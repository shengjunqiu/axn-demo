import { describe, expect, it } from 'vitest';
import {
  assertQuickActionCatalogValid,
  chatCatalogActions,
  QUICK_ACTION_CATALOG,
  stageChipConfig,
} from '@/seed/quickActionCatalog';
import { AGENT_QUICK_TASKS } from '@/seed/agentQuickTasks';
import { primaryLabelsForStage, loopLabelsForStage } from '@/services/agentFlow';

describe('quickActionCatalog', () => {
  it('配置自洽：stageChips 引用均存在于 actions', () => {
    expect(() => assertQuickActionCatalogValid()).not.toThrow();
  });

  it('AGENT_QUICK_TASKS 与 chat 动作一致', () => {
    expect(AGENT_QUICK_TASKS.map((item) => item.label)).toEqual(
      chatCatalogActions().map((item) => item.label),
    );
  });

  it('待研判主推含态势研判预警（招标 4.2.3）', () => {
    expect(stageChipConfig('待研判').primary).toEqual([
      '生成灾情摘要',
      '态势研判预警',
      '生成态势报告',
    ]);
    expect(primaryLabelsForStage('待研判')).toEqual(stageChipConfig('待研判').primary);
  });

  it('力量投送主推不含方案生成；救援中主推含方案生成', () => {
    expect(primaryLabelsForStage('力量投送中')).toEqual([
      '查询周边救援资源',
      '生成周边资源报告',
      '核对资源状态',
    ]);
    expect(primaryLabelsForStage('救援中')).toContain('生成救援方案');
    expect(loopLabelsForStage('救援中')).toEqual(['返回力量投送', '补充态势研判']);
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
