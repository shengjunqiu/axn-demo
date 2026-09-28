/**
 * 来源快照构建：生成文书 / 保存版本前，把当前事实与派生值固化为快照。
 */
import type { SourceSnapshot, WaterSeriesPoint } from '@/domain/types';
import { computeContentHash } from '@/store/documentStore';
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
import { currentContextVersion, resolveFact } from './factLookup';
import { computeDerived, DERIVED_META, type DerivedKey } from '@/seed/derived';

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

export function buildSnapshot(input: SnapshotInput): SourceSnapshot {
  const session = useSessionStore.getState().sessions[input.sessionId];
  const candidates = session?.candidateResourceIds ?? [];
  const facts: SourceSnapshot['facts'] = {};
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
    // 审查 minor-8：班次域只收本班次 scope 的人工补录事实，不收全量（防跨事件泄入）。
    const demo = useDemoStore.getState();
    for (const m of demo.manualFacts) {
      if (m.scopeKind === 'shift' && m.scopeId === input.shiftId) factIds.add(m.factId);
    }
  }

  for (const factId of factIds) {
    const f = resolveFact(factId);
    if (!f) continue;
    facts[factId] = {
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
    const d = computeDerived(key, candidates);
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
    if (oid === 'obs-water-005' && demo.waterOverride) continue;
    const at = resolveFact(`fact-${oid}-observedAt`);
    const lv = resolveFact(`fact-${oid}-waterLevel`);
    if (at && lv && lv.value != null) {
      waterSeries.push({
        observationId: oid,
        observedAt: String(at.value),
        waterLevel: Number(lv.value),
        unit: lv.unit ?? '米',
      });
    }
  }
  if (demo.waterOverride) {
    waterSeries.push({
      observationId: demo.waterOverride.observationId,
      observedAt: demo.waterOverride.observedAt,
      waterLevel: demo.waterOverride.waterLevel,
      unit: '米',
    });
  }

  const snapshot: SourceSnapshot = {
    snapshotId: nextSnapshotId(),
    scopeKind: input.scopeKind,
    eventId: input.eventId,
    shiftId: input.shiftId,
    takenAt: new Date().toISOString(),
    contextVersion: currentContextVersion(),
    dataVersion: Date.now(),
    facts,
    derived,
    candidateResourceIds: [...candidates],
    selectedProposalId: session?.selectedProposalId ?? null,
    selectedProposalVersion: session?.selectedProposalVersion ?? null,
    knowledgeChunkIds: Object.keys(knowledgeById),
    waterSeries,
    label: input.label,
  };
  void computeContentHash; // hash 属于内容层，这里不使用
  void DEMO_CLOCK;
  void DERIVED_META;
  return snapshot;
}
