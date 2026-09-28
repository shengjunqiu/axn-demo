import { create } from 'zustand';
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

let manualCounter = 0;
function nextManualId(): { factId: string; sourceRecordId: string } {
  manualCounter += 1;
  return { factId: `fact-manual-${String(manualCounter).padStart(3, '0')}`, sourceRecordId: `src-manual-${String(manualCounter).padStart(3, '0')}` } as const;
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
  storageWarning: string | null;
  globalBanner: string;
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
}

const demoPersisted = loadPersist<DemoPersist>('demo');

export const useDemoStore = create<DemoState>()((set, get) => ({
  actorId: demoPersisted?.actorId ?? DEFAULT_ACTOR_ID,
  currentEventId: demoPersisted?.currentEventId ?? DEFAULT_EVENT_ID,
  demoClock: demoPersisted?.demoClock ?? DEMO_CLOCK,
  pace: demoPersisted?.pace ?? 'normal',
  faults: demoPersisted?.faults ?? {},
  guideStepIndex: demoPersisted?.guideStepIndex ?? initialGuide,
  manualFacts: demoPersisted?.manualFacts ?? [],
  waterOverride: demoPersisted?.waterOverride ?? null,
  storageWarning: null,
  globalBanner: demoMeta.globalBanner,

  getActor: () => {
    const { actorId } = get();
    return actorById.get(actorId) ?? actorById.get(DEFAULT_ACTOR_ID)!;
  },
  setActor: (actorId) => set({ actorId }),

  switchEvent: (eventId) => set({ currentEventId: eventId }),
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
    return entry;
  },

  getManualFactByField: (field, scopeKind, scopeId) =>
    [...get().manualFacts]
      .reverse()
      .find((m) => m.field === field && m.scopeKind === scopeKind && m.scopeId === scopeId),

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
    if (fault) set({ waterOverride: fault, demoClock: fault.newDemoClock });
  },
  isWaterFeedUpdated: () => get().waterOverride !== null,

  setStorageWarning: (msg) => set({ storageWarning: msg }),

  reset: () => {
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
  } as DemoPersist);
});

export const DEMO_NAMESPACE = 'anneng-demo:v1';
export const DEMO_SESSION_KEY = `${DEMO_NAMESPACE}:session`;
export { DEFAULT_SESSION_ID };
