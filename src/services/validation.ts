/**
 * 校核引擎：规则版本 1.0.0-demo。
 * 对文书内容 + 当前运行时事实进行核查；block 级问题阻断提交与签发。
 * 校核结果绑定 contentHash：内容变化后旧报告自动失效。
 */
import type {
  DocumentContent,
  DocumentParagraph,
  SourceSnapshot,
  ValidationIssue,
  ValidationReport,
} from '@/domain/types';
import { CONTROL_STATUS_LABEL } from './documentFactory';
import { incidentById, templateByCode, shift } from '@/seed/scenario';
import { formatFactValue, permits } from './factLookup';
import { computeContentHash, useDocumentStore } from '@/store/documentStore';
import { computeDerived, type DerivedKey } from '@/seed/derived';
import { currentContextVersion } from './factLookup';

export const RULESET_VERSION = '1.0.0-demo';

export const RULE_TITLES: Record<string, string> = {
  'R-001': '必填缺失', 'R-002': '引用缺失', 'R-003': '值与来源不一致',
  'R-004': '未核实伤亡', 'R-005': '无依据控制结论', 'R-006': '候选冒充已调派',
  'R-007': '草稿来源过期', 'R-008': '校核报告过期', 'R-009': '引用跨事件',
  'R-010': '新增无来源数字', 'R-011': '演示标识缺失', 'R-012': '普通表述建议',
};

export interface FlattenedParagraph {
  sectionId: string;
  /** null 表示小节标题（标题同样纳入校核） */
  paragraphId: string | null;
  /** 段落角色（reference = 模板/知识引用等元信息，断言类规则不应扫描） */
  role: DocumentParagraph['role'];
  text: string;
  factBindings: { factId: string; suffix?: string }[];
  derivedBindings: { key: string; suffix?: string }[];
  knowledgeBindings: { chunkId: string }[];
}

export function flattenContent(content: DocumentContent, snapshot?: SourceSnapshot): FlattenedParagraph[] {
  const out: FlattenedParagraph[] = [];
  for (const section of content.sections) {
    // 小节标题也纳入校核（标题同样可能藏违规表述，如“险情已控制”写入标题）
    if (section.heading.trim().length > 0) {
      out.push({
        sectionId: section.id,
        paragraphId: null,
        role: 'narrative',
        text: section.heading,
        factBindings: [],
        derivedBindings: [],
        knowledgeBindings: [],
      });
    }
    for (const p of section.paragraphs) {
      let text = '';
      const factBindings: FlattenedParagraph['factBindings'] = [];
      const derivedBindings: FlattenedParagraph['derivedBindings'] = [];
      const knowledgeBindings: FlattenedParagraph['knowledgeBindings'] = [];
      for (const run of p.runs) {
        switch (run.type) {
          case 'text':
            text += run.text;
            break;
          case 'fact': {
            const f = snapshot?.facts[run.factId];
            const v = f ? formatFactValue(f.value, f.unit, f.sourceFieldKey) : '（来源缺失）';
            text += `${v}${run.suffix ?? ''}`;
            factBindings.push({ factId: run.factId, suffix: run.suffix });
            break;
          }
          case 'derived': {
            text += `（派生值）${run.suffix ?? ''}`;
            derivedBindings.push({ key: run.derivedKey, suffix: run.suffix });
            break;
          }
          case 'knowledge':
            text += run.label;
            knowledgeBindings.push({ chunkId: run.chunkId });
            break;
        }
      }
      out.push({ sectionId: section.id, paragraphId: p.id, role: p.role, text, factBindings, derivedBindings, knowledgeBindings });
    }
  }
  return out;
}

function issue(
  ruleId: string,
  level: ValidationIssue['level'],
  message: string,
  sectionId: string | null,
  paragraphId: string | null,
  currentValue: string | null,
  suggestion: string | null,
  suggestionText: string | null,
  fieldKey: string | null = null,
): ValidationIssue {
  return { ruleId, level, message, sectionId, paragraphId, fieldKey, currentValue, suggestion, suggestionText };
}

export interface ValidateInput {
  documentId: string;
  content: DocumentContent;
  snapshot: SourceSnapshot;
  checkPreviousReport?: boolean;
}

export function validateContent(input: ValidateInput): Omit<ValidationReport, 'reportId' | 'checkedAt'> {
  const { content, snapshot, documentId } = input;
  const issues: ValidationIssue[] = [];
  const flat = flattenContent(content, snapshot);

  const scope = snapshot.scopeKind === 'event' ? { kind: 'event' as const, eventId: snapshot.eventId ?? '' } : { kind: 'shift' as const, shiftId: snapshot.shiftId ?? '' };
  const bound = new Set(flat.flatMap(p => p.factBindings.map(b => b.factId)));
  for (const p of flat) {
    const inputs = p.derivedBindings.flatMap(b => snapshot.derived[b.key]?.inputFactIds ?? []);
    for (const b of [...p.factBindings, ...inputs.map(factId => ({ factId }))]) {
      const f = snapshot.facts[b.factId];
      const source = f && snapshot.sources?.[f.sourceRecordId];
      if (!f || !source || !Object.hasOwn(source.fields, f.sourceFieldKey)) {
        issues.push(issue('R-002', 'block', '正文事实或其完整来源字段缺失。', p.sectionId, p.paragraphId, b.factId, '补齐来源后显式刷新引用', null, b.factId));
      } else if (!f.scope || !source.scope || !permits(f.scope, scope) || !permits(source.scope, scope) || JSON.stringify(f.scope) !== JSON.stringify(source.scope)) {
        issues.push(issue('R-009', 'block', '引用不属于本文书授权范围。', p.sectionId, p.paragraphId, null, '删除跨域引用', null, b.factId));
      } else if (JSON.stringify(f.value) !== JSON.stringify(source.fields[f.sourceFieldKey]) || f.sourceVersion !== source.sourceVersion || f.capturedAt !== source.capturedAt) {
        issues.push(issue('R-003', 'block', '事实值、版本或采集时间与冻结来源记录不一致。', p.sectionId, p.paragraphId, String(f.value), '核实来源并刷新', null, b.factId));
      }
    }
    for (const b of p.derivedBindings) {
      const d = snapshot.derived[b.key];
      if (!d || d.inputFactIds.some(id => !snapshot.facts[id] || !snapshot.sources?.[snapshot.facts[id].sourceRecordId])) {
        issues.push(issue('R-002', 'block', '派生指标或输入来源缺失。', p.sectionId, p.paragraphId, b.key, '刷新来源', null));
        continue;
      }
      try {
        const clock = Object.values(snapshot.facts).filter(f => f.sourceFieldKey === 'currentTime').sort((a, b) => b.sourceVersion - a.sourceVersion)[0];
        const expected = computeDerived(b.key as DerivedKey, snapshot.candidateResourceIds, { facts: snapshot.facts, clock: String(clock?.value ?? '') });
        if (expected.value !== d.value || expected.formula !== d.formula || JSON.stringify(expected.inputFactIds) !== JSON.stringify(d.inputFactIds)) {
          issues.push(issue('R-003', 'block', '派生值或计算依据与冻结输入重算结果不一致。', p.sectionId, p.paragraphId, String(d.value), `原计算结果 ${expected.value}`, null));
        }
      } catch {
        issues.push(issue('R-002', 'block', '派生公式不存在。', p.sectionId, p.paragraphId, b.key, null, null));
      }
    }
  }
  for (const field of templateByCode.get(content.templateCode)?.requiredFields ?? []) {
    if (!field.required) continue;
    const key = field.field === 'statisticsCutoff' ? 'currentTime' : field.field;
    const expectedId = field.binding.startsWith('incident.factRefs.') ? incidentById.get(snapshot.eventId ?? '')?.factRefs[key]
      : field.binding.startsWith('shift.factRefs.') ? shift.factRefs[key] : undefined;
    const f = Object.values(snapshot.facts).find(f => (expectedId ? f.factId === expectedId : f.sourceFieldKey === key)
      && bound.has(f.factId) && f.scope && permits(f.scope, scope) && (f.value != null && String(f.value).trim() !== '' || field.allowPending && f.verification === 'pending'));
    if (!f) issues.push(issue('R-001', 'block', `必填字段 ${field.field} 缺少有效正文绑定。`, null, null, null, '补录并在正文绑定该字段', null, field.field));
  }
  // R-004/R-005/R-007 按单事件语境校验：仅事件域文书适用。
  // 班次域日报合法汇总多个事件的处置状态（如 B 事件已控制），不能拿单一事件事实套全文。
  const isEventScope = snapshot.scopeKind === 'event';

  // R-004 伤亡表述矛盾（审查 M-12：按快照事件动态解析事实，事件 B 同样受保护；M-5：覆盖更多绕过句式）
  const casualtyFactId =
    (snapshot.eventId ? incidentById.get(snapshot.eventId)?.factRefs.casualty : undefined) ??
    'fact-incident-001-casualty';
  const casualtyPending = snapshot.facts[casualtyFactId]?.verification === 'pending';
  if (isEventScope && casualtyPending) {
    const CASUALTY_ZERO =
      /(?:死亡|受伤|伤亡)[^。；]{0,6}[一二两三四五六七八九十百千\d]+\s*人|无人员伤亡|无伤亡|没有伤亡|未.{0,2}(发现|接到|收到).{0,6}伤亡|伤亡[^。；]{0,8}(0|零)\s*人?|(^|[^0-9])0\s*人伤亡|零伤亡|暂无伤亡/;
    for (const p of flat) {
      if (CASUALTY_ZERO.test(p.text)) {
        issues.push(
          issue(
            'R-004',
            'block',
            '正文表述“无伤亡”与来源“待核实”矛盾，可能低估事态。',
            p.sectionId,
            p.paragraphId,
            p.text.slice(0, 40),
            '改为待核实表述',
            '人员伤亡情况待核实。',
            'casualty',
          ),
        );
      }
    }
  }

  // R-005 处置状态表述矛盾（审查 M-12 动态事件 + M-6 覆盖“已得到控制/趋于平稳/基本控制”等近似表述）
  const controlFactId =
    (snapshot.eventId ? incidentById.get(snapshot.eventId)?.factRefs.controlStatus : undefined) ??
    'fact-incident-001-controlStatus';
  const controlFact = snapshot.facts[controlFactId];
  if (isEventScope && controlFact && String(controlFact.value) === 'ongoing') {
    const CONTROLLED_CLAIM = /((已经?|已)得?到?(有效)?控制|险情已控制|已完全控制|全面控制|完全控制|基本控制|趋于平稳|险情已平息|已排除)/;
    for (const p of flat) {
      if (CONTROLLED_CLAIM.test(p.text)) {
        issues.push(
          issue(
            'R-005',
            'block',
            `正文称“已控制/已平息”，与来源状态“${CONTROL_STATUS_LABEL.ongoing}”矛盾。`,
            p.sectionId,
            p.paragraphId,
            p.text.slice(0, 40),
            '改为与来源一致的表述',
            '现场正在持续处置，险情变化仍需跟踪核实。',
            'controlStatus',
          ),
        );
      }
    }
  }

  // R-006 调派表述与候选状态矛盾（审查 M-4：豁免仅限前瞻性拟派表述；种子负例“已调派候选救援队伍”仍命中；支持中文数词）
  const CN_NUM = '(\\d+|[一二两三四五六七八九十]+)';
  const DEPLOY_VERB = '(已调派|已出动|已派遣|调派了?|出动了?|派遣了?)';
  for (const p of flat) {
    // 引用段（知识卡片引用、模板版本、已采纳建议说明）是元信息而非作者断言，
    // 其文本中出现的“不得表述为已调派”等规则性引用不应触发调派矛盾校核。
    if (p.role === 'reference') continue;
    const deployHit = new RegExp(`${DEPLOY_VERB}|调派了?${CN_NUM}\\s*支|出动了?${CN_NUM}\\s*支`).test(p.text);
    if (!deployHit) continue;
    // 豁免：前瞻性拟派表述（拟调派/拟预置/计划调派/建议调派/预置）+12 字内出现“调派/出动/派遣”类动词；
    // 以及“候选…尚未(形成/下达…)调派”类否定声明。注意：“已调派候选救援队伍”不豁免（种子负例）。
    const exempt =
      /(拟|计划|建议|预置)[^。；]{0,10}(调派|出动|派遣|预置)|候选[^。；]{0,12}尚未[^。；]{0,6}(调派|出动|派遣)/.test(p.text) &&
      !/已(调派|出动|派遣)/.test(p.text);
    if (!exempt) {
      issues.push(
        issue(
          'R-006',
          'block',
          '正文出现“已调派”表述，但系统中没有已确认的调派记录（候选≠已调派）。',
          p.sectionId,
          p.paragraphId,
          p.text.slice(0, 40),
          '改为候选/拟预置表述',
          '相关队伍仅为拟预置候选，尚无已确认的新增调派记录。',
          'deployments',
        ),
      );
    }
  }

  // R-007 建议等级表述与确认状态矛盾（审查 M-12 按事件动态解析；M-7 覆盖断言动词句式）
  const suggestionStatusFactId = snapshot.eventId
    ? incidentById.get(snapshot.eventId)?.situationFactRefs.suggestionStatus
    : undefined;
  const suggestionStatusFact = suggestionStatusFactId ? snapshot.facts[suggestionStatusFactId] : undefined;
  if (isEventScope && suggestionStatusFact && String(suggestionStatusFact.value) === 'awaiting_confirmation') {
    const LEVEL_CLAIM =
      /(已确认|已确定|已批准|已同意|按|提升至|升级为|启动|确定为|批准)为?\s*(III|Ⅲ|3)\s*级|(III|Ⅲ|3)\s*级\s*响应[^。；]{0,6}(已|启动)|已确认[^。；]{0,8}(III|Ⅲ|3)\s*级/;
    for (const p of flat) {
      // “建议响应等级为 III 级”“建议启动 III 级响应”属合规表述，不命中；命中需含确认/批准类动词或等级+响应+启动组合
      const isProposalWording = /建议[^。；]{0,10}(III|Ⅲ|3)\s*级|(III|Ⅲ|3)\s*级[^。；]{0,6}（?建议/.test(p.text);
      if (LEVEL_CLAIM.test(p.text) && !isProposalWording) {
        issues.push(
          issue(
            'R-003',
            'block',
            '正文将建议响应等级表述为“已确认/已批准”，与确认状态（待确认）矛盾。',
            p.sectionId,
            p.paragraphId,
            p.text.slice(0, 40),
            '改为建议表述',
            '建议响应等级为 III 级（尚未确认）。',
            'suggestedResponseLevel',
          ),
        );
      }
    }
  }

  // 仅扫描叙述段中的自由文本；其他 fact/derived 引用不能给自由文本数字背书。
  for (const section of content.sections) for (const p of section.paragraphs) {
    if (p.role === 'reference') continue;
    const text = p.runs.filter(r => r.type === 'text').map(r => r.text).join('');
    if (/\d+(?:\.\d+)?|[零〇一二两三四五六七八九十百千万亿]+(?:点[零一二三四五六七八九]+)?\s*(?:人|台|辆|支|米|公里|户|处|起|名|个|套|小时|分钟|%|％)|[零〇一二两三四五六七八九千万亿]+(?:点\d+)?元/.test(text)) {
      issues.push(issue('R-010', 'block', '叙述包含未结构化绑定的数值；同段其他引用不构成该数值的来源。', section.id, p.id, text.slice(0, 60), '改用事实或派生值芯片', null));
    }
    if (/为了能够进一步更好地|在此基础之上进一步/.test(text)) issues.push(issue('R-012', 'warning', '表述冗长，可精简。', section.id, p.id, text, '精简非事实性表述', null));
  }
  if (snapshot.contextVersion !== currentContextVersion(scope)) issues.push(issue('R-007', 'block', '当前业务来源已更新，必须先显式刷新引用再校核。', null, null, String(snapshot.contextVersion), '刷新文书数据', null));
  const previous = useDocumentStore.getState().getActiveReport(documentId);
  if (previous && previous.contentHash !== computeContentHash(content) && input.checkPreviousReport !== false) issues.push(issue('R-008', 'block', '旧校核报告与当前内容指纹不一致。', null, null, previous.contentHash, '重新校核当前保存版本', null));
  if (!/模拟|演训/.test(content.footerNote) || !/非正式|非真实|不构成|不代表|仅用于|仅供/.test(content.footerNote)) issues.push(issue('R-011', 'block', '缺少演示及非正式报送声明。', null, null, null, '恢复页脚声明并重新校核', null));
  const handover = Object.values(snapshot.facts).find(f => f.sourceFieldKey === 'handOverNotes');
  if (handover && String(handover.value ?? '').trim().length < 8) issues.push(issue('R-012', 'warning', '交接事项过短，请补充便于接班人员理解的说明。', null, null, String(handover.value), '补充交接事项', null));

  const contentHash = computeContentHash(content);

  return {
    documentId,
    revisionId: null,
    factSnapshotVersion: snapshot.dataVersion,
    contentHash,
    contextSnapshotId: snapshot.snapshotId,
    rulesetVersion: RULESET_VERSION,
    issues,
  };
}

export function applySuggestion(
  content: DocumentContent,
  paragraphId: string,
  suggestionText: string,
): DocumentContent {
  const next = JSON.parse(JSON.stringify(content)) as DocumentContent;
  for (const section of next.sections) {
    for (const p of section.paragraphs) {
      if (p.id !== paragraphId) continue;
      // 整段替换为规范表述：仅替换首个 text run 会残留同段矛盾片段（如建议句与事实绑定同段时）。
      // 该段内的事实/派生/知识绑定一并移除，后续重新校核以替换后的文本为准。
      p.runs = [{ type: 'text', text: suggestionText }];
    }
  }
  return next;
}

export function saveReport(input: Omit<ValidationReport, 'reportId' | 'checkedAt'>): ValidationReport {
  return useDocumentStore.getState().addReport(input);
}
