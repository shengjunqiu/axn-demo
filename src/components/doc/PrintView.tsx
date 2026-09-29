/**
 * 打印视图（T-016）：隐藏 DOM + window.print()，浏览器打印对话框中可选“另存为 PDF”。
 * 打印内容来自用户选定的版本快照，与 Word 导出同源。
 */
import { useEffect, useState } from 'react';
import { Button, Drawer, Space, Typography, message } from 'antd';
import { PrinterOutlined } from '@ant-design/icons';
import { useDocumentStore } from '@/store/documentStore';
import { renderRevision } from '@/services/docRender';

let openPrint: ((revisionId: string | null) => void) | null = null;

/** 供文书中心调用：打开打印预览（revisionId 为空则打工作副本）。 */
export function openPrintPreview(revisionId: string | null) {
  const reason = revisionId ? useDocumentStore.getState().getRevisionGuard(revisionId, 'export') : '请选择已保存并校核的版本';
  if (reason) { message.warning(reason); return; }
  openPrint?.(revisionId);
}

export default function PrintView() {
  const [revisionId, setRevisionId] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const revisions = useDocumentStore((s) => s.revisions);
  const drafts = useDocumentStore((s) => s.drafts);

  useEffect(() => {
    openPrint = (id) => {
      setRevisionId(id);
      setOpen(true);
    };
    return () => {
      openPrint = null;
    };
  }, []);

  const rev = revisionId ? revisions[revisionId] : null;
  const draft = rev ? Object.values(drafts).find((d) => d.documentId === rev.documentId) ?? null : null;
  const guard = revisionId ? useDocumentStore.getState().getRevisionGuard(revisionId, 'export') : '请选择版本';
  const rendered = rev && !guard ? renderRevision(rev) : null;

  return (
    <Drawer
      title={`打印预览${rendered ? ` · ${rendered.title} ${rendered.version}` : ''}`}
      width={620}
      open={open}
      onClose={() => setOpen(false)}
      extra={
        <Space>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            在打印对话框中选择“另存为 PDF”
          </Typography.Text>
          <Button type="primary" icon={<PrinterOutlined />} disabled={!!guard} onClick={() => { const reason = revisionId ? useDocumentStore.getState().getRevisionGuard(revisionId, 'export') : '请选择版本'; if (reason) message.warning(reason); else window.print(); }}>
            打印 / 另存为 PDF
          </Button>
        </Space>
      }
    >
      <Typography.Paragraph type="warning" style={{ fontSize: 12 }}>
        打印内容来自你选定的版本（{rendered?.version ?? '工作副本'}），与 Word 导出同源；全部为模拟数据。
        本按钮不会直接生成 PDF 文件，请在系统打印对话框中选择“另存为 PDF”。
      </Typography.Paragraph>
      {rendered && draft && (
        <div style={{ border: '1px solid #eee', borderRadius: 8, padding: 24, background: '#fff' }}>
          <div style={{ textAlign: 'center', fontSize: 20, fontWeight: 700 }}>{rendered.title}</div>
          <div style={{ textAlign: 'center', color: '#666', fontSize: 12, margin: '4px 0 16px' }}>
            {rendered.templateName} · {rendered.version} · 内容指纹 {rendered.contentHash}
          </div>
          {rendered.sections.map((s) => (
            <div key={s.sectionId} style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 700, margin: '10px 0 4px' }}>{s.title}</div>
              {s.paragraphs.map((t, i) => (
                <p key={i} style={{ margin: '4px 0', textIndent: '2em', lineHeight: 1.8 }}>
                  {t}
                </p>
              ))}
            </div>
          ))}
          <div style={{ marginTop: 20, color: '#666', fontSize: 12, borderTop: '1px solid #ddd', paddingTop: 8 }}>
            {rendered.footerNote}
            <br />
            {rendered.mockNotice}
          </div>
        </div>
      )}
      <div className="print-root">
        {rendered && (
          <>
            <div className="print-doc-title">{rendered.title}</div>
            <div className="print-doc-meta">
              {rendered.templateName} · {rendered.version} · 指纹 {rendered.contentHash}
            </div>
            {rendered.sections.map((s) => (
              <div key={s.sectionId}>
                <h3 className="print-section-title">{s.title}</h3>
                {s.paragraphs.map((t, i) => (
                  <p className="print-para" key={i}>
                    {t}
                  </p>
                ))}
              </div>
            ))}
            <div className="print-footer">
              {rendered.footerNote}
              <br />
              {rendered.mockNotice}
            </div>
          </>
        )}
      </div>
    </Drawer>
  );
}
