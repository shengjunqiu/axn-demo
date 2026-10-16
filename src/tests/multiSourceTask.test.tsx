import { MemoryRouter } from 'react-router-dom';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { recognize } from '@/services/mock/provider';
import { sendMessage } from '@/services/taskRunner';
import { useSessionStore } from '@/store/sessionStore';
import { useDemoStore } from '@/store/demoStore';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { DEFAULT_EVENT_ID } from '@/seed/scenario';
import { stageChipConfig } from '@/seed/quickActionCatalog';
import { ensureQaLoaded } from '@/services/qaKnowledge';

await ensureQaLoaded();

import WorkspaceSync from '@/components/workspace/WorkspaceSync';
import TaskCard from '@/components/chat/TaskCard';

beforeEach(() => {
  useDemoStore.getState().reset();
  useDemoStore.getState().switchEvent(DEFAULT_EVENT_ID);
  useDemoStore.getState().setPace('fast');
  useSessionStore.getState().resetAll();
});
afterEach(cleanup);

describe('分析结果与正式报告分开呈现', () => {
  it.each(['查询周边救援资源', '核对资源状态', '资源投入偏差评估', '评估救援效果', '方案修订对比'])('%s不自动生成或打开文书', async text => {
    const sid = useSessionStore.getState().ensureSessionForEvent(DEFAULT_EVENT_ID);
    render(<WorkspaceSync />);
    const id = await sendMessage(sid, { text });
    await expect.poll(() => useSessionStore.getState().tasks[id]?.status, { timeout: 5000 }).toBe('succeeded');
    const artifact = useSessionStore.getState().tasks[id].artifacts.find(a => a.payload.kind === 'scenario_sections');
    expect(artifact?.payload.kind === 'scenario_sections' && artifact.payload.documentId).toBeUndefined();
    expect(useWorkspaceStore.getState().scopes[sid]?.generating ?? false).toBe(false);
  });
});

describe('独立多源数据汇聚快捷任务', () => {
  it('快捷目录和自然语言走汇聚，摘要和报告语义独立', () => {
    const ctx = { lastResourceResultIds: [], candidateResourceIds: [] };
    expect(stageChipConfig('待研判').primary).toContain('多源数据汇聚');
    expect(recognize('多源数据汇聚', ctx).params.capability).toBe('multiSource');
    expect(recognize('自动整合舆情、气象、水文等多源数据，实现全域灾情信息自动汇总', ctx).params.capability).toBe('multiSource');
    expect(recognize('生成灾情摘要', ctx).params.capability).toBe('disasterSummary');
    expect(recognize('生成态势报告', ctx).params.capability).toBe('situationReport');
  });
  it('直接展示六源分节与授权域条目，不生成文书或切换工作区', async () => {
    const sid = useSessionStore.getState().ensureSessionForEvent(DEFAULT_EVENT_ID);
    const beforeDocs = useMockDocumentStore.getState().libraries[sid]?.documents.length ?? 0;
    const beforeWorkspace = useWorkspaceStore.getState().scopes[sid]?.selection;
    render(<WorkspaceSync />);
    const id = await sendMessage(sid, { text: '多源数据汇聚' });
    await expect.poll(() => useSessionStore.getState().tasks[id]?.status, { timeout: 5000 }).toBe('succeeded');
    const task = useSessionStore.getState().tasks[id];
    expect(task.steps.map(s => s.name)).toEqual(['确定授权汇聚范围', '整合六类数据来源', '按事件归并并汇总灾情信息']);
    expect(task.artifacts).toHaveLength(1);
    const result = task.artifacts[0].payload;
    if (result.kind !== 'summary') throw Error('missing aggregation');
    expect(result.displayMode).toBe('multi_source');
    expect(result.rows).toEqual([]);
    expect(result.multiSource?.event.sources).toHaveLength(6);
    expect(result.multiSource?.domainEvents.length).toBeGreaterThan(0);
    expect(useMockDocumentStore.getState().libraries[sid]?.documents.length ?? 0).toBe(beforeDocs);
    expect(useWorkspaceStore.getState().scopes[sid]?.selection).toEqual(beforeWorkspace);
    expect(useWorkspaceStore.getState().scopes[sid]?.generating ?? false).toBe(false);
    render(<MemoryRouter><TaskCard task={task} onOpenDrawer={() => {}} /></MemoryRouter>);
    expect(screen.getByTestId('multi-source-summary')).toBeTruthy();
    expect(screen.queryByTestId('event-summary-text')).toBeNull();
    expect(screen.getByText('全域灾情汇总（授权范围）')).toBeTruthy();
    expect(screen.queryAllByRole('table')).toHaveLength(0);
    expect(screen.getAllByRole('region', { name: /汇聚摘要$/ })).toHaveLength(6);
    expect(screen.getByText('待核事项')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: `查看${result.multiSource!.domainEvents[0].title}汇聚详情` }));
    expect(await screen.findByText(/授权汇聚$/)).toBeTruthy();
    expect(screen.getAllByText(/V1-demo/).length).toBeGreaterThan(0);
  });
  it('未关联事件时不读取跨域资料', async () => {
    useDemoStore.getState().switchEvent('evt-blank-ms');
    const sid = useSessionStore.getState().ensureSessionForEvent('evt-blank-ms');
    const id = await sendMessage(sid, { text: '多源数据汇聚' });
    await expect.poll(() => useSessionStore.getState().tasks[id]?.status, { timeout: 5000 }).toBe('waiting_input');
    expect(useSessionStore.getState().tasks[id].artifacts).toEqual([]);
  });
});

 describe('现场智能勘察辅助任务', () => {
  it('快捷入口走独立勘察分析，不映射到摘要或补充流程', () => {
    expect(stageChipConfig('待研判').primary).toContain('现场智能勘察辅助');
    expect(recognize('现场智能勘察辅助', { lastResourceResultIds: [], candidateResourceIds: [] }).params.capability).toBe('survey');
  });
  it('勘察直接输出正文和三组证据，不自动生成文书', async () => {
    const sid = useSessionStore.getState().ensureSessionForEvent(DEFAULT_EVENT_ID);
    const sync = render(<WorkspaceSync />);
    const id = await sendMessage(sid, { text: '现场智能勘察辅助' });
    await expect.poll(() => useSessionStore.getState().tasks[id]?.status, { timeout: 5000 }).toBe('succeeded');
    const task = useSessionStore.getState().tasks[id];
    expect(task.textAnswer).toContain('现场资料综合分析');
    expect(task.textAnswer).toContain('勘察建议与补证事项');
    const artifact = task.artifacts.find(a => a.payload.kind === 'scenario_sections');
    if (artifact?.payload.kind !== 'scenario_sections') throw Error('missing survey document');
    expect(artifact.payload.capability).toBe('survey');
    expect(artifact.payload.tables).toHaveLength(3);
    expect(artifact.payload.documentId).toBeUndefined();
    expect(useMockDocumentStore.getState().libraries[sid]?.documents.some(d => d.code === 'SURVEY_ANALYSIS') ?? false).toBe(false);
    expect(useWorkspaceStore.getState().scopes[sid]?.generating ?? false).toBe(false);
    sync.unmount();
    useMockDocumentStore.setState({ libraries: {} });
    render(<WorkspaceSync />);
    expect(useMockDocumentStore.getState().libraries[sid]).toBeUndefined();
    render(<MemoryRouter><TaskCard task={task} onOpenDrawer={() => {}} /></MemoryRouter>);
    expect(screen.getByText(/现场资料综合分析/)).toBeTruthy();
    expect(screen.getByRole('button', { name: '按需整理为附件' })).toBeTruthy();
  });
 });

 it('智能编组快捷任务同时输出正文、搭配方案及比较表', async () => {
   const sid = useSessionStore.getState().ensureSessionForEvent(DEFAULT_EVENT_ID);
   render(<WorkspaceSync />);
   const id = await sendMessage(sid, { text: '智能编组推荐' });
   await expect.poll(() => useSessionStore.getState().tasks[id]?.status, { timeout: 5000 }).toBe('succeeded');
   const task = useSessionStore.getState().tasks[id];
   expect(task.textAnswer).toContain('任务与推荐约束');
   expect(task.textAnswer).toContain('道路');
   const artifact = task.artifacts.find(a => a.payload.kind === 'scenario_sections');
   if (artifact?.payload.kind !== 'scenario_sections') throw Error('missing grouping');
   const docId = artifact.payload.documentId;
   expect(artifact.payload.capability).toBe('group');
   expect(docId).toBeUndefined();
   expect(useWorkspaceStore.getState().scopes[sid]?.generating ?? false).toBe(false);
   render(<MemoryRouter><TaskCard task={task} onOpenDrawer={()=>{}} /></MemoryRouter>);
   expect(screen.getByText(/比较规则与推荐理由/)).toBeTruthy();
   expect(screen.getByRole('button', {name:'按需整理为附件'})).toBeTruthy();
 });
