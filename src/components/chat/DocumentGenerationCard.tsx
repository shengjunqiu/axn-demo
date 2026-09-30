import { useState } from 'react';
import { submitWorkSummaryImprovement } from '@/services/workSummaryWorkflow';
import { CheckCircleOutlined, FileTextOutlined, LoadingOutlined, RobotOutlined } from '@ant-design/icons';
import { Button, Input, Space, Steps, Tag, Typography } from 'antd';
import type { ChatMessage } from '@/domain/types';
import { useMockDocumentStore } from '@/store/mockDocumentStore';

export default function DocumentGenerationCard({ message }: { message: ChatMessage }) {
  const [improvement, setImprovement] = useState('');
  const workflow = message.documentWorkflow!;
  const waiting = workflow.stage === 'waiting_input';
  const completed = workflow.stage === 'completed';
  const interrupted = workflow.stage === 'interrupted';
  const current = { collecting: 0, waiting_input: 0, calling: 1, generating: 2, completed: 3, interrupted: 0 }[workflow.stage];
  const document = useMockDocumentStore(s => s.libraries[message.sessionId]?.documents.find(item => item.id === workflow.documentId));
  return <div className="axn-document-workflow" data-testid="document-generation-card" aria-live="polite">
    <Space wrap className="axn-document-workflow-head"><RobotOutlined /><Typography.Text strong>文书生成智能体</Typography.Text><Tag color={completed ? 'blue' : 'processing'}>{completed ? '已完成' : interrupted ? '已中断' : waiting ? '待补充' : '执行中'}</Tag></Space>
    <Typography.Paragraph type="secondary">{message.agentRole} · 模拟演示</Typography.Paragraph>
    <Steps direction="vertical" size="small" current={current} status={interrupted ? 'error' : undefined} items={[
      { title: current === 0 ? (workflow.collection ? `正在收集复盘要素 · ${workflow.collectedCount ?? 0}/${workflow.collection.length}` : '正在整理已收集的文书要素') : '文书要素已收集', description: <>
        <Typography.Text type="secondary">{workflow.collection ? '前五项为模拟资料，下一步改进由你补充' : '以下模拟用户已提供并确认的信息'}</Typography.Text>
        {workflow.collection && <div className="axn-summary-collection">{workflow.collection.slice(0, Math.min((workflow.collectedCount ?? 0) + (current === 0 ? 1 : 0), workflow.collection.length)).map((round, index) => <div key={round.question} className="axn-summary-round">
          <Typography.Text strong>{index + 1}. {round.question}</Typography.Text>
          {index < (workflow.collectedCount ?? 0) ? <Typography.Paragraph><Tag color="blue">{index === 5 ? '用户补充 · 已确认' : '模拟补充 · 已确认'}</Tag>{round.answer}</Typography.Paragraph> : waiting ? <div className="axn-summary-input">
            <Typography.Paragraph type="secondary">请填写下一步改进措施，可包含通信或服装采购、餐食保障、人员轮换机制，以及责任人和完成时限。</Typography.Paragraph>
            <Input.TextArea aria-label="下一步改进措施" placeholder="请输入你的改进计划…" autoSize={{ minRows: 3, maxRows: 8 }} value={improvement} onChange={event => setImprovement(event.target.value)} />
            <Button type="primary" disabled={!improvement.trim()} onClick={() => void submitWorkSummaryImprovement(message.sessionId, message.messageId, improvement)}>提交并生成工作总结</Button>
          </div> : <Typography.Paragraph type="secondary"><LoadingOutlined /> 正在整理本轮模拟资料…</Typography.Paragraph>}
        </div>)}</div>}
        <dl className="axn-document-elements">{workflow.elements.map(item => <div key={item.label}><dt>{item.label}</dt><dd>{item.value}</dd></div>)}</dl>
        {current > 0 && <Typography.Text type="success"><CheckCircleOutlined /> 要素齐备，已确认（模拟）</Typography.Text>}
      </> },
      { title: '调用文书生成智能体', description: current >= 1 ? '已传入文书类型、编制单位及内容要求' : '等待要素整理完成' },
      { title: completed ? '红头文书已生成' : '正在生成红头文书', description: current >= 2 ? '整理正文 · 编排红头格式 · 同步右侧面板' : '等待智能体调用' },
    ]} />
    {completed && document && <div className="axn-document-result" data-testid="document-result-summary">
      <Typography.Text strong><FileTextOutlined /> {document.title}</Typography.Text>
      <Typography.Paragraph type="secondary">{document.date} · 红头格式 · 模拟文书</Typography.Paragraph>
      <Typography.Paragraph ellipsis={{ rows: 3 }}>{document.sections[0]?.[1]}</Typography.Paragraph>
    </div>}
    {waiting ? <Typography.Text type="secondary">等待你补充改进计划，也可以在下方对话框直接回复。</Typography.Text> : interrupted ? <Typography.Text type="secondary">页面刷新中断了模拟过程，请重新点击生成。</Typography.Text> : completed ? <Space wrap className="axn-document-workflow-footer"><CheckCircleOutlined /><Typography.Text>已生成，可在右侧查看详情</Typography.Text>{document && <Button size="small" icon={<FileTextOutlined />} onClick={() => useMockDocumentStore.getState().select(message.sessionId, document)}>查看文书</Button>}</Space> : <Space><LoadingOutlined /><Typography.Text>{workflow.stage === 'collecting' ? '整理文书要素…' : workflow.stage === 'calling' ? '正在调用文书生成智能体…' : '正在生成文书…'}</Typography.Text></Space>}
  </div>;
}
