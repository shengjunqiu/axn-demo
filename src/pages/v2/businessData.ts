/** 当前明坑村事件的演示业务记录；页面、问答和方案共用。 */
export const BUSINESS_SNAPSHOT = '2026-09-07 18:00';
export const SUPPLY_ITEMS = [
  { name: '饮用水', team: '南昌队', spec: '24瓶/箱', unit: '箱', initial: 120, incoming: 80, outgoing: 150, consumed: 140, stock: 45, demand: 70 },
  { name: '自热食品', team: '南昌队', spec: '12份/箱', unit: '箱', initial: 100, incoming: 40, outgoing: 90, consumed: 85, stock: 50, demand: 40 },
  { name: '雨衣', team: '南昌队', spec: '成人通用', unit: '件', initial: 80, incoming: 20, outgoing: 60, consumed: 0, stock: 40, demand: 50 },
  { name: '照明头灯', team: '南昌队', spec: '充电式', unit: '盏', initial: 60, incoming: 20, outgoing: 50, consumed: 2, stock: 30, demand: 20 },
  { name: '急救包', team: '南昌队', spec: '便携标准包', unit: '套', initial: 20, incoming: 10, outgoing: 18, consumed: 12, stock: 12, demand: 20 },
];
export const supplyExpected = (item: typeof SUPPLY_ITEMS[number]) => item.initial + item.incoming - item.outgoing;
export const supplyGap = (item: typeof SUPPLY_ITEMS[number]) => Math.max(0, item.demand - item.stock);
export const SUPPLY_GAPS = SUPPLY_ITEMS.filter(item => supplyGap(item) > 0).map(item => `${item.name}${supplyGap(item)}${item.unit}`).join('、');
export const SUPPLY_DIFFERENCES = SUPPLY_ITEMS.filter(item => supplyExpected(item) !== item.stock).map(item => `${item.name}账面${supplyExpected(item)}${item.unit}、盘点${item.stock}${item.unit}，差异${item.stock - supplyExpected(item)}${item.unit}`).join('；');
export const SUPPLY_AUDIT_TEXT = `当前事件物资核验结果（模拟，${BUSINESS_SNAPSHOT}）：已登记${SUPPLY_ITEMS.length}类物资。按下一阶段需求与可用库存比较，缺口为${SUPPLY_GAPS}；自热食品、照明头灯库存满足本轮登记需求。账实核对发现${SUPPLY_DIFFERENCES}，需复核出入库及盘点记录。消耗属于已出库物资的使用情况，不再从库存重复扣减；不同计量单位不混加。本次仅反馈核验结果与补给建议，不修改台账或自动发起采购。`;
export const SUPPLY_LEDGER_TEXT = SUPPLY_ITEMS.map(item => `${item.name}（${item.spec}，${item.team}）：期初${item.initial}${item.unit}，入库${item.incoming}${item.unit}，出库${item.outgoing}${item.unit}，消耗${item.consumed}${item.unit}，可用库存${item.stock}${item.unit}，下一阶段需求${item.demand}${item.unit}`).join('\n');

export const APPROVAL_RECORDS = [
  ['南昌队常备中队', '第二工程局南昌分公司', '50', '第一梯队', '摩托化机动', '已完成（模拟）', '2026-09-05 07:10'],
  ['指导组', '中国安能', '30', '指导组出动', '摩托化机动', '已完成（模拟）', '2026-09-05 07:20'],
  ['永新项目部', '第二工程局南昌分公司', '18', '备勤候选', '摩托化机动', '待复核（模拟）', '2026-09-07 17:40'],
];
export const TASK_RECORDS = [
  { name: '阶段任务会商与进度核对', group: '指挥组', owner: '指挥协调岗（模拟）', deadline: '2026-09-07 18:30', status: '进行中', detail: '核对搜救结果、道路限制、坡体监测与后续保障安排，不代替正式任务批准。' },
  { name: '救援过程资料整理', group: '党建组', owner: '宣传记录岗（模拟）', deadline: '2026-09-07 19:30', status: '待协调', detail: '整理阶段快报、影像索引及过程记录，发布内容须经复核。' },
  { name: '明坑村被困人员搜救', group: '指挥-处置组', owner: '搜救负责人（模拟）', deadline: '2026-09-07 17:01', status: '已完成', detail: '按r5反馈核实12人、累计救出12人、尚待搜救0人；仅表示人员搜救闭合。' },
  { name: '进场便道抢通与通行核查', group: '技术组', owner: '道路保障岗（模拟）', deadline: '2026-09-07 18:30', status: '进行中', detail: '临时便道已恢复；桥涵承载、限行条件与大件装备通行仍待核实。' },
  { name: '坡体监测与警戒交接', group: '安全组', owner: '安全监测岗（模拟）', deadline: '2026-09-07 20:00', status: '进行中', detail: '坡体尚未稳定，持续监测并核对警戒、撤离路线与通信，阈值由专业岗位确认。' },
  { name: '夜间物资补给与交接', group: '保障组', owner: '物资保障岗（模拟）', deadline: '2026-09-07 19:00', status: '待协调', detail: `按18:00台账协调${SUPPLY_GAPS}，优先复核饮用水账实差异。` },
];
export const TASK_TEXT = TASK_RECORDS.map(task => `${task.name}｜${task.group}｜${task.owner}｜${task.status}｜目标时限${task.deadline}\n${task.detail}`).join('\n');
export const SUMMARY_RECORDS = [
  ['明坑村人员搜救阶段总结（模拟）', '未盖章·草稿', '草稿', '现场指挥所', '综合记录岗', '2026-09-07 18:00'],
  ['明坑村力量与物资保障复盘（模拟）', '未盖章·待复核', '待复核', '综合保障组', '保障记录岗', '2026-09-07 18:30'],
  ['明坑村便道与坡体风险专项总结（模拟）', '未盖章·草稿', '草稿', '安全管理组', '安全记录岗', '2026-09-07 19:00'],
];
export const BRIEF_RECORDS = [
  ['明坑村滑坡初报（模拟）', '现场指挥所', '2026-09-05 17:46', '已登记·演示', '初报约10人被困、8栋房屋倒塌，道路阻断（r1）。'],
  ['明坑村搜救进展续报（模拟）', '现场指挥所', '2026-09-06 15:59', '已登记·演示', '核实被困12人、累计救出8人、尚待搜救4人（r3）。'],
  ['明坑村搜救阶段快报（模拟）', '现场指挥所', '2026-09-07 17:01', '待复核·演示', '累计救出12人，坡体与道路风险监测继续（r5）。'],
];
export const BUSINESS_NOTE = '模拟业务数据，仅用于原型演示；任务时限、报备状态和文书记录不代表正式指令、审批或发布。';
