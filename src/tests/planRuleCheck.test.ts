/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { checkPlanRules, hasRuleConflict, ruleDimensionLabel } from '@/services/planRuleCheck';

describe('planRuleCheck', () => {
  it('缺安全与合规依据时返回不足或冲突', () => {
    const hits = checkPlanRules({
      revision: '调整作业面',
      basis: '口头反馈',
      risks: '涉水触电、地下空间进水',
      gaps: '排水能力缺口',
    });
    expect(hits).toHaveLength(3);
    expect(hits.map((h) => h.dimension).sort()).toEqual(['compliance', 'feasibility', 'safety']);
    expect(hasRuleConflict(hits) || hits.some((h) => h.status === 'insufficient')).toBe(true);
    expect(ruleDimensionLabel('safety')).toBe('安全');
  });

  it('写明撤离、增援与预案版本可通过三类校验', () => {
    const hits = checkPlanRules({
      revision: '增援一组排涝车到位，扩大警戒并组织撤离',
      basis: '引用内涝预案 V2 条款 3.2，版本已核对',
      risks: '涉水触电',
      gaps: '装备缺口已替补',
    });
    expect(hits.every((h) => h.status === 'pass')).toBe(true);
    expect(hasRuleConflict(hits)).toBe(false);
  });
});
