/**
 * 文书生成统一填充：十类走 buildDisasterSections；其余事件用事实/建设元数据填一期标题正文。
 * 禁止回落「由智能体按当前关联事件生成」纯占位架子。
 */
import { disasterProfileById } from './disasterScenarios';
import {
  DUTY_DAILY_TITLES,
  EMERGENCY_BRIEF_TITLES,
  RESCUE_EVAL_TITLES,
  RESCUE_PLAN_TITLES,
  RESOURCE_REPORT_TITLES,
  SITUATION_REPORT_TITLES,
  WORK_SUMMARY_REFLECT_TITLES,
  WORK_SUMMARY_TEMPLATE_TITLES,
  buildDisasterSections,
  personnelGroupingText,
  type DocumentSection,
} from './documentTemplates';
import { vueDemoResourcesForEvent } from './vueDemoResources';
import { vueWorkspaceEventById } from './vueWorkspaceEvents';
import { incidentById } from './scenario';
import { eventDisplayName, factDisplay } from '@/services/factLookup';

const PLACEHOLDER_MARK = '按当前关联事件生成';

const MEETING_MINUTES_TITLES = ['一、会议议题', '二、议定事项', '三、落实安排'] as const;
const RESOURCE_QUERY_TITLES = ['一、检索条件', '二、候选资源', '三、核对说明'] as const;
const RESOURCE_STATUS_TITLES = ['一、待核清单', '二、更新方式'] as const;

interface EventFillContext {
  eventId: string;
  name: string;
  title: string;
  location: string;
  disasterType: string;
  occurredAt: string;
  controlStatus: string;
  casualty: string;
  impact: string;
  description: string;
  risks: string;
  resourcesText: string;
  hasIncident: boolean;
}

function readEventFillContext(eventId: string): EventFillContext {
  const scope = { kind: 'event' as const, eventId };
  const incident = incidentById.get(eventId);
  const vue = vueWorkspaceEventById.get(eventId);
  const resources = vueDemoResourcesForEvent(eventId);
  const resourcesText = resources.length
    ? resources.map((r) => `${r.name} / ${r.amountLabel} / ${r.capability} / ${r.status}`).join('\n')
    : '本事件尚无演示资源候选记录，数量与可出动状态待补核。';

  if (!incident && !vue) {
    return {
      eventId,
      name: eventId || '未关联事件',
      title: '未关联有效灾情',
      location: '待补充',
      disasterType: '待核实',
      occurredAt: '待补充',
      controlStatus: '待核实',
      casualty: '人员伤亡情况待核实',
      impact: '影响范围待核实',
      description: '请先关联有效灾情后再生成文书；本草稿不写入具体险情结论。',
      risks: '现场风险与工程条件待技术、安全岗位复核。',
      resourcesText,
      hasIncident: false,
    };
  }

  const name = eventDisplayName(eventId);
  const title = incident ? factDisplay(incident.factRefs.title, scope) : (vue?.name ?? name);
  const disasterType = incident
    ? factDisplay(incident.factRefs.disasterType, scope)
    : (vue?.category ?? '待核实');
  return {
    eventId,
    name,
    title,
    location: incident ? factDisplay(incident.factRefs.location, scope) : (vue?.location ?? '待补充'),
    disasterType,
    occurredAt: incident ? factDisplay(incident.factRefs.occurredAt, scope) : (vue?.occurredAt ?? '待补充'),
    controlStatus: incident
      ? factDisplay(incident.factRefs.controlStatus, scope)
      : (vue?.controlStatus === 'controlled' ? '已控制' : '处置中'),
    casualty: incident ? factDisplay(incident.factRefs.casualty, scope) : (vue?.casualty ?? '人员伤亡情况待核实'),
    impact: incident ? factDisplay(incident.factRefs.impactScope, scope) : (vue?.impactScope ?? '影响范围待核实'),
    description: incident
      ? factDisplay(incident.factRefs.incidentDescription, scope)
      : (vue?.description ?? `${title}（演示）`),
    risks: vue?.risks
      ?? (/积水|内涝/.test(disasterType)
        ? '涉水触电、车辆漂浮、地下空间进水和交通阻断'
        : '渗流发展、堤体稳定与临水作业风险'),
    resourcesText: vue?.resourcesNote ? `${resourcesText}\n${vue.resourcesNote}` : resourcesText,
    hasIncident: true,
  };
}

function overview(ctx: EventFillContext): string {
  return [
    ctx.title,
    `灾种：${ctx.disasterType}`,
    `地点：${ctx.location}`,
    ctx.description,
    `影响范围：${ctx.impact}`,
    `人员情况：${ctx.casualty}`,
    `接报/发生时间：${ctx.occurredAt}`,
    `处置状态：${ctx.controlStatus}`,
  ].join('\n');
}

function buildFromContext(ctx: EventFillContext, code: string): DocumentSection[] {
  const bound = ctx.hasIncident
    ? ''
    : '\n（尚未关联有效事件演示资料，以下为待补说明，请关联灾情后重新生成。）';

  switch (code) {
    case 'EMERGENCY_BRIEF':
      return [
        [EMERGENCY_BRIEF_TITLES[0], `${overview(ctx)}${bound}`],
        [EMERGENCY_BRIEF_TITLES[1], `拟投入/候选力量（尚未形成正式调派命令）：\n${ctx.resourcesText}\n现场组织指挥以属地及原系统登记为准。`],
        [EMERGENCY_BRIEF_TITLES[2], `围绕「${ctx.disasterType}」开展核查与处置准备；阶段状态：${ctx.controlStatus}。战果与完成情况以正式台账为准，未核实不得写成已完成。`],
        [EMERGENCY_BRIEF_TITLES[3], `重点难点：${ctx.risks}\n采取的措施（演示）：先遣勘察、风险隐患评估后再投入主力；缺口与待核事项按岗位清单推进。`],
        [EMERGENCY_BRIEF_TITLES[4], '报送对象、抄送单位、承办处室及期号待原要情模块填写；本草稿不替代审批传阅。'],
      ];
    case 'DUTY_DAILY':
      return [
        [DUTY_DAILY_TITLES[0], '本班次值班人员在位情况以值守表报送数据为准；所属单位值班室在岗情况待核（模拟）。'],
        [DUTY_DAILY_TITLES[1], `关联事件：${ctx.title}（${ctx.disasterType}）。地点：${ctx.location}。\n概况：${ctx.description}\n候选力量（模拟）：\n${ctx.resourcesText}`],
        [DUTY_DAILY_TITLES[2], '本班次舆情与上访情况以宣传、信访部门反馈为准；未取得有效记录时不填写具体条数（模拟）。'],
        [DUTY_DAILY_TITLES[3], `下一班次继续跟踪：${ctx.risks}；核实待报信息并更新值班记录；遇有重要情况按程序报告（模拟）。`],
      ];
    case 'SITUATION_REPORT':
      return [
        [SITUATION_REPORT_TITLES[0], `${overview(ctx)}\n研判口径：到达现场不盲目施救，先成立专家组完成风险隐患评估，再展开救援（演示）。${bound}`],
        [SITUATION_REPORT_TITLES[1], `主要风险：${ctx.risks}\n能监测·会预警：监测指标与预警触发待核。演示检索圈层约 100 公里，不等于灾害边界。`],
        [SITUATION_REPORT_TITLES[2], `${ctx.resourcesText}\n台账常见维护周期最长约半年；可出动状态必须以状态更新时间为准，过期快照不直接出动。`],
        [SITUATION_REPORT_TITLES[3], `演示检索圈层：事发地周边约 100 公里内空旷场所、学校等待核；学校不自动认定为安置场所。\n医疗、宾馆、加油站可用性待属地确认。`],
      ];
    case 'RESOURCE_REPORT':
      return [
        [RESOURCE_REPORT_TITLES[0], `${overview(ctx)}\n编写单位：待补；统计截止时刻：待补；编写人：待补；审阅人：待确认。${bound}`],
        [RESOURCE_REPORT_TITLES[1], `${ctx.resourcesText}\n明细字段：所属工程局、队伍名称、人数、装备数、联系人及距事发地距离；缺失字段待核。`],
        [RESOURCE_REPORT_TITLES[2], '未取得本事件有效其他央企队伍记录，数量、所属央企、位置、人装及可出动状态待补核。'],
        [RESOURCE_REPORT_TITLES[3], `${ctx.resourcesText}\n现有记录不代表周边库存总量；技术状态、占用和更新时间待核。`],
        [RESOURCE_REPORT_TITLES[4], '未取得授权资料，装备类型、名称、所属央企及数量待补，不按零值汇总。'],
        [RESOURCE_REPORT_TITLES[5], `学校、医院、宾馆、加油站及其他重点防护目标待核。学校不自动认定为安全安置场所。主要风险：${ctx.risks}`],
        [RESOURCE_REPORT_TITLES[6], '本事件查询半径尚未指定，不沿用样例固定 300/10 公里；台账常见维护周期最长约半年。查询范围不代表灾害影响边界。'],
      ];
    case 'RESCUE_PLAN':
      return [
        [RESCUE_PLAN_TITLES[0], `${overview(ctx)}\n研判口径：先成立专家组完成风险隐患评估，再展开救援；先遣组完成现场侦测与通行条件核对后投入主力。\n中国安能集团抢险救灾典型案例（案例库·演示）：同类处置强调先遣评估与通行条件核对，不写入他案人数。${bound}`],
        [RESCUE_PLAN_TITLES[1], `${personnelGroupingText(ctx.resourcesText)}\n编组原则：精干高效，数量由经验人员最终敲定；正式抽组仍走原系统。`],
        [RESCUE_PLAN_TITLES[2], '现场指挥机构、技术组、安全组及保障组岗位名单待原系统确认；本草稿不成立新的指挥关系。先遣组向现场指挥机构回传侦测与属地对接情况。'],
        [RESCUE_PLAN_TITLES[3], `（一）救援基本条件与侦测依据\n按「${ctx.disasterType}」核对道路、展开面、供电通信；地点 ${ctx.location}。\n先遣组侦测处置：侦测处置分队（先遣组）搜集掌握情况通常采取研究上级通报、与地方有关部门对接，并应用侦测设备开展情报收集。\n（二）战法要点（内部战法参考·演示）\n围绕主要风险「${ctx.risks}」组织专业处置准备，工法参数待专家组论证。\n（三）人装编组与料源\n${personnelGroupingText(ctx.resourcesText)}\n（四）安全预警与撤离\n进入条件、停工撤离触发、撤离路线及人员清点待安全岗确认。\n（五）综合保障\n运输、供电、餐食、服装、医疗、通信及人员轮换责任岗位待核定；与上级公司建立应急通信指挥链条。`],
        [RESCUE_PLAN_TITLES[4], `主要风险与困难：${ctx.risks}\n人员情况：${ctx.casualty}。附件：人装编组清单、先遣组侦测记录等待补；审签沿用原处置方案模块；以上为演示初稿，不构成现场作业指令。`],
      ];
    case 'RESCUE_EVAL':
      return [
        [RESCUE_EVAL_TITLES[0], `${overview(ctx)}\n险情状态：${ctx.controlStatus}（模拟跟踪）。${bound}`],
        [RESCUE_EVAL_TITLES[1], `围绕「${ctx.disasterType}」阶段目标推进情况以台账为准；候选力量：\n${ctx.resourcesText}`],
        [RESCUE_EVAL_TITLES[2], '模拟记录显示阶段目标正在推进，仍有未完成事项，尚不能判定救援任务全部完成。正式评价须对照生效方案版本与执行回执。'],
        [RESCUE_EVAL_TITLES[3], `剩余风险：${ctx.risks}\n改进建议：补齐通信、轮换与物资消耗证据；明确责任人、期限及验证材料。`],
      ];
    case 'WORK_SUMMARY':
      return [
        [WORK_SUMMARY_TEMPLATE_TITLES[0], `${overview(ctx)}${bound}`],
        [WORK_SUMMARY_TEMPLATE_TITLES[1], `（一）处置组织：围绕${ctx.disasterType}任务开展核查与协同。\n（二）资源准备：\n${ctx.resourcesText}\n（候选未等于已调派）。`],
        [WORK_SUMMARY_TEMPLATE_TITLES[2], `短板与启示：通信、交接及保障类问题易重复出现；风险关注：${ctx.risks}。不作问责定性。`],
        [WORK_SUMMARY_TEMPLATE_TITLES[3], '按缺口逐项明确责任人、完成时限与验证材料；持续跟踪监测与现场回传（模拟）。'],
      ];
    case 'WORK_SUMMARY_REFLECT':
      return [
        [WORK_SUMMARY_REFLECT_TITLES[0], `${overview(ctx)}\n力量候选：\n${ctx.resourcesText}${bound}`],
        [WORK_SUMMARY_REFLECT_TITLES[1], `围绕「${ctx.disasterType}」组织处置准备；实际执行版本与批准变更以原系统为准。`],
        [WORK_SUMMARY_REFLECT_TITLES[2], `${ctx.risks}\n通信、轮换、物资消耗等保障问题须有单据或影像佐证后再写入正式总结。`],
        [WORK_SUMMARY_REFLECT_TITLES[3], '围绕未完成事项补齐证据与岗位责任；每项改进明确负责人、期限及验证材料（模拟）。'],
      ];
    case 'MEETING_MINUTES':
      return [
        [MEETING_MINUTES_TITLES[0], `会议围绕「${ctx.title}」（${ctx.disasterType}）的风险排查、应急值守与信息报送开展研究。地点：${ctx.location}。`],
        [MEETING_MINUTES_TITLES[1], `建立重点风险清单（关注：${ctx.risks}），明确责任人和跟进节点；完善信息核实与报送流程；对力量调配和物资保障需求开展联合研判。`],
        [MEETING_MINUTES_TITLES[2], '各工作组按职责细化任务，及时反馈推进情况。未确认事项纳入跟踪台账，后续以核实结果更新纪要附件。'],
      ];
    case 'RESOURCE_QUERY':
      return [
        [RESOURCE_QUERY_TITLES[0], `检索需求：事发周边队伍、装备、物资、专家、保障单元及学校/医院/宾馆/加油站等影响目标。\n事件：${ctx.title}；地点：${ctx.location}；灾种：${ctx.disasterType}。${bound}`],
        [RESOURCE_QUERY_TITLES[1], ctx.resourcesText],
        [RESOURCE_QUERY_TITLES[2], '专业、位置、距离、人数、装备、可用状态和更新时间待授权台账核对。台账常见维护周期最长约半年；过期快照不直接出动。投送堵点：通行保障与对外协调。'],
      ];
    case 'RESOURCE_STATUS':
      return [
        [RESOURCE_STATUS_TITLES[0], `当前材料：\n${ctx.resourcesText}\n待核：在岗/占用、单件标识、技术状态、状态更新时间。`],
        [RESOURCE_STATUS_TITLES[1], '可在对话中补充校正信息，形成待核材料。台账常见维护周期最长约半年；正式台账更新机制、IoT 接入由平台确认。'],
      ];
    case 'KNOWLEDGE':
      return [
        ['预案', `${ctx.disasterType}相关预案与规范要点（演示）；关联事件：${ctx.title}`],
        ['复核与适用边界', `${ctx.risks}。以上为产品演示参考材料，需专业复核，不构成现场作业指令。`],
      ];
    default:
      return [
        [SITUATION_REPORT_TITLES[0], `${overview(ctx)}${bound}`],
        [SITUATION_REPORT_TITLES[1], `主要风险：${ctx.risks}`],
        [SITUATION_REPORT_TITLES[2], ctx.resourcesText],
        [SITUATION_REPORT_TITLES[3], '安全场所与医疗资源待核。'],
      ];
  }
}

/** 按当前事件填充文书章节；永不返回纯占位万能句铺满的架子正文。 */
export function resolveDocumentSections(eventId: string, code: string): DocumentSection[] {
  const profile = disasterProfileById.get(eventId);
  if (profile) {
    const sections = buildDisasterSections(profile, code);
    if (sections.some(([, body]) => body.includes(PLACEHOLDER_MARK))) {
      return buildFromContext(readEventFillContext(eventId), code);
    }
    return sections;
  }
  return buildFromContext(readEventFillContext(eventId), code);
}

/** 生成文书标题：事件名 · 文种（新生成） */
export function resolveDocumentTitle(eventId: string, categoryName: string, topicFallback?: string): string {
  const ctx = readEventFillContext(eventId);
  if (ctx.hasIncident && ctx.name && !ctx.name.startsWith('evt-')) {
    return `${ctx.name} · ${categoryName}（新生成）`;
  }
  if (topicFallback) return `${topicFallback}（新生成）`;
  return `${categoryName}（新生成）`;
}

export const DOCUMENT_SKELETON_FORBIDDEN = PLACEHOLDER_MARK;
