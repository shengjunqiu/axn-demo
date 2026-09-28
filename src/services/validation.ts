/**
 * 校核引擎：规则版本 1.0.0-demo。
 * 对文书内容 + 当前运行时事实进行核查；block 级问题阻断提交与签发。
 * 校核结果绑定 contentHash：内容变化后旧报告自动失效。
 */
import type {
  DocumentContent,
  SourceSnapshot,
  ValidationIssue,
  ValidationReport,
} from '@/domain/types';
import { CONTROL_STATUS_LABEL } from './documentFactory';
import { incidentById } from '@/seed/scenario';
import { factDisplay } from './factLookup';
import { computeContentHash, useDocumentStore } from '@/store/documentStore';
import { useDemoStore } from '@/store/demoStore';
import { currentContextVersion } from './factLookup';

export const RULESET_VERSION = '1.0.0-demo';

export const RULE_TITLES: Record<string, string> = {
  'R-001': '必填字段缺失',
  'R-002': '来源无法解析',
  'R-003': '时间表述与来源不一致',
  'R-004': '伤亡表述与来源矛盾',
  'R-005': '处置状态表述与来源矛盾',
  'R-006': '调派表述与候选状态矛盾',
  'R-007': '响应等级表述与确认状态矛盾',
  'R-008': '派生数值与重算不一致',
  'R-009': '数据快照可能过期',
  'R-010': '数值缺少来源',
  'R-011': '知识引用失效',
  'R-012': '报送要素缺失',
  'R-013': '模拟标识缺失',
};

export interface FlattenedParagraph {
  sectionId: string;
  /** null 表示小节标题（标题同样纳入校核） */
  paragraphId: string | null;
  text: string;
  factBindings: { factId: string; suffix?: string }[];
  derivedBindings: { key: string; suffix?: string }[];
  knowledgeBindings: { chunkId: string }[];
}

export function flattenContent(content: DocumentContent): FlattenedParagraph[] {
  const out: FlattenedParagraph[] = [];
  for (const section of content.sections) {
    // 小节标题也纳入校核（标题同样可能藏违规表述，如“险情已控制”写入标题）
    if (section.heading.trim().length > 0) {
      out.push({
        sectionId: section.id,
        paragraphId: null,
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
            const v = factDisplay(run.factId);
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
      out.push({ sectionId: section.id, paragraphId: p.id, text, factBindings, derivedBindings, knowledgeBindings });
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
}

export function validateContent(input: ValidateInput): Omit<ValidationReport, 'reportId' | 'checkedAt'> {
  const { content, snapshot, documentId } = input;
  const issues: ValidationIssue[] = [];
  const flat = flattenContent(content);

  // R-002 来源无法解析（含故障注入的缺失来源）
  for (const p of flat) {
    for (const b of p.factBindings) {
      if (!snapshot.facts[b.factId]) {
        issues.push(
          issue(
            'R-002',
            'block',
            `正文数据（${b.factId}）在来源快照中无法解析，可能是来源缺失或数据被移除。`,
            p.sectionId,
            p.paragraphId,
            null,
            '请检查来源或在演示控制中关闭“缺来源”故障后重新生成/编辑。',
            null,
            b.factId,
          ),
        );
      }
    }
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
      /无人员伤亡|无伤亡|没有伤亡|未.{0,2}(发现|接到|收到).{0,6}伤亡|伤亡[^。；]{0,8}(0|零)\s*人?|(^|[^0-9])0\s*人伤亡|零伤亡|暂无伤亡/;
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
    const CONTROLLED_CLAIM = /((已经?|已)得?到?(有效)?控制|险情已控制|已完全控制|基本控制|趋于平稳|险情已平息|已排除)/;
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
    const deployHit = new RegExp(`${DEPLOY_VERB}|调派了?${CN_NUM}\\s*支|出动了?${CN_NUM}\\s*支`).test(p.text);
    if (!deployHit) continue;
    // 豁免：前瞻性拟派表述（拟调派/拟预置/计划调派/建议调派/预置）+12 字内出现“调派/出动/派遣”类动词。
    // 注意：“已调派候选救援队伍”不豁免（候选队伍不能写成已调派，种子负例）。
    const exempt =
      /(拟|计划|建议|预置)[^。；]{0,10}(调派|出动|派遣|预置)|候选[^。；]{0,10}尚未(调派|出动|派遣)/.test(p.text) &&
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
            'R-007',
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

  // R-010 无来源数值（审查 M-11：升为 block；数字级豁免——绑定数不足覆盖阿拉伯数字时才报；剔除日期/时间/版本号样式）
  for (const p of flat) {
    const normalized = p.text
      .replace(/\d{4}-\d{2}-\d{2}/g, '')
      .replace(/\d{2}:\d{2}/g, '')
      .replace(/\d+(\.\d+){2,}/g, '')
      .replace(/[Kk]\d+\+\d+/g, '');
    const numbers = normalized.match(/\d+(\.\d+)?/g) ?? [];
    if (!numbers.length) continue;
    const bindingCount = p.factBindings.length + p.derivedBindings.length;
    if (bindingCount === 0) {
      issues.push(
        issue(
          'R-010',
          'block',
          '段落包含数值但未绑定任何结构化来源，禁止无来源数字进入报送文书。',
          p.sectionId,
          p.paragraphId,
          p.text.slice(0, 40),
          '为数值补录来源绑定或删除该数值',
          null,
        ),
      );
    } else if (numbers.length > bindingCount) {
      issues.push(
        issue(
          'R-010',
          'block',
          `段落内来源绑定（${bindingCount} 处）不足以覆盖全部数值（${numbers.length} 处），存在无来源数字。`,
          p.sectionId,
          p.paragraphId,
          p.text.slice(0, 40),
          '为多余数值补充来源或删除',
          null,
        ),
      );
    }
  }

  // R-009 快照过期（监测数据更新后）
  if (snapshot.contextVersion < currentContextVersion()) {
    issues.push(
      issue(
        'R-009',
        'warning',
        '生成后监测数据已更新（演示时钟推进），本稿基于较早快照；请刷新水位等数据后重新校核。',
        null,
        null,
        `快照版本 ${snapshot.contextVersion}`,
        '可使用“按最新数据重校核”更新工作副本数据',
        null,
      ),
    );
  }

  // R-012 报送要素缺失：报送单位绑定应为当前文书 scope 的人工补录事实（field=reportingUnit），
  // 或正文明确写出报送单位（含事件/班次名等具体内容，非仅提及字段名）。
  const manualReportingFactIds = new Set(
    useDemoStore
      .getState()
      .manualFacts.filter((m) => m.field === 'reportingUnit')
      .filter((m) =>
        snapshot.scopeKind === 'event'
          ? m.scopeKind === 'event' && m.scopeId === snapshot.eventId
          : m.scopeKind === 'shift' && m.scopeId === snapshot.shiftId,
      )
      .map((m) => m.factId),
  );
  const reportingOk = flat.some((p) => p.factBindings.some((b) => manualReportingFactIds.has(b.factId)));
  const reportingTextOk = flat.some(
    (p) =>
      (p.text.includes('报送单位：') || p.text.includes('填报单位：')) &&
      p.text.replace(/报送单位：|填报单位：/g, '').trim().length >= 4,
  );
  if (!reportingOk && !reportingTextOk) {
    issues.push(
      issue('R-012', 'block', '缺少报送单位等报送要素。', null, null, null, '请在聊天中补录报送单位。', null, 'reportingUnit'),
    );
  }

  // R-013 模拟标识
  const hasMockMark = content.footerNote.includes('模拟') || flat.some((p) => p.text.includes('模拟'));
  if (!hasMockMark) {
    issues.push(issue('R-013', 'warning', '文书缺少“模拟数据”标识，请保留页脚演示声明。', null, null, null, null, null));
  }

  // 审查 minor-8：原 R-008 死代码已移除（派生一致性由快照冻结 + contentHash 门槛覆盖）。

  const contentHash = computeContentHash(content);

  return {
    documentId,
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
