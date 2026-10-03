/**
 * 任务执行卡（T-006）：渲染 assistant 任务消息的执行步骤、产物摘要、流式文本与操作。
 * 数据全部来自 sessionStore.tasks（zustand 订阅），本组件不复制任务状态。
 * 所有数值/文本均取自种子事实或任务产物，界面为模拟数据环境。
 */
import { Alert, Button, Space, Tag, Tooltip, Typography } from 'antd';
import {
  CheckCircleFilled,
  ClockCircleOutlined,
  CloseCircleFilled,
  LoadingOutlined,
  MinusCircleFilled,
  PauseCircleOutlined,
} from '@ant-design/icons';
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
import { qaStatusLabel } from '@/services/qaKnowledge';
import { factText, getFact, knowledgeById, teamById, warehouseById } from '@/seed/scenario';

const { Text } = Typography;

export interface TaskCardProps {
  task: AgentTask;
  onOpenDrawer: (target: 'resource' | 'knowledge') => void;
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
      return <CheckCircleFilled style={{ color: '#52c41a' }} />;
    case 'running':
      return <LoadingOutlined spin style={{ color: '#1d6ff2' }} />;
    case 'failed':
      return <CloseCircleFilled style={{ color: '#ff4d4f' }} />;
    case 'cancelled':
      return <MinusCircleFilled style={{ color: '#bfbfbf' }} />;
    default:
      return <ClockCircleOutlined style={{ color: '#bfbfbf' }} />;
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
              <Tag color="blue" style={{ marginLeft: 6 }}>
                建议值
              </Tag>
            )}
            {row.emphasize === 'pending' && isPending(row.factId) && (
              <Tag color="orange" style={{ marginLeft: 6 }}>
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
          style={{ marginTop: 8 }}
          title={`待确认字段：${pendingKeys.map(id => payload.rows.find(row => row.factId === id)?.label ?? '待补充信息').join('、')}`}
          description="以上字段暂无可靠来源，需人工补录后才会进入正式产物（模拟）。"
        />
      )}
      {payload.sourceUnavailable && (
        <Alert type="info" showIcon style={{ marginTop: 8 }} title={payload.sourceUnavailable} />
      )}
      <div className="axn-artifact-foot">数据时间：{payload.dataTime} · 模拟数据</div>
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
          {teamCount} 支队伍 · {warehouseCount} 处仓库（模拟数据）
        </span>
      </div>
      <div className="axn-resource-results" data-testid="resource-result-details">
        {payload.resourceIds.map(id => {
          const team = teamById.get(id);
          const warehouse = warehouseById.get(id);
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
      <Button size="small" type="primary" ghost onClick={() => onOpenDrawer('resource')} style={{ marginTop: 8 }}>
        查看资源与态势
      </Button>
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
      <Button size="small" type="primary" ghost onClick={() => onOpenDrawer('knowledge')} style={{ marginTop: 8 }}>
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
      <p style={{ margin: '8px 0 4px', fontWeight: 600, lineHeight: 1.6 }}>{payload.summary}</p>
      {payload.keyActions && (
        <div style={{ marginBottom: 4 }}>
          <Text strong style={{ fontSize: 12 }}>建议动作</Text>
          <div style={{ fontSize: 12, lineHeight: 1.6 }}>{payload.keyActions}</div>
        </div>
      )}
      {payload.doNot && (
        <div style={{ marginBottom: 4 }}>
          <Text strong style={{ fontSize: 12 }}>禁忌提醒</Text>
          <div style={{ fontSize: 12, lineHeight: 1.6 }}>{payload.doNot}</div>
        </div>
      )}
      {payload.supportAndReporting && (
        <div style={{ marginBottom: 4 }}>
          <Text strong style={{ fontSize: 12 }}>协同上报</Text>
          <div style={{ fontSize: 12, lineHeight: 1.6 }}>{payload.supportAndReporting}</div>
        </div>
      )}
      {payload.liveDataNeeded.length > 0 && (
        <div style={{ margin: '6px 0' }}>
          <Text type="secondary" style={{ fontSize: 12 }}>需结合现场实时数据：</Text>
          {payload.liveDataNeeded.map((d) => (
            <Tag key={d} style={{ marginInlineEnd: 4, fontSize: 11 }}>{d}</Tag>
          ))}
        </div>
      )}
      <div style={{ margin: '6px 0', fontSize: 12 }}>
        <Text type="secondary">置信度 {Math.round(payload.confidence * 100)}% · {qaStatusLabel(payload.answerStatus)}</Text>
      </div>
      <div style={{ borderTop: '1px dashed #d9dfe8', paddingTop: 6, marginTop: 6 }}>
        <Text strong style={{ fontSize: 12 }}>来源（模拟应用文档）</Text>
        {payload.sources.map((s) => (
          <div key={`${s.docId}-${s.section}`} className="axn-qa-source" style={{ margin: '6px 0', fontSize: 12, lineHeight: 1.6 }}>
            <div>
              <Tag color="blue" style={{ fontSize: 11, marginInlineEnd: 4 }}>模拟</Tag>
              <Text strong>《{s.title}》</Text>
              <Text type="secondary"> {s.section}</Text>
            </div>
            <div style={{ color: '#666' }}>“{s.excerpt}”</div>
          </div>
        ))}
        <Text type="secondary" style={{ fontSize: 11 }}>
          模拟数据，非正式技术规范；现场处置以现场指挥体系、现行法规标准与专业技术人员判断为准。
        </Text>
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
          已生成（版本 {payload.version}，模拟 · 待人工审核）
        </span>
      </div>
      {proposal?.sections.map(section => <div className="axn-resource-result" key={section.id}><Text strong>{section.title}</Text><Text>{section.text}</Text></div>)}
      <Button size="small" type="primary" ghost onClick={() => onOpenDrawer('knowledge')} style={{ marginTop: 8 }}>
        查看建议与知识
      </Button>
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
          style={{ marginTop: 8 }}
          title={`缺少必填字段：${payload.missingFields.join('、')}`}
          description="请在对话中按提示补录（补录内容确认后生成模拟来源记录）。"
        />
      )}
      {payload.state === 'draft_created' && draft && (
        <Button size="small" type="primary" ghost onClick={openDraft} style={{ marginTop: 8 }} data-testid="task-open-draft">
          预览/打开真实草稿
        </Button>
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
        <Alert type="info" showIcon message="需要补充信息" description={payload.prompt} style={{ marginTop: 8 }} />
      );
    case 'error': {
      const err: ErrorArtifact = payload;
      return (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 8 }}
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
  const meta = STATUS_META[task.status] ?? { label: task.status, color: 'default' };
  const isRunning = task.status === 'running' || task.status === 'queued';

  return (
    <div className={`axn-task-card axn-task-card--${task.status}`}>
      <div className="axn-task-head">
        <Space size={6} wrap>
          <Text strong style={{ fontSize: 13 }}>
            {task.displayTitle}
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
              <Button size="small" icon={<PauseCircleOutlined />} disabled>
                等待输入
              </Button>
            </Tooltip>
          )}
        </Space>
      </div>

      {task.steps.length > 0 && (
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

      {task.textAnswer && (
        <div className="axn-task-answer">
          <Text style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{task.textAnswer}</Text>
        </div>
      )}

      {task.artifacts.map((artifact) => (
        <ArtifactBlock key={artifact.artifactId} payload={artifact.payload} onOpenDrawer={onOpenDrawer} sessionId={task.sessionId} />
      ))}

      {task.error && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 8 }}
          title={`${task.error.message}（${task.error.errorCode}）`}
          description={
            <Space direction="vertical" size={4}>
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
