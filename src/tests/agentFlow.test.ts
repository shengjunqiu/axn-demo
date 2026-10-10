import { describe, expect, it } from 'vitest';
import {
  buildStageMismatchReply,
  computeStageAdvance,
  filterFollowUpLabels,
  isActionAheadOfStage,
  minStageForAction,
  primaryLabelsForStage,
  resolveScenarioId,
  scenarioForStage,
  splitQuickTasksByStage,
} from '@/services/agentFlow';

describe('agentFlow', () => {
  it('阶段映射到三场景', () => {
    expect(resolveScenarioId('待研判')).toBe('situation');
    expect(resolveScenarioId('力量投送中')).toBe('forceDelivery');
    expect(resolveScenarioId('救援中')).toBe('rescueOps');
    expect(scenarioForStage('待复盘').label).toBe('实施救援');
  });

  it('按阶段拆分快捷任务：主推与折叠', () => {
    const judgment = splitQuickTasksByStage('待研判');
    expect(judgment.scenarioLabel).toBe('灾情研判');
    expect(judgment.primary.map((item) => item.label)).toEqual(['生成灾情摘要', '生成态势报告', '核对道路天气']);
    expect(judgment.secondary.some((item) => item.label === '评估救援效果')).toBe(true);
    expect(judgment.secondary.some((item) => item.label === '生成灾情摘要')).toBe(false);
    expect(judgment.loopLabels).toEqual([]);

    const rescue = splitQuickTasksByStage('救援中');
    expect(rescue.primary.map((item) => item.label)).toEqual([
      '生成救援方案',
      '生成应急要情',
      '核对资源状态',
    ]);
    expect(rescue.primary.some((item) => item.label === '生成会议纪要')).toBe(false);
    expect(rescue.secondary.some((item) => item.label === '生成会议纪要')).toBe(false);
    expect(rescue.secondary.some((item) => item.label === '生成灾情摘要')).toBe(true);
    expect(rescue.loopLabels).toEqual(['返回力量投送', '补充态势研判']);

    const force = splitQuickTasksByStage('力量投送中');
    expect(force.primary.map((item) => item.label)).toEqual([
      '查询周边救援资源',
      '生成周边资源报告',
      '生成救援方案',
    ]);
    expect(force.secondary.some((item) => item.label === '生成应急要情')).toBe(true);
  });

  it('无阶段时全部进入折叠区', () => {
    const blank = splitQuickTasksByStage(null);
    expect(blank.primary).toEqual([]);
    expect(blank.secondary.length).toBeGreaterThan(0);
  });

  it('关键动作推进阶段并生成交接包', () => {
    const fromJudgment = computeStageAdvance('待研判', '生成灾情摘要', 'evt-x', 1);
    expect(fromJudgment.advanced).toBe(true);
    expect(fromJudgment.nextStage).toBe('力量投送中');
    expect(fromJudgment.handoff?.toScenario).toBe('forceDelivery');

    const fromForce = computeStageAdvance('力量投送中', '查询周边救援资源', 'evt-x', 2);
    expect(fromForce.nextStage).toBe('救援中');
    expect(fromForce.handoff?.fromScenario).toBe('forceDelivery');

    const toReview = computeStageAdvance('救援中', '评估救援效果', 'evt-x', 3);
    expect(toReview.nextStage).toBe('待复盘');

    const toArchive = computeStageAdvance('待复盘', '生成工作总结', 'evt-x', 4);
    expect(toArchive.nextStage).toBe('已归档');

    const noAdvance = computeStageAdvance('救援中', '生成值班日报', 'evt-x', 1);
    expect(noAdvance.advanced).toBe(false);
  });

  it('follow-up 不过界：排除越阶段主推', () => {
    // 待研判完成摘要后，若仍按待研判过滤，不应主推评估
    expect(filterFollowUpLabels('生成灾情摘要', '待研判')).toEqual(['生成态势报告']);
    // 推进到力量投送后，链路中的资源/方案可主推
    expect(filterFollowUpLabels('生成灾情摘要', '力量投送中')).toEqual([
      '查询周边救援资源',
      '生成救援方案',
    ]);
    expect(filterFollowUpLabels('生成救援方案', '救援中')).toContain('返回力量投送');
    expect(filterFollowUpLabels('生成救援方案', '救援中')).not.toContain('生成灾情摘要');
    expect(filterFollowUpLabels('生成救援方案', '救援中')).not.toContain('生成会议纪要');
    expect(filterFollowUpLabels('生成应急要情', '救援中')).not.toContain('生成会议纪要');
    expect(primaryLabelsForStage('已归档')).toEqual([]);
  });

  it('越阶段动作：未来拦截、回补放行', () => {
    expect(minStageForAction('生成工作总结')).toBe('待复盘');
    expect(isActionAheadOfStage('待研判', '生成工作总结')).toBe(true);
    expect(isActionAheadOfStage('待复盘', '生成工作总结')).toBe(false);
    expect(isActionAheadOfStage('救援中', '生成灾情摘要')).toBe(false);

    const reply = buildStageMismatchReply('待研判', '生成工作总结');
    expect(reply).toContain('灾情研判');
    expect(reply).toContain('待复盘');
    expect(reply).toMatch(/生成灾情摘要|态势报告|道路天气/);
  });
});
