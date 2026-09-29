import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createElement } from 'react';
import { act, cleanup, fireEvent, render } from '@testing-library/react';
import KnowledgePanel from '@/components/workspace/KnowledgePanel';
import ResourcePanel from '@/components/workspace/ResourcePanel';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { useDocumentStore } from '@/store/documentStore';
import { sendMessage } from '@/services/taskRunner';
import { recognize } from '@/services/mock/provider';
import { createEventDocument } from '@/services/documentFactory';
import { computeDerived } from '@/seed/derived';
import { factText, knowledgeById, teamById } from '@/seed/scenario';
import type { DocumentDraft } from '@/domain/types';

const A = 'evt-demo-001';
const B = 'evt-demo-002';
let sid: string;
const session = () => useSessionStore.getState().sessions[sid];
const totals = () => ['candidate_team_count', 'candidate_people_count', 'candidate_excavator_count'].map(
  (key) => computeDerived(key as Parameters<typeof computeDerived>[0], session().candidateResourceIds).value,
);
async function chat(text: string) {
  const id = await sendMessage(sid, { text });
  await vi.runAllTimersAsync();
  const task = useSessionStore.getState().tasks[id];
  expect(task.status).toBe('succeeded');
  return task;
}
function document() {
  useDemoStore.getState().addManualFact({ field: 'reportingUnit', value: '演示应急办公室', scopeKind: 'event', scopeId: session().eventId, actorId: useDemoStore.getState().actorId });
  const result = createEventDocument(sid);
  expect(result.ok).toBe(true);
  return useDocumentStore.getState().drafts[result.documentId!];
}
function textOf(draft: DocumentDraft) {
  return draft.working.content.sections.flatMap((s) => s.paragraphs).flatMap((p) => p.runs).map((r) => {
    if (r.type === 'text') return r.text;
    if (r.type === 'fact') return `${draft.snapshot.facts[r.factId]?.value}${r.suffix ?? ''}`;
    if (r.type === 'derived') return `${draft.snapshot.derived[r.derivedKey]?.value}${r.suffix ?? ''}`;
    return r.label;
  }).join('');
}
async function proposal() {
  const task = await chat('给我处置建议');
  const artifact = task.artifacts.find((a) => a.payload.kind === 'proposal')!;
  if (artifact.payload.kind !== 'proposal') throw new Error('proposal missing');
  return useSessionStore.getState().proposals[artifact.payload.proposalId];
}

beforeEach(() => {
  useSessionStore.getState().resetAll();
  useDemoStore.getState().setPace('fast');
  sid = useSessionStore.getState().ensureSessionForEvent(A);
  vi.useFakeTimers();
});
afterEach(async () => {
  cleanup();
  useSessionStore.getState().resetAll();
  await vi.runAllTimersAsync();
  vi.useRealTimers();
});

describe('D05 candidate → proposal → document', () => {
  it.each(['周边有哪些可以调动的专业救援力量？', '查可调队伍', '查询周边救援资源'])(
    'baseline resource request executes the query: %s', async (text) => {
      expect(recognize(text, { lastResourceResultIds: [], candidateResourceIds: [] }).intent).toBe('resource_query');
      await chat(text);
      expect(session().lastResourceResultIds).toEqual(['team-001', 'team-002', 'warehouse-001', 'warehouse-002']);
      expect(session().candidateResourceIds).toEqual([]);
    },
  );

  it('idempotent chat and store mutations preserve the adopted proposal', async () => {
    await chat('查询周边救援资源');
    await chat('把前两支加入候选');
    const p = await proposal();
    useSessionStore.getState().selectProposal(sid, p.proposalId);
    const check = () => {
      expect(session().selectedProposalId).toBe(p.proposalId);
      expect(session().selectedProposalVersion).toBe(p.version);
      expect(totals()).toEqual([2, 64, 7]);
    };
    useSessionStore.getState().addCandidates(sid, ['team-001', 'team-002']);
    check();
    useSessionStore.getState().removeCandidate(sid, 'team-003');
    check();
    await chat('把前两支加入候选');
    check();
    await chat('移除 team-003');
    check();
    await chat('加入 team-003 候选');
    check();
  });

  it('chat add/remove commits the same candidates as mouse, with real totals and idempotent repeats', async () => {
    expect(totals()).toEqual([0, 0, 0]);
    await chat('查询周边救援资源');
    const added = await chat('把前两支加入候选');
    expect(totals()).toEqual([2, 64, 7]);
    expect(added.textAnswer).toContain('64 人、7 台');
    await chat('把前两支加入候选');
    expect(session().candidateResourceIds).toEqual(['team-001', 'team-002']);
    const removed = await chat('移除第二支');
    expect(totals()).toEqual([1, 36, 4]);
    expect(removed.textAnswer).toContain('36 人、4 台');
    await chat('移除 team-002');
    expect(totals()).toEqual([1, 36, 4]);
    useSessionStore.getState().toggleCandidate(sid, 'team-002');
    expect(totals()).toEqual([2, 64, 7]);
    useSessionStore.getState().removeCandidate(sid, 'team-002');
    expect(totals()).toEqual([1, 36, 4]);
  });

  it('busy and unauthorized teams never produce a successful candidate addition', async () => {
    const busy = await chat('加入 team-003 候选');
    expect(totals()).toEqual([0, 0, 0]);
    expect(busy.textAnswer).toContain('未加入');
    useSessionStore.getState().toggleCandidate(sid, 'team-003');
    expect(session().candidateResourceIds).toEqual([]);
    useDemoStore.getState().switchEvent(B);
    sid = useSessionStore.getState().ensureSessionForEvent(B);
    const denied = await chat('加入 team-001 候选');
    expect(denied.textAnswer).toContain('未加入');
    expect(session().candidateResourceIds).toEqual([]);
    useSessionStore.getState().addCandidates(sid, ['team-001', 'team-002']);
    expect(session().candidateResourceIds).toEqual([]);
  });

  it('sorting writes the shared ordered result used by follow-up selection', async () => {
    await chat('查询周边救援资源');
    useSessionStore.getState().setLastResourceResult(sid, ['team-002', 'team-001', 'warehouse-001'], null);
    await chat('按到达时间排序');
    expect(session().lastResourceResultIds).toEqual(['team-001', 'team-002', 'warehouse-001']);
    await chat('把前两支加入候选');
    expect(session().candidateResourceIds).toEqual(['team-001', 'team-002']);
    await chat('按距离排序');
    expect(session().lastResourceResultIds).toEqual(['team-001', 'team-002', 'warehouse-001']);
  });

  it('mouse sorting and selection use the shared results; busy teams and warehouses are disabled with reasons', async () => {
    useSessionStore.getState().setLastResourceResult(sid, ['team-002', 'team-001', 'team-003', 'warehouse-001'], null);
    const view = render(createElement(ResourcePanel));
    fireEvent.click(view.getByRole('button', { name: '按 ETA' }));
    expect(session().lastResourceResultIds.slice(0, 2)).toEqual(['team-001', 'team-002']);
    const renderedIds = () => [...view.container.querySelectorAll('tr[data-row-key]')].map((row) => row.getAttribute('data-row-key'));
    expect(renderedIds()).toEqual(session().lastResourceResultIds);
    const boxes = view.getAllByRole('checkbox') as HTMLInputElement[];
    expect(boxes.filter((box) => box.disabled)).toHaveLength(2);
    expect(boxes.filter((box) => box.disabled).map((box) => box.getAttribute('aria-description'))).toEqual([
      '队伍当前不可调派', '仓库为物资储备，不能加入候选救援队伍',
    ]);
    fireEvent.click(view.getByRole('checkbox', { name: `选择 ${factText(teamById.get('team-001')!.factRefs.name)} 加入候选` }));
    expect(totals()).toEqual([1, 36, 4]);
    await act(async () => { await chat('把前两支加入候选'); });
    expect(totals()).toEqual([2, 64, 7]);
    act(() => useSessionStore.getState().setLastResourceResult(sid, ['team-002', 'team-001', 'warehouse-001'], null));
    expect(renderedIds()).toEqual(['team-002', 'team-001', 'warehouse-001']);
    await act(async () => { await chat('按距离排序'); });
    expect(renderedIds()).toEqual(session().lastResourceResultIds);
    expect(renderedIds()).toEqual(['team-001', 'team-002', 'warehouse-001']);
  });

  it('candidate mutation uses the latest store when mouse selection changes during execution', async () => {
    await chat('查询周边救援资源');
    const id = await sendMessage(sid, { text: '加入 team-001 候选' });
    await vi.advanceTimersByTimeAsync(140);
    useSessionStore.getState().toggleCandidate(sid, 'team-002');
    await vi.runAllTimersAsync();
    expect(totals()).toEqual([2, 64, 7]);
    expect(useSessionStore.getState().tasks[id].textAnswer).toContain('64 人、7 台');
    const removeId = await sendMessage(sid, { text: '移除 team-001' });
    await vi.advanceTimersByTimeAsync(140);
    useSessionStore.getState().removeCandidate(sid, 'team-002');
    await vi.runAllTimersAsync();
    expect(totals()).toEqual([0, 0, 0]);
    expect(useSessionStore.getState().tasks[removeId].textAnswer).toContain('0 人、0 台');
  });

  it('proposal reads candidates again at final assembly and references actual Map knowledge', async () => {
    useSessionStore.getState().addCandidates(sid, ['team-001', 'team-002']);
    const id = await sendMessage(sid, { text: '给我处置建议' });
    await vi.advanceTimersByTimeAsync(280);
    useSessionStore.getState().removeCandidate(sid, 'team-002');
    await vi.runAllTimersAsync();
    expect(useSessionStore.getState().tasks[id].status).toBe('succeeded');
    const p = Object.values(useSessionStore.getState().proposals)[0];
    expect(p.candidateIds).toEqual(['team-001']);
    expect(p.sections.find((s) => s.id === 'resources')?.bindingResourceIds).toEqual(['team-001']);
    expect(p.knowledgeRefs).toEqual([...knowledgeById.keys()]);
    expect(p.knowledgeRefs.length).toBeGreaterThan(0);
  });

  it('selected proposal content, version, knowledge, team identities and derived values reach one document', async () => {
    await chat('查询周边救援资源');
    await chat('把前两支加入候选');
    await chat('移除第二支');
    const p = await proposal();
    useSessionStore.getState().selectProposal(sid, p.proposalId);
    const draft = document();
    const text = textOf(draft);
    expect(draft.snapshot.candidateResourceIds).toEqual(['team-001']);
    expect(draft.snapshot.selectedProposalId).toBe(p.proposalId);
    expect(draft.snapshot.selectedProposalVersion).toBe(p.version);
    expect(draft.snapshot.knowledgeChunkIds).toEqual(p.knowledgeRefs);
    expect(text).toContain(factText(teamById.get('team-001')!.factRefs.name));
    expect(text).not.toContain(factText(teamById.get('team-002')!.factRefs.name));
    expect(text).toContain('合计 1 支，合计人员 36 人、挖掘机 4 台');
    expect(text).toContain(`版本 ${p.version}`);
    for (const section of p.sections) expect(text).toContain(section.text);
    for (const id of p.knowledgeRefs) expect(text).toContain(knowledgeById.get(id)!.content);
  });

  it('unselected or outdated proposal never becomes document context; old advice is visibly stale', async () => {
    useSessionStore.getState().addCandidates(sid, ['team-001', 'team-002']);
    const p = await proposal();
    const unselected = document();
    expect(unselected.snapshot.selectedProposalId).toBeNull();
    expect(unselected.snapshot.knowledgeChunkIds).toEqual([]);
    expect(textOf(unselected)).not.toContain('已采纳建议');
    useSessionStore.getState().selectProposal(sid, p.proposalId);
    const view = render(createElement(KnowledgePanel));
    expect(view.getByText('已采纳')).toBeTruthy();
    act(() => useSessionStore.getState().removeCandidate(sid, 'team-002'));
    expect(session().selectedProposalId).toBeNull();
    act(() => useSessionStore.getState().selectProposal(sid, p.proposalId));
    expect(session().selectedProposalId).toBeNull();
    // 注：renderToStaticMarkup 属 SSR 渲染器，zustand v5 在 SSR 下返回 getInitialState() 快照，
    // 看不到 setState 后的状态；此处必须用客户端 render（testing-library）才能断言真实 Store 状态。
    const html = view.container.innerHTML;
    expect(html).toContain('候选已变化 · 建议过期');
    expect(html).toContain('重新生成建议');
    expect(html).not.toContain('已采纳</span>');
    expect((view.getByRole('button', { name: '采纳为当前建议' }) as HTMLButtonElement).disabled).toBe(true);
    expect(view.getByText(factText(teamById.get('team-002')!.factRefs.name))).toBeTruthy();
    const draft = document();
    expect(draft.snapshot.selectedProposalId).toBeNull();
    expect(draft.snapshot.derived.candidate_people_count.value).toBe(36);
    expect(textOf(draft)).not.toContain('已采纳建议');
  });
});
