import { describe, expect, it } from 'vitest';
import { buildConstructionResult, resolveConstructionCapability } from '@/seed/constructionScenarios';
import { AGENT_MATERIAL_CODES } from '@/seed/mockDocuments';
import { constructionToMockSections } from '@/services/agentMaterialDocument';
import { RESOURCE_REPORT_TITLES } from '@/seed/documentTemplates';

describe('建设场景 · 资源管理能力', () => {
  it('洪涝决口：自然语言查资源给出本事件演示候选表', () => {
    const result = buildConstructionResult('search', 'evt-sim-breach', '查询事发周边封堵队伍、装备');
    expect(result.title).toContain('资源');
    expect(result.table?.rows.length).toBeGreaterThan(0);
    expect(result.table?.rows.some((row) => String(row[0]).includes('堤防') || String(row[0]).includes('封堵') || String(row[0]).includes('挖掘'))).toBe(true);
    expect(result.sections.map((s) => s.title)).toEqual(expect.arrayContaining(['检索条件', '查询说明', '待核字段']));
  });

  it('山体滑坡：填入本事件演示资源，不编造跨事件 ETA', () => {
    const result = buildConstructionResult('search', 'evt-sim-landslide', '查询周边救援资源');
    expect(result.title).toContain('资源');
    expect(result.table?.rows.length).toBeGreaterThan(0);
    expect(result.table?.rows.some((row) => String(row[0]).includes('青岭') || String(row[0]).includes('地质') || String(row[0]).includes('勘察'))).toBe(true);
    expect(result.sections.map((s) => s.title)).toEqual(expect.arrayContaining(['查询说明', '待核字段']));
  });

  it('下穿积水（evt-demo-002）：查询材料含本事件演示资源表，不套空文', () => {
    const result = buildConstructionResult('search', 'evt-demo-002', '查询周边救援资源');
    expect(result.table?.rows.some((row) => String(row[0]).includes('排涝'))).toBe(true);
    expect(AGENT_MATERIAL_CODES.search).toBe('RESOURCE_QUERY');
    const sections = constructionToMockSections(result);
    expect(sections.some(([heading, body]) => heading.includes('候选') && body.includes('|')))
      .toBe(true);
  });

  it('周边资源报告：一期七段结构且填入演示资源', () => {
    const result = buildConstructionResult('resourceReport', 'evt-demo-002', '生成周边资源报告');
    expect(result.title).toContain('周边资源分析报告');
    expect(result.sections.map((s) => s.title)).toEqual([...RESOURCE_REPORT_TITLES]);
    expect(result.sections[1]?.text).toContain('下穿排涝机动组');
    expect(AGENT_MATERIAL_CODES.resourceReport).toBe('RESOURCE_REPORT');
    const mock = constructionToMockSections(result);
    expect(mock.map(([heading]) => heading).filter((h) => h.startsWith('一、'))).toHaveLength(1);
    expect(mock.some(([heading]) => heading === '一、抢险基本信息')).toBe(true);
  });

  it('能力→文种映射：查询/核对/编组/总结不对号入座', () => {
    expect(AGENT_MATERIAL_CODES.search).toBe('RESOURCE_QUERY');
    expect(AGENT_MATERIAL_CODES.update).toBe('RESOURCE_STATUS');
    expect(AGENT_MATERIAL_CODES.group).toBe('RESCUE_PLAN');
    expect(AGENT_MATERIAL_CODES.summary).toBe('WORK_SUMMARY');
    expect(AGENT_MATERIAL_CODES.resourceReport).toBe('RESOURCE_REPORT');
  });

  it('意图识别：报告 / 状态核对 / 查询', () => {
    expect(resolveConstructionCapability('resource_query', '生成周边资源报告')).toBe('resourceReport');
    expect(resolveConstructionCapability('resource_query', '核对资源状态')).toBe('update');
    expect(resolveConstructionCapability('resource_query', '查询周边救援资源')).toBe('search');
  });

  it('建设场景报告正文含招标能力补齐（模拟·待接入）', () => {
    const situation = buildConstructionResult('situationReport', 'evt-sim-landslide', '生成态势报告');
    expect(situation.sections.map((s) => s.text).join('\n')).toMatch(/建议响应等级|预警推送/);

    const resource = buildConstructionResult('resourceReport', 'evt-sim-landslide', '生成周边资源报告');
    expect(resource.sections.map((s) => s.title)).toEqual([...RESOURCE_REPORT_TITLES]);
    expect(resource.sections.map((s) => s.text).join('\n')).toMatch(/物联网|多约束/);

    const plan = buildConstructionResult('plan', 'evt-sim-landslide', '生成救援方案');
    expect(plan.sections.map((s) => s.text).join('\n')).toContain('预案RAG');

    const deviation = buildConstructionResult('deviation', 'evt-sim-landslide', '分析投入偏差');
    expect(deviation.sections.map((s) => s.text).join('\n')).toContain('知识库迭代');
  });
});
