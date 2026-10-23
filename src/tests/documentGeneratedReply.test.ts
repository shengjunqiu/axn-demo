import { describe, expect, it } from 'vitest';
import { documentGeneratedReply, glanceFromSections, sanitizeGlance } from '@/services/documentGeneratedReply';
import { buildConstructionGlanceSummary, buildConstructionResult } from '@/seed/constructionScenarios';

describe('documentGeneratedReply', () => {
  it('统一生成完成回复文案', () => {
    expect(documentGeneratedReply('工程救援处置方案初稿（模拟）')).toBe(
      '已生成《工程救援处置方案初稿（模拟）》，右侧可查看。',
    );
  });

  it('空标题回落为未命名文书', () => {
    expect(documentGeneratedReply('  ')).toBe('已生成《未命名文书》，右侧可查看。');
  });

  it('附带速览时便于岗位扫读', () => {
    const text = documentGeneratedReply('资源智能检索（模拟）', '共找到 3 处（队伍1、装备1、医院1）。');
    expect(text).toContain('已生成《资源智能检索（模拟）》');
    expect(text).toContain('速览：共找到 3 处');
  });

  it('sanitizeGlance 去掉时间戳与台账话', () => {
    const dirty =
      '待核 3 条；资料时间 2026-10-08T11:30:00+08:00。台账常见维护周期最长约半年；过期快照不直接出动。';
    const clean = sanitizeGlance(dirty);
    expect(clean).not.toMatch(/2026-10-08|T11:30|台账|快照/);
  });
});

describe('建设结果内容速览', () => {
  it('周边资源查询只讲数量分布与名单位置', () => {
    const result = buildConstructionResult('search', 'evt-sim-landslide', '查询周边救援资源');
    const glance = buildConstructionGlanceSummary(result);
    expect(glance).toMatch(/共找到 \d+ 处/);
    expect(glance).toMatch(/队伍|装备|医院|物资/);
    expect(glance).not.toMatch(/台账|快照|资料时间|\d{4}-\d{2}-\d{2}T/);
  });

  it('状态核对速览口语短句，不含时间戳', () => {
    const result = buildConstructionResult('update', 'evt-sim-landslide', '核对资源状态');
    const glance = buildConstructionGlanceSummary(result);
    expect(glance).toMatch(/要核对|核对/);
    expect(glance).not.toMatch(/台账|快照|资料时间|\d{4}-\d{2}-\d{2}T|LEDGER/);
    expect(glance.length).toBeLessThan(120);
  });

  it('态势报告速览含灾情或风险，不含技术元数据', () => {
    const result = buildConstructionResult('situationReport', 'evt-sim-breach');
    const glance = buildConstructionGlanceSummary(result);
    expect(glance.length).toBeGreaterThan(10);
    expect(glance).toMatch(/灾情|风险|态势|详情/);
    expect(glance).not.toMatch(/台账|快照|\d{4}-\d{2}-\d{2}T/);
  });

  it('glanceFromSections 抽取前两节要点', () => {
    const glance = glanceFromSections([
      ['一、基本情况', '青岭村山体滑坡，受影响范围待核。'],
      ['二、先期处置', '先遣组已到场开展勘察。'],
    ]);
    expect(glance).toContain('基本情况');
    expect(glance).toContain('先遣组');
    expect(glance).toContain('详情看右侧');
  });
});
