import { beforeEach, describe, expect, it } from 'vitest';
import { AGENT_INVITATIONS } from '@/seed/agentInvitations';
import { summonAgentFromManagement, summonAgentInConversation } from '@/services/agentConversation';
import { useConversationStore } from '@/store/conversationStore';
import { useSessionStore } from '@/store/sessionStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { resetDemoData } from '@/store/resetDemo';
import { useDemoStore } from '@/store/demoStore';
import { visibleAgentsForActor } from '@/seed/agentAccess';
import { actors } from '@/seed/scenario';

beforeEach(() => resetDemoData());

describe('在同一对话召唤智能体', () => {
  it.each([
    ['张明远', AGENT_INVITATIONS.map(agent => agent.agentId)],
    ['赵强', []],
    ['李雷', ['agent-doc', 'agent-situation']],
  ] as const)('%s 只能查看和召唤已授权的智能体', (userName, allowed) => {
    const actor = actors.find(actor => actor.userName === userName)!;
    useDemoStore.getState().setActor(actor.actorId);
    expect(visibleAgentsForActor(actor.actorId).map(agent => agent.agentId)).toEqual(allowed);
    const sessionId = useSessionStore.getState().currentSessionId;
    for (const agent of AGENT_INVITATIONS) {
      const permitted = allowed.some(id => id === agent.agentId);
      const sessions = useSessionStore.getState();
      const conversations = useConversationStore.getState();
      const invitation = summonAgentInConversation(sessionId, agent.agentId);
      const managed = summonAgentFromManagement(agent.agentId);
      if (permitted) {
        expect(invitation?.agentId).toBe(agent.agentId);
        expect(managed?.agentId).toBe(agent.agentId);
      } else {
        expect(invitation).toBeNull();
        expect(managed).toBeNull();
        expect(useSessionStore.getState()).toBe(sessions);
        expect(useConversationStore.getState()).toBe(conversations);
      }
    }
  });

  it('不接受无效账号，切回张明远后恢复全部智能体', () => {
    const demo = useDemoStore.getState();
    demo.setActor('actor-demo-lilei');
    demo.setActor('missing');
    expect(useDemoStore.getState().getActor().userName).toBe('李雷');
    expect(visibleAgentsForActor('missing')).toEqual([]);
    demo.setActor('actor-demo-duty');
    expect(visibleAgentsForActor(useDemoStore.getState().actorId)).toHaveLength(5);
  });

  it('管理页每次召唤新建独立对话，保留原会话历史且不提前执行任务', () => {
    const conversation = useConversationStore.getState().createConversation({ title: '原对话', type: 'general', eventId: 'evt-demo-001' });
    const sessionId = useSessionStore.getState().sessionByConversation[conversation.id];
    const original = useSessionStore.getState().appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text: '已有需求', taskId: null });
    expect(conversation.source).toBeUndefined();
    const count = Object.keys(useConversationStore.getState().conversations).length;
    const createdSessions = new Set<string>();
    for (const [index, agent] of AGENT_INVITATIONS.entries()) {
      const invitation = summonAgentFromManagement(agent.agentId)!;
      const state = useConversationStore.getState();
      const current = state.conversations[state.activeConversationId!];
      expect(current.id).not.toBe(conversation.id);
      expect(current.source).toBe('agent-management');
      expect(current.title).toBe(`与${agent.name}对话`);
      expect(current.eventId).toBe(`evt-blank-${current.id}`);
      expect(Object.keys(state.conversations)).toHaveLength(count + index + 1);
      expect(invitation).toMatchObject({ agentId: agent.agentId, choices: agent.options });
      expect(useSessionStore.getState().currentSessionId).toBe(invitation.sessionId);
      expect(useSessionStore.getState().sessions[invitation.sessionId].messages).toEqual([invitation]);
      createdSessions.add(invitation.sessionId);
    }
    expect(createdSessions.size).toBe(AGENT_INVITATIONS.length);
    expect(useSessionStore.getState().sessions[sessionId].messages).toEqual([original]);
    expect(useSessionStore.getState().sessions[sessionId].eventId).toBe('evt-demo-001');
    expect(Object.keys(useSessionStore.getState().tasks)).toHaveLength(0);
  });

  it('没有当前对话时也能创建，重复召唤同一智能体仍开启新对话；无效智能体不创建', () => {
    useConversationStore.setState({ conversations: {}, activeConversationId: null });
    expect(summonAgentFromManagement('missing')).toBeNull();
    expect(Object.keys(useConversationStore.getState().conversations)).toHaveLength(0);
    const first = summonAgentFromManagement('agent-doc');
    const second = summonAgentFromManagement('agent-doc');
    expect(first).toMatchObject({ agentId: 'agent-doc' });
    expect(second?.sessionId).not.toBe(first?.sessionId);
    expect(Object.keys(useConversationStore.getState().conversations)).toHaveLength(2);
  });

  it.each([undefined, 'evt-demo-001'])('多个智能体保留当前对话、事件、已有记录和工作区（事件 %s）', eventId => {
    const conversation = useConversationStore.getState().createConversation({ title: '原对话', type: 'general', eventId });
    const sessionId = useSessionStore.getState().sessionByConversation[conversation.id];
    const original = useSessionStore.getState().appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text: '保留原来的消息', taskId: null });
    const before = useConversationStore.getState().conversations;
    const workspace = useWorkspaceStore.getState();
    for (const [index, agent] of AGENT_INVITATIONS.entries()) {
      const message = summonAgentInConversation(sessionId, agent.agentId);
      const session = useSessionStore.getState().sessions[sessionId];
      expect(useConversationStore.getState().conversations).toBe(before);
      expect(useConversationStore.getState().activeConversationId).toBe(conversation.id);
      expect(useSessionStore.getState().currentSessionId).toBe(sessionId);
      expect(session.eventId).toBe(conversation.eventId);
      expect(session.messages).toHaveLength(index + 2);
      expect(session.messages[0]).toEqual(original);
      expect(message).toMatchObject({ kind: 'agent', agentId: agent.agentId, choices: agent.options, taskId: null });
      expect(session.messages.at(-1)).toEqual(message);
      expect(useWorkspaceStore.getState()).toBe(workspace);
    }
    expect(Object.keys(useSessionStore.getState().tasks)).toHaveLength(0);
    summonAgentInConversation(sessionId, 'agent-doc');
    expect(useSessionStore.getState().sessions[sessionId].messages).toHaveLength(7);
  });

  it('无效智能体或会话不修改任何状态', () => {
    const before = useSessionStore.getState();
    expect(summonAgentInConversation(before.currentSessionId, 'missing')).toBeNull();
    expect(summonAgentInConversation('missing', 'agent-doc')).toBeNull();
    expect(useSessionStore.getState()).toBe(before);
  });
});
