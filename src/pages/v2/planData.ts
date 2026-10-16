import { V2_REPORT_STRUCTURE } from './reportStructure'
import { BUSINESS_SNAPSHOT, TASK_RECORDS, SUPPLY_GAPS, SUPPLY_DIFFERENCES } from './businessData'
import { DISASTER_TEXT } from './constants'

/** 处置方案页的现有内容，供页面与模拟生成共用。 */
export const PLAN_SECTIONS: [string, string][] = [
  [V2_REPORT_STRUCTURE.plan.titles[0], `${DISASTER_TEXT} 以上为初报；动态r5（2026-09-07 17:01）模拟核实被困12人、累计救出12人，后续仍需道路与坡体风险处置。`],
  [V2_REPORT_STRUCTURE.plan.titles[1], '在原现场勘察、人员搜救、险情处置与保障框架下，按最新模拟进度衔接便道通行核查、监测警戒交接和夜间补给；已闭合的人员搜救不重复列为未完成任务。'],
  [V2_REPORT_STRUCTURE.plan.titles[2], '组建现场指挥机构，按指挥控制、技术保障、安全管理、综合保障等职责分工组织实施救援。'],
  [V2_REPORT_STRUCTURE.plan.titles[3], `通用行动顺序为现场勘察、危险区域划定、搜救处置、工程抢险、现场清理。当前阶段按任务页${TASK_RECORDS.length}项分工衔接：道路保障岗9月7日18:30前核查便道限制，物资保障岗19:00前协调补给，安全监测岗20:00前核对监测警戒交接（模拟目标）。具体执行以批准任务为准，目标时限不代表已完成。`],
  [V2_REPORT_STRUCTURE.plan.titles[4], `做好坡体监测、警戒撤离、人员清点、通信医疗与轮换。物资依据${BUSINESS_SNAPSHOT}模拟台账，下一阶段缺${SUPPLY_GAPS}；${SUPPLY_DIFFERENCES}，先复核再协调补给。停工撤离阈值由专业岗位确认，未接入实时气象与地质监测。`],
]

export const PLAN_VERSION_RECORDS = [
  ['任务与物资衔接版', '2026-09-07 18:00', '草稿·未发布', '关联6项任务与5类物资，补充后续保障线索'],
  ['搜救阶段调整版', '2026-09-07 17:10', '草稿·未发布', '按r5反馈标注搜救闭合，道路与坡体处置继续'],
  ['初始行动框架版', '2026-09-05 17:50', '历史草稿', '按初报整理勘察、搜救与保障框架'],
]
