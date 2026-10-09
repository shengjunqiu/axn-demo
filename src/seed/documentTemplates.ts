/**
 * 一期过程公文 / 处置方案材料对齐的文书章节骨架与十类灾种填充。
 * 章节名固定；正文随 DisasterProfile 变化。不写入历史案例人数/联系人。
 * 仅 type-only 引用 profile，避免与 disasterScenarios 循环依赖。
 */
import type { DisasterProfile } from './disasterScenarios';

export type DocumentSection = [string, string];

function disasterMonitoringText(p: DisasterProfile): string {
  return p.monitoring
    .map((m) => `${m.label}（${m.unit}）：${m.times.map((time, i) => `${time} ${m.values[i]}`).join(' → ')}；${m.source}`)
    .join('\n');
}

function disasterResourcesText(p: DisasterProfile): string {
  return p.resources.map((r) => `${r.name} / ${r.amount} / ${r.capability} / ${r.status}`).join('\n');
}

/** 文书 code：含智能体样稿与一期模板章。 */
export type DisasterDocCode =
  | 'SITUATION_REPORT'
  | 'RESOURCE_REPORT'
  | 'RESCUE_PLAN'
  | 'EMERGENCY_BRIEF'
  | 'DUTY_DAILY'
  | 'WORK_SUMMARY'
  | 'WORK_SUMMARY_REFLECT'
  | 'RESCUE_EVAL'
  | 'KNOWLEDGE';

export const RESOURCE_REPORT_TITLES = [
  '一、抢险基本信息',
  '二、安能队伍情况',
  '三、其他央企队伍情况',
  '四、安能装备情况',
  '五、其他央企装备情况',
  '六、重点防护目标情况',
  '七、范围与数据核验',
] as const;

export const RESCUE_PLAN_TITLES = [
  '一、基本情况',
  '二、任务受领与力量抽组',
  '三、指挥机构',
  '四、主要措施',
  '五、风险困难与附件落款',
] as const;

export const SITUATION_REPORT_TITLES = [
  '一、灾情概况',
  '二、安全态势与发展关注',
  '三、队伍与人员状态时效',
  '四、安全场所与医疗资源核查',
] as const;

export const EMERGENCY_BRIEF_TITLES = [
  '一、灾（险）情概述',
  '二、投入力量及组织指挥',
  '三、处置行动及战果',
  '四、重点、难点及采取的措施',
  '五、其他重要情况',
] as const;

export const DUTY_DAILY_TITLES = [
  '一、人员在位情况',
  '二、应急救援情况',
  '三、舆情上访情况',
  '四、交接事项',
] as const;

export const WORK_SUMMARY_TEMPLATE_TITLES = [
  '一、基本情况',
  '二、主要经验做法',
  '三、深刻启示',
  '四、下一步工作打算',
] as const;

export const WORK_SUMMARY_REFLECT_TITLES = [
  '一、实际处置过程',
  '二、处置方案',
  '三、存在不足',
  '四、下一步改进计划',
] as const;

export const RESCUE_EVAL_TITLES = [
  '一、当前处置情况',
  '二、阶段性救援成效',
  '三、评估结论',
  '四、剩余风险与改进建议',
] as const;

const PLACEHOLDER = '（由智能体按当前关联事件生成；正式结论以岗位核对为准）';

function teamResources(p: DisasterProfile) {
  return p.resources.filter((r) => r.kind === 'team');
}

function equipmentResources(p: DisasterProfile) {
  return p.resources.filter((r) => r.kind === 'equipment' || r.kind === 'warehouse');
}

function hospitalResources(p: DisasterProfile) {
  return p.resources.filter((r) => r.kind === 'hospital');
}

function formatList(items: { name: string; amount: string; capability: string; status: string }[], empty: string): string {
  if (!items.length) return empty;
  return items.map((r) => `${r.name} / ${r.amount} / ${r.capability} / ${r.status}`).join('\n');
}

function planBody(p: DisasterProfile): string {
  return p.planSections.map(([h, b]) => `${h}：${b}`).join('\n');
}

function measureSlot(p: DisasterProfile, index: number, fallback: string): string {
  const item = p.planSections[index];
  return item ? `${item[0]}：${item[1]}` : fallback;
}

/** 按章节标题关键词取 planSections，避免顺序变化后战法串味。 */
function planSectionByKeyword(p: DisasterProfile, keywords: string[], fallback: string): string {
  const hit = p.planSections.find(([h]) => keywords.some((k) => h.includes(k)));
  return hit ? `${hit[0]}：${hit[1]}` : fallback;
}

function keyMonitoringLine(p: DisasterProfile, limit = 5): string {
  return p.monitoring.slice(0, limit).map((m) => {
    const latest = m.values.at(-1);
    const time = m.times.at(-1) ?? '';
    return `${m.label} ${latest ?? '缺测'}${m.unit}（${time}）`;
  }).join('；');
}

function overviewLine(p: DisasterProfile): string {
  return [
    `${p.name}；灾种：${p.category}；地点：${p.location}`,
    p.description,
    `影响范围：${p.impactScope}；人员情况：${p.casualty}`,
    `阶段：${p.stage}；模拟资料时间：${p.capturedAt}`,
  ].join('\n');
}

function buildSituationReport(p: DisasterProfile): DocumentSection[] {
  const teams = formatList(teamResources(p), '本事件尚无队伍候选记录，可出动状态与更新时间待核。');
  const hospitals = formatList(hospitalResources(p), '医院接诊容量、路线及属地联系人待卫健岗位确认。');
  const secondary = p.riskDistribution.map((r) => `${r.area}：${r.count}条模拟风险线索`).join('\n');
  return [
    [
      '一、灾情概况',
      `${overviewLine(p)}\n研判口径：到达现场不盲目施救，先成立专家组完成风险隐患评估，再展开救援（演示）。`,
    ],
    [
      '二、安全态势与发展关注',
      `主要风险：${p.risks}\n次生灾害关注：\n${secondary || '次生风险线索待补'}\n能监测·会预警：监测指标见下；预警触发阈值与推送责任人待核。\n监测（模拟）：\n${disasterMonitoringText(p)}\n安全范围由专业勘察确认；演示检索圈层约 100 公里，不等于灾害边界。`,
    ],
    [
      '三、队伍与人员状态时效',
      `${teams}\n配套装备与物资候选（模拟）：\n${formatList(equipmentResources(p), '装备与物资明细待核。')}\n台账常见维护周期最长约半年；可出动状态必须以状态更新时间为准，过期快照不直接出动。冲突值保留来源并人工确认。候选资源未形成正式调派。`,
    ],
    [
      '四、安全场所与医疗资源核查',
      `演示检索圈层：事发地周边约 100 公里内空旷场所、学校等（演示口径，非本事件已确认安全边界）。\n空旷集结 / 学校：${p.location}外围约 100 公里内场所名称、开放状态与容量待核；学校不自动认定为安全安置场所。\n宾馆、加油站等影响分析目标：名称、距离、可用性待核。\n医疗：${hospitals}`,
    ],
  ];
}

function buildResourceReport(p: DisasterProfile): DocumentSection[] {
  const teams = formatList(
    teamResources(p),
    '未取得本事件有效安能队伍记录，所属工程局、梯队、人数、装备数、联系人及距事发地距离待补核。',
  );
  const equipment = formatList(
    equipmentResources(p),
    '未取得本事件安能装备明细，类型、名称、数量、所属队伍及技术状态待补。',
  );
  return [
    [
      '一、抢险基本信息',
      `${overviewLine(p)}\n编写单位：待补；统计截止时刻：待补（到场时刻不等于统计截止时刻）；编写人：待补；审阅人：待确认。`,
    ],
    [
      '二、安能队伍情况',
      `${teams}\n明细字段：所属工程局、队伍名称、地址、所属梯队、人数、装备数、业务联系人、工作联系电话和距事发地距离；缺失字段待核。`,
    ],
    [
      '三、其他央企队伍情况',
      '未取得本事件有效其他央企队伍记录，数量、所属央企、位置、人装及可出动状态待补核。',
    ],
    [
      '四、安能装备情况',
      `${equipment}\n现有记录不代表周边库存总量。按装备类型、名称、数量、所属队伍及业务联络字段形成明细，技术状态、占用和更新时间待核。`,
    ],
    [
      '五、其他央企装备情况',
      '未取得授权资料，装备类型、名称、所属央企及数量待补，不按零值汇总。',
    ],
    [
      '六、重点防护目标情况',
      `学校、医院、宾馆、加油站及其他重点防护目标的名称、地址、数量、距离、联系人和可用性待核。学校不自动认定为安全安置场所。\n本事件缺口提示：${p.gaps}`,
    ],
    [
      '七、范围与数据核验',
      '一期样例资源查询曾采用300公里、重点目标采用10公里。本事件查询半径尚未指定，不沿用样例固定数值；查询范围不代表灾害影响边界。台账常见维护周期最长约半年，可出动状态须以状态更新时间为准。各类汇总须注明统计时间、单位和去重口径。',
    ],
  ];
}

function historyCaseRefs(p: DisasterProfile): string {
  return [
    `案例库·演示：同类「${p.category}」处置中，先遣组先完成风险隐患评估与展开条件核对，再投入主力作业；他案人数与联系人不写入本事件。`,
    `案例库·演示：复杂通行条件下优先核对道路天气与投送方式（如封山时装备禁高速、人员改铁路），再固化梯队计划。`,
  ].join('\n');
}

function buildRescuePlan(p: DisasterProfile): DocumentSection[] {
  const detect = planSectionByKeyword(p, ['侦测', '适用险情'], measureSlot(p, 0, '侦测依据待补。'));
  const tactics = planSectionByKeyword(p, ['主战法', '战法'], measureSlot(p, 1, '战法与工法参数待专业岗位论证补充。'));
  const force = planSectionByKeyword(p, ['人装', '料源'], `专业人装与料源：\n${disasterResourcesText(p)}`);
  const watch = planSectionByKeyword(p, ['监测预警', '撤离'], measureSlot(p, 3, '监测预警与撤离触发待安全岗位确认。'));
  const safety = planSectionByKeyword(p, ['安全红线', '待核'], measureSlot(p, 4, '进入条件、停工撤离触发条件、撤离路线及人员清点安排待安全岗位确认。'));
  const command = planSectionByKeyword(p, ['指挥协同', '审签'], '现场指挥机构、技术组、安全组及保障组岗位名单待原系统确认；本草稿不成立新的指挥关系。');
  return [
    [
      '一、基本情况',
      `${overviewLine(p)}\n适用预案参考：${p.planTitle}（模拟参考，非正式签发版；吸收安能公开战法关键词，不冒充九分案正文）。\n灾种关键监测最新值（模拟）：${keyMonitoringLine(p)}\n研判口径：先成立专家组完成风险隐患评估，再展开救援。\n${detect}\n历史案例参考（中性摘要，不写入他案人数）：\n${historyCaseRefs(p)}`,
    ],
    [
      '二、任务受领与力量抽组',
      `任务目标（模拟）：${p.objective}，阶段进度 ${p.completed}/${p.target}${p.unit}。\n${force}\n编组原则：精干高效，数量由经验人员最终敲定；正式抽组、报备与锁定仍走原系统流程。`,
    ],
    [
      '三、指挥机构',
      command,
    ],
    [
      '四、主要措施',
      [
        '（一）救援基本条件与侦测依据',
        `道路通行、作业展开面、供电通信及安全检测条件待核。主要风险：${p.risks}。\n${detect}\n监测摘要：\n${disasterMonitoringText(p)}`,
        '（二）主战法与作业步骤（内部战法参考·演示）',
        `${tactics}\n行动战法仅限授权人员查看，禁止下载；本草稿不替代正式战法库或九分案审批稿。`,
        '（三）人装编组与料源',
        `${force}\n按任务与展开条件控制规模，岗位人数由负责人核定。`,
        '（四）安全预警与撤离',
        `${watch}\n${safety}\n次生风险变化时同步预警推送责任岗位；撤离路线与人员清点待安全岗确认。`,
        '（五）综合保障',
        '运输、供电、餐食、服装、医疗及人员轮换责任岗位待核定。宣传口径待宣传岗位确认；通信保障：中继补点、报送渠道与备用电源待通信岗位确认。',
      ].join('\n'),
    ],
    [
      '五、风险困难与附件落款',
      `主要风险与困难：${p.risks}\n${p.gaps}\n${safety}\n附件：现场照片、监测曲线、人装清单、安全交底、历史案例索引（待补）。\n落款：拟稿单位待补；审签流程沿用原处置方案模块。以上为演示初稿，不构成现场作业指令。`,
    ],
  ];
}

function buildEmergencyBrief(p: DisasterProfile): DocumentSection[] {
  return [
    ['一、灾（险）情概述', overviewLine(p)],
    [
      '二、投入力量及组织指挥',
      `拟投入/候选力量（尚未形成正式调派命令）：\n${disasterResourcesText(p)}\n现场组织指挥以属地及原系统登记为准，本草稿所列力量为演示候选。`,
    ],
    [
      '三、处置行动及战果',
      `阶段目标：${p.objective}；进度 ${p.completed}/${p.target}${p.unit}（模拟）。\n处置参考：\n${planBody(p)}\n战果与完成情况以正式台账为准，未核实不得写成已完成。`,
    ],
    [
      '四、重点、难点及采取的措施',
      `重点难点：${p.risks}\n采取的措施（演示）：结合本灾种预案要点推进核查与处置准备；缺口：${p.gaps}`,
    ],
    [
      '五、其他重要情况',
      '报送对象、抄送单位、承办处室及期号待原要情模块填写；本草稿不替代审批传阅。',
    ],
  ];
}

function buildDutyDaily(p: DisasterProfile): DocumentSection[] {
  return [
    [
      '一、人员在位情况',
      '本班次值班人员在位情况以值守表报送数据为准；所属单位值班室在岗情况待核（模拟）。',
    ],
    [
      '二、应急救援情况',
      `关联事件：${p.name}（${p.category}）。阶段：${p.stage}。\n概况：${p.description}\n候选力量与进度（模拟）：${p.objective} ${p.completed}/${p.target}${p.unit}；${disasterResourcesText(p)}`,
    ],
    [
      '三、舆情上访情况',
      '本班次舆情与上访情况以宣传、信访部门反馈为准；未取得有效记录时不填写具体条数（模拟）。',
    ],
    [
      '四、交接事项',
      `下一班次继续跟踪：${p.gaps}；核实待报信息并更新值班记录；遇有重要情况按程序报告（模拟）。`,
    ],
  ];
}

function buildWorkSummaryTemplate(p: DisasterProfile): DocumentSection[] {
  return [
    [
      '一、基本情况',
      `${overviewLine(p)}\n阶段目标：${p.objective}，进度 ${p.completed}/${p.target}${p.unit}（模拟）。任务成果与投入以正式台账为准。`,
    ],
    [
      '二、主要经验做法',
      `（一）处置组织：围绕${p.category}任务开展核查与协同。\n（二）专业要点：\n${planBody(p)}\n（三）资源准备：${disasterResourcesText(p)}（候选未等于已调派）。`,
    ],
    [
      '三、深刻启示',
      `短板与启示：${p.gaps}；风险关注：${p.risks}。问题归因须有过程记录支持，不作问责定性。`,
    ],
    [
      '四、下一步工作打算',
      `按缺口逐项明确责任人、完成时限与验证材料：${p.gaps}；持续跟踪监测与现场回传（模拟）。`,
    ],
  ];
}

function buildWorkSummaryReflect(p: DisasterProfile): DocumentSection[] {
  return [
    [
      '一、实际处置过程',
      `${overviewLine(p)}\n监测（模拟）：\n${disasterMonitoringText(p)}\n力量候选：\n${disasterResourcesText(p)}`,
    ],
    [
      '二、处置方案',
      `预案参考：${p.planTitle}\n${planBody(p)}\n实际执行版本与批准变更以原系统为准。`,
    ],
    [
      '三、存在不足',
      `${p.gaps}\n风险：${p.risks}。通信、轮换、物资消耗等保障问题须有单据或影像佐证后再写入正式总结。`,
    ],
    [
      '四、下一步改进计划',
      `围绕未完成目标（${p.objective} ${p.completed}/${p.target}${p.unit}）补齐证据与岗位责任；每项改进明确负责人、期限及验证材料（模拟）。`,
    ],
  ];
}

function buildRescueEval(p: DisasterProfile): DocumentSection[] {
  const rate = p.target > 0 ? Math.round((p.completed / p.target) * 100) : 0;
  return [
    [
      '一、当前处置情况',
      `${overviewLine(p)}\n险情状态：按阶段「${p.stage}」跟踪（模拟）。人员情况：${p.casualty}。`,
    ],
    [
      '二、阶段性救援成效',
      `目标：${p.objective}；计划 ${p.target}${p.unit}，已完成 ${p.completed}${p.unit}，完成率约 ${rate}%（模拟口径）。\n监测摘要：\n${disasterMonitoringText(p)}`,
    ],
    [
      '三、评估结论',
      '模拟记录显示阶段目标正在推进，仍有未完成事项，尚不能判定救援任务全部完成。正式评价须对照生效方案版本与执行回执。',
    ],
    [
      '四、剩余风险与改进建议',
      `剩余风险：${p.risks}\n改进建议：${p.gaps}`,
    ],
  ];
}

function buildKnowledge(p: DisasterProfile): DocumentSection[] {
  return [
    ['灾种预案参考', p.planTitle],
    ...p.planSections,
    ['复核与适用边界', `${p.gaps}。以上为产品演示参考材料，需专业复核，不构成现场作业指令。`],
  ];
}

/** 按一期对齐骨架填充十类灾种文书章节。 */
export function buildDisasterSections(profile: DisasterProfile, code: string): DocumentSection[] {
  switch (code as DisasterDocCode | string) {
    case 'MEETING_MINUTES':
      return [
        ['会议基本信息', `关联事件：${profile.name}；${profile.category}；事件资料时间：${profile.capturedAt}。会议时间、地点、主持人、记录人和参会单位待补，不以事发地点代替会议地点。`],
        ['会议议题', `围绕${profile.objective}，核对${profile.risks}。本页为议题草稿，实际议程待确认。`],
        ['议定事项与责任分工', `需核对：${profile.gaps}。责任岗位、完成时限、办理回执待会议原始记录确认，不自动认定已议定或已下达。`],
        ['资料依据与待补事项', `模拟参考预案：${profile.planTitle}。原始会议记录、专家意见、有效预案版本及审核签发资料待补。`],
      ];
    case 'SITUATION_REPORT':
      return buildSituationReport(profile);
    case 'RESOURCE_REPORT':
      return buildResourceReport(profile);
    case 'RESCUE_PLAN':
      return buildRescuePlan(profile);
    case 'EMERGENCY_BRIEF':
      return buildEmergencyBrief(profile);
    case 'DUTY_DAILY':
      return buildDutyDaily(profile);
    case 'WORK_SUMMARY':
      return buildWorkSummaryTemplate(profile);
    case 'WORK_SUMMARY_REFLECT':
      return buildWorkSummaryReflect(profile);
    case 'RESCUE_EVAL':
      return buildRescueEval(profile);
    case 'KNOWLEDGE':
      return buildKnowledge(profile);
    default:
      return buildSituationReport(profile);
  }
}

/** 样稿库占位：仅标题齐套，正文由生成链路覆盖。 */
export function skeletonPlaceholders(code: DisasterDocCode): DocumentSection[] {
  const titles: Record<DisasterDocCode, readonly string[]> = {
    SITUATION_REPORT: SITUATION_REPORT_TITLES,
    RESOURCE_REPORT: RESOURCE_REPORT_TITLES,
    RESCUE_PLAN: RESCUE_PLAN_TITLES,
    EMERGENCY_BRIEF: EMERGENCY_BRIEF_TITLES,
    DUTY_DAILY: DUTY_DAILY_TITLES,
    WORK_SUMMARY: WORK_SUMMARY_TEMPLATE_TITLES,
    WORK_SUMMARY_REFLECT: WORK_SUMMARY_REFLECT_TITLES,
    RESCUE_EVAL: RESCUE_EVAL_TITLES,
    KNOWLEDGE: ['灾种预案参考', '复核与适用边界'],
  };
  return titles[code].map((title) => [title, PLACEHOLDER]);
}
