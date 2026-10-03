/**
 * 派生事实计算（derivedFactDefinitions 的运行时实现）。
 * 只依赖种子与运行时输入，不写死模拟期望值（expectedChecks 仅用于测试断言）。
 */
import type { FactValue } from '@/domain/types';
import { factById, factNumber, shift, teamById, DEMO_CLOCK, incidentById } from './scenario';

export type DerivedKey =
  | 'candidate_team_count'
  | 'candidate_people_count'
  | 'candidate_excavator_count'
  | 'daily_incident_count'
  | 'daily_ongoing_count'
  | 'daily_controlled_count';

export interface DerivedResult {
  key: DerivedKey;
  value: number;
  unit: string | null;
  formula: string;
  inputSummary: string;
  inputFactIds: string[];
}

function eventOccurredAt(eventId: string): string | null {
  const fact = factById.get(incidentById.get(eventId)?.factRefs.occurredAt ?? '');
  if (fact) return String(fact.value ?? '');
  return null;
}

export function computeDerived(
  key: DerivedKey,
  candidateResourceIdsRaw: string[],
  frozen?: { facts: Record<string, { value: FactValue }>; clock: string },
): DerivedResult {
  const valueOf = (id: string) => frozen ? frozen.facts[id]?.value : factById.get(id)?.value;
  // 去重：同一资源重复出现在候选集合中只计一次
  const candidateResourceIds = [...new Set(candidateResourceIdsRaw)];
  if (key === 'candidate_team_count') {
    const ids = candidateResourceIds.filter((id) => teamById.has(id));
    return {
      key,
      value: ids.length,
      unit: '支',
      formula: 'COUNT(DISTINCT candidateResourceIds)',
      inputSummary: ids.length ? ids.join('、') : '无候选力量',
      inputFactIds: ids.map(id => teamById.get(id)!.factRefs.name),
    };
  }
  if (key === 'candidate_people_count' || key === 'candidate_excavator_count') {
    const ids = candidateResourceIds.filter((id) => teamById.has(id));
    const field = key === 'candidate_people_count' ? 'peopleCount' : 'excavatorCount';
    const unit = key === 'candidate_people_count' ? '人' : '台';
    let sum = 0;
    const inputFactIds: string[] = [];
    const names: string[] = [];
    for (const id of ids) {
      const team = teamById.get(id)!;
      const factId = team.factRefs[field];
      const v = frozen ? Number(valueOf(factId)) : factNumber(factId);
      inputFactIds.push(factId);
      if (v != null) sum += v;
      names.push(String(valueOf(team.factRefs.name) ?? id));
    }
    return {
      key,
      value: sum,
      unit,
      formula: `SUM(selectedTeams.${field})`,
      inputSummary: names.length ? names.join('、') : '无候选力量',
      inputFactIds,
    };
  }
  // 班次统计：shift.incidentIds 中 occurredAt 落在班次区间内的事件
  const eventIds = shift.incidentIds;
  const started = new Date(shift.startsAt).getTime();
  const clock = new Date(frozen?.clock ?? DEMO_CLOCK).getTime();
  const inShift = eventIds.filter((id) => {
    const at = frozen ? String(valueOf(incidentById.get(id)?.factRefs.occurredAt ?? '') ?? '') : eventOccurredAt(id);
    if (!at) return false;
    const t = new Date(at).getTime();
    return t >= started && t <= clock;
  });
  if (key === 'daily_incident_count') {
    return {
      key,
      value: inShift.length,
      unit: '起',
      formula: 'COUNT(DISTINCT eventId)',
      inputSummary: `班次内接报事件：${inShift.join('、') || '无'}`,
      inputFactIds: eventIds.map(id => incidentById.get(id)!.factRefs.occurredAt),
    };
  }
  if (key === 'daily_ongoing_count' || key === 'daily_controlled_count') {
    const field = 'controlStatus';
    const target = key === 'daily_ongoing_count' ? 'ongoing' : 'controlled';
    let count = 0;
    const matched: string[] = [];
    for (const id of inShift) {
      const factId = incidentById.get(id)?.factRefs[field] ?? '';
      const v = String(valueOf(factId) ?? '');
      const label = factById.get(incidentById.get(id)?.factRefs.title ?? '');
      if (v === target) {
        count += 1;
        matched.push(String(label?.value ?? id));
      }
    }
    return {
      key,
      value: count,
      unit: '起',
      formula: `COUNT(controlStatus == ${target})`,
      inputSummary: matched.length ? matched.join('、') : '无',
      inputFactIds: eventIds.flatMap(id => [incidentById.get(id)!.factRefs.occurredAt, incidentById.get(id)!.factRefs.controlStatus]),
    };
  }
  throw new Error(`未实现的派生事实：${key}`);
}

export const DERIVED_META: Record<DerivedKey, { label: string }> = {
  candidate_team_count: { label: '候选队伍数' },
  candidate_people_count: { label: '候选人员总数' },
  candidate_excavator_count: { label: '候选挖掘机总数' },
  daily_incident_count: { label: '班次接报总数' },
  daily_ongoing_count: { label: '处置中事件数' },
  daily_controlled_count: { label: '已控制事件数' },
};
