import { useEffect, useRef, useState } from 'react'
import { Button, Input } from 'antd'
import { ArrowUp } from 'lucide-react'
import BrandMark from '@/components/brand/BrandMark'
import { AssistantMessage, ResourceList, UserMessage } from '@/components/common/ChatPrimitives'
import { BUSINESS_SNAPSHOT } from '../businessData'
import { EVENT_NAME } from '../constants'
import { RESOURCE_REPORT_READY, RESOURCE_REPORT_REQUEST } from '../surroundingsData'
import { CANDIDATE_TEAMS, EMPOWERMENT_LABELS, INITIAL_GENERATION_INPUT, WORKFLOW_APPLIED, WORKFLOW_APPLY, adjustGenerationRequest, candidateReview, generateDraft, matchingTeams, reportsInRange } from '../logic/empowerment'
import type { DraftSection, EmpowermentKind, GenerationInput, WorkflowApplication } from '../logic/empowerment'
import WorkflowDocument from './WorkflowDocument'
import WorkflowSources from './WorkflowSources'
import './empowerment-conversation.css'

interface DraftVersion { version: number; title: string; sections: DraftSection[]; input: GenerationInput; savedAt: string }
type ChatTurn = { role: 'user' | 'assistant'; text: string }
const intro: Record<EmpowermentKind, string> = {
  resources: '已根据当前事件、资源记录和任务背景整理调度建议。需求不明确的部分已标为待核，不影响先查看结果。',
  orders: '已按当前页面300公里范围列出有可调人数记录的候选队伍。未设置人数门槛；您可以直接说“200公里内，每队至少10人”调整结果。',
  plan: '已结合当前灾情、任务记录与原方案五章结构生成草稿。缺失依据已标为待核，您可以直接提出修改需求。',
  summary: '已根据事件全过程记录生成总结报告草稿，默认统计至现有数据截止时间。您可以直接提出关注重点或调整统计时间。',
}
export default function EmpowermentConversation({ kind }: { kind: EmpowermentKind }) {
  const [input, setInput] = useState({ ...INITIAL_GENERATION_INPUT })
  const [title, setTitle] = useState(`${EVENT_NAME}${kind === 'summary' ? '抢险任务总结报告' : kind === 'plan' ? '工程救援处置方案' : kind === 'orders' ? '指令草稿' : '资源调度建议方案'}`)
  const [sections, setSections] = useState<DraftSection[]>(() => generateDraft(kind, INITIAL_GENERATION_INPUT))
  const [turns, setTurns] = useState<ChatTurn[]>([])
  const [text, setText] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [selected, setSelected] = useState<string[]>(() => kind === 'orders' ? matchingTeams(INITIAL_GENERATION_INPUT.radius, '').map(t => t.id) : [])
  const [versions, setVersions] = useState<DraftVersion[]>([])
  const [pending, setPending] = useState(false)
  const request = useRef<string | null>(null)
  const awaiting = useRef<string | null>(null)
  const stream = useRef<HTMLDivElement>(null)
  const key = `v2-empowerment-${kind}-mingkeng`
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent || window.parent === window) return
      if (event.data?.type === RESOURCE_REPORT_REQUEST && event.data.kind === kind && typeof event.data.requestId === 'string') request.current = event.data.requestId
      if (event.data?.type === WORKFLOW_APPLIED && event.data.requestId === request.current && event.data.savedAt === awaiting.current) {
        awaiting.current = null; setPending(false)
        setMessage(kind === 'orders' ? '已将确认对象带回原指令列表并勾选。未下发指令。' : '已保存并带回原业务页，状态为草稿，未审批或发布。')
      }
    }
    window.addEventListener('message', onMessage)
    if (window.parent !== window) window.parent.postMessage({ type: RESOURCE_REPORT_READY }, window.location.origin)
    try {
      const data: unknown = JSON.parse(localStorage.getItem(key) || '[]')
      if (Array.isArray(data)) setVersions(data.filter((v): v is DraftVersion => !!v && typeof v.version === 'number' && typeof v.title === 'string' && Array.isArray(v.sections) && v.sections.every((s: DraftSection) => typeof s?.title === 'string' && typeof s?.body === 'string') && v.input && Object.keys(INITIAL_GENERATION_INPUT).every(k => typeof v.input[k] === 'string')))
    } catch { setMessage('历史草稿读取失败，仍可新建。') }
    return () => window.removeEventListener('message', onMessage)
  }, [key, kind])
  useEffect(() => { if (pending) { const timer = window.setTimeout(() => { setPending(false); setError('未收到业务页回执，本地草稿已保留，请确认原页面仍打开后重试。') }, 4000); return () => window.clearTimeout(timer) } }, [pending])
  useEffect(() => {
    if (!stream.current || (!turns.length && !message)) return
    const result = stream.current.querySelector<HTMLElement>('.axn-empowerment-result')
    stream.current.scrollTo({ top: message ? stream.current.scrollHeight : Math.max(0, (result?.offsetTop ?? 0) - stream.current.offsetTop), behavior: 'smooth' })
  }, [turns.length, message])
  const send = () => {
    const value = text.trim(); if (!value) return
    setText(''); setError(''); setMessage('')
    const result = adjustGenerationRequest(kind, value, input)
    if (result.input) {
      setInput(result.input); setSections(generateDraft(kind, result.input))
      setSelected(kind === 'orders' ? matchingTeams(result.input.radius, result.input.people).map(t => t.id) : [])
    }
    setTurns(v => [...v, { role: 'user', text: value }, { role: 'assistant', text: result.error ?? result.note ?? '已更新结果。' }])
  }
  const persist = (): DraftVersion | undefined => {
    if (!title.trim() || !sections.length || sections.some(s => !s.body.trim())) { setError('请补齐文稿标题与章节正文。'); return }
    const version = { version: Math.max(0, ...versions.map(v => v.version)) + 1, title, sections, input, savedAt: new Date().toISOString() }
    try { const next = [...versions, version]; localStorage.setItem(key, JSON.stringify(next)); setVersions(next); setError(''); return version }
    catch { setError('本地保存失败，请复制内容另行保存后重试。'); return }
  }
  const apply = () => {
    if (pending) return
    if (!request.current || window.parent === window) { setError('请从V2原页面的赋能按钮进入后应用。'); return }
    if (kind === 'orders' && !selected.length) { setError('当前没有选中的候选对象，不能带回原列表。'); return }
    const version = persist(); if (!version) return
    const selectedTeams = CANDIDATE_TEAMS.filter(t => selected.includes(t.id))
    const application: WorkflowApplication = {
      type: WORKFLOW_APPLY, eventId: 'mingkeng', requestId: request.current, kind, title,
      sections: kind === 'orders' ? sections.map((s, i) => i === 0 ? { ...s, body: `${s.body}\n人工确认对象：${selectedTeams.map(t => t.name).join('、')}` } : s) : sections,
      selectedIds: selected, savedAt: version.savedAt,
    }
    awaiting.current = version.savedAt; setPending(true); setMessage('正在带回原业务页…')
    window.parent.postMessage(application, window.location.origin)
  }
  const candidates = matchingTeams(input.radius, input.people)
  return <div className="axn-chat-page axn-empowerment-chat" data-testid="v2-phone-workflow">
    <div className="axn-chat-head"><strong>{EMPOWERMENT_LABELS[kind]}</strong><span>当前事件已关联</span></div>
    <div className="axn-empowerment-stream" ref={stream}>
      <AssistantMessage><p>{intro[kind]}</p><p className="axn-empowerment-source">{EVENT_NAME}<br />资料截止 {BUSINESS_SNAPSHOT} · 模拟数据</p></AssistantMessage>
      {turns.map((turn, index) => turn.role === 'user' ? <UserMessage key={index}>{turn.text}</UserMessage> : <AssistantMessage key={index}><p>{turn.text}</p></AssistantMessage>)}
      {sections.length > 0 && <AssistantMessage>
        <div className="axn-empowerment-result" data-testid="v2-phone-result">
          <strong>{kind === 'orders' ? '候选清单' : '公文已生成'}</strong>
          {kind === 'orders' ? <>
            <p>当前条件：历史行进路程{input.radius}公里内，{input.people ? `单队至少${input.people}人` : '未设置人数门槛'}。推荐项已默认勾选，其余记录保留并标明原因。</p>
            <div className="axn-agent-result" data-testid="v2-candidate-list">
              <ResourceList summary={{ label: '本页候选记录', value: `共${CANDIDATE_TEAMS.length}条 · 推荐${candidates.length}条 · 不推荐${CANDIDATE_TEAMS.length - candidates.length}条` }}
                items={candidateReview(input.radius, input.people).map(team => ({
                  name: team.name, kind: 'team', meta: `历史可调${team.people}人 · ${team.status}。${team.reason}`,
                  eta: `历史通行${team.travel}`, dist: `行进${team.km}公里`,
                  flag: <label className="axn-candidate-selection"><input type="checkbox" aria-label={`选择${team.name}`} disabled={!team.recommended} checked={team.recommended && selected.includes(team.id)} onChange={e => setSelected(v => e.target.checked ? [...v, team.id] : v.filter(id => id !== team.id))} /><span>{team.recommended ? '推荐候选' : '不推荐'}</span></label>,
                }))}
                foot="仅展示原页面已有的3条模拟记录。不推荐项不可勾选，确认带回仍不等于正式下发。" />
            </div>
            {!candidates.length && <p>当前条件下无推荐队伍。参考记录仍保留，不自动放宽筛选条件。</p>}
          </> : null}
          {kind === 'summary' ? <p className="axn-empowerment-source">统计范围：{input.start.replace('T', ' ')}至{input.end.replace('T', ' ')}，现场反馈{reportsInRange(input).length}条。</p> : null}
          {kind !== 'orders' ? <WorkflowDocument kind={kind} title={title} sections={sections} onSave={(nextTitle, nextSections) => { setTitle(nextTitle); setSections(nextSections); setMessage('公文修改已保存，尚未应用到原业务页。') }} /> : null}
          <div className="axn-empowerment-actions"><Button onClick={() => { const v = persist(); if (v) setMessage(`已保存手机端草稿V${v.version}，原业务页未改变。`) }}>保存手机端草稿</Button><Button type="primary" disabled={pending || (kind === 'orders' && !selected.length)} onClick={apply}>{kind === 'orders' ? '确认对象并带回原列表' : kind === 'summary' ? '保存并带回原报告列表' : '应用到原业务页'}</Button></div>
          <p>仅保存草稿或确认候选，不执行审批、指令下发或正式发布。</p>
          <WorkflowSources kind={kind} input={input} />
          <p className="axn-empowerment-source">待核验：实时路径、资源可用状态、有效预案条款及微信材料尚未接入，未作为已取得的依据。</p>
        </div>
      </AssistantMessage>}
      {versions.length > 0 && <AssistantMessage><details className="axn-empowerment-section"><summary>已保存草稿（{versions.length}版）</summary>{versions.map(v => <Button key={v.version} onClick={() => { setTitle(v.title); setInput(v.input); setSections(v.sections); setSelected([]); setMessage(`已载入V${v.version}，尚未应用到原业务页。`) }}>载入V{v.version}</Button>)}</details></AssistantMessage>}
      {error && <p role="alert" className="axn-empowerment-error">{error}</p>}
      {message && <p role="status" className="axn-empowerment-source">{message}</p>}
    </div>
    <form className="axn-empowerment-composer" onSubmit={e => { e.preventDefault(); send() }}><BrandMark size={24} /><Input aria-label="给安小能发消息" placeholder={kind === 'orders' || kind === 'resources' ? '直接说需求，例如200公里内、每队至少10人' : kind === 'summary' ? '例如：截止2026-09-05 18:00' : '直接提出修改需求…'} value={text} onChange={e => setText(e.target.value)} /><Button htmlType="submit" type="primary" aria-label="发送消息" icon={<ArrowUp size={16} />} disabled={!text.trim()} /></form>
  </div>
}
