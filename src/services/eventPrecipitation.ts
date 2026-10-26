/**
 * 事件沉淀：汇总本事件案例要点，写入本地知识案例库（模拟），
 * 供后续复盘总结、演练参考等使用。
 */
import { disasterProfileById } from '@/seed/disasterScenarios';
import { RESCUE_EVALUATION_MOCK } from '@/seed/rescueEvaluation';
import { vueWorkspaceEventById } from '@/seed/vueWorkspaceEvents';
import { formatTimelineForDocument } from '@/services/eventTimeline';
import { eventDisplayName } from '@/services/factLookup';
import {
  useKnowledgeCaseStore,
  type PublishedEventCase,
} from '@/services/knowledgePublish';
import { defaultWorkSummaryImprovement } from '@/services/workSummaryWorkflow';

export type EventPrecipitationResult = {
  published: PublishedEventCase;
  reply: string;
  /** 是否更新了已有待审案例 */
  updated: boolean;
};

/** 按事件资料拼装可沉淀的案例正文（本地模拟，不接真实知识库 API）。 */
export function buildEventCaseSummary(eventId: string): { title: string; body: string; tags: string[] } {
  const name = eventDisplayName(eventId);
  const profile = disasterProfileById.get(eventId);
  const vue = vueWorkspaceEventById.get(eventId);
  const evalMock = RESCUE_EVALUATION_MOCK[eventId];
  const category = profile?.category ?? vue?.category ?? '待核实灾种';
  const location = profile?.location ?? vue?.location ?? '待补地点';
  const stage = profile?.stage ?? vue?.stage ?? '待复盘';
  const risks = profile?.risks ?? vue?.risks ?? '现场风险待核';
  const gaps = profile?.gaps ?? '验收、消耗与撤收等凭证待补';
  const description = profile?.description ?? vue?.description ?? `${name}（演示事件）`;
  const resources = profile?.resources?.length
    ? profile.resources.map((r) => `${r.name} ${r.amount}（${r.status}）`).join('；')
    : '候选人装以本事件登记为准，正式调派走原系统';
  const objective = evalMock
    ? `${evalMock.objective}：计划 ${evalMock.target}${evalMock.unit}，已完成 ${evalMock.completed}${evalMock.unit}；投入约 ${evalMock.personnel} 人 / ${evalMock.equipment} 台套；响应约 ${evalMock.responseMinutes} 分钟。`
    : profile
      ? `${profile.objective}：${profile.completed}/${profile.target}${profile.unit}`
      : '阶段目标与完成量待补核';
  const improvement = defaultWorkSummaryImprovement(eventId);
  const timeline = formatTimelineForDocument(eventId);

  const body = [
    '【事件概况】',
    `${name}（${category}）· ${location} · 阶段「${stage}」。`,
    description,
    '',
    '【处置目标与成效（模拟）】',
    objective,
    `主要风险：${risks}`,
    `待补与缺口：${gaps}`,
    '',
    '【力量与资源线索（候选≠已调派）】',
    resources,
    '',
    '【过程时间轴摘录】',
    timeline,
    '',
    '【可复用经验与改进（演练/复盘参考）】',
    improvement,
    '',
    '【适用边界】',
    '本案例为产品演示沉淀，因果关系与工法参数须经专业审核后方可用于战法库或演练教案；正式入库与权限隔离走原知识库流程。',
  ].join('\n');

  return {
    title: `${name} · 事件沉淀案例`,
    body,
    tags: ['事件沉淀', '复盘', '演练参考', category],
  };
}

/** 汇总并写入知识案例库；同事件待审沉淀记录会被更新。 */
export function runEventPrecipitation(eventId: string): EventPrecipitationResult {
  const before = useKnowledgeCaseStore.getState().cases.find(
    (c) => c.eventId === eventId && c.source === 'precipitation' && c.status === '待审',
  );
  const draft = buildEventCaseSummary(eventId);
  const published = useKnowledgeCaseStore.getState().publishEventCase({
    eventId,
    source: 'precipitation',
    title: draft.title,
    body: draft.body,
    tags: draft.tags,
    status: '待审',
  });
  const updated = !!before;
  const reply = [
    '已完成本事件案例汇总，并写入知识库「本事件已沉淀案例」（模拟 · 待审）。',
    '',
    `案例标题：${published.title}`,
    `状态：${published.status}`,
    `标签：${published.tags.join('、')}`,
    '',
    '摘要要点：',
    '· 事件概况与阶段目标/成效',
    '· 风险、缺口与候选人装线索',
    '· 过程时间轴与改进计划（责任/时限/验证）',
    '',
    updated
      ? '已更新同事件既有待审沉淀稿，可在右侧知识库查看全文并模拟审批入库。'
      : '可在右侧知识库查看全文；审批通过后可供后续复盘总结、演练教案引用（模拟）。',
    '未经审核不作为正式战法或现场作业指令。',
  ].join('\n');
  return { published, reply, updated };
}
