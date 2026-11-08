import { useCallback, useMemo } from 'react';
import { canAccessAgent, visibleAgentsForActor } from '@/seed/agentAccess';
import { useDemoStore } from '@/store/demoStore';

/** 当前方案与模式下，导航、专家页和对话共用同一份可见权限。 */
export function useAgentAccess() {
  const actorId = useDemoStore(s => s.actorId);
  const designPlan = useDemoStore(s => s.designPlan);
  const interactionMode = useDemoStore(s => s.interactionMode);
  const agents = useMemo(() => visibleAgentsForActor(actorId, { designPlan, interactionMode }), [actorId, designPlan, interactionMode]);
  // 导航与专家页用的目录权限：方案二对话模式也要能浏览左侧「应急专家」，
  // 所以按工作模式的口径算目录；对话输入区仍用上面的 agents，保持对话模式无智能体入口。
  const directoryAgents = useMemo(() => visibleAgentsForActor(actorId, { designPlan, interactionMode: 'work' }), [actorId, designPlan]);
  const canUseAgent = useCallback((agentId: string) => canAccessAgent(actorId, agentId, { designPlan, interactionMode }), [actorId, designPlan, interactionMode]);
  return { agents, directoryAgents, canUseAgent };
}
