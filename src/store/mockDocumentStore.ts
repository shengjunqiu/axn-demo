import { create } from 'zustand';
import type { ChatMessage } from '@/domain/types';
import { DOCUMENT_CATEGORIES, MOCK_DOCUMENTS, type MockDocument } from '@/seed/mockDocuments';

type GenerationOptions = { collect?: () => Promise<void | false>; sections?: MockDocument['sections']; elements: NonNullable<ChatMessage['documentWorkflow']>['elements']; onStage: (stage: 'calling' | 'generating') => void };
/** 编辑中的工作副本（未保存）按文档 id 存放，离开详情页也不丢；保存或放弃才清除。 */
type Library = { documents: MockDocument[]; selected: MockDocument | null; generatingCode: string | null; working: Record<string, MockDocument> };
export const EMPTY_LIBRARY: Library = { documents: MOCK_DOCUMENTS, selected: null, generatingCode: null, working: {} };
interface MockDocumentState {
  libraries: Record<string, Library>;
  select: (scope: string, document: MockDocument | null) => void;
  update: (scope: string, document: MockDocument) => void;
  setWorking: (scope: string, document: MockDocument) => void;
  clearWorking: (scope: string, documentId: string) => void;
  generate: (scope: string, code: string, options?: GenerationOptions) => Promise<MockDocument | null>;
}

/** 分类按钮与对话快捷操作共用；每个会话单独保存模拟文书与生成状态。 */
export const useMockDocumentStore = create<MockDocumentState>((set, get) => ({
  libraries: {},
  select: (scope, document) => set(state => ({ libraries: {
    ...state.libraries, [scope]: { ...(state.libraries[scope] ?? EMPTY_LIBRARY), selected: document },
  } })),
  update: (scope, document) => set(state => {
    const library = state.libraries[scope] ?? EMPTY_LIBRARY;
    const { [document.id]: _saved, ...working } = library.working;
    return { libraries: { ...state.libraries, [scope]: {
      ...library, documents: library.documents.map(item => item.id === document.id ? document : item),
      selected: document, working,
    } } };
  }),
  setWorking: (scope, document) => set(state => {
    const library = state.libraries[scope] ?? EMPTY_LIBRARY;
    return { libraries: { ...state.libraries, [scope]: { ...library, working: { ...library.working, [document.id]: document } } } };
  }),
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
    if (options) {
      if (await options.collect?.() === false) {
        set(state => ({ libraries: { ...state.libraries, [scope]: { ...state.libraries[scope], generatingCode: null } } }));
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 700));
      options.onStage('calling');
      await new Promise(resolve => setTimeout(resolve, 700));
      options.onStage('generating');
    }
    await new Promise(resolve => setTimeout(resolve, 1200));
    const now = new Date();
    const document: MockDocument = {
      id: `generated-${code}-${now.getTime()}`, code,
      title: `${category.topics[0]}（新生成）`,
      date: now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
      number: `${category.prefix}〔${now.getFullYear()}〕模拟草稿`, sections: options?.sections ?? category.sections,
    };
    set(state => ({ libraries: { ...state.libraries, [scope]: {
      ...(state.libraries[scope] ?? EMPTY_LIBRARY),
      documents: [document, ...(state.libraries[scope] ?? EMPTY_LIBRARY).documents],
      selected: document, generatingCode: null,
    } } }));
    return document;
  },
}));
