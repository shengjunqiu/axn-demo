import {
  AlignmentType,
  Document,
  Footer,
  Header,
  HeadingLevel,
  Packer,
  PageNumber,
  Paragraph,
  TextRun,
} from 'docx'
import type { ChatResult } from './types'

const BODY_FONT = { ascii: 'Calibri', hAnsi: 'Calibri', eastAsia: '宋体' }
const HEADING_FONT = { ascii: 'Calibri', hAnsi: 'Calibri', eastAsia: '黑体' }

export function plainResult(result: ChatResult): string {
  return [
    result.title,
    '安小能V2 · 演示草稿',
    result.event ? `绑定事件：${result.event}` : '',
    ...(result.paragraphs || []),
    ...(result.table ? ['力量编成 / 核对明细', ...result.table.rows.map(row => result.table?.headers.map((label, index) => `${label}：${row[index] ?? ''}`).join('；') ?? '')] : []),
    ...(result.sections || []).flatMap(section => [section.title, ...section.paragraphs]),
  ].filter(Boolean).join('\n\n')
}

export async function copyResult(result: ChatResult): Promise<boolean> {
  const text = plainResult(result)
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      /* 浏览器拒绝剪贴板时改走选区复制。 */
    }
  }
  const field = document.createElement('textarea')
  field.value = text
  field.style.cssText = 'position:fixed;left:-9999px'
  document.body.appendChild(field)
  field.select()
  let success = false
  try { success = document.execCommand('copy') } catch { success = false }
  field.remove()
  return success
}

function paragraph(text: string): Paragraph {
  return new Paragraph({
    spacing: { before: 0, after: 120, line: 264 },
    children: [new TextRun({ text: String(text), font: BODY_FONT, size: 22, color: '222222' })],
  })
}

export async function downloadResult(result: ChatResult): Promise<void> {
  const children: Paragraph[] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      spacing: { before: 0, after: 160, line: 264 },
      children: [new TextRun({ text: result.title, font: HEADING_FONT, size: 36, bold: true, color: '0B2545' })],
    }),
    new Paragraph({
      spacing: { before: 0, after: 200, line: 264 },
      children: [new TextRun({ text: '安小能V2 · 演示草稿', font: BODY_FONT, size: 24, color: '666666' })],
    }),
  ]
  if (result.event) children.push(paragraph(`绑定事件：${result.event}`))
  ;(result.paragraphs || []).forEach(text => children.push(paragraph(text)))
  if (result.table) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 320, after: 160 },
      children: [new TextRun({ text: result.kind === 'resource' ? '力量编成建议' : '核对 / 任务明细', font: HEADING_FONT, size: 32, bold: true, color: '2E74B5' })],
    }))
    result.table.rows.forEach(row => {
      children.push(new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
        children: [new TextRun({ text: String(row[0] ?? ''), font: HEADING_FONT, size: 26, bold: true, color: '2E74B5' })],
      }))
      row.slice(1).forEach((value, index) => {
        children.push(new Paragraph({
          spacing: { before: 0, after: 120, line: 264 },
          children: [
            new TextRun({ text: `${result.table?.headers[index + 1] ?? ''}：`, bold: true, font: BODY_FONT, size: 22 }),
            new TextRun({ text: String(value ?? ''), font: BODY_FONT, size: 22 }),
          ],
        }))
      })
    })
  }
  for (const section of result.sections || []) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      spacing: { before: 320, after: 160 },
      children: [new TextRun({ text: section.title, font: HEADING_FONT, size: 32, bold: true, color: '2E74B5' })],
    }))
    section.paragraphs.forEach(text => children.push(paragraph(text)))
  }
  const file = new Document({
    title: result.title,
    creator: '应急救援演示原型',
    sections: [{
      properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, right: 1440, bottom: 1440, left: 1440, header: 708, footer: 708 } } },
      headers: { default: new Header({ children: [new Paragraph({ spacing: { before: 0, after: 0, line: 264 }, children: [new TextRun({ text: '安小能 · 对话生成演示草稿', size: 18, color: '777777' })] })] }) },
      footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, spacing: { before: 0, after: 0, line: 264 }, children: [new TextRun({ text: '第 ', size: 18 }), new TextRun({ children: [PageNumber.CURRENT], size: 18 }), new TextRun({ text: ' 页', size: 18 })] })] }) },
      children,
    }],
  })
  const blob = await Packer.toBlob(file)
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `${result.title}_V2演示草稿.docx`.replace(/[\\/:*?"<>|]/g, '_')
  document.body.appendChild(link)
  link.click()
  link.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 30000)
}
