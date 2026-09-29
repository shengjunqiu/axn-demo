/**
 * 应用入口（T-004 + 全局导航迭代）：
 * 第一栏 = 全局功能导航 + 对话历史（GlobalSidebar，可折叠 56px）；
 * 第二栏 = 当前安小能会话区（ChatPanel）；
 * 第三栏 = 主业务工作区（智能助理页签 / 应急项目 / 智能体与 Skill / 定时任务 / 知识库）。
 * 单页应用不引入 react-router；导航页与工作台页签均为本地状态。
 */
import { useEffect, useMemo, useState } from 'react';
import { Badge, Button, Drawer, Layout, Select, Space, Typography } from 'antd';
import { ControlOutlined, FileTextOutlined } from '@ant-design/icons';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { useDocumentStore } from '@/store/documentStore';
import { useConversationStore } from '@/store/conversationStore';
import { actors } from '@/seed/scenario';
import DemoControlPanel from '@/components/demo/DemoControlPanel';
import ChatPanel from '@/components/chat/ChatPanel';
import ResourcePanel from '@/components/workspace/ResourcePanel';
import KnowledgePanel from '@/components/workspace/KnowledgePanel';
import DocCenterPanel from '@/components/workspace/DocCenterPanel';
import GlobalSidebar, { CreateConversationModal } from '@/components/nav/GlobalSidebar';
import { NavPageContent } from '@/components/nav/NavPages';
import PrintView from '@/components/doc/PrintView';

const { Header, Sider, Content } = Layout;

export type WorkspaceTab = 'resource' | 'knowledge' | 'doc';

export default function AppRoot() {
  const actorId = useDemoStore((s) => s.actorId);
  const setActor = useDemoStore((s) => s.setActor);
  const currentEventId = useDemoStore((s) => s.currentEventId);
  const globalBanner = useDemoStore((s) => s.globalBanner);
  const storageWarning = useDemoStore((s) => s.storageWarning);
  const activeNav = useConversationStore((s) => s.activeNav);
  const collapsed = useConversationStore((s) => s.collapsed);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const conversations = useConversationStore((s) => s.conversations);

  const [tab, setTab] = useState<WorkspaceTab>('resource');
  const [controlOpen, setControlOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const session = useSessionStore((s) => s.sessions[s.sessionByEvent[currentEventId] ?? '']);
  const draftCount = useDocumentStore((s) => Object.keys(s.drafts).length);

  // 刷新恢复：让业务上下文（事件/会话）对齐已持久化的 activeConversation
  useEffect(() => {
    const conversation = activeConversationId ? conversations[activeConversationId] : null;
    if (!conversation) return;
    const demo = useDemoStore.getState();
    if (conversation.eventId && conversation.eventId !== demo.currentEventId) {
      demo.switchEvent(conversation.eventId);
    }
    useSessionStore.getState().ensureSessionForEvent(conversation.eventId ?? demo.currentEventId);
    // 仅挂载时执行一次（刷新后对齐已持久化的 activeConversation 与业务上下文）
  }, []);

  const pendingCount = useMemo(
    () => (session?.pendingClarification ? 1 : 0),
    [session?.pendingClarification],
  );

  const sidebarWidth = collapsed ? 56 : 224;

  return (
    <Layout style={{ height: '100%', overflow: 'hidden' }}>
      <Header style={{ display: 'flex', alignItems: 'center', gap: 14, paddingInline: 16, borderBottom: '1px solid #e5e9f0' }}>
        <Space size={10}>
          <div
            style={{
              width: 30,
              height: 30,
              borderRadius: 8,
              background: '#1d6ff2',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontWeight: 700,
            }}
          >
            安
          </div>
          <div>
            <Typography.Text strong style={{ fontSize: 15, lineHeight: 1.3, display: 'block' }}>
              安小能 · 应急智能工作台
            </Typography.Text>
            <div>
              <Typography.Text type="secondary" style={{ fontSize: 11, lineHeight: 1.2, display: 'block' }}>
                {globalBanner}
              </Typography.Text>
            </div>
          </div>
        </Space>
        <div style={{ flex: 1 }} />
        <Space size={10}>
          <Typography.Text type="secondary" style={{ fontSize: 12 }} data-testid="header-event">
            当前事件：{session ? session.title : currentEventId}
          </Typography.Text>
          <Select
            size="small"
            style={{ width: 190 }}
            value={actorId}
            onChange={setActor}
            aria-label="切换角色"
            options={actors.map((a) => ({ value: a.actorId, label: `${a.name} · ${a.role === 'duty' ? '值班员' : '指挥员'}` }))}
          />
          <Badge count={pendingCount} size="small" offset={[-2, 2]}>
            <Button size="small" icon={<ControlOutlined />} onClick={() => setControlOpen(true)}>
              演示控制
            </Button>
          </Badge>
        </Space>
      </Header>
      {storageWarning && (
        <div style={{ background: '#fffbe6', borderBottom: '1px solid #ffe58f', padding: '4px 16px', fontSize: 12, color: '#874d00' }}>
          {storageWarning}
        </div>
      )}
      <Layout style={{ padding: 8, gap: 8, height: 'calc(100% - 56px)', minHeight: 0, overflow: 'hidden' }}>
        {/* 第一栏：全局导航 + 历史会话 */}
        <div
          style={{
            width: sidebarWidth,
            flex: `0 0 ${sidebarWidth}px`,
            borderRadius: 10,
            border: '1px solid #e5e9f0',
            overflow: 'hidden',
            transition: 'width 0.18s ease',
          }}
        >
          <GlobalSidebar onCreateClick={() => setCreateOpen(true)} />
        </div>

        {/* 第二栏：当前会话区 */}
        <Sider width={350} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e9f0', overflow: 'hidden' }}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ChatPanel onOpenTab={(target: WorkspaceTab) => { setTab(target); }} />
          </div>
        </Sider>

        {/* 第三栏：主业务工作区 */}
        <Content style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e9f0', overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {activeNav === 'assistant' ? (
            <>
              <div style={{ display: 'flex', gap: 8, padding: '8px 14px 0', borderBottom: '1px solid #eef1f6' }}>
                {(
                  [
                    { key: 'resource', label: '资源与态势' },
                    { key: 'knowledge', label: '建议与知识' },
                    { key: 'doc', label: `文书中心${draftCount ? `（${draftCount}）` : ''}`, icon: true },
                  ] as { key: WorkspaceTab; label: string; icon?: boolean }[]
                ).map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setTab(t.key)}
                    style={{
                      border: 'none',
                      background: tab === t.key ? '#e8f0fe' : 'transparent',
                      color: tab === t.key ? '#1d5fd2' : '#555',
                      padding: '8px 14px',
                      borderRadius: '8px 8px 0 0',
                      cursor: 'pointer',
                      fontSize: 13,
                      fontWeight: tab === t.key ? 600 : 400,
                      display: 'flex',
                      alignItems: 'center',
                      gap: 6,
                    }}
                  >
                    {t.icon && <FileTextOutlined />}
                    {t.label}
                  </button>
                ))}
              </div>
              <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
                {tab === 'resource' && <ResourcePanel />}
                {tab === 'knowledge' && <KnowledgePanel />}
                {tab === 'doc' && <DocCenterPanel />}
              </div>
            </>
          ) : (
            <div style={{ flex: 1, overflow: 'auto', minHeight: 0 }}>
              <NavPageContent page={activeNav} />
            </div>
          )}
        </Content>
      </Layout>
      <Drawer title="演示控制（仅演示用）" width={420} open={controlOpen} onClose={() => setControlOpen(false)}>
        <DemoControlPanel />
      </Drawer>
      <CreateConversationModal open={createOpen} onClose={() => setCreateOpen(false)} />
      <PrintView />
    </Layout>
  );
}
