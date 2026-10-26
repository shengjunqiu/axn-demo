import { describe, expect, it } from 'vitest';
import {
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

  it('研判/投送/救援中主推客户核心功能；待复盘/已归档主推复盘动作', () => {
    const expectations = {
      待研判: ['多源数据汇聚', '生成灾情摘要', '现场智能勘察辅助', '态势研判预警', '生成态势报告', '资源建议'],
      力量投送中: ['查询周边救援资源', '智能编组推荐', '核对资源状态', '物资核验', '资源建议'],
      救援中: ['生成救援方案', '生成态势报告', '查询周边救援资源', '物资核验', '资源建议', '智能编组推荐'],
    };
    for (const stage of ['待研判', '力量投送中', '救援中'] as const) {
      const split = splitQuickTasksByStage(stage);
      expect(split.primary.map(item => item.label)).toEqual(expectations[stage]);
      expect(split.secondary.some(item => item.label === '生成会议纪要')).toBe(true);
      expect(split.loopLabels).toEqual([]);
    }
    expect(splitQuickTasksByStage(null).primary.map(item => item.label)).toEqual(expectations.待研判);
    const review = splitQuickTasksByStage('待复盘');
    expect(review.primary.map(item => item.label)).toEqual(['评估救援效果', '资源投入偏差评估', '复盘总结', '事件沉淀', '正式知识库审核发布', '正式知识检索']);
    expect(review.loopLabels).toEqual(['补充态势研判', '返回力量投送']);
    expect(review.scenarioLabel).toBe('实施救援 · 复盘');
    expect(review.secondary.some(item => item.label === '物资核验')).toBe(true);

    const archived = splitQuickTasksByStage('已归档');
    expect(archived.primary.map(item => item.label)).toEqual(['复盘总结', '事件沉淀', '正式知识库审核发布', '正式知识检索']);
    expect(archived.scenarioLabel).toBe('实施救援 · 复盘');
    expect(resolveScenarioId('待研判')).toBe('situation');
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

  it('复盘阶段主推复盘总结与事件沉淀，核心功能仍可从更多动作进入', () => {
    expect(primaryLabelsForStage('待复盘')).toEqual(['评估救援效果', '资源投入偏差评估', '复盘总结', '事件沉淀', '正式知识库审核发布', '正式知识检索']);
    expect(primaryLabelsForStage('已归档')).toEqual(['复盘总结', '事件沉淀', '正式知识库审核发布', '正式知识检索']);
    expect(primaryLabelsForStage('已归档')).not.toContain('物资核验');
    expect(filterFollowUpLabels('生成救援方案', '救援中')).not.toContain('生成救援方案');
    expect(minStageForAction('复盘总结')).toBe('待复盘');
    expect(minStageForAction('事件沉淀')).toBe('待复盘');
    expect(isActionAheadOfStage('待研判', '生成工作总结')).toBe(false);
    expect(isActionAheadOfStage('待研判', '生成救援方案')).toBe(false);
  });
});
