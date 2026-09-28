/**
 * 任务运行器：驱动 Mock Provider、应用事件到 Store、处理取消与重试（新 attempt）。
 */
import type { TaskEvent } from '@/domain/types';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { mockProvider, recognize, TaskFault } from './mock/provider';

const controllers = new Map<string, AbortController>();

function sleepZero(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

export interface SendOptions {
  text: string;
  commandId?: string | null;
}

export async function sendMessage(sessionId: string, options: SendOptions): Promise<string> {
  const sessionStore = useSessionStore.getState();
  const session = sessionStore.sessions[sessionId];
  if (!session) throw new Error(`会话不存在：${sessionId}`);
  const eventId = session.eventId;
  const existingRunning = Object.values(sessionStore.tasks).find(
    (t) => t.sessionId === sessionId && (t.status === 'running' || t.status === 'queued'),
  );
  const userMsg = sessionStore.appendMessage(sessionId, {
    sessionId,
    role: 'user',
    kind: 'text',
    text: options.text,
    taskId: null,
  });
  const recognized = recognize(options.text, {
    lastResourceResultIds: session.lastResourceResultIds,
    candidateResourceIds: session.candidateResourceIds,
  });
  // 审查 minor-1：stop 意图先于运行守卫 —— 有运行任务则真实取消（FR-002/AC-023 文本停止路径），无则如实回复。
  if (recognized.intent === 'stop') {
    if (existingRunning) {
      cancelTask(existingRunning.taskId);
      sessionStore.appendMessage(sessionId, {
        sessionId,
        role: 'assistant',
        kind: 'text',
        text: '好的，已停止当前任务（模拟）。已产生的步骤与结论保留在任务卡中。',
        taskId: null,
      });
    } else {
      sessionStore.appendMessage(sessionId, {
        sessionId,
        role: 'assistant',
        kind: 'text',
        text: '当前没有正在运行的任务。',
        taskId: null,
      });
    }
    return '';
  }
  if (existingRunning) {
    sessionStore.appendMessage(sessionId, {
      sessionId,
      role: 'assistant',
      kind: 'text',
      text: '当前有任务正在执行（模拟）。可先发送“停止”取消，或等待完成后重试。',
      taskId: null,
    });
    return '';
  }
  const task = sessionStore.createTask({
    sessionId,
    eventId,
    userMessageId: userMsg.messageId,
    intent: recognized.intent,
    displayTitle: recognized.displayTitle,
    attempt: 1,
  });
  sessionStore.appendMessage(sessionId, {
    sessionId,
    role: 'assistant',
    kind: 'task',
    text: null,
    taskId: task.taskId,
  });
  void executeTask(task.taskId, options.text, recognized.intent, recognized.params, 1, options.commandId ?? null);
  return task.taskId;
}

async function executeTask(
  taskId: string,
  userInput: string,
  intent: ReturnType<typeof recognize>['intent'],
  params: Record<string, unknown>,
  attempt: number,
  commandId: string | null,
): Promise<void> {
  const sessionStore = useSessionStore.getState();
  const task = sessionStore.getTask(taskId);
  if (!task) return;
  const demo = useDemoStore.getState();
  const session = useSessionStore.getState().sessions[task.sessionId];
  const controller = new AbortController();
  controllers.set(taskId, controller);
  try {
    const request = {
      requestId: `${taskId}-${attempt}`,
      taskId,
      attemptId: `${taskId}-a${attempt}`,
      sessionId: task.sessionId,
      eventId: task.eventId,
      commandId,
      userInput,
      intent,
      params,
      context: {
        sessionId: task.sessionId,
        eventId: task.eventId,
        candidateResourceIds: session?.candidateResourceIds ?? [],
        lastResourceResultIds: session?.lastResourceResultIds ?? [],
        selectedProposalId: session?.selectedProposalId ?? null,
        selectedProposalVersion: session?.selectedProposalVersion ?? null,
        pendingClarification: session?.pendingClarification ?? null,
        demoClock: demo.demoClock,
        pace: demo.pace,
      },
    };
    for await (const ev of mockProvider.run(request, controller.signal)) {
      await sleepZero();
      applySideEffects(task.taskId, ev);
      useSessionStore.getState().applyTaskEvent(task.taskId, ev);
    }
    // 正常结束：更新候选/资源结果派生视图由副作用完成
  } catch (err) {
    if (err instanceof DOMException && err.name === 'AbortError') {
      useSessionStore.getState().setTaskStatus(taskId, 'cancelled');
      return;
    }
    if (err instanceof TaskFault) {
      useSessionStore.getState().applyTaskEvent(taskId, {
        type: 'failed',
        errorCode: err.errorCode,
        message: err.message,
        hint: err.hint,
      });
      return;
    }
    useSessionStore.getState().applyTaskEvent(taskId, {
      type: 'failed',
      errorCode: 'INTERNAL',
      message: err instanceof Error ? err.message : '未知错误',
      hint: '请重试；若持续失败请查看控制台日志。',
    });
  } finally {
    controllers.delete(taskId);
    await refreshDerivedViews(task.taskId);
  }
}

function applySideEffects(taskId: string, ev: TaskEvent): void {
  const store = useSessionStore.getState();
  const task = store.getTask(taskId);
  if (!task) return;
  if (ev.type === 'step_completed' && ev.artifact) {
    const payload = ev.artifact.payload;
    if (payload.kind === 'resources') {
      store.setLastResourceResult(task.sessionId, payload.resourceIds, payload.sortedBy);
    }
  }
}

async function refreshDerivedViews(_taskId: string): Promise<void> {
  // 派生事实在渲染时即时计算，这里无需持久化；保留钩子以便扩展。
}

export function cancelTask(taskId: string): void {
  controllers.get(taskId)?.abort();
}

export async function retryTask(taskId: string): Promise<void> {
  const store = useSessionStore.getState();
  const task = store.getTask(taskId);
  if (!task) return;
  if (task.status === 'running' || task.status === 'queued') return;
  // 重试 = 新的执行尝试（attempt+1），保留此前步骤与产物
  const userMsg = task.userMessageId;
  const session = store.sessions[task.sessionId];
  const userText =
    session?.messages.find((m) => m.messageId === userMsg)?.text ?? task.displayTitle;
  const recognized = recognize(userText ?? '', {
    lastResourceResultIds: session?.lastResourceResultIds ?? [],
    candidateResourceIds: session?.candidateResourceIds ?? [],
  });
  const nextAttempt = task.attempt + 1;
  useSessionStore.getState().applyTaskEvent(taskId, {
    type: 'step_started',
    stepId: `retry-${nextAttempt}`,
    name: `重试（第 ${nextAttempt} 次尝试）`,
    inputSummary: '恢复执行，已完成产物保留',
  });
  void executeTask(taskId, userText ?? '', recognized.intent, recognized.params, nextAttempt, null);
}
