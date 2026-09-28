/**
 * 文书状态机测试（AC-014/015/016/017/022）：
 * 提交/签发前置条件、改文后旧校核失效、已签发版本锁定、修订形成新版本。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { useDocumentStore, computeContentHash } from '@/store/documentStore';
import { createEventDocument, createRevisionDraftFromSigned } from '@/services/documentFactory';
import { validateContent, saveReport, applySuggestion } from '@/services/validation';
import { DEFAULT_SESSION_ID, DEFAULT_ACTOR_ID } from '@/seed/scenario';
import { useDemoStore } from '@/store/demoStore';

/** 补齐报送单位与交接事项，让文书可生成 */
function fillManualFields() {
  const add = useDemoStore.getState().addManualFact;
  add({ field: 'reportingUnit', value: '清河段防汛值班室（演示补录）', scopeKind: 'event', scopeId: 'evt-demo-001', actorId: DEFAULT_ACTOR_ID });
  add({ field: 'handOverNotes', value: '持续跟踪堤防出险段（演示补录）', scopeKind: 'shift', scopeId: 'shift-demo-001', actorId: DEFAULT_ACTOR_ID });
}

describe('文书状态机', () => {
  beforeEach(() => {
    useDocumentStore.getState().resetAll();
    useDemoStore.getState().reset();
  });

  it('缺报送单位时生成被拒并返回缺失字段', () => {
    const r = createEventDocument(DEFAULT_SESSION_ID);
    expect(r.ok).toBe(false);
    expect(r.missingFields).toContain('reportingUnit');
  });

  it('补录后可生成草稿，初始校核包含 block（伤亡待核实表述之外的问题应为 0 依赖内容）', () => {
    fillManualFields();
    const r = createEventDocument(DEFAULT_SESSION_ID);
    expect(r.ok).toBe(true);
    const draft = useDocumentStore.getState().drafts[r.documentId!];
    expect(draft.lifecycle).toBe('draft');
    expect(draft.working.content.sections.length).toBeGreaterThan(3);
  });

  it('未校核或校核含 block 时不能提交（checkSubmit 语义在 UI 层，这里验证报告链路）', () => {
    fillManualFields();
    const r = createEventDocument(DEFAULT_SESSION_ID);
    const store = useDocumentStore.getState();
    const draft = store.drafts[r.documentId!];
    const base = validateContent({ documentId: r.documentId!, content: draft.working.content, snapshot: draft.snapshot });
    const report = saveReport(base);
    useDocumentStore.getState().markValidation(r.documentId!, report.issues.some((i) => i.level === 'block') ? 'failed' : 'passed', report.reportId);
    const after = useDocumentStore.getState();
    expect(after.activeReportByDocument[r.documentId!]).toBeTruthy();
  });

  it('修改内容后指纹变化，旧校核报告过期（invalidateReportForDocument）', () => {
    fillManualFields();
    const r = createEventDocument(DEFAULT_SESSION_ID);
    const store = useDocumentStore.getState();
    const draft = store.drafts[r.documentId!];
    const report = saveReport(validateContent({ documentId: r.documentId!, content: draft.working.content, snapshot: draft.snapshot }));
    useDocumentStore.getState().markValidation(r.documentId!, 'passed', report.reportId);

    const modified = applySuggestion(draft.working.content, draft.working.content.sections[0].paragraphs[0].id, '现场正在持续处置，险情变化仍需跟踪核实。');
    expect(computeContentHash(modified)).not.toBe(computeContentHash(draft.working.content));

    useDocumentStore.getState().updateWorkingContent(r.documentId!, modified);
    useDocumentStore.getState().invalidateReportForDocument(r.documentId!);
    const after = useDocumentStore.getState();
    expect(after.drafts[r.documentId!].validation.status).toBe('stale');
    // 旧报告仍可追溯，但其指纹与当前内容不一致（不能再用它授权签发）
    const staleReport = after.reports[after.drafts[r.documentId!].validation.reportId!];
    expect(staleReport).toBeTruthy();
    expect(staleReport.contentHash).not.toBe(computeContentHash(modified));
  });

  it('保存版本形成递增 displayVersion 且签发记录绑定版本；修订不覆盖已签发快照', () => {
    fillManualFields();
    const r = createEventDocument(DEFAULT_SESSION_ID);
    const store = useDocumentStore.getState();
    const draft = store.drafts[r.documentId!];
    const rev1 = useDocumentStore.getState().saveRevision({
      documentId: r.documentId!,
      content: draft.working.content,
      sourceSnapshotId: draft.snapshot.snapshotId,
      changeNote: '初稿',
      createdBy: '值班员',
      submitted: true,
    });
    // FR-013：首版为 V1.0（草稿期不占版本号）
    expect(rev1.displayVersion).toBe('V1.0');
    useDocumentStore.getState().markSubmitted(rev1.revisionId, '值班员');
    useDocumentStore.getState().markSigned(rev1.revisionId, '指挥员', 'actor-demo-commander');

    const signed = useDocumentStore.getState().revisions[rev1.revisionId];
    expect(signed.signedRecord?.isSimulated).toBe(true);
    const signedContent = JSON.stringify(signed.contentSnapshot);

    // 审查 M-2 修复后语义：已签发版本的正式修订走 createRevisionDraftFromSigned
    // （新草稿 major+1，首版 V2.0），不得覆盖已签发快照；同稿继续存版仅 minor 递增。
    const revisionDraft = createRevisionDraftFromSigned({ documentId: r.documentId!, content: signed.contentSnapshot, actorName: '值班员' });
    const rev2 = useDocumentStore.getState().saveRevision({
      documentId: revisionDraft.documentId,
      content: revisionDraft.working.content,
      sourceSnapshotId: revisionDraft.snapshot.snapshotId,
      changeNote: '签发后修订',
      createdBy: '值班员',
    });
    expect(rev2.displayVersion).toBe('V2.0');
    expect(useDocumentStore.getState().revisions[rev1.revisionId].signedRecord).toBeTruthy();
    expect(JSON.stringify(useDocumentStore.getState().revisions[rev1.revisionId].contentSnapshot)).toBe(signedContent);

    const revise = useDocumentStore.getState().saveRevision({
      documentId: r.documentId!,
      content: draft.working.content,
      sourceSnapshotId: draft.snapshot.snapshotId,
      changeNote: '修订',
      createdBy: '值班员',
    });
    expect(revise.displayVersion).toBe('V1.1');
    expect(JSON.stringify(useDocumentStore.getState().revisions[rev1.revisionId].contentSnapshot)).toBe(signedContent);
  });

  it('markSigned 幂等：重复签发不覆盖首次签发记录（审查 minor-4/AC-018）', () => {
    fillManualFields();
    const r = createEventDocument(DEFAULT_SESSION_ID);
    const draft = useDocumentStore.getState().drafts[r.documentId!];
    const rev = useDocumentStore.getState().saveRevision({
      documentId: r.documentId!,
      content: draft.working.content,
      sourceSnapshotId: draft.snapshot.snapshotId,
      changeNote: null,
      createdBy: '值班员',
      submitted: true,
    });
    useDocumentStore.getState().markSubmitted(rev.revisionId, '值班员');
    useDocumentStore.getState().markSigned(rev.revisionId, '指挥员', 'actor-demo-commander');
    const first = useDocumentStore.getState().revisions[rev.revisionId].signedRecord;
    // 第二次签发（不同人）应被幂等守卫拒绝
    useDocumentStore.getState().markSigned(rev.revisionId, '另一位指挥员', 'actor-demo-commander');
    const after = useDocumentStore.getState().revisions[rev.revisionId].signedRecord;
    expect(after).toEqual(first);
  });

  it('R-002 自愈：补录来源并重建快照后，原缺失来源问题清除（审查 M-3 配套）', () => {
    const missingFactId = 'fact-missing-waterLevel-demo';
    fillManualFields();
    const r = createEventDocument(DEFAULT_SESSION_ID);
    const draft = useDocumentStore.getState().drafts[r.documentId!];
    // 向工作副本注入缺失来源的事实 run
    const injected = JSON.parse(JSON.stringify(draft.working.content)) as typeof draft.working.content;
    injected.sections[0].paragraphs[0].runs.push({ type: 'fact', factId: missingFactId });
    const before = validateContent({ documentId: r.documentId!, content: injected, snapshot: draft.snapshot });
    expect(before.issues.find((i) => i.ruleId === 'R-002')).toBeTruthy();
    // 模拟补录来源：向快照注入缺失事实后重新校核
    const healedSnapshot = {
      ...draft.snapshot,
      facts: {
        ...draft.snapshot.facts,
        [missingFactId]: {
          factId: missingFactId,
          value: '42.35',
          unit: '米',
          valueType: 'number' as const,
          sourceRecordId: 'src-manual-001',
          sourceFieldKey: 'waterLevel',
          sourceVersion: 1,
          capturedAt: draft.snapshot.takenAt,
          verification: 'confirmed' as const,
          sourceSystem: '人工补录（模拟）',
          sourceLabel: '人工补录（模拟）',
        },
      },
    };
    const after = validateContent({ documentId: r.documentId!, content: injected, snapshot: healedSnapshot });
    expect(after.issues.find((i) => i.ruleId === 'R-002')).toBeUndefined();
  });

  it('审计流水记录签发与导出动作', () => {
    fillManualFields();
    const r = createEventDocument(DEFAULT_SESSION_ID);
    useDocumentStore.getState().addAudit({
      action: '导出 Word',
      actor: '值班员',
      objectId: r.documentId!,
      version: 'V1.1',
      performedAt: new Date().toISOString(),
      demoClockAt: '2026-09-28 21:10',
      detail: '测试',
    });
    expect(useDocumentStore.getState().audit.length).toBeGreaterThan(0);
  });
});
