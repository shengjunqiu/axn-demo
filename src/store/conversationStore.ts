/**
 * Conversation Store（全局导航 · 对话历史管理）。
 *
 * 设计决策：
 * - Conversation 是"交互上下文"（导航/历史/收藏），Event 是"业务对象"。
 *   消息、候选资源、文书、任务等业务数据仍挂在 session（按 Event 隔离）上，
 *   切换 Conversation = 切换到其 eventId 对应的事件与 session，不另建第二套数据。
 * - 一个 Event 可对应多个 Conversation；未绑事件的会话（空白对话）创建时分配专属虚拟事件 evt-blank-<id>，
 *   拥有独立空 session，不与任何业务事件共享消息。
 * - 持久化复用 persistence.ts（anneng-demo:v1:conversation），刷新后恢复历史与 active。
 * - 种子会话由 seedConversationRows 生成（全部为虚构模拟数据）。
 */
import { create } from 'zustand';
import type { Conversation, ConversationSettings, NavPage } from '@/domain/types';
import { clearPersist, loadPersist, schedulePersist } from './persistence.js';
import { useDemoStore } from './demoStore.js';
import { useSessionStore } from './sessionStore.js';
import { DEMO_CLOCK } from '@/seed/scenario';

interface ConversationPersist {
  conversations: Record<string, Conversation>;
  activeConversationId: string | null;
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
 * 种子历史会话（模拟数据，时间相对模拟时钟 2026-09-28 21:10 展开）。
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
  settings: ConversationSettings;

  createConversation: (input: CreateConversationInput) => Conversation;
  selectConversation: (conversationId: string) => void;
  /** 在对话界面内切换关联灾情：绑定事件共享 session；取消关联则回到会话专属虚拟事件 */
  linkConversationToEvent: (conversationId: string, eventId: string | undefined) => void;
  deleteConversation: (conversationId: string) => void;
  updateConversation: (conversationId: string, patch: Partial<Omit<Conversation, 'id' | 'createdAt'>>) => void;
  setActiveNav: (nav: NavPage) => void;
  updateSettings: (patch: Partial<ConversationSettings>) => void;
  resetAll: () => void;
}

export const useConversationStore = create<ConversationState>()((set, get) => ({
  conversations: persisted?.conversations ?? buildSeedMap(),
  activeConversationId: persisted?.activeConversationId ?? 'conv-seed-nandi',
  activeNav: 'assistant',
  settings: { ...DEFAULT_SETTINGS, ...(persisted?.settings ?? {}) },

  createConversation: (input) => {
    const now = new Date().toISOString();
    const id = nextConversationId();
    const conversation: Conversation = {
      id,
      title: input.title,
      type: input.type,
      // 未绑定事件的会话（如“空白对话”）分配专属虚拟事件 → ensureSessionForEvent
      // 会为其创建全新的空 session，不复用当前事件的历史消息。
      eventId: input.eventId ?? `evt-blank-${id}`,
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

  linkConversationToEvent: (conversationId, eventId) => {
    const conversation = get().conversations[conversationId];
    if (!conversation) return;
    // eventId 为 undefined：回到该会话专属虚拟事件（保留其独立消息），不落入当前事件。
    const nextEventId = eventId ?? `evt-blank-${conversationId}`;
    if (conversation.eventId === nextEventId) return;
    const updated = { ...conversation, eventId: nextEventId, updatedAt: new Date().toISOString() };
    set((s) => ({ conversations: { ...s.conversations, [conversationId]: updated } }));
    if (get().activeConversationId === conversationId) syncBusinessContext(updated);
  },

  deleteConversation: (conversationId) => {
    const { conversations, activeConversationId } = get();
    if (!conversations[conversationId]) return;
    const remaining = Object.values(conversations).filter((c) => c.id !== conversationId);
    // 被删的是激活会话时，切换到剩余会话中最近更新的一个；全部删光则无激活会话。
    // 业务数据（session/任务/候选）按事件共享保留，不随会话条目删除。
    let nextActive: string | null = null;
    if (activeConversationId === conversationId) {
      nextActive =
        remaining.sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0]?.id ?? null;
    } else {
      nextActive = activeConversationId;
    }
    set({ conversations: Object.fromEntries(remaining.map((c) => [c.id, c])), activeConversationId: nextActive });
    if (nextActive) syncBusinessContext(get().conversations[nextActive]);
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

  setActiveNav: (nav) => set({ activeNav: nav }),

  updateSettings: (patch) => set((s) => ({ settings: { ...s.settings, ...patch } })),

  resetAll: () => {
    clearPersist('conversation');
    set({
      conversations: buildSeedMap(),
      activeConversationId: 'conv-seed-nandi',
      activeNav: 'assistant',
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
  // 消息按会话隔离：每个会话专属 session（关联灾情共享业务数据，不共享聊天记录）
  const targetEventId = conversation.eventId ?? demo.currentEventId;
  useSessionStore.getState().ensureSessionForConversation(conversation.id, targetEventId);
}

// 状态变化即持久化（与会话/文书一致：AC-025 同款机制）
// 注意：activeNav 不参与持久化，切换导航不会触发任何序列化与写盘。
useConversationStore.subscribe((state) => {
  schedulePersist('conversation', {
    conversations: state.conversations,
    activeConversationId: state.activeConversationId,
    settings: state.settings,
  } satisfies ConversationPersist);
});

/* ========== 历史会话分组与搜索（供 GlobalSidebar 使用） ========== */

/** 按模拟时钟取"今天"零点（本地时区），返回 [今天0点, 昨天0点, 更早0点)。 */
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
