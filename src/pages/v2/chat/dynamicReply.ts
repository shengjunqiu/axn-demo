import { clone } from '../logic/clone'
import { forceImpact, mergeReports, planImpact, summarizeDynamics } from '../logic/dynamicsLogic'
import { allReports } from '../logic/dynamicsReports'
import { DEMO_NOTICE, STARTERS, ask, replyOf } from './replyShared'
import type { EngineReply, EngineSession } from './types'

const quantity = (value: number | null, unit: string) => value == null ? '未报告' : `${value}${unit}`

export function dynamicReply(state: EngineSession, _original: string, normalized: string): EngineReply {
  const transferRequested = /带入|更新处置方案|根据总结修订/.test(normalized) || state.pending === 'dynamic-transfer-range'
  if (transferRequested && !state.lastDynamic && !/最新.*份|第\d|全部|所有|现场/.test(normalized)) {
    return ask(state, '请先说明要采用的报告范围，例如“最新两份”，我会先汇总这个范围，再将可采用更新带入处置方案。', 'dynamic-transfer-range')
  }
  const all = allReports()
  const newest = [...all].reverse()
  let ids = state.reportIds
  const latest = normalized.match(/最新(?:的)?(\d+)份/)
  if (latest?.[1]) ids = newest.slice(0, Number(latest[1])).map(report => report.id)
  else if (/全部|所有/.test(normalized)) ids = newest.map(report => report.id)
  else if (/(?:分析|汇总|选择|第\d)/.test(normalized) && /只分析|只汇总|仅分析|第\d|现场/.test(normalized)) {
    let scope = normalized.replace(/^.*?(?:只分析|只汇总|仅分析|分析|汇总|选择)/, '')
    if (/第/.test(scope)) {
      const indices = scope.match(/\d+/g) || []
      if (indices.some(index => Number(index) < 1 || Number(index) > newest.length)) return ask(state, '当前列表只有5份报告，请说明有效序号，例如“第1和第3份”。', 'dynamic-range')
      ids = [...new Set(indices.map(index => newest[Number(index) - 1]?.id).filter((id): id is string => !!id))]
    } else if (/现场/.test(scope)) {
      const matched: string[] = []
      for (const report of [...newest].sort((a, b) => b.title.length - a.title.length)) {
        if (scope.includes(report.title)) {
          matched.push(report.id)
          scope = scope.split(report.title).join(' ')
        }
      }
      ids = newest.filter(report => matched.includes(report.id)).map(report => report.id)
    } else return ask(state, '你希望分析哪几份报告？可以回复“最新两份”或“第1和第3份”（序号对应当前页面列表）。', 'dynamic-range')
  }
  if (!ids.length) return ask(state, '当前范围没有匹配报告。请说“分析全部”或“分析最新两份”。', 'dynamic-range')
  state.reportIds = ids
  state.pending = null
  const selected = all.filter(report => ids.includes(report.id))
  const analysis = mergeReports(selected)
  const plan = planImpact(analysis, state.context.initialPlan)
  const forces = forceImpact(analysis, state.context.initialForces)
  state.lastDynamic = { analysis, plan, forces }
  state.revision += 1
  if (transferRequested) {
    if (!plan.canApply) return replyOf('本轮选中报告存在未解决的冲突或没有可采用更新，暂不带入方案；不会沿用旧范围的总结。请先核实当前范围与事实。', [], STARTERS.dynamics)
    return replyOf(`已按当前${selected.length}份报告整理动态总结和章节更新，将带入同一事件的处置方案对话；原方案保持不变。`, [], [], {
      transfer: {
        event: state.context.event,
        summary: summarizeDynamics(analysis),
        baselineId: state.context.initialPlan.id,
        baselineTitle: plan.baselineTitle,
        planRows: clone(plan.rows),
        complete: plan.complete,
        latestFacts: clone(analysis.latest),
        resourceSummary: forces.rows.map(row => `${row.name}最新报告人数${quantity(row.actualPersonnel, '人')}、装备${quantity(row.actualEquipment, '台/套')}；原计划${row.personnel}人、${row.equipment}台/套。`).join(' '),
      },
    })
  }
  const provenance = `本轮仅分析${selected.length}份演示正文样本：${selected.map(report => `${report.title}（${report.time}）`).join('；')}。核实状态为样例设定，不代表AI核验真实附件。`
  const summaryResult = {
    title: '灾情动态总结',
    kind: 'summary',
    paragraphs: [provenance, summarizeDynamics(analysis), '同一对象、同一指标采用后覆盖前；累计人数不叠加，未知信息不当作零。', ...analysis.issues.map(issue => `${issue.resolved ? '已处理' : '需核实'}：${issue.message}`), DEMO_NOTICE],
  }
  const planResult = {
    title: '救援方案更新建议',
    kind: 'summary',
    paragraphs: [`对比基准：${plan.baselineTitle}。`, plan.rows.length ? '以下章节受本轮动态影响；不直接替换原文。' : '本轮未发现可定位的章节更新。'],
    table: { headers: ['原方案章节', '最新变化', '更新建议'], rows: plan.rows.map(row => [row.section, row.current, row.suggestion]) },
  }
  const forceResult = {
    title: '力量抽组影响',
    kind: 'summary',
    paragraphs: [`对比基准：${forces.baselineTitle}。差额不等于增援缺口，未报告队伍不按零人处理。`, DEMO_NOTICE],
    table: { headers: ['队伍', '原计划 / 最新人数', '原计划 / 最新装备', '调整建议'], rows: forces.rows.map(row => [row.name, `${row.personnel}人 / ${quantity(row.actualPersonnel, '人')}`, `${row.equipment}台套 / ${quantity(row.actualEquipment, '台套')}`, row.suggestion]) },
  }
  const follow = plan.canApply ? ['将更新带入处置方案', '帮我生成灾情动态汇总报告', '根据最新进展，后续救援怎么安排？'] : STARTERS.dynamics
  if (/目前|进展怎么样|现在.*(?:情况|进展)/.test(normalized)) {
    return replyOf(`已根据${selected.length}份选中报告整理当前进展，以报告记录时间为准，不代表实时现场数据。`, [{ title: '当前灾情与救援进展', kind: 'dynamic-status', paragraphs: [summarizeDynamics(analysis), provenance, DEMO_NOTICE] }], STARTERS.dynamics)
  }
  if (/后续|怎么安排|有什么影响|哪些影响/.test(normalized)) {
    return replyOf(`最新报告${plan.complete ? '显示人员搜救结果已闭合，建议将工作重心转向必要风险监测、道路保障与任务交接' : '仍有未完成任务，建议结合最新处置阶段安排力量'}。下面分别说明处置方案和力量抽组的调整建议，实际采用由指挥确认。`, [planResult, forceResult], plan.canApply ? ['将更新带入处置方案', '帮我生成灾情动态汇总报告'] : STARTERS.dynamics)
  }
  if (/生成.*汇总报告|动态汇总报告/.test(normalized)) return replyOf(`已将${selected.length}份报告按时间整理为动态汇总报告，同一指标采用最新有效记录，不重复累加累计人数。`, [summaryResult], STARTERS.dynamics)
  return replyOf(`已汇总${selected.length}份报告，并整理处置方案与力量抽组两类影响。`, [summaryResult, planResult, forceResult], follow)
}
