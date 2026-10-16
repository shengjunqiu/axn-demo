import { describe, expect, it } from 'vitest';
import { floatingActionGroups } from '@/services/floatingActionGroups';
import { stageChoices } from '@/services/stageConversation';
import { STAGE_ORDER } from '@/services/agentFlow';
import { LEGACY_QUICK_ACTIONS } from '@/seed/quickActionCatalog';

describe('悬浮清单按事件阶段排序', () => {
  it.each(STAGE_ORDER)('%s将本阶段问题前置，保留全部原有入口', stage => {
    const groups = floatingActionGroups(stage);
    expect(groups[0].label).toBe(`${stage}相关提问`);
    expect(groups[0].options.map(option => option.id)).toEqual(stageChoices(stage)[0].options.map(option => option.id));
    const ids = groups.flatMap(group => group.options.map(option => option.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const option of stageChoices(stage).flatMap(group => group.options)) expect(ids).toContain(option.id);
    for (const action of LEGACY_QUICK_ACTIONS) expect(ids).toContain(`legacy-quick:${action}`);
  });
  it('投送与复盘阶段优先操作不同，异常材料始终靠后', () => {
    const delivery = floatingActionGroups('力量投送中');
    const review = floatingActionGroups('待复盘');
    expect(delivery[1].options[0].prompt).toBe('生成周边资源报告');
    expect(review[1].options[0].prompt).toBe('七环节救援时间轴');
    expect(review.at(-1)?.label).toBe('异常与意图确认示例');
  });
  it('无绑定事件时不假定事件阶段', () => {
    expect(floatingActionGroups(null)[0].label).toContain('未关联事件');
    expect(floatingActionGroups(null).some(group => group.label === '当前阶段快捷操作')).toBe(false);
  });
});
