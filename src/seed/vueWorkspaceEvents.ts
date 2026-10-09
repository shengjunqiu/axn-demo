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

/** 与 Vue eventWorkspace.workspaceEvents 一一对应（展示名保持一致）。 */
export const VUE_WORKSPACE_EVENTS: VueWorkspaceEventMeta[] = [
  ...disasterWorkspaceEvents,
  {
    eventId: 'evt-vue-nl08',
    name: '武陵大道立交下穿城市内涝',
    stage: '救援中',
    category: '城市内涝',
    risks: '涉水触电、车辆漂浮、地下空间进水和交通阻断',
    description: '武陵大道立交下穿城市内涝（演示）。09:40接报；10:00、10:10、10:20水位分别为0.42、0.45、0.48米。交通管控范围、受困对象、作业节点待核。',
    location: '武陵大道立交下穿（演示）',
    occurredAt: '2026-10-08T09:40:00+08:00',
    controlStatus: 'ongoing',
    impactScope: '下穿通道及周边交通节点（演示·待核实）',
    casualty: '人员伤亡情况待核实',
    resourcesNote:
      '演示计划：12人、泵2套、12:00到场。演示实际：12人、泵1套、12:18到场。队伍可出动状态、人员名单及装备单件标识待补核。',
    metrics: {
      plannedPeople: 12,
      actualPeople: 12,
      plannedPumps: 2,
      actualPumps: 1,
      plannedArrival: '12:00',
      actualArrival: '12:18',
    },
    equipment: { name: '排水泵', quantity: '1套' },
    dispatch: {
      taskSource: '工程局上报',
      channel: '地方发现／基层上报',
      infoType: '同步信息',
      sendUnit: '常德工程局值班室（演示）',
      reportUnit: '常德工程局值班室（演示）',
      callUnit: '待原任务受领岗位核实',
      issueUnit: '工程局应急值班（演示）',
      taskNo: 'TASK-20260921-NL08',
    },
    timeline: [
      { time: '09:40', title: '接报', detail: '武陵大道立交下穿城市内涝接报（演示）', tone: 'done' },
      { time: '10:00', title: '水位监测', detail: '水位计读数 0.42 米（演示快照）', tone: 'done' },
      { time: '10:10', title: '水位监测', detail: '水位计读数 0.45 米；较前次上升 0.03 米（演示）', tone: 'done' },
      { time: '10:20', title: '水位监测', detail: '水位计读数 0.48 米；观测时段累计上升 0.06 米（演示）', tone: 'done' },
      { time: '10:25', title: '救援处置中', detail: '交通管控范围、受困对象、作业节点待核；阶段为救援中', tone: 'active' },
      { time: '待补', title: '待核实事项', detail: '气体漏电检测、排水去向、临时供电与安全条件待岗位核对', tone: 'pending' },
    ],
  },
  {
    eventId: 'evt-vue-nd01',
    name: '南堤垸管涌险情',
    stage: '力量投送中',
    category: '堤防管涌',
    risks: '渗流发展、堤体稳定与临水作业风险',
    description: '南堤垸疑似管涌（演示）。位置、渗漏量、受威胁对象及专业勘察结论待核，未认定处置完成。',
    location: '南堤垸 K3+200（演示）',
    occurredAt: '2026-10-08T10:00:00+08:00',
    controlStatus: 'ongoing',
    impactScope: '堤段及临水区域（演示·待核实）',
    casualty: '人员伤亡情况待核实',
    resourcesNote: '候选水利抢险力量、反滤材料与运输条件待核，尚无正式出动或到场回执。',
    timeline: [
      { time: '10:00', title: '接报线索', detail: '南堤垸疑似管涌接报（演示）', tone: 'done' },
      { time: '10:10', title: '力量投送中', detail: '候选水利抢险力量与反滤材料运输条件待核', tone: 'active' },
      { time: '待补', title: '专业勘察', detail: '管涌位置、渗漏量、受威胁对象及工法适用条件待技术岗位复核', tone: 'pending' },
    ],
  },
  {
    eventId: 'evt-vue-yw01',
    name: '沅水水位上涨预警',
    stage: '待研判',
    category: '水位预警',
    risks: '水位变化与受威胁区域尚待专业研判',
    description: '沅水水位站收到上涨告警（演示）。测站位置、采集时刻、仪器校验及现场证据待核，告警不等于已确认灾情。',
    location: '沅水水位站（演示）',
    occurredAt: '2026-10-08T09:50:00+08:00',
    controlStatus: 'ongoing',
    impactScope: '受威胁区域待研判',
    casualty: '人员伤亡情况待核实',
    timeline: [
      { time: '09:50', title: '监测告警', detail: '沅水水位站上涨告警线索接入（演示）', tone: 'done' },
      { time: '待补', title: '待研判', detail: '测站位置、采集时刻、仪器校验及现场证据待核；告警≠已确认灾情', tone: 'pending' },
    ],
  },
  {
    eventId: 'evt-vue-g5513',
    name: 'G5513边坡滑移处置',
    stage: '待复盘',
    category: '边坡滑移',
    risks: '边坡稳定、落石与交通作业风险',
    description: 'G5513边坡滑移处置进入待复盘阶段（演示）。接报、处置及撤收记录已登记，成果验收和消耗凭证尚不完整。',
    location: 'G5513 边坡路段（演示）',
    occurredAt: '2026-10-07T14:00:00+08:00',
    controlStatus: 'controlled',
    impactScope: '道路作业影响范围（演示·待核实）',
    casualty: '人员伤亡情况待核实',
    resourcesNote: '人员装备投入记录已登记（演示），核定数量、到达时间和消耗凭证仍待核实。',
    timeline: [
      { time: '10-07 14:00', title: '接报处置', detail: 'G5513边坡滑移任务接报并进入处置（演示）', tone: 'done' },
      { time: '已登记', title: '撤收记录', detail: '接报、处置及撤收记录已登记（演示）', tone: 'done' },
      { time: '当前', title: '待复盘', detail: '成果验收与消耗凭证尚不完整，进入待复盘', tone: 'active' },
    ],
  },
  {
    eventId: 'evt-vue-qh01',
    name: '漆河镇水位站告警核查',
    stage: '已归档',
    category: '告警核查',
    risks: '归档记录的适用范围与引用权限待核对',
    description: '漆河镇水位站告警核查材料已归档（演示）。核查结论与正式归档依据请查看原系统记录，未填入具体实测数值。',
    location: '漆河镇水位站（演示）',
    occurredAt: '2026-10-07T08:00:00+08:00',
    controlStatus: 'controlled',
    impactScope: '告警核查归档范围（演示）',
    casualty: '无人员伤亡（演示·归档口径）',
    timeline: [
      { time: '10-07 08:00', title: '告警接入', detail: '漆河镇水位站告警线索（演示）', tone: 'done' },
      { time: '17:00', title: '核查归档', detail: '核查材料已归档；正式结论以原系统记录为准', tone: 'done' },
    ],
  },
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
  schematicPosition: { x: 400, y: 360 },
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
