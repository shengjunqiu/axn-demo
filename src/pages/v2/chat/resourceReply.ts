import { clone } from '../logic/clone'
import { resourcePool } from '../logic/resourceData'
import { EQUIPMENT_LABELS, METRIC_LABELS, equipmentLabel, skillLabel, solve, type MetricKey, type SkillKey } from '../logic/resourceLogic'
import { DEMO_NOTICE, STARTERS, ask, replyOf } from './replyShared'
import type { ChatResult, EngineReply, EngineSession } from './types'

const SKILL_ALIAS: Record<string, string> = { 搜救: 'search', 破拆: 'breaking', 工程: 'engineering', 监测: 'monitor', 通信: 'communication' }
const PURPOSE: Record<string, string> = {
  search: '人员线索与搜救协同',
  breaking: '专业破拆保障',
  engineering: '工程与道路保障',
  monitor: '险情监测与风险反馈',
  communication: '指挥联络与状态反馈',
}

function stock(values: Record<string, number>): string {
  return Object.entries(values).filter(([, count]) => count).map(([key, count]) => `${equipmentLabel(key)}${count}台/套`).join('、') || '无需求专项装备'
}

/** 把一句话里的距离、时限、人数和专业改成可计算条件，再枚举整队组合。 */
export function resourceReply(state: EngineSession, original: string, normalized: string): EngineReply {
  if (/-\d+(?:\.\d+)?\s*(?:公里|千米|km|小时|人|台|套|支|级)/i.test(normalized)) {
    return ask(state, '资源数量、距离和时限不能为负数。请重新说明要修改的条件。', 'resource-correction')
  }
  const next = clone(state.resource)
  let updated = false
  const take = (match: RegExpMatchArray | null) => {
    const value = match?.[1]
    return value === undefined ? null : Number(value)
  }
  const setLimit = (match: RegExpMatchArray | null, key: 'maxDistance' | 'maxArrival' | 'firstDeadline' | 'firstPeople' | 'maxTeams' | 'minLevel') => {
    const value = take(match)
    if (value !== null) {
      next.limits[key] = value
      updated = true
    }
  }
  const peopleMatch = normalized.match(/(?:至少|最低|不少于|投入|编成|需要|人数(?:改为|为|是|改成)?)\s*(\d+)\s*人/)
  const peopleCount = take(peopleMatch)
  if (peopleCount !== null) {
    next.demand.people = peopleCount
    updated = true
  }
  const first = normalized.match(/(?:首批|第1批)[^。；，,]*?(\d+(?:\.\d+)?)\s*小时/)
  setLimit(normalized.match(/(-?\d+(?:\.\d+)?)\s*(?:公里|千米|km)/i), 'maxDistance')
  setLimit(first, 'firstDeadline')
  const withoutFirst = normalized.replace(/(?:首批|第1批)[^。；，,]*/g, '')
  const arrival = withoutFirst.match(/(\d+(?:\.\d+)?)\s*小时(?:内)?(?:到场|到达)/) || withoutFirst.match(/(?:全部|所有)?(?:到场|到达)(?:时限|时间)?(?:改为|不超过|为|是|改成|在|控制在)?\s*(\d+(?:\.\d+)?)\s*小时/)
  setLimit(arrival, 'maxArrival')
  if (arrival && !first && next.limits.firstDeadline > next.limits.maxArrival) next.limits.firstDeadline = next.limits.maxArrival
  setLimit(normalized.match(/(?:首批|第1批)[^。；，,]*?(\d+)\s*人/), 'firstPeople')
  setLimit(normalized.match(/(?:最多|不超过|队伍上限(?:改为|为|是)?)\s*(\d+)\s*(?:支|个)?队伍/), 'maxTeams')
  setLimit(normalized.match(/(?:专业|能力)(?:最低)?(?:等级)?(?:至少|不低于|改为|为)?\s*(\d)\s*级/), 'minLevel')
  for (const [key, label] of Object.entries(EQUIPMENT_LABELS)) {
    const match = normalized.match(new RegExp(`(?:${label}|${key === 'search' ? '生命探测' : label})(?:至少|需要|改为|为|需求)?\\s*(\\d+)\\s*(?:台|套)`))
    const count = take(match)
    if (count !== null) {
      next.demand.equipment[key] = count
      updated = true
    }
  }
  const profession = /优先(?:.*?)(搜救|破拆|工程|监测|通信)/.exec(normalized)
  if (profession?.[1]) {
    const skill = SKILL_ALIAS[profession[1]]
    if (skill) {
      next.demand.prioritySkill = skill
      updated = true
    }
  }
  const excluded = /(?:排除|不考虑|不要|剔除)(?:.*?)(南昌|永新|吉安|监测分队|工程保障)/.exec(normalized)
  if (excluded?.[1]) {
    const keyword = excluded[1]
    const ids = resourcePool().filter(team => team.name.includes(keyword)).map(team => team.id)
    next.enabled = next.enabled.filter(id => !ids.includes(id))
    updated = true
  }
  if (/全部(?:资源|候选)|恢复候选/.test(normalized)) {
    next.enabled = resourcePool().filter(team => team.available).map(team => team.id)
    updated = true
  }
  if (/调整|改|控制|限制|以内|优先|近一点|快一点|至少|排除|不考虑/.test(normalized + original) && !updated && !/策略|方案|分梯次|专业能力|快速到场/.test(normalized)) {
    if (/距离|半径|近/.test(normalized)) return ask(state, '你希望最大机动距离控制在多少公里内？直接回复一个数值即可。', 'resource-distance')
    if (/到场|时限|快/.test(normalized)) return ask(state, '你希望全部力量在多少小时内到场？', 'resource-arrival')
    if (/人数|人员|投入|编成/.test(normalized)) return ask(state, '你希望最低建议投入多少人？请给出正整数人数。', 'resource-people')
    return ask(state, '这项修改还没有明确为可计算条件。你希望改变哪个条件及数值？', 'resource-correction')
  }
  const pool = resourcePool().map(team => ({ ...team, enabled: next.enabled.includes(team.id) }))
  const strategy = {
    name: '本次救援资源组合建议',
    mode: 'parallel',
    goal: '专业与首批到场要求作为硬约束，在满足条件的组合中综合距离、时效、专业匹配、台账优先级与投入规模择优；经人工批准后同步准备，及时开展救援保障。',
    weights: { time: 45, distance: 25, professional: 15, priority: 10, economy: 5 },
  }
  const solution = solve(pool, next.demand, next.limits, strategy)
  const errors = [...new Set(solution.errors)]
  if (errors.length) return ask(state, `暂时不能按这组条件计算：${errors.join(' ')} 请用一句话重新说明要修改的条件。`, 'resource-correction')
  state.resource = next
  state.pending = null
  state.revision += 1
  const priorityName = next.demand.prioritySkill === 'search' ? '搜救' : skillLabel(next.demand.prioritySkill)
  const constraints = `本轮条件：${next.limits.maxDistance}公里内；全部${next.limits.maxArrival}小时内到场；首批${next.limits.firstDeadline}小时内具备${priorityName}能力的队伍不少于${next.limits.firstPeople}人；最低${next.demand.people}人，最多${next.limits.maxTeams}个队伍，必要专业至少${next.limits.minLevel}级。`
  if (/需要哪些.*(?:人员|装备)|哪些人员和装备|需要什么.*(?:队伍|装备)/.test(normalized)) {
    return replyOf('结合当前山体滑坡初报，建议准备人员搜救、破拆、工程抢险、风险监测和通信保障力量。以下数量是本地演示测算假设，不是预案规定或现场确认需求。', [{
      title: '本次救援人员与装备需求建议',
      kind: 'resource-needs',
      paragraphs: [state.context.disaster, `演示最低投入参考：${next.demand.people}人。整队人数不等于每个专业的操作人员人数，实际需求须按受领任务及专业评估核定。`, constraints, DEMO_NOTICE],
      table: {
        headers: ['所需能力', '对应专项装备', '演示需求数量', '用途'],
        rows: next.demand.requiredSkills.map(key => [skillLabel(key), equipmentLabel(key), `${next.demand.equipment[key] || 0}台/套`, PURPOSE[key] ?? '待核定']),
      },
    }], STARTERS.resources.slice(1))
  }
  if (/周边|附近|哪些.*(?:力量|队伍)|适合调用/.test(normalized)) {
    const rows = [...solution.eligible]
      .filter(team => next.demand.requiredSkills.some(key => (team.skills[key as SkillKey] || 0) >= next.limits.minLevel))
      .sort((a, b) => a.eta - b.eta)
      .map(team => [team.name, `${team.people}人`, `${team.distance}公里`, `${team.eta.toFixed(2)}小时`, next.demand.requiredSkills.filter(key => (team.skills[key as SkillKey] || 0) >= next.limits.minLevel).map(key => skillLabel(key)).join('、')])
    return replyOf(`按当前距离、到场时限和可用状态筛出了${rows.length}支具备所需能力的候选力量。候选名单不是全部出动建议，下一步可让我组合编成与调度安排。`, [{
      title: '周边可调用力量参考',
      kind: 'resource-candidates',
      paragraphs: [constraints, '下表按准备加行进时长排序。队伍、专业等级、路线与可用状态是演示数据；每支队伍不必单独满足全部任务，组合建议另行测算。', ...solution.excluded.map(team => `未纳入${team.name}：${team.reasons.join('；')}。`), DEMO_NOTICE],
      table: { headers: ['候选队伍', '可调人数', '距离', '预计到场用时', '匹配能力'], rows },
    }], ['帮我生成资源调度建议', '本次救援需要哪些人员和装备？'])
  }
  const roles = (team: { skills: Partial<Record<SkillKey, number>> }) => next.demand.requiredSkills.filter(key => (team.skills[key as SkillKey] || 0) >= next.limits.minLevel).map(key => skillLabel(key)).join('、') || '待核定保障职责'
  const result: ChatResult = !solution.best
    ? {
      title: `${strategy.name} · 资源缺口`,
      kind: 'shortage',
      paragraphs: [constraints, '没有满足全部硬约束的组合。以下为当前队伍数上限内最接近需求的候选组合缺口，不是可执行方案；不自动放宽条件。', ...solution.gaps.map(gap => `${gap.label}：要求${gap.wanted}${gap.unit}，可提供${gap.supplied}${gap.unit}，缺口${gap.shortfall}${gap.unit}。`), DEMO_NOTICE],
    }
    : {
      title: strategy.name,
      kind: 'resource',
      recommended: true,
      paragraphs: [`建议${solution.best.people}人、${solution.best.equipmentCount}台/套需求专项装备；${solution.best.teams.length}个编成单元，最晚预计${solution.best.maxEta.toFixed(2)}小时到场。`, constraints, `在${solution.feasibleCount}个可行整队组合中综合择优；最优仅限当前模拟候选池，不是全局最优。`],
      table: {
        headers: ['编成队伍', '人数', '需求专项装备', '建议职责', '组织 / 到场'],
        rows: solution.best.teams.map(team => [team.name, String(team.people), stock(team.assignedEquipment), roles(team), `${team.wave} / ${team.eta.toFixed(2)}小时`]),
      },
      sections: [
        { title: '资源调度建议', paragraphs: [strategy.goal, ...[...solution.best.teams].sort((a, b) => a.eta - b.eta).map(team => `${team.name}：距事发地${team.distance}公里，准备${team.prepHours.toFixed(2)}小时、行进${team.travelHours.toFixed(2)}小时；经批准启动时计起，预计${team.eta.toFixed(2)}小时到场，承担${roles(team)}。`), '经批准后同步开展出动准备，实际先后到场由确认的路线、集结及运输条件决定。'] },
        { title: '推荐依据与边界', paragraphs: [`满足人数、专业、装备和到场要求后，按时效、距离、专业匹配、台账优先级与规模适配综合择优。演示权重：${(Object.keys(METRIC_LABELS) as MetricKey[]).map(key => `${METRIC_LABELS[key]}${strategy.weights[key]}`).join('、')}；归一化得分${solution.best.score.toFixed(1)}/100。`, ...solution.excluded.map(team => `未纳入${team.name}：${team.reasons.join('；')}。`), '初始需求、专业等级、专项库存与可用状态均为演示假设；具备某专业能力的队伍人数不等于全部人员都具有该专业资质。专项装备不包含运输及其他通用装备。真实使用前逐项核定。', DEMO_NOTICE] },
      ],
    }
  const shortage = result.kind === 'shortage'
  const lead = updated
    ? `已更新为${next.limits.maxDistance}公里内、全部${next.limits.maxArrival}小时到场、最低${next.demand.people}人，并重新计算。`
    : '我按当前事件初报和演示需求整理了一套资源组合建议。'
  const tail = shortage
    ? '\n当前资源无法满足全部条件，我列出了缺口，不生成虚假的可行方案。'
    : `\n当前最低需求为${next.demand.people}人，专业重点为${skillLabel(next.demand.prioritySkill)}；未修改的需求仍是演示假设，可继续调整。`
  return replyOf(`${lead}力量编成与调度安排见下方。${tail}`, [result], STARTERS.resources)
}
