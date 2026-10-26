import { sendMessage } from './taskRunner';
import { disasterProfileById, baseCombatEventId } from '@/seed/disasterScenarios';
import { RESCUE_EVALUATION_MOCK } from '@/seed/rescueEvaluation';
import { useSessionStore } from '@/store/sessionStore';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useKnowledgeCaseStore } from './knowledgePublish';
import { generateWorkSummary } from './workSummaryWorkflow';

export function startSummaryConversation(sessionId: string, request: string, structureText = request) {
  const store = useSessionStore.getState();
  const session = store.sessions[sessionId];
  if (!session) return;
  const profile = disasterProfileById.get(session.eventId);
  const record = RESCUE_EVALUATION_MOCK[session.eventId] ?? RESCUE_EVALUATION_MOCK[baseCombatEventId(session.eventId)];
  const target = profile?.target ?? record?.target;
  const completed = profile?.completed ?? record?.completed;
  const unit = profile?.unit ?? record?.unit ?? '';
  const completion = target && completed !== undefined ? `${profile?.objective ?? record?.objective}：计划${target}${unit}，完成${completed}${unit}，完成率${Math.round(completed / target * 100)}%。` : '已梳理人员转移、现场处置与通道保障等阶段成效（模拟）。';
  const diff = record ? record.responseMinutes - record.targetMinutes : null;
  const timing = record ? `计划${record.targetMinutes}分钟响应，实际${record.responseMinutes}分钟，${diff! > 0 ? `延迟${diff}分钟` : diff! < 0 ? `提前${-diff!}分钟` : '与计划一致'}。` : '已按接报、集结、到场和作业节点整理时效对比（模拟）。';
  const experience = /泥石流/.test(profile?.category ?? '') ? '将沟道排查、先遣核路与清障配合整理为可复用做法。' : /滑坡/.test(profile?.category ?? '') ? '将边坡监测、警戒撤离与分区搜救配合整理为经验。' : '提炼现场风险核查、人装协同和交接保障的可复用做法。';
  store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', taskId: null, text: request });
  store.appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', taskId: null,
    text: '需要我把以上评估整理成一份完整的复盘总结报告吗？',
    reviewSummary: { conclusion: target && completed !== undefined ? `本次阶段目标${completed >= target ? '已按模拟记录完成，仍需核对验收凭证' : '尚未全部完成，需跟进剩余任务'}。${timing}资源消耗和问题原因仍需结合凭证复核。` : '已按处置成效、投入时效和保障协同完成初步复盘，建议重点优化跨组交接与资源调配（模拟）。', rows: [
      { label: '处置成效', value: completion },
      { label: '投入与时效', value: `${timing}人员、装备投入偏差待批准计划核对。` },
      { label: '消耗与短板', value: '物资消耗待凭证核对；通信、人员轮换与交接作为复盘重点。' },
      { label: '可沉淀经验', value: experience },
    ] }, summaryOffer: { kind: 'report', request: structureText } });
}

/** 只有紧接本会话的明确询问才识别“是”，不会劫持其他问题。 */
export function respondToSummaryOffer(sessionId: string, raw: string): boolean {
  const store = useSessionStore.getState();
  const session = store.sessions[sessionId];
  const latest = session?.messages.at(-1);
  if (!session || latest?.role !== 'assistant' || !latest.summaryOffer || ['map', 'sixData'].includes(latest.summaryOffer.kind)) return false;
  const text = raw.trim();
  const yes = /^(是|是的|要|需要|好的?|可以|行|生成吧|请生成|生成总结报告|生成复盘总结报告|需要生成总结报告|需要，生成总结报告|整理知识候选|需要，整理知识候选)[。！!，,\s]*$/.test(text);
  const no = /^(否|不|不需要|不用|暂时不需要|暂不生成|暂不整理|先不生成|先不用)[。！!，,\s]*$/.test(text);
  if (!yes && !no) return false;
  if (yes && latest.summaryOffer.kind === 'analysis') {
    void sendMessage(sessionId, { text, interpretationText: latest.summaryOffer.request, skipAssess: true });
    return true;
  }
  store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', taskId: null, text });
  if (no) {
    store.appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', taskId: null, text: latest.summaryOffer.kind !== 'knowledge' ? '好的，先保留以上评估结果，您也可以继续补充资料或提出修改要求。' : '好的，暂不整理知识库候选，报告仍可继续查看和修改。' });
    return true;
  }
  if (latest.summaryOffer.kind === 'report') {
    void generateWorkSummary(sessionId, text, { interactive: true, skipUserMessage: true, structureText: latest.summaryOffer.request });
  } else {
    const document = useMockDocumentStore.getState().libraries[sessionId]?.documents.find(doc => doc.id === latest.summaryOffer?.documentId);
    if (document) {
      useKnowledgeCaseStore.getState().publishEventCase({ eventId: session.eventId, source: 'summary', title: `${document.title} · 经验候选`, body: document.sections.map(([heading, body]) => `${heading}\n${body}`).join('\n\n'), tags: ['复盘经验', '待审核'] });
    }
    store.appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', taskId: null, text: document ? '已根据报告整理本事件的经验候选，保留做法、问题和改进依据，等待人工审核；尚未发布到正式知识库。' : '未找到对应报告，请先生成总结报告后再整理经验候选。' });
  }
  return true;
}
