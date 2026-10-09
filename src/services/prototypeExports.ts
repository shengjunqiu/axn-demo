import { parsePipeTable } from '@/services/pipeTable';

export function downloadFile(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportMaterial(title: string, sections: readonly (readonly [string, string])[], format: 'Word' | 'PDF') {
  if (format === 'Word') {
    const { Document, Packer, Paragraph, HeadingLevel, Table, TableRow, TableCell, TextRun, WidthType, BorderStyle } = await import('docx');
    const border = { style: BorderStyle.SINGLE, size: 8, color: '333333' };
    const borders = { top: border, bottom: border, left: border, right: border };
    const cell = (text: string, bold = false) => new TableCell({
      borders,
      width: { size: 2400, type: WidthType.DXA },
      children: [new Paragraph({ children: [new TextRun({ text, bold })] })],
    });
    const children = [
      new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
      ...sections.flatMap(([heading, body]) => {
        const table = parsePipeTable(body);
        const headingPara = new Paragraph({ text: heading, heading: HeadingLevel.HEADING_1 });
        if (!table) {
          return [headingPara, ...body.split('\n').map((text) => new Paragraph(text))];
        }
        return [
          headingPara,
          new Table({
            width: { size: 9026, type: WidthType.DXA },
            rows: [
              new TableRow({ children: table.headers.map((header) => cell(header, true)) }),
              ...table.rows.map((row) => new TableRow({ children: row.map((value) => cell(value)) })),
            ],
          }),
        ];
      }),
      new Paragraph('模拟材料 · 待专业审核'),
    ];
    const doc = new Document({ sections: [{ children }] });
    downloadFile(await Packer.toBlob(doc), `${title}.docx`); return;
  }
  // 在浏览器使用中文系统字体排版，页面图片嵌入PDF，避免未嵌入字体造成中文乱码。
  const pages: Uint8Array[] = []; let canvas = document.createElement('canvas');
  let context: CanvasRenderingContext2D; let y: number;
  const fresh = () => { canvas = document.createElement('canvas'); canvas.width = 1240; canvas.height = 1754;
    context = canvas.getContext('2d')!; context.fillStyle = '#fff'; context.fillRect(0, 0, 1240, 1754);
    context.fillStyle = '#222'; context.font = '28px "SimSun", serif'; y = 100; };
  const finish = () => { const b = atob(canvas.toDataURL('image/jpeg', .92).split(',')[1]); pages.push(Uint8Array.from(b, c => c.charCodeAt(0))); };
  fresh();
  for (const line of [title, '', ...sections.flatMap(([h, body]) => [h, ...body.split('\n'), '']), '模拟材料 · 待专业审核']) {
    let current = '';
    const draw = () => { if (y > 1630) { finish(); fresh(); } context.fillText(current, 90, y); y += 46; current = ''; };
    for (const char of line) { if (context!.measureText(current + char).width > 1060) draw(); current += char; } draw();
  }
  finish();
  const encode = (s: string) => new TextEncoder().encode(s);
  const chunks: Uint8Array[] = [encode('%PDF-1.4\n')]; const offsets = [0]; let length = chunks[0].length;
  const append = (b: Uint8Array) => { chunks.push(b); length += b.length; };
  const object = (id: number, parts: (string | Uint8Array)[]) => { offsets[id] = length; append(encode(`${id} 0 obj\n`)); parts.forEach(p => append(typeof p === 'string' ? encode(p) : p)); append(encode('\nendobj\n')); };
  object(1, ['<< /Type /Catalog /Pages 2 0 R >>']);
  object(2, [`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${3 + i * 3} 0 R`).join(' ')}] >>`]);
  pages.forEach((bytes, i) => { const id = 3 + i * 3; const stream = 'q 595 0 0 842 0 0 cm /Im0 Do Q';
    object(id, [`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /XObject << /Im0 ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`]);
    object(id + 1, [`<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`, bytes, '\nendstream']);
    object(id + 2, [`<< /Length ${encode(stream).length} >>\nstream\n${stream}\nendstream`]);
  });
  const start = length; append(encode(`xref\n0 ${offsets.length}\n0000000000 65535 f \n${offsets.slice(1).map(o => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`));
  downloadFile(new Blob(chunks as BlobPart[], { type: 'application/pdf' }), `${title}.pdf`);
}

export async function exportResourceExcel(headers: string[], rows: string[][], name = '资源清单') {
  const { default: JSZip } = await import('jszip');
  const escape = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  const zip = new JSZip();
  zip.file('[Content_Types].xml', '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/></Types>');
  zip.file('_rels/.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>');
  zip.file('xl/workbook.xml', '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="资源清单" sheetId="1" r:id="rId1"/></sheets></workbook>');
  zip.file('xl/_rels/workbook.xml.rels', '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/></Relationships>');
  zip.file('xl/worksheets/sheet1.xml', `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" state="frozen"/></sheetView></sheetViews><sheetData>${[headers,...rows,['模拟数据，数量与状态待核实']].map((row,i)=>`<row r="${i+1}">${row.map(v=>`<c t="inlineStr"><is><t xml:space="preserve">${escape(v)}</t></is></c>`).join('')}</row>`).join('')}</sheetData></worksheet>`);
  downloadFile(await zip.generateAsync({type: 'blob', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}), `${name}.xlsx`);
}
