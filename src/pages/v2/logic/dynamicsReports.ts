import { clone } from './clone'
import { DYNAMIC_FIELDS, type DynamicFactInput, type DynamicReport } from './dynamicsLogic'

const RAW_BODIES: Record<string, string> = {
  r1: '现场初步反馈：明坑村发生山体滑坡，约8栋房屋倒塌，初报约10人被困。搜救力量处于准备阶段，目前尚未报告救出人员。进场道路阻断，替代路线待确认，二次滑坡风险需专业核查。',
  r2: '现场对比图的演示人工判读说明：房屋倒塌范围暂按8栋统计。进场道路仍阻断，替代路线未确认；降雨持续，应加强坡体风险监测。本demo未读取实际图片或执行OCR。',
  r3: '现场反馈：被困总人数经本轮核实修正为12人，累计救出8人，尚待搜救4人，救援持续开展。报告时南昌队常备中队在场50人、装备40台/套。人数为累计口径，并非本时段新增人数。',
  r4: '现场反馈：被困总人数12人，累计救出10人，尚待搜救2人，搜救持续开展。临时便道已经恢复，但限行条件仍待确认。报告时南昌队常备中队在场40人、装备30台/套。',
  r5: '现场反馈：本次被困总人数12人，累计救出12人，尚待搜救0人，人员搜救结果已经闭合。临时便道已恢复，限行条件仍待确认。坡体尚未稳定，应持续监测。报告时南昌队常备中队在场20人、装备18台/套；未报告指导组数量，其余人装返队或转任务情况需核对。',
}

function fact(key: keyof typeof DYNAMIC_FIELDS, value: number | string, scope = '灾区'): DynamicFactInput {
  return { key, value, scope, unit: DYNAMIC_FIELDS[key].unit }
}

const SEED: DynamicReport[] = [
  { id: 'r1', title: '现场情况', time: '2026-09-05 17:46', notes: '初报10人左右被困，人数为初步估计，后续核实报告可以修正。', facts: [fact('total', 10), fact('rescued', 0), fact('remaining', 10), fact('houses', 8), fact('road', '进场道路阻断，替代路线待确认'), fact('risk', '二次滑坡风险需专业核查'), fact('stage', '搜救准备')] },
  { id: 'r2', title: '现场对比图', time: '2026-09-06 12:56', notes: '此处为配合演示补充的图像人工判读摘要，不表示已读取实际图片或执行OCR。', facts: [fact('houses', 8), fact('road', '进场道路仍阻断，替代路线待确认'), fact('risk', '降雨持续，坡体风险需加强监测')] },
  { id: 'r3', title: '现场救援情况', time: '2026-09-06 15:59', notes: '模拟核实被困总人数由初报10人修正为12人，累计救出8人，尚待搜救4人；人数按本次核实口径。', facts: [fact('total', 12), fact('rescued', 8), fact('remaining', 4), fact('stage', '持续搜救'), fact('personnel', 50, '南昌队常备中队'), fact('equipment', 40, '南昌队常备中队')] },
  { id: 'r4', title: '现场救援情况-01', time: '2026-09-07 10:00', notes: '累计数据不是本时段新增数。临时便道恢复不代表所有车辆具备通行条件。', facts: [fact('total', 12), fact('rescued', 10), fact('remaining', 2), fact('road', '临时便道已恢复，限行条件待确认'), fact('stage', '持续搜救'), fact('personnel', 40, '南昌队常备中队'), fact('equipment', 30, '南昌队常备中队')] },
  { id: 'r5', title: '现场救援情况-02', time: '2026-09-07 17:01', notes: '模拟报告中人员搜救结果已闭合，但风险监测和道路保障继续；其余人装是否返队、转任务仍需核对。未报告指导组数量。', facts: [fact('total', 12), fact('rescued', 12), fact('remaining', 0), fact('stage', '搜救完成'), fact('road', '临时便道已恢复，限行条件待确认'), fact('risk', '坡体尚未稳定，需持续监测'), fact('personnel', 20, '南昌队常备中队'), fact('equipment', 18, '南昌队常备中队')] },
].map(report => ({ ...report, observedAt: report.time, status: '已上报', verified: true }))

export interface ReportListItem {
  id: string
  title: string
  time: string
  status: string
}

export function allReports(): DynamicReport[] {
  return clone(SEED)
}

export function reportListing(): ReportListItem[] {
  return SEED.map(({ id, title, time, status }) => ({ id, title, time, status })).reverse()
}

export function findReport(id: string): DynamicReport | undefined {
  return SEED.find(report => report.id === id)
}

export function reportBody(id: string): string {
  return RAW_BODIES[id] ?? ''
}
