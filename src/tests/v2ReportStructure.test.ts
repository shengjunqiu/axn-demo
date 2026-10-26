import { expect, it } from 'vitest';
import { V2_REPORT_STRUCTURE, groupReportSections } from '@/pages/v2/reportStructure';
import { assemblyReportSections, planReportSections, surroundingsReportSections } from '@/services/embeddedResourceReport';
import { dynamicsAiSections, transportAiSections, summaryAiSections } from '@/pages/v2/additionalAiData';
import { PLAN_SECTIONS } from '@/pages/v2/planData';
import { buildDisasterSections } from '@/seed/documentTemplates';
import { DISASTER_PROFILES } from '@/seed/disasterScenarios';
it('V2六类输出目录一致，合并不丢失风险、时间口径与补录项', () => {
  const outputs = { surroundings: surroundingsReportSections(), assembly: assemblyReportSections(), plan: planReportSections(), dynamics: dynamicsAiSections(), transport: transportAiSections(), summary: summaryAiSections() };
  for (const kind of Object.keys(outputs) as (keyof typeof outputs)[]) expect(outputs[kind].map(s => s[0])).toEqual(V2_REPORT_STRUCTURE[kind].titles);
  expect(PLAN_SECTIONS.map(s => s[0])).toEqual(V2_REPORT_STRUCTURE.plan.titles);
  for (const profile of DISASTER_PROFILES) expect(buildDisasterSections(profile, 'RESCUE_PLAN').map(s => s[0])).toEqual(V2_REPORT_STRUCTURE.plan.titles);
  expect(outputs.plan[4][1]).toContain('停工撤离阈值');
  expect(outputs.transport[2][1]).toContain('出发时间未知');
  expect(outputs.transport[3][1]).toContain('未执行导航规划');
  expect(outputs.summary[3][1]).toContain('复盘补录清单');
  expect(outputs.surroundings[2][1]).toContain('不按零值统计');
});
it('拒绝遗漏原正文的目录映射', () => {
  expect(() => groupReportSections('assembly', [['一、原文', '必须保留']], [[], [], []])).toThrow('映射不完整');
});
