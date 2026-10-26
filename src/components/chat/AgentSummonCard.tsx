import { tenderName } from '@/seed/tenderNames';
/**
 * 智能体消息：与知识问答等普通 AI 回答同一套版式 ——
 * 左侧 28px 头像列（智能体专属图标）+ 右侧内容列（身份行 → 当前动作 → 选项 → 任务卡）。
 * 不再套外框：一条消息就是一列内容，层级由字重 / 间距表达，而不是框中套框。
 * 状态只出现一次：有任务卡时由任务行（标题 + 状态）承载，身份行不再重复挂状态。
 */
import type { ReactNode } from 'react';
import type { TaskStatus } from '@/domain/types';
import { agentIcon } from './agentIcons';

const LABELS: Record<TaskStatus, string> = {
  queued: '正在调用', running: '执行中', succeeded: '已完成', partial: '部分完成',
  waiting_input: '待补充信息', failed: '执行失败', cancelled: '已取消',
};
const TONE: Partial<Record<TaskStatus, string>> = {
  queued: 'busy', running: 'busy', succeeded: 'ok', partial: 'warn', waiting_input: 'warn', failed: 'err',
};

function actionText(status: TaskStatus, action: string): string {
  switch (status) {
    case 'running':
    case 'queued': return action;
    case 'succeeded': return '任务已完成，执行过程与结果如下';
    case 'waiting_input': return '请补充所需信息后继续';
    case 'cancelled': return '任务已停止，已完成的步骤保留如下';
    case 'failed': return '执行遇到问题，可查看原因并重试';
    default: return '已完成部分任务，详情如下';
  }
}

export default function AgentSummonCard({ agentId, agentName, agentRole, action, status = 'running', children, bodyExtra }: {
  agentId?: string; agentName: string; agentRole: string; action: string; status?: TaskStatus; children?: ReactNode;
  /** 接在动作说明之后的内容，如文书生成的文书类型选项。 */
  bodyExtra?: ReactNode;
}) {
  // 自我介绍 + 选项（bodyExtra）时是在等用户选，不是「正在调用」：不转圈、不挂状态
  const awaitingChoice = bodyExtra != null && bodyExtra !== false && status === 'queued';
  const active = !awaitingChoice && (status === 'running' || status === 'queued');
  const Icon = agentIcon(agentId);
  const hasTask = children != null && children !== false;
  const text = awaitingChoice ? action : actionText(status, action);
  // 完成态的「任务已完成…」是给读屏的状态播报；视觉上任务行已有「已完成」，不再重复一句
  const quietAction = status === 'succeeded' && hasTask;
  return <section className={`axn-agent-execution${active ? ' is-running' : ''}`} data-testid="agent-summon-card" data-agent-id={agentId} aria-live="polite">
    <span className="axn-agent-summon-avatar" aria-hidden><Icon size={16} /></span>
    <div className="axn-agent-summon-body">
      <div className="axn-agent-summon-head">
        <span className="axn-agent-summon-name">{tenderName(agentName)}</span>
        {agentRole && <span className="axn-agent-summon-role">{agentRole}</span>}
        {!hasTask && !awaitingChoice && <span className={`axn-status axn-status--${TONE[status] ?? 'idle'}`}><i aria-hidden />{LABELS[status]}</span>}
      </div>
      <div className={`axn-agent-summon-action${quietAction ? ' axn-sr-only' : ''}`}>{text}</div>
      {bodyExtra}
      {children}
    </div>
  </section>;
}
