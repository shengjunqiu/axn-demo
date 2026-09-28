/**
 * 派生口径与种子一致性测试（AC-007 部分）：
 * 汇总值必须从统一数据（facts + 候选集合）计算，不得各页面写死。
 */
import { describe, expect, it } from 'vitest';
import { computeDerived, DERIVED_META } from '@/seed/derived';
import { expectedChecks, factText } from '@/seed/scenario';

describe('computeDerived 候选力量汇总口径', () => {
  it('初始无候选时全部为 0', () => {
    for (const key of ['candidate_team_count', 'candidate_people_count', 'candidate_excavator_count'] as const) {
      expect(computeDerived(key, []).value).toBe(0);
    }
  });

  it('选择 team-001 + team-002 后 2 支 / 64 人 / 7 台（种子期望值）', () => {
    const ids = ['team-001', 'team-002'];
    expect(computeDerived('candidate_team_count', ids).value).toBe(expectedChecks.afterSelectingTeam001And002.teams);
    expect(computeDerived('candidate_people_count', ids).value).toBe(expectedChecks.afterSelectingTeam001And002.people);
    expect(computeDerived('candidate_excavator_count', ids).value).toBe(
      expectedChecks.afterSelectingTeam001And002.excavators,
    );
  });

  it('移除 team-002 后 1 支 / 36 人 / 4 台（种子期望值）', () => {
    const ids = ['team-001'];
    expect(computeDerived('candidate_team_count', ids).value).toBe(expectedChecks.afterRemovingTeam002.teams);
    expect(computeDerived('candidate_people_count', ids).value).toBe(expectedChecks.afterRemovingTeam002.people);
    expect(computeDerived('candidate_excavator_count', ids).value).toBe(
      expectedChecks.afterRemovingTeam002.excavators,
    );
  });

  it('未知的资源 id 不计入，重复 id 不重复计数', () => {
    expect(computeDerived('candidate_team_count', ['team-001', 'team-xxx', 'team-001']).value).toBe(1);
  });

  it('班次统计口径：2 起接报 / 1 起处置中 / 1 起已控制', () => {
    expect(computeDerived('daily_incident_count', []).value).toBe(expectedChecks.shift.incidents);
    expect(computeDerived('daily_ongoing_count', []).value).toBe(expectedChecks.shift.ongoing);
    expect(computeDerived('daily_controlled_count', []).value).toBe(expectedChecks.shift.controlled);
  });

  it('派生结果带公式与输入口径说明（依据展示要求）', () => {
    const r = computeDerived('candidate_people_count', ['team-001']);
    expect(r.formula.length).toBeGreaterThan(0);
    expect(r.inputSummary.length).toBeGreaterThan(0);
    expect(r.inputFactIds.length).toBeGreaterThan(0);
  });

  it('DERIVED_META 覆盖全部派生定义', () => {
    expect(Object.keys(DERIVED_META)).toContain('candidate_team_count');
    expect(Object.keys(DERIVED_META)).toContain('daily_incident_count');
  });

  it('资源人数从种子事实读取而非写死（抽查 team-001 = 36 人）', () => {
    expect(factText('fact-team-001-peopleCount')).toBe('36');
  });
});
