import { expect, it } from 'vitest';
import { SELECTABLE_DISASTER_PROFILES } from '@/seed/disasterScenarios';
import { buildConstructionResult } from '@/seed/constructionScenarios';
import { constructionToMockSections } from '@/services/agentMaterialDocument';
import { parseRichHtml, serializeRichDom } from '@/services/richText';

it('全部灾种的报告与方案：结构化内容转为表格，单元格编辑往返完整', () => {
  let tables = 0;
  for (const profile of SELECTABLE_DISASTER_PROFILES) {
    for (const capability of ['situationReport', 'resourceReport', 'plan', 'group', 'summary'] as const) {
      const result = buildConstructionResult(capability, profile.eventId, '生成报告');
      for (const [heading, body] of constructionToMockSections(result)) {
        const host = document.createElement('div');
        host.appendChild(parseRichHtml(body));
        const label = `${profile.eventId}/${capability}/${heading}`;
        for (const p of host.querySelectorAll('p')) {
          expect(p.textContent, label).not.toMatch(/\S\s+\|\s+\S/);
          expect(p.textContent, label).not.toMatch(/\s\/\s.*\s\/\s.*候选待确认/);
        }
        for (const table of host.querySelectorAll('table')) {
          tables += 1;
          const width = table.querySelectorAll('thead th').length;
          for (const row of table.querySelectorAll('tbody tr')) expect(row.children.length, label).toBe(width);
        }
        const restored = document.createElement('div');
        restored.appendChild(parseRichHtml(serializeRichDom(host)));
        expect(restored.textContent, label).toBe(host.textContent);
        expect(restored.querySelectorAll('table').length, label).toBe(host.querySelectorAll('table').length);
      }
    }
  }
  expect(tables).toBeGreaterThan(100);
});
