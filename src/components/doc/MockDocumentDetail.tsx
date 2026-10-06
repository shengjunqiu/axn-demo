import { useEffect, useState } from 'react';
// message 反馈走 AntdApp.useApp()：antd v5 静态方法不消费 ConfigProvider 主题，会退回默认 token。
// useApp() 在 <App> 之外（如直接渲染本组件的单元测试）返回空实现，故调用点用可选链避免抛错。
import { App as AntdApp, Input } from 'antd';
import {
  FileText,
} from 'lucide-react'
import { DOCUMENT_CATEGORIES, sameMockDocument, type MockDocument } from '@/seed/mockDocuments';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import DocumentDetailToolbar from './DocumentDetailToolbar';

/** 模拟文书右栏详情：在线编辑直接在右栏进行，保存只写回当前会话作用域的模拟文书库。 */
export default function MockDocumentDetail({ scope, document, onClose, onOpenLibrary, onSave, onDirtyChange }: {
  scope: string; document: MockDocument; onClose: () => void; onSave: (document: MockDocument) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onOpenLibrary?: () => void;
}) {
  const { message } = AntdApp.useApp();
  // 未保存的工作副本存在 store 里（按会话作用域 + 文档 id），离开详情页不丢，保存或放弃才清除。
  const savedWorking = useMockDocumentStore((s) => s.libraries[scope]?.working[document.id]);
  const [editing, setEditing] = useState(() => savedWorking !== undefined);
  const working = savedWorking ?? document;
  const applyWorking = (next: MockDocument) => {
    const store = useMockDocumentStore.getState();
    // 改回原文即视为没有未保存修改，顺手清掉工作副本。
    if (sameMockDocument(next, document)) store.clearWorking(scope, document.id);
    else store.setWorking(scope, next);
  };
  const displayed = editing ? working : document;
  const category = DOCUMENT_CATEGORIES.find(item => item.code === document.code);
  const categoryName = category?.name ?? '文书';
  const redhead = category?.redhead;
  const dirty = !sameMockDocument(working, document);
  const sectionChange = (index: number, part: 0 | 1, value: string) => applyWorking({
    ...working, sections: working.sections.map((section, i) => i === index ? (part === 0 ? [value, section[1]] : [section[0], value]) : section),
  });
  // 未保存修改状态上报给工作区（供关闭 / 切换导航前的保护确认使用）。
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);
  const save = () => {
    if (!working.title.trim() || working.sections.some(([heading, body]) => !heading.trim() || !body.trim())) {
      message.warning?.('请填写文书标题、章节标题和正文后保存'); return;
    }
    onSave(working); setEditing(false); onDirtyChange?.(false); message.success?.('修改已保存在当前会话');
  };
  // 取消编辑保留本次编辑内容（工作副本在 store 里，再次进入编辑可继续），放弃修改才真正丢弃。
  const discard = () => { useMockDocumentStore.getState().clearWorking(scope, document.id); setEditing(false); onDirtyChange?.(false); message.info?.('已放弃未保存修改'); };
  return <div className="doc-detail-view">
    <DocumentDetailToolbar title={document.title} subtitle={`${categoryName} · ${document.date} · ${editing ? '编辑中 · 保存后生效' : '当前会话版本'}`} editing={editing} dirty={dirty} onBack={onClose} onOpenLibrary={onOpenLibrary}
      onEdit={() => setEditing(true)} onSave={save} onCancel={() => setEditing(false)} onDiscard={discard} />
    {editing && dirty && <div className="doc-dirty-note" data-testid="mock-dirty-note">有未保存修改 · 「取消编辑」保留内容，「放弃修改」丢弃，保存后写入当前会话文书库</div>}
    <div className="doc-detail-scroll">
      {editing && <div className="doc-edit-notice">编辑标题与正文，完成后点击“保存修改”。</div>}
      <article className={`axn-redhead-paper ${editing ? 'doc-paper-editing' : ''}`} data-testid="mock-redhead-document">
        {redhead?.platform && <div className="axn-redhead-platform">{redhead.platform}</div>}
        <div className="axn-redhead-org">{redhead?.org ?? '中国安能建设集团有限公司'}</div>
        <div className="axn-redhead-type">{redhead?.type ?? categoryName}</div>
        {redhead?.showNumber !== false && <div className="axn-redhead-no">{document.number}（模拟）</div>}
        <div className="axn-redhead-metabar">
          <span>{document.date}</span>
          <span>{redhead?.tail === 'duty' ? '审　阅：×××' : '签　发：×××'}</span>
        </div>
        <div className="axn-redhead-rule" />
        {editing && <Input className="doc-edit-title" aria-label="文书标题" value={working.title} onChange={event => applyWorking({ ...working, title: event.target.value })} />}
        {!editing && redhead?.showTitle !== false && <h2 className="doc-redhead-subject">{displayed.title}</h2>}
        <div className="axn-redhead-body">{displayed.sections.map(([heading, body], index) => heading === '文书要素（模拟收集）' ? null : <section key={index}>
          {editing ? <><Input className="doc-edit-heading" aria-label={`第${index + 1}节标题`} value={heading} onChange={event => sectionChange(index, 0, event.target.value)} /><Input.TextArea aria-label={`第${index + 1}节正文`} autoSize={{ minRows: 3 }} value={body} onChange={event => sectionChange(index, 1, event.target.value)} /></> : <><h3>{heading}</h3><p>{body}</p></>}
        </section>)}</div>
        {redhead?.tail === 'duty' && <div className="axn-redhead-tail axn-redhead-tail-duty">
          <span>值班员：×××</span>
          <span>值班电话：×××-××××××××</span>
        </div>}
        {redhead?.tail === 'brief' && <div className="axn-redhead-tail axn-redhead-tail-brief">
          <p>报送：集团应急指挥中心（模拟）。</p>
          <p>抄送：集团领导，副总师级以上管理人员，总部各部门（模拟）。</p>
          <p>承办：应急指挥中心（模拟）&emsp;&emsp;编辑：×××&emsp;电话：×××-××××××××</p>
        </div>}
        {redhead?.tail === 'report' && <div className="axn-redhead-tail axn-redhead-tail-report">
          <p className="axn-redhead-sign-org">{redhead.org}</p>
          <p className="axn-redhead-sign-date">{document.date}</p>
          <p className="axn-redhead-contact">（联系人：×××&emsp;电话：×××-××××××××）</p>
        </div>}
        <div className="axn-redhead-pageno">— 1 —</div>
        <div className="axn-redhead-mock">模拟样稿 · 仅供评估</div>
      </article>
      <div className="doc-reading-footer"><FileText /> {categoryName} · 红头格式<span>{displayed.sections.reduce((count, section) => count + section.join('').length, displayed.title.length)} 字</span></div>
    </div>
  </div>;
}
