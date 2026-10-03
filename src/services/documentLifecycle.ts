import { useDocumentStore } from '@/store/documentStore';
import { useDemoStore } from '@/store/demoStore';
import { validateContent } from './validation.js';

/** Persist the exact current content/snapshot before binding a validation report. */
export function saveCurrentRevision(documentId: string, changeNote = '保存当前工作副本') {
  const store = useDocumentStore.getState();
  const draft = store.getDraft(documentId);
  if (!draft) throw new Error('文书不存在');
  return store.saveRevision({ documentId, content: draft.working.content, sourceSnapshotId: draft.snapshot.snapshotId,
    changeNote, createdBy: useDemoStore.getState().getActor().name });
}

export function runDocumentValidation(documentId: string) {
  const store = useDocumentStore.getState();
  const draft = store.getDraft(documentId);
  if (!draft) return null;
  if (draft.lifecycle === 'signed' || draft.lifecycle === 'archived') throw new Error('已签发版本保持原校核报告；请先创建修订');
  const revision = saveCurrentRevision(documentId, '校核当前内容版本');
  const result = validateContent({ documentId, content: revision.contentSnapshot, snapshot: revision.sourceSnapshot, checkPreviousReport: false });
  const report = store.addReport({ ...result, revisionId: revision.revisionId, factSnapshotVersion: revision.sourceSnapshot.dataVersion });
  store.markValidation(documentId, report.issues.some(issue => issue.level === 'block') ? 'failed' : 'passed', report.reportId);
  return report;
}
