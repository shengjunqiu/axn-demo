import { CheckCircleOutlined, FileTextOutlined, LoadingOutlined, RobotOutlined } from '@ant-design/icons';
import { Button, Space, Steps, Tag, Typography } from 'antd';
import type { ChatMessage } from '@/domain/types';
import { useMockDocumentStore } from '@/store/mockDocumentStore';

export default function DocumentGenerationCard({ message }: { message: ChatMessage }) {
  const workflow = message.documentWorkflow!;
  const completed = workflow.stage === 'completed';
  const interrupted = workflow.stage === 'interrupted';
  const current = { collecting: 0, calling: 1, generating: 2, completed: 3, interrupted: 0 }[workflow.stage];
  const document = useMockDocumentStore(s => s.libraries[message.sessionId]?.documents.find(item => item.id === workflow.documentId));
  return <div className="axn-document-workflow" data-testid="document-generation-card" aria-live="polite">
    <Space><RobotOutlined /><Typography.Text strong>文书生成智能体</Typography.Text><Tag color={completed ? 'success' : 'processing'}>{completed ? '已完成' : interrupted ? '已中断' : '执行中'}</Tag></Space>
    <Typography.Paragraph type="secondary">{message.agentRole} · 模拟演示</Typography.Paragraph>
    <Steps direction="vertical" size="small" current={current} status={interrupted ? 'error' : undefined} items={[
      { title: current === 0 ? '正在整理已收集的文书要素' : '文书要素已收集', description: <>
        <Typography.Text type="secondary">以下模拟用户已提供并确认的信息</Typography.Text>
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
    {interrupted ? <Typography.Text type="secondary">页面刷新中断了模拟过程，请重新点击生成。</Typography.Text> : completed ? <Space><CheckCircleOutlined /><Typography.Text>已生成，可在右侧查看详情</Typography.Text>{document && <Button size="small" icon={<FileTextOutlined />} onClick={() => useMockDocumentStore.getState().select(message.sessionId, document)}>查看文书</Button>}</Space> : <Space><LoadingOutlined /><Typography.Text>{workflow.stage === 'collecting' ? '整理文书要素…' : workflow.stage === 'calling' ? '正在调用文书生成智能体…' : '正在生成文书…'}</Typography.Text></Space>}
  </div>;
}
