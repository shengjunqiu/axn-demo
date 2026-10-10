import OriginalSystemLink from '@/components/chat/OriginalSystemLink';
import { useSessionStore } from '@/store/sessionStore';
import { exportMaterial } from '@/services/prototypeExports';
import { parsePipeTable } from '@/services/pipeTable';
import { useEffect, useState } from 'react';
// message 反馈走 AntdApp.useApp()：antd v5 静态方法不消费 ConfigProvider 主题，会退回默认 token。
// useApp() 在 <App> 之外（如直接渲染本组件的单元测试）返回空实现，故调用点用可选链避免抛错。
import { App as AntdApp, Button, Checkbox, Input, Modal, Typography } from 'antd';
import {
  FileText,
} from 'lucide-react'
import {
  findDocumentCategory,
  handoffTargetFor,
  sameMockDocument,
  type MockDocument,
} from '@/seed/mockDocuments';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import DocumentDetailToolbar from './DocumentDetailToolbar';
import { isRedheadSubhead, splitRedheadParagraphs } from './redheadBody';

/** 管道表正文渲染为红头表格；普通正文按行拆段，避免 \n 被折叠成一堆文字。 */
function RedheadSectionBody({ body }: { body: string }) {
  const table = parsePipeTable(body);
  if (table) {
    return (
      <div className="axn-redhead-table-wrap">
        <table className="axn-redhead-table">
          <thead>
            <tr>
              {table.headers.map((header) => (
                <th key={header}>{header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, rowIndex) => (
              <tr key={rowIndex}>
                {row.map((cell, cellIndex) => (
                  <td key={`${rowIndex}-${cellIndex}`}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }
  const paragraphs = splitRedheadParagraphs(body);
  if (paragraphs.length === 0) return <p>{body}</p>;
  return (
    <>
      {paragraphs.map((para, index) => (
        <p key={`${index}-${para.slice(0, 12)}`} className={isRedheadSubhead(para) ? 'axn-redhead-subhead' : undefined}>
          {para}
        </p>
      ))}
    </>
  );
}

/** 模拟文书右栏详情：在线编辑直接在右栏进行，保存只写回当前会话作用域的模拟文书库。 */
export default function MockDocumentDetail({ scope, document, onClose, onOpenLibrary, onSave, onDirtyChange }: {
  scope: string; document: MockDocument; onClose: () => void; onSave: (document: MockDocument) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onOpenLibrary?: () => void;
}) {
  const eventId = useSessionStore(s => s.sessions[scope]?.eventId ?? '');
  const { message } = AntdApp.useApp();
  // 未保存的工作副本存在 store 里（按会话作用域 + 文档 id），离开详情页不丢，保存或放弃才清除。
  const savedWorking = useMockDocumentStore((s) => s.libraries[scope]?.working[document.id]);
  const [editing, setEditing] = useState(() => savedWorking !== undefined);
  const [transferOpen, setTransferOpen] = useState(false);
  const [transferChecked, setTransferChecked] = useState(false);
  const working = savedWorking ?? document;
  const applyWorking = (next: MockDocument) => {
    const store = useMockDocumentStore.getState();
    // 改回原文即视为没有未保存修改，顺手清掉工作副本。
    if (sameMockDocument(next, document)) store.clearWorking(scope, document.id);
    else store.setWorking(scope, next);
  };
  const displayed = editing ? working : document;
  const category = findDocumentCategory(document.code);
  const categoryName = category?.name ?? '文书';
  const redhead = category?.redhead;
  const dirty = !sameMockDocument(working, document);
  const handoff = document.handoff;
  const handoffTarget = handoffTargetFor(document.code);
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
  const openTransfer = () => {
    if (dirty) {
      message.warning?.('请先保存未保存的修改，再提交到原系统');
      return;
    }
    setTransferChecked(false);
    setTransferOpen(true);
  };
  const confirmTransfer = () => {
    if (!transferChecked) return;
    const now = new Date();
    const next: MockDocument = {
      ...document,
      handoff: {
        status: 'uploaded',
        target: handoffTarget,
        uploadedAt: now.toLocaleString('zh-CN', { hour12: false }),
        receiptId: `AXN-RCPT-${now.getTime().toString(36).toUpperCase()}`,
      },
    };
    onSave(next);
    setTransferOpen(false);
    message.success?.('已传入原系统对应栏目（演示）· 待提交审核');
  };
  const subtitleParts = [
    categoryName,
    document.date,
    editing ? '编辑中 · 保存后生效' : '当前会话版本',
    handoff ? `已上传 · ${handoff.target}` : null,
  ].filter(Boolean);
  return <div className="doc-detail-view">
    <DocumentDetailToolbar
      onExport={(format) => { void exportMaterial(document.title, document.sections, format).catch(() => message.error('导出失败，请重试')); }}
      title={document.title}
      subtitle={subtitleParts.join(' · ')}
      editing={editing}
      dirty={dirty}
      onBack={onClose}
      onOpenLibrary={onOpenLibrary}
      onEdit={() => setEditing(true)}
      onSave={save}
      onCancel={() => setEditing(false)}
      onDiscard={discard}
      onSubmitToOriginal={openTransfer}
      submitLabel={handoff ? '查看原系统回执' : '提交到原系统'}
      platformAction={(
        <OriginalSystemLink
          code={document.code}
          eventId={eventId}
          title={document.title}
          sourceId={document.id}
          sections={document.sections}
          buttonLabel="打开综合管理平台"
          size="middle"
        />
      )}
    />
    {editing && dirty && <div className="doc-dirty-note" data-testid="mock-dirty-note">有未保存修改 · 「取消编辑」保留内容，「放弃修改」丢弃，保存后写入当前会话文书库</div>}
    {handoff && !editing && (
      <div className="doc-handoff-note" data-testid="mock-handoff-note">
        已传入原系统（演示）· {handoff.target} · {handoff.status === 'uploaded' ? '待提交审核' : '已提交审核'} · 回执 {handoff.receiptId} · {handoff.uploadedAt}
        <span>上传正文草稿不等于正式签发</span>
      </div>
    )}
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
          {editing ? <><Input className="doc-edit-heading" aria-label={`第${index + 1}节标题`} value={heading} onChange={event => sectionChange(index, 0, event.target.value)} /><Input.TextArea aria-label={`第${index + 1}节正文`} autoSize={{ minRows: 3 }} value={body} onChange={event => sectionChange(index, 1, event.target.value)} /></> : <><h3>{heading}</h3><RedheadSectionBody body={body} /></>}
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
    <Modal
      open={transferOpen}
      title={handoff ? '原系统回执（演示）' : '确认提交到原系统'}
      onCancel={() => setTransferOpen(false)}
      footer={handoff ? (
        <Button type="primary" onClick={() => setTransferOpen(false)}>知道了</Button>
      ) : (
        <Button type="primary" disabled={!transferChecked} onClick={confirmTransfer} data-testid="confirm-submit-original">
          确认提交（演示）
        </Button>
      )}
      width={640}
      destroyOnHidden
    >
      <Typography.Paragraph type="secondary">
        原型对接演示：提交整理后的正文草稿到对应栏目，正式审核、调度、签发仍由原系统办理。
      </Typography.Paragraph>
      <dl className="doc-transfer-facts" data-testid="transfer-facts">
        <div><dt>上传栏目</dt><dd>{handoff?.target ?? handoffTarget}</dd></div>
        <div><dt>报告名称</dt><dd>{document.title}</dd></div>
        <div><dt>文件类型</dt><dd>正文草稿（未盖章）</dd></div>
        {handoff && <>
          <div><dt>回执编号</dt><dd>{handoff.receiptId}</dd></div>
          <div><dt>上传时间</dt><dd>{handoff.uploadedAt}</dd></div>
          <div><dt>状态</dt><dd>{handoff.status === 'uploaded' ? '已上传 · 待提交审核' : '已提交审核'}</dd></div>
        </>}
      </dl>
      {!handoff && (
        <Checkbox checked={transferChecked} onChange={(e) => setTransferChecked(e.target.checked)} data-testid="transfer-check">
          已核对正文、目标栏目及待核事项（上传不等于正式签发）
        </Checkbox>
      )}
    </Modal>
  </div>;
}
