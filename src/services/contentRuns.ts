/**
 * 内容运行级工具（无 store 依赖，供 documentFactory / documentStore / 渲染共用）。
 */
import type { DocumentContent, InlineRun } from '@/domain/types';

export function collectRunFactIds(content: DocumentContent): string[] {
  const ids: string[] = [];
  for (const section of content.sections) {
    for (const p of section.paragraphs) {
      for (const run of p.runs) {
        if (run.type === 'fact') ids.push(run.factId);
      }
    }
  }
  return ids;
}

export function collectRunDerivedKeys(content: DocumentContent): string[] {
  const keys: string[] = [];
  for (const section of content.sections) {
    for (const p of section.paragraphs) {
      for (const run of p.runs) {
        if (run.type === 'derived') keys.push(run.derivedKey);
      }
    }
  }
  return keys;
}

/** 将 runs 扁平为展示文本；facts/derived 由调用方提供冻结值。 */
export function flattenRuns(
  runs: InlineRun[],
  opts: { facts: Record<string, string>; derived: Record<string, string> },
): string {
  let out = '';
  for (const run of runs) {
    switch (run.type) {
      case 'text':
        out += run.text;
        break;
      case 'fact':
        out += `${opts.facts[run.factId] ?? '（来源缺失）'}${run.suffix ?? ''}`;
        break;
      case 'derived':
        out += `${opts.derived[run.derivedKey] ?? '（重算中）'}${run.suffix ?? ''}`;
        break;
      case 'knowledge':
        out += run.label;
        break;
      default:
        break;
    }
  }
  return out;
}
