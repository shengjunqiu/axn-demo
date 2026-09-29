/**
 * 全局导航 + 对话历史管理侧栏（需求一/二/三）。
 * 六个区域：品牌区 / 一级功能导航 / 新建应急对话 / 对话搜索 / 历史会话 / 底部工具区。
 * 支持 56px 折叠态（仅图标 + Tooltip）。全部数据为模拟数据。
 */
import { useMemo, useState } from 'react';
import {
  AppstoreOutlined,
  ClockCircleOutlined,
  DingtalkOutlined,
  ExperimentOutlined,
  FileAddOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PlusOutlined,
  RobotOutlined,
  SearchOutlined,
  SettingOutlined,
  StarFilled,
  StarOutlined,
} from '@ant-design/icons';
import { App as AntdApp, Badge, Button, Empty, Input, Modal, Popover, Radio, Tag, Tooltip } from 'antd';
import type { Conversation, ConversationSettings, ConversationStatus, NavPage } from '@/domain/types';
import {
  GROUP_LABEL,
  formatConversationTime,
  groupOf,
  matchConversation,
  useConversationStore,
  type ConversationGroup,
} from '@/store/conversationStore';
import { eventDisplayName } from '@/services/factLookup';
import './sidebar.css';

type NavKey = NavPage | 'new';

const NAV: { key: NavKey; label: string; icon: React.ReactNode }[] = [
  { key: 'new', label: '新建任务', icon: <FileAddOutlined /> },
  { key: 'assistant', label: '智能助理', icon: <DingtalkOutlined /> },
  { key: 'projects', label: '应急项目', icon: <AppstoreOutlined /> },
  { key: 'agents', label: '智能体与 Skill', icon: <RobotOutlined /> },
  { key: 'schedules', label: '定时任务', icon: <ClockCircleOutlined /> },
  { key: 'knowledge', label: '知识库', icon: <ExperimentOutlined /> },
];

const STATUS_TAG: Record<ConversationStatus, { label: string; color: string }> = {
  active: { label: '处理中', color: 'processing' },
  processing: { label: '研判中', color: 'blue' },
  completed: { label: '已完成', color: 'success' },
  draft: { label: '草稿', color: 'default' },
};

export interface CreateTemplate {
  key: string;
  label: string;
  title: string;
  type: Conversation['type'];
  eventId?: string;
  summary?: string;
  status?: ConversationStatus;
  desc: string;
}

/** 新建应急对话模板（需求 2.3）。 */
export const CREATE_TEMPLATES: CreateTemplate[] = [
  { key: 'blank', label: '空白对话', title: '新的应急对话', type: 'general', summary: '空白对话', desc: '不带预设上下文，自由开始' },
  { key: 'nandi', label: '南堤堤防管涌险情', title: '南堤堤防管涌险情', type: 'emergency', eventId: 'evt-demo-001', summary: '研判任务进行中', status: 'processing', desc: '绑定清河段堤防险情事件上下文' },
  { key: 'water', label: '河流水位上涨预警', title: '河流水位上涨预警', type: 'emergency', eventId: 'evt-demo-002', summary: '预警信息整理', status: 'processing', desc: '绑定城镇内涝/水位预警事件上下文' },
  { key: 'dispatch', label: '防汛资源调度', title: '防汛资源调度', type: 'resource', eventId: 'evt-demo-001', summary: '资源调度会话', status: 'active', desc: '面向资源查询与调度的会话' },
  { key: 'daily', label: '值班日报整理', title: '值班日报整理', type: 'daily', eventId: 'evt-demo-001', summary: '值班信息整理', status: 'draft', desc: '面向值班日报生成的会话' },
];

/** 新建会话 Modal（"新建任务"菜单与"新建应急对话"按钮共用）。 */
export function CreateConversationModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const createConversation = useConversationStore((s) => s.createConversation);
  const { message } = AntdApp.useApp();

  const handleCreate = (template: CreateTemplate) => {
    const conversation = createConversation({
      title: template.title,
      type: template.type,
      eventId: template.eventId,
      summary: template.summary,
      status: template.status,
    });
    onClose();
    message.success(`已创建会话「${conversation.title}」（模拟）`);
  };

  return (
    <Modal
      title="新建应急对话"
      open={open}
      onCancel={onClose}
      footer={null}
      width={520}
      data-testid="create-conversation-modal"
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingTop: 4 }}>
        {CREATE_TEMPLATES.map((t) => (
          <button
            key={t.key}
            className="axn-gs-template-row"
            onClick={() => handleCreate(t)}
            data-testid={`template-${t.key}`}
          >
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: '#2a3444' }}>{t.label}</div>
              <div style={{ fontSize: 12, color: '#8a94a6', marginTop: 2 }}>{t.desc}</div>
            </div>
            {t.eventId && <Tag style={{ flexShrink: 0 }}>{eventDisplayName(t.eventId)}</Tag>}
          </button>
        ))}
        <div style={{ fontSize: 12, color: '#a0a8b8', paddingTop: 4 }}>
          全部为模拟数据；创建后自动进入智能助理并切换到对应事件上下文。
        </div>
      </div>
    </Modal>
  );
}

/** 对话与通知设置（轻量展示，需求 2.6）。 */
export function ConversationSettingsPanel() {
  const settings = useConversationStore((s) => s.settings);
  const updateSettings = useConversationStore((s) => s.updateSettings);
  const items: { key: keyof ConversationSettings; label: string; desc: string }[] = [
    { key: 'openRecentOnStart', label: '默认进入最近会话', desc: '打开工作台时自动恢复上次的活跃会话' },
    { key: 'notifyTaskDone', label: '任务完成提醒', desc: '模拟任务完成时在会话列表更新状态' },
    { key: 'notifyDocReady', label: '文书生成提醒', desc: '生成文书后标记会话状态为处理中' },
    { key: 'demoMode', label: '演示模式', desc: '显示演示横幅与模拟数据标识（始终为模拟环境）' },
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18, paddingTop: 4 }}>
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
        以上均为演示环境的轻量设置（模拟数据），不连接真实通知渠道。
      </div>
    </div>
  );
}

export default function GlobalSidebar({ onCreateClick }: { onCreateClick: () => void }) {
  const conversations = useConversationStore((s) => s.conversations);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const activeNav = useConversationStore((s) => s.activeNav);
  const collapsed = useConversationStore((s) => s.collapsed);
  const selectConversation = useConversationStore((s) => s.selectConversation);
  const toggleFavorite = useConversationStore((s) => s.toggleFavorite);
  const setActiveNav = useConversationStore((s) => s.setActiveNav);
  const setCollapsed = useConversationStore((s) => s.setCollapsed);
  const [keyword, setKeyword] = useState('');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [favOpen, setFavOpen] = useState(false);

  const list = useMemo(
    () => Object.values(conversations).sort((a, b) => (a.updatedAt < b.updatedAt ? 1 : -1)),
    [conversations],
  );
  const filtered = useMemo(() => list.filter((c) => matchConversation(c, keyword)), [list, keyword]);
  const favorites = useMemo(() => list.filter((c) => c.favorite), [list]);

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
    <div className={`axn-global-sidebar${collapsed ? ' is-collapsed' : ''}`} data-testid="global-sidebar">
      {/* 1. 品牌区 */}
      <div className="axn-gs-brand">
        <div className="axn-gs-brand-logo">安</div>
        {!collapsed && (
          <div style={{ minWidth: 0 }}>
            <div className="axn-gs-brand-title">安小能</div>
            <div className="axn-gs-brand-sub">应急协同工作空间</div>
          </div>
        )}
        <Tooltip title={collapsed ? '展开导航' : '收起导航'} placement="right">
          <Button
            className="axn-gs-collapse-btn"
            type="text"
            size="small"
            aria-label={collapsed ? '展开导航' : '收起导航'}
            icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
            onClick={() => setCollapsed(!collapsed)}
          />
        </Tooltip>
      </div>

      {/* 2. 一级功能导航 */}
      <nav className="axn-gs-nav" aria-label="全局功能导航">
        {NAV.map((item) =>
          collapsed ? (
            <Tooltip key={item.key} title={item.label} placement="right">
              <button
                className={`axn-gs-nav-item${activeNav === item.key ? ' is-active' : ''}`}
                onClick={() => (item.key === 'new' ? onCreateClick() : setActiveNav(item.key))}
                aria-label={item.label}
              >
                {item.icon}
              </button>
            </Tooltip>
          ) : (
            <button
              key={item.key}
              className={`axn-gs-nav-item${activeNav === item.key ? ' is-active' : ''}`}
              onClick={() => (item.key === 'new' ? onCreateClick() : setActiveNav(item.key))}
            >
              {item.icon}
              <span>{item.label}</span>
            </button>
          ),
        )}
      </nav>

      {!collapsed && (
        <>
          {/* 3. 新建应急对话 */}
          <div className="axn-gs-new">
            <Button
              className="axn-gs-new-btn"
              type="default"
              icon={<PlusOutlined />}
              onClick={onCreateClick}
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
                      onSelect={() => selectConversation(c.id)}
                      onToggleFavorite={() => toggleFavorite(c.id)}
                    />
                  ))}
                </div>
              ))
            )}
          </div>

          {/* 6. 底部工具区 */}
          <div className="axn-gs-footer">
            <Popover
              title="我的收藏"
              trigger="click"
              open={favOpen}
              onOpenChange={setFavOpen}
              placement="topRight"
              content={
                favorites.length === 0 ? (
                  <span style={{ fontSize: 12, color: '#8a94a6' }}>
                    暂无收藏会话（hover 会话条目可星标收藏）
                  </span>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4, maxHeight: 260, overflowY: 'auto' }}>
                    {favorites.map((c) => (
                      <button
                        key={c.id}
                        className="axn-gs-nav-item"
                        style={{ height: 34, fontSize: 12.5, width: 220 }}
                        onClick={() => {
                          selectConversation(c.id);
                          setFavOpen(false);
                        }}
                      >
                        <StarFilled style={{ color: '#d48806' }} />
                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {c.title}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              }
            >
              <button className="axn-gs-nav-item" style={{ height: 34 }}>
                <Badge count={favorites.length} size="small" offset={[6, 0]}>
                  <StarOutlined />
                </Badge>
                <span>我的收藏</span>
              </button>
            </Popover>
            <button className="axn-gs-nav-item" style={{ height: 34 }} onClick={() => setSettingsOpen(true)}>
              <SettingOutlined />
              <span>对话与通知设置</span>
            </button>
          </div>
        </>
      )}

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
  onToggleFavorite,
}: {
  conversation: Conversation;
  active: boolean;
  onSelect: () => void;
  onToggleFavorite: () => void;
}) {
  const status = STATUS_TAG[conversation.status];
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
        <Tag color={status.color} style={{ fontSize: 10, lineHeight: '16px', padding: '0 5px', marginInlineEnd: 0, flexShrink: 0 }}>
          {status.label}
        </Tag>
      </div>
      <div className="axn-gs-conversation-sub">
        <span className="axn-gs-conv-summary">
          {conversation.summary ?? (conversation.eventId ? eventDisplayName(conversation.eventId) : '模拟会话')}
        </span>
        <span className="axn-gs-conv-time">{formatConversationTime(conversation)}</span>
      </div>
      <div className="axn-gs-conv-actions" onClick={(e) => e.stopPropagation()}>
        <Tooltip title={conversation.favorite ? '取消收藏' : '收藏'}>
          <button
            className={`axn-gs-conv-action${conversation.favorite ? ' is-fav' : ''}`}
            onClick={onToggleFavorite}
            aria-label={conversation.favorite ? '取消收藏' : '收藏'}
          >
            {conversation.favorite ? <StarFilled /> : <StarOutlined />}
          </button>
        </Tooltip>
      </div>
    </div>
  );
}
