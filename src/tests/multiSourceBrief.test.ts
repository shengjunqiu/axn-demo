import { describe, expect, it } from 'vitest';
import { multiSourceBrief } from '@/services/multiSourceBrief';
import { buildMultiSourceSnapshot } from '@/services/multiSourceAggregation';
import { incidents } from '@/seed/scenario';

describe('六源简短概述', () => {
  it('各事件六项概述不超过30字，不直接堆放时间序列', () => {
    for (const incident of incidents) {
      for (const source of buildMultiSourceSnapshot(incident.eventId).event.sources) {
        const brief = multiSourceBrief(source, incident.eventId);
        expect(Array.from(brief).length).toBeLessThanOrEqual(30);
        expect(brief).not.toMatch(/\d{2}:\d{2}/);
      }
    }
  });
  it('缺失来源不声称已汇聚，影像不声称已识别', () => {
    const source = buildMultiSourceSnapshot('evt-demo-001').event.sources.find(source => source.kind === '现场影像')!;
    expect(multiSourceBrief(source, 'evt-sim-debris')).toContain('通行');
    expect(multiSourceBrief(source, 'evt-sim-landslide')).toContain('滑坡');
    expect(multiSourceBrief({ ...source, records: [] })).toContain('暂无可用资料');
  });
});
