/**
 * 文书中心（T-011）：文书列表 + 状态机操作中枢。
 * 状态机硬约束：提交（草稿+有效校核+无阻断+指纹一致）→ 签发（指挥员+校核通过）→ 锁定；
 * 修订只能基于已签发版本新建草稿；编辑一律走 DocumentEditor 抽屉。
 * 全部数据为模拟数据。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Button, Skeleton, Spin, Space, Tag, Tooltip, Typography, message, theme } from 'antd';
import { useDocumentStore } from '@/store/documentStore';
import { useDemoStore } from '@/store/demoStore';
import { useConversationStore } from '@/store/conversationStore';
import { EMPTY_LIBRARY, useMockDocumentStore } from '@/store/mockDocumentStore';
import { useSessionStore } from '@/store/sessionStore';
import {
  refreshDraftSnapshot,
} from '@/services/documentFactory';
import { shiftEventIds, formatFactValue } from '@/services/factLookup';
import { templateByCode } from '@/seed/scenario';
import { DOCUMENT_CATEGORIES, type MockDocument } from '@/seed/mockDocuments';
import type { ValidationReport } from '@/domain/types';
import type { DocumentDraft } from '@/domain/types';
import MockDocumentDetail from '@/components/doc/MockDocumentDetail';
import DocumentDetailToolbar from '@/components/doc/DocumentDetailToolbar';
import DocumentEditor from '@/components/doc/DocumentEditor';
import { flattenRuns } from '@/services/contentRuns';
import { FileTextOutlined, RightOutlined, PlusOutlined, RobotOutlined, CalendarOutlined, AlertOutlined, TeamOutlined, BarChartOutlined } from '@ant-design/icons';
import VersionDrawer from '@/components/doc/VersionDrawer';
import SourceDrawer from '@/components/doc/SourceDrawer';
import { ValidationStatusTag, runValidationForDocument } from '@/components/doc/ValidationPanel';
import '../doc/doc.css';

const SOURCE_EVENT = 'axn:open-source';

// 用户指定移出文书库的两条旧演示草稿；保留底层历史记录。
const HIDDEN_DEMO_DRAFT_IDS = new Set(['doc-mum9lm4u-2', 'doc-mum9lbqs-1']);

const LIFECYCLE_TAG: Record<DocumentDraft['lifecycle'], { color: string; label: string }> = {
  draft: { color: 'blue', label: '草稿' },
  submitted: { color: 'gold', label: '待签发' },
  signed: { color: 'green', label: '已签发' },
  archived: { color: 'default', label: '已归档' },
};

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 提交送审前置检查：仅草稿 + 存在校核报告 + 无阻断级问题 + 校核指纹一致 + 数据快照未过期（审查 M-3）。 */
function checkSubmit(draft: DocumentDraft, report: ValidationReport | null): string | null {
  void report;
  return draft.activeRevisionId ? useDocumentStore.getState().getRevisionGuard(draft.activeRevisionId, 'submit') : '请先保存并校核当前稿';
}

function checkSign(draft: DocumentDraft, report: ValidationReport | null, role: string): string | null {
  void report; void role;
  return draft.activeRevisionId ? useDocumentStore.getState().getRevisionGuard(draft.activeRevisionId, 'sign') : '缺少送审版本';
}

/** 带原因提示的按钮：禁用时用 Tooltip 说明原因（包一层 span 以支持禁用态悬浮）。 */
function HintButton({ hint, ...buttonProps }: React.ComponentProps<typeof Button> & { hint?: string | null }) {
  const button = <Button size="small" {...buttonProps} />;
  if (!hint) return button;
  return (
    <Tooltip title={hint}>
      <span>{button}</span>
    </Tooltip>
  );
}

export default function DocCenterPanel() {
  const { token } = theme.useToken();
  const tasks = useSessionStore((s) => s.tasks);
  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const observedRuns = useRef(new Set<string>());
  const draftsMap = useDocumentStore((s) => s.drafts);
  const revisionsMap = useDocumentStore((s) => s.revisions);
  const activeReportMap = useDocumentStore((s) => s.activeReportByDocument);
  const reportsMap = useDocumentStore((s) => s.reports);
  const currentEventId = useDemoStore((s) => s.currentEventId);
  const actor = useDemoStore((s) => s.getActor());
  const conversationId = useConversationStore(s => s.activeConversationId);
  const sessionId = useSessionStore(s => s.sessionByConversation[conversationId ?? ''] ?? '');
  const libraryScope = sessionId || conversationId || currentEventId;

  const [editorDocId, setEditorDocId] = useState<string | null>(null);
  const [versionDocId, setVersionDocId] = useState<string | null>(null);
  const [sourceFactId, setSourceFactId] = useState<string | null>(null);
  const [sourceDocumentId, setSourceDocumentId] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const library = useMockDocumentStore(s => s.libraries[libraryScope] ?? EMPTY_LIBRARY);
  const { documents: mockDocuments, selected: selectedMock, generatingCode } = library;
  const selectMock = useMockDocumentStore(s => s.select);
  const setSelectedMock = useCallback((document: MockDocument | null) => selectMock(libraryScope, document), [libraryScope, selectMock]);
  const generateMock = (code: string) => {
    setSelectedDocId(null);
    void useMockDocumentStore.getState().generate(libraryScope, code);
  };

  const drafts = useMemo(
    () => Object.values(draftsMap).filter(draft => !HIDDEN_DEMO_DRAFT_IDS.has(draft.documentId)).filter(draft => draft.scopeKind === 'event' ? draft.eventId === currentEventId : !!draft.shiftId && shiftEventIds(draft.shiftId).includes(currentEventId)).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [draftsMap, currentEventId],
  );

  useEffect(() => {
    setSelectedDocId(null); setEditorDocId(null); setVersionDocId(null); setSourceOpen(false); setSourceDocumentId(null); setSourceFactId(null);
  }, [currentEventId, sessionId]);

  const documentTask = Object.values(tasks)
    .filter(task => task.eventId === currentEventId && task.sessionId === sessionId && ['doc_brief', 'doc_daily'].includes(task.intent))
    .sort((a, b) => b.seq - a.seq)[0];
  const generating = documentTask && ['queued', 'running'].includes(documentTask.status);
  useEffect(() => {
    if (!documentTask) return;
    const runKey = `${documentTask.taskId}:${documentTask.attemptId}`;
    if (['queued', 'running'].includes(documentTask.status)) {
      observedRuns.current.add(runKey);
      setSelectedDocId(null);
      setSelectedMock(null);
    } else if (observedRuns.current.has(runKey)) {
      const result = documentTask.artifacts.find(a => a.payload.kind === 'document' && a.payload.state === 'draft_created');
      if (result?.payload.kind === 'document' && draftsMap[result.payload.documentId]) {
        setSelectedDocId(result.payload.documentId);
      }
      observedRuns.current.delete(runKey);
    }
  }, [documentTask, draftsMap, setSelectedMock]);
  const selectedDraft = drafts.find(draft => draft.documentId === selectedDocId);

  // 编辑器内点击事实芯片 → 打开来源抽屉（事件由 DocumentEditor 派发）。
  useEffect(() => {
    const handler = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail: unknown = event.detail;
      if (
        detail &&
        typeof detail === 'object' &&
        'factId' in detail &&
        typeof (detail as { factId: unknown }).factId === 'string' &&
        'documentId' in detail &&
        typeof detail.documentId === 'string'
      ) {
        if (!drafts.some(d => d.documentId === detail.documentId)) return;
        setSourceFactId((detail as { factId: string }).factId);
        setSourceDocumentId(detail.documentId);
        setSourceOpen(true);
      }
    };
    window.addEventListener(SOURCE_EVENT, handler);
    // 审查 M-2 配套：编辑器“修订后保存”创建新草稿后，文书中心自动打开该草稿。
    const docOpenHandler = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const detail = event.detail as { documentId?: unknown } | null;
      if (detail && typeof detail.documentId === 'string' && drafts.some(d => d.documentId === detail.documentId)) {
        setEditorDocId(detail.documentId);
      }
    };
    window.addEventListener('axn:doc-open', docOpenHandler);
    return () => {
      window.removeEventListener(SOURCE_EVENT, handler);
      window.removeEventListener('axn:doc-open', docOpenHandler);
    };
  }, [drafts]);

  const getReport = useCallback(
    (documentId: string): ValidationReport | null => {
      const reportId = activeReportMap[documentId];
      return reportId ? reportsMap[reportId] ?? null : null;
    },
    [activeReportMap, reportsMap],
  );

  const handleValidate = useCallback((documentId: string) => {
    const report = runValidationForDocument(documentId);
    if (!report) {
      message.warning('文书不存在，无法校核（模拟）');
      return;
    }
    const blockCount = report.issues.filter((issue) => issue.level === 'block').length;
    if (blockCount > 0) {
      message.error(`校核完成（模拟）：${blockCount} 条阻断级问题，详见编辑抽屉校核面板`);
    } else {
      message.success('校核通过（模拟）');
    }
  }, []);

  const handleSubmit = useCallback(
    (draft: DocumentDraft) => {
      const report = getReport(draft.documentId);
      const reason = checkSubmit(draft, report);
      if (reason) {
        message.warning(`无法提交送审（模拟）：${reason}`);
        return;
      }
      const store = useDocumentStore.getState();
      const rev = store.saveRevision({
        documentId: draft.documentId,
        content: draft.working.content,
        sourceSnapshotId: draft.working.contextSnapshotId,
        changeNote: '提交送审快照（操作中枢）',
        createdBy: actor.name,
        submitted: false,
      });
      store.markSubmitted(rev.revisionId, actor.name);
      message.success(`已提交送审：${draft.title} ${rev.displayVersion}（模拟）`);
    },
    [actor.name, getReport],
  );

  const handleSign = useCallback(
    (draft: DocumentDraft) => {
      const report = getReport(draft.documentId);
      const reason = checkSign(draft, report, actor.role);
      if (reason || !draft.activeRevisionId) {
        message.warning(`无法签发（模拟）：${reason ?? '缺少送审版本'}`);
        return;
      }
      const store = useDocumentStore.getState();
      store.markSigned(draft.activeRevisionId, actor.name, actor.actorId);
      message.success(`已签发（模拟）：${draft.title}，该版本已锁定，修订请新建草稿`);
    },
    [actor.actorId, actor.name, actor.role, getReport],
  );

  /** 修订已签发文书：归档旧草稿，基于已签发版本内容新建草稿（大版本号 +1），不覆盖 signed 快照。 */
  const handleRevise = useCallback(
    (draft: DocumentDraft) => {
      const store = useDocumentStore.getState();
      const demo = useDemoStore.getState();
      const rev = draft.activeRevisionId ? store.getRevision(draft.activeRevisionId) : undefined;
      if (!rev || !rev.signedRecord) {
        message.warning('仅已签发版本支持修订（模拟）');
        return;
      }
      void demo;
      store.beginRevision(draft.documentId, '基于已签发版本开始修订');
      message.success('已创建同文书修订工作副本，历史签发版本保持锁定');
      setEditorDocId(draft.documentId);
    },
    [actor.name],
  );

  return (
    <div className="doc-center" style={{ '--doc-primary': token.colorPrimary, '--doc-hover': token.colorPrimaryBg, '--doc-muted': token.colorTextSecondary, '--doc-border': token.colorBorderSecondary, '--doc-surface': token.colorBgContainer, '--doc-canvas': token.colorBgLayout, '--doc-text': token.colorText, '--doc-radius': `${token.borderRadiusLG}px` } as React.CSSProperties}>
      <header className="doc-agent-header">
        <span className="doc-agent-avatar"><RobotOutlined /></span>
        <div className="doc-agent-heading"><h2>文书生成智能体</h2><p>规范成文，让每一份文书清晰有据</p></div>
        <Tag className="doc-demo-badge">模拟演示</Tag>
      </header>

      {generating || generatingCode ? (
        <div className="doc-generation" role="status" aria-live="polite">
          <Spin size="large" />
          <Typography.Title level={4}>正在生成文书</Typography.Title>
          <Typography.Text type="secondary">{generatingCode ? `生成${DOCUMENT_CATEGORIES.find(category => category.code === generatingCode)?.name} · 正在编排红头文书（模拟）` : `${documentTask?.displayTitle} · ${documentTask?.steps.find(step => step.status === 'running')?.name ?? '正在整理文书资料'}`}</Typography.Text>
          <Skeleton active paragraph={{ rows: 8 }} />
        </div>
      ) : selectedMock ? (
        <MockDocumentDetail key={selectedMock.id} document={selectedMock} onClose={() => setSelectedMock(null)} onSave={document => useMockDocumentStore.getState().update(libraryScope, document)} />
      ) : (
        <div className="doc-center-list">
          {selectedDraft ? (
            <>
              <DocumentDetailToolbar title={selectedDraft.title} onBack={() => setSelectedDocId(null)} onEdit={() => setEditorDocId(selectedDraft.documentId)} editDisabled={selectedDraft.lifecycle !== 'draft'} />
              <article className="doc-card doc-detail-paper axn-redhead-paper">
                <div className="axn-redhead-org">应急管理</div>
                <div className="axn-redhead-no">文书草稿（模拟）</div>
                <div className="axn-redhead-rule" />
                <Tag color="blue">{templateByCode.get(selectedDraft.templateCode)?.name}</Tag>
                <Typography.Title level={3}>{selectedDraft.working.content.title}</Typography.Title>
                {selectedDraft.working.content.sections.map(section => (
                  <section key={section.id}>
                    <Typography.Title level={5}>{section.heading}</Typography.Title>
                    {section.paragraphs.map((paragraph, index) => (
                      <Typography.Paragraph key={index}>{flattenRuns(paragraph.runs, {
                        facts: Object.fromEntries(Object.entries(selectedDraft.snapshot.facts).map(([id, fact]) => [id, formatFactValue(fact.value, fact.unit, fact.sourceFieldKey)])),
                        derived: Object.fromEntries(Object.entries(selectedDraft.snapshot.derived).map(([id, value]) => [id, `${value.value}${value.unit ?? ''}`])),
                      })}</Typography.Paragraph>
                    ))}
                  </section>
                ))}
                <Typography.Text type="secondary">{selectedDraft.working.content.footerNote}</Typography.Text>
              </article>
            </>
          ) : (
            <>
              <div className="doc-library-heading"><div><h3>文书库 <span>{drafts.length + mockDocuments.length}</span></h3><p>选择文书查看详情，或按分类生成新文书</p></div></div>
              <div className="doc-category-grid">
              {DOCUMENT_CATEGORIES.map(category => (
                <section className="doc-card doc-category" key={category.code}>
                  <div className="doc-library-row">
                    <span className={`doc-category-icon doc-category-icon--${category.code}`}>{category.code === 'DUTY_DAILY' ? <CalendarOutlined /> : category.code === 'EMERGENCY_BRIEF' ? <AlertOutlined /> : category.code === 'MEETING_MINUTES' ? <TeamOutlined /> : <BarChartOutlined />}</span>
                    <span className="doc-library-copy"><strong>{category.name}</strong><span>{mockDocuments.filter(doc => doc.code === category.code).length} 份文书</span></span>
                    <Button className="doc-create-button" size="small" icon={<PlusOutlined />} aria-label={`生成${category.name}`} onClick={() => generateMock(category.code)}>生成</Button>
                  </div>
                  <div className="doc-category-items">
                    {mockDocuments.filter(doc => doc.code === category.code).map(doc => (
                      <button className="doc-sample-row" key={doc.id} onClick={() => setSelectedMock(doc)}>
                        <span className="doc-file-mark"><FileTextOutlined /></span><span className="doc-file-copy"><span>{doc.title}</span><small>{doc.date}<span className="doc-file-status">模拟稿</span></small></span><RightOutlined className="doc-file-arrow" />
                      </button>
                    ))}
                  </div>
                </section>
              ))}
              </div>
            </>
          )}
          {(selectedDraft ? [selectedDraft] : drafts).map((draft) => {

            const report = getReport(draft.documentId);
            const activeRev = draft.activeRevisionId ? revisionsMap[draft.activeRevisionId] : undefined;
            const submitReason = checkSubmit(draft, report);
            const signReason = checkSign(draft, report, actor.role);
            const lifecycle = LIFECYCLE_TAG[draft.lifecycle];
            const editable = draft.lifecycle === 'draft';
            return (
              <div
                key={draft.documentId}
                className={`doc-card ${draft.freshness === 'stale' ? 'doc-card--stale' : ''}`}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <Space size={8} wrap>
                      <Button type="link" onClick={() => setSelectedDocId(draft.documentId)}>{draft.title}</Button>
                      <Tag color={lifecycle.color}>{lifecycle.label}</Tag>
                      <ValidationStatusTag status={draft.validation.status} />
                      {draft.freshness === 'stale' && <Tag color="orange">快照已过期</Tag>}
                    </Space>
                    <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                      {templateByCode.get(draft.templateCode)?.name ?? draft.templateCode} ·{' '}
                      {draft.scopeKind === 'event' ? '事件' : `班次范围：${shiftEventIds(draft.shiftId ?? '').join('、')}`} · 当前版本：
                      {activeRev ? activeRev.displayVersion : '未保存版本'} · 更新于 {fmtTime(draft.updatedAt)} · ID{' '}
                      {draft.documentId}
                    </div>
                  </div>
                  <Space size={6} wrap>
                    <HintButton
                      size="small"
                      type="primary"
                      disabled={!editable}
                      hint={editable ? null : draft.lifecycle === 'signed' ? '已签发锁定，请使用「修订」新建草稿' : '当前状态不可编辑'}
                      onClick={() => setEditorDocId(draft.documentId)}
                    >
                      编辑
                    </HintButton>
                    <HintButton
                      size="small"
                      disabled={draft.lifecycle === 'archived' || draft.lifecycle === 'signed'}
                      hint={draft.lifecycle === 'archived' ? '已归档文书不再参与校核' : null}
                      onClick={() => handleValidate(draft.documentId)}
                    >
                      校核
                    </HintButton>
                    {draft.freshness === 'stale' && draft.lifecycle !== 'archived' && draft.lifecycle !== 'signed' && (
                      <HintButton
                        size="small"
                        onClick={() => {
                          refreshDraftSnapshot({ documentId: draft.documentId, actorName: actor.name });
                          message.success('已按最新数据重建快照（模拟）；请重新校核后再提交/签发');
                        }}
                      >
                        按最新数据重建快照
                      </HintButton>
                    )}
                    <HintButton
                      size="small"
                      disabled={draft.lifecycle !== 'draft' || submitReason !== null}
                      hint={
                        draft.lifecycle !== 'draft'
                          ? '仅草稿状态可提交送审'
                          : submitReason ?? '提交后进入待签发状态（指挥员签发）'
                      }
                      onClick={() => handleSubmit(draft)}
                    >
                      提交送审
                    </HintButton>
                    <HintButton
                      size="small"
                      disabled={draft.lifecycle !== 'submitted' || signReason !== null}
                      hint={
                        draft.lifecycle !== 'submitted'
                          ? '仅待签发状态可签发'
                          : signReason ?? '签发后该版本锁定（模拟）'
                      }
                      onClick={() => handleSign(draft)}
                    >
                      签发
                    </HintButton>
                    <HintButton
                      size="small"
                      disabled={!(draft.lifecycle === 'signed' && draft.activeRevisionId && revisionsMap[draft.activeRevisionId]?.signedRecord)}
                      hint={
                        draft.lifecycle === 'signed'
                          ? '基于已签发版本新建修订草稿'
                          : '仅已签发文书支持修订（不覆盖已签发快照）'
                      }
                      onClick={() => handleRevise(draft)}
                    >
                      修订
                    </HintButton>
                    <Button size="small" onClick={() => setVersionDocId(draft.documentId)}>
                      版本
                    </Button>
                  </Space>
                </div>
                {report && (
                  <div style={{ fontSize: 12, color: '#888', marginTop: 6 }}>
                    最近校核：{report.issues.length === 0 ? '无问题' : `${report.issues.length} 条问题（阻断 ${report.issues.filter((i) => i.level === 'block').length} / 提示 ${report.issues.filter((i) => i.level === 'warning').length}）`}{' '}
                    · 校核时间 {fmtTime(report.checkedAt)}
                    {report.contentHash !== draft.working.contentHash && ' · 校核后内容已变更，需重新校核'}
                  </div>
                )}
                {activeRev?.signedRecord && (
                  <div style={{ fontSize: 12, color: '#888', marginTop: 4 }}>
                    签发人 {activeRev.signedRecord.signedByActorName} · {fmtTime(activeRev.signedRecord.performedAt)} ·{' '}
                    {activeRev.signedRecord.note}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}


      <DocumentEditor documentId={editorDocId ?? ''} open={editorDocId !== null} onClose={() => setEditorDocId(null)} />
      <VersionDrawer documentId={versionDocId ?? ''} open={versionDocId !== null} onClose={() => setVersionDocId(null)} />
      <SourceDrawer documentId={sourceDocumentId} factId={sourceFactId} open={sourceOpen} onClose={() => setSourceOpen(false)} />

    </div>
  );
}
