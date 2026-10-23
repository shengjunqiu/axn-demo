import { beforeEach, describe, expect, it, vi } from 'vitest';
import { applyMovements, evaluateRule, mergeReadings, parseSnapshot } from '@/services/customerOperations';
import type { Asset, Device, Movement, Reading, MonitorRule } from '@/services/customerOperations';
import { useCustomerOperations as store, startOperationsScheduler } from '@/store/customerOperationsStore';
import { analyzeMinutes, comparePlanAndSummary, dailySummarySections, tacticOptions } from '@/services/customerDocuments';
import { DISASTER_PROFILES } from '@/seed/disasterScenarios';
import { buildEventTimeline } from '@/services/eventTimeline';
const at = '2026-10-11T09:00:00+08:00';
const asset: Asset = { id: 'a', name: '泵', owner: '基地', quantity: 3, unit: '台' };
const device: Device = { id: 'd', name: '电量', assetId: 'a', eventId: 'e', metric: '电量', unit: '%' };
const reading: Reading = { id: 'r', deviceId: 'd', assetId: 'a', eventId: 'e', metric: '电量', unit: '%', value: 15, collectedAt: at, source: '设备采样' };
const movement: Movement = { id: 'm', assetId: 'a', direction: '出库', quantity: 2, unit: '台', occurredAt: at, source: '原库单' };
const rule: MonitorRule = { id: 'rule', name: '低电量', eventId: 'e', metric: '电量', operator: '<', threshold: 20, intervalSeconds: 5, staleMinutes: 10, enabled: true, target: '资源岗', lastRunAt: null };
beforeEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); store.getState().reset(); });
describe('客户需求操作闭环', () => {
  it('出库单幂等、冲突拒绝、库存不足不修改输入', () => {
    const result = applyMovements([asset], [], [movement, movement]);
    expect(applyMovements(result.assets, result.movements, [{ source: movement.source, occurredAt: movement.occurredAt, unit: movement.unit, quantity: movement.quantity, direction: movement.direction, assetId: movement.assetId, id: movement.id }]).added).toBe(0);
    expect(result.assets[0].quantity).toBe(1); expect(result.added).toBe(1); expect(asset.quantity).toBe(3);
    expect(() => applyMovements(result.assets, result.movements, [{ ...movement, quantity: 1 }])).toThrow('冲突');
    expect(() => applyMovements([asset], [], [{ ...movement, quantity: 4 }])).toThrow('超过');
  });
  it('迟到读数不覆盖最新记录，过期/未来不冒充正常', () => {
    const now = Date.parse(at);
    const older = { ...reading, id: 'old', value: 90, collectedAt: '2026-10-11T08:59:00+08:00' };
    const rows = mergeReadings([device], [reading], [older], now);
    expect(evaluateRule(rule, rows, now).result).toBe('预警');
    expect(evaluateRule(rule, rows, now + 700000).result).toBe('资料不足');
    expect(() => mergeReadings([device], [], [{ ...reading, collectedAt: '2026-10-11T09:05:00+08:00' }], now)).toThrow();
  });
  it('批次校验原子提交，库存失败不会先写采集数据', () => {
    store.getState().registerAsset(asset); store.getState().registerDevice(device);
    expect(() => store.getState().ingest([reading], [{ ...movement, quantity: 9 }])).toThrow();
    expect(store.getState().readings).toHaveLength(0); expect(store.getState().assets[0].quantity).toBe(3); expect(store.getState().issues).toHaveLength(1);
    expect(() => parseSnapshot({ readings: [] })).toThrow();
  });
  it('自动运行、事件隔离、重复去重和新读数取消旧回执', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(at));
    store.getState().registerAsset(asset); store.getState().registerDevice(device); store.getState().ingest([reading], []); store.getState().addRule(rule);
    const stop = startOperationsScheduler(); vi.advanceTimersByTime(6000);
    expect(store.getState().notices).toHaveLength(1); expect(store.getState().runs.length).toBeGreaterThan(1);
    store.getState().addRule({ ...rule, id: 'other', eventId: 'other' }); store.getState().tick(Date.now(), true);
    expect(store.getState().notices).toHaveLength(1);
    store.setState({ notices: store.getState().notices.map(n => ({ ...n, externalStatus: '已确认接收', receipt: 'old' })) });
    store.getState().ingest([{ ...reading, id: 'next', collectedAt: new Date().toISOString(), value: 10 }], []); store.getState().tick(Date.now(), true);
    expect(store.getState().notices[0].externalStatus).toBe('未发送'); expect(store.getState().notices[0].receipt).toBe(''); stop();
  });
  it('同指标多个设备分别通知，已绑定缺测不能判整体正常', () => {
    vi.useFakeTimers(); vi.setSystemTime(new Date(at));
    store.getState().registerAsset(asset); store.getState().registerDevice(device); store.getState().registerDevice({ ...device, id: 'd2' });
    store.getState().ingest([{ ...reading, value: 90 }], []); store.getState().addRule(rule); store.getState().tick(Date.parse(at), true);
    expect(store.getState().runs[0].result).toBe('资料不足');
    store.getState().ingest([{ ...reading, id: 'low1', collectedAt: '2026-10-11T09:00:01+08:00' }, { ...reading, id: 'low2', deviceId: 'd2', collectedAt: '2026-10-11T09:00:01+08:00' }], []);
    store.getState().tick(Date.parse(at) + 1000, true); expect(store.getState().notices).toHaveLength(2);
  });
  it('通知只有有效回执才确认，知识发布区分接收与索引', async () => {
    vi.setSystemTime(new Date(at)); store.getState().registerAsset(asset); store.getState().registerDevice(device); store.getState().ingest([reading], []); store.getState().addRule(rule); store.getState().tick(Date.parse(at), true);
    store.getState().configure({ snapshot: '', notification: 'https://gateway.example/notify', knowledge: 'https://gateway.example/knowledge', enabled: false, pollSeconds: 30 });
    const fetch = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ success: true }) }); vi.stubGlobal('fetch', fetch);
    const id = store.getState().notices[0].id; await store.getState().sendNotice(id); expect(store.getState().notices[0].externalStatus).toBe('发送失败');
    fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'receipt', status: 'accepted' }) }); await store.getState().sendNotice(id); expect(store.getState().notices[0].externalStatus).toBe('已确认接收');
    fetch.mockResolvedValue({ ok: true, json: async () => ({ id: 'knowledge', indexed: false }) }); await store.getState().publish('case', { eventId: 'e', title: '总结', body: '记录', tags: [] }); expect(store.getState().publications[0].status).toBe('已发布待索引');
  });
  it('完整时间轴标出缺环节且不混其他事件', () => {
    store.getState().ingest([], [], [{ id: 't', eventId: 'e', stage: '接报', occurredAt: at, detail: '接报回执', source: '电话记录' }]);
    const view = buildEventTimeline('e'); expect(view.items).toHaveLength(7); expect(view.items.filter(i => i.tone === 'pending')).toHaveLength(6); expect(buildEventTimeline('other').notice).toContain('模拟');
  });
  it('纪要和总结保留依据、不把未完成和未确认当成果', () => {
    const text = '10:00 未确认采购\n09:00 完成设备核验\n11:00 未完成运输\n12:00 决定张三负责提交报告';
    const minutes = analyzeMinutes(text, '2026-10-11'); expect(minutes.records[0].line).toBe(2); expect(minutes.decisionText).not.toContain('未确认'); expect(minutes.decisionText).not.toContain('未完成');
    const summary = dailySummarySections('工作', '2026-10-11', text, ''); expect(summary[2][1]).not.toContain('未完成'); expect(summary[2][1]).toContain('原文第2行');
  });
  it('专业方案按灾种不同，对照文字相似仍待复核', () => {
    expect(tacticOptions(DISASTER_PROFILES[0].eventId)[0].name).not.toBe(tacticOptions(DISASTER_PROFILES[1].eventId)[0].name);
    expect(comparePlanAndSummary('组织道路抢通', '道路抢通尚未完成')[0].result).toBe('有相关记录待复核');
    expect(comparePlanAndSummary('组织道路抢通', '设备入库')[0].result).toBe('缺少对应证据');
  });
});
