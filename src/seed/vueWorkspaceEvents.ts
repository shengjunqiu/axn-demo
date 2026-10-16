/**
 * Vue 原型（doc-emergency-anneng）对话工作台演示事件。
 * 并入本仓库关联灾情下拉与建设场景内容；全部为模拟数据。
 */
import { disasterWorkspaceEvents, disasterProfileById } from './disasterScenarios';
import type { FixtureFact, FixtureIncident, FixtureSource } from '@/seed/scenario';

export interface VueWorkspaceEventMeta {
  eventId: string;
  name: string;
  stage: '待研判' | '力量投送中' | '救援中' | '待复盘' | '已归档';
  category: string;
  risks: string;
  description: string;
  location: string;
  occurredAt: string;
  controlStatus: 'ongoing' | 'controlled';
  impactScope: string;
  casualty: string;
  /** 对齐 Vue eventWorkspace.materials.resources，供资源查询/报告引用。 */
  resourcesNote?: string;
  /** 对齐 Vue metrics（计划/实际人装到场），仅演示对照。 */
  metrics?: {
    plannedPeople: number;
    actualPeople: number;
    plannedPumps: number;
    actualPumps: number;
    plannedArrival: string;
    actualArrival: string;
  };
  equipment?: { name: string; quantity: string };
  /** 事件过程时间轴（演示节点，对齐监测/接报/到场等过程记录）。 */
  timeline?: { time: string; title: string; detail: string; tone?: 'done' | 'active' | 'pending' }[];
  /**
   * 一期信息接报 / 事件派发来源（可选覆盖）。
   * 未配置时由 resolveEventDispatchSource 按灾种给演示默认值。
   */
  dispatch?: {
    taskSource?: string;
    channel?: '上级下发' | '地方发现／基层上报';
    infoType?: '同步信息' | '录入信息';
    sendUnit?: string;
    reportUnit?: string;
    callUnit?: string;
    issueUnit?: string;
    taskNo?: string;
  };
}

/**
 * 工作台事件列表：仅三类实战场景（洪涝决口 / 山体滑坡 / 泥石流），
 * 每类含待研判 / 力量投送中 / 救援中 / 待复盘阶段变体，供关联灾情下拉选用。
 */
export const VUE_WORKSPACE_EVENTS: VueWorkspaceEventMeta[] = [
  ...disasterWorkspaceEvents,
];

export const vueWorkspaceEventById = new Map(VUE_WORKSPACE_EVENTS.map((e) => [e.eventId, e]));

function factId(eventId: string, field: string): string {
  return `fact-${eventId}-${field}`;
}

function sourceId(eventId: string): string {
  return `src-${eventId}-v1`;
}

function makeFact(
  eventId: string,
  field: string,
  value: string,
  verification: FixtureFact['verification'] = 'confirmed',
): FixtureFact {
  return {
    factId: factId(eventId, field),
    value,
    unit: null,
    valueType: 'string',
    sourceFieldId: `mock.vue_workspace.${field}.${eventId}`,
    sourceRecordId: sourceId(eventId),
    sourceFieldKey: field,
    sourceVersion: 1,
    capturedAt: disasterProfileById.get(eventId)?.capturedAt ?? '2026-10-08T10:25:00+08:00',
    verification,
    dataMode: 'mock',
    scope: { kind: 'event', eventId, orgId: 'org-demo-001' },
  };
}

export const vueWorkspaceIncidents: FixtureIncident[] = VUE_WORKSPACE_EVENTS.map((e) => ({
  eventId: e.eventId,
  orgId: 'org-demo-001',
  scope: 'drill',
  factRefs: {
    title: factId(e.eventId, 'title'),
    location: factId(e.eventId, 'location'),
    occurredAt: factId(e.eventId, 'occurredAt'),
    disasterType: factId(e.eventId, 'disasterType'),
    controlStatus: factId(e.eventId, 'controlStatus'),
    incidentDescription: factId(e.eventId, 'incidentDescription'),
    impactScope: factId(e.eventId, 'impactScope'),
    casualty: factId(e.eventId, 'casualty'),
    confirmedResponseLevel: factId(e.eventId, 'confirmedResponseLevel'),
  },
  situationFactRefs: {},
  stationId: null,
  // 落在资源廊道中段，便于态势图自动取景时事件点居中
  schematicPosition: { x: 460, y: 300 },
  confirmedDeployments: [],
  reportingUnitFactId: null,
  contextVersion: 1,
  supportedDepth: 'vue_workspace_demo',
}));

export const vueWorkspaceFacts: FixtureFact[] = VUE_WORKSPACE_EVENTS.flatMap((e) => [
  makeFact(e.eventId, 'title', e.name),
  makeFact(e.eventId, 'location', e.location),
  makeFact(e.eventId, 'occurredAt', e.occurredAt),
  makeFact(e.eventId, 'disasterType', e.category),
  makeFact(e.eventId, 'controlStatus', e.controlStatus),
  makeFact(e.eventId, 'incidentDescription', e.description),
  makeFact(e.eventId, 'impactScope', e.impactScope, e.impactScope.includes('待核') ? 'pending' : 'confirmed'),
  makeFact(e.eventId, 'casualty', e.casualty, e.casualty.includes('待核') ? 'pending' : 'confirmed'),
  makeFact(e.eventId, 'confirmedResponseLevel', '待核实', 'pending'),
]);

export const vueWorkspaceSources: FixtureSource[] = VUE_WORKSPACE_EVENTS.map((e) => ({
  sourceRecordId: sourceId(e.eventId),
  sourceSystem: '救援场景演示资料（模拟）',
  sourceTable: 'workspace_event',
  objectId: e.eventId,
  sourceVersion: 1,
  capturedAt: disasterProfileById.get(e.eventId)?.capturedAt ?? '2026-10-08T10:25:00+08:00',
  scope: { kind: 'event', eventId: e.eventId, orgId: 'org-demo-001' },
  dataMode: 'mock',
  isSimulated: true,
  label: `建设场景 · ${e.stage}（模拟）`,
  fields: {
    title: e.name,
    location: e.location,
    occurredAt: e.occurredAt,
    disasterType: e.category,
    controlStatus: e.controlStatus,
    incidentDescription: e.description,
    impactScope: e.impactScope,
    casualty: e.casualty,
    confirmedResponseLevel: '待核实',
    stage: e.stage,
    risks: e.risks,
  },
}));
