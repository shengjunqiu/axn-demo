import { useState } from 'react';
import { Button, Space } from 'antd';
import type { ChatMessage } from '@/domain/types';
import { ChoiceChips, KvTable, Notice, Section, StatusPill } from '@/components/common/ChatPrimitives';
import { openRescuePlan } from '@/services/rescuePlanAlternatives';
import StructuredReply from './StructuredReply';

/** 比较方向先于生成文书；保留每个候选的原始内容，不模拟批准或调派。 */
export default function RescuePlanChoices({ message }: { message: ChatMessage }) {
  const plans = message.rescuePlans ?? [];
  const [selected, setSelected] = useState(0);
  const plan = plans[selected];
  const labels = plans.map(p => p.title.split(' · ').at(-1) ?? p.title);
  if (!plan) return null;
  const direction = plan.sections.find(([heading]) => heading === '六、方案战法与实施安排')?.[1]
    ?? plan.sections.find(([heading]) => heading === '四、救援行动安排')?.[1].split('所选方向与实施安排\n').at(-1);
  const details = direction ?? '';
  const fields = details.split('\n').map(line => {
    const colon = line.indexOf('：');
    return colon >= 0 ? { label: line.slice(0, colon), value: line.slice(colon + 1) } : null;
  }).filter((row): row is { label: string; value: string } => !!row);
  return <div className="axn-structured-reply" data-testid="rescue-plan-choices">
    <StatusPill tone="ok">救援方案生成智能体 · 候选方向已整理</StatusPill>
    <p>{message.text}</p>
    <ChoiceChips options={labels} value={labels[selected]} onChange={label => setSelected(labels.indexOf(label))} />
    <Section title={plan.title}><KvTable rows={fields} /></Section>
    <Notice tone="warn" title="适用条件待确认">当前为模拟候选方向，尚未审核或发布；选择方向不会自动锁定资源、调派队伍或下达作业指令。</Notice>
    <details className="axn-result-details"><summary>展开所选方向的完整草稿</summary>
      {plan.sections.map(([title, body]) => <Section key={title} title={title}><StructuredReply text={body} /></Section>)}
    </details>
    <Space wrap><Button type="primary" onClick={() => openRescuePlan(message.sessionId, plan)}>按所选方向生成方案草稿</Button></Space>
  </div>;
}
