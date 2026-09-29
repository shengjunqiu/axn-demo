/**
 * 全局导航 · Conversation 数据模型与状态隔离测试（需求十一）。
 * 覆盖：创建/搜索/收藏/active 切换、菜单切换不丢会话、跨会话业务数据隔离、异步任务污染防护。
 * 说明：Conversation 是交互上下文，业务数据（消息/候选/文书/任务）挂在其 eventId 对应的 session 上；
 * 切换 Conversation = 切换事件 + 恢复 session，因此隔离断言基于 session 内容。
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
  const eventId = useDemoStore.getState().currentEventId;
  const sid = useSessionStore.getState().sessionByEvent[eventId];
  return useSessionStore.getState().sessions[sid];
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
    expect(useSessionStore.getState().sessions[useSessionStore.getState().sessionByEvent[B]]).toBeTruthy();
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

  it('收藏 toggleFavorite 更新 favorite 状态', () => {
    const id = seedConversationRows[0].id;
    const before = useConversationStore.getState().conversations[id].favorite;
    useConversationStore.getState().toggleFavorite(id);
    expect(useConversationStore.getState().conversations[id].favorite).toBe(!before);
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
    const sidA = useSessionStore.getState().sessionByEvent[A];
    useSessionStore.getState().addCandidates(sidA, ['team-001', 'team-002']);
    useDemoStore.getState().addManualFact({
      field: 'reportingUnit',
      value: '演示应急办公室',
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
    useConversationStore.getState().createConversation({ title: '会话B', type: 'emergency', eventId: B });
    const sessionBId = useSessionStore.getState().sessionByEvent[B];
    await vi.runAllTimersAsync();

    const task = useSessionStore.getState().tasks[taskId];
    // 旧 run 失效后任务不得以成功态继续污染
    expect(['cancelled', 'failed']).toContain(task.status);
    // 结果只可能写入 A 的会话，B 的会话中不存在该任务的副作用
    const sessionB = useSessionStore.getState().sessions[sessionBId];
    expect(sessionB.messages.every((m) => m.taskId !== taskId)).toBe(true);
    expect(sessionB.lastResourceResultIds).toEqual([]);
    // 切回 A：A 会话不包含 B 的上下文
    useConversationStore.getState().selectConversation(conversationA.id);
    expect(currentSession().eventId).toBe(A);
  });
});
