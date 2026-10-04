/**
 * 会话作用域任务订阅（useSessionTasks）回归。
 *
 * 背景：ChatPanel 的整张消息列表 memo 与 KnowledgePanel 的知识聚合 memo 原来都挂在
 * `useSessionStore((s) => s.tasks)` 上 —— 任何任务事件（包括别的会话里正在跑的任务）
 * 都会换掉整张表的引用，把两个 memo 全部重建。这里锁定「窄订阅 + 引用稳定」。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { DEFAULT_EVENT_ID } from '@/seed/scenario';
import { useSessionStore } from '@/store/sessionStore';
import { collectSessionTasks, useSessionTasks } from '@/hooks/useSessionTasks';
import type { ChatMessage } from '@/domain/types';

const OTHER_EVENT = 'evt-other-session';

beforeEach(() => {
  useSessionStore.getState().resetAll();
});

/** 建会话 + 建任务 + 补一条 task 消息（写入顺序与 sendMessage 一致）。 */
function startTask(conversationId: string, eventId: string, title: string) {
  const store = useSessionStore.getState();
  const sessionId = store.ensureSessionForConversation(conversationId, eventId);
  const message = useSessionStore.getState().appendMessage(sessionId, {
    sessionId, role: 'user', kind: 'text', text: title, taskId: null,
  });
  const task = useSessionStore.getState().createTask({
    sessionId, eventId, userMessageId: message.messageId, intent: 'summary', displayTitle: title, attempt: 1,
  });
  useSessionStore.getState().appendMessage(sessionId, {
    sessionId, role: 'assistant', kind: 'task', text: null, taskId: task.taskId,
  });
  return { sessionId, task };
}

describe('useSessionTasks', () => {
  it('别的会话推进任务进度时本会话任务表不动：不重渲、引用也不变', () => {
    const mine = startTask('conv-mine', DEFAULT_EVENT_ID, '本会话任务');
    const other = startTask('conv-other', OTHER_EVENT, '别的会话任务');

    let renders = 0;
    const { result, rerender } = renderHook(() => {
      renders += 1;
      return useSessionTasks(useSessionStore((s) => s.sessions[mine.sessionId]));
    });
    const first = result.current;
    expect(Object.keys(first)).toEqual([mine.task.taskId]);

    const rendersBefore = renders;
    act(() => {
      for (let i = 0; i < 5; i++) {
        useSessionStore.getState().setTaskStatus(other.task.taskId, i % 2 ? 'running' : 'queued');
      }
    });
    // 旧写法（直接订阅 s.tasks）这里会重渲整个聊天列表。
    expect(renders).toBe(rendersBefore);

    // 即使因别的原因重渲，返回的引用也必须稳定，否则调用方的 memo 照样白跑。
    rerender();
    expect(result.current).toBe(first);

    // 本会话自己的任务更新仍然要换引用 —— 否则面板就不刷新了。
    act(() => { useSessionStore.getState().setTaskStatus(mine.task.taskId, 'running'); });
    expect(result.current).not.toBe(first);
    expect(result.current[mine.task.taskId].status).toBe('running');
  });

  it('collectSessionTasks 只收本会话自己的任务和消息引用到的任务', () => {
    const mine = startTask('conv-mine', DEFAULT_EVENT_ID, '本会话任务');
    const other = startTask('conv-other', OTHER_EVENT, '别的会话任务');
    const state = useSessionStore.getState();

    const scoped = collectSessionTasks(state.sessions[mine.sessionId], state.tasks);
    expect(Object.keys(scoped)).toEqual([mine.task.taskId]);
    expect(scoped[other.task.taskId]).toBeUndefined();

    // 会话没就绪时返回空表（调用方原本也只能查到 sessionId 不匹配的任务）。
    expect(collectSessionTasks(undefined, state.tasks)).toEqual({});
  });

  it('消息引用到外部任务时一并纳入（保持与原整表读取一致的可见范围）', () => {
    const mine = startTask('conv-mine', DEFAULT_EVENT_ID, '本会话任务');
    const other = startTask('conv-other', OTHER_EVENT, '别的会话任务');
    const foreign = { ...other.task, taskId: 'foreign-task' };

    const foreignMessage: ChatMessage = {
      messageId: 'msg-foreign', sessionId: mine.sessionId, role: 'assistant', kind: 'task',
      text: null, taskId: foreign.taskId, createdAt: '', performedAt: '',
    };
    const state = useSessionStore.getState();
    const session = {
      ...state.sessions[mine.sessionId],
      messages: [...state.sessions[mine.sessionId].messages, foreignMessage],
    };

    const scoped = collectSessionTasks(session, { ...state.tasks, [foreign.taskId]: foreign });
    expect(scoped[foreign.taskId]).toBe(foreign);
  });
});
