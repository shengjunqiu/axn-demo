import { DISASTER_PROFILES } from '@/seed/disasterScenarios';
import { beforeEach, describe, expect, it } from 'vitest';
import { buildMultiSourceSnapshot, aggregationCounts, multiSourceMaterial } from '@/services/multiSourceAggregation';
import { useDemoStore } from '@/store/demoStore';
import { shift, incidentById } from '@/seed/scenario';
import { shiftEventIds } from '@/services/factLookup';

beforeEach(() => useDemoStore.getState().reset());
describe('六源汇聚', () => {
  it('归并同一事件的重复转发并保留原来源，待核样例不改成已核', () => {
    const snapshot = buildMultiSourceSnapshot('evt-demo-001');
    const counts = aggregationCounts(snapshot.event.sources);
    expect(counts.covered).toBe(6);
    expect(counts.raw - counts.merged).toBe(1);
    const publicRecords = snapshot.event.sources.find(s => s.kind === '舆情')!.records;
    expect(publicRecords[1].duplicateOf).toBe(publicRecords[0].id);
    expect(publicRecords.every(r => r.verification === '待核实')).toBe(true);
    expect(snapshot.event.sources.flatMap(s => s.records).every(r => r.refs.length > 0)).toBe(true);
  });
  it('其他事件使用独立的六源模拟记录，不复用首个事件的样例', () => {
    const snapshot = buildMultiSourceSnapshot('evt-demo-002');
    for (const kind of ['舆情', '气象', '地质', '现场影像']) {
      const records = snapshot.event.sources.find(s => s.kind === kind)!.records;
      expect(records.length).toBeGreaterThan(0);
      expect(records.every(record => record.id.startsWith('evt-demo-002'))).toBe(true);
      expect(records.every(record => record.source.includes('模拟'))).toBe(true);
    }
    expect(JSON.stringify(snapshot.event)).not.toContain('evt-demo-001');
  });
  it('数据域汇总只含已有值班授权清单，未知事件不取得跨域记录', () => {
    const snapshot = buildMultiSourceSnapshot('evt-demo-001');
    expect(snapshot.domainEvents.map(e => e.eventId)).toEqual(shiftEventIds(shift.shiftId));
    expect(snapshot.domainEvents.every(e => incidentById.get(e.eventId)?.orgId === shift.orgId)).toBe(true);
    const unknown = buildMultiSourceSnapshot('missing-event');
    expect(unknown.domainEvents).toEqual([]);
    expect(aggregationCounts(unknown.event.sources).raw).toBe(0);
  });
  it('成文保留六源覆盖、来源、待核与全域接入边界', () => {
    const material = multiSourceMaterial(buildMultiSourceSnapshot('evt-demo-001'));
    expect(material.table.rows).toHaveLength(6);
    expect(material.section.text).toContain('全域接口待接入');
    expect(material.section.text).toContain('未接入视觉模型');
    expect(material.section.text).toContain('待核实');
  });
});

it('三类实战灾种态势报告均覆盖六类来源，保留事件独立引用和模拟标识', () => {
  for (const profile of DISASTER_PROFILES) {
    const snapshot = buildMultiSourceSnapshot(profile.eventId);
    expect(aggregationCounts(snapshot.event.sources).covered).toBe(6);
    expect(snapshot.event.sources.every(group => group.records.length > 0)).toBe(true);
    expect(multiSourceMaterial(snapshot).table.rows.every(row => row[2] !== '0/0')).toBe(true);
    expect(snapshot.event.sources.flatMap(group => group.records).every(record => record.refs.length > 0)).toBe(true);
  }
});

 it('当前有权查看但未在值班种子清单的事件也进入汇聚域', () => {
  const profile = DISASTER_PROFILES[0];
  const snapshot = buildMultiSourceSnapshot(profile.eventId);
  expect(snapshot.domainEvents.some(event => event.eventId === profile.eventId)).toBe(true);
  expect(new Set(snapshot.domainEvents.map(event => event.eventId)).size).toBe(snapshot.domainEvents.length);
 });
