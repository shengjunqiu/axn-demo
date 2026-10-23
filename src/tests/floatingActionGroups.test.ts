import { describe, expect, it } from 'vitest';
import { floatingActionGroups } from '@/services/floatingActionGroups';
import { stageChoices } from '@/services/stageConversation';
import { STAGE_ORDER } from '@/services/agentFlow';
import { CONVERSATION_ONLY_ACTIONS } from '@/seed/agentQuickTasks';

describe('悬浮清单按事件发展顺序排序', () => {
  it.each(STAGE_ORDER)('%s不改变业务顺序，所有原入口保留且不重复', stage => {
    const groups = floatingActionGroups(stage);
    expect(groups.slice(0, 6).map(group => group.label.replace(' · 当前阶段', ''))).toEqual(['了解区域灾情', '灾情研判', '力量投送', '现场救援', '撤收与复盘', '归档与经验沉淀']);
    const ids = groups.flatMap(group => group.options.map(option => option.id));
    expect(new Set(ids).size).toBe(ids.length);
    for (const option of stageChoices(stage).flatMap(group => group.options)) expect(ids).toContain(option.id);
    for (const action of CONVERSATION_ONLY_ACTIONS) expect(ids).toContain(`legacy-quick:${action}`);
    expect(groups.filter(group => group.label.includes('当前阶段'))).toHaveLength(1);
  });
  it('资源查询位于投送阶段，复盘操作位于救援之后', () => {
    const groups = floatingActionGroups('待复盘');
    expect(groups[2].options.some(option => option.id === 'fuzzy-resource-search')).toBe(true);
    expect(groups[4].options.some(option => option.id === 'legacy-quick:七环节救援时间轴')).toBe(true);
    expect(groups.at(-1)?.label).toBe('异常与意图确认示例');
  });
  it('未关联事件时不标记当前阶段', () => {
    expect(floatingActionGroups(null).some(group => group.label.includes('当前阶段'))).toBe(false);
  });
});
