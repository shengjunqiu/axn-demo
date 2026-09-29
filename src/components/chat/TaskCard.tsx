/**
 * 任务执行卡（T-006）：渲染 assistant 任务消息的执行步骤、产物摘要、流式文本与操作。
 * 数据全部来自 sessionStore.tasks（zustand 订阅），本组件不复制任务状态。
 * 所有数值/文本均取自种子事实或任务产物，界面为模拟数据演示。
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
  ResourceResultArtifact,
  StepStatus,
  SummaryArtifact,
  TaskArtifactPayload,
  TaskStatus,
} from '@/domain/types';
import { cancelTask, retryTask } from '@/services/taskRunner';
import { factText, getFact, knowledgeById, teamById } from '@/seed/scenario';

const { Text } = Typography;

export interface TaskCardProps {
  task: AgentTask;
  onOpenDrawer: (target: 'resource' | 'knowledge') => void;
}

const STATUS_META: Record<TaskStatus, { label: string; color: string }> = {
  queued: { label: '排队中', color: 'default' },
  running: { label: '执行中', color: 'processing' },
  succeeded: { label: '已完成', color: 'success' },
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
            {row.emphasize === 'pending' && (
              <Tag color="orange" style={{ marginLeft: 6 }}>
                待确认
              </Tag>
            )}
          </span>
        </div>
      ))}
      {payload.pendingKeys.length > 0 && (
        <Alert
          type="warning"
          showIcon
          style={{ marginTop: 8 }}
          message={`待确认字段：${payload.pendingKeys.join('、')}`}
          description="以上字段暂无可靠来源，需人工补录后才会进入正式产物（模拟）。"
        />
      )}
      {payload.sourceUnavailable && (
        <Alert type="info" showIcon style={{ marginTop: 8 }} message={payload.sourceUnavailable} />
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

function ProposalBlock({ payload, onOpenDrawer }: { payload: ProposalArtifact; onOpenDrawer: TaskCardProps['onOpenDrawer'] }) {
  return (
    <div className="axn-artifact">
      <div className="axn-artifact-row">
        <span className="axn-artifact-label">处置建议</span>
        <span className="axn-artifact-value">
          已生成（版本 {payload.version}，模拟 · 待人工审核）
        </span>
      </div>
      <Button size="small" type="primary" ghost onClick={() => onOpenDrawer('knowledge')} style={{ marginTop: 8 }}>
        查看建议
      </Button>
    </div>
  );
}

function DocumentBlock({ payload }: { payload: DocumentLinkArtifact }) {
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
          message={`缺少必填字段：${payload.missingFields.join('、')}`}
          description="请在对话中按提示补录（补录内容确认后生成模拟来源记录）。"
        />
      )}
    </div>
  );
}

function ArtifactBlock({ payload, onOpenDrawer }: { payload: TaskArtifactPayload; onOpenDrawer: TaskCardProps['onOpenDrawer'] }) {
  switch (payload.kind) {
    case 'summary':
      return <SummaryBlock payload={payload} />;
    case 'resources':
      return <ResourceBlock payload={payload} onOpenDrawer={onOpenDrawer} />;
    case 'knowledge':
      return <KnowledgeBlock payload={payload} onOpenDrawer={onOpenDrawer} />;
    case 'proposal':
      return <ProposalBlock payload={payload} onOpenDrawer={onOpenDrawer} />;
    case 'document':
      return <DocumentBlock payload={payload} />;
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
          message={`${err.message}（${err.errorCode}）`}
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
    <div className="axn-task-card">
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
        <ArtifactBlock key={artifact.artifactId} payload={artifact.payload} onOpenDrawer={onOpenDrawer} />
      ))}

      {task.error && (
        <Alert
          type="error"
          showIcon
          style={{ marginTop: 8 }}
          message={`${task.error.message}（${task.error.errorCode}）`}
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
