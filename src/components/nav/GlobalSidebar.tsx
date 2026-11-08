/**
 * 全局导航 + 对话历史管理侧栏（UI 改版）：
 * 区域：品牌（左上，保留安小能身份）/ 一级功能导航/
 * 新建（新建对话=对话模式；「新建任务」工作模式入口暂时下线）/ 搜索 / 历史会话 / 底部账户区
 * （当前用户头像 + 名称 + 设置菜单：切换用户身份、聊天标准控件）。
 * 改版要点：原全宽业务页头移除，其承载项下移至侧栏底部；折叠与收藏功能保持移除状态。
 * 全部数据为模拟数据。
 */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { NAV_PATH } from './navRoutes';
import {
  Bot,
  Clock,
  // FilePlus, // 恢复「新建任务」按钮时一并取回
  FlaskConical,
  FolderClosed,
  // LayoutGrid, // 恢复「应急项目」侧栏入口时一并取回
  Pin,
  Plus,
  Puzzle,
  Search,
  Settings,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react'
import { App as AntdApp, Avatar, Button, Dropdown, Empty, Input, Popconfirm, Tooltip } from 'antd';
import type { Conversation, NavPage } from '@/domain/types';
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
import { actors, DEFAULT_ACTOR_ID } from '@/seed/scenario';
import { useAgentAccess } from '@/hooks/useAgentAccess';
import BrandMark from '@/components/brand/BrandMark';
import './sidebar.css';

type NavKey = NavPage;

const NAV: { key: NavKey; label: string; icon: React.ReactNode }[] = [
  { key: 'assistant', label: '安小能', icon: <Sparkles /> },
  { key: 'agents', label: '应急专家', icon: <Bot /> },
  { key: 'skills', label: '技能管理', icon: <Puzzle /> },
  { key: 'files', label: '我的文件', icon: <FolderClosed /> },
  { key: 'schedules', label: '定时任务', icon: <Clock /> },
  { key: 'knowledge', label: '知识库', icon: <FlaskConical /> },
  // 「应急项目」入口隐藏，页面与深链保留。
  // { key: 'projects', label: '应急项目', icon: <LayoutGrid /> },
];

export default function GlobalSidebar({ onClose }: { onClose?: () => void } = {}) {
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
  const designPlan = useDemoStore((s) => s.designPlan);
  const setDesignPlan = useDemoStore((s) => s.setDesignPlan);
  const { agents } = useAgentAccess();
  const setActor = useDemoStore((s) => s.setActor);
  const actor = useDemoStore((s) => s.getActor());
  const scope = useActiveScope();
  const setMode = useWorkspaceStore((s) => s.setMode);

  const [keyword, setKeyword] = useState('');

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
    return (['pinned', 'today', 'yesterday', 'earlier'] as ConversationGroup[])
      .map((g) => ({ group: g, items: map.get(g) ?? [] }))
      .filter((entry) => entry.items.length > 0);
  }, [filtered]);

  return (
    // 颜色统一走 main.tsx 注入 :root 的 --axn-*：这里原先另起了一套侧栏级局部变量，
    // 但它们只挂在侧栏这个 div 上 —— <main> 里的 NavPages 与 portal 出去的抽屉内容
    // 都继承不到，那些引用实际取不到值（颜色静默回退到继承色）。已整体并入 --axn-*。
    <div className="axn-global-sidebar" data-testid="global-sidebar">
      {/* 1. 品牌区（左上，保留安小能身份） */}
      <div className="axn-gs-brand">
        <span className="axn-gs-brand-mark"><BrandMark /></span>
        <span className="axn-gs-brand-copy">
          <span className="axn-gs-brand-name">安小能 · 应急智能工作台</span>
        </span>
        {/* 抽屉形态下的关闭出口：桌面侧栏是常驻列、不存在「关闭」，所以由父级决定是否传入。
            在此之前只能点遮罩关闭，而窄屏上遮罩只剩 60px（320 - 260），手机上又没有 Esc。 */}
        {onClose && (
          <button
            type="button"
            className="axn-gs-brand-close"
            onClick={onClose}
            aria-label="关闭导航"
            title="关闭导航"
          >
            <X />
          </button>
        )}
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

      {/* 3. 一级功能导航（文书库入口隐藏，页面与工作区内入口保留） */}
      <nav className="axn-gs-nav" aria-label="全局功能导航">
        {NAV.filter(item => item.key !== 'agents' || agents.length > 0).map((item) => (
          <button
            key={item.key}
            className={`axn-gs-nav-item${activeNav === item.key ? ' is-active' : ''}`}
            aria-current={activeNav === item.key ? 'page' : undefined}
            onClick={() => {
              guardDirty('切换导航页', () => navigate(`/${item.key}`));
            }}
          >
            {item.icon}
            <span>{item.label}</span>
          </button>
        ))}

      </nav>

      {/* 4. 对话搜索 */}
      <div className="axn-gs-search">
        <Input
          allowClear
          prefix={<Search style={{ color: 'var(--axn-faint)' }} />}
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
       * 6. 底部账户区：左侧当前用户头像与姓名，右侧设置按钮。
       * 设置按钮承载两项：切换用户身份（原底部角色下拉）与聊天标准控件，
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
          </span>
          <Dropdown
            trigger={['click']}
            placement="topRight"
            menu={{
              selectable: true,
              selectedKeys: [actorId, designPlan === 'one' ? 'plan-one' : 'plan-two'],
              items: [
                {
                  type: 'group',
                  label: designPlan === 'one' ? '切换账号' : '当前账号',
                  children: actors.filter(a => designPlan === 'one' || a.actorId === DEFAULT_ACTOR_ID).map((a) => ({ key: a.actorId, label: a.userName })),
                },
                { type: 'divider' },
                {
                  key: 'design-plans', label: '切换方案',
                  children: [{ key: 'plan-one', label: '方案一' }, { key: 'plan-two', label: '方案二' }],
                },
                { key: 'chat-controls', icon: <FlaskConical size={14} />, label: '聊天标准控件' },
              ],
              onClick: ({ key }) => {
                if (key === 'plan-one' || key === 'plan-two') {
                  guardDirty('切换改版方案', () => {
                    setDesignPlan(key === 'plan-one' ? 'one' : 'two');
                    navigate(NAV_PATH.assistant);
                    onClose?.();
                  });
                }
                else if (key === 'chat-controls') {
                  guardDirty('查看聊天标准控件', () => {
                    navigate(NAV_PATH.controls);
                    onClose?.();
                  });
                }
                else guardDirty('切换账号', () => setActor(key));
              },
            }}
          >
            <button className="axn-gs-account-settings" data-testid="account-settings" aria-label="用户与设置" title="用户与设置">
              <Settings size={15} />
            </button>
          </Dropdown>
        </div>
      </div>

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
            description="该对话产生的文件也会一并删除。"
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
