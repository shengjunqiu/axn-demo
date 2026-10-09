export type DisasterSourceKind = '舆情' | '气象' | '水文' | '地质' | '现场影像' | '接报记录';
export interface DisasterSourceRecord {
  id: string;
  title: string;
  content: string;
  source: string;
  capturedAt: string;
  version: string;
  refs: string[];
  verification: '待核实' | '来源已核（模拟）';
  duplicateOf?: string;
}
export interface DisasterSourceGroup {
  kind: DisasterSourceKind;
  state: '模拟已汇聚' | '暂无记录';
  records: DisasterSourceRecord[];
  missing: string;
}
export interface DisasterSourceEvent {
  eventId: string;
  title: string;
  location: string;
  sources: DisasterSourceGroup[];
}
export interface MultiSourceSnapshot {
  gatheredAt: string;
  event: DisasterSourceEvent;
  domainEvents: DisasterSourceEvent[];
  scopeLabel: string;
}
