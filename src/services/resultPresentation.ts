/** 招标要求保留的报告/方案才默认打开文书；分析、核验和推荐在对话中完成。 */
const DOCUMENT_CAPABILITIES = new Set(['situationReport', 'resourceReport', 'plan', 'summary']);
export function needsResultDocument(capability: string): boolean {
  return DOCUMENT_CAPABILITIES.has(capability);
}

/** 分析附件保留兼容文种供按需导出，不在文书中心作为独立新建入口。 */
export function isStandaloneDocumentCode(code: string): boolean {
  return !['SURVEY_ANALYSIS', 'RESOURCE_QUERY', 'RESOURCE_STATUS', 'GROUP_RECOMMENDATION', 'RESCUE_EVAL'].includes(code);
}
