import { SUPPLY_LEDGER_TEXT, SUPPLY_AUDIT_TEXT } from '@/pages/v2/businessData';
import type { StageChoiceGroup } from './stageConversation';
import { EVENT_NAME } from '@/pages/v2/constants';
import type { ChatAttachment, Session } from '@/domain/types';
import qa from '@/pages/v2/embeddedQa.json';
import { isV2AiKind, V2_AI_KINDS, V2_AI_DOCUMENT_CODES, type V2AiKind } from '@/pages/v2/aiNodes';
import { useSessionStore } from '@/store/sessionStore';

export function embeddedQaIntro(kind: V2AiKind): string {
  const node = qa[kind];
  return `还可以继续向${node.agent}提问。本节点依据${node.source}回答（模拟）。\n\n${node.items.map((item, i) => `${i + 1}. ${item.question}`).join('\n')}\n\n可直接发送：${node.items[0].question}`;
}

export function embeddedQaKind(session: Session | undefined, mode: string | null): V2AiKind | null {
  const kind = mode?.startsWith('v2-') ? mode.slice(3) : '';
  if (!isV2AiKind(kind) || !session) return null;
  if (kind === 'supplies') return session.messages.some(message => message.agentRole === 'v2-supplies') ? kind : null;
  const code = V2_AI_DOCUMENT_CODES[V2_AI_KINDS.indexOf(kind)];
  return session.messages.some(message => message.documentWorkflow?.documentCode === code) ? kind : null;
}

export function embeddedStageChoices(kind: V2AiKind): StageChoiceGroup[] {
  return [
    { label: '当前节点常见提问', options: qa[kind].items.map((item, index) => ({ id: `v2-qa:${kind}:${index}`, kind: 'question', label: item.question, prompt: item.question })) },
    { label: '资料与模拟文件', options: [
      { id: `v2-source:${kind}`, kind: 'question', label: '当前资料的数据来源是什么？', prompt: '当前资料的数据来源是什么？' },
      { id: `v2-file:${kind}`, kind: 'file', label: `发送${qa[kind].label}参考资料（模拟）`, prompt: `我补充：请登记这份${qa[kind].label}参考资料，保留为待核材料。` },
    ] },
  ];
}

export function embeddedChoiceAttachment(kind: V2AiKind, session: Session): ChatAttachment {
  const code = V2_AI_DOCUMENT_CODES[V2_AI_KINDS.indexOf(kind)];
  const workflow = session.messages.slice().reverse().find(message => code && message.documentWorkflow?.documentCode === code)?.documentWorkflow;
  const body = kind === 'supplies' ? `${SUPPLY_LEDGER_TEXT}\n${SUPPLY_AUDIT_TEXT}`
    : workflow?.reportSections?.map(section => section.join('\n')).join('\n\n') ?? '当前节点正文尚未生成，资料待补。';
  return { id: crypto.randomUUID(), name: `${qa[kind].label}参考资料（模拟）.docx`, eventId: session.eventId,
    eventName: EVENT_NAME, simulated: true, kind: '当前节点参考资料', status: '模拟正文已登记·待核',
    content: `当前事件：${EVENT_NAME}\n资料来源：${qa[kind].source}\n${body}` };
}

/** 仅处理当前嵌套节点已绑定的报告或物资核验会话，防止回落到其他种子事件。 */
export function replyEmbeddedQa(sessionId: string, mode: string | null, raw: string, attachment?: ChatAttachment | null): boolean {
  const store = useSessionStore.getState();
  const session = store.sessions[sessionId];
  const kind = embeddedQaKind(session, mode);
  if (!kind) return false;
  const code = V2_AI_DOCUMENT_CODES[V2_AI_KINDS.indexOf(kind)];
  const workflow = code ? session?.messages.slice().reverse().find(message => message.documentWorkflow?.documentCode === code)?.documentWorkflow : undefined;
  const inlineContext = kind === 'assembly';
  const suppliesContext = kind === 'supplies' && session?.messages.some(message => message.agentRole === 'v2-supplies');
  if (!session || (!suppliesContext && !workflow)) return false;
  const text = raw.trim();
  const node = qa[kind];
  const lastAnswer = session.messages.slice().reverse().find(message => message.role === 'assistant')?.text ?? '';
  const nextQuestion = lastAnswer.match(/(?:接下来可发送|可直接发送)：(.+)$/)?.[1];
  const question = /^(继续|下一步|然后呢|接着说)[。！!？?]*$/.test(text) && nextQuestion ? nextQuestion : text;
  const normalized = question.replace(/[\s，。？！,.?!]/g, '');
  const match = node.items.find(item => item.question.replace(/[\s，。？！,.?!]/g, '') === normalized)
    ?? node.items.find(item => item.keywords.some(keyword => normalized.includes(keyword)));
  let answer: string;
  if (['collecting', 'calling', 'generating'].includes(workflow?.stage ?? '')) {
    answer = '本次报告仍在生成，请完成后再提问；当前问题已保留在聊天中。';
  } else if (attachment || /^(我补充|补充资料|补充信息|更新数据)[：:]/.test(text)) {
    answer = (suppliesContext ? '已将补充内容保留在聊天中，按待核资料处理；不会自动解析附件或修改原台账。请在物资管理页补录并核实后再核验。\n\n' : '已将你提供的内容保留在本次聊天中，暂按待核资料处理；此处模拟问答不会解析附件或自动更新报告。请在业务页核实更新后重新分析，或在导出的附件中编辑。\n\n') + embeddedQaIntro(kind);
  } else if (/修改|重新生成|重做|保存|编辑/.test(question)) {
    answer = (inlineContext ? '编组建议直接展示在上方，展开明细核对人装与状态；如需留档可点击“按需整理为附件”。重新分析请回到人装抽组页点击“AI编组建议”；不会自动修改原表或下发指令。\n\n接下来可发送：' : suppliesContext ? '本入口直接在聊天中核验，不生成文书。请在物资管理页核实并更新台账，需要重新核验时再次点击“AI物资核验”。\n\n接下来可发送：' : '可点击“查看文书”打开本次草稿，编辑后点击“保存修改”。需要重新生成时，请回到业务页面再次点击对应 AI 按钮，将创建独立会话和草稿。\n\n接下来可发送：') + node.items[0].question;
  } else if (/来源|依据|哪个事件|当前事件/.test(question)) {
    const event = workflow?.elements.find(item => item.label === '当前事件')?.value ?? (suppliesContext ? EVENT_NAME : '当前页面事件');
    answer = `当前事件：${event}。\n资料来源：${node.source}。回复使用本节点原始页面口径，当前为模拟资料，未读取实时接口；补录资料需人工复核，不会自动成为已核实业务数据。\n\n接下来可发送：${node.items[0].question}`;
  } else if (match) {
    answer = `${match.answer}\n\n接下来可发送：${match.next}`;
  } else {
    answer = (normalized && !/能.*做什么|怎么用|帮助|你好/.test(normalized) ? '当前模拟问答暂未覆盖这个问题，可先从以下内容继续。\n\n' : '') + embeddedQaIntro(kind);
  }
  store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text: text || '请查看我补充的附件。', attachment: attachment ? { ...attachment, content: undefined } : null, taskId: null });
  store.appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', text: answer, taskId: null });
  return true;
}
