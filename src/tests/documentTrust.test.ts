import { beforeEach, describe, expect, it } from 'vitest';
import { useSessionStore } from '@/store/sessionStore';
import { useDemoStore } from '@/store/demoStore';
import { useDocumentStore } from '@/store/documentStore';
import { createEventDocument, createDailyDocument, refreshDraftSnapshot } from '@/services/documentFactory';
import { validateContent } from '@/services/validation';
import { runDocumentValidation } from '@/services/documentLifecycle';
import { DEFAULT_SESSION_ID, shift } from '@/seed/scenario';
import type { DocumentContent, SourceSnapshot } from '@/domain/types';

const A = 'evt-demo-001';
const store = () => useDocumentStore.getState();
const manual = (field: string, value: string, daily = false) => useDemoStore.getState().addManualFact({ field, value, scopeKind: daily ? 'shift' : 'event', scopeId: daily ? shift.shiftId : A, actorId: useDemoStore.getState().actorId });
function create(daily = false) {
  manual('reportingUnit', '原报送单位', daily);
  if (daily) manual('handOverNotes', '原交接事项持续跟踪情况', true);
  const result = daily ? createDailyDocument(DEFAULT_SESSION_ID) : createEventDocument(DEFAULT_SESSION_ID);
  expect(result.ok).toBe(true);
  return result.documentId!;
}
function setup() {
  useSessionStore.getState().addCandidates(DEFAULT_SESSION_ID, ['team-001']);
  const id = create();
  const draft = store().getDraft(id)!;
  return { id, content: structuredClone(draft.working.content), snapshot: structuredClone(draft.snapshot) };
}
function rules(id: string, content: DocumentContent, snapshot: SourceSnapshot) {
  return validateContent({ documentId: id, content, snapshot }).issues;
}
beforeEach(() => useSessionStore.getState().resetAll());

describe('baseline R001–012 frozen source checks', () => {
  it('a full generated document passes; deleting a required body binding is R001 even when snapshot keeps it', () => {
    const { id, content, snapshot } = setup();
    expect(rules(id, content, snapshot)).toEqual([]);
    content.sections.find(s => s.id === 'report')!.paragraphs[0].runs = [{ type: 'text', text: '报送单位：任意输入不代替来源' }];
    expect(rules(id, content, snapshot).find(i => i.ruleId === 'R-001')?.level).toBe('block');
  });
  it.each(['missing-record', 'missing-field', 'value', 'version', 'time', 'scope'])(
    'checks complete source evidence for fact references: %s', mode => {
      const { id, content, snapshot } = setup();
      const f = snapshot.facts['fact-obs-water-005-waterLevel'];
      if (mode === 'missing-record') delete snapshot.sources[f.sourceRecordId];
      if (mode === 'missing-field') delete snapshot.sources[f.sourceRecordId].fields[f.sourceFieldKey];
      if (mode === 'value') f.value = 99;
      if (mode === 'version') f.sourceVersion++;
      if (mode === 'time') f.capturedAt = '2000-01-01';
      if (mode === 'scope') f.scope = { kind: 'event', eventId: 'evt-demo-002', orgId: 'org-demo-001' };
      const expected = mode.startsWith('missing') ? 'R-002' : mode === 'scope' ? 'R-009' : 'R-003';
      expect(rules(id, content, snapshot).some(i => i.ruleId === expected && i.level === 'block')).toBe(true);
    },
  );
  it.each(['value', 'version', 'time', 'scope'])(
    'derived input %s must be validated against its source even if forged totals agree', mode => {
      const { id, content, snapshot } = setup();
      const d = snapshot.derived.candidate_people_count;
      const f = snapshot.facts[d.inputFactIds[0]];
      if (mode === 'value') { f.value = 99; d.value = 99; }
      if (mode === 'version') f.sourceVersion++;
      if (mode === 'time') f.capturedAt = '2000-01-01';
      if (mode === 'scope') f.scope = { kind: 'event', eventId: 'evt-demo-002', orgId: 'org-demo-001' };
      expect(rules(id, content, snapshot).some(i => i.ruleId === (mode === 'scope' ? 'R-009' : 'R-003'))).toBe(true);
    },
  );
  it('R003 detects altered derived value, formula and input IDs', () => {
    for (const field of ['value', 'formula', 'inputFactIds']) {
      const { id, content, snapshot } = setup();
      const d = snapshot.derived.candidate_people_count;
      if (field === 'value') d.value = 99;
      if (field === 'formula') d.formula = 'arbitrary';
      if (field === 'inputFactIds') d.inputFactIds = [];
      expect(rules(id, content, snapshot).some(i => i.ruleId === 'R-003')).toBe(true);
    }
  });
  it.each(['九十九台设备', '99台设备', '一亿人', '零人', '〇台设备', '两台设备', '九千万元'])(
    'R010 blocks free quantity despite adjacent citation and fact-line role: %s', text => {
      const { id, content, snapshot } = setup();
      const p = content.sections[0].paragraphs[0];
      p.runs.push({ type: 'text', text });
      expect(rules(id, content, snapshot).find(i => i.ruleId === 'R-010' && i.paragraphId === p.id)?.level).toBe('block');
    },
  );
  it('R010 allows ordinary Chinese wording, reference versions and headings; bound numbers pass', () => {
    const { id, content, snapshot } = setup();
    content.sections[0].heading = '一、情况';
    content.sections[0].paragraphs.push({ id: 'safe', role: 'narrative', runs: [{ type: 'text', text: '进一步落实下一步工作，统一组织，万众一心。' }] });
    content.sections[0].paragraphs.push({ id: 'reference', role: 'reference', runs: [{ type: 'text', text: '模板版本 v1.0.0' }] });
    expect(rules(id, content, snapshot).filter(i => i.ruleId === 'R-010')).toEqual([]);
  });
  it('R007 stale context blocks until refresh; R008 old report no longer authorizes changed content', () => {
    const { id, content, snapshot } = setup();
    const report = runDocumentValidation(id)!;
    expect(report.issues).toEqual([]);
    manual('reportingUnit', '新单位');
    expect(rules(id, content, snapshot).find(i => i.ruleId === 'R-007')?.level).toBe('block');
    content.title += '修改';
    expect(rules(id, content, snapshot).find(i => i.ruleId === 'R-008')?.level).toBe('block');
  });
  it('R011 removed declaration blocks; restored declaration passes; R012 verbosity warns only', () => {
    const { id, content, snapshot } = setup();
    const footer = content.footerNote;
    content.footerNote = '';
    expect(rules(id, content, snapshot).find(i => i.ruleId === 'R-011')?.level).toBe('block');
    content.footerNote = footer;
    content.sections[0].paragraphs.push({ id: 'verbose', role: 'narrative', runs: [{ type: 'text', text: '为了能够进一步更好地做好工作。' }] });
    expect(rules(id, content, snapshot).filter(i => i.level === 'block')).toEqual([]);
    expect(rules(id, content, snapshot).find(i => i.ruleId === 'R-012')?.level).toBe('warning');
  });
});

describe('explicit refresh rebinds scoped manual citations', () => {
  it.each([false, true])('unit update remains frozen until refresh (daily=%s)', daily => {
    const id = create(daily); const before = structuredClone(store().getDraft(id)!);
    const unit = manual('reportingUnit', '更新报送单位', daily);
    const handover = daily ? manual('handOverNotes', '更新交接事项继续核实现场', true) : null;
    expect(store().getDraft(id)!.freshness).toBe('stale');
    expect(store().getDraft(id)!.snapshot).toEqual(before.snapshot);
    expect(JSON.stringify(store().getDraft(id)!.working.content)).not.toContain(unit.factId);
    refreshDraftSnapshot({ documentId: id, actorName: '值班员' });
    const after = store().getDraft(id)!;
    expect(JSON.stringify(after.working.content)).toContain(unit.factId);
    expect(after.snapshot.facts[unit.factId].value).toBe('更新报送单位');
    expect(after.snapshot.sources[unit.sourceRecordId].fields.actorName).toBeTruthy();
    if (handover) {
      expect(JSON.stringify(after.working.content)).toContain(handover.factId);
      expect(after.snapshot.facts[handover.factId].value).toBe('更新交接事项继续核实现场');
    }
    expect(runDocumentValidation(id)!.issues.filter(i => i.level === 'block')).toEqual([]);
  });
});
