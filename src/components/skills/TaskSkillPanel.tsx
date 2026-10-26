/** 对照建设目录与真实本地任务记录，不将步骤映射冒充生产 Skill 调用。 */
import { useState } from 'react';
import { Alert, Button, Descriptions, Drawer, Space, Tag, Typography } from 'antd';
import type { AgentTask, StepStatus } from '@/domain/types';
import { SKILL_AGENTS, SKILL_PLANS, skillOwnerForTask, type SkillPlan } from '@/seed/skillPlanning';
import SkillDetailDrawer from './SkillDetailDrawer';
import './skills.css';

const STEP_LABELS: Record<StepStatus, string> = {
  pending: '等待本步', running: '模拟执行中', completed: '模拟已完成', failed: '执行失败', cancelled: '已取消',
};
export default function TaskSkillPanel({ task }: { task: AgentTask }) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<SkillPlan | null>(null);
  const owner = skillOwnerForTask(task);
  if (!owner) return null;
  const agent = SKILL_AGENTS.find(a => a.id === owner)!;
  const business = SKILL_PLANS.filter(s => s.owner === owner);
  const support = SKILL_PLANS.filter(s => s.owner === 'interaction' || (owner !== 'document' && s.owner === 'document'));
  return <div className="axn-task-skills" data-testid="task-skill-panel">
    <Space size={4} wrap><Typography.Text type="secondary">Skill 规划对照</Typography.Text>{business.slice(0, 3).map(s => <Button key={s.id} size="small" onClick={() => setSelected(s)}>{s.name}</Button>)}<Button size="small" type="link" onClick={() => setOpen(true)}>查看本次执行与能力分工</Button></Space>
    <Drawer title="本次执行与 Skill 规划对照" size={600} open={open} onClose={() => { setOpen(false); setSelected(null); }}>
      <Alert type="info" showIcon title="本地任务记录 · 非生产 Skill 调用日志" description="下方执行步骤来自本次任务；能力目录说明对应建设规划，不代表每项 Skill 都已执行。真实 Function Calling 与平台 Trace 服务待接入。" style={{ marginBottom: 16 }} />
      <Descriptions size="small" column={1} items={[
        { key: 'agent', label: '业务负责', children: agent.name },
        { key: 'event', label: '关联事件', children: task.eventId },
        { key: 'task', label: '本地任务标识', children: task.taskId },
        { key: 'attempt', label: '本次尝试', children: `${task.attemptId} · 第 ${task.attempt} 次` },
        { key: 'time', label: '开始时间', children: task.startedAt },
        { key: 'gate', label: '人工责任门', children: agent.gate },
      ]} />
      <Typography.Title level={5}>本次模拟执行步骤</Typography.Title>
      {task.steps.length === 0 && <Typography.Text type="secondary">尚无执行记录，等待任务开始。</Typography.Text>}
      {task.steps.map(step => <div className="axn-skill-trace-row" key={step.stepId}>
        <Space wrap><Typography.Text strong>{step.name}</Typography.Text><Tag color={step.status === 'failed' ? 'red' : step.status === 'completed' ? 'blue' : 'default'}>{STEP_LABELS[step.status]}</Tag></Space>
        <p>输入：{step.inputSummary || '本步未记录输入摘要'}</p><p>输出：{step.outputSummary || '尚无输出记录'}</p>
        <Typography.Text type="secondary">来源：{step.sourceRefs.length ? step.sourceRefs.join('、') : '本步未记录来源标识，需核对产物依据'}</Typography.Text>
        {step.errorCode && <p>失败原因：{step.errorCode}</p>}
      </div>)}
      <Typography.Title level={5}>业务智能体规划能力</Typography.Title>
      <Space wrap>{business.map(s => <Button size="small" key={s.id} onClick={() => setSelected(s)}>{s.name} · {s.status}</Button>)}</Space>
      <Typography.Title level={5}>共用支撑与交接</Typography.Title>
      <Typography.Paragraph type="secondary">交互与呈现负责事件和结果组织；文书生成负责模板成文、引用与导出。专业结论由业务智能体负责，正式办理仍由原岗位确认。</Typography.Paragraph>
      <Space wrap>{support.map(s => <Button size="small" key={s.id} onClick={() => setSelected(s)}>{s.name}</Button>)}</Space>
    </Drawer>
    <SkillDetailDrawer skill={selected} onClose={() => setSelected(null)} />
  </div>;
}
