import { actorById, DEFAULT_ACTOR_ID } from './scenario';
import { AGENT_INVITATIONS } from './agentInvitations';
import type { DesignPlan, InteractionMode } from '@/store/demoStore';

interface AgentAccessContext {
  designPlan: DesignPlan;
  interactionMode: InteractionMode;
}

/** 导航、智能体列表与召唤入口共用账号权限。未知账号默认没有权限。 */
export function canAccessAgent(actorId: string, agentId: string, context?: AgentAccessContext): boolean {
  if (context?.designPlan === 'two' && (actorId !== DEFAULT_ACTOR_ID || context.interactionMode !== 'work')) return false;
  const allowed = actorById.get(actorId)?.allowedAgentIds;
  return AGENT_INVITATIONS.some(agent => agent.agentId === agentId)
    && (allowed === 'all' || !!allowed?.includes(agentId));
}

export function visibleAgentsForActor(actorId: string, context?: AgentAccessContext) {
  return AGENT_INVITATIONS.filter(agent => canAccessAgent(actorId, agent.agentId, context));
}
