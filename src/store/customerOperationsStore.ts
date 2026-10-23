import { create } from 'zustand';
import { loadPersist, schedulePersist, clearPersist } from './persistence';
import { applyMovements, mergeReadings, mergeTimeline, evaluateRule, validateRule, parseSnapshot, requestConnection, EMPTY_CONNECTION } from '@/services/customerOperations';
import type { Asset, Device, Reading, Movement, TimelineRecord, MonitorRule, Notice, RunLog, Connection } from '@/services/customerOperations';

export type DataIssue = { id: string; at: string; detail: string; status: '待核对' | '已复核'; source: string };
type Publication = { caseId: string; status: '发布中' | '发布失败' | '已发布待索引' | '索引可用'; receipt: string };
type Data = { assets: Asset[]; devices: Device[]; readings: Reading[]; movements: Movement[]; timeline: TimelineRecord[]; rules: MonitorRule[]; notices: Notice[]; runs: RunLog[]; issues: DataIssue[]; connection: Connection; syncAt: string; syncError: string; publications: Publication[] };
const empty = (): Data => ({ assets: [], devices: [], readings: [], movements: [], timeline: [], rules: [], notices: [], runs: [], issues: [], connection: { ...EMPTY_CONNECTION }, syncAt: '', syncError: '', publications: [] });
type State = Data & {
  registerAsset: (asset: Asset) => void; registerDevice: (device: Device) => void;
  ingest: (readings: Reading[], movements: Movement[], timeline?: TimelineRecord[]) => void;
  addRule: (rule: MonitorRule) => void; toggleRule: (id: string, enabled: boolean) => void;
  tick: (now?: number, force?: boolean) => void;
  markNotice: (id: string, status: Notice['status']) => void;
  resolveIssue: (id: string) => void;
  configure: (connection: Connection) => void; sync: () => Promise<void>;
  sendNotice: (id: string) => Promise<void>;
  publish: (caseId: string, payload: { eventId: string; title: string; body: string; tags: string[] }) => Promise<void>;
  sample: (eventId: string) => void; reset: () => void;
};
let syncing = false;
const sending = new Set<string>();
const publishing = new Set<string>();
const restored = loadPersist<Data>('customerOperations');
if (restored) {
  restored.notices = restored.notices.map(n => n.externalStatus === '发送中' ? { ...n, externalStatus: '发送失败', receipt: '上次发送被中断，请核对回执后重试' } : n);
  restored.publications = restored.publications.map(p => p.status === '发布中' ? { ...p, status: '发布失败', receipt: '上次发布被中断，请核对正式库后重试' } : p);
}
export const useCustomerOperations = create<State>()((set, get) => ({
  ...empty(), ...restored,
  registerAsset: asset => {
    if (!asset.id.trim() || !asset.name.trim() || !asset.owner.trim() || !asset.unit.trim() || !Number.isFinite(asset.quantity) || asset.quantity < 0) throw new Error('物资标识、名称、归属、单位及非负库存必填');
    if (get().assets.some(a => a.id === asset.id)) throw new Error('物资已登记；库存变更请通过出入库记录');
    set(s => ({ assets: [...s.assets, asset] }));
  },
  registerDevice: device => {
    if (!device.id.trim() || !device.name.trim() || !device.eventId.trim() || !device.metric.trim() || !device.unit.trim() || !get().assets.some(a => a.id === device.assetId)) throw new Error('请绑定已登记物资，并填写设备、事件、采集指标及单位');
    if (get().devices.some(d => d.id === device.id)) throw new Error('设备已绑定，不能重复登记');
    set(s => ({ devices: [...s.devices, device] }));
  },
  ingest: (readings, incoming, timeline = []) => {
    try {
      const state = get();
      const merged = mergeReadings(state.devices, state.readings, readings);
      const updated = applyMovements(state.assets, state.movements, incoming);
      const mergedTimeline = mergeTimeline(state.timeline, timeline);
      // 三类数据全部校验通过才提交，避免接口部分失败却显示同步成功。
      set({ assets: updated.assets, movements: updated.movements, readings: merged, timeline: mergedTimeline, syncAt: new Date().toISOString(), syncError: '' });
    } catch (error) {
      const detail = error instanceof Error ? error.message : '数据校验失败';
      set(s => ({ syncError: detail, issues: s.issues.some(i => i.detail === detail && i.status === '待核对') ? s.issues : [{ id: crypto.randomUUID(), at: new Date().toISOString(), detail, status: '待核对', source: '数据接收/库存对账' }, ...s.issues] }));
      throw error;
    }
  },
  addRule: rule => { validateRule(rule); set(s => ({ rules: s.rules.some(r => r.id === rule.id) ? s.rules.map(r => r.id === rule.id ? { ...rule, lastRunAt: null } : r) : [...s.rules, rule] })); },
  toggleRule: (id, enabled) => set(s => ({ rules: s.rules.map(r => r.id === id ? { ...r, enabled, lastRunAt: null } : r) })),
  tick: (now = Date.now(), force = false) => {
    const state = get();
    const due = state.rules.filter(r => r.enabled && (force || !r.lastRunAt || now - Date.parse(r.lastRunAt) >= r.intervalSeconds * 1000));
    if (!due.length) return;
    const notices = [...state.notices];
    const logs: RunLog[] = [];
    for (const rule of due) {
      const result = evaluateRule(rule, state.readings, now);
      const missingDevices = state.devices.filter(d => d.eventId === rule.eventId && d.metric === rule.metric && !state.readings.some(r => r.deviceId === d.id));
      logs.push({ id: crypto.randomUUID(), ruleId: rule.id, at: result.at, result: result.result === '正常' && missingDevices.length ? '资料不足' : result.result, detail: `${result.detail}${missingDevices.length ? `；${missingDevices.length}个已绑定设备尚无采集记录` : ''}` });
      // 检查每个设备，不能只通知第一个异常设备。
      const latest = new Map<string, Reading>();
      for (const reading of state.readings.filter(r => r.eventId === rule.eventId && r.metric === rule.metric)) if (!latest.has(reading.deviceId) || Date.parse(reading.collectedAt) > Date.parse(latest.get(reading.deviceId)!.collectedAt)) latest.set(reading.deviceId, reading);
      for (const reading of latest.values()) {
        const hit = evaluateRule(rule, [reading], now);
        if (hit.result !== '预警' || notices.some(n => n.ruleId === rule.id && n.readingId === reading.id)) continue;
        const active = notices.findIndex(n => n.ruleId === rule.id && n.eventId === rule.eventId && n.status !== '已处理' && state.readings.find(r => r.id === n.readingId)?.deviceId === reading.deviceId);
        if (active >= 0) notices[active] = { ...notices[active], readingId: reading.id, text: hit.detail, status: '待处理', externalStatus: '未发送', receipt: '' };
        else notices.unshift({ id: crypto.randomUUID(), eventId: rule.eventId, ruleId: rule.id, target: rule.target, text: hit.detail, createdAt: new Date(now).toISOString(), readingId: reading.id, status: '待处理', externalStatus: '未发送', receipt: '' });
      }
    }
    set({ notices, runs: [...logs, ...state.runs].slice(0, 500), rules: state.rules.map(r => due.some(d => d.id === r.id) ? { ...r, lastRunAt: new Date(now).toISOString() } : r) });
  },
  markNotice: (id, status) => set(s => ({ notices: s.notices.map(n => n.id === id ? { ...n, status } : n) })),
  resolveIssue: id => set(s => ({ issues: s.issues.map(i => i.id === id ? { ...i, status: '已复核' } : i) })),
  configure: connection => {
    if (!Number.isFinite(connection.pollSeconds) || connection.pollSeconds < 5) throw new Error('同步间隔至少5秒');
    if (connection.enabled && !connection.snapshot.trim()) throw new Error('自动同步前请填写数据接口');
    set({ connection });
  },
  sync: async () => {
    if (syncing) return;
    syncing = true;
    try {
      const payload = parseSnapshot(await requestConnection(get().connection.snapshot));
      get().ingest(payload.readings, payload.movements, payload.timeline);
    } catch (error) { const detail = error instanceof Error ? error.message : '同步失败'; set({ syncError: detail }); throw error; }
    finally { syncing = false; }
  },
  sendNotice: async id => {
    if (sending.has(id)) return;
    const notice = get().notices.find(n => n.id === id);
    if (!notice || notice.externalStatus === '已确认接收') return;
    sending.add(id);
    const update = (next: Partial<Notice>) => set(s => ({ notices: s.notices.map(n => n.id === id && n.readingId === notice.readingId ? { ...n, ...next } : n) }));
    update({ externalStatus: '发送中', receipt: '' });
    try {
      const raw = await requestConnection(get().connection.notification, { idempotencyKey: `${notice.id}:${notice.readingId}`, eventId: notice.eventId, target: notice.target, text: notice.text }) as { id?: unknown; status?: unknown };
      if (!raw || typeof raw.id !== 'string' || !raw.id || raw.status !== 'accepted') throw new Error('通知接口未返回有效接收回执');
      update({ externalStatus: '已确认接收', receipt: raw.id });
    } catch (error) { update({ externalStatus: '发送失败', receipt: error instanceof Error ? error.message : '发送失败' }); }
    finally { sending.delete(id); }
  },
  publish: async (caseId, payload) => {
    if (publishing.has(caseId)) return;
    publishing.add(caseId);
    const update = (status: Publication['status'], receipt: string) => set(s => ({ publications: [...s.publications.filter(p => p.caseId !== caseId), { caseId, status, receipt }] }));
    update('发布中', '');
    try {
      const raw = await requestConnection(get().connection.knowledge, { idempotencyKey: caseId, ...payload }) as { id?: unknown; indexed?: unknown };
      if (!raw || typeof raw.id !== 'string' || !raw.id || typeof raw.indexed !== 'boolean') throw new Error('知识库接口缺少文档标识或索引回执');
      update(raw.indexed ? '索引可用' : '已发布待索引', raw.id);
    } catch (error) { update('发布失败', error instanceof Error ? error.message : '发布失败'); }
    finally { publishing.delete(caseId); }
  },
  sample: eventId => {
    const state = get();
    if (!state.assets.some(a => a.id === 'DEMO-PUMP')) get().registerAsset({ id: 'DEMO-PUMP', name: '排水泵（流程样例）', owner: '演示基地', quantity: 3, unit: '台' });
    const deviceId = `DEMO-${eventId}`;
    if (!get().devices.some(d => d.id === deviceId)) get().registerDevice({ id: deviceId, name: '电量传感器（流程样例）', assetId: 'DEMO-PUMP', eventId, metric: '电量', unit: '%' });
    get().ingest([{ id: crypto.randomUUID(), deviceId, assetId: 'DEMO-PUMP', eventId, metric: '电量', value: 15, unit: '%', collectedAt: new Date().toISOString(), source: '用户载入的流程样例' }], []);
  },
  reset: () => { clearPersist('customerOperations'); set(empty()); },
}));
useCustomerOperations.subscribe(s => schedulePersist('customerOperations', { assets: s.assets, devices: s.devices, readings: s.readings, movements: s.movements, timeline: s.timeline, rules: s.rules, notices: s.notices, runs: s.runs, issues: s.issues, connection: s.connection, syncAt: s.syncAt, syncError: s.syncError, publications: s.publications }));

/** 单个 App 实例只运行一个巡检循环；页面关闭期间由正式后台承接，浏览器不声称全天在线。 */
let leases = 0;
let timer: ReturnType<typeof setInterval> | undefined;
let lastSync = 0;
export function startOperationsScheduler() {
  leases++;
  if (!timer) timer = setInterval(() => {
    const store = useCustomerOperations.getState();
    store.tick();
    if (store.connection.enabled && Date.now() - lastSync >= store.connection.pollSeconds * 1000) {
      lastSync = Date.now();
      void store.sync().catch(() => { /* 失败已保留在接入状态，不刷假成功。 */ });
    }
  }, 1000);
  return () => { leases--; if (!leases && timer) { clearInterval(timer); timer = undefined; lastSync = 0; } };
}
