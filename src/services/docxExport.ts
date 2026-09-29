/**
 * 真 DOCX 导出（T-016）：基于用户选定版本（renderRevision 冻结渲染）生成 .docx。
 * 页脚含模拟声明 + 页脚备注 + 版本号 + 内容指纹；导出前写入审计留痕。
 */
import {
  AlignmentType,
  Document,
  Footer,
  HeadingLevel,
  Packer,
  Paragraph,
  TextRun,
} from 'docx';
import type { ISectionOptions, ParagraphChild } from 'docx';
import { useDocumentStore } from '@/store/documentStore';
import { useDemoStore } from '@/store/demoStore';
import { renderRevision } from './docRender';

const MOCK_FONT = 'SimSun';

function footerParagraph(children: ParagraphChild[]): Paragraph {
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 40 },
    children,
  });
}

function buildFileName(title: string, version: string): string {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const stamp = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
  // 文件名不允许半角冒号等字符，统一替换为全角冒号。
  const safeTitle = title.replace(/[\\/:*?"<>|]/g, '：');
  return `${safeTitle}_${version}_${stamp}.docx`;
}

function triggerDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = window.document.createElement('a');
  link.href = url;
  link.download = fileName;
  window.document.body.appendChild(link);
  link.click();
  window.setTimeout(() => {
    URL.revokeObjectURL(url);
    link.remove();
  }, 0);
}

/** 导出指定版本为 .docx 并触发浏览器下载。 */
export async function exportRevision(revisionId: string): Promise<void> {
  const store = useDocumentStore.getState();
  const reason = store.getRevisionGuard(revisionId, 'export');
  if (reason) throw new Error(reason);
  const rev = store.getRevision(revisionId);
  if (!rev) {
    throw new Error('版本不存在，无法导出');
  }
  const rendered = renderRevision(rev);
  const demo = useDemoStore.getState();
  const actor = demo.getActor();

  // 导出前留痕：addAudit('导出 Word')
  store.addAudit({
    action: '导出 Word',
    actor: actor.name,
    objectId: rev.documentId,
    version: rev.displayVersion,
    performedAt: new Date().toISOString(),
    demoClockAt: demo.demoClock,
    detail: `内容指纹 ${rev.contentHash}（模拟导出）`,
  });

  const children: ISectionOptions['children'] = [
    new Paragraph({
      heading: HeadingLevel.TITLE,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [new TextRun({ text: rendered.title, font: MOCK_FONT, size: 36, bold: true })],
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 240 },
      children: [
        new TextRun({
          text: `${rendered.templateName} · ${rendered.version} · 内容指纹 ${rendered.contentHash}`,
          font: MOCK_FONT,
          size: 18,
          color: '666666',
        }),
      ],
    }),
    ...rendered.sections.flatMap((section) => [
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 200, after: 80 },
        children: [new TextRun({ text: section.title, font: MOCK_FONT, size: 28, bold: true })],
      }),
      ...section.paragraphs.map(
        (text) =>
          new Paragraph({
            alignment: AlignmentType.BOTH,
            indent: { firstLine: 480 },
            spacing: { after: 80, line: 360 },
            children: [new TextRun({ text, font: MOCK_FONT, size: 24 })],
          }),
      ),
    ]),
  ];

  const docFile = new Document({
    creator: '安小能演示（模拟）',
    title: rendered.title,
    description: rendered.mockNotice,
    sections: [
      {
        footers: {
          default: new Footer({
            children: [
              footerParagraph([
                new TextRun({ text: rendered.footerNote, font: MOCK_FONT, size: 16, color: '888888' }),
              ]),
              footerParagraph([
                new TextRun({ text: rendered.mockNotice, font: MOCK_FONT, size: 16, color: '888888' }),
              ]),
              footerParagraph([
                new TextRun({
                  text: `${rendered.version} · 内容指纹 ${rendered.contentHash}`,
                  font: MOCK_FONT,
                  size: 16,
                  color: '888888',
                }),
              ]),
            ],
          }),
        },
        children,
      },
    ],
  });

  const blob = await Packer.toBlob(docFile);
  triggerDownload(blob, buildFileName(rendered.title, rendered.version));
}
