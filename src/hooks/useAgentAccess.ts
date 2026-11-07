import { useCallback, useMemo } from 'react';
import { canAccessAgent, visibleAgentsForActor } from '@/seed/agentAccess';
import { useDemoStore } from '@/store/demoStore';

/** 当前方案与模式下，导航、专家页和对话共用同一份可见权限。 */
export function useAgentAccess() {
  const actorId = useDemoStore(s => s.actorId);
  const designPlan = useDemoStore(s => s.designPlan);
  const interactionMode = useDemoStore(s => s.interactionMode);
  const agents = useMemo(() => visibleAgentsForActor(actorId, { designPlan, interactionMode }), [actorId, designPlan, interactionMode]);
  const canUseAgent = useCallback((agentId: string) => canAccessAgent(actorId, agentId, { designPlan, interactionMode }), [actorId, designPlan, interactionMode]);
  return { agents, canUseAgent };
}
