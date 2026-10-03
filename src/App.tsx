/**
 * 应用入口（UI 改版 · 参考图外壳）：
 * 左侧 260px 中性侧栏（品牌 / 功能导航含独立文书库 / 新建 / 搜索 / 历史 / 底部角色与设置），
 * 右侧宽敞主区：助理页 = 宽对话（打开文书后为「对话 + 文书工作区」两列），文书库独立成页，
 * 其余导航页占满主内容区。原全宽业务页头移除，其承载项下移至侧栏底部。
 * 单页应用不引入 react-router；导航页与工作区可见性均为本地/UI 状态。
 */
import { useEffect, useMemo, useState } from 'react';
import { Drawer } from 'antd';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { useConversationStore } from '@/store/conversationStore';
import { useActiveScope, useWorkspaceStore } from '@/store/workspaceStore';
import ChatPanel from '@/components/chat/ChatPanel';
import ResourcePanel from '@/components/workspace/ResourcePanel';
import KnowledgePanel from '@/components/workspace/KnowledgePanel';
import DocumentLibraryPage from '@/components/workspace/DocumentLibraryPage';
import DocumentWorkspace, { WorkspaceSync } from '@/components/workspace/DocumentWorkspace';
import GlobalSidebar from '@/components/nav/GlobalSidebar';
import { NavPageContent } from '@/components/nav/NavPages';
import PrintView from '@/components/doc/PrintView';

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

      {/* 主区：无全宽业务页头；文书工作区在助理页内以两列呈现 */}
      <main className="axn-shell-main">
        {/* 常驻协调：即使文书库/工作区未挂载也观察真实草稿任务与模拟文书流程 */}
        <WorkspaceSync />

        {storageWarning && <div className="axn-shell-warning">{storageWarning}</div>}

        {activeNav === 'library' ? (
          <DocumentLibraryPage />
        ) : activeNav === 'assistant' ? (
          <div className={`axn-assistant${workspaceOpen ? ' axn-assistant--split' : ''}`}>
            <div className="axn-chat-pane">
              <ChatPanel compact={workspaceOpen} onOpenDrawer={(target: 'resource' | 'knowledge') => setPanelDrawer(target)} />
            </div>
            {workspaceOpen && (
              <div className="axn-workspace-pane">
                <DocumentWorkspace />
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
            <NavPageContent page={activeNav} />
          </div>
        )}
      </main>

      <Drawer title="资源与态势（模拟）" width={760} open={panelDrawer === 'resource'} onClose={() => setPanelDrawer(null)} destroyOnHidden>
        {panelDrawer === 'resource' && <ResourcePanel />}
      </Drawer>
      <Drawer title="建议与知识（模拟）" width={560} open={panelDrawer === 'knowledge'} onClose={() => setPanelDrawer(null)} destroyOnHidden>
        {panelDrawer === 'knowledge' && <KnowledgePanel />}
      </Drawer>
      <PrintView />
    </div>
  );
}
