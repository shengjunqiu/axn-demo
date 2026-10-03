/**
 * 文书渲染辅助（T-016）：为导出/打印提供冻结渲染。
 * 导出与打印必须使用用户选定的版本快照 + 该版本保存时的事实值。
 */
import type { DocumentRevision } from '@/domain/types';
import { flattenRuns } from './contentRuns';
import { templateByCode } from '@/seed/scenario';

export interface RenderedSection {
  sectionId: string;
  title: string;
  paragraphs: string[];
}

export interface RenderedDocument {
  title: string;
  templateName: string;
  version: string;
  contentHash: string;
  sections: RenderedSection[];
  footerNote: string;
  mockNotice: string;
}

export function renderRevision(rev: DocumentRevision): RenderedDocument {
  const c = rev.contentSnapshot;
  return {
    title: c.title,
    templateName: templateByCode.get(c.templateCode)?.name ?? c.templateCode,
    version: rev.displayVersion,
    contentHash: rev.contentHash,
    sections: c.sections.map((s) => ({
      sectionId: s.id,
      title: s.heading,
      paragraphs: s.paragraphs.map((p) =>
        flattenRuns(p.runs, { facts: rev.factsSnapshot ?? {}, derived: rev.factsSnapshot ?? {} }),
      ),
    })),
    footerNote: c.footerNote,
    mockNotice: '本文件由安小能导出，全部内容为模拟数据，不构成真实救援指令或正式公文。',
  };
}
