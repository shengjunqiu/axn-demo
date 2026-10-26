import { startEmbeddedSuppliesAudit } from '@/services/embeddedSuppliesAudit';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import qa from '@/pages/v2/embeddedQa.json';
import { V2_REPORT_KINDS } from '@/pages/v2/aiNodes';
import { generateEmbeddedResourceReport, generateEmbeddedAssemblyReport, generateEmbeddedPlanReport, generateEmbeddedAdditionalReport } from '@/services/embeddedResourceReport';
import { replyEmbeddedQa, embeddedQaKind, embeddedStageChoices, embeddedChoiceAttachment } from '@/services/embeddedQa';
import { useSessionStore } from '@/store/sessionStore';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useConversationStore } from '@/store/conversationStore';

beforeEach(() => {
  vi.useFakeTimers();
  useSessionStore.getState().resetAll();
  useMockDocumentStore.setState({ libraries: {} });
});
afterEach(() => vi.useRealTimers());

describe('V2嵌套问答', () => {
  it('物资核验直接对话、去重并追问，不生成文书或串用其他节点', () => {
    const before = Object.keys(useConversationStore.getState().conversations).length;
    startEmbeddedSuppliesAudit('supplies-qa-test');
    startEmbeddedSuppliesAudit('supplies-qa-test');
    expect(Object.keys(useConversationStore.getState().conversations)).toHaveLength(before + 1);
    const cid = useConversationStore.getState().activeConversationId!;
    const sid = useSessionStore.getState().sessionByConversation[cid];
    const messages = () => useSessionStore.getState().sessions[sid].messages;
    const supplySession = useSessionStore.getState().sessions[sid];
    expect(embeddedQaKind(supplySession, 'v2-supplies')).toBe('supplies');
    expect(embeddedStageChoices('supplies')[0].options.map(item => item.prompt)).toEqual(qa.supplies.items.map(item => item.question));
    expect(embeddedChoiceAttachment('supplies', supplySession).content).toContain('饮用水');
    expect(messages().some(message => message.text?.includes('已登记5类物资'))).toBe(true);
    expect(messages().some(message => message.documentWorkflow)).toBe(false);
    for (const item of qa.supplies.items) {
      expect(replyEmbeddedQa(sid, 'v2-supplies', item.question)).toBe(true);
      expect(messages().at(-1)?.text).toContain(item.answer);
    }
    replyEmbeddedQa(sid, 'v2-supplies', '继续');
    expect(messages().at(-1)?.text).toContain(qa.supplies.items[0].answer);
    replyEmbeddedQa(sid, 'v2-supplies', '数据来源是什么？');
    expect(messages().at(-1)?.text).toContain('遂川县');
    expect(messages().at(-1)?.text).not.toContain('青岭村');
    replyEmbeddedQa(sid, 'v2-supplies', '如何修改报告？');
    expect(messages().at(-1)?.text).toContain('不生成文书');
    replyEmbeddedQa(sid, 'v2-supplies', '我补充：库存100件');
    expect(messages().at(-1)?.text).toContain('不会自动解析附件或修改原台账');
    expect(replyEmbeddedQa(sid, 'v2-plan', '数据来源是什么？')).toBe(false);
    expect(Object.keys(useMockDocumentStore.getState().libraries)).toHaveLength(0);
  });
  it.each(V2_REPORT_KINDS)('%s使用对应资料回答并支持继续追问', async kind => {
    const run = kind === 'surroundings' ? generateEmbeddedResourceReport('qa-resource')
      : kind === 'assembly' ? generateEmbeddedAssemblyReport('qa-assembly')
      : kind === 'plan' ? generateEmbeddedPlanReport('qa-plan')
      : generateEmbeddedAdditionalReport(kind, `qa-${kind}`);
    await vi.runAllTimersAsync();
    await run;
    const cid = useConversationStore.getState().activeConversationId!;
    const sid = useSessionStore.getState().sessionByConversation[cid];
    const latest = () => useSessionStore.getState().sessions[sid].messages.at(-1)!.text;
    const node = qa[kind];
    const currentSession = useSessionStore.getState().sessions[sid];
    expect(currentSession.eventId).toMatch(/^evt-blank-/);
    expect(embeddedQaKind(currentSession, `v2-${kind}`)).toBe(kind);
    expect(embeddedQaKind(currentSession, null)).toBeNull();
    expect(embeddedQaKind(undefined, `v2-${kind}`)).toBeNull();
    const picker = embeddedStageChoices(kind);
    expect(picker[0].options.map(item => item.prompt)).toEqual(node.items.map(item => item.question));
    expect(picker[1].options.some(item => item.kind === 'file')).toBe(true);
    const attachment = embeddedChoiceAttachment(kind, currentSession);
    expect(attachment.eventId).toBe(currentSession.eventId);
    expect(attachment.content).toContain('遂川县');
    expect(attachment.content).not.toContain('青岭村');
    expect(latest()).toContain(node.items[0].question);
    for (const item of node.items) {
      expect(replyEmbeddedQa(sid, `v2-${kind}`, item.question)).toBe(true);
      expect(latest()).toContain(item.answer);
      expect(latest()).toContain(item.next);
    }
    replyEmbeddedQa(sid, `v2-${kind}`, '继续');
    expect(latest()).toContain(node.items[0].answer);
    replyEmbeddedQa(sid, `v2-${kind}`, '月球轨道周期');
    expect(latest()).toContain('暂未覆盖');
    replyEmbeddedQa(sid, `v2-${kind}`, '这份报告的数据来源是什么？');
    expect(latest()).toContain('遂川县');
    expect(latest()).toContain(node.source);
    expect(latest()).not.toContain('青岭村');
    replyEmbeddedQa(sid, `v2-${kind}`, '我补充：已新增100人');
    expect(latest()).toContain('待核');
    expect(replyEmbeddedQa(sid, null, node.items[0].question)).toBe(false);
    const another = V2_REPORT_KINDS.find(other => other !== kind)!;
    expect(replyEmbeddedQa(sid, `v2-${another}`, node.items[0].question)).toBe(false);
    const body = kind === 'assembly'
      ? currentSession.messages.find(m => m.documentWorkflow)?.documentWorkflow?.reportSections?.map(s => s[1]).join('\n')
      : useMockDocumentStore.getState().libraries[sid].documents[0].sections.map(s => s[1]).join('\n');
    expect(body).not.toContain('已新增100人');
  });
});
