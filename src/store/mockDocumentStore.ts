import { useSessionStore } from './sessionStore';
import { create } from 'zustand';
import { withReviewDemoIssues } from '@/services/documentReviewScenario';
import type { ChatMessage } from '@/domain/types';
import { resolveDocumentSections, resolveDocumentTitle } from '@/seed/resolveDocumentSections';
import { DOCUMENT_CATEGORIES, MOCK_DOCUMENTS, sameMockDocument, type MockDocument } from '@/seed/mockDocuments';
import { diffDocuments, summarizeDiff } from '@/services/docDiff';
import { clearPersist, loadPersist, schedulePersist } from './persistence.js';
import { useDocumentReviewStore } from './documentReviewStore';

type GenerationOptions = {
  title?: string;
  collect?: () => Promise<void | false>;
  /** 逐条上报「已收齐第几条要素」，驱动气泡里的收集动画（用户 m01044）。
   *  没有自定义 collect 的文书（值班日报/应急要情）由 generate 按 elements 逐条吐。 */
  onCollected?: (count: number) => void;
  sections?: MockDocument['sections'];
  elements: NonNullable<ChatMessage['documentWorkflow']>['elements'];
  onStage: (stage: 'calling' | 'generating') => void;
};
/** 要素收集的节拍：每条 420ms，6 条约 2.5s —— 短到不拖生成，长到看得见进度在走。 */
export const COLLECT_STEP_MS = 420;
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/* ========== 版本 ========== */

/** 版本作者：安小能（生成 / 按指令修改）、系统样稿、或某位用户（带角色）。 */
export type VersionAuthor = { kind: 'ai' } | { kind: 'sample' } | { kind: 'user'; name: string; role: string };
export type VersionSource = 'sample' | 'generated' | 'edit' | 'restore' | 'autosave';
export type DocVersion = {
  no: number;
  /** ISO 时间；样稿 V1 没有保存时刻 */
  at?: string;
  author: VersionAuthor;
  source: VersionSource;
  snapshot: MockDocument;
  /** 用户选填的修改说明 */
  note?: string;
  restoredFrom?: number;
  final?: boolean;
  /** 相对上一版的变化（V1 为 null） */
  stats: { hunks: number; added: number; removed: number; summary: string } | null;
};
export type SaveMeta = { author: VersionAuthor; note?: string; source?: 'edit' | 'restore' | 'autosave'; restoredFrom?: number };
/** 每份公文最多保留的版本数（V1 初稿永远保留，其余保留最近的）。 */
export const MAX_VERSIONS = 20;

/** 还没有任何保存记录的文书：以它当前（已保存）的内容作为 V1。 */
export function baselineVersion(document: MockDocument): DocVersion {
  const generated = document.id.startsWith('generated-');
  const stamp = generated ? Number(document.id.split('-').pop()) : NaN;
  return {
    no: 1,
    at: Number.isFinite(stamp) ? new Date(stamp).toISOString() : undefined,
    author: generated ? { kind: 'ai' } : { kind: 'sample' },
    source: generated ? 'generated' : 'sample',
    snapshot: document,
    stats: null,
  };
}

/** 编辑中的工作副本（未保存）按文档 id 存放，离开详情页也不丢；保存或放弃才清除。
 *  versions：按文档 id 的版本历史（升序）；缺省表示只有 V1（= 文书库里的那份）。 */
type Library = {
  documents: MockDocument[]; selected: MockDocument | null; generatingCode: string | null;
  working: Record<string, MockDocument>; versions: Record<string, DocVersion[]>;
};
export const EMPTY_LIBRARY: Library = { documents: MOCK_DOCUMENTS, selected: null, generatingCode: null, working: {}, versions: {} };

/** 某文书的版本历史（至少一条 V1）。 */
export function versionsOf(library: Library | undefined, document: MockDocument): DocVersion[] {
  const stored = library?.versions?.[document.id];
  if (stored?.length) return stored;
  const saved = library?.documents.find(item => item.id === document.id) ?? document;
  return [baselineVersion(saved)];
}

function appendVersion(history: DocVersion[], document: MockDocument, meta: SaveMeta): DocVersion[] {
  const last = history[history.length - 1];
  const diff = diffDocuments(last.snapshot, document);
  const next: DocVersion = {
    no: last.no + 1,
    at: new Date().toISOString(),
    author: meta.author,
    source: meta.source ?? 'edit',
    snapshot: document,
    note: meta.note?.trim() || undefined,
    restoredFrom: meta.restoredFrom,
    stats: { hunks: diff.hunks, added: diff.added, removed: diff.removed, summary: summarizeDiff(diff) },
  };
  const all = [...history, next];
  return all.length > MAX_VERSIONS ? [all[0], ...all.slice(all.length - MAX_VERSIONS + 1)] : all;
}

interface MockDocumentState {
  libraries: Record<string, Library>;
  select: (scope: string, document: MockDocument | null) => void;
  /** 保存：写回文书库，并在内容有变化时追加一个新版本。 */
  update: (scope: string, document: MockDocument, meta?: SaveMeta) => void;
  /** 把历史版本 no 的内容恢复为一个新版本（不删除其后的版本）。 */
  restoreVersion: (scope: string, documentId: string, no: number, author: VersionAuthor) => DocVersion | null;
  setVersionNote: (scope: string, documentId: string, no: number, note: string) => void;
  toggleFinal: (scope: string, documentId: string, no: number) => void;
  reset: () => void;
  setWorking: (scope: string, document: MockDocument) => void;
  clearWorking: (scope: string, documentId: string) => void;
  generate: (scope: string, code: string, options?: GenerationOptions) => Promise<MockDocument | null>;
  /** 四智能体材料：写入文书库并选中，供右侧工作区与「查看文书」复用。 */
  publishAgentMaterial: (scope: string, input: {
    code: string;
    title: string;
    sections: MockDocument['sections'];
  }) => MockDocument | null;
}

/** 分类按钮与对话快捷操作共用；每个会话单独保存模拟文书与生成状态。 */
export const useMockDocumentStore = create<MockDocumentState>((set, get) => ({
  libraries: restoreLibraries(),
  select: (scope, document) => set(state => ({ libraries: {
    ...state.libraries, [scope]: { ...(state.libraries[scope] ?? EMPTY_LIBRARY), selected: document },
  } })),
  update: (scope, document, meta) => {
    useDocumentReviewStore.getState().invalidate(scope, document);
    set(state => {
      const library = state.libraries[scope] ?? EMPTY_LIBRARY;
      const { [document.id]: _saved, ...working } = library.working;
      const history = versionsOf(library, document);
      const last = history[history.length - 1];
      const saveMeta = meta ?? { author: { kind: 'user' as const, name: '值班员', role: '值班员' } };
      const unchanged = sameMockDocument(last.snapshot, document) && meta?.source !== 'restore';
      // 自动保存只更新最近的自动版本；手动保存或定稿后，下一轮另起一版。
      const sealAutoVersion = unchanged && last.source === 'autosave' && saveMeta.source !== 'autosave';
      const coalesce = saveMeta.source === 'autosave' && last.source === 'autosave' && !last.final && !last.note
        && last.author.kind === 'user' && saveMeta.author.kind === 'user'
        && last.author.name === saveMeta.author.name && last.author.role === saveMeta.author.role;
      const versions = unchanged && !sealAutoVersion ? library.versions : {
        ...library.versions,
        [document.id]: sealAutoVersion
          ? history.map(v => v.no === last.no ? { ...v, source: 'edit' as const, author: saveMeta.author } : v)
          : appendVersion(coalesce ? history.slice(0, -1) : history, document, saveMeta),
      };
      return { libraries: { ...state.libraries, [scope]: {
        ...library, documents: library.documents.map(item => item.id === document.id ? document : item),
        selected: document, working, versions,
      } } };
    });
  },
  restoreVersion: (scope, documentId, no, author) => {
    const library = get().libraries[scope] ?? EMPTY_LIBRARY;
    const current = library.documents.find(item => item.id === documentId);
    if (!current) return null;
    const target = versionsOf(library, current).find(v => v.no === no);
    if (!target) return null;
    get().update(scope, target.snapshot, { author, source: 'restore', restoredFrom: no });
    const history = get().libraries[scope]?.versions[documentId] ?? [];
    return history[history.length - 1] ?? null;
  },
  setVersionNote: (scope, documentId, no, note) => set(state => {
    const library = state.libraries[scope];
    const history = library?.versions[documentId];
    if (!library || !history) return state;
    return { libraries: { ...state.libraries, [scope]: { ...library, versions: {
      ...library.versions, [documentId]: history.map(v => v.no === no ? { ...v, note: note.trim() || undefined } : v),
    } } } };
  }),
  toggleFinal: (scope, documentId, no) => set(state => {
    const library = state.libraries[scope] ?? EMPTY_LIBRARY;
    const current = library.documents.find(item => item.id === documentId);
    if (!current) return state;
    // 只有 V1 时也要落一份历史，定稿标记才有地方挂
    const history = versionsOf(library, current);
    return { libraries: { ...state.libraries, [scope]: { ...library, versions: {
      ...library.versions, [documentId]: history.map(v => v.no === no ? { ...v, final: !v.final } : v),
    } } } };
  }),
  reset: () => { clearPersist('mockdoc'); useDocumentReviewStore.getState().reset(); set({ libraries: {} }); },
  setWorking: (scope, document) => {
    useDocumentReviewStore.getState().invalidate(scope, document);
    set(state => {
      const library = state.libraries[scope] ?? EMPTY_LIBRARY;
      return { libraries: { ...state.libraries, [scope]: { ...library, working: { ...library.working, [document.id]: document } } } };
    });
  },
  clearWorking: (scope, documentId) => set(state => {
    const library = state.libraries[scope];
    if (!library?.working[documentId]) return state;
    const { [documentId]: _discarded, ...working } = library.working;
    return { libraries: { ...state.libraries, [scope]: { ...library, working } } };
  }),
  generate: async (scope, code, options) => {
    const category = DOCUMENT_CATEGORIES.find(item => item.code === code);
    if (!category || get().libraries[scope]?.generatingCode) return null;
    set(state => ({ libraries: { ...state.libraries, [scope]: {
      ...(state.libraries[scope] ?? EMPTY_LIBRARY), selected: null, generatingCode: code,
    } } }));
    try {
    if (options) {
      if (options.collect) {
        if (await options.collect() === false) {
          set(state => ({ libraries: { ...state.libraries, [scope]: { ...state.libraries[scope], generatingCode: null } } }));
          return null;
        }
      } else {
        // 没有自定义收集流程的文书（值班日报/应急要情）：按要素逐条推进。
        // 原来这里只有一段 700ms 死等，气泡里的「收集」看不见任何过程（用户 m01044 要的动画）。
        for (let count = 1; count <= options.elements.length; count += 1) {
          await sleep(COLLECT_STEP_MS);
          options.onCollected?.(count);
        }
      }
      await sleep(700);
      options.onStage('calling');
      await sleep(700);
      options.onStage('generating');
    }
    await sleep(1200);
    const now = new Date();
    // 正文尾部附图与附件表体都按文种挂（不随上传件变）：从同文种的样稿上取。
    const sample = MOCK_DOCUMENTS.find(item => item.code === code);
    const eventId = useSessionStore.getState().sessions[scope]?.eventId ?? '';
    const document: MockDocument = withReviewDemoIssues({
      id: `generated-${code}-${now.getTime()}`, code,
      title: options?.title ?? resolveDocumentTitle(eventId, category.name, category.topics[0]),
      date: now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
      number: `${category.prefix}〔${now.getFullYear()}〕模拟草稿`, sections: options?.sections ?? (code === 'WEEKLY_DYNAMICS' ? category.sections : resolveDocumentSections(eventId, code)),
      figures: sample?.figures,
      tables: sample?.tables,
    });
    set(state => ({ libraries: { ...state.libraries, [scope]: {
      ...(state.libraries[scope] ?? EMPTY_LIBRARY),
      documents: [document, ...(state.libraries[scope] ?? EMPTY_LIBRARY).documents],
      selected: document, generatingCode: null,
      versions: { ...(state.libraries[scope] ?? EMPTY_LIBRARY).versions, [document.id]: [baselineVersion(document)] },
    } } }));
    useDocumentReviewStore.getState().start(scope, document);
    return document;
    } finally {
      // collect、阶段回调或正文生成失败时，也必须释放生成锁。
      if (get().libraries[scope]?.generatingCode === code) {
        set(state => ({ libraries: { ...state.libraries, [scope]: { ...state.libraries[scope], generatingCode: null } } }));
      }
    }
  },
  publishAgentMaterial: (scope, input) => {
    const category = DOCUMENT_CATEGORIES.find((item) => item.code === input.code);
    if (!category) return null;
    const now = new Date();
    const document: MockDocument = {
      id: `agent-${input.code}-${crypto.randomUUID()}`,
      code: input.code,
      title: input.title,
      date: now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
      number: `${category.prefix}〔${now.getFullYear()}〕模拟草稿`,
      sections: input.sections,
    };
    set((state) => ({
      libraries: {
        ...state.libraries,
        [scope]: {
          ...(state.libraries[scope] ?? EMPTY_LIBRARY),
          documents: [document, ...(state.libraries[scope] ?? EMPTY_LIBRARY).documents],
          selected: document,
          generatingCode: null,
        },
      },
    }));
    return document;
  },
}));

/* ========== 持久化（anneng-demo:v1:mockdoc）：文书、工作副本与版本历史刷新不丢 ========== */

type MockDocPersist = { libraries: Record<string, Library> };

function restoreLibraries(): Record<string, Library> {
  const persisted = loadPersist<MockDocPersist>('mockdoc');
  if (!persisted?.libraries || typeof persisted.libraries !== 'object') return {};
  return Object.fromEntries(Object.entries(persisted.libraries).map(([scope, library]) => [scope, {
    ...EMPTY_LIBRARY, ...library,
    // 选中项 / 生成中状态属于界面瞬时态，不跨刷新恢复（生成流程刷新后无法继续）
    selected: null, generatingCode: null,
    working: library.working ?? {}, versions: library.versions ?? {},
  }]));
}

useMockDocumentStore.subscribe((state) => {
  schedulePersist('mockdoc', { libraries: state.libraries } satisfies MockDocPersist);
});
