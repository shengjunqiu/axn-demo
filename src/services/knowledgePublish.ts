/**
 * 事件案例知识沉淀（本地模拟）：评估/总结/流程审批共用，不接真实知识库 API。
 */
import { create } from 'zustand';
import { clearPersist, loadPersist, schedulePersist } from '@/store/persistence';
import { eventDisplayName } from '@/services/factLookup';

export type KnowledgeCaseSource = 'evaluation' | 'summary' | 'flow' | 'precipitation';
export type KnowledgeCaseStatus = '待审' | '已入库（模拟）';

export type PublishedEventCase = {
  id: string;
  eventId: string;
  title: string;
  body: string;
  source: KnowledgeCaseSource;
  status: KnowledgeCaseStatus;
  tags: string[];
  updatedAt: string;
};

type KnowledgeCaseState = {
  cases: PublishedEventCase[];
  publishEventCase: (input: {
    eventId: string;
    title?: string;
    body: string;
    source: KnowledgeCaseSource;
    tags?: string[];
    status?: KnowledgeCaseStatus;
  }) => PublishedEventCase;
  approveCase: (id: string) => void;
  casesForEvent: (eventId: string) => PublishedEventCase[];
  pendingBodyForEvent: (eventId: string) => string | null;
  resetAll: () => void;
};

const persisted = loadPersist<{ cases: PublishedEventCase[] }>('knowledgeCases');

export const useKnowledgeCaseStore = create<KnowledgeCaseState>()((set, get) => ({
  cases: persisted?.cases ?? [],

  publishEventCase: (input) => {
    const now = new Date().toISOString();
    const title = input.title ?? `${eventDisplayName(input.eventId)} · 事件案例候选`;
    const existing = get().cases.find(
      (c) => c.eventId === input.eventId && c.source === input.source && c.status === '待审',
    );
    const next: PublishedEventCase = existing
      ? {
          ...existing,
          title,
          body: input.body,
          tags: input.tags ?? existing.tags,
          status: input.status ?? existing.status,
          updatedAt: now,
        }
      : {
          id: `case-${input.eventId}-${input.source}-${Date.now().toString(36)}`,
          eventId: input.eventId,
          title,
          body: input.body,
          source: input.source,
          status: input.status ?? '待审',
          tags: input.tags ?? ['复盘', '演练参考'],
          updatedAt: now,
        };
    set((s) => ({
      cases: existing
        ? s.cases.map((c) => (c.id === existing.id ? next : c))
        : [next, ...s.cases],
    }));
    return next;
  },

  approveCase: (id) => {
    set((s) => ({
      cases: s.cases.map((c) =>
        (c.id === id
          ? { ...c, status: '已入库（模拟）' as const, updatedAt: new Date().toISOString() }
          : c)),
    }));
  },

  casesForEvent: (eventId) => get().cases.filter((c) => c.eventId === eventId),

  pendingBodyForEvent: (eventId) => {
    const pending = get().cases.find((c) => c.eventId === eventId && c.status === '待审');
    return pending?.body ?? null;
  },

  resetAll: () => {
    clearPersist('knowledgeCases');
    set({ cases: [] });
  },
}));

useKnowledgeCaseStore.subscribe((state) => {
  schedulePersist('knowledgeCases', { cases: state.cases });
});
