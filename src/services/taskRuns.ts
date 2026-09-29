import { useSessionStore } from '@/store/sessionStore';
import { useDemoStore } from '@/store/demoStore';

/** Runtime identities are never persisted. Invalidated runs cannot publish results. */
export interface TaskRun {
  taskId: string;
  attemptId: string;
  eventId: string;
  sessionId: string;
  controller: AbortController;
}
const activeRuns = new Map<string, TaskRun>();
const cancelled = new Map<string, () => void>();

export function registerRun(run: TaskRun, onCancel: () => void): void {
  invalidateRun(run.taskId);
  activeRuns.set(run.taskId, run);
  cancelled.set(run.taskId, onCancel);
}
export function isActiveRun(taskId: string, attemptId: string): boolean {
  const run = activeRuns.get(taskId);
  if (!run || run.attemptId !== attemptId || run.controller.signal.aborted) return false;
  const state = useSessionStore.getState();
  const task = state.tasks[taskId];
  return !!task && !['succeeded', 'failed', 'cancelled'].includes(task.status) && task.attemptId === attemptId && task.sessionId === run.sessionId && task.eventId === run.eventId
    && state.sessions[run.sessionId]?.eventId === run.eventId
    && useDemoStore.getState().currentEventId === run.eventId;
}
export function finishRun(taskId: string, attemptId: string): void {
  if (activeRuns.get(taskId)?.attemptId !== attemptId) return;
  activeRuns.delete(taskId);
  cancelled.delete(taskId);
}
export function invalidateRun(taskId: string): void {
  const run = activeRuns.get(taskId);
  const notify = cancelled.get(taskId);
  activeRuns.delete(taskId);
  cancelled.delete(taskId);
  run?.controller.abort();
  notify?.();
}
export function invalidateAllRuns(): void {
  for (const id of [...activeRuns.keys()]) invalidateRun(id);
}
