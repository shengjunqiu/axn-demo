import { multiSourceBrief } from '@/services/multiSourceBrief';
import { Button, Space } from 'antd';
import { KvTable, Section } from '@/components/common/ChatPrimitives';
import type { ChatMessage } from '@/domain/types';

export default function SummaryReviewReply({ message, active, busy, onReply }: { message: ChatMessage; active: boolean; busy: boolean; onReply: (text: string) => void }) {
  return <div className="axn-agent-result" data-testid="summary-review-reply">
    {message.reviewSummary && <>
      <p className="axn-agent-result-lead">{message.reviewSummary.conclusion}</p>
      <Section title={message.summaryOffer?.kind === 'sixData' ? '六源汇聚要点' : message.summaryOffer?.kind === 'map' ? '路线与出行信息' : message.summaryOffer?.kind === 'analysis' ? '当前建议' : '本次复盘要点'}><KvTable rows={message.summaryOffer?.kind === 'sixData' && message.multiSourceDetails ? message.multiSourceDetails.event.sources.map(source => ({ label: source.kind, value: multiSourceBrief(source, message.multiSourceDetails!.event.eventId) })) : message.reviewSummary.rows} foot="依据当前事件模拟资料，未核实信息需进一步确认。" /></Section>
    </>}
    <p style={{ margin: 0 }}>{message.text}</p>
    {active && message.summaryOffer && <Space wrap>
      <Button size="small" type="primary" disabled={busy} onClick={() => onReply(message.summaryOffer?.kind === 'sixData' ? '需要，展示六类数据图表' : message.summaryOffer?.kind === 'map' ? '需要，用地图展示' : message.summaryOffer?.kind === 'analysis' ? '需要' : message.summaryOffer?.kind === 'report' ? '需要，生成总结报告' : '需要，整理知识候选')}>{message.summaryOffer.kind === 'sixData' ? '展示六类数据图表' : message.summaryOffer.kind === 'map' ? '用地图展示线路' : message.summaryOffer.kind === 'analysis' ? `生成${message.summaryOffer.title}` : message.summaryOffer.kind === 'report' ? '生成总结报告' : '整理知识候选'}</Button>
      <Button size="small" disabled={busy} onClick={() => onReply(message.summaryOffer?.kind !== 'knowledge' ? '暂不生成' : '暂不整理')}>暂时不需要</Button>
    </Space>}
  </div>;
}
