import { orderReportSections } from '@/services/reportSectionOrder';
import { useEffect, useMemo, useRef, useState } from 'react';
// message 反馈走 AntdApp.useApp()：antd v5 静态方法不消费 ConfigProvider 主题，会退回默认 token。
// useApp() 在 <App> 之外（如直接渲染本组件的单元测试）返回空实现，故调用点用可选链避免抛错。
import { App as AntdApp, Button, Select, Switch, Tabs } from 'antd';
import { ChevronDown, ChevronUp, FileText, GitCompareArrows, RotateCcw } from 'lucide-react';
import { sameMockDocument, type MockDocument } from '@/seed/mockDocuments';
import { baselineVersion, useMockDocumentStore, type SaveMeta, type VersionAuthor } from '@/store/mockDocumentStore';
import { useDemoStore } from '@/store/demoStore';
import { richTextToPlain } from '@/services/richText';
import { diffDocuments, summarizeDiff } from '@/services/docDiff';
import {
  BRIEF_TAIL_FIELDS, DUTY_TAIL_FIELDS, DYNAMICS_TAIL_FIELDS, HIDDEN_SECTION, REDHEAD_ORG_DEFAULT, REPORT_CONTACT_DEFAULT,
  categoryOf, signDefault as signDefaultOf,
} from '@/services/redheadFields';
import DocumentDetailToolbar from './DocumentDetailToolbar';
import DocVersionCompare from './DocVersionCompare';
import DocVersionPanel, { authorText, versionTime, type VersionTarget } from './DocVersionPanel';
import PaperText from './PaperText';
import RichTextEditor from './RichText';
import RichTextToolbar from './RichTextToolbar';
import { useDocumentReviewStore } from '@/store/documentReviewStore';
import { DocumentReviewDetails } from './DocumentReview';

/** 附件表的合并首列（真件里的「分类」跨三行）：从这一行往后数到下一个带 group 的行。 */
function groupSpan(rows: readonly { group?: string }[], index: number) {
  const next = rows.slice(index + 1).findIndex(row => row.group);
  return next < 0 ? rows.length - index : next + 1;
}

/** 模拟文书右栏详情：打开即编辑（不再有阅读/编辑两态），保存只写回当前会话作用域的模拟文书库。 */
export default function MockDocumentDetail({ scope, document, onClose, onOpenLibrary, onSave, onDirtyChange }: {
  scope: string; document: MockDocument; onClose: () => void; onSave: (document: MockDocument, meta?: SaveMeta) => void;
  onDirtyChange?: (dirty: boolean) => void;
  onOpenLibrary?: () => void;
}) {
  const { message, modal } = AntdApp.useApp();
  // 未保存的工作副本存在 store 里（按会话作用域 + 文档 id），离开详情页不丢，保存或放弃才清除。
  const savedWorking = useMockDocumentStore((s) => s.libraries[scope]?.working[document.id]);
  const baseline = useMemo(() => ({ ...document, sections: orderReportSections(document.sections) }), [document]);
  const working = useMemo(() => savedWorking ? { ...savedWorking, sections: orderReportSections(savedWorking.sections) } : baseline, [savedWorking, baseline]);
  const review = useDocumentReviewStore(s => s.reviews[scope]?.[document.id]);
  const detailsTarget = useDocumentReviewStore(s => s.detailsTarget);
  const reviewOpen = !!review && detailsTarget?.scope === scope && detailsTarget.documentId === document.id;
  const applyWorking = (next: MockDocument) => {
    const store = useMockDocumentStore.getState();
    // 改回原文即视为没有未保存修改，顺手清掉工作副本。
    if (sameMockDocument(next, baseline)) store.clearWorking(scope, document.id);
    else store.setWorking(scope, next);
  };
  const category = categoryOf(document);
  const categoryName = category?.name ?? '文书';
  const redhead = category?.redhead;
  const signDefault = signDefaultOf(redhead);
  // 红头/时间行/落款/页码没有结构化字段，编辑值统一存进 working.paper；改回默认值就把键删掉（等于没改），
  // 「有未保存修改」的判断和「放弃修改」沿用同一套 working 机制。
  const paper = working.paper;
  const setPaper = (key: string, value: string, fallback: string) => {
    const next = { ...paper };
    if (value === fallback) delete next[key]; else next[key] = value;
    applyWorking({ ...working, paper: next });
  };
  const paperField = (key: string, fallback: string) => ({
    fieldKey: key, fallback, value: paper?.[key], onChange: (value: string) => setPaper(key, value, fallback),
  });
  const dirty = !sameMockDocument(working, baseline);
  const sectionChange = (index: number, part: 0 | 1, value: string) => applyWorking({
    ...working, sections: working.sections.map((section, i) => i === index ? (part === 0 ? [value, section[1]] : [section[0], value]) : section),
  });
  // 未保存修改状态上报给工作区（供关闭 / 切换导航前的保护确认使用）。
  useEffect(() => { onDirtyChange?.(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => { onDirtyChange?.(false); }, [onDirtyChange]);

  /* ---------- 版本 ---------- */
  const storedVersions = useMockDocumentStore((s) => s.libraries[scope]?.versions[document.id]);
  const versions = useMemo(() => (storedVersions?.length ? storedVersions : [baselineVersion(document)]), [storedVersions, document]);
  const latest = versions[versions.length - 1];
  const [panelOpen, setPanelOpen] = useState(false);
  /** 对比视图：target = 要看的版本（或未保存的当前编辑），base = 对比基准（null = 无更早版本） */
  const [view, setView] = useState<{ target: VersionTarget; base: number | null } | null>(null);
  const [onlyChanges, setOnlyChanges] = useState(false);
  const [hunkIndex, setHunkIndex] = useState(0);
  const compareRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const workingDiff = useMemo(() => {
    if (!dirty) return null;
    const diff = diffDocuments(latest.snapshot, working);
    return { summary: summarizeDiff(diff), added: diff.added, removed: diff.removed };
  }, [dirty, latest, working]);
  const currentAuthor = (): VersionAuthor => {
    const actor = useDemoStore.getState().getActor();
    return { kind: 'user', name: actor?.userName ?? '值班员', role: actor?.name ?? '' };
  };
  const versionDoc = (no: number | null) => (no == null ? null : versions.find(v => v.no === no)?.snapshot ?? null);
  const openVersion = (target: VersionTarget) => {
    const base = target === 'working' ? latest.no : (target > 1 ? (versions.filter(v => v.no < target).pop()?.no ?? null) : null);
    setView({ target, base });
    setHunkIndex(0);
  };
  // 有未保存修改时离开「当前编辑」对比、或保存后，若目标已不存在就退出对比
  useEffect(() => {
    if (view?.target === 'working' && !dirty) setView(null);
  }, [view, dirty]);

  const save = () => {
    if (!working.title.trim() || working.sections.some(([heading, body]) => !heading.trim() || !richTextToPlain(body).trim())) {
      message.warning?.('请填写文书标题、章节标题和正文后保存'); return;
    }
    onSave(working, { author: currentAuthor() }); onDirtyChange?.(false);
    if (dirty) message.success?.(`已保存为 V${latest.no + 1}，可在版本记录中查看改动`);
    else message.info?.('内容没有变化，未生成新版本');
  };
  const saveRef = useRef(onSave);
  saveRef.current = onSave;
  useEffect(() => {
    if (!dirty || !savedWorking || view) return;
    const timer = window.setTimeout(() => {
      // 切换、放弃或手动保存后，旧计时器不能再写回过期的工作副本。
      const current = useMockDocumentStore.getState().libraries[scope]?.working[document.id];
      if (current !== savedWorking || !current.title.trim()
        || current.sections.some(([heading, body]) => !heading.trim() || !richTextToPlain(body).trim())) return;
      const actor = useDemoStore.getState().getActor();
      saveRef.current(current, {
        source: 'autosave',
        author: { kind: 'user', name: actor?.userName ?? '值班员', role: actor?.name ?? '' },
      });
    }, 2000);
    return () => window.clearTimeout(timer);
  }, [dirty, savedWorking, scope, document.id, view]);
  // 工作副本在 store 里，离开详情页不丢；只有「放弃修改」会真正丢弃。
  const discard = () => { useMockDocumentStore.getState().clearWorking(scope, document.id); onDirtyChange?.(false); message.info?.('已放弃未保存修改'); };
  const restore = (no: number) => {
    const run = () => {
      const store = useMockDocumentStore.getState();
      store.clearWorking(scope, document.id);
      const created = store.restoreVersion(scope, document.id, no, currentAuthor());
      onDirtyChange?.(false);
      if (created) {
        message.success?.(`已恢复 V${no} 的内容，存为 V${created.no}`);
        setView({ target: created.no, base: created.no - 1 });
      }
    };
    if (dirty) {
      modal.confirm?.({
        title: `恢复到 V${no}？`,
        content: '当前有未保存的修改，恢复后这些修改将被丢弃。之后的版本仍会保留在版本记录中。',
        okText: '丢弃修改并恢复', cancelText: '取消', okButtonProps: { danger: true }, onOk: run,
      });
    } else run();
  };

  // 对比视图里的「上一处 / 下一处」
  const hunks = () => Array.from(compareRef.current?.querySelectorAll<HTMLElement>('.doc-diff-hunk') ?? []);
  const [hunkCount, setHunkCount] = useState(0);
  useEffect(() => { setHunkCount(hunks().length); setHunkIndex(0); }, [view, onlyChanges]);
  const jump = (step: 1 | -1) => {
    const all = hunks();
    if (!all.length) return;
    const next = (hunkIndex + step + all.length) % all.length;
    all.forEach((el, i) => el.classList.toggle('is-current', i === next));
    all[next].scrollIntoView({ block: 'center', behavior: 'smooth' });
    setHunkIndex(next);
  };

  const target = view ? (view.target === 'working' ? working : versionDoc(view.target)) : null;
  const targetVersion = view && view.target !== 'working' ? versions.find(v => v.no === view.target) : undefined;
  const base = view ? versionDoc(view.base) : null;
  const compareStats = target && base ? diffDocuments(base, target) : null;
  const finalNote = latest.final ? `V${latest.no} 已定稿 · 修改将自动保存为新版本，原定稿保留` : null;
  const validWorking = working.title.trim() && working.sections.every(([heading, body]) => heading.trim() && richTextToPlain(body).trim());
  const saveStatus = dirty ? (validWorking ? '有未保存修改 · 等待自动保存' : '请补齐内容后自动保存') : latest.source === 'autosave' ? '已自动保存' : '已保存';

  return <div className="doc-detail-view">
    <DocumentDetailToolbar title={document.title} subtitle={`${categoryName} · ${document.date} · V${latest.no}${latest.final ? ' 定稿' : ''} · ${saveStatus}`} editing dirty={dirty} onBack={onClose} onOpenLibrary={onOpenLibrary}
      onSave={save} onDiscard={discard}
      versionLabel={`V${latest.no}`} versionsOpen={panelOpen}
      onToggleVersions={() => {
        if (reviewOpen) useDocumentReviewStore.getState().showDetails(null);
        setPanelOpen(open => reviewOpen || !open); if (panelOpen) setView(null);
      }} />
    {review && <Tabs className="doc-review-tabs" activeKey={reviewOpen ? 'review' : 'document'} onChange={key => {
      useDocumentReviewStore.getState().showDetails(key === 'review' ? { scope, documentId: document.id } : null);
      setView(null); setPanelOpen(false);
    }} items={[{ key: 'document', label: '正文' }, { key: 'review', label: '检查结果' }]} />}
    {reviewOpen ? null : view && target ? <div className="doc-compare-bar" role="region" aria-label="版本对比">
      <div className="doc-compare-title">
        <GitCompareArrows size={16} aria-hidden />
        {view.base != null ? <>
          <Select
            size="small"
            aria-label="对比基准"
            value={view.base}
            popupMatchSelectWidth={false}
            onChange={(no: number) => setView({ ...view, base: no })}
            options={versions.filter(v => view.target === 'working' || v.no < view.target).map(v => ({ value: v.no, label: `V${v.no}${v.no === 1 ? ' 初稿' : ''}` }))}
          />
          <span className="doc-compare-arrow" aria-hidden>→</span>
        </> : null}
        <strong>{view.target === 'working' ? '当前编辑（未保存）' : `V${view.target}`}</strong>
        {targetVersion && <span className="doc-compare-meta">{authorText(targetVersion.author)}{targetVersion.at ? ` · ${versionTime(targetVersion.at)}` : ''}</span>}
        {view.base == null && <span className="doc-compare-meta">最早的版本，没有可对比的更早版本</span>}
        {compareStats && <span className="doc-compare-stats">
          {compareStats.hunks ? `改了 ${compareStats.hunks} 处` : '无文字改动'}
          {compareStats.added > 0 && <ins>+{compareStats.added}</ins>}
          {compareStats.removed > 0 && <del>−{compareStats.removed}</del>}
        </span>}
      </div>
      <div className="doc-compare-actions">
        {compareStats && <>
          <label className="doc-compare-switch"><Switch size="small" checked={onlyChanges} onChange={setOnlyChanges} />仅看改动</label>
          <span className="doc-compare-nav">
            <Button size="small" type="text" aria-label="上一处改动" icon={<ChevronUp size={16} />} disabled={!hunkCount} onClick={() => jump(-1)} />
            <span>{hunkCount ? `${hunkIndex + 1}/${hunkCount}` : '0/0'}</span>
            <Button size="small" type="text" aria-label="下一处改动" icon={<ChevronDown size={16} />} disabled={!hunkCount} onClick={() => jump(1)} />
          </span>
        </>}
        {targetVersion && targetVersion.no !== latest.no && <Button size="small" icon={<RotateCcw size={14} />} onClick={() => restore(targetVersion.no)}>恢复此版本</Button>}
        {view.target === 'working' && <Button size="small" type="primary" onClick={save}>保存为 V{latest.no + 1}</Button>}
        <Button size="small" type="text" onClick={() => setView(null)}>退出对比</Button>
      </div>
    </div> : <>
      {/* 富文本工具条：命令作用于正文编辑器里当前的选区，见 components/doc/RichTextToolbar.tsx */}
      <RichTextToolbar />
      {dirty && <div className="doc-dirty-note" data-testid="mock-dirty-note">
        {finalNote ?? (validWorking ? '停止输入后自动保存 · 也可点击「保存修改」立即保存' : '请补齐文书标题、章节标题与正文后自动保存')}
        <button type="button" className="doc-dirty-link" onClick={() => { if ((bodyRef.current?.clientWidth ?? 0) > 820) setPanelOpen(true); openVersion('working'); }}>查看改动</button>
      </div>}
    </>}
    <div className="doc-detail-body" ref={bodyRef}>
    {reviewOpen ? <div className="doc-detail-scroll"><DocumentReviewDetails scope={scope} document={working} /></div> : view && target ? <div className="doc-detail-scroll" ref={compareRef}>
      <DocVersionCompare base={base} target={target} onlyChanges={onlyChanges} />
    </div> : <div className="doc-detail-scroll">
      <article className="axn-redhead-paper doc-paper-editing" data-testid="mock-redhead-document">
        {redhead?.platform && <PaperText className="axn-redhead-platform" ariaLabel="平台行" {...paperField('platform', redhead.platform)} />}
        <PaperText className="axn-redhead-org" ariaLabel="发文机关标志" {...paperField('org', redhead?.org ?? REDHEAD_ORG_DEFAULT)} />
        <PaperText className="axn-redhead-type" ariaLabel="文种" {...paperField('type', redhead?.type ?? categoryName)} />
        {redhead?.showNumber !== false && <div className="axn-redhead-no">
          <PaperText as="span" ariaLabel="发文字号" value={working.number} onChange={value => applyWorking({ ...working, number: value })} />
        </div>}
        <div className="axn-redhead-metabar">
          <PaperText as="span" ariaLabel="成文日期" value={working.date} onChange={value => applyWorking({ ...working, date: value })} />
          <PaperText as="span" ariaLabel={redhead?.tail === 'duty' ? '审阅人' : '签发人'} {...paperField('sign', signDefault)} />
        </div>
        <div className="axn-redhead-rule" />
        <input className="doc-edit-title doc-inline-edit" aria-label="文书标题" value={working.title} onChange={event => applyWorking({ ...working, title: event.target.value })} />
        <div className="axn-redhead-body">{working.sections.map(([heading, body], index) => heading === HIDDEN_SECTION ? null : <section key={index}>
          <input className="doc-edit-heading doc-inline-edit" aria-label={`第${index + 1}节标题`} value={heading} onChange={event => sectionChange(index, 0, event.target.value)} /><RichTextEditor ariaLabel={`第${index + 1}节正文`} autoFocus={index === 0} value={body} onChange={next => sectionChange(index, 1, next)} />
        </section>)}</div>
        {/* 正文尾部附图（只有挂了 figures 的样稿才有；用户 m01044 的两张现场照片） */}
        {working.figures?.length ? <div className="axn-redhead-figures" data-testid="mock-document-figures">
          <div className="axn-redhead-figures-label">附：现场处置图片</div>
          {working.figures.map(figure => <figure key={figure.src}>
            <img src={figure.src} alt={figure.caption} />
            <figcaption>{figure.caption}</figcaption>
          </figure>)}
        </div> : null}
        {/* 附件统计表（用户 m01163：周工作动态的附件要模拟出表格）—— 与图片同一个位置：正文之后、落款之前。
            表体不进富文本正文（不能编辑）：它是生成的固定产物，跟正文的可编辑文字分开，避免 execCommand 碰表格。 */}
        {working.tables?.length ? <div className="axn-redhead-tables" data-testid="mock-document-tables">
          {working.tables.map((table, tableIndex) => <section key={table.title} className="axn-redhead-table">
            <div className="axn-redhead-table-title">附件{tableIndex + 1}：{table.title}</div>
            <div className="axn-redhead-table-scroll">
              <table>
                <thead>
                  <tr>{table.head.map((cell, index) => <th key={index}>{cell}</th>)}</tr>
                </thead>
                <tbody>
                  {table.rows.map((row, rowIndex) => <tr key={rowIndex}>
                    {row.group ? <th rowSpan={groupSpan(table.rows, rowIndex)}>{row.group}</th> : null}
                    {row.cells.map((cell, index) => <td key={index}>{cell}</td>)}
                  </tr>)}
                </tbody>
              </table>
            </div>
          </section>)}
        </div> : null}
        {redhead?.tail === 'duty' && <div className="axn-redhead-tail axn-redhead-tail-duty">
          {DUTY_TAIL_FIELDS.map(([label, fallback], index) => <PaperText key={label} as="span" ariaLabel={label} {...paperField(`duty${index + 1}`, fallback)} />)}
        </div>}
        {redhead?.tail === 'brief' && <div className="axn-redhead-tail axn-redhead-tail-brief">
          {BRIEF_TAIL_FIELDS.map(([label, fallback], index) => <PaperText key={label} ariaLabel={label} {...paperField(`brief${index + 1}`, fallback)} />)}
        </div>}
        {redhead?.tail === 'dynamics' && <div className="axn-redhead-tail axn-redhead-tail-dynamics">
          {DYNAMICS_TAIL_FIELDS.map(([label, fallback], index) => <PaperText key={label} ariaLabel={label} {...paperField(`dynamics${index + 1}`, fallback)} />)}
        </div>}
        {redhead?.tail === 'report' && <div className="axn-redhead-tail axn-redhead-tail-report">
          <PaperText className="axn-redhead-sign-org" ariaLabel="落款单位" {...paperField('signOrg', redhead.org ?? REDHEAD_ORG_DEFAULT)} />
          <PaperText className="axn-redhead-sign-date" ariaLabel="落款日期" value={working.date} onChange={value => applyWorking({ ...working, date: value })} />
          <PaperText className="axn-redhead-contact" ariaLabel="联系人" {...paperField('contact', REPORT_CONTACT_DEFAULT)} />
        </div>}
        <PaperText className="axn-redhead-pageno" ariaLabel="页码" {...paperField('pageno', '— 1 —')} />
        <div className="axn-redhead-mock">模拟样稿 · 仅供评估</div>
      </article>
      <div className="doc-reading-footer"><FileText /> {categoryName} · 红头格式<span>{working.sections.reduce((count, [heading, body]) => count + heading.length + richTextToPlain(body).length, working.title.length)} 字</span></div>
    </div>}
    {panelOpen && !reviewOpen && <DocVersionPanel
      versions={versions}
      working={workingDiff}
      selected={view?.target ?? null}
      onSelect={(target) => {
        openVersion(target);
        // 窄工作区里版本栏是浮层，会盖住纸面：选中后收起，让修订标记露出来（工具栏「V#」可再打开）
        if ((bodyRef.current?.clientWidth ?? Infinity) <= 820) setPanelOpen(false);
      }}
      onSetNote={(no, note) => useMockDocumentStore.getState().setVersionNote(scope, document.id, no, note)}
      onToggleFinal={(no) => {
        const wasFinal = versions.find(v => v.no === no)?.final;
        useMockDocumentStore.getState().toggleFinal(scope, document.id, no);
        message.success?.(wasFinal ? `已取消 V${no} 的定稿标记` : `V${no} 已标记为定稿`);
      }}
      onClose={() => { setPanelOpen(false); setView(null); }}
    />}
    </div>
  </div>;
}
