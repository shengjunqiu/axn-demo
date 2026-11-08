import { generateWorkSummary, submitWorkSummaryImprovement } from '@/services/workSummaryWorkflow';
import { startWeeklyDynamics, submitDynamicsSources } from '@/services/weeklyDynamicsWorkflow';
import { formatSize } from '@/shared/format';
/**
 * 安小能对话工作流（UI 改版）：会话头（标题 + 关联灾情）+ 消息流（Bubble.List）
 * + 圆角一体化输入区 + 补录表单。
 * 首页引导问题取自已接入知识库的 qa.json；五个智能体入口在当前对话追加自我介绍与功能选项。
 * 会话跟随演示事件切换（ensureSessionForConversation）；消息与任务状态全部订阅 sessionStore，不本地复制。
 * 本界面为模拟数据演示（规则意图识别，不接真实大模型）。
 */
import { forwardRef, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { TextAreaRef } from 'antd/es/input/TextArea';
import { useSessionTasks } from '@/hooks/useSessionTasks';
import {
  ArrowUp,
  Bot,
  BriefcaseBusiness,
  ChevronDown,
  Globe,
  MapPin,
  Plus,
  MessageSquare,
  PanelLeftClose,
  PanelLeftOpen,
  Paperclip,
  X,
} from 'lucide-react';
import { Alert, App as AntdApp, Button, Input, Popover, Segmented, Space, Switch, Tag, Tooltip, Typography, Upload, theme } from 'antd';
import { Bubble, Sender } from '@ant-design/x';
import type { BubbleItemType } from '@ant-design/x';
import { useConversationStore } from '@/store/conversationStore';
import { useDemoStore } from '@/store/demoStore';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useSessionStore } from '@/store/sessionStore';
import { useActiveScope, useWorkspaceStore } from '@/store/workspaceStore';
import { sendMessage, cancelTask } from '@/services/taskRunner';
import { AGENT_INVITATIONS } from '@/seed/agentInvitations';
import { canAccessAgent } from '@/seed/agentAccess';
import { useAgentAccess } from '@/hooks/useAgentAccess';
import ResponseFeedback from './ResponseFeedback';
import EmergencyBriefForm, { type BriefFigure, type BriefFormValues } from './EmergencyBriefForm';
import { summonAgentInConversation } from '@/services/agentConversation';
import { AGENT_ICONS, agentIcon } from './agentIcons';
import { eventRequirement } from '@/services/eventRequirement';
import { incidentById } from '@/seed/scenario';
import { eventDisplayName } from '@/services/factLookup';
import TaskCard from './TaskCard';
import DocumentGenerationCard from './DocumentGenerationCard';
import { DocumentReviewCard } from '@/components/doc/DocumentReview';
import AgentSummonCard from './AgentSummonCard';
import IncidentPicker from './IncidentPicker';
import ComposerSkillPicker from './ComposerSkillPicker';
import BrandMark from '@/components/brand/BrandMark';
import { COMPOSE_EVENT } from '@/components/doc/SelectionAssist';
import TokenTextArea, { type TokenTextAreaProps } from './TokenTextArea';
import './chat.css';

const { Text } = Typography;

export interface ChatPanelProps {
  onOpenDrawer: (target: 'resource' | 'knowledge') => void;
  compact?: boolean;
}

const AVATAR = <div className="axn-chat-avatar"><BrandMark size={28} /></div>;

// 语音输入模拟用的示例话语（标注 vibe_1791960862035）：点麦克风逐字「转写」这句话。
const SPEECH_SAMPLE = '请汇总南堤堤防管涌险情的最新处置进展，并生成一份情况报告';

/** 文书生成智能体的输入模板：# 后是斜体占位符，点上方文书类型或占位符后替换。 */
const DOC_TEMPLATE = '帮我写一份#文书类型，针对的事件是#灾情事件';
const DOC_TYPE_PATTERN = /^帮我写一份\s*(值班日报|应急要情|周工作动态|工作总结)/;

/** 五类智能体共用的功能选择区。文书入口保留已有测试定位。 */
function AgentInviteChoices({ agentId, options, hint, disabled, onPick, showOptions = true }: {
  agentId?: string;
  options: { label: string; task: string }[];
  hint: string;
  disabled: boolean;
  onPick: (task: string, label: string) => void;
  /** 方案二工作模式把能力按钮挪到输入框上方，卡片里只留提示语。 */
  showOptions?: boolean;
}) {
  return (
    <div className="axn-doc-choices" data-testid={agentId === 'agent-doc' || !agentId ? 'doc-agent-choices' : 'agent-invite-choices'} data-agent-id={agentId}>
      {showOptions && (
        <div className="axn-doc-choice-row">
          {options.map(({ label, task }) => (
            <Button key={task} size="small" className="axn-doc-choice" data-choice-task={task} disabled={disabled} onClick={() => onPick(task, label)}>
              {label}
            </Button>
          ))}
        </div>
      )}
      <Text type="secondary" className="axn-doc-hint">{hint}</Text>
    </div>
  );
}

export default function ChatPanel({ onOpenDrawer, compact = false }: ChatPanelProps) {
  const { token } = theme.useToken();
  const { message } = AntdApp.useApp();
  const currentEventId = useDemoStore((s) => s.currentEventId);
  const sidebarCollapsed = useDemoStore((s) => s.sidebarCollapsed);
  const toggleSidebar = useDemoStore((s) => s.toggleSidebar);
  const actorUserName = useDemoStore((s) => s.getActor().userName);
  const actorId = useDemoStore((s) => s.actorId);
  const designPlan = useDemoStore((s) => s.designPlan);
  const interactionMode = useDemoStore((s) => s.interactionMode);
  const planTwoWorkMode = designPlan === 'two' && interactionMode === 'work';
  /** 方案一和方案二工作模式：智能体能力按钮横排展示在输入框上方；方案二对话模式无智能体入口。 */
  const showAgentCapabilityBar = designPlan === 'one' || planTwoWorkMode;
  const setInteractionMode = useDemoStore((s) => s.setInteractionMode);
  const { agents: visibleAgents, canUseAgent } = useAgentAccess();
  const homeDescription = visibleAgents.length === 0
    ? '您可以向我提问，我会帮您解答疑问、梳理信息。'
    : visibleAgents.length === AGENT_INVITATIONS.length
      ? '您可以向我提问，也可以让我帮您生成文书、感知灾情态势、查询救援资源、编制救援方案和评估救援效果。'
      : '您可以向我提问，也可以让我帮您生成文书、汇总灾情信息和研判应急态势。';
  const activeConversation = useConversationStore((s) =>
    s.activeConversationId ? s.conversations[s.activeConversationId] : null,
  );
  const activeConversationId = activeConversation?.id ?? null;
  const session = useSessionStore((s) => s.sessions[s.sessionByConversation[activeConversationId ?? ''] ?? '']);
  const tasks = useSessionTasks(session);
  const scope = useActiveScope();

  const [input, setInput] = useState('');
  const [pendingEventAction, setPendingEventAction] = useState<{ conversationId: string; label: string; run: () => void } | null>(null);
  const [skillPickerOpen, setSkillPickerOpen] = useState(false);
  const [incidentPickerOpen, setIncidentPickerOpen] = useState(false);
  /** 从输入框里的 #灾情事件 占位符打开选择器：选中后只替换文本，不改会话关联。 */
  const [pendingEventToken, setPendingEventToken] = useState(false);
  /** 方案二工作模式：智能体入口收进「应急专家」弹窗，不再在输入框上方平铺 chips。 */
  const [agentPickerOpen, setAgentPickerOpen] = useState(false);
  /** 应急要情的表头表单：点「生成应急要情」先弹出，填完直接出件（不再演逐项收集）。 */
  const [briefFormOpen, setBriefFormOpen] = useState(false);
  useEffect(() => { setIncidentPickerOpen(false); setPendingEventToken(false); setAgentPickerOpen(false); setPendingEventAction(null); }, [activeConversationId]);
  useEffect(() => {
    setPendingEventAction(null);
    setBriefFormOpen(false);
    setAgentPickerOpen(false);
  }, [actorId, designPlan, interactionMode]);
  const [skillQuery, setSkillQuery] = useState<string | null>(null);
  const skillCommandStart = useRef<number | null>(null);
  const changeSkillPickerOpen = useCallback((open: boolean) => {
    setSkillPickerOpen(open);
    if (open) { setIncidentPickerOpen(false); setAgentPickerOpen(false); setPendingEventAction(null); }
    if (!open) {
      const start = skillCommandStart.current;
      if (start !== null) setInput(previous => previous.slice(0, start));
      skillCommandStart.current = null;
      setSkillQuery(null);
    }
  }, []);
  const composerRef = useRef<HTMLDivElement>(null);
  const [mobileComposer, setMobileComposer] = useState(() => window.matchMedia('(max-width: 767px)').matches);
  const [toolsOpen, setToolsOpen] = useState(false);
  // 工作区展开会压缩对话栏：按输入框实际宽度切换，不能只判断浏览器宽度。
  useEffect(() => {
    const shell = composerRef.current;
    if (!shell) return;
    const observer = new ResizeObserver(([entry]) => {
      setMobileComposer(entry.contentRect.width <= 820);
    });
    observer.observe(shell);
    return () => observer.disconnect();
  }, []);
  useEffect(() => { setToolsOpen(false); }, [mobileComposer]);
  const [clarifyValue, setClarifyValue] = useState('');
  // 文书选区 AI 操作条（SelectionAssist）把「指令 + 原文」送进输入框，等用户确认后再发
  useEffect(() => {
    const onCompose = (e: Event) => {
      const text = (e as CustomEvent<string>).detail;
      if (typeof text !== 'string') return;
      setInput(text);
      requestAnimationFrame(() => {
        const el = document.querySelector<HTMLTextAreaElement>('.axn-composer textarea, .ant-sender textarea');
        el?.focus();
        el?.setSelectionRange(el.value.length, el.value.length);
      });
    };
    window.addEventListener(COMPOSE_EVENT, onCompose);
    return () => window.removeEventListener(COMPOSE_EVENT, onCompose);
  }, []);
  // 上传的文件：演示环境没有上传接口，不落盘也不读取内容，只把文件名与大小随消息记下来
  const [attachments, setAttachments] = useState<{ uid: string; name: string; size: number }[]>([]);
  const [webSearchEnabled, setWebSearchEnabled] = useState(false);

  // 应急专家浮层：点击外部或按 Escape 收起（与技能浮层一致）。
  useEffect(() => {
    if (!agentPickerOpen) return;
    const outside = (event: PointerEvent) => {
      const target = event.target as Node;
      if (composerRef.current?.querySelector('.axn-composer-agent-menu')?.contains(target)) return;
      if (target instanceof HTMLElement && target.closest('[data-testid="composer-agent-picker"]')) return;
      setAgentPickerOpen(false);
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setAgentPickerOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', keyboard);
    return () => {
      document.removeEventListener('pointerdown', outside);
      document.removeEventListener('keydown', keyboard);
    };
  }, [agentPickerOpen]);

  const addAttachments = (files: File[]) => {
    setAttachments((prev) => [
      ...prev,
      ...files.map((f, i) => ({ uid: `${f.name}-${f.size}-${Date.now()}-${i}`, name: f.name, size: f.size })),
    ]);
  };
  const removeAttachment = (uid: string) => setAttachments((prev) => prev.filter((f) => f.uid !== uid));

  // 语音输入（标注 vibe_1791960862035）：演示环境没有麦克风/语音识别，点语音按钮改为
  // 「模拟实时转写」——逐字把一段示例话语填进输入框，按钮同步显示录音中的动画。
  const [transcribing, setTranscribing] = useState(false);
  const speechTimer = useRef<number | null>(null);
  const stopTranscribing = useCallback(() => {
    if (speechTimer.current != null) {
      window.clearInterval(speechTimer.current);
      speechTimer.current = null;
    }
    setTranscribing(false);
  }, []);
  const startTranscribing = useCallback(() => {
    stopTranscribing();
    setInput('');
    setTranscribing(true);
    let i = 0;
    speechTimer.current = window.setInterval(() => {
      i += 1;
      setInput(SPEECH_SAMPLE.slice(0, i));
      if (i >= SPEECH_SAMPLE.length) stopTranscribing();
    }, 70);
  }, [stopTranscribing]);
  // 卸载/切会话时别把 interval 留住
  useEffect(() => () => stopTranscribing(), [stopTranscribing]);
  useEffect(() => {
    stopTranscribing();
    setInput(''); setClarifyValue(''); setAttachments([]);
  }, [session?.sessionId, stopTranscribing]);

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
  // 素材依赖型文书（周工作动态）正在等参考文档/附件：气泡里不做上传入口，入口就是输入框的 📎，
  // 所以这时候在 📎 上出箭头动画把目光带过去（用户 m00810），要传什么写在气泡里。卡片与输入框共用这一份判断。
  const waitingUpload = session?.messages.find(message => message.documentWorkflow?.stage === 'waiting_upload') ?? null;
  /** 只传了附件、输入框里还没打字：等材料期间这就算一条完整输入，回车与发送按钮都交得出去。 */
  const submittingSources = waitingUpload != null && attachments.length > 0;

  const requestEventBeforeTask = async (text: string, run: () => void, agentId?: string, label?: string) => {
    if (!activeConversationId || !session) return true;
    const conversationId = activeConversationId;
    const current = useConversationStore.getState().conversations[conversationId];
    if (incidentById.has(current?.eventId ?? '')) return false;
    const required = await eventRequirement(text, session, agentId);
    // 识别期间切换了对话，则放弃这次待执行操作。
    const conversations = useConversationStore.getState();
    if (conversations.activeConversationId !== conversationId) return true;
    if (!required || incidentById.has(conversations.conversations[conversationId]?.eventId ?? '')) return false;
    changeSkillPickerOpen(false);
    setPendingEventAction({ conversationId, label: label ?? required.title, run });
    setIncidentPickerOpen(true);
    return true;
  };

  const handleSend = async (raw: string): Promise<void> => {
    const text = raw.trim();
    if (!session || busy) return;
    // 附件随本条消息送出后清空。消费附件的两条路：周工作动态的上传门（下面）、默认问答。
    const pendingAttachments = attachments;
    // 上传门开着时，把文件直接发过来 = 上传并开始生成，所以允许只传文件不写字。
    if (!text && !(waitingUpload && pendingAttachments.length)) return;
    // 文书模板句：走对应文书的既有生成入口（值班日报/应急要情/周工作动态/工作总结）。
    const docTemplate = text.match(DOC_TYPE_PATTERN);
    if (docTemplate) {
      const label = docTemplate[1];
      const task = label === '值班日报' ? '生成值班日报'
        : label === '应急要情' ? '生成应急要情'
          : label === '周工作动态' ? '生成应急救援周工作动态'
            : '生成工作总结';
      setInput('');
      setAttachments([]);
      await handleQuickTask(task, 'agent-doc', label, text);
      return;
    }
    const waitingSummary = session.messages.find(message => message.documentWorkflow?.stage === 'waiting_input');
    const documentInput = (waitingUpload && pendingAttachments.length) || waitingSummary || /生成.*工作总结|工作总结.*生成/.test(text);
    const agentContext = activeConversation?.source === 'agent-management' ? session.messages.find(item => item.kind === 'agent' && item.choices)?.agentId : undefined;
    if (!documentInput && await requestEventBeforeTask(text, () => { void handleSend(raw); }, agentContext)) return;
    setInput('');
    setAttachments([]);
    if (waitingUpload && pendingAttachments.length) {
      void submitDynamicsSources(session.sessionId, waitingUpload.messageId, pendingAttachments);
      return;
    }
    if (waitingSummary) {
      void submitWorkSummaryImprovement(session.sessionId, waitingSummary.messageId, text);
      return;
    }
    if (/生成.*工作总结|工作总结.*生成/.test(text)) {
      void generateWorkSummary(session.sessionId, text);
      return;
    }
    void sendMessage(session.sessionId, { text, attachments: pendingAttachments.length ? pendingAttachments : undefined });
  };

  /** 只传了附件、输入框里没打字时的提交：Sender 内部按输入值拦提交（内部 state，props 改不了），所以这条路自己走。
   *  与 handleSend 里“上传门开着时直接发文件”是同一条路（那边管的是“打了字又带了附件”）。 */
  const startDynamicsWithSources = () => {
    if (!session || !waitingUpload || attachments.length === 0) return;
    const files = attachments;
    setAttachments([]);
    void submitDynamicsSources(session.sessionId, waitingUpload.messageId, files);
  };

  const handleQuickTask = async (text: string, agentId?: string, label?: string, displayText?: string): Promise<void> => {
    if (!session || busy) return;
    const demo = useDemoStore.getState();
    if (agentId && !canAccessAgent(demo.actorId, agentId, demo)) return;
    if (await requestEventBeforeTask(text, () => { void handleQuickTask(text, agentId, label, displayText); }, agentId, label)) return;
    if (text === '生成工作总结') {
      if (session && !busy) await generateWorkSummary(session.sessionId, text);
      return;
    }
    // 素材依赖型文书：先落一张上传门，等参考文档/附件到位再收要素并生成。
    if (text === '生成应急救援周工作动态') {
      if (session && !busy) startWeeklyDynamics(session.sessionId, text);
      return;
    }
    const code = text === '生成值班日报' ? 'DUTY_DAILY' : text === '生成应急要情' ? 'EMERGENCY_BRIEF' : null;
    if (!code) { handleSend(text); return; }
    if (!session || busy) return;
    // 应急要情：先弹表单让值班员填期号/审阅人/报送/承办/值班员/电话，填完直接出件，不再模拟逐项收集。
    if (code === 'EMERGENCY_BRIEF') { setBriefFormOpen(true); return; }
    const elements = [
      { label: '文书类型', value: '值班日报' },
      { label: '编制单位', value: '应急指挥中心' },
      { label: '报送对象', value: '相关应急工作部门' },
      { label: '值班时段', value: '当日 08:00—20:00' },
      { label: '交接要求', value: '持续跟踪重点风险、核实待报信息并做好交接' },
      { label: '文书格式', value: '红头格式，包含标题、正文与落款' },
    ];
    useSessionStore.getState().appendMessage(session.sessionId, { sessionId: session.sessionId, role: 'user', kind: 'text', text: displayText ?? text, taskId: null });
    await runDocumentGeneration({ sessionId: session.sessionId, code, elements, role: text });
  };

  /** 建气泡 → 生成 → 落完成态。collect=false 表示要素已经由表单拿到，气泡从「调用」起步、不演收集动画。 */
  const runDocumentGeneration = async ({ sessionId, code, elements, role, collect = true, patch, action = '根据已收集的文书要素生成红头文书' }: {
    sessionId: string;
    code: string;
    elements: { label: string; value: string }[];
    role: string;
    collect?: boolean;
    patch?: { number?: string; paper?: Readonly<Record<string, string>>; figures?: readonly BriefFigure[] };
    action?: string;
  }): Promise<void> => {
    const invocation = useSessionStore.getState().appendMessage(sessionId, {
      sessionId, role: 'assistant', kind: 'agent', text: action, taskId: null,
      agentId: 'agent-doc', agentName: '文书生成智能体', agentRole: role,
      documentWorkflow: { stage: collect ? 'collecting' : 'calling', elements },
    });
    const document = await useMockDocumentStore.getState().generate(sessionId, code, {
      elements, patch,
      // 表单已经拿到要素：给一个空 collect 就跳过 generate 里逐条吐要素的死等。
      ...(collect ? {} : { collect: async () => undefined }),
      // 逐条上报进度，气泡里的收集进度条才有东西走（用户 m01044）。
      onCollected: count => useSessionStore.getState().updateDocumentWorkflow(sessionId, invocation.messageId, { stage: 'collecting', elements, collectedCount: count }),
      onStage: stage => useSessionStore.getState().updateDocumentWorkflow(sessionId, invocation.messageId, { stage, elements }),
    });
    useSessionStore.getState().updateDocumentWorkflow(sessionId, invocation.messageId, {
      stage: document ? 'completed' : 'interrupted', elements, documentId: document?.id,
    });
    // 不再追加「已生成《…》，已在右侧文书工作区打开」这条消息：气泡自己就是这条消息，
    // 同一件事说两遍（用户 m00705「气泡里只展示一个要素收集的过程，其他不要了」）。
  };

  /** 应急要情表单提交：六个表头直接写进纸面（期号/审阅/报送/承办/值班员/电话），附图接在正文之后。 */
  const submitBriefForm = (values: BriefFormValues, figures: BriefFigure[]) => {
    setBriefFormOpen(false);
    if (!session || busy) return;
    const paper = {
      sign: `审\u3000阅：${values.reviewer}`,
      brief1: `报送：${values.reportingUnit}。`,
      brief3: `承办：${values.organizer}\u2003\u2003编辑：${values.dutyOfficer}\u2003电话：${values.dutyPhone}`,
    };
    void runDocumentGeneration({
      sessionId: session.sessionId, code: 'EMERGENCY_BRIEF', role: '生成应急要情', collect: false,
      action: '根据表单填写的表头信息生成红头文书',
      patch: { number: values.issue, paper, figures },
      elements: [
        { label: '文书类型', value: '应急要情' },
        { label: '期号', value: values.issue },
        { label: '审阅人', value: values.reviewer },
        { label: '报送单位', value: values.reportingUnit },
        { label: '承办单位', value: values.organizer },
        { label: '值班员', value: values.dutyOfficer },
        { label: '值班电话', value: values.dutyPhone },
        ...(figures.length ? [{ label: '附图', value: `${figures.length} 张` }] : []),
      ],
    });
  };

  const handleAgentInvite = (agentId: string) => {
    if (!session || busy) return;
    summonAgentInConversation(session.sessionId, agentId);
  };

  const pending = session?.pendingClarification ?? null;
  const submitClarification = () => {
    const value = clarifyValue.trim();
    if (!session || !pending || !value) return;
    const prefix = pending.field === 'handOverNotes' ? '交接事项：' : '报送单位：';
    void sendMessage(session.sessionId, { text: `${prefix}${value}` });
    setClarifyValue('');
  };

  const isBlankEvent = currentEventId.startsWith('evt-blank-');
  const eventTitle = isBlankEvent ? '空白对话（未关联事件）' : eventDisplayName(currentEventId);

  // 关联灾情（对话界面内切换）：evt-blank- 前缀或未绑定 → 未关联；否则为绑定事件
  const linkConversationToEvent = useConversationStore((s) => s.linkConversationToEvent);
  const BLANK = '__blank__';
  const linkValue =
    !activeConversation || !activeConversation.eventId || activeConversation.eventId.startsWith('evt-blank-')
      ? BLANK
      : activeConversation.eventId;
  const handleLinkChange = (value: string, afterLink?: () => void) => {
    if (!activeConversation) return;
    const updated = linkConversationToEvent(activeConversation.id, value);
    if (!updated) return;
    if (updated.id !== activeConversation.id) {
      // 新会话只保留专属智能体身份，不复制原会话的消息、文件或任务。
      const agentId = activeConversation.source === 'agent-management' ? session?.messages.find(item => item.kind === 'agent' && item.choices)?.agentId : undefined;
      const newSessionId = useSessionStore.getState().sessionByConversation[updated.id];
      if (agentId && newSessionId) summonAgentInConversation(newSessionId, agentId);
      message.success('已新开会话并关联事件，原会话已保留');
    }
    afterLink?.();
  };

  // 关联灾情：从输入框入口打开居中弹窗，支持事件名称搜索。
  // 未关联时显示 placeholder「选择关联灾情事件」（标注 vibe_1791787570681）。
  const incidentSelect = (
    <>
      <button
        type="button"
        className={`axn-cp-select${linkValue === BLANK ? ' is-empty' : ''}`}
        onClick={() => { changeSkillPickerOpen(false); setPendingEventAction(null); setIncidentPickerOpen(!incidentPickerOpen); }}
        aria-label="关联灾情"
        aria-description={linkValue === BLANK ? '未关联灾情' : eventDisplayName(linkValue)}
        aria-haspopup="dialog"
        aria-expanded={incidentPickerOpen}
        data-testid="chat-link-incident"
      >
        <MapPin size={14} aria-hidden />
        <span className="axn-cp-select-text">{mobileComposer ? '灾情' : linkValue === BLANK ? '选择关联灾情事件' : eventDisplayName(linkValue)}</span>
        <ChevronDown size={12} aria-hidden className="axn-cp-select-caret" />
      </button>
      <IncidentPicker
        open={incidentPickerOpen}
        containerRef={composerRef}
        value={pendingEventToken ? 'none' : linkValue === BLANK ? 'none' : linkValue}
        taskLabel={pendingEventAction?.label}
        hasUnsavedChanges={pendingEventToken ? false : useWorkspaceStore.getState().isDirty(scope)}
        confirmOnPick={pendingEventToken}
        onClose={() => { setIncidentPickerOpen(false); setPendingEventToken(false); setPendingEventAction(null); }}
        onSelect={(id) => {
          if (pendingEventToken) {
            setPendingEventToken(false);
            setIncidentPickerOpen(false);
            setInput(previous => previous.replace('#灾情事件', eventDisplayName(id)));
            requestAnimationFrame(() => composerRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus());
            return;
          }
          const pendingAction = pendingEventAction;
          handleLinkChange(id, () => {
            if (!pendingAction) return;
            const conversations = useConversationStore.getState();
            if (conversations.activeConversationId !== pendingAction.conversationId || !incidentById.has(conversations.conversations[pendingAction.conversationId]?.eventId ?? '')) return;
            setPendingEventAction(null);
            pendingAction.run();
          });
        }}
      />
    </>
  );

  const composerTools = (<>
              {/* 上传文件（输入框左下角，标注见本行）：演示环境不落盘也不上传，只把文件名/大小附在消息上。
                 周工作动态的上传入口在对话气泡的卡里（用户 m00994），所以这里不再挂箭头提示、也不再挂弹出层；
                 但文件依旧可以在这里交给智能体（上传门开着时＝交材料）。
                 外面这层 span 只给 Upload 收 ref（antd Upload 不转 ref，直接当 child 会告警）。 */}
              <span className="axn-composer-upload-wrap">
              <Upload
                multiple
                showUploadList={false}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.md,.png,.jpg,.jpeg"
                beforeUpload={(file) => {
                  addAttachments([file]);
                  return false; // 没有上传接口：只拦下文件，不让 antd 发起请求
                }}
              >
                <Button
                  type="text"
                  className="axn-composer-upload"
                  icon={<Paperclip size={18} />}
                  aria-label="上传文件"
                  title="上传文件"
                  data-testid="composer-upload"
                />
              </Upload>
              </span>
              {planTwoWorkMode ? (
                <Button
                  type="text"
                  className="axn-composer-agent-picker"
                  icon={<Bot size={16} aria-hidden />}
                  onClick={() => { changeSkillPickerOpen(false); setAgentPickerOpen(true); }}
                  disabled={!session || busy}
                  aria-haspopup="dialog"
                  aria-expanded={agentPickerOpen}
                  data-testid="composer-agent-picker"
                >
                  应急专家
                </Button>
              ) : (
                <Tooltip classNames={{ root: 'axn-composer-web-search-tooltip' }} title="当前为原型演示，暂未接入真实联网检索">
                  <label className={`axn-composer-web-search${webSearchEnabled ? ' is-on' : ''}`}>
                    <Globe size={14} aria-hidden />
                    <span className="axn-composer-web-search-label">联网<span className="axn-composer-web-search-full">搜索</span></span>
                    <Switch
                      size="small"
                      checked={webSearchEnabled}
                      onChange={(on) => {
                        setWebSearchEnabled(on);
                        // 触屏上看不到悬停提示：开 / 关时用一句轻提示交代状态与演示边界
                        if (window.matchMedia?.('(hover: none)').matches) {
                          message.open({ key: 'web-search', type: 'info', content: on ? '已开启联网搜索（演示环境暂未接入真实检索）' : '已关闭联网搜索' });
                        }
                      }}
                      aria-label="联网搜索"
                    />
                  </label>
                </Tooltip>
              )}
  </>);

  // 方案二工作模式：最近召唤的智能体，其能力按钮以横排展示在输入框上方（卡片内不再重复）。
  const activeAgentChoices = useMemo(() => {
    if (!showAgentCapabilityBar) return null;
    const messages = session?.messages ?? [];
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const item = messages[index];
      if (item.kind === 'agent' && item.agentId && item.choices && canUseAgent(item.agentId)) {
        const seed = AGENT_INVITATIONS.find(agent => agent.agentId === item.agentId);
        return { agentId: item.agentId, options: seed?.options ?? item.choices, messageId: item.messageId };
      }
    }
    return null;
  }, [session?.messages, showAgentCapabilityBar, canUseAgent]);

  // 文书生成智能体被召唤后，输入框预填模板（每个召唤消息只填一次，不覆盖用户已输入的内容）。
  const seededDocSummon = useRef<string | null>(null);
  useEffect(() => {
    if (!showAgentCapabilityBar || activeAgentChoices?.agentId !== 'agent-doc') return;
    const messageId = activeAgentChoices.messageId;
    if (seededDocSummon.current === messageId) return;
    seededDocSummon.current = messageId;
    setInput(previous => (previous.trim() ? previous : DOC_TEMPLATE));
  }, [activeAgentChoices, showAgentCapabilityBar]);

  /** 输入框里的斜体占位符：点 #文书类型 聚焦输入框（由上方的类型按钮替换），点 #灾情事件 打开事件选择器。 */
  const handleTokenClick = (token: string) => {
    if (token === '文书类型') {
      composerRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus();
      return;
    }
    if (token === '灾情事件') {
      changeSkillPickerOpen(false);
      setAgentPickerOpen(false);
      setPendingEventAction(null);
      setPendingEventToken(true);
      setIncidentPickerOpen(true);
    }
  };
  const tokenClickRef = useRef(handleTokenClick);
  tokenClickRef.current = handleTokenClick;
  const ComposerInput = useMemo(() => {
    const Wrapped = forwardRef<TextAreaRef, TokenTextAreaProps>((props, ref) => (
      <TokenTextArea {...props} ref={ref} onTokenClick={token => tokenClickRef.current(token)} />
    ));
    Wrapped.displayName = 'ComposerInput';
    return Wrapped;
  }, []);

  /** 点上方文书类型：模板已铺开时只替换 #文书类型（或已选类型），不直接生成。 */
  const applyDocType = (label: string) => {
    setInput(previous => {
      if (previous.includes('#文书类型')) return previous.replace('#文书类型', label);
      const matched = previous.match(DOC_TYPE_PATTERN);
      if (matched) return previous.replace(matched[1], label);
      return previous;
    });
  };

  const items: BubbleItemType[] = useMemo(() => {
    // 文书工作流的智能体消息可能没有 agentId（周工作动态/工作总结），按文档工作流放行。
    const messages = (session?.messages ?? []).filter(m => m.kind !== 'agent'
      || (m.agentId ? canUseAgent(m.agentId) : Boolean(m.documentWorkflow) && showAgentCapabilityBar));
    const summonedTasks = new Set(messages.filter(message => message.kind === 'agent' && message.taskId && tasks[message.taskId]).map(message => message.taskId));
    const list: BubbleItemType[] = messages.filter(message => !(message.kind === 'task' && summonedTasks.has(message.taskId))).map((m) => {
      if (m.reviewDocumentId) {
        return {
          key: m.messageId, role: 'task', content: '文书检查', avatar: null,
          contentRender: () => <DocumentReviewCard scope={m.sessionId} documentId={m.reviewDocumentId!} />,
        };
      }
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
              <Tag color="error">任务数据缺失</Tag>
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
          contentRender: () => m.documentWorkflow ? <><DocumentGenerationCard message={m} />
            {m.documentWorkflow.stage === 'completed' && <ResponseFeedback sessionId={m.sessionId} targetId={m.messageId} />}</> : (
            <AgentSummonCard
              agentId={m.agentId}
              agentName={m.agentName ?? '智能体协同'}
              agentRole={m.agentRole ?? ''}
              action={m.text ?? ''}
              status={m.choices ? 'queued' : m.taskId ? tasks[m.taskId]?.status : undefined}
              // 自我介绍式召唤（文书生成）：文书类型选项 + 一句「也可以直接提要求 / 传文件」的提示，
              // 放在正文列末尾（bodyExtra）——与姓名下的文字左对齐（标注 vibe_1791874890135）
              // 选项按当前 seed 渲染，不用消息里的快照：会话存在 localStorage 里，快照会让旧会话
              // 永远停在当时那几项上，新加的文书类型进不来（标注 vibe_1791945318621）。m.choices 只当标记用。
              bodyExtra={m.choices ? (
                <AgentInviteChoices
                  agentId={m.agentId}
                  options={AGENT_INVITATIONS.find(agent => agent.agentId === m.agentId)?.options ?? m.choices}
                  hint={m.hint ?? ''}
                  disabled={!session || busy}
                  showOptions={!showAgentCapabilityBar}
                  onPick={(task, label) => { void handleQuickTask(task, m.agentId, label); }}
                />
              ) : null}
            >
              {m.taskId && tasks[m.taskId] && <TaskCard task={tasks[m.taskId]} onOpenDrawer={onOpenDrawer} />}
            </AgentSummonCard>
          ),
        };
      }
      if (m.role === 'user') {
        const files = m.attachments ?? [];
        return {
          key: m.messageId,
          role: 'user',
          content: m.text ?? '',
          // 附件标记：发出去之后仍能看到随行的文件（否则选完文件一发送就没痕迹了）
          contentRender: files.length
            ? () => (
                <div>
                  <div>{m.text}</div>
                  <div className="axn-msg-attach" data-testid="message-attachments">
                    {files.map((f) => (
                      <span key={`${f.name}-${f.size}`} className="axn-msg-attach-item">
                        <Paperclip size={12} />{f.name}
                      </span>
                    ))}
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
      return { key: m.messageId, role: 'ai', content: m.text ?? '', avatar: AVATAR,
        contentRender: () => <><div>{m.text}</div>{m.text && <ResponseFeedback sessionId={m.sessionId} targetId={m.messageId} />}</>,
      };
    });
    // 应急要情的表头表单就是会话流里的一个气泡（用户 m00167）：填完整条流往下接生成气泡。
    if (briefFormOpen) {
      list.push({
        key: 'brief-form', role: 'task', content: '生成应急要情', avatar: AVATAR,
        styles: {
          root: { flex: '1 1 auto', width: 'auto', minWidth: 0, alignSelf: 'stretch', paddingInlineEnd: 0 },
          body: { flex: '1 1 auto', width: '100%', minWidth: 0, maxWidth: '100%' },
          content: { width: '100%' },
        },
        contentRender: () => (
          <>
            {/* 表单上方先交底：标题/正文由智能体自己组织，用户只补表头字段，也可上传图片（用户 m00201） */}
            <p className="axn-brief-form-lead">好的，现在我需要向您补充一些必要信息。标题名和正文由我根据事件资料内部组织，以下字段需要您提供，您也可以上传图片，我会将您上传的图片附加到文档里。</p>
            <EmergencyBriefForm onSubmit={submitBriefForm} onCancel={() => setBriefFormOpen(false)} disabled={!session || busy} />
          </>
        ),
      });
    }
    return list;
  }, [session?.messages, tasks, onOpenDrawer, busy, activeConversationId, attachments, briefFormOpen, submitBriefForm, canUseAgent, showAgentCapabilityBar]);

  const hasMessages = items.length > 0;
  const modeSwitch = designPlan === 'two' ? (
    <div className="axn-chat-mode-bar">
      <Segmented className="axn-chat-mode-switch" aria-label="切换聊天模式" value={interactionMode}
        options={[
          { label: '对话模式', value: 'chat', icon: <MessageSquare size={16} /> },
          { label: '工作模式', value: 'work', icon: <BriefcaseBusiness size={16} /> },
        ]}
        onChange={setInteractionMode} />
    </div>
  ) : null;

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
          {/* 无消息、或对话未关联事件时不显示标题：两者都由下方「关联灾情」选择器承载，
              标题只是重复（标注 vibe_1791303121889）；关联事件后标题回归。 */}
          {hasMessages && !isBlankEvent && (
            <Text strong className="axn-cp-title" data-testid="header-event">
              {eventTitle}
            </Text>
          )}
        </div>
      </div>

      {(hasMessages || compact) && modeSwitch}

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
              // AI 回答不套框：直接铺在白底上，层级靠排版而不是边框（参考 Claude / ChatGPT）
              styles: { content: { background: 'transparent', padding: '4px 0 0', fontSize: 'var(--fs-lead)', lineHeight: 1.75, maxWidth: '100%', overflowWrap: 'anywhere' } },
            },
            user: {
              placement: 'end',
              variant: 'filled',
              // 用户气泡：中性浅灰底 + 正文色，不再用整块主蓝（主色留给唯一的主操作）
              styles: { content: { background: token.colorFillQuaternary, color: token.colorText, borderRadius: '18px 18px 6px 18px', padding: '10px 16px', lineHeight: 1.7, fontSize: 'var(--fs-lead)', overflowWrap: 'anywhere' } },
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
              <BrandMark size={44} className="axn-home-mark" />
              {/* 标注 vibe_1791788298951：原「有什么我能帮你的吗？」+ 下方 secondary 问候语合并成这一句。
                  两段各自 inline-block：窄屏只在逗号处折行，不会把「应急」拆成两行。
                  标注 vibe_1792574805907：问候语带上当前用户名（与侧栏底部展示的 userName 同源）。 */}
              <Typography.Title level={1} className="axn-home-title">
                <span>您好，{actorUserName}，我是安小能，</span><span>您的应急智能助手</span>
              </Typography.Title>
              {/* 标注 vibe_1791788359448 */}
              <Typography.Paragraph className="axn-home-copy">
                {homeDescription}
              </Typography.Paragraph>
              {modeSwitch}
            </div>

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

      {/* 方案二工作模式把智能体入口收进输入框左侧的「应急专家」弹窗；召唤出智能体后，
          智能体入口行让位给该智能体的能力按钮（同一位置、同一套样式）。 */}
      {!planTwoWorkMode && !activeAgentChoices && (designPlan === 'two' || activeConversation?.source !== 'agent-management') && visibleAgents.length > 0 && <div className="axn-cp-chips-wrap">
        <div className="axn-chips">
          {visibleAgents.map(agent => {
            const Icon = AGENT_ICONS[agent.agentId];
            return <Button key={agent.agentId} size="small" className="axn-chip" title={agent.name}
              data-agent-id={agent.agentId} disabled={!session || busy} onClick={() => handleAgentInvite(agent.agentId)}>
              {Icon && <Icon className="axn-chip-icon" size={13} aria-hidden />}
              {agent.name}
            </Button>;
          })}
        </div>
      </div>}
      {/* 方案一 / 方案二工作模式：当前智能体的能力按钮横排显示在输入框上方。 */}
      {showAgentCapabilityBar && activeAgentChoices && (
        <div className="axn-cp-chips-wrap" data-testid="agent-capability-bar" data-agent-id={activeAgentChoices.agentId}>
          <div className="axn-chips">
            {activeAgentChoices.options.map(({ label, task }) => (
              <Button key={task} size="small" className="axn-chip" data-choice-task={task}
                disabled={!session || busy}
                onClick={() => {
                  // 文书智能体：输入框空时铺模板，模板已铺开时只替换类型，发送时才生成。
                  if (activeAgentChoices.agentId === 'agent-doc') {
                    if (!input.trim()) {
                      setInput(`帮我写一份${label}，针对的事件是#灾情事件`);
                      return;
                    }
                    if (input.trimStart().startsWith('帮我写一份')) {
                      applyDocType(label);
                      return;
                    }
                  }
                  void handleQuickTask(task, activeAgentChoices.agentId, label);
                }}>
                {label}
              </Button>
            ))}
          </div>
        </div>
      )}
      {/* 关联灾情与发送、语音操作位于输入框右下角。 */}
      <div className="axn-composer">
        <div ref={composerRef} className={`axn-composer-shell${mobileComposer ? ' is-mobile' : ''}`}>
          {/* 已选文件：输入框上方一行可移除的 chip（上传按钮在输入框左下角） */}
          {attachments.length > 0 && (
            <ul className="axn-attach-list" data-testid="composer-attachments">
              {attachments.map((f) => (
                <li key={f.uid}>
                  <Tag
                    closable
                    className="axn-attach-tag"
                    onClose={(e) => {
                      e.preventDefault();
                      removeAttachment(f.uid);
                    }}
                  >
                    <Paperclip size={12} />
                    <span className="axn-attach-name">{f.name}</span>
                    <span className="axn-attach-size">{formatSize(f.size)}</span>
                  </Tag>
                </li>
              ))}
            </ul>
          )}
          <Sender
            components={{ input: ComposerInput }}
            value={input}
            onChange={(value) => {
              setInput(value);
              const command = value.match(/(?:^|\s)\/([^\s/]*)$/);
              if (command && session && !busy) {
                skillCommandStart.current = value.lastIndexOf('/');
                setSkillQuery(command[1]);
                setIncidentPickerOpen(false);
                setPendingEventAction(null);
                setSkillPickerOpen(true);
              } else if (skillCommandStart.current !== null) {
                skillCommandStart.current = null;
                setSkillQuery(null);
                setSkillPickerOpen(false);
              }
            }}
            onSubmit={(message) => handleSend(message)}
            loading={runningTask != null}
            // 受控录音开关：点麦克风在「开始/停止模拟转写」间切换，按钮自己会显示录音中的动画。
            // 演示环境拿不到真实语音识别，所以只用它做交互外观，转写内容由 startTranscribing 模拟。
            allowSpeech={{
              recording: transcribing,
              onRecordingChange: (recording) => (recording ? startTranscribing() : stopTranscribing()),
            }}
            onCancel={() => {
              if (runningTask) cancelTask(runningTask.taskId);
            }}
            prefix={(
              <div className="axn-composer-tools">
              {mobileComposer ? <Popover trigger="click" placement="topLeft" open={toolsOpen}
                onOpenChange={setToolsOpen} content={<div className="axn-composer-tool-menu">
                  <div className="axn-composer-tool-menu-heading">输入工具</div>
                  {composerTools}
                </div>}>
                <Button type="text" className="axn-composer-more" icon={<Plus size={20} />}
                  aria-label="输入工具" aria-expanded={toolsOpen} />
              </Popover> : composerTools}
              <ComposerSkillPicker conversationId={activeConversationId ?? ''} disabled={!session || busy} compact={mobileComposer}
                open={skillPickerOpen} slashQuery={skillQuery} containerRef={composerRef} onOpenChange={changeSkillPickerOpen}
                onAfterClose={() => composerRef.current?.querySelector<HTMLTextAreaElement>('textarea')?.focus()} />
              {mobileComposer && incidentSelect}
              </div>
            )}
            suffix={(_, { components: { LoadingButton, SendButton, SpeechButton } }) => (
              <div className="axn-composer-actions">
                {!mobileComposer && incidentSelect}
                {/* 空输入→语音，有文字→发送，运行中→停止（可取消当前任务）；模拟转写中保持语音按钮，
                    再点一下可中途停下（此时输入框已有字，否则会被换成发送按钮）
                    同一位置同一动作槽：语音按钮与发送按钮同形（实心圆形主色容器）。
                    只传了附件时不走 Sender 的提交（空文本会被它内部的 submitDisabled 拦住），
                    所以等材料期间这里换成自己这个按钮把附件交出去，不然“传完没反应”。 */}
                {runningTask != null ? <LoadingButton aria-label="停止生成" title="停止生成" /> : submittingSources
                  ? <Button type="primary" shape="circle" icon={<ArrowUp size={16} />} aria-label="发送附件并开始生成" data-testid="composer-submit-sources" onClick={startDynamicsWithSources} />
                  : (
                    // 发送按钮常驻（空输入时禁用）——主操作位置固定；语音降为次要的文字按钮，
                    // 输入框有字后收起（转写中保留，可中途停下）
                    <>
                      {(mobileComposer || transcribing || !input.trim()) && (
                        <SpeechButton
                          type="text"
                          shape="circle"
                          className="axn-composer-speech"
                          aria-label={transcribing ? '停止语音输入' : '语音输入'}
                          title={transcribing ? '停止语音输入' : '语音输入'}
                          data-testid="composer-speech"
                        />
                      )}
                      <SendButton aria-label="发送" title="发送" />
                    </>
                  )}
              </div>
            )}
            /* 最小 2 行 = 54px（用户 m01370 要求输入框再高一些；1 行只有 32px 显得太扁）。
               输入框独占第一行（见 chat.css 的 .ant-sender-input { flex: 1 1 100% }），
               三个控件在第二行，所以留白在输入区内、不会把控件推到盒子底部。
               原 minRows: 3 时输入框恒为 76px 且控件与文字同一行（备注 m01301、m01342）。 */
            autoSize={{ minRows: 2, maxRows: 6 }}
            placeholder={
              session
                // 触屏没有实体 Enter 键，提示只留前半句
                ? (window.matchMedia?.('(hover: none)').matches ? '向安小能发送指令' : '向安小能发送指令，Enter 发送')
                : '会话初始化中…'
            }
            disabled={!session || !!generatingDocument}
          />
        </div>
      </div>

      {/* 方案二工作模式：输入框左侧「应急专家」按钮弹出，样式与点击「技能」后的浮层一致。 */}
      {planTwoWorkMode && agentPickerOpen && composerRef.current && createPortal(
        <div className="axn-composer-menu axn-composer-agent-menu" role="region" aria-label="选择应急专家" data-testid="agent-picker-menu">
          <div className="axn-composer-menu-heading">
            <span>应急专家 <span className="axn-composer-menu-count">{visibleAgents.length}</span></span>
            <button type="button" className="axn-composer-menu-close" aria-label="关闭应急专家选择" onClick={() => setAgentPickerOpen(false)}><X size={14} /></button>
          </div>
          <div className="axn-composer-menu-list" role="listbox" aria-label="可选应急专家">
            {visibleAgents.map(agent => {
              const Icon = agentIcon(agent.agentId);
              return (
                <button
                  key={agent.agentId}
                  type="button"
                  role="option"
                  aria-selected={false}
                  className="axn-composer-menu-option"
                  data-agent-id={agent.agentId}
                  disabled={!session || busy}
                  onClick={() => { setAgentPickerOpen(false); handleAgentInvite(agent.agentId); }}
                >
                  <span className="axn-composer-menu-icon"><Icon size={18} aria-hidden /></span>
                  <span className="axn-composer-menu-copy"><strong>{agent.name}</strong></span>
                </button>
              );
            })}
          </div>
        </div>,
        composerRef.current,
      )}
    </div>
  );
}
