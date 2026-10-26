import { BUSINESS_SNAPSHOT, SUPPLY_GAPS, TASK_RECORDS } from '../businessData'
import { DISASTER_TEXT, EVENT_NAME } from '../constants'
import { PLAN_SECTIONS } from '../planData'
import { allReports, reportBody } from './dynamicsReports'

export type EmpowermentKind = 'resources' | 'orders' | 'plan' | 'summary'
export const EMPOWERMENT_LABELS: Record<EmpowermentKind, string> = {
  resources: 'AI生成调度建议', orders: 'AI推荐下发对象', plan: 'AI生成处置方案', summary: 'AI生成报告草稿',
}
// 与指令列表采用相同历史记录。未核验状态不得作为实时可调用事实。
export const CANDIDATE_TEAMS = [
  { id: 'nanchang', name: '南昌队常备中队', people: 54, km: 432.98, travel: '5小时52分钟', status: '已返营', eligible: false },
  { id: 'yongxin', name: '永新项目部', people: 18, km: 136.39, travel: '2小时07分钟', status: '待核验', eligible: true },
  { id: 'meijiang', name: '梅江灌区项目部', people: 0, km: 279.15, travel: '4小时22分钟', status: '无可调人数', eligible: false },
] as const
export interface GenerationInput {
  task: string; people: string; radius: string; deadline: string; start: string; end: string; supplement: string
}
export type DraftSection = { title: string; body: string }
export const WORKFLOW_APPLY = 'axn:v2-workflow-apply'
export const WORKFLOW_APPLIED = 'axn:v2-workflow-applied'
export interface WorkflowApplication {
  type: typeof WORKFLOW_APPLY; requestId: string; eventId: 'mingkeng'; kind: EmpowermentKind
  title: string; sections: DraftSection[]; selectedIds: string[]; savedAt: string
}
export function isEmpowermentKind(value: unknown): value is EmpowermentKind {
  return typeof value === 'string' && Object.hasOwn(EMPOWERMENT_LABELS, value)
}
export function isWorkflowApplication(value: unknown): value is WorkflowApplication {
  if (!value || typeof value !== 'object') return false
  const data = value as Partial<WorkflowApplication>
  return data.type === WORKFLOW_APPLY && data.eventId === 'mingkeng' && isEmpowermentKind(data.kind)
    && typeof data.requestId === 'string' && typeof data.title === 'string' && !!data.title.trim()
    && typeof data.savedAt === 'string' && Array.isArray(data.sections) && data.sections.length > 0
    && data.sections.length <= 20 && data.sections.every(s => typeof s?.title === 'string' && typeof s?.body === 'string' && !!s.body.trim())
    && Array.isArray(data.selectedIds) && data.selectedIds.every(id => CANDIDATE_TEAMS.some(t => t.id === id && t.eligible))
    && (data.kind !== 'orders' || data.selectedIds.length > 0)
}
export const INITIAL_GENERATION_INPUT: GenerationInput = {
  task: '便道通行核查、监测警戒与后续保障', people: '', radius: '300', deadline: '',
  start: '2026-09-05T00:00', end: '2026-09-07T18:00', supplement: '',
}
export function matchingTeams(radius: string, people: string) {
  return CANDIDATE_TEAMS.filter(t => t.eligible && t.km <= Number(radius) && t.people >= Number(people || 0))
}
export function candidateReview(radius: string, people: string) {
  return CANDIDATE_TEAMS.map(team => {
    const reasons = [!team.eligible ? team.status : '', team.km > Number(radius) ? `超出${radius}公里范围` : '', people && team.people < Number(people) ? `不足单队${people}人` : ''].filter(Boolean)
    return { ...team, recommended: reasons.length === 0, reason: reasons.join('；') || '符合当前人数与路程条件，实时状态、技能、装备和权限仍待核验' }
  })
}
export function validateGeneration(input: GenerationInput, kind: EmpowermentKind): string {
  if (!input.task.trim()) return '请填写任务内容。'
  if (['resources', 'orders'].includes(kind)) {
    if (!Number.isFinite(Number(input.radius)) || Number(input.radius) <= 0) return '推荐范围须为大于0的公里数。'
    if (input.people && (!Number.isInteger(Number(input.people)) || Number(input.people) < 1)) return '人数须为大于0的整数。'
  }
  if (kind === 'summary' && (!input.start || !input.end || input.start > input.end || input.end > '2026-09-07T18:00')) return '请选择有效统计范围，截止时间不能晚于演示数据截止2026-09-07 18:00。'
  return ''
}
export function reportsInRange(input: GenerationInput) {
  return allReports().filter(r => r.time >= input.start.replace('T', ' ') && r.time <= input.end.replace('T', ' '))
}
export function workflowSources(kind: EmpowermentKind, input: GenerationInput): { title: string; section: string; excerpt: string }[] {
  const sources = [{ title: '当前事件信息', section: '明坑村山体滑坡 · 模拟事件', excerpt: kind === 'summary' ? EVENT_NAME : `${EVENT_NAME}。${DISASTER_TEXT}` }]
  if (kind === 'resources' || kind === 'orders') sources.push(
    { title: '指令下发队伍列表', section: `历史模拟台账 · 资料截止${BUSINESS_SNAPSHOT}`, excerpt: CANDIDATE_TEAMS.map(t => `${t.name}：可调人数记录${t.people}人，行进路程${t.km}公里，历史通行${t.travel}，${t.status}`).join('；') + '。原记录状态更新时间未提供，不代表实时可调用状态。' },
    { title: '本次任务与筛选需求', section: '当前上下文及对话条件', excerpt: `任务：${input.task}；范围：${input.radius}公里；${input.people ? `${kind === 'orders' ? '单队最少人数' : '任务需求人数'}：${input.people}人` : '人数条件未设置'}；到位时限：${input.deadline.replace('T', ' ') || '未指定'}。` },
  )
  if (kind === 'resources' || kind === 'plan') sources.push({ title: '物资台账与下一阶段需求', section: `${BUSINESS_SNAPSHOT} · 模拟台账`, excerpt: `按需求与可用库存比较，缺口为${SUPPLY_GAPS}。不同计量单位不合计，实际库存需复核。` })
  if (kind === 'plan') sources.push(
    { title: '原处置方案模板', section: '五章结构 · 模拟方案草稿', excerpt: PLAN_SECTIONS.map(([heading]) => heading).join('；') + '。仅作为编制框架，不是有效预案条款。' },
    { title: '现场任务记录', section: `${BUSINESS_SNAPSHOT} · ${TASK_RECORDS.length}项模拟任务`, excerpt: TASK_RECORDS.map(t => `${t.name}（${t.status}）`).join('；') + '。任务时限与岗位安排不代表已完成或正式批准。' },
  )
  if (kind === 'plan' || kind === 'summary') {
    const reports = kind === 'plan' ? allReports().filter(r => r.id === 'r5') : reportsInRange(input)
    sources.push(...reports.map(r => ({ title: r.title, section: `${r.id} · ${r.time} · 模拟现场反馈`, excerpt: reportBody(r.id) })))
  }
  if (input.supplement.trim()) sources.push({ title: '用户对话补充', section: '本次生成采用 · 待核实', excerpt: input.supplement })
  return sources
}
export function parseTeamConditions(text: string, current: Pick<GenerationInput, 'radius' | 'people'>) {
  const distance = text.match(/(?:范围|距离)?\s*(\d+(?:\.\d+)?)\s*(?:公里|km)(?:以内|内|以下)?/i)
  const people = text.match(/(?:每队|单队)?\s*(?:至少|不少于|最少)\s*(\d+)\s*人/)
  const remainder = text.replace(distance?.[0] ?? '\u0000', '').replace(people?.[0] ?? '\u0000', '')
    .replace(/筛选|推荐|队伍|范围|距离|调整为|缩小到|扩大到|不超过|改为|限定|搜索|且|并且|和|，|、|,|。|\s/g, '')
  if ((!distance && !people) || remainder) return { error: '请明确要调整的条件，例如“200公里内，每队至少10人”。装备、技能和到位时效需有对应数据才能筛选，当前结果保持不变。' }
  return { radius: distance?.[1] ?? current.radius, people: people?.[1] ?? current.people }
}
/** 对话直接调整并生成，无法执行的条件只追问该项，保留当前结果。 */
export function adjustGenerationRequest(kind: EmpowermentKind, text: string, current: GenerationInput): { input?: GenerationInput; note?: string; error?: string } {
  let input = { ...current }
  if (/^(重新生成|再生成一次|重新推荐)[。！!]?$/u.test(text)) return { input, note: '已按当前上下文重新生成。' }
  if (kind === 'resources' || kind === 'orders') {
    if (/公里|km|至少|最少|不少于|增加人数|缩小距离|每队|单队/i.test(text)) {
      const parsed = parseTeamConditions(text, current)
      if (parsed.error) return { error: parsed.error }
      input = { ...input, radius: parsed.radius!, people: parsed.people! }
    } else if (/装备|挖掘机|技能|资质|小时内|分钟内/.test(text)) return { error: '当前没有可核验的装备、技能或到位时效数据，无法据此筛选。已保留原结果，请补充对应台账后再调整。' }
    else input = { ...input, task: text, supplement: [input.supplement, text].filter(Boolean).join('\n') }
  } else if (kind === 'summary' && /截止|截至|统计开始/.test(text)) {
    const date = text.match(/(\d{4})[-年](\d{1,2})[-月](\d{1,2})日?[ T\s]*(\d{1,2})[:：](\d{2})/)
    if (!date) return { error: '请明确统计时间，例如“截止2026-09-05 18:00”。现有报告保持不变。' }
    const [, y, m, d, h, min] = date
    const timestamp = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T${h.padStart(2, '0')}:${min}`
    if (!Number.isFinite(Date.parse(timestamp)) || Number(m) > 12 || Number(d) > new Date(Number(y), Number(m), 0).getDate() || Number(h) > 23 || Number(min) > 59) return { error: '统计时间无效，请核对日期与时刻。' }
    input = { ...input, [/统计开始/.test(text) ? 'start' : 'end']: timestamp }
  } else input = { ...input, supplement: [input.supplement, text].filter(Boolean).join('\n') }
  const error = validateGeneration(input, kind)
  if (error) return { error }
  return { input, note: kind === 'resources' || kind === 'orders' ? '已根据需求更新结果，筛选范围与缺口见下方。' : '已根据您的补充更新草稿。人工补充已标注，原业务页未改变。' }
}
export function generateDraft(kind: EmpowermentKind, input: GenerationInput): DraftSection[] {
  const extra = input.supplement.trim() ? `\n人工补充（待核实）：${input.supplement}` : ''
  if (kind === 'plan') return PLAN_SECTIONS.map(([title, body], index) => ({ title, body: `${body}${index === 1 ? `\n本次任务：${input.task}` : ''}${index === 4 ? '\n适用预案：尚未取得有效版本及条款。关键技术参数与撤离阈值待专业岗位确认。' + extra : ''}` }))
  if (kind === 'summary') {
    const reports = reportsInRange(input)
    return [
      { title: '一、基本情况', body: `${EVENT_NAME}\n统计范围：${input.start.replace('T', ' ')}至${input.end.replace('T', ' ')}。\n${reports.length ? reports.map(r => `【${r.id} ${r.time}】${reportBody(r.id)}`).join('\n\n') : '该范围未取得过程记录，处置经过与结果待补充。'}\n各次累计救出人数和在场人装时点值不能相加。` },
      { title: '二、主要经验做法', body: '待补充：经审核的组织指挥、专业处置及协同保障经验。过程记录不足以直接认定为成功经验。' },
      { title: '三、深刻启示', body: `待补充：问题证据与原因分析。微信材料尚未接入。指令回执、出入场记录与最终任务结束批准未齐全，不能认定全部任务完成。${extra}` },
      { title: '四、下一步工作打算', body: '建议核实道路限制、坡体监测、资源投入与保障记录。改进责任人、完成期限、验证方式待补充。' },
    ]
  }
  const teams = matchingTeams(input.radius, kind === 'orders' ? input.people : '')
  return [
    { title: '一、任务与需求', body: `任务：${input.task}\n需求人数：${input.people || '待补充'}；推荐范围：${input.radius}公里；到位时限：${input.deadline.replace('T', ' ') || '待补充'}。` },
    { title: '二、候选资源与推荐依据', body: teams.length ? teams.map(t => `${t.name}：历史可调${t.people}人，行进路程${t.km}公里，历史通行时间${t.travel}。在范围内，有人数记录，但状态、技能、装备及权限待核验。`).join('\n') : '无符合当前人数和范围条件的队伍。请核对条件，不自动放宽约束。' },
    { title: '三、需求缺口与待核条件', body: `${!input.people ? '需求量不明，本次仅提供候选清单，不能形成满足任务的资源组合。' : `候选人数${teams.reduce((n, t) => n + t.people, 0)}人，仅用于历史候选容量比较，未确认可调；实际满足程度待核验。`}\n物资台账（${BUSINESS_SNAPSHOT}）：下一阶段缺${SUPPLY_GAPS}。状态、能力与数量约束尚未核实，不作最优或时效承诺。\n距离不是到位时间，历史行程不是实时路径计算。执行前需再次核验。${extra}` },
  ]
}
