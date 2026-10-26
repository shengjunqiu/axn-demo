import { normalize } from './normalize'
import { DEMO_NOTICE, STARTERS, ask, replyOf } from './replyShared'
import type { EngineReply, EngineSession } from './types'

const SURROUNDING_TEAMS = [
  ['南昌队常备中队', '第一梯队', '54人', '42台/套', '432.98公里'],
  ['永新项目部', '后备力量', '18人', '12台/套', '136.39公里'],
  ['梅江灌区项目部', '后备力量', '0人', '0台/套', '279.15公里'],
]

export function surroundingsReply(state: EngineSession, normalized: string): EngineReply {
  state.pending = null
  state.revision += 1
  if (/最近|距离/.test(normalized)) {
    return replyOf('按本页表格，永新项目部距事发地最近，为136.39公里，列在后备力量。南昌队常备中队是第一梯队，距离432.98公里。', [{
      title: '距事发地最近的队伍',
      paragraphs: ['比较范围是报告表格中已列出的三支队伍。报告另写明300公里内共有5支队伍，未列出的两支不在此补写。', DEMO_NOTICE],
      table: { headers: ['队伍名称', '所属梯队', '距事发地距离'], rows: [['永新项目部', '后备力量', '136.39公里'], ['梅江灌区项目部', '后备力量', '279.15公里'], ['南昌队常备中队', '第一梯队', '432.98公里']] },
    }], STARTERS.surroundings)
  }
  return replyOf('报告写明距事发地300公里范围内共有安能5支救援队伍，共171人、装备128台/套。下表是本页已列出的队伍。', [{
    title: '周边安能队伍',
    paragraphs: ['距事发地300公里范围内共有安能5支救援队伍，共171人、装备128台/套。', DEMO_NOTICE],
    table: { headers: ['队伍名称', '所属梯队', '人数', '装备', '距事发地距离'], rows: SURROUNDING_TEAMS },
  }], STARTERS.surroundings)
}

export function transportReply(state: EngineSession, normalized: string): EngineReply {
  const transport = state.context.transport
  if (!transport?.teams?.length) return ask(state, '当前页面没有可读的投送编成表。请粘贴人数、装备及机动安排正文。', 'transport-text')
  const people = transport.teams.reduce((sum, team) => sum + team.people, 0)
  const equipment = transport.teams.reduce((sum, team) => sum + team.equipment, 0)
  state.revision += 1
  const notes = [`当前投送文稿共${transport.people}人、${transport.equipment}台/套，表格合计${people}人、${equipment}台/套。`, '只使用本页同一份文稿，不混用人装抽组列表的另一组人数。', '出动时点、准备时长、路线及联系人未提供，需经办人依据确认记录补齐；本助手不产生新出动指令。', DEMO_NOTICE]
  if (people !== transport.people || equipment !== transport.equipment) notes.splice(1, 0, '正文与明细合计有差异，数量采用前须核实，不能自动修正为已确认投入。')
  if (/多久|时长|到场|到达/.test(normalized)) {
    return replyOf('本页提供的是预计行进时长，未提供准备时长和批准出发时间，因此不能直接给出实际到场时刻。', [{
      title: '各队伍投送时效参考',
      kind: 'transport-arrival',
      paragraphs: [notes[0] ?? '', '到场窗口＝批准启动时点＋集结准备时长＋行进时长；其中前两项本页未提供。', DEMO_NOTICE],
      table: { headers: ['队伍', '机动距离', '预计行进时长', '预计到场时刻'], rows: transport.teams.map(team => [team.name, team.distance ? `${team.distance}公里` : '未提供', team.travel || '未提供', '出发与准备时间未提供，待确认']) },
    }], STARTERS.transport)
  }
  const arrangement = {
    title: '本次人员装备投送安排',
    kind: 'transport-arrangement',
    paragraphs: notes,
    table: { headers: ['队伍', '人数', '装备', '机动距离', '预计行进时长'], rows: transport.teams.map(team => [team.name, `${team.people}人`, `${team.equipment}台/套`, team.distance ? `${team.distance}公里` : '未提供', team.travel || '未提供']) },
  }
  if (/如何投送|怎么投送/.test(normalized)) return replyOf(`建议沿用当前已编制的投送文稿，组织${people}人、${equipment}台/套的人装确认与机动准备；以下按队伍整理，不重新指定运输方式或路线。`, [arrangement], STARTERS.transport)
  return replyOf('已根据本页编成与行进记录整理一份投送抽组方案草稿，可复制或下载Word；具体运输方式和出动时点仍沿用人工确认结果。', [{
    ...arrangement,
    title: '投送抽组方案草稿',
    kind: 'transport',
    sections: [
      { title: '一、投送编成', paragraphs: [`${transport.teams.map(team => `${team.name}${team.people}人、${team.equipment}台/套`).join('；')}。人员、装备按本页文稿列示，不自动调整投入。`] },
      { title: '二、机动与到场衔接', paragraphs: transport.teams.map(team => `${team.name}：距事发地${team.distance || '待确认'}公里，预计行进${team.travel || '待确认'}。出动时间、车辆承载与路线以批准安排为准，到达后按原流程报备。`) },
      { title: '三、联络与安全保障', paragraphs: ['集结、途中、到达及异常状态按确认的联络机制反馈；联系人和联系方式由经办人补齐。', '通行、人员防护和运输条件依适用规程及专业评估确认，变化及时报告现场指挥。'] },
    ],
  }], STARTERS.transport)
}

export function taskReply(state: EngineSession, original: string, normalized: string): EngineReply {
  const proposedTime = normalized.match(/(-?\d+(?:\.\d+)?)\s*小时/)
  const proposedHours = proposedTime?.[1]
  if (proposedHours && Number(proposedHours) <= 0) return ask(state, '任务时限必须是有效正数。你希望改为多少小时？原任务与时限暂不修改。', 'task-time')
  if (state.pending !== 'task-body') state.taskView = /由哪些组|谁负责|责任组/.test(normalized) ? 'owners' : /分工表/.test(normalized) ? 'table' : 'tasks'
  if (/需要哪些|哪些信息/.test(normalized)) return replyOf('至少需要明确联指受领任务正文。我会据任务拆出责任组、工作内容、依赖关系、时限和验收产物；缺失责任人与具体时间保持待核定，不直接派遣队伍。', [], ['帮我拆解救援任务'])
  if (!state.taskText && state.pending !== 'task-body' && !/联指要求|指挥部要求|受领任务[:：]|任务是/.test(original)) {
    return ask(state, '当前页面的受领任务还是“xxxxx”占位说明。联指具体要求完成什么任务？请直接告诉我任务正文。', 'task-body')
  }
  if (!state.taskText || state.pending === 'task-body' || /联指要求|任务是|重新拆/.test(original)) state.taskText = original
  else if (/改|调整|补充/.test(normalized)) state.taskText += ` 补充要求：${original}`
  state.pending = null
  const task = normalize(state.taskText)
  const times = [...task.matchAll(/(\d+(?:\.\d+)?)\s*小时/g)]
  const lastTime = times.at(-1)?.[1]
  const time = lastTime ? `${lastTime}小时内` : '具体时限待核定'
  const technical = /核查|风险|勘察|监测/.test(task)
  const rescue = /搜救|被困|转移/.test(task)
  const road = /道路|清障|工程/.test(task)
  const rows = [['任务受领与组织', '指挥组', `核对受领要求：${state.taskText}`, time, '形成确认后的任务与联络安排', '先行任务']]
  if (technical) rows.push(['现场情况与风险核查', '技术组', '核查现场条件、记录风险与待确认事项，反馈专业意见', time, '提交核查记录，不以草稿代替专业结论', '完成任务受领后'])
  if (rescue) rows.push(['搜救与转移协同', '指挥-处置组', '按确认的人员线索和专业条件组织协同，衔接医疗联系', time, '记录完成情况与未完成事项', '依赖风险与条件确认'])
  if (road) rows.push(['道路与工程保障', '指挥-处置组', '按受领要求核对通行、作业和运输条件，组织必要工程保障', time, '报告通行限制与保障进展', '依赖专业核查'])
  if (!technical && !rescue && !road) rows.push(['受领任务具体实施', '责任组待核定', state.taskText, time, '验收口径需指挥明确', '依赖受领任务确认'])
  rows.push(['结果汇总与上报', '指挥组', '汇总执行记录、风险及遗留事项，按原流程上报', time, '形成结果报告并留存确认记录', '依赖各执行任务反馈'])
  state.revision += 1
  return replyOf(`已${state.taskView === 'owners' ? '整理各项任务的建议责任组' : `将受领任务拆成${rows.length}项草稿`}。${times.length ? `本轮按你给出的${time}组织安排` : '没有明确时限的部分保持待核定'}；具体责任人和采用结果仍需人工确认。`, [{
    title: state.taskView === 'owners' ? '救援任务责任组建议' : state.taskView === 'table' ? '救援任务分工表' : '救援任务分解草稿',
    kind: state.taskView === 'owners' ? 'task-owners' : 'tasks',
    paragraphs: [`受领任务：${state.taskText}`, `任务组织时限：${time}。`, DEMO_NOTICE],
    table: state.taskView === 'owners'
      ? { headers: ['任务', '建议责任组', '协同及衔接'], rows: rows.map(row => [row[0] ?? '', row[1] ?? '', row[5] ?? '']) }
      : { headers: ['任务', '建议责任组', '内容', '时限', '完成产物', '前置依赖'], rows },
  }], STARTERS.tasks)
}

export function documentReply(state: EngineSession, original: string, normalized: string): EngineReply {
  if (state.pending !== 'document-body') state.documentView = /精简|简洁|压缩/.test(normalized) ? 'short' : /注意|完善|要求/.test(normalized) ? 'requirements' : 'draft'
  if (/检查.*缺|缺少|哪些内容/.test(normalized) && !state.documentText) {
    return replyOf('列表仅能看到队伍、指令类型、所属梯队、指令单位和归档状态；无法据此判断正文完整性。完善时需要原文，尤其是已确认的任务要求、出动时间、集结地点、行进安排和联系人。缺失项不会自动编造。', [], ['完善当前任务文书'])
  }
  if (!state.documentText && state.pending !== 'document-body') {
    return ask(state, '当前列表没有文书正文。请粘贴需要完善的任务要求，我会保留原指令信息，只补充文字和缺项提示。', 'document-body')
  }
  if (state.pending === 'document-body' || !state.documentText) state.documentText = original
  else if (/改|补充|加强|增加/.test(normalized) && !/精简|简洁/.test(normalized)) state.documentText += ` 补充要求：${original}`
  state.pending = null
  const document = state.context.document
  const additions: string[] = []
  if (/上报|报告|通信|联络/.test(normalize(state.documentText))) additions.push('按已确认的联络渠道反馈途中、到达与人员装备状态；异常情况及时报告指挥人员，具体频道、联系方式与频次由经办人核定。')
  if (state.documentView === 'requirements' || /安全|注意|防护/.test(normalize(state.documentText))) additions.push('安全注意事项：结合适用方案落实交通、人员防护与现场风险确认；未确认的道路和作业条件不作为可执行依据。')
  const draft = [`文书对象：${document.name || '当前队伍'}；指令类型：${document.instruction || '待核定'}；梯队：${document.echelon || '待核定'}。`, `原文与补充要求：${state.documentText}`, ...additions, '执行时沿用已确认的出动指令、人装及行进记录；到达后按原流程报备并完成任务交接。', '缺项核对：出动/集结时间、地点、实际行进方案、联系人及联络方式须依据真实文书补齐，不能从当前列表推断。', DEMO_NOTICE]
  if (state.documentView === 'short') draft.splice(2, draft.length - 3, '沿用确认指令与行进方案，完成到达报备。出动时间、路线和联系人由经办人核定。')
  state.revision += 1
  return replyOf(state.documentView === 'short' ? '已精简草稿说明，保留原任务要求及必要确认事项；不生成新指令。' : '已根据你提供的原文整理任务文书，保留关联对象，不生成新指令。缺失的时间、路线和联系人仍需经办人补齐。', [{
    title: state.documentView === 'short' ? '任务文书简洁稿' : state.documentView === 'requirements' ? '任务文书完善草稿' : '任务文书起草稿',
    kind: 'document',
    paragraphs: draft,
  }], STARTERS.documents)
}
