import { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from 'antd';
import { Search, Sparkles, User, Wrench, X } from 'lucide-react';
import type { AgentTask, ChatMessage, Session, StepStatus, TaskArtifactPayload, TaskStatus } from '@/domain/types';
import { callArgs, toolNameFor } from './toolNames';
import './trajectory.css';

/**
 * 执行日志（对着 dsh 的 Trajectory 视图做的）：一轮对话里的编排过程，一行一条。
 *
 * 行只有三类 —— 用户 / 助手 / 工具：
 * - 用户 / 助手：人说的话和助手的发言（只有调用没正文时显示「（仅工具调用）」）
 * - 工具：真实执行日志的样子 —— 等宽字体的 `工具名` + 灰色入参 + `→` + 英文返回记录，
 *   右侧补状态（失败行整行转红）
 * 点任意一行，右侧拉出详情：工具给「状态 / 参数 / 结果 / 开始时间 / 时长」，
 * 助手给「状态 / 开始时间 / 总时长 / 首 token 延迟 / 生成 / 吞吐量」+ 正文。
 * 数据全部来自 sessionStore，不另存一份：顺序取 session.messages，步骤取 tasks[taskId]。
 */

type RowKind = 'user' | 'assistant' | 'tool';

interface DetailItem {
  label: string;
  value: string;
  /** 长内容（入参 JSON、正文）单独占一整块，不挤在右半边。 */
  block?: boolean;
  /** 等宽字体：JSON、错误码。 */
  mono?: boolean;
}

interface Row {
  key: string;
  kind: RowKind;
  /** 详情面板标题：工具名（用户 / 助手不必再写一遍，标签已经写了）。 */
  title?: string;
  /** 用户 / 助手的正文。 */
  text?: string;
  /** 工具名（英文）。 */
  name?: string;
  /** 入参（JSON 字符串）。 */
  payload?: string;
  /** 返回记录（英文一行）。 */
  result?: string;
  /** 右侧附注：状态。 */
  meta?: string;
  /** 右侧附注：耗时（工具 620ms / 助手 3.85s）。 */
  duration?: string;
  tone: 'run' | 'ok' | 'err' | 'idle';
  detail: DetailItem[];
}

/** kind 标签：中文 + 小图标（标签走中文，标签后的执行记录才走英文）。 */
const KIND_META: Record<RowKind, { label: string; icon: typeof User }> = {
  user: { label: '用户', icon: User },
  assistant: { label: '助手', icon: Sparkles },
  tool: { label: '工具', icon: Wrench },
};

const STEP_TONE: Record<StepStatus, Row['tone']> = {
  pending: 'idle',
  running: 'run',
  completed: 'ok',
  failed: 'err',
  cancelled: 'idle',
};

const STEP_LABEL: Record<StepStatus, string> = {
  pending: '待执行',
  running: '执行中',
  completed: '已完成',
  failed: '失败',
  cancelled: '已取消',
};

/** 只有调用、没有正文的助手消息，按日志惯例标出来。 */
const TOOL_CALL_ONLY = '（仅工具调用）';

/** 执行记录统一英文一行（标签仍中文），和人家的执行日志对齐。 */
function artifactText(payload: TaskArtifactPayload): string {
  switch (payload.kind) {
    case 'summary':
      return `${payload.rows.length} rows`;
    case 'resources':
      return 'resource list';
    case 'knowledge':
      return 'knowledge hits';
    case 'qa_knowledge':
      return 'qa hits';
    case 'proposal':
      return `proposal ${payload.version}`;
    case 'document':
      return `draft "${payload.title}"`;
    case 'clarification':
      return 'needs input';
    case 'error':
      return `error ${payload.errorCode}`;
  }
}

/** 右侧附注只写状态（已完成 / 执行中 / 失败 …），不写智能体名。 */
function taskStatusLabel(status: TaskStatus): string {
  switch (status) {
    // 有步骤失败但结论已给出：对外仍算已完成，失败的是那一步（步骤行自己标红）。
    case 'succeeded':
    case 'partial':
      return STEP_LABEL.completed;
    case 'waiting_input': return '待补充信息';
    case 'running': return STEP_LABEL.running;
    case 'queued': return STEP_LABEL.pending;
    case 'failed': return STEP_LABEL.failed;
    default: return STEP_LABEL.cancelled;
  }
}

const pad2 = (n: number) => String(n).padStart(2, '0');
const pad3 = (n: number) => String(n).padStart(3, '0');

/** 详情里的时间精确到毫秒（2026-11-07 00:16:37.476）。 */
function clockMs(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}:${pad2(d.getSeconds())}.${pad3(d.getMilliseconds())}`;
}

/** 列表行只有一行：把多行入参/输出压成单行，完整内容在详情里。 */
const oneLine = (text: string) => text.replace(/\s+/g, ' ').trim();

const seconds = (ms: number) => `${(ms / 1000).toFixed(2)} 秒`;
const millis = (ms: number) => `${Math.round(ms)} 毫秒`;

/** 千分位：token 用量读起来更有量级感（12,480）。 */
const count = (n: number) => n.toLocaleString('en-US');

/**
 * 助手这一步的生成时序与 token 用量（原型演示口径，不做业务断言依据）：
 * 输出 token 按答案字数折算（中文约 1.6 字/token），输入 token 由步骤数与任务序号稳定取值，
 * 吞吐量与首 token 延迟同样稳定取值，生成耗时与总时长由这两个反推；
 * 开始时间从任务收尾倒推，落在任务末尾。
 */
function answerTiming(task: AgentTask): { items: DetailItem[]; totalMs: number } {
  const outputTokens = Math.max(Math.round((task.textAnswer ?? '').length / 1.6), 1);
  // 输入侧 = 系统提示 + 历史轮次 + 每一步的工具返回，随步骤数增长。
  const inputTokens = 640 + (task.seq % 5) * 90 + task.steps.length * 120;
  const tps = 38 + (task.seq % 5) * 4;
  const genMs = Math.round((outputTokens / tps) * 1000);
  const firstTokenMs = 420 + (task.seq % 7) * 55;
  const totalMs = firstTokenMs + genMs;
  const endMs = task.finishedAt ? Date.parse(task.finishedAt) : Date.parse(task.startedAt) + (task.demoElapsedMs ?? 0);
  return {
    totalMs,
    items: [
      { label: '开始时间', value: clockMs(new Date(endMs - totalMs).toISOString()) },
      { label: '总时长', value: seconds(totalMs) },
      { label: '首 token 延迟', value: millis(firstTokenMs) },
      { label: '生成', value: seconds(genMs) },
      { label: '吞吐量', value: `${(outputTokens / (genMs / 1000)).toFixed(1)} tok/s` },
      { label: 'token', value: `${count(inputTokens + outputTokens)} tok` },
    ],
  };
}

function stepRows(task: AgentTask): Row[] {
  const rows: Row[] = [];
  // 步骤本身只存耗时，开始时间按任务起点 + 前面各步耗时累加推出来。
  let cursor = Date.parse(task.startedAt);

  task.steps.forEach((step) => {
    const name = step.tool ?? toolNameFor(step.name);
    const payload = callArgs(step.args);
    const result = step.errorCode ?? step.returns ?? 'ok';
    const startedAt = new Date(cursor).toISOString();
    if (Number.isFinite(cursor)) cursor += step.elapsedMs ?? 0;
    rows.push({
      key: `${task.taskId}-step-${step.stepId}`,
      kind: 'tool',
      title: name,
      name,
      payload: oneLine(payload),
      result: oneLine(result),
      meta: STEP_LABEL[step.status],
      duration: step.elapsedMs != null ? `${step.elapsedMs}ms` : undefined,
      tone: STEP_TONE[step.status],
      detail: [
        { label: '状态', value: STEP_LABEL[step.status] },
        { label: '参数', value: payload, block: true, mono: true },
        {
          label: '结果',
          value: step.errorCode ?? step.returns ?? step.outputSummary ?? result,
          block: true,
          mono: !!step.errorCode,
        },
        { label: '开始时间', value: clockMs(startedAt) },
        { label: '时长', value: step.elapsedMs != null ? `${step.elapsedMs} ms` : '—' },
      ],
    });
  });

  for (const artifact of task.artifacts) {
    rows.push({
      key: artifact.artifactId,
      kind: 'tool',
      title: 'emit_artifact',
      name: 'emit_artifact',
      payload: `{"kind":"${artifact.payload.kind}"}`,
      result: artifactText(artifact.payload),
      tone: artifact.payload.kind === 'error' ? 'err' : 'ok',
      detail: [
        { label: '状态', value: artifact.payload.kind === 'error' ? '失败' : '已完成' },
        { label: '参数', value: `{"kind":"${artifact.payload.kind}"}`, block: true, mono: true },
        { label: '结果', value: JSON.stringify(artifact.payload, null, 2), block: true, mono: true },
        { label: '开始时间', value: clockMs(task.finishedAt ?? task.startedAt) },
        { label: '时长', value: '—' },
      ],
    });
  }

  const answer = task.textAnswer ?? '';
  const timing = answerTiming(task);
  rows.push({
    key: `${task.taskId}-answer`,
    kind: 'assistant',
    text: answer || TOOL_CALL_ONLY,
    meta: taskStatusLabel(task.status),
    duration: `${(timing.totalMs / 1000).toFixed(2)}s`,
    tone: task.status === 'failed' ? 'err' : task.status === 'running' ? 'run' : 'ok',
    detail: [
      { label: '状态', value: taskStatusLabel(task.status) },
      ...timing.items,
      { label: '任务', value: task.displayTitle },
      ...(answer ? [{ label: '正文', value: answer, block: true }] : []),
    ],
  });
  return rows;
}

function messageRows(message: ChatMessage, tasks: Record<string, AgentTask>): Row[] {
  const base = { key: message.messageId };
  if (message.role === 'user') {
    const files = message.attachments?.length ? ` [+${message.attachments.length} 个附件]` : '';
    const text = `${message.text ?? ''}${files}`;
    return [{
      ...base,
      kind: 'user',
      text,
      tone: 'idle',
      detail: [
        { label: '状态', value: '已发送' },
        { label: '时间', value: clockMs(message.performedAt ?? message.createdAt) },
        { label: '正文', value: text, block: true },
      ],
    }];
  }
  if (message.kind === 'agent') {
    const task = message.taskId ? tasks[message.taskId] : undefined;
    const text = message.text || TOOL_CALL_ONLY;
    return [{
      ...base,
      kind: 'assistant',
      text,
      meta: task ? taskStatusLabel(task.status) : undefined,
      tone: task?.status === 'failed' ? 'err' : task?.status === 'running' ? 'run' : 'ok',
      detail: [
        { label: '状态', value: task ? taskStatusLabel(task.status) : STEP_LABEL.completed },
        { label: '时间', value: clockMs(message.performedAt ?? message.createdAt) },
        ...(message.text ? [{ label: '正文', value: message.text, block: true }] : []),
      ],
    }];
  }
  if (message.kind === 'task' && message.taskId) {
    const task = tasks[message.taskId];
    return task
      ? stepRows(task)
      : [{ ...base, kind: 'assistant', text: '任务数据缺失', tone: 'err', detail: [] }];
  }
  // 系统提示与普通回复都算助手的发言。
  const text = message.text || TOOL_CALL_ONLY;
  return [{
    ...base,
    kind: 'assistant',
    text,
    meta: STEP_LABEL.completed,
    tone: 'ok',
    detail: [
      { label: '状态', value: STEP_LABEL.completed },
      { label: '时间', value: clockMs(message.performedAt ?? message.createdAt) },
      ...(message.text ? [{ label: '正文', value: message.text, block: true }] : []),
    ],
  }];
}

function buildTrajectoryRows(session: Session | undefined, tasks: Record<string, AgentTask>): Row[] {
  if (!session) return [];
  // 被召唤智能体的任务卡在消息流里合并成了一条消息，执行日志里同样只展开一次。
  const expanded = new Set<string>();
  const rows: Row[] = [];
  for (const message of session.messages) {
    if (message.taskId && message.kind === 'agent') expanded.add(message.taskId);
    if (message.kind === 'task' && message.taskId && expanded.has(message.taskId)) continue;
    rows.push(...messageRows(message, tasks));
  }
  return rows;
}

function DetailPanel({ row, onClose }: { row: Row; onClose: () => void }) {
  const { label, icon: Icon } = KIND_META[row.kind];
  return (
    <aside className="axn-traj-detail" aria-label="记录详情">
      <div className="axn-traj-detail-head">
        <span className={`axn-traj-tag axn-traj-tag--${row.kind}`}>
          <Icon size={11} aria-hidden="true" />
          <span className="axn-traj-tag-label">{label}</span>
        </span>
        {row.title && <span className="axn-traj-detail-title">{row.title}</span>}
        <button type="button" className="axn-traj-detail-close" aria-label="关闭详情" onClick={onClose}>
          <X size={14} />
        </button>
      </div>
      <div className="axn-traj-detail-body">
        {row.detail.map((item) => (item.block ? (
          <section key={item.label} className="axn-traj-block">
            <h4>{item.label}</h4>
            <pre className={item.mono ? 'axn-traj-code' : 'axn-traj-prose'}>{item.value}</pre>
          </section>
        ) : (
          <div key={item.label} className="axn-traj-fact">
            <span className="axn-traj-fact-label">{item.label}</span>
            <span className={item.mono ? 'axn-traj-fact-value axn-traj-fact-mono' : 'axn-traj-fact-value'}>{item.value}</span>
          </div>
        )))}
      </div>
    </aside>
  );
}

export default function TrajectoryPanel({ session, tasks }: { session: Session | undefined; tasks: Record<string, AgentTask> }) {
  const [query, setQuery] = useState('');
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const rows = useMemo(() => buildTrajectoryRows(session, tasks), [session, tasks]);

  const q = query.trim();
  const visible = q
    ? rows.filter((row) => `${KIND_META[row.kind].label} ${row.name ?? ''} ${row.payload ?? ''} ${row.text ?? ''}`.includes(q))
    : rows;
  const selected = selectedKey ? rows.find((row) => row.key === selectedKey) ?? null : null;

  // 打开执行日志页签时直接看最新一段：和对话页签一样落在底部。
  useEffect(() => {
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [session?.sessionId]);

  // 换会话时详情跟着清掉，免得停在别的会话的记录上。
  useEffect(() => setSelectedKey(null), [session?.sessionId]);

  return (
    <div
      className="axn-traj"
      data-testid="trajectory-panel"
      onKeyDown={(e) => { if (e.key === 'Escape') setSelectedKey(null); }}
    >
      <div className="axn-traj-bar">
        <Input
          size="small"
          allowClear
          className="axn-traj-search"
          prefix={<Search size={13} />}
          placeholder="过滤日志"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      <div className="axn-traj-body">
        <div className="axn-traj-list" ref={listRef}>
          {visible.length === 0 ? (
            <p className="axn-traj-empty">{q ? `没有匹配「${q}」的日志` : '本会话还没有执行日志'}</p>
          ) : (
            visible.map((row) => {
              const { label, icon: Icon } = KIND_META[row.kind];
              const isSelected = row.key === selectedKey;
              return (
                <button
                  type="button"
                  key={row.key}
                  className={`axn-traj-row axn-traj-row--${row.kind}`}
                  data-tone={row.tone}
                  data-selected={isSelected ? 'true' : 'false'}
                  aria-pressed={isSelected}
                  onClick={() => setSelectedKey(isSelected ? null : row.key)}
                >
                  <span className="axn-traj-tag">
                    <Icon size={11} aria-hidden="true" />
                    <span className="axn-traj-tag-label">{label}</span>
                  </span>
                  {row.kind === 'tool' ? (
                    <span className="axn-traj-call" title={`${row.name} ${row.payload}${row.result ? ` → ${row.result}` : ''}`}>
                      <code className="axn-traj-tool">{row.name}</code>
                      <code className="axn-traj-payload">{row.payload}</code>
                      {row.result && <span className="axn-traj-arrow">→</span>}
                      {row.result && <code className="axn-traj-result">{row.result}</code>}
                    </span>
                  ) : (
                    <span className="axn-traj-text" title={row.text}>
                      {row.text === TOOL_CALL_ONLY ? <span className="axn-traj-only">{row.text}</span> : row.text}
                    </span>
                  )}
                  {(row.duration || row.meta) && (
                    <span className="axn-traj-side">
                      {row.duration && <span className="axn-traj-dur">{row.duration}</span>}
                      {row.meta && <span className="axn-traj-meta">{row.meta}</span>}
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>
        {selected && <DetailPanel row={selected} onClose={() => setSelectedKey(null)} />}
      </div>
    </div>
  );
}
