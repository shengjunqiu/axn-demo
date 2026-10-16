import { beforeEach, describe, expect, it } from 'vitest';
import { buildPlanRevisionBasis, formatPlanRevisionHints } from '@/services/planRevisionBasis';
import { formatTimelineForDocument } from '@/services/eventTimeline';
import { useKnowledgeCaseStore } from '@/services/knowledgePublish';
import { resolveDocumentSections } from '@/seed/resolveDocumentSections';
import { buildDisasterSections } from '@/seed/documentTemplates';
import { disasterProfileById } from '@/seed/disasterScenarios';

describe('预案编修依据', () => {
  it('输出力量/时间节点/分工/风险四维条目', () => {
    const items = buildPlanRevisionBasis('evt-demo-001', '阶段性总结：堤防加固完成大半');
    expect(items).toHaveLength(4);
    expect(items.map((i) => i.dimension)).toEqual(['力量', '时间节点', '任务分工', '风险措施']);
    for (const item of items) {
      expect(item.planExcerpt.length).toBeGreaterThan(0);
      expect(item.actualExcerpt.length).toBeGreaterThan(0);
      expect(item.gap.length).toBeGreaterThan(0);
      expect(item.revisionHint).toMatch(/编修/);
      expect(item.verified).toBe('draft');
    }
    const hints = formatPlanRevisionHints(items);
    expect(hints).toContain('【力量】');
    expect(hints).toContain('编修依据');
  });
});

describe('抢险总结时间轴注入', () => {
  it('formatTimelineForDocument 含过程时间轴标题与管道表', () => {
    const text = formatTimelineForDocument('evt-demo-001');
    expect(text).toContain('过程时间轴（模拟）');
    expect(text).toContain('序号 | 时间节点 | 环节 | 记录详情 | 状态');
    expect(text).toMatch(/\|/);
  });

  it('WORK_SUMMARY / REFLECT 章节含过程时间轴', () => {
    for (const code of ['WORK_SUMMARY', 'WORK_SUMMARY_REFLECT'] as const) {
      const sections = resolveDocumentSections('evt-demo-001', code);
      const first = sections[0]?.[1] ?? '';
      expect(first).toContain('过程时间轴（模拟）');
      expect(first).toMatch(/\d{2}:\d{2}|接报|当前/);
    }
  });

  it('documentTemplates 全面/反思总结首节含时间轴', () => {
    const profile = disasterProfileById.get('evt-sim-landslide');
    expect(profile).toBeTruthy();
    const full = buildDisasterSections(profile!, 'WORK_SUMMARY');
    const reflect = buildDisasterSections(profile!, 'WORK_SUMMARY_REFLECT');
    expect(full[0]?.[1] ?? '').toContain('过程时间轴');
    expect(reflect[0]?.[1] ?? '').toContain('过程时间轴');
  });
});

describe('知识沉淀入库（模拟）', () => {
  beforeEach(() => {
    useKnowledgeCaseStore.getState().resetAll();
  });

  it('publishEventCase 写入待审并可审批为已入库', () => {
    const created = useKnowledgeCaseStore.getState().publishEventCase({
      eventId: 'evt-demo-001',
      source: 'evaluation',
      body: '评估案例正文（模拟）',
      tags: ['效果评估'],
    });
    expect(created.status).toBe('待审');
    expect(useKnowledgeCaseStore.getState().pendingBodyForEvent('evt-demo-001')).toContain('评估案例');
    useKnowledgeCaseStore.getState().approveCase(created.id);
    const listed = useKnowledgeCaseStore.getState().casesForEvent('evt-demo-001');
    expect(listed[0]?.status).toBe('已入库（模拟）');
  });

  it('同事件同来源待审条目会被更新而非重复堆叠', () => {
    useKnowledgeCaseStore.getState().publishEventCase({
      eventId: 'evt-demo-001',
      source: 'summary',
      body: '初稿',
    });
    useKnowledgeCaseStore.getState().publishEventCase({
      eventId: 'evt-demo-001',
      source: 'summary',
      body: '修订稿',
      status: '已入库（模拟）',
    });
    const cases = useKnowledgeCaseStore.getState().casesForEvent('evt-demo-001');
    expect(cases).toHaveLength(1);
    expect(cases[0]?.body).toBe('修订稿');
    expect(cases[0]?.status).toBe('已入库（模拟）');
  });
});
