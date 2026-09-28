/**
 * 统一事实查询：种子事实 + 人工补录事实 + 监测数据更新覆盖。
 * 所有展示与文书绑定都通过这里取值，禁止各页面直连种子常量。
 */
import type { FactValue } from '@/domain/types';
import { factById, sourceById } from '@/seed/scenario';
import { useDemoStore } from '@/store/demoStore';

export interface ResolvedFact {
  factId: string;
  value: FactValue;
  unit: string | null;
  valueType: 'string' | 'number' | 'datetime' | 'string[]';
  sourceRecordId: string;
  sourceFieldKey: string;
  sourceVersion: number;
  capturedAt: string;
  verification: 'confirmed' | 'pending' | 'suggested';
  sourceSystem: string;
  sourceLabel: string;
  dataMode: 'mock';
  isSimulated: boolean;
}

export function resolveFact(factId: string): ResolvedFact | null {
  const demo = useDemoStore.getState();
  const manual = demo.manualFacts.find((m) => m.factId === factId);
  if (manual) {
    return {
      factId: manual.factId,
      value: manual.value,
      unit: null,
      valueType: 'string',
      sourceRecordId: manual.sourceRecordId,
      sourceFieldKey: manual.field,
      sourceVersion: 1,
      capturedAt: manual.performedAt,
      verification: 'confirmed',
      sourceSystem: '人工补录（模拟）',
      sourceLabel: manual.sourceLabel,
      dataMode: 'mock',
      isSimulated: true,
    };
  }
  const seed = factById.get(factId);
  if (!seed) return null;
  // 监测数据更新覆盖（故障注入 water_feed_update 后）
  const wo = demo.waterOverride;
  if (wo && factId === 'fact-obs-water-005-waterLevel') {
    return {
      factId,
      value: wo.waterLevel,
      unit: '米',
      valueType: 'number',
      sourceRecordId: 'src-obs-water-006-v2',
      sourceFieldKey: 'waterLevel',
      sourceVersion: 2,
      capturedAt: wo.capturedAt,
      verification: 'confirmed',
      sourceSystem: '水情监测服务',
      sourceLabel: '水情监测服务（模拟）',
      dataMode: 'mock',
      isSimulated: true,
    };
  }
  // 审查 minor-6：水位更新后观测时间成对覆盖，避免“42.35（21:05 观测）”时间错配。
  if (wo && factId === 'fact-obs-water-005-observedAt') {
    return {
      factId,
      value: wo.capturedAt,
      unit: null,
      valueType: 'datetime',
      sourceRecordId: 'src-obs-water-006-v2',
      sourceFieldKey: 'observedAt',
      sourceVersion: 2,
      capturedAt: wo.capturedAt,
      verification: 'confirmed',
      sourceSystem: '水情监测服务',
      sourceLabel: '水情监测服务（模拟）',
      dataMode: 'mock',
      isSimulated: true,
    };
  }
  const src = sourceById.get(seed.sourceRecordId);
  return {
    factId: seed.factId,
    value: seed.value,
    unit: seed.unit,
    valueType: seed.valueType,
    sourceRecordId: seed.sourceRecordId,
    sourceFieldKey: seed.sourceFieldKey,
    sourceVersion: seed.sourceVersion,
    capturedAt: seed.capturedAt,
    verification: seed.verification,
    sourceSystem: src?.sourceSystem ?? '模拟数据源',
    sourceLabel: src?.label ?? '模拟数据源',
    dataMode: 'mock',
    isSimulated: src?.isSimulated ?? true,
  };
}

/** 枚举型事实的展示标签（避免“ongoing / awaiting_confirmation”裸露到界面与导出）。 */
const ENUM_LABELS: Record<string, Record<string, string>> = {
  controlStatus: { ongoing: '处置中（持续跟踪）', controlled: '已控制' },
  suggestionStatus: { awaiting_confirmation: '待确认', confirmed: '已确认' },
};

/** 枚举事实值 → 中文标签（供快照冻结链路复用，避免导出/打印出现裸枚举值）。 */
export function formatFactValue(value: FactValue, unit: string | null, sourceFieldKey: string): string {
  const raw = Array.isArray(value) ? value.join('、') : value == null ? '（来源缺失）' : String(value);
  const enumMap = ENUM_LABELS[sourceFieldKey];
  const label = enumMap?.[raw];
  const text = label ?? raw;
  return unit ? `${text}${unit}` : text;
}

export function factDisplay(factId: string): string {
  const f = resolveFact(factId);
  if (!f) return '（来源缺失）';
  return formatFactValue(f.value, f.unit, f.sourceFieldKey);
}

export function latestWaterLevelFactId(): string {
  return 'fact-obs-water-005-waterLevel';
}

export function currentContextVersion(): number {
  const demo = useDemoStore.getState();
  return demo.waterOverride ? 2 : 1;
}
