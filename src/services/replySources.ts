import { useMockDocumentStore } from '@/store/mockDocumentStore';
import type { AgentTask, ChatMessage } from '@/domain/types';
import { knowledgeById } from '@/seed/scenario';
import { disasterProfileById } from '@/seed/disasterScenarios';
import { resolveFact } from './factLookup';

export interface ReplySource { title: string; section: string; excerpt: string }
/** 保留实际产物引用；没有检索记录的对话只标注上下文，不虚构外部来源。 */
export function replySources(message: ChatMessage, task?: AgentTask, eventId?: string): ReplySource[] {
  const sources: ReplySource[] = [];
  for (const artifact of task?.artifacts ?? []) {
    const payload = artifact.payload;
    if (payload.kind === 'qa_knowledge') sources.push(...payload.sources);
    if (payload.kind === 'knowledge') for (const id of payload.chunkIds) {
      const chunk = knowledgeById.get(id);
      if (chunk) sources.push({ title: chunk.title, section: chunk.category, excerpt: chunk.sourceLabel });
    }
    if (payload.kind === 'summary' && payload.multiSource) for (const group of payload.multiSource.event.sources) {
      sources.push(...group.records.filter(record => !record.duplicateOf).map(record => ({ title: record.title, section: `${group.kind} · ${record.capturedAt}`, excerpt: `${record.source}：${record.content}` })));
    }
    if (payload.kind === 'summary') for (const row of payload.rows) {
      const fact = resolveFact(row.factId, { kind: 'event', eventId: payload.eventId });
      if (fact) sources.push({ title: fact.sourceLabel, section: `采集时间：${fact.capturedAt}`, excerpt: `${row.label}：${fact.value ?? '待确认'}${fact.unit ?? ''}（模拟记录）` });
    }
    if (payload.kind === 'scenario_sections') {
      const table = payload.tables?.find(item => item.title === '现场资料与来源核对表');
      if (table) sources.push(...table.rows.map(row => ({ title: row[2], section: `${row[0]} · ${row[3]}`, excerpt: row[1] })));
      else sources.push({ title: payload.title, section: `事件资料 · ${payload.dataTime}`, excerpt: '依据当前事件的本地演示资料与任务分析结果整理。' });
    }
  }
  if (message.regionalDisasters) for (const event of message.regionalDisasters.domainEvents) for (const group of event.sources) {
    sources.push(...group.records.filter(record => !record.duplicateOf).map(record => ({ title: record.title, section: `${event.title} · ${group.kind} · ${record.capturedAt}`, excerpt: `${record.source}：${record.content}` })));
  }
  if (message.multiSourceDetails) for (const group of message.multiSourceDetails.event.sources) {
    sources.push(...group.records.filter(record => !record.duplicateOf).map(record => ({ title: record.title, section: `${group.kind} · ${record.capturedAt}`, excerpt: `${record.source}：${record.content}` })));
  }
  const documentId = message.documentWorkflow?.documentId ?? message.reviewDocumentId ?? message.summaryOffer?.documentId ?? message.situationReportAuto?.documentId;
  const document = documentId ? useMockDocumentStore.getState().libraries[message.sessionId]?.documents.find(document => document.id === documentId) : undefined;
  if (document) sources.push({ title: document.title, section: `文书 · ${document.date}`, excerpt: document.sections.map(([title]) => title).join('；') });
  if (!sources.length) {
    const sourceEventId = task?.eventId ?? message.eventBriefingEventId ?? message.inlineSituation?.eventId ?? eventId;
    const profile = sourceEventId ? disasterProfileById.get(sourceEventId) : undefined;
    if (profile && (task || message.reviewSummary || message.regionalDisasters || message.eventBriefingEventId || message.rescuePlans || message.inlineSituation)) {
      sources.push({ title: profile.name, section: `事件资料 · ${profile.capturedAt}`, excerpt: `${profile.description}（本地模拟场景）` });
    } else {
      sources.push({ title: '当前对话与操作上下文', section: '交互说明', excerpt: '依据本轮提问、当前操作及原型预设流程作答，未引用外部检索资料。' });
    }
  }
  return [...new Map(sources.map(source => [`${source.title}|${source.section}|${source.excerpt}`, source])).values()];
}
