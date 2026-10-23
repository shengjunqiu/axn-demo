import { describe, expect, it } from 'vitest';
import {
  assertQuickActionCatalogValid,
  chipCatalogActions,
  QUICK_ACTION_CATALOG,
  stageChipConfig,
} from '@/seed/quickActionCatalog';
import { AGENT_QUICK_TASKS, isTenderAgentTask } from '@/seed/agentQuickTasks';
import { primaryLabelsForStage, loopLabelsForStage } from '@/services/agentFlow';

function normalizeAgentId(agentId: string): string {
  return agentId === 'agent-evaluation' ? 'agent-eval' : agentId;
}

describe('quickActionCatalog', () => {
  it('配置自洽：stageChips 引用均存在于 actions', () => {
    expect(() => assertQuickActionCatalogValid()).not.toThrow();
  });

  it('AGENT_QUICK_TASKS 各块 tasks 与 chip（chat+flow）按 agent 分组一致', () => {
    const byAgent = new Map<string, string[]>();
    for (const action of chipCatalogActions().filter(action => isTenderAgentTask(action.agentId, action.label))) {
      const id = normalizeAgentId(action.agentId);
      const list = byAgent.get(id) ?? [];
      list.push(action.label);
      byAgent.set(id, list);
    }
    expect(AGENT_QUICK_TASKS.map((g) => g.agentId)).toEqual([
      'agent-doc',
      'agent-situation',
      'agent-resource',
      'agent-plan',
      'agent-eval',
    ]);
    for (const group of AGENT_QUICK_TASKS) {
      expect(group.tasks.map((t) => t.task)).toEqual(byAgent.get(group.agentId) ?? []);
    }
  });

  it('研判/投送/救援中主推核心功能；待复盘主推复盘动作', () => {
    expect(stageChipConfig('待研判').primary).toEqual(['多源数据汇聚', '生成灾情摘要', '现场智能勘察辅助', '态势研判预警', '生成态势报告', '资源建议']);
    expect(primaryLabelsForStage('力量投送中')).toEqual(['查询周边救援资源', '智能编组推荐', '核对资源状态', '物资核验', '资源建议']);
    expect(primaryLabelsForStage('救援中')[0]).toBe('生成救援方案');
    expect(loopLabelsForStage('救援中')).toEqual([]);
    expect(primaryLabelsForStage('待复盘')).toEqual(['评估救援效果', '资源投入偏差评估', '复盘总结', '事件沉淀', '正式知识库审核发布', '正式知识检索']);
    expect(loopLabelsForStage('待复盘')).toEqual(['补充态势研判', '返回力量投送']);
    expect(QUICK_ACTION_CATALOG.moreMenu.appendOverallFlow).toBe(false);
    expect(chipCatalogActions().map(item => item.label)).toEqual(expect.arrayContaining(['生成值班日报', '生成会议纪要', '生成日常工作总结']));
  });

  it('moreMenu 按招标四场景排序', () => {
    expect(QUICK_ACTION_CATALOG.moreMenu.scenarioOrder).toEqual([
      'situation',
      'forceDelivery',
      'rescueOps',
      'assistant',
    ]);
  });
});
