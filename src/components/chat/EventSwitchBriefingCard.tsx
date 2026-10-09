import { tenderName } from '@/seed/tenderNames';
import { disasterProfileById } from '@/seed/disasterScenarios';
/**
 * 关联灾情切换提示卡：状态总结 + 下一步操作按钮 +「查看时间轴」抽屉。
 */
import { useState } from 'react';
import { Button, Drawer, Space, Tag, Timeline, Typography } from 'antd';
import { Clock } from 'lucide-react';
import NextStepActionsBar from './NextStepActionsBar';
import { resolveEventDispatchSource } from '@/seed/eventDispatchSource';
import { scenarioForStage, scenarioLabelForId } from '@/services/agentFlow';
import { buildEventNextStepActions, resolveEventStage } from '@/services/eventSwitchBriefing';
import { buildEventTimeline, type EventTimelineItem } from '@/services/eventTimeline';
import { useSessionStore } from '@/store/sessionStore';

const { Text, Paragraph } = Typography;

function toneColor(tone: EventTimelineItem['tone']): string {
  if (tone === 'active') return 'blue';
  if (tone === 'pending') return 'gray';
  return 'green';
}

export default function EventSwitchBriefingCard({
  text,
  eventId,
  onTask,
  onNavigate,
  busy = false,
}: {
  text: string;
  eventId: string;
  onTask: (prompt: string) => void;
  onNavigate: (path: string) => void;
  busy?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const session = useSessionStore((s) => {
    const current = s.sessions[s.currentSessionId];
    return current?.eventId === eventId ? current : Object.values(s.sessions).find((item) => item.eventId === eventId) ?? null;
  });
  const stage = resolveEventStage(eventId, session);
  const scenario = scenarioForStage(stage);
  const timeline = buildEventTimeline(eventId);
  const actions = buildEventNextStepActions(eventId, session);
  const handoff = session?.handoffBundle;
  const dispatch = resolveEventDispatchSource(eventId);

  return (
    <div className="axn-event-briefing" data-testid="event-switch-briefing">
      <Space wrap size={6} className="axn-event-briefing-meta" style={{ marginBottom: 8 }}>
        <Tag color="blue" data-testid="event-scenario-tag">{tenderName(scenario.label)}</Tag>
        <Tag data-testid="event-stage-tag">{stage}</Tag>
        <Text type="secondary" className="axn-tc-fs12">主责 {scenario.agentLabel}</Text>
      </Space>
      {dispatch ? (
        <Space wrap size={6} className="axn-event-dispatch-meta" style={{ marginBottom: 8 }} data-testid="event-dispatch-tags">
          <Tag color="geekblue" data-testid="event-dispatch-task-source">{dispatch.taskSource}</Tag>
          <Tag data-testid="event-dispatch-channel">{dispatch.channel}</Tag>
          <Tag data-testid="event-dispatch-info-type">{dispatch.infoType}</Tag>
          <Text type="secondary" className="axn-tc-fs12">
            发送 {dispatch.sendUnit} · 填报 {dispatch.reportUnit} · 调用 {dispatch.callUnit}
          </Text>
        </Space>
      ) : null}
      {handoff ? (
        <Paragraph type="secondary" className="axn-event-handoff" data-testid="event-handoff-hint">
          承接自「{scenarioLabelForId(handoff.fromScenario)}」· {handoff.versionLabel}：{handoff.summary}
        </Paragraph>
      ) : null}
      <Paragraph className="axn-event-briefing-text">{text}</Paragraph>

      <NextStepActionsBar
        actions={actions}
        onTask={onTask}
        onNavigate={onNavigate}
        busy={busy}
      />

      <Space wrap className="axn-event-briefing-actions">
        {disasterProfileById.has(eventId) && <Button size="small" onClick={() => onNavigate(`/events?event=${encodeURIComponent(eventId)}`)}>查看本灾种图表与预案</Button>}
        <Button
          size="small"
          type="primary"
          ghost
          icon={<Clock size={14} />}
          aria-label="查看时间轴"
          data-testid="open-event-timeline"
          onClick={() => setOpen(true)}
        >
          查看时间轴
        </Button>
        <Text type="secondary" className="axn-tc-fs12">过程监测与处置节点（模拟）</Text>
      </Space>

      <Drawer
        title={`${timeline.eventName} · 过程时间轴`}
        size={480}
        open={open}
        onClose={() => setOpen(false)}
        destroyOnHidden
      >
        <div data-testid="event-timeline-drawer">
          <Space size={8} wrap style={{ marginBottom: 16 }}>
            <Tag color="orange">模拟数据</Tag>
            <Tag color="blue">{timeline.stageLabel}</Tag>
            <Tag color="geekblue">{tenderName(scenario.label)}</Tag>
            {dispatch ? (
              <>
                <Tag>{dispatch.taskSource}</Tag>
                <Tag>{dispatch.channel}</Tag>
                <Tag>{dispatch.infoType}</Tag>
              </>
            ) : null}
          </Space>
          {dispatch ? (
            <Paragraph type="secondary" className="axn-tc-fs12" style={{ marginBottom: 12 }}>
              派发来源：{dispatch.taskNo} · 发送 {dispatch.sendUnit} · 填报 {dispatch.reportUnit} · 调用 {dispatch.callUnit} · 下发 {dispatch.issueUnit}
            </Paragraph>
          ) : null}
          <Timeline
            items={timeline.items.map((item) => ({
              color: toneColor(item.tone),
              children: (
                <div className="axn-event-timeline-item">
                  <Text strong>{item.time} · {item.title}</Text>
                  <Paragraph type="secondary" style={{ marginBottom: 0 }}>{item.detail}</Paragraph>
                </div>
              ),
            }))}
          />
          <Text type="secondary" className="axn-tc-fs12">{timeline.notice}</Text>
        </div>
      </Drawer>
    </div>
  );
}
