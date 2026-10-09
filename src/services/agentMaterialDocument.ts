/**
 * 将四智能体建设场景结果物化为红头 MockDocument，复用右侧文书工作区展示链路。
 */
import type { ConstructionCapability, ConstructionResult } from '@/seed/constructionScenarios';
import { AGENT_MATERIAL_CODES, type MockDocument } from '@/seed/mockDocuments';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { tableToText } from '@/services/pipeTable';

const CN_INDEX = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十', '十一', '十二'];
/** 已带一期骨架序号（如「一、抢险基本信息」）的标题，物化时不再套一层「四、一、…」。 */
const NUMBERED_HEADING = /^[一二三四五六七八九十百千]+、/;

export function constructionToMockSections(result: ConstructionResult): MockDocument['sections'] {
  const sections: [string, string][] = [];
  let index = 0;
  const push = (title: string, text: string) => {
    const trimmed = title.trim();
    // 一期骨架序号或「附表：」标题保持原样，避免再套「一、附表…」。
    if (NUMBERED_HEADING.test(trimmed) || trimmed.startsWith('附表')) {
      sections.push([trimmed, text]);
      return;
    }
    const heading = `${CN_INDEX[index] ?? String(index + 1)}、${trimmed}`;
    index += 1;
    sections.push([heading, text]);
  };

  // 已按一期骨架编号的章节（如周边资源报告七段）不再套「概述」以免出现双「一、」。
  const templated = result.sections.some((section) => NUMBERED_HEADING.test(section.title.trim()));
  if (!templated) push('概述', result.summary);
  if (result.table) {
    push(templated ? '附表：队伍与人员状态时效' : '候选资源一览', tableToText(result.table.headers, result.table.rows));
  }
  for (const table of result.tables ?? []) {
    push(table.title.startsWith('附表') || NUMBERED_HEADING.test(table.title) ? table.title : templated ? `附表：${table.title}` : table.title, tableToText(table.headers, table.rows));
  }
  for (const section of result.sections) {
    push(section.title, section.text);
  }
  if (templated) sections.push(['说明', result.notice]);
  else push('说明', result.notice);
  return sections;
}

export function publishConstructionMaterial(
  sessionId: string,
  capability: ConstructionCapability,
  result: ConstructionResult,
): MockDocument | null {
  const code = AGENT_MATERIAL_CODES[capability];
  if (!code) return null;
  return useMockDocumentStore.getState().publishAgentMaterial(sessionId, {
    code,
    title: `${result.title}（模拟）`,
    sections: constructionToMockSections(result),
  });
}
