/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  FLOW_TASKS,
  FLOW_TASK_META,
  buildFlowSeedSnapshot,
  defaultFlowForScenario,
  flowTabMode,
  flowsForScenario,
  minStageForFlowTab,
  ownersForFlowScenario,
  scenarioRailForFlow,
  stageIndex,
} from '@/services/flowStageConfig';
import { disasterProfileById } from '@/seed/disasterScenarios';

describe('flowStageConfig', () => {
  it('阶段顺序与 Tab 门槛', () => {
    expect(stageIndex('待研判')).toBe(0);
    expect(stageIndex('已归档')).toBe(4);
    expect(minStageForFlowTab('现场智能勘察')).toBe('待研判');
    expect(minStageForFlowTab('规划梯队投送')).toBe('力量投送中');
    expect(minStageForFlowTab('方案修订对比')).toBe('救援中');
    expect(minStageForFlowTab('复盘评估分析')).toBe('待复盘');
  });

  it('救援中：研判/投送为 past，方案为 current，复盘为 future', () => {
    expect(flowTabMode('救援中', '现场智能勘察')).toBe('past');
    expect(flowTabMode('救援中', '态势研判预警')).toBe('past');
    expect(flowTabMode('救援中', '规划梯队投送')).toBe('past');
    expect(flowTabMode('救援中', '编组确认')).toBe('past');
    expect(flowTabMode('救援中', '方案修订对比')).toBe('current');
    expect(flowTabMode('救援中', '复盘评估分析')).toBe('future');
    expect(flowTabMode('救援中', '资料核验与总结')).toBe('future');
  });

  it('待研判：研判类 current，后续 future', () => {
    expect(flowTabMode('待研判', '现场智能勘察')).toBe('current');
    expect(flowTabMode('待研判', '预警推送')).toBe('current');
    expect(flowTabMode('待研判', '规划梯队投送')).toBe('future');
    expect(flowTabMode('待研判', '方案修订对比')).toBe('future');
  });

  it('快照含已核实勘察资料与投送完成态', () => {
    const profile = disasterProfileById.get('evt-demo-001');
    const snap = buildFlowSeedSnapshot('evt-demo-001', profile, '演示事件');
    expect(snap.records).toHaveLength(3);
    expect(snap.records.every((r) => r.verified)).toBe(true);
    expect(snap.analysis && snap.reviewed).toBe(true);
    expect(snap.dispatch).toBe(true);
    expect(snap.progress).toBe(3);
    expect(snap.receipts.length).toBe(3);
    expect(FLOW_TASKS.length).toBe(12);
  });

  it('每个流程有且仅有一个场景或 support 归属', () => {
    for (const task of FLOW_TASKS) {
      expect(FLOW_TASK_META[task].scenarioId).toBeTruthy();
      expect(FLOW_TASK_META[task].agentLabel).toMatch(/智能体$/);
    }
    const business = FLOW_TASKS.filter((t) => FLOW_TASK_META[t].scenarioId !== 'support');
    expect(business).toHaveLength(11);
    expect(FLOW_TASK_META['应急助手场景'].scenarioId).toBe('support');
    expect(FLOW_TASK_META['复盘评估分析'].scenarioId).toBe('rescueOps');
    expect(FLOW_TASK_META['回撤归建'].scenarioId).toBe('rescueOps');
  });

  it('三场景分组覆盖全部业务 Tab，应急助手横切置顶', () => {
    const situation = flowsForScenario('situation');
    const force = flowsForScenario('forceDelivery');
    const rescue = flowsForScenario('rescueOps');
    expect(situation[0]).toBe('应急助手场景');
    expect(situation).toEqual(expect.arrayContaining(['现场智能勘察', '态势研判预警', '预警推送']));
    expect(force).toEqual(expect.arrayContaining(['规划梯队投送', '编组确认']));
    expect(rescue).toEqual(expect.arrayContaining([
      '方案修订对比', '回撤归建', '复盘评估分析', '资料核验与总结', '知识沉淀入库', '资源维护与导出',
    ]));
    const covered = new Set([...situation, ...force, ...rescue]);
    expect([...covered].sort()).toEqual([...FLOW_TASKS].sort());
  });

  it('默认落点与场景轨道随阶段/流程对齐', () => {
    expect(defaultFlowForScenario('力量投送中', 'forceDelivery')).toBe('规划梯队投送');
    expect(defaultFlowForScenario('救援中', 'rescueOps')).toBe('方案修订对比');
    expect(scenarioRailForFlow('现场智能勘察', '救援中')).toBe('situation');
    expect(scenarioRailForFlow('应急助手场景', '力量投送中')).toBe('forceDelivery');
    expect(ownersForFlowScenario('rescueOps')).toEqual(['plan', 'evaluation', 'resource']);
  });
});
