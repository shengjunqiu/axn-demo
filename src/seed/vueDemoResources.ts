import { disasterDemoResources } from './disasterScenarios';
/**
 * 建设场景事件的演示资源叠加点位（对齐 Vue ResourceForce 台账样例）。
 * 仅用于「资源与态势」抽屉的列表 / 地图分布示意，不写入授权台账，不参与正式候选调派。
 */
export type VueDemoResourceKind =
  | 'team'
  | 'equipment'
  | 'warehouse'
  | 'hospital'
  | 'hotel'
  | 'gasStation'
  | 'supportUnit'
  | 'expert'
  | 'school';

export interface VueDemoResource {
  id: string;
  eventId: string;
  kind: VueDemoResourceKind;
  name: string;
  capability: string;
  amountLabel: string;
  status: string;
  location: string;
  distanceLabel: string;
  schematicPosition: { x: number; y: number };
  /** 演示可勾选进入候选区（仍标注 ≠ 已调派）。 */
  selectable: boolean;
}

/** 武陵大道内涝等建设场景事件的周边资源分布（示意坐标，非真实地图）。 */
export const VUE_DEMO_RESOURCES: VueDemoResource[] = [
  ...disasterDemoResources,
  {
    id: 'vue-res-nl08-t01',
    eventId: 'evt-vue-nl08',
    kind: 'team',
    name: '常德水域排涝队',
    capability: '水域救援、排涝',
    amountLabel: '12 / 12 人',
    status: '可出动（演示·待核）',
    location: '常德基地',
    distanceLabel: '约 18 km（演示）',
    schematicPosition: { x: 280, y: 220 },
    selectable: true,
  },
  {
    id: 'vue-res-nl08-e01',
    eventId: 'evt-vue-nl08',
    kind: 'equipment',
    name: '大流量排水泵组',
    capability: '排水、抽排积水',
    amountLabel: '1 / 2 套',
    status: '可调用（演示·另1套占用）',
    location: '常德装备库',
    distanceLabel: '约 18 km（演示）',
    schematicPosition: { x: 520, y: 160 },
    selectable: true,
  },
  {
    id: 'vue-res-nl08-t02',
    eventId: 'evt-vue-nl08',
    kind: 'team',
    name: '工程救援分队',
    capability: '工程抢险、排涝',
    amountLabel: '人数待核',
    status: '待核',
    location: '基地驻地',
    distanceLabel: '定位快照待核',
    schematicPosition: { x: 620, y: 300 },
    selectable: false,
  },
  {
    id: 'vue-res-nl08-h01',
    eventId: 'evt-vue-nl08',
    kind: 'hospital',
    name: '周边综合医院',
    capability: '急救、医疗保障',
    amountLabel: '床位待核',
    status: '容量待核',
    location: '城区',
    distanceLabel: '可达性待核',
    schematicPosition: { x: 720, y: 420 },
    selectable: false,
  },
  {
    id: 'vue-res-nd01-t01',
    eventId: 'evt-vue-nd01',
    kind: 'team',
    name: '候选水利抢险力量',
    capability: '堤防抢险、反滤',
    amountLabel: '编制待核',
    status: '待核（演示）',
    location: '南堤垸附近（演示）',
    distanceLabel: '距离待核',
    schematicPosition: { x: 360, y: 240 },
    selectable: false,
  },
  {
    id: 'vue-res-nd01-w01',
    eventId: 'evt-vue-nd01',
    kind: 'warehouse',
    name: '反滤材料集结点',
    capability: '反滤料、编织袋',
    amountLabel: '库存待核',
    status: '待核',
    location: '临堤集结场（演示）',
    distanceLabel: '运输条件待核',
    schematicPosition: { x: 560, y: 180 },
    selectable: false,
  },
  {
    id: 'vue-res-nd01-t02',
    eventId: 'evt-vue-nd01',
    kind: 'team',
    name: '南堤机动抢护分队',
    capability: '堤防巡查、袋土抢护',
    amountLabel: '18 / 20 人',
    status: '可出动（演示·待核）',
    location: '南堤集结点（演示）',
    distanceLabel: '约 12 km（演示）',
    schematicPosition: { x: 420, y: 310 },
    selectable: true,
  },
  // —— 沅水水位上涨预警（待研判）——
  {
    id: 'vue-res-yw01-t01',
    eventId: 'evt-vue-yw01',
    kind: 'team',
    name: '沅水巡查观测组',
    capability: '水位观测、险情初判',
    amountLabel: '6 / 6 人',
    status: '可出动（演示·待核）',
    location: '沅水水位站附近（演示）',
    distanceLabel: '约 8 km（演示）',
    schematicPosition: { x: 300, y: 200 },
    selectable: true,
  },
  {
    id: 'vue-res-yw01-e01',
    eventId: 'evt-vue-yw01',
    kind: 'equipment',
    name: '移动测报与通信单元',
    capability: '水位复核、现场报送',
    amountLabel: '1 / 1 套',
    status: '可调用（演示）',
    location: '流域测报点（演示）',
    distanceLabel: '约 15 km（演示）',
    schematicPosition: { x: 480, y: 260 },
    selectable: true,
  },
  {
    id: 'vue-res-yw01-w01',
    eventId: 'evt-vue-yw01',
    kind: 'warehouse',
    name: '防汛物资前置点',
    capability: '编织袋、土工布、照明',
    amountLabel: '库存待核',
    status: '待核',
    location: '沿河集结场（演示）',
    distanceLabel: '运输条件待核',
    schematicPosition: { x: 640, y: 340 },
    selectable: false,
  },
  // —— G5513 边坡滑移处置（待复盘）——
  {
    id: 'vue-res-g5513-t01',
    eventId: 'evt-vue-g5513',
    kind: 'team',
    name: '公路抢通工程队',
    capability: '边坡清障、临时支护',
    amountLabel: '22 / 24 人',
    status: '已归建（演示·待核）',
    location: 'G5513 附近基地（演示）',
    distanceLabel: '约 25 km（演示）',
    schematicPosition: { x: 260, y: 180 },
    selectable: true,
  },
  {
    id: 'vue-res-g5513-e01',
    eventId: 'evt-vue-g5513',
    kind: 'equipment',
    name: '挖掘机与清障车组',
    capability: '落石清运、路面抢通',
    amountLabel: '2 / 3 台套',
    status: '可调用（演示·1 台检修）',
    location: '路段养护站（演示）',
    distanceLabel: '约 20 km（演示）',
    schematicPosition: { x: 500, y: 240 },
    selectable: true,
  },
  {
    id: 'vue-res-g5513-h01',
    eventId: 'evt-vue-g5513',
    kind: 'hospital',
    name: '沿线急救站',
    capability: '外伤急救、转运衔接',
    amountLabel: '床位待核',
    status: '容量待核',
    location: '服务区医疗点（演示）',
    distanceLabel: '可达性待核',
    schematicPosition: { x: 700, y: 380 },
    selectable: false,
  },
  // —— 漆河镇水位站告警核查（已归档）——
  {
    id: 'vue-res-qh01-t01',
    eventId: 'evt-vue-qh01',
    kind: 'team',
    name: '漆河告警核查组',
    capability: '测站复核、现场取证',
    amountLabel: '4 / 4 人',
    status: '已归档力量（演示）',
    location: '漆河镇水位站（演示）',
    distanceLabel: '约 6 km（演示）',
    schematicPosition: { x: 320, y: 220 },
    selectable: true,
  },
  {
    id: 'vue-res-qh01-w01',
    eventId: 'evt-vue-qh01',
    kind: 'warehouse',
    name: '核查样本与器材箱',
    capability: '测深、影像、记录表',
    amountLabel: '1 套（演示）',
    status: '已核销归档（演示）',
    location: '镇站库房（演示）',
    distanceLabel: '同点位',
    schematicPosition: { x: 520, y: 280 },
    selectable: false,
  },
  {
    id: 'vue-res-qh01-t02',
    eventId: 'evt-vue-qh01',
    kind: 'team',
    name: '地方联动联络员',
    capability: '乡镇协同、信息报送',
    amountLabel: '2 人',
    status: '待命（演示·待核）',
    location: '漆河镇政府（演示）',
    distanceLabel: '约 3 km（演示）',
    schematicPosition: { x: 680, y: 360 },
    selectable: true,
  },
  // —— 下穿道路积水（evt-demo-002，与 001 台账隔离）——
  {
    id: 'vue-res-demo002-t01',
    eventId: 'evt-demo-002',
    kind: 'team',
    name: '下穿排涝机动组',
    capability: '积水抽排、交通疏导协助',
    amountLabel: '10 / 10 人',
    status: '可出动（演示·待核）',
    location: '城区排涝站（演示）',
    distanceLabel: '约 5 km（演示）',
    schematicPosition: { x: 340, y: 210 },
    selectable: true,
  },
  {
    id: 'vue-res-demo002-e01',
    eventId: 'evt-demo-002',
    kind: 'equipment',
    name: '车载排水泵',
    capability: '下穿积水抽排',
    amountLabel: '2 / 2 套',
    status: '可调用（演示）',
    location: '市政装备点（演示）',
    distanceLabel: '约 7 km（演示）',
    schematicPosition: { x: 540, y: 250 },
    selectable: true,
  },
  {
    id: 'vue-res-demo002-w01',
    eventId: 'evt-demo-002',
    kind: 'warehouse',
    name: '警示与围挡物资点',
    capability: '水马、警示灯、沙袋',
    amountLabel: '库存待核',
    status: '待核',
    location: '下穿口集结场（演示）',
    distanceLabel: '约 2 km（演示）',
    schematicPosition: { x: 660, y: 330 },
    selectable: false,
  },
  // 影响分析与保障类演示目标（宾馆/加油站/保障单元/专家/学校）
  {
    id: 'vue-res-nl08-hotel01',
    eventId: 'evt-vue-nl08',
    kind: 'hotel',
    name: '城东商务宾馆（演示）',
    capability: '临时住宿、集结缓冲',
    amountLabel: '床位待核',
    status: '开放状态待核',
    location: '常德城区（演示）',
    distanceLabel: '约 9 km（演示）',
    schematicPosition: { x: 400, y: 380 },
    selectable: false,
  },
  {
    id: 'vue-res-nl08-gas01',
    eventId: 'evt-vue-nl08',
    kind: 'gasStation',
    name: '国道加油站（演示）',
    capability: '油品补给',
    amountLabel: '库存待核',
    status: '夜间营业待核',
    location: '绕城国道（演示）',
    distanceLabel: '约 6 km（演示）',
    schematicPosition: { x: 200, y: 300 },
    selectable: false,
  },
  {
    id: 'vue-res-nl08-sup01',
    eventId: 'evt-vue-nl08',
    kind: 'supportUnit',
    name: '综合保障单元（演示）',
    capability: '餐食、服装、通信保障',
    amountLabel: '编制待核',
    status: '可衔接待核',
    location: '常德基地保障组（演示）',
    distanceLabel: '约 18 km（演示）',
    schematicPosition: { x: 340, y: 140 },
    selectable: false,
  },
  {
    id: 'vue-res-nl08-exp01',
    eventId: 'evt-vue-nl08',
    kind: 'expert',
    name: '排涝工程专家组（演示）',
    capability: '风险隐患评估、工法论证',
    amountLabel: '2 人（演示）',
    status: '远程/靠前待定',
    location: '远程（演示）',
    distanceLabel: '到场时效待核',
    schematicPosition: { x: 760, y: 120 },
    selectable: false,
  },
  {
    id: 'vue-res-nl08-sch01',
    eventId: 'evt-vue-nl08',
    kind: 'school',
    name: '周边中学（演示）',
    capability: '空旷场地参考；不自动认定为安置场所',
    amountLabel: '开放状态待核',
    status: '待教育/属地确认',
    location: '城区东侧（演示）',
    distanceLabel: '约 4 km（演示）',
    schematicPosition: { x: 680, y: 260 },
    selectable: false,
  },
];

export const vueDemoResourceById = new Map(VUE_DEMO_RESOURCES.map((item) => [item.id, item]));

/** 授权台账事件（evt-demo-001）查询/预览使用的资源 ID。 */
export const LEDGER_RESOURCE_IDS = ['team-001', 'team-002', 'warehouse-001', 'warehouse-002'] as const;

export function vueDemoResourcesForEvent(eventId: string): VueDemoResource[] {
  return VUE_DEMO_RESOURCES.filter((item) => item.eventId === eventId);
}

export function vueDemoResourceIdsForEvent(eventId: string): string[] {
  return vueDemoResourcesForEvent(eventId).map((item) => item.id);
}

/** 打开资源抽屉时的种子回退 ID（未执行查询时预览本事件资源）。 */
export function seedResourceIdsForEvent(eventId: string): string[] {
  if (eventId === 'evt-demo-001') return [...LEDGER_RESOURCE_IDS];
  return vueDemoResourceIdsForEvent(eventId);
}
