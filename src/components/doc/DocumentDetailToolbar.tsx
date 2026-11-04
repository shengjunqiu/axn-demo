import { useState } from 'react';
import { Button, Modal, Tooltip, Typography } from 'antd';
import { FileText, FileType, History, Save, SquarePen, Undo2, X } from 'lucide-react';
import { useIsCompact } from '@/hooks/useMediaQuery';

/** 文书标题和所有阅读操作收在一条工具栏。
 * 按钮可见文案按产品要求叫「下载」，但落在弹层里的说明照旧写明不生成实际文件；
 * aria-label 保持「导出 Word / PDF」——可访问名描述的是动作本身，且 e2e/document-agent.spec.ts 用它定位。
 *
 * 窄屏（≤767px）只重排、不隐藏：5 个操作按钮全部照样渲染（含禁用的「放弃修改」），
 * 变化只有三处 —— 标题行右侧多一个 44px 的关闭 ×（原本它是排在最后一行末尾的 32px 小叉，
 * 手机上最难找的角落）、副标题压成单行、操作按钮换到标题下一行按 40px 触摸高度自动折行。
 * 导出与版本记录留在外面而不是收进「更多」菜单：少一次点击，也少一个要记的入口。 */
export default function DocumentDetailToolbar({ title, subtitle, editing = false, dirty = false, onBack, onEdit, onSave, onDiscard, editDisabled = false, onVersions, previewExports = true, versionLabel, versionsOpen = false, onToggleVersions }: {
  title: string; subtitle?: string; editing?: boolean; dirty?: boolean;
  /** 红头公文的版本入口：显示当前版本号，点击打开版本记录弹窗 */
  versionLabel?: string; versionsOpen?: boolean; onToggleVersions?: () => void;
  onBack: () => void; onOpenLibrary?: () => void; onEdit?: () => void;
  onSave?: () => void; onDiscard?: () => void; editDisabled?: boolean;
  onVersions?: () => void; previewExports?: boolean;
}) {
  const [exportFormat, setExportFormat] = useState<'Word' | 'PDF' | null>(null);
  const isCompact = useIsCompact();

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

  // 两组按钮分装进 doc-toolbar-group：桌面上 display:contents 直接拍平进同一条 flex 行，
  // 排版与改造前逐像素一致；窄屏下才真正成为两行（主操作 / 输出工具）。
  // 用分组容器而不是往 flex 里塞零高断行元素：后者会多摊一份 row-gap，两行间距压不下去。
  const primaryActions = editing ? <>
    {onDiscard && <Button aria-label="放弃修改" icon={<Undo2 />} onClick={onDiscard} disabled={!dirty}>放弃修改</Button>}
    <Button aria-label="保存修改" type="primary" className="doc-toolbar-primary" icon={<Save />} onClick={onSave}>保存修改</Button>
  </> : onEdit ? <Button aria-label="在线编辑" type="primary" className="doc-toolbar-primary" icon={<SquarePen />} onClick={onEdit} disabled={editDisabled}>在线编辑</Button> : null;

  const outputActions = <>
    {onToggleVersions && <Button aria-label={`版本记录 ${versionLabel ?? ''}`.trim()} aria-pressed={versionsOpen} className={`doc-toolbar-secondary${versionsOpen ? ' is-active' : ''}`} icon={<History />} onClick={onToggleVersions} data-testid="doc-version-toggle">{versionLabel ?? '版本'}</Button>}
    {onVersions ? <Button className="doc-toolbar-secondary" icon={<FileText />} onClick={onVersions}>版本与导出</Button> : previewExports && <>
      <Button className="doc-toolbar-secondary" aria-label="导出 Word" icon={<FileText />} onClick={() => setExportFormat('Word')}>下载 Word</Button>
      <Button className="doc-toolbar-secondary" aria-label="导出 PDF" icon={<FileType />} onClick={() => setExportFormat('PDF')}>下载 PDF</Button>
    </>}
  </>;

  const closeButton = <Tooltip title="关闭文书，返回对话"><Button type="text" className="doc-toolbar-close" aria-label="关闭文书" icon={<X />} onClick={onBack} data-testid="workspace-close-btn" /></Tooltip>;

  if (isCompact) {
    return <>
      <header className="doc-detail-toolbar doc-detail-toolbar--full doc-detail-toolbar--compact" data-testid="document-toolbar">
        <div className="doc-toolbar-heading">
          <div className="doc-toolbar-copy">
            <h2 title={title}>{title}</h2>
            {subtitle && <div className="doc-toolbar-subtitle" aria-live="polite">{subtitle}</div>}
          </div>
          {closeButton}
        </div>
        <div className="doc-toolbar-actions">
          <div className="doc-toolbar-group">{primaryActions}</div>
          <div className="doc-toolbar-group">{outputActions}</div>
        </div>
      </header>
      {exportModal}
    </>;
  }

  return <>
    <header className="doc-detail-toolbar doc-detail-toolbar--full" data-testid="document-toolbar">
      <div className="doc-toolbar-heading">
        <div className="doc-toolbar-title"><h2 title={title}>{title}</h2></div>
        {subtitle && <div className="doc-toolbar-subtitle" aria-live="polite">{subtitle}</div>}
      </div>
      <div className="doc-toolbar-actions">
        <div className="doc-toolbar-group">{primaryActions}</div>
        <div className="doc-toolbar-group">{outputActions}</div>
        {closeButton}
      </div>
    </header>
    {exportModal}
  </>;
}
