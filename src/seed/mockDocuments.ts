/** 文书库样稿，不写入正式文书审批与事实快照。 */
export const DOCUMENT_CATEGORIES = [
  { code: 'DUTY_DAILY', name: '值班日报', prefix: '应急值', topics: ['防汛值守日报', '夜间值守交接日报'], sections: [
    ['一、值班概况', '本班次持续开展应急值守，汇总各值守点报送信息，重点关注河道水位、堤防巡查和低洼路段积水情况。相关数据仍需按报送流程核实。'],
    ['二、处置进展', '值班人员已联络相关责任单位，建立情况跟踪台账。巡查反馈、力量到场和物资保障情况正在逐项核对。'],
    ['三、交接事项', '下一班次继续跟踪重点区域变化，核实待报信息，及时更新值班记录；遇有重要情况按程序报告。'],
  ] },
  { code: 'EMERGENCY_BRIEF', name: '应急要情', prefix: '应急报', topics: ['重点河段险情处置要情', '低洼路段积水防范要情'], sections: [
    ['一、基本情况', '接到重点区域情况报告后，值班室立即开展信息核实。具体发生时间、影响范围和人员情况以现场续报为准，当前均列为待核实事项。'],
    ['二、先期处置', '有关单位正在开展现场巡查、警戒提示和处置准备，救援力量与物资需求由现场负责人进一步确认。'],
    ['三、工作要求', '持续跟踪事态变化，强化部门信息共享，及时补充核实情况并形成续报，避免使用未经确认的结论。'],
  ] },
  { code: 'MEETING_MINUTES', name: '会议纪要', prefix: '应急会纪', topics: ['防汛应急协调会议纪要', '值班值守工作部署会议纪要'], sections: [
    ['一、会议议题', '会议围绕重点区域风险排查、应急值守与信息报送开展研究。参会单位包括值班协调、现场巡查和物资保障等工作组（模拟设定）。'],
    ['二、议定事项', '建立重点风险清单，明确责任人和跟进节点；完善信息核实与报送流程；对力量调配和物资保障需求开展联合研判。'],
    ['三、落实安排', '各工作组按职责细化任务，及时反馈推进情况。未确认事项纳入跟踪台账，后续以核实结果更新纪要附件。'],
  ] },
  { code: 'WORK_SUMMARY', name: '工作总结', prefix: '应急综', topics: ['阶段性防汛工作总结', '应急值守保障工作总结'], sections: [
    ['一、工作开展情况', '本阶段围绕风险防范、应急值守和协调保障推进工作，梳理重点区域台账，完善信息接报、核实和跟踪机制。'],
    ['二、存在问题', '部分信息报送口径仍需统一，跨单位协同反馈有待加快，动态台账更新和交接记录完整性需要进一步提升。'],
    ['三、下一步计划', '持续完善工作清单，强化值守培训与应急演练，明确整改责任和完成节点，定期复盘并跟踪改进效果。'],
  ] },
] as const;

export type MockDocument = {
  id: string;
  code: string;
  title: string;
  date: string;
  number: string;
  sections: readonly (readonly [string, string])[];
};

export const MOCK_DOCUMENTS: MockDocument[] = DOCUMENT_CATEGORIES.flatMap(category =>
  category.topics.map((title, index) => ({
    id: `sample-${category.code}-${index}`,
    code: category.code,
    title,
    date: `2026年9月${28 - index}日`,
    number: `${category.prefix}〔2026〕${String(index + 21).padStart(3, '0')}号`,
    sections: category.sections,
  })),
);
