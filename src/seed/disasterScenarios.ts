import type { FixtureKnowledge } from './scenario';
/** 当前聚焦三类实战场景：洪涝决口、山体滑坡、泥石流；地点、数值、预案均为本地模拟。 */
import rawProfiles from './disasterScenarios.json';
import { buildDisasterSections } from './documentTemplates';
import type { VueWorkspaceEventMeta } from './vueWorkspaceEvents';
import type { VueDemoResource } from './vueDemoResources';

export interface DisasterProfile {
  eventId: string; name: string; category: string; location: string;
  stage: VueWorkspaceEventMeta['stage']; risks: string; impactScope: string; casualty: string;
  occurredAt: string; capturedAt: string; description: string;
  monitoring: { label: string; unit: string; times: string[]; values: number[]; source: string }[];
  riskDistribution: { area: string; count: number }[];
  resources: { name: string; kind: VueDemoResource['kind']; amount: string; capability: string; status: string }[];
  planTitle: string; planSections: [string, string][]; gaps: string;
  objective: string; target: number; completed: number; unit: string;
}

/**
 * 关联灾情仅挂三类作战场景（山体滑坡 / 洪涝决口 / 泥石流）。
 * 每类再按建设阶段展开为可选事件：待研判 → 力量投送中 → 救援中 → 待复盘。
 * 种子 JSON 中的「主阶段」事件保留原 ID（无后缀），其余阶段用后缀变体。
 */
export const BASE_FOCUS_COMBAT_EVENT_IDS = ['evt-sim-landslide', 'evt-sim-breach', 'evt-sim-debris'] as const;
export type FocusCombatEventId = (typeof BASE_FOCUS_COMBAT_EVENT_IDS)[number];
/** @deprecated 使用 BASE_FOCUS_COMBAT_EVENT_IDS；保留别名避免外部引用断裂。 */
export const FOCUS_COMBAT_EVENT_IDS = BASE_FOCUS_COMBAT_EVENT_IDS;
export const DEFAULT_FOCUS_COMBAT_EVENT_ID: FocusCombatEventId = 'evt-sim-landslide';

/** 关联灾情下拉展示的建设阶段（不含已归档，避免选项过多）。 */
export const FOCUS_COMBAT_STAGES = ['待研判', '力量投送中', '救援中', '待复盘'] as const;
export type FocusCombatStage = (typeof FOCUS_COMBAT_STAGES)[number];

const STAGE_ID_SUFFIX: Record<FocusCombatStage, string> = {
  待研判: 'judgment',
  力量投送中: 'force',
  救援中: 'rescue',
  待复盘: 'review',
};

const STAGE_BY_SUFFIX = Object.fromEntries(
  Object.entries(STAGE_ID_SUFFIX).map(([stage, suffix]) => [suffix, stage]),
) as Record<string, FocusCombatStage>;

/** 主阶段事件 ID（JSON 种子）或阶段变体 → 三类实战基线 ID。 */
export function baseCombatEventId(eventId: string): string {
  for (const base of BASE_FOCUS_COMBAT_EVENT_IDS) {
    if (eventId === base || eventId.startsWith(`${base}-`)) return base;
  }
  return eventId;
}

export function isFocusCombatEvent(eventId: string): boolean {
  return (BASE_FOCUS_COMBAT_EVENT_IDS as readonly string[]).some(
    (base) => eventId === base || eventId.startsWith(`${base}-`),
  );
}

/** 变体事件 ID：主阶段沿用基线 ID，其余为 `{base}-{suffix}`。 */
export function focusCombatEventIdForStage(baseEventId: FocusCombatEventId, stage: FocusCombatStage): string {
  const base = DISASTER_PROFILES.find((p) => p.eventId === baseEventId);
  if (base && base.stage === stage) return baseEventId;
  return `${baseEventId}-${STAGE_ID_SUFFIX[stage]}`;
}

export function focusCombatStageFromEventId(eventId: string): FocusCombatStage | undefined {
  const baseId = baseCombatEventId(eventId);
  if (!isFocusCombatEvent(eventId)) return undefined;
  if (eventId === baseId) {
    return DISASTER_PROFILES.find((p) => p.eventId === baseId)?.stage as FocusCombatStage | undefined;
  }
  const suffix = eventId.slice(baseId.length + 1);
  return STAGE_BY_SUFFIX[suffix];
}

/**
 * 将持久化/历史事件收敛到当前可选实战场景。
 * 空白对话（evt-blank-*）保留；已下线灾种回落到默认山体滑坡。
 */
export function resolveSelectableEventId(eventId: string | undefined | null): string | undefined {
  if (!eventId) return undefined;
  if (eventId.startsWith('evt-blank-')) return eventId;
  if (isFocusCombatEvent(eventId)) return eventId;
  return DEFAULT_FOCUS_COMBAT_EVENT_ID;
}

/** JSON 种子：每类实战场景一条主阶段画像（灾种库 / 隔离单测用）。 */
export const DISASTER_PROFILES = rawProfiles as DisasterProfile[];

/** 关联灾情可选：三类实战 × 四阶段。 */
export const SELECTABLE_DISASTER_PROFILES: DisasterProfile[] = DISASTER_PROFILES.flatMap((base) =>
  FOCUS_COMBAT_STAGES.map((stage) => {
    const eventId = focusCombatEventIdForStage(base.eventId as FocusCombatEventId, stage);
    if (eventId === base.eventId) return base;
    const progressBoost =
      stage === '力量投送中' ? 0.35 : stage === '救援中' ? 0.7 : stage === '待复盘' ? 1 : 0;
    return {
      ...base,
      eventId,
      stage,
      completed: Math.min(base.target, Math.round(base.target * progressBoost) || base.completed),
      gaps:
        stage === '待复盘'
          ? `${base.gaps}；现场处置已基本收口，待复盘归档（模拟）。`
          : base.gaps,
    };
  }),
);

export const disasterProfileById = new Map(SELECTABLE_DISASTER_PROFILES.map((p) => [p.eventId, p]));

export function disasterMonitoringText(p: DisasterProfile): string {
  return p.monitoring.map(m => `${m.label}（${m.unit}）：${m.times.map((time, i) => `${time} ${m.values[i]}`).join(' → ')}；${m.source}`).join('\n');
}

/** 主战法章节（planSections 中标题含「主战法」）。 */
export function disasterTacticSection(p: DisasterProfile): [string, string] | undefined {
  return p.planSections.find(([h]) => h.includes('主战法'));
}

/** 关键监测最新读数，供预案摘要条展示。 */
export function disasterKeyReadings(p: DisasterProfile, limit = 6): { label: string; value: string; source: string }[] {
  return p.monitoring.slice(0, limit).map((m) => ({
    label: m.label,
    value: `${m.values.at(-1) ?? '缺测'}${m.unit}（${m.times.at(-1) ?? ''}）`,
    source: m.source,
  }));
}
export function disasterResourcesText(p: DisasterProfile): string {
  return p.resources.map(r => `${r.name} / ${r.amount} / ${r.capability} / ${r.status}`).join('\n');
}
/** 一期对齐骨架填充；委托 documentTemplates，避免双套章节漂移。 */
export function disasterDocumentSections(eventId: string, code: string): [string, string][] | undefined {
  const p = disasterProfileById.get(eventId);
  if (!p) return undefined;
  return buildDisasterSections(p, code);
}

function toWorkspaceEvent(p: DisasterProfile): VueWorkspaceEventMeta {
  return {
    eventId: p.eventId,
    name: p.name,
    category: p.category,
    stage: p.stage,
    risks: p.risks,
    description: p.description,
    location: p.location,
    occurredAt: p.occurredAt,
    controlStatus: p.stage === '待复盘' || p.stage === '已归档' ? 'controlled' : 'ongoing',
    impactScope: `${p.impactScope}（模拟）`,
    casualty: p.casualty,
    resourcesNote: disasterResourcesText(p),
    equipment: { name: p.resources[1].name, quantity: p.resources[1].amount },
    timeline: [
      { time: '08:30', title: '模拟接报', detail: p.description, tone: 'done' },
      ...p.monitoring[0].times.map((time, i) => ({
        time,
        title: `${p.monitoring[0].label}记录`,
        detail: `${p.monitoring[0].values[i]} ${p.monitoring[0].unit}（模拟）；${p.monitoring[0].source}`,
        tone: 'done' as const,
      })),
      {
        time: '当前',
        title: p.stage,
        detail: `${p.objective} ${p.completed}/${p.target}${p.unit}（模拟）；${p.gaps}`,
        tone: 'active',
      },
    ],
  };
}

/** 关联灾情下拉 / 智能体按阶段筛选：三类实战 × 四阶段。 */
export const disasterWorkspaceEvents: VueWorkspaceEventMeta[] = SELECTABLE_DISASTER_PROFILES.map(toWorkspaceEvent);

const SCHEMATIC_SLOTS = [
  { x: 240, y: 170 },
  { x: 620, y: 200 },
  { x: 700, y: 390 },
  { x: 320, y: 420 },
] as const;

export const disasterDemoResources: VueDemoResource[] = SELECTABLE_DISASTER_PROFILES.flatMap((p) =>
  p.resources.map((r, i) => ({
    id: `${p.eventId}-resource-${i + 1}`,
    eventId: p.eventId,
    kind: r.kind,
    name: r.name,
    capability: r.capability,
    amountLabel: r.amount,
    status: r.status,
    location: p.location,
    distanceLabel: '未接真实定位（示意）',
    schematicPosition: SCHEMATIC_SLOTS[i] ?? { x: 240 + i * 180, y: 170 + i * 90 },
    selectable: true,
  })),
);

export const disasterKnowledgeChunks: FixtureKnowledge[] = SELECTABLE_DISASTER_PROFILES.map((p) => ({
  chunkId: `kb-${p.eventId}`,
  title: p.planTitle,
  category: p.category,
  version: 'V1-demo',
  isMock: true,
  effectiveStatus: '模拟参考待审',
  sourceLabel: `${p.category}预案样例（本地模拟，非正式集团预案）`,
  content: p.planSections.map(([h, b]) => `${h}：${b}`).join('\n'),
  notice: `${p.gaps}；仅产品演示，需专业复核。`,
}));
