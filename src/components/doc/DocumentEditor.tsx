/**
 * 文书编辑抽屉（T-012）：Tiptap 3 编辑器 + 事实芯片（atomInline）。
 * 段落与 DocumentParagraph 一一对应（按 sections 展平）；保存时序列化回 DocumentContent
 * 并使旧校核失效（invalidateReportForDocument）。全部数据为模拟数据。
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { App as AntdApp, Alert, Button, Drawer, Dropdown, Empty, Space, Tag, Tooltip, Typography, message } from 'antd';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import { Node, mergeAttributes } from '@tiptap/core';
import type { JSONContent } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import { useDocumentStore } from '@/store/documentStore';
import { useDemoStore } from '@/store/demoStore';
import { createRevisionDraftFromSigned } from '@/services/documentFactory';
import { formatFactValue } from '@/services/factLookup';
import { derivedMetaLabel } from '@/services/documentFactory';
import ValidationPanel, { ValidationStatusTag } from './ValidationPanel';
import { type DerivedKey } from '@/seed/derived';
import type {
  SourceSnapshot,
  DocumentContent,
  DocumentDraft,
  DocumentParagraph,
  DocumentSection,
  InlineRun,
} from '@/domain/types';
import './doc.css';

export interface DocumentEditorProps {
  documentId: string;
  open: boolean;
  onClose: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}

const SOURCE_EVENT = 'axn:open-source';
const CONTENT_REPLACED_EVENT = 'axn:doc-content-replaced';

/* ================= Tiptap 自定义节点 ================= */

/** 段落：携带 paraId（与 DocumentParagraph.id 对应）与 role（narrative/fact-line/reference）。 */
const DocParagraph = Node.create({
  name: 'paragraph',
  content: 'inline*',
  group: 'block',
  defining: true,
  addAttributes() {
    return {
      paraId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-para-id'),
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes.paraId === 'string' && attributes.paraId.length > 0
            ? { 'data-para-id': attributes.paraId }
            : {},
      },
      role: {
        default: 'narrative',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-role') ?? 'narrative',
        renderHTML: (attributes: Record<string, unknown>) => ({
          'data-role': typeof attributes.role === 'string' ? attributes.role : 'narrative',
        }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'p' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['p', mergeAttributes(HTMLAttributes), 0];
  },
});

/** 小节标题：携带 sectionId（与 DocumentSection.id 对应），用户不可新建（仅展示）。 */
const SectionTitle = Node.create({
  name: 'sectionTitle',
  content: 'inline*',
  group: 'block',
  defining: true,
  addAttributes() {
    return {
      sectionId: {
        default: null,
        parseHTML: (element: HTMLElement) => element.getAttribute('data-section-id'),
        renderHTML: (attributes: Record<string, unknown>) =>
          typeof attributes.sectionId === 'string' && attributes.sectionId.length > 0
            ? { 'data-section-id': attributes.sectionId }
            : {},
      },
    };
  },
  parseHTML() {
    return [{ tag: 'h3[data-section-id]', priority: 70 }];
  },
  addKeyboardShortcuts() {
    return {
      // 仅在节标题内回车时新起正文段落；其余场景返回 false 走默认行为。
      // 注意：Node 的 keyboardShortcuts 是全局注册的，不加 isActive 守卫会影响全文档回车。
      Enter: () => {
        if (!this.editor.isActive(this.name)) return false;
        return this.editor.chain().splitBlock().setNode('paragraph').run();
      },
    };
  },
  renderHTML({ HTMLAttributes }) {
    return ['h3', mergeAttributes({ class: 'doc-heading' }, HTMLAttributes), 0];
  },
});

/** 事实芯片：atomInline，attr factId；点击事件由容器代理转发给 SourceDrawer。 */
const FactChip = Node.create<{ snapshot: SourceSnapshot | null }>({
  addOptions() {
    return { snapshot: null };
  },
  name: 'factChip',
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      factId: { default: null },
      suffix: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-fact-chip]' }];
  },
  renderHTML({ node }) {
    const factId = typeof node.attrs.factId === 'string' ? node.attrs.factId : '';
    const fact = this.options.snapshot?.facts[factId];
    const missing = !fact;
    const suffix = typeof node.attrs.suffix === 'string' ? node.attrs.suffix : '';
    return [
      'span',
      {
        'data-fact-chip': factId,
        tabindex: '0', role: 'button',
        class: missing ? 'fact-chip fact-chip--missing' : 'fact-chip',
        title: '点击查看数据来源（模拟）',
      },
      `${fact ? formatFactValue(fact.value, fact.unit, fact.sourceFieldKey) : '（来源缺失）'}${suffix}`,
    ];
  },
});

/** 派生值芯片：atomInline，只读展示（不可改写派生公式）。 */
/** 派生值展示缓存：DocumentEditor 挂载时按草稿快照候选集填充（M-1：芯片显示真实数值而非指标名）。 */


const DerivedChip = Node.create<{ snapshot: SourceSnapshot | null }>({
  addOptions() { return { snapshot: null }; },
  name: 'derivedChip',
  inline: true,
  group: 'inline',
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      derivedKey: { default: null },
      suffix: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-derived-chip]' }];
  },
  renderHTML({ node }) {
    const key = typeof node.attrs.derivedKey === 'string' ? node.attrs.derivedKey : '';
    const label = key.length > 0 ? derivedMetaLabel(key as DerivedKey) : '（派生指标）';
    const suffix = typeof node.attrs.suffix === 'string' ? node.attrs.suffix : '';
    const value = key.length > 0 ? this.options.snapshot?.derived[key]?.value : undefined;
    return [
      'span',
      {
        'data-derived-chip': key,
        tabindex: '0', role: 'button',
        class: 'derived-chip',
        title: `${label}（派生指标，由候选力量自动计算）`,
      },
      `${value ?? label}${suffix}`,
    ];
  },
});

/** 知识引用：atomInline，展示知识条目名。 */
const KnowledgeRef = Node.create({
  name: 'knowledgeRef',
  inline: true,
  group: 'inline',
  atom: true,
  addAttributes() {
    return {
      chunkId: { default: null },
      label: { default: null },
    };
  },
  parseHTML() {
    return [{ tag: 'span[data-knowledge-chunk]' }];
  },
  renderHTML({ node }) {
    const label = typeof node.attrs.label === 'string' && node.attrs.label.length > 0 ? node.attrs.label : '知识条目';
    return [
      'span',
      { 'data-knowledge-chunk': String(node.attrs.chunkId ?? ''), class: 'doc-knowledge-ref', title: '知识引用（模拟）' },
      `『${label}』`,
    ];
  },
});

/* ================= 内容转换 ================= */

/** DocumentContent → Tiptap JSON（sections 展平：小节标题节点 + 段落节点）。 */
function contentToEditorJson(content: DocumentContent): JSONContent {
  const nodes: JSONContent[] = [];
  for (const section of content.sections) {
    nodes.push({
      type: 'sectionTitle',
      attrs: { sectionId: section.id },
      content: section.heading.length > 0 ? [{ type: 'text', text: section.heading }] : undefined,
    });
    for (const paragraph of section.paragraphs) {
      const children: JSONContent[] = [];
      for (const run of paragraph.runs) {
        if (run.type === 'text') {
          if (run.text.length > 0) children.push({ type: 'text', text: run.text });
        } else if (run.type === 'fact') {
          children.push({ type: 'factChip', attrs: { factId: run.factId, suffix: run.suffix ?? null } });
        } else if (run.type === 'derived') {
          children.push({ type: 'derivedChip', attrs: { derivedKey: run.derivedKey, suffix: run.suffix ?? null } });
        } else {
          children.push({ type: 'knowledgeRef', attrs: { chunkId: run.chunkId, label: run.label } });
        }
      }
      nodes.push({
        type: 'paragraph',
        attrs: { paraId: paragraph.id, role: paragraph.role },
        content: children.length > 0 ? children : undefined,
      });
    }
  }
  return { type: 'doc', content: nodes };
}

function optionalSuffix(value: unknown): string | undefined {
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

function inlineToRuns(node: JSONContent): InlineRun[] {
  const runs: InlineRun[] = [];
  for (const child of node.content ?? []) {
    if (child.type === 'factChip') {
      const factId = child.attrs?.factId;
      if (typeof factId === 'string' && factId.length > 0) {
        runs.push({ type: 'fact', factId, suffix: optionalSuffix(child.attrs?.suffix) });
      }
    } else if (child.type === 'derivedChip') {
      const key = child.attrs?.derivedKey;
      if (typeof key === 'string' && key.length > 0) {
        runs.push({ type: 'derived', derivedKey: key as DerivedKey, suffix: optionalSuffix(child.attrs?.suffix) });
      }
    } else if (child.type === 'knowledgeRef') {
      const chunkId = child.attrs?.chunkId;
      if (typeof chunkId === 'string' && chunkId.length > 0) {
        const label = child.attrs?.label;
        runs.push({ type: 'knowledge', chunkId, label: typeof label === 'string' && label.length > 0 ? label : chunkId });
      }
    } else if (child.type === 'text') {
      const text = child.text ?? '';
      const prev = runs[runs.length - 1];
      if (prev && prev.type === 'text') {
        prev.text += text;
      } else if (text.length > 0) {
        runs.push({ type: 'text', text });
      }
    }
  }
  return runs;
}

function plainTextOf(node: JSONContent): string {
  return (node.content ?? [])
    .map((child) => (child.type === 'text' ? child.text ?? '' : child.type === 'hardBreak' ? ' ' : ''))
    .join('');
}

/** Tiptap JSON → DocumentContent：原文段落 id 保持稳定；新段落 id 用 p-user-<n> 递增。 */
function editorJsonToContent(json: JSONContent, base: DocumentContent): DocumentContent {
  let userSeq = 0;
  for (const section of base.sections) {
    for (const paragraph of section.paragraphs) {
      const matched = /^p-user-(\d+)$/.exec(paragraph.id);
      if (matched) userSeq = Math.max(userSeq, Number.parseInt(matched[1], 10));
    }
  }
  const seenIds = new Set<string>();
  const sections: DocumentSection[] = [];
  let current: DocumentSection | null = null;
  const ensureSection = (): DocumentSection => {
    if (!current) {
      current = { id: `sec-user-${sections.length + 1}`, heading: '（未分节内容）', paragraphs: [] };
      sections.push(current);
    }
    return current;
  };
  for (const node of json.content ?? []) {
    if (node.type === 'sectionTitle') {
      const rawSectionId = node.attrs?.sectionId;
      current = {
        id: typeof rawSectionId === 'string' && rawSectionId.length > 0 ? rawSectionId : `sec-user-${sections.length + 1}`,
        heading: plainTextOf(node),
        paragraphs: [],
      };
      sections.push(current);
      continue;
    }
    // 兼容：意外出现的普通 heading 节点按正文段落保留，不丢内容
    if (node.type === 'heading') {
      const runs = inlineToRuns(node);
      const section = ensureSection();
      userSeq += 1;
      section.paragraphs.push({
        id: `p-user-${userSeq}`,
        role: 'narrative',
        runs: runs.length > 0 ? runs : [{ type: 'text', text: plainTextOf(node) }],
      });
      continue;
    }
    if (node.type !== 'paragraph') continue;
    const runs = inlineToRuns(node);
    const section = ensureSection();
    const rawId = node.attrs?.paraId;
    let id = typeof rawId === 'string' && rawId.length > 0 ? rawId : `p-user-${userSeq + 1}`;
    if (seenIds.has(id)) {
      userSeq += 1;
      id = `p-user-${userSeq}`;
    }
    if (!/^p-user-/.test(id)) seenIds.add(id);
    userSeq = Math.max(userSeq, Number.parseInt((/^p-user-(\d+)$/.exec(id)?.[1] ?? '0'), 10));
    const rawRole = node.attrs?.role;
    const role: DocumentParagraph['role'] = rawRole === 'fact-line' || rawRole === 'reference' ? rawRole : 'narrative';
    section.paragraphs.push({ id, role, runs: runs.length > 0 ? runs : [{ type: 'text', text: '' }] });
  }
  // 结构自愈：若首个小节标题在编辑往返中丢失（首组为未分节段落且原文档首个小节未被匹配），
  // 将该组段落归还原小节，避免导出/打印出现“（未分节内容）”在前、小节缺失的结构损坏。
  if (
    sections.length > 0 &&
    sections[0].heading === '（未分节内容）' &&
    base.sections.length > 0 &&
    !sections.some((s) => s.id === base.sections[0].id)
  ) {
    sections[0] = { id: base.sections[0].id, heading: base.sections[0].heading, paragraphs: sections[0].paragraphs };
  }
  return {
    title: base.title,
    templateCode: base.templateCode,
    templateVersion: base.templateVersion,
    sections,
    footerNote: base.footerNote,
  };
}

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/* ================= 编辑器实例 ================= */

interface EditorInstanceProps {
  draft: DocumentDraft;
  editable: boolean;
  onDirty: () => void;
  onEditorReady: (editor: Editor | null) => void;
}

function EditorInstance({ draft, editable, onDirty, onEditorReady }: EditorInstanceProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: false, paragraph: false }),
      DocParagraph,
      SectionTitle,
      FactChip.configure({ snapshot: draft.snapshot }),
      DerivedChip.configure({ snapshot: draft.snapshot }),
      KnowledgeRef,
    ],
    content: contentToEditorJson(draft.working.content),
    editable,
    immediatelyRender: false,
    onUpdate: ({ editor }) => {
      useDocumentStore.getState().updateWorkingContent(draft.documentId, editorJsonToContent(editor.getJSON(), useDocumentStore.getState().getDraft(draft.documentId)!.working.content));
      onDirty();
    },
  });

  useEffect(() => {
    onEditorReady(editor);
    return () => onEditorReady(null);
  }, [editor, onEditorReady]);

  useEffect(() => {
    // 权限切换与建议回写后的重挂载不属于用户编辑。
    editor?.setEditable(editable, false);
  }, [editor, editable]);

  return <EditorContent editor={editor} />;
}

/* ================= 编辑抽屉主体 ================= */

interface EditorSurfaceProps {
  draft: DocumentDraft;
  locked: boolean;
  signedVersion: string | null;
  onCloseRequest: () => void;
  onDirtyChange: (dirty: boolean) => void;
  onDiscardReady: (discard: (() => void) | null) => void;
}

function EditorSurface({ draft, locked, signedVersion, onCloseRequest, onDirtyChange, onDiscardReady }: EditorSurfaceProps) {
  const [dirty, setDirty] = useState(false);
  const [nonce, setNonce] = useState(0);
  const [revisionMode, setRevisionMode] = useState(false);
  const editorRef = useRef<Editor | null>(null);
  const savedContent = useRef(draft.working.content);
  const editable = !locked;
  useEffect(() => { onDirtyChange(dirty); }, [dirty, onDirtyChange]);
  useEffect(() => () => onDirtyChange(false), [onDirtyChange]);
  useEffect(() => {
    onDiscardReady(() => {
      const store = useDocumentStore.getState();
      store.updateWorkingContent(draft.documentId, savedContent.current);
      store.invalidateReportForDocument(draft.documentId);
      setDirty(false);
      onDirtyChange(false);
    });
    return () => onDiscardReady(null);
  }, [draft.documentId, onDirtyChange, onDiscardReady]);

  const handleDirty = useCallback(() => setDirty(true), []);
  const handleEditorReady = useCallback((editor: Editor | null) => {
    editorRef.current = editor;
  }, []);

  // 采用建议等外部内容替换后：重挂编辑器同步最新工作副本。
  useEffect(() => {
    const handler = () => {
      savedContent.current = useDocumentStore.getState().getDraft(draft.documentId)!.working.content;
      setDirty(false);
      setNonce((n) => n + 1);
    };
    window.addEventListener(CONTENT_REPLACED_EVENT, handler);
    return () => window.removeEventListener(CONTENT_REPLACED_EVENT, handler);
  }, [draft.documentId]);

  const factItems = useMemo(
    () =>
      Object.values(draft.snapshot.facts).map((fact) => ({
        key: fact.factId,
        label: `${formatFactValue(fact.value, fact.unit, fact.sourceFieldKey)}（${fact.sourceFieldKey}）`,
      })),
    [draft],
  );

  const derivedItems = useMemo(
    () =>
      Object.keys(draft.snapshot.derived).map((key) => ({
        key,
        label: derivedMetaLabel(key as DerivedKey),
      })),
    [draft],
  );

  const insertAtCursor = useCallback(
    (json: JSONContent) => {
      const editor = editorRef.current;
      if (!editor) return;
      editor.chain().focus().insertContent(json).run();
    },
    [],
  );

  const handleInsertFact = useCallback(
    (factId: string) => {
      insertAtCursor({ type: 'factChip', attrs: { factId, suffix: null } });
    },
    [insertAtCursor],
  );

  const handleInsertDerived = useCallback(
    (key: string) => {
      insertAtCursor({ type: 'derivedChip', attrs: { derivedKey: key, suffix: null } });
    },
    [insertAtCursor],
  );

  const handleBodyClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;
    const chip = target.closest('[data-fact-chip], [data-derived-chip]');
    if (chip instanceof HTMLElement) {
      const factId = chip.getAttribute('data-fact-chip') ?? `derived:${chip.getAttribute('data-derived-chip')}`;
      if (factId) window.dispatchEvent(new CustomEvent(SOURCE_EVENT, { detail: { factId, documentId: draft.documentId } }));
    }
  };

  const handleSave = () => {
    const editor = editorRef.current;
    if (!editor || locked) return;
    const content = editorJsonToContent(editor.getJSON(), draft.working.content);
    const store = useDocumentStore.getState();
    const actor = useDemoStore.getState().getActor();
    // 审查 M-2：已签发文书的“修订后保存”不写回原稿，而是基于修改内容创建修订草稿（major+1，新草稿）。
    if (draft.lifecycle === 'signed' && revisionMode) {
      try {
        const newDraft = createRevisionDraftFromSigned({ documentId: draft.documentId, content, actorName: actor.name });
        setDirty(false);
        onDirtyChange(false);
        setRevisionMode(false);
        message.success(`已基于已签发版本创建修订草稿（${newDraft.title}），请在文书中心继续编辑；原版本保持锁定`);
        window.dispatchEvent(new CustomEvent('axn:doc-open', { detail: { documentId: newDraft.documentId } }));
        onCloseRequest();
      } catch (err) {
        message.error(err instanceof Error ? err.message : '修订创建失败（模拟）');
      }
      return;
    }
    store.updateWorkingContent(draft.documentId, content);
    savedContent.current = content;
    store.invalidateReportForDocument(draft.documentId);
    const currentRev = draft.activeRevisionId ? store.getRevision(draft.activeRevisionId) : undefined;
    store.addAudit({
      action: '编辑正文',
      actor: actor.name,
      objectId: draft.documentId,
      version: currentRev?.displayVersion ?? null,
      performedAt: new Date().toISOString(),
      demoClockAt: useDemoStore.getState().demoClock,
      detail: '工作副本更新，原校核结果失效',
    });
    setDirty(false);
    onDirtyChange(false);
    message.success('工作副本已保存（模拟）；原校核结果已失效，请重新校核');
  };

  return (
    <div className="doc-editor-surface">
      {draft.lifecycle === 'signed' && !revisionMode && (
        <Alert
          style={{ marginBottom: 12 }}
          type="warning"
          showIcon
          title={`该文书已签发锁定（${signedVersion ?? '已签发版本'}）`}
          description="已签发版本不可再编辑、不可覆盖。点击「开始修订」后可在新的工作副本上修改，保存版本时将生成新版本号（V*.*），不会覆盖已签发快照。"
          action={
            <Button size="small" onClick={() => { createRevisionDraftFromSigned({ documentId: draft.documentId, content: draft.working.content, actorName: useDemoStore.getState().getActor().name }); setRevisionMode(false); setNonce(n => n + 1); }}>
              开始修订
            </Button>
          }
        />
      )}
      <div style={{ marginBottom: 8 }}>
        <Space wrap size={[8, 4]}>
          <Tag color="geekblue">{draft.templateCode === 'EMERGENCY_BRIEF' ? '应急要情' : '值班日报'}</Tag>
          <ValidationStatusTag status={draft.validation.status} />
          {draft.freshness === 'stale' && (
            <Tooltip title="来源快照已过期（数据已更新），保存版本前建议关注校核提示 R-009">
              <Tag color="orange">数据过期</Tag>
            </Tooltip>
          )}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            来源快照：{draft.snapshot.label} · {fmtTime(draft.snapshot.takenAt)}（模拟）
          </Typography.Text>
        </Space>
      </div>

      <div style={{ marginBottom: 8 }}>
        <Space wrap>
          <Dropdown
            menu={{
              items: factItems,
              onClick: ({ key }) => handleInsertFact(key),
              selectable: false,
            }}
            disabled={factItems.length === 0}
          >
            <Button size="small">插入事实芯片</Button>
          </Dropdown>
          <Dropdown
            menu={{
              items: derivedItems,
              onClick: ({ key }) => handleInsertDerived(key),
              selectable: false,
            }}
            disabled={derivedItems.length === 0}
          >
            <Button size="small">插入派生值</Button>
          </Dropdown>
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            点击正文中的蓝色数据芯片可查看来源
          </Typography.Text>
        </Space>
      </div>

      <div className={locked && !revisionMode ? 'doc-editor-shell doc-editor-readonly' : 'doc-editor-shell'}>
        <div className="doc-editor-scroll" onClick={handleBodyClick} onKeyDown={event => {
          if ((event.key === 'Enter' || event.key === ' ') && event.target instanceof HTMLElement && event.target.matches('[data-fact-chip], [data-derived-chip]')) {
            event.preventDefault(); event.target.click();
          }
        }}>
          <EditorInstance
            key={`${draft.documentId}:${draft.snapshot.snapshotId}:${nonce}`}
            draft={draft}
            editable={editable}
            onDirty={handleDirty}
            onEditorReady={handleEditorReady}
          />
        </div>
      </div>

      <div className="doc-editor-footer">
        <Space wrap>
          <Button type="primary" disabled={!dirty || !editable} onClick={handleSave}>
            保存工作副本
          </Button>
          {dirty && <Tag color="blue">有未保存修改</Tag>}
          <ValidationStatusTag status={draft.validation.status} />
          {!editable && <Tag color="red">已锁定</Tag>}
          <Typography.Text type="secondary" style={{ fontSize: 12 }}>
            模拟数据 · 编辑后旧校核立即失效，需重新校核才能提交
          </Typography.Text>
        </Space>
      </div>

      <ValidationPanel documentId={draft.documentId} />
    </div>
  );
}

/* ================= 对外组件 ================= */

export default function DocumentEditor({ documentId, open, onClose, onDirtyChange }: DocumentEditorProps) {
  const { modal } = AntdApp.useApp();
  const dirty = useRef(false);
  const discard = useRef<(() => void) | null>(null);
  const reportDiscard = useCallback((handler: (() => void) | null) => { discard.current = handler; }, []);
  const reportDirty = useCallback((value: boolean) => {
    dirty.current = value;
    onDirtyChange?.(value);
  }, [onDirtyChange]);
  const requestClose = () => {
    if (!dirty.current) { onClose(); return; }
    modal.confirm({
      title: '有未保存的文书修改', content: '关闭后将放弃未保存的工作副本修改。',
      okText: '放弃修改并关闭', cancelText: '继续编辑', okButtonProps: { danger: true },
      onOk: () => { discard.current?.(); reportDirty(false); onClose(); },
    });
  };
  const draft = useDocumentStore((s) => s.drafts[documentId]);
  const revisionsMap = useDocumentStore((s) => s.revisions);

  const signedRevision = useMemo(
    () =>
      Object.values(revisionsMap).find(
        (rev) => rev.documentId === documentId && rev.signedRecord !== null,
      ) ?? null,
    [revisionsMap, documentId],
  );

  const locked =
    !draft ||
    draft.lifecycle === 'archived' ||
    draft.lifecycle === 'signed';

  return (
    <Drawer
      title={draft ? `编辑文书 · ${draft.title}` : '编辑文书'}
      width={880}
      open={open}
      onClose={requestClose}
      destroyOnHidden
    >
      {draft ? (
        <EditorSurface
          key={draft.documentId}
          draft={draft}
          locked={locked}
          signedVersion={signedRevision?.displayVersion ?? null}
          onCloseRequest={requestClose}
          onDirtyChange={reportDirty}
          onDiscardReady={reportDiscard}
        />
      ) : (
        <Empty description="文书不存在或模拟数据已重置" />
      )}
    </Drawer>
  );
}
