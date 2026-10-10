import { describe, expect, it } from 'vitest';
import { isRedheadSubhead, splitRedheadParagraphs } from '@/components/doc/redheadBody';

describe('redheadBody 分段', () => {
  it('按换行拆成多段，空行不产生空段落', () => {
    const paras = splitRedheadParagraphs('甲行\n乙行\n\n丙行');
    expect(paras).toEqual(['甲行', '乙行', '丙行']);
  });

  it('识别节内小标题与编号', () => {
    expect(isRedheadSubhead('（一）救援基本条件与侦测依据')).toBe(true);
    expect(isRedheadSubhead('1. 侦测处置分队（先遣组）：负责现场侦测')).toBe(true);
    expect(isRedheadSubhead('人员编组建议（演示·待原系统锁定）：')).toBe(true);
    expect(isRedheadSubhead('道路通行、作业展开面待核。')).toBe(false);
  });

  it('处置方案样例正文不会压成单段', () => {
    const body = [
      '南湾堤段模拟决口（模拟）',
      '灾种：堤防决口',
      '地点：南湾堤段 K6+400',
      '（一）救援基本条件与侦测依据',
      '先遣组侦测处置：研究上级通报、与地方对接。',
      '（三）人装编组与料源',
      '1. 侦测处置分队（先遣组）：负责现场侦测。',
    ].join('\n');
    const paras = splitRedheadParagraphs(body);
    expect(paras.length).toBeGreaterThanOrEqual(6);
    expect(paras.some((p) => isRedheadSubhead(p))).toBe(true);
  });
});
