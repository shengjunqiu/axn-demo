/**
 * 版头/落款规格按真件提取；章节骨架对齐一期过程公文材料。
 * 样稿与生成正文均按演示事件填充，不再使用纯占位架子。
 * - 值班日报：机关标志 + 红字文种；结尾=值班员/值班电话。
 * - 应急要情：平台行 + 机关标志 + 「应 急 救 援 要 情」。
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
  tail: 'duty' | 'brief' | 'report';
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
  { code: 'DUTY_DAILY', name: '值班日报', prefix: '应急值', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '值 班 日 报', showNumber: false, showTitle: false, tail: 'duty' }, topics: ['应急值守日报', '夜间值守交接日报'], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'DUTY_DAILY') },
  { code: 'EMERGENCY_BRIEF', name: '应急要情', prefix: '应急报', redhead: { platform: '中央企业应急救援综合平台', org: '中国安能建设集团有限公司', type: '应 急 救 援 要 情', showNumber: true, showTitle: true, tail: 'brief' }, topics: ['险情处置要情', '应急救援过程要情'], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'EMERGENCY_BRIEF') },
  { code: 'MEETING_MINUTES', name: '会议纪要', prefix: '应急会纪', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '会 议 纪 要', showNumber: true, showTitle: true, tail: 'report' }, topics: ['应急协调会议纪要', '值班值守工作部署会议纪要'], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'MEETING_MINUTES') },
  { code: 'WORK_SUMMARY', name: '工作总结', prefix: '应急综', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '工 作 总 结', showNumber: true, showTitle: true, tail: 'report' }, topics: ['阶段性应急工作总结', '应急值守保障工作总结'], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'WORK_SUMMARY') },
  // 四智能体建设材料（由对话任务物化到右侧红头文书）
  { code: 'SITUATION_REPORT', name: '态势报告', prefix: '应急态', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '灾 情 态 势 报 告', showNumber: true, showTitle: true, tail: 'report' }, topics: [], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'SITUATION_REPORT') },
  { code: 'RESOURCE_REPORT', name: '周边资源报告', prefix: '应急资', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '周 边 资 源 分 析 报 告', showNumber: true, showTitle: true, tail: 'report' }, topics: [], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'RESOURCE_REPORT') },
  // 查询 / 核对类材料：不当作一期「周边资源分析报告」红头，避免文种与正文结构错配。
  { code: 'RESOURCE_QUERY', name: '资源查询', prefix: '应急查', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '资 源 查 询 结 果', showNumber: true, showTitle: true, tail: 'report' }, topics: [], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'RESOURCE_QUERY') },
  { code: 'RESOURCE_STATUS', name: '资源状态核对', prefix: '应急核', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '资 源 状 态 核 对', showNumber: true, showTitle: true, tail: 'report' }, topics: [], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'RESOURCE_STATUS') },
  { code: 'RESCUE_PLAN', name: '救援方案', prefix: '应急案', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '救 援 处 置 方 案', showNumber: true, showTitle: true, tail: 'report' }, topics: [], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'RESCUE_PLAN') },
  { code: 'RESCUE_EVAL', name: '效果评估', prefix: '应急评', redhead: { platform: '', org: '中国安能建设集团有限公司', type: '救 援 效 果 评 估', showNumber: true, showTitle: true, tail: 'report' }, topics: [], sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, 'RESCUE_EVAL') },
];

/** 四智能体可物化为右侧红头文书的能力 → 文书分类（文种须与正文结构一致）。 */
export const AGENT_MATERIAL_CODES = {
  situation: 'SITUATION_REPORT',
  situationReport: 'SITUATION_REPORT',
  search: 'RESOURCE_QUERY',
  resourceReport: 'RESOURCE_REPORT',
  update: 'RESOURCE_STATUS',
  group: 'RESCUE_PLAN',
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

export type MockDocument = {
  id: string;
  code: string;
  title: string;
  date: string;
  number: string;
  sections: readonly (readonly [string, string])[];
  /** 提交到原系统栏目的演示回执；上传不等于正式签发 */
  handoff?: MockDocumentHandoff;
};

/** 智能体文书 → 原系统栏目（演示映射，不接真实接口） */
export const MOCK_DOCUMENT_HANDOFF_TARGETS: Record<string, string> = {
  SITUATION_REPORT: '周边资源分析报告／态势参考附件（A01）',
  RESOURCE_REPORT: '周边资源分析报告（A01）',
  RESOURCE_QUERY: '周边资源分析报告／资源查询附件（A01）',
  RESOURCE_STATUS: '周边资源分析报告／资源状态核对（A01）',
  RESCUE_PLAN: '救援处置方案管理（S03）',
  RESCUE_EVAL: '总结报告管理与编写（P02）',
  DUTY_DAILY: '应急要情查询与编制／值班日报（B03）',
  EMERGENCY_BRIEF: '应急要情查询与编制（B03）',
  MEETING_MINUTES: '全过程记录／会议纪要（P01）',
  WORK_SUMMARY: '总结报告管理与编写（P02）',
};

export function handoffTargetFor(code: string) {
  return MOCK_DOCUMENT_HANDOFF_TARGETS[code] ?? '原系统对应栏目（演示）';
}

/**
 * MockDocument 是扁平结构，逐字段比较即可。
 * 编辑路径原来用 `JSON.stringify(a) === JSON.stringify(b)` 判断「是否改回原文」，
 * 每次击键都要把整篇文书序列化好几遍；这里改成常数级字段比较。
 */
export function sameMockDocument(a: MockDocument, b: MockDocument): boolean {
  if (a === b) return true;
  if (a.id !== b.id || a.code !== b.code || a.title !== b.title || a.date !== b.date || a.number !== b.number) return false;
  if (a.sections.length !== b.sections.length) return false;
  if ((a.handoff?.receiptId ?? '') !== (b.handoff?.receiptId ?? '')) return false;
  if ((a.handoff?.status ?? '') !== (b.handoff?.status ?? '')) return false;
  return a.sections.every(
    (section, index) => section[0] === b.sections[index][0] && section[1] === b.sections[index][1],
  );
}

export const MOCK_DOCUMENTS: MockDocument[] = DOCUMENT_CATEGORIES.flatMap((category) =>
  category.topics.map((title, index) => ({
    id: `sample-${category.code}-${index}`,
    code: category.code,
    title,
    date: `2026年9月${28 - index}日`,
    number: `${category.prefix}〔2026〕${String(index + 21).padStart(3, '0')}号`,
    sections: resolveDocumentSections(MOCK_SAMPLE_EVENT_ID, category.code),
  })),
);

export function findDocumentCategory(code: string) {
  return DOCUMENT_CATEGORIES.find((item) => item.code === code);
}
