import { useState } from 'react';
import { ChoiceChips, Notice, Section, StatusPill } from '@/components/common/ChatPrimitives';
import { disasterProfileById } from '@/seed/disasterScenarios';
import { incidentById } from '@/seed/scenario';
import { eventDisplayName } from '@/services/factLookup';
import SiteSafetyAlerts from './SiteSafetyAlerts';
import { safetyAlertDraft, siteSafetyAlerts } from '@/services/siteSafetyAlerts';
import { defaultTargetsForKind } from '@/services/warningPush';
import { useSessionStore } from '@/store/sessionStore';
import WarningPushPanel from './WarningPushPanel';

export default function InlineSituationFlow({ eventId, sessionId, initial }: {
  eventId: string; sessionId: string; initial: 'forecast' | 'warning';
}) {
  const [tab, setTab] = useState(initial);
  const [notificationDraft, setNotificationDraft] = useState<string | null>(null);
  const profile = disasterProfileById.get(eventId);
  const notify = (warning?: string) => {
    if (profile) {
      const text = warning ?? safetyAlertDraft(profile, siteSafetyAlerts(profile));
      setNotificationDraft(text);
      useSessionStore.getState().setWarningPush(sessionId, 'situation', {
      kind: 'situation', targets: defaultTargetsForKind('situation'),
      warning: text, approved: false, receipts: [], updatedAt: new Date().toISOString(),
    });
    }
    setTab('warning');
  };
  if (!incidentById.has(eventId)) return <Notice tone="warn" title="请先关联灾情">关联有效事件后，再读取该事件监测资料或编制预警草稿。</Notice>;
  return <section className="axn-agent-result" data-testid="inline-situation-flow">
    <StatusPill tone="idle">态势感知智能体 · 本地模拟</StatusPill>
    <ChoiceChips options={['查看危险提醒', '通知相关人员']} value={tab === 'forecast' ? '查看危险提醒' : '通知相关人员'}
      onChange={label => label === '通知相关人员' ? setTab('warning') : setTab('forecast')} />
    <p className="axn-agent-result-lead">{tab === 'forecast'
      ? '这里直接告诉你：哪里要注意，哪些人、学校、医院或道路可能受影响，现在该做什么、找谁核实。资料不全的地方会明确写“还没核实”。'
      : '先核对这次要提醒的事，再选择接收岗位。批准后只做本地模拟发送，可查看送达和响应情况。'}</p>
    <div hidden={tab !== 'forecast'}><Section title="现在有哪些危险要注意">
      {profile ? <SiteSafetyAlerts profile={profile} onNotify={notify} />
        : <Notice tone="warn" title="专业监测资料待补">当前事件尚未配置趋势序列，请补齐本事件监测资料后研判，不套用其他事件数值。</Notice>}
    </Section></div>
    <div hidden={tab !== 'warning'}><Section title="预警草稿与模拟推送">
      <Notice tone="info" title="先核实，再批准">在对话中选择责任岗位、核对预警草稿并批准本地模拟发送；不会连接真实短信或外部推送渠道。</Notice>
      <WarningPushPanel kind="situation" mode="current" eventId={eventId} eventName={eventDisplayName(eventId)} sessionId={sessionId}
        draftText={notificationDraft ?? (profile ? safetyAlertDraft(profile, siteSafetyAlerts(profile)) : undefined)} />
    </Section></div>
  </section>;
}
