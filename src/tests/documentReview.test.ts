import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { applyReviewDemoFixes, withReviewDemoIssues } from '@/services/documentReviewScenario';
import { MOCK_DOCUMENTS } from '@/seed/mockDocuments';
import { DOCUMENT_CHECK_INTERVAL, DOCUMENT_CHECK_ITEMS, useDocumentReviewStore } from '@/store/documentReviewStore';
import { useMockDocumentStore } from '@/store/mockDocumentStore';

const doc = MOCK_DOCUMENTS.find(document => document.code === 'EMERGENCY_BRIEF')!;
const CHECK_DURATION = DOCUMENT_CHECK_INTERVAL * DOCUMENT_CHECK_ITEMS.length;
const reviewOf = (scope = 'session-a') => useDocumentReviewStore.getState().reviews[scope]?.[doc.id];

beforeEach(() => { useMockDocumentStore.getState().reset(); });
afterEach(() => { vi.useRealTimers(); });

describe('模拟文书检查', () => {
  it('依次完成数据校验、内容初审与格式审核', () => {
    const store = useDocumentReviewStore.getState();
    store.start('session-a', doc);
    const run = reviewOf()!;
    store.advance('session-a', doc.id, run.runId, run.startedAt + DOCUMENT_CHECK_INTERVAL * 4);
    expect(reviewOf()).toMatchObject({ status: 'running', completedCount: 4, completedAt: null });
    store.advance('session-a', doc.id, run.runId, run.startedAt + DOCUMENT_CHECK_INTERVAL * DOCUMENT_CHECK_ITEMS.length);
    expect(reviewOf()).toMatchObject({ status: 'passed', completedCount: DOCUMENT_CHECK_ITEMS.length });
    expect(reviewOf()?.completedAt).not.toBeNull();
  });

  it('编辑立即使检查失效，旧计时器和旧结果不能覆盖重检', () => {
    const store = useDocumentReviewStore.getState();
    store.start('session-a', doc);
    const old = reviewOf()!;
    useMockDocumentStore.getState().setWorking('session-a', { ...doc, title: '修改后的标题' });
    expect(reviewOf()?.status).toBe('stale');
    store.advance('session-a', doc.id, old.runId, old.startedAt + CHECK_DURATION);
    expect(reviewOf()?.status).toBe('stale');
    store.start('session-a', { ...doc, title: '修改后的标题' });
    const next = reviewOf()!;
    store.advance('session-a', doc.id, old.runId, next.startedAt + CHECK_DURATION);
    expect(reviewOf()).toMatchObject({ status: 'running', completedCount: 0 });
    store.advance('session-a', doc.id, next.runId, next.startedAt + CHECK_DURATION);
    expect(reviewOf()).toMatchObject({ status: 'passed', snapshot: { title: '修改后的标题' } });
  });

  it('保存相同内容不会使结果失效，不同会话互不影响', () => {
    const store = useDocumentReviewStore.getState();
    store.start('session-a', doc);
    store.start('session-b', doc);
    const a = reviewOf()!;
    store.advance('session-a', doc.id, a.runId, a.startedAt + CHECK_DURATION);
    useMockDocumentStore.getState().update('session-a', doc);
    expect(reviewOf()?.status).toBe('passed');
    useMockDocumentStore.getState().setWorking('session-b', { ...doc, title: '另一会话的修改' });
    expect(reviewOf()?.status).toBe('passed');
    expect(reviewOf('session-b')?.status).toBe('stale');
  });

  it('发现人数和格式问题，内容初审仍通过；未修正文书时重检仍报错', () => {
    const store = useDocumentReviewStore.getState();
    const bad = withReviewDemoIssues(doc);
    store.start('session-a', bad);
    let run = reviewOf()!;
    expect(run.issues?.map(issue => issue.title)).toEqual(['人数合计不一致', '日期格式错误']);
    store.advance('session-a', doc.id, run.runId, run.startedAt + CHECK_DURATION);
    expect(reviewOf()?.status).toBe('issues');
    store.start('session-a', bad);
    run = reviewOf()!;
    store.advance('session-a', doc.id, run.runId, run.startedAt + CHECK_DURATION);
    expect(reviewOf()?.status).toBe('issues');
    const fixed = applyReviewDemoFixes({ ...bad, title: '用户编辑后的标题' });
    expect(fixed.title).toBe('用户编辑后的标题');
    expect(fixed.sections.slice(1)).toEqual(bad.sections.slice(1));
    expect(fixed.date).toBe(doc.date);
    expect(fixed.sections[0][1]).toContain('累计转移群众 96 人');
    store.start('session-a', fixed);
    const next = reviewOf()!;
    store.advance('session-a', doc.id, run.runId, next.startedAt + CHECK_DURATION);
    expect(reviewOf()?.status).toBe('running');
    store.advance('session-a', doc.id, next.runId, next.startedAt + CHECK_DURATION);
    expect(reviewOf()).toMatchObject({ status: 'passed', issues: [] });
  });

  it('生成文书会自动创建检查，重置后旧任务不能回写', async () => {
    vi.useFakeTimers();
    const generation = useMockDocumentStore.getState().generate('session-a', 'EMERGENCY_BRIEF');
    await vi.advanceTimersByTimeAsync(1200);
    const generated = await generation;
    expect(generated).not.toBeNull();
    const review = useDocumentReviewStore.getState().reviews['session-a'][generated!.id];
    expect(review.status).toBe('running');
    expect(review.issues).toHaveLength(2);
    expect(generated?.date).toMatch(/^\d{4}\/\d{1,2}\/\d{1,2}$/);
    useMockDocumentStore.getState().reset();
    useDocumentReviewStore.getState().advance('session-a', generated!.id, review.runId, review.startedAt + CHECK_DURATION);
    expect(useDocumentReviewStore.getState().reviews).toEqual({});
  });
});
