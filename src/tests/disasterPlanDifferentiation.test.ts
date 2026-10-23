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
  it('三类均有主战法章节与关键监测读数', () => {
    for (const p of DISASTER_PROFILES) {
      const tactic = disasterTacticSection(p);
      expect(tactic?.[0]).toContain('主战法');
      expect(tactic?.[1].length).toBeGreaterThan(20);
      expect(disasterKeyReadings(p).length).toBeGreaterThanOrEqual(3);
      expect(p.planSections.length).toBeGreaterThanOrEqual(6);
    }
  });

  it('洪涝决口、山体滑坡、泥石流方案正文战法与监测字段互不串用', () => {
    const breach = DISASTER_PROFILES.find((p) => p.category.includes('洪涝决口'))!;
    const landslide = DISASTER_PROFILES.find((p) => p.category.includes('山体滑坡'))!;
    const debris = DISASTER_PROFILES.find((p) => p.category.includes('泥石流'))!;

    const breachPlan = buildDisasterSections(breach, 'RESCUE_PLAN').map((s) => s[1]).join('\n');
    const landslidePlan = buildDisasterSections(landslide, 'RESCUE_PLAN').map((s) => s[1]).join('\n');
    const debrisPlan = buildDisasterSections(debris, 'RESCUE_PLAN').map((s) => s[1]).join('\n');

    expect(breachPlan).toMatch(/立堵|合龙|裹头|决口/);
    expect(breachPlan).toContain('决口宽度');
    expect(landslidePlan).toMatch(/滑坡|清坡|支护|监测/);
    expect(landslidePlan).toContain('坡体累计位移');
    expect(debrisPlan).toMatch(/泥石流|清障|沟道/);

    expect(breachPlan).not.toContain('坡体累计位移');
    expect(landslidePlan).not.toContain('决口宽度');
  });

  it('生成救援方案任务摘要带出本灾种主战法', () => {
    const debris = DISASTER_PROFILES.find((p) => p.category.includes('泥石流'))!;
    const result = buildConstructionResult('plan', debris.eventId);
    expect(result.summary).toMatch(/主战法|泥石流|清障|沟道/);
    expect(result.sections.some((s) => /泥石流|清障|沟道/.test(s.text))).toBe(true);
  });
});
