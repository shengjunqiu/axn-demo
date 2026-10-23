import { useSessionStore } from '@/store/sessionStore';
import { aggregationCounts, buildMultiSourceSnapshot } from './multiSourceAggregation';
import { multiSourceBrief } from './multiSourceBrief';
export function startMultiSourceConversation(sessionId: string, request: string) {
  const store = useSessionStore.getState();
  const session = store.sessions[sessionId];
  if (!session) return;
  const snapshot = buildMultiSourceSnapshot(session.eventId);
  const counts = aggregationCounts(snapshot.event.sources);
  store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text: request, taskId: null });
  store.appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', taskId: null,
    text: '需要我为您展开六类数据的详细图表吗？', multiSourceDetails: snapshot,
    reviewSummary: { conclusion: `已汇总${counts.covered}类来源，以下按类别概括当前情况。`, rows: snapshot.event.sources.map(source => ({ label: source.kind, value: multiSourceBrief(source, session.eventId) })) }, summaryOffer: { kind: 'sixData', request: session.eventId } });
}
