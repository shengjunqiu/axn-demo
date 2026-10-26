import type { ChatPageId } from '../constants'
import type { ChatResult, EngineReply, EngineSession } from './types'

export const DEMO_NOTICE = '演示草稿，仅供核对；不自动调度、审批、发布或回写一期系统。'

export const STARTERS: Record<ChatPageId, string[]> = {
  surroundings: ['300公里内有哪些安能救援队伍？', '哪支队伍距离事发地最近？', '帮我整理周边资源情况'],
  resources: ['本次救援需要哪些人员和装备？', '周边有哪些适合调用的救援力量？', '帮我生成资源调度建议'],
  plan: ['帮我编制本次救援处置方案', '本次救援工作如何开展？', '根据最新情况调整处置方案'],
  dynamics: ['目前灾情和救援进展怎么样？', '帮我生成灾情动态汇总报告', '根据最新进展，后续救援怎么安排？'],
  transport: ['本次人员和装备如何投送？', '各队伍预计多久到场？', '帮我整理投送抽组方案'],
  tasks: ['本次救援需要安排哪些任务？', '各项任务由哪些组负责？', '帮我生成救援任务分工表'],
  documents: ['帮我起草当前任务文书', '帮我完善任务要求和注意事项', '将这份文书整理得简洁清楚'],
}

export function replyOf(text: string, results: ChatResult[] = [], suggestions: string[] = [], extra: Partial<EngineReply> = {}): EngineReply {
  return { text, results, suggestions: suggestions.slice(0, 3), ...extra }
}

export function ask(state: EngineSession, text: string, pending: string): EngineReply {
  state.pending = pending
  return replyOf(text, [], [], { question: true })
}
