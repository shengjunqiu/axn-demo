import { AGENT_INVITATIONS } from '@/seed/agentInvitations';
import { useSessionStore } from '@/store/sessionStore';

/** 在当前会话追加智能体介绍和功能卡，不切换对话、事件或文书工作区。 */
export function summonAgentInConversation(sessionId: string, agentId: string) {
  const agent = AGENT_INVITATIONS.find(item => item.agentId === agentId);
  const store = useSessionStore.getState();
  if (!agent || !store.sessions[sessionId]) return null;
  return store.appendMessage(sessionId, {
    sessionId, role: 'assistant', kind: 'agent', taskId: null,
    agentId, agentName: agent.name, agentRole: agent.role,
    text: agent.intro, choices: agent.options.map(option => ({ ...option })), hint: agent.hint,
  });
}
