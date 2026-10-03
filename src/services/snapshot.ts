/**
 * 来源快照构建：生成文书 / 保存版本前，把当前事实与派生值固化为快照。
 */
import type { SourceSnapshot, WaterSeriesPoint } from '@/domain/types';

import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import {
  DEMO_CLOCK,
  incidentById,
  knowledgeById,
  shift,
  teamById,
  warehouseById,
} from '@/seed/scenario';
import { currentContextVersion, resolveFact, resolveSourceRecord, latestClockFactId, resourceAllowed, shiftEventIds, type FactQueryScope } from './factLookup.js';
import { computeDerived, type DerivedKey } from '@/seed/derived';

let snapshotCounter = 0;
function nextSnapshotId(): string {
  snapshotCounter += 1;
  return `snapshot-${Date.now().toString(36)}-${snapshotCounter}`;
}

export interface SnapshotInput {
  scopeKind: 'event' | 'shift';
  eventId: string | null;
  shiftId: string | null;
  sessionId: string;
  extraFactIds?: string[];
  /** 需要固化的派生事实 key */
  derivedKeys?: DerivedKey[];
  label: string;
}

/** 仅返回当前事件、候选和选定版本一致的建议；未采纳不默认选择。 */
export function selectedProposalForSession(sessionId: string, eventId: string) {
  const store = useSessionStore.getState();
  const session = store.sessions[sessionId];
  const proposal = session?.selectedProposalId ? store.proposals[session.selectedProposalId] : undefined;
  if (!session || session.eventId !== eventId || !proposal || proposal.eventId !== eventId
    || proposal.version !== session.selectedProposalVersion
    || [...proposal.candidateIds].sort((a, b) => a.localeCompare(b)).join('|') !== [...session.candidateResourceIds].sort((a, b) => a.localeCompare(b)).join('|')) return null;
  return proposal;
}

export function buildSnapshot(input: SnapshotInput): SourceSnapshot {
  const session = useSessionStore.getState().sessions[input.sessionId];
  const scope: FactQueryScope = input.scopeKind === 'event'
    ? { kind: 'event', eventId: input.eventId ?? '' }
    : { kind: 'shift', shiftId: input.shiftId ?? '' };
  const candidates = session?.eventId === input.eventId && input.scopeKind === 'event'
    ? (session?.candidateResourceIds ?? []).filter((id) => resourceAllowed(id, input.eventId as string)) : [];;
  const facts: SourceSnapshot['facts'] = {};
  const sources: SourceSnapshot['sources'] = {};
  const factIds = new Set<string>(input.extraFactIds ?? []);

  if (input.scopeKind === 'event' && input.eventId) {
    const incident = incidentById.get(input.eventId);
    if (incident) {
      for (const factId of Object.values(incident.factRefs)) factIds.add(factId);
      for (const factId of Object.values(incident.situationFactRefs)) factIds.add(factId);
    }
    for (const resourceId of candidates) {
      const team = teamById.get(resourceId);
      if (team) for (const factId of Object.values(team.factRefs)) factIds.add(factId);
      const wh = warehouseById.get(resourceId);
      if (wh) for (const factId of Object.values(wh.factRefs)) factIds.add(factId);
    }
  }
  if (input.scopeKind === 'shift' && input.shiftId) {
    for (const factId of Object.values(shift.factRefs)) factIds.add(factId);
    for (const id of shiftEventIds(input.shiftId)) {
      for (const factId of Object.values(incidentById.get(id)?.factRefs ?? {})) factIds.add(factId);
    }
    // 审查 minor-8：班次域只收本班次 scope 的人工补录事实，不收全量（防跨事件泄入）。
    const demo = useDemoStore.getState();
    for (const m of demo.manualFacts) {
      if (m.scopeKind === 'shift' && m.scopeId === input.shiftId) factIds.add(m.factId);
    }
  }

  for (const key of input.derivedKeys ?? []) {
    for (const id of computeDerived(key, candidates).inputFactIds) factIds.add(id);
  }
  factIds.add(latestClockFactId());
  for (const oid of ['001', '002', '003', '004', '005', '006']) {
    factIds.add(`fact-obs-water-${oid}-waterLevel`);
    factIds.add(`fact-obs-water-${oid}-observedAt`);
  }
  for (const factId of factIds) {
    const f = resolveFact(factId, scope);
    if (!f) continue;
    const source = resolveSourceRecord(f.sourceRecordId, scope);
    if (source) sources[source.sourceRecordId] = source;
    facts[factId] = {
      scope: f.scope,
      factId: f.factId,
      value: f.value,
      unit: f.unit,
      valueType: f.valueType,
      sourceRecordId: f.sourceRecordId,
      sourceFieldKey: f.sourceFieldKey,
      sourceVersion: f.sourceVersion,
      capturedAt: f.capturedAt,
      verification: f.verification,
      sourceSystem: f.sourceSystem,
      sourceLabel: f.sourceLabel,
    };
  }

  const derived: SourceSnapshot['derived'] = {};
  for (const key of input.derivedKeys ?? []) {
    if (key.startsWith('daily_') && (scope.kind !== 'shift' || shiftEventIds(scope.shiftId).length !== shift.incidentIds.length)) continue;
    const d = computeDerived(key, candidates, { facts, clock: String(facts[latestClockFactId()]?.value ?? DEMO_CLOCK) });
    if (d.inputFactIds.some((id) => !resolveFact(id, scope))) continue;
    derived[key] = {
      key: d.key,
      value: d.value,
      unit: d.unit,
      formula: d.formula,
      inputFactIds: d.inputFactIds,
      inputSummary: d.inputSummary,
    };
  }

  // 水位序列
  const waterSeries: WaterSeriesPoint[] = [];
  const demo = useDemoStore.getState();
  const obsIds = ['obs-water-001', 'obs-water-002', 'obs-water-003', 'obs-water-004', 'obs-water-005'];
  for (const oid of obsIds) {
    // 审查 minor-6：水位更新后 obs-005 由覆盖点取代，避免同值两点成平段。

    const at = resolveFact(`fact-${oid}-observedAt`, scope);
    const lv = resolveFact(`fact-${oid}-waterLevel`, scope);
    if (at && lv && lv.value != null) {
      waterSeries.push({
        observationId: oid,
        observedAt: String(at.value),
        waterLevel: Number(lv.value),
        unit: lv.unit ?? '米',
      });
    }
  }
  if (demo.waterOverride && resolveFact('fact-obs-water-005-waterLevel', scope)) {
    waterSeries.push({
      observationId: demo.waterOverride.observationId,
      observedAt: demo.waterOverride.observedAt,
      waterLevel: demo.waterOverride.waterLevel,
      unit: '米',
    });
  }

  const proposal = input.scopeKind === 'event' && input.eventId
    ? selectedProposalForSession(input.sessionId, input.eventId) : null;
  const snapshot: SourceSnapshot = {
    snapshotId: nextSnapshotId(),
    scopeKind: input.scopeKind,
    eventId: input.eventId,
    shiftId: input.shiftId,
    takenAt: new Date().toISOString(),
    contextVersion: currentContextVersion(scope),
    dataVersion: currentContextVersion(scope),
    sources,
    facts,
    derived,
    candidateResourceIds: [...candidates],
    selectedProposalId: proposal?.proposalId ?? null,
    selectedProposalVersion: proposal?.version ?? null,
    knowledgeChunkIds: proposal?.knowledgeRefs.filter((id) => knowledgeById.has(id)) ?? [],
    waterSeries,
    label: input.label,
  };

  return structuredClone(snapshot) as SourceSnapshot;
}
