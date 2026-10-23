import { Timeline } from 'antd';
import { InlineFlag } from '@/components/common/ChatPrimitives';
import type { EventTimelineItem } from '@/services/eventTimeline';
import './event-timeline.css';

/** 与控件规范页一致，按原记录顺序呈现时间、事件和状态。 */
export default function EventTimelineList({ items }: { items: EventTimelineItem[] }) {
  return <Timeline className="axn-event-timeline" items={items.map((item, index) => ({
    key: `${item.time}-${index}`,
    color: item.tone === 'done' ? 'green' : item.tone === 'active' ? 'blue' : 'gray',
    title: item.time,
    content: <><div className="axn-event-timeline-title"><strong>{item.title}</strong><InlineFlag tone={item.tone === 'pending' ? 'warn' : 'info'}>{item.tone === 'done' ? '已完成' : item.tone === 'active' ? '进行中' : '待办'}</InlineFlag></div><p>{item.detail}</p></>,
  }))} />;
}

export function isEventTimelineTable(headers: string[]) {
  return ['时间节点', '环节', '记录详情', '状态'].every(label => headers.includes(label));
}
export function timelineItemsFromTable(headers: string[], rows: string[][]): EventTimelineItem[] {
  return rows.map(row => ({
    time: row[headers.indexOf('时间节点')] ?? '',
    title: row[headers.indexOf('环节')] ?? '',
    detail: row[headers.indexOf('记录详情')] ?? '',
    tone: /^(已完成|完成)$/.test(row[headers.indexOf('状态')] ?? '') ? 'done' : /进行|执行/.test(row[headers.indexOf('状态')] ?? '') ? 'active' : 'pending',
  }));
}
