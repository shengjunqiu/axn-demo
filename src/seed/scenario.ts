import { disasterKnowledgeChunks } from './disasterScenarios';
import rawScenario from '@/fixtures/scenario.json';
import {
  vueWorkspaceFacts,
  vueWorkspaceIncidents,
  vueWorkspaceSources,
} from '@/seed/vueWorkspaceEvents';

/**
 * scenario.json 的最小类型镜像。种子结构以 fixtures 文件为准；
 * 这里只做一次性收窄，不做运行时校验（模拟原型，种子受版本管理）。
 * Vue 原型建设场景事件由 vueWorkspaceEvents 并入 incidents/facts/sources，供关联灾情下拉展示。
 */
export interface FixtureScope {
  kind: 'event' | 'organization' | 'shift' | 'demo_configuration';
  eventId?: string;
  orgId?: string;
  shiftId?: string;
  allowedEventIds?: string[];
}

export interface FixtureFact {
  factId: string;
  value: string | number | string[] | null;
  unit: string | null;
  valueType: 'string' | 'number' | 'datetime' | 'string[]';
  sourceFieldId: string;
  sourceRecordId: string;
  sourceFieldKey: string;
  sourceVersion: number;
  capturedAt: string;
  verification: 'confirmed' | 'pending' | 'suggested';
  dataMode: 'mock';
  scope: FixtureScope;
}

export interface FixtureSource {
  sourceRecordId: string;
  sourceSystem: string;
  sourceTable: string;
  objectId: string;
  sourceVersion: number;
  capturedAt: string;
  scope: FixtureScope;
  dataMode: 'mock';
  isSimulated: boolean;
  label: string;
  fields: Record<string, string | number | string[] | null>;
}

export interface FixtureIncident {
  eventId: string;
  orgId: string;
  scope: string;
  factRefs: Record<string, string>;
  situationFactRefs: Record<string, string>;
  stationId: string | null;
  schematicPosition: { x: number; y: number };
  confirmedDeployments: unknown[];
  reportingUnitFactId: string | null;
  contextVersion: number;
  supportedDepth: string;
}

export interface FixtureTeam {
  resourceId: string;
  resourceType: 'team';
  factRefs: Record<string, string>;
  distanceAnchorEventId: string;
  distanceAndEtaAreSimulated: boolean;
  schematicPosition: { x: number; y: number };
  unavailableReason: string | null;
}

export interface FixtureWarehouse {
  resourceId: string;
  resourceType: 'warehouse';
  factRefs: Record<string, string>;
  schematicPosition: { x: number; y: number };
}

export interface FixtureWaterObservation {
  observationId: string;
  stationId: string;
  factRefs: Record<string, string>;
}

export interface FixtureTemplateField {
  field: string;
  binding: string;
  required: boolean;
  allowPending: boolean;
}

export interface FixtureTemplate {
  templateCode: string;
  name: string;
  templateVersion: string;
  status: 'enabled' | 'preview_only';
  sections: string[];
  requiredFields: FixtureTemplateField[] | null;
  optionalBindings: string[] | null;
  allowedExports: string[];
  signatureMode: string | null;
  note: string | null;
}

export interface FixtureKnowledge {
  chunkId: string;
  title: string;
  category: string;
  version: string;
  isMock: boolean;
  effectiveStatus: string;
  sourceLabel: string;
  content: string;
  notice: string;
}

export interface FixtureSession {
  sessionId: string;
  eventId: string;
  messages: unknown[];
  lastResourceResultIds: string[];
  candidateResourceIds: string[];
  selectedProposalId: string | null;
  pendingClarification: unknown | null;
}

export interface FixtureBlueprintSection {
  id: string;
  title: string;
  text: string;
  binding?: string;
  emptyText?: string;
}

export interface ScenarioFixture {
  meta: {
    schemaVersion: number;
    fixtureVersion: string;
    createdAt: string;
    title: string;
    dataMode: 'mock';
    dataScope: string;
    scenarioMode: string;
    demoClock: string;
    timeZone: string;
    notice: string;
    globalBanner: string;
    storageNamespace: string;
    defaultEventId: string;
    defaultSessionId: string;
    defaultActorId: string;
    runtimeContract: string;
    demoClockFactId: string;
  };
  actors: {
    actorId: string;
    /** 身份标签（值班员/指挥员）；签发人等审计记录用的是它，不要与 userName 混用。 */
    name: string;
    /** 模拟用户姓名，仅用于侧栏展示。 */
    userName: string;
    role: 'duty' | 'commander';
    orgId: string;
    isSimulated: boolean;
  }[];
  incidents: FixtureIncident[];
  sessions: FixtureSession[];
  shift: {
    shiftId: string;
    orgId: string;
    startsAt: string;
    endsAt: string;
    incidentIds: string[];
    handOverNotesFactId: string | null;
    reportingUnitFactId: string | null;
    statisticsCutoffUses: string;
    label: string;
    factRefs: Record<string, string>;
  };
  teams: FixtureTeam[];
  warehouses: FixtureWarehouse[];
  station: {
    stationId: string;
    eventId: string;
    latestObservationId: string;
    schematicPosition: { x: number; y: number };
    feedVersion: number;
  };
  waterObservations: FixtureWaterObservation[];
  sources: FixtureSource[];
  facts: FixtureFact[];
  knowledgeChunks: FixtureKnowledge[];
  templates: FixtureTemplate[];
  proposalBlueprint: {
    blueprintId: string;
    isMock: boolean;
    notice: string;
    knowledgeRefs: string[];
    sections: FixtureBlueprintSection[];
    riskNotes: string[];
    creationRule: string;
  };
  manualInputExamples: {
    field: string;
    exampleUtterance: string;
    exampleValue: string;
    requiresConfirmation: boolean;
    persistRule: string;
  }[];
  derivedFactDefinitions: { key: string; formula: string; inputs: string }[];
  schematicMap: {
    mode: string;
    label: string;
    viewBox: number[];
    georeferenced: boolean;
    distanceRule: string;
    riverPath: string;
    eventMarkerRef: string;
    teamMarkerRef: string;
    warehouseMarkerRef: string;
  };
  faultScenarios: {
    faultId: string;
    title: string;
    enabledByDefault: boolean;
    target: string;
    behavior: string;
    factId?: string;
    requiresEventId?: string;
    newDemoClock?: string;
    newObservationId?: string;
    newCapturedAt?: string;
    newWaterLevel?: number;
    unit?: string;
    newFeedVersion?: number;
  }[];
  negativeContentExamples: {
    text: string;
    expectedRule: string;
    replacement: string | null;
  }[];
  expectedChecks: {
    note: string;
    initialCandidates: { teams: number; people: number; excavators: number };
    afterSelectingTeam001And002: { teams: number; people: number; excavators: number };
    afterRemovingTeam002: { teams: number; people: number; excavators: number };
    availableTeamsByEta: string[];
    shift: { incidents: number; ongoing: number; controlled: number };
    latestWaterLevel: number;
    afterFeedUpdateWaterLevel: number;
    mandatoryManualFieldsInitiallyMissing: string[];
  };
}

// SAFETY: rawScenario is the imported JSON fixture, guaranteed to match the ScenarioFixture shape
// at build time via the typed import and the static seed generation that produces it.
export const scenario = rawScenario as unknown as ScenarioFixture;

export const demoMeta = scenario.meta;
export const DEFAULT_EVENT_ID = demoMeta.defaultEventId;
export const DEFAULT_SESSION_ID = demoMeta.defaultSessionId;
export const DEFAULT_ACTOR_ID = demoMeta.defaultActorId;
export const DEMO_CLOCK = demoMeta.demoClock;

export const actors = scenario.actors;
export const actorById = new Map(actors.map((a) => [a.actorId, a]));

export const incidents = [...scenario.incidents, ...vueWorkspaceIncidents];
export const incidentById = new Map(incidents.map((i) => [i.eventId, i]));

export const shift = scenario.shift;
export const teams = scenario.teams;
export const teamById = new Map(teams.map((t) => [t.resourceId, t]));
export const warehouses = scenario.warehouses;
export const warehouseById = new Map(warehouses.map((w) => [w.resourceId, w]));
export const station = scenario.station;
export const waterObservations = scenario.waterObservations;
export const observationById = new Map(waterObservations.map((o) => [o.observationId, o]));

export const knowledgeChunks = [...scenario.knowledgeChunks, ...disasterKnowledgeChunks];
export const knowledgeById = new Map(knowledgeChunks.map((k) => [k.chunkId, k]));

export const templates = scenario.templates;
export const templateByCode = new Map(templates.map((t) => [t.templateCode, t]));

export const proposalBlueprint = scenario.proposalBlueprint;
export const manualInputExamples = scenario.manualInputExamples;
export const derivedFactDefinitions = scenario.derivedFactDefinitions;
export const schematicMap = scenario.schematicMap;
export const faultScenarios = scenario.faultScenarios;
export const negativeContentExamples = scenario.negativeContentExamples;
export const expectedChecks = scenario.expectedChecks;

export const factById: ReadonlyMap<string, FixtureFact> = new Map(
  [...scenario.facts, ...vueWorkspaceFacts].map((f) => [f.factId, f]),
);

export const sourceById: ReadonlyMap<string, FixtureSource> = new Map(
  [...scenario.sources, ...vueWorkspaceSources].map((s) => [s.sourceRecordId, s]),
);

export function getFact(factId: string): FixtureFact | undefined {
  return factById.get(factId);
}

export function factText(factId: string): string {
  const f = factById.get(factId);
  if (!f) return '';
  if (Array.isArray(f.value)) return f.value.join('、');
  return String(f.value ?? '');
}

export function factNumber(factId: string): number | null {
  const f = factById.get(factId);
  if (!f || typeof f.value !== 'number') return null;
  return f.value;
}
