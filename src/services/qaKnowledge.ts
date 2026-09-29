/**
 * 抢险救援知识问答检索（qa.json 接入）。
 * 数据为演示模拟数据（126 条问题 + 结构化示例答案 + 模拟应用文档溯源卡），
 * 不接真实大模型；匹配为本地规则检索（归一化精确命中 / 双向包含）。
 */
import qaData from '@/fixtures/qaKnowledge.json';

export interface QaSource {
  docId: string;
  title: string;
  section: string;
  excerpt: string;
  simulated: boolean;
}

export interface QaAnswer {
  summary: string;
  keyActions: string;
  doNot: string;
  supportAndReporting: string;
  liveDataNeeded: string[];
}

export interface QaItem {
  id: number;
  sheetRow: number;
  question: string;
  category: string;
  answer: QaAnswer;
  confidence: number;
  answerStatus: string;
  sourceMode: string;
  sources: QaSource[];
}

interface RawQaItem {
  sheet_row: number;
  id: number;
  question: string;
  category: string;
  answer: { summary: string; key_actions: string; do_not: string; support_and_reporting: string; live_data_needed: string[] };
  confidence: number;
  answer_status: string;
  source_mode: string;
  sources: { doc_id: string; title: string; section: string; excerpt: string; simulated: boolean }[];
}

function toItems(raw: unknown): QaItem[] {
  const items = (raw as { items: RawQaItem[] }).items ?? [];
  return items.map((it) => ({
    id: it.id,
    sheetRow: it.sheet_row,
    question: it.question,
    category: it.category,
    answer: {
      summary: it.answer.summary,
      keyActions: it.answer.key_actions,
      doNot: it.answer.do_not,
      supportAndReporting: it.answer.support_and_reporting,
      liveDataNeeded: it.answer.live_data_needed ?? [],
    },
    confidence: it.confidence,
    answerStatus: it.answer_status,
    sourceMode: it.source_mode,
    sources: (it.sources ?? []).map((s) => ({
      docId: s.doc_id,
      title: s.title,
      section: s.section,
      excerpt: s.excerpt,
      simulated: s.simulated !== false,
    })),
  }));
}

export const qaItems: QaItem[] = toItems(qaData);

export const qaCatalog: { docId: string; title: string; type: string; version: string; publisher: string }[] = (
  (qaData as { mock_document_catalog: Record<string, unknown>[] }).mock_document_catalog ?? []
).map((d) => ({
  docId: String(d.doc_id),
  title: String(d.title),
  type: String(d.type),
  version: String(d.version),
  publisher: String(d.publisher),
}));

export function getQaItem(id: number): QaItem | undefined {
  return qaItems.find((i) => i.id === id);
}

/** 归一化：去除空白与常见中英文标点（问答匹配用）。 */
export function normalizeQaText(text: string): string {
  return text.replace(/[\s？?！!。，,、；;：:·．.\u3000]+/gu, '');
}

const QA_INCLUDE_MIN_LEN = 6;

/**
 * 规则匹配问题 → 知识条目。
 * ① 归一化后精确相等（原表存在重复问题文本，取序号靠前的第一条）；
 * ② 双向包含且归一化长度 ≥6（避免误吞"它们谁最快能到"等业务短句）。
 */
export function matchQa(rawText: string): QaItem | null {
  const norm = normalizeQaText(rawText);
  if (!norm) return null;
  const exact = qaItems.find((i) => normalizeQaText(i.question) === norm);
  if (exact) return exact;
  if (norm.length < QA_INCLUDE_MIN_LEN) return null;
  return (
    qaItems.find((i) => {
      const q = normalizeQaText(i.question);
      return q.length >= QA_INCLUDE_MIN_LEN && (q.includes(norm) || norm.includes(q));
    }) ?? null
  );
}

/** answer_status → 界面提示文案（模拟状态，不包装成真实模型能力）。 */
export function qaStatusLabel(status: string): string {
  switch (status) {
    case 'demo_general_guidance_needs_live_data':
      return '通用处置指引 · 需结合现场实时数据';
    default:
      return '模拟示例答案';
  }
}
