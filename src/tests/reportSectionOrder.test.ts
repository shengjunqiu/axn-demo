import { expect, it } from 'vitest';
import { buildConstructionResult } from '@/seed/constructionScenarios';
import { constructionToMockSections } from '@/services/agentMaterialDocument';
import { orderReportSections } from '@/services/reportSectionOrder';
it('态势报告先展示四章正文，再展示附表，序号不重复', () => {
  const sections = constructionToMockSections(buildConstructionResult('situationReport', 'evt-sim-landslide', '生成态势报告'));
  expect(sections[0][0]).toBe('一、灾情概况');
  expect(sections[1][0]).toBe('二、安全态势与发展关注');
  expect(sections.findIndex(s => s[0].startsWith('附表'))).toBeGreaterThan(3);
  expect(sections.some(s => s[0] === '附录：事件关键要素')).toBe(true);
});
it('旧稿排序不丢内容且不改写原始版本', () => {
  const source: [string, string][] = [['附表：来源', '来源原文'], ['一、多源数据汇聚', '汇聚原文'], ['一、灾情概况', '正文'], ['说明', '待核']];
  expect(orderReportSections(source).map(s => s[1])).toEqual(['正文', '来源原文', '汇聚原文', '待核']);
  expect(source[0][0]).toBe('附表：来源');
});
it.each(['evt-sim-landslide', 'evt-sim-breach', 'evt-sim-debris'])('%s四类正式报告正文先于附表', eventId => {
  for (const capability of ['situationReport', 'resourceReport', 'plan', 'summary'] as const) {
    const sections = constructionToMockSections(buildConstructionResult(capability, eventId, '生成报告'));
    expect(sections[0][0]).not.toMatch(/^附[表录件]/);
    const appendix = sections.findIndex(([title]) => /^附[表录件]/.test(title));
    if (appendix >= 0) expect(sections.slice(appendix).some(([title]) => /^[一二三四五六七八九十]+、/.test(title) && !title.endsWith('说明'))).toBe(false);
  }
});
