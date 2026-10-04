import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { useDocumentStore } from '@/store/documentStore';
import { sendMessage, cancelTask, retryTask } from '@/services/taskRunner';
import { mockProvider } from '@/services/mock/provider';
import { finishRun, isActiveRun, registerRun } from '@/services/taskRuns';
import { resolveFact, latestWaterLevelFactId, resourceAllowed } from '@/services/factLookup';
import { buildSnapshot } from '@/services/snapshot';
import { createDailyDocument } from '@/services/documentFactory';
import { documentFactScope, resolveDocumentFact } from '@/services/documentFactScope';
import { incidentById, shift } from '@/seed/scenario';
import type { TaskEvent } from '@/domain/types';

const A = 'evt-demo-001';
const B = 'evt-demo-002';
const session = () => useSessionStore.getState().ensureSessionForEvent(useDemoStore.getState().currentEventId);
const task = (id: string) => useSessionStore.getState().tasks[id];
const settle = () => vi.runAllTimersAsync();
/** 模拟硬刷新：pagehide 是生产环境冲刷待写入持久化的真实路径（persistence.ts）。 */
const simulateReload = () => window.dispatchEvent(new Event('pagehide'));
const supplement = (field: string, value: string, scopeKind: 'event' | 'shift' = 'shift') =>
  useDemoStore.getState().addManualFact({ field, value, scopeKind, scopeId: scopeKind === 'shift' ? shift.shiftId : A, actorId: useDemoStore.getState().actorId });

beforeEach(() => {
  useSessionStore.getState().resetAll();
  useDemoStore.getState().setPace('fast');
  vi.useFakeTimers();
});
afterEach(() => {
  useSessionStore.getState().resetAll();
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe('document scope and runtime guards', () => {
  it('daily sources remain accessible in A and B without authorizing them in an event document', () => {
    supplement('reportingUnit', '日报单位');
    const handover = supplement('handOverNotes', '日报交接');
    const result = createDailyDocument(session());
    expect(result.ok).toBe(true);
    const draft = useDocumentStore.getState().drafts[result.documentId!];
    const ids = [handover.factId, shift.factRefs.startsAt, incidentById.get(A)!.factRefs.title, incidentById.get(B)!.factRefs.title];
    const original = ids.map((id) => resolveDocumentFact(id, draft));
    expect(original.every(Boolean)).toBe(true);
    for (const eventId of [B, A]) {
      useDemoStore.getState().switchEvent(eventId);
      expect(ids.map((id) => resolveDocumentFact(id, draft))).toEqual(original);
    }
    expect(documentFactScope(draft)).toEqual({ kind: 'shift', shiftId: shift.shiftId });
    expect(resolveDocumentFact(handover.factId, { scopeKind: 'event', eventId: A, shiftId: null })).toBeNull();
    expect(resolveDocumentFact(ids[3], { scopeKind: 'event', eventId: A, shiftId: null })).toBeNull();
    expect(resolveDocumentFact(ids[0], undefined)).toBeNull();
    expect(documentFactScope({ scopeKind: 'shift', eventId: A, shiftId: null })).toBeNull();
  });

  it('store rejects missing/empty identity and finished waiting-input identity', () => {
    const sid = session();
    const created = useSessionStore.getState().createTask({ sessionId: sid, eventId: A, userMessageId: '', intent: 'summary', displayTitle: '', attempt: 1 });
    registerRun({ ...created, controller: new AbortController() }, () => {});
    const apply = useSessionStore.getState().applyTaskEvent;
    // Exercise JS callers bypassing the required TypeScript parameter.
    // @ts-expect-error attemptId is required at compile time and checked at runtime.
    apply(created.taskId, { type: 'text_delta', text: 'missing identity' });
    apply(created.taskId, { type: 'text_delta', text: 'empty identity' }, '');
    expect(task(created.taskId).textAnswer).toBeNull();
    apply(created.taskId, { type: 'clarification_required', clarification: {
      clarificationId: 'test', field: 'reportingUnit', prompt: '补录', exampleHint: '', scopeKind: 'event', scopeId: A,
    } }, created.attemptId);
    expect(task(created.taskId).status).toBe('waiting_input');
    expect(isActiveRun(created.taskId, created.attemptId)).toBe(true);
    finishRun(created.taskId, created.attemptId);
    const finished = task(created.taskId);
    apply(created.taskId, { type: 'text_delta', text: 'finished identity' }, created.attemptId);
    expect(task(created.taskId)).toEqual(finished);
    expect(isActiveRun(created.taskId, created.attemptId)).toBe(false);
  });
});

describe('D04 / run identity', () => {
  it.each(['报送单位是重置竞态中心', '形成处置建议', '生成应急要情', '生成值班日报'])('reset rejects late effects: %s', async (text) => {
    supplement('reportingUnit', '单位', 'event');
    supplement('reportingUnit', '单位');
    supplement('handOverNotes', '交接');
    const id = await sendMessage(session(), { text });
    await vi.advanceTimersByTimeAsync(140);
    expect(task(id)).toBeDefined();
    useSessionStore.getState().resetAll();
    await settle();
    expect(useDemoStore.getState().manualFacts).toEqual([]);
    expect(useSessionStore.getState().tasks).toEqual({});
    expect(useSessionStore.getState().proposals).toEqual({});
    expect(useDocumentStore.getState().drafts).toEqual({});
    expect(useDocumentStore.getState().audit).toEqual([]);
    expect(Object.values(useSessionStore.getState().sessions).every((s) => s.activeDocumentId === null)).toBe(true);
  });

  it.each(['cancel', 'switch'])('%s synchronously closes steps and rejects late manual writes', async (action) => {
    const id = await sendMessage(session(), { text: '报送单位是不得晚到' });
    await vi.advanceTimersByTimeAsync(140);
    if (action === 'cancel') cancelTask(id);
    else useDemoStore.getState().switchEvent(B);
    const stopped = task(id);
    expect(stopped.status).toBe('cancelled');
    expect(stopped.steps.some((s) => s.status === 'running')).toBe(false);
    await settle();
    expect(task(id)).toEqual(stopped);
    expect(useDemoStore.getState().manualFacts).toEqual([]);
  });

  it('runner sleepZero and an abort-ignoring provider cannot publish late events', async () => {
    let release!: (event: TaskEvent) => void;
    vi.spyOn(mockProvider, 'run').mockImplementation(async function* () {
      yield await new Promise<TaskEvent>((r) => { release = r; });
    });
    const id = await sendMessage(session(), { text: '灾情摘要' });
    release({ type: 'text_delta', text: '不得出现' });
    for (let i = 0; i < 5; i++) await Promise.resolve();
    // 排空持久化合并窗口的定时器，使计数只反映任务运行时的定时器。
    simulateReload();
    expect(vi.getTimerCount()).toBe(1);
    cancelTask(id);
    const stopped = task(id);
    await settle();
    expect(task(id)).toEqual(stopped);
    expect(task(id).textAnswer).toBeNull();
  });

  it.each(['complete', 'cancel'])('sleep releases abort listeners on %s', async (action) => {
    const original = mockProvider.run;
    let capturedSignal!: AbortSignal;
    vi.spyOn(mockProvider, 'run').mockImplementation((request, signal) => {
      capturedSignal = signal;
      vi.spyOn(signal, 'addEventListener');
      vi.spyOn(signal, 'removeEventListener');
      return original(request, signal);
    });
    const id = await sendMessage(session(), { text: '灾情摘要' });
    if (action === 'cancel') {
      await vi.advanceTimersByTimeAsync(10);
      cancelTask(id);
    }
    await settle();
    const listeners = vi.mocked(capturedSignal.addEventListener).mock.calls.filter(([type]) => type === 'abort');
    expect(listeners.length).toBeGreaterThan(0);
    for (const [type, callback] of listeners) expect(capturedSignal.removeEventListener).toHaveBeenCalledWith(type, callback);
  });

  it('events after completed cannot apply resource side effects', async () => {
    vi.spyOn(mockProvider, 'run').mockImplementation(async function* () {
      yield { type: 'completed' };
      yield { type: 'step_completed', stepId: 'late', artifact: { payload: {
        kind: 'resources', eventId: A, resourceIds: ['team-001'], sortedBy: 'eta', dataTime: '', excluded: [], note: '',
      } } };
    });
    const sid = session();
    const id = await sendMessage(sid, { text: '查询周边救援资源' });
    await settle();
    expect(task(id).status).toBe('succeeded');
    expect(useSessionStore.getState().sessions[sid].lastResourceResultIds).toEqual([]);
  });

  it('retry has a new identity, rejects double click/old events and old cleanup', async () => {
    useDemoStore.getState().armFault('resource_timeout_once');
    const id = await sendMessage(session(), { text: '查询周边救援资源' });
    await settle();
    expect(task(id).status).toBe('failed');
    const old = task(id).attemptId;
    await retryTask(id);
    const current = task(id).attemptId;
    expect(current).not.toBe(old);
    expect(task(id).attempt).toBe(2);
    expect(task(id).error).toBeNull();
    await retryTask(id);
    expect(task(id).attemptId).toBe(current);
    finishRun(id, old);
    expect(isActiveRun(id, current)).toBe(true);
    useSessionStore.getState().applyTaskEvent(id, { type: 'text_delta', text: '旧 attempt' }, old);
    expect(task(id).textAnswer).toBeNull();
    await settle();
    expect(task(id).status).toBe('succeeded');
    expect(task(id).steps.every((s) => s.status !== 'running')).toBe(true);
    expect(task(id).error).toBeNull();
  });

  it('retry refuses another active task in the same session', async () => {
    const sid = session();
    const first = await sendMessage(sid, { text: '灾情摘要' });
    cancelTask(first);
    await settle();
    await sendMessage(sid, { text: '形成处置建议' });
    await retryTask(first);
    expect(task(first).attempt).toBe(1);
    expect(task(first).status).toBe('cancelled');
    await settle();
  });

  it('identity requires matching task attempt, session event and current UI event', () => {
    const sid = session();
    const created = useSessionStore.getState().createTask({ sessionId: sid, eventId: A, userMessageId: '', intent: 'summary', displayTitle: '', attempt: 1 });
    registerRun({ ...created, controller: new AbortController() }, () => {});
    expect(isActiveRun(created.taskId, created.attemptId)).toBe(true);
    useDemoStore.setState({ currentEventId: B });
    expect(isActiveRun(created.taskId, created.attemptId)).toBe(false);
    useDemoStore.setState({ currentEventId: A });
    useSessionStore.setState((s) => ({ sessions: { ...s.sessions, [sid]: { ...s.sessions[sid], eventId: B } } }));
    expect(isActiveRun(created.taskId, created.attemptId)).toBe(false);
  });
});

describe('D06 / explicit fact scope', () => {
  it('B summary and proposal never bind A water/situation/resources', async () => {
    useDemoStore.getState().switchEvent(B);
    const sid = session();
    const id = await sendMessage(sid, { text: '灾情摘要' });
    await settle();
    const artifact = task(id).artifacts.find((a) => a.payload.kind === 'summary')!;
    expect(artifact.payload.kind).toBe('summary');
    if (artifact.payload.kind !== 'summary') throw new Error('missing summary');
    expect(artifact.payload.waterLevelFactId).toBeNull();
    expect(artifact.payload.rows.every((row) => resolveFact(row.factId, { kind: 'event', eventId: B }))).toBe(true);
    expect(JSON.stringify(artifact)).not.toContain('已确认）');
    expect(latestWaterLevelFactId(B)).toBeNull();
    await sendMessage(sid, { text: '形成处置建议' });
    await settle();
    for (const proposal of Object.values(useSessionStore.getState().proposals)) {
      expect(proposal.factRefsUsed.every((id) => resolveFact(id, { kind: 'event', eventId: B }))).toBe(true);
    }
    const resources = await sendMessage(sid, { text: '查询周边救援资源' });
    await settle();
    expect(task(resources).artifacts).toEqual([]);
    expect(useSessionStore.getState().sessions[sid].lastResourceResultIds).toEqual([]);
  });

  it('A fact is rejected after switching to B and remains correct on returning to A', () => {
    const water = latestWaterLevelFactId(A)!;
    const original = resolveFact(water);
    expect(original?.value).toBe(42.3);
    useDemoStore.getState().switchEvent(B);
    expect(resolveFact(water)).toBeNull();
    useDemoStore.getState().switchEvent(A);
    expect(resolveFact(water)).toEqual(original);
  });

  it('event isolation denies shared resources without authorization; shift keeps A+B', () => {
    const water = latestWaterLevelFactId(A)!;
    const titleB = incidentById.get(B)!.factRefs.title;
    expect(resolveFact(water, { kind: 'event', eventId: B })).toBeNull();
    expect(resolveFact(titleB, { kind: 'event', eventId: A })).toBeNull();
    expect(resourceAllowed('team-001', A)).toBe(true);
    expect(resourceAllowed('team-001', B)).toBe(false);
    expect(resolveFact('fact-team-001-name', { kind: 'event', eventId: B })).toBeNull();
    const manual = supplement('handOverNotes', '班次交接');
    expect(resolveFact(manual.factId, { kind: 'event', eventId: A })).toBeNull();
    useDemoStore.getState().switchEvent(B);
    const sid = session();
    const snapshot = buildSnapshot({ scopeKind: 'shift', eventId: null, shiftId: shift.shiftId, sessionId: sid, extraFactIds: [water, titleB], derivedKeys: ['daily_incident_count', 'daily_ongoing_count', 'daily_controlled_count'], label: 'test' });
    expect(snapshot.facts[water]).toBeDefined();
    expect(snapshot.facts[titleB]).toBeDefined();
    expect(snapshot.facts[manual.factId]?.value).toBe('班次交接');
    expect(Object.values(snapshot.derived).map((d) => d.value)).toEqual([2, 1, 1]);
    const isolated = buildSnapshot({ scopeKind: 'event', eventId: B, shiftId: null, sessionId: sid, extraFactIds: [water], label: 'test' });
    expect(isolated.waterSeries).toEqual([]);
    expect(isolated.facts[water]).toBeUndefined();
    expect(resolveFact(water, { kind: 'shift', shiftId: 'outside-shift' })).toBeNull();
  });
});

describe('D03 / hydration', () => {
  it('legacy duplicate IDs fail closed instead of selecting the first value', () => {
    const entry = supplement('reportingUnit', '单位');
    useDemoStore.setState({ manualFacts: [entry, { ...entry, field: 'handOverNotes', value: '交接' }] });
    expect(resolveFact(entry.factId, { kind: 'shift', shiftId: shift.shiftId })).toBeNull();
  });

  it.each(['non-array', 'invalid-entries'])('malformed hydration is filtered with a warning: %s', async (mode) => {
    const valid = supplement('handOverNotes', '保留有效记录');
    simulateReload();
    const saved = JSON.parse(localStorage.getItem('anneng-demo:v1:demo')!);
    saved.data.manualFacts = mode === 'non-array' ? { broken: true } : [null, 42, {}, { ...valid, value: null }, valid];
    localStorage.setItem('anneng-demo:v1:demo', JSON.stringify(saved));
    vi.resetModules();
    const { useDemoStore: restored } = await import('@/store/demoStore');
    expect(restored.getState().manualFacts).toEqual(mode === 'non-array' ? [] : [valid]);
    expect(restored.getState().storageWarning).toContain('格式不完整');
    restored.getState().reset();
  });

  it('reload preserves distinct manual values and interrupted task can retry with new identity', async () => {
    const unit = supplement('reportingUnit', '刷新前单位');
    await sendMessage(session(), { text: '灾情摘要' });
    simulateReload();
    // Stop the old JS runtime without rewriting its persisted queued/running task.
    const persistedSession = localStorage.getItem('anneng-demo:v1:session');
    useSessionStore.getState().resetAll();
    await settle();
    localStorage.setItem('anneng-demo:v1:session', persistedSession!);
    // Persist the pre-refresh manual fact via the normal store persistence subscriber.
    useDemoStore.setState({ manualFacts: [unit] });
    simulateReload();
    vi.resetModules();
    const { useDemoStore: restoredDemo } = await import('@/store/demoStore');
    const { useSessionStore: restoredSession } = await import('@/store/sessionStore');
    const { resolveFact: restoredResolve } = await import('@/services/factLookup');
    const restoredFactory = await import('@/services/documentFactory');
    const restoredDocuments = await import('@/store/documentStore');
    const restoredRunner = await import('@/services/taskRunner');
    const handover = restoredDemo.getState().addManualFact({ field: 'handOverNotes', value: '刷新后交接', scopeKind: 'shift', scopeId: shift.shiftId, actorId: restoredDemo.getState().actorId });
    expect(handover.factId).not.toBe(unit.factId);
    expect(handover.sourceRecordId).not.toBe(unit.sourceRecordId);
    const scope = { kind: 'shift' as const, shiftId: shift.shiftId };
    expect(restoredResolve(unit.factId, scope)?.value).toBe('刷新前单位');
    expect(restoredResolve(handover.factId, scope)?.value).toBe('刷新后交接');
    const interrupted = Object.values(restoredSession.getState().tasks)[0];
    expect(interrupted.status).toBe('failed');
    const result = restoredFactory.createDailyDocument(interrupted.sessionId);
    expect(result.ok).toBe(true);
    const draft = restoredDocuments.useDocumentStore.getState().drafts[result.documentId!];
    expect(draft.snapshot.facts[handover.factId].value).toBe('刷新后交接');
    await restoredRunner.retryTask(interrupted.taskId);
    expect(restoredSession.getState().tasks[interrupted.taskId].attemptId).not.toBe(interrupted.attemptId);
    await settle();
    expect(restoredSession.getState().tasks[interrupted.taskId].status).toBe('succeeded');
    restoredSession.getState().resetAll();
  });
});
