/**
 * 侧栏建设四智能体：展示入口与「关联可选事件」过滤（按事件阶段对齐场景）。
 */
import { resolveSeedEventStage, type EventStage } from '@/services/agentFlow';
import { VUE_WORKSPACE_EVENTS, type VueWorkspaceEventMeta } from '@/seed/vueWorkspaceEvents';
import type { Conversation } from '@/domain/types';

export type SidebarAgentId = 'situation' | 'resource' | 'plan' | 'evaluation';

export type SidebarAgent = {
  id: SidebarAgentId;
  agentId: string;
  name: string;
  shortName: string;
  scene: string;
  stages: EventStage[];
};

/** 与 CONSTRUCTION_SCENARIO_PROMPTS / SKILL_AGENTS 前四项对齐 */
export const SIDEBAR_AGENTS: SidebarAgent[] = [
  {
    id: 'situation',
    agentId: 'agent-situation',
    name: '态势感知智能体',
    shortName: '态势感知',
    scene: '灾情研判',
    stages: ['待研判'],
  },
  {
    id: 'resource',
    agentId: 'agent-resource',
    name: '救援资源管理智能体',
    shortName: '资源管理',
    scene: '力量投送',
    stages: ['力量投送中'],
  },
  {
    id: 'plan',
    agentId: 'agent-plan',
    name: '救援方案生成智能体',
    shortName: '方案生成',
    scene: '实施救援·方案',
    stages: ['救援中'],
  },
  {
    id: 'evaluation',
    agentId: 'agent-eval',
    name: '救援效果评估智能体',
    shortName: '效果评估',
    scene: '实施救援·复盘',
    stages: ['待复盘', '已归档'],
  },
];

export function sidebarAgentById(id: SidebarAgentId | null): SidebarAgent | null {
  if (!id) return null;
  return SIDEBAR_AGENTS.find((a) => a.id === id) ?? null;
}

export function conversationMatchesAgent(
  conversation: Conversation,
  agentId: SidebarAgentId | null,
): boolean {
  if (!agentId) return true;
  const agent = sidebarAgentById(agentId);
  if (!agent) return true;
  const eventId = conversation.eventId;
  if (!eventId || eventId.startsWith('evt-blank-')) return false;
  return agent.stages.includes(resolveSeedEventStage(eventId));
}

/** 智能体关联的可选事件（工作台事件库，按阶段）。 */
export function optionalEventsForAgent(agentId: SidebarAgentId | null): VueWorkspaceEventMeta[] {
  if (!agentId) return [];
  const agent = sidebarAgentById(agentId);
  if (!agent) return [];
  const stageSet = new Set(agent.stages);
  return VUE_WORKSPACE_EVENTS.filter((e) => stageSet.has(e.stage));
}

export function matchEventKeyword(event: VueWorkspaceEventMeta, keyword: string): boolean {
  const q = keyword.trim().toLowerCase();
  if (!q) return true;
  return [event.name, event.eventId, event.category, event.location, event.stage]
    .join(' ')
    .toLowerCase()
    .includes(q);
}
