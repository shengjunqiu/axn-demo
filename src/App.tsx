/**
 * 应用入口（UI 改版 · 参考图外壳）：
 * 左侧 260px 中性侧栏（品牌 / 功能导航含独立文书库 / 新建 / 搜索 / 历史 / 底部角色与设置），
 * 右侧宽敞主区：助理页 = 宽对话（打开文书后为「对话 + 文书工作区」两列），文书库独立成页，
 * 其余导航页占满主内容区。原全宽业务页头移除，其承载项下移至侧栏底部。
 *
 * 路由：HashRouter（react-router-dom v7），URL hash 为导航唯一真相源；
 * 浏览器前进/后退直接生效；不合法路径回退到 /assistant。
 *
 * 反馈范式（固定规则，后续开发遵守）：
 *   - message      —— 轻量、无需用户决策的瞬时结果（成功 / 已保存 / 已导出）
 *   - notification —— 失败且需要用户处理，或需要携带描述与操作按钮
 *   - Modal.confirm / Popconfirm —— 破坏性操作二次确认（Popconfirm 用于行内，Modal.confirm 用于区块级）
 *   - Drawer       —— 承载表单、详情、设置等有内容的二级视图（size 按内容定）
 *   - Modal        —— 仅用于轻量确认与短表单
 *
 * 响应式：视口 ≤767px 时侧栏改为抽屉式（汉堡按钮 + 遮罩），由 matchMedia hook 驱动；
 * ≤1024px 只收缩助理区列宽，侧栏依旧常驻。
 */
import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Drawer } from 'antd';
import { Menu } from 'lucide-react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useUrlNavSync } from '@/components/nav/navRoutes';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { useConversationStore } from '@/store/conversationStore';
import { useActiveScope, useWorkspaceStore } from '@/store/workspaceStore';
import ChatPanel from '@/components/chat/ChatPanel';
import GlobalSidebar from '@/components/nav/GlobalSidebar';
import WorkspaceSync from '@/components/workspace/WorkspaceSync';

// URL 路径 → NavPage 映射表与「URL → store」单向同步都放在 navRoutes.ts，
// 路由表与代码内跳转共用同一套路径。

/** 工作区抽屉中按需渲染的面板。 */
const DocumentLibraryPage = lazy(() => import('@/components/workspace/DocumentLibraryPage'));
const DocumentWorkspace = lazy(() => import('@/components/workspace/DocumentWorkspace'));
const ResourcePanel = lazy(() => import('@/components/workspace/ResourcePanel'));
const KnowledgePanel = lazy(() => import('@/components/workspace/KnowledgePanel'));
const NavPageContent = lazy(() => import('@/components/nav/NavPages').then(m => ({ default: m.NavPageContent })));
const DisasterEventsPage = lazy(() => import('@/components/events/DisasterEventsPage'));
const OriginalSystemWorkspace = lazy(() => import('@/components/workspace/OriginalSystemWorkspace'));
const PrintView = lazy(() => import('@/components/doc/PrintView'));

/** 工作区抽屉目标（资源/知识面板由对话任务卡触发的抽屉承载）。 */
export type WorkspaceTab = 'resource' | 'knowledge';

/**
 * 响应式媒体查询 hook：监听窗口宽度并返回是否命中 `query`。
 * 折叠 inline style 会压掉 media query（inline 优先级更高），所以窄屏判断必须走 JS。
 * 使用 `change` 事件订阅并在卸载时移除监听。
 */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export default function AppRoot() {
  const storageWarning = useDemoStore((s) => s.storageWarning);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const conversations = useConversationStore((s) => s.conversations);
  const scope = useActiveScope();
  const workspaceOpen = useWorkspaceStore((s) => {
    const scopeState = s.scopes[scope];
    return !!scopeState && (scopeState.generating || scopeState.selection !== null);
  });

  // 资源/知识面板抽屉（由对话任务卡触发）；资源抽屉可指定默认 Tab（列表 / 态势地图）。
  const [panelDrawer, setPanelDrawer] = useState<'resource' | 'knowledge' | null>(null);
  const [resourceDrawerTab, setResourceDrawerTab] = useState<'list' | 'map'>('list');
  const openPanelDrawer = (target: 'resource' | 'knowledge', options?: { tab?: 'list' | 'map' }) => {
    if (target === 'resource') setResourceDrawerTab(options?.tab ?? 'list');
    setPanelDrawer(target);
  };

  // URL 是导航的唯一权威；store 的 activeNav 只跟着 URL 走，用来驱动侧栏高亮。
  useUrlNavSync();

  // 刷新恢复：让业务上下文（事件/会话）对齐已持久化的 activeConversation
  useEffect(() => {
    const conversation = activeConversationId ? conversations[activeConversationId] : null;
    if (!conversation) return;
    const demo = useDemoStore.getState();
    if (conversation.eventId && conversation.eventId !== demo.currentEventId) {
      demo.switchEvent(conversation.eventId);
    }
    useSessionStore
      .getState()
      .ensureSessionForConversation(conversation.id, conversation.eventId ?? demo.currentEventId);
    // 仅挂载时执行一次（刷新后对齐已持久化的 activeConversation 与业务上下文）
  }, []);

  const sidebarCollapsed = useDemoStore((s) => s.sidebarCollapsed);

  // 窄屏（≤767px）下侧栏切换为抽屉式：需 JS 参与（遮罩 / 开关），无法纯 CSS 完成。
  // 阈值必须与 global.css 的 @media (max-width: 767px) 一致，否则 JS 状态与 CSS 定位脱节。
  const isCompact = useMediaQuery('(max-width: 767px)');
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const navToggleRef = useRef<HTMLButtonElement>(null);
  const sidebarRef = useRef<HTMLElement>(null);
  const pendingNavFocusRef = useRef(false);

  // 路由变化时自动收起抽屉，避免切换页面后遮罩残留（不动焦点：导航后用户应在内容区继续操作）。
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  // 抽屉可访问性：打开时把焦点送进抽屉，Escape 关闭。
  // 手写抽屉不像 antd Drawer 自带焦点陷阱，这两件事必须自己补。

  // 关闭抽屉。真正的 focus() 放到下面的 effect 里执行 —— 关闭瞬间汉堡按钮
  // 还是 visibility:hidden，同步调用会静默失败，键盘用户就丢了位置。
  const closeNav = () => {
    pendingNavFocusRef.current = true;
    setNavOpen(false);
  };

  // 关闭后把焦点交还给汉堡按钮（手写抽屉没有 antd Drawer 的 focusTriggerAfterClose）。
  useEffect(() => {
    if (navOpen || !isCompact || !pendingNavFocusRef.current) return;
    pendingNavFocusRef.current = false;
    navToggleRef.current?.focus();
  }, [navOpen, isCompact]);

  useEffect(() => {
    if (!isCompact || !navOpen) return;
    sidebarRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      pendingNavFocusRef.current = true;
      setNavOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isCompact, navOpen]);

  // 折叠 inline style 只在非窄屏生效：inline style 优先级高于 media query，
  // 若在窄屏照常注入，width:0 会压掉 @media (max-width: 767px) 的抽屉定位
  //（1024px 那个块只做助理区三列→单列折叠，不含抽屉定位）。
  const sidebarStyle = useMemo(
    () => !isCompact && sidebarCollapsed
      ? { flex: '0 0 0', width: 0, borderRight: 'none', overflow: 'hidden' } as React.CSSProperties
      : undefined,
    [isCompact, sidebarCollapsed],
  );

  return (
    <div className="axn-shell">
      {/* 窄屏遮罩：点按关闭导航抽屉（纯装饰） */}
      {isCompact && navOpen && (
        <div
          className={`axn-shell-backdrop${navOpen ? ' is-open' : ''}`}
          aria-hidden="true"
          onClick={closeNav}
        />
      )}

      {/* 第一栏：全局导航 + 对话历史 + 底部角色/设置（窄屏下为抽屉）。
          tabIndex={-1} 只为让打开抽屉时能把焦点送进来，不参与 Tab 顺序。 */}
      <aside
        ref={sidebarRef}
        className={`axn-shell-sidebar${navOpen ? ' is-open' : ''}`}
        style={sidebarStyle}
        tabIndex={-1}
      >
        <GlobalSidebar />
      </aside>

      {/* 窄屏汉堡按钮：打开导航抽屉 */}
      {isCompact && (
        <button
          ref={navToggleRef}
          type="button"
          className={`axn-shell-navtoggle${navOpen ? ' is-open' : ''}`}
          aria-label="打开导航"
          aria-expanded={navOpen}
          onClick={() => setNavOpen(true)}
        >
          <Menu />
        </button>
      )}

      {/* 主区：HashRouter 路由分发 */}
      <main className="axn-shell-main">
        {/* 常驻协调：即使文书库/工作区未挂载也观察真实草稿任务与模拟文书流程 */}
        <WorkspaceSync />

        {storageWarning && <div className="axn-shell-warning">{storageWarning}</div>}

        <Routes>
          <Route path="/assistant" element={
            <div className={`axn-assistant${workspaceOpen ? ' axn-assistant--split' : ''}`}>
              <div className="axn-chat-pane">
                <ChatPanel compact={workspaceOpen} onOpenDrawer={openPanelDrawer} />
              </div>
              {workspaceOpen && (
                <div className="axn-workspace-pane">
                  <Suspense><DocumentWorkspace /></Suspense>
                </div>
              )}
            </div>
          } />
          <Route path="/events" element={<Suspense><DisasterEventsPage /></Suspense>} />
          <Route path="/originalSystems/:system?" element={
            <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
              <Suspense><OriginalSystemWorkspace /></Suspense>
            </div>
          } />
          <Route path="/library" element={<Suspense><DocumentLibraryPage /></Suspense>} />
          <Route path="/projects" element={
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <Suspense><NavPageContent page="projects" /></Suspense>
            </div>
          } />
          <Route path="/agents" element={
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <Suspense><NavPageContent page="agents" /></Suspense>
            </div>
          } />
          <Route path="/schedules" element={
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <Suspense><NavPageContent page="schedules" /></Suspense>
            </div>
          } />
          <Route path="/knowledge" element={
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <Suspense><NavPageContent page="knowledge" /></Suspense>
            </div>
          } />
          <Route path="*" element={<Navigate to="/assistant" replace />} />
        </Routes>
      </main>

      <Drawer title="资源与态势（模拟）" size={760} open={panelDrawer === 'resource'} onClose={() => setPanelDrawer(null)} destroyOnHidden>
        <Suspense>{panelDrawer === 'resource' && <ResourcePanel initialTab={resourceDrawerTab} />}</Suspense>
      </Drawer>
      <Drawer title="建议与知识（模拟）" size={560} open={panelDrawer === 'knowledge'} onClose={() => setPanelDrawer(null)} destroyOnHidden>
        <Suspense>{panelDrawer === 'knowledge' && <KnowledgePanel />}</Suspense>
      </Drawer>
      <Suspense><PrintView /></Suspense>
    </div>
  );
}
