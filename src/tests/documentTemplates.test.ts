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
      '一、灾情基本情况',
      '二、任务和救援目标',
      '三、救援组织与力量编成',
      '四、救援行动安排',
      '五、安全与保障措施',
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

  it('三类实战灾种资源报告七段、处置方案含任务受领与主要措施，非水灾无管涌措辞', () => {
    const nonWater = new Set([
      'evt-sim-landslide',
      'evt-sim-debris',
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
      expect(titles).toContain('二、任务和救援目标');
      expect(titles).toContain('四、救援行动安排');
      expect(titles).toContain('五、安全与保障措施');
      const body = plan.map(([, b]) => b).join('\n');
      expect(body).toMatch(/救援基本条件/);
      expect(body).toMatch(/战法/);
      expect(body).toMatch(/安全预警/);
      expect(body).toMatch(/案例库/);
      expect(body).toMatch(/先遣组/);
      expect(body).toMatch(/专家技术组/);
      expect(body).toMatch(/人员编组/);
      expect(body).toMatch(/抽组人员清单/);
      expect(body).toMatch(/名称 \| 数量 \| 专业能力 \| 状态/);
      expect(body).toMatch(/集结号令/);
      expect(body).toMatch(/应急通信指挥链条/);
      if (nonWater.has(profile.eventId)) {
        expect(body).not.toMatch(/管涌|围井反滤/);
      }
    }
  });

  it('态势报告四章瘦身且含灾种监测侧重；其他报告仍写入招标补齐', () => {
    const profile = DISASTER_PROFILES[1];
    const situation = buildDisasterSections(profile, 'SITUATION_REPORT');
    expect(situation.map(([t]) => t)).toEqual([...SITUATION_REPORT_TITLES]);
    const situationBody = situation.map(([, b]) => b).join('\n');
    expect(situationBody).toContain('灾种关键监测');
    expect(situationBody).toContain('六源汇聚');
    expect(situationBody).toContain('态势地图');
    expect(situationBody).toMatch(/决口|水位|封堵|雨量|位移|裂缝/);

    const resource = buildDisasterSections(profile, 'RESOURCE_REPORT');
    expect(resource.map(([t]) => t)).toEqual([...RESOURCE_REPORT_TITLES]);
    const resourceBody = resource.map(([, b]) => b).join('\n');
    expect(resourceBody).toContain('物联网');
    expect(resourceBody).toContain('多约束');
    expect(resourceBody).toMatch(/破拆/);

    const plan = buildDisasterSections(profile, 'RESCUE_PLAN');
    expect(plan.map(([t]) => t)).toEqual([...RESCUE_PLAN_TITLES]);
    const planBody = plan.map(([, b]) => b).join('\n');
    expect(planBody).toContain('预案RAG');
    expect(planBody).toContain('安全红线');

    const evalDoc = buildDisasterSections(profile, 'RESCUE_EVAL');
    expect(evalDoc.map(([t]) => t)).toEqual([...RESCUE_EVAL_TITLES]);
    const evalBody = evalDoc.map(([, b]) => b).join('\n');
    expect(evalBody).toContain('知识库迭代');
    expect(evalBody).toContain('时间序列比对');

    const reflect = buildDisasterSections(profile, 'WORK_SUMMARY_REFLECT');
    expect(reflect.map(([t]) => t)).toEqual([...WORK_SUMMARY_REFLECT_TITLES]);
    expect(reflect.map(([, b]) => b).join('\n')).toContain('知识库迭代');
  });
});
