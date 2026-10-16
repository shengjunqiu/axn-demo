import { useState } from 'react';
import { Alert, Button, Card, Input, Select, Space, Switch, Tag, Typography } from 'antd';
import { SKILL_PLANS, type SkillPlan } from '@/seed/skillPlanning';
export default function SkillRuntimeDemo({skill}:{skill?:SkillPlan}) {
  const [id,setId]=useState(skill?.id??SKILL_PLANS[0].id),[enabled,setEnabled]=useState(true),[authorized,setAuthorized]=useState(false),[event,setEvent]=useState(''),[version,setVersion]=useState('v0.1.0'),[result,setResult]=useState('');
  const selected=skill??SKILL_PLANS.find(s=>s.id===id)!;
  const reset=()=>setResult('');
  return <Card size="small" title="Function Calling · 热插拔与权限隔离（模拟）">
    <Space orientation="vertical" size="middle" style={{width:'100%'}}>
      {!skill&&<Select aria-label="运行演示能力" style={{width:'100%'}} value={id} onChange={v=>{setId(v);reset();}} options={SKILL_PLANS.map(s=>({value:s.id,label:s.name}))}/>}
      <Space wrap><Switch aria-label="能力启用演示" checked={enabled} onChange={v=>{setEnabled(v);reset();}}/><span>{enabled?'已装载（模拟）':'已卸载（模拟）'}</span><Select aria-label="能力版本演示" value={version} onChange={v=>{setVersion(v);reset();}} options={['v0.1.0','v0.2.0-preview'].map(value=>({value,label:value}))}/></Space>
      <Input aria-label="能力调用事件" placeholder="填写当前授权事件 ID" value={event} onChange={e=>{setEvent(e.target.value);reset();}}/>
      <Space><Switch aria-label="事件权限演示" checked={authorized} onChange={v=>{setAuthorized(v);reset();}}/><span>具有此事件与此能力的授权（模拟）</span></Space>
      <Typography.Paragraph code style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere'}}>{JSON.stringify({type:'function',function:{name:selected.id.replace(/[^a-zA-Z0-9_]/g,'_'),description:selected.name,parameters:{type:'object',properties:{eventId:{type:'string'},inputVersion:{type:'string'},dataMode:{type:'string',enum:['mock']}},required:['eventId','inputVersion','dataMode'],additionalProperties:false}}},null,2)}</Typography.Paragraph>
      <Button onClick={()=>setResult(!enabled?'SKILL_UNAVAILABLE：能力已卸载，保留输入并回退人工处理。':!authorized?'PERMISSION_DENIED：无事件授权，未读取业务数据。':!event.trim()?'INVALID_ARGUMENT：缺少 eventId，拒绝调用。':JSON.stringify({traceId:crypto.randomUUID(),eventId:event,inputVersion:version,skill:selected.id,dataMode:'mock',status:'模拟契约校验通过',output:selected.output},null,2))}>模拟调用</Button>
      {result&&<Alert type={result.startsWith('{')?'success':'warning'} title="本次调用结果" description={<pre style={{whiteSpace:'pre-wrap',overflowWrap:'anywhere',margin:0}}>{result}</pre>}/>}
      <Tag>仅校验演示契约；不修改真实权限、服务注册或业务数据</Tag>
    </Space>
  </Card>;
}
