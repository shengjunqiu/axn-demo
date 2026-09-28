import { create } from 'zustand';
import type {
  AuditEvent,
  DocumentContent,
  DocumentDraft,
  DocumentRevision,
  SourceSnapshot,
  ValidationReport,
} from '@/domain/types';
import { useDemoStore } from './demoStore';
import { clearPersist, loadPersist, savePersist } from './persistence';
import { factDisplay, formatFactValue } from '@/services/factLookup';
import { collectRunDerivedKeys, collectRunFactIds } from '@/services/contentRuns';
import { computeDerived } from '@/seed/derived';

let revisionCounter = 0;
function nextRevisionId(): string {
  revisionCounter += 1;
  return `rev-${Date.now().toString(36)}-${revisionCounter}`;
}
let reportCounter = 0;
function nextReportId(): string {
  reportCounter += 1;
  return `report-${Date.now().toString(36)}-${reportCounter}`;
}
let auditCounter = 0;
function nextAuditId(): string {
  auditCounter += 1;
  return `audit-${Date.now().toString(36)}-${auditCounter}`;
}

export function computeContentHash(content: DocumentContent): string {
  const json = JSON.stringify(content);
  let h = 5381;
  for (let i = 0; i < json.length; i += 1) {
    h = ((h << 5) + h + json.charCodeAt(i)) >>> 0;
  }
  return `sha1-demo-${h.toString(16).padStart(8, '0')}`;
}

interface DocumentState {
  drafts: Record<string, DocumentDraft>;
  revisions: Record<string, DocumentRevision>;
  reports: Record<string, ValidationReport>;
  /** 文书 id → 当前生效校核 reportId（contentHash 一致才有效） */
  activeReportByDocument: Record<string, string | null>;
  audit: AuditEvent[];
  addAudit: (input: Omit<AuditEvent, 'auditId' | 'isSimulated'>) => void;
  addDraft: (draft: DocumentDraft) => void;
  getDraft: (documentId: string) => DocumentDraft | undefined;
  updateWorkingContent: (documentId: string, content: DocumentContent) => void;
  markValidation: (documentId: string, status: DocumentDraft['validation']['status'], reportId: string | null) => void;
  updateDraftSnapshot: (documentId: string, snapshot: SourceSnapshot) => void;
  addReport: (report: Omit<ValidationReport, 'reportId' | 'checkedAt'>) => ValidationReport;
  getActiveReport: (documentId: string) => ValidationReport | null;
  invalidateReportForDocument: (documentId: string) => void;
  saveRevision: (input: {
    documentId: string;
    content: DocumentContent;
    sourceSnapshotId: string;
    changeNote: string | null;
    createdBy: string;
    submitted?: boolean;
  }) => DocumentRevision;
  getRevision: (revisionId: string) => DocumentRevision | undefined;
  listRevisions: (documentId: string) => DocumentRevision[];
  markSubmitted: (revisionId: string, actorName: string) => void;
  markSigned: (revisionId: string, signedByActorName: string, actorId: string) => void;
  setLifecycle: (documentId: string, lifecycle: DocumentDraft['lifecycle']) => void;
  setFreshness: (documentId: string, freshness: DocumentDraft['freshness']) => void;
  listDrafts: () => DocumentDraft[];
  resetAll: () => void;
}

/** 可持久化切片（AC-025：刷新后恢复草稿、版本、校核与审计）。 */
interface DocumentPersist {
  drafts: Record<string, DocumentDraft>;
  revisions: Record<string, DocumentRevision>;
  reports: Record<string, ValidationReport>;
  activeReportByDocument: Record<string, string>;
  audit: AuditEvent[];
}

const docPersisted = loadPersist<DocumentPersist>('doc');

export const useDocumentStore = create<DocumentState>()((set, get) => ({
  drafts: docPersisted?.drafts ?? {},
  revisions: docPersisted?.revisions ?? {},
  reports: docPersisted?.reports ?? {},
  activeReportByDocument: docPersisted?.activeReportByDocument ?? {},
  audit: docPersisted?.audit ?? [],

  addAudit: (input) => {
    const ev: AuditEvent = { ...input, auditId: nextAuditId(), isSimulated: true };
    set((s) => ({ audit: [ev, ...s.audit].slice(0, 200) }));
  },

  addDraft: (draft) => {
    set((s) => ({
      drafts: { ...s.drafts, [draft.documentId]: draft },
      activeReportByDocument: { ...s.activeReportByDocument, [draft.documentId]: null },
    }));
  },

  getDraft: (documentId) => get().drafts[documentId],

  updateWorkingContent: (documentId, content) => {
    set((s) => {
      const draft = s.drafts[documentId];
      if (!draft) return s;
      return {
        drafts: {
          ...s.drafts,
          [documentId]: {
            ...draft,
            working: {
              content,
              contextSnapshotId: draft.working.contextSnapshotId,
              contentHash: computeContentHash(content),
              updatedAt: new Date().toISOString(),
              baseRevisionId: draft.working.baseRevisionId,
            },
            updatedAt: new Date().toISOString(),
          },
        },
      };
    });
  },

  markValidation: (documentId, status, reportId) => {
    set((s) => {
      const draft = s.drafts[documentId];
      if (!draft) return s;
      return {
        drafts: { ...s.drafts, [documentId]: { ...draft, validation: { status, reportId } } },
        activeReportByDocument: { ...s.activeReportByDocument, [documentId]: reportId },
      };
    });
  },

  updateDraftSnapshot: (documentId, snapshot) => {
    set((s) => {
      const draft = s.drafts[documentId];
      if (!draft) return s;
      return { drafts: { ...s.drafts, [documentId]: { ...draft, snapshot } } };
    });
  },

  addReport: (report) => {
    const full: ValidationReport = { ...report, reportId: nextReportId(), checkedAt: new Date().toISOString() };
    set((s) => ({ reports: { ...s.reports, [full.reportId]: full } }));
    return full;
  },

  getActiveReport: (documentId) => {
    const { activeReportByDocument, reports } = get();
    const reportId = activeReportByDocument[documentId];
    if (!reportId) return null;
    return reports[reportId] ?? null;
  },

  invalidateReportForDocument: (documentId) => {
    set((s) => {
      const draft = s.drafts[documentId];
      if (!draft) return s;
      const active = s.activeReportByDocument[documentId];
      return {
        drafts: {
          ...s.drafts,
          [documentId]: {
            ...draft,
            validation: { status: active ? 'stale' : draft.validation.status, reportId: active },
            freshness: draft.freshness === 'stale' ? 'stale' : draft.freshness,
          },
        },
      };
    });
  },

  saveRevision: ({ documentId, content, sourceSnapshotId, changeNote, createdBy, submitted }) => {
    const draft = get().drafts[documentId];
    if (!draft) throw new Error(`文书不存在：${documentId}`);
    // FR-013：草稿期首次存版即 V{major}.0；同稿后续存版 minor 递增；签发后修订由修订路径预置 major+1/minor=0。
    const rev: DocumentRevision = {
      revisionId: nextRevisionId(),
      documentId,
      displayVersion: '',
      major: draft.revisionCounter.major,
      minor: draft.revisionCounter.minor,
      contentSnapshot: JSON.parse(JSON.stringify(content)) as DocumentContent,
      sourceSnapshotId,
      factsSnapshot: (() => {
        const acc: Record<string, string> = {};
        for (const factId of collectRunFactIds(content)) {
          // M-8：优先冻结草稿生成时快照值（防水位更新后审阅/导出不一致），并复用枚举标签链路（避免裸值入文）。
          const snapVal = draft.snapshot?.facts[factId];
          acc[factId] = snapVal
            ? formatFactValue(snapVal.value, snapVal.unit, snapVal.sourceFieldKey)
            : factDisplay(factId);
        }
        // 冻结派生值：以草稿快照中的候选集合重算，与生成时一致。
        // 同时存裸键（flattenRuns 消费）与 derived: 前缀键（VersionDrawer 消费）。修复 B-1。
        for (const key of collectRunDerivedKeys(content)) {
          try {
            const d = computeDerived(key as Parameters<typeof computeDerived>[0], draft.snapshot?.candidateResourceIds ?? []);
            // 裸键不带单位：正文 run 的 suffix 已含单位，避免导出出现“1 支 支”重复。
            const display = `${d.value}`;
            acc[key] = display;
            acc[`derived:${key}`] = `${d.value}${d.unit ? ` ${d.unit}` : ''}`;
          } catch {
            acc[key] = '（重算失败）';
            acc[`derived:${key}`] = '（重算失败）';
          }
        }
        return acc;
      })(),
      contentHash: computeContentHash(content),
      createdBy,
      createdAt: new Date().toISOString(),
      changeNote,
      submittedBy: submitted ? createdBy : null,
      submittedAt: submitted ? new Date().toISOString() : null,
      signedRecord: null,
    };
    rev.displayVersion = `V${rev.major}.${rev.minor}`;
    set((s) => ({
      revisions: { ...s.revisions, [rev.revisionId]: rev },
      drafts: {
        ...s.drafts,
        [documentId]: {
          ...draft,
          activeRevisionId: rev.revisionId,
          revisionCounter: { major: rev.major, minor: rev.minor + 1 },
        },
      },
    }));
    return rev;
  },

  getRevision: (revisionId) => get().revisions[revisionId],

  listRevisions: (documentId) =>
    Object.values(get().revisions)
      .filter((r) => r.documentId === documentId)
      .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),

  markSubmitted: (revisionId, actorName) => {
    set((s) => {
      const rev = s.revisions[revisionId];
      if (!rev) return s;
      return {
        revisions: {
          ...s.revisions,
          [revisionId]: { ...rev, submittedBy: actorName, submittedAt: new Date().toISOString() },
        },
      };
    });
    get().addAudit({
      action: '提交送审',
      actor: actorName,
      objectId: revDocumentId(get(), revisionId),
      version: get().revisions[revisionId]?.displayVersion ?? null,
      performedAt: new Date().toISOString(),
      demoClockAt: useDemoStore.getState().demoClock,
      detail: '提交为待签发状态（模拟）',
    });
  },

  markSigned: (revisionId, signedByActorName, actorId) => {
    const rev = get().revisions[revisionId];
    if (!rev) return;
    // 审查 minor-4：幂等守卫 —— 已签发快照不可重复签发（AC-018）。
    if (rev.signedRecord) return;
    const signedRecord = {
      signedByActorId: actorId,
      signedByActorName,
      performedAt: new Date().toISOString(),
      demoClockAt: useDemoStore.getState().demoClock,
      contentHash: rev.contentHash,
      isSimulated: true as const,
      note: '本机演示状态变化，不代表真实审批效力',
    };
    set((s) => ({
      revisions: { ...s.revisions, [revisionId]: { ...rev, signedRecord } },
      drafts: s.drafts[rev.documentId]
        ? { ...s.drafts, [rev.documentId]: { ...s.drafts[rev.documentId], lifecycle: 'signed' } }
        : s.drafts,
    }));
    get().addAudit({
      action: '模拟签发',
      actor: signedByActorName,
      objectId: rev.documentId,
      version: rev.displayVersion,
      performedAt: signedRecord.performedAt,
      demoClockAt: signedRecord.demoClockAt,
      detail: `锁定内容指纹 ${rev.contentHash}`,
    });
  },

  setLifecycle: (documentId, lifecycle) => {
    set((s) => {
      const draft = s.drafts[documentId];
      if (!draft) return s;
      return { drafts: { ...s.drafts, [documentId]: { ...draft, lifecycle } } };
    });
  },

  setFreshness: (documentId, freshness) => {
    set((s) => {
      const draft = s.drafts[documentId];
      if (!draft) return s;
      return { drafts: { ...s.drafts, [documentId]: { ...draft, freshness } } };
    });
  },

  listDrafts: () => Object.values(get().drafts).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),

  resetAll: () => {
    clearPersist('doc');
    set({ drafts: {}, revisions: {}, reports: {}, activeReportByDocument: {}, audit: [] });
  },
}));

// 状态变化即持久化（AC-025）
useDocumentStore.subscribe((state) => {
  savePersist('doc', {
    drafts: state.drafts,
    revisions: state.revisions,
    reports: state.reports,
    activeReportByDocument: state.activeReportByDocument as Record<string, string>,
    audit: state.audit,
  } satisfies DocumentPersist);
});

function revDocumentId(_state: DocumentState, _revisionId: string): string {
  // 审计 objectId 使用文书 id；从 revision 取
  const rev = useDocumentStore.getState().revisions[_revisionId];
  return rev?.documentId ?? _revisionId;
}

export type { SourceSnapshot };
