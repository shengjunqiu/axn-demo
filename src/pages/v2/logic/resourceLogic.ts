/** 演示台账上的整队组合枚举：先满足硬约束，再按权重评分。 */
export const SKILL_LABELS = {
  search: '人员搜救',
  breaking: '破拆',
  engineering: '工程抢险',
  monitor: '风险监测',
  communication: '通信保障',
} as const

export const EQUIPMENT_LABELS = {
  search: '生命探测设备',
  breaking: '破拆装备',
  engineering: '工程机械',
  monitor: '监测设备',
  communication: '通信装备',
} as const

export const METRIC_LABELS = {
  time: '时效',
  distance: '距离',
  professional: '专业匹配',
  priority: '台账优先级',
  economy: '规模适配',
} as const

export type SkillKey = keyof typeof SKILL_LABELS
export type MetricKey = keyof typeof METRIC_LABELS

export interface LedgerTeam {
  id: string
  name: string
  people: number
  totalEquipment: number
  distance: number
  travelHours: number
  prepHours: number
  priority: number
  available: boolean
  routeOpen: boolean
  skills: Partial<Record<SkillKey, number>>
  equipment: Partial<Record<SkillKey, number>>
  source: string
  enabled?: boolean
}

export interface ResourceDemand {
  people: number
  requiredSkills: string[]
  prioritySkill: string
  equipment: Record<string, number>
}

export interface ResourceLimits {
  maxDistance: number
  maxArrival: number
  firstDeadline: number
  firstPeople: number
  maxTeams: number
  minLevel: number
}

export interface ResourceStrategy {
  name: string
  mode: string
  goal: string
  weights: Partial<Record<MetricKey, number>>
}

export interface ResourceGap {
  key: string
  label: string
  wanted: number
  supplied: number
  shortfall: number
  unit: string
}

export interface AssignedTeam extends LedgerTeam {
  eta: number
  assignedEquipment: Record<string, number>
  equipmentCount: number
  wave: string
}

export interface ResourceCombination {
  teams: AssignedTeam[]
  people: number
  maxEta: number
  firstEta: number | null
  firstPeople: number
  score: number
  equipmentCount: number
  metricScores: Record<MetricKey, number>
}

export interface SolveResult {
  errors: string[]
  excluded: Array<{ id: string; name: string; reasons: string[] }>
  eligible: Array<LedgerTeam & { eta: number }>
  scannedCount: number
  feasibleCount: number
  best: ResourceCombination | null
  gaps: ResourceGap[]
  alternatives: ResourceCombination[]
  closestNames?: string[]
}

const numeric = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value) && value >= 0
const integer = (value: unknown): value is number => numeric(value) && Number.isInteger(value)

export function skillLabel(key: string): string {
  return SKILL_LABELS[key as SkillKey] ?? key
}

export function equipmentLabel(key: string): string {
  return EQUIPMENT_LABELS[key as SkillKey] ?? key
}

export function solve(pool: LedgerTeam[], demand: ResourceDemand, limits: ResourceLimits, strategy: ResourceStrategy): SolveResult {
  const result: SolveResult = { errors: [], excluded: [], eligible: [], scannedCount: 0, feasibleCount: 0, best: null, gaps: [], alternatives: [] }
  const positive = (value: unknown): value is number => numeric(value) && value > 0
  if (!integer(demand.people) || demand.people < 1) result.errors.push('最低人数必须是正整数。')
  if (!demand.requiredSkills.length || demand.requiredSkills.some(key => !(key in SKILL_LABELS))) result.errors.push('请至少选择一种已定义的必要专业。')
  if (!demand.requiredSkills.includes(demand.prioritySkill)) result.errors.push('优先任务必须属于所选必要专业。')
  for (const [key, value] of Object.entries(demand.equipment || {})) {
    if (!(key in EQUIPMENT_LABELS) || !integer(value)) result.errors.push('专项装备数量必须是非负整数。')
  }
  for (const key of ['maxDistance', 'maxArrival', 'firstDeadline'] as const) {
    if (!positive(limits[key])) result.errors.push('距离和到场时限必须是有效正数。')
  }
  if (!integer(limits.firstPeople) || limits.firstPeople < 1 || !integer(limits.maxTeams) || limits.maxTeams < 1 || limits.maxTeams > 12 || !integer(limits.minLevel) || limits.minLevel < 1 || limits.minLevel > 3) {
    result.errors.push('首批人数必须为正整数，队伍上限或专业等级也须有效。')
  }
  if (limits.firstDeadline > limits.maxArrival) result.errors.push('首批到场时限不能晚于全部到场时限。')
  const metricKeys = Object.keys(METRIC_LABELS) as MetricKey[]
  const weightSum = metricKeys.reduce((sum, key) => sum + (strategy.weights[key] || 0), 0)
  if (!metricKeys.every(key => numeric(strategy.weights[key])) || weightSum <= 0) result.errors.push('评分权重必须非负，且至少有一项大于零。')
  if (!['parallel', 'tiered'].includes(strategy.mode)) result.errors.push('请选择统一机动或分梯次组织。')
  if (pool.length > 12) result.errors.push('演示枚举最多支持12个独立队伍单元。')
  if (new Set(pool.map(team => team.id)).size !== pool.length) result.errors.push('候选台账存在重复资源标识，不能重复计入。')
  if (result.errors.length) return result

  for (const team of pool) {
    const reasons: string[] = []
    if (team.enabled === false) reasons.push('用户未纳入候选')
    if (team.available !== true) reasons.push('可用状态未确认或无可调资源')
    if (team.routeOpen !== true) reasons.push('机动路线未确认可用')
    if (!integer(team.people) || team.people < 1) reasons.push('没有有效可调人数')
    if (!integer(team.totalEquipment)) reasons.push('装备总量无效')
    if (![team.distance, team.travelHours, team.prepHours].every(numeric)) reasons.push('距离、准备或行进时长未知')
    if (![1, 2, 3].includes(team.priority)) reasons.push('台账优先级未知')
    const stocks = Object.values(team.equipment || {})
    if (!stocks.every(integer) || stocks.reduce((sum, count) => sum + count, 0) > team.totalEquipment) reasons.push('专项库存与装备总量不一致')
    if (!Object.values(team.skills || {}).every(value => integer(value) && value <= 3)) reasons.push('专业能力分级无效')
    const eta = team.travelHours + team.prepHours
    if (numeric(team.distance) && team.distance > limits.maxDistance) reasons.push(`距离${team.distance}km超过${limits.maxDistance}km`)
    if (Number.isFinite(eta) && eta > limits.maxArrival) reasons.push(`预计到场${eta.toFixed(2)}小时超过${limits.maxArrival}小时`)
    if (reasons.length) result.excluded.push({ id: team.id, name: team.name, reasons })
    else result.eligible.push({ ...team, eta })
  }

  interface Scored {
    teams: Array<LedgerTeam & { eta: number }>
    people: number
    maxEta: number
    firstEta: number | null
    firstPeople: number
    metricScores: Record<MetricKey, number>
    score: number
    gaps: ResourceGap[]
    penalty: number
  }

  function evaluate(teams: Array<LedgerTeam & { eta: number }>): Scored {
    const people = teams.reduce((sum, team) => sum + team.people, 0)
    const stocks = Object.fromEntries((Object.keys(EQUIPMENT_LABELS) as SkillKey[]).map(key => [key, teams.reduce((sum, team) => sum + (team.equipment[key] || 0), 0)]))
    const bestGrades = Object.fromEntries(demand.requiredSkills.map(key => [key, Math.max(0, ...teams.map(team => team.skills[key as SkillKey] || 0))]))
    const firstTeams = teams.filter(team => team.eta <= limits.firstDeadline && (team.skills[demand.prioritySkill as SkillKey] || 0) >= limits.minLevel)
    const firstPeople = firstTeams.reduce((sum, team) => sum + team.people, 0)
    const firstItems = firstTeams.reduce((sum, team) => sum + (team.equipment[demand.prioritySkill as SkillKey] || 0), 0)
    const gaps: ResourceGap[] = []
    const gap = (key: string, label: string, wanted: number, supplied: number, unit: string) => {
      if (supplied < wanted) gaps.push({ key, label, wanted, supplied, shortfall: wanted - supplied, unit })
    }
    gap('people', '最低建议投入人数', demand.people, people, '人')
    gap('firstPeople', `首批${skillLabel(demand.prioritySkill)}力量（${limits.firstDeadline}小时内）`, limits.firstPeople, firstPeople, '人')
    gap('firstEquipment', `首批${equipmentLabel(demand.prioritySkill)}`, demand.equipment[demand.prioritySkill] || 0, firstItems, '台/套')
    demand.requiredSkills.forEach(key => gap(`skill:${key}`, `${skillLabel(key)}专业等级`, limits.minLevel, bestGrades[key] ?? 0, '级'))
    Object.entries(demand.equipment).forEach(([key, count]) => gap(`equipment:${key}`, equipmentLabel(key), count, stocks[key as SkillKey] ?? 0, '台/套'))
    const maxEta = Math.max(0, ...teams.map(team => team.eta))
    const firstEta = firstTeams.length ? Math.min(...firstTeams.map(team => team.eta)) : null
    const averageDistance = people ? teams.reduce((sum, team) => sum + team.distance * team.people, 0) / people : 0
    const abilityWeight = demand.requiredSkills.reduce((sum, key) => sum + (key === demand.prioritySkill ? 2 : 1), 0)
    const metricScores = {
      time: 100 * Math.max(0, 1 - maxEta / limits.maxArrival),
      distance: 100 * Math.max(0, 1 - averageDistance / limits.maxDistance),
      professional: 100 * demand.requiredSkills.reduce((sum, key) => sum + (bestGrades[key] ?? 0) * (key === demand.prioritySkill ? 2 : 1), 0) / (3 * abilityWeight),
      priority: people ? teams.reduce((sum, team) => sum + 100 * (4 - team.priority) / 3 * team.people, 0) / people : 0,
      economy: people ? 100 * Math.min(1, demand.people / people) : 0,
    }
    const score = metricKeys.reduce((sum, key) => sum + metricScores[key] * (strategy.weights[key] || 0) / weightSum, 0)
    return { teams, people, maxEta, firstEta, firstPeople, metricScores, score, gaps, penalty: gaps.reduce((sum, item) => sum + item.shortfall / Math.max(item.wanted, 1), 0) }
  }

  const feasible: Scored[] = []
  let closest: Scored | null = null
  for (let mask = 1; mask < 2 ** result.eligible.length; mask += 1) {
    result.scannedCount += 1
    const teams = result.eligible.filter((_, index) => mask & (1 << index))
    if (teams.length > limits.maxTeams) continue
    const combination = evaluate(teams)
    if (!combination.gaps.length) feasible.push(combination)
    else if (!closest || combination.penalty < closest.penalty || (combination.penalty === closest.penalty && combination.score > closest.score)) closest = combination
  }
  feasible.sort((a, b) => b.score - a.score || a.teams.length - b.teams.length || a.people - b.people || a.teams.map(team => team.id).join().localeCompare(b.teams.map(team => team.id).join()))
  result.feasibleCount = feasible.length
  if (!feasible.length) {
    result.gaps = (closest || evaluate([])).gaps
    result.closestNames = closest?.teams.map(team => team.name) || []
    return result
  }

  function allocate(combination: Scored): ResourceCombination {
    const teams: AssignedTeam[] = combination.teams.map(team => ({
      ...team,
      assignedEquipment: {},
      equipmentCount: 0,
      wave: strategy.mode === 'tiered' && team.eta > limits.firstDeadline ? '第二梯队' : strategy.mode === 'tiered' ? '第一梯队' : '统一机动',
    }))
    for (const [key, count] of Object.entries(demand.equipment)) {
      let remaining = count
      const sorted = [...teams].sort((a, b) => {
        if (key === demand.prioritySkill) {
          const early = (team: AssignedTeam) => team.eta <= limits.firstDeadline && (team.skills[key as SkillKey] || 0) >= limits.minLevel ? 1 : 0
          if (early(a) !== early(b)) return early(b) - early(a)
        }
        return (b.skills[key as SkillKey] || 0) - (a.skills[key as SkillKey] || 0) || a.eta - b.eta || a.priority - b.priority
      })
      for (const team of sorted) {
        const take = Math.min(remaining, team.equipment[key as SkillKey] || 0)
        if (take) {
          team.assignedEquipment[key] = take
          team.equipmentCount += take
          remaining -= take
        }
      }
    }
    return { ...combination, teams, equipmentCount: teams.reduce((sum, team) => sum + team.equipmentCount, 0) }
  }

  result.best = allocate(feasible[0]!)
  result.alternatives = feasible.slice(1, 3).map(allocate)
  return result
}
