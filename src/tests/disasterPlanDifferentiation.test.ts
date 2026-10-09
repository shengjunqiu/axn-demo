/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import {
  DISASTER_PROFILES,
  disasterKeyReadings,
  disasterTacticSection,
} from '@/seed/disasterScenarios';
import { buildDisasterSections } from '@/seed/documentTemplates';
import { buildConstructionResult } from '@/seed/constructionScenarios';

describe('分灾种方案与监测差异', () => {
  it('十类均有主战法章节与关键监测读数', () => {
    for (const p of DISASTER_PROFILES) {
      const tactic = disasterTacticSection(p);
      expect(tactic?.[0]).toContain('主战法');
      expect(tactic?.[1].length).toBeGreaterThan(20);
      expect(disasterKeyReadings(p).length).toBeGreaterThanOrEqual(3);
      expect(p.planSections.length).toBeGreaterThanOrEqual(6);
    }
  });

  it('洪涝、决口、堰塞湖方案正文战法与监测字段互不串用', () => {
    const flood = DISASTER_PROFILES.find((p) => p.category.includes('洪涝'))!;
    const breach = DISASTER_PROFILES.find((p) => p.category.includes('决口'))!;
    const lake = DISASTER_PROFILES.find((p) => p.category.includes('堰塞湖'))!;

    const floodPlan = buildDisasterSections(flood, 'RESCUE_PLAN').map((s) => s[1]).join('\n');
    const breachPlan = buildDisasterSections(breach, 'RESCUE_PLAN').map((s) => s[1]).join('\n');
    const lakePlan = buildDisasterSections(lake, 'RESCUE_PLAN').map((s) => s[1]).join('\n');

    expect(floodPlan).toMatch(/排水|内涝|抽排/);
    expect(floodPlan).toContain('积水深度');
    expect(breachPlan).toMatch(/立堵|合龙|裹头/);
    expect(breachPlan).toContain('决口宽度');
    expect(lakePlan).toMatch(/泄流|导流|堰塞/);
    expect(lakePlan).toContain('湖水位');

    expect(floodPlan).not.toContain('决口宽度');
    expect(breachPlan).not.toContain('积水深度');
    expect(lakePlan).not.toContain('决口宽度');
  });

  it('生成救援方案任务摘要带出本灾种主战法', () => {
    const lake = DISASTER_PROFILES.find((p) => p.category.includes('堰塞湖'))!;
    const result = buildConstructionResult('plan', lake.eventId);
    expect(result.summary).toMatch(/主战法|泄流|导流|堰塞/);
    expect(result.sections.some((s) => s.text.includes('泄流') || s.text.includes('导流'))).toBe(true);
  });
});
