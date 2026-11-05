import { useState } from 'react';
import { Button, Modal, Tooltip, Typography } from 'antd';
import { FileText, FileType, History, Save, ShieldCheck, SquarePen, Undo2, X } from 'lucide-react';

/** 标题与保存操作在上，审查、版本和下载工具在下；窄屏按组换行。 */
export default function DocumentDetailToolbar({ title, subtitle, editing = false, dirty = false, onBack, onEdit, onSave, onDiscard, editDisabled = false, onVersions, previewExports = true, versionLabel, versionsOpen = false, onToggleVersions }: {
  title: string; subtitle?: string; editing?: boolean; dirty?: boolean;
  /** 红头公文的版本入口：显示当前版本号，点击打开版本记录弹窗 */
  versionLabel?: string; versionsOpen?: boolean; onToggleVersions?: () => void;
  onBack: () => void; onOpenLibrary?: () => void; onEdit?: () => void;
  onSave?: () => void; onDiscard?: () => void; editDisabled?: boolean;
  onVersions?: () => void; previewExports?: boolean;
}) {
  const [exportFormat, setExportFormat] = useState<'Word' | 'PDF' | null>(null);

  const exportModal = (
    <Modal open={!!exportFormat} title={`导出 ${exportFormat ?? ''}`} onCancel={() => setExportFormat(null)} footer={<Button type="primary" onClick={() => setExportFormat(null)}>知道了</Button>}>
      <div className="doc-export-preview">
        {exportFormat === 'Word' ? <FileText /> : <FileType />}
        <Typography.Text strong>{title}.{exportFormat === 'Word' ? 'docx' : 'pdf'}</Typography.Text>
      </div>
      <Typography.Paragraph>将按当前红头文书版式导出，包含标题、文号、正文与落款。</Typography.Paragraph>
      <Typography.Text type="secondary">本次仅展示导出预览，不生成或下载实际文件。</Typography.Text>
    </Modal>
  );

  const primaryActions = editing ? <>
    {onDiscard && <Button aria-label="放弃修改" icon={<Undo2 />} onClick={onDiscard} disabled={!dirty}>放弃修改</Button>}
    <Button aria-label="保存修改" type="primary" className="doc-toolbar-primary" icon={<Save />} onClick={onSave}>保存修改</Button>
  </> : onEdit ? <Button aria-label="在线编辑" type="primary" className="doc-toolbar-primary" icon={<SquarePen />} onClick={onEdit} disabled={editDisabled}>在线编辑</Button> : null;

  const hasOutputActions = editing || onEdit || onToggleVersions || onVersions || previewExports;
  const outputActions = <>
    {(editing || onEdit || onToggleVersions) && <div className="doc-toolbar-group doc-toolbar-context">
      {(editing || onEdit) && <Button className="doc-toolbar-secondary" icon={<ShieldCheck />}>一键审查</Button>}
      {onToggleVersions && <Button aria-label={`版本记录 ${versionLabel ?? ''}`.trim()} aria-pressed={versionsOpen} className={`doc-toolbar-secondary${versionsOpen ? ' is-active' : ''}`} icon={<History />} onClick={onToggleVersions} data-testid="doc-version-toggle">{versionLabel ?? '版本'}</Button>}
    </div>}
    {(onVersions || previewExports) && <div className="doc-toolbar-group doc-toolbar-exports">
      {onVersions ? <Button className="doc-toolbar-secondary" icon={<FileText />} onClick={onVersions}>版本与导出</Button> : <>
        <Button className="doc-toolbar-secondary" aria-label="导出 Word" icon={<FileText />} onClick={() => setExportFormat('Word')}>下载 Word</Button>
        <Button className="doc-toolbar-secondary" aria-label="导出 PDF" icon={<FileType />} onClick={() => setExportFormat('PDF')}>下载 PDF</Button>
      </>}
    </div>}
  </>;

  const closeButton = <Tooltip title="关闭文书，返回对话"><Button type="text" className="doc-toolbar-close" aria-label="关闭文书" icon={<X />} onClick={onBack} data-testid="workspace-close-btn" /></Tooltip>;

  return <>
    <header className="doc-detail-toolbar doc-detail-toolbar--full" data-testid="document-toolbar">
      <div className="doc-toolbar-header">
        <div className="doc-toolbar-heading">
          <div className="doc-toolbar-title"><h2 title={title}>{title}</h2></div>
          {subtitle && <div className="doc-toolbar-subtitle" aria-live="polite">{subtitle}</div>}
        </div>
        {primaryActions && <div className="doc-toolbar-group doc-toolbar-save-actions">{primaryActions}</div>}
        {closeButton}
      </div>
      {hasOutputActions && <div className="doc-toolbar-actions">{outputActions}</div>}
    </header>
    {exportModal}
  </>;
}
