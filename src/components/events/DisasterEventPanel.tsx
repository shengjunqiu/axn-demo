import { useState } from 'react';
import { Alert, App, Button, Card, Progress, Select, Space, Table, Tabs, Tag, Typography } from 'antd';
import {
  disasterDocumentSections,
  disasterKeyReadings,
  disasterTacticSection,
  type DisasterProfile,
} from '@/seed/disasterScenarios';
import { exportMaterial } from '@/services/prototypeExports';
import OriginalSystemLink from '@/components/chat/OriginalSystemLink';
import DisasterMonitoring from './DisasterMonitoring';
import SituationForecast from './SituationForecast';
import ResourceComposition from './ResourceComposition';
import RescueEvaluation from './RescueEvaluation';
import OperationalFlows from '@/components/chat/OperationalFlows';

const MATERIALS = [{ value: 'RESCUE_PLAN', label: '现场处置行动方案样例' }, { value: 'SITUATION_REPORT', label: '灾情态势报告样例' }, { value: 'RESOURCE_REPORT', label: '周边资源报告样例' }, { value: 'RESCUE_EVAL', label: '阶段评估样例' }, { value: 'EMERGENCY_BRIEF', label: '应急抢险要情样例' }];
export default function DisasterEventPanel({ profile, onTask }: { profile: DisasterProfile; onTask: (prompt: string) => void }) {
  const [code, setCode] = useState('RESCUE_PLAN');
  const [warningOpen,setWarningOpen]=useState(false);
  const { message } = App.useApp();
  const sections = disasterDocumentSections(profile.eventId, code)!;
  const title = code === 'RESCUE_PLAN' ? profile.planTitle : `${profile.name} · ${MATERIALS.find(m => m.value === code)?.label}`;
  const tactic = disasterTacticSection(profile);
  const keyReadings = disasterKeyReadings(profile);
  const download = async (format: 'Word' | 'PDF') => { try { await exportMaterial(title, sections, format); } catch { message.error('材料导出失败，请重试'); } };
  return <Card title={<Space wrap><Typography.Text strong>{profile.name}</Typography.Text><Tag color="blue">{profile.stage}</Tag><Tag color="orange">模拟数据</Tag></Space>}>
    <div className="axn-disaster-context"><div><Typography.Text type="secondary">事件类型与地点</Typography.Text><p>{profile.category} · {profile.location}</p></div><div><Typography.Text type="secondary">接报与数据时间</Typography.Text><p>{profile.occurredAt} / {profile.capturedAt}</p></div></div>
    <Typography.Paragraph>{profile.description} {profile.impactScope}；{profile.casualty}。</Typography.Paragraph>
    <Alert showIcon type="warning" title={`风险关注：${profile.risks}`} description={`${profile.gaps}。本页数据、地点及预案均为产品模拟，不构成现场作业指令。`} />
    <Tabs defaultActiveKey="monitor" destroyOnHidden items={[
      {key:'forecast',label:'态势研判预警',children:<SituationForecast key={profile.eventId} profile={profile} onWarning={()=>setWarningOpen(true)}/>},
      { key: 'monitor', label: '监测图表与风险', children: <>
        <DisasterMonitoring profile={profile}/>
        <Card size="small" title="风险线索分布（模拟统计，非灾害边界）">{profile.riskDistribution.map(r => <div className="axn-disaster-bar-row" key={r.area}><span>{r.area}</span><div className="axn-disaster-bar"><span style={{width:`${r.count / Math.max(...profile.riskDistribution.map(d => d.count)) * 100}%`}}/></div><span>{r.count} 条线索</span></div>)}</Card>
        <Card size="small" style={{marginTop:14}} title={`${profile.objective} · 阶段目标（模拟）`}><Progress percent={Math.round(profile.completed/profile.target*100)} status="active"/><p>{profile.completed} / {profile.target} {profile.unit}；尚未完成全部目标，需核查现场回执。</p></Card>
        <Space wrap style={{marginTop:14}}><Button type="primary" onClick={()=>onTask('生成态势报告')}>态势报告自动生成</Button><Button onClick={()=>onTask('生成灾情摘要')}>多源数据汇聚</Button></Space>
      </> },
      { key: 'resources', label: '资源智能检索', children: <><Alert type="info" title="每个事件使用独立资源样例，以下是候选配置，尚未调派。"/><Table scroll={{x:720}} style={{marginTop:14}} size="small" pagination={false} rowKey="name" dataSource={profile.resources} columns={[{title:'资源',dataIndex:'name',width:230},{title:'数量',dataIndex:'amount',width:110},{title:'专业能力',dataIndex:'capability',width:230},{title:'状态',dataIndex:'status',width:160}]}/><Button style={{marginTop:14}} onClick={()=>onTask('查询周边救援资源')}>资源智能检索</Button></> },
      {key:'composition',label:'智能编组推荐',children:<ResourceComposition key={profile.eventId} profile={profile}/>},
      {key:'evaluation',label:'复盘评估分析',children:<RescueEvaluation key={profile.eventId} profile={profile}/>},
      { key: 'materials', label: '预案与报告', children: <>
        <Card size="small" title={`本灾种主战法（模拟）· ${profile.category}`} style={{ marginBottom: 14 }} data-testid="disaster-tactic-card">
          <Typography.Paragraph style={{ marginBottom: 8 }}>
            {tactic ? tactic[1] : '尚未配置主战法章节；请核对灾种种子 planSections。'}
          </Typography.Paragraph>
          <Typography.Text type="secondary">关键监测最新值（随灾种变化）</Typography.Text>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
            {keyReadings.map((r) => (
              <Tag key={r.label} color="processing">{r.label}：{r.value}</Tag>
            ))}
          </div>
          <Typography.Paragraph type="secondary" style={{ marginTop: 8, marginBottom: 0, fontSize: 12 }}>
            吸收安能公开战法关键词与分灾种监测字段，非正式九分案正文。
          </Typography.Paragraph>
        </Card>
        <Space wrap><Select aria-label="灾种材料类型" value={code} options={MATERIALS} onChange={setCode} style={{minWidth:220}}/><Tag>演示参考 · 待专业审核</Tag></Space>
        <div className="axn-disaster-document" data-testid="disaster-material"><Typography.Title level={4}>{title}</Typography.Title>{sections.map(([h,b])=><section key={h}><Typography.Title level={5}>{h}</Typography.Title><p style={{whiteSpace:'pre-wrap'}}>{b}</p></section>)}</div>
        <Space wrap><Button type="primary" onClick={()=>onTask(code === 'RESCUE_PLAN' ? '生成救援方案' : code === 'RESOURCE_REPORT' ? '生成周边资源报告' : code === 'RESCUE_EVAL' ? '评估救援效果' : code === 'EMERGENCY_BRIEF' ? '生成应急要情' : '生成态势报告')}>用安小能生成当前材料</Button><Button onClick={()=>void download('Word')}>下载 Word 样例</Button><Button onClick={()=>void download('PDF')}>下载 PDF 样例</Button><OriginalSystemLink eventId={profile.eventId} code={code} title={title} sourceId={`${profile.eventId}:sample:${code}`} sections={sections}/></Space>
      </> },
    ]}/>
    {warningOpen && (
      <OperationalFlows
        eventId={profile.eventId}
        eventName={profile.name}
        initial="预警推送"
        eventStage={profile.stage}
        onClose={() => setWarningOpen(false)}
        onTask={onTask}
      />
    )}
  </Card>;
}
