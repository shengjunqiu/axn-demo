import { evaluationModuleTexts } from '@/services/evaluationActions';
import { disasterDocumentSections, disasterProfileById } from '@/seed/disasterScenarios';
import type { ChatMessage } from '@/domain/types';
import { RESCUE_EVALUATION_MOCK } from '@/seed/rescueEvaluation';
import { DOCUMENT_CATEGORIES, type MockDocument } from '@/seed/mockDocuments';
import { resolveDocumentTitle } from '@/seed/resolveDocumentSections';
import { documentGeneratedReply, glanceFromSections } from '@/services/documentGeneratedReply';
import { formatTimelineForDocument } from '@/services/eventTimeline';
import { useKnowledgeCaseStore } from '@/services/knowledgePublish';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useSessionStore } from '@/store/sessionStore';

function appendGeneratedReply(
  sessionId: string,
  title: string,
  sections?: Array<readonly [string, string] | { title: string; text?: string; body?: string }>,
) {
  useSessionStore.getState().appendMessage(sessionId, {
    sessionId,
    role: 'assistant',
    kind: 'text',
    taskId: null,
    text: documentGeneratedReply(title, sections?.length ? glanceFromSections(sections) : undefined),
  });
}

type Workflow = NonNullable<ChatMessage['documentWorkflow']>;

/** 第 6 问「下一步改进」的默认可编辑草稿，便于演示直接提交。 */
export function defaultWorkSummaryImprovement(eventId: string): string {
  const profile = disasterProfileById.get(eventId);
  const objective = profile
    ? `${profile.objective}（进度 ${profile.completed}/${profile.target}${profile.unit}）`
    : '未完成目标与缺项凭证';
  const focus = profile?.gaps || '通信保障、服装餐食与人员轮换衔接';
  return [
    `1. 通信保障：针对现场盲区补齐中继与双通道报送；责任人：通信岗；时限：7 日内完成点位复核；验证：盲区覆盖测试记录与报送回执。`,
    `2. 后勤保障：固化餐食配送、服装尺码与湿衣替换清单；责任人：后勤岗；时限：下次集结前；验证：物资台账与现场签收单。`,
    `3. 人员轮换：明确多点作业与夜间任务的交接时段、交接清单与清点责任；责任人：现场指挥岗；时限：本周内修订并演练；验证：交接清单样例与演练记录。`,
    `4. 目标跟踪：围绕「${objective}」补齐验收、消耗与撤收回执；关注「${focus}」；责任人：值班与专业岗位；时限：归档前；验证：有效凭证齐全后再改写正式结论。`,
  ].join('\n');
}

/**
 * 会话 workflow 会持久化，但 mock 文书库不落盘。
 * 刷新后「已完成」却找不到文书时，按 reportSections 重建并回写 documentId。
 */
export function ensureWorkSummaryDocument(
  sessionId: string,
  workflow: Workflow,
  messageId?: string,
): MockDocument | null {
  const sections = workflow.reportSections;
  if (workflow.presentation === 'inline') return null;
  if (!sections?.length) return null;
  const library = useMockDocumentStore.getState().libraries[sessionId];
  const existing = workflow.documentId
    ? library?.documents.find((item) => item.id === workflow.documentId)
    : null;
  if (existing) return existing;

  const code = workflow.documentCode ?? 'WORK_SUMMARY';
  const category = DOCUMENT_CATEGORIES.find((item) => item.code === code);
  if (!category) return null;
  const session = useSessionStore.getState().sessions[sessionId];
  const eventId = session?.eventId ?? '';
  const now = new Date();
  const document: MockDocument = {
    id: workflow.documentId ?? `generated-${code}-${now.getTime()}`,
    code,
    title: workflow.documentTitle ?? resolveDocumentTitle(eventId, category.name, category.topics[0]),
    date: now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
    number: `${category.prefix}〔${now.getFullYear()}〕模拟草稿`,
    sections,
  };
  useMockDocumentStore.setState((state) => {
    const prev = state.libraries[sessionId] ?? {
      documents: [],
      selected: null,
      generatingCode: null,
      working: {},
      versions: {},
    };
    return {
      libraries: {
        ...state.libraries,
        [sessionId]: {
          ...prev,
          documents: [document, ...prev.documents.filter((d) => d.id !== document.id)],
          selected: document,
          generatingCode: null,
        },
      },
    };
  });
  if (session && workflow.documentId !== document.id) {
    const message = (messageId
      ? session.messages.find((m) => m.messageId === messageId)
      : null)
      ?? session.messages.find((m) => m.documentWorkflow === workflow)
      ?? session.messages.find((m) =>
        m.documentWorkflow?.stage === 'completed' && m.documentWorkflow.reportSections === sections);
    if (message?.documentWorkflow) {
      useSessionStore.getState().updateDocumentWorkflow(sessionId, message.messageId, {
        ...message.documentWorkflow,
        documentId: document.id,
      });
    }
  }
  return document;
}

/** 问答与报告共享同一份模拟复盘记录，不把模拟补充伪装成用户真实输入。 */
export async function generateWorkSummary(sessionId: string, text = '生成工作总结', options?: { interactive?: boolean; skipUserMessage?: boolean; structureText?: string }) {
  const store = useSessionStore.getState();
  const session = store.sessions[sessionId];
  if (!session || session.messages.some(message => message.documentWorkflow?.stage === 'waiting_input') || useMockDocumentStore.getState().libraries[sessionId]?.generatingCode ||
    Object.values(store.tasks).some(task => task.sessionId === sessionId && ['running', 'queued'].includes(task.status))) return;
  // 复盘总结 / 抢险总结默认走反思式；仅显式「全面」时用全面型章节。
  const useFull = /全面总结|工作总结（全面）|抢险总结（全面）|全面型/.test(options?.structureText ?? text);
  const record = RESCUE_EVALUATION_MOCK[session.eventId];
  const profile = disasterProfileById.get(session.eventId);
  const overview = record
    ? `本阶段围绕${record.objective}开展救援，投入人员${record.personnel}人、设备${record.equipment}台，响应耗时${record.responseMinutes}分钟；目标${record.target}${record.unit}，已完成${record.completed}${record.unit}，完成率${Math.round(record.completed / record.target * 100)}%。${record.risk}`
    : '本次采用独立应急演练样例：投入24人、3台设备，开展人员转移与现场保障，计划转移60人，已完成54人，剩余6人持续跟进。';
  const collection = [
    {
      question: '总结什么阶段的工作？采用什么结构？',
      answer: useFull
        ? '采用本阶段救援工作的全面总结，按基本情况、主要经验做法、深刻启示、下一步工作打算组织报告（与反思式复盘分属不同应用场景）。'
        : '采用本阶段救援工作的反思式总结，按实际处置过程、处置方案、存在不足、下一步改进计划组织报告（与全面总结分属不同应用场景）。',
    },
    { question: '自动汇总的救援数据是否完整？还需要补充哪些资源消耗？', answer: `${overview}补充模拟保障台账：累计发放餐食96份、饮水144瓶，使用雨衣24件、备用电池12组；装备投入与物资消耗分别统计。` },
    { question: '现场实际问题是什么？采取了哪些处置方案？', answer: profile ? `${profile.planSections.map(([h, b]) => `${h}：${b}`).join('；')} 专业复核事项：${profile.gaps}` : '现场存在通信盲区、作业点分散、交接信息不完整等问题。采取中继补点与专人转报，按作业区分组处置；设置物资配送点，分批轮换并建立交接清单。' },
    { question: '取得了哪些成效？如何沉淀实战经验？', answer: '已完成任务以救援台账为准，未完成事项继续跟踪。通过复盘会议和集合列队讲评分享经验，形成通信双通道、分区保障和交接清单三项做法，纳入后续训练。' },
    { question: '有哪些反复出现的问题？通信与复杂保障场景存在哪些不足？', answer: '重复问题：跨班交接遗漏、物资需求重复报送。通信类：盲区覆盖不足、备用电池补给不及时。保障类：多点作业与夜间任务叠加，人员轮换衔接不畅，餐食配送延迟、服装尺码不齐及湿衣替换不足。' },
    { question: '下一步如何改进？责任、时限和验证方式是什么？', answer: defaultWorkSummaryImprovement(session.eventId) },
  ];
  const timeline = formatTimelineForDocument(session.eventId);
  const fromProfile = disasterDocumentSections(session.eventId, useFull ? 'WORK_SUMMARY' : 'WORK_SUMMARY_REFLECT');
  let sections: [string, string][] = fromProfile
    ? fromProfile.map(([h, b]) => [h, b] as [string, string])
    : (useFull
      ? [
          ['一、基本情况', `${profile ? `${profile.name}；${profile.description}` : ''}${overview}\n\n${timeline}`],
          ['二、主要经验做法', `（一）处置方案与实施：${collection[2].answer}（二）成效与实战经验：${collection[3].answer}`],
          ['三、深刻启示', `复盘暴露的短板与启示：${collection[4].answer}`],
          ['四、下一步工作打算', collection[5].answer],
        ]
      : [
          ['一、实际处置过程', `${profile ? `${profile.name}；${profile.description}` : ''}${overview}保障台账（模拟）：累计发放餐食96份、饮水144瓶，使用雨衣24件、备用电池12组。\n\n${timeline}`],
          ['二、处置方案', `（一）处置方案与实施：${collection[2].answer}（二）成效与实战经验：${collection[3].answer}`],
          ['三、存在不足', `复盘暴露的短板：${collection[4].answer}`],
          ['四、下一步改进计划', collection[5].answer],
        ]);
  if (sections[0] && !sections[0][1].includes('过程时间轴')) {
    sections = [[sections[0][0], `${sections[0][1]}\n\n${timeline}`], ...sections.slice(1)];
  }
  const modules = evaluationModuleTexts(session.eventId, sessionId, sections.map(([h,b])=>`${h}：${b}`).join('\n'));
  sections.push(['附：评估与证据模块（正文）', ['救援效果评估','资源投入偏差评估','七环节救援时间轴','预案条款对照','事件沉淀'].map(name=>`${name}：\n${modules[name]}`).join('\n\n')]);
  if (options?.interactive) {
    sections = sections.map(([heading, body]) => [heading, body
      .replaceAll('已形成知识候选（模拟）', '待确认后提炼知识候选（模拟）')
      .replaceAll('评估完成自动触发迭代任务', '经验审核后更新知识库')
      .replaceAll('已触发（模拟）', '待确认与审核（模拟）')]);
  }
  const elements = [{
    label: '报告结构',
    value: useFull
      ? '全面抢险总结 · 基本情况/主要经验做法/深刻启示/下一步打算'
      : '反思式抢险总结 · 实际处置过程/处置方案/存在不足/改进计划',
  }];
  let workflow: Workflow = {
    compactReview: options?.interactive,
    stage: 'collecting',
    elements,
    collection,
    collectedCount: 0,
    reportSections: sections,
  };
  if (!options?.skipUserMessage) store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text, taskId: null });
  const invocation = store.appendMessage(sessionId, {
    sessionId, role: 'assistant', kind: 'agent', taskId: null, text: '自动汇总复盘要素并生成抢险总结',
    agentName: '文书生成智能体', agentRole: '抢险总结 · 复盘评估分析', documentWorkflow: workflow,
  });
  const update = (patch: Partial<Workflow>) => {
    workflow = { ...workflow, ...patch };
    useSessionStore.getState().updateDocumentWorkflow(sessionId, invocation.messageId, { ...workflow });
  };
  // 自动收集全部要素（含默认改进计划），不再停在逐步问答，直接生成文书并打开。
  const document = await useMockDocumentStore.getState().generate(sessionId, 'WORK_SUMMARY', {
    elements,
    sections,
    collect: async () => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      update({ collectedCount: collection.length });
    },
    onStage: (stage) => update({ stage }),
  });
  update({ stage: document ? 'completed' : 'interrupted', documentId: document?.id });
  if (document && options?.interactive) {
    store.appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', taskId: null,
      text: '复盘总结报告已生成，可点击“查看文书”查看、编辑和导出。需要我从报告中提炼可复用经验，整理为知识库候选吗？',
      summaryOffer: { kind: 'knowledge', documentId: document.id } });
  } else if (document) {
    appendGeneratedReply(sessionId, document.title, sections);
    useKnowledgeCaseStore.getState().publishEventCase({
      eventId: session.eventId,
      source: 'summary',
      title: `${document.title} · 案例候选`,
      body: sections.map(([h, b]) => `${h}\n${b}`).join('\n\n'),
      tags: ['抢险总结', '复盘', '演练参考'],
    });
  }
}

/** 接收真实输入后恢复生成，等待状态可在刷新后继续。 */
export async function submitWorkSummaryImprovement(sessionId: string, messageId: string, raw: string) {
  const answer = raw.trim();
  const store = useSessionStore.getState();
  const workflow = store.sessions[sessionId]?.messages.find(message => message.messageId === messageId)?.documentWorkflow;
  if (!answer || workflow?.stage !== 'waiting_input' || !workflow.collection || !workflow.reportSections ||
    useMockDocumentStore.getState().libraries[sessionId]?.generatingCode) return;
  const collection = workflow.collection.map((round, index) => index === 5 ? { ...round, answer } : round);
  const sections = workflow.reportSections.map(([title, body], index): [string, string] => [title, index === 3 ? answer : body]);
  const confirmed = { ...workflow, collection, collectedCount: collection.length, reportSections: sections };
  const update = (stage: Workflow['stage'], documentId?: string) =>
    useSessionStore.getState().updateDocumentWorkflow(sessionId, messageId, { ...confirmed, stage, documentId });
  update('calling');
  store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text: answer, taskId: null });
  const document = await useMockDocumentStore.getState().generate(sessionId, 'WORK_SUMMARY', {
    elements: workflow.elements, sections, onStage: stage => update(stage),
  });
  update(document ? 'completed' : 'interrupted', document?.id);
  if (document) {
    appendGeneratedReply(sessionId, document.title, sections);
    const session = useSessionStore.getState().sessions[sessionId];
    if (session) {
      useKnowledgeCaseStore.getState().publishEventCase({
        eventId: session.eventId,
        source: 'summary',
        title: `${document.title} · 案例候选`,
        body: sections.map(([h, b]) => `${h}\n${b}`).join('\n\n'),
        tags: ['抢险总结', '复盘', '演练参考'],
      });
    }
  }
}
