import { create } from 'zustand';
import type {
  AgentTask,
  ChatMessage,
  PendingClarification,
  Proposal,
  Session,
  TaskEvent,
  TaskStatus,
} from '@/domain/types';
import { DEFAULT_EVENT_ID, DEFAULT_SESSION_ID, incidentById } from '@/seed/scenario';
import { useDemoStore } from './demoStore';
import { useDocumentStore } from './documentStore';
import { clearPersist, loadPersist, savePersist } from './persistence';

let seqCounter = 100;
function nextSeq(): number {
  seqCounter += 1;
  return seqCounter;
}

let msgCounter = 0;
let taskCounter = 0;
export function newMessageId(): string {
  msgCounter += 1;
  return `msg-${Date.now().toString(36)}-${msgCounter}`;
}
export function newTaskId(): string {
  taskCounter += 1;
  return `task-${Date.now().toString(36)}-${taskCounter}`;
}

/** 可持久化切片。 */
interface SessionPersist {
  sessions: Record<string, Session>;
  currentSessionId: string;
  tasks: Record<string, AgentTask>;
  proposals: Record<string, ProposalRecord>;
  sessionByEvent: Record<string, string>;
}

/**
 * 刷新恢复（AC-025）：运行中/排队/重试中的任务在刷新后不可能继续执行，
 * 统一降级为可重试的失败态（不永远执行中），并在会话内插入系统提示。
 */
function rehydrate(): SessionPersist {
  const raw = loadPersist<SessionPersist>('session');
  if (!raw || !raw.sessions) {
    return {
      sessions: { [DEFAULT_SESSION_ID]: emptySession(DEFAULT_SESSION_ID, DEFAULT_EVENT_ID) },
      currentSessionId: DEFAULT_SESSION_ID,
      tasks: {},
      proposals: {},
      sessionByEvent: { [DEFAULT_EVENT_ID]: DEFAULT_SESSION_ID },
    };
  }
  const tasks: Record<string, AgentTask> = {};
  const interruptedBySession = new Map<string, number>();
  for (const [taskId, task] of Object.entries(raw.tasks ?? {})) {
    const st = task.status as string;
    if (st === 'running' || st === 'queued' || st === 'retrying') {
      tasks[taskId] = {
        ...task,
        status: 'failed',
        error: {
          errorCode: 'TASK_INTERRUPTED',
          message: '演示刷新导致任务中断',
          hint: '任务未完成，可点击重试重新执行（模拟环境）。',
        },
        steps: task.steps.map((st) => (st.status === 'running' ? { ...st, status: 'failed' as const } : st)),
      };
      interruptedBySession.set(task.sessionId, (interruptedBySession.get(task.sessionId) ?? 0) + 1);
    } else {
      tasks[taskId] = task;
    }
  }
  const sessions: Record<string, Session> = {};
  for (const [sessionId, session] of Object.entries(raw.sessions)) {
    const n = interruptedBySession.get(sessionId) ?? 0;
    sessions[sessionId] =
      n > 0
        ? {
            ...session,
            messages: [
              ...session.messages,
              {
                messageId: newMessageId(),
                sessionId,
                role: 'system' as const,
                kind: 'system' as const,
                text: `演示已刷新：${n} 个进行中的任务已中断，可在任务卡中重试。`,
                taskId: null,
                createdAt: new Date().toISOString(),
                performedAt: new Date().toISOString(),
              },
            ],
          }
        : session;
  }
  return {
    sessions,
    currentSessionId: raw.currentSessionId ?? DEFAULT_SESSION_ID,
    tasks,
    proposals: raw.proposals ?? {},
    sessionByEvent: raw.sessionByEvent ?? { [DEFAULT_EVENT_ID]: DEFAULT_SESSION_ID },
  };
}

const sessionPersisted = rehydrate();

function emptySession(sessionId: string, eventId: string): Session {
  return {
    sessionId,
    eventId,
    title: incidentById.get(eventId)?.factRefs.title ? '事件会话' : '会话',
    messages: [],
    lastResourceResultIds: [],
    candidateResourceIds: [],
    selectedProposalId: null,
    selectedProposalVersion: null,
    pendingClarification: null,
    activeDocumentId: null,
    createdAt: new Date().toISOString(),
  };
}

export interface ProposalRecord extends Proposal {
  /** 采纳状态：候选建议 → 用户点击后置为 selected */
  selectedAt: string | null;
}

interface SessionState {
  sessions: Record<string, Session>;
  currentSessionId: string;
  tasks: Record<string, AgentTask>;
  proposals: Record<string, ProposalRecord>;
  /** 当前事件的主会话 id（每事件一个会话） */
  sessionByEvent: Record<string, string>;
  getCurrentSession: () => Session;
  ensureSessionForEvent: (eventId: string) => string;
  switchSession: (sessionId: string) => void;
  appendMessage: (sessionId: string, msg: Omit<ChatMessage, 'messageId' | 'createdAt' | 'performedAt'>) => ChatMessage;
  createTask: (input: { sessionId: string; eventId: string; userMessageId: string; intent: string; displayTitle: string; attempt: number }) => AgentTask;
  applyTaskEvent: (taskId: string, ev: TaskEvent) => void;
  setTaskStatus: (taskId: string, status: TaskStatus) => void;
  getTask: (taskId: string) => AgentTask | undefined;
  setLastResourceResult: (sessionId: string, resourceIds: string[], sortedBy: 'eta' | 'distance' | null) => void;
  toggleCandidate: (sessionId: string, resourceId: string) => void;
  addCandidates: (sessionId: string, resourceIds: string[]) => void;
  removeCandidate: (sessionId: string, resourceId: string) => void;
  setPendingClarification: (sessionId: string, c: PendingClarification | null) => void;
  addProposal: (p: Proposal) => void;
  selectProposal: (sessionId: string, proposalId: string | null) => void;
  getProposal: (proposalId: string) => ProposalRecord | undefined;
  setActiveDocument: (sessionId: string, documentId: string | null) => void;
  clearSessionRuntime: (sessionId: string) => void;
  resetAll: () => void;
}

export const useSessionStore = create<SessionState>()((set, get) => ({
  sessions: sessionPersisted.sessions,
  currentSessionId: sessionPersisted.currentSessionId,
  tasks: sessionPersisted.tasks,
  proposals: sessionPersisted.proposals,
  sessionByEvent: sessionPersisted.sessionByEvent,

  getCurrentSession: () => {
    const { sessions, currentSessionId } = get();
    return sessions[currentSessionId];
  },

  ensureSessionForEvent: (eventId) => {
    const state = get();
    const existing = state.sessionByEvent[eventId];
    if (existing && state.sessions[existing]) {
      if (state.currentSessionId !== existing) set({ currentSessionId: existing });
      return existing;
    }
    const sessionId = `session-${eventId}-${Date.now().toString(36)}`;
    const session = emptySession(sessionId, eventId);
    set((s) => ({
      sessions: { ...s.sessions, [sessionId]: session },
      sessionByEvent: { ...s.sessionByEvent, [eventId]: sessionId },
      currentSessionId: sessionId,
    }));
    return sessionId;
  },

  switchSession: (sessionId) => set({ currentSessionId: sessionId }),

  appendMessage: (sessionId, partial) => {
    const msg: ChatMessage = {
      ...partial,
      messageId: newMessageId(),
      createdAt: new Date().toISOString(),
      performedAt: new Date().toISOString(),
    };
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: { ...session, messages: [...session.messages, msg] },
        },
      };
    });
    return msg;
  },

  createTask: ({ sessionId, eventId, userMessageId, intent, displayTitle, attempt }) => {
    const task: AgentTask = {
      taskId: newTaskId(),
      sessionId,
      eventId,
      userMessageId,
      attemptId: `${Date.now().toString(36)}-a${attempt}`,
      attempt,
      status: 'queued',
      intent,
      displayTitle,
      steps: [],
      artifacts: [],
      textAnswer: null,
      error: null,
      startedAt: new Date().toISOString(),
      finishedAt: null,
      demoElapsedMs: null,
      seq: nextSeq(),
    };
    set((s) => ({ tasks: { ...s.tasks, [task.taskId]: task } }));
    return task;
  },

  applyTaskEvent: (taskId, ev) => {
    set((s) => {
      const task = s.tasks[taskId];
      if (!task) return s;
      const next: AgentTask = { ...task };
      switch (ev.type) {
        case 'step_started':
          next.steps = [
            ...task.steps,
            {
              stepId: ev.stepId,
              name: ev.name,
              inputSummary: ev.inputSummary ?? null,
              status: 'running',
              outputSummary: null,
              sourceRefs: [],
              elapsedMs: null,
              errorCode: null,
            },
          ];
          if (task.status === 'queued') next.status = 'running';
          break;
        case 'step_completed': {
          next.steps = task.steps.map((st) =>
            st.stepId === ev.stepId
              ? {
                  ...st,
                  status: 'completed',
                  outputSummary: ev.outputSummary ?? st.outputSummary,
                  sourceRefs: ev.sourceRefs ?? st.sourceRefs,
                  elapsedMs: st.elapsedMs ?? null,
                }
              : st,
          );
          if (ev.artifact) {
            next.artifacts = [
              ...task.artifacts,
              { artifactId: `${taskId}-art-${task.artifacts.length + 1}`, payload: ev.artifact.payload },
            ];
          }
          break;
        }
        case 'step_failed':
          next.steps = task.steps.map((st) =>
            st.stepId === ev.stepId
              ? { ...st, status: 'failed', errorCode: ev.errorCode, outputSummary: ev.message }
              : st,
          );
          break;
        case 'text_delta':
          next.textAnswer = (task.textAnswer ?? '') + ev.text;
          break;
        case 'artifact':
          next.artifacts = [
            ...task.artifacts,
            { artifactId: `${taskId}-art-${task.artifacts.length + 1}`, payload: ev.artifact.payload },
          ];
          break;
        case 'clarification_required':
          next.status = 'waiting_input';
          {
            const session = s.sessions[task.sessionId];
            if (session) {
              s.sessions[task.sessionId] = {
                ...session,
                pendingClarification: { ...ev.clarification, taskId },
              };
            }
          }
          break;
        case 'failed':
          next.status = 'failed';
          next.error = { errorCode: ev.errorCode, message: ev.message, hint: ev.hint };
          next.finishedAt = new Date().toISOString();
          break;
        case 'completed':
          if (task.status !== 'waiting_input' && task.status !== 'cancelled') {
            next.status = ev.summary ? 'succeeded' : 'succeeded';
          }
          next.finishedAt = new Date().toISOString();
          break;
      }
      return { tasks: { ...s.tasks, [taskId]: next } };
    });
  },

  setTaskStatus: (taskId, status) => {
    set((s) => {
      const task = s.tasks[taskId];
      if (!task) return s;
      return {
        tasks: {
          ...s.tasks,
          [taskId]: { ...task, status, finishedAt: status === 'cancelled' ? new Date().toISOString() : task.finishedAt },
        },
      };
    });
  },

  getTask: (taskId) => get().tasks[taskId],

  setLastResourceResult: (sessionId, resourceIds, sortedBy) => {
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: { ...session, lastResourceResultIds: resourceIds },
        },
      };
    });
    void sortedBy;
  },

  toggleCandidate: (sessionId, resourceId) => {
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      const has = session.candidateResourceIds.includes(resourceId);
      const candidateResourceIds = has
        ? session.candidateResourceIds.filter((id) => id !== resourceId)
        : [...session.candidateResourceIds, resourceId];
      return { sessions: { ...s.sessions, [sessionId]: { ...session, candidateResourceIds } } };
    });
  },

  addCandidates: (sessionId, resourceIds) => {
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      const merged = [...session.candidateResourceIds];
      for (const id of resourceIds) if (!merged.includes(id)) merged.push(id);
      return { sessions: { ...s.sessions, [sessionId]: { ...session, candidateResourceIds: merged } } };
    });
  },

  removeCandidate: (sessionId, resourceId) => {
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: {
            ...session,
            candidateResourceIds: session.candidateResourceIds.filter((id) => id !== resourceId),
          },
        },
      };
    });
  },

  setPendingClarification: (sessionId, c) => {
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      return { sessions: { ...s.sessions, [sessionId]: { ...session, pendingClarification: c } } };
    });
  },

  addProposal: (p) => {
    set((s) => ({ proposals: { ...s.proposals, [p.proposalId]: { ...p, selectedAt: null } } }));
  },

  selectProposal: (sessionId, proposalId) => {
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      const prev = session.selectedProposalId;
      if (prev && s.proposals[prev]) {
        s.proposals = {
          ...s.proposals,
          [prev]: { ...s.proposals[prev], selectedAt: null },
        };
      }
      if (proposalId && s.proposals[proposalId]) {
        s.proposals = {
          ...s.proposals,
          [proposalId]: { ...s.proposals[proposalId], selectedAt: new Date().toISOString() },
        };
      }
      return {
        proposals: s.proposals,
        sessions: {
          ...s.sessions,
          [sessionId]: {
            ...session,
            selectedProposalId: proposalId,
            selectedProposalVersion: proposalId ? (s.proposals[proposalId]?.version ?? null) : null,
          },
        },
      };
    });
  },

  getProposal: (proposalId) => get().proposals[proposalId],

  setActiveDocument: (sessionId, documentId) => {
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      return { sessions: { ...s.sessions, [sessionId]: { ...session, activeDocumentId: documentId } } };
    });
  },

  clearSessionRuntime: (sessionId) => {
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: {
            ...session,
            messages: [],
            lastResourceResultIds: [],
            candidateResourceIds: [],
            selectedProposalId: null,
            selectedProposalVersion: null,
            pendingClarification: null,
            activeDocumentId: null,
          },
        },
      };
    });
  },

  resetAll: () => {
    clearPersist('session');
    set({
      sessions: { [DEFAULT_SESSION_ID]: emptySession(DEFAULT_SESSION_ID, DEFAULT_EVENT_ID) },
      currentSessionId: DEFAULT_SESSION_ID,
      tasks: {},
      proposals: {},
      sessionByEvent: { [DEFAULT_EVENT_ID]: DEFAULT_SESSION_ID },
    });
    // 审查 M-10：重置必须连文书/审计/版本一并清空（FR-016）。
    useDocumentStore.getState().resetAll();
    useDemoStore.getState().reset();
  },
}));

// 状态变化即持久化（AC-025）
useSessionStore.subscribe((state) => {
  savePersist('session', {
    sessions: state.sessions,
    currentSessionId: state.currentSessionId,
    tasks: state.tasks,
    proposals: state.proposals,
    sessionByEvent: state.sessionByEvent,
  } satisfies SessionPersist);
});
