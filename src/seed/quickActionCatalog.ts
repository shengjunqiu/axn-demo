/**
 * 快捷按钮目录：招标 §4 场景分类的唯一配置源。
 * 改主推 / 折叠 / 回环时优先改 quickActionCatalog.json。
 */
import catalog from './quickActionCatalog.json';

export type CatalogScenarioId = 'assistant' | 'situation' | 'forceDelivery' | 'rescueOps';
export type CatalogActionKind = 'chat' | 'flow' | 'loop';

export type CatalogScenario = {
  id: CatalogScenarioId;
  clause: string;
  label: string;
};

export type CatalogAction = {
  label: string;
  clause: string;
  scenarioId: CatalogScenarioId;
  agentId: string;
  agentName: string;
  kind: CatalogActionKind;
};

export type StageChipConfig = {
  primary: string[];
  loop: string[];
};

export type QuickActionCatalog = {
  version: number;
  source: string;
  scenarios: CatalogScenario[];
  actions: CatalogAction[];
  stageChips: Record<string, StageChipConfig>;
  moreMenu: {
    groupBy: 'scenario';
    scenarioOrder: CatalogScenarioId[];
    appendOverallFlow: boolean;
    overallFlowEntryLabel: string;
    overallFlowDefaultTab: string;
  };
};

export const QUICK_ACTION_CATALOG = catalog as QuickActionCatalog;

export const CATALOG_SCENARIOS = QUICK_ACTION_CATALOG.scenarios;

export const CATALOG_ACTIONS = QUICK_ACTION_CATALOG.actions;

const actionByLabel = new Map(CATALOG_ACTIONS.map((action) => [action.label, action]));

export function catalogAction(label: string): CatalogAction | undefined {
  return actionByLabel.get(label);
}

/** 已从能力块清单隐藏的历史动作（仍可出现在 stageChips 配置校验中）。 */
export const LEGACY_QUICK_ACTIONS = ['核对道路天气', '生成周边资源报告', '七环节救援时间轴', '预案条款对照'];

export function chatCatalogActions(): CatalogAction[] {
  return CATALOG_ACTIONS.filter((action) => action.kind === 'chat' && !LEGACY_QUICK_ACTIONS.includes(action.label));
}

/** 能力块子项 / 扁平对照：chat + flow（不含 loop、不含 LEGACY）。 */
export function chipCatalogActions(): CatalogAction[] {
  return CATALOG_ACTIONS.filter(
    (action) => (action.kind === 'chat' || action.kind === 'flow') && !LEGACY_QUICK_ACTIONS.includes(action.label),
  );
}

export function stageChipConfig(stage: string | null | undefined): StageChipConfig {
  const config = QUICK_ACTION_CATALOG.stageChips[stage || '待研判'] ?? { primary: [], loop: [] };
  return { ...config, primary: config.primary.filter(label => !LEGACY_QUICK_ACTIONS.includes(label)) };
}

export function catalogScenarioLabel(id: CatalogScenarioId): string {
  return CATALOG_SCENARIOS.find((item) => item.id === id)?.label ?? id;
}

/** 校验 stageChips 引用的 label 均存在于 actions（启动/单测用）。 */
export function assertQuickActionCatalogValid(): void {
  const known = new Set(CATALOG_ACTIONS.map((action) => action.label));
  for (const [stage, chips] of Object.entries(QUICK_ACTION_CATALOG.stageChips)) {
    for (const label of [...chips.primary, ...chips.loop]) {
      if (!known.has(label)) {
        throw new Error(`quickActionCatalog: stageChips「${stage}」引用未知动作「${label}」`);
      }
    }
  }
  for (const id of QUICK_ACTION_CATALOG.moreMenu.scenarioOrder) {
    if (!CATALOG_SCENARIOS.some((item) => item.id === id)) {
      throw new Error(`quickActionCatalog: moreMenu.scenarioOrder 未知场景「${id}」`);
    }
  }
}
