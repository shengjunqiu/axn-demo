/**
 * 全局导航 + 对话历史管理侧栏（UI 改版）：
 * 区域：品牌（左上，保留安小能身份与模拟环境标识）/ 一级功能导航（含独立「文书库」）/
 * 新建（新建任务=工作模式、新建应急对话=对话模式）/ 搜索 / 历史会话 / 底部工具区
 * （当前事件、角色切换、设置）。
 * 改版要点：原全宽业务页头移除，其承载项下移至侧栏底部；折叠与收藏功能保持移除状态。
 * 全部数据为模拟数据。
 */
import { useCallback, useMemo, useState } from 'react';
import {
  AppstoreOutlined,
  ClockCircleOutlined,
  DeleteOutlined,
  DingtalkOutlined,
  ExperimentOutlined,
  FileAddOutlined,
  FolderOpenOutlined,
  PlusOutlined,
  RobotOutlined,
  SearchOutlined,
  SettingOutlined,
} from '@ant-design/icons';
import { App as AntdApp, Button, Empty, Input, Modal, Popconfirm, Radio, Select, theme } from 'antd';
import type { Conversation, ConversationSettings, NavPage } from '@/domain/types';
import {
  GROUP_LABEL,
  formatConversationTime,
  groupOf,
  matchConversation,
  useConversationStore,
  type ConversationGroup,
} from '@/store/conversationStore';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { useActiveScope, useWorkspaceStore, type WorkMode } from '@/store/workspaceStore';
import { eventDisplayName } from '@/services/factLookup';
import { actors } from '@/seed/scenario';
import './sidebar.css';

type NavKey = NavPage;

const NAV: { key: NavKey; label: string; icon: React.ReactNode }[] = [
  { key: 'library', label: '文书库', icon: <FolderOpenOutlined /> },
  { key: 'assistant', label: '智能助理', icon: <DingtalkOutlined /> },
  { key: 'projects', label: '应急项目', icon: <AppstoreOutlined /> },
  { key: 'agents', label: '智能体与 Skill', icon: <RobotOutlined /> },
  { key: 'schedules', label: '定时任务', icon: <ClockCircleOutlined /> },
  { key: 'knowledge', label: '知识库', icon: <ExperimentOutlined /> },
];

/** 对话与通知设置（轻量展示，需求 2.6）。 */
export function ConversationSettingsPanel() {
  const settings = useConversationStore((s) => s.settings);
  const updateSettings = useConversationStore((s) => s.updateSettings);
  const items: { key: keyof ConversationSettings; label: string; desc: string }[] = [
    { key: 'openRecentOnStart', label: '默认进入最近会话', desc: '打开工作台时自动恢复上次的活跃会话' },
    { key: 'notifyTaskDone', label: '任务完成提醒', desc: '模拟任务完成时在会话列表更新状态' },
    { key: 'notifyDocReady', label: '文书生成提醒', desc: '生成文书后标记会话状态为处理中' },
    { key: 'demoMode', label: '模拟模式', desc: '显示环境横幅与模拟数据标识（始终为模拟环境）' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingTop: 4 }}>
      {items.map((item) => {
        const patch: Partial<ConversationSettings> = {};
        return (
          <div key={item.key}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 13.5, fontWeight: 600, color: '#2a3444' }}>{item.label}</span>
              <Radio.Group
                size="small"
                value={settings[item.key] ? 'on' : 'off'}
                onChange={(e) => {
                  patch[item.key] = e.target.value === 'on';
                  updateSettings(patch);
                }}
              >
                <Radio.Button value="on">开</Radio.Button>
                <Radio.Button value="off">关</Radio.Button>
              </Radio.Group>
            </div>
            <div style={{ fontSize: 12, color: '#8a94a6', marginTop: 4 }}>{item.desc}</div>
          </div>
        );
      })}
      <div style={{ fontSize: 12, color: '#a0a8b8' }}>
        以上均为模拟环境的轻量设置（模拟数据），不连接真实通知渠道。
      </div>
    </div>
  );
}

export default function GlobalSidebar() {
  const { token } = theme.useToken();
  const { message, modal } = AntdApp.useApp();
  const conversations = useConversationStore((s) => s.conversations);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const activeNav = useConversationStore((s) => s.activeNav);
  const selectConversation = useConversationStore((s) => s.selectConversation);
  const createConversation = useConversationStore((s) => s.createConversation);
  const deleteConversation = useConversationStore((s) => s.deleteConversation);
  const setActiveNav = useConversationStore((s) => s.setActiveNav);
  const actorId = useDemoStore((s) => s.actorId);
  const setActor = useDemoStore((s) => s.setActor);
  const globalBanner = useDemoStore((s) => s.globalBanner);
  const currentEventId = useDemoStore((s) => s.currentEventId);
  const scope = useActiveScope();
  const session = useSessionStore((s) => s.sessions[s.sessionByConversation[activeConversationId ?? ''] ?? '']);
  const setMode = useWorkspaceStore((s) => s.setMode);

  const [keyword, setKeyword] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);

  /** 未保存编辑保护：关闭 / 切换文书、会话或导航前确认（取消保留编辑，放弃才丢弃）。 */
  const guardDirty = useCallback(
    (title: string, onProceed: () => void) => {
      if (!useWorkspaceStore.getState().isDirty(scope)) {
        onProceed();
        return;
      }
      modal.confirm({
        title: '有未保存的文书修改',
        content: `当前文书正在编辑（${title}）。继续将放弃这些修改。`,
        okText: '放弃修改并继续',
        cancelText: '继续编辑',
        okButtonProps: { danger: true },
        onOk: () => {
          useWorkspaceStore.getState().setDirty(scope, false);
          useWorkspaceStore.getState().close(scope);
          onProceed();
        },
      });
    },
    [modal, scope],
  );

  // 新建：新建任务 → 工作模式；新建应急对话 → 对话模式（一次操作决定实际模式）。
  const handleNew = (mode: WorkMode) => {
    const samePrefix = Object.values(conversations).filter((c) => c.title.startsWith('新的应急对话')).length;
    const conversation = createConversation({
      title: samePrefix === 0 ? '新的应急对话' : `新的应急对话 ${samePrefix + 1}`,
      type: mode === 'work' ? 'daily' : 'general',
      status: 'active',
    });
    selectConversation(conversation.id);
    const nextScope =
      useSessionStore.getState().sessionByConversation[conversation.id] ?? conversation.id;
    setMode(nextScope, mode);
    message.success(
      mode === 'work'
        ? `已创建「${conversation.title}」（工作模式：任务与文书建议，模拟）`
        : `已创建「${conversation.title}」（对话模式：问答建议，模拟）`,
    );
  };

  const openLibrary = () => guardDirty('切换到文书库', () => setActiveNav('library'));

  const list = useMemo(
    () => Object.values(conversations).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [conversations],
  );
  const filtered = useMemo(() => list.filter((c) => matchConversation(c, keyword)), [list, keyword]);

  const groups = useMemo(() => {
    const map = new Map<ConversationGroup, Conversation[]>();
    for (const c of filtered) {
      const g = groupOf(c);
      const arr = map.get(g) ?? [];
      arr.push(c);
      map.set(g, arr);
    }
    return (['today', 'yesterday', 'earlier'] as ConversationGroup[])
      .map((g) => ({ group: g, items: map.get(g) ?? [] }))
      .filter((entry) => entry.items.length > 0);
  }, [filtered]);

  return (
    <div
      className="axn-global-sidebar"
      data-testid="global-sidebar"
      style={{
        '--nav-primary': token.colorPrimary,
        '--nav-tint': token.colorPrimaryBg,
        '--nav-text': token.colorText,
        '--nav-muted': token.colorTextSecondary,
        '--nav-border': token.colorBorderSecondary,
        '--nav-surface': token.colorBgContainer,
        '--nav-soft': '#f6f7f9',
        '--nav-error': token.colorError,
      } as React.CSSProperties}
    >
      {/* 1. 品牌区（左上，保留安小能身份与模拟环境标识） */}
      <div className="axn-gs-brand">
        <span className="axn-gs-brand-mark">安</span>
        <span className="axn-gs-brand-copy">
          <span className="axn-gs-brand-name">安小能 · 应急智能工作台</span>
          <span className="axn-gs-brand-sub">{globalBanner}</span>
        </span>
      </div>

      {/* 2. 一级功能导航（含独立文书库） */}
      <nav className="axn-gs-nav" aria-label="全局功能导航">
        {NAV.map((item) => (
          <button
            key={item.key}
            className={`axn-gs-nav-item${activeNav === item.key ? ' is-active' : ''}`}
            aria-current={activeNav === item.key ? 'page' : undefined}
            onClick={() => {
              if (item.key === 'library') {
                openLibrary();
                return;
              }
              guardDirty('切换导航页', () => setActiveNav(item.key as NavPage));
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* 3. 新建：一次操作各自决定实际模式 */}
      <div className="axn-gs-new">
        <Button
          className="axn-gs-nav-item axn-gs-new-btn axn-gs-new-btn--solid"
          type="default"
          icon={<FileAddOutlined />}
          onClick={() => guardDirty('新建任务', () => handleNew('work'))}
          data-testid="new-task-btn"
        >
          新建任务
        </Button>
        <Button
          className="axn-gs-new-btn"
          type="default"
          icon={<PlusOutlined />}
          onClick={() => guardDirty('新建应急对话', () => handleNew('chat'))}
          data-testid="new-conversation-btn"
        >
          新建应急对话
        </Button>
      </div>

      {/* 4. 对话搜索 */}
      <div className="axn-gs-search">
        <Input
          allowClear
          prefix={<SearchOutlined style={{ color: '#a0a8b8' }} />}
          placeholder="搜索对话或事件"
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          data-testid="conversation-search"
        />
      </div>

      {/* 5. 历史会话 */}
      <div className="axn-gs-history" data-testid="conversation-history">
        {filtered.length === 0 ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={keyword ? `未找到与「${keyword}」匹配的会话` : '暂无历史会话'}
            style={{ marginTop: 32 }}
          />
        ) : (
          groups.map(({ group, items }) => (
            <div key={group}>
              <div className="axn-gs-group-label">{GROUP_LABEL[group]}</div>
              {items.map((c) => (
                <ConversationRow
                  key={c.id}
                  conversation={c}
                  active={c.id === activeConversationId}
                  onSelect={() => guardDirty('切换会话', () => selectConversation(c.id))}
                  onDelete={() => guardDirty('删除会话', () => deleteConversation(c.id))}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* 6. 底部工具区：当前事件 / 角色 / 设置 */}
      <div className="axn-gs-footer">
        <div className="axn-gs-event" data-testid="header-event">
          当前事件：<strong>{session ? session.title : currentEventId}</strong>
        </div>
        <div className="axn-gs-footer-row">
          <Select
            size="small"
            value={actorId}
            onChange={setActor}
            aria-label="切换角色"
            options={actors.map((a) => ({ value: a.actorId, label: `${a.name} · ${a.role === 'duty' ? '值班员' : '指挥员'}`, title: a.name }))}
          />
        </div>
        <button className="axn-gs-nav-item" onClick={() => setSettingsOpen(true)}>
          <SettingOutlined />
          <span>对话与通知设置</span>
        </button>
      </div>

      <Modal
        title="对话与通知设置"
        open={settingsOpen}
        onCancel={() => setSettingsOpen(false)}
        footer={null}
        width={440}
      >
        <ConversationSettingsPanel />
      </Modal>
    </div>
  );
}

function ConversationRow({
  conversation,
  active,
  onSelect,
  onDelete,
}: {
  conversation: Conversation;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      role="button"
      tabIndex={0}
      className={`axn-gs-conversation${active ? ' is-active' : ''}`}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onSelect();
        }
      }}
      data-testid={`conversation-${conversation.id}`}
      data-active={active ? 'true' : 'false'}
      aria-current={active ? 'true' : undefined}
    >
      <div className="axn-gs-conversation-title">
        <span className="axn-gs-conv-title-text">{conversation.title}</span>
        <div className="axn-gs-conv-actions" onClick={(e) => e.stopPropagation()}>
          <Popconfirm
            title="删除该对话？"
            description="仅移除会话条目，不影响事件业务数据。"
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
            onConfirm={(e) => {
              e?.stopPropagation();
              onDelete();
            }}
            onCancel={(e) => e?.stopPropagation()}
          >
            <button
              className="axn-gs-conv-action"
              aria-label={`删除对话 ${conversation.title}`}
              onClick={(e) => e.stopPropagation()}
            >
              <DeleteOutlined />
            </button>
          </Popconfirm>
        </div>
      </div>
      <div className="axn-gs-conversation-sub">
        <span className="axn-gs-conv-summary">
          {conversation.summary ?? (conversation.eventId ? eventDisplayName(conversation.eventId) : '模拟会话')}
        </span>
        <span className="axn-gs-conv-time">{formatConversationTime(conversation)}</span>
      </div>
    </div>
  );
}
