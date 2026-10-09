import { describe, expect, it } from 'vitest';
import { buildChatMaterialSummary, buildConstructionResult } from '@/seed/constructionScenarios';
import { recognize } from '@/services/mock/provider';
import { disasterProfileById } from '@/seed/disasterScenarios';

describe('聊天材料摘要与阶段提问意图', () => {
  it('协调类提问产出短摘要，含类别与演示资源名，提示看右侧文书', () => {
    const eventId = 'evt-sim-earthquake';
    const profile = disasterProfileById.get(eventId)!;
    const prompt =
      '请结合本事件记录整理处置建议，列出现场技术、安全和保障协调事项，供业务岗位核对。';
    const result = buildConstructionResult('plan', eventId, prompt);
    const summary = buildChatMaterialSummary(result, prompt);
    expect(summary.length).toBeLessThan(900);
    expect(summary).toMatch(/协调|待核/);
    expect(summary).toContain('右侧文书');
    expect(summary).toContain(profile.category);
    expect(summary).toContain(profile.resources[1].name);
    // 不应整段粘贴「一、基本情况」长文；允许在要点短摘中出现章节名
    expect(summary.split('\n\n').length).toBeLessThanOrEqual(4);
  });

  it('阶段提问：协调事项 / 修订 / 要情 意图对齐', () => {
    const ctx = { lastResourceResultIds: [] as string[], candidateResourceIds: [] as string[] };
    const coord = recognize(
      '请结合本事件记录整理处置建议，列出现场技术、安全和保障协调事项，供业务岗位核对。',
      ctx,
    );
    expect(coord.intent).toBe('proposal');
    expect(coord.displayTitle).toBe('整理协调事项');
    expect(coord.params.focus).toBe('coordination');

    const revise = recognize(
      '现场反馈：作业条件需要重新核实，请整理处置方案修订建议，说明影响章节和安全条件。',
      ctx,
    );
    expect(revise.intent).toBe('proposal');
    expect(revise.params.capability).toBe('revise');

    const brief = recognize(
      '现场进展：人员装备到场记录已登记，作业成效和安全检测回执待核。请整理阶段要情初稿。',
      ctx,
    );
    expect(brief.intent).toBe('doc_brief');
  });
});
