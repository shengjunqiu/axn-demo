import { DISASTER_TEXT, EVENT_NAME, findPageMeta, type ChatPageId } from '../constants'
import type { ChatContext, TransportTeam } from './types'

const INITIAL_PLAN_SECTIONS = [
  { title: '一、灾情基本情况', text: DISASTER_TEXT },
  { title: '二、任务和救援目标', text: '根据联合指挥部部署，组织开展现场勘察、被困人员搜救、险情处置和救援保障工作。' },
  { title: '三、救援组织与力量编成', text: '组建现场指挥机构，按指挥控制、技术保障、安全管理、综合保障等职责分工组织实施救援。' },
  { title: '四、救援行动安排', text: '按照现场勘察、危险区域划定、搜救处置、工程抢险、现场清理的顺序开展救援，具体任务以现场指挥部下达的指令为准。' },
  { title: '五、安全与保障措施', text: '做好现场风险监测、人员防护、通信联络和物资保障。落实预案规定的安全管理要求。' },
]

const TRANSPORT_TEAMS: TransportTeam[] = [
  { name: '南昌队常备中队', people: 52, equipment: 42, contact: '—', phone: '—', distance: '432.98', mode: '摩托化机动', travel: '5小时52分钟', task: '搜救与工程处置', personnel: 52 },
  { name: '指导组', people: 28, equipment: 3, contact: '—', phone: '—', distance: '423.16', mode: '摩托化机动', travel: '5小时14分钟', task: '指挥协调', personnel: 28 },
]

export function buildChatContext(page: ChatPageId): ChatContext {
  const meta = findPageMeta(page)
  return {
    event: EVENT_NAME,
    disaster: DISASTER_TEXT,
    page,
    title: meta.title,
    breadcrumb: meta.groupName === meta.title ? meta.title : `${meta.groupName} / ${meta.title}`,
    initialPlan: {
      id: 'initial-page-plan',
      event: EVENT_NAME,
      title: '处置方案管理 · 初始救援处置方案（演示模板）',
      facts: { total: 10, remaining: 10, houses: 8, stage: '开展搜救', road: '原方案未明确道路状态', risk: '原方案要求现场风险监测' },
      sections: INITIAL_PLAN_SECTIONS,
    },
    initialForces: {
      id: 'initial-page-transport',
      event: EVENT_NAME,
      title: '力量抽组 · 原始投送抽组方案',
      teams: TRANSPORT_TEAMS.map(team => ({ name: team.name, personnel: team.personnel, equipment: team.equipment, task: team.task })),
    },
    transport: { people: 80, equipment: 45, teams: TRANSPORT_TEAMS },
    document: { name: '南昌队常备中队', instruction: '队伍机动', echelon: '第一梯队' },
  }
}

export const CHAT_PLACEHOLDER: Record<ChatPageId, string> = {
  surroundings: '例如：300公里内有哪些安能救援队伍',
  resources: '例如：帮我生成资源调度建议，要求4小时内到场',
  plan: '例如：编制本次处置方案，或根据新情况调整正文',
  dynamics: '例如：汇总最新救援进展，说明后续工作安排',
  transport: '例如：整理投送方案，说明各队伍预计行进时长',
  tasks: '直接告诉我联指受领任务，我来整理任务分工',
  documents: '粘贴任务要求，或告诉我希望完善的重点',
}

export const VOICE_SAMPLE: Record<ChatPageId, string> = {
  surroundings: '说明300公里内的安能救援队伍',
  resources: '只考虑300公里内，4小时到场，优先搜救',
  plan: '生成三个处置方案',
  dynamics: '分析最新两份灾情报告',
  transport: '检查当前投送方案',
  tasks: '拆解现场救援任务',
  documents: '检查当前任务文书',
}
