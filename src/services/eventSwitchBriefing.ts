import { disasterProfileById } from '@/seed/disasterScenarios';
/**
 * 关联灾情切换后的安小能提示：确认切换 + 当前事件状态总结 + 可点击的下一步操作。
 * 数据全部来自模拟事实 / Vue 建设场景元数据，不接真实模型。
 */
import { factText, incidentById } from '@/seed/scenario';
import { formatDispatchSourceLines, resolveEventDispatchSource } from '@/seed/eventDispatchSource';
import { isHiddenPrototypeAction } from '@/seed/prototypeVisibility';
import { vueWorkspaceEventById, type VueWorkspaceEventMeta } from '@/seed/vueWorkspaceEvents';
import { WELCOME_QUESTIONS } from '@/seed/welcomeQuestions';
import {
  ARCHIVE_NAV_LABEL,
  filterFollowUpLabels,
  loopLabelsForStage,
  normalizeCompletedAction,
  primaryLabelsForStage,
  resolveActionPrompt,
  resolveSeedEventStage,
  scenarioForStage,
  scenarioLabelForId,
  type EventStage,
} from '@/services/agentFlow';
import { eventDisplayName, formatFactValue } from '@/services/factLookup';
import type { Session } from '@/domain/types';

export type { EventStage };
export { normalizeCompletedAction, resolveSeedEventStage };

/** 与 NAV_PATH.library 一致，避免 service 反向依赖组件层。 */
const LIBRARY_PATH = '/library';

export type EventNextStepAction = {
  label: string;
  hint: string;
  kind: 'task' | 'navigate';
  /** kind=task 时为发送文案；kind=navigate 时为路由 path。 */
  payload: string;
};

const QA_PAYLOAD = WELCOME_QUESTIONS[0]
  ?? '堤防管涌、渗漏、滑坡等险情有哪些识别征兆？对应的抢护方法是什么？';

const action = (
  label: string,
  hint: string,
  kind: EventNextStepAction['kind'] = 'task',
  payload = label,
): EventNextStepAction => ({
  label,
  hint,
  kind,
  payload: kind === 'navigate' ? LIBRARY_PATH : resolveActionPrompt(payload),
});

function actionFromLabel(label: string, stage: EventStage): EventNextStepAction {
  if (label === ARCHIVE_NAV_LABEL) {
    return action(label, '核对已生成材料，补充验收与消耗凭证', 'navigate');
  }
  if (label === '专家知识问答') {
    return action(label, '对照预案与规范要点', 'task', QA_PAYLOAD);
  }
  if (label === '返回力量投送') {
    return action(label, '增援或重编组时回到力量投送场景', 'task', '返回力量投送');
  }
  if (label === '补充态势研判') {
    return action(label, '现场态势变化时补充灾情研判', 'task', '补充态势研判');
  }
  const hints: Record<string, string> = {
    生成灾情摘要: '核对现场资料、次生风险与待核实事项',
    生成态势报告: '补充安全区域、可出动队伍与医疗资源',
    查询周边救援资源: '核对可调动队伍、装备与预计到达（模拟）',
    生成周边资源报告: '将查询结果整理为可报送材料',
    核对资源状态: '确认队伍状态与物资缺口',
    生成救援方案: '形成处置初稿，再交专业岗位审核',
    生成值班日报: '班次交接前留存处置过程',
    生成应急要情: '汇总基本情况与先期处置',
    评估救援效果: '核对目标完成率、剩余风险与评估结论',
    生成工作总结: '按模拟要素整理经验与改进',
  };
  return action(label, hints[label] ?? `${scenarioForStage(stage).label}场景相关动作`);
}

/** 优先会话演示覆盖，否则回落种子阶段。 */
export function resolveEventStage(eventId: string, session?: Session | null): EventStage {
  if (session?.eventId === eventId && session.eventStageOverride) {
    return session.eventStageOverride;
  }
  return resolveSeedEventStage(eventId);
}

function labelsToActions(labels: string[], stage: EventStage, eventId: string): EventNextStepAction[] {
  const profile = disasterProfileById.get(eventId);
  return labels
    .filter((label) => !isHiddenPrototypeAction(label))
    .map((label) => {
      const item = actionFromLabel(label, stage);
      if (profile && item.label === '专家知识问答') {
        return { ...item, payload: '查看本事件预案依据' };
      }
      return item;
    });
}

/** 按事件阶段给出可点击的下一步操作（含场景回环入口）。 */
export function buildEventNextStepActions(eventId: string, session?: Session | null): EventNextStepAction[] {
  if (!incidentById.get(eventId)) return [];
  const stage = resolveEventStage(eventId, session);
  const labels = [
    ...primaryLabelsForStage(stage),
    ...loopLabelsForStage(stage),
  ];
  if (stage === '已归档') {
    labels.push('专家知识问答', ARCHIVE_NAV_LABEL);
  }
  return labelsToActions(labels, stage, eventId);
}

/**
 * 完成某一动作后的下一步建议：动作链路 ∩ 当前阶段主推/回环。
 * session 传入时使用会话覆盖后的阶段（通常为刚推进后的阶段）。
 */
export function buildFollowUpNextStepActions(
  completedAction: string,
  eventId: string,
  session?: Session | null,
): EventNextStepAction[] {
  if (!incidentById.get(eventId)) return [];
  const stage = resolveEventStage(eventId, session);
  return labelsToActions(filterFollowUpLabels(completedAction, stage), stage, eventId);
}

function controlStatusLabel(raw: string): string {
  return formatFactValue(raw, null, 'controlStatus');
}

function clip(text: string, max = 120): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

/**
 * 生成关联 / 切换事件后的助手提示正文（不含「下一步建议」列表；
 * 操作按钮由 EventSwitchBriefingCard 根据 buildEventNextStepActions 渲染）。
 */
export function buildEventSwitchBriefing(eventId: string, session?: Session | null): string {
  const incident = incidentById.get(eventId);
  const vue = vueWorkspaceEventById.get(eventId);
  const name = eventDisplayName(eventId);
  const stage = resolveEventStage(eventId, session);
  const scenario = scenarioForStage(stage);
  const label = vue || session?.eventStageOverride
    ? `${name}（${stage}）`
    : name;

  const header = [
    `已切换关联灾情为「${label}」。`,
    '后续快捷任务与指令将基于该事件的模拟资料执行；本会话在此事件下的对话记录独立保留。',
  ].join('');

  if (!incident) {
    return [
      header,
      '',
      '【当前状态】',
      '· 未能读取该事件的授权演示资料，请改选有效灾情后再继续。',
      '',
      '以上为模拟研判提示，正式结论以值班与专业岗位核对为准。',
    ].join('\n');
  }

  const disasterType = factText(incident.factRefs.disasterType);
  const location = factText(incident.factRefs.location);
  const occurredAt = factText(incident.factRefs.occurredAt);
  const controlRaw = factText(incident.factRefs.controlStatus);
  const impact = factText(incident.factRefs.impactScope);
  const casualty = factText(incident.factRefs.casualty);
  const description = factText(incident.factRefs.incidentDescription);
  const risks = vue?.risks
    ?? (/积水|内涝/.test(disasterType)
      ? '涉水触电、车辆漂浮、地下空间进水和交通阻断'
      : '渗流发展、堤体稳定与临水作业风险');

  const handoff = session?.handoffBundle;
  const handoffLine = handoff
    ? `· 场景交接：承接自「${scenarioLabelForId(handoff.fromScenario)}」· ${handoff.versionLabel}（${handoff.verified === 'draft' ? '草稿待核' : '已确认'}）`
    : null;

  const dispatch = resolveEventDispatchSource(eventId);
  const dispatchLines = dispatch ? formatDispatchSourceLines(dispatch) : [];

  const statusLines = [
    `· 建设场景：${scenario.label}（主责 ${scenario.agentLabel}）`,
    `· 阶段：${stage}`,
    handoffLine,
    `· 类型：${disasterType || '待核实'}`,
    `· 位置：${location || '待补充'}`,
    `· 接报时间：${occurredAt || '待补充'}`,
    `· 控制状态：${controlStatusLabel(controlRaw || 'ongoing')}`,
    `· 影响范围：${impact || '待核实'}`,
    `· 人员情况：${casualty || '人员伤亡情况待核实'}`,
    `· 主要风险：${risks}`,
    `· 概况：${clip(description || '暂无概况说明')}`,
  ].filter(Boolean) as string[];

  return [
    header,
    '',
    '【当前状态】',
    ...statusLines,
    '',
    '【事件派发来源】',
    ...(dispatchLines.length
      ? dispatchLines
      : ['· 未能读取一期接报/派发字段，请在原系统信息接报模块核对。']),
    '',
    '以上为模拟研判提示，正式结论以值班与专业岗位核对为准；AI 建议不自动推进原系统审批状态。派发来源字段对齐一期「任务来源 / 信息类型 / 发送·填报·调用单位」，不自动推进受理。',
  ].join('\n');
}

/** 取消关联时的短提示（无事件状态可总结）。 */
export function buildEventUnlinkBriefing(): string {
  return '已取消关联灾情。当前为空白对话，后续任务不会引用具体事件资料；可随时重新关联事件继续演示。';
}

export type { VueWorkspaceEventMeta };
