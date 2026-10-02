import { useState } from 'react';
import { Button, Modal, Space, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, EditOutlined, FileWordOutlined, FilePdfOutlined, SaveOutlined, UndoOutlined } from '@ant-design/icons';

/** 文书详情工具条（文书库 / 工作区共用）：返回文案可按视图定制，导出在模拟文书中明确为预览。 */
export default function DocumentDetailToolbar({ title, editing = false, dirty = false, backLabel = '返回对话', onBack, onEdit, onSave, onCancel, onDiscard, editDisabled = false, onVersions }: {
  title: string; editing?: boolean; dirty?: boolean; backLabel?: string; onBack: () => void; onEdit: () => void;
  onSave?: () => void; onCancel?: () => void; onDiscard?: () => void; editDisabled?: boolean;
  onVersions?: () => void;
}) {
  const [exportFormat, setExportFormat] = useState<'Word' | 'PDF' | null>(null);
  return <>
    <div className="doc-detail-toolbar doc-detail-toolbar--full">
      <div className="doc-detail-breadcrumb"><Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>{backLabel}</Button><Tag bordered={false}>{editing ? '编辑中' : '文书详情'}</Tag></div>
      <Space wrap size={8}>
        {editing ? <><Button onClick={onCancel}>取消编辑</Button>{onDiscard && <Button aria-label="放弃修改" icon={<UndoOutlined />} onClick={onDiscard} disabled={!dirty}>放弃修改</Button>}<Button aria-label="保存修改" type="primary" icon={<SaveOutlined />} onClick={onSave}>保存修改</Button></> : <Button aria-label="在线编辑" type="primary" icon={<EditOutlined />} onClick={onEdit} disabled={editDisabled}>在线编辑</Button>}
        {onVersions ? <Button icon={<FileWordOutlined />} onClick={onVersions}>版本与导出</Button> : <>
          <Button aria-label="导出 Word" icon={<FileWordOutlined />} onClick={() => setExportFormat('Word')} disabled={editing}>Word 预览</Button>
          <Button aria-label="导出 PDF" icon={<FilePdfOutlined />} onClick={() => setExportFormat('PDF')} disabled={editing}>PDF 预览</Button>
        </>}
      </Space>
    </div>
    <Modal open={!!exportFormat} title={`导出 ${exportFormat ?? ''}`} onCancel={() => setExportFormat(null)} footer={<Button type="primary" onClick={() => setExportFormat(null)}>知道了</Button>}>
      <div className="doc-export-preview">
        {exportFormat === 'Word' ? <FileWordOutlined /> : <FilePdfOutlined />}
        <Typography.Text strong>{title}.{exportFormat === 'Word' ? 'docx' : 'pdf'}</Typography.Text>
      </div>
      <Typography.Paragraph>将按当前红头文书版式导出，包含标题、文号、正文与落款。</Typography.Paragraph>
      <Typography.Text type="secondary">功能演示：本次仅展示导出预览，不生成或下载实际文件。</Typography.Text>
    </Modal>
  </>;
}
