/**
 * 红头文书节内正文拆段：保留生成侧 \n，避免浏览器把换行折叠成「一堆文字」。
 */

/** 小节标题、编号条目等：不首行缩进，略加重显示。 */
export function isRedheadSubhead(line: string): boolean {
  const t = line.trim();
  if (!t) return false;
  if (/^[（(][一二三四五六七八九十百\d]+[）)]/.test(t)) return true;
  if (/^[一二三四五六七八九十]+[、．.]/.test(t)) return true;
  if (/^\d+[\.、．]\s*\S/.test(t)) return true;
  if (
    /^(人员编组|先遣组|集结与出动|编组原则|任务目标|研判口径|适用预案|灾种关键|监测摘要|监测（模拟）|候选人装|专业人装|中国安能集团抢险救灾典型案例)/.test(
      t,
    )
  ) {
    return true;
  }
  return false;
}

/** 每个非空行一段；空行仅作分隔，不产生空段落。 */
export function splitRedheadParagraphs(body: string): string[] {
  return body
    .replace(/\r\n/g, '\n')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}
