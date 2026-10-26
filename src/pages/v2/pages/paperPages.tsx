import { V2_REPORT_STRUCTURE } from '../reportStructure'
import { BUSINESS_SNAPSHOT, SUPPLY_GAPS, SUPPLY_DIFFERENCES } from '../businessData'
import { TRANSPORT_HEADERS, TRANSPORT_ROWS } from '../additionalAiData'
import { DISASTER_TEXT, EVENT_NAME } from '../constants'
import { ActionButton, EventBar, PaperTable, PaperViewer, SectionHeader } from '../components/chrome'
import { SURROUNDINGS_DATA } from '../surroundingsData'
import { PLAN_SECTIONS, PLAN_VERSION_RECORDS } from '../planData'
import type { WorkflowApplication } from '../logic/empowerment'


export function SurroundingsPage() {
  return (
    <>
      <EventBar actions={<><ActionButton>↔ 切换事件</ActionButton><ActionButton>编辑</ActionButton><ActionButton>下载</ActionButton><ActionButton>⚙ 条件设置</ActionButton></>} />
      <PaperViewer pageCount={4}>
        <h1>江西省吉安市遂川县9月5日6时40分-{EVENT_NAME}<br />周边资源分析报告</h1>
        <h2>一、抢险基本信息</h2>
        <p>{DISASTER_TEXT}</p>
        <h2>{V2_REPORT_STRUCTURE.surroundings.titles[1]}</h2>
        <p>{SURROUNDINGS_DATA.summary}</p>
        <PaperTable headers={SURROUNDINGS_DATA.headers} rows={SURROUNDINGS_DATA.rows} />
        <h2>{V2_REPORT_STRUCTURE.surroundings.titles[2]}</h2>
        <p>其他央企队伍名称、能力、人数与可出动状态待补，不按零值统计。</p>
        <h2>{V2_REPORT_STRUCTURE.surroundings.titles[3]}</h2>
        <p>装备数量见上表；型号、技术状态、操作手配套及可调用数量待核。</p>
        <h2>{V2_REPORT_STRUCTURE.surroundings.titles[4]}</h2>
        <p>其他央企装备所属单位、型号、数量与可用状态待补。</p>
        <h2>{V2_REPORT_STRUCTURE.surroundings.titles[5]}</h2>
        <p>学校、医院、加油站等目标位置与受影响情况待核，没有资料不能认定安全。</p>
        <h2>{V2_REPORT_STRUCTURE.surroundings.titles[6]}</h2>
        <p>300公里为资源查询范围，不是灾害影响范围。摘要与明细不完整对应，须核对统计时间、数量、距离、可出动状态及道路天气，不直接合计或调派。</p>
      </PaperViewer>
    </>
  )
}

export function ResourcesPage({ onGenerate, applied }: { onGenerate?: () => void; applied?: WorkflowApplication }) {
  return (
    <>
      <EventBar actions={<>{onGenerate ? <ActionButton ai onClick={onGenerate}>AI生成调度建议</ActionButton> : null}<ActionButton>↔ 切换事件</ActionButton><ActionButton>编辑</ActionButton><ActionButton>下载</ActionButton><ActionButton>重新生成</ActionButton></>} />
      <PaperViewer pageCount={3}>
        <h1>{applied ? applied.title : <>{EVENT_NAME}<br />资源调度建议方案</>}</h1>
        {applied ? applied.sections.map(section => <section key={section.title}><h2>{section.title}</h2><p style={{ whiteSpace: 'pre-wrap' }}>{section.body}</p></section>) : <>
        <h2>一、灾情信息</h2>
        <p>{DISASTER_TEXT}</p>
        <h2>二、力量编成建议</h2>
        <p>根据中国安能建设集团有限公司自然灾害工程应急救援行动预案，建议配置人员125人，装备72台/套，详见下表。</p>
        <h3>力量编成建议表</h3>
        <PaperTable
          headers={['梯队', '任务类型', '人员数量（人）', '装备数量（台/套）', '主要能力']}
          rows={[
            ['第一梯队', '现场勘察、搜救与破拆', '65', '40', '搜救、破拆、工程抢险'],
            ['第二梯队', '工程处置、技术保障', '40', '24', '工程抢险、测绘监测'],
            ['后备力量', '后勤保障、机动支援', '20', '8', '物资保障、通信保障'],
          ]}
        />
        <h2>三、资源调度建议</h2>
        <p>结合任务需求和现有力量，按照梯次投入、专业互补的原则组织救援力量。</p>
        </>}
      </PaperViewer>
    </>
  )
}

export function TransportPage() {
  return (
    <>
      <EventBar actions={<><ActionButton>↔ 切换事件</ActionButton><ActionButton>编辑</ActionButton><ActionButton>下载</ActionButton><ActionButton>重新生成</ActionButton></>} />
      <PaperViewer pageCount={4}>
        <h1>{EVENT_NAME}<br />{V2_REPORT_STRUCTURE.transport.name}</h1>
        <h2>一、灾情信息</h2>
        <p>{DISASTER_TEXT}</p>
        <h2>二、力量编成</h2>
        <p>共抽组人员80人、装备45台（套）。</p>
        <h3>力量编成表</h3>
        <PaperTable
          headers={TRANSPORT_HEADERS}
          rows={TRANSPORT_ROWS}
        />
        <h2>三、投送安排</h2>
        <p>依据任务指令组织人员装备集结，完成出动准备后按梯队有序机动，途中保持信息联络。</p>
        <h2>四、保障要求</h2>
        <p>落实途中交通安全、通信联络与后勤保障，按规定反馈机动及到达情况。</p>
        <p>后续补给参考（{BUSINESS_SNAPSHOT}模拟台账）：缺{SUPPLY_GAPS}；{SUPPLY_DIFFERENCES}。先复核库存，再协调补给；此为后续保障候选，不改变原投送人装或反推初次装载。</p>
      </PaperViewer>
    </>
  )
}

export function PlanPage({ onGeneratePlan, applied }: { onGeneratePlan?: () => void; applied?: WorkflowApplication }) {
  return (
    <>
      <EventBar />
      <SectionHeader title="处置方案管理" actions={<>{onGeneratePlan ? <ActionButton ai onClick={onGeneratePlan}>AI生成处置方案</ActionButton> : null}<ActionButton>编辑</ActionButton><ActionButton>导出</ActionButton><ActionButton>重新生成</ActionButton></>} />
      <div className="split-view">
        <PaperViewer pageCount={4}>
          <h1>{applied ? applied.title : <>江西省吉安市遂川县山体滑坡险情<br /><br />{V2_REPORT_STRUCTURE.plan.name}</>}</h1>
          {(applied ? applied.sections.map(s => [s.title, s.body]) : PLAN_SECTIONS).map(([heading, text]) => <section key={heading}><h2>{heading}</h2><p>{text}</p></section>)}
        </PaperViewer>
        <aside className="side-panel">
          <div className="panel-heading"><span className="panel-tab active">版本记录</span></div>
          <div className="approval-timeline">{applied ? <div>手机端确认草稿<br />{new Date(applied.savedAt).toLocaleString('zh-CN')}<br />草稿·未发布<br />人工确认后应用</div> : null}{PLAN_VERSION_RECORDS.map(row => <div key={row[1]}>{row[0]}<br />{row[1]}<br />{row[2]}<br />{row[3]}</div>)}</div>
        </aside>
      </div>
    </>
  )
}
