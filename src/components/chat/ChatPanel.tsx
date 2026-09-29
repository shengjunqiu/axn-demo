/**
 * 安小能对话工作流（T-005）：会话头 + 消息流（Bubble.List）+ 输入区（Sender）+ 快捷任务 + 补录表单。
 * 会话跟随演示事件切换（ensureSessionForEvent）；消息与任务状态全部订阅 sessionStore，不本地复制。
 * 本界面为模拟数据演示（规则意图识别，不接真实大模型）。
 */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input, Select, Space, Tag, Tooltip, Typography } from 'antd';
import { Bubble, Sender } from '@ant-design/x';
import type { BubbleItemType } from '@ant-design/x';
import { useConversationStore } from '@/store/conversationStore';
import { useDemoStore } from '@/store/demoStore';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useSessionStore } from '@/store/sessionStore';
import { sendMessage, cancelTask } from '@/services/taskRunner';
import { AGENT_QUICK_TASKS } from '@/seed/agentQuickTasks';
import { getQaItem } from '@/services/qaKnowledge';
import { factText, incidentById, incidents } from '@/seed/scenario';
import { eventDisplayName } from '@/services/factLookup';
import TaskCard from './TaskCard';
import DocumentGenerationCard from './DocumentGenerationCard';
import AgentSummonCard from './AgentSummonCard';
import './chat.css';

const { Text } = Typography;

export interface ChatPanelProps {
  onOpenDrawer: (target: 'resource' | 'knowledge') => void;
}

/** 从 qa.json 已接入的知识库读取原问题，保证点击后命中对应答案。 */
const WELCOME_QUESTIONS = [1, 5, 9, 17]
  .map(id => getQaItem(id)?.question)
  .filter((question): question is string => !!question);

const AVATAR = (
  <div
    style={{
      width: 30,
      height: 30,
      borderRadius: '50%',
      background: '#e8f0fe',
      color: '#1d5fd2',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontWeight: 700,
      fontSize: 13,
      flexShrink: 0,
    }}
  >
    安
  </div>
);

export default function ChatPanel({ onOpenDrawer }: ChatPanelProps) {
  const currentEventId = useDemoStore((s) => s.currentEventId);
  const activeConversation = useConversationStore((s) =>
    s.activeConversationId ? s.conversations[s.activeConversationId] : null,
  );
  const activeConversationId = activeConversation?.id ?? null;
  const ensureSessionForConversation = useSessionStore((s) => s.ensureSessionForConversation);
  const session = useSessionStore((s) => s.sessions[s.sessionByConversation[activeConversationId ?? ''] ?? '']);
  const tasks = useSessionStore((s) => s.tasks);

  const [input, setInput] = useState('');
  const [clarifyValue, setClarifyValue] = useState('');

  // 事件切换/重置后确保会话存在并跟随当前事件
  useEffect(() => {
    if (activeConversation) ensureSessionForConversation(activeConversation.id, activeConversation.eventId ?? currentEventId);
  }, [activeConversation, ensureSessionForConversation, currentEventId]);

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
    void sendMessage(session.sessionId, { text });
  };

  const handleQuickTask = async (text: string) => {
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
        text: `已生成《${document.title}》（模拟文书），请在右侧文书生成智能体查看红头文书详情。`,
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
    linkConversationToEvent(activeConversation.id, value === BLANK ? undefined : value);
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
          avatar: AVATAR,
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
          styles: { content: { fontSize: 12, color: '#8c8c8c' } },
        };
      }
      return { key: m.messageId, role: 'ai', content: m.text ?? '', avatar: AVATAR };
    });
  }, [session?.messages, tasks, onOpenDrawer]);

  const hasMessages = items.length > 0;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      {/* 会话头 */}
      <div className="axn-chat-head">
        {/* 标题行：单行省略，窄栏（350px）下不换行 */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Text strong style={{ fontSize: 14, flex: 1, minWidth: 0, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis' }}>
            {eventTitle}
          </Text>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
          <Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
            关联灾情
          </Text>
          <Tooltip title="关联后共享该事件的会话消息与业务数据；未关联为空白对话">
            <Select
              size="small"
              style={{ flex: 1, minWidth: 0 }}
              value={linkValue}
              onChange={handleLinkChange}
              options={linkOptions}
              data-testid="chat-link-incident"
              aria-label="关联灾情"
            />
          </Tooltip>
        </div>
      </div>

      {/* 消息流 */}
      {hasMessages ? (
        <Bubble.List
          style={{ flex: 1, minHeight: 0 }}
          autoScroll
          items={items}
          role={{
            ai: {
              placement: 'start',
              variant: 'filled',
              avatar: AVATAR,
              styles: { content: { background: '#f4f7fb', maxWidth: '100%' } },
            },
            user: {
              placement: 'end',
              variant: 'filled',
              styles: { content: { background: '#1d6ff2', color: '#fff' } },
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
      ) : (
        <div className="chat-scroll axn-welcome">
          <div className="axn-welcome-card">
            <Space size={8} align="center">
              {AVATAR}
              <Text strong style={{ fontSize: 15 }}>
                您好，我是安小能（演示）
              </Text>
              <Tag color="orange">模拟数据</Tag>
            </Space>
            <Typography.Paragraph style={{ margin: '14px 0', lineHeight: 1.8 }}>
              我是安小能，你的应急工作智能助手。可以帮你梳理灾情、查询救援资源、生成工作文书，让信息整理与日常协同更高效。
            </Typography.Paragraph>
            <div className="axn-welcome-questions">
              <Text strong style={{ fontSize: 12 }}>
                你可以问我：
              </Text>
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
            <Text type="secondary" style={{ fontSize: 12 }}>
              也可直接输入指令，或点击下方快捷任务。
            </Text>
          </div>
        </div>
      )}

      {/* 补录表单（pendingClarification 存在时内联展示） */}
      {pending && (
        <div style={{ padding: '8px 12px 0' }}>
          <Alert
            type="warning"
            showIcon
            title={pending.prompt}
            description={
              <Space.Compact style={{ width: '100%', marginTop: 6 }}>
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

      {/* 快捷任务 chips */}
      <div className="axn-chips">
        {AGENT_QUICK_TASKS.map(({ label, agentName, agentId }) => (
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
      </div>

      {/* 输入区 */}
      <div style={{ padding: '8px 12px 12px' }}>
        <Sender
          value={input}
          onChange={(v) => setInput(v)}
          onSubmit={(message) => handleSend(message)}
          loading={runningTask != null}
          onCancel={() => {
            if (runningTask) cancelTask(runningTask.taskId);
          }}
          placeholder={
            session ? '向安小能发送指令，Enter 发送（模拟环境，不接真实模型）' : '会话初始化中…'
          }
          disabled={!session || !!generatingDocument}
        />
      </div>
    </div>
  );
}
