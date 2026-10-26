import { beforeEach, describe, expect, it } from 'vitest';
import {
  buildEventCaseSummary,
  runEventPrecipitation,
} from '@/services/eventPrecipitation';
import { useKnowledgeCaseStore } from '@/services/knowledgePublish';

describe('事件沉淀', () => {
  beforeEach(() => {
    useKnowledgeCaseStore.getState().resetAll();
  });

  it('汇总事件案例包含概况、成效、改进与适用边界', () => {
    const draft = buildEventCaseSummary('evt-sim-landslide');
    expect(draft.title).toMatch(/事件沉淀案例/);
    expect(draft.body).toMatch(/事件概况/);
    expect(draft.body).toMatch(/处置目标与成效/);
    expect(draft.body).toMatch(/可复用经验与改进/);
    expect(draft.body).toMatch(/适用边界/);
    expect(draft.tags).toEqual(expect.arrayContaining(['事件沉淀', '复盘', '演练参考']));
  });

  it('写入知识库待审案例，同事件再次沉淀为更新', () => {
    const first = runEventPrecipitation('evt-sim-landslide');
    expect(first.updated).toBe(false);
    expect(first.published.source).toBe('precipitation');
    expect(first.published.status).toBe('待审');
    expect(first.reply).toMatch(/知识库/);

    const second = runEventPrecipitation('evt-sim-landslide');
    expect(second.updated).toBe(true);
    expect(second.published.id).toBe(first.published.id);
    expect(useKnowledgeCaseStore.getState().casesForEvent('evt-sim-landslide')).toHaveLength(1);
  });
});
