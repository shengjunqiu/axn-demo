/**
 * 建设场景文书表格的文本往返：结构化表 ↔ 「列 | 列」多行文本。
 * 供红头预览识别为 HTML 表格，避免正文里直接露出管道符。
 */

export function tableToText(headers: string[], rows: string[][]): string {
  return [headers.join(' | '), ...rows.map((row) => row.join(' | '))].join('\n');
}

function splitPipeRow(line: string): string[] {
  return line.split(/\s*\|\s*/).map((cell) => cell.trim());
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
