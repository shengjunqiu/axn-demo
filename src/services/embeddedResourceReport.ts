import { groupReportSections, V2_REPORT_STRUCTURE } from '@/pages/v2/reportStructure';
import { TASK_TEXT, SUPPLY_AUDIT_TEXT } from '@/pages/v2/businessData';
import { embeddedQaIntro } from './embeddedQa';
import type { V2AiKind } from '@/pages/v2/aiNodes';
import { dynamicsAiSections, transportAiSections, summaryAiSections } from '@/pages/v2/additionalAiData';
import { SURROUNDINGS_DATA } from '@/pages/v2/surroundingsData';
import { ASSEMBLY_HEADERS, ASSEMBLY_ROWS } from '@/pages/v2/assemblyData';
import { PLAN_SECTIONS } from '@/pages/v2/planData';
import { useConversationStore } from '@/store/conversationStore';
import { useSessionStore } from '@/store/sessionStore';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { tableToText } from './pipeTable';

const requests = new Map<string, Promise<void>>();

export function surroundingsReportSections(): [string, string][] {
  const data = SURROUNDINGS_DATA;
  const within = data.rows.filter(row => Number(row[8]) <= data.radiusKm);
  const detail = tableToText(data.headers, data.rows);
  return [
    ['一、抢险基本信息', `${data.eventName}\n${data.description}\nV2页面模拟资料，不代表实时灾情。`],
    ['二、安能队伍情况', `${data.summary}\n队伍明细：\n${detail}\n明细仅展示${data.rows.length}支队伍，其中${within.length}支在300公里内，摘要与明细不完整对应，不能把摘要人数、装备数视为明细核实合计。`],
    ['三、其他央企队伍情况', '本页未提供其他央企队伍明细，名称、能力、人数和可出动状态待补，不按零值统计。'],
    ['四、安能装备情况', `${detail}\n装备数量沿用页面模拟台账，型号、技术状态、操作手配套及可调用数量待核，不能认定全部可用。`],
    ['五、其他央企装备情况', '本页未提供其他央企装备资料，所属单位、数量、型号与可用状态待补。'],
    ['六、重点防护目标情况', '学校、医院、加油站等目标的位置、联系人及受影响情况待核；没有空间对照资料，不推断学校安全、医院可接诊或送医道路畅通。'],
    ['七、范围与数据核验', '查询范围300公里，不等于灾害影响范围。永新项目部136.39公里；梅江灌区279.15公里，人装为0，不能认定可出动；南昌队432.98公里须单列跨范围候选。距离非实时导航。核对摘要与明细差异、台账时间、联系方式、出动条件、主备路线、桥涵承载及气象。资源均为候选，未接实时接口，未审批、调派或发送。'],
  ];
}

/** 每次按钮点击对应独立会话；不将V2事件挂到青岭村等种子事件。 */
export function generateEmbeddedResourceReport(requestId: string): Promise<void> {
  const key = `surroundings:${requestId}`;
  const existing = requests.get(key);
  if (existing) return existing;
  const run = runReport();
  requests.set(key, run);
  return run;
}

export function assemblyReportSections(): [string, string][] {
  const people = ASSEMBLY_ROWS.reduce((sum, row) => sum + Number(row[1]), 0);
  const equipment = ASSEMBLY_ROWS.reduce((sum, row) => sum + Number(row[2]), 0);
  return groupReportSections('assembly', [
    ['一、事件与抽组依据', `${SURROUNDINGS_DATA.eventName}\n${SURROUNDINGS_DATA.description}\n仅使用V2人装抽组页的当前记录，模拟生成候选方案，不借用周边资源或投送页人数。`],
    ['二、人装抽组明细', tableToText(ASSEMBLY_HEADERS, ASSEMBLY_ROWS)],
    ['三、编成汇总与职责建议', `本页合计${people}人、装备${equipment}台/套。南昌队常备中队50人、42台/套，沿用第一梯队组别；指导组30人、3台/套，沿用指导组出动组别。建议分别核对工程救援任务与技术协调职责，具体岗位、驾驶员和操作手尚未提供，待负责人确认。`],
    ['四、出动条件与复核', '当前两条队伍状态均为“已返营”，不应解读为已重新出动或当前可立即调派。重新抽组前须核可用人装、专业资格、操作手配套及轮换；指令类型沿用“队伍机动”，任务目标、到位时限和责任人待补。'],
    ['五、投送与安全保障', `主备路线、桥涵承载、交通管制、天气、通信及后勤条件待核。报备页永新项目部18人仅为备勤候选待复核，不计入当前80人。后续保障参考同事件台账：${SUPPLY_AUDIT_TEXT} 不据此改变已抽组人数或推定新的到场时间。`],
    ['六、待确认与应用说明', '本方案为AI模拟候选，不自动修改人装抽组表、不下发出动指令。请复核装备明细、人员名单、可用状态、到位时限及负责人后再办理正式抽组；可编辑和导出供审阅。'],
  ], [[0], [1, 2], [3, 4, 5]]);
}

export function generateEmbeddedAssemblyReport(requestId: string): Promise<void> {
  const key = `assembly:${requestId}`;
  const existing = requests.get(key);
  if (existing) return existing;
  const run = runReport('assembly');
  requests.set(key, run);
  return run;
}

export function planReportSections(): [string, string][] {
  return groupReportSections('plan', [
    ...PLAN_SECTIONS.map(([heading, text]): [string, string] => [heading, text]),
    ['六、现场勘察与行动细化（模拟建议）', `先核对事发位置、受困线索、坡体及道路现场资料，交由专业岗位确认危险区域和作业边界；结合批准任务开展搜索、救援及工程处置。最新任务页用于后续衔接（模拟，不把已完成搜救重复列为新任务）：\n${TASK_TEXT}\n滑坡影响范围、稳定性、装备能力与专业工法参数仍需专业核实。`],
    ['七、安全预警与撤离衔接', '补齐降雨实况/预报、坡体位移/裂缝监测、警戒与撤离路线、通信和人员清点安排；天气、地质及道路情况变化时按既有指挥流程复核方案。停工撤离阈值和作业许可须经专业会商及授权岗位确定，不自动给出。'],
    ['八、力量与保障待核项', `本页仅提供组织职责框架，未提供可调用队伍、人装数量及到场时限，不借用其他页数量作为已批准力量。新增任务页已列责任岗位与目标时限，但真实名单、执行及验收仍待核。物资保障依据同事件台账：${SUPPLY_AUDIT_TEXT} 补充医疗、通信、轮换、主备运输条件及有效预案版本后再审定。`],
    ['九、编制及应用说明', '依据当前处置方案页五节模板、事件概况及同事件任务与物资台账模拟生成，由救援方案生成智能体补充实施衔接与待核事项。接报中的房屋、被困人数为页面初步信息，尚待核实。此为可编辑草稿，不覆盖原页、不生成正式版本、不办理审批或下达现场指令。'],
  ], [[0], [1], [2], [3, 5], [4, 6, 7, 8]]);
}

export function generateEmbeddedPlanReport(requestId: string): Promise<void> {
  const key = `plan:${requestId}`;
  const existing = requests.get(key);
  if (existing) return existing;
  const run = runReport('plan');
  requests.set(key, run);
  return run;
}

const additionalNodes = {
  dynamics: { label: V2_REPORT_STRUCTURE.dynamics.name, code: 'SITUATION_REPORT', source: 'V2灾情动态页r1—r5五次模拟反馈', agent: '态势感知智能体', sections: dynamicsAiSections, scope: '按反馈时间梳理累计人数、道路与坡体风险，保留原始报告依据' },
  transport: { label: '梯队投送方案', code: 'TRANSPORT_PLAN', source: 'V2投送页两组力量记录（模拟）', agent: '救援资源管理智能体', sections: transportAiSections, scope: '本页52/28人分配，合计80人、45台套；主备路线与实时通行条件待核' },
  summary: { label: V2_REPORT_STRUCTURE.summary.name, code: 'WORK_SUMMARY', source: '总结记录、要情快报、任务分配、动态r1—r5与物资台账（模拟）', agent: '救援效果评估智能体', sections: summaryAiSections, scope: '过程、阶段成效、问题线索、投入消耗证据与改进事项；缺失实绩不补造' },
} as const;

export function generateEmbeddedAdditionalReport(kind: keyof typeof additionalNodes, requestId: string): Promise<void> {
  const key = `${kind}:${requestId}`;
  const existing = requests.get(key);
  if (existing) return existing;
  const run = runReport(kind);
  requests.set(key, run);
  return run;
}

async function runReport(kind: V2AiKind = 'surroundings') {
  const additional = kind === 'dynamics' || kind === 'transport' || kind === 'summary' ? additionalNodes[kind] : undefined;
  const assembly = kind === 'assembly';
  const plan = kind === 'plan';
  const label = additional?.label ?? (plan ? '工程救援处置方案' : assembly ? V2_REPORT_STRUCTURE.assembly.name : '周边资源分析报告');
  const code = additional?.code ?? (plan ? 'RESCUE_PLAN' : assembly ? 'GROUP_RECOMMENDATION' : 'RESOURCE_REPORT');
  const source = additional?.source ?? (plan ? 'V2处置方案模板、事件概况、任务分配与物资台账（模拟）' : assembly ? 'V2人装抽组页两条队伍记录（模拟）' : 'V2周边资源页摘要与三支队伍明细（模拟）');
  const conversation = useConversationStore.getState().createConversation({
    title: `${SURROUNDINGS_DATA.eventName} · ${label}`, type: 'resource',
    summary: `${source}，独立会话`,
  });
  const sessionId = useSessionStore.getState().ensureSessionForConversation(conversation.id, conversation.eventId!);
  const store = useSessionStore.getState();
  store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', taskId: null,
    text: `请根据当前${additional ? additional.label : plan ? '处置方案' : assembly ? '人装抽组' : '周边资源'}页面，生成${SURROUNDINGS_DATA.eventName}的${label}（模拟）。` });
  const title = `${SURROUNDINGS_DATA.eventName} · ${label}（模拟）`;
  const sections = additional ? additional.sections() : plan ? planReportSections() : assembly ? assemblyReportSections() : surroundingsReportSections();
  const elements = [
    { label: '当前事件', value: SURROUNDINGS_DATA.eventName },
    { label: '资料来源', value: source },
    { label: '核对范围', value: additional?.scope ?? (plan ? '事件、任务目标、组织编成、行动安排、安全与保障；缺少数据保留待核' : assembly ? '本页两组人装，合计80人、45台/套；已返营状态须复核' : '300公里；保留摘要与明细差异，超范围队伍单列') },
  ];
  const invocation = store.appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'agent', taskId: null,
    agentName: additional?.agent ?? (plan ? '救援方案生成智能体' : '救援资源管理智能体'), agentRole: additional ? `读取依据 → 核对${additional.scope} → 生成${label}` : plan ? '读取当前事件与模板 → 梳理行动与安全条件 → 生成处置方案草稿' : assembly ? '读取本页人装 → 核对人数装备与状态 → 生成抽组方案' : '读取当前页面 → 核对资源与距离 → 生成周边资源分析报告',
    text: `模拟整理${label}`,
    documentWorkflow: { presentation: assembly ? 'inline' : 'document', stage: 'collecting', documentCode: code, documentTitle: title, elements },
  });
  const update = (stage: 'calling' | 'generating' | 'interrupted') => useSessionStore.getState().updateDocumentWorkflow(
    sessionId, invocation.messageId, { stage, documentCode: code, documentTitle: title, elements },
  );
  try {
    if (assembly) {
      useSessionStore.getState().updateDocumentWorkflow(sessionId, invocation.messageId, {
        stage: 'completed', presentation: 'inline', elements, documentCode: code, documentTitle: title, reportSections: sections,
      });
      useSessionStore.getState().appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', taskId: null,
        text: '编组建议已整理（模拟）。本页两组力量合计80人、45台/套，两组均标为已返营；请先复核可用状态、操作手及到位时限。明细和待核事项在上方展开查看，未修改抽组表或下发指令。' });
      useSessionStore.getState().appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', taskId: null, text: embeddedQaIntro(kind) });
      return;
    }
    const document = await useMockDocumentStore.getState().generate(sessionId, code, {
      title, sections, elements, onStage: update,
    });
    if (!document) { update('interrupted'); return; }
    useSessionStore.getState().updateDocumentWorkflow(sessionId, invocation.messageId, {
      stage: 'completed', elements, documentCode: document.code, documentTitle: document.title,
      reportSections: sections, documentId: document.id,
    });
    useSessionStore.getState().appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', taskId: null,
      text: additional ? `${label}已生成（模拟）。已保留资料来源、数据口径及待核事项，可查看文书并编辑、预览；未发布或执行指令。` : plan ? '处置方案已生成（模拟）。已整理灾情、救援目标、组织编成、行动安排、安全保障，并补充勘察、撤离衔接及待核事项。可查看、编辑和导出；未覆盖原页或发布正式版本。' : assembly ? '人装抽组方案已生成（模拟）。按本页整理两组力量，共80人、45台/套；两组均标为已返营，已列复核事项。可查看、编辑和导出，尚未修改原表或下发指令。' : '周边资源分析报告已生成（模拟）。已整理事件概况、队伍明细、距离核对、资源建议与待核事项。原页摘要与明细存在差异，已在报告中标注；可点击“查看文书”打开、编辑和导出。',
    });
    useSessionStore.getState().appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', taskId: null, text: embeddedQaIntro(kind) });
  } catch {
    update('interrupted');
    useSessionStore.getState().appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', taskId: null,
      text: `模拟${label}生成未完成，请再次点击“${additional ? 'AI生成' + ({ dynamics: '态势报告', transport: '投送方案', summary: '复盘总结' } as Record<string, string>)[kind] : plan ? 'AI生成处置方案' : assembly ? 'AI生成抽组' : 'AI生成报告'}”重试；当前任务已结束，不会持续加载。` });
  }
}
