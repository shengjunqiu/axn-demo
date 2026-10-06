/**
 * 安小能领域类型 —— 单一事实来源（主控维护，冻结契约）。
 * 所有业务时间使用带 +08:00 的 ISO 字符串；用户实际操作时间另存 performedAt。
 * 全部数据均为模拟数据（dataMode: 'mock'）。
 */

// ===== 基础值类型 =====

export type FactValue = string | number | string[] | null;

export type Verification = 'confirmed' | 'pending' | 'suggested';

export type DataMode = 'mock';

export type FactScope =
  | { kind: 'event'; eventId: string; orgId: string }
  | { kind: 'organization'; orgId: string; allowedEventIds: string[] }
  | { kind: 'shift'; shiftId: string; orgId: string; allowedEventIds: string[] }
  | { kind: 'demo_configuration' };

export interface StructuredFact {
  factId: string;
  value: FactValue;
  unit: string | null;
  valueType: 'string' | 'number' | 'datetime' | 'string[]';
  sourceFieldId: string;
  sourceRecordId: string;
  sourceFieldKey: string;
  sourceVersion: number;
  capturedAt: string;
  verification: Verification;
  dataMode: DataMode;
  scope: FactScope;
}

export interface SourceRecord {
  sourceRecordId: string;
  sourceSystem: string;
  sourceTable: string;
  objectId: string;
  sourceVersion: number;
  capturedAt: string;
  scope: FactScope;
  dataMode: DataMode;
  isSimulated: boolean;
  label: string;
  fields: Record<string, FactValue>;
}

/** 人工补录（模拟）产生的记录：聊天原文不直接作为来源，确认后生成 manual source + fact。 */
export interface ManualInputRecord {
  recordId: string;
  field: string;
  value: string;
  scopeKind: 'event' | 'shift';
  scopeId: string;
  actorId: string;
  actorName: string;
  performedAt: string;
  demoClockAt: string;
  factId: string;
  sourceRecordId: string;
}

// ===== 实体（种子原始结构） =====

export interface IncidentRecord {
  eventId: string;
  orgId: string;
  scope: 'drill';
  factRefs: Record<string, string>;
  situationFactRefs: Record<string, string>;
  stationId: string | null;
  schematicPosition: { x: number; y: number };
  confirmedDeployments: unknown[];
  reportingUnitFactId: string | null;
  contextVersion: number;
  supportedDepth: string;
}

export interface TeamRecord {
  resourceId: string;
  resourceType: 'team';
  factRefs: Record<string, string>;
  distanceAnchorEventId: string;
  distanceAndEtaAreSimulated: boolean;
  schematicPosition: { x: number; y: number };
  unavailableReason: string | null;
}

export interface WarehouseRecord {
  resourceId: string;
  resourceType: 'warehouse';
  factRefs: Record<string, string>;
  schematicPosition: { x: number; y: number };
}

export type ResourceRecord = TeamRecord | WarehouseRecord;

export interface ObservationRecord {
  observationId: string;
  stationId: string;
  factRefs: Record<string, string>;
}

export interface StationRecord {
  stationId: string;
  eventId: string;
  latestObservationId: string;
  schematicPosition: { x: number; y: number };
  feedVersion: number;
}

export interface ShiftRecord {
  shiftId: string;
  orgId: string;
  startsAt: string;
  endsAt: string;
  incidentIds: string[];
  handOverNotesFactId: string | null;
  reportingUnitFactId: string | null;
  label: string;
  factRefs: Record<string, string>;
}

export interface KnowledgeChunk {
  chunkId: string;
  title: string;
  category: string;
  version: string;
  isMock: boolean;
  effectiveStatus: string;
  sourceLabel: string;
  content: string;
  notice: string;
}

export type TemplateCode = 'EMERGENCY_BRIEF' | 'DUTY_DAILY' | 'MEETING_MINUTES' | 'WORK_SUMMARY';

export interface TemplateFieldDef {
  field: string;
  binding: string;
  required: boolean;
  allowPending: boolean;
}

export interface TemplateDef {
  templateCode: TemplateCode;
  name: string;
  templateVersion: string;
  status: 'enabled' | 'preview_only';
  sections: string[];
  requiredFields?: TemplateFieldDef[];
  aggregateDefinitions?: string[];
  allowedExports: string[];
  signatureMode?: string;
  notice?: string;
  note?: string;
}

// ===== 运行时实体 =====

export interface Actor {
  actorId: string;
  /** 身份标签（值班员/指挥员）；签发人等审计记录用的是它，不要与 userName 混用。 */
  name: string;
  /** 模拟用户姓名，仅用于侧栏展示。 */
  userName: string;
  role: 'duty' | 'commander';
  orgId: string;
  isSimulated: boolean;
}

export interface PendingClarification {
  clarificationId: string;
  field: string;
  prompt: string;
  exampleHint: string;
  scopeKind: 'event' | 'shift';
  scopeId: string;
  taskId: string;
}

export interface ChatMessage {
  messageId: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system';
  kind: 'text' | 'task' | 'system' | 'agent';
  text: string | null;
  taskId: string | null;
  /** kind='agent' 专用：召唤的智能体标识与行动描述（text 存行动说明）。 */
  agentId?: string;
  agentName?: string;
  agentRole?: string;
  documentWorkflow?: {
    stage: 'collecting' | 'waiting_input' | 'calling' | 'generating' | 'completed' | 'interrupted';
    elements: { label: string; value: string }[];
    collection?: { question: string; answer: string }[];
    collectedCount?: number;
    reportSections?: [string, string][];
    documentId?: string;
  };
  createdAt: string;
  performedAt: string;
}

export interface Session {
  sessionId: string;
  eventId: string;
  title: string;
  messages: ChatMessage[];
  lastResourceResultIds: string[];
  resourceSortBy: 'eta' | 'distance' | null;
  candidateResourceIds: string[];
  selectedProposalId: string | null;
  selectedProposalVersion: string | null;
  pendingClarification: PendingClarification | null;
  activeDocumentId: string | null;
  createdAt: string;
}

export interface Proposal {
  proposalId: string;
  eventId: string;
  version: string;
  isMock: true;
  title: string;
  sections: ProposalSection[];
  riskNotes: string[];
  knowledgeRefs: string[];
  factRefsUsed: string[];
  candidateIds: string[];
  createdAt: string;
}

export interface ProposalSection {
  id: string;
  title: string;
  text: string;
  bindingResourceIds?: string[];
  emptyText?: string;
}

// ===== 任务与事件协议 =====

export type TaskStatus =
  | 'queued'
  | 'running'
  | 'succeeded'
  | 'partial'
  | 'waiting_input'
  | 'failed'
  | 'cancelled';

export type StepStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface TaskStep {
  stepId: string;
  name: string;
  inputSummary: string | null;
  status: StepStatus;
  outputSummary: string | null;
  sourceRefs: string[];
  elapsedMs: number | null;
  errorCode: string | null;
}

export interface SummaryArtifact {
  kind: 'summary';
  eventId: string;
  rows: {
    label: string;
    factId: string;
    displayOverride?: string;
    emphasize?: 'suggested' | 'pending';
  }[];
  pendingKeys: string[];
  waterLevelFactId: string | null;
  dataTime: string;
  sourceUnavailable: string | null;
}

export interface ResourceResultArtifact {
  kind: 'resources';
  eventId: string;
  resourceIds: string[];
  sortedBy: 'eta' | 'distance' | null;
  dataTime: string;
  excluded: { resourceId: string; reason: string }[];
  note: string | null;
}

export interface KnowledgeArtifact {
  kind: 'knowledge';
  chunkIds: string[];
  answer: string;
  dataTime: string;
}

/** 抢险救援知识问答卡（qa.json，模拟文档溯源）。 */
export interface QaKnowledgeArtifact {
  kind: 'qa_knowledge';
  qaId: number;
  question: string;
  category: string;
  summary: string;
  keyActions: string;
  doNot: string;
  supportAndReporting: string;
  liveDataNeeded: string[];
  confidence: number;
  answerStatus: string;
  sources: { docId: string; title: string; section: string; excerpt: string; simulated: boolean }[];
  dataTime: string;
}

export interface ProposalArtifact {
  kind: 'proposal';
  proposalId: string;
  version: string;
  eventId: string;
  dataTime: string;
}

export interface DocumentLinkArtifact {
  kind: 'document';
  documentId: string;
  templateCode: string;
  title: string;
  state: 'draft_created' | 'waiting_input';
  missingFields: string[];
}

export interface ClarificationPayload {
  kind: 'clarification';
  clarificationId: string;
  field: string;
  prompt: string;
  exampleHint: string;
  scopeKind: 'event' | 'shift';
  scopeId: string;
  taskId: string;
}

export interface ErrorArtifact {
  kind: 'error';
  errorCode: string;
  message: string;
  hint: string;
}

export type TaskArtifactPayload =
  | SummaryArtifact
  | ResourceResultArtifact
  | KnowledgeArtifact
  | QaKnowledgeArtifact
  | ProposalArtifact
  | DocumentLinkArtifact
  | ClarificationPayload
  | ErrorArtifact;

export interface TaskArtifact {
  artifactId: string;
  payload: TaskArtifactPayload;
}

export interface AgentTask {
  taskId: string;
  sessionId: string;
  eventId: string;
  userMessageId: string;
  attemptId: string;
  attempt: number;
  status: TaskStatus;
  intent: string;
  displayTitle: string;
  steps: TaskStep[];
  artifacts: TaskArtifact[];
  textAnswer: string | null;
  error: { errorCode: string; message: string; hint: string } | null;
  startedAt: string;
  finishedAt: string | null;
  demoElapsedMs: number | null;
  seq: number;
}

// ===== 文书内容模型 =====

export type InlineRun =
  | { type: 'text'; text: string }
  | { type: 'fact'; factId: string; suffix?: string }
  | { type: 'derived'; derivedKey: string; suffix?: string }
  | { type: 'knowledge'; chunkId: string; label: string };

export interface DocumentParagraph {
  id: string;
  role: 'narrative' | 'fact-line' | 'reference';
  runs: InlineRun[];
}

export interface DocumentSection {
  id: string;
  heading: string;
  paragraphs: DocumentParagraph[];
}

export interface DocumentContent {
  title: string;
  templateCode: TemplateCode;
  templateVersion: string;
  sections: DocumentSection[];
  footerNote: string;
}

// ===== 快照 =====

export interface FactSnapshotValue {
  scope: FactScope;
  factId: string;
  value: FactValue;
  unit: string | null;
  valueType: StructuredFact['valueType'];
  sourceRecordId: string;
  sourceFieldKey: string;
  sourceVersion: number;
  capturedAt: string;
  verification: Verification;
  sourceSystem: string;
  sourceLabel: string;
}

export interface DerivedSnapshotValue {
  key: string;
  value: number;
  unit: string | null;
  formula: string;
  inputFactIds: string[];
  inputSummary: string;
}

export interface WaterSeriesPoint {
  observationId: string;
  observedAt: string;
  waterLevel: number;
  unit: string;
}

export interface SourceSnapshot {
  sources: Record<string, SourceRecord>;
  snapshotId: string;
  scopeKind: 'event' | 'shift';
  eventId: string | null;
  shiftId: string | null;
  takenAt: string;
  contextVersion: number;
  dataVersion: number;
  facts: Record<string, FactSnapshotValue>;
  derived: Record<string, DerivedSnapshotValue>;
  candidateResourceIds: string[];
  selectedProposalId: string | null;
  selectedProposalVersion: string | null;
  knowledgeChunkIds: string[];
  waterSeries: WaterSeriesPoint[];
  label: string;
}

// ===== 文书草稿 / 版本 / 校核 =====

export type DocumentLifecycle = 'draft' | 'submitted' | 'signed' | 'archived';
export type ValidationStatus = 'not_run' | 'running' | 'passed' | 'failed' | 'stale';
export type Freshness = 'current' | 'stale';

export interface WorkingVersion {
  content: DocumentContent;
  contextSnapshotId: string;
  contentHash: string;
  updatedAt: string;
  baseRevisionId: string | null;
}

export interface DocumentDraft {
  documentId: string;
  title: string;
  templateCode: Extract<TemplateCode, 'EMERGENCY_BRIEF' | 'DUTY_DAILY'>;
  templateVersion: string;
  scopeKind: 'event' | 'shift';
  eventId: string | null;
  shiftId: string | null;
  originSessionId: string;
  working: WorkingVersion;
  lifecycle: DocumentLifecycle;
  validation: { status: ValidationStatus; reportId: string | null };
  freshness: Freshness;
  activeRevisionId: string | null;
  revisionCounter: { major: number; minor: number };
  /** 生成/最近重校核时的来源快照（R-002/R-009 校核依据）。 */
  snapshot: SourceSnapshot;
  createdAt: string;
  updatedAt: string;
}

export interface SignedRecord {
  signedByActorId: string;
  signedByActorName: string;
  performedAt: string;
  demoClockAt: string;
  contentHash: string;
  isSimulated: true;
  note: string;
}

export interface DocumentRevision {
  sourceSnapshot: SourceSnapshot;
  validationReportId: string | null;
  locked: boolean;
  revisionId: string;
  documentId: string;
  displayVersion: string;
  major: number;
  minor: number;
  contentSnapshot: DocumentContent;
  sourceSnapshotId: string;
  /** 保存时刻各事实的展示值，供导出/打印冻结渲染（防止监测更新污染已存版本）。 */
  factsSnapshot: Record<string, string>;
  contentHash: string;
  createdBy: string;
  createdAt: string;
  changeNote: string | null;
  submittedBy: string | null;
  submittedAt: string | null;
  signedRecord: SignedRecord | null;
}

export type ValidationLevel = 'block' | 'warning' | 'info';

export interface ValidationIssue {
  ruleId: string;
  level: ValidationLevel;
  message: string;
  sectionId: string | null;
  paragraphId: string | null;
  fieldKey: string | null;
  currentValue: string | null;
  suggestion: string | null;
  suggestionText: string | null;
}

export interface ValidationReport {
  revisionId: string | null;
  factSnapshotVersion: number;
  reportId: string;
  documentId: string;
  contentHash: string;
  contextSnapshotId: string;
  rulesetVersion: string;
  issues: ValidationIssue[];
  checkedAt: string;
}

// ===== 审计 =====

export interface AuditEvent {
  auditId: string;
  action: string;
  actor: string;
  objectId: string;
  version: string | null;
  performedAt: string;
  demoClockAt: string;
  isSimulated: true;
  detail: string | null;
}

// ===== 模拟控制 =====

export type DemoPace = 'normal' | 'fast';

export interface DemoConfig {
  pace: DemoPace;
  faults: Record<string, boolean>;
  guideStepIndex: number;
  storageWarning: string | null;
}

export type IntentId =
  | 'summary'
  | 'resource_query'
  | 'resource_sort_eta'
  | 'resource_sort_distance'
  | 'candidate_add_top2'
  | 'candidate_remove'
  | 'knowledge'
  | 'qa_knowledge'
  | 'proposal'
  | 'evaluation'
  | 'doc_brief'
  | 'doc_daily'
  | 'fill_reporting_unit'
  | 'fill_handover'
  | 'stop'
  | 'combined'
  | 'unknown';

export interface AssistantContext {
  sessionId: string;
  eventId: string;
  candidateResourceIds: string[];
  lastResourceResultIds: string[];
  selectedProposalId: string | null;
  selectedProposalVersion: string | null;
  pendingClarification: PendingClarification | null;
  demoClock: string;
  pace: DemoPace;
}

export interface AssistantRequest {
  requestId: string;
  taskId: string;
  attemptId: string;
  sessionId: string;
  eventId: string;
  commandId: string | null;
  userInput: string;
  intent: IntentId;
  params: Record<string, unknown>;
  context: AssistantContext;
}

export type TaskEvent =
  | { type: 'step_started'; stepId: string; name: string; inputSummary?: string }
  | {
      type: 'step_completed';
      stepId: string;
      outputSummary?: string;
      sourceRefs?: string[];
      artifact?: Omit<TaskArtifact, 'artifactId'>;
    }
  | { type: 'step_failed'; stepId: string; errorCode: string; message: string }
  | { type: 'agent_summon'; agentId: string; agentName: string; agentRole: string; action: string }
  | { type: 'text_delta'; text: string }
  | { type: 'artifact'; artifact: Omit<TaskArtifact, 'artifactId'> }
  | { type: 'clarification_required'; clarification: Omit<ClarificationPayload, 'kind' | 'taskId'> }
  | { type: 'failed'; errorCode: string; message: string; hint: string }
  | { type: 'completed'; summary?: string; status?: 'succeeded' | 'waiting_input' };

/** 智能体召唤消息：主任务执行中协同调用其他智能体的过程展示（kind='agent'）。 */
export interface AgentSummonMessage {
  id: string;
  sessionId: string;
  kind: 'agent';
  agentId: string;
  agentName: string;
  agentRole: string;
  action: string;
  ts: number;
}

export interface AssistantProvider {
  run(request: AssistantRequest, signal: AbortSignal): AsyncIterable<TaskEvent>;
}

/* ========== 全局导航 · Conversation 模型（需求：全局功能导航 + 对话历史管理） ========== */

/** Conversation = 交互上下文；Event = 业务对象（数据仍挂在 session 上，二者通过 eventId 关联，可多对一）。 */
export type ConversationType = 'emergency' | 'daily' | 'resource' | 'general';

export type ConversationStatus = 'active' | 'processing' | 'completed' | 'draft';

export interface Conversation {
  id: string;
  title: string;
  type: ConversationType;
  eventId?: string;
  summary?: string;
  status: ConversationStatus;
  createdAt: string;
  updatedAt: string;
  /** 置顶：侧栏单独「置顶」分组；置顶会话不再落入今天/昨天/更早。 */
  pinned?: boolean;
}

/** 一级导航页；'library' 为本次 UI 改版新增的独立文书库入口。 */
export type NavPage = 'assistant' | 'library' | 'projects' | 'agents' | 'schedules' | 'knowledge';

export interface ConversationSettings {
  openRecentOnStart: boolean;
  notifyTaskDone: boolean;
  notifyDocReady: boolean;
  demoMode: boolean;
}
