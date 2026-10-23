import { act, cleanup, render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import WorkspaceSync from '@/components/workspace/WorkspaceSync';
import { generateEmbeddedResourceReport, generateEmbeddedAssemblyReport, generateEmbeddedPlanReport, generateEmbeddedAdditionalReport } from '@/services/embeddedResourceReport';
import { sendMessage } from '@/services/taskRunner';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useSessionStore } from '@/store/sessionStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useConversationStore } from '@/store/conversationStore';
import { useDemoStore } from '@/store/demoStore';
import { ensureQaLoaded } from '@/services/qaKnowledge';

beforeEach(() => {
  useSessionStore.getState().resetAll();
  useMockDocumentStore.setState({ libraries: {} });
  useWorkspaceStore.getState().resetAll();
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('V2周边资源报告', () => {
  it.each([
    ['dynamics', 'SITUATION_REPORT', '态势感知智能体', '累计值不可逐条相加'],
    ['transport', 'TRANSPORT_PLAN', '救援资源管理智能体', '南昌队52人/42台套'],
    ['summary', 'WORK_SUMMARY', '救援效果评估智能体', '无法计算累计投入'],
  ] as const)('%s节点生成独立报告并恢复正文', async (kind, code, agent, evidence) => {
    vi.useFakeTimers();
    render(<WorkspaceSync />);
    await act(async () => {
      const run = generateEmbeddedAdditionalReport(kind, `new-${kind}`);
      expect(generateEmbeddedAdditionalReport(kind, `new-${kind}`)).toBe(run);
      await vi.runAllTimersAsync();
      await run;
    });
    const cid = useConversationStore.getState().activeConversationId!;
    const sid = useSessionStore.getState().sessionByConversation[cid];
    const invocation = useSessionStore.getState().sessions[sid].messages.find(m => m.documentWorkflow)!;
    expect(invocation.agentName).toBe(agent);
    expect(invocation.documentWorkflow?.stage).toBe('completed');
    const doc = useMockDocumentStore.getState().libraries[sid].documents.find(d => d.id === invocation.documentWorkflow?.documentId)!;
    expect(doc.code).toBe(code);
    expect(doc.title).toContain('遂川县');
    expect(doc.sections.map(section => section[1]).join('\n')).toContain(evidence);
    expect(doc.title).not.toContain('青岭村');
    await act(async () => { useMockDocumentStore.setState({ libraries: {} }); });
    expect(useMockDocumentStore.getState().libraries[sid].documents.some(d => d.id === doc.id)).toBe(true);
    expect(useWorkspaceStore.getState().scopes[sid].generating).toBe(false);
  });
  it('处置方案使用本页模板并恢复正文，不借用其他页人装或虚构专业参数', async () => {
    vi.useFakeTimers();
    render(<WorkspaceSync />);
    await act(async () => {
      const run = generateEmbeddedPlanReport('plan-click-test');
      expect(generateEmbeddedPlanReport('plan-click-test')).toBe(run);
      await vi.runAllTimersAsync();
      await run;
    });
    const cid = useConversationStore.getState().activeConversationId!;
    const sid = useSessionStore.getState().sessionByConversation[cid];
    const invocation = useSessionStore.getState().sessions[sid].messages.find(m => m.documentWorkflow)!;
    expect(invocation.agentName).toBe('救援方案生成智能体');
    expect(invocation.documentWorkflow?.stage).toBe('completed');
    const doc = useMockDocumentStore.getState().libraries[sid].documents.find(d => d.id === invocation.documentWorkflow?.documentId)!;
    expect(doc.code).toBe('RESCUE_PLAN');
    expect(doc.sections).toHaveLength(5);
    const body = doc.sections.map(s => s[1]).join('\n');
    expect(body).toContain('主备运输条件');
    expect(body).toContain('未提供可调用队伍');
    expect(body).not.toContain('80人');
    expect(body).not.toContain('171人');
    await act(async () => { useMockDocumentStore.setState({ libraries: {} }); });
    expect(useMockDocumentStore.getState().libraries[sid].documents.some(d => d.id === doc.id)).toBe(true);
    expect(useWorkspaceStore.getState().scopes[sid].generating).toBe(false);
  });
  it('人装抽组在聊天中展示80人45台套，刷新不自动转为文书', async () => {
    vi.useFakeTimers();
    render(<WorkspaceSync />);
    await act(async () => {
      const run = generateEmbeddedAssemblyReport('assembly-click-test');
      expect(generateEmbeddedAssemblyReport('assembly-click-test')).toBe(run);
      await vi.runAllTimersAsync();
      await run;
    });
    const cid = useConversationStore.getState().activeConversationId!;
    const sid = useSessionStore.getState().sessionByConversation[cid];
    const workflow = useSessionStore.getState().sessions[sid].messages.find(m => m.documentWorkflow)?.documentWorkflow;
    expect(workflow?.stage).toBe('completed');
    expect(workflow?.presentation).toBe('inline');
    expect(workflow?.documentId).toBeUndefined();
    const body = workflow!.reportSections!.map(s => s[1]).join('\n');
    expect(body).toContain('80人、装备45台/套');
    expect(body).toContain('已返营');
    expect(body).not.toContain('171人');
    await act(async () => { useMockDocumentStore.setState({ libraries: {} }); });
    expect(useMockDocumentStore.getState().libraries[sid]).toBeUndefined();
    expect(useWorkspaceStore.getState().scopes[sid]?.generating ?? false).toBe(false);
  });
  it('同一点击不重复生成，保留页面事件、明细差异及可恢复正文', async () => {
    vi.useFakeTimers();
    render(<WorkspaceSync />);
    let run!: Promise<void>;
    await act(async () => {
      run = generateEmbeddedResourceReport('report-click-test');
      expect(generateEmbeddedResourceReport('report-click-test')).toBe(run);
      await vi.runAllTimersAsync();
      await run;
    });
    const conversation = useConversationStore.getState().activeConversationId!;
    const sid = useSessionStore.getState().sessionByConversation[conversation];
    const session = useSessionStore.getState().sessions[sid];
    expect(session.eventId).toMatch(/^evt-blank-/);
    const workflow = session.messages.find(m => m.documentWorkflow)?.documentWorkflow;
    expect(workflow?.stage).toBe('completed');
    const doc = useMockDocumentStore.getState().libraries[sid].documents.find(d => d.id === workflow?.documentId)!;
    expect(doc.title).toContain('遂川县');
    expect(doc.sections.map(s => s[1]).join('\n')).toContain('432.98公里');
    expect(doc.sections.map(s => s[1]).join('\n')).toContain('不能把摘要人数');
    expect(doc.title).not.toContain('青岭村');
    expect(useWorkspaceStore.getState().scopes[sid].generating).toBe(false);
    await act(async () => { useMockDocumentStore.setState({ libraries: {} }); });
    expect(useMockDocumentStore.getState().libraries[sid].documents.some(d => d.id === doc.id)).toBe(true);
    expect(useWorkspaceStore.getState().scopes[sid].selection).toEqual({ kind: 'mock', id: doc.id });
  });

  it('阶段回调异常时释放生成锁，允许下次重试', async () => {
    vi.useFakeTimers();
    const sid = useSessionStore.getState().ensureSessionForEvent('evt-sim-landslide');
    const rejected = useMockDocumentStore.getState().generate(sid, 'RESOURCE_REPORT', {
      elements: [], onStage: () => { throw new Error('阶段错误'); },
    });
    const check = expect(rejected).rejects.toThrow('阶段错误');
    await vi.advanceTimersByTimeAsync(1000);
    await check;
    expect(useMockDocumentStore.getState().libraries[sid].generatingCode).toBeNull();
    const retry = useMockDocumentStore.getState().generate(sid, 'RESOURCE_REPORT');
    await vi.advanceTimersByTimeAsync(2000);
    expect(await retry).toBeTruthy();
  });

  it('普通智能体资源报告刷新后从持久化产物恢复，不再永久生成中', async () => {
    await ensureQaLoaded();
    useDemoStore.getState().setPace('fast');
    const sid = useSessionStore.getState().ensureSessionForEvent('evt-sim-landslide');
    let id = '';
    await act(async () => { id = await sendMessage(sid, { text: '生成周边资源报告' }); });
    await expect.poll(() => useSessionStore.getState().tasks[id]?.status, { timeout: 5000 }).toBe('succeeded');
    const artifact = useSessionStore.getState().tasks[id].artifacts.find(a => a.payload.kind === 'scenario_sections');
    if (artifact?.payload.kind !== 'scenario_sections') throw new Error('没有报告产物');
    const documentId = artifact.payload.documentId;
    useMockDocumentStore.setState({ libraries: {} });
    render(<WorkspaceSync />);
    await expect.poll(() => useMockDocumentStore.getState().libraries[sid]?.documents.some(d => d.id === documentId)).toBe(true);
    expect(useWorkspaceStore.getState().scopes[sid].generating).toBe(false);
    expect(useWorkspaceStore.getState().scopes[sid].selection?.id).toBe(documentId);
  });
});
