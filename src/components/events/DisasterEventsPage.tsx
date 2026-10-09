import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, Button, Card, Empty, Select, Space, Tag, Typography } from 'antd';
import { DISASTER_PROFILES, disasterProfileById } from '@/seed/disasterScenarios';
import { vueWorkspaceEventById } from '@/seed/vueWorkspaceEvents';
import { incidents } from '@/seed/scenario';
import { eventDisplayName } from '@/services/factLookup';
import { useConversationStore } from '@/store/conversationStore';
import { useSessionStore } from '@/store/sessionStore';
import { buildEventSwitchBriefing } from '@/services/eventSwitchBriefing';
import { sendMessage } from '@/services/taskRunner';
import DisasterEventPanel from './DisasterEventPanel';
import './events.css';

export default function DisasterEventsPage() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const eventId = params.get('event') ?? DISASTER_PROFILES[0].eventId;
  const profile = disasterProfileById.get(eventId);
  const enterConversation = (prompt?: string) => {
    const store = useConversationStore.getState();
    const existing = Object.values(store.conversations).find(c => c.eventId === eventId);
    const conversation = existing ?? store.createConversation({title:eventDisplayName(eventId), type:'emergency', eventId, summary:'灾种模拟事件演示'});
    if (existing) store.selectConversation(existing.id);
    const sessionId = useSessionStore.getState().sessionByConversation[conversation.id];
    if (sessionId && !useSessionStore.getState().sessions[sessionId].messages.length) {
      useSessionStore.getState().appendMessage(sessionId, {sessionId, role:'assistant', kind:'text', taskId:null, text:buildEventSwitchBriefing(eventId), eventBriefingEventId:eventId});
    }
    navigate('/assistant');
    if (prompt && sessionId) void sendMessage(sessionId, {text:prompt});
  };
  return <div className="axn-events-page"><div className="axn-events-inner">
    <div className="axn-events-head"><div><Typography.Title level={3} style={{marginTop:0}}>灾种事件库</Typography.Title><Typography.Text type="secondary">十类救援场景 · 独立事件、专业监测与配套材料</Typography.Text></div><Space wrap><Tag color="orange">全部为模拟</Tag><Button onClick={()=>navigate('/assistant')}>返回安小能</Button></Space></div>
    <div className="axn-events-picker" aria-label="十类模拟救援场景">{DISASTER_PROFILES.map(p => <button type="button" className="axn-event-choice" aria-pressed={eventId===p.eventId} key={p.eventId} onClick={()=>setParams({event:p.eventId})}><strong>{p.category}</strong><span>{p.stage} · {p.monitoring[0].label}</span></button>)}</div>
    <Space wrap><Typography.Text>查看事件</Typography.Text><Select showSearch optionFilterProp="label" aria-label="事件库选择事件" style={{width:360,maxWidth:'100%'}} value={eventId} options={incidents.map(i=>({value:i.eventId,label:`${eventDisplayName(i.eventId)}（${vueWorkspaceEventById.get(i.eventId)?.stage ?? '原有事件'}）`}))} onChange={id=>setParams({event:id})}/><Button type="primary" disabled={!incidents.some(i=>i.eventId===eventId)} onClick={()=>enterConversation()}>关联事件并对话</Button></Space>
    {profile ? <DisasterEventPanel key={eventId} profile={profile} onTask={prompt=>enterConversation(prompt)}/> : incidents.some(i=>i.eventId===eventId) ? <Card title={eventDisplayName(eventId)}><Alert type="info" title="原有事件保留" description="原有事件继续使用已配置的资料，不把十类新增事件的监测数值或预案套入此事件。可关联后继续查看和生成材料。"/></Card> : <Empty description="未找到该事件，请选择有效事件"/>}
    <Typography.Paragraph type="secondary" style={{fontSize:12}}>场景范围结合用户确认与中国安能公开救援能力；图表和预案结构为产品设计推演。参考：<a href="https://wap.sasac.gov.cn/n2588025/n2588124/c35340229/content.html" target="_blank" rel="noreferrer">国资委：中国安能应急救援演练</a>、<a href="https://www.mem.gov.cn/xw/ztzl/2021/qgyjglxtxjmfhzcwsbzdh/xjjt/shyjjyll/202111/t20211105_402053.shtml" target="_blank" rel="noreferrer">应急管理部：中国安能救援事迹</a>。</Typography.Paragraph>
  </div></div>;
}
