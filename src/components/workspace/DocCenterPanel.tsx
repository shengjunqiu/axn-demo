/**
 * 文书中心（T-011）：文书列表 + 状态机操作中枢。
 * 状态机硬约束：提交（草稿+有效校核+无阻断+指纹一致）→ 签发（指挥员+校核通过）→ 锁定；
 * 修订只能基于已签发版本新建草稿；编辑一律走 DocumentEditor 抽屉。
 * 全部数据为模拟数据。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Empty, Modal, Space, Tag, Tooltip, Typography, message } from 'antd';
import { useDocumentStore } from '@/store/documentStore';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import {
  createDailyDocument,
  createEventDocument,
  derivedMetaLabel,
  fieldLabel,
  refreshDraftSnapshot,
} from '@/services/documentFactory';
import { shiftEventIds } from '@/services/factLookup';
import { DERIVED_META, type DerivedKey } from '@/seed/derived';
import { templateByCode } from '@/seed/scenario';
import type { FixtureTemplate } from '@/seed/scenario';
import type { ValidationReport } from '@/domain/types';
import type { DocumentDraft } from '@/domain/types';
import DocumentEditor from '@/components/doc/DocumentEditor';
import VersionDrawer from '@/components/doc/VersionDrawer';
import SourceDrawer from '@/components/doc/SourceDrawer';
import { ValidationStatusTag, runValidationForDocument } from '@/components/doc/ValidationPanel';
import '../doc/doc.css';

const SOURCE_EVENT = 'axn:open-source';

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

/** 只读模板预览弹窗（会议纪要 / 工作总结）。 */
function TemplatePreviewModal({ template, onClose }: { template: FixtureTemplate | null; onClose: () => void }) {
  return (
    <Modal
      title={template ? `模板预览 · ${template.name}` : '模板预览'}
      open={template !== null}
      onCancel={onClose}
      footer={<Button onClick={onClose}>关闭</Button>}
      width={560}
    >
      {template && (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="只读预览（模拟）"
            description="该模板在当前演示中仅支持只读预览，不参与生成-编辑-签发流程。"
          />
          <Space direction="vertical" size={6} style={{ width: '100%' }}>
            <Space size={8} wrap>
              <Tag>{template.templateCode}</Tag>
              <Tag>模板版本 {template.templateVersion}</Tag>
              <Tag color={template.status === 'enabled' ? 'green' : 'orange'}>
                {template.status === 'enabled' ? '启用' : '仅预览'}
              </Tag>
            </Space>
            <Typography.Text strong style={{ fontSize: 13 }}>
              小节结构
            </Typography.Text>
            <ol style={{ margin: 0, paddingLeft: 20, fontSize: 13 }}>
              {template.sections.map((section) => (
                <li key={section}>{section}</li>
              ))}
            </ol>
            {template.requiredFields && template.requiredFields.length > 0 && (
              <>
                <Typography.Text strong style={{ fontSize: 13 }}>
                  必填字段
                </Typography.Text>
                <Space size={[4, 4]} wrap>
                  {template.requiredFields.map((field) => (
                    <Tag key={field.field}>{fieldLabel(field.field)}</Tag>
                  ))}
                </Space>
              </>
            )}
            {template.note && (
              <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                说明：{template.note}
              </Typography.Text>
            )}
          </Space>
        </>
      )}
    </Modal>
  );
}

export default function DocCenterPanel() {
  const draftsMap = useDocumentStore((s) => s.drafts);
  const revisionsMap = useDocumentStore((s) => s.revisions);
  const activeReportMap = useDocumentStore((s) => s.activeReportByDocument);
  const reportsMap = useDocumentStore((s) => s.reports);
  const currentEventId = useDemoStore((s) => s.currentEventId);
  const actor = useDemoStore((s) => s.getActor());
  const sessionId = useSessionStore((s) => s.sessionByEvent[currentEventId] ?? '');

  const [editorDocId, setEditorDocId] = useState<string | null>(null);
  const [versionDocId, setVersionDocId] = useState<string | null>(null);
  const [sourceFactId, setSourceFactId] = useState<string | null>(null);
  const [sourceDocumentId, setSourceDocumentId] = useState<string | null>(null);
  const [sourceOpen, setSourceOpen] = useState(false);
  const [previewCode, setPreviewCode] = useState<string | null>(null);

  const drafts = useMemo(
    () => Object.values(draftsMap).filter(draft => draft.scopeKind === 'event' ? draft.eventId === currentEventId : !!draft.shiftId && shiftEventIds(draft.shiftId).includes(currentEventId)).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [draftsMap, currentEventId],
  );

  useEffect(() => {
    setEditorDocId(null); setVersionDocId(null); setSourceOpen(false); setSourceDocumentId(null); setSourceFactId(null);
  }, [currentEventId]);

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

  const handleCreateEvent = useCallback(() => {
    if (!sessionId) {
      message.warning('当前事件尚无对话会话，请先在对话工作台发起咨询（模拟）');
      return;
    }
    const result = createEventDocument(sessionId);
    if (result.ok && result.documentId) {
      message.success('已生成事件要情草稿（模拟），可在编辑抽屉中核对后校核提交');
      setEditorDocId(result.documentId);
    } else {
      const labels = result.missingFields.map((field) => fieldLabel(field));
      message.warning(`缺少必填信息：${labels.join('、')}，请在对话中补录后重试（模拟）`);
    }
  }, [sessionId]);

  const handleCreateDaily = useCallback(() => {
    if (!sessionId) {
      message.warning('当前事件尚无对话会话，请先在对话工作台发起咨询（模拟）');
      return;
    }
    const result = createDailyDocument(sessionId);
    if (result.ok && result.documentId) {
      message.success('已生成值班日报草稿（模拟），可在编辑抽屉中核对后校核提交');
      setEditorDocId(result.documentId);
    } else {
      const labels = result.missingFields.map((field) => fieldLabel(field));
      message.warning(`缺少必填信息：${labels.join('、')}，请在对话中补录后重试（模拟）`);
    }
  }, [sessionId]);

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

  const previewTemplate = previewCode ? templateByCode.get(previewCode) ?? null : null;
  const previewButtons = useMemo(
    () => (['MEETING_MINUTES', 'WORK_SUMMARY'] as const).filter((code) => templateByCode.has(code)),
    [],
  );

  return (
    <div className="doc-center">
      <Alert
        type="info"
        showIcon
        message="文书中心 · 模拟数据"
        description="生成、编辑、校核、签发、导出全流程均为本地演示（dataMode: mock）；签发为模拟状态变化，不代表真实审批效力。"
      />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <Space size={8} wrap>
          <HintButton
            type="primary"
            size="small"
            disabled={!sessionId}
            hint={sessionId ? null : '当前事件尚无对话会话，请先在对话工作台发起咨询'}
            onClick={handleCreateEvent}
          >
            生成事件要情
          </HintButton>
          <HintButton
            size="small"
            disabled={!sessionId}
            hint={sessionId ? null : '当前事件尚无对话会话，请先在对话工作台发起咨询'}
            onClick={handleCreateDaily}
          >
            生成值班日报
          </HintButton>
        </Space>
        <Space size={6} wrap>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            只读模板：
          </Typography.Text>
          {previewButtons.map((code) => (
            <Button key={code} size="small" onClick={() => setPreviewCode(code)}>
              {templateByCode.get(code)?.name ?? code}
            </Button>
          ))}
        </Space>
      </div>

      {drafts.length === 0 ? (
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Empty
            description={
              <span style={{ fontSize: 13 }}>
                暂无文书：点击上方「生成事件要情 / 生成值班日报」，或在对话中对生成结果确认后自动创建（模拟）。
              </span>
            }
          />
        </div>
      ) : (
        <div className="doc-center-list">
          {drafts.map((draft) => {
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
                      <Typography.Text strong>{draft.title}</Typography.Text>
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

      <Typography.Paragraph type="secondary" style={{ fontSize: 12, margin: 0 }}>
        操作流：生成草稿 → 编辑（事实芯片可溯源）→ 校核（阻断级清零）→ 提交送审 → 指挥员签发（锁定）→ 导出/打印/修订。
        派生数据可插入：{Object.keys(DERIVED_META).map((key) => derivedMetaLabel(key as DerivedKey)).join('、')}（模拟）。
      </Typography.Paragraph>

      <DocumentEditor documentId={editorDocId ?? ''} open={editorDocId !== null} onClose={() => setEditorDocId(null)} />
      <VersionDrawer documentId={versionDocId ?? ''} open={versionDocId !== null} onClose={() => setVersionDocId(null)} />
      <SourceDrawer documentId={sourceDocumentId} factId={sourceFactId} open={sourceOpen} onClose={() => setSourceOpen(false)} />
      <TemplatePreviewModal template={previewTemplate} onClose={() => setPreviewCode(null)} />
    </div>
  );
}
