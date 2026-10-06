/**
 * 版头/落款规格按 `/mnt/Data2/01-文书` 里的真件提取：
 * - 值班日报：「中国安能建设集团有限公司」+ 红字大字文种，无字号行、无黑色标题行；
 *   结尾=值班员/值班电话。
 * - 应急要情：平台行 + 机关标志 + 「应 急 救 援 要 情」，有期号行与黑色标题行；
 *   结尾=报送/抄送/承办·编辑·电话。
 * - 报告类（工作总结/会议纪要）：机关标志 + 红字文种 + 黑色标题；结尾=单位署名 + 日期 + 联系人。
 */
export type RedheadSpec = {
  /** 平台行（真件应急要情在机关标志上方还有一行平台名） */
  platform?: string;
  org: string;
  /** 红字大字文种，真件里逐字加宽（如「值 班 日 报」） */
  type: string;
  /** 日报类不排字号/期号行 */
  showNumber?: boolean;
  /** 日报类不排黑色标题行（标题即红字文种） */
  showTitle?: boolean;
  /** 结尾块样式 */
  tail: 'duty' | 'brief' | 'report';
};

/** 文书库样稿，不写入正式文书审批与事实快照。 */
export const DOCUMENT_CATEGORIES = [
  { code: 'DUTY_DAILY', name: '值班日报', prefix: '应急值', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '值 班 日 报', showNumber: false, showTitle: false, tail: 'duty' }, topics: ['防汛值守日报', '夜间值守交接日报'], sections: [
    ['一、人员在位情况', '本班次值班人员在位情况以值守表报送数据为准。模拟样例：值班领导 1 人、值班员 2 人、保障人员 2 人，所属单位值班室均在岗（模拟）。'],
    ['二、应急救援情况', '本班次接报险情 2 起，其中处置中 1 起、已控制 1 起；投入抢险人员 18 人、挖掘机 2 台（模拟）。重点险情：清河段堤防管涌，已完成围井反滤并持续监测水位（模拟）。'],
    ['三、舆情上访情况', '本班次未发现相关舆情与上访情况；核查结论以宣传、信访部门反馈为准（模拟）。'],
    ['四、交接事项', '下一班次继续跟踪重点险情发展，核实待报信息并更新值班记录；遇有重要情况按程序报告（模拟）。'],
  ] },
  { code: 'EMERGENCY_BRIEF', name: '应急要情', prefix: '应急报', redhead: { platform: '中央企业应急救援综合平台', org: '中国安能建设集团有限公司', type: '应 急 救 援 要 情', showNumber: true, showTitle: true, tail: 'brief' }, topics: ['重点河段险情处置要情', '低洼路段积水防范要情'], sections: [
    ['一、灾（险）情概述', '2026年9月28日22时，接清河段巡堤人员报告，南堤堤防背水坡出现管涌险情，涌水浑浊带砂。发生时间、影响范围与人员情况以模拟数据源登记值为准（模拟）。'],
    ['二、投入力量及组织指挥', '现场处置由属地防汛指挥机构统一组织，投入抢险人员 18 人、挖掘机 2 台、编织袋 500 条、反滤料 30 立方米（模拟）。所列力量为拟使用资源，尚未形成正式调派命令。'],
    ['三、处置行动及战果', '采取围井导滤、反滤料铺压、抛投黏土等措施；截至模拟统计时点，涌水由浑转清、出水量减小，险情发展得到初步控制（模拟）。'],
    ['四、重点、难点及采取的措施', '重点、难点：控制渗流通道，防止堤身进一步掏空；夜间作业、取土场地受限。采取的措施：分段施工、加密水位与位移监测、预置抢险物资与备用电源（模拟）。'],
    ['五、其他重要情况', '报送：集团应急指挥中心（模拟）；抄送：清河段防汛值班室（模拟）；承办：市应急指挥中心值班室（模拟）。'],
  ] },
  { code: 'MEETING_MINUTES', name: '会议纪要', prefix: '应急会纪', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '会 议 纪 要', showNumber: true, showTitle: true, tail: 'report' }, topics: ['防汛应急协调会议纪要', '值班值守工作部署会议纪要'], sections: [
    ['一、会议议题', '会议围绕重点区域风险排查、应急值守与信息报送开展研究。参会单位包括值班协调、现场巡查和物资保障等工作组（模拟设定）。'],
    ['二、议定事项', '建立重点风险清单，明确责任人和跟进节点；完善信息核实与报送流程；对力量调配和物资保障需求开展联合研判。'],
    ['三、落实安排', '各工作组按职责细化任务，及时反馈推进情况。未确认事项纳入跟踪台账，后续以核实结果更新纪要附件。'],
  ] },
  { code: 'WORK_SUMMARY', name: '工作总结', prefix: '应急综', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '工 作 总 结', showNumber: true, showTitle: true, tail: 'report' }, topics: ['阶段性防汛工作总结', '应急值守保障工作总结'], sections: [
    ['一、基本情况', '本阶段受领防汛抢险任务，投入人员 24 人、设备 3 台，响应耗时 35 分钟；累计转移人员 54 人、封堵管涌点 2 处，消耗编织袋 1200 条（模拟）。'],
    ['二、主要经验做法', '（一）前置力量、快速响应：任务下达后 35 分钟内完成编组出动。（二）双通道通信保障：中继补点与专人转报结合，解决作业区通信盲区。（三）清单化移交：按作业区建立交接清单，明确事项、责任人与完成时限。（四）标准化物资模块：按救援单元配齐反滤料、照明与备用电源，缩短取用时间（模拟）。'],
    ['三、深刻启示', '一是复杂环境下的通信与夜间保障仍是短板；二是跨班交接与信息报送口径需要统一；三是分作业点资源消耗核算尚未建立，难以评估使用效率（模拟）。'],
    ['四、下一步工作打算', '完善通信盲区覆盖与备用电源配置，按节点组织演练；建立分作业点物资消耗核算；明确整改责任人与完成时限，定期复盘并跟踪改进效果（模拟）。'],
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

/**
 * MockDocument 是扁平结构，逐字段比较即可。
 * 编辑路径原来用 `JSON.stringify(a) === JSON.stringify(b)` 判断「是否改回原文」，
 * 每次击键都要把整篇文书序列化好几遍；这里改成常数级字段比较。
 */
export function sameMockDocument(a: MockDocument, b: MockDocument): boolean {
  if (a === b) return true;
  if (a.id !== b.id || a.code !== b.code || a.title !== b.title || a.date !== b.date || a.number !== b.number) return false;
  if (a.sections.length !== b.sections.length) return false;
  return a.sections.every(
    (section, index) => section[0] === b.sections[index][0] && section[1] === b.sections[index][1],
  );
}

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
