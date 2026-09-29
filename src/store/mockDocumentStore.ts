import { create } from 'zustand';
import type { ChatMessage } from '@/domain/types';
import { DOCUMENT_CATEGORIES, MOCK_DOCUMENTS, type MockDocument } from '@/seed/mockDocuments';

type GenerationOptions = { elements: NonNullable<ChatMessage['documentWorkflow']>['elements']; onStage: (stage: 'calling' | 'generating') => void };
type Library = { documents: MockDocument[]; selected: MockDocument | null; generatingCode: string | null };
export const EMPTY_LIBRARY: Library = { documents: MOCK_DOCUMENTS, selected: null, generatingCode: null };
interface MockDocumentState {
  libraries: Record<string, Library>;
  select: (scope: string, document: MockDocument | null) => void;
  generate: (scope: string, code: string, options?: GenerationOptions) => Promise<MockDocument | null>;
}

/** 分类按钮与对话快捷操作共用；每个会话单独保存模拟文书与生成状态。 */
export const useMockDocumentStore = create<MockDocumentState>((set, get) => ({
  libraries: {},
  select: (scope, document) => set(state => ({ libraries: {
    ...state.libraries, [scope]: { ...(state.libraries[scope] ?? EMPTY_LIBRARY), selected: document },
  } })),
  generate: async (scope, code, options) => {
    const category = DOCUMENT_CATEGORIES.find(item => item.code === code);
    if (!category || get().libraries[scope]?.generatingCode) return null;
    set(state => ({ libraries: { ...state.libraries, [scope]: {
      ...(state.libraries[scope] ?? EMPTY_LIBRARY), selected: null, generatingCode: code,
    } } }));
    if (options) {
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
      number: `${category.prefix}〔${now.getFullYear()}〕模拟草稿`, sections: category.sections,
    };
    set(state => ({ libraries: { ...state.libraries, [scope]: {
      documents: [document, ...(state.libraries[scope] ?? EMPTY_LIBRARY).documents],
      selected: document, generatingCode: null,
    } } }));
    return document;
  },
}));
