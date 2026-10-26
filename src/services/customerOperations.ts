/** 资源/监测流程的业务规则。来源、失败和缺资料均保留，不伪造外部回执。 */
export type Asset = { id: string; name: string; owner: string; quantity: number; unit: string };
export type Device = { id: string; assetId: string; name: string; metric: string; unit: string; eventId: string };
export type Reading = { id: string; deviceId: string; assetId: string; eventId: string; metric: string; value: number; unit: string; collectedAt: string; source: string };
export type Movement = { id: string; assetId: string; direction: '入库' | '出库'; quantity: number; unit: string; occurredAt: string; source: string };
export type TimelineRecord = { id: string; eventId: string; stage: string; occurredAt: string; detail: string; source: string };
export const RESCUE_STAGES = ['接报', '研判', '出动', '到场', '处置', '回撤', '复盘'] as const;
export type MonitorRule = { id: string; name: string; eventId: string; metric: string; operator: '>' | '<'; threshold: number; intervalSeconds: number; staleMinutes: number; enabled: boolean; target: string; lastRunAt: string | null };
export type Notice = { id: string; eventId: string; ruleId: string; target: string; text: string; createdAt: string; readingId: string; status: '待处理' | '已读' | '已处理'; externalStatus: '未发送' | '发送中' | '已确认接收' | '发送失败'; receipt: string };
export type RunLog = { id: string; ruleId: string; at: string; result: '预警' | '正常' | '资料不足'; detail: string };

function sameRecord(a: object, b: object): boolean {
  return [...new Set([...Object.keys(a), ...Object.keys(b)])].every(key => Reflect.get(a, key) === Reflect.get(b, key));
}

export function validTime(value: string): boolean {
  // 接口时间必须带日期及时区，避免浏览器所在地区改变业务顺序。
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/);
  if (!match || !Number.isFinite(Date.parse(value))) return false;
  const year = Number(match[1]); const month = Number(match[2]); const day = Number(match[3]);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate() && Number(match[4]) < 24 && Number(match[5]) < 60 && Number(match[6]) < 60;
}
export function applyMovements(assets: Asset[], existing: Movement[], incoming: Movement[]) {
  const next = assets.map(a => ({ ...a }));
  const movements = [...existing];
  let added = 0;
  for (const row of [...incoming].sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt))) {
    if (!row.id?.trim() || !row.source?.trim() || !validTime(row.occurredAt) || !Number.isFinite(row.quantity) || row.quantity <= 0 || !['入库', '出库'].includes(row.direction)) throw new Error('出入库记录标识、时间、方向或数量不合法');
    const previous = movements.find(m => m.id === row.id);
    if (previous) {
      if (!sameRecord(previous, row)) throw new Error(`单据 ${row.id} 内容冲突，需核对原始单据`);
      continue;
    }
    const asset = next.find(a => a.id === row.assetId);
    if (!asset || asset.unit !== row.unit) throw new Error(`单据 ${row.id} 未匹配物资或计量单位`);
    const latest = movements.filter(m => m.assetId === row.assetId).sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt))[0];
    if (latest && Date.parse(row.occurredAt) < Date.parse(latest.occurredAt)) throw new Error(`单据 ${row.id} 为迟到记录，需先核对库存基线`);
    const quantity = asset.quantity + (row.direction === '入库' ? row.quantity : -row.quantity);
    if (!Number.isFinite(quantity)) throw new Error(`单据 ${row.id} 数量超出可处理范围`);
    if (quantity < 0) throw new Error(`单据 ${row.id} 出库量超过本地可用库存`);
    asset.quantity = quantity;
    movements.push(row); added++;
  }
  return { assets: next, movements, added };
}

export function mergeReadings(devices: Device[], previous: Reading[], incoming: Reading[], now = Date.now()): Reading[] {
  const result = [...previous];
  for (const row of incoming) {
    const device = devices.find(d => d.id === row.deviceId);
    if (!row.id?.trim() || !device || device.assetId !== row.assetId || device.eventId !== row.eventId || device.metric !== row.metric || device.unit !== row.unit) throw new Error('采集记录与设备绑定关系或单位不一致');
    if (!row.source?.trim() || !validTime(row.collectedAt) || !Number.isFinite(row.value) || Date.parse(row.collectedAt) > now + 60_000) throw new Error('采集值或采集时间不合法');
    const duplicate = result.find(r => r.id === row.id);
    if (duplicate) {
      if (!sameRecord(duplicate, row)) throw new Error(`采集记录 ${row.id} 内容冲突`);
      continue;
    }
    // 保留迟到原记录；最新读数按采集时间选取，不以接收顺序覆盖。
    result.push(row);
  }
  return result;
}

export function evaluateRule(rule: MonitorRule, readings: Reading[], now: number): Omit<RunLog, 'id'> & { reading?: Reading } {
  const candidates = readings.filter(r => r.eventId === rule.eventId && r.metric === rule.metric);
  const latestByDevice = new Map<string, Reading>();
  for (const row of candidates) {
    if (!latestByDevice.has(row.deviceId) || Date.parse(row.collectedAt) > Date.parse(latestByDevice.get(row.deviceId)!.collectedAt)) latestByDevice.set(row.deviceId, row);
  }
  const fresh = [...latestByDevice.values()].filter(r => now >= Date.parse(r.collectedAt) && now - Date.parse(r.collectedAt) <= rule.staleMinutes * 60_000);
  const matching = fresh.find(r => rule.operator === '>' ? r.value > rule.threshold : r.value < rule.threshold);
  const result = matching ? '预警' : !fresh.length || fresh.length !== latestByDevice.size ? '资料不足' : '正常';
  const detail = matching ? `${matching.deviceId} ${matching.metric}=${matching.value}${matching.unit}，命中 ${rule.operator}${rule.threshold}${matching.unit}；来源 ${matching.source}，采集时间 ${matching.collectedAt}` : result === '正常' ? `已检查${fresh.length}个设备最新读数，未命中本规则` : '缺少有效读数或部分数据过期；不能判定整体正常';
  return { ruleId: rule.id, at: new Date(now).toISOString(), result, detail, reading: matching };
}

export function validateRule(rule: MonitorRule) {
  if (!rule.id.trim() || !['>', '<'].includes(rule.operator) || !rule.name.trim() || !rule.eventId.trim() || !rule.target.trim() || !rule.metric.trim() || !Number.isFinite(rule.threshold) || !Number.isFinite(rule.intervalSeconds) || rule.intervalSeconds < 5 || !Number.isFinite(rule.staleMinutes) || rule.staleMinutes <= 0) throw new Error('请填写规则、关联事件和责任岗位；执行间隔至少5秒，有效期必须大于0');
}

export function mergeTimeline(existing: TimelineRecord[], incoming: TimelineRecord[]) {
  const next = [...existing];
  for (const row of incoming) {
    if (!row.id?.trim() || !row.eventId?.trim() || !RESCUE_STAGES.some(s => s === row.stage) || !row.detail?.trim() || !row.source?.trim() || !validTime(row.occurredAt)) throw new Error('时间轴记录需提供标识、事件、环节、带时区时间、内容及来源');
    const previous = next.find(r => r.id === row.id);
    if (previous && !sameRecord(previous, row)) throw new Error(`时间轴记录 ${row.id} 内容冲突`);
    if (!previous) next.push(row);
  }
  return next.sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));
}

export type Connection = { snapshot: string; notification: string; knowledge: string; pollSeconds: number; enabled: boolean };
export const EMPTY_CONNECTION: Connection = { snapshot: '', notification: '', knowledge: '', pollSeconds: 30, enabled: false };
export function connectionUrl(raw: string): string {
  if (!raw.trim()) throw new Error('尚未配置接口地址');
  const origin = typeof window === 'undefined' ? 'http://localhost' : window.location.origin;
  const url = new URL(raw, origin);
  if (url.username || url.password || (url.protocol !== 'https:' && !(url.origin === origin && url.protocol === 'http:'))) throw new Error('接口必须为同源地址或HTTPS，且不能在地址内包含账号密码');
  return url.href;
}
export async function requestConnection(raw: string, payload?: unknown): Promise<unknown> {
  const response = await fetch(connectionUrl(raw), { method: payload === undefined ? 'GET' : 'POST', credentials: 'same-origin', headers: payload === undefined ? undefined : { 'Content-Type': 'application/json' }, body: payload === undefined ? undefined : JSON.stringify(payload), signal: AbortSignal.timeout(12_000) });
  if (!response.ok) throw new Error(`接口返回HTTP ${response.status}`);
  return response.json();
}

export function parseSnapshot(raw: unknown): { readings: Reading[]; movements: Movement[]; timeline: TimelineRecord[] } {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) throw new Error('接口应返回数据对象');
  const data = raw as Record<string, unknown>;
  for (const key of ['readings', 'movements', 'timeline']) if ((!Array.isArray(data[key]) || (data[key] as unknown[]).length > 10000)) throw new Error(`缺少 ${key} 数组，未更新本地数据`);
  // 逐字段白名单映射，后续业务校验再核对值、映射和时效。
  const text = (o: Record<string, unknown>, k: string) => typeof o[k] === 'string' ? o[k] as string : '';
  const object = (v: unknown) => { if (!v || typeof v !== 'object' || Array.isArray(v)) throw new Error('数据行格式错误'); return v as Record<string, unknown>; };
  const readings = (data.readings as unknown[]).map(v => { const o = object(v); return { id: text(o, 'id'), deviceId: text(o, 'deviceId'), assetId: text(o, 'assetId'), eventId: text(o, 'eventId'), metric: text(o, 'metric'), unit: text(o, 'unit'), value: typeof o.value === 'number' ? o.value : NaN, collectedAt: text(o, 'collectedAt'), source: text(o, 'source') }; });
  const movements = (data.movements as unknown[]).map(v => { const o = object(v); return { id: text(o, 'id'), assetId: text(o, 'assetId'), direction: text(o, 'direction') as Movement['direction'], quantity: typeof o.quantity === 'number' ? o.quantity : NaN, unit: text(o, 'unit'), occurredAt: text(o, 'occurredAt'), source: text(o, 'source') }; });
  const timeline = (data.timeline as unknown[]).map(v => { const o = object(v); return { id: text(o, 'id'), eventId: text(o, 'eventId'), stage: text(o, 'stage'), occurredAt: text(o, 'occurredAt'), detail: text(o, 'detail'), source: text(o, 'source') }; });
  return { readings, movements, timeline };
}
