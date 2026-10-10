/**
 * 底部快捷任务：由 quickActionCatalog.json（招标 §4）派生。
 * 点击后走 AgentSummonCard + TaskCard；展示名见 tenderNames。
 */
import { chatCatalogActions } from './quickActionCatalog';

export const AGENT_QUICK_TASKS = chatCatalogActions().map((action) => ({
  agentId: action.agentId,
  agentName: action.agentName,
  label: action.label,
  scenarioId: action.scenarioId,
  clause: action.clause,
})) as readonly {
  agentId: string;
  agentName: string;
  label: string;
  scenarioId: string;
  clause: string;
}[];
