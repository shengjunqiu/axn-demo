import { useState } from 'react';
import { Button, Modal, Space, Tag, Typography } from 'antd';
import { ArrowLeftOutlined, EditOutlined, FileWordOutlined, FilePdfOutlined, SaveOutlined } from '@ant-design/icons';

export default function DocumentDetailToolbar({ title, editing = false, onBack, onEdit, onSave, onCancel, editDisabled = false }: {
  title: string; editing?: boolean; onBack: () => void; onEdit: () => void;
  onSave?: () => void; onCancel?: () => void; editDisabled?: boolean;
}) {
  const [exportFormat, setExportFormat] = useState<'Word' | 'PDF' | null>(null);
  return <>
    <div className="doc-detail-toolbar doc-detail-toolbar--full">
      <div className="doc-detail-breadcrumb"><Button type="text" icon={<ArrowLeftOutlined />} onClick={onBack}>返回文书列表</Button><Tag bordered={false}>{editing ? '编辑中' : '文书详情'}</Tag></div>
      <Space wrap size={8}>
        {editing ? <><Button onClick={onCancel}>取消编辑</Button><Button aria-label="保存修改" type="primary" icon={<SaveOutlined />} onClick={onSave}>保存修改</Button></> : <Button aria-label="在线编辑" type="primary" icon={<EditOutlined />} onClick={onEdit} disabled={editDisabled}>在线编辑</Button>}
        <Button aria-label="导出 Word" icon={<FileWordOutlined />} onClick={() => setExportFormat('Word')} disabled={editing}>导出 Word</Button>
        <Button aria-label="导出 PDF" icon={<FilePdfOutlined />} onClick={() => setExportFormat('PDF')} disabled={editing}>导出 PDF</Button>
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
