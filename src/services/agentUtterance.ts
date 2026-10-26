/**
 * 四个救援智能体的会话分流：态势、资源、方案、评估。
 * 命中后直接写入当前会话，不再走通用任务卡。
 */
import type { EvaluationTextAction } from '@/services/evaluationActions';
import { EVALUATION_TEXT_ACTIONS, evaluationActionReply } from '@/services/evaluationActions';
import { openInlineSituation } from '@/services/inlineSituation';
import { startMultiSourceConversation } from '@/services/multiSourceConversation';
import { runEventPrecipitation } from '@/services/eventPrecipitation';
import { resourceAuditSample } from '@/services/resourceAudit';
import { resourceRecommendationReply } from '@/services/resourceRecommendation';
import { generateRescuePlanAlternatives } from '@/services/rescuePlanAlternatives';
import { startRouteConversation } from '@/services/roadWeather';
import { respondToSummaryOffer, startSummaryConversation } from '@/services/summaryConversation';
import { tenderTaskPrompt } from '@/seed/tenderNames';
import { useSessionStore } from '@/store/sessionStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

const YES = /^(是|是的|需要|要|好的?|可以|展示|需要，展示六类数据图表|展示六类数据图表|需要，用地图展示|用地图展示线路)[。！!，,\s]*$/;
const NO = /^(不需要|不用|暂不生成|暂时不需要|先不用)[。！!\s]*$/;

function matchesTask(text: string, task: string): boolean {
  return text === task || text.includes(task) || tenderTaskPrompt(text) === task;
}

export function dispatchAgentUtterance(input: {
  sessionId: string;
  eventId: string;
  text: string;
  scope: string;
  onOpenKnowledge: () => void;
}): boolean {
  const { sessionId, text, scope, onOpenKnowledge } = input;
  const trimmed = text.trim();
  if (!trimmed) return false;
  const store = useSessionStore.getState();
  const session = store.sessions[sessionId];
  if (!session) return false;
  // 绑定事件后的回调可能还拿着渲染前的事件，这里以 store 里的最新事件为准。
  const eventId = session.eventId;
  const latest = session.messages.at(-1);

  if (latest?.summaryOffer?.kind === 'sixData') {
    const accepted = YES.test(trimmed);
    const declined = NO.test(trimmed);
    if (accepted || declined) {
      store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text: trimmed, taskId: null });
      store.appendMessage(sessionId, {
        sessionId, role: 'assistant', kind: 'text', taskId: null,
        text: accepted ? '已在右侧展开六类数据，您可以切换查看图表、记录与来源依据。' : '好的，先保留以上汇聚总结，需要时可以继续查看详细数据。',
        multiSourceDetails: latest.multiSourceDetails,
      });
      if (accepted) useWorkspaceStore.getState().select(scope, { kind: 'sixData', id: latest.summaryOffer.request ?? eventId });
      return true;
    }
  }

  if (/多源数据汇聚|六源汇聚|汇聚.*六类|汇总.*六类/.test(trimmed) || matchesTask(trimmed, '多源数据汇聚')) {
    startMultiSourceConversation(sessionId, trimmed);
    return true;
  }

  if (latest?.summaryOffer?.kind === 'map') {
    const accepted = YES.test(trimmed);
    const declined = NO.test(trimmed);
    if (accepted || declined) {
      store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text: trimmed, taskId: null });
      store.appendMessage(sessionId, {
        sessionId, role: 'assistant', kind: 'text', taskId: null,
        text: accepted ? '已在右侧地图展示线路，您可以查看路线详情。' : '好的，先保留以上路线信息。',
      });
      if (accepted) useWorkspaceStore.getState().select(scope, { kind: 'flow', id: '规划梯队投送' });
      return true;
    }
  }

  if (/核对道路天气|沿途道路|现场天气|规划.*(?:路线|线路)|投送路线优化/.test(trimmed) || matchesTask(trimmed, '规划梯队投送')) {
    startRouteConversation(sessionId, trimmed, /天气|沿途道路/.test(trimmed));
    return true;
  }

  if (respondToSummaryOffer(sessionId, trimmed)) return true;

  if (matchesTask(trimmed, '物资核验') || matchesTask(trimmed, '资源数据校验对比')) {
    store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text: trimmed, taskId: null });
    store.appendMessage(sessionId, {
      sessionId, role: 'assistant', kind: 'text', taskId: null,
      text: '物资核验结果（模拟台账）',
      resourceAudit: {
        rows: resourceAuditSample('异常样例'),
        checkedAt: new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' }),
      },
    });
    return true;
  }

  if (matchesTask(trimmed, '事件沉淀')) {
    if (eventId.startsWith('evt-blank-')) return false;
    store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text: '事件沉淀', taskId: null });
    store.appendMessage(sessionId, {
      sessionId, role: 'assistant', kind: 'agent', taskId: null,
      text: '正在汇总本事件案例要点并写入知识库（模拟）',
      agentName: '救援效果评估智能体',
      agentRole: '事件沉淀',
    });
    const { reply } = runEventPrecipitation(eventId);
    store.appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', taskId: null, text: reply });
    onOpenKnowledge();
    return true;
  }

  if (EVALUATION_TEXT_ACTIONS.includes(trimmed as EvaluationTextAction)) {
    store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text: trimmed, taskId: null });
    store.appendMessage(sessionId, {
      sessionId, role: 'assistant', kind: 'text', taskId: null,
      text: evaluationActionReply(trimmed as EvaluationTextAction, eventId, sessionId),
    });
    return true;
  }

  if (matchesTask(trimmed, '生成救援方案')) {
    generateRescuePlanAlternatives(sessionId, eventId);
    return true;
  }

  if (matchesTask(trimmed, '资源建议')) {
    store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text: '资源建议', taskId: null });
    store.appendMessage(sessionId, {
      sessionId, role: 'assistant', kind: 'text', taskId: null,
      text: resourceRecommendationReply(eventId),
    });
    return true;
  }

  if (matchesTask(trimmed, '预警推送') || matchesTask(trimmed, '态势研判预警')) {
    openInlineSituation(sessionId, matchesTask(trimmed, '预警推送') ? '预警推送' : '态势研判预警');
    return true;
  }

  if (/复盘总结|生成全面总结/.test(trimmed) && !/生成工作总结/.test(trimmed)) {
    startSummaryConversation(sessionId, trimmed);
    return true;
  }

  return false;
}
