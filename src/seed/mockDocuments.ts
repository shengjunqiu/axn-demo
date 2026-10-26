/**
 * 版头/落款规格按真件提取；章节骨架对齐一期过程公文材料。
 * 样稿与生成正文均按演示事件填充，不再使用纯占位架子。
 * - 值班日报：机关标志 + 红字文种；结尾=值班员/值班电话。
 * - 应急抢险要情：平台行 + 机关标志 + 「应 急 抢 险 要 情」。
 * - 报告类：机关标志 + 红字文种 + 黑色标题。
 */
import { resolveDocumentSections } from './resolveDocumentSections';

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
  tail: 'duty' | 'brief' | 'report' | 'dynamics';
};

/** 文书库预置样稿所绑定的默认演示事件（清河段，含授权台账线索）。 */
export const MOCK_SAMPLE_EVENT_ID = 'evt-demo-001';

type CategoryDef = {
  code: string;
  name: string;
  prefix: string;
  redhead: RedheadSpec;
  topics: readonly string[];
  sections: ReturnType<typeof resolveDocumentSections>;
};

/** 文书库样稿，不写入正式文书审批与事实快照。 */
export const DOCUMENT_CATEGORIES: readonly CategoryDef[] = [
  { code: 'DAILY_WORK_SUMMARY', name: '日常工作总结', prefix: '工作综', redhead: { org: '中国安能建设集团有限公司', type: '工 作 总 结', showNumber: true, showTitle: true, tail: 'report' }, topics: [], sections: [['一、工作范围', '待填写工作主题与时段'], ['二、工作时间轴', '待补充工作记录'], ['三、亮点与依据', '待补充'], ['四、下一步工作', '待补充']] },
  { code: 'WEEKLY_DYNAMICS', name: '应急救援周工作动态', prefix: '应急周动', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '应 急 救 援 周 工 作 动 态', showNumber: true, showTitle: true, tail: 'dynamics' }, topics: ['防汛应急周工作动态', '应急救援能力建设周工作动态'], sections: [
    ['一、上周工作完成情况', [
      '（一）应急救援行动。4月18日，派员参加北京市丰台区防汛工作会议，共同研判防汛形势，介绍安能防灾减灾救灾能力，进一步顺畅对接协同机制。',
      '（二）应急能力建设。1.工程练兵。共有23支专业中队、1294人、507台装备，在39个项目参与工程练兵，周完成产值574.67万元，完成计划的104.49%。（详见附件1）2.训练培训。4月17日，召开通信侦测装备及无人机操作集训动员大会，来自各工程局、科工和研究院共100余人操作骨干在三局重庆队正式开训。',
      '（三）安全应急产业。1.市场拓展。本周新增中标项目（含直接签订合同）4个，合同金额106.88万元。2.安全应急产业营收。本周安全应急产业营收444.98万元。（详见附件2）3.重点客户及项目跟踪。一局推进与大藤峡2026年应急演练项目；二局推动内蒙古电力（集团）有限责任公司基干队伍应急培训项目落地；三局对接白鹤滩电站坝区地灾应急处理与边坡维护项目。',
    ].join('\n')],
    ['二、本周工作计划', [
      '（一）应急救援工作。1.督导各级加强应急值班备勤工作，重点加大对各救援基地、队伍视频检查力度。2.筹备抢险救灾动员部署会。',
      '（二）应急能力建设。1.工程练兵。计划完成产值602万元，其中一局189万元、二局300万元、三局113万元。2.国有资本预算申报。根据财政部批复编制预算执行计划，提交集团会议研究审议。',
      '（三）安全应急产业。1.安全应急服务营收。计划完成安全应急服务营收360.98万元，其中一局25万元、二局200万元、三局120万元、科工15.98万元。2.安全应急产品体系规范工作。组织专家对《安全应急服务产品清单实施指南》进行会审。',
    ].join('\n')],
    ['附件', [
      '附件1：工程练兵情况统计表',
      '附件2：安全应急产业营收情况统计表',
      '附件3：本周中标项目（直接签订合同项目）汇总表',
    ].join('\n')],
  ] },
  { code: 'DUTY_DAILY', name: '值班日报', prefix: '应急值', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '值 班 日 报', showNumber: false, showTitle: false, tail: 'duty' }, topics: ['应急值守日报', '夜间值守交接日报'], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'DUTY_DAILY') },
  { code: 'EMERGENCY_BRIEF', name: '应急抢险要情', prefix: '应急报', redhead: { platform: '中央企业应急救援综合平台', org: '中国安能建设集团有限公司', type: '应 急 抢 险 要 情', showNumber: true, showTitle: true, tail: 'brief' }, topics: ['险情处置要情', '应急救援过程要情'], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'EMERGENCY_BRIEF') },
  { code: 'MEETING_MINUTES', name: '会议纪要', prefix: '应急会纪', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '会 议 纪 要', showNumber: true, showTitle: true, tail: 'report' }, topics: ['应急协调会议纪要', '值班值守工作部署会议纪要'], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'MEETING_MINUTES') },
  { code: 'WORK_SUMMARY', name: '抢险总结', prefix: '应急综', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '抢 险 总 结', showNumber: true, showTitle: true, tail: 'report' }, topics: ['阶段性抢险总结', '应急值守保障工作总结'], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'WORK_SUMMARY') },
  // 四智能体建设材料（由对话任务物化到右侧红头文书）
  { code: 'GROUP_RECOMMENDATION', name: '智能编组推荐', prefix: '应急编', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '编 组 推 荐 方 案', showNumber: true, showTitle: true, tail: 'report' }, topics: [], sections: [['编组建议', '请关联事件并点击智能编组推荐生成方案。']] },
  { code: 'SURVEY_ANALYSIS', name: '现场勘察分析', prefix: '应急勘', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '勘 察 分 析 报 告', showNumber: true, showTitle: true, tail: 'report' }, topics: [], sections: [['勘察资料', '请选择事件并通过现场智能勘察辅助生成报告。']] },
  { code: 'SITUATION_REPORT', name: '态势报告', prefix: '应急态', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '灾 情 态 势 报 告', showNumber: true, showTitle: true, tail: 'report' }, topics: [], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'SITUATION_REPORT') },
  { code: 'RESOURCE_REPORT', name: '周边资源报告', prefix: '应急资', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '周 边 资 源 分 析 报 告', showNumber: true, showTitle: true, tail: 'report' }, topics: [], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'RESOURCE_REPORT') },
  // 查询 / 核对类材料：不当作一期「周边资源分析报告」红头，避免文种与正文结构错配。
  { code: 'RESOURCE_QUERY', name: '资源查询', prefix: '应急查', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '资 源 查 询 结 果', showNumber: true, showTitle: true, tail: 'report' }, topics: [], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'RESOURCE_QUERY') },
  { code: 'RESOURCE_STATUS', name: '资源状态核对', prefix: '应急核', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '资 源 状 态 核 对', showNumber: true, showTitle: true, tail: 'report' }, topics: [], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'RESOURCE_STATUS') },
  { code: 'RESCUE_PLAN', name: '工程救援处置方案', prefix: '应急案', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '工 程 救 援 处 置 方 案', showNumber: true, showTitle: true, tail: 'report' }, topics: [], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'RESCUE_PLAN') },
  { code: 'TRANSPORT_PLAN', name: '梯队投送方案', prefix: '应急投', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '梯 队 投 送 方 案', showNumber: true, showTitle: true, tail: 'report' }, topics: [], sections: [['投送依据', '请从投送页面生成并核对力量与通行条件。']] },
  { code: 'RESCUE_EVAL', name: '效果评估', prefix: '应急评', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '救 援 效 果 评 估', showNumber: true, showTitle: true, tail: 'report' }, topics: [], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'RESCUE_EVAL') },
];

/** 四智能体可物化为右侧红头文书的能力 → 文书分类（文种须与正文结构一致）。 */
export const AGENT_MATERIAL_CODES = {
  survey: 'SURVEY_ANALYSIS',
  situation: 'SITUATION_REPORT',
  situationReport: 'SITUATION_REPORT',
  search: 'RESOURCE_QUERY',
  resourceReport: 'RESOURCE_REPORT',
  update: 'RESOURCE_STATUS',
  group: 'GROUP_RECOMMENDATION',
  plan: 'RESCUE_PLAN',
  revise: 'RESCUE_PLAN',
  deviation: 'RESCUE_EVAL',
  summary: 'WORK_SUMMARY',
} as const;

export type MockDocumentHandoff = {
  status: 'uploaded' | 'submitted_review';
  /** 原系统接收栏目名称（演示） */
  target: string;
  uploadedAt: string;
  receiptId: string;
};

/** 样稿正文尾部的现场图片：不进富文本正文，由详情页按图注渲染（用户 m01044 提供的两张模拟素材）。 */
type MockFigure = { src: string; caption: string };

/**
 * 附件统计表（用户 m01163：周工作动态的附件要模拟出表格）。
 * 数据取自参考真件（/home/xx/应急救援周工作动态 .doc，WPS 导出的 6 页原件），
 * 表头只铺平一层：真件里的合并表头（如「年度累计完成情况/本周营收情况」跨列、「项目概况」下嵌 4 列）
 * 在 570px 宽的纸面上排不下，拆成一列一个语义完整的字段更可读。
 * `group` 是真件里的合并首列（如「本周完成产值」跨三行）：只写在每组第一行，渲染时按相邻行补 rowSpan。
 */
type MockTable = { title: string; head: readonly string[]; rows: readonly { group?: string; cells: readonly string[] }[] };

export type MockDocument = {
  id: string;
  code: string;
  title: string;
  date: string;
  number: string;
  sections: readonly (readonly [string, string])[];
  figures?: readonly MockFigure[];
  tables?: readonly MockTable[];
  paper?: Readonly<Record<string, string>>;
  /** 提交到原系统栏目的演示回执；上传不等于正式签发 */
  handoff?: MockDocumentHandoff;
};

/** 智能体文书 → 原系统栏目（演示映射，不接真实接口） */
export const MOCK_DOCUMENT_HANDOFF_TARGETS: Record<string, string> = {
  SITUATION_REPORT: '周边资源分析报告／态势参考附件（A01）',
  RESOURCE_REPORT: '周边资源分析报告（A01）',
  RESOURCE_QUERY: '周边资源分析报告／资源查询附件（A01）',
  RESOURCE_STATUS: '周边资源分析报告／资源状态核对（A01）',
  RESCUE_PLAN: '现场处置行动方案管理（S03）',
  RESCUE_EVAL: '抢险总结管理与编写（P02）',
  DUTY_DAILY: '应急抢险要情查询与编制／值班日报（B03）',
  EMERGENCY_BRIEF: '应急抢险要情查询与编制（B03）',
  MEETING_MINUTES: '全过程记录／会议纪要（P01）',
  WORK_SUMMARY: '抢险总结管理与编写（P02）',
};

export function handoffTargetFor(code: string) {
  return MOCK_DOCUMENT_HANDOFF_TARGETS[code] ?? '原系统对应栏目（演示）';
}

const NO_PAPER_FIELDS: string[] = [];
const SAMPLE_COVER: Partial<Record<string, { number: (index: number) => string; date: (index: number) => string }>> = {
  WEEKLY_DYNAMICS: {
    number: (index) => `〔2026〕第${13 + index}期`,
    date: (index) => `4月${11 + index * 7}日-4月${17 + index * 7}日`,
  },
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
  if (a.handoff?.receiptId !== b.handoff?.receiptId || a.handoff?.status !== b.handoff?.status) return false;
  if (!a.sections.every(
    (section, index) => section[0] === b.sections[index][0] && section[1] === b.sections[index][1],
  )) return false;
  // paper 通常是 undefined（没编辑过红头/落款），相同的 undefined 直接跳过，别每次击键都分配数组。
  if (a.paper === b.paper) return true;
  const keys = a.paper ? Object.keys(a.paper) : NO_PAPER_FIELDS;
  return keys.length === (b.paper ? Object.keys(b.paper).length : 0)
    && keys.every(key => a.paper?.[key] === b.paper?.[key]);
}

/**
 * 按标题挂的尾部附图：只给「重点河段险情处置要情」这一篇样稿配现场照片（用户 m01044）。
 * 图片放在 public/doc-assets/（原图 4096×3072、12–15MB，已压到 1400px / 约 350KB 再入库）。
 */
const SAMPLE_FIGURES: Record<string, readonly MockFigure[]> = {
  '重点河段险情处置要情': [
    { src: '/doc-assets/qinghe-site-1.jpg', caption: '图1　抢险机械进场清理危岩、开辟作业平台' },
    { src: '/doc-assets/qinghe-site-2.jpg', caption: '图2　现场指挥组与抢险队伍会商处置方案' },
  ],
};

/** 附件统计表（用户 m01163）：周工作动态的三张表，与上传门清单（services/weeklyDynamicsWorkflow 的
 * REQUIRED_ATTACHMENTS）及种子里的附件清单一一对应。数值全取自参考真件（模拟稿口径）。 */
const SAMPLE_TABLES: Record<string, readonly MockTable[]> = {
  WEEKLY_DYNAMICS: [
    {
      title: '工程练兵情况统计表',
      head: ['分类', '项目', '一局', '二局', '三局', '总计'],
      rows: [
        { group: '专业中队人员投入', cells: ['投入人数', '436', '468', '390', '1294'] },
        { cells: ['专业中队总人数', '606', '500', '509', '1615'] },
        { cells: ['占比', '71.95%', '93.60%', '73.53%', '80.1%'] },
        { group: '工程机械类装备投入', cells: ['投入台套数', '147', '169', '191', '507'] },
        { cells: ['总台套数', '286', '211', '225', '722'] },
        { cells: ['占比', '51.4%', '80.09%', '84.89%', '70.22%'] },
        { group: '本周完成产值', cells: ['完成产值（万元）', '186.84', '277.83', '110', '574.67'] },
        { cells: ['周计划产值（万元）', '185', '250', '115', '550'] },
        { cells: ['完成率', '101%', '111.13%', '95.6%', '104.49%'] },
        { group: '开累完成产值', cells: ['完成产值（万元）', '1500.5', '3105.08', '2443.74', '7049.32'] },
        { cells: ['目标产值（万元）', '21210', '17500', '17815', '56525'] },
        { cells: ['完成率', '7.07%', '17.74%', '13.71%', '12.47%'] },
        { group: '年度人均练兵产值', cells: ['目前人均练兵产值', '2.48', '6.21', '4.8', '4.36'] },
        { cells: ['目标产值', '35', '35', '35', '35'] },
        { cells: ['完成率', '7.07%', '17.74%', '13.7%', '12.47%'] },
      ],
    },
    {
      title: '安全应急产业营收情况统计表',
      head: ['单位', '年度累计营收', '应急服务营收', '应急服务占比', '教育培训营收', '教育培训占比', '周营收合计', '本周应急服务', '本周应急服务占比', '本周教育培训', '本周教育培训占比', '下周计划营收'],
      rows: [
        { cells: ['合计', '10051.35', '9691.74', '96.42%', '359.61', '3.58%', '444.98', '429.22', '96.46%', '15.76', '3.54%', '360.98'] },
        { cells: ['一局', '3059.27', '3036.01', '99.24%', '23.26', '0.76%', '9.76', '0.00', '0.00%', '9.76', '100.00%', '25'] },
        { cells: ['二局', '3086.56', '2965.87', '96.09%', '120.69', '3.91%', '198.05', '198.05', '100.00%', '0.00', '0.00%', '200'] },
        { cells: ['三局', '3168.19', '2952.53', '93.19%', '215.66', '6.81%', '121.00', '115.00', '95.04%', '6.00', '4.96%', '120'] },
        { cells: ['科工', '737.33', '737.33', '100.00%', '0.00', '0.00%', '116.17', '116.17', '100.00%', '0.00', '0.00%', '15.98'] },
      ],
    },
    {
      title: '本周中标项目（直接签订合同项目）汇总表',
      head: ['序号', '中标单位', '业主单位（发包人）', '项目业态', '项目名称', '项目内容', '中标模式', '中标金额（万元）', '项目所在地', '中标时间', '合同金额（万元）'],
      rows: [
        { cells: ['1', '一局唐山分公司', '河北省应急物资供应中心', '应急服务', '应急物资代储', '物资代储', '单价合同', '2.55', '唐山', '2026.01.01', '2.55'] },
        { cells: ['2', '三局西安基地', '国家管网兰州输油气分公司', '应急服务', '兰州输油气分公司应急演练机械租赁项目', '—', '独立中标', '42.98', '兰州', '2026.4.8', '42.98'] },
        { cells: ['3', '三局新疆公司', '新疆送变电有限公司', '应急服务', '2026年产业单位第三次服务类竞争性谈判采购', '设备租赁服务', '独立中标', '61.35', '新疆乌鲁木齐', '2026.4.10', '61.35'] },
        { cells: ['4', '三局武汉公司', '武汉市国防动员办公室', '应急服务', '全市国防动员专业保障队伍骨干培训保障服务项目', '培训保障', '独立中标', '单价合同', '武汉', '2026.4.10', '单价合同'] },
      ],
    },
  ],
};

export const MOCK_DOCUMENTS: MockDocument[] = DOCUMENT_CATEGORIES.flatMap((category) =>
  category.topics.map((title, index) => ({
    id: `sample-${category.code}-${index}`,
    code: category.code,
    title,
    date: SAMPLE_COVER[category.code]?.date(index) ?? `2026年9月${28 - index}日`,
    number: SAMPLE_COVER[category.code]?.number(index) ?? `${category.prefix}〔2026〕${String(index + 21).padStart(3, '0')}号`,
    figures: SAMPLE_FIGURES[title] ?? (category.code === 'EMERGENCY_BRIEF' && index === 0 ? Object.values(SAMPLE_FIGURES)[0] : undefined),
    tables: SAMPLE_TABLES[category.code],
    sections: category.sections,
  })),
);

export function findDocumentCategory(code: string) {
  return DOCUMENT_CATEGORIES.find((item) => item.code === code);
}
