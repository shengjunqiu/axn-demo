import EventTimelineList, { isEventTimelineTable, timelineItemsFromTable } from './EventTimelineList';
import SurveyAnalysisReply from './SurveyAnalysisReply';
import { ResultNotice as Alert } from '@/components/common/AgentResultPrimitives';
import { Confidence, FileRow, InlineFlag, KvTable, Notice, ResourceList, RunBar, Section, SourceList, type Tone } from '@/components/common/ChatPrimitives';
import StructuredReply from './StructuredReply';
import './agent-results.css';
import MultiSourceSummary from './MultiSourceSummary';
import { tenderName } from '@/seed/tenderNames';
/**
 * 任务执行卡（T-006）：渲染 assistant 任务消息的执行步骤、产物摘要、流式文本与操作。
 * 数据全部来自 sessionStore.tasks（zustand 订阅），本组件不复制任务状态。
 * 所有数值/文本均取自种子事实或任务产物，界面为模拟数据环境。
 */
import { useState, type ReactNode } from 'react';
import { publishConstructionMaterial } from '@/services/agentMaterialDocument';
import { needsResultDocument } from '@/services/resultPresentation';
import type { ConstructionCapability } from '@/seed/constructionScenarios';
import {  Button, Space, Typography } from 'antd';
import {
  FileText,
} from 'lucide-react'
import type {
  AgentTask,
  DocumentLinkArtifact,
  ErrorArtifact,
  KnowledgeArtifact,
  ProposalArtifact,
  QaKnowledgeArtifact,
  ResourceResultArtifact,
  ScenarioSectionsArtifact,
  SummaryArtifact,
  TaskArtifactPayload,
  TaskStatus,
} from '@/domain/types';
import { cancelTask, retryTask } from '@/services/taskRunner';
import { scenarioLabelForId } from '@/services/agentFlow';
import { buildFollowUpNextStepActions } from '@/services/eventSwitchBriefing';
import { resolveFact } from '@/services/factLookup';
import { useSessionStore } from '@/store/sessionStore';
import { useDocumentStore } from '@/store/documentStore';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useDocumentNavigation } from '@/components/workspace/useDocumentNavigation';
import { qaStatusLabel } from '@/services/qaKnowledge';
import { factText, getFact, knowledgeById, teamById, warehouseById } from '@/seed/scenario';
import NextStepActionsBar from './NextStepActionsBar';
import TaskSkillPanel from '@/components/skills/TaskSkillPanel';

const { Text } = Typography;

export interface TaskCardProps {
  task: AgentTask;
  onOpenDrawer: (target: 'resource' | 'knowledge', options?: { tab?: 'list' | 'map' }) => void;
  onTask?: (prompt: string) => void;
  onNavigate?: (path: string) => void;
  /** 打开业务流程补充抽屉并定位到指定流程 Tab */
  onOpenFlow?: (tab: string) => void;
  busy?: boolean;
}

const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  queued: { label: '排队中', color: 'default' },
  running: { label: '执行中', color: 'processing' },
  succeeded: { label: '已完成', color: 'blue' },
  partial: { label: '部分完成', color: 'warning' },
  waiting_input: { label: '待补充信息', color: 'warning' },
  failed: { label: '失败', color: 'error' },
  cancelled: { label: '已取消', color: 'default' },
};

function fmtSeconds(ms: number | null): string {
  if (ms == null) return '';
  return `${(ms / 1000).toFixed(1)}s`;
}

function factValueText(factId: string, override?: string): string {
  if (override) return override;
  const text = factText(factId);
  const unit = getFact(factId)?.unit;
  if (!text) return '（来源缺失）';
  return unit ? `${text} ${unit}` : text;
}

function SummaryBlock({
  payload,
  onOpenFlow,
}: {
  payload: SummaryArtifact;
  onOpenFlow?: (tab: string) => void;
}) {
  const isPending = (id: string) => resolveFact(id, { kind: 'event', eventId: payload.eventId })?.verification !== 'confirmed';
  return <div data-testid="event-summary-text">
    <KvTable rows={payload.rows.map(row => ({ label: row.label, value: <>{factValueText(row.factId, row.displayOverride)} {row.emphasize === 'suggested' ? <InlineFlag tone="info">建议值</InlineFlag> : row.emphasize === 'pending' && isPending(row.factId) ? <InlineFlag tone="warn">待确认</InlineFlag> : null}</> }))}
      foot={`数据时间：${payload.dataTime} · 模拟数据`}
      actions={onOpenFlow && <Button size="small" data-testid="open-situation-warning" onClick={() => onOpenFlow('预警推送')}>打开预警推送</Button>} />
    {payload.sourceUnavailable && <Notice tone="warn" title="资料待补充">{payload.sourceUnavailable}</Notice>}
  </div>;
}

/** 产物单行条：类型 + 名称（省略）+ 右侧查看，避免多行卡片占位。 */
function ResultLine({
  label,
  name,
  actions,
  testId,
}: {
  label: string;
  name: string;
  actions: ReactNode;
  testId?: string;
}) {
  return <div data-testid={testId}><FileRow name={name} sub={label} action={<Space size={6} wrap>{actions}</Space>} /></div>;
}

function ResourceBlock({
  payload,
  onOpenDrawer,
  onOpenFlow,
}: {
  payload: ResourceResultArtifact;
  onOpenDrawer: TaskCardProps['onOpenDrawer'];
  onOpenFlow?: TaskCardProps['onOpenFlow'];
}) {
  const teamCount = payload.resourceIds.filter(id => teamById.has(id)).length;
  const warehouseCount = payload.resourceIds.filter(id => warehouseById.has(id)).length;
  const items = payload.resourceIds.flatMap(id => {
    const team = teamById.get(id);
    const warehouse = warehouseById.get(id);
    const entity = team ?? warehouse;
    if (!entity) return [];
    return [{ name: factText(entity.factRefs.name) || id, kind: team ? 'team' as const : 'store' as const,
      meta: team ? `人员 ${factText(team.factRefs.peopleCount)} · 挖掘机 ${factText(team.factRefs.excavatorCount)}` : '仓储明细与可用库存待核对',
    }];
  });
  return <div data-testid="resource-result-compact"><ResourceList summary={{ label: '查询结果', value: items.length ? `${teamCount} 支队伍 · ${warehouseCount} 处仓库` : `${payload.resourceIds.length} 处周边资源示意点` }}
    items={items} foot={payload.note ?? `数据时间：${payload.dataTime} · 候选资源不等于已调派`}
    actions={<Space wrap size={6}><Button size="small" aria-label="查看资源列表" onClick={() => onOpenDrawer('resource', { tab: 'list' })}>列表</Button><Button size="small" type="primary" aria-label="查看态势地图" onClick={() => onOpenDrawer('resource', { tab: 'map' })}>地图</Button>{onOpenFlow && <Button size="small" data-testid="open-resource-warning" onClick={() => onOpenFlow('资源预警通知')}>打开资源预警通知</Button>}</Space>} />
    {payload.excluded.length > 0 && <Notice tone="warn" title={`${payload.excluded.length} 项未列入`}>{payload.excluded.map(item => `${item.resourceId}：${item.reason}`).join('；')}</Notice>}
  </div>;
}

function KnowledgeBlock({ payload, onOpenDrawer }: { payload: KnowledgeArtifact; onOpenDrawer: TaskCardProps['onOpenDrawer'] }) {
  const chunks = payload.chunkIds
    .map((id) => knowledgeById.get(id))
    .filter((c): c is NonNullable<typeof c> => Boolean(c));
  return <div><SourceList sources={chunks.map(c => ({ title: c.title, section: c.category, excerpt: c.sourceLabel }))} /><Button size="small" onClick={() => onOpenDrawer('knowledge')}>查看建议与知识</Button></div>;
}

/** 抢险救援知识问答卡：结构化答案 + 模拟文档溯源（qa.json，模拟数据）。 */
function QaKnowledgeBlock({ payload }: { payload: QaKnowledgeArtifact }) {
  return <div className="axn-qa">
    <p className="axn-qa-lead">{payload.summary}</p>
    <div className="axn-agent-result-meta"><span>{payload.category} · {qaStatusLabel(payload.answerStatus)}</span><Confidence level={payload.confidence >= 0.8 ? 'high' : payload.confidence >= 0.6 ? 'mid' : 'low'} value={Math.round(payload.confidence * 100)} /></div>
    {payload.keyActions && <Section title="建议动作"><p>{payload.keyActions}</p></Section>}
    {payload.doNot && <Section title="禁忌提醒" warn><p>{payload.doNot}</p></Section>}
    {payload.supportAndReporting && <Section title="协同上报"><p>{payload.supportAndReporting}</p></Section>}
    {payload.liveDataNeeded.length > 0 && <Notice tone="warn" title="需结合现场实时数据">{payload.liveDataNeeded.join('、')}</Notice>}
    <SourceList sources={payload.sources.map(source => ({ title: source.title, section: source.section, excerpt: source.excerpt }))} />
    <Notice tone="info" title="模拟数据，非正式技术规范">现场处置以现场指挥体系、现行法规标准与专业技术人员判断为准。</Notice>
  </div>;
}

function ProposalBlock({ payload, onOpenDrawer }: { payload: ProposalArtifact; onOpenDrawer: TaskCardProps['onOpenDrawer'] }) {
  const proposal = useSessionStore(s => s.proposals[payload.proposalId]);
  const name = proposal?.title ?? '险情处置工作建议';
  return (
    <ResultLine
      testId="proposal-result"
      label="处置建议"
      name={name}
      actions={(
        <Button
          size="small"
          type="primary"
          ghost
          aria-label="查看建议与知识"
          onClick={() => onOpenDrawer('knowledge')}
        >
          查看
        </Button>
      )}
    />
  );
}

const RESOURCE_SCENARIO_CAPABILITIES = new Set(['search', 'resourceReport', 'update', 'group']);

/** 四智能体建设材料：单行名称 +「查看」，正文在右侧红头工作区。 */
function ScenarioSectionsBlock({
  payload,
  sessionId,
  onOpenDrawer,
  onOpenFlow,
}: {
  payload: ScenarioSectionsArtifact;
  sessionId: string;
  onOpenDrawer: TaskCardProps['onOpenDrawer'];
  onOpenFlow?: TaskCardProps['onOpenFlow'];
}) {
  const openDocument = useDocumentNavigation();
  const [attachmentId, setAttachmentId] = useState<string | null>(null);
  const document = useMockDocumentStore((s) =>
    (attachmentId || payload.documentId)
      ? s.libraries[sessionId]?.documents.find((item) => item.id === (attachmentId || payload.documentId))
      : undefined,
  );
  const openInWorkspace = () => {
    if (!document) return;
    openDocument(sessionId, { kind: 'mock', id: document.id });
  };
  const showResourceMap = RESOURCE_SCENARIO_CAPABILITIES.has(payload.capability);
  const inline = !needsResultDocument(payload.capability);
  const exportAttachment = () => {
    const created = document ?? publishConstructionMaterial(sessionId, payload.capability as ConstructionCapability,
      { ...payload, capability: payload.capability as ConstructionCapability }, { attachment: true });
    if (!created) return;
    setAttachmentId(created.id);
    openDocument(sessionId, { kind: 'mock', id: created.id });
  };
  const materialName = document?.title ?? payload.title;
  if (payload.capability === 'survey') return <SurveyAnalysisReply payload={payload} sessionId={sessionId} />;
  if (payload.capability === 'situationReport') {
    // 兼容已有会话中的长摘要；完整章节、附表与说明仍由报告工作区承载。
    const risks = payload.summary.match(/关注([^；。]+)/)?.[1];
    const summary = risks
      ? `当前重点：关注${risks}；救援前需完成现场风险评估。`
      : payload.summary.split(/[。]/).filter(Boolean).slice(0, 2).join('。') + '。';
    const parsedTime = new Date(payload.dataTime);
    const dataTime = Number.isNaN(parsedTime.getTime()) ? payload.dataTime : new Intl.DateTimeFormat('zh-CN', {
      timeZone: 'Asia/Shanghai', month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false,
    }).format(parsedTime);
    return <div data-testid="scenario-sections">
      <p className="axn-agent-result-lead">已生成态势报告初稿</p>
      <p className="axn-agent-result-lead">{summary}</p>
      <ResultLine label="报告 / 方案草稿" name={materialName.replace(/（模拟）/g, '').trim()} actions={
        <Button aria-label="查看文书" size="small" type="primary" ghost icon={<FileText />}
          onClick={document ? openInWorkspace : exportAttachment} data-testid="agent-material-preview">查看报告</Button>
      } />
      <Text type="secondary">模拟数据 · 更新于 {dataTime}</Text>
    </div>;
  }

  return (
    <div data-testid="scenario-sections">
      {inline ? <Section title={payload.title}>
        <Space wrap size={6}>
          <Button size="small" onClick={exportAttachment}>按需整理为附件</Button>
          {showResourceMap && <>
            <Button size="small" aria-label="查看资源列表" onClick={() => onOpenDrawer('resource', { tab: 'list' })}>列表</Button>
            <Button size="small" aria-label="查看态势地图" onClick={() => onOpenDrawer('resource', { tab: 'map' })}>地图</Button>
          </>}
        </Space>
      </Section> : <ResultLine
        label="报告 / 方案草稿 · 模拟"
        name={materialName}
        actions={(
          <>
            {document ? (
              <Button
                aria-label="查看文书"
                size="small"
                type="primary"
                ghost
                icon={<FileText />}
                onClick={openInWorkspace}
                data-testid="agent-material-preview"
              >
                查看
              </Button>
            ) : (
              <Text type="secondary" className="axn-tc-fs12">结果已整理</Text>
            )}
            {showResourceMap && (
              <>
                <Button
                  size="small"
                  type="primary"
                  ghost
                  aria-label="查看资源列表"
                  onClick={() => onOpenDrawer('resource', { tab: 'list' })}
                >
                  列表
                </Button>
                <Button
                  size="small"
                  type="primary"
                  aria-label="查看态势地图"
                  onClick={() => onOpenDrawer('resource', { tab: 'map' })}
                >
                  地图
                </Button>
              </>
            )}
          </>
        )}
      />}
      <p className="axn-agent-result-lead">{payload.summary}</p>
      {payload.sections.filter(section => !/招标能力补齐/.test(section.title)).map((section, index) => <details className="axn-result-details" key={`${index}-${section.title}`} open={index === 0}>
        <summary>{section.title}</summary><StructuredReply text={section.text} />
      </details>)}
      {[...(payload.table ? [{ title: '明细记录', ...payload.table }] : []), ...(payload.tables ?? [])].map((table, index) => <details className="axn-result-details" key={index}><summary>{table.title} · {table.rows.length} 条</summary>
        {isEventTimelineTable(table.headers) ? <EventTimelineList items={timelineItemsFromTable(table.headers, table.rows)} /> : table.rows.map((row, rowIndex) => <KvTable key={rowIndex} rows={table.headers.map((label, col) => ({ label, value: row[col] ?? '—' }))} />)}
      </details>)}
      <Notice tone="info" title="编制说明">{payload.notice} · 数据时间：{payload.dataTime}</Notice>
      {showResourceMap && onOpenFlow && (
        <Button
          size="small"
          type="primary"
          ghost
          className="axn-tc-mt8"
          data-testid="open-resource-warning-material"
          onClick={() => onOpenFlow('资源预警通知')}
        >
          打开资源预警通知
        </Button>
      )}
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
          description="请在对话中按提示补录（补录内容确认后生成模拟来源记录）。"
        />
      )}
      {payload.state === 'draft_created' && draft && (
        <Button size="small" type="primary" ghost onClick={openDraft} className="axn-tc-mt8" data-testid="task-open-draft">
          预览/打开真实草稿
        </Button>
      )}
    </div>
  );
}

function ArtifactBlock({
  payload,
  onOpenDrawer,
  onOpenFlow,
  sessionId,
}: {
  payload: TaskArtifactPayload;
  onOpenDrawer: TaskCardProps['onOpenDrawer'];
  onOpenFlow?: TaskCardProps['onOpenFlow'];
  sessionId: string;
}) {
  switch (payload.kind) {
    case 'summary':
      return payload.displayMode === 'multi_source' && payload.multiSource
        ? <MultiSourceSummary snapshot={payload.multiSource} />
        : <SummaryBlock payload={payload} onOpenFlow={onOpenFlow} />;
    case 'resources':
      return <ResourceBlock payload={payload} onOpenDrawer={onOpenDrawer} onOpenFlow={onOpenFlow} />;
    case 'knowledge':
      return <KnowledgeBlock payload={payload} onOpenDrawer={onOpenDrawer} />;
    case 'qa_knowledge':
      return <QaKnowledgeBlock payload={payload} />;
    case 'proposal':
      return <ProposalBlock payload={payload} onOpenDrawer={onOpenDrawer} />;
    case 'scenario_sections':
      return (
        <ScenarioSectionsBlock
          payload={payload}
          sessionId={sessionId}
          onOpenDrawer={onOpenDrawer}
          onOpenFlow={onOpenFlow}
        />
      );
    case 'document':
      return <DocumentBlock payload={payload} sessionId={sessionId} />;
    case 'clarification':
      return (
        <Notice tone="warn" title="需要补充信息">{payload.prompt}</Notice>
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

export default function TaskCard({ task, onOpenDrawer, onTask, onNavigate, onOpenFlow, busy = false }: TaskCardProps) {
  const meta = STATUS_META[task.status] ?? { label: task.status, color: 'default' };
  const isRunning = task.status === 'running' || task.status === 'queued';
  const session = useSessionStore((s) => s.sessions[task.sessionId]);
  const hasMaterialDoc = task.artifacts.some((a) => a.payload.kind === 'scenario_sections');
  // 文书物化结果本身已带「查看文书」入口，不再叠一层下一步建议，避免对话噪音。
  const showFollowUps =
    (task.status === 'succeeded' || task.status === 'partial') && onTask && onNavigate && !hasMaterialDoc;
  const followUps = showFollowUps
    ? buildFollowUpNextStepActions(task.displayTitle, task.eventId, session)
    : [];
  const handoff = session?.handoffBundle;

  return (
    <div className={`axn-task-card axn-agent-result axn-task-card--${task.status}`}>
      <RunBar key={task.artifacts.some(a => a.payload.kind === 'scenario_sections' && a.payload.capability === 'survey') ? (isRunning ? 'survey-running' : 'survey-finished') : 'process'} title={tenderName(task.displayTitle)} status={{ tone: ({ queued: 'busy', running: 'busy', succeeded: 'ok', partial: 'warn', waiting_input: 'warn', failed: 'err', cancelled: 'idle' } as Record<TaskStatus, Tone>)[task.status], label: meta.label }}
        steps={task.steps.map(step => ({ name: tenderName(step.name), status: step.status === 'cancelled' ? 'pending' : step.status, output: step.outputSummary ?? (step.status === 'running' ? '执行中…' : undefined), time: step.elapsedMs == null ? undefined : fmtSeconds(step.elapsedMs) }))}
        defaultOpen={isRunning} meta={task.attempt > 1 ? `第 ${task.attempt} 次尝试 · 模拟` : '模拟数据'}
        side={isRunning ? <Button size="small" onClick={() => cancelTask(task.taskId)}>取消</Button> : task.status === 'failed' ? <Button size="small" onClick={() => void retryTask(task.taskId)}>重试</Button> : null} />
      {handoff && <Notice tone="info" title={`场景交接 · ${scenarioLabelForId(handoff.fromScenario)}`}><span data-testid="task-handoff-hint">{handoff.versionLabel}：{handoff.summary}</span></Notice>}
      {task.steps.length > 0 && !task.artifacts.some(a => a.payload.kind === 'scenario_sections' && a.payload.capability === 'survey') && <details className="axn-result-details"><summary>查看本次执行与能力分工</summary><TaskSkillPanel task={task} /></details>}

      {/* 建设材料 / 处置建议已物化时，正文只在右侧或知识抽屉；聊天区不重复长摘要 */}
      {task.textAnswer
        && !task.artifacts.some(a => a.payload.kind === 'scenario_sections' || a.payload.kind === 'proposal') && (
        <div className="axn-task-answer">
          <StructuredReply text={task.textAnswer} />
        </div>
      )}

      {task.artifacts.map((artifact) => (
        <ArtifactBlock
          key={artifact.artifactId}
          payload={artifact.payload}
          onOpenDrawer={onOpenDrawer}
          onOpenFlow={onOpenFlow}
          sessionId={task.sessionId}
        />
      ))}

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

      {showFollowUps && (
        <NextStepActionsBar
          actions={followUps}
          onTask={onTask ?? (() => {})}
          onNavigate={onNavigate ?? (() => {})}
          busy={busy}
          testId="task-next-steps"
        />
      )}
    </div>
  );
}
