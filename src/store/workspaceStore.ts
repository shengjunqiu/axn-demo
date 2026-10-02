/**
 * 工作区 UI 选择状态（独立于核心业务 store，不写入任何业务数据）。
 *
 * 设计决策：
 * - 作用域 scope = 当前会话（sessionId 优先，回退 conversationId / eventId）：
 *   切换会话即切换作用域，A 会话的文书选择不会污染 B 会话。
 * - 选择区分 mock（模拟文书）与 draft（真实草稿），二者不共用 id 语义。
 * - generating = 正在生成 / 等待补充（工作区打开但尚无选中文书）。
 * - autoToken = 最近一次自动打开所依据的完成标记；suppressed = 被用户关闭的标记。
 *   关闭（close 不带参）会抑制“同一个完成”在无关重渲染 / 重新挂载时再次弹出，
 *   而新的完成标记或用户显式选择（点击预览 / 文书库条目）仍会正常打开。
 * - dirty 记录右栏模拟编辑的未保存状态，供关闭 / 切换前的保护确认使用。
 * 全部为演示环境的 UI 状态。
 */
import { create } from 'zustand';
import { useConversationStore } from './conversationStore';
import { useDemoStore } from './demoStore';
import { useSessionStore } from './sessionStore';

export type WorkspaceSelection =
  | { kind: 'mock'; id: string }
  | { kind: 'draft'; id: string };

/** 对话 / 工作模式：改变首页可执行建议（问答问题 vs 智能体任务）。 */
export type WorkMode = 'chat' | 'work';

interface ScopeState {
  selection: WorkspaceSelection | null;
  generating: boolean;
  suppressed: string | null;
  autoToken: string | null;
}

export const EMPTY_SCOPE: ScopeState = { selection: null, generating: false, suppressed: null, autoToken: null };

export type WorkspaceIntent = { kind: 'generating' } | WorkspaceSelection;

interface WorkspaceState {
  scopes: Record<string, ScopeState>;
  modes: Record<string, WorkMode>;
  dirty: Record<string, boolean>;

  modeOf: (scope: string) => WorkMode;
  setMode: (scope: string, mode: WorkMode) => void;

  selectionOf: (scope: string) => WorkspaceSelection | null;
  isOpen: (scope: string) => boolean;
  /** 自动打开（生成中 / 完成 / 等待补充）。同一完成标记被用户关闭后不再自动弹出。 */
  autoOpen: (scope: string, token: string, intent: WorkspaceIntent) => void;
  /** 显式打开（点击聊天预览 / 文书库条目）：清除关闭标记。 */
  select: (scope: string, selection: WorkspaceSelection) => void;
  /** 关闭文书：仅改 UI，不清理会话数据，也不触发重新生成；不带 token 时抑制最近一次自动打开。 */
  close: (scope: string, token?: string | null) => void;
  finish: (scope: string, token: string) => void;

  setDirty: (scope: string, dirty: boolean) => void;
  isDirty: (scope: string) => boolean;

  resetAll: () => void;
}

export const useWorkspaceStore = create<WorkspaceState>()((set, get) => ({
  scopes: {},
  modes: {},
  dirty: {},

  modeOf: (scope) => get().modes[scope] ?? 'chat',
  setMode: (scope, mode) => set((s) => ({ modes: { ...s.modes, [scope]: mode } })),

  selectionOf: (scope) => get().scopes[scope]?.selection ?? null,
  isOpen: (scope) => {
    const scopeState = get().scopes[scope];
    return !!scopeState && (scopeState.generating || scopeState.selection !== null);
  },

  autoOpen: (scope, token, intent) =>
    set((s) => {
      const prev = s.scopes[scope] ?? EMPTY_SCOPE;
      if (prev.suppressed === token || s.dirty[scope]) return s;
      if (prev.autoToken === token && (intent.kind === 'generating'
        ? prev.generating
        : !prev.generating && prev.selection?.kind === intent.kind && prev.selection.id === intent.id)) return s;
      return {
        scopes: {
          ...s.scopes,
          [scope]: intent.kind === 'generating'
            ? { selection: null, generating: true, suppressed: null, autoToken: token }
            : { selection: intent, generating: false, suppressed: null, autoToken: token },
        },
      };
    }),

  select: (scope, selection) =>
    set((s) => ({ scopes: { ...s.scopes, [scope]: { selection, generating: false, suppressed: null, autoToken: null } } })),

  close: (scope, token) =>
    set((s) => {
      const prev = s.scopes[scope] ?? EMPTY_SCOPE;
      return {
        scopes: {
          ...s.scopes,
          [scope]: { selection: null, generating: false, suppressed: token ?? prev.autoToken, autoToken: null },
        },
      };
    }),

  setDirty: (scope, dirty) => set((s) => ({ dirty: { ...s.dirty, [scope]: dirty } })),
  finish: (scope, token) => set((s) => {
    const current = s.scopes[scope];
    if (!current?.generating || current.autoToken !== token) return s;
    return { scopes: { ...s.scopes, [scope]: { ...current, generating: false } } };
  }),
  isDirty: (scope) => get().dirty[scope] ?? false,

  resetAll: () => set({ scopes: {}, modes: {}, dirty: {} }),
}));

/** 当前会话的作用域键（与工作区选择状态一致：sessionId 优先，回退 conversationId / eventId）。 */
export function useActiveScope(): string {
  const conversationId = useConversationStore((s) => s.activeConversationId);
  const sessionId = useSessionStore((s) => s.sessionByConversation[conversationId ?? ''] ?? '');
  const currentEventId = useDemoStore((s) => s.currentEventId);
  return sessionId || conversationId || currentEventId;
}
