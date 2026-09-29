import { create } from 'zustand';
import { useDocumentStore } from './documentStore';
import { shift } from '@/seed/scenario';
import { invalidateAllRuns } from '@/services/taskRuns';
import {
  DEFAULT_ACTOR_ID,
  DEFAULT_EVENT_ID,
  DEFAULT_SESSION_ID,
  DEMO_CLOCK,
  actorById,
  demoMeta,
} from '@/seed/scenario';
import type { Actor, DemoConfig, DemoPace } from '@/domain/types';
import { clearPersist, loadPersist, savePersist } from './persistence';

export interface ManualFactEntry {
  factId: string;
  eventId: string;
  field: string;
  value: string;
  scopeKind: 'event' | 'shift';
  scopeId: string;
  sourceRecordId: string;
  actorId: string;
  actorName: string;
  performedAt: string;
  demoClockAt: string;
  sourceLabel: string;
}

export interface WaterFeedOverride {
  observationId: string;
  stationId: string;
  observedAt: string;
  waterLevel: number;
  capturedAt: string;
  feedVersion: number;
  newDemoClock: string;
}

function nextManualId(): { factId: string; sourceRecordId: string } {
  const id = crypto.randomUUID();
  return { factId: `fact-manual-${id}`, sourceRecordId: `src-manual-${id}` };
}

interface DemoState {
  actorId: string;
  currentEventId: string;
  demoClock: string;
  pace: DemoPace;
  faults: Record<string, boolean>;
  guideStepIndex: number;
  manualFacts: ManualFactEntry[];
  waterOverride: WaterFeedOverride | null;
  contextVersions: Record<string, number>;
  contextSequence: number;
  storageWarning: string | null;
  globalBanner: string;
  touchContext: (kind: 'event' | 'shift', id: string) => void;
  getContextVersion: (kind: 'event' | 'shift', id: string) => number;
  getActor: () => Actor;
  setActor: (actorId: string) => void;
  switchEvent: (eventId: string) => void;
  getCurrentEventId: () => string;
  setPace: (pace: DemoPace) => void;
  armFault: (faultId: string) => void;
  disarmFault: (faultId: string) => void;
  consumeFault: (faultId: string) => boolean;
  isFaultArmed: (faultId: string) => boolean;
  setGuideStep: (index: number) => void;
  addManualFact: (input: {
    field: string;
    value: string;
    scopeKind: 'event' | 'shift';
    scopeId: string;
    actorId: string;
  }) => ManualFactEntry;
  getManualFactByField: (field: string, scopeKind: 'event' | 'shift', scopeId: string) => ManualFactEntry | undefined;
  applyWaterFeedUpdate: () => void;
  isWaterFeedUpdated: () => boolean;
  setStorageWarning: (msg: string | null) => void;
  reset: () => void;
}

const initialGuide: DemoConfig['guideStepIndex'] = 0;

/** 可持久化切片（函数与临时提示不落盘）。 */
interface DemoPersist {
  actorId: string;
  currentEventId: string;
  demoClock: string;
  pace: 'normal' | 'fast';
  faults: Record<string, boolean>;
  guideStepIndex: number;
  manualFacts: ManualFactEntry[];
  waterOverride: WaterFeedOverride | null;
  contextVersions: Record<string, number>;
  contextSequence: number;
}

const demoPersisted = loadPersist<DemoPersist>('demo');
const persistedManualInput: unknown = demoPersisted?.manualFacts;
const persistedManualFacts = (Array.isArray(persistedManualInput) ? persistedManualInput : []).filter(
  (entry): entry is ManualFactEntry => !!entry && typeof entry === 'object'
    && ['factId', 'field', 'value', 'scopeId', 'sourceRecordId', 'actorId', 'actorName', 'performedAt', 'demoClockAt', 'sourceLabel'].every(
      key => typeof (entry as Record<string, unknown>)[key] === 'string')
    && (entry.scopeKind === 'event' || entry.scopeKind === 'shift'),
);
const malformedManualFacts = persistedManualInput != null && (!Array.isArray(persistedManualInput) || persistedManualFacts.length !== persistedManualInput.length);
const duplicateManualIds = new Set(persistedManualFacts.filter((fact, index, all) =>
  all.findIndex(other => other.factId === fact.factId) !== index).map(fact => fact.factId));

export const useDemoStore = create<DemoState>()((set, get) => ({
  actorId: demoPersisted?.actorId ?? DEFAULT_ACTOR_ID,
  currentEventId: demoPersisted?.currentEventId ?? DEFAULT_EVENT_ID,
  demoClock: demoPersisted?.demoClock ?? DEMO_CLOCK,
  pace: demoPersisted?.pace ?? 'normal',
  faults: demoPersisted?.faults ?? {},
  guideStepIndex: demoPersisted?.guideStepIndex ?? initialGuide,
  manualFacts: persistedManualFacts,
  waterOverride: demoPersisted?.waterOverride ?? null,
  contextVersions: demoPersisted?.contextVersions ?? {},
  contextSequence: demoPersisted?.contextSequence ?? (demoPersisted?.waterOverride ? 2 : 1),
  storageWarning: malformedManualFacts ? '部分补录缓存格式不完整，未载入；请重新补录并校核文书。' : duplicateManualIds.size ? '检测到旧演示数据的补录引用冲突，请重新补录相关字段并刷新文书数据；旧记录未被删除。' : null,
  globalBanner: demoMeta.globalBanner,

  getContextVersion: (kind, id) => get().contextVersions[`${kind}:${id}`] ?? (get().waterOverride && (id === 'evt-demo-001' || kind === 'shift') ? 2 : 1),
  touchContext: (kind, id) => {
    const version = get().contextSequence + 1;
    const keys = [`${kind}:${id}`];
    if (kind === 'event' && shift.incidentIds.includes(id)) keys.push(`shift:${shift.shiftId}`);
    set(s => ({ contextSequence: version, contextVersions: { ...s.contextVersions, ...Object.fromEntries(keys.map(key => [key, version])) } }));
    useDocumentStore.getState().markBusinessDataChanged(kind, id);
  },

  getActor: () => {
    const { actorId } = get();
    return actorById.get(actorId) ?? actorById.get(DEFAULT_ACTOR_ID)!;
  },
  setActor: (actorId) => set({ actorId }),

  switchEvent: (eventId) => {
    if (eventId !== get().currentEventId) invalidateAllRuns();
    set({ currentEventId: eventId });
  },
  getCurrentEventId: () => get().currentEventId,

  setPace: (pace) => set({ pace }),

  isFaultArmed: (faultId) => get().faults[faultId] === true,
  armFault: (faultId) => set((s) => ({ faults: { ...s.faults, [faultId]: true } })),
  disarmFault: (faultId) => set((s) => ({ faults: { ...s.faults, [faultId]: false } })),
  consumeFault: (faultId) => {
    if (get().faults[faultId] === true) {
      set((s) => ({ faults: { ...s.faults, [faultId]: false } }));
      return true;
    }
    return false;
  },

  setGuideStep: (index) => set({ guideStepIndex: index }),

  addManualFact: (input) => {
    const actor = get().getActor();
    const ids = nextManualId();
    const entry: ManualFactEntry = {
      ...ids,
      eventId: input.scopeKind === 'event' ? input.scopeId : get().currentEventId,
      field: input.field,
      value: input.value,
      scopeKind: input.scopeKind,
      scopeId: input.scopeId,
      actorId: input.actorId,
      actorName: actor.name,
      performedAt: new Date().toISOString(),
      demoClockAt: get().demoClock,
      sourceLabel: '人工补录（模拟）',
    };
    set((s) => ({ manualFacts: [...s.manualFacts, entry] }));
    get().touchContext(input.scopeKind, input.scopeId);
    return entry;
  },

  getManualFactByField: (field, scopeKind, scopeId) =>
    [...get().manualFacts]
      .reverse()
      .find((m) => m.field === field && m.scopeKind === scopeKind && m.scopeId === scopeId
        && get().manualFacts.filter(other => other.factId === m.factId).length === 1),

  applyWaterFeedUpdate: () => {
    const fault = get().isWaterFeedUpdated() ? null : {
      observationId: 'obs-water-006',
      stationId: 'station-demo-001',
      observedAt: '2026-09-28T21:12:00+08:00',
      waterLevel: 42.35,
      capturedAt: '2026-09-28T21:12:00+08:00',
      feedVersion: 2,
      newDemoClock: '2026-09-28T21:12:00+08:00',
    };
    if (fault) {
      set({ waterOverride: fault, demoClock: fault.newDemoClock });
      get().touchContext('event', 'evt-demo-001');
    }
  },
  isWaterFeedUpdated: () => get().waterOverride !== null,

  setStorageWarning: (msg) => set({ storageWarning: msg }),

  reset: () => {
    invalidateAllRuns();
    clearPersist('demo');
    set({
      actorId: DEFAULT_ACTOR_ID,
      currentEventId: DEFAULT_EVENT_ID,
      demoClock: DEMO_CLOCK,
      pace: 'normal',
      faults: {},
      guideStepIndex: initialGuide,
      manualFacts: [],
      waterOverride: null,
      contextVersions: {},
      contextSequence: 1,
      storageWarning: null,
      globalBanner: demoMeta.globalBanner,
    });
  },
}));

// 状态变化即持久化（AC-025）
useDemoStore.subscribe((state) => {
  savePersist('demo', {
    actorId: state.actorId,
    currentEventId: state.currentEventId,
    demoClock: state.demoClock,
    pace: state.pace,
    faults: state.faults,
    guideStepIndex: state.guideStepIndex,
    manualFacts: state.manualFacts,
    waterOverride: state.waterOverride,
    contextVersions: state.contextVersions,
    contextSequence: state.contextSequence,
  } as DemoPersist);
});

export const DEMO_NAMESPACE = 'anneng-demo:v1';
export const DEMO_SESSION_KEY = `${DEMO_NAMESPACE}:session`;
export { DEFAULT_SESSION_ID };
