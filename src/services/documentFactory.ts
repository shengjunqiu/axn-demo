/**
 * 文书工厂：模板 + 统一事实查询 → 文书内容（结构化 runs）+ 来源快照 + 草稿。
 * 缺必填字段时返回 missingFields，不产出看似完整的文书。
 */
import type {
  DocumentContent,
  DocumentDraft,
  DocumentParagraph,
  DocumentSection,
  InlineRun,
  TemplateCode,
} from '@/domain/types';
import {
  DEMO_CLOCK,
  factById,
  getFact,
  incidentById,
  knowledgeById,
  shift,
  teamById,
  templateByCode,
} from '@/seed/scenario';
import { DERIVED_META, type DerivedKey } from '@/seed/derived';
import { useDemoStore } from '@/store/demoStore';
import { collectRunFactIds as collectFactIdsPure, collectRunDerivedKeys } from './contentRuns';
import { useSessionStore } from '@/store/sessionStore';
import { resolveFact, latestWaterLevelFactId } from './factLookup';
import { buildSnapshot } from './snapshot';
import { computeContentHash, useDocumentStore } from '@/store/documentStore';

let docCounter = 0;
function nextDocumentId(): string {
  docCounter += 1;
  return `doc-${Date.now().toString(36)}-${docCounter}`;
}

export const CONTROL_STATUS_LABEL: Record<string, string> = {
  ongoing: '处置中（持续跟踪）',
  controlled: '已控制',
};

function para(
  id: string,
  role: DocumentParagraph['role'],
  runs: InlineRun[],
): DocumentParagraph {
  return { id, role, runs };
}

function factRun(factId: string, suffix?: string): InlineRun {
  return { type: 'fact', factId, suffix };
}

function textRun(text: string): InlineRun {
  return { type: 'text', text };
}

function derivedRun(key: DerivedKey, suffix?: string): InlineRun {
  return { type: 'derived', derivedKey: key, suffix };
}

export interface CreateDocumentResult {
  ok: boolean;
  documentId?: string;
  missingFields: string[];
  reason?: string;
  state: 'draft_created' | 'waiting_input';
}

function manualFactIdOrNull(field: string, scopeKind: 'event' | 'shift', scopeId: string): string | null {
  const entry = useDemoStore.getState().getManualFactByField(field, scopeKind, scopeId);
  return entry?.factId ?? null;
}

export function missingBriefFields(eventId: string): string[] {
  const missing: string[] = [];
  const incident = incidentById.get(eventId);
  if (!incident) return ['事件不存在'];
  for (const [key, factId] of Object.entries(incident.factRefs)) {
    const f = getFact(factId);
    if (!f || f.value == null || f.value === '') missing.push(key);
  }
  if (!manualFactIdOrNull('reportingUnit', 'event', eventId)) missing.push('reportingUnit');
  return missing;
}

export function missingDailyFields(): string[] {
  const missing: string[] = [];
  for (const [key, factId] of Object.entries(shift.factRefs)) {
    const f = getFact(factId);
    if (!f || f.value == null || f.value === '') missing.push(key);
  }
  if (!manualFactIdOrNull('handOverNotes', 'shift', shift.shiftId)) missing.push('handOverNotes');
  if (!manualFactIdOrNull('reportingUnit', 'shift', shift.shiftId)) missing.push('reportingUnit');
  return missing;
}

const FIELD_LABEL: Record<string, string> = {
  reportingUnit: '报送单位',
  handOverNotes: '交接事项',
  impactScope: '影响范围',
  casualty: '人员伤亡情况',
};

export function fieldLabel(field: string): string {
  return FIELD_LABEL[field] ?? field;
}

function composeBriefContent(eventId: string, sessionId: string): DocumentContent {
  const incident = incidentById.get(eventId)!;
  const refs = incident.factRefs;
  // 审查 M-9：按任务/来源会话取候选，不读当前 UI 会话（防事件切换后跨会话污染）。
  const session = useSessionStore.getState().sessions[sessionId];
  const candidates = (session?.candidateResourceIds ?? []).filter((id) => teamById.has(id));
  const demo = useDemoStore.getState();
  const reportingUnitFactId = manualFactIdOrNull('reportingUnit', 'event', eventId);
  const title = String(factById.get(refs.title)?.value ?? eventId);

  const sections: DocumentSection[] = [
    {
      id: 'basic',
      heading: '一、基本情况',
      paragraphs: [
        para('basic-1', 'fact-line', [
          textRun('发生时间：'),
          factRun(refs.occurredAt),
          textRun('；事发地点：'),
          factRun(refs.location),
          textRun('。'),
        ]),
        para('basic-2', 'fact-line', [
          textRun('险情类型：'),
          factRun(refs.disasterType),
          textRun('；'),
          factRun(refs.incidentDescription),
        ]),
        para('basic-3', 'fact-line', [
          textRun('水情监测：'),
          factRun('fact-obs-water-001-stationName', '（模拟测站）'),
          textRun('最新水位 '),
          factRun(latestWaterLevelFactId()),
          textRun('（'),
          factRun('fact-obs-water-005-observedAt'),
          textRun(' 观测）。'),
        ]),
      ],
    },
    {
      id: 'impact',
      heading: '二、当前影响',
      paragraphs: [
        para('impact-1', 'fact-line', [
          textRun('影响范围：'),
          factRun(refs.impactScope),
          textRun('。'),
        ]),
        para('impact-2', 'fact-line', [
          textRun('人员伤亡情况：'),
          factRun(refs.casualty),
          textRun('。'),
        ]),
      ],
    },
    {
      id: 'response',
      heading: '三、响应及处置进展',
      paragraphs: [
        para('response-1', 'fact-line', [
          textRun('现场处置状态：'),
          factRun(refs.controlStatus),
          textRun('。'),
        ]),
        para('response-2', 'fact-line', [
          textRun('已确认响应等级：'),
          factRun(refs.confirmedResponseLevel, ' 级'),
          textRun('；上游态势建议：'),
          factRun(incident.situationFactRefs.suggestedResponseLevel, ' 级'),
          textRun('（'),
          factRun(incident.situationFactRefs.suggestionStatus, ''),
          textRun('，尚未确认）。'),
        ]),
      ],
    },
    {
      id: 'forces',
      heading: '四、力量情况',
      paragraphs: [
        para(
          'forces-1',
          candidates.length ? 'fact-line' : 'narrative',
          candidates.length
            ? [
                textRun('拟预置候选力量 '),
                derivedRun('candidate_team_count', ' 支'),
                textRun('，合计人员 '),
                derivedRun('candidate_people_count', ' 人'),
                textRun('、挖掘机 '),
                derivedRun('candidate_excavator_count', ' 台'),
                textRun('（以上为候选，尚未形成调派命令）。'),
              ]
            : [textRun('候选力量待确认。')],
        ),
      ],
    },
    {
      id: 'next',
      heading: '五、下一步工作',
      paragraphs: [
        para('next-1', 'narrative', [
          textRun('持续跟踪险情发展，核实待核实事项并动态更新本报告；具体处置措施以专业人员审核意见为准。'),
        ]),
      ],
    },
    {
      id: 'report',
      heading: '六、报送信息',
      paragraphs: [
        para('report-1', 'fact-line', [
          textRun('报送单位：'),
          reportingUnitFactId ? factRun(reportingUnitFactId) : textRun('（待补录）'),
          textRun('。'),
        ]),
      ],
    },
    {
      id: 'appendix',
      heading: '七、附件与依据',
      paragraphs: [
        para('appendix-1', 'reference', [
          textRun('本报告事实均取自模拟数据源并留痕，可点击正文数据查看来源；候选与建议数据为运行时模拟结果。'),
        ]),
      ],
    },
  ];
  void demo;

  return {
    title: `应急要情：${title}`,
    templateCode: 'EMERGENCY_BRIEF',
    templateVersion: templateByCode.get('EMERGENCY_BRIEF')?.templateVersion ?? '1.0.0-demo',
    sections,
    footerNote: '演示环境 · 模拟数据 · 非真实救援指令',
  };
}

function composeDailyContent(sessionId: string): DocumentContent {
  // 审查 M-9：日报的候选/派生与快照均按来源会话；shift 域本身无候选参与。
  const session = useSessionStore.getState().sessions[sessionId];
  void session;
  const handOverFactId = manualFactIdOrNull('handOverNotes', 'shift', shift.shiftId);
  const reportingUnitFactId = manualFactIdOrNull('reportingUnit', 'shift', shift.shiftId);
  const eventIds = shift.incidentIds;

  const keyEvents: DocumentParagraph[] = eventIds.map((eid, i) => {
    const inc = incidentById.get(eid)!;
    return para(`daily-key-${i}`, 'fact-line', [
      textRun(`${String(factById.get(inc.factRefs.title)?.value ?? eid)}：`),
      factRun(inc.factRefs.controlStatus),
      textRun('。'),
    ]);
  });

  const sections: DocumentSection[] = [
    {
      id: 'shift-overview',
      heading: '一、班次概况',
      paragraphs: [
        para('shift-1', 'fact-line', [
          textRun('班次 '),
          factRun(shift.factRefs.shiftId),
          textRun(`（${shift.label}）：`),
          factRun(shift.factRefs.startsAt),
          textRun(' 至 '),
          factRun(shift.factRefs.endsAt),
          textRun('；统计截止：'),
          factRun('fact-clock-demo-001-currentTime'),
          textRun('（演示时钟，非完整日终数据）。'),
        ]),
      ],
    },
    {
      id: 'stats',
      heading: '二、接报统计',
      paragraphs: [
        para('stats-1', 'fact-line', [
          textRun('本班次接报 '),
          derivedRun('daily_incident_count', ' 起'),
          textRun('，其中处置中 '),
          derivedRun('daily_ongoing_count', ' 起'),
          textRun('、已控制 '),
          derivedRun('daily_controlled_count', ' 起'),
          textRun('。'),
        ]),
      ],
    },
    {
      id: 'key-events',
      heading: '三、重点事件',
      paragraphs: keyEvents.length ? keyEvents : [para('daily-key-empty', 'narrative', [textRun('本班次无接报事件。')])],
    },
    {
      id: 'monitor',
      heading: '四、监测摘要',
      paragraphs: [
        para('monitor-1', 'fact-line', [
          textRun('清河段模拟测站最新水位 '),
          factRun(latestWaterLevelFactId()),
          textRun('（'),
          factRun('fact-obs-water-005-observedAt'),
          textRun(' 观测）；水情趋势详见工作台监测摘要。'),
        ]),
      ],
    },
    {
      id: 'progress',
      heading: '五、处置进展',
      paragraphs: eventIds.map((eid, i) => {
        const inc = incidentById.get(eid)!;
        return para(`daily-progress-${i}`, 'fact-line', [
          textRun(`${String(factById.get(inc.factRefs.title)?.value ?? eid)}：`),
          factRun(inc.factRefs.incidentDescription),
        ]);
      }),
    },
    {
      id: 'handover',
      heading: '六、交接事项',
      paragraphs: [
        para('handover-1', 'fact-line', [
          handOverFactId
            ? factRun(handOverFactId)
            : textRun('（待补录）'),
        ]),
      ],
    },
    {
      id: 'daily-report',
      heading: '七、填报单位',
      paragraphs: [
        para('daily-report-1', 'fact-line', [
          textRun('填报单位：'),
          reportingUnitFactId ? factRun(reportingUnitFactId) : textRun('（待补录）'),
          textRun('。'),
        ]),
      ],
    },
  ];
  void session;

  return {
    title: `值班日报：${shift.shiftId}`,
    templateCode: 'DUTY_DAILY',
    templateVersion: templateByCode.get('DUTY_DAILY')?.templateVersion ?? '1.0.0-demo',
    sections,
    footerNote: '演示环境 · 模拟数据 · 非真实救援指令',
  };
}

function briefDerivedKeys(): DerivedKey[] {
  return ['candidate_team_count', 'candidate_people_count', 'candidate_excavator_count'];
}

function dailyDerivedKeys(): DerivedKey[] {
  return ['daily_incident_count', 'daily_ongoing_count', 'daily_controlled_count'];
}

export function createEventDocument(sessionId: string): CreateDocumentResult {
  const session = useSessionStore.getState().sessions[sessionId];
  if (!session) return { ok: false, missingFields: [], state: 'waiting_input', reason: '会话不存在' };
  const eventId = session.eventId;
  const missing = missingBriefFields(eventId);
  if (missing.length) {
    return { ok: false, missingFields: missing, state: 'waiting_input', reason: '存在待补录必填字段' };
  }
  const content = composeBriefContent(eventId, sessionId);
  const snapshot = buildSnapshot({
    scopeKind: 'event',
    eventId,
    shiftId: null,
    sessionId,
    extraFactIds: [
      'fact-obs-water-001-stationName',
      'fact-obs-water-005-observedAt',
      'fact-obs-water-005-waterLevel',
      'fact-clock-demo-001-currentTime',
      ...collectFactIdsPure(content),
    ],
    derivedKeys: briefDerivedKeys(),
    label: '应急要情生成快照',
  });
  const demo = useDemoStore.getState();
  const actor = demo.getActor();
  const documentId = nextDocumentId();
  const draft: DocumentDraft = {
    documentId,
    title: content.title,
    templateCode: 'EMERGENCY_BRIEF',
    templateVersion: content.templateVersion,
    scopeKind: 'event',
    eventId,
    shiftId: null,
    originSessionId: sessionId,
    working: {
      content,
      contextSnapshotId: snapshot.snapshotId,
      contentHash: computeContentHash(content),
      updatedAt: new Date().toISOString(),
      baseRevisionId: null,
    },
    lifecycle: 'draft',
    validation: { status: 'not_run', reportId: null },
    freshness: 'current',
    activeRevisionId: null,
    revisionCounter: { major: 1, minor: 0 },
    snapshot,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  useDocumentStore.getState().addDraft(draft);
  useDocumentStore.getState().addAudit({
    action: '生成文书',
    actor: actor.name,
    objectId: documentId,
    version: '工作副本',
    performedAt: new Date().toISOString(),
    demoClockAt: demo.demoClock,
    detail: `模板 应急要情 · 快照 ${snapshot.snapshotId}`,
  });
  void DEMO_CLOCK;
  return { ok: true, documentId, missingFields: [], state: 'draft_created' };
}

export function createDailyDocument(sessionId: string): CreateDocumentResult {
  const session = useSessionStore.getState().sessions[sessionId];
  if (!session) return { ok: false, missingFields: [], state: 'waiting_input', reason: '会话不存在' };
  const missing = missingDailyFields();
  if (missing.length) {
    return { ok: false, missingFields: missing, state: 'waiting_input', reason: '存在待补录必填字段' };
  }
  const content = composeDailyContent(sessionId);
  const snapshot = buildSnapshot({
    scopeKind: 'shift',
    eventId: null,
    shiftId: shift.shiftId,
    sessionId,
    extraFactIds: [
      'fact-obs-water-005-observedAt',
      'fact-obs-water-005-waterLevel',
      'fact-clock-demo-001-currentTime',
      ...collectFactIdsPure(content),
    ],
    derivedKeys: dailyDerivedKeys(),
    label: '值班日报生成快照',
  });
  const demo = useDemoStore.getState();
  const actor = demo.getActor();
  const documentId = nextDocumentId();
  const draft: DocumentDraft = {
    documentId,
    title: content.title,
    templateCode: 'DUTY_DAILY',
    templateVersion: content.templateVersion,
    scopeKind: 'shift',
    eventId: null,
    shiftId: shift.shiftId,
    originSessionId: sessionId,
    working: {
      content,
      contextSnapshotId: snapshot.snapshotId,
      contentHash: computeContentHash(content),
      updatedAt: new Date().toISOString(),
      baseRevisionId: null,
    },
    lifecycle: 'draft',
    validation: { status: 'not_run', reportId: null },
    freshness: 'current',
    activeRevisionId: null,
    revisionCounter: { major: 1, minor: 0 },
    snapshot,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  useDocumentStore.getState().addDraft(draft);
  useDocumentStore.getState().addAudit({
    action: '生成文书',
    actor: actor.name,
    objectId: documentId,
    version: '工作副本',
    performedAt: new Date().toISOString(),
    demoClockAt: demo.demoClock,
    detail: `模板 值班日报 · 快照 ${snapshot.snapshotId}`,
  });
  return { ok: true, documentId, missingFields: [], state: 'draft_created' };
}

export { collectRunFactIds } from './contentRuns';

export function derivedMetaLabel(key: DerivedKey): string {
  return DERIVED_META[key].label;
}

export function knowledgeNotice(): string {
  return Object.values(knowledgeById)[0]?.notice ?? '';
}

export function factPendingLabel(factId: string): string | null {
  const f = resolveFact(factId);
  if (!f) return null;
  if (f.verification === 'pending') return '待核实';
  return null;
}

export type { TemplateCode };

/** 审查 M-3：按最新数据重建草稿快照（补齐 updateDraftSnapshot 调用链），重建后须重新校核。 */
export function refreshDraftSnapshot(input: { documentId: string; actorName: string }): void {
  const { documentId, actorName } = input;
  const store = useDocumentStore.getState();
  const draft = store.drafts[documentId];
  if (!draft) throw new Error(`文书不存在：${documentId}`);
  const derivedKeys = collectRunDerivedKeys(draft.working.content).filter(
    (key): key is DerivedKey => key in DERIVED_META,
  );
  const snapshot = buildSnapshot({
    scopeKind: draft.scopeKind,
    eventId: draft.eventId,
    shiftId: draft.shiftId,
    sessionId: draft.originSessionId,
    extraFactIds: collectFactIdsPure(draft.working.content),
    derivedKeys,
    label: `重建快照 · ${draft.title}`,
  });
  store.updateDraftSnapshot(documentId, snapshot);
  store.addAudit({
    action: '重建快照',
    actor: actorName,
    objectId: documentId,
    version: null,
    performedAt: new Date().toISOString(),
    demoClockAt: useDemoStore.getState().demoClock,
    detail: `按最新监测数据重建快照 ${snapshot.snapshotId}（contextVersion ${snapshot.contextVersion}）`,
  });
}

/**
 * 审查 M-2/M-9 共用：基于已签发版本内容新建修订草稿（大版本号 +1，旧稿归档，不覆盖 signed 快照）。
 * 文书中心「修订」与编辑器「开始修订后保存」均走此函数，保证版本语义唯一；会话归属取 originSessionId。
 */
export function createRevisionDraftFromSigned(input: {
  documentId: string;
  content: DocumentContent;
  actorName: string;
}): DocumentDraft {
  const { documentId, content, actorName } = input;
  const store = useDocumentStore.getState();
  const demo = useDemoStore.getState();
  const draft = store.drafts[documentId];
  if (!draft) throw new Error(`文书不存在：${documentId}`);
  const rev = draft.activeRevisionId ? store.getRevision(draft.activeRevisionId) : undefined;
  if (!rev || !rev.signedRecord) throw new Error('仅已签发版本支持修订（模拟）');
  const derivedKeys = collectRunDerivedKeys(content).filter((key): key is DerivedKey => key in DERIVED_META);
  const snapshot = buildSnapshot({
    scopeKind: draft.scopeKind,
    eventId: draft.eventId,
    shiftId: draft.shiftId,
    sessionId: draft.originSessionId,
    extraFactIds: collectFactIdsPure(content),
    derivedKeys,
    label: `修订快照 · ${draft.title}`,
  });
  const newId = `doc-revise-${Date.now().toString(36)}`;
  const now = new Date().toISOString();
  const newDraft: DocumentDraft = {
    documentId: newId,
    title: `${draft.title}（修订）`,
    templateCode: draft.templateCode,
    templateVersion: draft.templateVersion,
    scopeKind: draft.scopeKind,
    eventId: draft.eventId,
    shiftId: draft.shiftId,
    originSessionId: draft.originSessionId,
    working: {
      content,
      contextSnapshotId: snapshot.snapshotId,
      contentHash: computeContentHash(content),
      updatedAt: now,
      baseRevisionId: rev.revisionId,
    },
    lifecycle: 'draft',
    validation: { status: 'not_run', reportId: null },
    freshness: 'current',
    activeRevisionId: null,
    revisionCounter: { major: draft.revisionCounter.major + 1, minor: 0 },
    snapshot,
    createdAt: now,
    updatedAt: now,
  };
  store.addDraft(newDraft);
  store.setLifecycle(documentId, 'archived');
  store.addAudit({
    action: '修订新建草稿',
    actor: actorName,
    objectId: documentId,
    version: rev.displayVersion,
    performedAt: now,
    demoClockAt: demo.demoClock,
    detail: `基于已签发版本 ${rev.displayVersion} 生成新草稿（原版本保持锁定）`,
  });
  return newDraft;
}
