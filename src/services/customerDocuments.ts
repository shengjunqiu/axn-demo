/** 本地可解释文本整理；每个提炼结果保留原文行号，不冒充模型推理。 */
import { disasterProfileById, DISASTER_PROFILES } from '@/seed/disasterScenarios';
import { factText, incidentById } from '@/seed/scenario';
export type ExtractedRecord = { line: number; time: string; text: string; sortKey: string | null };
export function extractRecords(text: string, period = ''): ExtractedRecord[] {
  const date = period.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/)?.[0]?.replaceAll('/', '-');
  const days = period.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/g) ?? [];
  const uniqueDates = new Set(days);
  return text.split(/\r?\n/).map((raw, index) => {
    const full = raw.match(/(\d{4})[-/年](\d{1,2})[-/月](\d{1,2})日?[ T\s]+(\d{1,2}):(\d{2})/);
    const clock = raw.match(/(?:^|[\s【[（(])(\d{1,2}):(\d{2})(?=$|[\s:：】\])）—-])/);
    const time = full ? `${full[1]}-${full[2].padStart(2, '0')}-${full[3].padStart(2, '0')} ${full[4].padStart(2, '0')}:${full[5]}` : clock ? `${clock[1].padStart(2, '0')}:${clock[2]}` : '时间待核';
    const hour = Number(full?.[4] ?? clock?.[1]); const minute = Number(full?.[5] ?? clock?.[2]);
    const valid = Number.isFinite(hour) && hour >= 0 && hour < 24 && minute >= 0 && minute < 60;
    const validDate = full ? valid && Number.isFinite(Date.parse(`${time.replace(' ', 'T')}:00+08:00`)) : valid;
    const sortKey = validDate ? full ? time : date && uniqueDates.size === 1 ? `${date} ${time}` : null : null;
    return { line: index + 1, time: validDate ? time : '时间待核', text: raw.trim(), sortKey };
  }).filter(r => r.text).sort((a, b) => a.sortKey && b.sortKey ? a.sortKey.localeCompare(b.sortKey) : a.sortKey ? -1 : b.sortKey ? 1 : a.line - b.line);
}
export function analyzeMinutes(text: string, period = '') {
  const records = extractRecords(text, period);
  const decisions = records.filter(r => /决定|议定|同意|确认|确定|通过|要求|负责|待办|截止|提交/.test(r.text) && !/未决定|未确认|待确认|没有确定|未通过/.test(r.text));
  const pending = records.filter(r => /待确认|待核|未决定|尚未|待办|下次|进一步/.test(r.text));
  return { records, decisions, pending, decisionText: decisions.map(r => `[原文第${r.line}行] ${r.text}`).join('\n') };
}
export function minutesSections(subject: string, period: string, records: string, confirmed: string): [string, string][] {
  const analysis = analyzeMinutes(records, period);
  const format = (rows: ExtractedRecord[]) => rows.map(r => `[原文第${r.line}行；${r.time}] ${r.text}`).join('\n');
  return [
    ['一、会议基本信息', `会议主题：${subject}\n时间、地点与参会人员：${period}`],
    ['二、讨论议题与记录', format(analysis.records)],
    ['三、议定事项与责任分工', confirmed || analysis.decisionText || '原文未识别到明确议定事项，待人工确认'],
    ['四、待核与后续事项', format(analysis.pending) || '未识别到明确待核事项；责任人或时限未在原文明确的，不自动补写。'],
    ['五、资料依据', '按原文关键词与时间规则提炼，可在线核对修改；行号对应本次输入的转写文本。文本提炼未调用外部模型；转写文本可由浏览器识别或用户导入。'],
  ];
}
export function dailySummarySections(subject: string, period: string, text: string, confirmed: string): [string, string][] {
  const records = extractRecords(text, period);
  const highlights = records.filter(r => /完成|交付|解决|通过|提升|优化|节约|成果|亮点/.test(r.text) && !/未完成|没有完成|未通过|尚未|待完成|计划完成|未解决|待解决|未交付|待交付|计划优化|未提升/.test(r.text));
  const next = records.filter(r => /待办|待核|未完成|下一步|计划|风险|问题/.test(r.text));
  const format = (rows: ExtractedRecord[]) => rows.map(r => `${r.time} · ${r.text} [原文第${r.line}行]`).join('\n');
  return [
    ['一、工作范围', `工作主题：${subject}\n总结时段：${period}`],
    ['二、工作时间轴', format(records)],
    ['三、亮点与依据', `${format(highlights) || '原始记录未识别到明确成果，待补证。'}${confirmed ? `\n人工确认补充：${confirmed}` : ''}`],
    ['四、问题与下一步', format(next) || '下一步任务、责任人与时限待补充'],
    ['五、资料依据', '按本次记录时间排序，并逐条引用原文行号。无明确日期或跨日期仅写时刻的记录保留输入顺序、待核日期；未识别到的内容不推断。'],
  ];
}

export type TacticOption = { name: string; tactic: string; applicability: string; resources: string; risk: string; basis: string; organization: string; tradeoff: string };
// 仅从已存在的灾种预案章节抽取不同技术任务，避免给所有灾种套同一组织策略。
const FOCUS: Record<string, string[]> = {
  '洪涝决口': ['裹头抢护与料源准备', '机械化双向立堵及水上抛投'],
  '山体滑坡': ['地质侦测与避险转移', '专业审定后的工程清障'],
  '泥石流': ['分区搜救优先', '道路保通与工程清障'],
};
export function tacticOptions(eventId: string): TacticOption[] {
  const incident = incidentById.get(eventId);
  const category = incident ? factText(incident.factRefs.disasterType) : '';
  const profile = disasterProfileById.get(eventId) ?? DISASTER_PROFILES.find(p => category && (category.includes(p.category) || p.category.includes(category)));
  if (!profile) return [];
  const basis = profile.planSections.find(([h]) => h.includes('主战法'))?.[1];
  if (!basis || !FOCUS[profile.category]) return [];
  return FOCUS[profile.category].map((focus, index) => ({ name: focus, tactic: focus, applicability: index === 0 ? `适用关注：${profile.objective}；须核实现场条件与专业授权` : `适用关注：${profile.gaps}；前序监测、许可和专业论证齐备后评估`, resources: profile.resources.map(r => `${r.name}：${r.capability}（${r.status}）`).join('；'), risk: profile.risks, basis: `${profile.planTitle} / 主战法与作业步骤（本地参考，非正式生效预案）`, organization: basis.split(/[。；]/).filter(sentence => { const tokens = focus.match(/[\u4e00-\u9fff]{2,}/g)?.flatMap(word => Array.from({ length: word.length - 1 }, (_, i) => word.slice(i, i + 2))) ?? []; return tokens.some(token => sentence.includes(token)); }).join('；') || basis, tradeoff: '仅比较任务技术侧重点；可以组合使用，不能代替专家审批。耗时与成本资料不足，不自动评分。' }));
}

export type Comparison = { clause: number; plan: string; evidence: string; result: '有相关记录待复核' | '缺少对应证据'; hint: string };
export function comparePlanAndSummary(plan: string, summary: string): Comparison[] {
  const actual = summary.split(/\r?\n|[。；]/).map(s => s.trim()).filter(Boolean);
  const clauses = plan.split(/\r?\n|[。；]/).map(s => s.trim()).filter(Boolean);
  return clauses.map((clause, index) => {
    // 字面相关性仅用于定位条款，不判定落实、合规或因果。
    const tokens = clause.match(/[\u4e00-\u9fff]{2,}/g)?.flatMap(s => Array.from({ length: Math.max(0, s.length - 1) }, (_, i) => s.slice(i, i + 2))) ?? [];
    let evidence = ''; let score = 0;
    for (const line of actual) { const hits = new Set(tokens.filter(t => line.includes(t))).size; if (hits > score) { score = hits; evidence = line; } }
    const matched = score >= 2;
    return { clause: index + 1, plan: clause, evidence: matched ? evidence : '未找到对应记录', result: matched ? '有相关记录待复核' : '缺少对应证据', hint: matched ? '核对实际动作、数量、时间及该预案版本的适用条件；不以文字相似判定完成。' : '补充该条款对应的执行记录，或由专家说明变更依据。' };
  });
}
