/**
 * 安小能对话工作流（T-005）：会话头 + 消息流（Bubble.List）+ 输入区（Sender）+ 快捷任务 + 补录表单。
 * 会话跟随演示事件切换（ensureSessionForEvent）；消息与任务状态全部订阅 sessionStore，不本地复制。
 * 本界面为模拟数据演示（规则意图识别，不接真实大模型）。
 */
import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Input, Space, Tag, Typography } from 'antd';
import { Bubble, Sender } from '@ant-design/x';
import type { BubbleItemType } from '@ant-design/x';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { sendMessage, cancelTask } from '@/services/taskRunner';
import { factText, incidentById } from '@/seed/scenario';
import TaskCard from './TaskCard';
import './chat.css';

const { Text } = Typography;

export interface ChatPanelProps {
  onOpenTab: (tab: 'resource' | 'knowledge' | 'doc') => void;
}

/** 引导提示（演示步骤文案，随控制面板 guideStepIndex 切换） */
const GUIDE_HINTS: string[] = [
  '引导 1/6：发送“生成灾情摘要”，观察回答中的事实来源与待确认标注',
  '引导 2/6：发送“查询周边救援资源”，再追问“它们谁最快能到”',
  '引导 3/6：选择队伍加入候选，到“资源与态势”页查看派生汇总',
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

function fmtClock(iso: string): string {
  if (iso.length >= 16) return iso.slice(11, 16);
  return iso;
}

function guideHint(index: number): string {
  if (!Number.isFinite(index) || index < 0) return GUIDE_HINTS[0];
  if (index >= GUIDE_HINTS.length) return GUIDE_HINTS[GUIDE_HINTS.length - 1];
  return GUIDE_HINTS[index];
}

export default function ChatPanel({ onOpenTab }: ChatPanelProps) {
  const currentEventId = useDemoStore((s) => s.currentEventId);
  const demoClock = useDemoStore((s) => s.demoClock);
  const guideStepIndex = useDemoStore((s) => s.guideStepIndex);
  const ensureSessionForEvent = useSessionStore((s) => s.ensureSessionForEvent);
  const session = useSessionStore((s) => s.sessions[s.sessionByEvent[currentEventId] ?? '']);
  const tasks = useSessionStore((s) => s.tasks);

  const [input, setInput] = useState('');
  const [clarifyValue, setClarifyValue] = useState('');

  // 事件切换/重置后确保会话存在并跟随当前事件
  useEffect(() => {
    ensureSessionForEvent(currentEventId);
  }, [currentEventId, ensureSessionForEvent]);

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
  const eventTitle = incident ? factText(incident.factRefs.title) || currentEventId : currentEventId;

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
          contentRender: () =>
            task ? (
              <TaskCard task={task} onOpenTab={onOpenTab} />
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
  }, [session?.messages, tasks, onOpenTab]);

  const hasMessages = items.length > 0;

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', background: '#fff' }}>
      {/* 会话头 */}
      <div className="axn-chat-head">
        <Space size={8} align="center" wrap>
          <Text strong style={{ fontSize: 14 }}>
            {eventTitle}
          </Text>
          <Tag color="orange">模拟数据</Tag>
          <Tag color="blue">演示时钟 {fmtClock(demoClock)}</Tag>
        </Space>
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
              styles: { content: { padding: 0, background: 'transparent' } },
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
            <Text type="secondary" style={{ fontSize: 12 }}>
              可直接输入指令，或点击下方快捷任务开始体验。
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
            message={pending.prompt}
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
