/**
 * 校核结果面板（T-014）：读取当前生效校核报告，按级别分组展示问题，
 * 支持一键「采用建议」（自动重校核）。同时导出共享的重新校核入口与状态标签。
 */
import { useCallback, useMemo, useState } from 'react';
// message 反馈走 AntdApp.useApp()：antd v5 静态方法不消费 ConfigProvider 主题，会退回默认 token。
import { App as AntdApp, Alert, Button, Empty, Space, Tag, Tooltip, Typography } from 'antd';
import { useDocumentStore } from '@/store/documentStore';
import { useDemoStore } from '@/store/demoStore';
import { applySuggestion, RULE_TITLES } from '@/services/validation';
import { formatFactValue } from '@/services/factLookup';
import { runDocumentValidation } from '@/services/documentLifecycle';
import type { SourceSnapshot, InlineRun, ValidationIssue, ValidationReport, ValidationStatus } from '@/domain/types';

export interface ValidationPanelProps {
  documentId: string;
}

const VALIDATION_TAG: Record<ValidationStatus, { color: string; label: string }> = {
  not_run: { color: 'default', label: '未校核' },
  running: { color: 'processing', label: '校核中' },
  passed: { color: 'success', label: '校核通过' },
  failed: { color: 'error', label: '校核未通过' },
  stale: { color: 'warning', label: '校核已过期' },
};

export function ValidationStatusTag({ status }: { status: ValidationStatus }) {
  const meta = VALIDATION_TAG[status];
  return <Tag color={meta.color}>{meta.label}</Tag>;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * 对文书工作副本执行一次完整校核并落库（validateContent → addReport → markValidation）。
 * 供校核面板与文书中心共用；返回新增报告（文书不存在时返回 null）。
 */
export function runValidationForDocument(documentId: string): ValidationReport | null {
  return runDocumentValidation(documentId);
}

/** 段落 runs 摘要文本（用于问题定位展示）。 */
function runsExcerpt(runs: InlineRun[], snapshot: SourceSnapshot): string {
  const text = runs
    .map((run) => {
      if (run.type === 'text') return run.text;
      if (run.type === 'fact') { const f = snapshot.facts[run.factId]; return `${f ? formatFactValue(f.value, f.unit, f.sourceFieldKey) : '（来源缺失）'}${run.suffix ?? ''}`; }
      if (run.type === 'derived') return `〔派生：${run.derivedKey}〕${run.suffix ?? ''}`;
      return `『${run.label}』`;
    })
    .join('');
  return text.length > 42 ? `${text.slice(0, 42)}…` : text;
}

interface IssueItemProps {
  issue: ValidationIssue;
  locate: (issue: ValidationIssue) => string | null;
  onAdopt: (issue: ValidationIssue) => void;
}

function IssueItem({ issue, locate, onAdopt }: IssueItemProps) {
  const levelMeta =
    issue.level === 'block'
      ? { color: 'red', label: '阻断签发', cls: 'doc-issue-block' }
      : issue.level === 'warning'
        ? { color: 'orange', label: '提示', cls: 'doc-issue-warning' }
        : { color: 'blue', label: '说明', cls: 'doc-issue-info' };
  return (
    <div className={`doc-issue-item ${levelMeta.cls}`}>
      <Space wrap size={[6, 2]} align="center">
        <Tag color={levelMeta.color}>{levelMeta.label}</Tag>
        <Typography.Text strong style={{ fontSize: 13 }}>
          {RULE_TITLES[issue.ruleId] ?? issue.ruleId}
        </Typography.Text>
        {issue.fieldKey && <Tag>{issue.fieldKey}</Tag>}
      </Space>
      <div style={{ fontSize: 13, marginTop: 2 }}>{issue.message}</div>
      {issue.currentValue && (
        <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--axn-muted)', marginTop: 4 }}>当前值：{issue.currentValue}</div>
      )}
      {(() => {
        const locateText = locate(issue);
        if (!locateText) return null;
        return (
          <div style={{ fontSize: 'var(--fs-meta)', color: 'var(--axn-muted)', marginTop: 4 }}>定位：{locateText}</div>
        );
      })()}
      {issue.suggestionText && (
        <div style={{ marginTop: 8 }}>
          <Tooltip title={issue.paragraphId ? '按建议改写该段落，随后需显式重新校核' : '该问题未定位到具体段落，无法自动采用'}>
            <Button size="small" disabled={!issue.paragraphId} onClick={() => onAdopt(issue)}>
              采用建议
            </Button>
          </Tooltip>
          <Typography.Text type="secondary" style={{ fontSize: 12, marginLeft: 8 }}>
            建议：{issue.suggestionText}
          </Typography.Text>
        </div>
      )}
    </div>
  );
}

function IssueList({
  title,
  items,
  locate,
  onAdopt,
}: {
  title: string;
  items: ValidationIssue[];
  locate: (issue: ValidationIssue) => string | null;
  onAdopt: (issue: ValidationIssue) => void;
}) {
  if (items.length === 0) return null;
  return (
    <div style={{ marginTop: 12 }}>
      <Typography.Title level={5} style={{ marginBottom: 8 }}>
        {title}（{items.length}）
      </Typography.Title>
      {items.map((issue, index) => (
        <IssueItem
          key={`${issue.ruleId}-${issue.paragraphId ?? 'na'}-${index}`}
          issue={issue}
          locate={locate}
          onAdopt={onAdopt}
        />
      ))}
    </div>
  );
}

export default function ValidationPanel({ documentId }: ValidationPanelProps) {
  const draft = useDocumentStore((s) => s.drafts[documentId]);
  const report = useDocumentStore((s) => {
    const reportId = s.activeReportByDocument[documentId];
    return reportId ? (s.reports[reportId] ?? null) : null;
  });
  const [busy, setBusy] = useState(false);
  const { message } = AntdApp.useApp();

  const blocks = useMemo(() => (report ? report.issues.filter((i) => i.level === 'block') : []), [report]);
  const warnings = useMemo(() => (report ? report.issues.filter((i) => i.level === 'warning') : []), [report]);
  const infos = useMemo(() => (report ? report.issues.filter((i) => i.level === 'info') : []), [report]);
  const hashMismatch = !!draft && !!report && (draft.validation.status === 'stale' || report.contentHash !== draft.working.contentHash || report.contextSnapshotId !== draft.snapshot.snapshotId);
  const locked = draft?.lifecycle === 'signed' || draft?.lifecycle === 'archived';

  const handleRevalidate = useCallback(() => {
    setBusy(true);
    try {
      const next = runValidationForDocument(documentId);
      if (!next) {
        message.warning('文书不存在，无法校核');
        return;
      }
      const blockCount = next.issues.filter((issue) => issue.level === 'block').length;
      if (blockCount > 0) {
        message.error(`校核完成（模拟）：${blockCount} 条阻断级问题，处理后才能提交`);
      } else {
        message.success('校核通过（模拟）');
      }
    } catch (error) {
      message.error(error instanceof Error ? error.message : '校核失败');
    } finally {
      setBusy(false);
    }
  }, [documentId]);

  const locate = useCallback(
    (issue: ValidationIssue): string | null => {
      if (!draft || !issue.sectionId) return null;
      const section = draft.working.content.sections.find((sec) => sec.id === issue.sectionId);
      if (!section) return null;
      const paragraph = issue.paragraphId
        ? section.paragraphs.find((p) => p.id === issue.paragraphId)
        : null;
      const excerpt = paragraph ? `，段落摘录：${runsExcerpt(paragraph.runs, draft.snapshot)}` : '';
      return `小节「${section.heading}」${excerpt}`;
    },
    [draft],
  );

  const handleAdopt = useCallback(
    (issue: ValidationIssue) => {
      const currentDraft = useDocumentStore.getState().drafts[documentId];
      if (!currentDraft || currentDraft.lifecycle === 'signed' || currentDraft.lifecycle === 'archived' || !issue.suggestionText || !issue.paragraphId) return;
      const store = useDocumentStore.getState();
      const next = applySuggestion(currentDraft.working.content, issue.paragraphId, issue.suggestionText);
      store.updateWorkingContent(documentId, next);
      store.invalidateReportForDocument(documentId);
      const actor = useDemoStore.getState().getActor();
      const rev = currentDraft.activeRevisionId ? store.getRevision(currentDraft.activeRevisionId) : undefined;
      store.addAudit({
        action: '采用校核建议',
        actor: actor.name,
        objectId: documentId,
        version: rev?.displayVersion ?? null,
        performedAt: new Date().toISOString(),
        demoClockAt: useDemoStore.getState().demoClock,
        detail: `${issue.ruleId}：${issue.suggestionText}`,
      });

      // 通知编辑器同步最新工作副本（放弃未保存的本地修改）。
      window.dispatchEvent(new CustomEvent('axn:doc-content-replaced'));
      message.success('已采用建议，旧报告已失效；请显式重新校核（模拟）');
    },
    [documentId],
  );

  return (
    <div className="doc-validation-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <Typography.Title level={5} style={{ margin: 0 }}>
          校核结果
        </Typography.Title>
        <Space size={8}>
          {report && (
            <Typography.Text type="secondary" style={{ fontSize: 12 }}>
              {fmtTime(report.checkedAt)} · 规则集 v{report.rulesetVersion}
            </Typography.Text>
          )}
          <Button size="small" loading={busy} disabled={!draft || locked} onClick={handleRevalidate}>
            重新校核
          </Button>
        </Space>
      </div>

      {!draft && <Empty description="文书不存在，无法校核（模拟）" style={{ marginTop: 12 }} />}

      {draft && !report && (
        <Empty
          style={{ marginTop: 12 }}
          description={
            <span style={{ fontSize: 13 }}>
              尚未校核：点击「重新校核」对工作副本执行规则校核（模拟规则集，含来源/时间/伤亡/调派等一致性检查）
            </span>
          }
        />
      )}

      {draft && report && (
        <div className="doc-validation-scroll">
          {hashMismatch && (
            <Alert
              style={{ marginTop: 12 }}
              type="warning"
              showIcon
              title="校核结果已过期"
              description="工作副本在校核后又被修改，请重新校核后再提交送审。"
            />
          )}
          {!hashMismatch && blocks.length === 0 && warnings.length === 0 && (
            <Alert
              style={{ marginTop: 12 }}
              type="success"
              showIcon
              title="校核通过"
              description={`未发现问题（规则集 v${report.rulesetVersion}，模拟校核）。`}
            />
          )}
          {!hashMismatch && blocks.length === 0 && warnings.length > 0 && (
            <Alert
              style={{ marginTop: 12 }}
              type="warning"
              showIcon
              title={`校核通过，但有 ${warnings.length} 条提示`}
              description="提示级问题不阻断提交签发，建议人工确认。"
            />
          )}
          {blocks.length > 0 && (
            <Alert
              style={{ marginTop: 12 }}
              type="error"
              showIcon
              title={`存在 ${blocks.length} 条阻断级问题`}
              description="阻断级问题未解决前，无法提交送审与签发。"
            />
          )}
          <IssueList title="阻断级（阻断签发）" items={blocks} locate={locate} onAdopt={handleAdopt} />
          <IssueList title="提示级" items={warnings} locate={locate} onAdopt={handleAdopt} />
          <IssueList title="说明" items={infos} locate={locate} onAdopt={handleAdopt} />
          <div style={{ marginTop: 12, fontSize: 'var(--fs-meta)', color: 'var(--axn-muted)' }}>
            校核内容指纹：<Typography.Text code>{report.contentHash}</Typography.Text>
            {hashMismatch && (
              <>
                {' '}／ 当前工作副本指纹：<Typography.Text code>{draft.working.contentHash}</Typography.Text>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
