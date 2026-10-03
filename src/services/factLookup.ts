/**
 * 统一事实查询：种子事实 + 人工补录事实 + 监测数据更新覆盖。
 * 所有展示与文书绑定都通过这里取值，禁止各页面直连种子常量。
 */
import type { FactValue, FactScope, SourceRecord } from '@/domain/types';
import rawScenario from '@/fixtures/scenario.json';
import { factById, sourceById, incidentById, shift, teamById, warehouseById, type FixtureScope } from '@/seed/scenario';
import { useDemoStore } from '@/store/demoStore';

export interface ResolvedFact {
  scope: FactScope;
  factId: string;
  value: FactValue;
  unit: string | null;
  valueType: 'string' | 'number' | 'datetime' | 'string[]';
  sourceRecordId: string;
  sourceFieldKey: string;
  sourceVersion: number;
  capturedAt: string;
  verification: 'confirmed' | 'pending' | 'suggested';
  sourceSystem: string;
  sourceLabel: string;
  dataMode: 'mock';
  isSimulated: boolean;
}

/** Omitted scope is the current event, never an unrestricted lookup. */
export type FactQueryScope = { kind: 'event'; eventId: string } | { kind: 'shift'; shiftId: string };

export function shiftEventIds(shiftId: string): string[] {
  if (shiftId !== shift.shiftId) return [];
  return shift.incidentIds.filter((id) => rawScenario.shift.scope.allowedEventIds.includes(id)
    && incidentById.get(id)?.orgId === shift.orgId);
}

export function permits(owner: FixtureScope, query: FactQueryScope): boolean {
  let events: string[];
  if (query.kind === 'event') {
    events = incidentById.has(query.eventId) ? [query.eventId] : [];
  } else {
    events = shiftEventIds(query.shiftId);
  }
  if (!events.length) return false;
  if (owner.kind === 'demo_configuration') return true;
  if (owner.kind === 'event') {
    if (!owner.eventId) return false;
    return events.includes(owner.eventId);
  }
  if (owner.kind === 'shift') return query.kind === 'shift' && owner.shiftId === query.shiftId && (!owner.orgId || owner.orgId === shift.orgId);
  return events.some((id) => incidentById.get(id)?.orgId === owner.orgId && owner.allowedEventIds?.includes(id));
}

export function resourceAllowed(resourceId: string, eventId: string): boolean {
  const resource = teamById.get(resourceId) ?? warehouseById.get(resourceId);
  if (!resource) return false;
  if ('distanceAnchorEventId' in resource && resource.distanceAnchorEventId !== eventId) return false;
  return Object.values(resource.factRefs).every((id) => Boolean(resolveFact(id, { kind: 'event', eventId })));
}

export function resolveFact(factId: string, scope: FactQueryScope = { kind: 'event', eventId: useDemoStore.getState().currentEventId }): ResolvedFact | null {
  const demo = useDemoStore.getState();
  const matches = demo.manualFacts.filter((m) => m.factId === factId);
  // Legacy collisions are ambiguous: never silently pick the first record.
  if (matches.length > 1) return null;
  const manual = matches[0];
  if (manual) {
    const allowed = manual.scopeKind === 'event'
      ? permits({ kind: 'event', eventId: manual.scopeId }, scope)
      : scope.kind === 'shift' && scope.shiftId === manual.scopeId && shiftEventIds(scope.shiftId).length > 0;
    if (!allowed || (manual.scopeKind === 'event' && manual.eventId && manual.eventId !== manual.scopeId)) return null;
    const event = incidentById.get(manual.scopeId);
    const orgId = event?.orgId ?? shift.orgId;
    return {
      scope: manual.scopeKind === 'event' ? { kind: 'event', eventId: manual.scopeId, orgId } : { kind: 'shift', shiftId: manual.scopeId, orgId: shift.orgId, allowedEventIds: shiftEventIds(manual.scopeId) },
      factId: manual.factId,
      value: manual.value,
      unit: null,
      valueType: 'string',
      sourceRecordId: manual.sourceRecordId,
      sourceFieldKey: manual.field,
      sourceVersion: 1,
      capturedAt: manual.performedAt,
      verification: 'confirmed',
      sourceSystem: '人工补录（模拟）',
      sourceLabel: manual.sourceLabel,
      dataMode: 'mock',
      isSimulated: true,
    };
  }
  const dynamicBindings: Record<string, { sourceRecordId: string; field: string }> = {
    'fact-obs-water-006-waterLevel': { sourceRecordId: 'src-obs-water-006-v2', field: 'waterLevel' },
    'fact-obs-water-006-observedAt': { sourceRecordId: 'src-obs-water-006-v2', field: 'observedAt' },
    'fact-clock-demo-002-currentTime': { sourceRecordId: 'src-clock-002-v2', field: 'currentTime' },
  };
  const binding = dynamicBindings[factId];
  const dynamic = binding && dynamicSources().find(source => source.sourceRecordId === binding.sourceRecordId);
  if (dynamic && permits(dynamic.scope, scope)) {
    const field = binding.field;
    return { factId, scope: dynamic.scope, value: dynamic.fields[field], unit: field === 'waterLevel' ? '米' : null,
      valueType: field === 'waterLevel' ? 'number' : 'datetime', sourceRecordId: dynamic.sourceRecordId,
      sourceFieldKey: field, sourceVersion: dynamic.sourceVersion, capturedAt: dynamic.capturedAt,
      verification: 'confirmed', sourceSystem: dynamic.sourceSystem, sourceLabel: dynamic.label, dataMode: 'mock', isSimulated: true };
  }
  const seed = factById.get(factId);
  if (!seed || !permits(seed.scope, scope)) return null;
  const source = sourceById.get(seed.sourceRecordId);
  if (!source || !permits(source.scope, scope)) return null;
  const src = sourceById.get(seed.sourceRecordId);
  return {
    scope: seed.scope as FactScope,
    factId: seed.factId,
    value: seed.value,
    unit: seed.unit,
    valueType: seed.valueType,
    sourceRecordId: seed.sourceRecordId,
    sourceFieldKey: seed.sourceFieldKey,
    sourceVersion: seed.sourceVersion,
    capturedAt: seed.capturedAt,
    verification: seed.verification,
    sourceSystem: src?.sourceSystem ?? '模拟数据源',
    sourceLabel: src?.label ?? '模拟数据源',
    dataMode: 'mock',
    isSimulated: src?.isSimulated ?? true,
  };
}

/** 枚举型事实的展示标签（避免“ongoing / awaiting_confirmation”裸露到界面与导出）。 */
const ENUM_LABELS: Record<string, Record<string, string>> = {
  controlStatus: { ongoing: '处置中（持续跟踪）', controlled: '已控制' },
  suggestionStatus: { awaiting_confirmation: '待确认', confirmed: '已确认' },
};

/** 枚举事实值 → 中文标签（供快照冻结链路复用，避免导出/打印出现裸枚举值）。 */
export function formatFactValue(value: FactValue, unit: string | null, sourceFieldKey: string): string {
  let raw: string;
  if (Array.isArray(value)) {
    raw = value.join('、');
  } else if (value == null) {
    raw = '（来源缺失）';
  } else {
    raw = String(value);
  }
  const enumMap = ENUM_LABELS[sourceFieldKey];
  const label = enumMap?.[raw];
  const text = label ?? raw;
  return unit ? `${text}${unit}` : text;
}

export function factDisplay(factId: string, scope?: FactQueryScope): string {
  const f = resolveFact(factId, scope);
  if (!f) return '（来源缺失）';
  return formatFactValue(f.value, f.unit, f.sourceFieldKey);
}

/** 事件显示名（取 incident 标题事实，供导航/会话列表使用）。无标题时回退事件 ID。 */
export function eventDisplayName(eventId: string): string {
  const incident = incidentById.get(eventId);
  if (!incident) return eventId;
  const resolved = resolveFact(incident.factRefs.title, { kind: 'event', eventId });
  return resolved ? String(resolved.value) : eventId;
}

export function latestWaterLevelFactId(eventId: string = useDemoStore.getState().currentEventId): string | null {
  const incident = incidentById.get(eventId);
  if (!incident?.stationId || incident.stationId !== rawScenario.station.stationId) return null;
  const id = useDemoStore.getState().waterOverride ? 'fact-obs-water-006-waterLevel' : `fact-${rawScenario.station.latestObservationId}-waterLevel`;
  return resolveFact(id, { kind: 'event', eventId }) ? id : null;
}

export function currentContextVersion(scope: FactQueryScope = { kind: 'event', eventId: useDemoStore.getState().currentEventId }): number {
  return useDemoStore.getState().getContextVersion(scope.kind, scope.kind === 'event' ? scope.eventId : scope.shiftId);
}

function dynamicSources(): SourceRecord[] {
  const demo = useDemoStore.getState();
  const result: SourceRecord[] = [];
  if (demo.waterOverride) {
    const wo = demo.waterOverride;
    const wlFact = factById.get('fact-obs-water-005-waterLevel');
    const seedSourceId = wlFact?.sourceRecordId ?? '';
    const seed = sourceById.get('src-obs-water-005-v1') ?? sourceById.get(seedSourceId);
    if (!seed) throw new Error('seed data missing: obs-water-005');
    result.push({ ...seed, scope: seed.scope as FactScope, sourceRecordId: 'src-obs-water-006-v2', objectId: 'obs-water-006',
      sourceVersion: 2, capturedAt: wo.capturedAt, fields: { ...seed.fields, waterLevel: wo.waterLevel, observedAt: wo.observedAt } });
    const clock = sourceById.get('src-clock-001-v1');
    if (!clock) throw new Error('seed data missing: src-clock-001-v1');
    result.push({ ...clock, scope: clock.scope as FactScope, sourceRecordId: 'src-clock-002-v2', objectId: 'clock-demo-002', sourceVersion: 2,
      capturedAt: wo.capturedAt, fields: { currentTime: demo.demoClock } });
  }
  return result;
}

export function latestClockFactId(): string {
  return useDemoStore.getState().waterOverride ? 'fact-clock-demo-002-currentTime' : 'fact-clock-demo-001-currentTime';
}

export function resolveSourceRecord(sourceRecordId: string, scope: FactQueryScope): SourceRecord | null {
  const manual = useDemoStore.getState().manualFacts.find(m => m.sourceRecordId === sourceRecordId);
  if (manual) {
    const fact = resolveFact(manual.factId, scope);
    return fact ? { sourceRecordId, scope: fact.scope, sourceSystem: fact.sourceSystem, sourceTable: 'manual_inputs', objectId: manual.factId,
      sourceVersion: fact.sourceVersion, capturedAt: fact.capturedAt, dataMode: 'mock', isSimulated: true, label: fact.sourceLabel,
      fields: { [manual.field]: manual.value, actorName: manual.actorName, actorId: manual.actorId, performedAt: manual.performedAt, demoClockAt: manual.demoClockAt } } : null;
  }
  const source = dynamicSources().find(s => s.sourceRecordId === sourceRecordId) ?? sourceById.get(sourceRecordId);
  return source && permits(source.scope, scope) ? structuredClone(source) as SourceRecord : null;
}
