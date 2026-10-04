import { generateWorkSummary, submitWorkSummaryImprovement } from '@/services/workSummaryWorkflow';
/**
 * 安小能对话工作流（UI 改版）：会话头（标题 + 关联灾情）+ 消息流（Bubble.List）
 * + 圆角一体化输入区（快捷任务 chips 位于输入框上方）+ 补录表单。
 * 首页引导问题取自已接入知识库的 qa.json；输入区常驻 3 个常用任务 chips，其余收进「更多任务」浮层。
 * 会话跟随演示事件切换（ensureSessionForConversation）；消息与任务状态全部订阅 sessionStore，不本地复制。
 * 本界面为模拟数据演示（规则意图识别，不接真实大模型）。
 */
import { useEffect, useMemo, useState } from 'react';
import { useSessionTasks } from '@/hooks/useSessionTasks';
import {
  ChevronDown,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react'
import { Alert, App as AntdApp, Button, Input, Popover, Select, Space, Tag, Tooltip, Typography, theme } from 'antd';
import { Bubble, Sender } from '@ant-design/x';
import type { BubbleItemType } from '@ant-design/x';
import { useConversationStore } from '@/store/conversationStore';
import { useDemoStore } from '@/store/demoStore';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useSessionStore } from '@/store/sessionStore';
import { useActiveScope, useWorkspaceStore } from '@/store/workspaceStore';
import { sendMessage, cancelTask } from '@/services/taskRunner';
import { AGENT_QUICK_TASKS } from '@/seed/agentQuickTasks';
import { WELCOME_QUESTIONS } from '@/seed/welcomeQuestions';
import { factText, incidentById, incidents } from '@/seed/scenario';
import { eventDisplayName } from '@/services/factLookup';
import TaskCard from './TaskCard';
import DocumentGenerationCard from './DocumentGenerationCard';
import AgentSummonCard from './AgentSummonCard';
import './chat.css';

const { Text } = Typography;

export interface ChatPanelProps {
  onOpenDrawer: (target: 'resource' | 'knowledge') => void;
  compact?: boolean;
}

const AVATAR = <div className="axn-chat-avatar">安</div>;

// 输入区常驻 3 个常用任务，其余收进「更多任务」浮层（任务全集见 seed/agentQuickTasks）
const PRIMARY_LABELS = ['生成灾情摘要', '查询周边救援资源', '生成应急要情'];
const PRIMARY_TASKS = AGENT_QUICK_TASKS.filter(({ label }) => PRIMARY_LABELS.includes(label));
const MORE_TASKS = AGENT_QUICK_TASKS.filter(({ label }) => !PRIMARY_LABELS.includes(label));

export default function ChatPanel({ onOpenDrawer, compact = false }: ChatPanelProps) {
  const { token } = theme.useToken();
  const { modal } = AntdApp.useApp();
  const currentEventId = useDemoStore((s) => s.currentEventId);
  const sidebarCollapsed = useDemoStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useDemoStore((s) => s.toggleSidebar);
  const activeConversation = useConversationStore((s) =>
    s.activeConversationId ? s.conversations[s.activeConversationId] : null,
  );
  const activeConversationId = activeConversation?.id ?? null;
  const session = useSessionStore((s) => s.sessions[s.sessionByConversation[activeConversationId ?? ''] ?? '']);
  const tasks = useSessionTasks(session);
  const scope = useActiveScope();

  const [input, setInput] = useState('');
  const [clarifyValue, setClarifyValue] = useState('');
  const [moreOpen, setMoreOpen] = useState(false);

  // 「更多任务」浮层：切换范围时收起，打开时支持 Esc 关闭
  useEffect(() => { setMoreOpen(false); }, [scope]);
  useEffect(() => {
    if (!moreOpen) return;
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') setMoreOpen(false); };
    window.addEventListener('keydown', onEscape);
    return () => window.removeEventListener('keydown', onEscape);
  }, [moreOpen]);

  // 事件切换/重置后确保会话存在并跟随当前事件
  useEffect(() => {
    if (activeConversation) {
      useSessionStore
        .getState()
        .ensureSessionForConversation(activeConversation.id, activeConversation.eventId ?? currentEventId);
    }
  }, [activeConversation, currentEventId]);

  const runningTask = useMemo(
    () =>
      Object.values(tasks).find(
        (t) => t.sessionId === session?.sessionId && (t.status === 'running' || t.status === 'queued'),
      ) ?? null,
    [tasks, session?.sessionId],
  );
  const generatingDocument = useMockDocumentStore(s => s.libraries[session?.sessionId ?? '']?.generatingCode);
  const busy = runningTask != null || !!generatingDocument;

  const handleSend = (raw: string) => {
    const text = raw.trim();
    if (!session || !text || busy) return;
    setInput('');
    const waitingSummary = session.messages.find(message => message.documentWorkflow?.stage === 'waiting_input');
    if (waitingSummary) {
      void submitWorkSummaryImprovement(session.sessionId, waitingSummary.messageId, text);
      return;
    }
    if (/生成.*工作总结|工作总结.*生成/.test(text)) {
      void generateWorkSummary(session.sessionId, text);
      return;
    }
    void sendMessage(session.sessionId, { text });
  };

  const handleQuickTask = async (text: string) => {
    if (text === '生成工作总结') {
      if (session && !busy) await generateWorkSummary(session.sessionId, text);
      return;
    }
    const code = text === '生成值班日报' ? 'DUTY_DAILY' : text === '生成应急要情' ? 'EMERGENCY_BRIEF' : null;
    if (!code) { handleSend(text); return; }
    if (!session || busy) return;
    const sessionId = session.sessionId;
    useSessionStore.getState().appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text, taskId: null });
    const elements = [
      { label: '文书类型', value: code === 'DUTY_DAILY' ? '值班日报' : '应急要情' },
      { label: '编制单位', value: '应急指挥中心（模拟）' },
      { label: '报送对象', value: '相关应急工作部门（模拟）' },
      { label: code === 'DUTY_DAILY' ? '值班时段' : '关联事项', value: code === 'DUTY_DAILY' ? '当日 08:00—20:00（模拟）' : eventTitle },
      { label: code === 'DUTY_DAILY' ? '交接要求' : '内容要求', value: code === 'DUTY_DAILY' ? '持续跟踪重点风险、核实待报信息并做好交接' : '汇总基本情况、先期处置和下一步工作；未核实信息保留待核实标记' },
      { label: '文书格式', value: '红头格式，包含标题、正文与落款' },
    ];
    const invocation = useSessionStore.getState().appendMessage(sessionId, {
      sessionId, role: 'assistant', kind: 'agent', text: '根据已收集的文书要素生成红头文书', taskId: null,
      agentName: '文书生成智能体', agentRole: text,
      documentWorkflow: { stage: 'collecting', elements },
    });
    const document = await useMockDocumentStore.getState().generate(sessionId, code, {
      elements,
      onStage: stage => useSessionStore.getState().updateDocumentWorkflow(sessionId, invocation.messageId, { stage, elements }),
    });
    useSessionStore.getState().updateDocumentWorkflow(sessionId, invocation.messageId, {
      stage: document ? 'completed' : 'interrupted', elements, documentId: document?.id,
    });
    if (document && useSessionStore.getState().sessions[sessionId]) {
      useSessionStore.getState().appendMessage(sessionId, {
        sessionId, role: 'assistant', kind: 'text', taskId: null,
        text: `已生成《${document.title}》（模拟文书），已在右侧文书工作区打开。`,
      });
    }
  };

  const pending = session?.pendingClarification ?? null;
  const submitClarification = () => {
    const value = clarifyValue.trim();
    if (!session || !pending || !value) return;
    const prefix = pending.field === 'handOverNotes' ? '交接事项：' : '报送单位：';
    void sendMessage(session.sessionId, { text: `${prefix}${value}` });
    setClarifyValue('');
  };

  const incident = incidentById.get(currentEventId);
  const isBlankEvent = currentEventId.startsWith('evt-blank-');
  const eventTitle = incident
    ? factText(incident.factRefs.title) || currentEventId
    : isBlankEvent
      ? '空白对话（未关联事件）'
      : currentEventId;

  // 关联灾情（对话界面内切换）：evt-blank- 前缀或未绑定 → 未关联；否则为绑定事件
  const linkConversationToEvent = useConversationStore((s) => s.linkConversationToEvent);
  const BLANK = '__blank__';
  const linkValue =
    !activeConversation || !activeConversation.eventId || activeConversation.eventId.startsWith('evt-blank-')
      ? BLANK
      : activeConversation.eventId;
  const linkOptions = useMemo(
    () => [
      { value: BLANK, label: '未关联事件（空白对话）' },
      ...incidents.map((i) => ({ value: i.eventId, label: eventDisplayName(i.eventId) })),
    ],
    [],
  );
  const handleLinkChange = (value: string) => {
    if (!activeConversation) return;
    // undefined → 会话回到专属虚拟事件（保留其独立消息）
    const proceed = () => linkConversationToEvent(activeConversation.id, value === BLANK ? undefined : value);
    const workspace = useWorkspaceStore.getState();
    if (!workspace.isDirty(scope)) { proceed(); return; }
    modal.confirm({
      title: '有未保存的文书修改',
      // 切事件只解除编辑状态；草稿改动在 documentStore、模拟文书改动在 mockDocumentStore，都不会丢。
      content: '切换事件不会丢弃修改，改动保留在本次会话（尚未保存）。',
      okText: '继续切换',
      cancelText: '继续编辑',
      onOk: () => { workspace.setDirty(scope, false); workspace.close(scope); proceed(); },
    });
  };

  const items: BubbleItemType[] = useMemo(() => {
    const messages = session?.messages ?? [];
    const summonedTasks = new Set(messages.filter(message => message.kind === 'agent' && message.taskId && tasks[message.taskId]).map(message => message.taskId));
    return messages.filter(message => !(message.kind === 'task' && summonedTasks.has(message.taskId))).map((m) => {
      if (m.kind === 'task' && m.taskId) {
        const task = tasks[m.taskId];
        return {
          key: m.messageId,
          role: 'task',
          content: task?.displayTitle ?? '任务',
          avatar: AVATAR,
          // 任务卡占满会话栏可用宽度（默认气泡 fit-content 会把长内容挤成窄条）
          styles: {
            root: { flex: '1 1 auto', width: 'auto', minWidth: 0, alignSelf: 'stretch', paddingInlineEnd: 0 },
            body: { flex: '1 1 auto', width: '100%', minWidth: 0, maxWidth: '100%' },
            content: { width: '100%' },
          },
          contentRender: () =>
            task ? (
              <TaskCard task={task} onOpenDrawer={onOpenDrawer} />
            ) : (
              <Tag color="error">任务数据缺失（模拟数据）</Tag>
            ),
        };
      }
      if (m.kind === 'agent') {
        return {
          key: m.messageId,
          role: 'task',
          content: m.agentName ?? '智能体协同',
          avatar: null,
          styles: {
            root: { flex: '1 1 auto', width: 'auto', minWidth: 0, alignSelf: 'stretch', paddingInlineEnd: 0 },
            body: { flex: '1 1 auto', width: '100%', minWidth: 0, maxWidth: '100%' },
            content: { width: '100%', padding: 0, background: 'transparent' },
          },
          contentRender: () => m.documentWorkflow ? <DocumentGenerationCard message={m} /> : (
            <AgentSummonCard
              agentName={m.agentName ?? '智能体协同'}
              agentRole={m.agentRole ?? ''}
              action={m.text ?? ''}
              status={m.taskId ? tasks[m.taskId]?.status : undefined}
            >
              {m.taskId && tasks[m.taskId] && <TaskCard task={tasks[m.taskId]} onOpenDrawer={onOpenDrawer} />}
            </AgentSummonCard>
          ),
        };
      }
      if (m.role === 'user') {
        return { key: m.messageId, role: 'user', content: m.text ?? '' };
      }
      if (m.role === 'system') {
        return {
          key: m.messageId,
          role: 'system',
          content: m.text ?? '',
          styles: { content: { fontSize: 'var(--fs-body)', color: 'var(--chat-muted)' } },
        };
      }
      return { key: m.messageId, role: 'ai', content: m.text ?? '', avatar: AVATAR };
    });
  }, [session?.messages, tasks, onOpenDrawer]);

  const hasMessages = items.length > 0;

  return (
    <div className="axn-chat-page" style={{ '--chat-primary': token.colorPrimary, '--chat-primary-bg': token.colorPrimaryBg, '--chat-border': token.colorBorderSecondary, '--chat-muted': token.colorTextSecondary, '--chat-faint': token.colorTextTertiary, '--chat-text': token.colorText, '--chat-surface': token.colorBgContainer, '--chat-soft': token.colorFillAlter, '--chat-warning': token.colorWarning, '--chat-success': token.colorSuccess, '--chat-error': token.colorError }}>
          {/* 会话头：左侧收起侧边栏 + 标题 */}
      <div className="axn-chat-head">
        <div className="axn-chat-head-row">
          <Button
            type="text"
            className="axn-collapse-btn"
            icon={sidebarCollapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
            onClick={toggleSidebar}
            aria-label={sidebarCollapsed ? '展开侧边栏' : '收起侧边栏'}
          />
          <Text strong className="axn-cp-title">
            {eventTitle}
          </Text>
        </div>
      </div>

      {/* 消息流 / 首页 */}
      {hasMessages ? (
        <Bubble.List
          className="axn-message-list"
          autoScroll
          items={items}
          role={{
            ai: {
              placement: 'start',
              variant: 'filled',
              avatar: AVATAR,
              styles: { content: { background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: '4px 14px 14px 14px', padding: '12px 14px', lineHeight: 1.85, maxWidth: '100%', overflowWrap: 'anywhere' } },
            },
            user: {
              placement: 'end',
              variant: 'filled',
              styles: { content: { background: token.colorPrimary, color: token.colorTextLightSolid, borderRadius: '14px 14px 4px 14px', padding: '11px 15px', lineHeight: 1.8, fontSize: 13, overflowWrap: 'anywhere' } },
            },
            system: { placement: 'start', variant: 'borderless' },
            task: {
              placement: 'start',
              variant: 'borderless',
              avatar: AVATAR,
              styles: {
                body: { flex: '1 1 auto', minWidth: 0 },
                content: { padding: 0, background: 'transparent', width: '100%', flex: '1 1 auto', minWidth: 0 },
              },
            },
          }}
        />
      ) : compact ? (
        <div className="axn-chat-empty-compact" data-testid="split-chat-empty">
          <MessageSquare />
          <Typography.Title level={5}>围绕这份文书继续讨论</Typography.Title>
          <Typography.Text type="secondary">可以补充资料、发起任务，或在右侧编辑文书。</Typography.Text>
        </div>
      ) : (
        <div className="chat-scroll axn-home">
          <div className="axn-home-inner">
            <div className="axn-home-hero">
              <Typography.Title level={1} className="axn-home-title">有什么我能帮你的吗？</Typography.Title>
              <Text className="axn-home-greeting" type="secondary">您好，我是安小能（演示）</Text>
            </div>
            <Typography.Paragraph className="axn-home-copy">
              梳理灾情、查询救援资源、生成工作文书。把信息整理交给安小能。
            </Typography.Paragraph>

            <div className="axn-home-block" data-testid="home-chat-recommend">
              <Text type="secondary" className="axn-tc-fs13">为你推荐</Text>
              <ul className="axn-question-list">
                {WELCOME_QUESTIONS.map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      className="axn-question-item"
                      disabled={!session || busy}
                      onClick={() => { void handleQuickTask(q); }}
                    >
                      {q}
                    </button>
                  </li>
                ))}
              </ul>
            </div>

            <Text type="secondary" className="axn-tc-fs12">
              也可直接输入指令，或在下方输入区使用快捷任务。
            </Text>
          </div>
        </div>
      )}

      {/* 补录表单（pendingClarification 存在时内联展示） */}
      {pending && (
        <div className="axn-clarification">
          <Alert
            type="warning"
            showIcon
            title={pending.prompt}
            description={
              <Space.Compact className="axn-cp-compact">
                <Input
                  value={clarifyValue}
                  onChange={(e) => setClarifyValue(e.target.value)}
                  onPressEnter={submitClarification}
                  placeholder={`示例：${pending.exampleHint}`}
                  maxLength={80}
                />
                <Button type="primary" onClick={submitClarification} disabled={!clarifyValue.trim()}>
                  提交
                </Button>
              </Space.Compact>
            }
          />
        </div>
      )}

      {/* 快捷任务 chips：位于输入框上方 */}
      <div className="axn-cp-chips-wrap">
        <div className="axn-chips">
        {PRIMARY_TASKS.map(({ label, agentName, agentId }) => (
          <Button
            key={label}
            size="small"
            className="axn-chip"
            title={agentName}
            data-agent-id={agentId}
            disabled={!session || busy}
            onClick={() => { void handleQuickTask(label); }}
          >
            {label}
          </Button>
        ))}
        <Popover
          trigger="click"
          placement="topRight"
          open={moreOpen}
          onOpenChange={setMoreOpen}
          getPopupContainer={(trigger) => trigger.parentElement ?? document.body}
          content={
            <div className="axn-more-tasks" role="group" aria-label="更多快捷任务" data-testid="quick-task-menu">
              {MORE_TASKS.map(({ label, agentName, agentId }) => (
                <Button
                  key={label}
                  type="text"
                  title={agentName}
                  data-agent-id={agentId}
                  disabled={!session || busy}
                  onClick={() => { setMoreOpen(false); void handleQuickTask(label); }}
                >
                  {label}
                </Button>
              ))}
            </div>
          }
        >
          <Button
            size="small"
            className="axn-chip"
            aria-label="更多任务"
            aria-expanded={moreOpen}
            disabled={!session || busy}
          >
            更多任务 <ChevronDown />
          </Button>
        </Popover>
      </div>
      </div>
      {/* 圆角一体化输入区：关联灾情在输入框上方 */}
      <div className="axn-composer">
        <div className="axn-composer-shell">
          <div className="axn-cp-select-row">
            <Tooltip title="关联后使用该事件的业务资料，对话消息保持独立">
              <Select
                size="small"
                className="axn-cp-select"
                value={linkValue}
                onChange={handleLinkChange}
                options={linkOptions}
                aria-label="关联灾情"
                data-testid="chat-link-incident"
              />
            </Tooltip>
          </div>
          <Sender
            value={input}
            onChange={(v) => setInput(v)}
            onSubmit={(message) => handleSend(message)}
            loading={runningTask != null}
            onCancel={() => {
              if (runningTask) cancelTask(runningTask.taskId);
            }}
            suffix={(_, { components: { SendButton, SpeechButton } }) => (
              <>
                <SpeechButton />
                <SendButton />
              </>
            )}
            placeholder={
              session ? '向安小能发送指令，Enter 发送' : '会话初始化中…'
            }
            disabled={!session || !!generatingDocument}
          />
        </div>
      </div>
    </div>
  );
}
