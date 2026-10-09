import { describe, expect, it } from 'vitest';
import { parsePipeTable, tableToText } from '@/services/pipeTable';
import { constructionToMockSections } from '@/services/agentMaterialDocument';
import { buildConstructionResult } from '@/seed/constructionScenarios';

describe('pipeTable', () => {
  it('往返保持表头与数据行', () => {
    const headers = ['指标', '最新样例', '观察时段', '来源'];
    const rows = [
      ['余震记录', '1 次', '09:00 / 10:00', '地震监测适配器（本地模拟）'],
      ['已核查建筑', '19 栋', '09:00 / 10:00', '地震监测适配器（本地模拟）'],
    ];
    expect(parsePipeTable(tableToText(headers, rows))).toEqual({ headers, rows });
  });

  it('普通正文不误判为表', () => {
    expect(parsePipeTable('按岚川县模拟地震搜救资料整理，关注余震与建筑坍塌。')).toBeNull();
    expect(parsePipeTable('仅一行 | 不够')).toBeNull();
  });

  it('周边资源报告的监测章节可解析为表格', () => {
    const result = buildConstructionResult('resourceReport', 'evt-sim-earthquake', '生成周边资源报告');
    const sections = constructionToMockSections(result);
    const monitoring = sections.find(([heading]) => heading.includes('专业监测数据'));
    expect(monitoring).toBeTruthy();
    const table = parsePipeTable(monitoring![1]);
    expect(table?.headers).toEqual(['指标', '最新样例', '观察时段', '来源']);
    expect(table!.rows.length).toBeGreaterThan(0);
  });

  it('已含一期序号的章节标题不再套一层中文序号', () => {
    const result = buildConstructionResult('resourceReport', 'evt-sim-earthquake', '生成周边资源报告');
    const headings = constructionToMockSections(result).map(([heading]) => heading);
    expect(headings).toContain('一、抢险基本信息');
    expect(headings).toContain('二、安能队伍情况');
    expect(headings.some((h) => /[一二三四五六七八九十]+、[一二三四五六七八九十]+、/.test(h))).toBe(false);
  });
});
