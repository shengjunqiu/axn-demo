/**
 * 三场景串联配置：灾情研判 → 力量投送 → 实施救援。
 * 驱动快捷 chips 推荐/折叠、阶段推进与场景交接包（演示级，不改原系统状态）。
 */
import { AGENT_QUICK_TASKS } from '@/seed/agentQuickTasks';
import { isHiddenPrototypeAction } from '@/seed/prototypeVisibility';
import { factText, incidentById } from '@/seed/scenario';
import { tenderName } from '@/seed/tenderNames';
import { vueWorkspaceEventById, type VueWorkspaceEventMeta } from '@/seed/vueWorkspaceEvents';

export type EventStage = VueWorkspaceEventMeta['stage'];

/** 事件阶段顺序（与业务流程面板、越阶段闸门共用）。 */
export const STAGE_ORDER: readonly EventStage[] = [
  '待研判',
  '力量投送中',
  '救援中',
  '待复盘',
  '已归档',
];

export function stageIndex(stage: EventStage): number {
  const idx = STAGE_ORDER.indexOf(stage);
  return idx >= 0 ? idx : STAGE_ORDER.length - 1;
}

export type ScenarioId = 'situation' | 'forceDelivery' | 'rescueOps';

export type HandoffBundle = {
  fromScenario: ScenarioId;
  toScenario: ScenarioId;
  eventId: string;
  versionLabel: string;
  summary: string;
  bullets: string[];
  verified: 'draft' | 'user_confirmed';
};

export type QuickTaskItem = (typeof AGENT_QUICK_TASKS)[number];

export type ScenarioMeta = {
  id: ScenarioId;
  label: string;
  agentLabel: string;
  stages: EventStage[];
  /** 输入框上方关键推荐（主推） */
  primaryLabels: string[];
  /** 阶段推进：完成这些动作且当前落在本场景时，进入下一阶段 */
  advanceOn: string[];
  nextStage: EventStage | null;
  handoffTo: ScenarioId | null;
  handoffSummary: string;
  handoffBullets: string[];
};

/** 特殊回环动作：文案 → 实际发送 prompt */
export const LOOP_ACTION_PROMPTS: Record<string, string> = {
  返回力量投送: '查询周边救援资源',
  补充态势研判: '生成态势报告',
};

export const SCENARIO_FLOW: ScenarioMeta[] = [
  {
    id: 'situation',
    label: '灾情研判',
    agentLabel: '态势感知智能体',
    stages: ['待研判'],
    primaryLabels: ['生成灾情摘要', '生成态势报告', '核对道路天气'],
    advanceOn: ['生成灾情摘要', '生成态势报告', '核对道路天气'],
    nextStage: '力量投送中',
    handoffTo: 'forceDelivery',
    handoffSummary: '研判草稿已形成资源需求建议，可进入力量投送核对候选力量',
    handoffBullets: ['灾情摘要与主要风险', '资源需求建议（待核）', '待核实事项清单'],
  },
  {
    id: 'forceDelivery',
    label: '力量投送',
    agentLabel: '救援资源管理智能体',
    stages: ['力量投送中'],
    primaryLabels: ['查询周边救援资源', '生成周边资源报告', '生成救援方案'],
    advanceOn: ['查询周边救援资源', '生成周边资源报告', '生成救援方案'],
    nextStage: '救援中',
    handoffTo: 'rescueOps',
    handoffSummary: '资源/编组建议已就绪，可进入实施救援编制处置方案',
    handoffBullets: ['周边可调力量与缺口', '编组/投送要点（演示）', '未决核实事项'],
  },
  {
    id: 'rescueOps',
    label: '实施救援',
    agentLabel: '救援方案生成智能体 / 救援效果评估智能体',
    stages: ['救援中', '待复盘', '已归档'],
    primaryLabels: [],
    advanceOn: ['评估救援效果', '生成工作总结'],
    nextStage: null,
    handoffTo: null,
    handoffSummary: '',
    handoffBullets: [],
  },
];

const RESCUE_PRIMARY: Record<'救援中' | '待复盘' | '已归档', string[]> = {
  救援中: ['生成救援方案', '生成应急要情', '生成会议纪要', '核对资源状态'],
  待复盘: ['评估救援效果', '生成工作总结', '生成全面总结'],
  已归档: [],
};

/** 导航类主推（非 AGENT_QUICK_TASKS） */
export const ARCHIVE_NAV_LABEL = '打开文书箱';

/** 将任务标题 / 快捷入口文案归一到演示动作键（与 eventSwitchBriefing 共用语义）。 */
export function normalizeCompletedAction(raw: string): string {
  const text = raw.replace(/\s+/g, '').trim();
  if (!text) return '';
  if (/全面总结/.test(text)) return '生成全面总结';
  if (/工作总结/.test(text)) return '生成工作总结';
  if (/值班日报/.test(text)) return '生成值班日报';
  if (/应急要情/.test(text)) return '生成应急要情';
  if (/评估救援|救援效果/.test(text)) return '评估救援效果';
  if (/总结报告/.test(text)) return '生成总结报告';
  if (/投入偏差/.test(text)) return '分析投入偏差';
  if (/周边资源报告/.test(text)) return '生成周边资源报告';
  if (/核对资源/.test(text)) return '核对资源状态';
  if (/核对道路天气|道路与天气/.test(text)) return '核对道路天气';
  if (/查询周边|周边救援资源/.test(text)) return '查询周边救援资源';
  if (/救援方案|处置建议/.test(text)) return /处置建议/.test(text) ? '形成处置建议' : '生成救援方案';
  if (/态势报告/.test(text)) return '生成态势报告';
  if (/灾情摘要|灾情研判|汇总灾情/.test(text)) return '生成灾情摘要';
  if (/知识问答|专家知识/.test(text)) return /专家/.test(text) ? '专家知识问答' : '知识问答';
  if (/返回力量投送/.test(text)) return '返回力量投送';
  if (/补充态势研判/.test(text)) return '补充态势研判';
  return raw.trim();
}

/** 仅读种子/事实，不含会话覆盖。 */
export function resolveSeedEventStage(eventId: string): EventStage {
  const vue = vueWorkspaceEventById.get(eventId);
  if (vue) return vue.stage;
  const incident = incidentById.get(eventId);
  const raw = incident ? factText(incident.factRefs.controlStatus) : '';
  return raw === 'controlled' ? '待复盘' : '救援中';
}

export function scenarioForStage(stage: EventStage): ScenarioMeta {
  return SCENARIO_FLOW.find((s) => s.stages.includes(stage)) ?? SCENARIO_FLOW[2];
}

export function resolveScenarioId(stage: EventStage): ScenarioId {
  return scenarioForStage(stage).id;
}

export function primaryLabelsForStage(stage: EventStage): string[] {
  if (stage === '待研判') return SCENARIO_FLOW[0].primaryLabels;
  if (stage === '力量投送中') return SCENARIO_FLOW[1].primaryLabels;
  if (stage === '救援中' || stage === '待复盘' || stage === '已归档') {
    return RESCUE_PRIMARY[stage];
  }
  return [];
}

/** 实施救援阶段的回环入口 */
export function loopLabelsForStage(stage: EventStage): string[] {
  if (stage === '救援中') return ['返回力量投送', '补充态势研判'];
  if (stage === '待复盘') return ['补充态势研判'];
  return [];
}

export function splitQuickTasksByStage(stage: EventStage | null): {
  primary: QuickTaskItem[];
  secondary: QuickTaskItem[];
  scenarioLabel: string | null;
  agentLabel: string | null;
} {
  const visibleTasks = AGENT_QUICK_TASKS.filter((t) => !isHiddenPrototypeAction(t.label));
  if (!stage) {
    return {
      primary: [],
      secondary: [...visibleTasks],
      scenarioLabel: null,
      agentLabel: null,
    };
  }
  const scenario = scenarioForStage(stage);
  const primarySet = new Set(primaryLabelsForStage(stage));
  const primary = visibleTasks.filter((t) => primarySet.has(t.label));
  const secondary = visibleTasks.filter((t) => !primarySet.has(t.label));
  return {
    primary,
    secondary,
    scenarioLabel: scenario.label,
    agentLabel: scenario.agentLabel,
  };
}

export type StageAdvanceResult = {
  nextStage: EventStage | null;
  handoff: HandoffBundle | null;
  advanced: boolean;
};

/**
 * 根据已完成动作与当前阶段计算是否推进，并生成交接包。
 * 调用方负责写入 session；本函数无副作用。
 */
export function computeStageAdvance(
  currentStage: EventStage,
  completedActionRaw: string,
  eventId: string,
  completedCount = 0,
): StageAdvanceResult {
  const key = normalizeCompletedAction(completedActionRaw);
  if (!key) return { nextStage: null, handoff: null, advanced: false };

  if (currentStage === '救援中' && key === '评估救援效果') {
    return {
      nextStage: '待复盘',
      handoff: {
        fromScenario: 'rescueOps',
        toScenario: 'rescueOps',
        eventId,
        versionLabel: `复盘评估 v${completedCount + 1}`,
        summary: '已形成效果评估草稿，可整理工作总结并核对文书',
        bullets: ['计划与实际对照要点', '剩余风险与改进建议', '资料完整度待核项'],
        verified: 'draft',
      },
      advanced: true,
    };
  }

  if (currentStage === '待复盘' && key === '生成工作总结') {
    return {
      nextStage: '已归档',
      handoff: {
        fromScenario: 'rescueOps',
        toScenario: 'rescueOps',
        eventId,
        versionLabel: `工作总结 v${completedCount + 1}`,
        summary: '总结草稿已生成（演示归档终点），正式归档仍走原系统',
        bullets: ['处置过程与不足', '改进计划', '待审知识候选'],
        verified: 'draft',
      },
      advanced: true,
    };
  }

  const scenario = scenarioForStage(currentStage);
  if (!scenario.advanceOn.includes(key) || !scenario.nextStage || !scenario.handoffTo) {
    return { nextStage: null, handoff: null, advanced: false };
  }

  const versionLabel =
    scenario.id === 'situation'
      ? `研判草稿 v${completedCount + 1}`
      : scenario.id === 'forceDelivery'
        ? `投送建议 v${completedCount + 1}`
        : `交接 v${completedCount + 1}`;

  return {
    nextStage: scenario.nextStage,
    handoff: {
      fromScenario: scenario.id,
      toScenario: scenario.handoffTo,
      eventId,
      versionLabel,
      summary: scenario.handoffSummary,
      bullets: scenario.handoffBullets,
      verified: 'draft',
    },
    advanced: true,
  };
}

/** 动作链路：完成后的候选下一步（再与阶段主推求交） */
export const ACTION_FOLLOW_UP_LABELS: Record<string, string[]> = {
  生成灾情摘要: ['生成态势报告', '查询周边救援资源', '生成救援方案'],
  生成态势报告: ['查询周边救援资源', '生成救援方案', '生成应急要情'],
  查询周边救援资源: ['生成周边资源报告', '生成救援方案', '核对资源状态'],
  生成周边资源报告: ['生成救援方案', '打开文书箱'],
  核对资源状态: ['查询周边救援资源', '生成救援方案'],
  生成救援方案: ['生成应急要情', '生成会议纪要', '评估救援效果', '返回力量投送'],
  形成处置建议: ['生成应急要情', '生成会议纪要', '评估救援效果'],
  评估救援效果: ['生成工作总结', '打开文书箱'],
  生成总结报告: ['生成工作总结', '打开文书箱'],
  分析投入偏差: ['评估救援效果', '生成工作总结'],
  生成工作总结: ['打开文书箱', '专家知识问答'],
  生成值班日报: ['生成应急要情', '打开文书箱'],
  生成应急要情: ['生成会议纪要', '打开文书箱'],
  生成会议纪要: ['生成应急要情', '打开文书箱'],
  知识问答: ['生成灾情摘要', '打开文书箱'],
  专家知识问答: ['生成灾情摘要', '打开文书箱'],
};

/**
 * 过滤 follow-up：优先保留「动作链路 ∩（阶段主推 ∪ 回环）」；
 * 若交集为空则回落阶段主推（排除刚完成项），并附加回环入口。
 */
export function filterFollowUpLabels(
  completedActionRaw: string,
  stage: EventStage,
): string[] {
  const key = normalizeCompletedAction(completedActionRaw);
  const primary = new Set([
    ...primaryLabelsForStage(stage),
    ...loopLabelsForStage(stage),
  ]);
  if (stage === '已归档') {
    primary.add('专家知识问答');
    primary.add(ARCHIVE_NAV_LABEL);
  }

  const chained = ACTION_FOLLOW_UP_LABELS[key] ?? [];
  const intersected = chained.filter((label) => primary.has(label) || label === ARCHIVE_NAV_LABEL);
  if (intersected.length > 0) {
    return unique(intersected.filter((label) => normalizeCompletedAction(label) !== key));
  }

  const fallback = [
    ...primaryLabelsForStage(stage),
    ...loopLabelsForStage(stage),
  ];
  if (stage === '已归档') fallback.push('专家知识问答', ARCHIVE_NAV_LABEL);
  return unique(fallback.filter((label) => normalizeCompletedAction(label) !== key));
}

function unique(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (isHiddenPrototypeAction(item)) continue;
    if (seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

export function scenarioLabelForId(id: ScenarioId): string {
  return SCENARIO_FLOW.find((s) => s.id === id)?.label ?? id;
}

/** 解析发送文案：回环按钮映射到真实 prompt。 */
export function resolveActionPrompt(label: string): string {
  return LOOP_ACTION_PROMPTS[label] ?? label;
}

/**
 * 快捷/文书动作的「最早可执行阶段」。
 * 仅用于拦截尚未到达的未来动作；已过去阶段允许回补，不在此表限制。
 */
export const ACTION_MIN_STAGE: Record<string, EventStage> = {
  生成灾情摘要: '待研判',
  生成态势报告: '待研判',
  核对道路天气: '待研判',
  态势研判预警: '待研判',
  查询周边救援资源: '力量投送中',
  生成周边资源报告: '力量投送中',
  生成救援方案: '力量投送中',
  形成处置建议: '力量投送中',
  核对资源状态: '力量投送中',
  生成应急要情: '救援中',
  生成会议纪要: '救援中',
  评估救援效果: '待复盘',
  生成工作总结: '待复盘',
  生成全面总结: '待复盘',
  生成总结报告: '待复盘',
  分析投入偏差: '待复盘',
};

export function minStageForAction(labelRaw: string): EventStage | null {
  const key = normalizeCompletedAction(resolveActionPrompt(labelRaw));
  if (!key) return null;
  return ACTION_MIN_STAGE[key] ?? ACTION_MIN_STAGE[labelRaw.trim()] ?? null;
}

/** 动作所属阶段是否严格晚于当前事件阶段（越阶段）。 */
export function isActionAheadOfStage(currentStage: EventStage, labelRaw: string): boolean {
  const min = minStageForAction(labelRaw);
  if (!min) return false;
  return stageIndex(min) > stageIndex(currentStage);
}

/** 越阶段点击时的安小能纠错回复（演示口吻）。 */
export function buildStageMismatchReply(currentStage: EventStage, labelRaw: string): string {
  const action = resolveActionPrompt(labelRaw).trim() || labelRaw.trim();
  const actionName = tenderName(action);
  const min = minStageForAction(action);
  const scenario = scenarioForStage(currentStage);
  const neededScenario = min ? scenarioForStage(min) : null;
  const suggestions = primaryLabelsForStage(currentStage)
    .filter((label) => !isHiddenPrototypeAction(label))
    .map((label) => `「${tenderName(label)}」`);
  const suggestLine = suggestions.length > 0
    ? `建议先完成当前阶段主推：${suggestions.join('、')}。`
    : '请先完成本阶段必要动作，再进入后续环节。';
  const needLine = min && neededScenario
    ? `「${actionName}」属于「${neededScenario.label}」场景（阶段：${min}），当前尚未到达。`
    : `「${actionName}」尚不适合在当前阶段执行。`;
  return [
    `当前事件处于「${scenario.label}」场景（阶段：${currentStage}）。`,
    needLine,
    suggestLine,
    '演示说明：阶段推进后即可使用该动作；也可继续使用当前阶段相关提问或快捷任务。',
  ].join('');
}
