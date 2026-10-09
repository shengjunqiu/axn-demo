import { describe, expect, it } from 'vitest';
import { buildEventTimeline } from '@/services/eventTimeline';

describe('eventTimeline', () => {
  it('武陵大道内涝：含接报与水位监测节点', () => {
    const view = buildEventTimeline('evt-vue-nl08');
    expect(view.stageLabel).toBe('救援中');
    expect(view.items.some((item) => item.title === '接报')).toBe(true);
    expect(view.items.filter((item) => item.title === '水位监测')).toHaveLength(3);
    expect(view.items.at(-1)?.tone).toBe('pending');
  });

  it('清河段堤防：用水情观测序列展开时间轴', () => {
    const view = buildEventTimeline('evt-demo-001');
    expect(view.items.some((item) => item.title === '事件接报')).toBe(true);
    expect(view.items.some((item) => item.title === '水位监测')).toBe(true);
    expect(view.items.some((item) => item.detail.includes('米'))).toBe(true);
  });
});
