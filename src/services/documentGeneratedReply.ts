/**
 * 文书生成完成后的统一对话回复。
 * 速览只讲一线能听懂的业务要点，不贴时间戳、台账、快照等技术话。
 */
export function documentGeneratedReply(title: string, glance?: string): string {
  const name = title.trim() || '未命名文书';
  const open = `已生成《${name}》，右侧可查看。`;
  const bit = sanitizeGlance(glance);
  if (!bit) return open;
  return `${open}\n\n速览：${bit}`;
}

/** 清洗速览：去掉时间戳与技术术语残留。 */
export function sanitizeGlance(glance?: string): string {
  if (!glance) return '';
  return glance
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.+-]+/g, '')
    .replace(/\d{4}-\d{2}-\d{2}[ T]\d{2}:\d{2}(:\d{2})?/g, '')
    .replace(/资料时间[：:\s]*[^。；]*/g, '')
    .replace(/台账[^。；]*/g, '')
    .replace(/快照[^。；]*/g, '')
    .replace(/IoT[^。；]*/gi, '')
    .replace(/ETA[^。；]*/gi, '')
    .replace(/（模拟文书）/g, '')
    .replace(/\s+/g, ' ')
    .replace(/[；;]{2,}/g, '；')
    .replace(/^[；;。.\s]+|[；;。.\s]+$/g, '')
    .trim();
}

/** 从章节正文抽一两句业务要点（文书库生成等无 ConstructionResult 的路径）。 */
export function glanceFromSections(
  sections: ReadonlyArray<readonly [string, string] | { title: string; text?: string; body?: string }>,
  maxSections = 2,
  maxEach = 40,
): string {
  const bits = sections.slice(0, maxSections).map((section) => {
    const title = 'title' in section ? section.title : section[0];
    const body = 'title' in section
      ? (section.text ?? section.body ?? '')
      : section[1];
    const cleaned = sanitizeGlance(body.replace(/\s+/g, ' '));
    if (!cleaned) return title.replace(/^[\d一二三四五六七八九十]、/, '');
    const short = cleaned.length <= maxEach ? cleaned : `${cleaned.slice(0, maxEach - 1)}…`;
    const shortTitle = title.replace(/^[\d一二三四五六七八九十]、/, '');
    return `${shortTitle}：${short}`;
  }).filter(Boolean);
  if (!bits.length) return '';
  return `${bits.join('；')}。详情看右侧。`;
}
