import { disasterDocumentSections, disasterProfileById } from '@/seed/disasterScenarios';
import type { ChatMessage } from '@/domain/types';
import { RESCUE_EVALUATION_MOCK } from '@/seed/rescueEvaluation';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useSessionStore } from '@/store/sessionStore';

type Workflow = NonNullable<ChatMessage['documentWorkflow']>;

/** 问答与报告共享同一份模拟复盘记录，不把模拟补充伪装成用户真实输入。 */
export async function generateWorkSummary(sessionId: string, text = '生成工作总结') {
  const store = useSessionStore.getState();
  const session = store.sessions[sessionId];
  if (!session || session.messages.some(message => message.documentWorkflow?.stage === 'waiting_input') || useMockDocumentStore.getState().libraries[sessionId]?.generatingCode ||
    Object.values(store.tasks).some(task => task.sessionId === sessionId && ['running', 'queued'].includes(task.status))) return;
  const useFull = /全面总结|工作总结（全面）|抢险总结（全面）|全面型/.test(text);
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
    { question: '下一步如何改进？责任、时限和验证方式是什么？', answer: '' },
  ];
  const fromProfile = disasterDocumentSections(session.eventId, useFull ? 'WORK_SUMMARY' : 'WORK_SUMMARY_REFLECT');
  const sections: [string, string][] = fromProfile ?? (useFull
    ? [
        ['一、基本情况', `${profile ? `${profile.name}；${profile.description}` : ''}${overview}`],
        ['二、主要经验做法', `（一）处置方案与实施：${collection[2].answer}（二）成效与实战经验：${collection[3].answer}`],
        ['三、深刻启示', `复盘暴露的短板与启示：${collection[4].answer}`],
        ['四、下一步工作打算', collection[5].answer],
      ]
    : [
        ['一、实际处置过程', `${profile ? `${profile.name}；${profile.description}` : ''}${overview}保障台账（模拟）：累计发放餐食96份、饮水144瓶，使用雨衣24件、备用电池12组。`],
        ['二、处置方案', `（一）处置方案与实施：${collection[2].answer}（二）成效与实战经验：${collection[3].answer}`],
        ['三、存在不足', `复盘暴露的短板：${collection[4].answer}`],
        ['四、下一步改进计划', collection[5].answer],
      ]);
  const elements = [{
    label: '报告结构',
    value: useFull
      ? '全面抢险总结 · 基本情况/主要经验做法/深刻启示/下一步打算'
      : '反思式抢险总结 · 实际处置过程/处置方案/存在不足/改进计划',
  }];
  let workflow: Workflow = { stage: 'collecting', elements, collection, collectedCount: 0, reportSections: sections };
  store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text, taskId: null });
  const invocation = store.appendMessage(sessionId, {
    sessionId, role: 'assistant', kind: 'agent', taskId: null, text: '收集救援复盘要素并生成抢险总结',
    agentName: '文书生成智能体', agentRole: '抢险总结 · 复盘评估分析', documentWorkflow: workflow,
  });
  const update = (patch: Partial<Workflow>) => {
    workflow = { ...workflow, ...patch };
    useSessionStore.getState().updateDocumentWorkflow(sessionId, invocation.messageId, { ...workflow });
  };
  const document = await useMockDocumentStore.getState().generate(sessionId, 'WORK_SUMMARY', {
    elements, sections,
    collect: async () => {
      for (let i = 1; i < collection.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 650));
        update({ collectedCount: i });
      }
      update({ stage: 'waiting_input' });
      return false;
    },
    onStage: stage => update({ stage }),
  });
  if (workflow.stage !== 'waiting_input') update({ stage: document ? 'completed' : 'interrupted', documentId: document?.id });
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
}
