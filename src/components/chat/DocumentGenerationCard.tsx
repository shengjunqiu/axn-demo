import { useSessionStore } from '@/store/sessionStore';
import { useEffect, useState } from 'react';
import { defaultWorkSummaryImprovement, ensureWorkSummaryDocument, submitWorkSummaryImprovement } from '@/services/workSummaryWorkflow';
import { REQUIRED_ATTACHMENTS, submitDynamicsSources } from '@/services/weeklyDynamicsWorkflow';
import { formatSize } from '@/shared/format';
import { FileText, LoaderCircle, Paperclip, X } from 'lucide-react';
import { Button, Input, Space, Typography, Upload } from 'antd';
import { agentIcon } from './agentIcons';
import type { ChatMessage } from '@/domain/types';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useDocumentNavigation } from '@/components/workspace/useDocumentNavigation';
import { KvTable, Notice, RunBar, Section } from '@/components/common/ChatPrimitives';
import StructuredReply from './StructuredReply';

/**
 * 文书生成气泡里只展示「要素收集」这一个过程（用户 m00705）：需要要素或材料就在这里找用户要。
 * 三件曾经铺在卡里的东西一律不展示 —— 调用智能体/生成正文的过程流水账、完成后的正文摘要、
 * 以及「已生成，可在右侧查看」的页脚（完成态一句话 + 一个入口就够，正文去右侧文书工作区看）。
 * 上传入口就在卡里（用户 m00994，把 m00710 挪出去的做法又挪回来）：等材料时这里出上传按钮，
 * 传完把材料列成清单、给「开始生成」。输入框的 📎 仍能用（把文件直接发给智能体），但不再为它做箭头指路。
 */

/** 等材料期间选中的参考文档/附件（演示环境不落盘：beforeUpload 返回 false，只留文件名与大小）。 */
type SourceFile = { name: string; size: number };

export default function DocumentGenerationCard({ message }: { message: ChatMessage }) {
  const eventId = useSessionStore(s => s.sessions[message.sessionId]?.eventId ?? '');
  const [improvement, setImprovement] = useState(() => message.documentWorkflow?.collection?.[5]?.answer?.trim() || defaultWorkSummaryImprovement(eventId));
  const [sources, setSources] = useState<SourceFile[]>([]);
  const openDocument = useDocumentNavigation();
  const workflow = message.documentWorkflow!;
  const inline = workflow.presentation === 'inline';
  const waiting = workflow.stage === 'waiting_input';
  /** 素材依赖型文书（周工作动态）等参考文档/附件：上传按钮就在卡里（见下面的 uploading 分支）。 */
  const uploading = workflow.stage === 'waiting_upload';
  const collecting = workflow.stage === 'collecting';
  const completed = workflow.stage === 'completed';
  const interrupted = workflow.stage === 'interrupted';
  const collected = workflow.collectedCount ?? 0;
  // 要素收集动画（用户 m01044）：要素表本身不许展示（用户 m00861），所以过程只能抽象成
  // 「已走到第几条」——计数在标题里，进度条在下面。
  const elementCount = workflow.elements?.length ?? 0;
  const collectPercent = elementCount > 0 ? Math.round(collected / elementCount * 100) : 0;
  // 收集过程逐轮长出来：进行中/等补充时多显示一轮（最后一轮就是要用户填的那个表单）。
  const rounds = workflow.collection?.slice(
    0,
    Math.min(collected + (collecting || waiting ? 1 : 0), workflow.collection.length),
  ) ?? [];
  const title = uploading
    ? '等待上传参考文档与附件'
    : workflow.collection
      ? (collecting || waiting ? `正在收集复盘要素 · ${collected}/${workflow.collection.length}` : '复盘要素已收集')
      : (collecting ? `正在收集文书要素 · ${collected}/${elementCount}` : '文书要素已收集');
  const document = useMockDocumentStore(s => s.libraries[message.sessionId]?.documents.find(item => item.id === workflow.documentId));
  useEffect(() => {
    if (completed && !document && workflow.reportSections?.length) ensureWorkSummaryDocument(message.sessionId, workflow, message.messageId);
  }, [completed, document, workflow, message.sessionId, message.messageId]);
  const openInWorkspace = () => {
    const restored = document ?? ensureWorkSummaryDocument(message.sessionId, { ...workflow, presentation: 'document' });
    if (!restored) return;
    openDocument(message.sessionId, { kind: 'mock', id: restored.id });
  };
  /** 卡片里交材料：和输入框那条路走同一个服务（都把材料记进对话流，再进要素整理）。 */
  const submitSources = () => void submitDynamicsSources(message.sessionId, message.messageId, sources);
  const DocIcon = agentIcon('agent-doc');
  const statusText = completed ? '已完成' : interrupted ? '已中断' : waiting ? '待补充' : uploading ? '待上传素材' : '执行中';
  const tone = completed ? 'ok' : interrupted ? 'err' : waiting || uploading ? 'warn' : 'busy';
  if (inline) return <section className="axn-agent-result" data-testid="inline-agent-result" aria-live="polite">
    <RunBar title={message.agentName || '救援资源管理智能体'} meta="编组建议 · 模拟" status={{ tone, label: statusText }}
      steps={[{ name: '读取本页人装与出动状态', status: completed ? 'completed' : interrupted ? 'failed' : 'running' },
        { name: '整理编成、约束及待核事项', status: completed ? 'completed' : 'pending' }]} />
    <KvTable rows={workflow.elements.map(item => ({ label: item.label, value: item.value }))} />
    {completed && <>
      <Notice tone="warn" title="抽组条件待核">候选人装须核对可用状态、专业资格及驾驶员/操作手后办理正式抽组；未下发出动指令。</Notice>
      {workflow.reportSections?.map(([heading, body], index) => <details key={heading} className="axn-result-details" open={index === 1}>
        <summary>{heading}</summary><StructuredReply text={body} />
      </details>)}
      <Section title="应用与留档"><Button size="small" onClick={openInWorkspace}>按需整理为附件</Button></Section>
    </>}
  </section>;
  // 与 AgentSummonCard 同一版式：头像列 + 内容列（身份行 → 要素收集面板）
  return <section className={`axn-agent-execution axn-document-workflow${collecting ? ' is-running' : ''}`} data-testid="document-generation-card" aria-live="polite">
    <span className="axn-agent-summon-avatar" aria-hidden><DocIcon size={16} /></span>
    <div className="axn-agent-summon-body">
    <div className="axn-agent-summon-head">
      <span className="axn-agent-summon-name">{message.agentName || '文书生成智能体'}</span>
      <span className="axn-agent-summon-role">文书撰写</span>
      <span className={`axn-status axn-status--${tone}`}><i aria-hidden />{statusText}</span>
    </div>
    <div className="axn-document-collect">
      <Typography.Text strong>{title}</Typography.Text>
      {uploading && <>
        <Typography.Text type="secondary">正文数据全部来自下面这些统计表 —— 请把它们交给我（可一次多选），收到材料就开始编制：</Typography.Text>
        <ul className="axn-upload-needed">{REQUIRED_ATTACHMENTS.map(item => <li key={item}>{item}</li>)}</ul>
        <Space wrap>
          <Upload
            multiple
            showUploadList={false}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.png,.jpg,.jpeg"
            beforeUpload={(file) => {
              setSources(list => [...list, { name: file.name, size: file.size }]);
              return false; // 没有上传接口：只拦下文件，不让 antd 发起请求
            }}
          >
            <Button icon={<Paperclip size={14} />} aria-label="上传参考文档与附件" data-testid="doc-source-upload">上传参考文档与附件</Button>
          </Upload>
          <Button type="primary" disabled={sources.length === 0} onClick={submitSources} data-testid="doc-source-generate">开始生成</Button>
        </Space>
        {sources.length > 0 && <ul className="axn-source-list" data-testid="doc-source-list">
          {sources.map((file, index) => <li key={`${file.name}-${index}`}>
            <FileText size={14} aria-hidden />
            <span className="axn-source-name">{file.name}</span>
            <span className="axn-source-size">{formatSize(file.size)}</span>
            <Button type="text" size="small" aria-label={`移除 ${file.name}`} icon={<X size={14} />} onClick={() => setSources(list => list.filter((_, i) => i !== index))} />
          </li>)}
        </ul>}
      </>}
      {workflow.collection && <Typography.Text type="secondary">前五项为模拟资料，下一步改进由你补充</Typography.Text>}
      {rounds.length > 0 && <div className="axn-summary-collection">{rounds.map((round, index) => <div key={round.question} className={`axn-summary-round${collecting && index === collected ? ' is-collecting' : ''}`}>
        <Typography.Text strong>{index + 1}. {round.question}</Typography.Text>
        {index < collected ? <Typography.Paragraph><span className="axn-round-source">{index === 5 ? '用户补充' : '资料提取'}</span>{round.answer}</Typography.Paragraph> : waiting ? <div className="axn-summary-input">
          <Typography.Paragraph type="secondary">请填写下一步改进措施，可包含通信或服装采购、餐食保障、人员轮换机制，以及责任人和完成时限。</Typography.Paragraph>
          <Input.TextArea aria-label="下一步改进措施" placeholder="请输入你的改进计划…" autoSize={{ minRows: 3, maxRows: 8 }} value={improvement} onChange={event => setImprovement(event.target.value)} />
          <Button type="primary" disabled={!improvement.trim()} onClick={() => void submitWorkSummaryImprovement(message.sessionId, message.messageId, improvement)}>提交并生成工作总结</Button>
        </div> : <Typography.Paragraph type="secondary"><LoaderCircle size={14} /> 正在整理本轮模拟资料…</Typography.Paragraph>}
      </div>)}</div>}
      {collecting && !workflow.collection && <>
        <div className="axn-collect-progress" data-testid="doc-collect-progress" role="progressbar" aria-label="文书要素收集进度" aria-valuemin={0} aria-valuemax={elementCount} aria-valuenow={collected}>
          <div className="axn-collect-progress-bar" style={{ width: `${collectPercent}%` }} />
        </div>
        <Typography.Text type="secondary"><LoaderCircle size={14} className="axn-spin" /> 正在逐项核对要素，收齐即开始编制…</Typography.Text>
      </>}
      {interrupted && <Typography.Text type="warning">页面刷新中断了模拟过程，请重新点击生成。</Typography.Text>}
      {completed && <div className="axn-document-collect-done" data-testid="doc-collect-done">
        <span className="axn-doc-done-icon" aria-hidden><FileText size={16} /></span>
        <span className="axn-doc-done-text">已生成{document ? `《${document.title}》` : '文书'}</span>
        {document && <Button size="small" aria-label="查看文书" onClick={openInWorkspace}>查看文书</Button>}
      </div>}
      {completed && document && <details className="axn-document-outline">
        <summary>查看文书包含哪些章节（{document.sections.length}章）</summary>
        <Section title="文书内容结构">
          <ol>{document.sections.map(([heading], index) => <li key={index}>{heading}</li>)}</ol>
        </Section>
      </details>}
    </div>
    </div>
  </section>;
}
