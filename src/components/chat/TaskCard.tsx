import { tenderName } from '@/seed/tenderNames';
/**
 * 任务执行卡（T-006）：渲染 assistant 任务消息的执行步骤、产物摘要、流式文本与操作。
 * 数据全部来自 sessionStore.tasks（zustand 订阅），本组件不复制任务状态。
 * 所有数值/文本均取自种子事实或任务产物，界面为模拟数据环境。
 */
import { Alert, Button, Space, Tag, Tooltip, Typography } from 'antd';
import {
  CircleCheck,
  CircleMinus,
  CirclePause,
  CircleX,
  Clock,
  FileText,
  LoaderCircle,
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
  StepStatus,
  SummaryArtifact,
  TaskArtifactPayload,
  TaskStatus,
} from '@/domain/types';
import { cancelTask, retryTask } from '@/services/taskRunner';
import { scenarioLabelForId } from '@/services/agentFlow';
import { buildFollowUpNextStepActions } from '@/services/eventSwitchBriefing';
import { factDisplay, resolveFact } from '@/services/factLookup';
import { useSessionStore } from '@/store/sessionStore';
import { useDocumentStore } from '@/store/documentStore';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useDocumentNavigation } from '@/components/workspace/useDocumentNavigation';
import { qaStatusLabel } from '@/services/qaKnowledge';
import { factText, getFact, knowledgeById, teamById, warehouseById } from '@/seed/scenario';
import { vueDemoResourceById } from '@/seed/vueDemoResources';
import NextStepActionsBar from './NextStepActionsBar';
import TaskSkillPanel from '@/components/skills/TaskSkillPanel';
import { aggregationCounts } from '@/services/multiSourceAggregation';

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
  const pendingKeys = payload.pendingKeys.filter(isPending);
  const msCounts = payload.multiSource ? aggregationCounts(payload.multiSource.event.sources) : null;
  return (
    <div className="axn-artifact">
      {payload.multiSource && msCounts && (
        <Alert
          type="info"
          showIcon
          style={{ marginBottom: 8 }}
          data-testid="multi-source-flow-hint"
          title="多源数据汇聚明细已放入业务流程补充"
          description={(
            <Space orientation="vertical" size={8} style={{ width: '100%' }}>
              <span>
                覆盖 {msCounts.covered}/6 类 · 原始 {msCounts.raw} 条 · 归并后 {msCounts.merged} 条 · 待核 {msCounts.pending} 条。完整六类来源请在「智能勘察分析」中查看。
              </span>
              {onOpenFlow && (
                <Button size="small" type="primary" ghost onClick={() => onOpenFlow('现场智能勘察')}>
                  打开智能勘察分析
                </Button>
              )}
            </Space>
          )}
        />
      )}
      {payload.rows.map((row) => (
        <div key={row.label + row.factId} className="axn-artifact-row">
          <span className="axn-artifact-label">{row.label}</span>
          <span className="axn-artifact-value">
            {factValueText(row.factId, row.displayOverride)}
            {row.emphasize === 'suggested' && (
              <Tag color="blue" className="axn-tc-ml6">
                建议值
              </Tag>
            )}
            {row.emphasize === 'pending' && isPending(row.factId) && (
              <Tag color="orange" className="axn-tc-ml6">
                待确认
              </Tag>
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
          description="以上字段暂无可靠来源，需人工补录后才会进入正式产物（模拟）。"
        />
      )}
      {payload.sourceUnavailable && (
        <Alert type="info" showIcon className="axn-tc-mt8" title={payload.sourceUnavailable} />
      )}
      <div className="axn-artifact-foot">数据时间：{payload.dataTime} · 模拟数据</div>
    </div>
  );
}

function ResourceBlock({ payload, onOpenDrawer }: { payload: ResourceResultArtifact; onOpenDrawer: TaskCardProps['onOpenDrawer'] }) {
  const teamCount = payload.resourceIds.filter((id) => teamById.has(id)).length;
  const warehouseCount = payload.resourceIds.filter((id) => warehouseById.has(id)).length;
  const demoCount = payload.resourceIds.length - teamCount - warehouseCount;
  return (
    <div className="axn-artifact">
      <div className="axn-artifact-row">
        <span className="axn-artifact-label">查询结果</span>
        <span className="axn-artifact-value">
          {teamCount > 0 || warehouseCount > 0
            ? `${teamCount} 支队伍 · ${warehouseCount} 处仓库（模拟数据）`
            : `${demoCount} 处周边资源示意点（建设场景 · 模拟）`}
        </span>
      </div>
      <div className="axn-resource-results" data-testid="resource-result-details">
        {payload.resourceIds.map(id => {
          const team = teamById.get(id);
          const warehouse = warehouseById.get(id);
          const demo = vueDemoResourceById.get(id);
          if (demo) {
            return <div className="axn-resource-result" key={id}>
              <Space wrap size={4}><Text strong>{demo.name}</Text><Tag>{demo.kind === 'team' ? '救援队伍' : demo.kind === 'hospital' ? '医院' : demo.kind === 'equipment' ? '装备' : '仓库'}</Tag></Space>
              <Text type="secondary">{demo.capability} · {demo.amountLabel}</Text>
              <Text type="secondary">{demo.location} · {demo.distanceLabel} · {demo.status}</Text>
            </div>;
          }
          const refs = team?.factRefs ?? warehouse?.factRefs;
          if (!refs) return null;
          const value = (factId: string) => factDisplay(factId, { kind: 'event', eventId: payload.eventId });
          return <div className="axn-resource-result" key={id}>
            <Space wrap size={4}><Text strong>{value(refs.name)}</Text><Tag>{team ? '救援队伍' : '物资仓库'}</Tag></Space>
            <Text type="secondary">{team
              ? `人员 ${value(team.factRefs.peopleCount)} · 挖掘机 ${value(team.factRefs.excavatorCount)}`
              : warehouse ? `${value(warehouse.factRefs.materialName)} · 库存 ${value(warehouse.factRefs.stockQuantity)}` : ''}</Text>
            {team && <Text type="secondary">距离 {value(team.factRefs.distanceKm)} · 预计到达 {value(team.factRefs.etaMinutes)}</Text>}
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
      <Space wrap className="axn-tc-mt8">
        <Button size="small" type="primary" ghost onClick={() => onOpenDrawer('resource', { tab: 'list' })}>
          查看资源列表
        </Button>
        <Button size="small" type="primary" onClick={() => onOpenDrawer('resource', { tab: 'map' })}>
          查看态势地图
        </Button>
      </Space>
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
        <Text type="secondary">引用知识条目缺失（模拟数据）</Text>
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
      <Button size="small" type="primary" ghost onClick={() => onOpenDrawer('knowledge')} className="axn-tc-mt8">
        查看建议与知识
      </Button>
    </div>
  );
}

/** 抢险救援知识问答卡：结构化答案 + 模拟文档溯源（qa.json，模拟数据）。 */
function QaKnowledgeBlock({ payload }: { payload: QaKnowledgeArtifact }) {
  return (
    <div className="axn-artifact axn-qa">
      <div className="axn-artifact-row">
        <span className="axn-artifact-label">{payload.category}</span>
        <span className="axn-artifact-value">知识问答（模拟数据）</span>
      </div>
      <p className="axn-tc-heading">{payload.summary}</p>
      {payload.keyActions && (
        <div className="axn-tc-mb4">
          <Text strong className="axn-tc-fs12">建议动作</Text>
          <div className="axn-tc-fs12-lh16">{payload.keyActions}</div>
        </div>
      )}
      {payload.doNot && (
        <div className="axn-tc-mb4">
          <Text strong className="axn-tc-fs12">禁忌提醒</Text>
          <div className="axn-tc-fs12-lh16">{payload.doNot}</div>
        </div>
      )}
      {payload.supportAndReporting && (
        <div className="axn-tc-mb4">
          <Text strong className="axn-tc-fs12">协同上报</Text>
          <div className="axn-tc-fs12-lh16">{payload.supportAndReporting}</div>
        </div>
      )}
      {payload.liveDataNeeded.length > 0 && (
        <div className="axn-tc-m-6-0">
          <Text type="secondary" className="axn-tc-fs12">需结合现场实时数据：</Text>
          {payload.liveDataNeeded.map((d) => (
            <Tag key={d} className="axn-tc-tag-sm">{d}</Tag>
          ))}
        </div>
      )}
      <div className="axn-tc-m-6-0 axn-tc-fs12">
        <Text type="secondary">置信度 {Math.round(payload.confidence * 100)}% · {qaStatusLabel(payload.answerStatus)}</Text>
      </div>
      <div className="axn-tc-divider">
        <Text strong className="axn-tc-fs12">来源（模拟应用文档）</Text>
        {payload.sources.map((s) => (
          <div key={`${s.docId}-${s.section}`} className="axn-qa-source axn-tc-body">
            <div>
              <Tag color="blue" className="axn-tc-tag-sm">模拟</Tag>
              <Text strong>《{s.title}》</Text>
              <Text type="secondary"> {s.section}</Text>
            </div>
            <div className="axn-tc-gray">“{s.excerpt}”</div>
          </div>
        ))}
        <Text type="secondary" className="axn-tc-fs12">
          模拟数据，非正式技术规范；现场处置以现场指挥体系、现行法规标准与专业技术人员判断为准。
        </Text>
      </div>
    </div>
  );
}

function ProposalBlock({ payload, onOpenDrawer }: { payload: ProposalArtifact; onOpenDrawer: TaskCardProps['onOpenDrawer'] }) {
  const proposal = useSessionStore(s => s.proposals[payload.proposalId]);
  return (
    <div className="axn-artifact axn-proposal">
      <div className="axn-artifact-row">
        <span className="axn-artifact-label">处置建议</span>
        <span className="axn-artifact-value">
          已生成（版本 {payload.version}，模拟 · 待人工审核）
        </span>
      </div>
      <div className="axn-proposal-body">
        {proposal?.sections.slice(0, 2).map(section => (
          <div className="axn-resource-result" key={section.id}>
            <Text strong>{section.title}</Text>
            <Typography.Paragraph className="axn-tc-pre" ellipsis={{ rows: 2 }} style={{ marginBottom: 0 }}>
              {section.text}
            </Typography.Paragraph>
          </div>
        ))}
      </div>
      <div className="axn-proposal-foot">
        {(proposal?.sections.length ?? 0) > 2 && (
          <Typography.Text type="secondary" className="axn-tc-fs12">
            其余章节见右侧红头方案文书…
          </Typography.Text>
        )}
        <Button size="small" type="primary" ghost onClick={() => onOpenDrawer('knowledge')}>
          查看建议与知识
        </Button>
      </div>
    </div>
  );
}

function ScenarioTable({
  title,
  headers,
  rows,
}: {
  title?: string;
  headers: string[];
  rows: string[][];
}) {
  return (
    <div className="axn-scenario-table-wrap">
      {title && <div className="axn-scenario-table-title">{title}</div>}
      <table className="axn-scenario-table">
        <thead>
          <tr>
            {headers.map((h) => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={`${i}-${j}`}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const RESOURCE_SCENARIO_CAPABILITIES = new Set(['search', 'resourceReport', 'update', 'group']);

/** 建设场景分节结果：对话内摘要预览 +「查看文书」打开右侧红头工作区（对齐文书生成卡）。 */
function ScenarioSectionsBlock({
  payload,
  sessionId,
  onOpenDrawer,
}: {
  payload: ScenarioSectionsArtifact;
  sessionId: string;
  onOpenDrawer: TaskCardProps['onOpenDrawer'];
}) {
  const openDocument = useDocumentNavigation();
  const document = useMockDocumentStore((s) =>
    payload.documentId
      ? s.libraries[sessionId]?.documents.find((item) => item.id === payload.documentId)
      : undefined,
  );
  const openInWorkspace = () => {
    if (!document) return;
    openDocument(sessionId, { kind: 'mock', id: document.id });
  };
  const linkedEventId = useSessionStore(s => s.sessions[sessionId]?.eventId ?? '');
  const showResourceMap = RESOURCE_SCENARIO_CAPABILITIES.has(payload.capability);
  // 已物化红头文书：对话里只留标题摘要 + 打开入口，正文/表格/监测图一律在右侧文书看。
  if (document) {
    return (
      <div className="axn-artifact axn-scenario axn-scenario--compact" data-testid="scenario-sections">
        <div className="axn-artifact-row">
          <span className="axn-artifact-label">建设材料</span>
          <span className="axn-artifact-value">
            <Text strong>{payload.title}</Text>
            <Tag className="axn-tc-ml6">模拟数据</Tag>
          </span>
        </div>
        <Typography.Paragraph type="secondary" className="axn-tc-fs12" style={{ marginBottom: 8 }} ellipsis={{ rows: 2 }}>
          {payload.summary}
        </Typography.Paragraph>
        <div className="axn-document-result" data-testid="agent-material-preview">
          <Typography.Text strong><FileText /> {document.title}</Typography.Text>
          <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
            {document.date} · 红头格式 · 模拟文书 · 共 {document.sections.length} 节，请在右侧查看全文
          </Typography.Paragraph>
        </div>
        <div className="axn-artifact-foot">
          <Space wrap>
            <Button aria-label="查看文书" size="small" type="primary" ghost icon={<FileText />} onClick={openInWorkspace}>
              查看文书
            </Button>
            {showResourceMap && (
              <>
                <Button size="small" type="primary" ghost onClick={() => onOpenDrawer('resource', { tab: 'list' })}>
                  查看资源列表
                </Button>
                <Button aria-label="查看态势地图" size="small" type="primary" onClick={() => onOpenDrawer('resource', { tab: 'map' })}>
                  查看态势地图
                </Button>
              </>
            )}
          </Space>
        </div>
      </div>
    );
  }
  return (
    <div className="axn-artifact axn-scenario" data-testid="scenario-sections">
      <div className="axn-artifact-row">
        <span className="axn-artifact-label">建设材料</span>
        <span className="axn-artifact-value">
          <Text strong>{payload.title}</Text>
          <Tag className="axn-tc-ml6">模拟数据</Tag>
        </span>
      </div>
      <div className="axn-scenario-summary">{payload.summary}</div>
      {payload.table && (
        <ScenarioTable title="队伍与人员状态时效" headers={payload.table.headers} rows={payload.table.rows.slice(0, 2)} />
      )}
      <Typography.Text type="secondary" className="axn-tc-fs12">
        完整章节请在右侧文书工作区查看。
      </Typography.Text>
      <div className="axn-artifact-foot">
        <Space wrap>
          <span>{payload.notice} · 数据时间 {payload.dataTime}</span>
          {showResourceMap && (
            <>
              <Button size="small" type="primary" ghost onClick={() => onOpenDrawer('resource', { tab: 'list' })}>
                查看资源列表
              </Button>
              <Button aria-label="查看态势地图" size="small" type="primary" onClick={() => onOpenDrawer('resource', { tab: 'map' })}>
                查看态势地图
              </Button>
            </>
          )}
        </Space>
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
      return <SummaryBlock payload={payload} onOpenFlow={onOpenFlow} />;
    case 'resources':
      return <ResourceBlock payload={payload} onOpenDrawer={onOpenDrawer} />;
    case 'knowledge':
      return <KnowledgeBlock payload={payload} onOpenDrawer={onOpenDrawer} />;
    case 'qa_knowledge':
      return <QaKnowledgeBlock payload={payload} />;
    case 'proposal':
      return <ProposalBlock payload={payload} onOpenDrawer={onOpenDrawer} />;
    case 'scenario_sections':
      return <ScenarioSectionsBlock payload={payload} sessionId={sessionId} onOpenDrawer={onOpenDrawer} />;
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
    <div className={`axn-task-card axn-task-card--${task.status}`}>
      <div className="axn-task-head">
        <Space size={6} wrap>
          <Text strong className="axn-tc-fs13">
            {tenderName(task.displayTitle)}
          </Text>
          <Tag color={meta.color}>{meta.label}</Tag>
          <Tag>模拟数据</Tag>
          {task.attempt > 1 && <Tag color="purple">第 {task.attempt} 次尝试</Tag>}
        </Space>
        <Space size={4}>
          {isRunning && (
            <Button size="small" danger onClick={() => cancelTask(task.taskId)}>
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
        </Space>
      </div>

      <TaskSkillPanel task={task} />

      {(task.status === 'succeeded' || task.status === 'partial') && handoff ? (
        <Typography.Paragraph type="secondary" className="axn-tc-fs12" data-testid="task-handoff-hint" style={{ margin: '6px 0 0' }}>
          场景交接 · 承接自「{scenarioLabelForId(handoff.fromScenario)}」· {handoff.versionLabel}：{handoff.summary}
        </Typography.Paragraph>
      ) : null}

      {task.steps.length > 0 && (
        <ul className="axn-task-steps">
          {task.steps.map((step) => (
            <li key={step.stepId} className={`axn-task-step axn-step-${step.status}`}>
              <StepIcon status={step.status} />
              <span className="axn-step-name">{tenderName(step.name)}</span>
              {step.outputSummary && <span className="axn-step-output">{step.outputSummary}</span>}
              {step.status === 'running' && <span className="axn-step-output">执行中…</span>}
              {step.elapsedMs != null && step.status === 'completed' && (
                <span className="axn-step-time">{fmtSeconds(step.elapsedMs)}</span>
              )}
            </li>
          ))}
        </ul>
      )}

      {/* 已物化建设文书时，正文与长摘要只在右侧；聊天区改由 scenario_sections 卡片给短提示 */}
      {task.textAnswer && !task.artifacts.some(a => a.payload.kind === 'scenario_sections') && (
        <div className="axn-task-answer">
          <Typography.Paragraph
            className="axn-tc-pre"
            style={{ marginBottom: 0 }}
            ellipsis={
              task.artifacts.some(a => a.payload.kind === 'proposal')
                ? { rows: 4, expandable: false }
                : false
            }
          >
            {task.textAnswer}
          </Typography.Paragraph>
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
          onTask={onTask}
          onNavigate={onNavigate}
          busy={busy}
          testId="task-next-steps"
        />
      )}
    </div>
  );
}
