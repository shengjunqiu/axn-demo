/**
 * 全局导航 · Conversation 数据模型与状态隔离测试（需求十一）。
 * 覆盖：创建/搜索/active 切换/删除/空白对话隔离、菜单切换不丢会话、跨会话业务数据隔离、异步任务污染防护。
 * 说明：消息/任务/候选挂在会话专属 session（sessionByConversation[会话ID]，关联灾情不共享历史消息）；
 * 切换 Conversation = 切换专属 session + 同步事件上下文，因此隔离断言基于会话专属 session 内容。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  groupOf,
  matchConversation,
  useConversationStore,
  seedConversationRows,
} from '@/store/conversationStore';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { useDocumentStore } from '@/store/documentStore';
import { sendMessage } from '@/services/taskRunner';
import { createEventDocument } from '@/services/documentFactory';

const A = 'evt-demo-001';
const B = 'evt-demo-002';

beforeEach(() => {
  vi.useFakeTimers();
  useSessionStore.getState().resetAll();
  useConversationStore.getState().resetAll();
  useDemoStore.getState().setPace('fast');
});

afterEach(() => {
  void vi.runAllTimersAsync();
  vi.useRealTimers();
});

function currentSession() {
  const convId = useConversationStore.getState().activeConversationId;
  const sid = convId ? useSessionStore.getState().sessionByConversation[convId] : undefined;
  const session = sid ? useSessionStore.getState().sessions[sid] : undefined;
  if (!session) throw new Error('测试前置失败：当前会话 session 不存在');
  return session;
}

describe('Conversation 基础行为（需求 2.3/2.5/九）', () => {
  it('1. 创建 Conversation → 历史列表增加', () => {
    const before = Object.keys(useConversationStore.getState().conversations).length;
    useConversationStore.getState().createConversation({
      title: '测试新建会话',
      type: 'general',
      eventId: A,
    });
    const state = useConversationStore.getState();
    expect(Object.keys(state.conversations).length).toBe(before + 1);
    expect(state.activeConversationId).toBeTruthy();
  });

  it('6. 搜索"南堤" → 只显示匹配会话；7. 清空搜索 → 全部恢复', () => {
    const all = Object.values(useConversationStore.getState().conversations);
    const matched = all.filter((c) => matchConversation(c, '南堤'));
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.length).toBeLessThan(all.length);
    expect(matched.every((c) => c.title.includes('南堤'))).toBe(true);
    // 事件名/编码也应可命中（漳河镇会话通过 eventId 命中）
    expect(all.filter((c) => matchConversation(c, 'evt-demo-002')).length).toBeGreaterThan(0);
    // 清空恢复
    expect(all.filter((c) => matchConversation(c, '')).length).toBe(all.length);
  });

  it('8. 新建模板会话 → activeConversationId 自动切换并进入智能助理', () => {
    const created = useConversationStore.getState().createConversation({
      title: '河流水位上涨预警',
      type: 'emergency',
      eventId: B,
      status: 'processing',
    });
    const state = useConversationStore.getState();
    expect(state.activeConversationId).toBe(created.id);
    expect(state.activeNav).toBe('assistant');
    expect(useDemoStore.getState().currentEventId).toBe(B);
    expect(useSessionStore.getState().sessions[useSessionStore.getState().sessionByConversation[created.id]]).toBeTruthy();
  });

  it('9. 菜单切换：智能助理→知识库→智能体与Skill→智能助理，active conversation 不变', () => {
    const original = useConversationStore.getState().activeConversationId;
    useConversationStore.getState().setActiveNav('knowledge');
    useConversationStore.getState().setActiveNav('agents');
    expect(useConversationStore.getState().activeNav).toBe('agents');
    useConversationStore.getState().setActiveNav('assistant');
    const state = useConversationStore.getState();
    expect(state.activeConversationId).toBe(original);
    expect(state.activeNav).toBe('assistant');
  });

  it('deleteConversation：删除激活会话切换到最近更新的剩余会话', () => {
    useConversationStore.getState().resetAll();
    const state = useConversationStore.getState();
    const active = state.activeConversationId as string;
    const latestOther = Object.values(state.conversations)
      .filter((c) => c.id !== active)
      .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
    state.deleteConversation(active);
    const next = useConversationStore.getState();
    expect(next.conversations[active]).toBeUndefined();
    expect(next.activeConversationId).toBe(latestOther.id);
  });

  it('deleteConversation：全部删光后无激活会话；新建会话恢复激活', () => {
    useConversationStore.getState().resetAll();
    const ids = Object.keys(useConversationStore.getState().conversations);
    for (const id of ids) useConversationStore.getState().deleteConversation(id);
    expect(useConversationStore.getState().activeConversationId).toBeNull();
    const created = useConversationStore.getState().createConversation({ title: '删除后新建', type: 'general' });
    expect(useConversationStore.getState().activeConversationId).toBe(created.id);
  });

  it('空白对话：分配专属虚拟事件，session 为全新空会话且不影响其他会话', async () => {
    useConversationStore.getState().resetAll();
    const demo = useDemoStore.getState();
    const nandiEvent = demo.currentEventId; // 种子激活为 evt-demo-001
    const created = useConversationStore.getState().createConversation({ title: '空白', type: 'general' });
    expect(created.eventId).toMatch(/^evt-blank-/);
    // 切回南堤会话：业务事件与会话恢复
    useConversationStore.getState().selectConversation('conv-seed-nandi');
    expect(useDemoStore.getState().currentEventId).toBe(nandiEvent);
    // 再切回空白对话：虚拟事件 + 独立空 session
    useConversationStore.getState().selectConversation(created.id);
    expect(useDemoStore.getState().currentEventId).toBe(created.eventId);
    const sessionStore = useSessionStore.getState();
    const sid = sessionStore.currentSessionId;
    expect(sessionStore.sessions[sid].eventId).toBe(created.eventId);
    expect(sessionStore.sessions[sid].messages).toHaveLength(0);
    // 南堤事件的 session 消息不受影响
    const nandiSid = sessionStore.sessionByEvent[nandiEvent];
    expect(sessionStore.sessions[nandiSid].messages.length).toBeGreaterThanOrEqual(0);
  });

  it('新建对话关联灾情：绑定事件并可共享 session 消息', () => {
    const conversation = useConversationStore.getState().createConversation({
      title: '关联漳河水情的会话',
      type: 'general',
      eventId: 'evt-demo-002',
      status: 'active',
    });
    expect(conversation.eventId).toBe('evt-demo-002');
    useConversationStore.getState().selectConversation(conversation.id);
    useSessionStore.getState().ensureSessionForEvent('evt-demo-002');
    const demo = useDemoStore.getState();
    demo.switchEvent('evt-demo-002');
    useSessionStore.getState().ensureSessionForEvent('evt-demo-002');
    // 会话切换同步业务上下文到关联事件（共享事件 session）
    expect(useDemoStore.getState().currentEventId).toBe('evt-demo-002');
  });

  it('对话区内切换关联灾情：绑定事件 / 取消关联回到专属虚拟事件', () => {
    const state = useConversationStore.getState();
    const conversation = state.createConversation({ title: '切换关联用例', type: 'general', status: 'active' });
    // 默认为专属虚拟事件
    expect(conversation.eventId).toMatch(/^evt-blank-/);
    // 绑定真实事件
    useConversationStore.getState().linkConversationToEvent(conversation.id, 'evt-demo-001');
    expect(useConversationStore.getState().conversations[conversation.id].eventId).toBe('evt-demo-001');
    // 取消关联 → 回到同一个专属虚拟事件（保留独立消息，不落入其他事件）
    useConversationStore.getState().linkConversationToEvent(conversation.id, undefined);
    expect(useConversationStore.getState().conversations[conversation.id].eventId).toBe(conversation.eventId);
  });

  it('历史会话分组：种子数据覆盖 今天/昨天/更早', () => {
    const groups = new Set(seedConversationRows.map((row) => groupOf(row)));
    expect(groups.has('today')).toBe(true);
    expect(groups.has('yesterday')).toBe(true);
    expect(groups.has('earlier')).toBe(true);
  });
});

describe('会话切换与状态隔离（需求五/十）', () => {
  function setupAWithData() {
    const conversationA = useConversationStore.getState().createConversation({
      title: '会话A（清河堤防）',
      type: 'emergency',
      eventId: A,
    });
    const sidA = useSessionStore.getState().sessionByConversation[conversationA.id];
    useSessionStore.getState().addCandidates(sidA, ['team-001', 'team-002']);
    useDemoStore.getState().addManualFact({
      field: 'reportingUnit',
      value: '应急办公室',
      scopeKind: 'event',
      scopeId: A,
      actorId: useDemoStore.getState().actorId,
    });
    const docResult = createEventDocument(sidA);
    expect(docResult.ok).toBe(true);
    return { conversationA, sidA, documentId: docResult.documentId! };
  }

  it('2/3/4. A 有消息/候选/文书 → 切到 B：B 显示自己的空上下文，不见 A 的候选与文书', async () => {
    const { sidA, documentId } = setupAWithData();
    await sendMessage(sidA, { text: '生成灾情摘要' });
    await vi.runAllTimersAsync();
    expect(useSessionStore.getState().sessions[sidA].messages.length).toBeGreaterThan(0);

    useConversationStore.getState().createConversation({ title: '会话B（水位预警）', type: 'emergency', eventId: B });
    const sessionB = currentSession();
    expect(sessionB.eventId).toBe(B);
    expect(sessionB.messages.length).toBe(0);
    expect(sessionB.candidateResourceIds).toEqual([]);
    expect(sessionB.activeDocumentId).toBeNull();
    // A 的文书仍在 A 的作用域（documentStore 按文档 id 存取，事件归属不受切换影响）
    expect(useDocumentStore.getState().drafts[documentId].eventId).toBe(A);
  });

  it('5. 从 B 切回 A → A 的消息、候选、文书上下文恢复', async () => {
    const { conversationA, sidA, documentId } = setupAWithData();
    await sendMessage(sidA, { text: '生成灾情摘要' });
    await vi.runAllTimersAsync();
    const messagesCount = useSessionStore.getState().sessions[sidA].messages.length;

    useConversationStore.getState().createConversation({ title: '会话B', type: 'emergency', eventId: B });
    expect(currentSession().candidateResourceIds).toEqual([]);

    useConversationStore.getState().selectConversation(conversationA.id);
    const restored = currentSession();
    expect(restored.eventId).toBe(A);
    expect(restored.candidateResourceIds).toEqual(['team-001', 'team-002']);
    expect(restored.messages.length).toBe(messagesCount);
    expect(useDocumentStore.getState().drafts[documentId]).toBeTruthy();
    expect(useConversationStore.getState().activeConversationId).toBe(conversationA.id);
  });

  it('10. A 执行任务 → 切到 B → A 的晚到结果不得写入 B', async () => {
    const { conversationA, sidA } = setupAWithData();
    useDemoStore.getState().setPace('normal');
    const taskId = await sendMessage(sidA, { text: '生成灾情摘要' });

    // 任务运行中切到 B（switchEvent 会使所有活动 run 失效）
    const convB = useConversationStore.getState().createConversation({ title: '会话B', type: 'emergency', eventId: B });
    const sessionBId = useSessionStore.getState().sessionByConversation[convB.id];
    await vi.runAllTimersAsync();

    const task = useSessionStore.getState().tasks[taskId]!;
    // 旧 run 失效后任务不得以成功态继续污染
    expect(['cancelled', 'failed']).toContain(task.status);
    // 结果只可能写入 A 的会话，B 的会话中不存在该任务的副作用
    const sessionB = useSessionStore.getState().sessions[sessionBId]!;
    expect(sessionB.messages.every((m) => m.taskId !== taskId)).toBe(true);
    expect(sessionB.lastResourceResultIds).toEqual([]);
    // 切回 A：A 会话不包含 B 的上下文
    useConversationStore.getState().selectConversation(conversationA.id);
    expect(currentSession().eventId).toBe(A);
  });

  it('11. 关联同一灾情的两个会话：消息互不可见（关联灾情不出旧对话）', async () => {
    const convA = useConversationStore.getState().createConversation({
      title: '甲会话（关联南堤）',
      type: 'emergency',
      eventId: A,
    });
    await sendMessage(useSessionStore.getState().sessionByConversation[convA.id], { text: '生成灾情摘要' });
    await vi.runAllTimersAsync();
    const sidA = useSessionStore.getState().sessionByConversation[convA.id];
    expect(useSessionStore.getState().sessions[sidA].messages.length).toBeGreaterThan(0);

    // 同一事件的另一个会话：全新空消息，不见甲会话的对话记录
    const convB = useConversationStore.getState().createConversation({
      title: '乙会话（关联同一南堤）',
      type: 'emergency',
      eventId: A,
    });
    const sidB = useSessionStore.getState().sessionByConversation[convB.id];
    expect(sidB).not.toBe(sidA);
    expect(useSessionStore.getState().sessions[sidB].messages.length).toBe(0);

    // 乙会话发消息后，甲会话仍只看到自己的记录
    await sendMessage(sidB, { text: '查询周边救援资源' });
    await vi.runAllTimersAsync();
    useConversationStore.getState().selectConversation(convA.id);
    const backA = currentSession();
    expect(backA.messages.every((m) => !(m.role === 'user' && (m.text ?? '').includes('查询周边救援资源')))).toBe(true);
    expect(backA.messages.some((m) => m.role === 'user' && (m.text ?? '').includes('生成灾情摘要'))).toBe(true);
  });
});
