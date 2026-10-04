/**
 * 应用入口（UI 改版 · 参考图外壳）：
 * 左侧 260px 中性侧栏（品牌 / 功能导航含独立文书库 / 新建 / 搜索 / 历史 / 底部角色与设置），
 * 右侧宽敞主区：助理页 = 宽对话（打开文书后为「对话 + 文书工作区」两列），文书库独立成页，
 * 其余导航页占满主内容区。原全宽业务页头移除，其承载项下移至侧栏底部。
 *
 * 路由：HashRouter（react-router-dom v7），URL hash 为导航唯一真相源；
 * 浏览器前进/后退直接生效；不合法路径回退到 /assistant。
 */
import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Drawer } from 'antd';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { useConversationStore } from '@/store/conversationStore';
import { useActiveScope, useWorkspaceStore } from '@/store/workspaceStore';
import type { NavPage } from '@/domain/types';
import ChatPanel from '@/components/chat/ChatPanel';
import GlobalSidebar from '@/components/nav/GlobalSidebar';
import WorkspaceSync from '@/components/workspace/WorkspaceSync';

// URL 路径 → NavPage 映射表（模块级常量，避免每次渲染重建）。
const PATH_TO_NAV: Record<string, NavPage> = {
  '/assistant': 'assistant',
  '/library': 'library',
  '/projects': 'projects',
  '/agents': 'agents',
  '/schedules': 'schedules',
  '/knowledge': 'knowledge',
};
const NAV_TO_PATH: Record<NavPage, string> = {
  assistant: '/assistant',
  library: '/library',
  projects: '/projects',
  agents: '/agents',
  schedules: '/schedules',
  knowledge: '/knowledge',
};

/** 工作区抽屉中按需渲染的面板。 */
const DocumentLibraryPage = lazy(() => import('@/components/workspace/DocumentLibraryPage'));
const DocumentWorkspace = lazy(() => import('@/components/workspace/DocumentWorkspace'));
const ResourcePanel = lazy(() => import('@/components/workspace/ResourcePanel'));
const KnowledgePanel = lazy(() => import('@/components/workspace/KnowledgePanel'));
const NavPageContent = lazy(() => import('@/components/nav/NavPages').then(m => ({ default: m.NavPageContent })));
const PrintView = lazy(() => import('@/components/doc/PrintView'));

/** 工作区抽屉目标（资源/知识面板由对话任务卡触发的抽屉承载）。 */
export type WorkspaceTab = 'resource' | 'knowledge';

export default function AppRoot() {
  const storageWarning = useDemoStore((s) => s.storageWarning);
  const activeNav = useConversationStore((s) => s.activeNav);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const conversations = useConversationStore((s) => s.conversations);
  const scope = useActiveScope();
  const workspaceOpen = useWorkspaceStore((s) => {
    const scopeState = s.scopes[scope];
    return !!scopeState && (scopeState.generating || scopeState.selection !== null);
  });

  // 资源/知识面板抽屉（由对话任务卡触发）
  const [panelDrawer, setPanelDrawer] = useState<'resource' | 'knowledge' | null>(null);

  // ── react-router 双向同步 ──────────────────────────────────────
  const location = useLocation();
  const navigate = useNavigate();
  const setActiveNav = useConversationStore((s) => s.setActiveNav);

  // URL 变化（用户点击导航/前进/后退）→ 同步到 store。
  useEffect(() => {
    const page = PATH_TO_NAV[location.pathname];
    if (page && page !== activeNav) {
      setActiveNav(page);
    }
  }, [location.pathname, activeNav, setActiveNav]);

  // store 中 activeNav 变化（createConversation / selectConversation 等）→ 同步到 URL。
  // 使用 push 而非 replace，保留浏览器历史栈（让「从 library 新建后」能后退回去）。
  useEffect(() => {
    const target = NAV_TO_PATH[activeNav];
    if (target && location.pathname !== target) {
      navigate(target);
    }
  }, [activeNav, location.pathname, navigate]);
  // ── 路由同步结束 ────────────────────────────────────────────────

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
  const sidebarStyle = useMemo(() => sidebarCollapsed ? { flex: '0 0 0', width: 0, borderRight: 'none', overflow: 'hidden' } as React.CSSProperties : undefined, [sidebarCollapsed]);

  return (
    <div className="axn-shell">
      {/* 第一栏：全局导航 + 对话历史 + 底部角色/设置 */}
      <aside className="axn-shell-sidebar" style={sidebarStyle}>
        <GlobalSidebar />
      </aside>

      {/* 主区：HashRouter 路由分发 */}
      <main className="axn-shell-main">
        {/* 常驻协调：即使文书库/工作区未挂载也观察真实草稿任务与模拟文书流程 */}
        <WorkspaceSync />

        {storageWarning && <div className="axn-shell-warning">{storageWarning}</div>}

        <Routes>
          <Route path="/assistant" element={
            <div className={`axn-assistant${workspaceOpen ? ' axn-assistant--split' : ''}`}>
              <div className="axn-chat-pane">
                <ChatPanel compact={workspaceOpen} onOpenDrawer={(target: 'resource' | 'knowledge') => setPanelDrawer(target)} />
              </div>
              {workspaceOpen && (
                <div className="axn-workspace-pane">
                  <Suspense><DocumentWorkspace /></Suspense>
                </div>
              )}
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
        <Suspense>{panelDrawer === 'resource' && <ResourcePanel />}</Suspense>
      </Drawer>
      <Drawer title="建议与知识（模拟）" size={560} open={panelDrawer === 'knowledge'} onClose={() => setPanelDrawer(null)} destroyOnHidden>
        <Suspense>{panelDrawer === 'knowledge' && <KnowledgePanel />}</Suspense>
      </Drawer>
      <Suspense><PrintView /></Suspense>
    </div>
  );
}
