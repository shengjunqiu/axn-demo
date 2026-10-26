/** 灾情动态的时间归并与影响分析。只使用演示报告，不回写业务数据。 */
export const DYNAMIC_FIELDS = {
  total: { label: '核实被困总人数', unit: '人' },
  rescued: { label: '累计救出人数', unit: '人' },
  remaining: { label: '尚待搜救人数', unit: '人' },
  houses: { label: '倒塌房屋', unit: '栋' },
  road: { label: '道路情况', unit: '' },
  risk: { label: '现场风险', unit: '' },
  stage: { label: '处置阶段', unit: '' },
  personnel: { label: '现场人数', unit: '人' },
  equipment: { label: '现场装备', unit: '台/套' },
} as const

export type DynamicFieldKey = keyof typeof DYNAMIC_FIELDS

export interface DynamicFactInput {
  key: string
  value: number | string | null
  scope?: string
  unit?: string
  correction?: boolean
}

export interface DynamicReport {
  id: string
  title: string
  time: string
  notes: string
  facts: DynamicFactInput[]
  observedAt: string
  status: string
  verified: boolean
}

export interface NormalizedFact {
  key: string
  value: number | string
  scope: string
  unit: string
  label: string
  reportId: string
  reportTitle: string
  time: string
  submittedAt: string
  effectiveTime: number
  correction?: boolean
}

export interface DynamicIssue {
  kind: string
  blocking?: boolean
  message: string
  reportIds: string[]
  resolved?: boolean
  resolution?: string
  key?: string
  effectiveTime?: number
  unit?: string | null
}

export interface MergeResult {
  latest: Record<string, NormalizedFact>
  changes: Array<{ key: string; previous: NormalizedFact; current: NormalizedFact; kind: string; decision: string }>
  issues: DynamicIssue[]
  excluded: Array<DynamicReport & { reason: string }>
  timeline: Array<DynamicReport & { observedAt: string; effectiveTime: number }>
}

export interface PlanBaselineSection {
  title: string
  text: string
}

export interface PlanBaseline {
  id: string
  event: string
  title: string
  facts: {
    total: number | null
    remaining: number | null
    houses: number | null
    stage: string | null
    road: string | null
    risk: string | null
  }
  sections: PlanBaselineSection[]
}

export interface ForceTeamBaseline {
  name: string
  personnel: number
  equipment: number
  task: string
}

export interface ForceBaseline {
  id: string
  event: string
  title: string
  teams: ForceTeamBaseline[]
}

export interface PlanImpactRow {
  key: string
  section: string
  original: string
  current: string
  suggestion: string
  reportId: string
  source: string
}

export interface PlanImpact {
  baselineId: string | null
  baselineTitle: string
  rows: PlanImpactRow[]
  complete: boolean
  canApply: boolean
}

export interface ForceImpactRow extends ForceTeamBaseline {
  actualPersonnel: number | null
  actualEquipment: number | null
  personnelDelta: number | null
  equipmentDelta: number | null
  taskChanged: boolean
  suggestion: string
  source: string
}

export interface ForceImpact {
  baselineId: string | null
  baselineTitle: string
  rows: ForceImpactRow[]
  hasImpact: boolean
  writeBack: false
  blocked: boolean
}

export function formatFact(fact: { value: number | string; unit?: string }): string {
  return `${fact.value}${fact.unit || ''}`
}

export function timestamp(value: string): number | null {
  const matched = String(value || '').match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/)
  if (!matched) return null
  const [year, month, day, hour, minute, second] = matched.slice(1).map(item => Number(item || 0))
  if (year === undefined || month === undefined || day === undefined || hour === undefined || minute === undefined || second === undefined) return null
  const stamp = Date.UTC(year, month - 1, day, hour, minute, second)
  const date = new Date(stamp)
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day || hour > 23 || minute > 59 || second > 59) return null
  return stamp - 8 * 3600000
}

export function mergeReports(reports: DynamicReport[]): MergeResult {
  const result: MergeResult = { latest: {}, changes: [], issues: [], excluded: [], timeline: [] }
  const candidates = new Map<string, NormalizedFact[]>()
  for (const report of reports) {
    if (report.status !== '已上报' || !report.verified) {
      result.excluded.push({ ...report, reason: report.status !== '已上报' ? '非已上报记录，不参与归并' : '内容未核实，不覆盖已核实情况' })
      continue
    }
    const observedAt = report.observedAt || report.time
    const effectiveTime = timestamp(observedAt)
    if (effectiveTime === null || timestamp(report.time) === null) {
      result.issues.push({ kind: 'time', blocking: true, message: `${report.title}的时间无效，未纳入最新情况。`, reportIds: [report.id] })
      continue
    }
    result.timeline.push({ ...report, observedAt, effectiveTime })
    for (const fact of report.facts || []) {
      if (fact.value === '' || fact.value === null || fact.value === undefined) continue
      const field = DYNAMIC_FIELDS[fact.key as DynamicFieldKey]
      const label = field?.label || fact.key
      const unit = fact.unit ?? field?.unit ?? ''
      const normalized: NormalizedFact = { ...fact, value: fact.value, label, unit, reportId: report.id, reportTitle: report.title, time: observedAt, submittedAt: report.time, effectiveTime, scope: fact.scope || '灾区' }
      if (unit && (!Number.isFinite(Number(fact.value)) || Number(fact.value) < 0)) {
        result.issues.push({ kind: 'value', blocking: true, message: `${report.title}的${label}不是有效非负数，未采用。`, reportIds: [report.id] })
        continue
      }
      normalized.value = unit ? Number(fact.value) : String(fact.value).trim()
      const key = `${fact.scope || '灾区'}|${fact.key}`
      const bucket = candidates.get(key) ?? []
      bucket.push(normalized)
      candidates.set(key, bucket)
    }
  }
  result.timeline.sort((a, b) => a.effectiveTime - b.effectiveTime || a.time.localeCompare(b.time) || a.id.localeCompare(b.id))
  for (const [key, values] of candidates) {
    const groups = new Map<number, NormalizedFact[]>()
    for (const fact of values.sort((a, b) => a.effectiveTime - b.effectiveTime)) {
      const group = groups.get(fact.effectiveTime) ?? []
      group.push(fact)
      groups.set(fact.effectiveTime, group)
    }
    let current: NormalizedFact | null = null
    for (const group of groups.values()) {
      const distinct = new Set(group.map(fact => JSON.stringify([fact.value, fact.unit])))
      const first = group[0]
      if (!first) continue
      if (distinct.size > 1) {
        result.issues.push({ kind: 'tie', blocking: true, message: `${first.time}，${first.scope}的${first.label}同时间报告不一致；保留此前确定值，待核实后重新分析。`, reportIds: group.map(fact => fact.reportId), key, effectiveTime: first.effectiveTime, unit: new Set(group.map(fact => fact.unit)).size === 1 ? first.unit : null })
        continue
      }
      const next = first
      if (current && current.unit !== next.unit) {
        result.issues.push({ kind: 'unit', blocking: true, message: `${next.scope}的${next.label}单位由“${current.unit}”变为“${next.unit}”，口径不一致，未覆盖。`, reportIds: [current.reportId, next.reportId], key })
        continue
      }
      if (current && current.value !== next.value) {
        const correction = next.key === 'total' || next.key === 'houses' || next.correction
        result.changes.push({ key, previous: current, current: next, kind: correction ? '口径修正' : '情况演变', decision: `采用${next.time}的${formatFact(next)}；不与旧值累加。` })
        if (next.key === 'rescued' && Number(next.value) < Number(current.value)) {
          result.issues.push({ kind: 'regression', blocking: true, message: `累计救出人数由${current.value}降至${next.value}，最新值虽已归并，但需确认统计修正原因后再更新方案。`, reportIds: [current.reportId, next.reportId] })
        }
      }
      current = next
    }
    if (current) result.latest[key] = current
    for (const issue of result.issues.filter(item => item.key === key && item.kind === 'tie')) {
      if (current && issue.effectiveTime !== undefined && current.effectiveTime > issue.effectiveTime && current.unit === issue.unit) {
        issue.resolved = true
        issue.resolution = `${current.time}的同口径已核实报告明确为${formatFact(current)}，采用较新记录。`
      }
    }
  }
  const total = result.latest['灾区|total']
  const rescued = result.latest['灾区|rescued']
  const remaining = result.latest['灾区|remaining']
  if (total && rescued && (Number(rescued.value) > Number(total.value) || (remaining && Number(rescued.value) + Number(remaining.value) !== Number(total.value)))) {
    result.issues.push({ kind: 'arithmetic', blocking: true, message: '最新累计救出、尚待搜救与被困总人数不一致，需核实统计口径后再更新方案。', reportIds: [total.reportId, rescued.reportId, remaining?.reportId].filter((id): id is string => !!id) })
  }
  const stage = result.latest['灾区|stage']
  if (stage?.value === '搜救完成' && (!remaining || remaining.value !== 0 || !total || !rescued || total.value !== rescued.value)) {
    result.issues.push({ kind: 'stage', blocking: true, message: '“搜救完成”与当前人数信息不匹配，不能据此进入回撤或结束阶段。', reportIds: [stage.reportId] })
  }
  return result
}

export function summarizeDynamics(result: MergeResult): string {
  const facts = Object.values(result.latest)
  if (!facts.length) return '没有可用的已核实报告正文，无法形成最新灾情总结。'
  const latestTime = result.timeline.at(-1)?.observedAt || '未明确'
  const unresolved = result.issues.filter(issue => !issue.resolved)
  const resolvedNote = result.issues.some(issue => issue.resolved) ? '\n早期同时间矛盾已被较新的同口径报告明确，保留处理轨迹。' : ''
  const excludedNote = result.excluded.length ? `\n未采用${result.excluded.length}条撤回、未上报或未核实报告。` : ''
  return `灾情动态总结（截至${latestTime}）\n按情况发生时间归并，同一对象、同一指标采用较新已核实记录；旧值不累加。\n\n${facts.map(fact => `${fact.scope}：${fact.label}为${formatFact(fact)}。（${fact.time}，${fact.reportTitle}）`).join('\n')}\n\n${unresolved.length ? `需核实事项：${unresolved.map(issue => issue.message).join('；')}` : '未发现未解决的数值或时间口径冲突。'}${resolvedNote}${excludedNote}`
}

export function planImpact(result: MergeResult, baseline?: PlanBaseline | null): PlanImpact {
  const rows: PlanImpactRow[] = []
  const facts = baseline?.facts
  const get = (key: string) => result.latest[`灾区|${key}`]
  const originalSection = (section: string, fallback: string) => baseline?.sections?.find(item => item.title === section)?.text || fallback
  const complete = get('stage')?.value === '搜救完成'
  const add = (key: keyof PlanBaseline['facts'], section: string, original: string, suggestion: string) => {
    const current = get(key)
    if (current && facts && facts[key] !== current.value) {
      rows.push({ key, section, original: originalSection(section, original), current: formatFact(current), suggestion, reportId: current.reportId, source: `${current.time} · ${current.reportTitle}` })
    }
  }
  add('total', '一、灾情基本情况', facts?.total == null ? '原方案未明确人数' : `原记录${facts.total}人（初报估计）`, '以最新核实口径更新人数；保留原初报说明，不把两次人数相加。')
  add('houses', '一、灾情基本情况', facts?.houses == null ? '原方案未明确倒塌房屋数' : `原记录${facts.houses}栋`, '按最新核实范围更新受影响房屋数量及现场核查重点，不与旧数累加。')
  add('remaining', '二、任务和救援目标', facts?.remaining == null ? '按被困人员搜救组织任务' : `初始尚待搜救${facts.remaining}人`, complete ? '人员搜救结果已闭合，建议由持续搜救转为风险监测、道路保障和任务交接；结束搜救仍需指挥人员确认。' : `围绕尚待搜救${get('remaining')?.value}人复核搜救目标、区域和保障需求，不自行确定结束搜救。`)
  add('stage', '四、救援行动安排', facts?.stage || '原方案按勘察、搜救、工程抢险顺序实施', complete ? '增加搜救结束确认、持续监测、任务交接与回撤准备阶段，不自动执行回撤。' : '按最新阶段复核行动顺序，未完成任务及转入条件需现场确认。')
  add('road', '四、救援行动安排', facts?.road || '原方案未明确现时道路条件', '按最新道路情况复核进出路线与投送安排；通行限制和作业条件仍由专业人员确认。')
  add('risk', '五、安全与保障措施', facts?.risk || '原方案要求现场风险监测', '将最新风险写入安全交底与监测重点；不得仅因搜救完成而取消警戒、监测或必要保障。')
  return {
    baselineId: baseline?.id || null,
    baselineTitle: baseline?.title || '未选择初始方案',
    rows,
    complete,
    canApply: !!baseline?.id && rows.length > 0 && !result.issues.some(issue => issue.blocking && !issue.resolved) && result.timeline.length > 0,
  }
}

export function forceImpact(result: MergeResult, baseline?: ForceBaseline | null): ForceImpact {
  const complete = result.latest['灾区|stage']?.value === '搜救完成'
  const rows = (baseline?.teams || []).map(team => {
    const people = result.latest[`${team.name}|personnel`]
    const equipment = result.latest[`${team.name}|equipment`]
    const personnelDelta = people ? Number(people.value) - team.personnel : null
    const equipmentDelta = equipment ? Number(equipment.value) - team.equipment : null
    const taskChanged = complete && /搜救/.test(team.task)
    const sources = [people, equipment].filter((fact): fact is NormalizedFact => !!fact).map(fact => `${fact.time} · ${fact.reportTitle}`)
    return {
      ...team,
      actualPersonnel: people ? Number(people.value) : null,
      actualEquipment: equipment ? Number(equipment.value) : null,
      personnelDelta,
      equipmentDelta,
      taskChanged,
      suggestion: `${people || equipment ? '核对原计划与报告在场数量的差额，确认返队、转任务或统计范围；差额不等于增援缺口。' : '最新报告没有该队伍数量，需核对实际在场人装，不能按零人处理。'}${taskChanged ? '建议从搜救任务转为必要监测、道路保障及回撤准备，具体保留人装数量待指挥核定。' : '继续复核指挥协调与保障职责，不自动改变抽组数量。'}`,
      source: sources.filter((value, index, all) => all.indexOf(value) === index).join('；') || '最新报告未提供该队伍数量',
    }
  })
  return {
    baselineId: baseline?.id || null,
    baselineTitle: baseline?.title || '未提供原始抽组方案',
    rows,
    hasImpact: rows.some(row => row.taskChanged || (row.personnelDelta !== null && row.personnelDelta !== 0) || (row.equipmentDelta !== null && row.equipmentDelta !== 0)),
    writeBack: false,
    blocked: result.issues.some(issue => issue.blocking && !issue.resolved),
  }
}
