/**
 * 任务执行卡（T-006）：渲染 assistant 任务消息的执行步骤、产物摘要、流式文本与操作。
 * 数据全部来自 sessionStore.tasks（zustand 订阅），本组件不复制任务状态。
 * 所有数值/文本均取自种子事实或任务产物，界面为模拟数据环境。
 */
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Alert, Button, Space, Tooltip, Typography } from 'antd';
import {
  CircleCheck,
  CircleMinus,
  CirclePause,
  ChevronRight,
  CircleX,
  Clock,
  LoaderCircle,
  BookOpen,
  FileText,
  Map as MapIcon,
  Users,
  Warehouse,
} from 'lucide-react'
import type {
  AgentTask,
  DocumentLinkArtifact,
  ErrorArtifact,
  KnowledgeArtifact,
  ProposalArtifact,
  QaKnowledgeArtifact,
  ResourceResultArtifact,
  StepStatus,
  SummaryArtifact,
  TaskArtifactPayload,
  TaskStatus,
} from '@/domain/types';
import { cancelTask, retryTask } from '@/services/taskRunner';
import { factDisplay, resolveFact } from '@/services/factLookup';
import { useSessionStore } from '@/store/sessionStore';
import { useDocumentStore } from '@/store/documentStore';
import { useDocumentNavigation } from '@/components/workspace/useDocumentNavigation';
import { factText, getFact, knowledgeById, teamById, warehouseById } from '@/seed/scenario';
import Typewriter from './Typewriter';
import ResponseFeedback from './ResponseFeedback';

const { Text } = Typography;

export interface TaskCardProps {
  task: AgentTask;
  onOpenDrawer: (target: 'resource' | 'knowledge') => void;
}

// 状态用「圆点 + 文字」的轻量徽标，不再用一排彩色 Tag 抢正文的视觉权重。
const STATUS_META: Record<TaskStatus, { label: string; tone: 'idle' | 'busy' | 'ok' | 'warn' | 'err' }> = {
  queued: { label: '排队中', tone: 'idle' },
  running: { label: '执行中', tone: 'busy' },
  succeeded: { label: '已完成', tone: 'ok' },
  partial: { label: '部分完成', tone: 'warn' },
  waiting_input: { label: '待补充信息', tone: 'warn' },
  failed: { label: '失败', tone: 'err' },
  cancelled: { label: '已取消', tone: 'idle' },
};

/** 知识文档标题去掉自带的书名号与「（模拟）」后缀——外层统一加《》，演示标识只在全局出现一次。 */
function cleanDocTitle(title: string): string {
  return title.replace(/^《|》$/g, '').replace(/（模拟）$/, '');
}

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'completed':
      return <CircleCheck className="axn-tc-green" />;
    case 'running':
      return <LoaderCircle className="axn-tc-blue axn-spin" />;
    case 'failed':
      return <CircleX className="axn-tc-red" />;
    case 'cancelled':
      return <CircleMinus className="axn-tc-muted" />;
    default:
      return <Clock className="axn-tc-muted" />;
  }
}

function fmtSeconds(ms: number | null): string {
  if (ms == null) return '';
  return `${(ms / 1000).toFixed(1)}s`;
}

/** 种子里的时间是 ISO 串（2026-09-28T20:18:00+08:00），对话里展示成「2026-09-28 20:18」 */
function readableTime(text: string): string {
  return text.replace(/(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::\d{2})?(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?/g, '$1 $2');
}

/**
 * 纯文本回答的轻量版式：「一、…」成小标题，「xx依据：/说明：」成脚注，首行短标题加粗，
 * 空行只当段间距（不再渲染成一整行空白）。逐字输出时也按这套版式长出来。
 */
function FormattedAnswer({ text }: { text: string }) {
  const lines = text.split('\n');
  const firstIdx = lines.findIndex((l) => l.trim());
  const nodes: ReactNode[] = [];
  lines.forEach((raw, i) => {
    const line = raw.trim();
    if (!line) return;
    if (/^[一二三四五六七八九十]+、/.test(line)) {
      nodes.push(<h4 key={i} className="axn-answer-h">{line}</h4>);
    } else if (/^(评估依据|数据依据|依据|说明|备注)：/.test(line)) {
      nodes.push(<p key={i} className="axn-answer-foot">{line}</p>);
    } else if (i === firstIdx && line.length <= 40 && !/[。；！？]$/.test(line) && lines.length > 2) {
      nodes.push(<p key={i} className="axn-answer-title">{line}</p>);
    } else {
      const kv = /^([^：]{2,8})：(.+)$/.exec(line);
      nodes.push(kv
        ? <p key={i} className="axn-answer-p"><span className="axn-answer-k">{kv[1]}</span>{kv[2]}</p>
        : <p key={i} className="axn-answer-p">{line}</p>);
    }
  });
  return <div className="axn-answer">{nodes}</div>;
}

function factValueText(factId: string, override?: string): string {
  if (override) return readableTime(override);
  const text = readableTime(factText(factId));
  const unit = getFact(factId)?.unit;
  if (!text) return '（来源缺失）';
  return unit ? `${text} ${unit}` : text;
}

function SummaryBlock({ payload }: { payload: SummaryArtifact }) {
  const isPending = (id: string) => resolveFact(id, { kind: 'event', eventId: payload.eventId })?.verification !== 'confirmed';
  const pendingKeys = payload.pendingKeys.filter(isPending);
  return (
    <div className="axn-artifact">
      {payload.rows.map((row) => (
        <div key={row.label + row.factId} className="axn-artifact-row">
          <span className="axn-artifact-label">{row.label}</span>
          <span className="axn-artifact-value">
            {factValueText(row.factId, row.displayOverride)}
            {row.emphasize === 'suggested' && (
              <span className="axn-inline-flag is-info">建议值</span>
            )}
            {row.emphasize === 'pending' && isPending(row.factId) && (
              <span className="axn-inline-flag is-warn">待确认</span>
            )}
          </span>
        </div>
      ))}
      {pendingKeys.length > 0 && (
        <Alert
          type="warning"
          showIcon
          className="axn-tc-mt8"
          title={`待确认字段：${pendingKeys.map(id => payload.rows.find(row => row.factId === id)?.label ?? '待补充信息').join('、')}`}
          description="以上字段暂无可靠来源，需人工补录后才会进入正式产物。"
        />
      )}
      {payload.sourceUnavailable && (
        <Alert type="info" showIcon className="axn-tc-mt8" title={payload.sourceUnavailable} />
      )}
      <div className="axn-artifact-foot">数据时间：{readableTime(payload.dataTime)}</div>
    </div>
  );
}

function ResourceBlock({ payload, onOpenDrawer }: { payload: ResourceResultArtifact; onOpenDrawer: TaskCardProps['onOpenDrawer'] }) {
  const teamCount = payload.resourceIds.filter((id) => teamById.has(id)).length;
  const warehouseCount = payload.resourceIds.length - teamCount;
  return (
    <div className="axn-artifact">
      <div className="axn-artifact-row">
        <span className="axn-artifact-label">查询结果</span>
        <span className="axn-artifact-value">
          {teamCount} 支队伍 · {warehouseCount} 处仓库
        </span>
      </div>
      <div className="axn-resource-results" data-testid="resource-result-details">
        {payload.resourceIds.map(id => {
          const team = teamById.get(id);
          const warehouse = warehouseById.get(id);
          const refs = team?.factRefs ?? warehouse?.factRefs;
          if (!refs) return null;
          const value = (factId: string) => factDisplay(factId, { kind: 'event', eventId: payload.eventId });
          const Icon = team ? Users : Warehouse;
          return <div className="axn-resource-result" key={id}>
            <span className={`axn-resource-icon${team ? '' : ' is-store'}`} aria-hidden><Icon size={15} /></span>
            <div className="axn-resource-main">
              <div className="axn-resource-name">{value(refs.name)}<span className="axn-resource-kind">{team ? '救援队伍' : '物资仓库'}</span></div>
              <div className="axn-resource-meta">{team
                ? `人员 ${value(team.factRefs.peopleCount)} · 挖掘机 ${value(team.factRefs.excavatorCount)}`
                : warehouse ? `${value(warehouse.factRefs.materialName)} · 库存 ${value(warehouse.factRefs.stockQuantity)}` : ''}</div>
            </div>
            {team && <div className="axn-resource-eta">
              <strong>{value(team.factRefs.etaMinutes)}</strong>
              <span>{value(team.factRefs.distanceKm)}</span>
            </div>}
          </div>;
        })}
      </div>
      {payload.excluded.map((ex) => {
        const team = teamById.get(ex.resourceId);
        const name = team ? factText(team.factRefs.name) || ex.resourceId : ex.resourceId;
        return (
          <div key={ex.resourceId} className="axn-artifact-row">
            <span className="axn-artifact-label">未列入</span>
            <span className="axn-artifact-value">
              {name}：{ex.reason}
            </span>
          </div>
        );
      })}
      {payload.note && <div className="axn-artifact-foot">{payload.note}</div>}
      <div className="axn-artifact-actions">
        <Button size="small" icon={<MapIcon size={14} />} onClick={() => onOpenDrawer('resource')}>
          查看资源与态势
        </Button>
      </div>
    </div>
  );
}

function KnowledgeBlock({ payload, onOpenDrawer }: { payload: KnowledgeArtifact; onOpenDrawer: TaskCardProps['onOpenDrawer'] }) {
  const chunks = payload.chunkIds
    .map((id) => knowledgeById.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  return (
    <div className="axn-artifact">
      {chunks.length === 0 ? (
        <Text type="secondary">引用知识条目缺失</Text>
      ) : (
        chunks.map((c) => (
          <div key={c.chunkId} className="axn-artifact-row">
            <span className="axn-artifact-label">{c.category}</span>
            <span className="axn-artifact-value">
              《{c.title}》· {c.sourceLabel}
            </span>
          </div>
        ))
      )}
      <div className="axn-artifact-actions">
        <Button size="small" icon={<BookOpen size={14} />} onClick={() => onOpenDrawer('knowledge')}>
          查看建议与知识
        </Button>
      </div>
    </div>
  );
}

/**
 * 抢险救援知识问答：不再套框，按「结论 → 建议动作 / 禁忌 / 上报 → 依据」的阅读顺序平铺；
 * 来源以编号脚注呈现（qa.json，模拟数据）。
 */
function QaKnowledgeBlock({ payload }: { payload: QaKnowledgeArtifact }) {
  const sections = [
    { title: '建议动作', body: payload.keyActions },
    { title: '禁忌提醒', body: payload.doNot, warn: true },
    { title: '协同上报', body: payload.supportAndReporting },
  ].filter((x) => x.body);
  return (
    <div className="axn-qa">
      <p className="axn-qa-lead">
        {payload.summary}
        {payload.sources.map((src, i) => (
          <sup key={i} className="axn-cite" title={`《${cleanDocTitle(src.title)}》${src.section}`}>{i + 1}</sup>
        ))}
      </p>
      {sections.map((sec) => (
        <section key={sec.title} className={`axn-qa-section${sec.warn ? ' is-warn' : ''}`}>
          <h4>{sec.title}</h4>
          <p>{sec.body}</p>
        </section>
      ))}
      <div className="axn-qa-sources">
        <div className="axn-qa-sources-title">依据来源 · {payload.sources.length}</div>
        <ol>
          {payload.sources.map((s, i) => (
            <li key={`${s.docId}-${s.section}`} className="axn-qa-source">
              <span className="axn-cite" aria-hidden>{i + 1}</span>
              <div className="axn-qa-source-body">
                <div className="axn-qa-source-title">《{cleanDocTitle(s.title)}》<span>{s.section}</span></div>
                <div className="axn-qa-source-quote">{s.excerpt}</div>
              </div>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function ProposalBlock({ payload, onOpenDrawer }: { payload: ProposalArtifact; onOpenDrawer: TaskCardProps['onOpenDrawer'] }) {
  const proposal = useSessionStore(s => s.proposals[payload.proposalId]);
  return (
    <div className="axn-artifact">
      <div className="axn-artifact-row">
        <span className="axn-artifact-label">处置建议</span>
        <span className="axn-artifact-value">
          已生成（版本 {payload.version} · 待人工审核）
        </span>
      </div>
      {proposal && proposal.sections.length > 0 && (
        <ol className="axn-proposal-steps">
          {proposal.sections.map(section => <li key={section.id}><strong>{section.title}</strong><p>{section.text}</p></li>)}
        </ol>
      )}
      <div className="axn-artifact-actions">
        <Button size="small" icon={<BookOpen size={14} />} onClick={() => onOpenDrawer('knowledge')}>
          查看建议与知识
        </Button>
      </div>
    </div>
  );
}

/** 任务产出的文书：草稿已创建时提供真实的预览/打开工作区动作（不伪造下载）。 */
function DocumentBlock({ payload, sessionId }: { payload: DocumentLinkArtifact; sessionId: string }) {
  const draft = useDocumentStore(s => s.drafts[payload.documentId]);
  const openDocument = useDocumentNavigation();
  const openDraft = () => {
    if (!draft) return;
    openDocument(sessionId, { kind: 'draft', id: payload.documentId });
  };
  return (
    <div className="axn-artifact">
      <div className="axn-artifact-row">
        <span className="axn-artifact-label">文书</span>
        <span className="axn-artifact-value">
          《{payload.title}》
          {payload.state === 'draft_created' ? '草稿已创建' : '等待补录必填信息'}
        </span>
      </div>
      {payload.state === 'waiting_input' && payload.missingFields.length > 0 && (
        <Alert
          type="warning"
          showIcon
          className="axn-tc-mt8"
          title={`缺少必填字段：${payload.missingFields.join('、')}`}
          description="请在对话中按提示补录（补录内容确认后生成来源记录）。"
        />
      )}
      {payload.state === 'draft_created' && draft && (
        <div className="axn-artifact-actions">
          <Button size="small" icon={<FileText size={14} />} onClick={openDraft} data-testid="task-open-draft">
            预览/打开真实草稿
          </Button>
        </div>
      )}
    </div>
  );
}

function ArtifactBlock({ payload, onOpenDrawer, sessionId }: { payload: TaskArtifactPayload; onOpenDrawer: TaskCardProps['onOpenDrawer']; sessionId: string }) {
  switch (payload.kind) {
    case 'summary':
      return <SummaryBlock payload={payload} />;
    case 'resources':
      return <ResourceBlock payload={payload} onOpenDrawer={onOpenDrawer} />;
    case 'knowledge':
      return <KnowledgeBlock payload={payload} onOpenDrawer={onOpenDrawer} />;
    case 'qa_knowledge':
      return <QaKnowledgeBlock payload={payload} />;
    case 'proposal':
      return <ProposalBlock payload={payload} onOpenDrawer={onOpenDrawer} />;
    case 'document':
      return <DocumentBlock payload={payload} sessionId={sessionId} />;
    case 'clarification':
      return (
        <Alert type="info" showIcon title="需要补充信息" description={payload.prompt} className="axn-tc-mt8" />
      );
    case 'error': {
      const err: ErrorArtifact = payload;
      return (
        <Alert
          type="error"
          showIcon
          className="axn-tc-mt8"
          title={`${err.message}（${err.errorCode}）`}
          description={err.hint}
        />
      );
    }
    default:
      return null;
  }
}

export default function TaskCard({ task, onOpenDrawer }: TaskCardProps) {
  const meta = STATUS_META[task.status] ?? { label: task.status, tone: 'idle' as const };
  const isRunning = task.status === 'running' || task.status === 'queued';
  // 执行过程：运行中展开（看得到 AI 在做什么），结束后自动收起成一行摘要，结果成为主角
  const [stepsOpen, setStepsOpen] = useState(isRunning);
  // 挂载时仍在生成 → 回答逐字呈现；历史消息（刷新恢复）直接整段显示
  const liveRef = useRef(isRunning);
  useEffect(() => { setStepsOpen(isRunning); }, [isRunning]);
  const doneSteps = task.steps.filter((st) => st.status === 'completed');
  const totalMs = doneSteps.reduce((sum, st) => sum + (st.elapsedMs ?? 0), 0);

  return (
    <div className={`axn-task-card axn-task-card--${task.status}`}>
      {/* 运行条：一行承载「任务名 · 步数 · 耗时」+ 状态；有步骤时整行可展开执行过程（参考 Claude 的工具调用行） */}
      <div className={`axn-task-run${stepsOpen ? ' is-open' : ''}${isRunning ? ' is-running' : ''}`}>
        <div className="axn-task-head">
          {task.steps.length > 0 ? (
            <button
              type="button"
              className="axn-task-process-toggle"
              aria-expanded={stepsOpen}
              aria-label={`${stepsOpen ? '收起' : '展开'}执行过程`}
              onClick={() => setStepsOpen((v) => !v)}
            >
              <ChevronRight size={14} aria-hidden className="axn-task-process-caret" />
              <Text className="axn-task-title">{task.displayTitle}</Text>
              <span className="axn-task-process-meta">
                {isRunning ? '正在执行 · ' : ''}{doneSteps.length}/{task.steps.length} 步{totalMs > 0 ? ` · ${fmtSeconds(totalMs)}` : ''}
              </span>
            </button>
          ) : (
            <Text className="axn-task-title">{task.displayTitle}</Text>
          )}
          <div className="axn-task-head-side">
            {task.attempt > 1 && <span className="axn-status axn-status--idle">第 {task.attempt} 次尝试</span>}
            <span className={`axn-status axn-status--${meta.tone}`}><i aria-hidden />{meta.label}</span>
            {isRunning && (
              <Button size="small" type="text" className="axn-task-cancel" onClick={() => cancelTask(task.taskId)}>
                取消
              </Button>
            )}
            {task.status === 'failed' && (
              <Button size="small" type="primary" onClick={() => void retryTask(task.taskId)}>
                重试
              </Button>
            )}
            {task.status === 'waiting_input' && (
              <Tooltip title="请在下方补录表单或对话中回复所需信息">
                <Button size="small" icon={<CirclePause />} disabled>
                  等待输入
                </Button>
              </Tooltip>
            )}
          </div>
        </div>
        {stepsOpen && task.steps.length > 0 && (
        <ul className="axn-task-steps">
          {task.steps.map((step) => (
            <li key={step.stepId} className={`axn-task-step axn-step-${step.status}`}>
              <StepIcon status={step.status} />
              <span className="axn-step-name">{step.name}</span>
              {step.outputSummary && <span className="axn-step-output">{step.outputSummary}</span>}
              {step.status === 'running' && <span className="axn-step-output">执行中…</span>}
              {step.elapsedMs != null && step.status === 'completed' && (
                <span className="axn-step-time">{fmtSeconds(step.elapsedMs)}</span>
              )}
            </li>
          ))}
        </ul>
        )}
      </div>

      {task.textAnswer && (
        <div className="axn-task-answer">
          <Typewriter text={task.textAnswer} animate={liveRef.current} render={(t) => <FormattedAnswer text={t} />} />
        </div>
      )}

      {task.artifacts.map((artifact) => (
        <ArtifactBlock key={artifact.artifactId} payload={artifact.payload} onOpenDrawer={onOpenDrawer} sessionId={task.sessionId} />
      ))}

      {['succeeded', 'partial'].includes(task.status) && (task.textAnswer || task.artifacts.length > 0) && <ResponseFeedback sessionId={task.sessionId} targetId={task.taskId} />}
      {task.error && (
        <Alert
          type="error"
          showIcon
          className="axn-tc-mt8"
          title={`${task.error.message}（${task.error.errorCode}）`}
          description={
            <Space orientation="vertical" size={4}>
              <span>{task.error.hint}</span>
              <Button size="small" type="primary" onClick={() => void retryTask(task.taskId)}>
                重试
              </Button>
            </Space>
          }
        />
      )}
    </div>
  );
}
