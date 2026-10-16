import { useState } from 'react'
import { APPROVAL_RECORDS, BRIEF_RECORDS, SUMMARY_RECORDS, SUPPLY_ITEMS, BUSINESS_NOTE, BUSINESS_SNAPSHOT, supplyExpected, supplyGap } from '../businessData'
import type { V2PageId } from '../constants'
import { ASSEMBLY_HEADERS, ASSEMBLY_ROWS } from '../assemblyData'
import { ActionButton, CellActions, DataTable, EventBar, Pagination, SectionHeader, SelectBox, Tabs } from '../components/chrome'
import type { WorkflowApplication } from '../logic/empowerment'
import { CANDIDATE_TEAMS } from '../logic/empowerment'

const EVENT_ROWS = [
  ['山西省太原市阳曲县暴雨灾情', '泥石流险情', '辰安科技武汉基地', '2026-10-10 10:37:18', '抢险中'],
  ['河北省石家庄市赞皇县电力火灾险情', '电力应急险情', '辰安科技测试', '2026-10-10 10:37:12', '抢险中'],
  ['重庆市城口县明中乡金池村险情', '堰塞湖险情', '重庆市应急管理局', '2026-10-03 18:28:45', '抢险结束'],
  ['河南省郑州市中牟县城市内涝灾情', '内涝险情', '郑州市防汛抗旱指挥部', '2026-09-21 15:30:58', '抢险结束'],
  ['西藏自治区日喀则市吉隆县山体滑坡', '山体滑坡险情', '应急管理部', '2026-09-18 11:51:52', '抢险结束'],
  ['湖南省郴州市桂东县山体滑坡灾情', '山体滑坡险情', '湖南省应急厅', '2026-09-10 16:03:14', '抢险结束'],
  ['福建省莆田市城厢区华亭镇灾情', '山体滑坡险情', '福建省应急管理厅', '2026-09-06 12:44:21', '抢险结束'],
  ['江西省吉安市遂川县高坪镇明坑村-山体滑坡灾情', '山体滑坡险情', '江西省应急管理厅', '2026-09-06 11:23:36', '抢险结束'],
]

export function EventsPage({ onNavigate }: { onNavigate: (page: V2PageId) => void }) {
  return (
    <>
      <SectionHeader title="事件信息列表" />
      <div className="content-scroll">
        <Tabs names={['抢险事件', '演训演练']} />
        <div className="filter">
          <label>标题： <input className="field-170" placeholder="请输入标题" /></label>
          <label>更新时间： <input className="field-340" placeholder="开始更新时间 → 结束更新时间" /></label>
        </div>
        <DataTable
          headers={['序号', '标题', '抢险类别', '调用单位', '更新时间', '抢险状态', '操作']}
          rows={EVENT_ROWS.map((row, index) => [index + 1, <span key={row[0]} title={row[0]}>{row[0]}</span>, row[1], row[2], row[3], row[4], <button key="go" type="button" className="small" onClick={() => onNavigate('response')}>处置响应</button>])}
        />
        <Pagination total={113} pages={12} />
      </div>
    </>
  )
}

export function OrdersPage({ onRecommend, applied }: { onRecommend?: () => void; applied?: WorkflowApplication }) {
  const rows = [
    [<SelectBox key="a" />, '南昌队常备中队', '中国安能/第二工程局/南昌分公司/南昌队', '54/54', '432.98', '5小时52分钟', '第一梯队（队伍机动）', '已返营', '50'],
    [<SelectBox key="b" />, '第二工程局南昌分公司永新项目部', '中国安能/第二工程局/南昌分公司/永新抽蓄项目部', '18/18', '136.39', '2小时07分钟', '—', '—', '—'],
    [<SelectBox key="c" />, '第三工程局武汉分公司梅江灌区项目部', '中国安能/第三工程局/武汉分公司/梅江灌区项目部', '0/0', '279.15', '4小时22分钟', '—', '—', '—'],
  ]
  return (
    <>
      <EventBar />
      <SectionHeader title="指令下发列表" actions={['预先号令', '取消号令', '队伍机动', '撤销指令', '切换地图'].map(label => <ActionButton key={label}>{label}</ActionButton>)} />
      <div className="content-scroll">
        <div className="note">注：列表中可能因队伍人员变动，出现队伍总人数小于已出动人数的情况</div>
        <div className="filter">
          <input className="field-210" placeholder="请输入队伍名称" />
          <input className="field-200" placeholder="请输入搜索范围　KM" />
          <select aria-label="队伍状态" defaultValue=""><option value="">选择队伍状态</option></select>
          <select aria-label="出动类型" defaultValue=""><option value="">队伍出动类型</option></select>
          <label className="checkbox"><SelectBox />只显示抽组队伍</label>
          <span className="spacer" />
          {onRecommend ? <ActionButton ai onClick={onRecommend}>AI推荐下发对象</ActionButton> : null}
          <ActionButton primary>搜索</ActionButton>
        </div>
        <DataTable headers={['', '队伍名称', '所属单位', '可调人数/总人数', '行进路程(km)', '行进时长', '出动类型', '队伍状态', '出动力量']} rows={applied ? rows.map((row, index) => [<input key={`${applied.savedAt}-${index}`} type="checkbox" aria-label="选择此项" defaultChecked={applied.selectedIds.includes(CANDIDATE_TEAMS[index].id)} />, ...row.slice(1)]) : rows} striped={false} />
        <Pagination total={140} pages={14} />
      </div>
    </>
  )
}

export function AssemblyPage() {
  return (
    <>
      <EventBar />
      <SectionHeader title="人装抽组" actions={<><ActionButton>指导组出动</ActionButton></>} />
      <div className="content-scroll">
        <DataTable
          headers={[...ASSEMBLY_HEADERS, '操作']}
          rows={ASSEMBLY_ROWS.map((row, index) => [...row.slice(0, 5), index === 0 ? `${row[5]} ✉` : row[5], <CellActions key={row[0]} labels={index === 0 ? ['人装抽组', '行进方案', '救援情况'] : ['人装抽组', '行进方案', '救援情况', '删除']} />])}
        />
      </div>
    </>
  )
}

export function ApprovalPage() {
  return (
    <>
      <EventBar />
      <div className="split-view">
        <div className="content-scroll">
          <SectionHeader title="出动报备与审批" actions={<><ActionButton>签收</ActionButton><ActionButton>审批</ActionButton></>} />
          <div className="filter">
            <input className="field-380" placeholder="请输入队伍名称" />
            <select aria-label="审批状态" defaultValue=""><option value="">请选择</option></select>
            <span className="spacer" />
            <ActionButton primary>搜索</ActionButton>
          </div>
          <div className="note">{BUSINESS_NOTE} 备勤候选不计入既有80人抽组。</div>
          <DataTable headers={['序号', '队伍名称', '所属单位', '出动人数', '队伍梯队', '机动方式', '状态', '登记时间', '操作']} rows={APPROVAL_RECORDS.map((row, index) => [index + 1, ...row, <CellActions key={row[0]} labels={['查看']} />])} />
          <Pagination total={APPROVAL_RECORDS.length} />
        </div>
        <aside className="side-panel">
          <div className="panel-heading">{'▤\u3000处理过程'}</div>
          <div className="approval-timeline">
            {['2026-09-05 07:40:00', '2026-09-05 07:25:00', '2026-09-05 07:10:00'].map(time => <div key={time}>{'◆\u3000南昌队'}<br />模拟报备流转记录<br />{time}</div>)}
          </div>
        </aside>
      </div>
    </>
  )
}

export function DocumentsPage() {
  return (
    <>
      <EventBar />
      <SectionHeader title="任务文书" actions={<><ActionButton>▧</ActionButton><ActionButton primary>☷</ActionButton></>} />
      <div className="content-scroll">
        <DataTable
          striped={false}
          headers={['队伍名称', '指令类型', '所属梯队', '指令单位', '更新日期', '归档状态', '操作']}
          rows={[['南昌队常备中队', '队伍机动', '第一梯队', '中国安能', '2026-09-06 11:48', '待归档', <CellActions key="ops" labels={['详情', '下载', '归档']} />]]}
        />
        <Pagination total={1} />
      </div>
    </>
  )
}

export function ForcesPage() {
  return (
    <>
      <EventBar />
      <div className="content-scroll">
        <Tabs names={['现场力量情况', '现场信息统计']} variant="flat" />
        <div className="filter">
          <input className="field-390" placeholder="请输入队伍梯队名称/联系人" />
          <span className="spacer" />
          <ActionButton primary>＋ 添加力量</ActionButton>
          <ActionButton primary>查询</ActionButton>
          <ActionButton>重置</ActionButton>
        </div>
        <DataTable
          headers={['序号', '队伍名称', '参与救援人数', '携带装备数', '联系人', '联系电话', '队伍状态', '操作']}
          rows={[
            ['1', '南昌队常备中队', '50', '42', '—', '—', '自行回撤', <CellActions key="a" labels={['编辑', '查看详情']} />],
            ['2', '指导组', '30', '3', '—', '—', '自行回撤', <CellActions key="b" labels={['编辑', '查看详情']} />],
          ]}
        />
        <Pagination total={2} />
      </div>
    </>
  )
}

export function SuppliesPage() {
  const [tab, setTab] = useState(0)
  const [query, setQuery] = useState('')
  const [search, setSearch] = useState('')
  const rows = SUPPLY_ITEMS.filter(item => item.name.includes(search.trim()))
  return (
    <>
      <EventBar />
      <div className="content-scroll">
        <div className="note">{BUSINESS_NOTE} 统计时点：{BUSINESS_SNAPSHOT}；需求为下一阶段需求。</div>
        <Tabs names={['初始物资', '现场物资需求', '物资消耗', '当前库存']} variant="pills" activeIndex={tab} onChange={setTab} />
        <div className="filter filter-end">
          <label>物资名称： <input className="field-250" placeholder="请输入物资名称" value={query} onChange={event => setQuery(event.target.value)} /></label>
          <ActionButton primary onClick={() => setSearch(query)}>查询</ActionButton>
          <ActionButton primary>导出Excel</ActionButton>
        </div>
        <DataTable headers={['序号', '物资名称', '所属队伍', '规格型号', '计量单位', ...([['期初数量'], ['需求数量', '可用库存', '缺口'], ['出库数量', '已消耗', '已出库未消耗'], ['期初', '入库', '出库', '账面结余', '可用库存', '账实差异']][tab])]} rows={rows.map((item, index) => [index + 1, item.name, item.team, item.spec, item.unit, ...([ [item.initial], [item.demand, item.stock, supplyGap(item)], [item.outgoing, item.consumed, item.outgoing - item.consumed], [item.initial, item.incoming, item.outgoing, supplyExpected(item), item.stock, item.stock - supplyExpected(item)] ][tab])])} />
        <div className="note">消耗属于已出库物资使用情况，不再重复扣减库存；账实差异＝可用库存－账面结余。不同单位不合计。{rows.length === 0 ? '当前查询无匹配物资，可清空条件重查。' : ''}</div>
        <Pagination total={rows.length} />
      </div>
    </>
  )
}

export function SummaryPage({ onGenerate, applied }: { onGenerate?: () => void; applied?: WorkflowApplication }) {
  return (
    <>
      <EventBar />
      <SectionHeader title="总结报告" actions={<><ActionButton onClick={onGenerate}>新建报告</ActionButton></>} />
      <div className="content-scroll">
        <div className="filter">
          <input className="field-340" placeholder="请输入报告名称" />
          <ActionButton primary>搜索</ActionButton>
        </div>
        <div className="note">{BUSINESS_NOTE}</div>
        <DataTable headers={['序号', '报告名称', '附件（盖章）', '状态', '编写部门', '编写人', '编写时间', '操作']} rows={[...(applied ? [[1, applied.title, '未盖章·草稿', '草稿', '待补充', '待补充', new Date(applied.savedAt).toLocaleString('zh-CN'), <ActionButton key="phone-draft" onClick={onGenerate}>查看草稿</ActionButton>]] : []), ...SUMMARY_RECORDS.map((row, index) => [index + (applied ? 2 : 1), ...row, <CellActions key={row[0]} labels={['查看']} />])]} />
        <Pagination total={SUMMARY_RECORDS.length + (applied ? 1 : 0)} />
      </div>
    </>
  )
}

export function BriefsPage() {
  return (
    <>
      <EventBar />
      <SectionHeader title="要情快报" actions={<ActionButton primary>新建快报</ActionButton>} />
      <div className="content-scroll">
        <div className="filter">
          <input placeholder="请输入快报名称" />
          <ActionButton primary>查询</ActionButton>
        </div>
        <div className="note">{BUSINESS_NOTE}</div>
        <DataTable headers={['序号', '快报名称', '上报单位', '上报时间', '状态', '要点', '操作']} rows={BRIEF_RECORDS.map((row, index) => [index + 1, ...row, <CellActions key={row[0]} labels={['查看']} />])} />
        <Pagination total={BRIEF_RECORDS.length} />
      </div>
    </>
  )
}

export function ReturnPage() {
  return (
    <>
      <EventBar />
      <SectionHeader title="回撤归建" actions={<><ActionButton>回撤指令</ActionButton><ActionButton>归建确认</ActionButton></>} />
      <div className="content-scroll">
        <DataTable
          headers={['队伍名称', '回撤人数', '回撤装备数', '队伍状态', '操作']}
          rows={[
            ['南昌队常备中队', '50', '42', '已返营', <CellActions key="a" labels={['查看详情', '归建记录']} />],
            ['指导组', '30', '3', '已返营', <CellActions key="b" labels={['查看详情', '归建记录']} />],
          ]}
        />
        <Pagination total={2} />
      </div>
    </>
  )
}
