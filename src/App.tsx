/**
 * 应用入口（T-004）：单页双工作台布局。
 * 路由决策：演示为单屏应用，不引入 react-router；用本地状态切换工作台视图。
 */
import { useMemo, useState } from 'react';
import { Badge, Button, Drawer, Layout, Select, Space, Typography } from 'antd';
import { ControlOutlined, FileTextOutlined } from '@ant-design/icons';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { useDocumentStore } from '@/store/documentStore';
import { actors } from '@/seed/scenario';
import DemoControlPanel from '@/components/demo/DemoControlPanel';
import ChatPanel from '@/components/chat/ChatPanel';
import ResourcePanel from '@/components/workspace/ResourcePanel';
import KnowledgePanel from '@/components/workspace/KnowledgePanel';
import DocCenterPanel from '@/components/workspace/DocCenterPanel';
import PrintView from '@/components/doc/PrintView';

const { Header, Sider, Content } = Layout;

export type WorkspaceTab = 'resource' | 'knowledge' | 'doc';

export default function AppRoot() {
  const actorId = useDemoStore((s) => s.actorId);
  const setActor = useDemoStore((s) => s.setActor);
  const currentEventId = useDemoStore((s) => s.currentEventId);
  const globalBanner = useDemoStore((s) => s.globalBanner);
  const storageWarning = useDemoStore((s) => s.storageWarning);
  const [tab, setTab] = useState<WorkspaceTab>('resource');
  const [controlOpen, setControlOpen] = useState(false);
  const session = useSessionStore((s) => s.sessions[s.sessionByEvent[currentEventId] ?? '']);
  const draftCount = useDocumentStore((s) => Object.keys(s.drafts).length);

  const pendingCount = useMemo(
    () => (session?.pendingClarification ? 1 : 0),
    [session?.pendingClarification],
  );

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
          <Select
            size="small"
            style={{ width: 200 }}
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
      <Layout style={{ padding: 10, gap: 10, height: 'calc(100% - 56px)', minHeight: 0, overflow: 'hidden' }}>
        <Sider width={460} style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e9f0', overflow: 'hidden' }}>
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <ChatPanel onOpenTab={(target: WorkspaceTab) => setTab(target)} />
          </div>
        </Sider>
        <Content style={{ background: '#fff', borderRadius: 10, border: '1px solid #e5e9f0', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
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
          <div style={{ flex: 1, overflow: 'auto' }}>
            {tab === 'resource' && <ResourcePanel />}
            {tab === 'knowledge' && <KnowledgePanel />}
            {tab === 'doc' && <DocCenterPanel />}
          </div>
        </Content>
      </Layout>
      <Drawer title="演示控制（仅演示用）" width={420} open={controlOpen} onClose={() => setControlOpen(false)}>
        <DemoControlPanel />
      </Drawer>
      <PrintView />
    </Layout>
  );
}
