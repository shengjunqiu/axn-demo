import { expect, it } from 'vitest';
import { stageChoices } from '@/services/stageConversation';
import { recognize } from '@/services/mock/provider';
it('各阶段常见提问保留破拆能力查询入口，完整问题与短句均识别为资源检索', () => {
  for (const stage of ['待研判', '力量投送中', '救援中', '待复盘', '已归档'] as const) {
    const question = stageChoices(stage)[0].options.find(q => q.id === 'fuzzy-resource-search')!;
    expect(question.capability).toBe('search');
    expect(recognize(question.prompt, { lastResourceResultIds: [], candidateResourceIds: [] }).intent).toBe('resource_query');
  }
  expect(recognize('需要能破拆的装备', { lastResourceResultIds: [], candidateResourceIds: [] }).params.capability).toBe('search');
});
