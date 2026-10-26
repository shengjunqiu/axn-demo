import { useSessionStore } from '@/store/sessionStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

/** 所有入口共用会话内预警，旧工作区入口也迁移到这里。 */
export function openInlineSituation(sessionId: string, tab: '态势研判预警' | '预警推送') {
  const store = useSessionStore.getState();
  const session = store.sessions[sessionId];
  if (!session) return;
  store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', taskId: null, text: tab });
  store.appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', taskId: null, text: tab,
    inlineSituation: { kind: tab === '预警推送' ? 'warning' : 'forecast', eventId: session.eventId } });
  useWorkspaceStore.getState().close(sessionId);
}
