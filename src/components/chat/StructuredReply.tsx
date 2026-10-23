import EventTimelineList, { isEventTimelineTable, timelineItemsFromTable } from './EventTimelineList';
import { Fragment } from 'react';
import './agent-results.css';
import { KvTable, NumberedSteps, Section } from '@/components/common/ChatPrimitives';

/** 保留原文顺序与所有事实；只将标题、列表与管道表转换为规范组件，不推导新结论。 */
export default function StructuredReply({ text }: { text: string }) {
  const lines = text.split('\n');
  const content = [];
  for (let i = 0; i < lines.length;) {
    const line = lines[i].trim();
    if (!line) { i++; continue; }
    if (line.includes('|') && i + 1 < lines.length && lines[i + 1].includes('|')) {
      const cells = (value: string) => value.trim().replace(/^\||\|$/g, '').split('|').map(cell => cell.trim());
      const headers = cells(line);
      const rows = [];
      i++;
      while (i < lines.length && lines[i].includes('|')) {
        const row = cells(lines[i++]);
        if (row.every(cell => /^:?-{2,}:?$/.test(cell))) continue;
        rows.push(row);
      }
      if (isEventTimelineTable(headers)) {
        content.push(<EventTimelineList key={`timeline-${i}`} items={timelineItemsFromTable(headers, rows)} />);
        continue;
      }
      content.push(<div key={`table-${i}`} className="axn-structured-records">{rows.map((row, index) => <KvTable key={index} rows={Array.from({ length: Math.max(headers.length, row.length) }, (_, col) => ({ label: headers[col] ?? `补充字段${col + 1}`, value: row[col] ?? '—' }))} />)}</div>);
      continue;
    }
    const heading = line.match(/^(?:#{1,4}\s+(.+)|【(.+)】$|([一二三四五六七八九十]+、.+))$/);
    if (heading) {
      content.push(<Section key={`heading-${i}`} title={heading[1] ?? heading[2] ?? heading[3]}><></></Section>);
      i++; continue;
    }
    if (/^\d+[.、）)]\s*/.test(line)) {
      const items = [];
      while (i < lines.length && /^\d+[.、）)]\s*/.test(lines[i].trim())) {
        const value = lines[i++].trim().replace(/^\d+[.、）)]\s*/, '');
        const colon = value.indexOf('：');
        items.push({ title: colon >= 0 ? value.slice(0, colon) : value, text: colon >= 0 ? value.slice(colon + 1) : '' });
      }
      content.push(<NumberedSteps key={`steps-${i}`} summary={{ label: '事项', value: `${items.length} 项` }} items={items} />);
      continue;
    }
    content.push(<p key={`line-${i++}`}>{line}</p>);
  }
  return <div className="axn-structured-reply">{content.map((node, i) => <Fragment key={i}>{node}</Fragment>)}</div>;
}
