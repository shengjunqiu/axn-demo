import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defaultWorkSummaryImprovement,
  ensureWorkSummaryDocument,
  generateWorkSummary,
  submitWorkSummaryImprovement,
} from '@/services/workSummaryWorkflow';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useSessionStore } from '@/store/sessionStore';
import { useKnowledgeCaseStore } from '@/services/knowledgePublish';

describe('workSummaryWorkflow 文书落地', () => {
  it('客户输入文书恢复时保留文种和标题，不改成抢险总结', () => {
    const sessionId = useSessionStore.getState().ensureSessionForEvent('evt-blank-customer');
    for (const code of ['MEETING_MINUTES', 'DUTY_DAILY', 'DAILY_WORK_SUMMARY', 'RESCUE_PLAN']) {
      const title = `客户输入文书-${code}`;
      const document = ensureWorkSummaryDocument(sessionId, {
        stage: 'completed', elements: [], documentCode: code, documentTitle: title,
        documentId: `customer-${code}`, reportSections: [['本次资料', '客户输入内容']],
      });
      expect(document?.code).toBe(code);
      expect(document?.title).toBe(title);
      expect(document?.sections[0][1]).toBe('客户输入内容');
    }
  });
  beforeEach(() => {
    vi.useFakeTimers();
    useSessionStore.getState().resetAll();
    useMockDocumentStore.setState({ libraries: {} });
    useKnowledgeCaseStore.getState().resetAll();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('自动收集后直接生成文书，不停留在逐步问答', async () => {
    const sessionId = useSessionStore.getState().ensureSessionForEvent('evt-sim-landslide');
    const run = generateWorkSummary(sessionId, '生成工作总结');
    await vi.advanceTimersByTimeAsync(5000);
    await run;
    const workflow = useSessionStore.getState().sessions[sessionId]?.messages
      .find((m) => m.documentWorkflow)?.documentWorkflow;
    expect(workflow?.stage).toBe('completed');
    expect(workflow?.collectedCount).toBe(6);
    const module = workflow?.reportSections?.find(([title]) => title === '附：评估与证据模块（正文）');
    expect(module?.[1]).toContain('救援效果评估');
    expect(module?.[1]).toContain('资源投入偏差评估');
    expect(module?.[1]).toContain('七环节救援时间轴');
    expect(module?.[1]).toContain('预案条款对照');
    expect(module?.[1]).toContain('事件沉淀');
    expect(workflow?.collection?.[5]?.answer).toBe(defaultWorkSummaryImprovement('evt-sim-landslide'));
    expect(workflow?.documentId).toBeTruthy();
    const doc = useMockDocumentStore.getState().libraries[sessionId]?.documents
      .find((d) => d.id === workflow?.documentId);
    expect(doc).toBeTruthy();
    expect(doc!.sections.some(([, body]) => body.includes('过程时间轴') || body.includes('改进'))).toBe(true);
  });

  it('历史 waiting_input 仍可提交改进后生成', async () => {
    const sessionId = useSessionStore.getState().ensureSessionForEvent('evt-sim-landslide');
    const message = useSessionStore.getState().appendMessage(sessionId, {
      sessionId,
      role: 'assistant',
      kind: 'agent',
      taskId: null,
      text: '历史待补充',
      agentName: '文书生成智能体',
      agentRole: '抢险总结',
      documentWorkflow: {
        stage: 'waiting_input',
        elements: [{ label: '报告结构', value: '反思式' }],
        collection: [
          { question: 'q1', answer: 'a1' },
          { question: 'q2', answer: 'a2' },
          { question: 'q3', answer: 'a3' },
          { question: 'q4', answer: 'a4' },
          { question: 'q5', answer: 'a5' },
          { question: 'q6', answer: '' },
        ],
        collectedCount: 5,
        reportSections: [
          ['一、实际处置过程', '过程'],
          ['二、处置方案', '方案'],
          ['三、存在不足', '不足'],
          ['四、下一步改进计划', ''],
        ],
      },
    });
    const submit = submitWorkSummaryImprovement(
      sessionId,
      message.messageId,
      '通信组补齐双通道，后勤落实轮换与餐食保障。',
    );
    await vi.advanceTimersByTimeAsync(5000);
    await submit;
    const workflow = useSessionStore.getState().sessions[sessionId]?.messages
      .find((m) => m.messageId === message.messageId)?.documentWorkflow;
    expect(workflow?.stage).toBe('completed');
    expect(workflow?.documentId).toBeTruthy();
  });

  it('完成后清空文书库仍可按 reportSections 重建并打开', async () => {
    const sessionId = useSessionStore.getState().ensureSessionForEvent('evt-sim-landslide');
    const run = generateWorkSummary(sessionId, '生成工作总结');
    await vi.advanceTimersByTimeAsync(5000);
    await run;
    const before = useSessionStore.getState().sessions[sessionId]?.messages
      .find((m) => m.documentWorkflow)?.documentWorkflow;
    expect(before?.stage).toBe('completed');
    useMockDocumentStore.setState({ libraries: {} });
    const restored = ensureWorkSummaryDocument(sessionId, before!);
    expect(restored).toBeTruthy();
    expect(restored!.sections[0]?.[1]).toMatch(/过程时间轴|基本情况|实际处置/);
    const workflow = useSessionStore.getState().sessions[sessionId]?.messages
      .find((m) => m.documentWorkflow)?.documentWorkflow;
    expect(workflow?.documentId).toBe(restored!.id);
  });
});
