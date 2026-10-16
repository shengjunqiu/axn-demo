import type { PlanImpactRow } from './dynamicsLogic'

export interface PlanDirection {
  id: string
  name: string
  short: string
  goal: string
  fit: string
  tradeoff: string
  constraint: string
  groups: string[]
  phases: Array<[string, string]>
}

export interface PlanDraftContext {
  event: string
  disaster: string
  task: string
  resources: string
  supplement: string
  status: string
  dynamicUpdate?: {
    baselineTitle: string
    planRows: PlanImpactRow[]
  } | null
}

export interface GeneratedPlan {
  id: string
  title: string
  strategy: PlanDirection
  meta: string[]
  sections: Array<{ title: string; paragraphs: string[] }>
}

const PHASE_INDEX = ['一', '二', '三']

/** 按给定方向生成处置方案草稿。对话引擎每次只传入当前这一条方向。 */
export function generatePlans(context: PlanDraftContext, directions: PlanDirection[]): GeneratedPlan[] {
  const plans = directions.map(strategy => ({
    id: strategy.id,
    title: `${context.event} · ${strategy.name}`,
    strategy,
    meta: [`组织思路：${strategy.short}`, `编制侧重点：${strategy.goal}`, `适用条件：${strategy.fit}`, `取舍：${strategy.tradeoff}`],
    sections: [
      { title: '一、灾情与现场情况', paragraphs: [context.disaster, `现场补充情况：${context.supplement || '暂无新增说明；道路、天气及二次灾害等条件待现场核查。'}`, `资源状态：${context.status}。${context.resources}`] },
      { title: '二、救援目标与适用条件', paragraphs: [`本方案目标：${strategy.goal}`, `本次任务要求：${context.task}`, `适用条件：${strategy.fit} 当前输入不足以判断条件是否完全满足，具体组织以现场确认结果为准。`] },
      { title: '三、力量编成与职责', paragraphs: [`围绕“${strategy.short}”设置${strategy.groups.join('、')}，各单元可在现有队伍内按职责编组；指导组承担指挥协调，不自动计入一线作业力量。`, `资源规划参考：${context.resources}`, context.status === '已确认可用' ? '可用力量已由填报人确认，仍需结合人员专业、装备明细和具体任务确定各单元投入，避免重复占用。' : context.status === '需补充或增援' ? '当前资源不足或尚未具备使用条件，各工作单元先明确缺口和增援需求；增援来源、数量和时效由指挥人员落实。' : '当前资源仅为参考数据，尚未确认可用。先完成队伍状态、人员专业和装备可用性核查，不将历史台账直接作为实际出动力量。'] },
      { title: '四、阶段安排与任务衔接', paragraphs: strategy.phases.map(([phase, detail], index) => `第${PHASE_INDEX[index] ?? index + 1}阶段：${phase}。${detail} ${index === 0 && context.supplement ? `重点结合补充情况“${context.supplement}”核实本阶段的行动条件。` : ''}`) },
      { title: '五、安全与保障要求', paragraphs: ['现场作业前由专业人员确认风险、作业条件与人员防护要求；不以本草案代替适用预案、技术规程或现场指令。', `本方向补充约束：${strategy.constraint}`, `根据“${strategy.short}”的任务重点落实通信联络、人员状态反馈、医疗联系及后勤保障。具体警戒范围、作业参数和撤离阈值依适用规程及现场评估确定。`, '新增风险或关键条件变化时，及时报告现场指挥，复核相关行动；未确认的道路、天气、专业装备和医疗资源不写成已具备。'] },
      { title: '六、调整、交接与结束条件', paragraphs: [`结合${strategy.short}的执行进展，在被困人员信息、现场风险、资源可用性或任务要求变化时复核方案。`, '阶段转换、任务交接和回撤归建由指挥人员确认，记录人员装备状态、完成事项和遗留问题。', `本方案的主要取舍：${strategy.tradeoff} 时限、责任人和具体作业安排依据实际条件补充后执行。`] },
    ],
  }))
  if (context.dynamicUpdate) {
    const sectionMap: Record<string, number> = { 一: 0, 二: 1, 四: 3, 五: 4 }
    plans.forEach(plan => {
      plan.meta.push(`更新基准：${context.dynamicUpdate?.baselineTitle}；原始方案未覆盖。`)
      const situation = plan.sections[0]
      if (situation) situation.paragraphs.unshift('本草案依据灾情动态总结修订；各项最新事实和原方案更新建议须由使用人员复核。')
      context.dynamicUpdate?.planRows.forEach(row => {
        const index = sectionMap[row.section[0] ?? '']
        const section = index === undefined ? undefined : plan.sections[index]
        if (section) section.paragraphs.push(`动态更新建议：${row.suggestion} 对应原方案“${row.section}”，最新情况：${row.current}。`)
      })
    })
  }
  return plans
}
