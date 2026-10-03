import { useState } from 'react';
import { Button, Modal, Tag, Tooltip, Typography } from 'antd';
import { CloseOutlined, EditOutlined, FileWordOutlined, FilePdfOutlined, FolderOpenOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons';

/** 文书标题和所有阅读操作收在一条工具栏；模拟导出始终明确标注为预览。 */
export default function DocumentDetailToolbar({ title, subtitle, editing = false, dirty = false, onBack, onOpenLibrary, onEdit, onSave, onCancel, onDiscard, editDisabled = false, onVersions, previewExports = true }: {
  title: string; subtitle?: string; editing?: boolean; dirty?: boolean;
  onBack: () => void; onOpenLibrary?: () => void; onEdit?: () => void;
  onSave?: () => void; onCancel?: () => void; onDiscard?: () => void; editDisabled?: boolean;
  onVersions?: () => void; previewExports?: boolean;
}) {
  const [exportFormat, setExportFormat] = useState<'Word' | 'PDF' | null>(null);
  return <>
    <header className="doc-detail-toolbar doc-detail-toolbar--full" data-testid="document-toolbar">
      <div className="doc-toolbar-heading">
        <div className="doc-toolbar-title"><h2 title={title}>{title}</h2><Tag bordered={false}>模拟</Tag></div>
        {subtitle && <div className="doc-toolbar-subtitle">{subtitle}</div>}
      </div>
      <div className="doc-toolbar-actions">
        {editing ? <>
          <Button onClick={onCancel}>取消编辑</Button>
          {onDiscard && <Button aria-label="放弃修改" icon={<UndoOutlined />} onClick={onDiscard} disabled={!dirty}>放弃修改</Button>}
          <Button aria-label="保存修改" type="primary" icon={<SaveOutlined />} onClick={onSave}>保存修改</Button>
        </> : onEdit && <Button aria-label="在线编辑" type="primary" icon={<EditOutlined />} onClick={onEdit} disabled={editDisabled}>在线编辑</Button>}
        {onVersions ? <Button icon={<FileWordOutlined />} onClick={onVersions}>版本与导出</Button> : previewExports && <>
          <Button aria-label="导出 Word" icon={<FileWordOutlined />} onClick={() => setExportFormat('Word')} disabled={editing}>Word 预览</Button>
          <Button aria-label="导出 PDF" icon={<FilePdfOutlined />} onClick={() => setExportFormat('PDF')} disabled={editing}>PDF 预览</Button>
        </>}
        {onOpenLibrary && <Tooltip title="文书库"><Button type="text" aria-label="文书库" icon={<FolderOpenOutlined />} onClick={onOpenLibrary} data-testid="workspace-library-btn" /></Tooltip>}
        <Tooltip title="关闭文书，返回对话"><Button type="text" aria-label="关闭文书" icon={<CloseOutlined />} onClick={onBack} data-testid="workspace-close-btn" /></Tooltip>
      </div>
    </header>
    <Modal open={!!exportFormat} title={`导出 ${exportFormat ?? ''}`} onCancel={() => setExportFormat(null)} footer={<Button type="primary" onClick={() => setExportFormat(null)}>知道了</Button>}>
      <div className="doc-export-preview">
        {exportFormat === 'Word' ? <FileWordOutlined /> : <FilePdfOutlined />}
        <Typography.Text strong>{title}.{exportFormat === 'Word' ? 'docx' : 'pdf'}</Typography.Text>
      </div>
      <Typography.Paragraph>将按当前红头文书版式导出，包含标题、文号、正文与落款。</Typography.Paragraph>
      <Typography.Text type="secondary">本次仅展示导出预览，不生成或下载实际文件。</Typography.Text>
    </Modal>
  </>;
}
