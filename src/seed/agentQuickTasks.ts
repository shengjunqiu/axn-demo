/**
 * 输入区上方 5 个能力块：点击后在对话中召唤智能体并展示功能选项（对齐文书生成）。
 * 子项内容来自 quickActionCatalog（招标 §4，chat + flow）。
 *
 * task 必须是 catalog 内部动作键（非 tender 展示名），保证 recognize / flow 路由命中。
 */
import {
  CATALOG_ACTIONS,
  LEGACY_QUICK_ACTIONS,
  type CatalogAction,
} from './quickActionCatalog';
import { tenderName } from './tenderNames';

export type AgentQuickTaskChild = {
  /** 界面展示名（经 tenderName） */
  label: string;
  /** catalog 内部动作键，点击后交给 handleQuickTask */
  task: string;
  kind: 'chat' | 'flow';
};

export type AgentQuickTaskGroup = {
  agentId: string;
  agentName: string;
  /** 父能力块短名（chip 文案） */
  label: string;
  tasks: readonly AgentQuickTaskChild[];
};

const PARENT_BLOCKS: readonly { agentId: string; label: string; agentName: string }[] = [
  { agentId: 'agent-doc', label: '文书生成', agentName: '文书生成智能体' },
  { agentId: 'agent-situation', label: '态势感知', agentName: '态势感知智能体' },
  { agentId: 'agent-resource', label: '救援资源管理', agentName: '救援资源管理智能体' },
  { agentId: 'agent-plan', label: '救援方案生成', agentName: '救援方案生成智能体' },
  { agentId: 'agent-eval', label: '救援效果评估', agentName: '救援效果评估智能体' },
];

/** catalog 里偶发 agent-evaluation，统一到 agent-eval */
function normalizeAgentId(agentId: string): string {
  return agentId === 'agent-evaluation' ? 'agent-eval' : agentId;
}

function chipEligible(action: CatalogAction): boolean {
  return (action.kind === 'chat' || action.kind === 'flow') && !LEGACY_QUICK_ACTIONS.includes(action.label);
}

function tasksForAgent(agentId: string): AgentQuickTaskChild[] {
  return CATALOG_ACTIONS.filter(
    (action) => chipEligible(action) && normalizeAgentId(action.agentId) === agentId,
  ).map((action) => ({
    label: tenderName(action.label),
    task: action.label,
    kind: action.kind as 'chat' | 'flow',
  }));
}

export const AGENT_QUICK_TASKS: readonly AgentQuickTaskGroup[] = PARENT_BLOCKS.map((block) => ({
  ...block,
  tasks: tasksForAgent(block.agentId),
}));
