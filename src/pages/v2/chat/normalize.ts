const DIGITS: Record<string, number> = { 零: 0, 〇: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
const UNITS: Record<string, number> = { 十: 10, 百: 100, 千: 1000 }

export function numeral(value: string): number {
  if (/^\d+(?:\.\d+)?$/.test(value)) return Number(value)
  if (!/[十百千万]/.test(value)) return Number([...value].map(char => DIGITS[char] ?? '').join(''))
  let total = 0
  let section = 0
  let number = 0
  for (const char of value) {
    const digit = DIGITS[char]
    if (digit !== undefined) number = digit
    else if (char === '万') {
      total += (section + number || 1) * 10000
      section = 0
      number = 0
    } else {
      section += (number || 1) * (UNITS[char] || 0)
      number = 0
    }
  }
  return total + section + number
}

/** 把中文数字和“半小时”收成可计算的阿拉伯数字，方便后续规则匹配。 */
export function normalize(text: string): string {
  return String(text)
    .replace(/[零〇一二两三四五六七八九十百千万]+/g, match => String(numeral(match)))
    .replace(/负(?=\d)/g, '-')
    .replace(/(\d)点(\d)/g, '$1.$2')
    .replace(/半小时/g, '0.5小时')
}
