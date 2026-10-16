/**
 * 预警推送 / 资源预警通知：草稿构建与会话态类型（本地模拟，不接真实通道）。
 */
import type { DisasterProfile } from '@/seed/disasterScenarios';
import { vueDemoResourceById } from '@/seed/vueDemoResources';
import { factText, teamById } from '@/seed/scenario';
import { resourceComposition } from '@/services/tenderScenario';

export type WarningPushKind = 'situation' | 'resource';

export type FlowReceipt = {
  id: string;
  target: string;
  status: '失败' | '已送达' | '已响应';
};

export type WarningPushState = {
  kind: WarningPushKind;
  targets: string[];
  warning: string;
  approved: boolean;
  receipts: FlowReceipt[];
  updatedAt: string;
};

export const SITUATION_WARNING_TARGETS = [
  '现场安全员（演示）',
  '应急协调员（演示）',
  '技术负责人（演示）',
] as const;

export const RESOURCE_WARNING_TARGETS = [
  '先遣组负责人（演示）',
  '编组确认人（演示）',
  '资源台账维护岗（演示）',
] as const;

export function defaultTargetsForKind(kind: WarningPushKind): string[] {
  return kind === 'situation' ? [...SITUATION_WARNING_TARGETS] : [...RESOURCE_WARNING_TARGETS];
}

export function emptyWarningPushState(kind: WarningPushKind): WarningPushState {
  return {
    kind,
    targets: [],
    warning: '',
    approved: false,
    receipts: [],
    updatedAt: new Date().toISOString(),
  };
}

/** 待研判：次生风险 + 资源需求/缺口摘要。 */
export function buildSituationWarningDraft(
  _eventId: string,
  profile?: DisasterProfile,
  eventName = profile?.name ?? '当前事件',
): { targets: string[]; warning: string } {
  const risks = profile?.risks ?? '现场风险';
  const gaps = profile?.gaps ?? '资源缺口待核';
  const rows = profile ? resourceComposition(profile, 2, true) : [];
  const gapLines = rows
    .filter((r) => (r.gap ?? 0) > 0)
    .slice(0, 4)
    .map((r) => `${r.name}缺口约 ${r.gap}${r.unit}（需求 ${r.requested}${r.unit} / 现有 ${r.available}${r.unit}）`);
  const gapBlock = gapLines.length
    ? `资源需求与缺口（模拟）：${gapLines.join('；')}。`
    : `资源需求与缺口（模拟）：${gaps}。`;
  return {
    targets: [...SITUATION_WARNING_TARGETS],
    warning:
      `${eventName}次生风险预警草稿（模拟）：关注${risks}。${gapBlock}`
      + '依据现场待核线索，请技术、安全岗位复核；关注条件变化，保持撤离路线可用。有效期与风险阈值待确认。',
  };
}

export type ResourceWarningDraftOpts = {
  resourceIds?: string[];
  roadHint?: string;
};

/** 力量投送：缺口 / 状态异常 / 路况核实。 */
export function buildResourceWarningDraft(
  eventId: string,
  profile?: DisasterProfile,
  eventName = profile?.name ?? '当前事件',
  opts: ResourceWarningDraftOpts = {},
): { targets: string[]; warning: string } {
  const gaps = profile?.gaps ?? '增援缺口待核';
  const road = opts.roadHint ?? '主路阻断（示例），绕行条件待确认';
  const ids = opts.resourceIds ?? [];
  const statusLines = ids
    .map((id) => {
      const demo = vueDemoResourceById.get(id);
      if (demo) return `${demo.name}：${demo.status}`;
      const team = teamById.get(id);
      if (team) {
        const name = factText(team.factRefs.name) || id;
        return `${name}：状态待核（演示）`;
      }
      return null;
    })
    .filter((line): line is string => Boolean(line))
    .slice(0, 5);
  const statusBlock = statusLines.length
    ? `近期检索对象状态：${statusLines.join('；')}。`
    : '近期检索对象状态：尚未写入会话结果，请先完成资源智能检索或核对资源状态。';
  return {
    targets: [...RESOURCE_WARNING_TARGETS],
    warning:
      `${eventName}资源预警通知草稿（模拟）：关注${gaps}。${statusBlock}`
      + `投送路况核实：${road}。请先遣与编组岗位确认可调派力量与通行条件；未批准前不下达正式派遣。事件编号 ${eventId}。`,
  };
}

/** 历史回放用的已完成推送快照。 */
export function buildWarningPushSeed(
  kind: WarningPushKind,
  eventId: string,
  profile?: DisasterProfile,
  eventName = profile?.name ?? '当前事件',
): WarningPushState {
  const draft = kind === 'situation'
    ? buildSituationWarningDraft(eventId, profile, eventName)
    : buildResourceWarningDraft(eventId, profile, eventName, {
        roadHint: '主路阻断（示例），绕行条件待确认',
      });
  return {
    kind,
    targets: draft.targets,
    warning: draft.warning,
    approved: true,
    receipts: draft.targets.map((target, i) => ({
      id: `${eventId}:${kind}:receipt:${i}`,
      target,
      status: '已响应' as const,
    })),
    updatedAt: profile?.capturedAt ?? new Date().toISOString(),
  };
}

export function warningPushPanelTitle(kind: WarningPushKind): string {
  return kind === 'situation' ? '预警推送（态势）' : '资源预警通知';
}

export function warningPushKindForFlow(tab: string): WarningPushKind | null {
  if (tab === '预警推送') return 'situation';
  if (tab === '资源预警通知') return 'resource';
  return null;
}
