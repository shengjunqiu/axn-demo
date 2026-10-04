import { create } from 'zustand';
import type { AuditEvent, DocumentContent, DocumentDraft, DocumentRevision, SourceSnapshot, ValidationReport } from '@/domain/types';
import { useDemoStore } from './demoStore.js';
import { shift } from '@/seed/scenario';
import { clearPersist, loadPersist, schedulePersist } from './persistence.js';
import { formatFactValue } from '@/services/factLookup';
import { collectRunDerivedKeys, collectRunFactIds } from '@/services/contentRuns';

const clone = <T,>(value: T): T => structuredClone(value);

/** Deep freeze: prevents external mutation of stored reports (test-gated guarantee). */
function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const key of Object.keys(value as object)) deepFreeze((value as Record<string, unknown>)[key]);
  }
  return value;
}

/** Deterministic local comparison token; this is not a cryptographic signature. */
export function computeContentHash(content: DocumentContent, precomputedJson?: string): string {
  const json = precomputedJson ?? JSON.stringify(content);
  let h = 5381;
  for (let i = 0; i < json.length; i++) h = ((h << 5) + h + json.charCodeAt(i)) >>> 0;
  return `demo-content-${h.toString(16).padStart(8, '0')}`;
}

type RevisionAction = 'submit' | 'sign' | 'export';
interface DocumentState {
  drafts: Record<string, DocumentDraft>;
  revisions: Record<string, DocumentRevision>;
  reports: Record<string, ValidationReport>;
  activeReportByDocument: Record<string, string | null>;
  audit: AuditEvent[];
  addAudit: (input: Omit<AuditEvent, 'auditId' | 'isSimulated'>) => void;
  addDraft: (draft: DocumentDraft) => void;
  getDraft: (id: string) => DocumentDraft | undefined;
  updateWorkingContent: (id: string, content: DocumentContent) => void;
  markValidation: (id: string, status: DocumentDraft['validation']['status'], reportId: string | null) => void;
  updateDraftSnapshot: (id: string, snapshot: SourceSnapshot) => void;
  markBusinessDataChanged: (kind: 'event' | 'shift', id: string) => void;
  addReport: (report: Omit<ValidationReport, 'reportId' | 'checkedAt'>) => ValidationReport;
  getActiveReport: (id: string) => ValidationReport | null;
  invalidateReportForDocument: (id: string) => void;
  saveRevision: (input: { documentId: string; content: DocumentContent; sourceSnapshotId: string; changeNote: string | null; createdBy: string; submitted?: boolean }) => DocumentRevision;
  getRevision: (id: string) => DocumentRevision | undefined;
  listRevisions: (id: string) => DocumentRevision[];
  getRevisionGuard: (id: string, action: RevisionAction) => string | null;
  markSubmitted: (id: string, actorName: string) => void;
  markSigned: (id: string, name: string, actorId: string) => void;
  beginRevision: (id: string, changeNote: string) => DocumentDraft;
  setLifecycle: (id: string, lifecycle: DocumentDraft['lifecycle']) => void;
  setFreshness: (id: string, freshness: DocumentDraft['freshness']) => void;
  listDrafts: () => DocumentDraft[];
  resetAll: () => void;
}

type DocumentPersist = Pick<DocumentState, 'drafts' | 'revisions' | 'reports' | 'activeReportByDocument' | 'audit'>;
const persisted = loadPersist<DocumentPersist>('doc');
const editable = (draft: DocumentDraft) => draft.lifecycle !== 'signed' && draft.lifecycle !== 'archived';
function stale(draft: DocumentDraft): DocumentDraft {
  return { ...draft, lifecycle: draft.lifecycle === 'submitted' ? 'draft' : draft.lifecycle,
    validation: { status: draft.validation.reportId ? 'stale' : 'not_run', reportId: draft.validation.reportId }, updatedAt: new Date().toISOString() };
}
function versionOf(snapshot: SourceSnapshot): number {
  return useDemoStore.getState().getContextVersion(snapshot.scopeKind, snapshot.scopeKind === 'event' ? snapshot.eventId ?? '' : snapshot.shiftId ?? '');
}
function frozenDisplays(content: DocumentContent, snapshot: SourceSnapshot): Record<string, string> {
  const result: Record<string, string> = {};
  for (const id of collectRunFactIds(content)) {
    const fact = snapshot.facts[id];
    result[id] = fact ? formatFactValue(fact.value, fact.unit, fact.sourceFieldKey) : '（来源缺失）';
  }
  for (const key of collectRunDerivedKeys(content)) {
    const fact = snapshot.derived[key];
    result[key] = fact ? String(fact.value) : '（来源缺失）';
    result[`derived:${key}`] = result[key];
  }
  return result;
}

export const useDocumentStore = create<DocumentState>()((set, get) => ({
  drafts: persisted?.drafts ?? {}, revisions: persisted?.revisions ?? {}, reports: persisted?.reports ?? {},
  activeReportByDocument: persisted?.activeReportByDocument ?? {}, audit: persisted?.audit ?? [],
  addAudit: input => set(s => ({ audit: [{ ...input, auditId: `audit-${crypto.randomUUID()}`, isSimulated: true as const }, ...s.audit].slice(0, 200) })),
  addDraft: draft => {
    const existing = get().drafts[draft.documentId];
    // 信任链防线：同 ID 已签发（或已形成版本）的文档不允许被新草稿对象覆盖；
    // 修订必须走 submit/signNewVersion 生成新 revision，而不是替换工作副本。
    if (existing && (existing.lifecycle === 'signed' || existing.activeRevisionId)) {
      throw new Error(`文档 ${draft.documentId} 已签发锁定，禁止用同 ID 草稿覆盖；请通过修订生成新版本。`);
    }
    set(s => ({ drafts: { ...s.drafts, [draft.documentId]: clone(draft) }, activeReportByDocument: { ...s.activeReportByDocument, [draft.documentId]: null } }));
  },
  getDraft: id => get().drafts[id],
  updateWorkingContent: (id, content) => set(s => {
    const draft = s.drafts[id];
    if (!draft || !editable(draft)) return s;
    // 每次击键只序列化一次：既用于精确比对，也复用为内容指纹（原先串行 stringify 三次）。
    const json = JSON.stringify(content);
    const contentHash = computeContentHash(content, json);
    // 指纹相同才回落精确比对，避免 32 位指纹碰撞导致用户编辑被静默丢弃。
    if (contentHash === draft.working.contentHash && json === JSON.stringify(draft.working.content)) return s;
    return { drafts: { ...s.drafts, [id]: { ...stale(draft), working: { ...draft.working, content: clone(content), contentHash, updatedAt: new Date().toISOString() } } } };
  }),
  markValidation: (id, status, reportId) => set(s => {
    const draft = s.drafts[id];
    if (!draft || !editable(draft)) return s;
    const report = reportId ? s.reports[reportId] : null;
    const revision = report?.revisionId ? s.revisions[report.revisionId] : undefined;
    const validBinding = report && revision && revision.documentId === id && revision.revisionId === draft.activeRevisionId
      && report.contentHash === draft.working.contentHash && report.contentHash === revision.contentHash
      && report.contextSnapshotId === draft.snapshot.snapshotId && report.contextSnapshotId === revision.sourceSnapshotId
      && report.factSnapshotVersion === draft.snapshot.dataVersion;
    if (status === 'passed' && (!validBinding || report.issues.some(i => i.level === 'block') || draft.freshness === 'stale' || draft.snapshot.contextVersion !== versionOf(draft.snapshot))) {
      throw new Error('校核报告与当前版本或业务数据不一致，不能标记通过');
    }
    return { drafts: { ...s.drafts, [id]: { ...draft, validation: { status, reportId } } },
      activeReportByDocument: { ...s.activeReportByDocument, [id]: reportId },
      revisions: validBinding ? { ...s.revisions, [revision.revisionId]: { ...revision, validationReportId: reportId } } : s.revisions };
  }),
  updateDraftSnapshot: (id, snapshot) => set(s => {
    const draft = s.drafts[id];
    if (!draft || !editable(draft)) throw new Error('已签发文书不可原地刷新数据，请先创建修订');
    if (snapshot.scopeKind !== draft.scopeKind || snapshot.eventId !== draft.eventId || snapshot.shiftId !== draft.shiftId) throw new Error('快照不属于本文书');
    return { drafts: { ...s.drafts, [id]: { ...stale(draft), snapshot: clone(snapshot), freshness: snapshot.contextVersion === versionOf(snapshot) ? 'current' : 'stale',
      working: { ...draft.working, contextSnapshotId: snapshot.snapshotId, updatedAt: new Date().toISOString() } } } };
  }),
  markBusinessDataChanged: (kind, id) => set(s => ({ drafts: Object.fromEntries(Object.entries(s.drafts).map(([key, draft]) => {
    const affected = kind === 'event' ? draft.eventId === id || (draft.scopeKind === 'shift' && draft.shiftId === shift.shiftId && shift.incidentIds.includes(id)) : draft.scopeKind === 'shift' && draft.shiftId === id;
    return [key, affected && editable(draft) ? { ...stale(draft), freshness: 'stale' as const } : draft];
  })) })),
  addReport: report => {
    const full = { ...clone(report), reportId: `report-${crypto.randomUUID()}`, checkedAt: new Date().toISOString() };
    // 报告一旦入库即冻结：签发授权依据不可被外部引用篡改。
    set(s => ({ reports: { ...s.reports, [full.reportId]: deepFreeze(full) } }));
    return full;
  },
  getActiveReport: id => { const rid = get().activeReportByDocument[id]; return rid ? get().reports[rid] ?? null : null; },
  invalidateReportForDocument: id => set(s => {
    const draft = s.drafts[id];
    return draft && editable(draft) ? { drafts: { ...s.drafts, [id]: stale(draft) } } : s;
  }),
  saveRevision: ({ documentId, content, sourceSnapshotId, changeNote, createdBy, submitted }) => {
    const draft = get().drafts[documentId];
    if (!draft || !editable(draft)) throw new Error('已签发或归档文书不能覆盖保存，请创建修订');
    if (submitted) throw new Error('保存不能代替送审，请先校核再提交');
    if (sourceSnapshotId !== draft.snapshot.snapshotId || sourceSnapshotId !== draft.working.contextSnapshotId || JSON.stringify(content) !== JSON.stringify(draft.working.content)) throw new Error('保存内容与当前工作副本或快照不一致');
    const current = draft.activeRevisionId ? get().revisions[draft.activeRevisionId] : undefined;
    if (current && current.contentHash === draft.working.contentHash && current.sourceSnapshotId === sourceSnapshotId && JSON.stringify(current.contentSnapshot) === JSON.stringify(content)) return current;
    const revision: DocumentRevision = {
      revisionId: `rev-${crypto.randomUUID()}`, documentId, displayVersion: `V${draft.revisionCounter.major}.${draft.revisionCounter.minor}`,
      major: draft.revisionCounter.major, minor: draft.revisionCounter.minor, contentSnapshot: clone(content), sourceSnapshotId,
      sourceSnapshot: clone(draft.snapshot), factsSnapshot: frozenDisplays(content, draft.snapshot), contentHash: computeContentHash(content),
      validationReportId: null, locked: false, createdBy, createdAt: new Date().toISOString(), changeNote,
      submittedBy: null, submittedAt: null, signedRecord: null,
    };
    set(s => ({ revisions: { ...s.revisions, [revision.revisionId]: revision }, drafts: { ...s.drafts, [documentId]: {
      ...stale(draft), activeRevisionId: revision.revisionId, working: { ...draft.working, baseRevisionId: revision.revisionId },
      revisionCounter: { major: revision.major, minor: revision.minor + 1 },
    } } }));
    return revision;
  },
  getRevision: id => {
    const rev = get().revisions[id];
    if (!rev) return undefined;
    // 返回深冻结副本：签发历史不可通过返回引用被外部篡改。
    return structuredClone(rev);
  },
  listRevisions: id => Object.values(get().revisions).filter(r => r.documentId === id).sort((a, b) => a.major - b.major || a.minor - b.minor),
  getRevisionGuard: (id, action) => {
    const state = get(); const rev = state.revisions[id];
    if (!rev) return '版本不存在';
    const snapshot = rev.sourceSnapshot;
    const report = rev.validationReportId ? state.reports[rev.validationReportId] : null;
    if (!snapshot?.sources || !report?.revisionId) return '该版本缺少完整来源和校核绑定，请重新校核';
    if (report.documentId !== rev.documentId || report.revisionId !== id || report.contentHash !== rev.contentHash || computeContentHash(rev.contentSnapshot) !== rev.contentHash
      || report.contextSnapshotId !== rev.sourceSnapshotId || snapshot.snapshotId !== rev.sourceSnapshotId || report.factSnapshotVersion !== snapshot.dataVersion) return '校核与内容版本或事实快照不一致';
    if (report.issues.some(i => i.level === 'block')) return '存在阻断级校核问题';
    if (rev.signedRecord) {
      if (action !== 'export') return '该版本已签发锁定';
      return rev.locked && rev.signedRecord.contentHash === rev.contentHash ? null : '签发快照异常';
    }
    if (snapshot.contextVersion !== versionOf(snapshot)) return '业务数据已更新，请刷新文书数据并重新校核';
    const draft = state.drafts[rev.documentId];
    if (action === 'export') return null; // Explicitly selected, previously validated saved draft.
    if (!draft || draft.activeRevisionId !== id || draft.working.contentHash !== rev.contentHash || draft.snapshot.snapshotId !== rev.sourceSnapshotId
      || draft.validation.status !== 'passed' || draft.validation.reportId !== report.reportId || draft.freshness !== 'current') return '当前正文或引用已修改，请重新校核并保存当前版本';
    if (action === 'submit' && draft.lifecycle !== 'draft') return '仅草稿可送审';
    if (action === 'sign' && (draft.lifecycle !== 'submitted' || !rev.submittedAt)) return '请先提交当前版本送审';
    if (action === 'sign' && useDemoStore.getState().getActor().role !== 'commander') return '请切换为指挥员';
    return null;
  },
  markSubmitted: (id, actorName) => {
    const reason = get().getRevisionGuard(id, 'submit'); if (reason) throw new Error(reason);
    const revision = get().revisions[id]; const now = new Date().toISOString();
    set(s => ({ revisions: { ...s.revisions, [id]: { ...revision, submittedBy: actorName, submittedAt: now } }, drafts: { ...s.drafts, [revision.documentId]: { ...s.drafts[revision.documentId], lifecycle: 'submitted' } } }));
    get().addAudit({ action: '提交送审', actor: actorName, objectId: revision.documentId, version: revision.displayVersion, performedAt: now, demoClockAt: useDemoStore.getState().demoClock, detail: '送审当前已校核版本（模拟）' });
  },
  markSigned: (id, name, actorId) => {
    const revision = get().revisions[id]; if (revision?.signedRecord) return;
    const reason = get().getRevisionGuard(id, 'sign'); if (reason) throw new Error(reason);
    const actor = useDemoStore.getState().getActor();
    if (actor.actorId !== actorId || actor.name !== name) throw new Error('签发身份与当前角色不一致');
    const signedRecord = { signedByActorId: actorId, signedByActorName: name, performedAt: new Date().toISOString(), demoClockAt: useDemoStore.getState().demoClock,
      contentHash: revision.contentHash, isSimulated: true as const, note: '本机模拟状态变化，不代表真实审批效力' };
    set(s => ({ revisions: { ...s.revisions, [id]: { ...revision, locked: true, signedRecord } }, drafts: { ...s.drafts, [revision.documentId]: { ...s.drafts[revision.documentId], lifecycle: 'signed' } } }));
    get().addAudit({ action: '模拟签发', actor: name, objectId: revision.documentId, version: revision.displayVersion, performedAt: signedRecord.performedAt, demoClockAt: signedRecord.demoClockAt, detail: `锁定版本、来源和校核 ${revision.contentHash}` });
  },
  beginRevision: (id, changeNote) => {
    const draft = get().drafts[id]; const revision = draft?.activeRevisionId ? get().revisions[draft.activeRevisionId] : undefined;
    if (!draft || !revision?.signedRecord || !revision.locked || !changeNote.trim()) throw new Error('请从已签发版本创建修订，并填写修订原因');
    const next: DocumentDraft = { ...draft, lifecycle: 'draft', validation: { status: 'not_run', reportId: null }, activeRevisionId: null,
      freshness: revision.sourceSnapshot.contextVersion === versionOf(revision.sourceSnapshot) ? 'current' : 'stale',
      snapshot: clone(revision.sourceSnapshot), working: { content: clone(revision.contentSnapshot), contentHash: revision.contentHash, contextSnapshotId: revision.sourceSnapshotId, baseRevisionId: revision.revisionId, updatedAt: new Date().toISOString() },
      revisionCounter: { major: revision.major + 1, minor: 0 }, updatedAt: new Date().toISOString() };
    set(s => ({ drafts: { ...s.drafts, [id]: next }, activeReportByDocument: { ...s.activeReportByDocument, [id]: null } }));
    get().addAudit({ action: '创建修订', actor: useDemoStore.getState().getActor().name, objectId: id, version: revision.displayVersion, performedAt: next.updatedAt, demoClockAt: useDemoStore.getState().demoClock, detail: changeNote });
    return next;
  },
  setLifecycle: (id, lifecycle) => set(s => {
    const draft = s.drafts[id]; if (!draft || draft.lifecycle === lifecycle) return s;
    if (lifecycle === 'draft' && draft.lifecycle === 'submitted') return { drafts: { ...s.drafts, [id]: stale(draft) } };
    if (lifecycle === 'archived' && draft.lifecycle === 'signed') return { drafts: { ...s.drafts, [id]: { ...draft, lifecycle } } };
    throw new Error('请使用校核、送审、签发或创建修订操作推进生命周期');
  }),
  setFreshness: (id, freshness) => set(s => {
    const draft = s.drafts[id]; if (!draft || !editable(draft)) return s;
    if (freshness === 'current' && draft.snapshot.contextVersion !== versionOf(draft.snapshot)) throw new Error('请先刷新文书快照');
    return { drafts: { ...s.drafts, [id]: { ...(freshness === 'stale' ? stale(draft) : draft), freshness } } };
  }),
  listDrafts: () => Object.values(get().drafts).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)),
  resetAll: () => { clearPersist('doc'); set({ drafts: {}, revisions: {}, reports: {}, activeReportByDocument: {}, audit: [] }); },
}));

// 状态变化即持久化（AC-025）；连续输入（击键）由 persistence 合并为一次落盘。
useDocumentStore.subscribe(state => schedulePersist('doc', { drafts: state.drafts, revisions: state.revisions, reports: state.reports, activeReportByDocument: state.activeReportByDocument, audit: state.audit } satisfies DocumentPersist));
export type { SourceSnapshot };
