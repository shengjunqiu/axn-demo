import { openInlineSituation } from '@/services/inlineSituation';
import EmpowermentConversation from '@/pages/v2/chat/EmpowermentConversation';
import { isEmpowermentKind } from '@/pages/v2/logic/empowerment';
import RescuePlanChoices from './RescuePlanChoices';
import InlineSituationFlow from './InlineSituationFlow';
import StructuredReply from './StructuredReply';
import { Notice } from '@/components/common/ChatPrimitives';
import { ArrowUp, ChevronRight } from 'lucide-react';
import BrandMark from '@/components/brand/BrandMark';
import { ShieldAlert, Waves, MapPin as RecommendationMapPin, LifeBuoy } from 'lucide-react';
import IncidentPickerModal from './IncidentPickerModal';
import { MapPin, ChevronDown } from 'lucide-react';
import { COMPOSE_EVENT } from '@/components/doc/SelectionAssist';
import { startWeeklyDynamics, submitDynamicsSources } from '@/services/weeklyDynamicsWorkflow';
import { floatingActionGroups } from '@/services/floatingActionGroups';
import type { ComponentRef } from 'react';
import { replyEmbeddedQa, embeddedQaKind, embeddedStageChoices, embeddedChoiceAttachment } from '@/services/embeddedQa';
import { V2_AI_MODES, V2_AI_DOCUMENT_CODES } from '@/pages/v2/aiNodes';
import { EVALUATION_TEXT_ACTIONS, evaluationActionReply, type EvaluationTextAction } from '@/services/evaluationActions';
import { resourceRecommendationReply } from '@/services/resourceRecommendation';
import { monitorNoticeReply } from '@/services/monitorNoticeReply';
import { generateRescuePlanAlternatives } from '@/services/rescuePlanAlternatives';
import { useCustomerOperations } from '@/store/customerOperationsStore';
import CustomerRequestPanel, { CUSTOMER_ACTIONS, type CustomerAction } from './CustomerRequestPanel';
import { catalogAction, LEGACY_QUICK_ACTIONS } from '@/seed/quickActionCatalog';
import { AGENT_QUICK_TASKS } from '@/seed/agentQuickTasks';
import { tenderName, tenderTaskPrompt } from '@/seed/tenderNames';
import { isDutyContent, isMeetingMinutesContent, isResourceDataAlertContent, SHOW_DISASTER_EVENTS_LIBRARY } from '@/seed/prototypeVisibility';
import { FLOW_TASKS } from './OperationalFlows';
import { generateWorkSummary, submitWorkSummaryImprovement } from '@/services/workSummaryWorkflow';
import ResourceAuditReply from './ResourceAuditReply';
import { resourceAuditSample } from '@/services/resourceAudit';
import { runEventPrecipitation } from '@/services/eventPrecipitation';
/**
 * 安小能对话工作流（UI 改版）：会话头（标题 + 关联灾情）+ 消息流（Bubble.List）
 * + 圆角一体化输入区（快捷任务：5 个能力块点击后对话邀请选功能）+ 补录表单。
 * 首页含建设三场景入口与知识库引导问题；会话跟随演示事件切换。
 * 本界面为模拟数据演示（规则意图识别，不接真实大模型）。
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation, useNavigate } from 'react-router-dom';

/** 与 App / global.css 的 768px 桌面断点一致。 */
function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false),
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    onChange();
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}
import { hostPageChipOverride } from '@/seed/hostPageChips';
import { useSessionTasks } from '@/hooks/useSessionTasks';
import {
  Bell,
  FileCheck,
  FileText,
  Flame,
  Lightbulb,
  MessageSquare,
  Paperclip,
  PanelLeftClose,
  PanelLeftOpen,
  ShieldCheck,
  Wrench,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Alert, App as AntdApp, Badge, Button, Input, Popover, Space, Tag, Tooltip, Typography, theme } from 'antd';
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
  normalizeCompletedAction,
  resolveActionPrompt,
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
import { WELCOME_QUESTIONS } from '@/seed/welcomeQuestions';
import { factText, incidentById } from '@/seed/scenario';
import { eventDisplayName } from '@/services/factLookup';
import {
  buildEventSwitchBriefing,
  buildEventUnlinkBriefing,
  resolveEventStage,
} from '@/services/eventSwitchBriefing';
import { documentGeneratedReply, glanceFromSections } from '@/services/documentGeneratedReply';
import { scheduleAutoSituationReport } from '@/services/autoSituationReport';
import TaskCard from './TaskCard';
import DocumentGenerationCard from './DocumentGenerationCard';
import { DocumentReviewCard } from '@/components/doc/DocumentReview';
import AgentSummonCard from './AgentSummonCard';
import EventSwitchBriefingCard from './EventSwitchBriefingCard';
import SessionMaterialsDrawer from './SessionMaterialsDrawer';
import './chat.css';

const { Text } = Typography;

export interface ChatPanelProps {
  /** 悬浮嵌入等场景可不传；资源/知识抽屉仅在主工作台打开 */
  onOpenDrawer?: (target: 'resource' | 'knowledge', options?: { tab?: 'list' | 'map' }) => void;
  compact?: boolean;
}

const AVATAR = <div className="axn-chat-avatar"><BrandMark size={28} /></div>;

const QUESTION_META: { icon: LucideIcon; tag: string }[] = [
  { icon: ShieldAlert, tag: '险情识别' },
  { icon: Waves, tag: '水情研判' },
  { icon: RecommendationMapPin, tag: '路线规划' },
  { icon: LifeBuoy, tag: '现场急救' },
];

const BLANK_LINK = '__blank__';

const AGENT_CHIP_ICONS: Record<string, LucideIcon> = {
  'agent-doc': FileCheck,
  'agent-situation': Flame,
  'agent-resource': Wrench,
  'agent-plan': Lightbulb,
  'agent-eval': ShieldCheck,
};

/** 五个能力块统一：点 chip → 对话里召唤智能体 + 功能选项（对齐文书生成）。 */
const AGENT_INVITES: Record<string, {
  name: string;
  role: string;
  intro: string;
  hint: string;
}> = {
  'agent-doc': {
    name: '文书生成智能体',
    role: '文书撰写',
    intro: '您好，我是文书生成智能体，可以帮您撰写各类文书。请选择您要生成的文书类型：',
    hint: '您也可以直接把生成要求告诉我；需要参考的文件、要写进文书的图片，都可以上传给我。',
  },
  'agent-situation': {
    name: '态势感知智能体',
    role: '灾情研判',
    intro: '您好，我是态势感知智能体，可以帮您汇聚多源数据、生成灾情摘要、研判态势并生成报告。请选择要执行的功能：',
    hint: '您也可以直接描述研判需求；相关监测、影像与接报材料可上传给我。',
  },
  'agent-resource': {
    name: '救援资源管理智能体',
    role: '力量投送',
    intro: '您好，我是救援资源管理智能体，可以帮您检索周边资源、比较编组建议和核验物资；查询与核验直接在对话中展示，需要报告时再生成。请选择要执行的功能：',
    hint: '您也可以直接说明需要的人装与投送条件；台账或清单材料可上传给我。',
  },
  'agent-plan': {
    name: '救援方案生成智能体',
    role: '方案编制',
    intro: '您好，我是救援方案生成智能体，可以帮您比较处置方向，确认后生成工程救援处置方案，并根据现场变化对比修订。请选择要执行的功能：',
    hint: '您也可以直接说明方案边界与约束；相关预案与现场反馈可上传给我。',
  },
  'agent-eval': {
    name: '救援效果评估智能体',
    role: '复盘评估',
    intro: '您好，我是救援效果评估智能体，可以帮您对照投入与成效、梳理时间轴和问题清单，需要正式总结时再生成总结报告。请选择要执行的功能：',
    hint: '您也可以直接说明复盘范围与关注点；过程材料可上传给我。',
  },
};

/** 智能体邀请气泡里的功能选项（文书 / 态势 / 资源 / 方案 / 评估共用）。 */
function AgentInviteChoices({ options, hint, disabled, onPick }: {
  options: { label: string; task: string }[];
  hint: string;
  disabled: boolean;
  onPick: (task: string) => void;
}) {
  return (
    <div className="axn-doc-choices" data-testid="agent-invite-choices">
      <div className="axn-doc-choice-row">
        {options.map(({ label, task }) => (
          <Button key={task} size="small" className="axn-doc-choice" data-choice-task={task} disabled={disabled} onClick={() => onPick(task)}>
            {label}
          </Button>
        ))}
      </div>
      <Text type="secondary" className="axn-doc-hint">{hint}</Text>
    </div>
  );
}

const noopOpenDrawer: NonNullable<ChatPanelProps['onOpenDrawer']> = () => {};

export default function ChatPanel(props: ChatPanelProps) {
  const location = useLocation();
  const mode = new URLSearchParams(location.search).get('embedded') ?? '';
  const kind = mode.startsWith('v2-workflow-') ? mode.slice('v2-workflow-'.length) : null;
  if (isEmpowermentKind(kind)) return <EmpowermentConversation key={kind} kind={kind} />;
  return <StandardChatPanel {...props} />;
}

function StandardChatPanel({ onOpenDrawer = noopOpenDrawer, compact = false }: ChatPanelProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const embeddedMessageList = useRef<ComponentRef<typeof Bubble.List>>(null);
  const isEmbeddedAssistant = typeof window !== 'undefined' && window.parent !== window;
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

  const openFlowWorkspace = (tab: typeof FLOW_TASKS[number]) => {
    if (tab === '态势研判预警' || tab === '预警推送') {
      if (!session) return;
      openInlineSituation(session.sessionId, tab);
      useWorkspaceStore.getState().close(scope);
      return;
    }
    useWorkspaceStore.getState().select(scope, { kind: 'flow', id: tab });
  };
  const monitorNotices = useCustomerOperations(s => s.notices);
  const unreadMonitorCount = monitorNotices.filter(n => n.eventId === session?.eventId && n.status === '待处理').length;
  const [customerAction, setCustomerAction] = useState<CustomerAction | null>(null);
  const [input, setInput] = useState('');
  useEffect(() => {
    const compose = (event: Event) => setInput((event as CustomEvent<string>).detail);
    window.addEventListener(COMPOSE_EVENT, compose);
    return () => window.removeEventListener(COMPOSE_EVENT, compose);
  }, []);
  const [clarifyValue, setClarifyValue] = useState('');
  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);
  const [queuedChoice, setQueuedChoice] = useState<StageChoice | null>(null);
  const [stagePromptOpen, setStagePromptOpen] = useState(false);
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

  useEffect(() => { setCustomerAction(null); }, [session?.sessionId]);

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
  const embeddedEventTitle = V2_AI_MODES.includes(new URLSearchParams(location.search).get('embedded') ?? '')
    ? session?.messages.find(m => V2_AI_DOCUMENT_CODES.includes(m.documentWorkflow?.documentCode ?? ''))
      ?.documentWorkflow?.elements.find(item => item.label === '当前事件')?.value
    : undefined;
  const suppliesEventTitle = new URLSearchParams(location.search).get('embedded') === 'v2-supplies'
    ? session?.messages.find(message => message.agentRole === 'v2-supplies')?.text?.split('\n')[0]?.replace('当前事件：', '') : undefined;
  const embeddedKind = isEmbeddedAssistant ? embeddedQaKind(session, new URLSearchParams(location.search).get('embedded')) : null;
  const pickerGroups = embeddedKind ? embeddedStageChoices(embeddedKind) : floatingActionGroups(eventStage);
  const eventTitle = suppliesEventTitle ?? embeddedEventTitle ?? (incident
    ? factText(incident.factRefs.title) || currentEventId
    : isBlankEvent
      ? '空白对话（未关联事件）'
      : currentEventId);

  const clearPending = () => {
    if (queuedChoice && input === queuedChoice.prompt) setInput('');
    setPendingAttachment(null);
    setQueuedChoice(null);
  };

  const replyResourceRecommendation = () => {
    if (!session || busy) return;
    const store = useSessionStore.getState();
    const sessionId = session.sessionId;
    store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text: '资源建议', taskId: null });
    store.appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', text: resourceRecommendationReply(session.eventId), taskId: null });
  };

  const replyMonitorNoticesInChat = () => {
    if (!session) return;
    const store = useSessionStore.getState();
    const sessionId = session.sessionId;
    const text = monitorNoticeReply(session.eventId, useCustomerOperations.getState().notices);
    store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text: '查看当前监测问题', taskId: null });
    store.appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', text, taskId: null });
    openFlowWorkspace('资源预警通知');
  };

  const replyResourceAuditInChat = (prompt = '资源数据校验对比') => {
    if (!session || busy) return;
    const sessionId = session.sessionId;
    const store = useSessionStore.getState();
    store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text: prompt, taskId: null });
    store.appendMessage(sessionId, {
      sessionId, role: 'assistant', kind: 'text', taskId: null,
      text: '物资核验结果（模拟台账）',
      resourceAudit: { rows: resourceAuditSample('异常样例'), checkedAt: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }) },
    });
  };

  const replyEventPrecipitationInChat = (prompt = '事件沉淀') => {
    if (!session || busy) return;
    if (session.eventId.startsWith('evt-blank-')) {
      notice.info('请先关联有效灾情后再做事件沉淀');
      return;
    }
    const sessionId = session.sessionId;
    const store = useSessionStore.getState();
    store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text: prompt, taskId: null });
    store.appendMessage(sessionId, {
      sessionId,
      role: 'assistant',
      kind: 'agent',
      taskId: null,
      text: '正在汇总本事件案例要点并写入知识库（模拟）',
      agentName: '救援效果评估智能体',
      agentRole: '事件沉淀',
    });
    const { reply } = runEventPrecipitation(session.eventId);
    store.appendMessage(sessionId, {
      sessionId,
      role: 'assistant',
      kind: 'text',
      taskId: null,
      text: reply,
    });
    store.recordFlowProgress(sessionId, '事件沉淀');
    onOpenDrawer('knowledge');
  };

  const replyEvaluationAction = (action: EvaluationTextAction) => {
    if (!session || busy) return;
    const store = useSessionStore.getState();
    store.appendMessage(session.sessionId, { sessionId: session.sessionId, role: 'user', kind: 'text', text: action, taskId: null });
    store.appendMessage(session.sessionId, { sessionId: session.sessionId, role: 'assistant', kind: 'text', text: evaluationActionReply(action, session.eventId, session.sessionId), taskId: null });
  };

  const handleSend = (raw: string, attachmentOverride?: ChatAttachment | null, sendOpts?: {
    skipAssess?: boolean;
    attachmentMode?: 'reference' | 'check' | null;
  }) => {
    const text = raw.trim();
    const attachment = attachmentOverride !== undefined ? attachmentOverride : pendingAttachment;
    const uploadGate = session?.messages.find(m => m.documentWorkflow?.stage === 'waiting_upload');
    if (session && uploadGate && attachment) {
      setInput(''); setPendingAttachment(null);
      void submitDynamicsSources(session.sessionId, uploadGate.messageId, [{ name: attachment.name, size: 0 }]);
      return;
    }
    if (!session || busy) return;
    if (!text && !attachment) return;
    if (isEmbeddedAssistant && replyEmbeddedQa(session.sessionId, new URLSearchParams(location.search).get('embedded'), text, attachment)) {
      requestAnimationFrame(() => embeddedMessageList.current?.scrollTo({ top: 'bottom' }));
      setInput('');
      clearPending();
      return;
    }
    if (text && isDutyContent(text)) { notice.info('值班相关内容暂时隐藏'); return; }
    setInput('');
    clearPending();
    if (isMeetingMinutesContent(text)) {
      notice.info('会议纪要入口暂时隐藏');
      return;
    }
    if (isResourceDataAlertContent(text)) {
      notice.info('「资源数据与预警」暂时下线');
      return;
    }
    if (text === '物资核验' || text.includes('物资核验') || text === '资源数据校验对比' || text.includes('资源数据校验对比')) {
      replyResourceAuditInChat(text.includes('物资核验') ? '物资核验' : '资源数据校验对比');
      return;
    }
    if (text === '事件沉淀' || text.includes('事件沉淀')) {
      replyEventPrecipitationInChat('事件沉淀');
      return;
    }
    if (EVALUATION_TEXT_ACTIONS.includes(text as EvaluationTextAction)) { replyEvaluationAction(text as EvaluationTextAction); return; }
    if (text.includes('生成救援方案') || tenderTaskPrompt(text) === '生成救援方案' || normalizeCompletedAction(text) === '生成救援方案') { generateRescuePlanAlternatives(session.sessionId, session.eventId); return; }
    if (text.includes('资源建议')) { replyResourceRecommendation(); return; }
    const directAction = CUSTOMER_ACTIONS.find(action => text.includes(action) || tenderTaskPrompt(text) === action || normalizeCompletedAction(text) === action);
    if (directAction) { setCustomerAction(directAction); return; }
    const requestedFlow = FLOW_TASKS.filter(name => name !== '现场智能勘察' && name !== '编组确认').find(name => text === name || text === tenderName(name));
    if (requestedFlow) { openFlowWorkspace(requestedFlow); return; }
    const waitingSummary = session.messages.find(message => message.documentWorkflow?.stage === 'waiting_input');
    if (waitingSummary && text) {
      void submitWorkSummaryImprovement(session.sessionId, waitingSummary.messageId, text);
      return;
    }
    if (text && /复盘总结|生成.*工作总结|工作总结.*生成|生成全面总结|全面总结|抢险总结/.test(text)) {
      void generateWorkSummary(session.sessionId, /复盘总结/.test(text) ? '复盘总结' : text);
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
    if (!id || !session) { return; }
    if (!embeddedKind && id.startsWith('legacy-quick:')) {
      const label = id.slice('legacy-quick:'.length);
      if (LEGACY_QUICK_ACTIONS.includes(label)) { handleQuickTask(label); }
      return;
    }
    const choice = pickerGroups.flatMap(g => g.options).find(c => c.id === id);
    if (!choice) { return; }
    const apply = () => {
      setQueuedChoice(choice);
      setInput(choice.prompt);
      if (choice.kind === 'file') {
        if (embeddedKind) setPendingAttachment(embeddedChoiceAttachment(embeddedKind, session));
        else {
          const ctx = buildStageEventContext(session.eventId, session);
          setPendingAttachment(simulateAttachment(choice, ctx));
        }
      } else {
        setPendingAttachment(null);
      }
    };
    if ((input.trim() || pendingAttachment) && (input !== choice.prompt || pendingAttachment)) {
      modal.confirm({
        title: '替换当前未发送内容？',
        content: '用所选示例替换当前输入框与待发附件。',
        okText: '替换',
        cancelText: '取消',
        onOk: apply,
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
    if (raw === '生成应急救援周工作动态') {
      if (session && !busy) startWeeklyDynamics(session.sessionId, raw);
      return;
    }
    const text = normalizeCompletedAction(resolveActionPrompt(raw)) || resolveActionPrompt(raw);
    if (text === '物资核验' || tenderName(text) === '物资核验' || text === '资源数据校验对比' || tenderName(text) === '资源数据校验对比') {
      replyResourceAuditInChat(text);
      return;
    }
    if (text === '事件沉淀' || tenderName(text) === '事件沉淀') {
      replyEventPrecipitationInChat(text);
      return;
    }
    if (EVALUATION_TEXT_ACTIONS.includes(text as EvaluationTextAction)) { replyEvaluationAction(text as EvaluationTextAction); return; }
    if (text === '生成救援方案' || tenderTaskPrompt(text) === '生成救援方案') { if (session && !busy) generateRescuePlanAlternatives(session.sessionId, session.eventId); return; }
    if (text === '资源建议') { replyResourceRecommendation(); return; }
    if (text === '预警推送' || text === '态势研判预警') { openFlowWorkspace(text); return; }
    if (CUSTOMER_ACTIONS.includes(text as CustomerAction)) { setCustomerAction(text as CustomerAction); return; }
    const flowLabel = FLOW_TASKS.filter(name => name !== '现场智能勘察' && name !== '编组确认').find(
      (name) => text === name || text === tenderName(name) || tenderTaskPrompt(text) === name,
    );
    const catalog = catalogAction(text) ?? (flowLabel ? catalogAction(flowLabel) : undefined);
    if (catalog?.kind === 'flow' || flowLabel) {
      openFlowWorkspace((flowLabel ?? catalog!.label) as typeof FLOW_TASKS[number]);
      return;
    }
    if (text === '复盘总结' || text === '生成工作总结' || text === '生成全面总结') {
      if (session && !busy) {
        const prompt = text === '生成全面总结' ? '生成全面总结' : text === '复盘总结' ? '复盘总结' : text;
        await generateWorkSummary(session.sessionId, prompt);
        useSessionStore.getState().recordFlowProgress(session.sessionId, text === '复盘总结' ? '复盘总结' : text);
      }
      return;
    }
    if (isDutyContent(text)) { notice.info('值班相关内容暂时隐藏'); return; }
    if (isMeetingMinutesContent(text)) { notice.info('会议纪要入口暂时隐藏'); return; }
    if (isResourceDataAlertContent(text)) { notice.info('「资源数据与预警」暂时下线'); return; }
    const code = text === '生成会议纪要' ? 'MEETING_MINUTES' : text === '生成应急要情' ? 'EMERGENCY_BRIEF' : null;
    if (!code) { handleSend(text); return; }
    if (!session || busy) return;
    const sessionId = session.sessionId;
    useSessionStore.getState().appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text, taskId: null });
    const elements = [
      { label: '文书类型', value: code === 'MEETING_MINUTES' ? '会议纪要' : '应急抢险要情' },
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
        text: documentGeneratedReply(document.title, glanceFromSections(document.sections)),
      });
    }
  };

  /** 点能力块：对话里召唤对应智能体 + 功能选项（五块统一，不就地展开）。 */
  const handleAgentInvite = (agentId: string) => {
    if (!session || busy) return;
    const invite = AGENT_INVITES[agentId];
    const group = AGENT_QUICK_TASKS.find((item) => item.agentId === agentId);
    if (!invite || !group) return;
    const { sessionId } = session;
    useSessionStore.getState().appendMessage(sessionId, {
      sessionId,
      role: 'assistant',
      kind: 'agent',
      taskId: null,
      agentId,
      agentName: invite.name,
      agentRole: invite.role,
      text: invite.intro,
      choices: group.tasks.map(({ label, task }) => ({ label, task })),
      hint: invite.hint,
    });
  };

  // 右侧内嵌业务流程发出的快捷任务：关闭工作区后在对话中执行
  const quickTaskRef = useRef(handleQuickTask);
  quickTaskRef.current = handleQuickTask;
  useEffect(() => {
    const onFlowTask = (event: Event) => {
      if (!(event instanceof CustomEvent)) return;
      const text = (event.detail as { text?: unknown } | null)?.text;
      if (typeof text === 'string' && text.trim()) void quickTaskRef.current(text);
    };
    window.addEventListener('axn:flow-task', onFlowTask);
    return () => window.removeEventListener('axn:flow-task', onFlowTask);
  }, []);

  /** 一期嵌入页（如 W02）可覆盖底部 chips；其余走 5 能力块。 */
  const pageChipOverride = useMemo(
    () => hostPageChipOverride(location.pathname, location.search),
    [location.pathname, location.search],
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
    // 关联有效实战事件后自动汇总态势报告（模拟）
    if (value !== BLANK_LINK) {
      scheduleAutoSituationReport(sessionId, value, 'event_link', 0);
    }
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

  // 电脑端：关联灾情放发送钮左侧（右下角）；手机端独立成行，避免 suffix 挤爆输入框
  const isDesktopComposer = useMediaQuery('(min-width: 768px)');
  const [incidentPickerOpen, setIncidentPickerOpen] = useState(false);
  const incidentSelect = (
    <>
      <button
        type="button"
        className={`axn-cp-select${linkValue === BLANK_LINK ? ' is-empty' : ''}`}
        onClick={() => setIncidentPickerOpen(true)}
        aria-label="关联灾情"
        aria-haspopup="dialog"
        data-testid="chat-link-incident"
      >
        <MapPin size={14} aria-hidden />
        <span className="axn-cp-select-text">{linkValue === BLANK_LINK ? '选择关联灾情事件' : eventDisplayName(linkValue)}</span>
        <ChevronDown size={12} aria-hidden className="axn-cp-select-caret" />
      </button>
      <IncidentPickerModal
        open={incidentPickerOpen}
        value={linkValue === BLANK_LINK ? 'none' : linkValue}
        onClose={() => setIncidentPickerOpen(false)}
        onSelect={(id) => { if (id !== linkValue) handleLinkChange(id === 'none' ? BLANK_LINK : id); }}
      />
    </>

  );

  const items: BubbleItemType[] = useMemo(() => {
    const messages = (session?.messages ?? []).filter(m => !isDutyContent(m.taskId ? tasks[m.taskId]?.intent ?? '' : ''));
    const summonedTasks = new Set(messages.filter(message => message.kind === 'agent' && message.taskId && tasks[message.taskId]).map(message => message.taskId));
    return messages.filter(message => !(message.kind === 'task' && summonedTasks.has(message.taskId))).map((m) => {
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
                onOpenFlow={(tab) => { openFlowWorkspace(tab as typeof FLOW_TASKS[number]); }}
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
            />
          ) : (
            <AgentSummonCard
              agentId={m.agentId}
              agentName={m.agentName ?? '智能体协同'}
              agentRole={m.agentRole ?? ''}
              action={m.text ?? ''}
              status={m.choices ? 'queued' : m.taskId ? tasks[m.taskId]?.status : undefined}
              bodyExtra={m.choices ? (
                <AgentInviteChoices
                  options={m.choices}
                  hint={m.hint ?? ''}
                  disabled={!session || busy}
                  onPick={(task) => { void handleQuickTask(task); }}
                />
              ) : null}
            >
              {m.taskId && tasks[m.taskId] && (
                <TaskCard
                  task={tasks[m.taskId]}
                  onOpenDrawer={onOpenDrawer}
                  busy={busy}
                  onTask={(prompt) => { void handleQuickTask(prompt); }}
                  onNavigate={(path) => { navigate(path); }}
                  onOpenFlow={(tab) => { openFlowWorkspace(tab as typeof FLOW_TASKS[number]); }}
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
      if (m.inlineSituation) {
        return { key: m.messageId, role: 'ai', content: m.text ?? '', avatar: AVATAR,
          contentRender: () => <InlineSituationFlow eventId={m.inlineSituation!.eventId} sessionId={m.sessionId} initial={m.inlineSituation!.kind} /> };
      }
      if (m.rescuePlans) {
        return {
          key: m.messageId, role: 'ai', content: m.text ?? '', avatar: AVATAR,
          contentRender: () => <RescuePlanChoices message={m} />,
        };
      }
      if (m.resourceAudit) {
        return {
          key: m.messageId, role: 'ai', content: m.text ?? '', avatar: AVATAR,
          styles: { root: { alignSelf: 'stretch', minWidth: 0, width: '100%', paddingInlineEnd: 0 }, body: { flex: '1 1 0%', width: '100%', maxWidth: '100%', minWidth: 0 }, content: { width: '100%', maxWidth: '100%', minWidth: 0 } },
          contentRender: () => <ResourceAuditReply rows={m.resourceAudit!.rows} checkedAt={m.resourceAudit!.checkedAt} />,
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
      if (m.situationReportAuto) {
        const auto = m.situationReportAuto;
        return {
          key: m.messageId,
          role: 'ai',
          content: m.text ?? '',
          avatar: AVATAR,
          contentRender: () => (
            <div className="axn-auto-situation-report" data-testid="auto-situation-report">
              <Text>{m.text}</Text>
              <Space wrap size={8} style={{ marginTop: 8 }}>
                {auto.documentId && (
                  <Button
                    size="small"
                    type="primary"
                    ghost
                    icon={<FileText size={14} />}
                    onClick={() => {
                      useWorkspaceStore.getState().autoOpen(
                        m.sessionId,
                        `auto-situation-open:${auto.documentId}`,
                        { kind: 'mock', id: auto.documentId! },
                      );
                    }}
                  >
                    查看态势报告
                  </Button>
                )}
                {auto.openMap && (
                  <Button
                    size="small"
                    type="primary"
                    aria-label="查看态势地图"
                    onClick={() => onOpenDrawer('resource', { tab: 'map' })}
                  >
                    查看态势地图
                  </Button>
                )}
                <Text type="secondary" className="axn-tc-fs12">模拟数据 · 正式研判须岗位审核</Text>
              </Space>
            </div>
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
              <Notice tone="info" title="资料处理提示">{m.text}</Notice>
              {renderWorkflowActions(m.workflow!, m)}
            </div>
          ),
        };
      }
      return { key: m.messageId, role: 'ai', content: m.text ?? '', avatar: AVATAR, contentRender: () => <StructuredReply text={m.text ?? ''} /> };
    });
  }, [session?.messages, tasks, onOpenDrawer, busy, navigate]);

  const hasMessages = items.length > 0;

  return (
    <div className="axn-chat-page">
      {customerAction && session && <CustomerRequestPanel key={`${session.sessionId}:${customerAction}`} action={customerAction} sessionId={session.sessionId} eventId={session.eventId} onClose={() => setCustomerAction(null)} />}

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
          {SHOW_DISASTER_EVENTS_LIBRARY && (
            <Button size="small" onClick={() => navigate(`/events?event=${encodeURIComponent(currentEventId)}`)}>灾种事件库</Button>
          )}
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
          ref={embeddedMessageList}
          className="axn-message-list"
          autoScroll
          items={items}
          role={{
            ai: {
              placement: 'start',
              variant: 'filled',
              avatar: AVATAR,
              styles: { content: { background: 'transparent', padding: '4px 0 0', fontSize: 'var(--fs-lead)', lineHeight: 1.75, maxWidth: '100%', overflowWrap: 'anywhere' } },
            },
            user: {
              placement: 'end',
              variant: 'filled',
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
                  两段各自 inline-block：窄屏只在逗号处折行，不会把「应急」拆成两行。 */}
              <Typography.Title level={1} className="axn-home-title">
                <span>您好，我是安小能，</span><span>您的应急智能助手</span>
              </Typography.Title>
              {/* 标注 vibe_1791788359448 */}
              <Typography.Paragraph className="axn-home-copy">
                您可以问我问题，也可以让我帮您写公文，或者我也可以帮您执行应急相关的任务。
              </Typography.Paragraph>
            </div>

            <div className="axn-home-block" data-testid="home-chat-recommend">
              <Text type="secondary" className="axn-home-block-label">为你推荐</Text>
              <ul className="axn-question-list">
                {WELCOME_QUESTIONS.map((q, i) => {
                  const meta = QUESTION_META[i % QUESTION_META.length];
                  const QIcon = meta.icon;
                  return (
                    <li key={q}>
                      <button
                        type="button"
                        className="axn-question-item"
                        disabled={!session || busy}
                        onClick={() => { void handleQuickTask(q); }}
                      >
                        <span className="axn-question-head" aria-hidden>
                          <QIcon size={15} />
                          <span>{meta.tag}</span>
                        </span>
                        <span className="axn-question-text">{q}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
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

      {/* 快捷任务：5 能力块内联展开；一期嵌入页可用 pageChipOverride 覆盖 */}
      {!isEmbeddedAssistant && <div className="axn-cp-chips-wrap">
        <div className="axn-chips" data-testid="quick-task-chips">
          {pageChipOverride ? (
            pageChipOverride.primary.map(({ label, agentName, agentId, action, title }) => (
              <Button
                key={label}
                size="small"
                className="axn-chip"
                title={title ?? `${tenderName(agentName)} · 独立调用`}
                data-agent-id={agentId}
                data-testid={`chip-primary-${label}`}
                disabled={!session || busy}
                onClick={() => { void handleQuickTask(action); }}
              >
                {tenderName(label)}
              </Button>
            ))
          ) : (
            AGENT_QUICK_TASKS.map(({ label, agentName, agentId }) => {
              const ChipIcon = AGENT_CHIP_ICONS[agentId];
              return (
                <Button
                  key={agentId}
                  size="small"
                  className="axn-chip"
                  title={agentName}
                  data-agent-id={agentId}
                  disabled={!session || busy}
                  onClick={() => { handleAgentInvite(agentId); }}
                >
                  {ChipIcon && <ChipIcon className="axn-chip-icon" size={13} aria-hidden />}
                  {label}
                  {agentId !== 'agent-doc' && <ChevronRight className="axn-chip-arrow" size={12} aria-hidden />}
                </Button>
              );
            })
          )}
        </div>
      </div>}
      {/* 圆角输入区：电脑端关联灾情在发送钮左侧；手机端独立成行避免挤爆 */}
      <div className={`axn-composer${compact ? ' axn-composer--compact' : ''}${isDesktopComposer ? ' axn-composer--desktop' : ''}`}>
        <div className="axn-composer-shell">
          {/* 「资料」入口暂时隐藏；SessionMaterialsDrawer 仍保留，便于后续恢复 */}
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
                  className="axn-composer-upload"
                  icon={<Paperclip size={18} />}
                  aria-label="添加资料"
                  data-testid="chat-attach-button"
                  disabled={!session || busy}
                  onClick={() => fileInputRef.current?.click()}
                />
              </Tooltip>
            )}
            suffix={(_, { components: { LoadingButton, SendButton, SpeechButton } }) => (
              <div className="axn-composer-actions">
                {!isEmbeddedAssistant && incidentSelect}
                {runningTask != null ? (
                  <LoadingButton aria-label="停止生成" title="停止生成" />
                ) : pendingAttachment && !input.trim() ? (
                  <Button type="primary" shape="circle" icon={<ArrowUp size={16} />}
                    aria-label="发送附件" data-testid="send-attachment-only"
                    onClick={() => handleSend('', pendingAttachment)} />
                ) : (
                  <>
                    {!input.trim() && <SpeechButton type="text" shape="circle"
                      className="axn-composer-speech" aria-label="语音输入" title="语音输入"
                      data-testid="composer-speech" />}
                    <SendButton aria-label="发送" title="发送" />
                  </>
                )}
              </div>
            )}
            autoSize={compact ? { minRows: 2, maxRows: 4 } : { minRows: 2, maxRows: 6 }}
            placeholder={
              session
                ? (pendingAttachment
                  ? (compact ? '可补充说明后发送' : '可补充说明后发送，或直接发送附件')
                  : (compact ? '输入指令…' : '向安小能发送指令，Enter 发送'))
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
      {createPortal(
        <div style={{ position: 'fixed', right: 16, top: '50%', transform: 'translateY(-50%)', zIndex: 100 }}>
          <Popover
            title="模拟发送／阶段提问／模拟文件／监测通知"
            trigger="click"
            placement="left"
            open={stagePromptOpen}
            onOpenChange={setStagePromptOpen}
            destroyOnHidden
            content={
              <div className="axn-floating-actions" data-testid="floating-action-list">
                <div className="axn-floating-actions-context">
                  {embeddedKind ? '当前节点相关操作优先展示' : eventStage ? `当前事件阶段：${eventStage} · 相关操作优先展示` : '未关联事件 · 展示常用操作'}
                </div>
                <div className="axn-floating-actions-scroll">
                  {unreadMonitorCount > 0 && (
                    <Button block icon={<Bell size={15} aria-hidden />} danger disabled={!session}
                      onClick={() => { setStagePromptOpen(false); replyMonitorNoticesInChat(); }} data-testid="floating-monitor-notices">
                      监测通知（{unreadMonitorCount}）
                    </Button>
                  )}
                  {pickerGroups.map(group => (
                    <section className="axn-floating-action-group" key={group.label} aria-label={group.label}>
                      <div className="axn-floating-action-group-title">{group.label}</div>
                      {group.options.map(option => (
                        <button type="button" className="axn-floating-action-item" key={option.id}
                          data-choice-id={option.id} disabled={!session || busy}
                          onClick={() => { selectStageChoice(option.id); setStagePromptOpen(false); }}>
                          <span>{option.label}</span>
                          <small>{option.id.startsWith('legacy-quick:') ? '执行' : option.kind === 'file' ? '附件' : '填入'}</small>
                        </button>
                      ))}
                    </section>
                  ))}
                  {unreadMonitorCount === 0 && (
                    <Button block icon={<Bell size={15} aria-hidden />} disabled={!session}
                      onClick={() => { setStagePromptOpen(false); replyMonitorNoticesInChat(); }} data-testid="floating-monitor-notices">
                      监测通知（0）
                    </Button>
                  )}
                </div>
                <div className="axn-floating-actions-hint">
                  {!session ? '会话初始化中，请稍候。' : busy ? '当前任务处理中，完成后即可选择。' : '标记“执行”的操作直接运行；提问和附件先填入输入区，由你发送。'}
                </div>
              </div>
            }
          >
            <Button
              shape="circle"
              size="large"
              icon={<Badge count={unreadMonitorCount} size="small"><MessageSquare size={18} /></Badge>}
              aria-label="阶段提问／模拟文件／监测通知"
              aria-expanded={stagePromptOpen}
              title="模拟发送／阶段提问／模拟文件／监测通知"
              data-testid="stage-prompt-toggle"
              style={{ boxShadow: token.boxShadowSecondary }}
            />
          </Popover>
        </div>,
        document.body,
      )}
    </div>
  );
}
