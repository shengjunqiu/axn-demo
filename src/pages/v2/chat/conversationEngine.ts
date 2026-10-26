import { clone } from '../logic/clone'
import { defaultResourceSettings } from '../logic/resourceData'
import { allReports } from '../logic/dynamicsReports'
import { dynamicReply } from './dynamicReply'
import { documentReply, surroundingsReply, taskReply, transportReply } from './fieldReplies'
import { normalize } from './normalize'
import { planReply } from './planReply'
import { STARTERS, replyOf } from './replyShared'
import { resourceReply } from './resourceReply'
import type { ChatContext, DynamicTransfer, EngineReply, EngineSession } from './types'

const WELCOME: Record<ChatContext['page'], (context: ChatContext) => string> = {
  surroundings: () => '我已关联当前周边资源分析报告。你可以问300公里范围内的安能队伍、比较距离，或让我按本页表格整理资源情况。',
  resources: () => '我已关联当前事件初报。你可以直接让我推荐资源，也可以用一句话说明距离、时限或专业重点；我会据此计算编成与调度建议。',
  plan: () => '我已关联当前灾情和初始方案。可以帮你编制一份完整处置方案、说明救援工作安排，或根据新情况调整草稿。你直接说需求即可。',
  dynamics: () => '我已关联当前事件的5份演示动态报告。可以告诉你最新进展、生成动态汇总报告，或说明后续救援安排；默认采用全部报告，也可以直接告诉我要用哪几份。',
  transport: () => '我已关联当前投送编成文稿。可以整理人员装备投送安排、说明各队伍的预计行进时长，或起草投送抽组方案；不替你下达出动指令。',
  tasks: () => '当前受领任务仍是占位说明。你告诉我联指安排，我会拆成任务草稿；必要信息不足时，我一次只问一个问题。',
  documents: context => `我已关联${context.document.name || '当前队伍'}的任务文书记录。列表没有正文；需要完善内容时，我会向你询问原文，不凭空编造任务、路线或时间。`,
}

export function createEngineSession(context: ChatContext): EngineSession {
  return {
    context: { ...context },
    resource: defaultResourceSettings(),
    reportIds: allReports().map(report => report.id).reverse(),
    pending: null,
    plan: {
      task: '组织现场核查、被困人员搜救、工程抢险与救援保障。',
      supplement: '',
      conditions: { time: '', road: '', risk: '', weather: '', notes: [] },
      resources: '未提供当前确认可用人装；不得沿用历史台账作为出动数量。',
      status: '待确认',
      dynamicUpdate: null,
    },
    taskText: '',
    taskView: 'tasks',
    documentText: '',
    documentView: 'draft',
    lastDynamic: null,
    revision: 0,
  }
}

export function welcome(state: EngineSession): EngineReply {
  const page = state.context.page
  return replyOf(WELCOME[page](state.context), [], STARTERS[page] ?? [])
}

function stamp(state: EngineSession, answer: EngineReply): EngineReply {
  answer.results.forEach(result => {
    result.event = state.context.event
    result.module = state.context.title
    result.version = state.revision
  })
  return answer
}

export function reply(state: EngineSession, text: string): EngineReply {
  const original = String(text || '').trim()
  const normalized = normalize(original)
  if (!original) return stamp(state, replyOf('请告诉我你希望处理什么。', [], welcome(state).suggestions))
  if (original.length > 4000) return stamp(state, replyOf('这段内容较长，请分段发送，每次不超过4000字。'))
  if (/(立即|直接|替我|自动).*(下达|调动|发布|审批|归档|撤回|派遣)/.test(normalized)) {
    return stamp(state, replyOf('我可以提供草稿与建议，但不执行实际调度、审批、发布或归档。请在一期原有流程中由有权限人员确认办理。'))
  }
  if (/订机票|股票|天气预报|联网搜索|查询实时|真实库存|读取物联网|删除全部/.test(normalized)) {
    return stamp(state, replyOf('当前是本地规则演示，未接入实时网络、物联网或生产台账，不能完成这项操作。我可以帮助处理当前模块的演示任务。', [], welcome(state).suggestions))
  }
  if (state.pending === 'resource-distance' && /\d/.test(normalized) && !/公里|km/.test(normalized)) return stamp(state, resourceReply(state, original, `半径改为${normalized}公里`))
  if (state.pending === 'resource-arrival' && /\d/.test(normalized) && !/小时/.test(normalized)) return stamp(state, resourceReply(state, original, `到场时限改为${normalized}小时`))
  if (state.pending === 'resource-people' && /^\s*\d+\s*(?:人)?\s*$/.test(normalized)) return stamp(state, resourceReply(state, original, `至少投入${normalized.replace(/人/g, '')}人`))
  if (state.pending === 'plan-time' && /^-?\d+(?:\.\d+)?\s*(?:小时)?$/.test(normalized)) return stamp(state, planReply(state, original, `时限改为${normalized.replace(/小时/g, '').trim()}小时`))
  if (state.pending === 'task-time' && /^-?\d+(?:\.\d+)?\s*(?:小时)?$/.test(normalized)) {
    const rewritten = `把时限改为${normalized.replace(/小时/g, '').trim()}小时`
    return stamp(state, taskReply(state, rewritten, rewritten))
  }
  if (state.pending === 'plan-change') return stamp(state, planReply(state, original, normalized))
  if (state.pending === 'task-body') return stamp(state, taskReply(state, original, normalized))
  if (state.pending === 'document-body') return stamp(state, documentReply(state, original, normalized))
  if (state.context.page === 'dynamics' && /第\d/.test(normalized)) return stamp(state, dynamicReply(state, original, normalized))
  const relevant = /资源|策略|组合|编成|调度|方案|报告|动态|汇总|分析|影响|任务|拆解|完善|检查|核对|人装|人数|装备|到场|距离|半径|公里|小时|优先|生成|搜救|救援|灾情|文书|投送|道路|监测|通信|风险|修改|调整|改成|改为|缺|准备|带入|上报|全部|最新|解释|精简|简洁|至少|投入/.test(normalized)
  if (!relevant) return stamp(state, replyOf('我还不能在这个演示中可靠理解这句话。你可以换成当前模块的任务描述，例如下面的推荐问题；不会把未理解的请求当成已完成。', [], welcome(state).suggestions))
  switch (state.context.page) {
    case 'surroundings': return stamp(state, surroundingsReply(state, normalized))
    case 'resources': return stamp(state, resourceReply(state, original, normalized))
    case 'plan': return stamp(state, planReply(state, original, normalized))
    case 'dynamics': return stamp(state, dynamicReply(state, original, normalized))
    case 'transport': return stamp(state, transportReply(state, normalized))
    case 'tasks': return stamp(state, taskReply(state, original, normalized))
    case 'documents': return stamp(state, documentReply(state, original, normalized))
    default: return stamp(state, replyOf('当前页面不在V2六个演示模块内，未启动分析。'))
  }
}

export function applyTransfer(state: EngineSession, update: DynamicTransfer): EngineReply {
  if (state.context.page !== 'plan' || state.context.event !== update.event || !update.baselineId) {
    throw new Error('动态更新与当前方案事件或基准不一致。')
  }
  state.plan.dynamicUpdate = clone(update)
  return replyOf('已接收同一事件的动态总结与章节更新。你可以直接说“根据最新情况调整处置方案”；原方案未被覆盖。', [], ['根据最新情况调整处置方案'])
}
