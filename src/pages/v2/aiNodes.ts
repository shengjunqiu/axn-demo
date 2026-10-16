export const V2_REPORT_KINDS = ['surroundings', 'assembly', 'plan', 'dynamics', 'transport', 'summary'] as const;
export const V2_AI_KINDS = [...V2_REPORT_KINDS, 'supplies'] as const;
export type V2AiKind = typeof V2_AI_KINDS[number];
export function isV2AiKind(value: string): value is V2AiKind {
  return (V2_AI_KINDS as readonly string[]).includes(value);
}
export const V2_AI_MODES = V2_AI_KINDS.map(kind => `v2-${kind}`);
export const V2_AI_DOCUMENT_CODES = ['RESOURCE_REPORT', 'GROUP_RECOMMENDATION', 'RESCUE_PLAN', 'SITUATION_REPORT', 'TRANSPORT_PLAN', 'WORK_SUMMARY'];
