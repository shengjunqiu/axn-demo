/**
 * 业务流程补充面板：按事件阶段决定 Tab 为历史回放 / 当前可交互 / 未到达；
 * 并按建设三场景 + 主责智能体分组展示。
 */
import type { DisasterProfile } from '@/seed/disasterScenarios';
import { WORK_SUMMARY_REFLECT_TITLES } from '@/seed/documentTemplates';
import type { SkillOwner } from '@/seed/skillPlanning';
import {
  SCENARIO_FLOW,
  STAGE_ORDER,
  resolveScenarioId,
  stageIndex,
  type EventStage,
  type ScenarioId,
} from '@/services/agentFlow';

export { STAGE_ORDER, stageIndex };

export const FLOW_TASKS = [
  '应急助手场景',
  '现场智能勘察',
  '态势研判预警',
  '规划梯队投送',
  '预警推送',
  '知识沉淀入库',
  '编组确认',
  '方案修订对比',
  '回撤归建',
  '复盘评估分析',
  '资料核验与总结',
  '资源维护与导出',
] as const;

export type FlowTask = (typeof FLOW_TASKS)[number];

export type FlowTabMode = 'past' | 'current' | 'future';

/** 流程归属：业务三场景，或横切支撑（应急助手）。 */
export type FlowScenarioKey = ScenarioId | 'support';

export type FlowTaskMeta = {
  scenarioId: FlowScenarioKey;
  owner: SkillOwner;
  agentLabel: string;
};

/** 流程 → 场景 → 主责智能体（与招标三场景 / Skill 规划同源）。 */
export const FLOW_TASK_META: Record<FlowTask, FlowTaskMeta> = {
  应急助手场景: { scenarioId: 'support', owner: 'interaction', agentLabel: '交互与呈现智能体' },
  现场智能勘察: { scenarioId: 'situation', owner: 'situation', agentLabel: '态势感知智能体' },
  态势研判预警: { scenarioId: 'situation', owner: 'situation', agentLabel: '态势感知智能体' },
  预警推送: { scenarioId: 'situation', owner: 'situation', agentLabel: '态势感知智能体' },
  规划梯队投送: { scenarioId: 'forceDelivery', owner: 'resource', agentLabel: '救援资源管理智能体' },
  编组确认: { scenarioId: 'forceDelivery', owner: 'resource', agentLabel: '救援资源管理智能体' },
  方案修订对比: { scenarioId: 'rescueOps', owner: 'plan', agentLabel: '救援方案生成智能体' },
  回撤归建: { scenarioId: 'rescueOps', owner: 'resource', agentLabel: '救援资源管理智能体' },
  复盘评估分析: { scenarioId: 'rescueOps', owner: 'evaluation', agentLabel: '救援效果评估智能体' },
  资料核验与总结: { scenarioId: 'rescueOps', owner: 'document', agentLabel: '文书生成智能体' },
  知识沉淀入库: { scenarioId: 'rescueOps', owner: 'evaluation', agentLabel: '救援效果评估智能体' },
  资源维护与导出: { scenarioId: 'rescueOps', owner: 'resource', agentLabel: '救援资源管理智能体' },
};

export const FLOW_SCENARIO_RAIL: { id: ScenarioId; label: string }[] = SCENARIO_FLOW.map((s) => ({
  id: s.id,
  label: s.label,
}));

/** Tab 归属的「完成门槛」阶段；当前阶段严格晚于该门槛 → past。 */
const FLOW_TAB_MIN_STAGE: Record<FlowTask, EventStage> = {
  应急助手场景: '待研判',
  现场智能勘察: '待研判',
  态势研判预警: '待研判',
  预警推送: '待研判',
  规划梯队投送: '力量投送中',
  编组确认: '力量投送中',
  方案修订对比: '救援中',
  回撤归建: '救援中',
  复盘评估分析: '待复盘',
  资料核验与总结: '待复盘',
  知识沉淀入库: '待复盘',
  资源维护与导出: '待复盘',
};

export function minStageForFlowTab(tab: FlowTask): EventStage {
  return FLOW_TAB_MIN_STAGE[tab];
}

export function flowTabMode(currentStage: EventStage, tab: FlowTask): FlowTabMode {
  const cur = stageIndex(currentStage);
  const min = stageIndex(minStageForFlowTab(tab));
  if (cur > min) return 'past';
  if (cur === min) return 'current';
  return 'future';
}

export function flowTaskMeta(tab: FlowTask): FlowTaskMeta {
  return FLOW_TASK_META[tab];
}

/** 某建设场景下展示的流程：该场景业务 Tab + 横切应急助手（置顶）。 */
export function flowsForScenario(scenarioId: ScenarioId): FlowTask[] {
  const support = FLOW_TASKS.filter((t) => FLOW_TASK_META[t].scenarioId === 'support');
  const owned = FLOW_TASKS.filter((t) => FLOW_TASK_META[t].scenarioId === scenarioId);
  return [...support, ...owned];
}

/** 打开某流程时外层场景轨道落点；支撑类随当前事件阶段。 */
export function scenarioRailForFlow(tab: FlowTask, eventStage: EventStage): ScenarioId {
  const key = FLOW_TASK_META[tab].scenarioId;
  if (key === 'support') return resolveScenarioId(eventStage);
  return key;
}

/** 场景内默认流程：优先 current 业务 Tab，其次非 future，再回落第一项。 */
export function defaultFlowForScenario(eventStage: EventStage, scenarioId: ScenarioId): FlowTask {
  const flows = flowsForScenario(scenarioId);
  const business = flows.filter((t) => FLOW_TASK_META[t].scenarioId !== 'support');
  const current = business.find((t) => flowTabMode(eventStage, t) === 'current');
  if (current) return current;
  const reachable = business.find((t) => flowTabMode(eventStage, t) !== 'future');
  return reachable ?? business[0] ?? flows[0];
}

export function ownersForFlowScenario(key: FlowScenarioKey | 'all'): SkillOwner[] {
  if (key === 'all') return ['situation', 'resource', 'plan', 'evaluation', 'interaction', 'document'];
  if (key === 'support') return ['interaction', 'document'];
  if (key === 'situation') return ['situation'];
  if (key === 'forceDelivery') return ['resource'];
  return ['plan', 'evaluation', 'resource'];
}

export function scenarioIntro(scenarioId: ScenarioId): {
  label: string;
  agentLabel: string;
  stages: EventStage[];
  handoffSummary: string;
} {
  const exact = SCENARIO_FLOW.find((s) => s.id === scenarioId) ?? SCENARIO_FLOW[2];
  return {
    label: exact.label,
    agentLabel: exact.agentLabel,
    stages: exact.stages,
    handoffSummary: exact.handoffSummary || '本场景为处置收尾与复盘归档，无下一场景交接。',
  };
}

export type FlowRecordRow = {
  id: string;
  name: string;
  source: string;
  time: string;
  verified: boolean;
};

export type FlowReceipt = {
  id: string;
  target: string;
  status: '失败' | '已送达' | '已响应';
};

/** 历史回放用的本地演示快照（不接真实接口）。 */
export type FlowSeedSnapshot = {
  records: FlowRecordRow[];
  analysis: boolean;
  reviewed: boolean;
  feedback: string;
  route: string;
  road: string;
  dispatch: boolean;
  progress: number;
  owner: string;
  targets: string[];
  warning: string;
  approved: boolean;
  receipts: FlowReceipt[];
  caseText: string;
  caseStatus: string;
  reason: string;
  published: boolean;
  cars: number;
  people: number;
  groupConfirmed: boolean;
  summaryType: string;
  summary: string;
  resources: string[][];
};

function surveyRecords(eventId: string, profile?: DisasterProfile): FlowRecordRow[] {
  const category = profile?.category ?? '';
  const occurred = profile?.occurredAt ?? '2026-09-28 18:30';
  const captured = profile?.capturedAt ?? '2026-09-28 21:00';
  const before = profile
    ? new Date(new Date(profile.occurredAt).getTime() - 30 * 60_000).toISOString()
    : '2026-09-28 18:00';
  return [
    {
      id: `${eventId}:survey:pre`,
      name: `${category}灾前现场资料（演示）`,
      source: '属地政府·微信群（非正式台账，待结构化入库）',
      time: before,
      verified: true,
    },
    {
      id: `${eventId}:survey:fax`,
      name: `${category}政府传真示意图（演示）`,
      source: '属地政府·传真（非正式台账，待结构化入库）',
      time: occurred,
      verified: true,
    },
    {
      id: `${eventId}:survey:post`,
      name: `${category}灾后先遣影像（演示）`,
      source: '先遣组（模拟）',
      time: captured,
      verified: true,
    },
  ];
}

export function buildFlowSeedSnapshot(
  eventId: string,
  profile?: DisasterProfile,
  eventName = profile?.name ?? '当前事件',
): FlowSeedSnapshot {
  const records = surveyRecords(eventId, profile);
  const risks = profile?.risks ?? '现场风险';
  const targets = ['现场安全员（演示）', '应急协调员（演示）', '技术负责人（演示）'];
  const warning =
    `${eventName}次生风险预警草稿（模拟）：关注${risks}。依据现场待核线索，请技术、安全岗位复核；关注条件变化，保持撤离路线可用。有效期与风险阈值待确认。`;
  const feedback =
    `专家组已完成隐患初评（模拟回放）：关注「${risks}」。未完成正式会签前不展开救援作业；通信与撤离路线保持可用。`;
  const caseText =
    `${eventName}复盘案例草稿：现有资料存在通信与交接缺口。建议复核作业记录，完善双通道通信与轮换交接。因果关系尚待专家确认，未经审核不作为战法。`;
  const summary = WORK_SUMMARY_REFLECT_TITLES.map((h) =>
    `${h}：${/不足|问题|启示/.test(h)
      ? '通信类、保障类（人员轮换、食物、服装）等重复短板需复核，并结合历史案例沉淀改进'
      : `根据${records.length}份已人工核对的模拟资料整理，详细内容待补`}`,
  ).join('\n');

  return {
    records,
    analysis: true,
    reviewed: true,
    feedback,
    route: '东侧绕行（示例）',
    road: '主路阻断（示例）',
    dispatch: true,
    progress: 3,
    owner: '先遣组负责人（演示）',
    targets,
    warning,
    approved: true,
    receipts: targets.map((target, i) => ({
      id: `${eventId}:receipt:${i}`,
      target,
      status: '已响应' as const,
    })),
    caseText,
    caseStatus: '已入库',
    reason: '限定内部可见（演示回放）',
    published: true,
    cars: 8,
    people: 4,
    groupConfirmed: true,
    summaryType: '反思式',
    summary,
    resources: profile
      ? [[
          profile.resources[0]?.name ?? '演示资源',
          '1',
          '可出动',
          '先遣组负责人（演示）',
          profile.capturedAt,
          eventId,
        ]]
      : [],
  };
}
