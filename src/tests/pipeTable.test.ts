import { describe, expect, it } from 'vitest';
import {
  parsePipeTable,
  slashResourcesToPipeTable,
  splitPipeContent,
  tableToText,
} from '@/services/pipeTable';
import { constructionToMockSections } from '@/services/agentMaterialDocument';
import { buildConstructionResult } from '@/seed/constructionScenarios';
import { personnelGroupingText } from '@/seed/documentTemplates';

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

  it('斜杠人装清单可转为管道表', () => {
    const table = slashResourcesToPipeTable(
      [
        '沟道工程抢险分队（模拟） / 24人 / 搜救与沟道勘察协同 / 候选待确认（模拟）',
        '履带挖掘机与装载机（模拟） / 4台 / 清障与运输 / 候选待确认（模拟）',
      ].join('\n'),
    );
    expect(parsePipeTable(table)?.headers).toEqual(['名称', '数量', '专业能力', '状态']);
    expect(parsePipeTable(table)?.rows).toHaveLength(2);
  });

  it('正文可拆出内嵌管道表', () => {
    const body = personnelGroupingText(
      '沟道工程抢险分队（模拟） / 24人 / 搜救与沟道勘察协同 / 候选待确认（模拟）',
    );
    const blocks = splitPipeContent(body);
    expect(blocks.some((block) => block.kind === 'text' && block.text.includes('专家技术组'))).toBe(true);
    const table = blocks.find((block) => block.kind === 'table');
    expect(table?.kind === 'table' && table.headers).toEqual(['名称', '数量', '专业能力', '状态']);
  });

  it('周边资源报告的监测章节可解析为表格', () => {
    const result = buildConstructionResult('resourceReport', 'evt-sim-landslide', '生成周边资源报告');
    const sections = constructionToMockSections(result);
    const monitoring = sections.find(([heading]) => heading.includes('专业监测数据'));
    expect(monitoring).toBeTruthy();
    const table = parsePipeTable(monitoring![1]);
    expect(table?.headers).toEqual(['指标', '最新样例', '观察时段', '来源']);
    expect(table!.rows.length).toBeGreaterThan(0);
  });

  it('已含一期序号的章节标题不再套一层中文序号', () => {
    const result = buildConstructionResult('resourceReport', 'evt-sim-landslide', '生成周边资源报告');
    const headings = constructionToMockSections(result).map(([heading]) => heading);
    expect(headings).toContain('一、抢险基本信息');
    expect(headings).toContain('二、安能队伍情况');
    expect(headings.some((h) => /[一二三四五六七八九十]+、[一二三四五六七八九十]+、/.test(h))).toBe(false);
  });
});
