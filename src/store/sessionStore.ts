import { create } from 'zustand';
import { resourceAllowed, resolveFact } from '@/services/factLookup';
import { teamById } from '@/seed/scenario';
import { invalidateAllRuns, isActiveRun } from '@/services/taskRuns';
import type {
  AgentTask,
  ChatMessage,
  PendingClarification,
  Proposal,
  Session,
  TaskEvent,
  TaskStatus,
} from '@/domain/types';
import { DEFAULT_EVENT_ID, DEFAULT_SESSION_ID, factById, incidentById } from '@/seed/scenario';
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
  sessionByConversation: Record<string, string>;
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
      sessionByConversation: SEED_SESSION_BY_CONVERSATION,
    };
  }
  for (const session of Object.values(raw.sessions)) {
    session.messages = session.messages.map(message => message.documentWorkflow && !['completed', 'interrupted'].includes(message.documentWorkflow.stage)
      ? { ...message, documentWorkflow: { ...message.documentWorkflow, stage: 'interrupted' } }
      : message);
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
            resourceSortBy: session.resourceSortBy ?? null,
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
        : { ...session, resourceSortBy: session.resourceSortBy ?? null };
  }
  return {
    sessions,
    currentSessionId: raw.currentSessionId ?? DEFAULT_SESSION_ID,
    tasks,
    proposals: raw.proposals ?? {},
    sessionByEvent: raw.sessionByEvent ?? { [DEFAULT_EVENT_ID]: DEFAULT_SESSION_ID },
    sessionByConversation: raw.sessionByConversation ?? SEED_SESSION_BY_CONVERSATION,
  };
}

/** 会话→session 映射种子：消息按会话隔离（关联灾情不共享历史消息）；主种子会话继承演示消息。 */
const SEED_SESSION_BY_CONVERSATION: Record<string, string> = {
  'conv-seed-nandi': DEFAULT_SESSION_ID,
};

const sessionPersisted = rehydrate();

/** 种子直查事件标题（不经任何 store，模块初始化安全）。 */
function seedEventTitle(eventId: string): string {
  if (eventId.startsWith('evt-blank-')) return '空白对话（未关联事件）';
  const titleFactId = incidentById.get(eventId)?.factRefs.title;
  if (!titleFactId) return eventId;
  const fact = factById.get(titleFactId);
  return fact?.value != null ? String(fact.value) : eventId;
}

function emptySession(sessionId: string, eventId: string): Session {
  return {
    sessionId,
    eventId,
    // 会话标题跟随事件名。注意：此处必须走种子直查（factById），
    // 不能调用 factLookup.eventDisplayName —— 模块初始化阶段 resolveFact
    // 会触及 demoStore（循环引用，生产包 TDZ 崩溃：Cannot access before initialization）。
    title: seedEventTitle(eventId),
    messages: [],
    lastResourceResultIds: [],
    resourceSortBy: null,
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
  /** 会话→session 映射（消息按会话隔离） */
  sessionByConversation: Record<string, string>;
  getCurrentSession: () => Session;
  ensureSessionForEvent: (eventId: string) => string;
  /** 会话专属 session：消息按会话隔离；eventId 仅作为业务上下文（任务/来源解析）记录 */
  ensureSessionForConversation: (conversationId: string, eventId: string) => string;
  switchSession: (sessionId: string) => void;
  appendMessage: (sessionId: string, msg: Omit<ChatMessage, 'messageId' | 'createdAt' | 'performedAt'>) => ChatMessage;
  updateDocumentWorkflow: (sessionId: string, messageId: string, workflow: NonNullable<ChatMessage['documentWorkflow']>) => void;
  createTask: (input: { sessionId: string; eventId: string; userMessageId: string; intent: string; displayTitle: string; attempt: number }) => AgentTask;
  applyTaskEvent: (taskId: string, ev: TaskEvent, attemptId: string) => void;
  beginAttempt: (taskId: string) => AgentTask | undefined;
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
  sessionByConversation: sessionPersisted.sessionByConversation,

  getCurrentSession: () => {
    const { sessions, currentSessionId } = get();
    return sessions[currentSessionId];
  },

  ensureSessionForEvent: (eventId) => {
    const state = get();
    if (state.sessions[state.currentSessionId]?.eventId !== eventId) invalidateAllRuns();
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

  ensureSessionForConversation: (conversationId, eventId) => {
    const state = get();
    const existing = state.sessionByConversation[conversationId];
    if (existing && state.sessions[existing]?.eventId === eventId) {
      if (state.currentSessionId !== existing) {
        invalidateAllRuns();
        set({ currentSessionId: existing });
      }
      return existing;
    }
    // 重新关联时切换到独立事件会话；不把旧事件的候选、补录或任务带入新事件。
    invalidateAllRuns();
    const legacyId = [`session-conv-${conversationId}`, SEED_SESSION_BY_CONVERSATION[conversationId]]
      .find(id => id && state.sessions[id]?.eventId === eventId);
    const sessionId = legacyId ?? `session-conv-${conversationId}-${eventId}`;
    const session = state.sessions[sessionId] ?? emptySession(sessionId, eventId);
    set((s) => ({
      sessions: { ...s.sessions, [sessionId]: session },
      sessionByConversation: { ...s.sessionByConversation, [conversationId]: sessionId },
      currentSessionId: sessionId,
    }));
    return sessionId;
  },

  switchSession: (sessionId) => {
    if (sessionId !== get().currentSessionId) invalidateAllRuns();
    set({ currentSessionId: sessionId });
  },

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

  updateDocumentWorkflow: (sessionId, messageId, workflow) => set(state => {
    const session = state.sessions[sessionId];
    if (!session) return state;
    return { sessions: { ...state.sessions, [sessionId]: {
      ...session, messages: session.messages.map(message => message.messageId === messageId ? { ...message, documentWorkflow: workflow } : message),
    } } };
  }),

  createTask: ({ sessionId, eventId, userMessageId, intent, displayTitle, attempt }) => {
    const task: AgentTask = {
      taskId: newTaskId(),
      sessionId,
      eventId,
      userMessageId,
      attemptId: crypto.randomUUID(),
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

  beginAttempt: (taskId) => {
    const task = get().tasks[taskId];
    if (!task || ['running', 'queued', 'succeeded'].includes(task.status)) return undefined;
    const next: AgentTask = { ...task, attempt: task.attempt + 1, attemptId: crypto.randomUUID(),
      status: 'queued', error: null, textAnswer: null, steps: [], artifacts: [],
      finishedAt: null, startedAt: new Date().toISOString() };
    set((s) => ({ tasks: { ...s.tasks, [taskId]: next } }));
    return next;
  },

  applyTaskEvent: (taskId, ev, attemptId) => {
    set((s) => {
      const task = s.tasks[taskId];
      if (!task || ['cancelled', 'failed', 'succeeded'].includes(task.status)) return s;
      if (!attemptId || task.attemptId !== attemptId || !isActiveRun(taskId, attemptId)) return s;
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
        case 'agent_summon': {
          // 召唤其他智能体：作为独立聊天消息插入（不改变任务状态，仅过程展示）
          const session = s.sessions[task.sessionId];
          if (session) {
            const summonMsg: ChatMessage = {
              messageId: newMessageId(),
              sessionId: task.sessionId,
              role: 'assistant',
              kind: 'agent',
              text: ev.action,
              taskId,
              agentId: ev.agentId,
              agentName: ev.agentName,
              agentRole: ev.agentRole,
              createdAt: new Date().toISOString(),
              performedAt: new Date().toISOString(),
            };
            s.sessions[task.sessionId] = { ...session, messages: [...session.messages, summonMsg] };
          }
          break;
        }
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
          next.steps = task.steps.map(st => st.status === 'running' ? { ...st, status: 'failed' } : st);
          next.error = { errorCode: ev.errorCode, message: ev.message, hint: ev.hint };
          next.finishedAt = new Date().toISOString();
          break;
        case 'completed':
          if (task.status !== 'waiting_input' && task.status !== 'cancelled') {
            next.status = ev.status ?? 'succeeded';
          }
          next.error = null;
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
          [taskId]: { ...task, status, steps: status === 'cancelled' ? task.steps.map(st => st.status === 'running' ? { ...st, status: 'cancelled' as const } : st) : task.steps, finishedAt: status === 'cancelled' ? new Date().toISOString() : task.finishedAt },
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
          [sessionId]: { ...session, lastResourceResultIds: [...resourceIds], resourceSortBy: sortedBy },
        },
      };
    });
  },

  toggleCandidate: (sessionId, resourceId) => {
    if (get().sessions[sessionId]?.candidateResourceIds.includes(resourceId)) get().removeCandidate(sessionId, resourceId);
    else get().addCandidates(sessionId, [resourceId]);
  },

  addCandidates: (sessionId, resourceIds) => {
    const before = get().sessions[sessionId]?.candidateResourceIds;
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session) return s;
      const merged = [...session.candidateResourceIds];
      for (const id of resourceIds) {
        const team = teamById.get(id);
        if (team && resourceAllowed(id, session.eventId)
          && resolveFact(team.factRefs.status, { kind: 'event', eventId: session.eventId })?.value === 'available'
          && !merged.includes(id)) merged.push(id);
      }
      if (merged.length === session.candidateResourceIds.length) return s;
      return { sessions: { ...s.sessions, [sessionId]: { ...session, candidateResourceIds: merged, selectedProposalId: null, selectedProposalVersion: null } } };
    });
    const after = get().sessions[sessionId];
    if (after && before !== after.candidateResourceIds) useDemoStore.getState().touchContext('event', after.eventId);
  },

  removeCandidate: (sessionId, resourceId) => {
    const before = get().sessions[sessionId]?.candidateResourceIds;
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session || !session.candidateResourceIds.includes(resourceId)) return s;
      return {
        sessions: {
          ...s.sessions,
          [sessionId]: {
            ...session,
            candidateResourceIds: session.candidateResourceIds.filter((id) => id !== resourceId),
            selectedProposalId: null, selectedProposalVersion: null,
          },
        },
      };
    });
    const after = get().sessions[sessionId];
    if (after && before !== after.candidateResourceIds) useDemoStore.getState().touchContext('event', after.eventId);
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
    const before = get().sessions[sessionId]?.selectedProposalId;
    set((s) => {
      const session = s.sessions[sessionId];
      if (!session || session.selectedProposalId === proposalId) return s;
      if (proposalId) {
        const proposal = s.proposals[proposalId];
        if (!proposal || proposal.eventId !== session.eventId ||
          [...proposal.candidateIds].sort().join('|') !== [...session.candidateResourceIds].sort().join('|')) return s;
      }
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
    const after = get().sessions[sessionId];
    if (after && before !== after.selectedProposalId) useDemoStore.getState().touchContext('event', after.eventId);
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
            resourceSortBy: null,
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
    invalidateAllRuns();
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
    sessionByConversation: state.sessionByConversation,
  } satisfies SessionPersist);
});
