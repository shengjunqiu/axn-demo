/**
 * Conversation Store（全局导航 · 对话历史管理）。
 *
 * 设计决策：
 * - Conversation 是"交互上下文"（导航/历史/收藏），Event 是"业务对象"。
 *   消息、候选资源、文书、任务等业务数据仍挂在 session（按 Event 隔离）上，
 *   切换 Conversation = 切换到其 eventId 对应的事件与 session，不另建第二套数据。
 * - 一个 Event 可对应多个 Conversation（eventId 可选；general 类型会话可不绑事件）。
 * - 持久化复用 persistence.ts（anneng-demo:v1:conversation），刷新后恢复历史与 active。
 * - 种子会话由 seedConversationRows 生成（全部为虚构演示数据）。
 */
import { create } from 'zustand';
import type { Conversation, ConversationSettings, NavPage } from '@/domain/types';
import { clearPersist, loadPersist, savePersist } from './persistence';
import { useDemoStore } from './demoStore';
import { useSessionStore } from './sessionStore';
import { DEMO_CLOCK } from '@/seed/scenario';

interface ConversationPersist {
  conversations: Record<string, Conversation>;
  activeConversationId: string | null;
  collapsed: boolean;
  settings: ConversationSettings;
}

const persisted = loadPersist<ConversationPersist>('conversation');

let conversationSeq = 0;
function nextConversationId(): string {
  conversationSeq += 1;
  return `conv-${Date.now().toString(36)}-${conversationSeq}`;
}

export const DEFAULT_SETTINGS: ConversationSettings = {
  openRecentOnStart: true,
  notifyTaskDone: true,
  notifyDocReady: false,
  demoMode: true,
};

export interface ConversationSeedRow {
  id: string;
  title: string;
  type: Conversation['type'];
  eventId?: string;
  summary?: string;
  status: Conversation['status'];
  createdAt: string;
  updatedAt: string;
  favorite?: boolean;
}

/**
 * 种子历史会话（演示数据，时间相对演示时钟 2026-09-28 21:10 展开）。
 * 分组：今天（09-28）/ 昨天（09-27）/ 更早（09-20）。
 */
export const seedConversationRows: ConversationSeedRow[] = [
  {
    id: 'conv-seed-nandi',
    title: '南堤堤防管涌险情',
    type: 'emergency',
    eventId: 'evt-demo-001',
    summary: '研判任务进行中',
    status: 'processing',
    createdAt: '2026-09-28T10:24:00+08:00',
    updatedAt: '2026-09-28T10:24:00+08:00',
  },
  {
    id: 'conv-seed-zhanghe',
    title: '漳河镇水位上涨预警',
    type: 'emergency',
    eventId: 'evt-demo-002',
    summary: '预警信息整理',
    status: 'processing',
    createdAt: '2026-09-28T09:56:00+08:00',
    updatedAt: '2026-09-28T09:56:00+08:00',
  },
  {
    id: 'conv-seed-g5f13',
    title: 'G5F13边坡滑坡事件',
    type: 'general',
    eventId: 'evt-demo-001',
    summary: '动态跟踪中',
    status: 'active',
    createdAt: '2026-09-28T09:31:00+08:00',
    updatedAt: '2026-09-28T09:31:00+08:00',
    favorite: true,
  },
  {
    id: 'conv-seed-daily-draft',
    title: '值班日报整理',
    type: 'daily',
    eventId: 'evt-demo-001',
    summary: '今日交接班信息收集中',
    status: 'draft',
    createdAt: '2026-09-28T08:40:00+08:00',
    updatedAt: '2026-09-28T08:40:00+08:00',
  },
  {
    id: 'conv-seed-dispatch',
    title: '防汛资源调度',
    type: 'resource',
    eventId: 'evt-demo-001',
    summary: '投送建议已生成',
    status: 'completed',
    createdAt: '2026-09-27T16:40:00+08:00',
    updatedAt: '2026-09-27T17:05:00+08:00',
  },
  {
    id: 'conv-seed-0920-brief',
    title: '9月20日值班要情',
    type: 'daily',
    eventId: 'evt-demo-001',
    summary: '要情第4稿已归档',
    status: 'completed',
    createdAt: '2026-09-20T18:00:00+08:00',
    updatedAt: '2026-09-20T19:20:00+08:00',
  },
];

function buildSeedMap(): Record<string, Conversation> {
  const map: Record<string, Conversation> = {};
  for (const row of seedConversationRows) {
    map[row.id] = { ...row };
  }
  return map;
}

export interface CreateConversationInput {
  title: string;
  type: Conversation['type'];
  eventId?: string;
  summary?: string;
  status?: Conversation['status'];
}

interface ConversationState {
  conversations: Record<string, Conversation>;
  activeConversationId: string | null;
  activeNav: NavPage;
  collapsed: boolean;
  settings: ConversationSettings;

  createConversation: (input: CreateConversationInput) => Conversation;
  selectConversation: (conversationId: string) => void;
  updateConversation: (conversationId: string, patch: Partial<Omit<Conversation, 'id' | 'createdAt'>>) => void;
  toggleFavorite: (conversationId: string) => void;
  setActiveNav: (nav: NavPage) => void;
  setCollapsed: (collapsed: boolean) => void;
  updateSettings: (patch: Partial<ConversationSettings>) => void;
  resetAll: () => void;
}

export const useConversationStore = create<ConversationState>()((set, get) => ({
  conversations: persisted?.conversations ?? buildSeedMap(),
  activeConversationId: persisted?.activeConversationId ?? 'conv-seed-nandi',
  activeNav: 'assistant',
  collapsed: persisted?.collapsed ?? false,
  settings: { ...DEFAULT_SETTINGS, ...(persisted?.settings ?? {}) },

  createConversation: (input) => {
    const now = new Date().toISOString();
    const conversation: Conversation = {
      id: nextConversationId(),
      title: input.title,
      type: input.type,
      eventId: input.eventId,
      summary: input.summary,
      status: input.status ?? 'active',
      createdAt: now,
      updatedAt: now,
    };
    set((s) => ({
      conversations: { ...s.conversations, [conversation.id]: conversation },
      activeConversationId: conversation.id,
      activeNav: 'assistant',
    }));
    // 同步底层业务上下文（切事件 + 恢复/创建 session）
    syncBusinessContext(conversation);
    return conversation;
  },

  selectConversation: (conversationId) => {
    const conversation = get().conversations[conversationId];
    if (!conversation) return;
    set({ activeConversationId: conversationId, activeNav: 'assistant' });
    syncBusinessContext(conversation);
  },

  updateConversation: (conversationId, patch) => {
    set((s) => {
      const conversation = s.conversations[conversationId];
      if (!conversation) return s;
      return {
        conversations: {
          ...s.conversations,
          [conversationId]: { ...conversation, ...patch, updatedAt: new Date().toISOString() },
        },
      };
    });
  },

  toggleFavorite: (conversationId) => {
    set((s) => {
      const conversation = s.conversations[conversationId];
      if (!conversation) return s;
      return {
        conversations: {
          ...s.conversations,
          [conversationId]: { ...conversation, favorite: !conversation.favorite },
        },
      };
    });
  },

  setActiveNav: (nav) => set({ activeNav: nav }),

  setCollapsed: (collapsed) => set({ collapsed }),

  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  resetAll: () => {
    clearPersist('conversation');
    set({
      conversations: buildSeedMap(),
      activeConversationId: 'conv-seed-nandi',
      activeNav: 'assistant',
      collapsed: false,
      settings: { ...DEFAULT_SETTINGS },
    });
  },
}));

/** 切换 Conversation 后同步业务上下文：切事件（含 run 失效）+ 恢复该事件 session。 */
function syncBusinessContext(conversation: Conversation): void {
  const demo = useDemoStore.getState();
  if (conversation.eventId && conversation.eventId !== demo.currentEventId) {
    demo.switchEvent(conversation.eventId);
  }
  const sessionStore = useSessionStore.getState();
  const targetEventId = conversation.eventId ?? demo.currentEventId;
  sessionStore.ensureSessionForEvent(targetEventId);
}

// 状态变化即持久化（与会话/文书一致：AC-025 同款机制）
useConversationStore.subscribe((state) => {
  savePersist('conversation', {
    conversations: state.conversations,
    activeConversationId: state.activeConversationId,
    collapsed: state.collapsed,
    settings: state.settings,
  } satisfies ConversationPersist);
});

/* ========== 历史会话分组与搜索（供 GlobalSidebar 使用） ========== */

/** 按演示时钟取"今天"零点（本地时区），返回 [今天0点, 昨天0点, 更早0点)。 */
function dayBoundary(offsetDays: number): number {
  const base = new Date(DEMO_CLOCK);
  base.setHours(0, 0, 0, 0);
  base.setDate(base.getDate() - offsetDays);
  return base.getTime();
}

export type ConversationGroup = 'today' | 'yesterday' | 'earlier';

export function groupOf(conversation: Conversation): ConversationGroup {
  const t = new Date(conversation.updatedAt).getTime();
  if (t >= dayBoundary(0)) return 'today';
  if (t >= dayBoundary(1)) return 'yesterday';
  return 'earlier';
}

export const GROUP_LABEL: Record<ConversationGroup, string> = {
  today: '今天',
  yesterday: '昨天',
  earlier: '更早',
};

export function formatConversationTime(conversation: Conversation): string {
  const group = groupOf(conversation);
  const d = new Date(conversation.updatedAt);
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  if (group === 'today') return hm;
  return `${d.getMonth() + 1}月${d.getDate()}日 ${hm}`;
}

/** 模糊匹配：标题 / 摘要 / 事件名 / 事件或任务编码（大小写不敏感）。 */
export function matchConversation(conversation: Conversation, keyword: string): boolean {
  const kw = keyword.trim().toLowerCase();
  if (!kw) return true;
  const haystacks = [
    conversation.title,
    conversation.summary ?? '',
    conversation.eventId ?? '',
    conversation.id,
  ];
  return haystacks.some((h) => h.toLowerCase().includes(kw));
}
