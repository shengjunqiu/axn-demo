import { clone } from '../logic/clone'
import { generatePlans, type PlanDirection } from '../logic/planGenerate'
import { DEMO_NOTICE, STARTERS, ask, replyOf } from './replyShared'
import type { EngineReply, EngineSession } from './types'

function detail(original: string, keywords: RegExp): string {
  return original.split(/[，,。；;]/).filter(line => keywords.test(line)).map(line => line.replace(/(?:且|并)?(?:任务|方案)?(?:组织)?(?:时限|时间)?(?:要求|改为|改成|控制在|不超过)?\s*[零〇一二两三四五六七八九十百千万\d.]+\s*小时(?:内)?/g, '').trim()).filter(Boolean).join('；')
}

export function planReply(state: EngineSession, original: string, normalized: string): EngineReply {
  if (/缺什么|缺少|信息不足/.test(normalized)) return replyOf('当前初报有事件、地点、8栋倒塌房屋及约10人被困，但没有当前确认可用力量、实际道路状态、现场风险评估和明确作业时限。可以先编制一份草稿；缺失内容保持待核实，不写成已具备。', [], ['帮我编制本次救援处置方案'])
  if (/删除|去掉|取消/.test(normalized) && /安全|红线|核查|防护/.test(normalized)) return replyOf('安全红线和专业确认要求不能删除。我可以精简表达，但不会把未确认条件写成可以直接作业。', [], ['保留安全要求，精简方案'])
  let invalidatedCompletion = false
  const renewedRescue = normalized.split(/[，,。；;]/).some(clause => {
    const change = clause.match(/(?:新增|又发现|还有|尚有|仍有).*(?:被困|待救)|继续搜救|重新搜救/)
    if (!change || change.index === undefined || /(?:没有|暂无|并无|无|未|不是|不再|不用|不需|无需|并非|否认|停止|结束|取消)\s*(?:发现|确认|任何|新的|人员)?\s*$/.test(clause.slice(0, change.index))) return false
    return !/(?:新增|又发现|还有|尚有|仍有).*?(?:被困|待救).*?0人|(?:新增|又发现|还有|尚有|仍有).*?0人.*?(?:被困|待救)/.test(clause)
  })
  if (state.plan.dynamicUpdate?.complete && renewedRescue) {
    state.plan.dynamicUpdate = null
    state.plan.currentDisaster = `用户补充的新情况（尚待现场核实）：${original}。此前带入的搜救完成结论已失效，不再用作当前方案依据。`
    invalidatedCompletion = true
  }
  const awaitingChange = state.pending === 'plan-change'
  if (/根据最新情况.*(?:调整|修订)|根据最新情况重新生成/.test(normalized) && !state.plan.dynamicUpdate && !state.plan.supplement && !awaitingChange) {
    return ask(state, '请告诉我最新发生了什么变化，例如人员搜救进展、道路状况或新任务要求，我会据此调整当前草稿。', 'plan-change')
  }
  state.pending = null
  if (awaitingChange || (/改|调整|补充|道路|监测|小时|时限|人员|装备|风险/.test(normalized) && !/生成|先给我|精简|简短/.test(normalized))) {
    const conditions = state.plan.conditions
    let applied = false
    if (/时限|小时/.test(normalized)) {
      const time = normalized.match(/(-?\d+(?:\.\d+)?)\s*小时/)
      const hours = time?.[1]
      if (!hours || Number(hours) <= 0) return ask(state, '方案组织时限需要一个有效正数。你希望控制在多少小时？', 'plan-time')
      conditions.time = `任务组织时限要求：${Number(hours)}小时（用户提出，具体执行节点须指挥核定）。`
      applied = true
    }
    if (/道路|便道|路线|通行/.test(normalized)) {
      conditions.road = detail(original, /道路|便道|路线|通行/)
      applied = true
    }
    if (/风险|坡体|二次灾害|监测/.test(normalized)) {
      conditions.risk = detail(original, /风险|坡体|二次灾害|监测/)
      applied = true
    }
    if (/天气|降雨|暴雨/.test(normalized)) {
      conditions.weather = detail(original, /天气|降雨|暴雨/)
      applied = true
    }
    if (!applied && !conditions.notes.includes(original)) conditions.notes.push(original)
    state.plan.supplement = [conditions.time, conditions.road, conditions.risk, conditions.weather, ...conditions.notes].filter(Boolean).join(' ')
  }
  const completed = !!state.plan.dynamicUpdate?.complete
  const direction: PlanDirection = {
    id: 'current-rescue',
    name: completed ? '救援处置调整方案' : '本次救援处置方案',
    short: '现场核查、搜救与保障协同',
    goal: completed ? '依据最新搜救结果，组织风险监测与道路保障、遗留任务处理和后续交接；调整人员安排须经指挥确认。' : '及时组织人员搜救与抢险，同时落实专业风险确认、工程保障、通信医疗及后勤协同。',
    fit: '依据当前灾情与受领任务编制；道路、风险和可用人装由现场专业人员及指挥确认。',
    tradeoff: '统筹时效、能力与安全条件，不将其拆成互相排斥的方案方向。',
    constraint: '不编造缺失信息；未确认现场条件不作为可执行依据；安全红线与专业确认要求始终保留。',
    groups: completed ? ['风险监测单元', '道路与工程保障单元', '遗留任务与交接单元'] : ['搜救处置单元', '工程与道路保障单元', '风险监测单元', '通信医疗与后勤保障单元'],
    phases: completed
      ? [['结果确认与遗留任务梳理', '核对搜救结果与遗留任务，明确仍需保障的风险和区域。'], ['风险监测与道路保障', '维持必要监测、道路和联络保障，依据实际任务调整投入。'], ['后续任务交接', '经确认后组织交接、轮换或回撤准备，不自动结束任务或回撤。']]
      : [['现场确认与同步准备', '及时核实人员线索、道路与风险，同步组织人装、通信、医疗与后勤准备。'], ['搜救抢险与保障协同', '对专业人员确认具备条件的任务组织搜救与工程保障，持续反馈人员进展和风险。'], ['动态调整与任务交接', '根据最新灾情和任务完成情况调整投入，经指挥确认后组织交接和后续安排。']],
  }
  state.revision += 1
  const disaster = state.plan.dynamicUpdate?.summary || state.plan.currentDisaster || state.context.disaster
  const resources = state.plan.dynamicUpdate?.resourceSummary || state.plan.resources
  if (/工作如何开展|先做什么|后做什么|工作怎么开展/.test(normalized)) {
    return replyOf('建议按现场确认与同步准备、搜救抢险协同、动态调整与交接三个阶段组织。准备与保障可同步开展，不代表等全部核查完才处理已确认具备条件的任务。', [{
      title: '本次救援工作安排',
      kind: 'plan-stages',
      paragraphs: [disaster, state.plan.supplement || '具体责任人与时间节点由指挥核定。', DEMO_NOTICE],
      table: { headers: ['阶段', '主要工作', '协同力量'], rows: direction.phases.map(([phase, text], index) => [phase, text, index === 0 ? '指挥、技术与保障组' : index === 1 ? direction.groups.join('、') : '指挥与各执行组']) },
      sections: [{ title: '现场确认要求', paragraphs: [direction.constraint] }],
    }], STARTERS.plan)
  }
  const plans = generatePlans({
    event: state.context.event,
    disaster,
    task: state.plan.task,
    supplement: state.plan.supplement,
    resources,
    status: state.plan.status,
    dynamicUpdate: state.plan.dynamicUpdate,
  }, [direction])
  if (/精简|简短|压缩/.test(normalized)) {
    plans.forEach(plan => plan.sections.forEach(section => {
      if (!section.title.includes('安全')) section.paragraphs = section.paragraphs.filter((line, index) => index < 2 || line.startsWith('动态更新建议'))
    }))
  }
  const changed = !!(state.plan.dynamicUpdate || awaitingChange || state.plan.supplement)
  const unverified = state.plan.status !== '已确认可用' ? '，当前人装可用性与现场条件尚未核实' : ''
  const prefix = invalidatedCompletion ? '新增被困人员信息与之前带入的搜救完成结论不一致，旧结论已失效；当前按你补充的待核实情况重新组织搜救任务。' : ''
  return replyOf(`${prefix}已${changed ? '结合已提供的变化更新' : '编制'}一份救援处置方案草稿${unverified}。你可以继续补充现场情况或要求精简正文。`, plans.map(plan => ({ title: plan.strategy.name, kind: 'plan', paragraphs: [...plan.meta, DEMO_NOTICE], sections: clone(plan.sections) })), STARTERS.plan)
}
