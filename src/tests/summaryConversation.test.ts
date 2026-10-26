import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { startSummaryConversation, respondToSummaryOffer } from '@/services/summaryConversation';
import { useSessionStore } from '@/store/sessionStore';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useKnowledgeCaseStore } from '@/services/knowledgePublish';

beforeEach(() => {
  vi.useFakeTimers();
  useSessionStore.getState().resetAll();
  useMockDocumentStore.setState({ libraries: {} });
  useKnowledgeCaseStore.getState().resetAll();
});
afterEach(() => vi.useRealTimers());

describe('先评估再确认生成复盘报告', () => {
  it('首次只输出四项简评，不生成文书或知识候选', () => {
    const sid = useSessionStore.getState().ensureSessionForEvent('evt-sim-debris-review');
    startSummaryConversation(sid, '这次救援结束了，帮我把过程资料整理成一份总结。');
    const reply = useSessionStore.getState().sessions[sid].messages.at(-1)!;
    expect(reply.reviewSummary?.rows).toHaveLength(4);
    expect(reply.summaryOffer?.kind).toBe('report');
    expect(reply.text).toContain('需要我');
    expect(useMockDocumentStore.getState().libraries[sid]).toBeUndefined();
    expect(useKnowledgeCaseStore.getState().cases).toHaveLength(0);
  });
  it('确认后生成报告，第二次确认才整理待审经验候选', async () => {
    const sid = useSessionStore.getState().ensureSessionForEvent('evt-sim-debris-review');
    startSummaryConversation(sid, '帮我整理总结');
    expect(respondToSummaryOffer(sid, '是')).toBe(true);
    expect(respondToSummaryOffer(sid, '是')).toBe(false);
    await vi.advanceTimersByTimeAsync(10000);
    const session = useSessionStore.getState().sessions[sid];
    expect(session.messages.filter(message => message.documentWorkflow?.compactReview)).toHaveLength(1);
    expect(session.messages.at(-1)?.summaryOffer?.kind).toBe('knowledge');
    expect(useMockDocumentStore.getState().libraries[sid]?.documents.some(document => document.id === session.messages.at(-1)?.summaryOffer?.documentId)).toBe(true);
    expect(useKnowledgeCaseStore.getState().cases).toHaveLength(0);
    expect(respondToSummaryOffer(sid, '需要')).toBe(true);
    expect(useKnowledgeCaseStore.getState().cases).toHaveLength(1);
    expect(useKnowledgeCaseStore.getState().cases[0].status).toBe('待审');
  });
  it('无确认上下文不接受“是”；拒绝或转问其他问题不触发生成', () => {
    const sid = useSessionStore.getState().ensureSessionForEvent('evt-sim-debris-review');
    expect(respondToSummaryOffer(sid, '是')).toBe(false);
    startSummaryConversation(sid, '整理总结');
    expect(respondToSummaryOffer(sid, '现在天气如何')).toBe(false);
    expect(respondToSummaryOffer(sid, '不需要')).toBe(true);
    expect(respondToSummaryOffer(sid, '是')).toBe(false);
    expect(useMockDocumentStore.getState().libraries[sid]).toBeUndefined();
  });
});
