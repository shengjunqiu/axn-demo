import type { FixtureKnowledge } from './scenario';
/** 按用户确认的十类救援场景配置；地点、数值、预案均为本地模拟。 */
import rawProfiles from './disasterScenarios.json';
import { buildDisasterSections } from './documentTemplates';
import type { VueWorkspaceEventMeta } from './vueWorkspaceEvents';
import type { VueDemoResource } from './vueDemoResources';

export interface DisasterProfile {
  eventId: string; name: string; category: string; location: string;
  stage: VueWorkspaceEventMeta['stage']; risks: string; impactScope: string; casualty: string;
  occurredAt: string; capturedAt: string; description: string;
  monitoring: { label: string; unit: string; times: string[]; values: number[]; source: string }[];
  riskDistribution: { area: string; count: number }[];
  resources: { name: string; kind: VueDemoResource['kind']; amount: string; capability: string; status: string }[];
  planTitle: string; planSections: [string, string][]; gaps: string;
  objective: string; target: number; completed: number; unit: string;
}
export const DISASTER_PROFILES = rawProfiles as DisasterProfile[];
export const disasterProfileById = new Map(DISASTER_PROFILES.map(p => [p.eventId, p]));
export function disasterMonitoringText(p: DisasterProfile): string {
  return p.monitoring.map(m => `${m.label}（${m.unit}）：${m.times.map((time, i) => `${time} ${m.values[i]}`).join(' → ')}；${m.source}`).join('\n');
}

/** 主战法章节（planSections 中标题含「主战法」）。 */
export function disasterTacticSection(p: DisasterProfile): [string, string] | undefined {
  return p.planSections.find(([h]) => h.includes('主战法'));
}

/** 关键监测最新读数，供预案摘要条展示。 */
export function disasterKeyReadings(p: DisasterProfile, limit = 6): { label: string; value: string; source: string }[] {
  return p.monitoring.slice(0, limit).map((m) => ({
    label: m.label,
    value: `${m.values.at(-1) ?? '缺测'}${m.unit}（${m.times.at(-1) ?? ''}）`,
    source: m.source,
  }));
}
export function disasterResourcesText(p: DisasterProfile): string {
  return p.resources.map(r => `${r.name} / ${r.amount} / ${r.capability} / ${r.status}`).join('\n');
}
/** 一期对齐骨架填充；委托 documentTemplates，避免双套章节漂移。 */
export function disasterDocumentSections(eventId: string, code: string): [string, string][] | undefined {
  const p = disasterProfileById.get(eventId);
  if (!p) return undefined;
  return buildDisasterSections(p, code);
}
export const disasterWorkspaceEvents: VueWorkspaceEventMeta[] = DISASTER_PROFILES.map(p => ({
  eventId: p.eventId, name: p.name, category: p.category, stage: p.stage, risks: p.risks,
  description: p.description, location: p.location, occurredAt: p.occurredAt, controlStatus: 'ongoing',
  impactScope: `${p.impactScope}（模拟）`, casualty: p.casualty,
  resourcesNote: disasterResourcesText(p), equipment: { name: p.resources[1].name, quantity: p.resources[1].amount },
  timeline: [
    { time: '08:30', title: '模拟接报', detail: p.description, tone: 'done' },
    ...p.monitoring[0].times.map((time, i) => ({ time, title: `${p.monitoring[0].label}记录`, detail: `${p.monitoring[0].values[i]} ${p.monitoring[0].unit}（模拟）；${p.monitoring[0].source}`, tone: 'done' as const })),
    { time: '当前', title: p.stage, detail: `${p.objective} ${p.completed}/${p.target}${p.unit}（模拟）；${p.gaps}`, tone: 'active' },
  ],
}));
export const disasterDemoResources: VueDemoResource[] = DISASTER_PROFILES.flatMap(p => p.resources.map((r, i) => ({
  id: `${p.eventId}-resource-${i + 1}`, eventId: p.eventId, kind: r.kind, name: r.name,
  capability: r.capability, amountLabel: r.amount, status: r.status, location: p.location,
  distanceLabel: '未接真实定位（示意）', schematicPosition: { x: 230 + i * 200, y: 180 + i * 100 },
  selectable: true,
})));

export const disasterKnowledgeChunks: FixtureKnowledge[] = DISASTER_PROFILES.map(p => ({
  chunkId: `kb-${p.eventId}`, title: p.planTitle, category: p.category, version: 'V1-demo',
  isMock: true, effectiveStatus: '模拟参考待审', sourceLabel: `${p.category}预案样例（本地模拟，非正式集团预案）`,
  content: p.planSections.map(([h,b]) => `${h}：${b}`).join('\n'), notice: `${p.gaps}；仅产品演示，需专业复核。`,
}));
