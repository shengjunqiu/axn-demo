/**
 * 受控 Mock Provider：规则意图识别 + 确定性任务编排。
 * 所有回复均为模拟结果，不接真实大模型；步骤与依据来自本地种子与运行时状态。
 */
import type {
  AssistantProvider,
  AssistantRequest,
  Proposal,
  TaskEvent,
} from '@/domain/types';
import {
  DEMO_CLOCK,
  factById,
  incidentById,
  knowledgeById,
  teamById,
  warehouseById,
  faultScenarios,
} from '@/seed/scenario';
import { RESCUE_EVALUATION_MOCK } from '@/seed/rescueEvaluation';
import { computeDerived } from '@/seed/derived';
import { type FixtureFact, type FixtureTeam, type FixtureIncident, type FixtureKnowledge } from '@/seed/scenario';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { isActiveRun } from '../taskRuns.js';
import { useDocumentStore } from '@/store/documentStore';
import { resourceAllowed, factDisplay, latestWaterLevelFactId, resolveFact } from '../factLookup.js';
import {
  CONTROL_STATUS_LABEL,
  createDailyDocument,
  createEventDocument,
  fieldLabel,
  missingBriefFields,
  missingDailyFields,
} from '../documentFactory.js';
import { ensureQaLoaded, getQaItem, matchQa, qaStatusLabel } from '../qaKnowledge.js';

/**
 * 未命中任何演示意图（输入框自由文本）时的默认回复。
 * taskRunner 在创建任务前就直接回复这句，不发任务卡、不展示「意图识别」步骤。
 */
export const UNKNOWN_REPLY_TEXT =
  '安小能暂未接入真实功能，你可以点击推荐问题或快捷任务来体验演示效果。';

export class TaskFault extends Error {
  constructor(
    public errorCode: string,
    message: string,
    public hint: string,
    public recoverable: boolean,
  ) {
    super(message);
  }
}

type Ctx = AssistantRequest;

function assertActive(req: Ctx): void {
  if (!isActiveRun(req.taskId, req.attemptId)) throw new DOMException('Inactive run', 'AbortError');
}

const sleep = (ms: number, signal: AbortSignal) =>
  new Promise<void>((resolve, reject) => {
    if (signal.aborted) { reject(new DOMException('Aborted', 'AbortError')); return; }
    const onAbort = () => {
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      signal.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    signal.addEventListener('abort', onAbort, { once: true });
  });

// ===== 意图识别（规则，非模型） =====

export interface RecognizedIntent {
  intent: AssistantRequest['intent'];
  params: Record<string, unknown>;
  displayTitle: string;
}

function teamByName(text: string, ids: string[]): string | null {
  for (const id of ids) {
    const t = teamById.get(id);
    if (!t) continue;
    const name = String(factById.get(t.factRefs.name)?.value ?? '');
    if (name && text.includes(name)) return id;
    if (text.toLowerCase().includes(id.toLowerCase())) return id;
  }
  return null;
}

export function recognize(rawText: string, ctx: { lastResourceResultIds: string[]; candidateResourceIds: string[] }): RecognizedIntent {
  const text = rawText.trim();

  // 与应急业务无关的闲聊/无关问题 → 明确兑底，不硬套灾情摘要（产品红线：未知问题不伪装成摘要）
  if (/^(今天|现在)?(天气|气温|股票|新闻|笑话|周杰伦)/.test(text) || /天气(怎么样|如何)/.test(text)) {
    return { intent: 'unknown', params: {}, displayTitle: '未能识别的请求' };
  }

  if (/^(停止|取消|停下|中断)/.test(text)) {
    return { intent: 'stop', params: {}, displayTitle: '停止当前任务' };
  }
  const ru = text.match(/报送单位[是为：:]\s*(.+)/);
  if (ru) {
    // 防御性剥离：用户可能重复前缀（如澄清表单拼接后出现“报送单位：报送单位是…”）
    const value = ru[1].trim().replace(/^报送单位[是为：:]\s*/, '');
    return { intent: 'fill_reporting_unit', params: { value }, displayTitle: '补录报送单位' };
  }
  const ho = text.match(/交接事项[是为：:]\s*(.+)/);
  if (ho) {
    const value = ho[1].trim().replace(/^交接事项[是为：:]\s*/, '');
    return { intent: 'fill_handover', params: { value }, displayTitle: '补录交接事项' };
  }
  if (/^(评估救援效果|救援效果评估|评估救援成效)$/.test(text)) {
    return { intent: 'evaluation', params: {}, displayTitle: '评估救援效果' };
  }
  if (text === '生成救援方案') {
    return { intent: 'proposal', params: {}, displayTitle: '生成救援方案' };
  }
  // 抢险救援知识问答（qa.json，126 条，模拟文档溯源）：归一化精确/双向包含命中，优先于含“要情/最快”等词的业务正则
  const qaHit = matchQa(text);
  if (qaHit) {
    return { intent: 'qa_knowledge', params: { qaId: qaHit.id }, displayTitle: '知识问答' };
  }
  if (/(生成|起草|写|形成|出).{0,6}(要情|简报)|要情/.test(text)) {
    return { intent: 'doc_brief', params: {}, displayTitle: '生成应急要情' };
  }
  if (/(生成|起草|写|形成|出).{0,6}日报|值班日报/.test(text)) {
    return { intent: 'doc_daily', params: {}, displayTitle: '生成值班日报' };
  }
  if (/(最快|先到|多久能到|预计到达|按到达时间排序)/.test(text)) {
    return { intent: 'resource_sort_eta', params: {}, displayTitle: '按预计到达排序' };
  }
  if (/(最近|距离最短|距离最近|按距离排序)/.test(text)) {
    return { intent: 'resource_sort_distance', params: {}, displayTitle: '按距离排序' };
  }
  let removeTarget: string | null | undefined;
  const ordinal = text.match(/(?:移除|去掉|剔除|移出|删除)第([一二三123])支/);
  if (ordinal) {
    const index = '一二三'.indexOf(ordinal[1]);
    removeTarget = index >= 0
      ? ctx.candidateResourceIds[index]
      : ctx.candidateResourceIds[Number(ordinal[1]) - 1];
  } else {
    removeTarget = teamByName(text, [...teamById.keys()]);
  }
  if (removeTarget && /(移除|去掉|剔除|移出|删除)/.test(text)) {
    return { intent: 'candidate_remove', params: { resourceId: removeTarget }, displayTitle: '移除候选力量' };
  }
  if (/(选|加入|预置|候选|增援).{0,12}(前两|前2|两支|2支|top2)|前两支|前2支/.test(text)) {
    return { intent: 'candidate_add_top2', params: {}, displayTitle: '预置候选力量（前 2 支）' };
  }
  const addTarget = teamByName(text, [...teamById.keys()]);
  if (addTarget && /(选|加入|预置|候选|列为)/.test(text)) {
    return { intent: 'candidate_add_top2', params: { resourceId: addTarget }, displayTitle: '加入候选力量' };
  }
  if (/(处置建议|怎么处置|如何处置|建议.{0,4}措施|工作建议|下一步建议)/.test(text)) {
    return { intent: 'proposal', params: {}, displayTitle: '形成处置建议' };
  }
  if (/周边有哪些可以调动的专业救援力量|(?:查询|查找|查)(?:可调|可调动的)?(?:队伍|资源|救援力量)|(?:资源|队伍|救援力量|仓库|物资).{0,10}(?:查|找|有哪些|清单|盘点)|周边.{0,6}(?:资源|队伍|救援)/.test(text)) {
    return { intent: 'resource_query', params: {}, displayTitle: '查询周边救援资源' };
  }
  if (/(依据|来源|为什么|根据什么|出处)/.test(text)) {
    return { intent: 'knowledge', params: { chunkId: 'kb-demo-status-terms' }, displayTitle: '解释依据与术语' };
  }
  if (/(摘要|灾情|态势|概况|什么情况|发生了什么|情况怎么样)/.test(text)) {
    return { intent: 'summary', params: {}, displayTitle: '汇总灾情摘要' };
  }
  return { intent: 'unknown', params: {}, displayTitle: '未能识别的请求' };
}

// ===== 事件流构建 =====

/**
 * 意图 → 协同智能体映射（模拟协同）：任务执行前先在对话中展示召唤效果。
 * 知识问答/解释/停止/未知不召唤（直接回答或兜底）。
 */
function summonFor(intent: Ctx['intent']):
  | { agentId: string; agentName: string; agentRole: string; action: string }
  | null {
  switch (intent) {
    case 'evaluation':
      return { agentId: 'agent-eval', agentName: '效果评估智能体', agentRole: '评估救援进展、处置成效与剩余风险', action: '正在汇总现场反馈与模拟救援记录，对比目标完成情况并生成阶段性评估' };
    case 'summary':
      return {
        agentId: 'agent-situation',
        agentName: '态势感知智能体',
        agentRole: '汇总事件事实与监测数据',
        action: '正在比对事件事实、接报信息与水情监测数据，生成灾情摘要',
      };
    case 'resource_query':
    case 'resource_sort_eta':
    case 'resource_sort_distance':
    case 'candidate_add_top2':
    case 'candidate_remove':
      return {
        agentId: 'agent-resource',
        agentName: '资源管理智能体',
        agentRole: '查询与调度救援资源',
        action: '正在检索本事件授权范围内的救援队伍与装备仓库，并汇总可用状态',
      };
    case 'proposal':
      return {
        agentId: 'agent-plan',
        agentName: '救援方案生成智能体',
        agentRole: '形成处置建议与响应等级建议',
        action: '正在结合灾情摘要与候选力量，拟定处置步骤与依据',
      };
    case 'doc_brief':
    case 'doc_daily':
    case 'fill_reporting_unit':
    case 'fill_handover':
      return {
        agentId: 'agent-doc',
        agentName: '文书生成智能体',
        agentRole: '生成与校核应急文书',
        action: '正在按模板绑定事实字段，起草文书并标注来源',
      };
    default:
      return null;
  }
}

async function* runIntent(req: Ctx, signal: AbortSignal): AsyncIterable<TaskEvent> {
  const demo = useDemoStore.getState();
  const paceMs = demo.pace === 'fast' ? 130 : 620;
  const summon = summonFor(req.intent);
  if (summon) yield { type: 'agent_summon', ...summon };
  if (['summary', 'proposal', 'doc_brief', 'evaluation'].includes(req.intent) && !incidentById.has(req.eventId)) {
    yield { type: 'step_started', stepId: 'context', name: '检查关联灾情' };
    await sleep(paceMs, signal);
    assertActive(req);
    yield { type: 'step_completed', stepId: 'context', outputSummary: '当前对话尚未关联有效灾情' };
    yield { type: 'text_delta', text: '当前对话尚未关联有效灾情。请在对话顶部“关联灾情”中选择一个事件，再点击对应快捷按钮继续；不会引用其他事件的数据。' };
    yield { type: 'completed', summary: '等待关联灾情', status: 'waiting_input' };
    return;
  }
  switch (req.intent) {
    case 'evaluation':
      yield* runEvaluation(req, signal, paceMs);
      break;
    case 'summary':
      yield* runSummary(req, signal, paceMs);
      break;
    case 'resource_query':
      yield* runResourceQuery(req, signal, paceMs);
      break;
    case 'resource_sort_eta':
      yield* runResourceSort(req, signal, paceMs, 'eta');
      break;
    case 'resource_sort_distance':
      yield* runResourceSort(req, signal, paceMs, 'distance');
      break;
    case 'candidate_add_top2':
      yield* runCandidateAdd(req, signal, paceMs);
      break;
    case 'candidate_remove':
      yield* runCandidateRemove(req, signal, paceMs);
      break;
    case 'knowledge':
      yield* runKnowledge(req, signal, paceMs);
      break;
    case 'qa_knowledge':
      yield* runQaKnowledge(req, signal, paceMs);
      break;
    case 'proposal':
      yield* runProposal(req, signal, paceMs);
      break;
    case 'doc_brief':
      yield* runDocBrief(req, signal, paceMs);
      break;
    case 'doc_daily':
      yield* runDocDaily(req, signal, paceMs);
      break;
    case 'fill_reporting_unit':
      yield* runFillField(req, signal, paceMs, 'reportingUnit');
      break;
    case 'fill_handover':
      yield* runFillField(req, signal, paceMs, 'handOverNotes');
      break;
    case 'stop':
      yield { type: 'text_delta', text: '已收到停止指令。运行中的任务会被中断，已完成的产物保留在会话中。' };
      yield { type: 'completed' };
      break;
    default:
      // 正常不会走到：taskRunner 已对 unknown 意图直接回复默认文案（不发任务卡）。
      // 保留为兑底，避免任何异常路径下安小能“失语”。
      yield { type: 'text_delta', text: UNKNOWN_REPLY_TEXT };
      yield { type: 'completed', summary: '默认回复' };
  }
}

async function* runEvaluation(req: Ctx, signal: AbortSignal, paceMs: number): AsyncIterable<TaskEvent> {
  const evaluationIncident = incidentById.get(req.eventId);
  if (!evaluationIncident) throw new Error(`event ${req.eventId} not found`);
  const incident = evaluationIncident;
  const scope = { kind: 'event' as const, eventId: req.eventId };
  const sample = RESCUE_EVALUATION_MOCK[req.eventId];
  yield { type: 'step_started', stepId: 'e1', name: '汇总灾情与救援反馈', inputSummary: '事件事实 + 模拟作业记录' };
  await sleep(paceMs, signal);
  assertActive(req);
  yield { type: 'step_completed', stepId: 'e1', outputSummary: factDisplay(incident.factRefs.title, scope), sourceRefs: [incident.factRefs.controlStatus, incident.factRefs.casualty] };
  yield { type: 'step_started', stepId: 'e2', name: '对比救援目标与阶段成效' };
  await sleep(paceMs, signal);
  assertActive(req);
  const metrics = sample
    ? `目标完成：${sample.objective} ${sample.completed}/${sample.target}${sample.unit}，完成率 ${Math.round(sample.completed / sample.target * 100)}%。\n响应时效：模拟首次响应 ${sample.responseMinutes} 分钟，目标 ${sample.targetMinutes} 分钟，达到目标。\n力量投入：模拟作业记录为 ${sample.personnel} 人、${sample.equipment} 台设备（独立模拟记录，不代表候选力量已调派）。`
    : '当前事件尚无模拟救援作业记录，目标完成率、响应时效和投入效能待补充现场反馈后评估。';
  yield { type: 'step_completed', stepId: 'e2', outputSummary: sample ? `${sample.objective}完成率 ${Math.round(sample.completed / sample.target * 100)}%，响应时效达到模拟目标` : '缺少作业记录，保留待评估项' };
  yield { type: 'step_started', stepId: 'e3', name: '形成救援效果评估与改进建议' };
  await sleep(paceMs, signal);
  assertActive(req);
  yield { type: 'text_delta', text: `救援效果评估 · ${factDisplay(incident.factRefs.title, scope)}（模拟）\n\n一、当前处置情况\n险情状态：${factDisplay(incident.factRefs.controlStatus, scope)}。\n人员情况：${factDisplay(incident.factRefs.casualty, scope)}。\n\n二、阶段性救援成效\n${metrics}\n\n三、评估结论\n${sample ? '模拟记录显示阶段目标正在推进、响应及时，仍有未完成事项，尚不能判定救援任务全部完成。' : '资料不足，暂不形成救援成效结论。'}\n\n四、剩余风险与改进建议\n${sample?.risk ?? '需补齐救援进展、现场监测和人员救助记录。'}\n${sample?.next ?? '补充任务目标、实际完成量、到场时间和投入记录后重新评估。'}\n\n评估依据：当前事件模拟事实与独立模拟作业记录；用于展示阶段复盘，不作为真实现场结论。` };
  yield { type: 'step_completed', stepId: 'e3', outputSummary: '救援效果评估已生成（模拟）' };
  yield { type: 'completed', summary: '救援效果评估完成' };
}

async function* runSummary(req: Ctx, signal: AbortSignal, paceMs: number): AsyncIterable<TaskEvent> {
  const incidentIn = incidentById.get(req.eventId);
  if (!incidentIn) throw new Error(`event ${req.eventId} not found`);
  const incident = incidentIn;
  const refs = incident.factRefs;
  const scope = { kind: 'event' as const, eventId: req.eventId };
  const waterFactId = latestWaterLevelFactId(req.eventId);
  const observedAt = factDisplay('fact-obs-water-005-observedAt', scope);
  const rows: {
    label: string;
    factId: string;
    displayOverride?: string;
    emphasize?: 'suggested' | 'pending';
  }[] = [
    { label: '事件名称', factId: refs.title },
    { label: '发生时间', factId: refs.occurredAt },
    { label: '事发地点', factId: refs.location },
    { label: '险情类型', factId: refs.disasterType },
    { label: '处置状态', factId: refs.controlStatus, displayOverride: CONTROL_STATUS_LABEL[String(factById.get(refs.controlStatus)?.value ?? '')] ?? undefined },
    { label: '影响范围', factId: refs.impactScope, emphasize: resolveFact(refs.impactScope, scope)?.verification === 'pending' ? 'pending' : undefined },
    { label: '人员伤亡情况', factId: refs.casualty, emphasize: resolveFact(refs.casualty, scope)?.verification === 'pending' ? 'pending' : undefined },
    ...(waterFactId ? [{ label: '最新水位', factId: waterFactId, displayOverride: `${factDisplay(waterFactId, scope)}（${observedAt} 观测）` }] : []),
    {
      label: '建议响应等级',
      factId: incident.situationFactRefs.suggestedResponseLevel,
      displayOverride: `${factDisplay(incident.situationFactRefs.suggestedResponseLevel, scope)} 级（建议，尚未确认）`,
      emphasize: 'suggested',
    },
    {
      label: resolveFact(refs.confirmedResponseLevel, scope)?.verification === 'confirmed' ? '已确认响应等级' : '响应等级（待核实）',
      factId: refs.confirmedResponseLevel,
      displayOverride: `${factDisplay(refs.confirmedResponseLevel, scope)}（${resolveFact(refs.confirmedResponseLevel, scope)?.verification === 'confirmed' ? '已确认' : '待核实'}）`,
    },
  ].filter((row) => resolveFact(row.factId, scope)) as typeof rows;

  yield { type: 'step_started', stepId: 's1', name: '读取事件上下文', inputSummary: `事件 ${req.eventId}` };
  await sleep(paceMs, signal);
  assertActive(req);
  yield {
    type: 'step_completed',
    stepId: 's1',
    outputSummary: String(factById.get(refs.title)?.value ?? req.eventId),
    sourceRefs: [refs.title],
  };

  yield { type: 'step_started', stepId: 's2', name: '汇总结构化事实', inputSummary: '接报与事件服务（模拟）+ 水情监测服务（模拟）' };
  await sleep(paceMs, signal);
  assertActive(req);
  yield {
    type: 'step_completed',
    stepId: 's2',
    outputSummary: `共 ${rows.length} 项结构化事实`,
    sourceRefs: rows.map((r) => r.factId),
  };

  yield { type: 'step_started', stepId: 's3', name: '生成灾情摘要卡片' };
  await sleep(paceMs, signal);
  assertActive(req);
  const pendingKeys = rows.flatMap((r) => r.emphasize === 'pending' ? [r.factId] : []);
  yield {
    type: 'step_completed',
    stepId: 's3',
    outputSummary: '摘要卡片已生成',
    sourceRefs: rows.map((r) => r.factId),
    artifact: {
      payload: {
        kind: 'summary',
        eventId: req.eventId,
        rows,
        pendingKeys,
        waterLevelFactId: waterFactId,
        dataTime: DEMO_CLOCK,
        sourceUnavailable: waterFactId ? null : '当前事件无水情监测依据',
      },
    },
  };
  yield {
    type: 'text_delta',
    text: waterFactId
      ? '已按模拟数据源汇总当前灾情，影响范围与人员伤亡情况详见下方摘要。建议响应等级来自上游态势服务（尚未确认），全部数据为模拟数据。'
      : '已汇总当前事件事实。当前事件无水情监测及上游态势建议依据；未确认字段保持待核实。全部数据为模拟数据。',
  };
  yield { type: 'completed', summary: '灾情摘要已生成' };
}

async function* runResourceQuery(req: Ctx, signal: AbortSignal, paceMs: number): AsyncIterable<TaskEvent> {
  const demo = useDemoStore.getState();
  if (![...teamById.keys(), ...warehouseById.keys()].some((id) => resourceAllowed(id, req.eventId))) {
    yield { type: 'text_delta', text: '当前事件暂无获授权的资源数据，不能沿用其他事件的距离或预计到达时间。' };
    yield { type: 'completed', summary: '无获授权的资源数据' };
    return;
  }
  yield { type: 'step_started', stepId: 'r1', name: '确定查询范围', inputSummary: `事件 ${req.eventId} 周边（模拟距离）` };
  await sleep(paceMs, signal);
  assertActive(req);
  yield {
    type: 'step_completed',
    stepId: 'r1',
    outputSummary: '范围：3 支模拟队伍、2 处模拟仓库',
    sourceRefs: ['fact-team-001-name', 'fact-warehouse-001-name'],
  };

  yield { type: 'step_started', stepId: 'r2', name: '过滤可用状态', inputSummary: '按模拟状态字段过滤' };
  await sleep(paceMs, signal);
  assertActive(req);
  if (demo.consumeFault('resource_timeout_once')) {
    yield {
      type: 'step_failed',
      stepId: 'r2',
      errorCode: 'RESOURCE_TIMEOUT',
      message: '资源服务超时（模拟故障注入）',
    };
    throw new TaskFault(
      'RESOURCE_TIMEOUT',
      '资源服务超时（模拟故障注入）',
      '可点击“重试”建立新的执行尝试；已完成的摘要产物会保留。',
      true,
    );
  }
  const excluded = [{ resourceId: 'team-003', reason: '正在执行其他模拟任务，不可加入本事件候选。' }];
  yield {
    type: 'step_completed',
    stepId: 'r2',
    outputSummary: '2 支队伍可用，1 支不可用',
    sourceRefs: ['fact-team-003-status'],
  };

  yield { type: 'step_started', stepId: 'r3', name: '组装结果并按预计到达排序' };
  await sleep(paceMs, signal);
  assertActive(req);
  const ids = ['team-001', 'team-002', 'warehouse-001', 'warehouse-002'].filter((id) => resourceAllowed(id, req.eventId));
  yield {
    type: 'step_completed',
    stepId: 'r3',
    outputSummary: '返回 2 支队伍、2 处仓库',
    sourceRefs: ['fact-team-001-etaMinutes', 'fact-team-002-etaMinutes'],
    artifact: {
      payload: {
        kind: 'resources',
        eventId: req.eventId,
        resourceIds: ids,
        sortedBy: 'eta',
        dataTime: DEMO_CLOCK,
        excluded,
        note: '距离与预计到达时间为模拟数据；图上位置不用于计算公里数或 ETA。',
      },
    },
  };
  yield {
    type: 'text_delta',
    text: '查询到 2 支可用队伍与 2 处仓库（模拟数据）。team-003 因正在执行其他模拟任务未列入。需要按“谁最快能到”继续追问，或选择队伍加入候选。',
  };
  yield { type: 'completed', summary: '资源查询完成' };
}

async function* runResourceSort(req: Ctx, signal: AbortSignal, paceMs: number, by: 'eta' | 'distance'): AsyncIterable<TaskEvent> {
  if (!req.context.lastResourceResultIds.length) {
    yield {
      type: 'text_delta',
      text: '还没有可排序的资源结果。请先说“查询周边救援资源”，我再按预计到达时间或距离排序（模拟数据）。',
    };
    yield { type: 'completed', summary: '等待先进行资源查询' };
    return;
  }
  yield { type: 'step_started', stepId: 's1', name: '解析指代', inputSummary: '使用最近一次资源查询结果' };
  await sleep(paceMs, signal);
  assertActive(req);
  yield { type: 'step_completed', stepId: 's1', outputSummary: `${req.context.lastResourceResultIds.length} 个对象` };

  yield { type: 'step_started', stepId: 's2', name: by === 'eta' ? '按预计到达时间排序' : '按模拟距离排序' };
  await sleep(paceMs, signal);
  assertActive(req);
  const teams = req.context.lastResourceResultIds.filter((id) => teamById.has(id) && resourceAllowed(id, req.eventId));
  const sorted = [...teams].sort((a, b) => {
    const fa = factById.get((teamById.get(a) as FixtureTeam).factRefs[by === 'eta' ? 'etaMinutes' : 'distanceKm']) as FixtureFact;
    const fb = factById.get((teamById.get(b) as FixtureTeam).factRefs[by === 'eta' ? 'etaMinutes' : 'distanceKm']) as FixtureFact;
    return Number(fa.value) - Number(fb.value);
  });
  // 排序结果同时成为后续指代使用的唯一有序集合，仓库保持在队伍之后。
  useSessionStore.getState().setLastResourceResult(req.sessionId, [
    ...sorted, ...req.context.lastResourceResultIds.filter((id) => warehouseById.has(id) && resourceAllowed(id, req.eventId)),
  ], by);
  const lines = sorted
    .map((id, i) => {
      const t = teamById.get(id) as FixtureTeam;
      const name = String(factById.get(t.factRefs.name)?.value ?? id);
      const eta = factById.get(t.factRefs.etaMinutes)?.value;
      const km = factById.get(t.factRefs.distanceKm)?.value;
      return `${i + 1}. ${name}：预计 ${eta} 分钟到达，距离约 ${km} 公里（模拟）`;
    })
    .join('\n');
  yield {
    type: 'step_completed',
    stepId: 's2',
    outputSummary: '排序完成',
    sourceRefs: sorted.flatMap((id) => [
      (teamById.get(id) as FixtureTeam).factRefs.etaMinutes,
      (teamById.get(id) as FixtureTeam).factRefs.distanceKm,
    ]),
  };
  yield { type: 'text_delta', text: `${by === 'eta' ? '按预计到达时间' : '按距离'}排序结果：\n${lines}\n\n可说“选择前两支队伍预置候选”。` };
  yield { type: 'completed', summary: '排序完成' };
}

async function* runCandidateAdd(req: Ctx, signal: AbortSignal, paceMs: number): AsyncIterable<TaskEvent> {
  const fromResult = req.context.lastResourceResultIds.filter((id) => teamById.has(id) && resourceAllowed(id, req.eventId));
  let targets: string[] = [];
  if (typeof req.params.resourceId === 'string') {
    targets = [req.params.resourceId];
  } else if (/前两|前2|两支|2支/.test(req.userInput)) {
    targets = fromResult.slice(0, 2);
  } else {
    const named = teamByName(req.userInput, fromResult);
    targets = named ? [named] : fromResult.slice(0, 2);
  }
  targets = targets.filter((id) => teamById.has(id));
  if (!targets.length) {
    yield { type: 'text_delta', text: '还没有可选择的队伍。请先查询周边救援资源，再从结果中选择。' };
    yield { type: 'completed', summary: '无候选可添加' };
    return;
  }
  yield { type: 'step_started', stepId: 'c1', name: '解析待加入队伍', inputSummary: targets.join('、') };
  await sleep(paceMs, signal);
  assertActive(req);
  yield { type: 'step_completed', stepId: 'c1', outputSummary: `${targets.length} 支队伍`, sourceRefs: targets.map((id) => (teamById.get(id) as FixtureTeam).factRefs.name) };

  yield { type: 'step_started', stepId: 'c2', name: '写入候选清单（拟预置）', inputSummary: '候选 ≠ 已调派' };
  await sleep(paceMs, signal);
  assertActive(req);
  const store = useSessionStore.getState();
  const before = store.sessions[req.sessionId].candidateResourceIds;
  store.addCandidates(req.sessionId, targets);
  const merged = useSessionStore.getState().sessions[req.sessionId].candidateResourceIds;
  const added = merged.filter((id) => !before.includes(id)).length;
  const rejected = targets.filter((id) => !merged.includes(id)).length;
  const teamCount = computeDerived('candidate_team_count', merged);
  const people = computeDerived('candidate_people_count', merged);
  const excavators = computeDerived('candidate_excavator_count', merged);
  yield {
    type: 'step_completed',
    stepId: 'c2',
    outputSummary: `候选 ${teamCount.value} 支队伍`,
    sourceRefs: merged.flatMap((id) => Object.values((teamById.get(id) as FixtureTeam).factRefs)),
    artifact: {
      payload: {
        kind: 'summary',
        eventId: req.eventId,
        rows: [
          { label: '候选队伍数', factId: 'candidate_team_count', displayOverride: `${teamCount.value} 支（派生值）` },
          { label: '候选人员总数', factId: 'candidate_people_count', displayOverride: `${people.value} 人（派生值）` },
          { label: '候选挖掘机总数', factId: 'candidate_excavator_count', displayOverride: `${excavators.value} 台（派生值）` },
        ],
        pendingKeys: [],
        waterLevelFactId: null,
        dataTime: DEMO_CLOCK,
        sourceUnavailable: null,
      },
    },
  };
  yield {
    type: 'text_delta',
    text: `${rejected ? `有 ${rejected} 支队伍未加入（不可调或未获当前事件授权）。` : ''}${added ? `已新增 ${added} 支拟预置候选（未调派）。` : '候选未新增。'}当前候选合计：${teamCount.value} 支队伍、${people.value} 人、${excavators.value} 台挖掘机（由统一数据计算）。`,
  };
  yield { type: 'completed', summary: '候选已更新' };
}

async function* runCandidateRemove(req: Ctx, signal: AbortSignal, paceMs: number): AsyncIterable<TaskEvent> {
  const target = String(req.params.resourceId ?? '');
  const session = useSessionStore.getState().sessions[req.sessionId];
  if (!target || !session.candidateResourceIds.includes(target)) {
    yield { type: 'text_delta', text: '该队伍不在当前候选清单中。可在右侧工作区直接切换候选状态。' };
    yield { type: 'completed', summary: '候选未变化' };
    return;
  }
  yield { type: 'step_started', stepId: 'c1', name: '定位候选队伍', inputSummary: target };
  await sleep(paceMs, signal);
  assertActive(req);
  yield { type: 'step_completed', stepId: 'c1', outputSummary: String(factById.get((teamById.get(target) as FixtureTeam).factRefs.name)?.value ?? target) };
  yield { type: 'step_started', stepId: 'c2', name: '从候选清单移除' };
  await sleep(paceMs, signal);
  assertActive(req);
  useSessionStore.getState().removeCandidate(req.sessionId, target);
  const merged = useSessionStore.getState().sessions[req.sessionId].candidateResourceIds;
  const teamCount = computeDerived('candidate_team_count', merged);
  const people = computeDerived('candidate_people_count', merged);
  const excavators = computeDerived('candidate_excavator_count', merged);
  yield {
    type: 'step_completed',
    stepId: 'c2',
    outputSummary: `剩余候选 ${teamCount.value} 支`,
    sourceRefs: [],
  };
  yield { type: 'text_delta', text: `已移除该队伍（拟预置候选变化，不影响任何已确认记录）。当前候选：${teamCount.value} 支、${people.value} 人、${excavators.value} 台挖掘机。` };
  yield { type: 'completed', summary: '候选已更新' };
}

async function* runKnowledge(req: Ctx, signal: AbortSignal, paceMs: number): AsyncIterable<TaskEvent> {
  const chunk = knowledgeById.get('kb-demo-status-terms') ?? knowledgeById.values().next().value as FixtureKnowledge;
  yield { type: 'step_started', stepId: 'k1', name: '检索知识包', inputSummary: chunk.title };
  await sleep(paceMs, signal);
  assertActive(req);
  yield {
    type: 'step_completed',
    stepId: 'k1',
    outputSummary: `${chunk.title}（${chunk.sourceLabel}）`,
    sourceRefs: [chunk.chunkId],
  };
  yield {
    type: 'artifact',
    artifact: {
      payload: {
        kind: 'knowledge',
        chunkIds: [chunk.chunkId],
        answer: chunk.content,
        dataTime: DEMO_CLOCK,
      },
    },
  };
  yield { type: 'text_delta', text: `${chunk.content}\n\n（来源：${chunk.sourceLabel}，${chunk.notice}）` };
  yield { type: 'completed', summary: '知识解答完成' };
}

/**
 * 抢险救援知识问答（qa.json，模拟数据）：检索本地问题库 → 结构化答案卡 + 模拟文档溯源。
 * 回答内容全部来自种子 JSON，不接真实大模型；现场处置以现场指挥体系与专业判断为准。
 */
async function* runQaKnowledge(req: Ctx, signal: AbortSignal, paceMs: number): AsyncIterable<TaskEvent> {
  const qaId = Number(req.params.qaId);
  // 语料按需加载（正常链路在 taskRunner 已加载，这里兜住直接调用本函数的路径）。
  await ensureQaLoaded();
  const item = getQaItem(qaId);
  if (!item) {
    // 语料缺项：不假装成知识回答，直接给默认回复。
    yield { type: 'text_delta', text: UNKNOWN_REPLY_TEXT };
    yield { type: 'completed', summary: '默认回复' };
    return;
  }
  const a = item.answer;
  yield { type: 'step_started', stepId: 'q1', name: '检索抢险救援知识库', inputSummary: `${item.category} · ${item.question}` };
  await sleep(paceMs, signal);
  assertActive(req);
  yield {
    type: 'step_completed',
    stepId: 'q1',
    outputSummary: `命中知识条目（${item.sources.length} 个模拟文档来源）`,
    sourceRefs: item.sources.map((s) => s.docId),
  };
  yield {
    type: 'artifact',
    artifact: {
      payload: {
        kind: 'qa_knowledge',
        qaId: item.id,
        question: item.question,
        category: item.category,
        summary: a.summary,
        keyActions: a.keyActions,
        doNot: a.doNot,
        supportAndReporting: a.supportAndReporting,
        liveDataNeeded: a.liveDataNeeded,
        confidence: item.confidence,
        answerStatus: item.answerStatus,
        sources: item.sources.map((s) => ({ docId: s.docId, title: s.title, section: s.section, excerpt: s.excerpt, simulated: s.simulated })),
        dataTime: DEMO_CLOCK,
      },
    },
  };
  // 答案全文已在 QA 知识卡中展示，流式文本仅补充来源提示，避免同一回答出现两次
  yield {
    type: 'text_delta',
    text: `以上为结构化回答（模拟数据），来源与依据见上方知识卡；置信度 ${Math.round(item.confidence * 100)}%，${qaStatusLabel(item.answerStatus)}。`,
  };
  await sleep(paceMs, signal);
  assertActive(req);
  yield { type: 'completed', summary: `知识问答完成（模拟文档溯源 · ${item.category}）` };
}

async function* runProposal(req: Ctx, signal: AbortSignal, paceMs: number): AsyncIterable<TaskEvent> {
  yield { type: 'step_started', stepId: 'p1', name: '读取事件事实与候选', inputSummary: `事件 ${req.eventId}` };
  await sleep(paceMs, signal);
  assertActive(req);
  const session = useSessionStore.getState().sessions[req.sessionId];
  const initialCandidates = session.candidateResourceIds;
  const incident = incidentById.get(req.eventId) as FixtureIncident;
  const factRefs = [incident.factRefs.casualty, incident.factRefs.impactScope, incident.situationFactRefs.suggestedResponseLevel].filter((id) => resolveFact(id, { kind: 'event', eventId: req.eventId }));
  yield {
    type: 'step_completed',
    stepId: 'p1',
    outputSummary: `候选 ${initialCandidates.length} 支；生成前将复核最新候选`,
    sourceRefs: factRefs,
  };
  yield { type: 'step_started', stepId: 'p2', name: '匹配知识包', inputSummary: '要素清单 / 案例 / 术语' };
  await sleep(paceMs, signal);
  assertActive(req);
  yield { type: 'step_completed', stepId: 'p2', outputSummary: `命中 ${knowledgeById.size} 个知识条目（模拟）`, sourceRefs: [...knowledgeById.keys()] };

  yield { type: 'step_started', stepId: 'p3', name: '组装处置建议（待审核）' };
  await sleep(paceMs, signal);
  assertActive(req);
  // UI 可在执行期间更改候选：最终组装与写入之间不再 await。
  const candidates = [...useSessionStore.getState().sessions[req.sessionId].candidateResourceIds];
  const version = 'v1';
  const proposal: Proposal = {
    proposalId: `proposal-${crypto.randomUUID()}`,
    eventId: req.eventId,
    version,
    isMock: true,
    title: '险情处置工作建议（模拟 · 待审核）',
    sections: [
      { id: 'objective', title: '工作目标', text: '及时核实当前险情，形成可核查的工作记录。' },
      { id: 'information', title: '信息核实', text: '继续收集现场信息，明确未核实事项及对应责任。' },
      {
        id: 'resources',
        title: '拟预置力量',
        text: candidates.length
          ? candidates
              .map((id) => String(factById.get(teamById.get(id)?.factRefs.name ?? '')?.value ?? id))
              .join('、')
          : '尚未指定候选力量。',
        bindingResourceIds: candidates,
        emptyText: '尚未指定候选力量。',
      },
      { id: 'review', title: '专业审核', text: '建议开展风险评估及力量预置论证，具体处置措施由专业人员审核确定。' },
    ],
    riskNotes: [
      '人员伤亡及影响范围仍待核实。',
      '建议升级响应等级尚未确认。',
      '候选力量尚未形成正式调派命令。',
    ],
    knowledgeRefs: [...knowledgeById.keys()],
    factRefsUsed: factRefs,
    candidateIds: candidates,
    createdAt: new Date().toISOString(),
  };
  assertActive(req);
  useSessionStore.getState().addProposal(proposal);
  yield {
    type: 'step_completed',
    stepId: 'p3',
    outputSummary: '建议已生成（待审核）',
    sourceRefs: proposal.factRefsUsed,
    artifact: {
      payload: {
        kind: 'proposal',
        proposalId: proposal.proposalId,
        version,
        eventId: req.eventId,
        dataTime: DEMO_CLOCK,
      },
    },
  };
  yield {
    type: 'text_delta',
    text: '处置建议已生成（模拟 · 待审核意见）。要点：核实待核实事项、论证力量预置。注意：候选是拟使用的资源，不是已调派力量；建议响应等级尚未确认。可在右侧工作区查看依据并采纳。',
  };
  yield { type: 'completed', summary: '处置建议已生成' };
}

async function* runDocBrief(req: Ctx, signal: AbortSignal, paceMs: number): AsyncIterable<TaskEvent> {
  yield { type: 'step_started', stepId: 'd1', name: '校验必填字段', inputSummary: '应急要情模板 v1.0.0-demo' };
  await sleep(paceMs, signal);
  assertActive(req);
  const missing = missingBriefFields(req.eventId);
  if (missing.length) {
    const need = missing.includes('reportingUnit') ? 'reportingUnit' : missing[0];
    yield {
      type: 'step_completed',
      stepId: 'd1',
      outputSummary: `缺 ${missing.length} 项：${missing.map(fieldLabel).join('、')}`,
    };
    yield {
      type: 'clarification_required',
      clarification: {
        clarificationId: `clarify-${Date.now().toString(36)}`,
        field: need,
        prompt: `生成应急要情前需要补录“${fieldLabel(need)}”。请直接回复，例如：报送单位是集团应急指挥中心。`,
        exampleHint: '报送单位是集团应急指挥中心',
        scopeKind: 'event',
        scopeId: req.eventId,
      },
    };
    yield { type: 'text_delta', text: `还缺必填字段：${missing.map(fieldLabel).join('、')}。补录并确认后我再生成文书（不产出看似完整的草稿）。` };
    yield { type: 'completed', summary: '等待补录必填字段' };
    return;
  }
  yield { type: 'step_completed', stepId: 'd1', outputSummary: '必填字段齐备' };
  yield { type: 'step_started', stepId: 'd2', name: '固化事实快照', inputSummary: '生成时点数据留痕' };
  await sleep(paceMs, signal);
  assertActive(req);
  yield { type: 'step_completed', stepId: 'd2', outputSummary: '快照已建立（生成后数据变化不会改写本文书）' };
  yield { type: 'step_started', stepId: 'd3', name: '生成可编辑工作副本', inputSummary: '结构化事实绑定正文' };
  await sleep(paceMs, signal);
  assertActive(req);
  const demo = useDemoStore.getState();
  const missingSource = demo.consumeFault('missing_source_once');
  assertActive(req);
  const result = createEventDocument(req.sessionId);
  if (result.ok && result.documentId) {
    if (missingSource) injectMissingSource(result.documentId, req);
    assertActive(req);
    useSessionStore.getState().setActiveDocument(req.sessionId, result.documentId);
    yield {
      type: 'step_completed',
      stepId: 'd3',
      outputSummary: '草稿已生成，可在文书工作台编辑',
      sourceRefs: [],
      artifact: {
        payload: {
          kind: 'document',
          documentId: result.documentId,
          templateCode: 'EMERGENCY_BRIEF',
          title: '应急要情（草稿）',
          state: 'draft_created',
          missingFields: [],
        },
      },
    };
    yield { type: 'text_delta', text: '应急要情草稿已生成：正文数据均绑定模拟来源，可点击数据查看来源；可在文书工作台编辑、校核并保存版本。' };
    yield { type: 'completed', summary: '草稿已生成' };
  } else {
    yield { type: 'failed', errorCode: 'DOC_CREATE_FAILED', message: result.reason ?? '生成失败', hint: '请检查必填字段后重试。' };
  }
}

/** 故障注入：下一次生成的文书带上一个无法解析的水位事实（触发 R-002） */
function injectMissingSource(documentId: string, req: Ctx): void {
  assertActive(req);
  const draft = useDocumentStore.getState().getDraft(documentId);
  if (!draft) return;
  const content = structuredClone(draft.working.content) as typeof draft.working.content;
  for (const section of content.sections) {
    for (const p of section.paragraphs) {
      p.runs = p.runs.map((r) => (r.type === 'fact' && r.factId === latestWaterLevelFactId(req.eventId) ? { ...r, factId: 'fact-missing-waterLevel-demo' } : r));
    }
  }
  useDocumentStore.getState().updateWorkingContent(documentId, content);
}

async function* runDocDaily(req: Ctx, signal: AbortSignal, paceMs: number): AsyncIterable<TaskEvent> {
  yield { type: 'step_started', stepId: 'd1', name: '校验日报必填字段', inputSummary: '值班日报模板 v1.0.0-demo' };
  await sleep(paceMs, signal);
  assertActive(req);
  const missing = missingDailyFields();
  if (missing.length) {
    const need = missing.includes('handOverNotes') ? 'handOverNotes' : missing[0];
    yield {
      type: 'step_completed',
      stepId: 'd1',
      outputSummary: `缺 ${missing.length} 项：${missing.map(fieldLabel).join('、')}`,
    };
    yield {
      type: 'clarification_required',
      clarification: {
        clarificationId: `clarify-${Date.now().toString(36)}`,
        field: need,
        prompt: `生成值班日报前需要补录“${fieldLabel(need)}”。请直接回复，例如：交接事项是继续跟踪清河段险情和待核实事项。`,
        exampleHint: '交接事项是继续跟踪清河段险情和待核实事项',
        scopeKind: need === 'handOverNotes' ? 'shift' : 'shift',
        scopeId: 'shift-demo-001',
      },
    };
    yield { type: 'text_delta', text: `还缺必填字段：${missing.map(fieldLabel).join('、')}。补录并确认后我再生成日报。` };
    yield { type: 'completed', summary: '等待补录必填字段' };
    return;
  }
  yield { type: 'step_completed', stepId: 'd1', outputSummary: '必填字段齐备' };
  yield { type: 'step_started', stepId: 'd2', name: '统计班次派生事实', inputSummary: '由统一数据计算' };
  await sleep(paceMs, signal);
  assertActive(req);
  yield { type: 'step_completed', stepId: 'd2', outputSummary: '接报/处置中/已控制统计完成（派生事实）' };
  yield { type: 'step_started', stepId: 'd3', name: '生成日报工作副本' };
  await sleep(paceMs, signal);
  assertActive(req);
  const result = createDailyDocument(req.sessionId);
  if (result.ok && result.documentId) {
    assertActive(req);
    useSessionStore.getState().setActiveDocument(req.sessionId, result.documentId);
    yield {
      type: 'step_completed',
      stepId: 'd3',
      outputSummary: '日报草稿已生成',
      sourceRefs: [],
      artifact: {
        payload: {
          kind: 'document',
          documentId: result.documentId,
          templateCode: 'DUTY_DAILY',
          title: '值班日报（草稿）',
          state: 'draft_created',
          missingFields: [],
        },
      },
    };
    yield { type: 'text_delta', text: '值班日报草稿已生成：班次统计为派生事实，交接事项与填报单位为已确认补录。可在文书工作台继续编辑与校核。' };
    yield { type: 'completed', summary: '日报草稿已生成' };
  } else {
    yield { type: 'failed', errorCode: 'DOC_CREATE_FAILED', message: result.reason ?? '生成失败', hint: '请检查必填字段后重试。' };
  }
}

async function* runFillField(
  req: Ctx,
  signal: AbortSignal,
  paceMs: number,
  field: 'reportingUnit' | 'handOverNotes',
): AsyncIterable<TaskEvent> {
  const value = String(req.params.value ?? '').trim();
  if (!value) {
    yield { type: 'text_delta', text: `请提供“${fieldLabel(field)}”的具体内容，例如：${field === 'reportingUnit' ? '报送单位是集团应急指挥中心' : '交接事项是继续跟踪清河段险情'}。` };
    yield { type: 'completed', summary: '等待输入' };
    return;
  }
  yield { type: 'step_started', stepId: 'f1', name: '识别待补录字段', inputSummary: fieldLabel(field) };
  await sleep(paceMs, signal);
  assertActive(req);
  yield { type: 'step_completed', stepId: 'f1', outputSummary: fieldLabel(field) };

  yield { type: 'step_started', stepId: 'f2', name: '建立模拟来源并确认', inputSummary: '人工补录（模拟）· 确认后生效' };
  await sleep(paceMs, signal);
  assertActive(req);
  const demo = useDemoStore.getState();
  const scopeKind: 'event' | 'shift' = field === 'handOverNotes' ? 'shift' : 'event';
  const scopeId = field === 'handOverNotes' ? 'shift-demo-001' : req.eventId;
  const entry = demo.addManualFact({ field, value, scopeKind, scopeId, actorId: demo.actorId });
  // 报送单位同时绑定班次域（值班日报的填报单位取班次域补录，避免重复追问）
  if (field === 'reportingUnit') {
    assertActive(req);
    demo.addManualFact({ field, value, scopeKind: 'shift', scopeId: 'shift-demo-001', actorId: demo.actorId });
  }
  yield {
    type: 'step_completed',
    stepId: 'f2',
    outputSummary: `已确认：${value}`,
    sourceRefs: [entry.factId],
  };
  void resolveFact;
  void warehouseById;
  void faultScenarios;

  yield { type: 'step_started', stepId: 'f3', name: '绑定事件与班次' };
  await sleep(paceMs, signal);
  assertActive(req);
  const session = useSessionStore.getState().sessions[req.sessionId];
  const activeDocId = session?.activeDocumentId;
  let bindNote = `已绑定${scopeKind === 'event' ? '主事件' : '当前班次'}；原聊天消息不作为来源，仅确认后的补录记录生效。`;
  if (activeDocId) {
    const draft = useDocumentStore.getState().getDraft(activeDocId);
    if (draft && draft.lifecycle === 'draft') {
      assertActive(req);
      useDocumentStore.getState().setFreshness(activeDocId, 'stale');
      bindNote += ' 已有草稿标记为“数据可能过期”，请重新校核后再提交。';
    }
  }
  yield {
    type: 'step_completed',
    stepId: 'f3',
    outputSummary: bindNote,
    sourceRefs: [entry.factId],
  };
  yield { type: 'text_delta', text: `“${fieldLabel(field)}”已补录并确认：${value}。${bindNote}${session?.pendingClarification ? '\n现在可以继续生成文书了。' : ''}` };

  if (session?.pendingClarification) {
    assertActive(req);
    useSessionStore.getState().setPendingClarification(req.sessionId, null);
  }
  yield { type: 'completed', summary: `${fieldLabel(field)}已确认` };
}

export const mockProvider: AssistantProvider = {
  async *run(request, signal) {
    assertActive(request);
    for await (const event of runIntent(request, signal)) {
      assertActive(request);
      yield event;
    }
  },
};
