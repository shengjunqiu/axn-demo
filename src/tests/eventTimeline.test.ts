import { describe, expect, it } from 'vitest';
import { buildEventTimeline, formatTimelineForDocument } from '@/services/eventTimeline';
import { splitPipeContent } from '@/services/pipeTable';

describe('eventTimeline', () => {
  it('洪涝决口：含模拟接报与监测节点，文书侧输出表格', () => {
    const view = buildEventTimeline('evt-sim-breach');
    expect(view.stageLabel).toBe('力量投送中');
    expect(view.items.some((item) => item.title === '模拟接报')).toBe(true);
    expect(view.items.length).toBeGreaterThan(2);
    const text = formatTimelineForDocument('evt-sim-breach');
    const blocks = splitPipeContent(text);
    expect(blocks.some((block) => block.kind === 'table')).toBe(true);
  });

  it('清河段堤防：用水情观测序列展开时间轴', () => {
    const view = buildEventTimeline('evt-demo-001');
    expect(view.items.some((item) => item.title === '事件接报')).toBe(true);
    expect(view.items.some((item) => item.title === '水位监测')).toBe(true);
    expect(view.items.some((item) => item.detail.includes('米'))).toBe(true);
  });

  it('山体滑坡：文书侧输出过程时间轴表格', () => {
    const view = buildEventTimeline('evt-sim-landslide');
    expect(view.stageLabel).toBe('待研判');
    expect(view.items.some((item) => item.title === '模拟接报')).toBe(true);
    const text = formatTimelineForDocument('evt-sim-landslide');
    const blocks = splitPipeContent(text);
    const table = blocks.find((block) => block.kind === 'table');
    expect(table?.kind).toBe('table');
    if (table?.kind === 'table') {
      expect(table.headers).toEqual(['序号', '时间节点', '环节', '记录详情', '状态']);
      expect(table.rows.length).toBeGreaterThan(2);
    }
  });
});
