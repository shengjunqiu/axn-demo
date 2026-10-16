import { useState } from 'react'
import { BUSINESS_NOTE, TASK_RECORDS } from '../businessData'
import { EVENT_NAME } from '../constants'
import { ActionButton, DataTable, EventBar, Pagination, SectionHeader, SelectBox, Tabs } from '../components/chrome'
import { MapGraphic } from '../components/MapGraphic'
import { reportListing } from '../logic/dynamicsReports'

const MEMBERS = [
  ['第一方向指导组', '组长', '吴汉明', '副总经理'],
  ['', '副组长', '王永平', '安全总监'],
  ['', '指挥', '王平武', '部门负责人'],
  ['', '技术', '项正军', '处长'],
  ['', '宣传', '赵洪亮', '职员'],
  ['', '保障', '史天宇', '职员'],
  ['第二方向指导组', '组长', '郭建和', '总经理'],
  ['', '副组长', '梁建忠', '副总经理'],
]

const ORG_ROLES = [['指挥控制组', '程占化'], ['技术保障组', '潘翔'], ['安全管理组', '刘耀华'], ['党建宣传组', '谭明裕'], ['综合保障组', '万强']]

function OrgPerson({ role, name }: { role: string; name: string }) {
  return <div className="org-person"><div className="role">{role}</div><div className="person">{name}</div></div>
}

export function ResponsePage() {
  return (
    <>
      <EventBar actions={<ActionButton primary>预案响应依据</ActionButton>} />
      <div className="response-layout">
        <section>
          <div className="plan-name">{'▤\u3000中国安能建设集团有限公司自然灾害工程应急救援行动预案 ⇄'}</div>
          <div className="response-card">
            <h3><span>1级响应</span><button type="button">确定响应</button></h3>
            <div>◇ 一省（自治区、直辖市）人员死亡和失踪200人以上可启动响应。其相邻省（自治区、直辖市）人员死亡和失踪160人以上200人以下可启动响应。</div>
            <div>◇ 一省（自治区、直辖市）紧急转移安置和需紧急生活救助200万人以上可启动响应。</div>
            <div>◇ 一省（自治区、直辖市）倒塌和严重损坏房屋30万间以上可启动响应。</div>
          </div>
          <div className="response-card orange">
            <h3><span>2级响应</span><button type="button">确定响应</button></h3>
            <div>◇ 一省（自治区、直辖市）人员死亡和失踪100人以上200人以下可启动响应。</div>
            <div>◇ 紧急转移安置、房屋损毁等其他启动条件详见预案。</div>
          </div>
        </section>
        <section>
          <div className="section-header section-header-tight">
            <h2 className="page-heading">选择指导组人员</h2>
            <div className="toolbar">{['添加', '出动', '到达', '删除', '取消出动', '归建'].map(label => <ActionButton key={label} small>{label}</ActionButton>)}</div>
          </div>
          <DataTable
            tableClassName="response-table"
            striped={false}
            headers={['大组', '组名', '姓名', '职务', '出动', '到达', '归建']}
            rows={MEMBERS.map(row => [row[0], row[1], <span key={row[2]} className="name-cell"><SelectBox /> {row[2]}</span>, row[3], '—', '—', '—'])}
          />
        </section>
        <aside className="response-info">
          <div className="panel-heading">{'▤\u3000响应情况'}</div>
          <p>暂无响应情况</p>
        </aside>
      </div>
    </>
  )
}

export function OrganizationPage() {
  return (
    <>
      <EventBar />
      <div className="content-scroll">
        <div className="section-header section-header-org">
          <Tabs names={['现场指挥所', '现场党委/党支部']} />
          <div className="toolbar"><ActionButton>编辑</ActionButton><ActionButton>⌖ 指挥所定位</ActionButton></div>
        </div>
        <h2 className="org-title">【{EVENT_NAME}】现场指挥所机构图</h2>
        <div className="org-chart">
          <h2>中国安能救援</h2>
          <OrgPerson role="指挥长" name="刘　剑" />
          <OrgPerson role="副指挥长" name="陈志宏" />
          <div className="org-branches">{ORG_ROLES.map(([role, name]) => <OrgPerson key={role} role={role ?? ''} name={name ?? ''} />)}</div>
        </div>
      </div>
    </>
  )
}

export function TasksPage() {
  const groups = ['全部', '指挥组', '技术组', '党建组', '安全组', '保障组', '指挥-处置组']
  const [group, setGroup] = useState(0)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('全部')
  const rows = TASK_RECORDS.filter(task => (group === 0 || task.group === groups[group]) && task.name.includes(query) && (status === '全部' || task.status === status))
  return (
    <>
      <EventBar />
      <SectionHeader title="联指受领任务" actions={<ActionButton primary>✎ 编辑</ActionButton>} />
      <div className="content-scroll">
        <div className="task-banner">明坑村现场救援任务（模拟）：开展被困人员搜救、便道通行核查、坡体监测与物资保障；以下为分工及进度演示。</div>
        <SectionHeader title="现场救援任务" actions={<ActionButton primary>＋新建任务</ActionButton>} />
        <div className="filter">
          <label>任务名称 <input className="field-370" placeholder="请输入任务名称" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <label>任务状态 <select className="field-270" value={status} onChange={event => setStatus(event.target.value)}>{['全部', '已完成', '进行中', '待协调'].map(value => <option key={value}>{value}</option>)}</select></label>
          <span className="spacer" />
          <ActionButton>查询</ActionButton>
          <ActionButton onClick={() => { setQuery(''); setStatus('全部'); setGroup(0) }}>重置</ActionButton>
        </div>
        <div className="note">{BUSINESS_NOTE}</div>
        <Tabs names={groups} variant="flat" activeIndex={group} onChange={setGroup} />
        <div className="task-grid task-grid-populated">
          <div><DataTable headers={['任务', '责任组', '负责人', '目标时限', '状态', '进展']} rows={rows.map(task => [task.name, task.group, task.owner, task.deadline, task.status, task.detail])} /><Pagination total={rows.length} />{rows.length === 0 && <div className="note">当前筛选无匹配任务，请切回“全部”。</div>}</div>
          <MapGraphic />
        </div>
      </div>
    </>
  )
}

export function DynamicsPage({ onOpenReport }: { onOpenReport: (id: string) => void }) {
  const rows = reportListing()
  return (
    <>
      <EventBar actions={<><ActionButton primary>新增</ActionButton></>} />
      <div className="content-scroll">
        <DataTable
          headers={['序号', '标题', '反馈组织/人员', '反馈时间', '状态', '操作']}
          rows={rows.map((report, index) => [
            index + 1,
            report.title,
            '中国安能 - 管理员',
            report.time,
            report.status,
            <div className="cell-actions" key={report.id}>
              <button type="button" className="small" onClick={() => onOpenReport(report.id)}>查看</button>
              <ActionButton small>撤回</ActionButton>
            </div>,
          ])}
        />
        <Pagination total={5} />
      </div>
    </>
  )
}

export function MapsPage() {
  return (
    <>
      <EventBar />
      <SectionHeader title="专题图制作" actions={<><ActionButton primary>新建专题图</ActionButton><ActionButton>编辑</ActionButton><ActionButton>导出</ActionButton></>} />
      <div className="content-scroll">
        <Tabs names={['救援力量分布图', '灾情专题图']} variant="flat" />
        <div className="map-block"><MapGraphic /></div>
      </div>
    </>
  )
}

const TIMELINE = [
  ['力量调度建议', '2026-10-11 14:23:15', '已生成调度建议方案', '江西省吉安市遂川县高坪镇明坑村-山体滑坡灾情资源调度建议方案.docx', '中国安能', '李霖枫'],
  ['救援总结', '2026-09-30 09:43:51', '救援总结', '南昌队救援总结报告.docx', '南昌队', '郭洋'],
  ['救援总结', '2026-09-30 09:40:40', '救援总结', '现场救援行动总结.docx', '南昌队', '郭洋'],
]

export function RecordsPage() {
  return (
    <>
      <EventBar />
      <div className="content-scroll">
        <div className="timeline-columns">
          <section className="timeline-panel">
            <div className="panel-heading">▣ 一张图展示信息 <span>↥</span></div>
            <div className="filter timeline-search">
              <input className="field-300" placeholder="请输入关键字" />
              <ActionButton small>⌕</ActionButton>
            </div>
            <div className="timeline-body">
              <div className="timeline-items">
                {TIMELINE.map(entry => (
                  <div className="timeline-item" key={entry[1]}>
                    <h3><span>{entry[0]}</span><span className="timeline-time">{entry[1]}</span></h3>
                    <p>{entry[2]}</p>
                    <p>▤ {entry[3]}</p>
                    <div className="meta"><span>{entry[4]}</span><span>{entry[5]}</span><ActionButton small danger>不显示</ActionButton></div>
                  </div>
                ))}
              </div>
              <div className="category-list">
                <span className="selected">◆ 全部</span>
                <br />◇ 信息接报<br />{'\u3000'} 上报信息<br />{'\u3000'} 信息转办
                <br />◇ 力量抽组<br />{'\u3000'} 指令下发<br />{'\u3000'} 抽组方案
                <br />◇ 分析研判<br />{'\u3000'} 周边分析<br />{'\u3000'} 力量调度建议
              </div>
            </div>
          </section>
          <section className="timeline-panel">
            <div className="panel-heading">▤ 未展示信息 <span>↥</span></div>
            <div className="filter timeline-search-loose">
              <input className="field-220" placeholder="请输入关键字" />
              <ActionButton small>⌕</ActionButton>
              <ActionButton small>新建记录</ActionButton>
            </div>
          </section>
        </div>
      </div>
    </>
  )
}
