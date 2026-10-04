import { useShallow } from 'zustand/react/shallow';
import type { AgentTask, Session } from '@/domain/types';
import { useSessionStore } from '@/store/sessionStore';

/**
 * 本会话的任务子集 = 会话自己的任务 ∪ 会话消息引用到的任务。
 * 纯函数（便于单测）：不含其它会话的任务，所以别的会话推进任务进度不会换掉返回对象的引用。
 * 两个来源都取，是为了不改变调用方原来的可见范围（原来大家读的是整张 tasks 表）。
 */
export function collectSessionTasks(
  session: Session | undefined,
  tasks: Record<string, AgentTask>,
): Record<string, AgentTask> {
  const scoped: Record<string, AgentTask> = {};
  if (!session) return scoped;
  for (const task of Object.values(tasks)) {
    if (task.sessionId === session.sessionId) scoped[task.taskId] = task;
  }
  for (const message of session.messages) {
    if (!message.taskId) continue;
    const task = tasks[message.taskId];
    if (task) scoped[task.taskId] = task;
  }
  return scoped;
}

/**
 * 订阅「本会话作用域」的任务表，替代 `useSessionStore((s) => s.tasks)`。
 *
 * 直接读整张 tasks 表的代价：任何任务事件（包括别的会话里正在跑的任务）都会换掉引用，
 * 让调用方的 useMemo（ChatPanel 的整张消息列表、KnowledgePanel 的知识聚合）整个重建。
 * 这里用 useShallow 保持内容不变时的引用稳定；本会话自己的任务更新仍会换引用（那是必须重算的）。
 *
 * 用法：传当前会话对象（`useSessionStore((s) => s.sessions[id])`），由它带来的消息变化
 * 会自然触发重算。
 */
export function useSessionTasks(session: Session | undefined): Record<string, AgentTask> {
  return useSessionStore(useShallow((s) => collectSessionTasks(session, s.tasks)));
}
