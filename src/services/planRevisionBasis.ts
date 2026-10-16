/**
 * 预案/方案与实际执行对照 → 预案编修依据条目（本地模拟，不写原系统）。
 */
import { disasterProfileById } from '@/seed/disasterScenarios';
import { RESCUE_EVALUATION_MOCK } from '@/seed/rescueEvaluation';
import { eventDisplayName } from '@/services/factLookup';

export type PlanRevisionDimension = '力量' | '时间节点' | '任务分工' | '风险措施';

export type PlanRevisionBasisItem = {
  id: string;
  dimension: PlanRevisionDimension;
  planExcerpt: string;
  actualExcerpt: string;
  gap: string;
  revisionHint: string;
  verified: 'draft';
};

export function buildPlanRevisionBasis(
  eventId: string,
  summaryExcerpt?: string,
): PlanRevisionBasisItem[] {
  const profile = disasterProfileById.get(eventId);
  const sample = RESCUE_EVALUATION_MOCK[eventId];
  const name = profile?.name ?? eventDisplayName(eventId);
  const planForce = profile?.planSections.find(([h]) => /力量|编组|抽组|出动/.test(h))?.[1]
    ?? profile?.resources.map((r) => `${r.name}/${r.amount}`).join('；')
    ?? '预案力量条目待核';
  const planRisk = profile?.planSections.find(([h]) => /风险|安全|撤离/.test(h))?.[1]
    ?? profile?.risks
    ?? '预案风险措施待核';
  const planDuty = profile?.planSections.find(([h]) => /指挥|分工|职责|措施/.test(h))?.[1]
    ?? (profile?.planSections[0]?.[1] ?? '任务分工以生效方案为准');
  const actualForce = sample
    ? `实际投入人员 ${sample.personnel} 人、设备 ${sample.equipment} 台（模拟作业记录）`
    : '实际调动记录不足，待补核';
  const actualTime = sample
    ? `响应 ${sample.responseMinutes} 分钟（目标 ${sample.targetMinutes} 分钟）；${sample.objective} ${sample.completed}/${sample.target}${sample.unit}`
    : '时间节点回执不足，待补核';
  const actualGap = sample?.next ?? profile?.gaps ?? '改进项待核';
  const summaryBit = summaryExcerpt?.trim()
    ? `总结摘录：${summaryExcerpt.trim().slice(0, 160)}${summaryExcerpt.length > 160 ? '…' : ''}`
    : `事件「${name}」复盘摘要待与总结正文对照`;

  return [
    {
      id: `${eventId}:rev:force`,
      dimension: '力量',
      planExcerpt: planForce.slice(0, 180),
      actualExcerpt: actualForce,
      gap: sample && sample.personnel
        ? '计划编成与实际到位人数/装备可能存在差额，须对照调派回执'
        : '缺少可核对的实际到位台账',
      revisionHint: '预案编修建议：补充主备力量门槛、装备差额触发条件与台账核对节点（模拟）。',
      verified: 'draft',
    },
    {
      id: `${eventId}:rev:time`,
      dimension: '时间节点',
      planExcerpt: `预案参考响应节点；阶段目标「${profile?.objective ?? '处置目标'}」`,
      actualExcerpt: actualTime,
      gap: sample && sample.responseMinutes > sample.targetMinutes
        ? `响应超出目标 ${sample.responseMinutes - sample.targetMinutes} 分钟（模拟）`
        : '时效偏差以正式回执为准',
      revisionHint: '预案编修建议：明确先遣到位、主力集结与阶段复盘的时限及延误升级条件（模拟）。',
      verified: 'draft',
    },
    {
      id: `${eventId}:rev:duty`,
      dimension: '任务分工',
      planExcerpt: planDuty.slice(0, 180),
      actualExcerpt: summaryBit,
      gap: profile?.gaps ?? '岗位交接与责任边界待补证',
      revisionHint: '预案编修建议：细化指挥、技术、保障岗位分工与跨班交接清单（模拟）。',
      verified: 'draft',
    },
    {
      id: `${eventId}:rev:risk`,
      dimension: '风险措施',
      planExcerpt: planRisk.slice(0, 180),
      actualExcerpt: sample?.risk ?? profile?.risks ?? '剩余风险待核',
      gap: actualGap,
      revisionHint: '预案编修建议：把复盘确认的剩余风险与撤离/通信双通道要求写入适用条款（模拟）。',
      verified: 'draft',
    },
  ];
}

/** 写入方案修订依据文本区的摘要。 */
export function formatPlanRevisionHints(items: PlanRevisionBasisItem[]): string {
  return items
    .map((item, i) =>
      `${i + 1}.【${item.dimension}】差距：${item.gap}\n预案：${item.planExcerpt}\n实际：${item.actualExcerpt}\n编修依据：${item.revisionHint}`,
    )
    .join('\n\n');
}
