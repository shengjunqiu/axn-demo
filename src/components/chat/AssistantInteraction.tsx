import { useEffect, useState } from 'react';
import { Alert, Button, Card, Descriptions, Input, Select, Space, Switch, Tag } from 'antd';
export default function AssistantInteraction({onTask}:{onTask?:(text:string)=>void}) {
  const [wake,setWake]=useState('安小能'),[language,setLanguage]=useState('普通话'),[network,setNetwork]=useState('在线'),[channel,setChannel]=useState('H5网页端'),[text,setText]=useState(''),[listening,setListening]=useState(false),[playing,setPlaying]=useState(false);
  useEffect(()=>()=>{if('speechSynthesis' in window)window.speechSynthesis.cancel();},[]);
  const canSpeak='speechSynthesis' in window;
  const stop=()=>{if(canSpeak)window.speechSynthesis.cancel();setPlaying(false);setListening(false);};
  return <Space orientation="vertical" size="middle" style={{width:'100%'}}>
    <Alert title="应急助手场景" type="info" showIcon description="配置唤醒词、交互语言和弱网降级，体验识别文本校对、播报与紧急打断。语音识别、方言及数字人是流程演示，未连接识别服务。"/>
    <Space wrap><label>唤醒词 <Input aria-label="自定义唤醒词" value={wake} maxLength={16} onChange={e=>{setWake(e.target.value);stop();}} style={{width:150}}/></label><label>交互语言 <Select aria-label="交互语言" value={language} onChange={v=>{setLanguage(v);stop();}} options={['普通话','四川方言（演示）','湖南方言（演示）'].map(value=>({value,label:value}))}/></label></Space>
    <Space wrap><Select aria-label="交互终端" value={channel} onChange={setChannel} options={['H5网页端','移动APP端（交互演示）','微信生态端（交互演示）','大屏数字人（交互演示）'].map(value=>({value,label:value}))}/><Select aria-label="网络环境" value={network} onChange={setNetwork} options={['在线','弱网','离线'].map(value=>({value,label:value}))}/><Tag>{channel} · {network}</Tag></Space>
    <Card size="small" title="语音交互能力"><Space wrap><Switch aria-label="唤醒交互演示" checked={listening} disabled={!wake.trim()} onChange={v=>{setListening(v);setText('');}}/><span>{listening?`已唤醒「${wake}」· 等待识别文本（演示）`:'尚未唤醒'}</span><Button disabled={!listening} onClick={()=>setText('多源数据汇聚')}>载入识别文本样例</Button></Space><Input.TextArea aria-label="识别文本校对" placeholder="确认识别文本；当前不采集麦克风" value={text} onChange={e=>setText(e.target.value)} rows={3} style={{marginTop:12}}/><Space wrap style={{marginTop:12}}><Button disabled={!text.trim()||!onTask||network==='离线'} onClick={()=>{onTask?.(text);setListening(false);}}>确认文本并交给安小能</Button><Button disabled={!text.trim()||!canSpeak||playing} onClick={()=>{const u=new SpeechSynthesisUtterance(text);u.lang='zh-CN';u.onend=()=>setPlaying(false);u.onerror=()=>setPlaying(false);window.speechSynthesis.speak(u);setPlaying(true);}}>语音合成播报</Button><Button danger disabled={!playing&&!listening} onClick={stop}>紧急打断</Button></Space>{!canSpeak&&<p>当前浏览器不支持语音合成，可使用文字交互。</p>}</Card>
    <Alert type={network==='在线'?'info':'warning'} title="端云协同与弱网降级" description={network==='离线'?'离线模式仅演示查看已有事件资料、编辑本地草稿；云端识别、检索及外部推送暂停，待恢复网络后人工核对。':network==='弱网'?'弱网模式优先查看本地事件与缓存材料，外部同步显示待重试；不把未同步内容标为已办理。':'在线模式演示调用任务与材料联动；当前使用本地模拟数据。'}/>
    <Descriptions column={1} size="small" title="核心业务能力" items={[{key:'summary',label:'多源灾情摘要获取',children:'招标目标：10秒内'},{key:'resource',label:'资源查询',children:'招标目标：秒级'},{key:'plan',label:'救援方案生成',children:'招标目标：5分钟内'},{key:'document',label:'文书初稿撰写',children:'招标目标：1分钟内'},{key:'qa',label:'行业知识问答',children:'招标目标：30秒内'}]}/>
    <Tag>识别准确率≥95%为招标验收目标，原型未进行性能或准确率验收</Tag>
  </Space>;
}
