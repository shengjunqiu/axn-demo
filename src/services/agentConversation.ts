import { AGENT_INVITATIONS } from '@/seed/agentInvitations';
import { useSessionStore } from '@/store/sessionStore';
import { useConversationStore } from '@/store/conversationStore';

/** 管理页召唤：每次开启独立对话，展示对应智能体的介绍和任务选项。 */
export function summonAgentFromManagement(agentId: string) {
  const agent = AGENT_INVITATIONS.find(item => item.agentId === agentId);
  if (!agent) return null;
  const conversations = useConversationStore.getState();
  const conversation = conversations.createConversation({ title: `与${agent.name}对话`, type: 'general', source: 'agent-management' });
  const sessionId = useSessionStore.getState().ensureSessionForConversation(
    conversation.id, `evt-blank-${conversation.id}`,
  );
  return summonAgentInConversation(sessionId, agentId);
}

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
