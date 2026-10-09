/**
 * 事件过程时间轴：建设场景用 Vue 元数据节点；主演示事件用水情观测序列。
 * 全部为模拟过程记录，不接真实监测推送。
 */
import { factText, incidentById, waterObservations } from '@/seed/scenario';
import { vueWorkspaceEventById } from '@/seed/vueWorkspaceEvents';
import { eventDisplayName, formatFactValue } from '@/services/factLookup';

export interface EventTimelineItem {
  time: string;
  title: string;
  detail: string;
  tone: 'done' | 'active' | 'pending';
}

export interface EventTimelineView {
  eventId: string;
  eventName: string;
  stageLabel: string;
  items: EventTimelineItem[];
  notice: string;
}

function formatClock(isoOrText: string): string {
  const match = isoOrText.match(/T(\d{2}:\d{2})/);
  if (match) return match[1];
  if (/^\d{2}:\d{2}/.test(isoOrText)) return isoOrText.slice(0, 5);
  return isoOrText;
}

/** 组装当前事件可展示的过程时间轴。 */
export function buildEventTimeline(eventId: string): EventTimelineView {
  const vue = vueWorkspaceEventById.get(eventId);
  const incident = incidentById.get(eventId);
  const eventName = eventDisplayName(eventId);
  const notice = '时间轴为模拟过程记录；监测读数、到场回执与正式结论须由值班与专业岗位核对。';

  if (vue?.timeline?.length) {
    return {
      eventId,
      eventName,
      stageLabel: vue.stage,
      items: vue.timeline.map((item) => ({
        time: item.time,
        title: item.title,
        detail: item.detail,
        tone: item.tone ?? 'done',
      })),
      notice,
    };
  }

  const items: EventTimelineItem[] = [];
  if (incident) {
    const occurredAt = factText(incident.factRefs.occurredAt);
    const control = formatFactValue(factText(incident.factRefs.controlStatus) || 'ongoing', null, 'controlStatus');
    items.push({
      time: formatClock(occurredAt) || '接报',
      title: '事件接报',
      detail: `${factText(incident.factRefs.incidentDescription) || eventName}（模拟）`,
      tone: 'done',
    });

    // 主演示事件：按站点观测序列展开水位过程（仅当前事件绑定的站点观测）。
    if (eventId === 'evt-demo-001') {
      const obs = [...waterObservations].sort((a, b) => a.observationId.localeCompare(b.observationId));
      for (const [index, row] of obs.entries()) {
        const at = factText(row.factRefs.observedAt);
        const level = factText(row.factRefs.waterLevel);
        items.push({
          time: formatClock(at) || row.observationId,
          title: '水位监测',
          detail: `演示水文站水位 ${level || '—'} 米（模拟快照）`,
          tone: index === obs.length - 1 ? 'active' : 'done',
        });
      }
    }

    items.push({
      time: '当前',
      title: '处置状态',
      detail: `控制状态：${control}；人员与影响范围以事实库待核实字段为准`,
      tone: control.includes('已控制') ? 'done' : 'active',
    });
  } else {
    items.push({
      time: '—',
      title: '暂无过程节点',
      detail: '当前事件缺少授权演示资料，无法展开时间轴。',
      tone: 'pending',
    });
  }

  return {
    eventId,
    eventName,
    stageLabel: vue?.stage ?? (incident ? '处置跟踪' : '未关联'),
    items,
    notice,
  };
}
