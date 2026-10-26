/**
 * 建设场景文书表格的文本往返：结构化表 ↔ 「列 | 列」多行文本。
 * 供红头预览识别为 HTML 表格，避免正文里直接露出管道符。
 */

export function tableToText(headers: string[], rows: string[][]): string {
  return [headers.join(' | '), ...rows.map((row) => row.join(' | '))].join('\n');
}

function splitPipeRow(line: string): string[] {
  return line.trim().replace(/^\|/, '').replace(/\|$/, '').split(/\s*\|\s*/).map((cell) => cell.trim());
}

function isPipeDataRow(line: string): boolean {
  if (!line.includes('|')) return false;
  const cells = splitPipeRow(line);
  return cells.length >= 2;
}

/** 识别由 tableToText 生成的管道表；普通正文不含一致列数管道行时返回 null。 */
export function parsePipeTable(text: string): { headers: string[]; rows: string[][] } | null {
  const lines = text
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (lines.length < 2) return null;
  if (!lines.every((line) => line.includes('|'))) return null;
  const matrix = lines.map(splitPipeRow);
  const width = matrix[0]?.length ?? 0;
  if (width < 2) return null;
  if (!matrix.every((row) => row.length === width && row.every((cell) => cell.length > 0))) return null;
  return { headers: matrix[0], rows: matrix.slice(1) };
}

export type PipeContentBlock =
  | { kind: 'text'; text: string }
  | { kind: 'table'; headers: string[]; rows: string[][] };

/**
 * 将正文拆成普通文本块与内嵌管道表，供红头预览 / Word 导出混排。
 * 连续 ≥2 行、列数一致的管道行视为一张表；其余行按原文保留换行。
 */
export function splitPipeContent(text: string): PipeContentBlock[] {
  const rawLines = normalizeResourceLists(text).replace(/\r\n/g, '\n').split('\n');
  const blocks: PipeContentBlock[] = [];
  let textBuf: string[] = [];

  const flushText = () => {
    if (!textBuf.length) return;
    const chunk = textBuf.join('\n').replace(/^\n+/, '').replace(/\n+$/, '');
    textBuf = [];
    if (chunk.length) blocks.push({ kind: 'text', text: chunk });
  };

  let i = 0;
  while (i < rawLines.length) {
    const line = rawLines[i] ?? '';
    const trimmed = line.trim();
    if (!isPipeDataRow(trimmed)) {
      textBuf.push(line);
      i += 1;
      continue;
    }
    const run: string[] = [trimmed];
    let j = i + 1;
    while (j < rawLines.length) {
      const next = (rawLines[j] ?? '').trim();
      if (!next) {
        j += 1;
        continue;
      }
      if (!isPipeDataRow(next) || splitPipeRow(next).length !== splitPipeRow(trimmed).length) break;
      run.push(next);
      j += 1;
    }
    const matrix = run.map(splitPipeRow);
    const width = matrix[0]?.length ?? 0;
    const consistent = width >= 2 && matrix.every((row) => row.length === width);
    if (consistent && matrix.length >= 2) {
      flushText();
      blocks.push({ headers: matrix[0], rows: matrix.slice(1).filter(row => !row.every(cell => /^:?-{3,}:?$/.test(cell))), kind: 'table' });
      i = j;
      continue;
    }
    textBuf.push(line);
    i += 1;
  }
  flushText();
  return blocks;
}

/** 将「名称 / 数量 / 能力 / 状态」多行文本转为管道表；无法解析时原样返回。 */
export function slashResourcesToPipeTable(resourcesText: string): string {
  const rows = resourcesText
    .split(/\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .flatMap((line) => {
      const stripped = line.replace(/^[^：:]*[：:]\s*/, '');
      const chunks = stripped.includes('；') ? stripped.split(/；/) : [stripped];
      return chunks
        .map((chunk) => chunk.trim())
        .filter(Boolean)
        .map((chunk) => {
          const parts = chunk.split(/\s+\/\s+/).map((cell) => cell.trim()).filter(Boolean);
          if (parts.length < 4) return null;
          return [parts[0], parts.slice(1, -2).join(' / '), parts.at(-2)!, parts.at(-1)!] as string[];
        })
        .filter((row): row is string[] => row !== null);
    });
  if (!rows.length) return resourcesText;
  return tableToText(['名称', '数量', '专业能力', '状态'], rows);
}


/** 旧文书资源行：用数量和状态字段确认结构，避免把路线、单位中的斜杠误作表格。 */
export function normalizeResourceLists(text: string): string {
  const lines = text.split('\n');
  const result: string[] = [];
  let inResources = false;
  for (const line of lines) {
    const parts = line.trim().split(/\s+\/\s+/);
    const valid = parts.length >= 4 && /\d/.test(parts.slice(1, -2).join(' '))
      && /候选|待核|确认|可用|出动|调派|在位|执行|待命/.test(parts.at(-1) ?? '');
    if (!valid) { result.push(line); inResources = false; continue; }
    const name = parts[0];
    const prefix = name.match(/^([^：:]+[：:])(.+)$/);
    if (prefix) { result.push(prefix[1]); inResources = false; }
    if (!inResources) result.push('名称 | 数量 | 专业能力 | 状态');
    result.push([prefix?.[2] ?? name, parts.slice(1, -2).join(' / '), parts.at(-2), parts.at(-1)].join(' | '));
    inResources = true;
  }
  return result.join('\n');
}
