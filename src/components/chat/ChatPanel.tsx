import { tenderName } from '@/seed/tenderNames';
import { isDutyContent, isMeetingMinutesContent } from '@/seed/prototypeVisibility';
import OperationalFlows, { FLOW_TASKS } from './OperationalFlows';
import { generateWorkSummary, submitWorkSummaryImprovement } from '@/services/workSummaryWorkflow';
/**
 * 安小能对话工作流（UI 改版）：会话头（标题 + 关联灾情）+ 消息流（Bubble.List）
 * + 圆角一体化输入区（快捷任务 chips：场景关键推荐 + 更多动作折叠）+ 补录表单。
 * 首页含建设三场景入口与知识库引导问题；会话跟随演示事件切换。
 * 本界面为模拟数据演示（规则意图识别，不接真实大模型）。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSessionTasks } from '@/hooks/useSessionTasks';
import {
  FileText,
  MessageSquare,
  Paperclip,
  PanelLeftClose,
  PanelLeftOpen,
  X,
} from 'lucide-react'
import { Alert, App as AntdApp, Button, Dropdown, Input, Select, Space, Tag, Tooltip, Typography, theme } from 'antd';
import { resolveEventDispatchSource } from '@/seed/eventDispatchSource';
import type { MenuProps } from 'antd';
import { Bubble, Sender } from '@ant-design/x';
import type { BubbleItemType } from '@ant-design/x';
import type { AttachmentWorkflow, ChatAttachment, ChatMessage } from '@/domain/types';
import { useConversationStore } from '@/store/conversationStore';
import { useDemoStore } from '@/store/demoStore';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useSessionStore } from '@/store/sessionStore';
import { useActiveScope, useWorkspaceStore } from '@/store/workspaceStore';
import { sendMessage, cancelTask } from '@/services/taskRunner';
import {
  buildStageMismatchReply,
  isActionAheadOfStage,
  resolveActionPrompt,
  splitQuickTasksByStage,
} from '@/services/agentFlow';
import {
  buildStageEventContext,
  LOCAL_FILE_ACCEPT,
  PLAIN_TEXT_EXT,
  PLAIN_TEXT_MAX_BYTES,
  PLAIN_TEXT_MAX_CHARS,
  simulateAttachment,
  stageChoices,
  type StageChoice,
} from '@/services/stageConversation';
import { CONSTRUCTION_SCENARIO_PROMPTS } from '@/seed/constructionScenarios';
import { WELCOME_QUESTIONS } from '@/seed/welcomeQuestions';
import { factText, incidentById, incidents } from '@/seed/scenario';
import { vueWorkspaceEventById } from '@/seed/vueWorkspaceEvents';
import { eventDisplayName } from '@/services/factLookup';
import {
  buildEventSwitchBriefing,
  buildEventUnlinkBriefing,
  resolveEventStage,
} from '@/services/eventSwitchBriefing';
import TaskCard from './TaskCard';
import DocumentGenerationCard from './DocumentGenerationCard';
import AgentSummonCard from './AgentSummonCard';
import EventSwitchBriefingCard from './EventSwitchBriefingCard';
import SessionMaterialsDrawer from './SessionMaterialsDrawer';
import './chat.css';

const { Text } = Typography;

export interface ChatPanelProps {
  onOpenDrawer: (target: 'resource' | 'knowledge', options?: { tab?: 'list' | 'map' }) => void;
  compact?: boolean;
}

const AVATAR = <div className="axn-chat-avatar">安</div>;

const BLANK_LINK = '__blank__';

function incidentOptionLabel(eventId: string): string {
  const name = eventDisplayName(eventId);
  const vue = vueWorkspaceEventById.get(eventId);
  return vue ? `${name}（${vue.stage}）` : name;
}

/** 关联灾情选项/已选值悬浮详情（补全截断文案 + 关键元数据）。 */
function incidentOptionDetail(value: string) {
  if (value === BLANK_LINK) {
    return (
      <div className="axn-cp-select-tip">
        <div className="axn-cp-select-tip-title">未关联事件（空白对话）</div>
        <div>不引用具体事件资料；对话消息保持独立，可随时重新关联继续演示。</div>
      </div>
    );
  }
  const incident = incidentById.get(value);
  const vue = vueWorkspaceEventById.get(value);
  const name = eventDisplayName(value);
  const stage = vue?.stage ?? '原有事件';
  const category = vue?.category || (incident ? factText(incident.factRefs.disasterType) : '');
  const location = vue?.location || (incident ? factText(incident.factRefs.location) : '');
  const risks = vue?.risks || '';
  const overview = vue?.description || (incident ? factText(incident.factRefs.incidentDescription) : '');
  const dispatch = resolveEventDispatchSource(value);
  const clip = (text: string, max = 96) => {
    const normalized = text.replace(/\s+/g, ' ').trim();
    return normalized.length <= max ? normalized : `${normalized.slice(0, max - 1)}…`;
  };
  return (
    <div className="axn-cp-select-tip">
      <div className="axn-cp-select-tip-title">{name}</div>
      <div>阶段：{stage}{category ? ` · ${category}` : ''}</div>
      {location ? <div>位置：{location}</div> : null}
      {dispatch ? (
        <>
          <div>任务来源：{dispatch.taskSource}（{dispatch.channel}）</div>
          <div>信息类型：{dispatch.infoType} · 调用单位：{dispatch.callUnit}</div>
          <div>发送/填报：{dispatch.sendUnit} / {dispatch.reportUnit}</div>
        </>
      ) : null}
      {risks ? <div>风险：{clip(risks, 72)}</div> : null}
      {overview ? <div className="axn-cp-select-tip-desc">{clip(overview)}</div> : null}
      <div className="axn-cp-select-tip-note">模拟资料 · 正式结论以岗位核对为准</div>
    </div>
  );
}

export default function ChatPanel({ onOpenDrawer, compact = false }: ChatPanelProps) {
  const navigate = useNavigate();
  const { token } = theme.useToken();
  const { modal, message: notice } = AntdApp.useApp();
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

  const [flow, setFlow] = useState<typeof FLOW_TASKS[number] | null>(null);
  const [input, setInput] = useState('');
  const [clarifyValue, setClarifyValue] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);
  const [queuedChoice, setQueuedChoice] = useState<StageChoice | null>(null);
  const [choicePicker, setChoicePicker] = useState<string>('');
  const [materialsOpen, setMaterialsOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const eventStage = session && !session.eventId.startsWith('evt-blank-')
    ? resolveEventStage(session.eventId, session)
    : null;
  const incident = incidentById.get(currentEventId);
  const isBlankEvent = currentEventId.startsWith('evt-blank-');
  const eventTitle = incident
    ? factText(incident.factRefs.title) || currentEventId
    : isBlankEvent
      ? '空白对话（未关联事件）'
      : currentEventId;

  const clearPending = () => {
    if (queuedChoice && input === queuedChoice.prompt) setInput('');
    setPendingAttachment(null);
    setQueuedChoice(null);
    setChoicePicker('');
  };

  const replyStageMismatch = (actionText: string) => {
    if (!session || !eventStage) return false;
    if (!isActionAheadOfStage(eventStage, actionText)) return false;
    const sessionId = session.sessionId;
    const store = useSessionStore.getState();
    store.appendMessage(sessionId, {
      sessionId,
      role: 'user',
      kind: 'text',
      text: actionText,
      taskId: null,
    });
    store.appendMessage(sessionId, {
      sessionId,
      role: 'assistant',
      kind: 'text',
      text: buildStageMismatchReply(eventStage, actionText),
      taskId: null,
    });
    return true;
  };

  const handleSend = (raw: string, attachmentOverride?: ChatAttachment | null, sendOpts?: {
    skipAssess?: boolean;
    attachmentMode?: 'reference' | 'check' | null;
  }) => {
    const text = raw.trim();
    const attachment = attachmentOverride !== undefined ? attachmentOverride : pendingAttachment;
    if (!session || busy) return;
    if (!text && !attachment) return;
    if (text && isDutyContent(text)) { notice.info('值班相关内容暂时隐藏'); return; }
    setInput('');
    clearPending();
    const requestedFlow = FLOW_TASKS.find(name => text === name || text === tenderName(name));
    if (requestedFlow) { setFlow(requestedFlow); return; }
    if (isMeetingMinutesContent(text)) {
      notice.info('会议纪要入口暂时隐藏');
      return;
    }
    if (text && replyStageMismatch(text)) return;
    const waitingSummary = session.messages.find(message => message.documentWorkflow?.stage === 'waiting_input');
    if (waitingSummary && text) {
      void submitWorkSummaryImprovement(session.sessionId, waitingSummary.messageId, text);
      return;
    }
    if (text && /生成.*工作总结|工作总结.*生成|生成全面总结|全面总结/.test(text)) {
      void generateWorkSummary(session.sessionId, text);
      return;
    }
    void sendMessage(session.sessionId, {
      text: text || (attachment ? '请读取附件并确认材料用途。' : ''),
      attachment,
      skipAssess: sendOpts?.skipAssess,
      attachmentMode: sendOpts?.attachmentMode,
    });
  };

  const selectStageChoice = (id: string) => {
    if (!id || !session) { setChoicePicker(''); return; }
    const groups = stageChoices(eventStage ?? '待研判');
    const choice = groups.flatMap(g => g.options).find(c => c.id === id);
    if (!choice) { setChoicePicker(''); return; }
    const apply = () => {
      setQueuedChoice(choice);
      setInput(choice.prompt);
      if (choice.kind === 'file') {
        const ctx = buildStageEventContext(session.eventId, session);
        setPendingAttachment(simulateAttachment(choice, ctx));
      } else {
        setPendingAttachment(null);
      }
      setChoicePicker('');
    };
    if ((input.trim() || pendingAttachment) && (input !== choice.prompt || pendingAttachment)) {
      modal.confirm({
        title: '替换当前未发送内容？',
        content: '用所选示例替换当前输入框与待发附件。',
        okText: '替换',
        cancelText: '取消',
        onOk: apply,
        onCancel: () => setChoicePicker(''),
      });
      return;
    }
    apply();
  };

  const handleLocalUpload = async (fileList: FileList | null) => {
    if (!session || !fileList?.length) return;
    const store = useSessionStore.getState();
    const added: { id: string; name: string; content: string; status: string; kind: string; selected: boolean }[] = [];
    for (const file of Array.from(fileList)) {
      const id = crypto.randomUUID();
      const plain = PLAIN_TEXT_EXT.test(file.name) && file.size <= PLAIN_TEXT_MAX_BYTES;
      let content = '';
      try {
        if (plain) content = (await file.text()).slice(0, PLAIN_TEXT_MAX_CHARS);
      } catch {
        notice.error(`文件读取失败：${file.name}`);
        continue;
      }
      const status = content
        ? '已读取文本 · 来源待核'
        : '仅登记文件名 · 正文未解析';
      added.push({ id, name: file.name, content, status, kind: '本次补充', selected: true });
      store.appendMessage(session.sessionId, {
        sessionId: session.sessionId,
        role: 'assistant',
        kind: 'text',
        taskId: null,
        text: content
          ? `已读取“${file.name}”的文本（演示截断），已加入会话资料区。正式分析请粘贴关键正文并核对来源与时间。`
          : `已附上“${file.name}”。本原型仅登记该格式的文件名，请粘贴关键正文以用于分析。`,
      });
    }
    if (added.length) {
      store.addSessionMaterials(session.sessionId, added);
      setMaterialsOpen(true);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const resolveAttachmentWorkflow = (
    message: ChatMessage,
    action: 'plan' | 'bulletin' | 'check' | 'reference' | 'bind' | 'replace' | 'current',
  ) => {
    const workflow = message.workflow;
    if (!session || !workflow || workflow.resolved || busy) return;
    if (workflow.eventId !== session.eventId) {
      notice.warning('请回到材料所属事件继续处理');
      return;
    }
    useSessionStore.getState().updateAttachmentWorkflow(session.sessionId, message.messageId, {
      ...workflow,
      resolved: true,
    });
    if (action === 'replace') {
      notice.info('请从下拉菜单重新选择本事件材料，再发送。');
      return;
    }
    if (action === 'current') {
      const groups = stageChoices(eventStage ?? '待研判');
      const first = groups[0]?.options[0];
      if (first) {
        setQueuedChoice(first);
        setInput(first.prompt);
        setPendingAttachment(null);
      }
      notice.info('当前阶段提问已填入输入框，请核对后发送。');
      return;
    }
    let attachment: ChatAttachment = { ...workflow.attachment };
    let mode: 'reference' | 'check' | null = null;
    if (action === 'reference') {
      if (!attachment.content) {
        attachment = {
          ...attachment,
          id: attachment.id || crypto.randomUUID(),
          name: attachment.name || '用户提供的历史说明',
          content: workflow.prompt,
          eventId: session.eventId,
          simulated: true,
          kind: attachment.kind || '模拟 Word 附件',
          status: attachment.status || '模拟正文 · 非真实文件解析',
        };
      }
      mode = 'reference';
    } else if (action === 'check') {
      mode = 'check';
    } else if (action === 'bind') {
      attachment = { ...attachment, eventId: session.eventId, eventName: eventTitle };
    } else if (action === 'plan') {
      attachment = { ...attachment, type: 'advice' };
    } else if (action === 'bulletin') {
      attachment = { ...attachment, type: 'bulletin' };
    }
    const confirmText =
      mode === 'reference'
        ? '确认作为历史参考，仅提取参考结构，不纳入当前事件事实。'
        : mode === 'check'
          ? '确认仅检查附件内容，不提交原系统。'
          : action === 'bind'
            ? '确认该附件属于当前事件，请继续整理初稿。'
            : `确认将附件整理为${action === 'plan' ? '处置方案' : '阶段要情'}初稿。`;
    handleSend(confirmText, attachment, { skipAssess: true, attachmentMode: mode });
  };

  const renderWorkflowActions = (workflow: AttachmentWorkflow, message: ChatMessage) => {
    if (workflow.resolved) {
      return <Typography.Text type="secondary" className="axn-intent-resolved">已确认用途（演示）</Typography.Text>;
    }
    const btn = (label: string, action: Parameters<typeof resolveAttachmentWorkflow>[1], testId: string) => (
      <Button
        key={action}
        size="small"
        disabled={busy}
        data-testid={testId}
        onClick={() => resolveAttachmentWorkflow(message, action)}
      >
        {label}
      </Button>
    );
    if (workflow.kind === 'ambiguous') {
      return (
        <div className="axn-intent-actions" data-testid="attachment-workflow-actions">
          {btn('整理为方案', 'plan', 'workflow-plan')}
          {btn('提炼为要情', 'bulletin', 'workflow-bulletin')}
          {btn('仅检查材料', 'check', 'workflow-check')}
        </div>
      );
    }
    if (workflow.kind === 'mismatch') {
      return (
        <div className="axn-intent-actions" data-testid="attachment-workflow-actions">
          {btn('作为历史参考', 'reference', 'workflow-reference')}
          {btn('整理当前阶段资料', 'current', 'workflow-current')}
        </div>
      );
    }
    if (workflow.kind === 'wrongEvent') {
      return (
        <div className="axn-intent-actions" data-testid="attachment-workflow-actions">
          {btn('更换本事件材料', 'replace', 'workflow-replace')}
        </div>
      );
    }
    return (
      <div className="axn-intent-actions" data-testid="attachment-workflow-actions">
        {btn('绑定本事件', 'bind', 'workflow-bind')}
        {btn('更换材料', 'replace', 'workflow-replace')}
      </div>
    );
  };

  const handleQuickTask = async (raw: string) => {
    const text = resolveActionPrompt(raw);
    if (replyStageMismatch(text)) return;
    if (text === '生成工作总结' || text === '生成全面总结') {
      if (session && !busy) {
        await generateWorkSummary(session.sessionId, text === '生成全面总结' ? '生成全面总结' : text);
        useSessionStore.getState().recordFlowProgress(session.sessionId, text);
      }
      return;
    }
    if (isDutyContent(text)) { notice.info('值班相关内容暂时隐藏'); return; }
    if (isMeetingMinutesContent(text)) { notice.info('会议纪要入口暂时隐藏'); return; }
    const code = text === '生成会议纪要' ? 'MEETING_MINUTES' : text === '生成应急要情' ? 'EMERGENCY_BRIEF' : null;
    if (!code) { handleSend(text); return; }
    if (!session || busy) return;
    const sessionId = session.sessionId;
    useSessionStore.getState().appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text, taskId: null });
    const elements = [
      { label: '文书类型', value: code === 'MEETING_MINUTES' ? '会议纪要' : '应急要情' },
      { label: '编制单位', value: '应急指挥中心（模拟）' },
      { label: '报送对象', value: '相关应急工作部门（模拟）' },
      { label: '关联事项', value: eventTitle },
      { label: '内容要求', value: code === 'MEETING_MINUTES' ? '整理议题、参会岗位、议定事项和责任分工；缺项保留待核标记' : '汇总基本情况、先期处置和下一步工作；未核实信息保留待核实标记' },
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
      useSessionStore.getState().recordFlowProgress(sessionId, text);
      useSessionStore.getState().appendMessage(sessionId, {
        sessionId, role: 'assistant', kind: 'text', taskId: null,
        text: `已生成《${document.title}》（模拟文书），已在右侧文书工作区打开。`,
      });
    }
  };

  const chipSplit = useMemo(() => splitQuickTasksByStage(eventStage), [eventStage]);
  const moreActionItems: MenuProps['items'] = useMemo(
    () => chipSplit.secondary.map((item) => ({
      key: item.label,
      label: `${tenderName(item.label)}（${tenderName(item.agentName)}）`,
      disabled: !session || busy,
      onClick: () => { void handleQuickTask(item.label); },
    })),
    // handleQuickTask 依赖 session/busy；用标签列表作稳定依赖即可
    [chipSplit.secondary, session?.sessionId, busy],
  );

  const pending = session?.pendingClarification && tasks[session.pendingClarification.taskId]?.intent !== 'doc_daily' ? session.pendingClarification : null;
  const submitClarification = () => {
    const value = clarifyValue.trim();
    if (!session || !pending || !value) return;
    const prefix = pending.field === 'handOverNotes' ? '交接事项：' : '报送单位：';
    void sendMessage(session.sessionId, { text: `${prefix}${value}` });
    setClarifyValue('');
  };

  // 关联灾情（对话界面内切换）：evt-blank- 前缀或未绑定 → 未关联；否则为绑定事件
  const linkConversationToEvent = useConversationStore((s) => s.linkConversationToEvent);
  const linkValue =
    !activeConversation || !activeConversation.eventId || activeConversation.eventId.startsWith('evt-blank-')
      ? BLANK_LINK
      : activeConversation.eventId;
  const linkOptions = useMemo(
    () => [
      // title 置空：避免与 Ant Design Tooltip 详情叠出浏览器原生 title
      { value: BLANK_LINK, label: '未关联事件（空白对话）', title: '' },
      // Vue 建设场景事件附带阶段，便于对照原型工作台事件列表。
      ...incidents.map((i) => ({
        value: i.eventId,
        label: incidentOptionLabel(i.eventId),
        title: '',
      })),
    ],
    [],
  );
  const notifyEventLinked = (conversationId: string, value: string) => {
    const sessionId = useSessionStore.getState().sessionByConversation[conversationId];
    if (!sessionId) return;
    const linkedSession = useSessionStore.getState().sessions[sessionId];
    const text = value === BLANK_LINK
      ? buildEventUnlinkBriefing()
      : buildEventSwitchBriefing(value, linkedSession);
    useSessionStore.getState().appendMessage(sessionId, {
      sessionId,
      role: 'assistant',
      kind: 'text',
      text,
      taskId: null,
      eventBriefingEventId: value === BLANK_LINK ? null : value,
    });
  };

  const handleLinkChange = (value: string) => {
    if (!activeConversation) return;
    // 未实际变更时不重复提示（例如再次点选当前项）。
    if (value === linkValue) return;
    // undefined → 会话回到专属虚拟事件（保留其独立消息）
    const proceed = () => {
      linkConversationToEvent(activeConversation.id, value === BLANK_LINK ? undefined : value);
      notifyEventLinked(activeConversation.id, value);
    };
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

  // 关联灾情选择器：与发送/语音按钮同排，位于其左侧；已选值与下拉项均悬浮展示详情（文案易截断）
  const incidentSelect = (
    <Tooltip title={incidentOptionDetail(linkValue)} placement="top" mouseEnterDelay={0.25}>
      <Select
        size="small"
        variant="borderless"
        className={`axn-cp-select${compact ? ' axn-cp-select--compact' : ''}`}
        classNames={{ popup: { root: compact ? 'axn-cp-select-popup axn-cp-select-popup--compact' : 'axn-cp-select-popup' } }}
        value={linkValue}
        onChange={handleLinkChange}
        options={linkOptions}
        popupMatchSelectWidth={false}
        optionRender={(option) => (
          <Tooltip
            title={incidentOptionDetail(String(option.value ?? BLANK_LINK))}
            placement="left"
            mouseEnterDelay={0.25}
            destroyOnHidden
          >
            <span className="axn-cp-select-option-label">{option.label}</span>
          </Tooltip>
        )}
        aria-label="关联灾情"
        data-testid="chat-link-incident"
      />
    </Tooltip>
  );

  const items: BubbleItemType[] = useMemo(() => {
    const messages = (session?.messages ?? []).filter(m => !isDutyContent(m.taskId ? tasks[m.taskId]?.intent ?? '' : '') && !/值班日报|值守日报|值班专项/.test(m.text ?? ''));
    const summonedTasks = new Set(messages.filter(message => message.kind === 'agent' && message.taskId && tasks[message.taskId]).map(message => message.taskId));
    return messages.filter(message => !(message.kind === 'task' && summonedTasks.has(message.taskId))).map((m) => {
      if (m.kind === 'task' && m.taskId) {
        const task = tasks[m.taskId];
        return {
          key: m.messageId,
          role: 'task',
          content: tenderName(task?.displayTitle ?? '任务'),
          avatar: AVATAR,
          // 任务卡占满会话栏可用宽度（默认气泡 fit-content 会把长内容挤成窄条）
          styles: {
            root: { flex: '1 1 auto', width: 'auto', minWidth: 0, alignSelf: 'stretch', paddingInlineEnd: 0 },
            body: { flex: '1 1 auto', width: '100%', minWidth: 0, maxWidth: '100%' },
            content: { width: '100%' },
          },
          contentRender: () =>
            task ? (
              <TaskCard
                task={task}
                onOpenDrawer={onOpenDrawer}
                busy={busy}
                onTask={(prompt) => { void handleQuickTask(prompt); }}
                onNavigate={(path) => { navigate(path); }}
              />
            ) : (
              <Tag color="error">任务数据缺失（模拟数据）</Tag>
            ),
        };
      }
      if (m.kind === 'agent') {
        return {
          key: m.messageId,
          role: 'task',
          content: tenderName(m.agentName ?? '智能体协同'),
          avatar: null,
          styles: {
            root: { flex: '1 1 auto', width: 'auto', minWidth: 0, alignSelf: 'stretch', paddingInlineEnd: 0 },
            body: { flex: '1 1 auto', width: '100%', minWidth: 0, maxWidth: '100%' },
            content: { width: '100%', padding: 0, background: 'transparent' },
          },
          contentRender: () => m.documentWorkflow ? (
            <DocumentGenerationCard
              message={m}
              busy={busy}
              onTask={(prompt) => { void handleQuickTask(prompt); }}
              onNavigate={(path) => { navigate(path); }}
            />
          ) : (
            <AgentSummonCard
              agentId={m.agentId}
              agentName={m.agentName ?? '智能体协同'}
              agentRole={m.agentRole ?? ''}
              action={m.text ?? ''}
              status={m.taskId ? tasks[m.taskId]?.status : undefined}
            >
              {m.taskId && tasks[m.taskId] && (
                <TaskCard
                  task={tasks[m.taskId]}
                  onOpenDrawer={onOpenDrawer}
                  busy={busy}
                  onTask={(prompt) => { void handleQuickTask(prompt); }}
                  onNavigate={(path) => { navigate(path); }}
                />
              )}
            </AgentSummonCard>
          ),
        };
      }
      if (m.role === 'user') {
        return {
          key: m.messageId,
          role: 'user',
          content: m.text ?? '',
          contentRender: m.attachment
            ? () => (
              <div className="axn-user-bubble-body">
                <div>{m.text}</div>
                <div className="axn-sent-file">
                  <FileText size={14} aria-hidden />
                  <span>{m.attachment!.name}</span>
                  <small>{m.attachment!.simulated ? '模拟附件 · 已发送' : '附件'}</small>
                </div>
              </div>
            )
            : undefined,
        };
      }
      if (m.role === 'system') {
        return {
          key: m.messageId,
          role: 'system',
          content: m.text ?? '',
          styles: { content: { fontSize: 'var(--fs-body)', color: 'var(--axn-muted)' } },
        };
      }
      if (m.eventBriefingEventId) {
        return {
          key: m.messageId,
          role: 'ai',
          content: m.text ?? '',
          avatar: AVATAR,
          contentRender: () => (
            <EventSwitchBriefingCard
              text={m.text ?? ''}
              eventId={m.eventBriefingEventId!}
              busy={busy}
              onTask={(prompt) => { void handleQuickTask(prompt); }}
              onNavigate={(path) => { navigate(path); }}
            />
          ),
        };
      }
      if (m.workflow) {
        return {
          key: m.messageId,
          role: 'ai',
          content: m.text ?? '',
          avatar: AVATAR,
          contentRender: () => (
            <div className="axn-attachment-workflow">
              <Typography.Paragraph className="axn-event-briefing-text">{m.text}</Typography.Paragraph>
              {renderWorkflowActions(m.workflow!, m)}
            </div>
          ),
        };
      }
      return { key: m.messageId, role: 'ai', content: m.text ?? '', avatar: AVATAR };
    });
  }, [session?.messages, tasks, onOpenDrawer, busy, navigate]);

  const hasMessages = items.length > 0;

  return (
    <div className="axn-chat-page">
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
          {/* 对话未开始（无消息）时不显示事件标题：此时上下文由下方「关联灾情」选择器承载，
              标题只是重复（标注 vibe_1791303121889）。首条消息出现后标题回归。 */}
          <Button size="small" onClick={() => navigate(`/events?event=${encodeURIComponent(currentEventId)}`)}>灾种事件库</Button>
          {hasMessages && (
            <Text strong className="axn-cp-title" data-testid="header-event">
              {eventTitle}
            </Text>
          )}
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
              styles: { content: { background: token.colorBgContainer, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: '4px 14px 14px 14px', padding: '14px 16px', lineHeight: 1.85, maxWidth: '100%', overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' } },
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
              按灾情研判 → 力量投送 → 实施救援三场景串联演示；下方快捷任务按当前事件阶段推荐关键动作。
            </Typography.Paragraph>

            <div className="axn-home-block" data-testid="home-construction-scenarios">
              <Text type="secondary" className="axn-tc-fs13">建设场景 · 灾情研判 / 力量投送 / 实施救援</Text>
              <div className="axn-scenario-grid">
                {CONSTRUCTION_SCENARIO_PROMPTS.map((item) => (
                  <button
                    key={item.label}
                    type="button"
                    className="axn-scenario-card"
                    data-agent-id={item.agentId}
                    data-scenario={item.scenario}
                    disabled={!session || busy}
                    title={`${item.scenario} · ${tenderName(item.agentName)}`}
                    onClick={() => { void handleQuickTask(item.prompt); }}
                  >
                    <span className="axn-scenario-card-title">{tenderName(item.label)}</span>
                    <span className="axn-scenario-card-text">{item.prompt}</span>
                    <span className="axn-scenario-card-tag">{item.tag} · {tenderName(item.agentName)}</span>
                  </button>
                ))}
              </div>
            </div>

            <div className="axn-home-block" data-testid="home-chat-recommend">
              <Text type="secondary" className="axn-tc-fs13">知识问答推荐</Text>
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
              也可直接输入指令，或在下方输入区使用快捷任务调用对应智能体。
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

      {/* 快捷任务：场景关键推荐平铺 + 其余收入「更多动作」 */}
      <div className="axn-cp-chips-wrap">
        <div className="axn-chips" data-testid="quick-task-chips">
          {chipSplit.scenarioLabel ? (
            <Tag className="axn-chip-scenario-tag" color="blue">
              {tenderName(chipSplit.scenarioLabel)}
            </Tag>
          ) : null}
          {chipSplit.primary.map(({ label, agentName, agentId }) => (
            <Button
              key={label}
              size="small"
              type="primary"
              ghost
              className="axn-chip axn-chip--primary"
              title={`${tenderName(agentName)} · 当前场景推荐`}
              data-agent-id={agentId}
              data-testid={`chip-primary-${label}`}
              disabled={!session || busy}
              onClick={() => { void handleQuickTask(label); }}
            >
              {tenderName(label)}
            </Button>
          ))}
          {chipSplit.secondary.length > 0 ? (
            <Dropdown menu={{ items: moreActionItems }} trigger={['click']} placement="topLeft">
              <Button
                size="small"
                className="axn-chip axn-chip--more"
                disabled={!session || busy}
                data-testid="chip-more-actions"
              >
                更多动作
              </Button>
            </Dropdown>
          ) : null}
          <Button size="small" disabled={!session || busy} onClick={() => setFlow('现场智能勘察')}>整体业务流程</Button>
        </div>
      </div>
      {/* 圆角一体化输入区：关联灾情与发送/语音按钮同在输入框右下角；分屏时用 compact 收紧内部布局 */}
      <div className={`axn-composer${compact ? ' axn-composer--compact' : ''}`}>
        <div className="axn-composer-shell">
          <div className="axn-composer-toolbar">
            <label className="axn-stage-prompt-picker">
              <span>{compact ? '阶段提问' : '当前阶段提问／模拟文件'}</span>
              <Select
                size="small"
                allowClear
                placeholder={compact ? '选择提问或模拟文件' : '选择后填入输入框，由你点击发送'}
                value={choicePicker || undefined}
                disabled={!session || busy || !eventStage}
                aria-label="选择提问或模拟文件"
                data-testid="stage-choice-picker"
                popupMatchSelectWidth={compact ? false : true}
                classNames={compact ? { popup: { root: 'axn-stage-prompt-popup--compact' } } : undefined}
                options={stageChoices(eventStage ?? '待研判').map(group => ({
                  label: group.label,
                  options: group.options.map(opt => ({ value: opt.id, label: opt.label })),
                }))}
                onChange={value => selectStageChoice(String(value ?? ''))}
                className="axn-stage-prompt-select"
              />
            </label>
            <Button
              type="link"
              size="small"
              className="axn-composer-materials-btn"
              disabled={!session}
              data-testid="open-session-materials"
              onClick={() => setMaterialsOpen(true)}
            >
              {compact
                ? `资料${session?.materials?.length ? ` ${session.materials.length}` : ''}`
                : `资料${session?.materials?.length ? `（${session.materials.length}）` : ''}`}
            </Button>
          </div>
          {pendingAttachment && (
            <div className="axn-pending-file" data-testid="pending-attachment">
              <span>
                <FileText size={14} aria-hidden /> {pendingAttachment.name}
                <small>模拟附件 · 待发送</small>
              </span>
              <Button
                type="text"
                size="small"
                icon={<X size={14} />}
                aria-label="移除待发附件"
                onClick={clearPending}
              />
            </div>
          )}
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept={LOCAL_FILE_ACCEPT}
            className="axn-file-input-hidden"
            data-testid="chat-file-input"
            onChange={e => { void handleLocalUpload(e.target.files); }}
          />
          <Sender
            value={input}
            onChange={(v) => setInput(v)}
            onSubmit={(message) => handleSend(message)}
            loading={runningTask != null}
            onCancel={() => {
              if (runningTask) cancelTask(runningTask.taskId);
            }}
            prefix={(
              <Tooltip title="添加资料（本机文件登记）">
                <Button
                  type="text"
                  size="small"
                  icon={<Paperclip size={16} />}
                  aria-label="添加资料"
                  data-testid="chat-attach-button"
                  disabled={!session || busy}
                  onClick={() => fileInputRef.current?.click()}
                />
              </Tooltip>
            )}
            suffix={(_, { components: { LoadingButton, SendButton, SpeechButton } }) => (
              <>
                {incidentSelect}
                {/* 空输入且无附件→语音；有文字→SendButton；仅附件→自定义发送（避免 Sender 禁用空值） */}
                {runningTask != null ? (
                  <LoadingButton />
                ) : input.trim() ? (
                  <SendButton />
                ) : pendingAttachment ? (
                  <Button
                    type="primary"
                    shape="circle"
                    aria-label="发送附件"
                    data-testid="send-attachment-only"
                    onClick={() => handleSend('', pendingAttachment)}
                  >
                    发
                  </Button>
                ) : (
                  <SpeechButton variant="solid" color="primary" shape="circle" />
                )}
              </>
            )}
            autoSize={compact ? { minRows: 2, maxRows: 4 } : { minRows: 3, maxRows: 6 }}
            placeholder={
              session
                ? (pendingAttachment
                  ? (compact ? '可补充说明后发送' : '可补充说明后发送，或直接发送附件')
                  : (compact ? '向安小能发送指令…' : '向安小能发送指令，Enter 发送；可点回形针添加资料'))
                : '会话初始化中…'
            }
            disabled={!session || !!generatingDocument}
          />
        </div>
      </div>
      <SessionMaterialsDrawer
        open={materialsOpen}
        sessionId={session?.sessionId}
        eventId={session?.eventId ?? currentEventId}
        onClose={() => setMaterialsOpen(false)}
      />
      {flow && (
        <OperationalFlows
          key={`${session?.sessionId}:${currentEventId}`}
          eventId={currentEventId}
          eventName={eventDisplayName(currentEventId)}
          initial={flow}
          eventStage={eventStage}
          onClose={() => setFlow(null)}
          onTask={(text) => {
            setFlow(null);
            void handleQuickTask(text);
          }}
        />
      )}
    </div>
  );
}
