import { useState } from 'react';
import { Alert, Button, Checkbox, Input, Select, Space, Table, Tag } from 'antd';
import type { DisasterProfile } from '@/seed/disasterScenarios';
import { resourceComposition } from '@/services/tenderScenario';
import OriginalSystemLink from '@/components/chat/OriginalSystemLink';
export default function ResourceComposition({profile}:{profile:DisasterProfile}) {
  const [scale,setScale]=useState(1),[blocked,setBlocked]=useState(false),[priority,setPriority]=useState('专业匹配优先'),[owner,setOwner]=useState(''),[confirmed,setConfirmed]=useState(false);
  const rows=resourceComposition(profile,scale,blocked);
  const text=`灾种：${profile.category}\n目标：${profile.objective}\n约束：${priority}；${blocked?'主路阻断，备用通道待核':'主通道待核'}\n${rows.map(r=>`${r.name} / 需求 ${r.requested??'待核'}${r.unit} / 现有 ${r.amount} / 缺口 ${r.gap??'待核'}${r.unit} / ${r.capability}`).join('\n')}\n确认人：${owner}；${confirmed?'已确认模拟建议':'待确认'}\n定位、距离、ETA、适配参数和实际可调用状态待核；未正式调派。`;
  return <Space orientation="vertical" style={{width:'100%'}} size="middle">
    <Alert type="info" showIcon title="智能编组推荐" description={`${profile.category} · 按本事件专业资源和任务规模组合。数量为模拟库存；选择约束会更新待核条件，不声称已计算真实最优方案。`}/>
    <Space wrap><Select aria-label="编组任务规模" value={scale} onChange={v=>{setScale(v);setConfirmed(false);}} options={[{value:1,label:'基线任务'},{value:1.5,label:'增援任务（扩大50%）'},{value:2,label:'增援任务（扩大100%）'}]}/><Select aria-label="编组推荐约束" value={priority} onChange={v=>{setPriority(v);setConfirmed(false);}} options={['专业匹配优先','时效优先','保障优先'].map(value=>({value,label:value}))}/><Checkbox checked={blocked} onChange={e=>{setBlocked(e.target.checked);setConfirmed(false);}}>主路灾害阻断（模拟）</Checkbox></Space>
    <Table size="small" pagination={false} rowKey="id" scroll={{x:720}} dataSource={rows} columns={[{title:'推荐资源',dataIndex:'name'},{title:'专业能力',dataIndex:'capability'},{title:'需求／库存',render:(_,r)=>`${r.requested??'待核'}${r.unit} / ${r.amount}`},{title:'缺口',render:(_,r)=><Tag color={r.gap?'orange':'default'}>{r.gap??'待核'}{r.unit}</Tag>},{title:'通行条件',dataIndex:'route'},{title:'可调用状态',dataIndex:'status'}]}/>
    <Alert type="warning" title="距离时效与资格核查" description={`${priority}：${priority==='时效优先'?'需补各资源位置、交通方式和ETA后比较':priority==='保障优先'?'需先确认通信、医疗、后勤配套和保障持续时间':'需核对人员资质、装备性能和当前灾种作业条件'}。${blocked?'主路阻断时不得沿原路出动，备用通道需通行岗位确认。':''}${profile.gaps}`}/>
    <Input aria-label="专业编组确认人" value={owner} onChange={e=>{setOwner(e.target.value);setConfirmed(false);}} placeholder="填写编组建议核对人"/>
    <Space wrap><Button type="primary" disabled={!owner.trim()} onClick={()=>setConfirmed(true)}>确认模拟编组建议</Button>{confirmed&&<Tag color="blue">{owner} 已核对 · 待正式调派</Tag>}<OriginalSystemLink code="编组确认" eventId={profile.eventId} title={`${profile.name} · 智能编组推荐（模拟）`} sourceId={`${profile.eventId}:composition:${scale}:${blocked}:${priority}`} sections={[["资源建议",text]]}/></Space>
  </Space>;
}
