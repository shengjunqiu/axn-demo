import { disasterWorkspaceEvents } from '@/seed/disasterScenarios';
import { VUE_WORKSPACE_EVENTS } from '@/seed/vueWorkspaceEvents';
import { primaryLabelsForStage } from '@/services/agentFlow';
import { describe, expect, it } from 'vitest';
import {
  buildEventNextStepActions,
  buildEventSwitchBriefing,
  buildEventUnlinkBriefing,
  buildFollowUpNextStepActions,
  normalizeCompletedAction,
  resolveEventStage,
} from '@/services/eventSwitchBriefing';

describe('eventSwitchBriefing', () => {
  it('洪涝决口：力量投送中阶段给出投送场景操作', () => {
    const text = buildEventSwitchBriefing('evt-sim-breach');
    expect(text).toContain('已切换关联灾情为「南湾堤段洪涝决口（模拟）（力量投送中）」');
    expect(text).toContain('【当前状态】');
    expect(text).toContain('· 建设场景：力量投送');
    expect(text).toContain('· 阶段：力量投送中');
    expect(text).toContain('洪涝决口');
    expect(text).toContain('【事件派发来源】');
    expect(text).toMatch(/· 任务来源：/);
    expect(text).not.toContain('【下一步建议】');

    const actions = buildEventNextStepActions('evt-sim-breach');
    expect(actions.map((item) => item.label)).toEqual(primaryLabelsForStage('力量投送中'));
    expect(actions.every((item) => item.kind === 'task')).toBe(true);
  });

  it('演示主事件：救援中阶段给出实施救援场景操作', () => {
    const text = buildEventSwitchBriefing('evt-demo-001');
    expect(text).toContain('已切换关联灾情为「清河段堤防险情」');
    expect(text).toContain('【当前状态】');
    expect(text).toContain('处置中（持续跟踪）');
    expect(text).toContain('建设场景：实施救援');
    expect(text).toContain('【事件派发来源】');
    expect(text).toContain('· 任务来源：集团应急指挥中心');
    expect(text).toContain('上级下发');

    const actions = buildEventNextStepActions('evt-demo-001');
    expect(actions.map((item) => item.label)).toEqual([
      '生成救援方案', '生成态势报告', '查询周边救援资源', '物资核验', '资源建议',
    ]);
  });

  it('三类实战灾种事件 briefing 含派发来源默认字段', () => {
    const text = buildEventSwitchBriefing('evt-sim-debris');
    expect(text).toContain('【事件派发来源】');
    expect(text).toMatch(/· 任务来源：/);
    expect(text).toMatch(/· 信息类型：/);
    expect(text).toMatch(/· 调用单位：/);
    expect(text).toMatch(/· 任务编号：/);
  });

  it('山体滑坡待研判：主推研判类操作', () => {
    const actions = buildEventNextStepActions('evt-sim-landslide');
    expect(actions.map((item) => item.label)).toEqual(primaryLabelsForStage('待研判'));
  });

  it('动作完成后给出与阶段对齐的后续建议', () => {
    expect(normalizeCompletedAction('汇总灾情摘要')).toBe('生成灾情摘要');
    expect(normalizeCompletedAction('复盘总结')).toBe('复盘总结');
    expect(normalizeCompletedAction('事件沉淀')).toBe('事件沉淀');
    expect(buildFollowUpNextStepActions('查询周边救援资源', 'evt-demo-001').map((item) => item.label)).toEqual([
      '生成救援方案',
    ]);
    expect(buildFollowUpNextStepActions('生成态势报告', 'evt-sim-landslide').map((item) => item.label)).not.toContain('生成态势报告');
    expect(buildFollowUpNextStepActions('生成救援方案', 'evt-sim-debris').map((item) => item.label)).not.toContain('生成救援方案');
  });

  it('所有演示事件按事件状态提供推荐', () => {
    for (const event of [...VUE_WORKSPACE_EVENTS, ...disasterWorkspaceEvents]) {
      expect(resolveEventStage(event.eventId)).toBe(event.stage);
      expect(buildEventNextStepActions(event.eventId).map(item => item.label).slice(0, primaryLabelsForStage(event.stage).length)).toEqual(primaryLabelsForStage(event.stage));
    }
  });

  it('取消关联：短提示不含状态块', () => {
    const text = buildEventUnlinkBriefing();
    expect(text).toContain('已取消关联灾情');
    expect(text).not.toContain('【当前状态】');
  });
});
