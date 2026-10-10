/**
 * 对齐 Vue stageConversation.js：阶段提问 / 模拟 Word / assessInput。
 * 全部为演示规则，不解析真实 Word。
 */
import type { ChatAttachment, Session } from '@/domain/types';
import type { EventStage } from '@/services/agentFlow';
import { vueWorkspaceEventById } from '@/seed/vueWorkspaceEvents';
import { eventDisplayName } from '@/services/factLookup';
import { resolveEventStage } from '@/services/eventSwitchBriefing';

export type StageChoiceKind = 'question' | 'file';

export interface StageChoice {
  id: string;
  kind: StageChoiceKind;
  label: string;
  prompt: string;
  capability?: string;
  type?: string;
}

export interface StageChoiceGroup {
  label: string;
  options: StageChoice[];
}

export interface StageEventContext {
  id: string;
  name: string;
  stage: EventStage;
  risks: string;
  materials: { id: string; text: string }[];
}

type FileTypeKey =
  | 'scene'
  | 'advice'
  | 'needs'
  | 'roster'
  | 'delivery'
  | 'feedback'
  | 'bulletin'
  | 'summary'
  | 'process'
  | 'acceptance'
  | 'archive'
  | 'experience'
  | 'unclear'
  | 'missing'
  | 'wrongEvent';

const question = (
  id: string,
  label: string,
  prompt: string,
  capability: string,
): StageChoice => ({ id, kind: 'question', label, prompt, capability });

const file = (type: FileTypeKey, label: string): StageChoice => ({
  id: `file-${type}`,
  kind: 'file',
  type,
  label: `发送${label}`,
  prompt: `请读取附件，结合当前事件整理${label}，列出待核事项，核对后提交到原系统。`,
});

const stages: Record<EventStage, StageChoice[]> = {
  待研判: [
    question('risks', '这段现场情况有哪些风险？', '请根据当前现场情况整理研判报告，说明风险、依据和待核事项。', 'situationReport'),
    question('facts', '现场描述整理成研判材料', '现场反馈：险情位置和受威胁对象尚未核实。请整理为态势报告，并列出需要补充的证据。', 'situationReport'),
    question('nearby', '需要核查哪些周边资源？', '请整理当前事件周边资源分析报告，未核实的队伍、医疗和保障条件列为待核。', 'resourceReport'),
    file('scene', '现场情况说明'),
    file('advice', '处置建议'),
    question('verification', '告警是否足以确认灾情？', '现场情况：目前只有监测告警，尚无现场核查结论。请整理态势报告，区分告警线索、已核事实和待补证据。', 'situationReport'),
    question('evidence', '这段描述缺少哪些研判依据？', '现场情况：位置、影响范围和受威胁对象仍不明确。请整理研判材料和补充资料清单。', 'situationReport'),
    question('protection', '如何整理重点防护和保障需求？', '请整理周边资源报告，列明重点防护目标、医疗与保障需求，未取得有效资料的保留待核。', 'resourceReport'),
  ],
  力量投送中: [
    question('group', '如何整理抽组建议？', '请根据本事件需求和候选人装记录整理抽组建议，数量、可用状态和编组责任人待人工核对。', 'group'),
    question('route', '投送前还要确认什么？', '请梳理本事件投送条件，列出道路通行、出动批次和保障协调的待核事项。', 'delivery'),
    question('gap', '需求和现有资源有哪些缺口？', '请整理资源分析报告，对照本事件需求、候选人装和可用状态，缺失数量不按零处理。', 'resourceReport'),
    file('needs', '力量需求'),
    file('roster', '人员装备清单'),
    file('delivery', '投送建议'),
    question('positions', '缺少人员名单，如何先整理编组？', '请先整理本事件编组草稿，区分专业岗位需求和已确认人装，名单、组数与负责人待核，不生成正式调度命令。', 'group'),
    question('access', '道路未确认时如何整理投送材料？', '请整理投送建议，通行、车辆、通信和协调对象尚未确认的逐项列出，不能据此认定路线可通行。', 'delivery'),
    question('availability', '候选资源数量和状态如何核对？', '请整理周边资源报告，分别列出数量、可用状态、任务占用和资料来源，不把候选当成已出动力量。', 'resourceReport'),
  ],
  救援中: [
    question('changes', '现场情况变化，方案如何调整？', '现场反馈：作业条件需要重新核实，请整理处置方案修订建议，说明影响章节和安全条件。', 'revise'),
    question('bulletin', '把这段进展整理成阶段要情', '现场进展：人员装备到场记录已登记，作业成效和安全检测回执待核。请整理阶段要情初稿。', 'document'),
    question('coordination', '整理当前需协调的事项', '请结合本事件记录整理处置建议，列出现场技术、安全和保障协调事项，供业务岗位核对。', 'plan'),
    file('advice', '处置建议'),
    file('feedback', '现场反馈'),
    file('bulletin', '阶段要情'),
    question('safety', '安全条件没有确认，如何调整建议？', '现场反馈：安全检测和工程条件尚未确认。请整理方案修订建议及需要技术、安全岗位复核的事项。', 'revise'),
    question('progress', '只有进展记录，怎样避免夸大成效？', '现场进展：已有过程记录，实际处置量与验收结果仍待核。请整理阶段要情，不写成任务完成或验收通过。', 'document'),
    question('support', '整理通信、物资和轮换保障建议', '请结合本事件记录整理处置方案初稿中的通信、物资、供电和人员轮换保障，缺失字段明确待补。', 'plan'),
  ],
  待复盘: [
    question('summary', '整理过程资料并生成总结', '请检查本事件过程资料，生成总结报告初稿，明确成果、消耗和撤收证据的缺项。', 'summary'),
    question('review', '这份总结有哪些遗漏？', '请根据本事件资料整理反思式总结，检查实际过程、方案执行、问题证据和下一步改进。', 'summary'),
    question('full', '整理全面总结供人工核对', '请生成全面总结初稿，所有数量和完成结论均以本事件有效凭证为依据，未取得的保留待核。', 'summary'),
    file('summary', '总结报告'),
    file('process', '过程记录'),
    file('acceptance', '验收材料'),
    question('proof', '验收和消耗凭证没齐，如何写总结？', '请整理总结初稿，标注验收、消耗、撤收等缺项，未核定数量不填零，不依据材料登记认定任务完成。', 'summary'),
    question('improvement', '把问题整理为下一步改进计划', '请整理反思式总结，区分有证据的问题和模板提示维度，列出改进事项、责任岗位、完成时限与验证材料的待核字段。', 'summary'),
    question('traceability', '总结中的表述如何追溯到材料？', '请整理全面总结初稿，保留本事件资料与一期结构参考的区别，列出需要原文、时间和有效版本支持的表述。', 'summary'),
  ],
  已归档: [
    question('archive', '整理归档补充说明', '请整理本事件归档补充说明，说明材料来源、拟补充内容及核实责任，保持原归档状态。', 'document'),
    question('experience', '从归档资料提炼经验', '请从本事件归档资料提取可复用经验和案例候选，说明依据与适用条件，不自动入库。', 'case'),
    question('trace', '检查归档材料的引用依据', '请结合当前归档资料整理总结补充初稿，列明引用来源和待核事项，不修改既有归档结论。', 'summary'),
    file('archive', '归档补充说明'),
    file('experience', '经验总结'),
    question('supplement', '发现遗漏记录后怎样补充归档？', '请整理归档补充说明，写清拟补材料、补充原因和核实责任，作为独立补充记录，不覆盖原归档版本。', 'document'),
    question('scope', '归档材料引用范围如何说明？', '请整理归档补充说明，列出引用依据、适用范围和权限待核事项，不沿用未经确认的结论。', 'document'),
    question('limits', '哪些经验可以作为案例候选？', '请提取案例候选，说明出处、适用灾种和条件，未经审定的经验不自动发布或入库。', 'case'),
  ],
};

export const fileTypes: Record<
  FileTypeKey,
  { name: string; capability?: string; allowed: EventStage[] }
> = {
  scene: { name: '现场情况说明', capability: 'situationReport', allowed: ['待研判', '力量投送中', '救援中'] },
  advice: { name: '处置建议', capability: 'plan', allowed: ['待研判', '力量投送中', '救援中'] },
  needs: { name: '力量需求', capability: 'group', allowed: ['待研判', '力量投送中', '救援中'] },
  roster: { name: '人员装备清单', capability: 'group', allowed: ['力量投送中', '救援中'] },
  delivery: { name: '投送建议', capability: 'delivery', allowed: ['力量投送中', '救援中'] },
  feedback: { name: '现场反馈', capability: 'revise', allowed: ['救援中'] },
  bulletin: { name: '阶段要情', capability: 'document', allowed: ['力量投送中', '救援中', '待复盘'] },
  summary: { name: '总结报告', capability: 'summary', allowed: ['待复盘', '已归档'] },
  process: { name: '过程记录', capability: 'summary', allowed: ['待复盘', '已归档'] },
  acceptance: { name: '验收材料', capability: 'summary', allowed: ['待复盘', '已归档'] },
  archive: { name: '归档补充说明', capability: 'document', allowed: ['已归档'] },
  experience: { name: '经验总结', capability: 'case', allowed: ['待复盘', '已归档'] },
  unclear: { name: '工作材料', allowed: [] },
  missing: { name: '缺少事件信息的材料', allowed: [] },
  wrongEvent: { name: '其他事件材料', allowed: [] },
};

export function stageChoices(stage: EventStage): StageChoiceGroup[] {
  const list = stages[stage] ?? stages['待研判'];
  const mismatchLabel =
    stage === '待复盘' || stage === '已归档'
      ? '现场反馈（阶段不匹配）'
      : '总结报告（阶段不匹配）';
  const mismatchType: FileTypeKey =
    stage === '待复盘' || stage === '已归档' ? 'feedback' : 'summary';
  return [
    { label: '当前阶段常见提问', options: list.filter(c => c.kind === 'question') },
    { label: '模拟发送 Word 文件', options: list.filter(c => c.kind === 'file') },
    {
      label: '异常与意图确认示例',
      options: [
        file(mismatchType, mismatchLabel),
        file('unclear', '工作材料（用途不明确）'),
        file('missing', '缺少事件信息的材料'),
        file('wrongEvent', '其他事件材料'),
      ],
    },
  ];
}

/** 根据会话事件构建模拟附件所需上下文。 */
export function buildStageEventContext(eventId: string, session?: Session | null): StageEventContext {
  const vue = vueWorkspaceEventById.get(eventId);
  const stage = resolveEventStage(eventId, session);
  const name = vue?.name || eventDisplayName(eventId);
  const risks = vue?.risks || '次生风险与作业条件待核';
  const materials: { id: string; text: string }[] = [
    {
      id: 'event',
      text: vue?.description || '本事件现场情况说明待补，位置、影响范围与受威胁对象需岗位核实。',
    },
    {
      id: 'plan',
      text: '处置建议与方案要点待补；安全检测与工程条件未经确认前不认定可直接实施。',
    },
    {
      id: 'resources',
      text: vue?.resourcesNote || '实际人装与到场记录未取得。',
    },
  ];
  return { id: eventId, name, stage, risks, materials };
}

export function simulateAttachment(choice: StageChoice, event: StageEventContext): ChatAttachment {
  const type = (choice.type ?? 'unclear') as FileTypeKey;
  const descriptor = fileTypes[type] ?? fileTypes.unclear;
  const recordId = ['roster', 'needs', 'delivery'].includes(type)
    ? 'resources'
    : ['advice', 'feedback'].includes(type)
      ? 'plan'
      : 'event';
  const record = event.materials.find(m => m.id === recordId);
  const contents: Partial<Record<FileTypeKey, string>> = {
    feedback: `依据本事件记录反馈：${event.materials.find(m => m.id === 'resources')?.text || '实际人装与到场记录未取得。'} 请复核投入与需求的差异，以及${event.risks}；未确认安全与工程条件前，不认定可直接实施。`,
    summary: '本材料拟整理为任务总结。实际处置过程、方案执行、存在不足和下一步改进逐项核对。成果验收、消耗与撤收凭证待核；不填入未经证实的完成结论。',
    acceptance: '成果验收相关材料已登记，验收对象、核定数量、验收人和签认日期待核。材料登记不代表验收通过。',
    archive: '拟补充材料来源、引用范围和遗漏记录，原归档结论及状态保持不变。',
    experience: '拟从记录提炼适用条件、技术与组织经验，原始证据和审定状态待核。',
    unclear: '材料包含现场线索、处置建议和待协调事项。请确认希望整理为方案、要情，还是仅检查材料。',
    missing: '材料只有业务描述，未注明关联事件，暂不能确定提交对象。',
    wrongEvent: '其他事件的过程与处置记录，不属于当前所选事件。',
  };
  return {
    id: crypto.randomUUID(),
    type,
    name: `${descriptor.name}.docx`,
    eventId: type === 'missing' ? null : type === 'wrongEvent' ? 'EV-DEMO-OTHER' : event.id,
    eventName: event.name,
    content: contents[type] || record?.text || '本事件资料未取得，请补充相应正文。',
    kind: '模拟 Word 附件',
    status: '模拟正文 · 非真实文件解析',
    simulated: true,
  };
}

export interface AssessIssue {
  kind: 'wrongEvent' | 'missing' | 'ambiguous' | 'mismatch';
  text: string;
}

export function assessInput(
  event: StageEventContext,
  attachment: ChatAttachment | null | undefined,
  capability = '',
  documentType = '',
): AssessIssue | null {
  if (attachment?.eventId && attachment.eventId !== event.id) {
    return {
      kind: 'wrongEvent',
      text: `已读取《${attachment.name}》的模拟正文，但材料关联的是其他事件。当前事件为“${event.name}”，不能将这份材料提交到本事件。请重新选择正确事件或更换本事件文件。`,
    };
  }
  if (attachment && !attachment.eventId) {
    return {
      kind: 'missing',
      text: `已读取《${attachment.name}》的模拟正文，但缺少关联事件标识，无法确定提交对象。请确认该材料是否属于“${event.name}”；确认前不会传入原系统。`,
    };
  }
  if (attachment?.type === 'unclear') {
    return {
      kind: 'ambiguous',
      text: `已读取《${attachment.name}》的模拟正文，内容包含现场线索、处置建议和待协调事项。请确认本次用途：整理为方案、提炼为要情，还是仅检查材料。确认后我再继续整理。`,
    };
  }
  const isArchive = capability === 'document' && /归档补充说明/.test(documentType);
  const isSummary =
    capability === 'summary' || (capability === 'document' && /工作总结|抢险总结|任务总结/.test(documentType));
  const allowed = attachment?.type ? fileTypes[attachment.type as FileTypeKey]?.allowed : undefined;
  if (
    (attachment && allowed?.length && !allowed.includes(event.stage)) ||
    (isSummary && !['待复盘', '已归档'].includes(event.stage)) ||
    (isArchive && event.stage !== '已归档')
  ) {
    return {
      kind: 'mismatch',
      text: `${attachment ? `已读取《${attachment.name}》的模拟正文。` : ''}当前事件处于“${event.stage}”，${
        isSummary
          ? '尚不适合形成正式复盘总结，仍需处置过程、成果验收和撤收等有效记录。'
          : '这份材料的用途与当前阶段不匹配，需要核实适用时段和材料性质。'
      }如果这是历史材料，可以提取参考信息；如果属于本事件，建议先整理当前阶段的资料。请确认用途，系统不会自动改变事件阶段或提交该文件。`,
    };
  }
  return null;
}

export const stageDefaultCapability = (stage: EventStage): string =>
  ({
    待研判: 'situationReport',
    力量投送中: 'group',
    救援中: 'revise',
    待复盘: 'summary',
    已归档: 'document',
  })[stage] || 'situationReport';

/** 附件摘要写入消息时截断 content，避免撑爆 localStorage。 */
export function attachmentForPersist(attachment: ChatAttachment): ChatAttachment {
  const content = attachment.content ?? '';
  return {
    ...attachment,
    content: content.length > 4000 ? `${content.slice(0, 4000)}…` : content,
  };
}

/** 将附件信息拼入识别文本，便于走现有任务意图。 */
export function composeTextWithAttachment(
  text: string,
  attachment: ChatAttachment | null | undefined,
  mode?: 'reference' | 'check' | null,
): string {
  const base = text.trim() || (attachment ? '请读取附件并确认材料用途。' : '');
  if (!attachment) return base;
  const modeHint =
    mode === 'reference'
      ? '（确认作为历史参考，仅提取参考结构，不纳入当前事件事实）'
      : mode === 'check'
        ? '（确认仅检查附件内容，不提交原系统）'
        : '';
  const body = (attachment.content || '').trim();
  const clip = body.length > 800 ? `${body.slice(0, 800)}…` : body;
  return [
    base,
    modeHint,
    `已附${attachment.simulated ? '模拟' : ''}材料：${attachment.name}`,
    clip ? `材料摘要：${clip}` : '',
  ]
    .filter(Boolean)
    .join('\n');
}

export const LOCAL_FILE_ACCEPT = '.txt,.md,.csv,.pdf,.doc,.docx,.xlsx,.png,.jpg';
export const PLAIN_TEXT_EXT = /\.(txt|md|csv)$/i;
export const PLAIN_TEXT_MAX_BYTES = 2 * 1024 * 1024;
export const PLAIN_TEXT_MAX_CHARS = 24000;
