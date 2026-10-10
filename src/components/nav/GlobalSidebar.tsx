/**
 * 全局导航 + 对话历史管理侧栏（UI 改版）：
 * 区域：品牌 / 新建 / 一级导航 / 建设四智能体（点选后下方仅展示关联可选事件）/
 * 搜索 / 历史会话 / 底部账户区。
 * 全部数据为模拟数据。
 */
import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { NAV_PATH } from './navRoutes';
import {
  Bot,
  ClipboardCheck,
  // Clock, // 恢复「定时任务」侧栏入口时一并取回
  // FilePlus, // 恢复「新建任务」按钮时一并取回
  // FlaskConical, // 恢复「知识库」侧栏入口时一并取回
  Flame,
  FolderOpen,
  // LayoutGrid, // 恢复「应急项目」侧栏入口时一并取回
  LayoutGrid,
  Lightbulb,
  MonitorSmartphone,
  Smartphone,
  Pin,
  Plus,
  RotateCcw,
  Search,
  Settings,
  Sparkles,
  Trash2,
  Wrench,
} from 'lucide-react'
import { App as AntdApp, Avatar, Button, Divider, Drawer, Dropdown, Empty, Input, Popconfirm, Radio, Tooltip } from 'antd';
import type { Conversation, ConversationSettings, NavPage } from '@/domain/types';
import {
  GROUP_LABEL,
  groupOf,
  matchConversation,
  useConversationStore,
  type ConversationGroup,
} from '@/store/conversationStore';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { useActiveScope, useWorkspaceStore, type WorkMode } from '@/store/workspaceStore';
import { resetDemoData } from '@/store/resetDemo';
import { actors } from '@/seed/scenario';
import {
  conversationMatchesAgent,
  matchEventKeyword,
  optionalEventsForAgent,
  SIDEBAR_AGENTS,
  type SidebarAgentId,
} from '@/services/sidebarAgentFilter';
import type { VueWorkspaceEventMeta } from '@/seed/vueWorkspaceEvents';
import './sidebar.css';

const SIDEBAR_AGENT_ICONS: Record<SidebarAgentId, ReactNode> = {
  situation: <Flame size={14} />,
  resource: <Wrench size={14} />,
  plan: <Lightbulb size={14} />,
  evaluation: <ClipboardCheck size={14} />,
};

type NavKey = NavPage;

const NAV: { key: NavKey; label: string; icon: ReactNode }[] = [
  { key: 'library', label: '文书库', icon: <FolderOpen /> },
  { key: 'assistant', label: '智能助理', icon: <Sparkles /> },
  // 「应急项目」「定时任务」「知识库」三个入口按下线标注从侧栏隐藏：
  // 页面（NavPages）与路由（/projects、/agents、/schedules、/knowledge）全部保留，深链直达仍可用；
  // 取消下列注释并取回对应图标导入（LayoutGrid / Clock / FlaskConical）即可恢复侧栏入口。
  // { key: 'projects', label: '应急项目', icon: <LayoutGrid /> },
  { key: 'agents', label: '智能体与 Skill', icon: <Bot /> },
  // { key: 'schedules', label: '定时任务', icon: <Clock /> },
  // { key: 'knowledge', label: '知识库', icon: <FlaskConical /> },
];

/** 非 NavPage 的侧栏快捷入口（门户 / 一期嵌入 / 手机工作台等独立全屏页）。 */
const EXTRA_NAV: { path: string; label: string; icon: ReactNode; testId: string }[] = [
  {
    path: '/portal',
    label: '桌面门户入口',
    icon: <LayoutGrid size={16} />,
    testId: 'nav-desktop-portal',
  },
  {
    path: '/phase1/coordination',
    label: '一期系统嵌入',
    icon: <MonitorSmartphone size={16} />,
    testId: 'nav-phase1-host',
  },
  {
    path: '/mobile',
    label: '手机工作台嵌入',
    icon: <Smartphone size={16} />,
    testId: 'nav-mobile-workbench',
  },
];

/** 对话与通知设置（轻量展示，需求 2.6）+ 演示数据重置入口（现场一键回到初始场景）。 */
export function ConversationSettingsPanel({ onDone }: { onDone?: () => void } = {}) {
  const settings = useConversationStore((s) => s.settings);
  const updateSettings = useConversationStore((s) => s.updateSettings);
  const { message } = AntdApp.useApp();
  const navigate = useNavigate();
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
              <span style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--axn-text)' }}>{item.label}</span>
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
            <div style={{ fontSize: 'var(--fs-body)', color: 'var(--axn-muted)', marginTop: 4 }}>{item.desc}</div>
          </div>
        );
      })}
      <div style={{ fontSize: 'var(--fs-body)', color: 'var(--axn-muted)' }}>
        以上均为模拟环境的轻量设置（模拟数据），不连接真实通知渠道。
      </div>

      <Divider style={{ margin: 0 }} />

      <div>
        <div style={{ fontSize: 'var(--fs-body)', fontWeight: 600, color: 'var(--axn-text)' }}>演示数据</div>
        <div style={{ fontSize: 'var(--fs-body)', color: 'var(--axn-muted)', margin: '4px 0 8px' }}>
          把模拟会话、文书与工作台状态全部恢复为初始场景，便于重新演示（不可撤销）。
        </div>
        <Popconfirm
          title="重置演示数据？"
          description="当前模拟会话、文书、审计记录与工作台状态都会回到初始场景。"
          okText="确认重置"
          cancelText="取消"
          okButtonProps={{ danger: true }}
          onConfirm={() => {
            resetDemoData();
            // 重置后导航也回到首页；URL 是唯一权威，所以这里显式跳转（store 不再回推 URL）。
            navigate(NAV_PATH.assistant);
            message.success('已恢复为初始演示数据。');
            onDone?.();
          }}
        >
          <Button danger size="small" icon={<RotateCcw />}>
            重置演示数据
          </Button>
        </Popconfirm>
      </div>
    </div>
  );
}

export default function GlobalSidebar() {
  const { message, modal } = AntdApp.useApp();
  const conversations = useConversationStore((s) => s.conversations);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const activeNav = useConversationStore((s) => s.activeNav);
  const navigate = useNavigate();
  const selectConversation = useConversationStore((s) => s.selectConversation);
  const createConversation = useConversationStore((s) => s.createConversation);
  const deleteConversation = useConversationStore((s) => s.deleteConversation);
  const toggleConversationPin = useConversationStore((s) => s.toggleConversationPin);
  const actorId = useDemoStore((s) => s.actorId);
  const setActor = useDemoStore((s) => s.setActor);
  const actor = useDemoStore((s) => s.getActor());
  const globalBanner = useDemoStore((s) => s.globalBanner);
  const scope = useActiveScope();
  const setMode = useWorkspaceStore((s) => s.setMode);

  const [keyword, setKeyword] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  /** null=全部会话；选中建设智能体后仅展示关联可选事件（及匹配阶段的会话） */
  const [activeAgentId, setActiveAgentId] = useState<SidebarAgentId | null>(null);

  /** 未保存编辑保护：关闭 / 切换文书、会话或导航前确认（取消保留编辑；继续也不丢弃，工作副本仍在 store 里）。 */
  const guardDirty = useCallback(
    (title: string, onProceed: () => void) => {
      if (!useWorkspaceStore.getState().isDirty(scope)) {
        onProceed();
        return;
      }
      modal.confirm({
        title: '有未保存的文书修改',
        content: `当前文书正在编辑（${title}）。继续不会丢弃修改，改动保留在本次会话（尚未保存）。`,
        okText: '继续',
        cancelText: '继续编辑',
        onOk: () => {
          useWorkspaceStore.getState().setDirty(scope, false);
          useWorkspaceStore.getState().close(scope);
          onProceed();
        },
      });
    },
    [modal, scope],
  );

  // 新建对话 → 对话模式（handleNew 亦支持工作模式，其入口见下方注释）。
  const handleNew = (mode: WorkMode) => {
    const samePrefix = Object.values(conversations).filter((c) => c.title.startsWith('新的对话')).length;
    const conversation = createConversation({
      title: samePrefix === 0 ? '新的对话' : `新的对话 ${samePrefix + 1}`,
      type: mode === 'work' ? 'daily' : 'general',
      status: 'active',
    });
    selectConversation(conversation.id);
    navigate(NAV_PATH.assistant);
    const nextScope =
      useSessionStore.getState().sessionByConversation[conversation.id] ?? conversation.id;
    setMode(nextScope, mode);
    message.success(
      mode === 'work'
        ? `已创建「${conversation.title}」（工作模式：任务与文书建议，模拟）`
        : `已创建「${conversation.title}」（对话模式：问答建议，模拟）`,
    );
  };

  const openLibrary = () => guardDirty('切换到文书库', () => navigate(NAV_PATH.library));

  const list = useMemo(
    () => Object.values(conversations).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [conversations],
  );
  const filtered = useMemo(
    () => list.filter(
      (c) => !/值班|值守/.test(c.title)
        && matchConversation(c, keyword)
        && conversationMatchesAgent(c, activeAgentId),
    ),
    [list, keyword, activeAgentId],
  );

  const relatedEvents = useMemo(() => {
    if (!activeAgentId) return [] as VueWorkspaceEventMeta[];
    return optionalEventsForAgent(activeAgentId).filter((e) => matchEventKeyword(e, keyword));
  }, [activeAgentId, keyword]);

  const groups = useMemo(() => {
    const map = new Map<ConversationGroup, Conversation[]>();
    for (const c of filtered) {
      const g = groupOf(c);
      const arr = map.get(g) ?? [];
      arr.push(c);
      map.set(g, arr);
    }
    return (['pinned', 'today', 'yesterday', 'earlier'] as ConversationGroup[])
      .map((g) => ({ group: g, items: map.get(g) ?? [] }))
      .filter((entry) => entry.items.length > 0);
  }, [filtered]);

  const openEventConversation = useCallback((event: VueWorkspaceEventMeta) => {
    guardDirty('关联事件并对话', () => {
      const existing = Object.values(useConversationStore.getState().conversations)
        .filter((c) => c.eventId === event.eventId)
        .sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1))[0];
      if (existing) {
        selectConversation(existing.id);
      } else {
        const conversation = createConversation({
          title: event.name,
          type: 'emergency',
          eventId: event.eventId,
          summary: `${event.stage} · ${event.category}`,
          status: 'active',
        });
        selectConversation(conversation.id);
      }
      navigate(NAV_PATH.assistant);
    });
  }, [guardDirty, selectConversation, createConversation, navigate]);

  return (
    // 颜色统一走 main.tsx 注入 :root 的 --axn-*：这里原先另起了一套侧栏级局部变量，
    // 但它们只挂在侧栏这个 div 上 —— <main> 里的 NavPages 与 portal 出去的抽屉内容
    // 都继承不到，那些引用实际取不到值（颜色静默回退到继承色）。已整体并入 --axn-*。
    <div className="axn-global-sidebar" data-testid="global-sidebar">
      {/* 1. 品牌区（左上，保留安小能身份与模拟环境标识） */}
      <div className="axn-gs-brand">
        <span className="axn-gs-brand-mark">安</span>
        <span className="axn-gs-brand-copy">
          <span className="axn-gs-brand-name">安小能 · 应急智能工作台</span>
          <span className="axn-gs-brand-sub">{globalBanner}</span>
        </span>
      </div>

      {/* 2. 新建：主要动作置顶，紧跟品牌 */}
      <div className="axn-gs-new">
        {/* 「新建任务」（工作模式入口）暂时下线：handleNew('work') 与工作模式实现全部保留，
            取消本段注释即可恢复（同时取回顶部 FilePlus 图标导入）。 */}
        {/*
        <Button
          className="axn-gs-new-btn axn-gs-new-btn--solid"
          type="default"
          icon={<FilePlus />}
          onClick={() => guardDirty('新建任务', () => handleNew('work'))}
          data-testid="new-task-btn"
        >
          新建任务
        </Button>
        */}
        <Button
          className="axn-gs-new-btn axn-gs-new-btn--solid"
          type="default"
          icon={<Plus />}
          onClick={() => guardDirty('新建对话', () => handleNew('chat'))}
          data-testid="new-conversation-btn"
        >
          新建对话
        </Button>
      </div>

      {/* 3. 一级功能导航（含独立文书库） */}
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
              guardDirty('切换导航页', () => navigate(`/${item.key}`));
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
        {EXTRA_NAV.map((item) => (
          <button
            key={item.path}
            className="axn-gs-nav-item"
            data-testid={item.testId}
            onClick={() => guardDirty('打开一期系统嵌入', () => navigate(item.path))}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      {/* 4. 建设四智能体：点击后下方仅展示该智能体阶段关联的可选事件 */}
      <div className="axn-gs-agents" data-testid="sidebar-agents">
        <div className="axn-gs-agents-head">
          <span>建设智能体</span>
          {activeAgentId ? (
            <button
              type="button"
              className="axn-gs-agents-clear"
              onClick={() => setActiveAgentId(null)}
              data-testid="sidebar-agent-clear"
            >
              全部
            </button>
          ) : null}
        </div>
        <div className="axn-gs-agents-grid" role="listbox" aria-label="建设智能体筛选">
          {SIDEBAR_AGENTS.map((agent) => {
            const active = activeAgentId === agent.id;
            return (
              <button
                key={agent.id}
                type="button"
                role="option"
                aria-selected={active}
                className={`axn-gs-agent-chip${active ? ' is-active' : ''}`}
                title={`${agent.name} · ${agent.scene}`}
                data-testid={`sidebar-agent-${agent.id}`}
                onClick={() => {
                  setActiveAgentId((prev) => (prev === agent.id ? null : agent.id));
                  if (activeNav !== 'assistant') {
                    guardDirty('切换到智能助理', () => navigate(NAV_PATH.assistant));
                  }
                }}
              >
                <span className="axn-gs-agent-chip-icon" aria-hidden>
                  {SIDEBAR_AGENT_ICONS[agent.id]}
                </span>
                <span className="axn-gs-agent-chip-text">
                  <span className="axn-gs-agent-chip-name">{agent.shortName}</span>
                  <span className="axn-gs-agent-chip-scene">{agent.scene}</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* 5. 对话搜索 */}
      <div className="axn-gs-search">
        <Input
          allowClear
          prefix={<Search style={{ color: 'var(--axn-faint)' }} />}
          placeholder={activeAgentId ? '搜索关联事件' : '搜索对话或事件'}
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          data-testid="conversation-search"
        />
      </div>

      {/* 6. 历史会话 / 智能体关联可选事件 */}
      <div className="axn-gs-history" data-testid="conversation-history">
        {activeAgentId ? (
          relatedEvents.length === 0 ? (
            <Empty
              image={Empty.PRESENTED_IMAGE_SIMPLE}
              description={keyword ? `未找到与「${keyword}」匹配的关联事件` : '暂无该智能体关联的可选事件'}
              style={{ marginTop: 32 }}
            />
          ) : (
            <div data-testid="sidebar-related-events">
              <div className="axn-gs-group-label">
                {SIDEBAR_AGENTS.find((a) => a.id === activeAgentId)?.scene ?? '关联'} · 可选事件
              </div>
              {relatedEvents.map((event) => {
                const linked = filtered.find((c) => c.eventId === event.eventId);
                const active = linked?.id === activeConversationId;
                return (
                  <button
                    key={event.eventId}
                    type="button"
                    className={`axn-gs-event${active ? ' is-active' : ''}`}
                    data-testid={`sidebar-event-${event.eventId}`}
                    aria-current={active ? 'true' : undefined}
                    onClick={() => openEventConversation(event)}
                  >
                    <span className="axn-gs-event-title">{event.name}</span>
                    <span className="axn-gs-event-meta">
                      {event.stage} · {event.category}
                      {linked ? ' · 已有会话' : ''}
                    </span>
                  </button>
                );
              })}
            </div>
          )
        ) : filtered.length === 0 ? (
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
                  onSelect={() =>
                    guardDirty('切换会话', () => {
                      selectConversation(c.id);
                      navigate(NAV_PATH.assistant);
                    })
                  }
                  onDelete={() => guardDirty('删除会话', () => deleteConversation(c.id))}
                  onTogglePin={() => toggleConversationPin(c.id)}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/*
       * 6. 底部账户区：左侧当前用户（头像 + 两行：上行模拟用户名、下行身份），右侧设置按钮。
       * 设置按钮承载两项：切换用户身份（原底部角色下拉）与对话与通知设置（原底部入口），
       * 避免底部堆叠多个入口。（关联事件改在对话区头部显示，不占侧栏）
       */}
      <div className="axn-gs-footer">
        <div className="axn-gs-account">
          <Avatar className="axn-gs-account-avatar" size={28}>
            {actor.userName.slice(0, 1)}
          </Avatar>
          <span className="axn-gs-account-meta">
            <span className="axn-gs-account-name">
              {actor.userName}
            </span>
            <span className="axn-gs-account-identity">
              {actor.name}
            </span>
          </span>
          <Dropdown
            trigger={['click']}
            placement="topRight"
            menu={{
              selectable: true,
              selectedKeys: [actorId],
              items: [
                {
                  type: 'group',
                  label: '切换用户身份',
                  children: actors.map((a) => ({ key: a.actorId, label: <span title={a.name}>{a.name}</span> })),
                },
                { type: 'divider' },
                { key: 'conversation-settings', icon: <Settings size={14} />, label: '对话与通知设置' },
              ],
              onClick: ({ key }) => {
                if (key === 'conversation-settings') setSettingsOpen(true);
                else setActor(key);
              },
            }}
          >
            <button className="axn-gs-account-settings" data-testid="account-settings" aria-label="用户与设置" title="用户与设置">
              <Settings size={15} />
            </button>
          </Dropdown>
        </div>
      </div>

      {/*
       * 设置属于「有内容的二级视图」→ 用 Drawer 承载（Modal 仅用于轻量确认与短表单）。
       * 反馈范式：message=瞬时结果 / notification=需处理的失败 / Popconfirm·Modal.confirm=破坏性确认。
       */}
      <Drawer
        title="对话与通知设置"
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        size={440}
      >
        <ConversationSettingsPanel onDone={() => setSettingsOpen(false)} />
      </Drawer>
    </div>
  );
}

function ConversationRow({
  conversation,
  active,
  onSelect,
  onDelete,
  onTogglePin,
}: {
  conversation: Conversation;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onTogglePin: () => void;
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
          <Tooltip title={conversation.pinned ? '取消置顶' : '置顶对话'}>
            <button
              className="axn-gs-conv-action axn-gs-conv-action--pin"
              aria-label={`${conversation.pinned ? '取消置顶' : '置顶'}对话 ${conversation.title}`}
              aria-pressed={conversation.pinned ? 'true' : 'false'}
              onClick={(e) => {
                e.stopPropagation();
                onTogglePin();
              }}
            >
              <Pin />
            </button>
          </Tooltip>
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
              <Trash2 />
            </button>
          </Popconfirm>
        </div>
      </div>
    </div>
  );
}
