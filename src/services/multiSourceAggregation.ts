import { disasterProfileById } from '@/seed/disasterScenarios';
/** 六源汇聚的确定性原型：真实源字段保留引用，新来源仅为明确标识的模拟记录。 */
import type { DisasterSourceEvent, DisasterSourceGroup, DisasterSourceKind, DisasterSourceRecord, MultiSourceSnapshot } from '@/domain/multiSource';
import { DEMO_CLOCK, incidentById, shift } from '@/seed/scenario';
import { factDisplay, latestWaterLevelFactId, resolveFact, shiftEventIds } from './factLookup';

export const DISASTER_SOURCE_KINDS: DisasterSourceKind[] = ['舆情', '气象', '水文', '地质', '现场影像', '接报记录'];
function sourceEvent(eventId: string): DisasterSourceEvent {
  const incident = incidentById.get(eventId);
  const scope = { kind: 'event' as const, eventId };
  const titleFact = incident && resolveFact(incident.factRefs.title, scope);
  const title = titleFact ? factDisplay(incident!.factRefs.title, scope) : '未关联有效事件';
  const location = incident ? factDisplay(incident.factRefs.location, scope) : '位置待核';
  const sources: DisasterSourceGroup[] = DISASTER_SOURCE_KINDS.map(kind => ({ kind, state: '暂无记录', records: [], missing: `${kind}授权接口未接入，当前事件暂无可用记录。` }));
  const put = (kind: DisasterSourceKind, records: DisasterSourceRecord[]) => {
    const group = sources.find(s => s.kind === kind)!;
    group.records = records; group.state = '模拟已汇聚'; group.missing = '';
  };
  if (!incident || !titleFact) return { eventId, title, location, sources };
  const receipt = resolveFact(incident.factRefs.description ?? incident.factRefs.title, scope)!;
  if (receipt) put('接报记录', [{ id: receipt.sourceRecordId, title: '原接报与事件资料', content: `${title}；${location}；${factDisplay(incident.factRefs.disasterType, scope)}；接报/发生时间 ${factDisplay(incident.factRefs.occurredAt, scope)}。`, source: receipt.sourceLabel, capturedAt: receipt.capturedAt, version: `V${receipt.sourceVersion}`, refs: [receipt.factId, incident.factRefs.location, incident.factRefs.disasterType, incident.factRefs.occurredAt].filter(id => Boolean(id && resolveFact(id, scope))), verification: receipt.verification === 'confirmed' ? '来源已核（模拟）' : '待核实' }]);
  const waterId = latestWaterLevelFactId(eventId);
  const water = waterId && resolveFact(waterId, scope);
  if (water) put('水文', [{ id: water.sourceRecordId, title: '水情监测快照', content: `最新水位 ${factDisplay(water.factId, scope)}；历史快照，不外推趋势。`, source: water.sourceLabel, capturedAt: water.capturedAt, version: `V${water.sourceVersion}`, refs: [water.factId], verification: water.verification === 'confirmed' ? '来源已核（模拟）' : '待核实' }]);
  // 只为明确的演示事件配置新来源样例，其他事件缺项保持缺项。
  if (eventId === 'evt-demo-001') {
    const sample = (kind: DisasterSourceKind, id: string, content: string, channel?: string): DisasterSourceRecord => ({ id: `${eventId}-${id}`, title: `${kind}线索样例`, content, source: channel ?? `${kind}接入适配器（本地模拟）`, capturedAt: DEMO_CLOCK, version: 'V1-demo', refs: [`demo-source:${eventId}:${id}`], verification: '待核实' });
    put('舆情', [sample('舆情', 'public-01', `${location}附近存在险情讨论，需与接报地点、时间和现场反馈核对；不据此推断伤亡。`), { ...sample('舆情', 'public-02', '转发同一险情线索，自动归并到首条记录，保留转发来源。'), duplicateOf: `${eventId}-public-01` }]);
    put('气象', [sample('气象', 'weather-01', '降雨背景资料样例；降雨量、预警级别及有效期未取得，保留待补，不生成未来天气结论。')]);
    put('地质', [sample('地质', 'geology-01', '工程地质资料目录样例；土层、渗透参数与现场勘察报告待补，不能判定堤体稳定。')]);
    put('现场影像', [
      sample('现场影像', 'image-01', '现场影像线索登记样例；原文件、拍摄位置与时间待核。未接入视觉模型，不声称已识别隐患。'),
      sample('现场影像', 'gov-wechat', `${location}属地政府通过应急厅微信群转发的示意图与文字说明（演示）。非正式台账，待结构化入库。`, '属地政府·微信群（本地模拟）'),
      sample('现场影像', 'gov-fax', `${location}属地政府传真件目录登记（演示）。非正式台账，待结构化入库。`, '属地政府·传真（本地模拟）'),
    ]);
  }
  const profile = disasterProfileById.get(eventId);
  if (profile) {
    for (const kind of ['气象', '水文', '地质'] as const) {
      const indicators = profile.monitoring.filter(m => kind === '气象' ? /雨量|气温|积雪/.test(m.label) : kind === '水文' ? /水位|流量|抽排|涌水|渗漏|积水/.test(m.label) : /位移|裂缝|余震/.test(m.label));
      if (indicators.length) put(kind, indicators.map((m,i) => ({ id: `${eventId}-${kind}-${i}`, title: `${m.label}样例记录`, content: m.times.map((t,j) => `${t} ${m.values[j]}${m.unit}`).join('；'), source: m.source, capturedAt: profile.capturedAt, version: 'V1-demo', refs: [`demo-source:${eventId}:${m.label}`], verification: '来源已核（模拟）' })));
    }
    put('现场影像', [
      { id: `${eventId}-image`, title: `${profile.category}现场资料登记（模拟）`, content: `${profile.location}影像目录示例，需补原文件、位置与拍摄时间，不声称已进行视觉识别。`, source: '现场资料适配器（本地模拟）', capturedAt: profile.capturedAt, version: 'V1-demo', refs: [`demo-source:${eventId}:image`], verification: '待核实' },
      { id: `${eventId}-gov-wechat`, title: '属地政府微信群资料（演示）', content: `${profile.location}政府渠道通过微信群提供的示意图与文字说明。非正式台账，待结构化入库。`, source: '属地政府·微信群（本地模拟）', capturedAt: profile.capturedAt, version: 'V1-demo', refs: [`demo-source:${eventId}:gov-wechat`], verification: '待核实' },
      { id: `${eventId}-gov-fax`, title: '属地政府传真资料（演示）', content: `${profile.location}政府传真件目录登记。非正式台账，待结构化入库。`, source: '属地政府·传真（本地模拟）', capturedAt: profile.capturedAt, version: 'V1-demo', refs: [`demo-source:${eventId}:gov-fax`], verification: '待核实' },
    ]);
  }
  return { eventId, title, location, sources };
}
export function buildMultiSourceSnapshot(eventId: string): MultiSourceSnapshot {
  const event = sourceEvent(eventId);
  // 全域演示只覆盖已有值班授权清单，与事件详情严格分开，不把其他事件混入当前摘要。
  const orgId = incidentById.get(eventId)?.orgId;
  const domainIds = orgId === shift.orgId ? shiftEventIds(shift.shiftId) : [];
  return { gatheredAt: disasterProfileById.get(eventId)?.capturedAt ?? DEMO_CLOCK, event, domainEvents: domainIds.map(sourceEvent), scopeLabel: '授权事件清单（模拟）' };
}
export function aggregationCounts(sources: DisasterSourceGroup[]) {
  const records = sources.flatMap(s => s.records);
  return { covered: sources.filter(s => s.records.length).length, raw: records.length, merged: records.filter(r => !r.duplicateOf).length, pending: records.filter(r => !r.duplicateOf && r.verification === '待核实').length };
}
export function multiSourceMaterial(snapshot: MultiSourceSnapshot) {
  const counts = aggregationCounts(snapshot.event.sources);
  return {
    section: { title: '多源数据汇聚', text: `当前事件覆盖${counts.covered}/6类来源，原始${counts.raw}条，归并后${counts.merged}条，${counts.pending}条待核线索。\n${snapshot.event.sources.map(s => `${s.kind}：${s.records.filter(r => !r.duplicateOf).map(r => `${r.content}（${r.source}；${r.capturedAt}；${r.verification}）`).join('；') || s.missing}`).join('\n')}\n全域演示范围为${snapshot.scopeLabel}，共${snapshot.domainEvents.length}个事件；各事件分别汇总，不混入本事件业务事实。真实全域接口待接入。` },
    table: { title: '多源汇聚覆盖与来源', headers: ['来源类别', '状态', '原始/归并记录', '来源与数据时间'], rows: snapshot.event.sources.map(s => [s.kind, s.state, `${s.records.length}/${s.records.filter(r => !r.duplicateOf).length}`, s.records.map(r => `${r.source} · ${r.capturedAt}`).join('；') || s.missing]) },
  };
}
