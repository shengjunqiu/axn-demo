/**
 * 版本历史抽屉（T-015）：版本列表 + 行级差异对比 + 导出/打印入口。
 * 导出基于用户选定版本的 factsSnapshot 冻结渲染（renderRevision），不导出静态样稿。
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Alert, Button, Drawer, Empty, Select, Space, Tag, Tooltip, Typography, message } from 'antd';
import { useDocumentStore } from '@/store/documentStore';
import { exportRevision } from '@/services/docxExport';
import { openPrintPreview } from './PrintView';
import type { DocumentContent, DocumentRevision, InlineRun } from '@/domain/types';
import './doc.css';

export interface VersionDrawerProps {
  documentId: string;
  open: boolean;
  onClose: () => void;
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** 将段落 runs 渲染为纯文本（使用版本冻结的 factsSnapshot，保证对比基于已存版本）。 */
function runsToText(runs: InlineRun[], rev: DocumentRevision): string {
  return runs
    .map((run) => {
      if (run.type === 'text') return run.text;
      if (run.type === 'fact') return `〔${rev.factsSnapshot[run.factId] ?? '（来源缺失）'}〕${run.suffix ?? ''}`;
      if (run.type === 'derived')
        return `〔派生：${rev.factsSnapshot[`derived:${run.derivedKey}`] ?? run.derivedKey}〕${run.suffix ?? ''}`;
      return `『${run.label}』`;
    })
    .join('');
}

/** 版本内容展平为行数组：小节标题行 + 段落行（用于行级 diff）。 */
function flattenRevisionLines(content: DocumentContent, rev: DocumentRevision): { kind: 'section' | 'para'; text: string }[] {
  const lines: { kind: 'section' | 'para'; text: string }[] = [];
  for (const section of content.sections) {
    lines.push({ kind: 'section', text: `【${section.heading}】` });
    for (const paragraph of section.paragraphs) {
      lines.push({ kind: 'para', text: runsToText(paragraph.runs, rev) });
    }
  }
  return lines;
}

interface DiffRow {
  kind: 'section' | 'para';
  text: string;
  change: 'ctx' | 'add' | 'del';
}

/** 简单 LCS 行级 diff（不引第三方依赖）。 */
function diffLines(
  base: { kind: 'section' | 'para'; text: string }[],
  target: { kind: 'section' | 'para'; text: string }[],
): DiffRow[] {
  const n = base.length;
  const m = target.length;
  // lcs[i][j]：base[i..] 与 target[j..] 的最长公共子序列长度
  const lcs: number[][] = Array.from({ length: n + 1 }, () => new Array<number>(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i -= 1) {
    for (let j = m - 1; j >= 0; j -= 1) {
      lcs[i][j] = base[i].text === target[j].text ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
    }
  }
  const rows: DiffRow[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (base[i].text === target[j].text) {
      rows.push({ ...base[i], change: 'ctx' });
      i += 1;
      j += 1;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) {
      rows.push({ ...base[i], change: 'del' });
      i += 1;
    } else {
      rows.push({ ...target[j], change: 'add' });
      j += 1;
    }
  }
  while (i < n) {
    rows.push({ ...base[i], change: 'del' });
    i += 1;
  }
  while (j < m) {
    rows.push({ ...target[j], change: 'add' });
    j += 1;
  }
  return rows;
}

const DIFF_TAG: Record<DiffRow['change'], { label: string; cls: string } | null> = {
  ctx: null,
  add: { label: '新增', cls: 'diff-line--add' },
  del: { label: '删除', cls: 'diff-line--del' },
};

function DiffView({ rows }: { rows: DiffRow[] }) {
  return (
    <div className="doc-diff-body">
      {rows.map((row, index) => {
        const meta = DIFF_TAG[row.change];
        return (
          <div key={`${index}-${row.change}`} className={`diff-line ${meta?.cls ?? 'diff-line--ctx'} ${row.kind === 'section' ? 'diff-section-title' : ''}`}>
            <span className="diff-line-tag">{meta ? meta.label : row.kind === 'section' ? '小节' : '　'}</span>
            <span style={{ flex: 1 }}>{row.text || '（空段落）'}</span>
          </div>
        );
      })}
    </div>
  );
}

interface RevisionActionsProps {
  rev: DocumentRevision;
}

function RevisionActions({ rev }: RevisionActionsProps) {
  const [exporting, setExporting] = useState(false);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      await exportRevision(rev.revisionId);
      message.success(`已导出 Word：${rev.displayVersion}（模拟导出，基于该版本冻结数据渲染）`);
    } catch (error) {
      message.error(`导出失败（模拟环境）：${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setExporting(false);
    }
  }, [rev.revisionId, rev.displayVersion]);

  return (
    <Space size={6}>
      <Tooltip title="基于该版本冻结的来源快照渲染生成 .docx（含模拟声明与内容指纹页脚）">
        <Button size="small" loading={exporting} onClick={() => void handleExport()}>
          导出 Word
        </Button>
      </Tooltip>
      <Tooltip title="打开打印预览（同样基于该版本冻结渲染）">
        <Button size="small" onClick={() => openPrintPreview(rev.revisionId)}>
          打印
        </Button>
      </Tooltip>
    </Space>
  );
}

export default function VersionDrawer({ documentId, open, onClose }: VersionDrawerProps) {
  const draft = useDocumentStore((s) => s.drafts[documentId]);
  const revisionsMap = useDocumentStore((s) => s.revisions);

  const revisions = useMemo(
    () =>
      Object.values(revisionsMap)
        .filter((rev) => rev.documentId === documentId)
        .sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1)),
    [revisionsMap, documentId],
  );

  const [baseId, setBaseId] = useState<string | null>(null);
  const [targetId, setTargetId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    const latest = revisions[revisions.length - 1] ?? null;
    setBaseId(revisions[0]?.revisionId ?? null);
    setTargetId(latest?.revisionId ?? null);
  }, [open, revisions]);

  const baseRev = baseId ? revisions.find((rev) => rev.revisionId === baseId) ?? null : null;
  const targetRev = targetId ? revisions.find((rev) => rev.revisionId === targetId) ?? null : null;

  const diffRows = useMemo(() => {
    if (!baseRev || !targetRev || baseRev.revisionId === targetRev.revisionId) return [];
    return diffLines(
      flattenRevisionLines(baseRev.contentSnapshot, baseRev),
      flattenRevisionLines(targetRev.contentSnapshot, targetRev),
    );
  }, [baseRev, targetRev]);

  const versionOptions = useMemo(
    () =>
      revisions.map((rev) => ({
        value: rev.revisionId,
        label: `${rev.displayVersion}（${fmtTime(rev.createdAt)}${rev.signedRecord ? ' · 已签发' : ''}）`,
      })),
    [revisions],
  );

  return (
    <Drawer
      title={draft ? `版本历史 · ${draft.title}` : '版本历史'}
      width={760}
      open={open}
      onClose={onClose}
      destroyOnHidden
    >
      {!draft && <Empty description="文书不存在或模拟数据已重置" />}

      {draft && (
        <>
          <Alert
            type="info"
            showIcon
            style={{ marginBottom: 12 }}
            message="版本说明（模拟）"
            description="保存/提交/签发都会形成不可变版本快照；导出与打印严格基于所选版本的冻结来源快照渲染，监测数据更新不会影响已存版本。"
          />

          {revisions.length === 0 && (
            <Empty
              description={
                <span style={{ fontSize: 13 }}>
                  暂无版本：保存或提交工作副本后，这里会出现第一个版本快照（模拟）。
                </span>
              }
            />
          )}

          {revisions.map((rev) => (
            <div
              key={rev.revisionId}
              className="doc-card"
              style={{ marginBottom: 10, borderColor: rev.signedRecord ? '#b7eb8f' : undefined }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
                <Space size={8} wrap>
                  <Typography.Text strong>{rev.displayVersion}</Typography.Text>
                  {rev.signedRecord ? (
                    <Tag color="green">已签发 · {rev.signedRecord.signedByActorName}</Tag>
                  ) : rev.submittedBy ? (
                    <Tag color="gold">已送审 · {rev.submittedBy}</Tag>
                  ) : (
                    <Tag>草稿保存</Tag>
                  )}
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {fmtTime(rev.createdAt)} · {rev.createdBy}
                  </Typography.Text>
                </Space>
                <RevisionActions rev={rev} />
              </div>
              <div style={{ fontSize: 13, marginTop: 4 }}>
                变更说明：{rev.changeNote ?? '（无）'}
              </div>
              <div style={{ fontSize: 12, color: '#888', marginTop: 2 }}>
                内容指纹：<Typography.Text code>{rev.contentHash}</Typography.Text>
                {rev.signedRecord && (
                  <>
                    {' '}· 签发指纹一致
                    {rev.signedRecord.contentHash === rev.contentHash ? ' ✓' : '（不一致，模拟数据异常）'}
                  </>
                )}
              </div>
            </div>
          ))}

          {revisions.length >= 2 && (
            <div className="doc-card" style={{ marginTop: 14 }}>
              <Typography.Title level={5} style={{ marginTop: 0 }}>
                版本差异对比
              </Typography.Title>
              <Space size={8} wrap style={{ marginBottom: 8 }}>
                <span style={{ fontSize: 13 }}>基准版本：</span>
                <Select
                  size="small"
                  style={{ minWidth: 230 }}
                  value={baseId ?? undefined}
                  options={versionOptions}
                  onChange={setBaseId}
                  placeholder="选择基准版本"
                />
                <span style={{ fontSize: 13 }}>对比版本：</span>
                <Select
                  size="small"
                  style={{ minWidth: 230 }}
                  value={targetId ?? undefined}
                  options={versionOptions}
                  onChange={setTargetId}
                  placeholder="选择对比版本"
                />
              </Space>
              {baseRev && targetRev && baseRev.revisionId === targetRev.revisionId && (
                <Typography.Text type="secondary" style={{ fontSize: 13 }}>
                  基准与对比为同一版本，暂无差异。
                </Typography.Text>
              )}
              {baseRev && targetRev && baseRev.revisionId !== targetRev.revisionId && (
                <>
                  <div style={{ fontSize: 12, color: '#888', marginBottom: 6 }}>
                    {baseRev.displayVersion} → {targetRev.displayVersion}：绿色为新增内容、红色为删除内容（行级简化对比，模拟）。
                  </div>
                  <DiffView rows={diffRows} />
                </>
              )}
            </div>
          )}

          {draft.lifecycle === 'signed' && (
            <Typography.Paragraph type="secondary" style={{ marginTop: 12, fontSize: 12 }}>
              该文书已签发：已签发版本被锁定，不可覆盖修改；如需修订请在文书中心「修订」生成新草稿版本。
            </Typography.Paragraph>
          )}
        </>
      )}
    </Drawer>
  );
}
