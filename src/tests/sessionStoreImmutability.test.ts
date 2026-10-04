/**
 * applyTaskEvent 写会话必须走不可变更新（回归）。
 *
 * 原来两处写成 `s.sessions[id] = { ... }`，而函数结尾只 return `{ tasks }` ——
 * 会话对象的引用没变，只订阅 `s.sessions` 的订阅者（src/components/workspace/WorkspaceSync.tsx:12）
 * 拿不到新引用；同时旧快照被就地改写，任何「先存引用后比较」的代码都会看到脏数据。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { DEFAULT_EVENT_ID } from '@/seed/scenario';
import { useSessionStore } from '@/store/sessionStore';
import { useDemoStore } from '@/store/demoStore';
import { registerRun } from '@/services/taskRuns';

beforeEach(() => {
  useSessionStore.getState().resetAll();
  useDemoStore.getState().switchEvent(DEFAULT_EVENT_ID);
});

/** 建一个「活跃运行」的任务：applyTaskEvent 只接受活跃 attempt 的事件。 */
function activeTask() {
  const store = useSessionStore.getState();
  const sessionId = store.ensureSessionForEvent(DEFAULT_EVENT_ID);
  const task = store.createTask({
    sessionId, eventId: DEFAULT_EVENT_ID, userMessageId: 'msg-1', intent: 'summary', displayTitle: '灾情摘要', attempt: 1,
  });
  registerRun(
    { taskId: task.taskId, attemptId: task.attemptId, eventId: DEFAULT_EVENT_ID, sessionId, controller: new AbortController() },
    () => {},
  );
  return { sessionId, task };
}

describe('applyTaskEvent 写会话的不可变性', () => {
  it('agent_summon 插入的协同消息换新引用，且不改写旧快照', () => {
    const { sessionId, task } = activeTask();
    const sessionsBefore = useSessionStore.getState().sessions;
    const sessionBefore = sessionsBefore[sessionId];

    useSessionStore.getState().applyTaskEvent(
      task.taskId,
      { type: 'agent_summon', agentId: 'agent-kb', agentName: '知识检索智能体', agentRole: '依据检索', action: '检索相关依据' },
      task.attemptId,
    );

    const sessionsAfter = useSessionStore.getState().sessions;
    expect(sessionsAfter).not.toBe(sessionsBefore);
    expect(sessionsBefore[sessionId]).toBe(sessionBefore); // 原地改 map 时这条会失败
    expect(sessionsAfter[sessionId]).not.toBe(sessionBefore);
    expect(sessionsAfter[sessionId].messages).toHaveLength(sessionBefore.messages.length + 1);
    expect(sessionsAfter[sessionId].messages.at(-1)).toMatchObject({ kind: 'agent', taskId: task.taskId });
  });

  it('clarification_required 写的 pendingClarification 同样换新引用', () => {
    const { sessionId, task } = activeTask();
    const sessionsBefore = useSessionStore.getState().sessions;
    const sessionBefore = sessionsBefore[sessionId];

    useSessionStore.getState().applyTaskEvent(
      task.taskId,
      {
        type: 'clarification_required',
        clarification: {
          clarificationId: 'clar-1', field: 'reportingUnit', prompt: '报送单位是？',
          exampleHint: '如：清河段防汛值班室', scopeKind: 'event', scopeId: DEFAULT_EVENT_ID,
        },
      },
      task.attemptId,
    );

    const sessionsAfter = useSessionStore.getState().sessions;
    expect(sessionsAfter).not.toBe(sessionsBefore);
    expect(sessionsBefore[sessionId]).toBe(sessionBefore);
    expect(sessionsAfter[sessionId].pendingClarification).toMatchObject({ clarificationId: 'clar-1', taskId: task.taskId });
    expect(useSessionStore.getState().tasks[task.taskId].status).toBe('waiting_input');
  });
});
