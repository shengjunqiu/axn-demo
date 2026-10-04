import { useState } from 'react';
import { Button, Modal, Tag, Tooltip, Typography } from 'antd';
import {
  FileText,
  FileType,
  FolderOpen,
  Save,
  SquarePen,
  Undo2,
  X,
} from 'lucide-react'

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
        <div className="doc-toolbar-title"><h2 title={title}>{title}</h2><Tag variant="filled">模拟</Tag></div>
        {subtitle && <div className="doc-toolbar-subtitle">{subtitle}</div>}
      </div>
      <div className="doc-toolbar-actions">
        {editing ? <>
          <Button onClick={onCancel}>取消编辑</Button>
          {onDiscard && <Button aria-label="放弃修改" icon={<Undo2 />} onClick={onDiscard} disabled={!dirty}>放弃修改</Button>}
          <Button aria-label="保存修改" type="primary" icon={<Save />} onClick={onSave}>保存修改</Button>
        </> : onEdit && <Button aria-label="在线编辑" type="primary" icon={<SquarePen />} onClick={onEdit} disabled={editDisabled}>在线编辑</Button>}
        {onVersions ? <Button icon={<FileText />} onClick={onVersions}>版本与导出</Button> : previewExports && <>
          <Button aria-label="导出 Word" icon={<FileText />} onClick={() => setExportFormat('Word')} disabled={editing}>Word 预览</Button>
          <Button aria-label="导出 PDF" icon={<FileType />} onClick={() => setExportFormat('PDF')} disabled={editing}>PDF 预览</Button>
        </>}
        {onOpenLibrary && <Tooltip title="文书库"><Button type="text" aria-label="文书库" icon={<FolderOpen />} onClick={onOpenLibrary} data-testid="workspace-library-btn" /></Tooltip>}
        <Tooltip title="关闭文书，返回对话"><Button type="text" aria-label="关闭文书" icon={<X />} onClick={onBack} data-testid="workspace-close-btn" /></Tooltip>
      </div>
    </header>
    <Modal open={!!exportFormat} title={`导出 ${exportFormat ?? ''}`} onCancel={() => setExportFormat(null)} footer={<Button type="primary" onClick={() => setExportFormat(null)}>知道了</Button>}>
      <div className="doc-export-preview">
        {exportFormat === 'Word' ? <FileText /> : <FileType />}
        <Typography.Text strong>{title}.{exportFormat === 'Word' ? 'docx' : 'pdf'}</Typography.Text>
      </div>
      <Typography.Paragraph>将按当前红头文书版式导出，包含标题、文号、正文与落款。</Typography.Paragraph>
      <Typography.Text type="secondary">本次仅展示导出预览，不生成或下载实际文件。</Typography.Text>
    </Modal>
  </>;
}
