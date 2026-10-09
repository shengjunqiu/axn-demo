/**
 * 任务运行器：驱动 Mock Provider、应用事件到 Store、处理取消与重试（新 attempt）。
 */
import type { ChatAttachment, TaskEvent } from '@/domain/types';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { mockProvider, recognize, TaskFault, UNKNOWN_REPLY_TEXT } from './mock/provider.js';
import { ensureQaLoaded } from './qaKnowledge.js';
import {
  assessInput,
  attachmentForPersist,
  buildStageEventContext,
  composeTextWithAttachment,
  fileTypes,
} from './stageConversation.js';

import { registerRun, isActiveRun, finishRun, invalidateRun } from './taskRuns.js';

function sleepZero(): Promise<void> {
  return new Promise((r) => setTimeout(r, 0));
}

export interface SendOptions {
  text: string;
  commandId?: string | null;
  attachment?: ChatAttachment | null;
  attachmentMode?: 'reference' | 'check' | null;
  /** 已通过用途确认后跳过 assessInput */
  skipAssess?: boolean;
}

export async function sendMessage(sessionId: string, options: SendOptions): Promise<string> {
  const sessionStore = useSessionStore.getState();
  const session = sessionStore.sessions[sessionId];
  if (!session) throw new Error(`会话不存在：${sessionId}`);
  const eventId = session.eventId;
  const existingRunning = Object.values(sessionStore.tasks).find(
    (t) => t.sessionId === sessionId && (t.status === 'running' || t.status === 'queued'),
  );

  const attachment = options.attachment ? attachmentForPersist(options.attachment) : null;
  const displayText =
    options.text.trim() || (attachment ? '请读取附件并确认材料用途。' : '');
  if (!displayText && !attachment) return '';

  const userMsg = sessionStore.appendMessage(sessionId, {
    sessionId,
    role: 'user',
    kind: 'text',
    text: displayText,
    taskId: null,
    attachment: attachment
      ? {
          id: attachment.id,
          name: attachment.name,
          type: attachment.type,
          simulated: attachment.simulated,
          kind: attachment.kind,
          status: attachment.status,
          eventId: attachment.eventId,
          eventName: attachment.eventName,
          // 气泡展示不需要全文
          content: undefined,
        }
      : null,
  });

  // 附件用途校验（对齐 Vue assessInput）；阻断时不建任务
  if (attachment && !options.skipAssess && !eventId.startsWith('evt-blank-')) {
    const eventCtx = buildStageEventContext(eventId, session);
    const capability = attachment.type
      ? fileTypes[attachment.type as keyof typeof fileTypes]?.capability ?? ''
      : '';
    const issue = assessInput(eventCtx, attachment, capability, '');
    if (issue) {
      sessionStore.appendMessage(sessionId, {
        sessionId,
        role: 'assistant',
        kind: 'text',
        text: issue.text,
        taskId: null,
        workflow: {
          kind: issue.kind,
          attachment,
          prompt: displayText,
          stage: eventCtx.stage,
          eventId: eventCtx.id,
          resolved: false,
        },
      });
      return '';
    }
  }

  if (attachment) {
    sessionStore.addSessionMaterials(sessionId, [
      {
        id: attachment.id,
        name: attachment.name,
        content: attachment.content ?? '',
        status: attachment.status,
        kind: attachment.kind,
        selected: true,
      },
    ]);
  }

  const recognizeText = composeTextWithAttachment(
    displayText,
    attachment ?? options.attachment,
    options.attachmentMode,
  );

  // 问答语料按需加载（不进首屏）；recognize 内部的 matchQa 要求语料已就绪。
  await ensureQaLoaded();
  const recognized = recognize(recognizeText, {
    lastResourceResultIds: session.lastResourceResultIds,
    candidateResourceIds: session.candidateResourceIds,
  });

  // 仅检查 / 历史参考：简化助手回复，不建任务卡
  if (options.attachmentMode === 'check' || options.attachmentMode === 'reference') {
    const name = attachment?.name ?? '附件';
    sessionStore.appendMessage(sessionId, {
      sessionId,
      role: 'assistant',
      kind: 'text',
      text:
        options.attachmentMode === 'check'
          ? `已检查《${name}》的模拟正文（演示）。未提交原系统；待核字段请岗位核对后使用。`
          : `已将《${name}》作为历史参考提取结构要点（演示）。不纳入当前事件事实，不提交原系统。`,
      taskId: null,
    });
    return '';
  }

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
  // 未命中任何演示意图（输入框自由文本）：只回一句默认文案，不建任务卡、不展示意图识别步骤。
  if (recognized.intent === 'unknown') {
    sessionStore.appendMessage(sessionId, {
      sessionId,
      role: 'assistant',
      kind: 'text',
      text: attachment
        ? `已读取《${attachment.name}》的模拟正文。已登记到会话资料区，可继续用快捷任务或指令整理初稿；正式办理沿用原系统权限与审核流程。`
        : UNKNOWN_REPLY_TEXT,
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
  void executeTask(task.taskId, recognizeText, recognized.intent, recognized.params, 1, options.commandId ?? null);
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
  const attemptId = task.attemptId;
  registerRun({ taskId, attemptId, sessionId: task.sessionId, eventId: task.eventId, controller }, () => {
    const current = useSessionStore.getState().getTask(taskId);
    if (current?.attemptId === attemptId) useSessionStore.getState().setTaskStatus(taskId, 'cancelled');
  });
  try {
    const request = {
      requestId: `${taskId}-${attempt}`,
      taskId,
      attemptId,
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
      if (!isActiveRun(taskId, attemptId)) return;
      applySideEffects(task.taskId, ev);
      useSessionStore.getState().applyTaskEvent(task.taskId, ev, attemptId);
    }
    // 正常结束：更新候选/资源结果派生视图由副作用完成
  } catch (err) {
    if (!isActiveRun(taskId, attemptId)) return;
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
      }, attemptId);
      return;
    }
    useSessionStore.getState().applyTaskEvent(taskId, {
      type: 'failed',
      errorCode: 'INTERNAL',
      message: err instanceof Error ? err.message : '未知错误',
      hint: '请重试；若持续失败请查看控制台日志。',
    }, attemptId);
  } finally {
    finishRun(taskId, attemptId);
  }
}

function applySideEffects(taskId: string, ev: TaskEvent): void {
  const store = useSessionStore.getState();
  const task = store.getTask(taskId);
  if (!task) return;
  const payload = (ev.type === 'step_completed' || ev.type === 'artifact') && ev.artifact
    ? ev.artifact.payload
    : null;
  if (payload?.kind === 'resources') {
    store.setLastResourceResult(task.sessionId, payload.resourceIds, payload.sortedBy);
  }
}


export function cancelTask(taskId: string): void {
  invalidateRun(taskId);
}

export async function retryTask(taskId: string): Promise<void> {
  const store = useSessionStore.getState();
  const task = store.getTask(taskId);
  if (!task) return;
  if (Object.values(store.tasks).some((other) => other.sessionId === task.sessionId && ['running', 'queued'].includes(other.status))) return;
  if (useDemoStore.getState().currentEventId !== task.eventId || store.sessions[task.sessionId]?.eventId !== task.eventId) return;
  // 重试 = 新的执行尝试（attempt+1），保留此前步骤与产物
  const userMsg = task.userMessageId;
  const session = store.sessions[task.sessionId];
  const userText =
    session?.messages.find((m) => m.messageId === userMsg)?.text ?? task.displayTitle;
  await ensureQaLoaded();
  const recognized = recognize(userText ?? '', {
    lastResourceResultIds: session?.lastResourceResultIds ?? [],
    candidateResourceIds: session?.candidateResourceIds ?? [],
  });
  const next = store.beginAttempt(taskId);
  if (!next) return;
  void executeTask(taskId, userText ?? '', recognized.intent, recognized.params, next.attempt, null);
}
