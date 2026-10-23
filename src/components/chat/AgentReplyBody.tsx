import { Button, Space, Typography } from 'antd';
import { FileText } from 'lucide-react';
import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ChatMessage } from '@/domain/types';
import { useWorkspaceStore } from '@/store/workspaceStore';
import EventSwitchBriefingCard from './EventSwitchBriefingCard';
import InlineSituationFlow from './InlineSituationFlow';
import MultiSourceSummary from './MultiSourceSummary';
import RescuePlanChoices from './RescuePlanChoices';
import ResourceAuditReply from './ResourceAuditReply';
import SummaryReviewReply from './SummaryReviewReply';

const { Text } = Typography;

/** 四个救援智能体的结构化回复。没有对应字段时回退到普通文本。 */
export default function AgentReplyBody({
  message,
  active,
  busy,
  onReply,
  onTask,
  onOpenDrawer,
  fallback,
}: {
  message: ChatMessage;
  active: boolean;
  busy: boolean;
  onReply: (text: string) => void;
  onTask: (prompt: string) => void;
  onOpenDrawer: (target: 'resource' | 'knowledge', options?: { tab?: 'list' | 'map' }) => void;
  fallback: ReactNode;
}) {
  const navigate = useNavigate();
  if (message.reviewSummary || message.summaryOffer) {
    return <SummaryReviewReply message={message} active={active} busy={busy} onReply={onReply} />;
  }
  if (message.regionalDisasters) {
    return <MultiSourceSummary snapshot={message.regionalDisasters} regionalOnly />;
  }
  if (message.inlineSituation) {
    return (
      <InlineSituationFlow
        eventId={message.inlineSituation.eventId}
        sessionId={message.sessionId}
        initial={message.inlineSituation.kind}
      />
    );
  }
  if (message.rescuePlans) return <RescuePlanChoices message={message} />;
  if (message.resourceAudit) {
    return <ResourceAuditReply rows={message.resourceAudit.rows} checkedAt={message.resourceAudit.checkedAt} />;
  }
  if (message.eventBriefingEventId) {
    return (
      <EventSwitchBriefingCard
        text={message.text ?? ''}
        eventId={message.eventBriefingEventId}
        busy={busy}
        onTask={onTask}
        onNavigate={navigate}
      />
    );
  }
  if (message.situationReportAuto) {
    const auto = message.situationReportAuto;
    return (
      <div className="axn-auto-situation-report" data-testid="auto-situation-report">
        <Text>{message.text}</Text>
        <Space wrap size={8} style={{ marginTop: 8 }}>
          {auto.documentId && (
            <Button
              size="small"
              type="primary"
              ghost
              icon={<FileText size={14} />}
              onClick={() => {
                useWorkspaceStore.getState().autoOpen(
                  message.sessionId,
                  `auto-situation-open:${auto.documentId}`,
                  { kind: 'mock', id: auto.documentId! },
                );
              }}
            >
              查看态势报告
            </Button>
          )}
          {auto.openMap && (
            <Button size="small" type="primary" aria-label="查看态势地图" onClick={() => onOpenDrawer('resource', { tab: 'map' })}>
              查看态势地图
            </Button>
          )}
          <Text type="secondary">模拟数据 · 正式研判须岗位审核</Text>
        </Space>
      </div>
    );
  }
  if (message.multiSourceDetails && !message.reviewSummary) {
    return <MultiSourceSummary snapshot={message.multiSourceDetails} />;
  }
  return fallback;
}
