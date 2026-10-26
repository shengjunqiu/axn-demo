/**
 * 规范页 / 气泡用例页共用的「对话样式标本」。
 * 只复刻真实对话（TaskCard / AgentSummonCard / DocumentGenerationCard）的 DOM 结构与 class，
 * 样式全部来自 chat.css —— 对话改版时这里跟着看起来一样；结构变了需要同步改这里。
 */
import { useState, type ReactNode } from 'react';
import { ChevronRight, CircleCheck, CircleX, Clock, FileText, LoaderCircle, Users, Warehouse } from 'lucide-react';
import { Button } from 'antd';
import BrandMark from '@/components/brand/BrandMark';
import '@/components/chat/chat.css';
import '@/components/settings/chat-main-reference.css';
import '@/components/settings/chat-specimens.css';

export type Tone = 'busy' | 'ok' | 'warn' | 'err' | 'idle';

export function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return <span className={`axn-status axn-status--${tone}`}><i aria-hidden />{children}</span>;
}

export function InlineFlag({ tone, children }: { tone: 'info' | 'warn'; children: ReactNode }) {
  return <span className={`axn-inline-flag is-${tone}`}>{children}</span>;
}

/** 智能体消息：28px 图标列 + 内容列（身份行 → 正文） */
export function AgentMessage({ icon, name, role, status, children }: {
  icon: ReactNode; name: string; role?: string; status?: { tone: Tone; label: string }; children?: ReactNode;
}) {
  return (
    <section className={`axn-agent-execution${status?.tone === 'busy' ? ' is-running' : ''}`}>
      <span className="axn-agent-summon-avatar" aria-hidden>{icon}</span>
      <div className="axn-agent-summon-body">
        <div className="axn-agent-summon-head">
          <span className="axn-agent-summon-name">{name}</span>
          {role && <span className="axn-agent-summon-role">{role}</span>}
          {status && <StatusPill tone={status.tone}>{status.label}</StatusPill>}
        </div>
        {children}
      </div>
    </section>
  );
}

/** 安小能自己的回答：品牌头像列 + 平铺正文 */
export function AssistantMessage({ children }: { children: ReactNode }) {
  return (
    <section className="axn-agent-execution">
      <span className="axn-spec-brand" aria-hidden><BrandMark size={28} /></span>
      <div className="axn-agent-summon-body">{children}</div>
    </section>
  );
}

export function UserMessage({ children }: { children: ReactNode }) {
  return <div className="axn-spec-user"><div>{children}</div></div>;
}

export type SpecStep = { name: string; status: 'completed' | 'running' | 'failed' | 'pending'; output?: string; time?: string };

function StepIcon({ status }: { status: SpecStep['status'] }) {
  if (status === 'completed') return <CircleCheck className="axn-tc-green" />;
  if (status === 'running') return <LoaderCircle className="axn-tc-blue axn-spin" />;
  if (status === 'failed') return <CircleX className="axn-tc-red" />;
  return <Clock className="axn-tc-muted" />;
}

/** 任务运行条：任务名 · 步数 · 耗时 | 状态；点开是执行过程 */
export function RunBar({ title, steps, status, meta, defaultOpen = false, side }: {
  title: string; steps: SpecStep[]; status: { tone: Tone; label: string }; meta?: string; defaultOpen?: boolean; side?: ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const done = steps.filter(s => s.status === 'completed').length;
  const running = status.tone === 'busy';
  return (
    <div className={`axn-task-run${open ? ' is-open' : ''}${running ? ' is-running' : ''}`}>
      <div className="axn-task-head">
        <button type="button" className="axn-task-process-toggle" aria-expanded={open} onClick={() => setOpen(v => !v)}>
          <ChevronRight size={14} aria-hidden className="axn-task-process-caret" />
          <span className="axn-task-title" title={title}>{title}</span>
          <span className="axn-task-process-meta">{running ? '正在执行 · ' : ''}{done}/{steps.length} 步{meta ? ` · ${meta}` : ''}</span>
        </button>
        <div className="axn-task-head-side">
          <StatusPill tone={status.tone}>{status.label}</StatusPill>
          {side}
        </div>
      </div>
      {open && (
        <ul className="axn-task-steps">
          {steps.map(step => (
            <li key={step.name} className={`axn-task-step axn-step-${step.status}`}>
              <StepIcon status={step.status} />
              <span className="axn-step-name">{step.name}</span>
              {step.output && <span className="axn-step-output">{step.output}</span>}
              {step.time && <span className="axn-step-time">{step.time}</span>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/** 字段摘要：细线键值表 + 可选脚注 / 操作栏 */
export function KvTable({ rows, foot, actions }: {
  rows: { label: ReactNode; value: ReactNode }[]; foot?: ReactNode; actions?: ReactNode;
}) {
  return (
    <div className="axn-artifact">
      {rows.map((row, index) => (
        <div key={typeof row.label === 'string' ? row.label : index} className="axn-artifact-row">
          <span className="axn-artifact-label">{row.label}</span>
          <span className="axn-artifact-value">{row.value}</span>
        </div>
      ))}
      {foot && <div className="axn-artifact-foot">{foot}</div>}
      {actions && <div className="axn-artifact-actions">{actions}</div>}
    </div>
  );
}

/** 产物 / 附件条：图标 · 名称（+ 说明）· 右侧操作 */
export function FileRow({ name, sub, action, icon = <FileText size={16} /> }: {
  name: ReactNode; sub?: ReactNode; action?: ReactNode; icon?: ReactNode;
}) {
  return (
    <div className="axn-document-collect-done axn-spec-file">
      <span className="axn-doc-done-icon" aria-hidden>{icon}</span>
      <span className="axn-spec-file-copy">
        <span className="axn-doc-done-text">{name}</span>
        {sub && <span className="axn-spec-file-sub">{sub}</span>}
      </span>
      {action ?? <span />}
    </div>
  );
}

/** 依据来源：编号卡片，与正文 [1][2] 角标对应 */
export function SourceList({ sources, onOpen }: {
  sources: { title: string; section: string; excerpt: string }[]; onOpen?: (index: number) => void;
}) {
  return (
    <div className="axn-qa-sources">
      <div className="axn-qa-sources-title">依据来源 · {sources.length}</div>
      <ol>
        {sources.map((s, i) => (
          <li key={s.title + s.section} className={`axn-qa-source${onOpen ? ' axn-spec-clickable' : ''}`} onClick={onOpen ? () => onOpen(i) : undefined}>
            <span className="axn-cite" aria-hidden>{i + 1}</span>
            <div className="axn-qa-source-body">
              <div className="axn-qa-source-title">《{s.title}》<span>{s.section}</span></div>
              <div className="axn-qa-source-quote">{s.excerpt}</div>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function Cite({ n }: { n: number }) {
  return <sup className="axn-cite">{n}</sup>;
}

/** 资源清单：图标 · 名称 + 类型 · 参数，右侧到达时间 / 距离（替代通用表格） */
export function ResourceList({ summary, items, foot, actions }: {
  summary: { label: string; value: ReactNode };
  items: { name: string; kind: 'team' | 'store'; meta: string; eta?: string; dist?: string; flag?: ReactNode }[];
  foot?: ReactNode; actions?: ReactNode;
}) {
  return (
    <div className="axn-artifact">
    <div className="axn-artifact-row"><span className="axn-artifact-label">{summary.label}</span><span className="axn-artifact-value">{summary.value}</span></div>
    <div className="axn-resource-results">
      {items.map(it => {
        const Icon = it.kind === 'team' ? Users : Warehouse;
        return (
          <div key={it.name} className="axn-resource-result">
            <span className={`axn-resource-icon${it.kind === 'store' ? ' is-store' : ''}`} aria-hidden><Icon size={15} /></span>
            <div className="axn-resource-main">
              <div className="axn-resource-name">{it.name}<span className="axn-resource-kind">{it.kind === 'team' ? '救援队伍' : '物资仓库'}</span>{it.flag}</div>
              <div className="axn-resource-meta">{it.meta}</div>
            </div>
            {it.eta && <div className="axn-resource-eta"><strong>{it.eta}</strong><span>{it.dist}</span></div>}
          </div>
        );
      })}
    </div>
    {foot && <div className="axn-artifact-foot">{foot}</div>}
    {actions && <div className="axn-artifact-actions">{actions}</div>}
    </div>
  );
}

/** 编号步骤：处置建议 / 方案类内容 */
export function NumberedSteps({ summary, items, actions }: {
  summary: { label: string; value: ReactNode }; items: { title: string; text: string }[]; actions?: ReactNode;
}) {
  return (
    <div className="axn-artifact">
      <div className="axn-artifact-row"><span className="axn-artifact-label">{summary.label}</span><span className="axn-artifact-value">{summary.value}</span></div>
      <ol className="axn-proposal-steps">
        {items.map(it => <li key={it.title}><strong>{it.title}</strong><p>{it.text}</p></li>)}
      </ol>
      {actions && <div className="axn-artifact-actions">{actions}</div>}
    </div>
  );
}

/** 回答正文容器：与知识问答同一套字号 / 行高 / 段距 */
export function Prose({ children }: { children: ReactNode }) {
  return <div className="axn-qa">{children}</div>;
}

/** 分节正文：小标题 + 段落，禁忌类用警示色 */
export function Section({ title, warn, children }: { title: ReactNode; warn?: boolean; children: ReactNode }) {
  return (
    <section className={`axn-qa-section${warn ? ' is-warn' : ''}`}>
      <h4>{title}</h4>
      <div className="axn-section-body">{children}</div>
    </section>
  );
}

export function Confidence({ level, value }: { level: 'high' | 'mid' | 'low'; value: number }) {
  const text = { high: '高', mid: '中', low: '低' }[level];
  return <span className={`axn-confidence axn-confidence--${level}`}>置信度 {text} · {value}%</span>;
}

/** 轻提示：一行图标 + 文字（替代整块 Alert） */
export function Notice({ tone, title, children }: { tone: 'info' | 'ok' | 'warn' | 'err'; title: ReactNode; children?: ReactNode }) {
  return (
    <div className={`axn-spec-notice is-${tone}`} role={tone === 'err' ? 'alert' : 'status'}>
      <i aria-hidden />
      <div><strong>{title}</strong>{children && <div className="axn-section-body">{children}</div>}</div>
    </div>
  );
}

export function ChoiceChips({ options, value, onChange }: { options: string[]; value?: string; onChange?: (v: string) => void }) {
  return (
    <div className="axn-doc-choices">
      <div className="axn-doc-choice-row">
        {options.map(o => (
          <Button key={o} size="small" className={`axn-doc-choice${value === o ? ' is-selected' : ''}`} aria-pressed={value === o} onClick={() => onChange?.(o)}>{o}</Button>
        ))}
      </div>
    </div>
  );
}
