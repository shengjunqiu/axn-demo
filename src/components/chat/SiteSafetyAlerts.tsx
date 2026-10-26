import { useState } from 'react';
import { Button } from 'antd';
import { ChoiceChips, KvTable, Notice, Section, StatusPill } from '@/components/common/ChatPrimitives';
import type { DisasterProfile } from '@/seed/disasterScenarios';
import { safetyAlertDraft, siteSafetyAlerts } from '@/services/siteSafetyAlerts';

export default function SiteSafetyAlerts({ profile, onNotify }: { profile: DisasterProfile; onNotify: (text: string) => void }) {
  const [filter, setFilter] = useState('全部提醒');
  const alerts = siteSafetyAlerts(profile);
  return <div className="axn-structured-reply" data-testid="site-safety-alerts">
    <Notice tone="warn" title="先看哪里有危险，再确认怎么走、怎么避险">当前资料提示：{profile.impactScope}；{profile.risks}。以下为本地模拟提醒，不是实时正式预警。“还没核实”不等于安全。</Notice>
    <KvTable rows={[{ label: '当前事件', value: profile.name }, { label: '资料时间', value: profile.capturedAt }]} />
    <ChoiceChips options={['全部提醒', '人员房屋', '道路桥梁', '学校医院', '天气变化', '其他隐患']} value={filter} onChange={setFilter} />
    {alerts.filter(a => filter === '全部提醒' || a.category === filter).map(a => <Section key={a.id} title={a.title}>
      <StatusPill tone={a.state === '已有模拟线索' ? 'warn' : 'idle'}>{a.state}</StatusPill>
      <p>{a.impact}</p>
      <KvTable rows={[
        { label: '注意哪里', value: a.place }, { label: '现在怎么做', value: a.action }, { label: '找谁核实', value: a.contact },
      ]} foot={`依据：${a.source}；资料时间：${profile.capturedAt}`} actions={<Button size="small" onClick={() => onNotify(safetyAlertDraft(profile, [a]))}>把这条提醒告诉相关人员</Button>} />
    </Section>)}
    <Button onClick={() => onNotify(safetyAlertDraft(profile, alerts))}>整理全部提醒，通知相关人员</Button>
  </div>;
}
