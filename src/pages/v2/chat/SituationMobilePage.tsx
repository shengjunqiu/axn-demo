import { useRef, useState } from 'react'

const FACTS = [
  ['事件名称', '青岭村山体滑坡（模拟）'],
  ['发生时间', '2026-10-08T08:30:00+08:00'],
  ['事发地点', '青岭村后山坡体（模拟地点）'],
  ['险情类型', '山体滑坡'],
  ['处置状态', '处置中（持续跟踪）'],
  ['影响范围', '模拟坡体影响2个居民组与1段乡道（模拟）'],
  ['人员伤亡情况', '模拟接报受威胁26人，已转移20人，伤亡待核'],
  ['响应等级', '待核实'],
  ['数据时间', '2026-10-08T11:30:00+08:00 · 模拟数据'],
]

const STEPS = [
  '读取当前事件事实与处置状态',
  '汇聚舆情、气象、水文与监测记录',
  '核对安全区域、医疗资源与队伍时效',
  '形成灾情态势报告初稿',
]

const SOURCES = [
  {
    kind: '舆情',
    status: '模拟已汇聚 1/1',
    record: '青岭村山体滑坡（模拟）相关信息样例。属地渠道收到道路受影响与救援进展咨询2条；地点为青岭村后山坡体（模拟地点），线索需复核，不据此认定伤亡。',
    detail: '舆情监测适配器（本地模拟） · 2026-10-08T11:30:00+08:00',
  },
  {
    kind: '气象',
    status: '模拟已汇聚 1/1',
    record: '09:00 8mm；10:00 14mm；11:00 19mm；11:30 11mm（滑坡/崩塌监测适配器（本地模拟）',
    detail: '2026-10-08T11:30:00+08:00',
  },
  {
    kind: '水文',
    status: '模拟已汇聚 1/1',
    record: '青岭村后山坡体（模拟地点）周边沟道水位无明显上涨，通行条件仍待现场复核。',
    detail: '水文监测适配器（本地模拟） · 2026-10-08T11:30:00+08:00',
  },
]

/** 安小能抽屉底部嵌套的手机端态势报告页，对应桌面「生成态势报告」工作区。 */
export function SituationMobilePage() {
  const paperRef = useRef<HTMLElement>(null)
  const [stepsOpen, setStepsOpen] = useState(false)
  const [warningOpen, setWarningOpen] = useState(false)
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState('')

  const showPaper = () => paperRef.current?.scrollIntoView({ block: 'start', behavior: 'smooth' })

  const sendInstruction = () => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    setNote('已按模拟流程接收指令，不接入真实模型。请查看下方灾情态势报告。')
    showPaper()
  }

  return (
    <div className="chat-mobile-nest">
      <div className="sit-phone">
        <div className="sit-phone-screen">
          <div className="sit-phone-body">
          <button type="button" className="sit-pill" onClick={showPaper}>生成态势报告</button>
          <article className="sit-agent">
            <div className="sit-agent-head">
              <span className="sit-agent-mark" aria-hidden="true">◎</span>
              <div>
                <strong>态势感知智能体</strong>
                <p>研判灾情，核对队伍人员状态时效，形成含安全区域与医疗资源的态势报告 · 模拟执行</p>
              </div>
              <span className="sit-tag">已完成</span>
            </div>
            <p className="sit-task">任务已完成，执行过程与结果如下</p>
          </article>
          <article className="sit-card">
            <div className="sit-card-title">
              <span>生成态势报告</span>
              <span className="sit-tag">已完成</span>
              <span className="sit-tag sit-tag-plain">模拟数据</span>
            </div>
            <button type="button" className="sit-link" aria-expanded={stepsOpen} onClick={() => setStepsOpen(open => !open)}>
              {stepsOpen ? '收起执行详情' : '查看执行详情（4步）'}
            </button>
            {stepsOpen ? (
              <ol className="sit-steps">
                {STEPS.map(step => <li key={step}>{step}</li>)}
              </ol>
            ) : null}
            <dl className="sit-facts">
              {FACTS.map(([label, value]) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>{value}</dd>
                </div>
              ))}
            </dl>
            <button type="button" className="sit-ghost" aria-expanded={warningOpen} onClick={() => setWarningOpen(open => !open)}>打开预警推送</button>
            {warningOpen ? <p className="sit-warning">预警推送（模拟）：青岭村后山坡体影响 2 个居民组与 1 段乡道，已转移 20 人，伤亡待核。未接入真实推送渠道。</p> : null}
            <div className="sit-material">
              <span>建设材料</span>
              <strong>青岭村山体滑坡（模拟）· 灾情态势报告初稿（模拟）</strong>
              <button type="button" className="sit-ghost" onClick={showPaper}>查看</button>
            </div>
            {note ? <p className="sit-note">{note}</p> : null}
          </article>
          <article className="sit-paper" ref={paperRef}>
            <p className="sit-org">中国安能建设集团有限公司</p>
            <h3>灾情态势报告</h3>
            <p className="sit-doc-meta">应急态〔2026〕模拟草稿（模拟）</p>
            <p className="sit-doc-line"><span>2026年10月14日</span><span>签发：***</span></p>
            <h4>青岭村山体滑坡（模拟） · 灾情态势报告初稿（模拟）</h4>
            <h5>附表：多源汇聚覆盖与来源</h5>
            <ul className="sit-sources">
              {SOURCES.map(source => (
                <li key={source.kind}>
                  <p><span>{source.kind}</span><span>{source.status}</span></p>
                  <p>{source.record}</p>
                  <p>{source.detail}</p>
                </li>
              ))}
            </ul>
          </article>
          </div>
          <form className="sit-command" onSubmit={event => { event.preventDefault(); sendInstruction() }}>
            <input value={draft} placeholder="输入指令..." aria-label="输入态势指令" onChange={event => setDraft(event.target.value)} />
            <button type="submit" disabled={!draft.trim()}>发送</button>
          </form>
        </div>
      </div>
    </div>
  )
}
