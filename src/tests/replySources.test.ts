import { expect, it } from 'vitest';
import { replySources } from '@/services/replySources';
import type { ChatMessage, AgentTask } from '@/domain/types';
const message: ChatMessage = { messageId: 'reply', sessionId: 'session', role: 'assistant', kind: 'text', text: '好的', taskId: null, createdAt: '', performedAt: '' };
it('普通回复注明对话上下文，不虚构检索来源', () => {
  expect(replySources(message)[0].excerpt).toContain('未引用外部检索资料');
});
it('知识问答复用真实引用并去重', () => {
  const source = { docId: 'doc', title: '参考预案', section: '第三节', excerpt: '原文依据', simulated: true };
  const task = { artifacts: [{ payload: { kind: 'qa_knowledge', sources: [source, source] } }] } as unknown as AgentTask;
  expect(replySources(message, task)).toHaveLength(1);
  expect(replySources(message, task)[0].excerpt).toBe('原文依据');
});
it('模拟分析显示所属事件资料与采集时间', () => {
  const sources = replySources({ ...message, reviewSummary: { conclusion: '模拟分析', rows: [] } }, undefined, 'evt-sim-landslide');
  expect(sources[0].title).toContain('青岭村');
  expect(sources[0].section).toContain('事件资料');
});
