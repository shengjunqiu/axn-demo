/**
 * 一期综合业务「信息接报 / 事件派发」字段对齐（演示）。
 * 对应原系统列表/详情：任务来源、信息类型、发送单位、填报单位、调用单位；
 * 派发渠道对齐 v6 upper/local 口径（上级下发 / 地方发现·基层上报）。
 */
import { disasterProfileById } from './disasterScenarios';
import { vueWorkspaceEventById } from './vueWorkspaceEvents';
import { factText, incidentById } from './scenario';

/** 事件派发 / 接报来源（演示口径，不接真实接口）。 */
export interface EventDispatchSource {
  /** 任务来源，如工程局上报、集团应急指挥中心、演示接报 */
  taskSource: string;
  /** 派发渠道：上级下发 | 地方发现／基层上报 */
  channel: '上级下发' | '地方发现／基层上报';
  /** 信息类型：同步信息 | 录入信息 */
  infoType: '同步信息' | '录入信息';
  /** 发送单位 */
  sendUnit: string;
  /** 填报单位 */
  reportUnit: string;
  /** 调用单位（未核实时保留「未核实」） */
  callUnit: string;
  /** 下发/来源单位（任务卡侧展示） */
  issueUnit: string;
  /** 任务编号示意（演示） */
  taskNo: string;
}

export type EventDispatchOverride = Partial<EventDispatchSource>;

/** 建设场景事件显式覆盖（对齐 Vue 接报/任务卡演示口径）。 */
const DISPATCH_OVERRIDES: Record<string, EventDispatchOverride> = {
  'evt-vue-nl08': {
    taskSource: '工程局上报',
    channel: '地方发现／基层上报',
    infoType: '同步信息',
    sendUnit: '常德工程局值班室（演示）',
    reportUnit: '常德工程局值班室（演示）',
    callUnit: '待原任务受领岗位核实',
    issueUnit: '工程局应急值班（演示）',
    taskNo: 'TASK-20260921-NL08',
  },
  'evt-vue-nd01': {
    taskSource: '演示接报',
    channel: '地方发现／基层上报',
    infoType: '同步信息',
    sendUnit: '演示填报单位',
    reportUnit: '演示填报单位',
    callUnit: '未核实',
    issueUnit: '属地防汛值班室（演示）',
    taskNo: 'TASK-20261008-ND01',
  },
  'evt-demo-001': {
    taskSource: '集团应急指挥中心',
    channel: '上级下发',
    infoType: '同步信息',
    sendUnit: '集团应急指挥中心（演示）',
    reportUnit: '清河段防汛值班室（演示）',
    callUnit: '待核实',
    issueUnit: '集团应急指挥中心',
    taskNo: 'TASK-20260921-0012',
  },
  'evt-demo-002': {
    taskSource: '演示接报',
    channel: '地方发现／基层上报',
    infoType: '录入信息',
    sendUnit: '演示填报单位',
    reportUnit: '演示填报单位',
    callUnit: '未核实',
    issueUnit: '市政值班（演示）',
    taskNo: 'TASK-20261008-DEMO002',
  },
};

function defaultForCategory(category: string, eventId: string): EventDispatchSource {
  const upper = /预警|电网|水库|堰塞|决口|集团/.test(category);
  const suffix = eventId.replace(/^evt-/, '').toUpperCase().slice(0, 12);
  return {
    taskSource: upper ? '集团应急指挥中心' : '工程局上报',
    channel: upper ? '上级下发' : '地方发现／基层上报',
    infoType: '同步信息',
    sendUnit: upper ? '集团应急指挥中心（演示）' : '所属工程局值班室（演示）',
    reportUnit: upper ? '集团应急指挥中心（演示）' : '所属工程局值班室（演示）',
    callUnit: '未核实',
    issueUnit: upper ? '集团应急指挥中心' : '工程局应急值班（演示）',
    taskNo: `TASK-DEMO-${suffix}`,
  };
}

/** 解析当前事件的一期派发/接报来源字段。 */
export function resolveEventDispatchSource(eventId: string): EventDispatchSource | null {
  if (!incidentById.has(eventId) && !vueWorkspaceEventById.has(eventId)) return null;
  const vue = vueWorkspaceEventById.get(eventId);
  const profile = disasterProfileById.get(eventId);
  const category =
    vue?.category
    ?? profile?.category
    ?? (incidentById.get(eventId) ? factText(incidentById.get(eventId)!.factRefs.disasterType) : '');
  const base = defaultForCategory(category || '应急抢险', eventId);
  const fromVue = vue?.dispatch;
  const override = DISPATCH_OVERRIDES[eventId];
  return { ...base, ...fromVue, ...override };
}

/** 状态卡/正文用的有序列表行。 */
export function formatDispatchSourceLines(source: EventDispatchSource): string[] {
  return [
    `· 任务来源：${source.taskSource}（${source.channel}）`,
    `· 信息类型：${source.infoType}`,
    `· 发送单位：${source.sendUnit}`,
    `· 填报单位：${source.reportUnit}`,
    `· 调用单位：${source.callUnit}`,
    `· 下发单位：${source.issueUnit}`,
    `· 任务编号：${source.taskNo}（演示）`,
  ];
}
