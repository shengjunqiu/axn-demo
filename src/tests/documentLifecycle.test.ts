import { beforeEach, describe, expect, it } from 'vitest';
import { useDocumentStore } from '@/store/documentStore';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { createEventDocument, createRevisionDraftFromSigned, refreshDraftSnapshot } from '@/services/documentFactory';
import { runDocumentValidation, saveCurrentRevision } from '@/services/documentLifecycle';
import { validateContent, applySuggestion } from '@/services/validation';
import { resolveFact, latestWaterLevelFactId } from '@/services/factLookup';
import { renderRevision } from '@/services/docRender';
import { DEFAULT_SESSION_ID } from '@/seed/scenario';

const store = () => useDocumentStore.getState();
function create() {
  useDemoStore.getState().addManualFact({ field: 'reportingUnit', value: '清河段防汛值班室', scopeKind: 'event', scopeId: 'evt-demo-001', actorId: useDemoStore.getState().actorId });
  const result = createEventDocument(DEFAULT_SESSION_ID);
  expect(result.ok).toBe(true);
  return result.documentId!;
}
function pass(id: string) {
  const report = runDocumentValidation(id)!;
  expect(report.issues.filter(i => i.level === 'block')).toEqual([]);
  expect(store().getDraft(id)!.validation.status).toBe('passed');
  expect(report.revisionId).toBe(store().getDraft(id)!.activeRevisionId);
  return store().getRevision(report.revisionId!)!;
}
function sign(id: string) {
  const rev = pass(id);
  store().markSubmitted(rev.revisionId, useDemoStore.getState().getActor().name);
  useDemoStore.getState().setActor('actor-demo-commander');
  const actor = useDemoStore.getState().getActor();
  store().markSigned(rev.revisionId, actor.name, actor.actorId);
  return store().getRevision(rev.revisionId)!;
}
beforeEach(() => useSessionStore.getState().resetAll());

describe('document revision trust chain', () => {
  it('missing reporting unit blocks generation', () => {
    expect(createEventDocument(DEFAULT_SESSION_ID).missingFields).toContain('reportingUnit');
  });
  it('unvalidated revision and null-revision report cannot submit/sign/export', () => {
    const id = create();
    const draft = store().getDraft(id)!;
    expect(() => store().saveRevision({ documentId: id, content: draft.working.content, sourceSnapshotId: draft.snapshot.snapshotId, createdBy: '值班员', changeNote: '', submitted: true })).toThrow();
    const rev = saveCurrentRevision(id);
    for (const action of ['submit', 'sign', 'export'] as const) expect(store().getRevisionGuard(rev.revisionId, action)).toBeTruthy();
    const report = store().addReport(validateContent({ documentId: id, content: draft.working.content, snapshot: draft.snapshot }));
    expect(report.revisionId).toBeNull();
    expect(() => store().markValidation(id, 'passed', report.reportId)).toThrow();
    expect(() => store().markSubmitted(rev.revisionId, '值班员')).toThrow();
    expect(() => store().markSigned(rev.revisionId, '指挥员', 'actor-demo-commander')).toThrow();
  });
  it('current validation ensures an idempotent saved revision; edits immediately revoke submitted authority', () => {
    const id = create();
    const rev = pass(id);
    expect(saveCurrentRevision(id).revisionId).toBe(rev.revisionId);
    store().markSubmitted(rev.revisionId, '值班员');
    const content = structuredClone(store().getDraft(id)!.working.content);
    content.sections.at(-1)!.paragraphs.push({ id: 'user', role: 'narrative', runs: [{ type: 'text', text: '持续保持联络。' }] });
    store().updateWorkingContent(id, content);
    expect(store().getDraft(id)!.validation.status).toBe('stale');
    expect(store().getDraft(id)!.lifecycle).toBe('draft');
    expect(store().getRevisionGuard(rev.revisionId, 'sign')).toBeTruthy();
    expect(validateContent({ documentId: id, content, snapshot: store().getDraft(id)!.snapshot }).issues.some(i => i.ruleId === 'R-008')).toBe(true);
    const next = pass(id);
    expect(next.revisionId).not.toBe(rev.revisionId);
    expect(next.validationReportId).toBe(store().getDraft(id)!.validation.reportId);
  });
  it('adopting a correction only makes the report stale until explicit validation', () => {
    const id = create();
    const draft = store().getDraft(id)!;
    const bad = structuredClone(draft.working.content);
    bad.sections.at(-1)!.paragraphs.push({ id: 'bad', role: 'narrative', runs: [{ type: 'text', text: '险情已经全面控制。' }] });
    store().updateWorkingContent(id, bad);
    const report = runDocumentValidation(id)!;
    const issue = report.issues.find(i => i.ruleId === 'R-005')!;
    expect(issue.level).toBe('block');
    store().updateWorkingContent(id, applySuggestion(bad, 'bad', issue.suggestionText!));
    expect(store().getDraft(id)!.validation.status).toBe('stale');
    expect(store().getRevisionGuard(report.revisionId!, 'submit')).toBeTruthy();
    pass(id);
  });
  it('signed version is immutable through lifecycle APIs; same document revision becomes V2.0', () => {
    const id = create(); const signed = sign(id); const frozen = JSON.stringify(signed);
    expect(signed.displayVersion).toBe('V1.0');
    expect(signed.locked).toBe(true);
    const modified = structuredClone(signed.contentSnapshot); modified.title = '禁止覆盖';
    store().updateWorkingContent(id, modified);
    expect(store().getDraft(id)!.working.content.title).not.toBe('禁止覆盖');
    expect(() => saveCurrentRevision(id)).toThrow();
    expect(() => refreshDraftSnapshot({ documentId: id, actorName: '值班员' })).toThrow();
    store().markSigned(signed.revisionId, '另一位指挥员', 'actor-demo-commander');
    expect(JSON.stringify(store().getRevision(signed.revisionId))).toBe(frozen);
    useDemoStore.getState().applyWaterFeedUpdate();
    expect(store().getRevisionGuard(signed.revisionId, 'export')).toBeNull();
    expect(JSON.stringify(store().getRevision(signed.revisionId))).toBe(frozen);
    const revisionDraft = createRevisionDraftFromSigned({ documentId: id, content: signed.contentSnapshot, actorName: '值班员' });
    expect(revisionDraft.documentId).toBe(id);
    refreshDraftSnapshot({ documentId: id, actorName: '值班员' });
    expect(pass(id).displayVersion).toBe('V2.0');
    expect(JSON.stringify(store().getRevision(signed.revisionId))).toBe(frozen);
    expect(store().audit.some(a => a.action === '模拟签发')).toBe(true);
  });
  it('source update appends obs006, keeps 005, and explicit refresh preserves user narration', () => {
    useSessionStore.getState().addCandidates(DEFAULT_SESSION_ID, ['team-001', 'team-002']);
    const id = create(); const rev = pass(id); const original = JSON.stringify(rev.sourceSnapshot);
    const content = structuredClone(store().getDraft(id)!.working.content);
    content.sections.at(-1)!.paragraphs.push({ id: 'user-note', role: 'narrative', runs: [{ type: 'text', text: '用户核实记录，继续跟进。' }] });
    store().updateWorkingContent(id, content);
    useDemoStore.getState().applyWaterFeedUpdate();
    expect(resolveFact('fact-obs-water-005-waterLevel')?.value).toBe(42.3);
    expect(resolveFact('fact-obs-water-005-observedAt')?.value).toContain('21:05');
    expect(resolveFact('fact-obs-water-006-waterLevel')?.value).toBe(42.35);
    expect(resolveFact('fact-obs-water-006-stationName')).toBeNull();
    expect(resolveFact('fact-clock-demo-002-missing')).toBeNull();
    expect(latestWaterLevelFactId()).toBe('fact-obs-water-006-waterLevel');
    expect(store().getRevisionGuard(rev.revisionId, 'export')).toBeTruthy();
    expect(runDocumentValidation(id)!.issues.some(i => i.ruleId === 'R-007' && i.level === 'block')).toBe(true);
    useSessionStore.getState().removeCandidate(DEFAULT_SESSION_ID, 'team-002');
    refreshDraftSnapshot({ documentId: id, actorName: '值班员' });
    const refreshed = store().getDraft(id)!;
    expect(refreshed.snapshot.waterSeries).toHaveLength(6);
    expect(refreshed.working.contextSnapshotId).toBe(refreshed.snapshot.snapshotId);
    expect(refreshed.snapshot.derived.candidate_people_count.value).toBe(36);
    expect(JSON.stringify(refreshed.working.content)).toContain('用户核实记录');
    expect(JSON.stringify(refreshed.working.content)).toContain('fact-obs-water-006-observedAt');
    const text = JSON.stringify(renderRevision(pass(id)));
    expect(text).toContain('42.35'); expect(text).toContain('36'); expect(text).not.toContain('64');
    expect(JSON.stringify(store().getRevision(rev.revisionId)!.sourceSnapshot)).toBe(original);
  });
  it('fact presence alone cannot heal a missing source record; real supplement and refresh can', () => {
    const id = create(); const draft = store().getDraft(id)!;
    const content = structuredClone(draft.working.content);
    const manual = useDemoStore.getState().addManualFact({ field: 'verifiedNote', value: '已补充现场核实记录', scopeKind: 'event', scopeId: 'evt-demo-001', actorId: useDemoStore.getState().actorId });
    content.sections.at(-1)!.paragraphs.push({ id: 'manual', role: 'fact-line', runs: [{ type: 'fact', factId: manual.factId }] });
    store().updateWorkingContent(id, content);
    expect(validateContent({ documentId: id, content, snapshot: draft.snapshot }).issues.some(i => i.ruleId === 'R-002')).toBe(true);
    refreshDraftSnapshot({ documentId: id, actorName: '值班员' });
    const snapshot = structuredClone(store().getDraft(id)!.snapshot);
    delete snapshot.sources[manual.sourceRecordId];
    expect(validateContent({ documentId: id, content, snapshot }).issues.some(i => i.ruleId === 'R-002')).toBe(true);
    pass(id);
  });
  it('duplicate signed document ID cannot replace signed working content (public Store gate)', () => {
    const id = create(); sign(id); const draft = structuredClone(store().getDraft(id)!);
    const before = JSON.stringify(store().getDraft(id));
    draft.lifecycle = 'draft'; draft.working.content.title = '覆盖攻击';
    try { store().addDraft(draft); } catch { /* rejection is also valid */ }
    expect(JSON.stringify(store().getDraft(id)) === before).toBe(true);
  });
  it('returned locked source and report nested objects cannot mutate history (public Store gate)', () => {
    const id = create(); const signed = sign(id); const before = JSON.stringify(signed);
    try { signed.sourceSnapshot.facts['fact-obs-water-005-waterLevel'].value = 99; } catch { /* frozen */ }
    expect(JSON.stringify(store().getRevision(signed.revisionId)) === before).toBe(true);
    const report = store().reports[signed.validationReportId!]; const reportBefore = JSON.stringify(report);
    try { report.issues.push({ ruleId: 'fake', level: 'block', message: '', sectionId: null, paragraphId: null, currentValue: null, suggestion: null, suggestionText: null, fieldKey: null }); } catch { /* frozen */ }
    expect(JSON.stringify(store().reports[report.reportId])).toBe(reportBefore);
  });
});
