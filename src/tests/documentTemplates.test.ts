import { describe, expect, it } from 'vitest';
import {
  DUTY_DAILY_TITLES,
  EMERGENCY_BRIEF_TITLES,
  RESCUE_EVAL_TITLES,
  RESCUE_PLAN_TITLES,
  RESOURCE_REPORT_TITLES,
  SITUATION_REPORT_TITLES,
  WORK_SUMMARY_REFLECT_TITLES,
  WORK_SUMMARY_TEMPLATE_TITLES,
  buildDisasterSections,
  skeletonPlaceholders,
} from '@/seed/documentTemplates';
import { DISASTER_PROFILES } from '@/seed/disasterScenarios';

describe('documentTemplates 一期骨架顺序', () => {
  it('各文书标题常量顺序固定', () => {
    expect([...RESOURCE_REPORT_TITLES]).toEqual([
      '一、抢险基本信息',
      '二、安能队伍情况',
      '三、其他央企队伍情况',
      '四、安能装备情况',
      '五、其他央企装备情况',
      '六、重点防护目标情况',
      '七、范围与数据核验',
    ]);
    expect([...RESCUE_PLAN_TITLES]).toEqual([
      '一、基本情况',
      '二、任务受领与力量抽组',
      '三、指挥机构',
      '四、主要措施',
      '五、风险困难与附件落款',
    ]);
    expect([...SITUATION_REPORT_TITLES]).toEqual([
      '一、灾情概况',
      '二、安全态势与发展关注',
      '三、队伍与人员状态时效',
      '四、安全场所与医疗资源核查',
    ]);
    expect([...EMERGENCY_BRIEF_TITLES]).toHaveLength(5);
    expect([...DUTY_DAILY_TITLES]).toHaveLength(4);
    expect([...WORK_SUMMARY_TEMPLATE_TITLES]).toEqual([
      '一、基本情况',
      '二、主要经验做法',
      '三、深刻启示',
      '四、下一步工作打算',
    ]);
    expect([...WORK_SUMMARY_REFLECT_TITLES]).toEqual([
      '一、实际处置过程',
      '二、处置方案',
      '三、存在不足',
      '四、下一步改进计划',
    ]);
    expect([...RESCUE_EVAL_TITLES]).toHaveLength(4);
  });

  it('skeletonPlaceholders 仅保留标题齐套（不用于生成回落）', () => {
    for (const code of ['RESOURCE_REPORT', 'RESCUE_PLAN', 'SITUATION_REPORT', 'EMERGENCY_BRIEF', 'WORK_SUMMARY', 'RESCUE_EVAL'] as const) {
      const sections = skeletonPlaceholders(code);
      expect(sections.length).toBeGreaterThan(0);
      expect(sections.every(([title]) => title.length > 0)).toBe(true);
    }
  });

  it('buildDisasterSections 对样例 profile 产出与标题常量一致的顺序', () => {
    const profile = DISASTER_PROFILES[1];
    expect(buildDisasterSections(profile, 'RESOURCE_REPORT').map(([t]) => t)).toEqual([...RESOURCE_REPORT_TITLES]);
    expect(buildDisasterSections(profile, 'RESCUE_PLAN').map(([t]) => t)).toEqual([...RESCUE_PLAN_TITLES]);
    expect(buildDisasterSections(profile, 'WORK_SUMMARY_REFLECT').map(([t]) => t)).toEqual([...WORK_SUMMARY_REFLECT_TITLES]);
  });

  it('十类灾种资源报告七段、处置方案含任务受领与主要措施，非水灾无管涌措辞', () => {
    const nonWater = new Set([
      'evt-sim-earthquake',
      'evt-sim-landslide',
      'evt-sim-debris',
      'evt-sim-snow',
      'evt-sim-mine',
      'evt-sim-power',
    ]);
    for (const profile of DISASTER_PROFILES) {
      const resource = buildDisasterSections(profile, 'RESOURCE_REPORT');
      expect(resource.map(([t]) => t)).toEqual([...RESOURCE_REPORT_TITLES]);
      expect(resource.map(([, b]) => b).join('\n')).toContain(profile.name);
      expect(resource.map(([, b]) => b).join('\n')).toContain('半年');

      const situation = buildDisasterSections(profile, 'SITUATION_REPORT');
      const situationBody = situation.map(([, b]) => b).join('\n');
      expect(situationBody).toMatch(/100\s*公里|百公里/);
      expect(situationBody).toContain('专家组');

      const plan = buildDisasterSections(profile, 'RESCUE_PLAN');
      const titles = plan.map(([t]) => t);
      expect(titles).toContain('二、任务受领与力量抽组');
      expect(titles).toContain('四、主要措施');
      expect(titles).toContain('五、风险困难与附件落款');
      const body = plan.map(([, b]) => b).join('\n');
      expect(body).toMatch(/救援基本条件/);
      expect(body).toMatch(/战法/);
      expect(body).toMatch(/安全预警/);
      expect(body).toMatch(/案例库/);
      expect(body).toMatch(/先遣组/);
      expect(body).toMatch(/人员编组/);
      expect(body).toMatch(/集结号令/);
      expect(body).toMatch(/应急通信指挥链条/);
      if (nonWater.has(profile.eventId)) {
        expect(body).not.toMatch(/管涌|围井反滤/);
      }
    }
  });
});
