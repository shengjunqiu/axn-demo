/** 报告先呈现正文，资料附表/附录置后，编制说明最后；同类章节保留原顺序。 */
export function orderReportSections(sections: readonly (readonly [string, string])[]): [string, string][] {
  const rank = (title: string) => /^说明$|^[一二三四五六七八九十]+、说明$/.test(title.trim()) ? 2 : /^(?:[一二三四五六七八九十]+、)?附[表录件]/.test(title.trim()) ? 1 : 0;
  const hasReportBody = sections.some(([title]) => /^一、灾情概况$/.test(title));
  const display = sections.map((section): [string, string] => hasReportBody && /^(?:[一二三四五六七八九十]+、)?(?:多源数据汇聚|事件关键要素)$/.test(section[0])
    ? [`附录：${section[0].replace(/^[一二三四五六七八九十]+、/, '')}`, section[1]] : [section[0], section[1]]);
  return display.sort((a, b) => rank(a[0]) - rank(b[0]));
}
