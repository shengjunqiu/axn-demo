import { describe, expect, it } from 'vitest';
import {
  buildEventNextStepActions,
  buildEventSwitchBriefing,
  buildEventUnlinkBriefing,
  buildFollowUpNextStepActions,
  normalizeCompletedAction,
} from '@/services/eventSwitchBriefing';

describe('eventSwitchBriefing', () => {
  it('Vue 建设场景事件：含场景与阶段；下一步为场景关键操作', () => {
    const text = buildEventSwitchBriefing('evt-vue-nl08');
    expect(text).toContain('已切换关联灾情为「武陵大道立交下穿城市内涝（救援中）」');
    expect(text).toContain('【当前状态】');
    expect(text).toContain('· 建设场景：实施救援');
    expect(text).toContain('· 阶段：救援中');
    expect(text).toContain('城市内涝');
    expect(text).toContain('【事件派发来源】');
    expect(text).toContain('· 任务来源：工程局上报');
    expect(text).toContain('· 信息类型：同步信息');
    expect(text).toContain('· 发送单位：');
    expect(text).toContain('· 填报单位：');
    expect(text).toContain('· 调用单位：');
    expect(text).not.toContain('【下一步建议】');

    const actions = buildEventNextStepActions('evt-vue-nl08');
    expect(actions.map((item) => item.label)).toEqual([
      '生成救援方案',
      '生成应急要情',
      '核对资源状态',
      '返回力量投送',
      '补充态势研判',
    ]);
    expect(actions.every((item) => item.kind === 'task')).toBe(true);
    expect(actions.find((item) => item.label === '返回力量投送')?.payload).toBe('查询周边救援资源');
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
      '生成救援方案',
      '生成应急要情',
      '核对资源状态',
      '返回力量投送',
      '补充态势研判',
    ]);
  });

  it('十类灾种事件 briefing 含派发来源默认字段', () => {
    const text = buildEventSwitchBriefing('evt-sim-debris');
    expect(text).toContain('【事件派发来源】');
    expect(text).toMatch(/· 任务来源：/);
    expect(text).toMatch(/· 信息类型：/);
    expect(text).toMatch(/· 调用单位：/);
    expect(text).toMatch(/· 任务编号：/);
  });

  it('待复盘阶段：评估效果 / 工作总结 / 回环研判', () => {
    const actions = buildEventNextStepActions('evt-vue-g5513');
    expect(actions.map((item) => item.label)).toEqual([
      '评估救援效果',
      '生成工作总结',
      '生成全面总结',
      '补充态势研判',
    ]);
  });

  it('动作完成后给出与阶段对齐的后续建议', () => {
    expect(normalizeCompletedAction('汇总灾情摘要')).toBe('生成灾情摘要');
    expect(buildFollowUpNextStepActions('查询周边救援资源', 'evt-demo-001').map((item) => item.label)).toEqual([
      '生成救援方案',
      '核对资源状态',
    ]);
    expect(buildFollowUpNextStepActions('评估救援效果', 'evt-vue-g5513').map((item) => item.label)).toEqual([
      '生成工作总结',
      '打开文书箱',
    ]);
    expect(buildFollowUpNextStepActions('生成工作总结 · 复盘评估分析', 'evt-vue-g5513').map((item) => item.label)).toEqual([
      '打开文书箱',
    ]);
  });

  it('取消关联：短提示不含状态块', () => {
    const text = buildEventUnlinkBriefing();
    expect(text).toContain('已取消关联灾情');
    expect(text).not.toContain('【当前状态】');
  });
});
