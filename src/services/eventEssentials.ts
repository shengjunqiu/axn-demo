import { incidentById } from '@/seed/scenario';
import { disasterProfileById } from '@/seed/disasterScenarios';
import { vueWorkspaceEventById } from '@/seed/vueWorkspaceEvents';
import { factDisplay, resolveFact } from './factLookup';

export function eventEssentials(eventId: string): string {
  const incident = incidentById.get(eventId);
  if (!incident) return '未关联有效事件，关键要素待补充。';
  const scope = { kind: 'event' as const, eventId };
  const refs = incident.factRefs;
  const value = (id: string) => factDisplay(id, scope) || '待核实';
  const confirmed = resolveFact(refs.confirmedResponseLevel, scope);
  const response = confirmed?.verification === 'confirmed'
    ? `${value(refs.confirmedResponseLevel)}（已确认）`
    : `${value(refs.confirmedResponseLevel)}（待核实，未确认启动）`;
  const suggestedId = incident.situationFactRefs.suggestedResponseLevel;
  const suggested = resolveFact(suggestedId, scope);
  const profile = disasterProfileById.get(eventId);
  const vue = vueWorkspaceEventById.get(eventId);
  const resources = profile ? profile.resources.map(r => `${r.name} ${r.amount}，${r.status}`).join('；') : vue?.resourcesNote;
  const deployment = vue?.metrics ? `已记录到场${vue.metrics.actualPeople}人、抽排设备${vue.metrics.actualPumps}台，到场时间${vue.metrics.actualArrival}（模拟）；作业点及正式回执待核实` : '实际部署人数、装备数量、作业点及到场回执待核实';
  return [
    `灾害类型：${value(refs.disasterType)}`,
    `发生时间：${value(refs.occurredAt)}`,
    `事发地点：${value(refs.location)}`,
    `影响范围：${value(refs.impactScope)}`,
    `应急响应等级：${response}`,
    suggested ? `建议响应等级：${value(suggestedId)}（建议值，不等于已启动响应）` : null,
    `救援力量部署：${resources ? `候选资源：${resources}；` : ''}${deployment}；候选资源不等于已调派。`,
  ].filter(Boolean).join('\n');
}
