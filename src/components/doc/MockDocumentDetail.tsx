import { useEffect, useState } from 'react';
import { Input, message } from 'antd';
import { FileTextOutlined } from '@ant-design/icons';
import { DOCUMENT_CATEGORIES, type MockDocument } from '@/seed/mockDocuments';
import DocumentDetailToolbar from './DocumentDetailToolbar';

/** 模拟文书右栏详情：在线编辑直接在右栏进行，保存只写回当前会话作用域的模拟文书库。 */
export default function MockDocumentDetail({ document, onClose, onOpenLibrary, onSave, onDirtyChange }: {
  document: MockDocument; onClose: () => void; onSave: (document: MockDocument) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onOpenLibrary?: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [working, setWorking] = useState(document);
  const displayed = editing ? working : document;
  const category = DOCUMENT_CATEGORIES.find(item => item.code === document.code)?.name ?? '文书';
  const dirty = JSON.stringify(working) !== JSON.stringify(document);
  const sectionChange = (index: number, part: 0 | 1, value: string) => setWorking(current => ({
    ...current, sections: current.sections.map((section, i) => i === index ? (part === 0 ? [value, section[1]] : [section[0], value]) : section),
  }));
  // 未保存修改状态上报给工作区（供关闭 / 切换导航前的保护确认使用）。
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);
  const save = () => {
    if (!working.title.trim() || working.sections.some(([heading, body]) => !heading.trim() || !body.trim())) {
      message.warning('请填写文书标题、章节标题和正文后保存'); return;
    }
    onSave(working); setEditing(false); onDirtyChange?.(false); message.success('修改已保存在当前会话');
  };
  // 取消编辑保留本次编辑内容（再次进入编辑可继续），放弃修改才真正丢弃。
  const discard = () => { setWorking(document); setEditing(false); onDirtyChange?.(false); message.info('已放弃未保存修改'); };
  return <div className="doc-detail-view">
    <DocumentDetailToolbar title={document.title} subtitle={`${category} · ${document.date} · ${editing ? '编辑中 · 保存后生效' : '当前会话版本'}`} editing={editing} dirty={dirty} onBack={onClose} onOpenLibrary={onOpenLibrary}
      onEdit={() => setEditing(true)} onSave={save} onCancel={() => setEditing(false)} onDiscard={discard} />
    {editing && dirty && <div className="doc-dirty-note" data-testid="mock-dirty-note">有未保存修改 · 「取消编辑」保留内容，「放弃修改」丢弃，保存后写入当前会话文书库</div>}
    <div className="doc-detail-scroll">
      {editing && <div className="doc-edit-notice">编辑标题与正文，完成后点击“保存修改”。</div>}
      <article className={`axn-redhead-paper ${editing ? 'doc-paper-editing' : ''}`} data-testid="mock-redhead-document">
        <div className="axn-redhead-org">应急管理</div>
        <div className="axn-redhead-no">{document.number}（模拟）</div>
        <div className="axn-redhead-rule" />
        {editing ? <Input className="doc-edit-title" aria-label="文书标题" value={working.title} onChange={event => setWorking({ ...working, title: event.target.value })} /> : <h2 className="doc-redhead-subject">{displayed.title}</h2>}
        <div className="axn-redhead-meta-row"><span>编制单位：市应急指挥中心（模拟）</span><span>{document.date}</span></div>
        <div className="axn-redhead-body">{displayed.sections.map(([heading, body], index) => heading === '文书要素（模拟收集）' ? null : <section key={index}>
          {editing ? <><Input className="doc-edit-heading" aria-label={`第${index + 1}节标题`} value={heading} onChange={event => sectionChange(index, 0, event.target.value)} /><Input.TextArea aria-label={`第${index + 1}节正文`} autoSize={{ minRows: 3 }} value={body} onChange={event => sectionChange(index, 1, event.target.value)} /></> : <><h3>{heading}</h3><p>{body}</p></>}
        </section>)}</div>
        <div className="doc-document-signature"><p>应急管理</p><p>{document.date}</p></div>
        <div className="axn-redhead-foot"><span>报送：有关单位（模拟）</span><span>模拟样稿 · 仅供评估</span></div>
      </article>
      <div className="doc-reading-footer"><FileTextOutlined /> {category} · 红头格式<span>{displayed.sections.reduce((count, section) => count + section.join('').length, displayed.title.length)} 字</span></div>
    </div>
  </div>;
}
