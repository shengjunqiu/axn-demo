/** V2 页面、助手文书与交付目录的共用章节定义。分析/通知继续使用对话控件。 */
export const V2_REPORT_STRUCTURE = {
  surroundings: { name: '周边资源分析报告', route: '/v2/surroundings', titles: ['一、抢险基本信息', '二、安能队伍情况', '三、其他央企队伍情况', '四、安能装备情况', '五、其他央企装备情况', '六、重点防护目标情况', '七、范围与数据核验'] },
  assembly: { name: '力量编组与资源调度建议方案', route: '/v2/assembly', titles: ['一、灾情信息', '二、力量编成建议', '三、资源调度建议'] },
  plan: { name: '工程救援处置方案', route: '/v2/plan', titles: ['一、灾情基本情况', '二、任务和救援目标', '三、救援组织与力量编成', '四、救援行动安排', '五、安全与保障措施'] },
  transport: { name: '梯队投送方案', route: '/v2/transport', titles: ['一、灾情信息', '二、力量编成', '三、投送安排', '四、保障要求'] },
  dynamics: { name: '灾情态势报告', route: '/v2/dynamics', titles: ['一、事件与资料范围', '二、动态反馈与依据', '三、人员与救援进展研判', '四、道路、坡体及力量变化', '五、研判建议与待核项'] },
  summary: { name: '抢险任务总结报告', route: '/v2/summary', titles: ['一、基本情况', '二、主要经验做法', '三、深刻启示', '四、下一步工作打算'] },
} as const;
export type V2ReportKind = keyof typeof V2_REPORT_STRUCTURE;
/** 合并原章节并保留来源小标题，禁止靠改标题把不相关正文错放。 */
export function groupReportSections(kind: V2ReportKind, source: [string, string][], groups: number[][]): [string, string][] {
  const used = groups.flat();
  if (groups.length !== V2_REPORT_STRUCTURE[kind].titles.length || used.length !== source.length || new Set(used).size !== source.length || used.some(i => !source[i])) throw new Error('文书章节映射不完整');
  const strip = (title: string) => title.replace(/^[一二三四五六七八九十]+、/, '');
  const number = ['一', '二', '三', '四', '五', '六'];
  return V2_REPORT_STRUCTURE[kind].titles.map((title, i) => [title, (groups[i] ?? []).map((index, subIndex) => {
    const [original, body] = source[index];
    return strip(original) === strip(title) ? body : `（${number[subIndex] ?? subIndex + 1}）${strip(original)}\n${body}`;
  }).join('\n\n') || '资料待补充，不能据此认定不存在。']);
}
