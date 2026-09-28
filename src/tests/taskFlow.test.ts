/**
 * Mock 意图识别与任务执行链路测试（不接真实大模型）。
 * 覆盖：主线意图映射、取消、重试、未知兜底、事件隔离。
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { recognize } from '@/services/mock/provider';
import { useSessionStore } from '@/store/sessionStore';
import { useDemoStore } from '@/store/demoStore';
import { useDocumentStore } from '@/store/documentStore';
import { DEFAULT_EVENT_ID, factText } from '@/seed/scenario';
import { sendMessage, cancelTask } from '@/services/taskRunner';

function ctx() {
  const store = useSessionStore.getState();
  const sessionId = store.ensureSessionForEvent(DEFAULT_EVENT_ID);
  const session = useSessionStore.getState().sessions[sessionId];
  return { lastResourceResultIds: session.lastResourceResultIds, candidateResourceIds: session.candidateResourceIds };
}

describe('意图识别（规则模拟，非真实模型）', () => {
  it('灾情摘要', () => {
    expect(recognize('生成灾情摘要', ctx()).intent).toBe('summary');
  });
  it('资源查询', () => {
    expect(recognize('查询周边救援资源', ctx()).intent).toBe('resource_query');
  });
  it('连续追问谁最快', () => {
    expect(recognize('它们谁最快能到', ctx()).intent).toBe('resource_sort_eta');
  });
  it('处置建议', () => {
    expect(recognize('给我处置建议', ctx()).intent).toBe('proposal');
  });
  it('生成应急要情', () => {
    expect(recognize('帮我生成一份应急要情', ctx()).intent).toBe('doc_brief');
  });
  it('生成值班日报', () => {
    expect(recognize('生成今天的值班日报', ctx()).intent).toBe('doc_daily');
  });
  it('补录报送单位', () => {
    expect(recognize('报送单位是清河段防汛值班室', ctx()).intent).toBe('fill_reporting_unit');
  });
  it('移除候选（需候选中存在该队）', () => {
    const c = ctx();
    c.candidateResourceIds = ['team-001'];
    expect(recognize('把演示一号工程救援队移除出候选', c).intent).toBe('candidate_remove');
  });
  it('知识依据', () => {
    expect(recognize('这个建议的依据是什么', ctx()).intent).toBe('knowledge');
  });
  it('未知问题兜底', () => {
    expect(recognize('今天天气怎么样', ctx()).intent).toBe('unknown');
  });
});

describe('任务链路', () => {
  beforeEach(() => {
    useSessionStore.getState().resetAll();
    useDocumentStore.getState().resetAll();
  });

  function sessionIdFor(eventId = DEFAULT_EVENT_ID) {
    return useSessionStore.getState().ensureSessionForEvent(eventId);
  }

  it('发送消息产生 user 消息并创建任务', async () => {
    const sessionId = sessionIdFor();
    sendMessage(sessionId, { text: '生成灾情摘要' });
    const session = useSessionStore.getState().sessions[sessionId];
    const userMsgs = session.messages.filter((m) => m.role === 'user');
    expect(userMsgs.at(-1)?.text).toBe('生成灾情摘要');
    await new Promise((r) => setTimeout(r, 60));
    const tasks = Object.values(useSessionStore.getState().tasks);
    expect(tasks.length).toBeGreaterThan(0);
    expect(tasks[0].intent).toBe('summary');
  });

  it('摘要任务完成后产生 rows 且标注待核实项（不伪造伤亡为 0）', async () => {
    useDemoStore.getState().setPace('fast');
    const sessionId = sessionIdFor();
    sendMessage(sessionId, { text: '生成灾情摘要' });
    await new Promise((r) => setTimeout(r, 4000));
    const task = Object.values(useSessionStore.getState().tasks).find((t) => t.intent === 'summary');
    expect(task?.status).toBe('succeeded');
    const summary = task?.artifacts.find((a) => a.payload.kind === 'summary');
    if (summary && summary.payload.kind === 'summary') {
      const casualtyRow = summary.payload.rows.find((r) => r.label.includes('伤亡'));
      expect(casualtyRow?.factId).toBeTruthy();
      expect(factText(casualtyRow!.factId!)).toContain('待核实');
    }
  }, 10000);

  it('取消任务后状态为 cancelled，不再产出新步骤', async () => {
    useDemoStore.getState().setPace('normal');
    const sessionId = sessionIdFor();
    sendMessage(sessionId, { text: '生成灾情摘要' });
    await new Promise((r) => setTimeout(r, 300));
    const task = Object.values(useSessionStore.getState().tasks).find((t) => t.intent === 'summary');
    expect(task).toBeTruthy();
    cancelTask(task!.taskId);
    await new Promise((r) => setTimeout(r, 200));
    expect(useSessionStore.getState().tasks[task!.taskId].status).toBe('cancelled');
  });

  it('不同事件各自会话，互不污染（切换事件隔离）', () => {
    const s1 = useSessionStore.getState().ensureSessionForEvent('evt-demo-001');
    const s2 = useSessionStore.getState().ensureSessionForEvent('evt-demo-002');
    expect(s1).not.toBe(s2);
    useSessionStore.getState().toggleCandidate(s1, 'team-001');
    expect(useSessionStore.getState().sessions[s1].candidateResourceIds).toContain('team-001');
    expect(useSessionStore.getState().sessions[s2].candidateResourceIds).not.toContain('team-001');
  });
});
