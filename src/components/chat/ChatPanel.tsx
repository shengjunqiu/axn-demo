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
import { useSessionStore } from '@/store/sessionStore';
import { sendMessage, cancelTask } from '@/services/taskRunner';
import { factText, incidentById, incidents } from '@/seed/scenario';
import { eventDisplayName } from '@/services/factLookup';
import TaskCard from './TaskCard';
import './chat.css';

const { Text } = Typography;

export interface ChatPanelProps {
  onOpenDrawer: (target: 'resource' | 'knowledge') => void;
}

/** 引导提示（演示步骤文案，随控制面板 guideStepIndex 切换） */
const GUIDE_HINTS: string[] = [
  '引导 1/6：发送“生成灾情摘要”，观察回答中的事实来源与待确认标注',
  '引导 2/6：发送“查询周边救援资源”，再追问“它们谁最快能到”',
  '引导 3/6：点击资源卡的“查看资源与态势”，勾选候选并查看派生汇总',
  '引导 4/6：发送“给我处置建议”，在右侧页签查看依据与知识',
  '引导 5/6：生成应急要情 / 值班日报，按提示补录缺失字段',
  '引导 6/6：可在演示控制面板注入故障或重置演示',
];

const QUICK_TASKS: string[] = [
  '生成灾情摘要',
  '查询周边救援资源',
  '它们谁最快能到',
  '给我处置建议',
  '生成应急要情',
  '生成值班日报',
];

/** 欢迎卡引导问题：关联灾情会话 / 空白对话两套，点击即发送。 */
const WELCOME_QUESTIONS_EVENT: string[] = [
  '生成当前灾情摘要',
  '查询周边救援资源',
  '它们谁最快能到？',
  '生成应急要情',
];
const WELCOME_QUESTIONS_BLANK: string[] = [
  '人员被困时，最快的救人方式是什么？',
  '如何快速判断堤防管涌险情？',
  '汛期值班交接班要注意什么？',
  '生成值班日报',
];

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

function guideHint(index: number): string {
  if (!Number.isFinite(index) || index < 0) return GUIDE_HINTS[0];
  if (index >= GUIDE_HINTS.length) return GUIDE_HINTS[GUIDE_HINTS.length - 1];
  return GUIDE_HINTS[index];
}

export default function ChatPanel({ onOpenDrawer }: ChatPanelProps) {
  const currentEventId = useDemoStore((s) => s.currentEventId);
  const guideStepIndex = useDemoStore((s) => s.guideStepIndex);
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
  const busy = runningTask != null;

  const handleSend = (raw: string) => {
    const text = raw.trim();
    if (!session || !text || busy) return;
    setInput('');
    void sendMessage(session.sessionId, { text });
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
    return messages.map((m) => {
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
        <div style={{ marginTop: 4 }}>
          <Text type="secondary" style={{ fontSize: 12 }}>
            💡 {guideHint(guideStepIndex)}
          </Text>
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
            <ul className="axn-welcome-list">
              <li>我的回答全部锚定本演示环境的种子事实与派生结果，不使用外部大模型。</li>
              <li>缺少可靠来源的信息会明确标注“待确认”，不会编造数值。</li>
              <li>“候选力量”指拟使用的资源，候选 ≠ 已调派。</li>
              <li>生成的文书需通过校核并按权限提交、签发（均为模拟流程）。</li>
            </ul>
            <div className="axn-welcome-questions">
              <Text strong style={{ fontSize: 12 }}>
                你可以问我：
              </Text>
              <ul className="axn-question-list">
                {(isBlankEvent ? WELCOME_QUESTIONS_BLANK : WELCOME_QUESTIONS_EVENT).map((q) => (
                  <li key={q}>
                    <button
                      type="button"
                      className="axn-question-item"
                      disabled={!session || busy}
                      onClick={() => handleSend(q)}
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
        {QUICK_TASKS.map((label) => (
          <Button
            key={label}
            size="small"
            className="axn-chip"
            disabled={!session || busy}
            onClick={() => handleSend(label)}
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
          loading={busy}
          onCancel={() => {
            if (runningTask) cancelTask(runningTask.taskId);
          }}
          placeholder={
            session ? '向安小能发送指令，Enter 发送（模拟环境，不接真实模型）' : '会话初始化中…'
          }
          disabled={!session}
        />
      </div>
    </div>
  );
}
