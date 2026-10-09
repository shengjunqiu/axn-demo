import { describe, expect, it } from 'vitest';
import { buildConstructionResult, resolveConstructionCapability } from '@/seed/constructionScenarios';
import { AGENT_MATERIAL_CODES } from '@/seed/mockDocuments';
import { constructionToMockSections } from '@/services/agentMaterialDocument';
import { RESOURCE_REPORT_TITLES } from '@/seed/documentTemplates';

describe('建设场景 · 资源管理能力', () => {
  it('武陵大道内涝：自然语言查资源给出演示候选表', () => {
    const result = buildConstructionResult('search', 'evt-vue-nl08', '查询事发周边能够排涝的队伍、装备');
    expect(result.title).toBe('本事件资源查询');
    expect(result.table?.rows.some((row) => String(row[0]).includes('排涝'))).toBe(true);
    expect(result.sections.map((s) => s.title)).toEqual(expect.arrayContaining(['检索条件', '查询说明', '待核字段']));
  });

  it('其他建设场景事件：填入本事件演示资源，不编造跨事件 ETA', () => {
    const result = buildConstructionResult('search', 'evt-vue-nd01', '查询周边救援资源');
    expect(result.title).toBe('本事件资源查询');
    expect(result.table?.rows.length).toBeGreaterThan(0);
    expect(result.table?.rows.some((row) => String(row[0]).includes('南堤'))).toBe(true);
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
});
