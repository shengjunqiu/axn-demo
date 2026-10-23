import { describe, expect, it } from 'vitest';
import { buildMultiSourceSnapshot } from '@/services/multiSourceAggregation';
import { multiSourceFollowUp } from '@/services/multiSourceFollowUp';

describe('汇聚后的补充核实清单', () => {
  it('同类待核资料合并成业务问题，保留原始数量', () => {
    const snapshot = buildMultiSourceSnapshot('evt-sim-debris-review');
    const items = multiSourceFollowUp(snapshot.event.sources);
    expect(items).toHaveLength(3);
    expect(items.find(item => item.kind === '现场影像')?.count).toBe(3);
    expect(items.reduce((total, item) => total + item.count, 0)).toBe(6);
    expect(items.map(item => item.title)).toContain('确认地面和边坡是否安全');
    expect(JSON.stringify(items)).not.toContain('demo-source:');
  });
  it('已核实资料不再产生确认任务', () => {
    const sources = buildMultiSourceSnapshot('evt-sim-debris-review').event.sources;
    expect(multiSourceFollowUp(sources.map(source => ({ ...source, records: source.records.map(record => ({ ...record, verification: '来源已核（模拟）' as const })) })))).toEqual([]);
  });
});
