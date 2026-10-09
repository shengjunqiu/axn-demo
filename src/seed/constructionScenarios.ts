/**
 * 建设场景 · 四智能体演示内容
 * 文案与能力口径对齐 Vue 原型 doc-emergency-anneng（conversationCapabilities / AnnengEntry），
 * 绑定本仓库模拟事件（evt-demo-001 / evt-demo-002），全部为本地演示结果，不接真实模型或系统。
 */
import {
  disasterProfileById,
  disasterDocumentSections,
  disasterResourcesText,
  disasterTacticSection,
} from './disasterScenarios';
import { DEMO_CLOCK, factById, incidentById } from '@/seed/scenario';
import { vueDemoResourcesForEvent, type VueDemoResource } from '@/seed/vueDemoResources';
import { vueWorkspaceEventById } from '@/seed/vueWorkspaceEvents';
import { factDisplay } from '@/services/factLookup';

export type ConstructionCapability =
  | 'situation'
  | 'situationReport'
  | 'search'
  | 'resourceReport'
  | 'update'
  | 'group'
  | 'plan'
  | 'revise'
  | 'deviation'
  | 'summary';

/** Vue 默认演示事件（武陵大道内涝），对齐 eventWorkspace.defaultEventId。 */
export const VUE_DEFAULT_RESOURCE_EVENT_ID = 'evt-vue-nl08';

export interface ConstructionSection {
  title: string;
  text: string;
}

export interface ConstructionTable {
  headers: string[];
  rows: string[][];
}

export interface ConstructionResult {
  capability: ConstructionCapability;
  agentId: string;
  title: string;
  summary: string;
  sections: ConstructionSection[];
  table?: ConstructionTable;
  tables?: { title: string; headers: string[]; rows: string[][] }[];
  notice: string;
  dataTime: string;
}

/**
 * 首页建设场景入口：对齐招标/规划三场景（灾情研判、力量投送、实施救援）。
 * 第四卡为实施救援·复盘，避免与「四个平行业务场景」口径冲突。
 */
export const CONSTRUCTION_SCENARIO_PROMPTS = [
  {
    agentId: 'agent-situation',
    agentName: '态势感知智能体',
    label: '灾情研判',
    prompt: '分析当前险情的现场资料、次生风险、队伍人员状态时效和待核实事项',
    tag: '场景 · 研判',
    scenario: '灾情研判',
  },
  {
    agentId: 'agent-resource',
    agentName: '救援资源管理智能体',
    label: '力量投送',
    prompt: '查询事发周边可调动的队伍、装备和保障单元',
    tag: '场景 · 投送',
    scenario: '力量投送',
  },
  {
    agentId: 'agent-plan',
    agentName: '救援方案生成智能体',
    label: '实施救援 · 方案',
    prompt: '结合现有人员装备、历史案例和预案规范生成处置方案初稿',
    tag: '场景 · 实施',
    scenario: '实施救援',
  },
  {
    agentId: 'agent-eval',
    agentName: '救援效果评估智能体',
    label: '实施救援 · 复盘',
    prompt: '根据本次过程记录，生成反思式总结报告，重点整理问题与改进',
    tag: '场景 · 复盘',
    scenario: '实施救援',
  },
] as const;

const NOTICE = '结果仅为建议或初稿（模拟数据），正式办理沿用原系统权限与审核流程。';

function eventContext(eventId: string) {
  const incident = incidentById.get(eventId);
  const scope = { kind: 'event' as const, eventId };
  if (!incident) {
    return {
      title: eventId,
      location: '待补充',
      disasterType: '待核实',
      occurredAt: '待补充',
      controlStatus: '待核实',
      casualty: '人员伤亡情况待核实',
      impact: '影响范围待核实',
      description: '当前事件缺少授权演示资料，请先关联有效灾情。',
      risks: '现场风险与工程条件待技术、安全岗位复核。',
      isFlood: false,
    };
  }
  const title = factDisplay(incident.factRefs.title, scope);
  const disasterType = factDisplay(incident.factRefs.disasterType, scope);
  const vue = vueWorkspaceEventById.get(eventId);
  const isFlood = /积水|内涝/.test(disasterType) || vue?.category === '城市内涝';
  return {
    title,
    location: factDisplay(incident.factRefs.location, scope),
    disasterType,
    occurredAt: factDisplay(incident.factRefs.occurredAt, scope),
    controlStatus: factDisplay(incident.factRefs.controlStatus, scope),
    casualty: factDisplay(incident.factRefs.casualty, scope),
    impact: factDisplay(incident.factRefs.impactScope, scope),
    description: factDisplay(incident.factRefs.incidentDescription, scope),
    risks: vue?.risks
      ?? (isFlood
        ? '涉水触电、车辆漂浮、地下空间进水和交通阻断'
        : '渗流发展、堤体稳定与临水作业风险'),
    isFlood,
  };
}

const DEMO_KIND_LABEL: Record<VueDemoResource['kind'], string> = {
  team: '队伍',
  equipment: '装备',
  warehouse: '物资',
  hospital: '医院',
  hotel: '宾馆',
  gasStation: '加油站',
  supportUnit: '保障单元',
  expert: '专家',
  school: '学校',
};

/** 本事件演示资源表（建设叠加点 / 十类灾种样例），供查询与报告填表。 */
function demoResourceTable(eventId: string): ConstructionTable | null {
  const items = vueDemoResourcesForEvent(eventId);
  if (!items.length) return null;
  return {
    headers: ['资源', '类型', '数量', '位置 / 距离', '状态 / 能力'],
    rows: items.map((r) => [
      r.name,
      DEMO_KIND_LABEL[r.kind],
      r.amountLabel,
      `${r.location} / ${r.distanceLabel}`,
      `${r.status} · ${r.capability}`,
    ]),
  };
}

function formatDemoResources(items: VueDemoResource[], empty: string): string {
  if (!items.length) return empty;
  return items
    .map((r) => `${r.name}（${DEMO_KIND_LABEL[r.kind]}）/ ${r.amountLabel} / ${r.status} / ${r.location} / ${r.distanceLabel}`)
    .join('\n');
}

function resourceLines(eventId: string): string {
  const demo = vueDemoResourcesForEvent(eventId);
  if (demo.length) {
    return formatDemoResources(demo, '');
  }
  const vue = vueWorkspaceEventById.get(eventId);
  if (vue?.resourcesNote) return vue.resourcesNote;
  const teams = ['fact-team-001-name', 'fact-team-002-name']
    .map((id) => factById.get(id))
    .filter(Boolean)
    .map((f) => String(f!.value));
  if (eventId === 'evt-demo-001' && teams.length) {
    return `演示候选力量：${teams.join('、')}；装备与可出动状态、人员名单及单件标识仍待核。距离与预计到达时间为模拟数据。`;
  }
  return '未取得本事件有效人装记录，请补充数量、单位、状态、来源与更新时间。';
}

function searchResultFromResources(
  eventId: string,
  userInput: string,
  table: ConstructionTable,
): ConstructionResult {
  const query = userInput || '查询事发周边队伍、保障单元、装备、物资、专家，以及学校、医院、宾馆、加油站等影响目标';
  return {
    capability: 'search',
    agentId: 'agent-resource',
    title: '本事件资源查询',
    summary: '已按本事件演示资料整理候选资源；数量与可出动状态待岗位核对，未取得数量不按零处理。支持联动查看列表 / 态势地图分布示意。',
    table,
    sections: [
      { title: '检索条件', text: query },
      {
        title: '查询说明',
        text: hasAuthorizedResourceLedger(eventId)
          ? '可按专业、区域、距离及可出动状态查询。距离与预计到达时间为当前事件授权台账中的模拟字段；医院、学校和保障单元需另核实可用性。'
          : '以下为当前事件演示候选，不沿用其他事件的距离或预计到达时间；医院、学校和保障单元需另核实可用性。',
      },
      {
        title: '待核字段',
        text: `专业、位置、距离、人数、装备、可用状态和更新时间待授权台账核对。${LEDGER_MAINTENANCE_HINT}投送堵点：通行保障与对外协调。`,
      },
    ],
    notice: NOTICE,
    dataTime: DEMO_CLOCK,
  };
}

/** 是否具备本仓库授权台账资源（距离/ETA 仅允许绑定同一事件）。 */
export function hasAuthorizedResourceLedger(eventId: string): boolean {
  return eventId === 'evt-demo-001';
}

const STATUS_LABEL: Record<string, string> = {
  available: '可出动（演示）',
  busy: '任务占用（不可调）',
  offline: '离线待核',
};

const LEDGER_MAINTENANCE_HINT =
  '台账常见维护周期最长约半年；可出动状态必须以状态更新时间为准，过期快照不直接出动。';

/** 按灾种给出道路/天气演示占位（非实时路况）。 */
function roadWeatherDemo(disasterType: string, isFlood: boolean): string {
  if (/冰雪|大雪|低温|封山/.test(disasterType)) {
    return '演示占位（参考镇雄抢险口径）：大雪封山时装备可能无法上高速，人员可改铁路等运输方式；通行保障、票务与对外协调为投送堵点。未接实时路况，正式结论待当地回传。';
  }
  if (isFlood || /内涝|积水|洪涝|堤防|决口|堰塞/.test(disasterType)) {
    return '演示占位：关注低洼路段积水、匝道封闭与绕行条件；装备与人员投送前核对通行保障（含高速免费/快速通行协调）。未接实时路况 API。';
  }
  if (/地震|滑坡|泥石流|矿/.test(disasterType)) {
    return '演示占位：关注塌方阻断、便道承载与展开空间；道路通行与天气条件对先期研判和投送组织至关重要，须据现场回传更新。未接实时路况。';
  }
  return '尚无授权实时道路、天气或交通管制记录，请补充当地回传资料；通行保障与对外协调为投送组织常见堵点。本原型不预测灾害边界或认定通行条件。';
}

/** 队伍/人员状态时效：突出更新时间与可出动核对（用户关注点）。 */
function teamPersonnelRealtime(eventId: string): { text: string; table: ConstructionTable } {
  const hasAnchor = eventId === 'evt-demo-001';
  const rows = hasAnchor
    ? [
        [
          String(factById.get('fact-team-001-name')?.value ?? '一号工程应急救援队'),
          `${factById.get('fact-team-001-peopleCount')?.value ?? '—'}人`,
          STATUS_LABEL[String(factById.get('fact-team-001-status')?.value ?? '')] ?? '状态待核',
          '2026-09-28 20:58（模拟快照）',
          '需值班岗位确认是否仍可出动',
        ],
        [
          String(factById.get('fact-team-002-name')?.value ?? '二号应急救援队'),
          `${factById.get('fact-team-002-peopleCount')?.value ?? '—'}人`,
          STATUS_LABEL[String(factById.get('fact-team-002-status')?.value ?? '')] ?? '状态待核',
          '2026-09-28 20:58（模拟快照）',
          '人员名单与装备单件标识待补核',
        ],
        [
          String(factById.get('fact-team-003-name')?.value ?? '三号抢险支队'),
          `${factById.get('fact-team-003-peopleCount')?.value ?? '—'}人`,
          STATUS_LABEL[String(factById.get('fact-team-003-status')?.value ?? '')] ?? '状态待核',
          '2026-09-28 20:50（模拟快照）',
          '正在执行其他任务，不列入本事件可调力量',
        ],
      ]
    : [
        ['本事件授权队伍台账', '人数待核', '可出动状态待核', '未取得本事件有效更新时间', '请补充授权台账或现场回传后再判定实时可用'],
      ];
  return {
    text: hasAnchor
      ? `以下为演示快照，重点展示队伍/人员状态与更新时间；不代替实时台账。${LEDGER_MAINTENANCE_HINT}正式可出动结论须由资源维护岗位确认。`
      : `当前事件尚未接入授权实时台账。态势感知优先提示“状态更新时间缺失”，不将历史名册直接当作实时可出动力量。${LEDGER_MAINTENANCE_HINT}`,
    table: {
      headers: ['队伍', '人员', '可出动状态', '状态更新时间', '核对事项'],
      rows,
    },
  };
}

/** 态势报告保障资源：安全区域 / 可出动队伍 / 医院 / 影响目标。 */
function situationSupportResources(eventId: string, location: string, isFlood: boolean): {
  safeZones: ConstructionTable;
  deployableTeams: ConstructionTable;
  hospitals: ConstructionTable;
  impactTargets: ConstructionTable;
  note: string;
} {
  const realtime = teamPersonnelRealtime(eventId);
  const deployable = realtime.table.rows.filter((row) => /可出动/.test(row[2] ?? ''));
  return {
    safeZones: {
      headers: ['安全区域 / 场所', '检索圈层（演示）', '相对位置（演示）', '开放与容量', '通达与安全条件', '核实状态'],
      rows: isFlood
        ? [
            ['立交口空旷集结区（演示）', '事发地周边约 100 公里', `${location} 北侧约 0.8 km`, '开放状态待核 / 容量待核', '涉水路段待确认', '待现场与属地确认'],
            ['周边学校（演示）', '事发地周边约 100 公里', `${location} 东侧约 1.5 km`, '是否开放、床位待核；不自动认定为安置场所', '夜间通达与供电待核', '待教育/属地确认'],
            ['高地停车场（演示）', '事发地周边约 100 公里', `${location} 西侧约 2.0 km`, '容量与照明待核', '积水回退条件待核', '待交管确认'],
          ]
        : [
            ['空旷集结点（演示）', '事发地周边约 100 公里', `${location} 外侧约 1.0 km`, '容量待核', '物资装卸条件待核', '待现场确认'],
            ['周边学校（演示）', '事发地周边约 100 公里', `${location} 方向约 3 km`, '是否开放待核；不自动认定为安置场所', '撤离路线待核', '待教育/属地确认'],
            ['村组应急避险点（演示）', '事发地周边约 100 公里', `${location} 约 1.2 km`, '开放与容纳人数待核', '通达条件待核', '待属地确认'],
          ],
    },
    deployableTeams: {
      headers: ['可出动救援队伍', '人员', '状态 / 更新时间', '说明'],
      rows: (deployable.length ? deployable : realtime.table.rows).map((row) => [
        row[0],
        row[1],
        `${row[2]} / ${row[3]}`,
        row[4],
      ]),
    },
    hospitals: {
      headers: ['医院 / 医疗点', '相对位置（演示）', '接诊能力', '救护车 / 床位', '核实状态'],
      rows: [
        ['县人民医院急诊（演示）', `${location} 方向约 12 km`, '创伤急诊可衔接（演示口径）', '救护车与床位占用待核', '待卫健联络确认'],
        ['中心卫生院（演示）', `${location} 方向约 6 km`, '初步处置能力待核', '转运能力待核', '待属地确认'],
        ['现场救护点（拟设）', '靠近但不进入高风险区', '检伤分类与复苏待配置', '后送路线待核', '待医疗与安全岗会商'],
      ],
    },
    impactTargets: {
      headers: ['影响分析目标', '类型', '相对位置（演示）', '可用性', '核实状态'],
      rows: [
        ['城东商务宾馆（演示）', '宾馆', `${location} 方向约 8 km`, '床位与开放状态待核', '待属地确认'],
        ['国道加油站（演示）', '加油站', `${location} 方向约 5 km`, '油品与夜间营业待核', '待能源/属地确认'],
        ['综合保障单元（演示）', '保障单元', `${location} 外围集结区`, '餐食服装通信保障能力待核', '待资源岗位确认'],
        ['工程抢险专家组（演示）', '专家', '远程/靠前待定', '专业领域与到场时效待核', '待专家组确认'],
      ],
    },
    note: `演示检索圈层：事发地周边约 100 公里（不等于灾害安全边界）。安全区域与医院信息不构成已确认安置或接诊安排；学校不自动认定为安置场所。队伍可出动以“状态 + 更新时间”双字段核对。${LEDGER_MAINTENANCE_HINT}`,
  };
}

/** 从用户输入与意图参数推断建设能力（对齐 Vue detectCapability）。 */
export function resolveConstructionCapability(
  intent: string,
  userInput: string,
  params?: Record<string, unknown>,
): ConstructionCapability | null {
  if (typeof params?.capability === 'string') {
    return params.capability as ConstructionCapability;
  }
  const text = userInput.trim();
  if (/周边.*资源.*报告|资源分析报告|生成周边资源报告/.test(text)) return 'resourceReport';
  if (/状态|更新|校正/.test(text) && /队伍|人员|装备|资源/.test(text)) return 'update';
  if (/编组|抽组|一车一组|排涝车/.test(text)) return 'group';
  if (/修订|现场反馈|调整方案|完善方案/.test(text)) return 'revise';
  if (/偏差|投入.*实际|对照.*计划/.test(text)) return 'deviation';
  if (/态势报告|研判报告/.test(text)) return 'situationReport';
  if (/总结|复盘|反思式/.test(text) && intent === 'evaluation') return 'summary';
  if (intent === 'summary') return /态势|研判报告/.test(text) ? 'situationReport' : 'situation';
  if (intent === 'resource_query') {
    if (/周边.*资源.*报告|资源分析报告/.test(text)) return 'resourceReport';
    if (/状态|更新|校正/.test(text)) return 'update';
    if (/编组|抽组/.test(text)) return 'group';
    return 'search';
  }
  if (intent === 'proposal') return /修订|反馈/.test(text) ? 'revise' : 'plan';
  if (intent === 'evaluation') return /偏差/.test(text) ? 'deviation' : 'summary';
  return null;
}

export function buildConstructionResult(
  capability: ConstructionCapability,
  eventId: string,
  userInput = '',
): ConstructionResult {
  const profile = disasterProfileById.get(eventId);
  if (profile) {
    // 资源查询 / 状态核对：产出查询类材料（不当作一期七段报告）；正式报告走 resourceReport。
    if (capability === 'search') {
      const result = searchResultFromResources(eventId, userInput, {
        headers: ['资源', '类型', '数量', '专业能力', '状态'],
        rows: profile.resources.map((r) => [r.name, r.kind, r.amount, r.capability, r.status]),
      });
      result.title = `${profile.name} · 资源智能检索`;
      result.summary = `${profile.category}；${profile.location}；${profile.capturedAt}。${result.summary}`;
      result.dataTime = profile.capturedAt;
      result.sections.unshift({title:'事件与检索范围',text:`${profile.name} / ${profile.category} / ${profile.location}。${profile.gaps}。资源为当前事件独立候选（模拟），未正式调派。`});
      return result;
    }
    if (capability === 'update') {
      return {
        capability,
        agentId: 'agent-resource',
        title: `${profile.name} · 专业资源状态核对`,
        summary: `数量与可出动状态分开核对；资料时间 ${profile.capturedAt}。${LEDGER_MAINTENANCE_HINT}`,
        table: {
          headers: ['资源', '当前状态', '待核字段', '建议动作'],
          rows: profile.resources.map((r) => [r.name, r.status, '数量 / 占用 / 更新时间', '联系资源维护岗位补核']),
        },
        sections: [
          { title: '当前材料', text: disasterResourcesText(profile) },
          {
            title: '更新方式',
            text: '可在对话中补充校正信息，形成待核材料。正式台账更新机制、IoT接入与写入接口由平台确认。',
          },
        ],
        notice: NOTICE,
        dataTime: profile.capturedAt,
      };
    }
    const codes: Record<ConstructionCapability, string> = {
      situation: 'SITUATION_REPORT',
      situationReport: 'SITUATION_REPORT',
      search: 'RESOURCE_REPORT',
      resourceReport: 'RESOURCE_REPORT',
      update: 'RESOURCE_REPORT',
      group: 'RESCUE_PLAN',
      plan: 'RESCUE_PLAN',
      revise: 'RESCUE_PLAN',
      deviation: 'RESCUE_EVAL',
      summary: 'WORK_SUMMARY_REFLECT',
    };
    const labels: Record<ConstructionCapability, string> = { situation: '灾情研判', situationReport: '灾情态势报告初稿', search: '专业资源查询', resourceReport: '周边资源分析报告初稿', update: '专业资源状态核对', group: '专业力量编组建议', plan: '救援方案初稿', revise: '方案修订建议', deviation: '阶段目标与投入核对', summary: '反思式总结初稿' };
    const sections = (disasterDocumentSections(eventId, codes[capability]) ?? []).map(([title, text]) => ({ title, text }));
    if (capability === 'group') sections.push({ title: '专业编组', text: `围绕${profile.objective}配置技术、安全、作业与保障岗位；${disasterResourcesText(profile)}。具体人数和装备配组需负责人核定。` });
    if (capability === 'revise') sections.push({ title: '本次现场反馈', text: userInput || '尚无现场反馈，请补充后复核对应章节。' });
    if (capability === 'deviation') sections.push({ title: '投入偏差边界', text: '本事件只有专业资源候选和阶段目标样例，未配置批准的投入计划及实际出动回执，不计算投入偏差。' });
    const isResources = ['search', 'resourceReport', 'update', 'group'].includes(capability);
    const expertFirst = '到达现场不盲目施救，先成立专家组完成风险隐患评估，再展开救援。';
    if (capability === 'revise') {
      sections.push({
        title: '动态调控说明',
        text: '先遣组到场后实时回传现场情况，后方结合历史案例对照一边抢险一边完善方案；现场由基地领导巡查各点位、动态调剂人员装备。',
      });
    }
    if (capability === 'group') {
      sections.push({
        title: '梯队与通行堵点',
        text: '梯队组织：先遣队 + 机动中队，按第一、二、三梯队派出。投送堵点：通行保障（高速免费/快速通行）、交通票务、对外协调。',
      });
    }
    const tactic = disasterTacticSection(profile);
    const planSummaryExtra = ['plan', 'revise', 'group'].includes(capability) && tactic
      ? `主战法要点：${tactic[1].slice(0, 80)}${tactic[1].length > 80 ? '…' : ''}。`
      : '';
    return {
      capability, agentId: isResources ? 'agent-resource' : ['plan', 'revise'].includes(capability) ? 'agent-plan' : ['summary', 'deviation'].includes(capability) ? 'agent-eval' : 'agent-situation',
      title: `${profile.name} · ${labels[capability]}`,
      summary: `${expertFirst}${planSummaryExtra}按${profile.category}独立模拟资料整理，关注${profile.risks}；资料时间 ${profile.capturedAt}，候选资源未形成实际调派。${LEDGER_MAINTENANCE_HINT}`,
      sections,
      tables: [
        { title: '专业监测数据', headers: ['指标', '最新样例', '观察时段', '来源'], rows: profile.monitoring.map(m => [m.label, `${m.values.at(-1)} ${m.unit}`, m.times.join(' / '), m.source]) },
        { title: '专业资源候选', headers: ['资源', '数量', '专业能力', '状态'], rows: profile.resources.map(r => [r.name, r.amount, r.capability, r.status]) },
        ...(capability === 'situationReport' ? [
          { title: '避险与医疗协同（待核）', headers: ['事项', '当前事件核对要求'], rows: [['检索圈层', '事发地周边约 100 公里（演示），不等于灾害边界'], ['避险集结点 / 学校', `${profile.location}外围空旷场所与学校开放状态待核；学校不自动认定为安置场所`], ['医疗后送', `${profile.category}医疗接诊容量、路线及属地联系人待卫健岗位确认`], ['宾馆 / 加油站', '影响分析目标名称、距离与可用性待核']] },
        ] : []),
      ], notice: NOTICE, dataTime: profile.capturedAt,
    };
  }
  const ctx = eventContext(eventId);
  const timeline = `演示事件：${ctx.title}（${ctx.disasterType}）。接报/发生时间 ${ctx.occurredAt}；地点 ${ctx.location}。${ctx.description} 处置状态：${ctx.controlStatus}。`;
  const resources = resourceLines(eventId);
  const planText = ctx.isFlood
    ? '核实受困对象，开展工程勘察及气体漏电检测，确认排水去向、临时供电与安全条件后实施经审定的排涝作业。实际批准版本及变化记录待核。'
    : `围绕「${ctx.disasterType}」核实现场条件、受威胁对象与适用工法；技术参数与安全条件由专业岗位复核，未签发工法或正式调度命令。`;
  const gaps = '连续作业量、人员救助确认、安全检测、验收及撤收回执尚不完整；不据此推定零消耗、无伤亡或任务已完成。';
  const dataTime = DEMO_CLOCK;

  switch (capability) {
    case 'situation': {
      const realtime = teamPersonnelRealtime(eventId);
      return {
        capability,
        agentId: 'agent-situation',
        title: '当前灾情研判',
        summary: '到达现场不盲目施救，先成立专家组完成风险隐患评估，再展开救援。队伍、人员状态以更新时间为准，过期快照不直接当作实时可出动。',
        table: realtime.table,
        sections: [
          { title: '当前依据', text: timeline },
          {
            title: '风险与勘察重点',
            text: `建议重点核实${ctx.risks}。人员情况：${ctx.casualty}。影响范围：${ctx.impact}。与本灾种相关的安全检测和工程勘察资料未取得，需由技术、安全岗位复核。次生灾害须做到能监测、会预警。`,
          },
          {
            title: '队伍与人员状态时效',
            text: `${realtime.text} 用户重点关注可出动状态、在岗人数与状态更新时间；冲突值保留来源并人工确认。`,
          },
          {
            title: '道路与天气',
            text: roadWeatherDemo(ctx.disasterType, ctx.isFlood),
          },
        ],
        notice: NOTICE,
        dataTime,
      };
    }
    case 'situationReport': {
      const support = situationSupportResources(eventId, ctx.location, ctx.isFlood);
      const realtime = teamPersonnelRealtime(eventId);
      return {
        capability,
        agentId: 'agent-situation',
        title: '灾情态势报告初稿',
        summary: '报告包含灾情概况、安全态势与次生预警关注、队伍人员状态时效、约 100 公里圈层内安全区域/学校、可出动救援队伍、医院及宾馆加油站等影响目标（模拟 · 待人工核对）。先专家组评估，再展开救援。',
        table: realtime.table,
        tables: [
          { title: '安全区域（约100公里演示圈层）', ...support.safeZones },
          { title: '可出动救援队伍', ...support.deployableTeams },
          { title: '医院等医疗资源', ...support.hospitals },
          { title: '影响分析目标（宾馆/加油站/保障/专家）', ...support.impactTargets },
        ],
        sections: [
          { title: '灾情概况', text: `${timeline}\n研判口径：先成立专家组完成风险隐患评估，再展开救援。` },
          {
            title: '安全态势与发展关注',
            text: `主要风险：${ctx.risks}。能监测·会预警：次生灾害监测指标与预警触发待核；需补连续监测和现场勘察。演示检索圈层约 100 公里，不代表灾害边界。\n道路与天气：${roadWeatherDemo(ctx.disasterType, ctx.isFlood)}`,
          },
          {
            title: '队伍与人员状态时效',
            text: `${realtime.text} 态势报告优先列出状态更新时间与可出动核对事项，避免把历史名册当作实时力量。`,
          },
          {
            title: '资源信息核对提示',
            text: `${support.note}\n检索范围覆盖队伍、装备、物资、专家、保障单元，以及学校、医院、宾馆、加油站等影响目标。\n救援力量背景：${resources}`,
          },
        ],
        notice: NOTICE,
        dataTime,
      };
    }
    case 'search': {
      // 对齐 Vue conversationCapabilities search：有本事件演示资源则填表；不沿用跨事件台账。
      const query = userInput || '查询事发周边队伍、保障单元、装备、物资、专家，以及学校、医院、宾馆、加油站等影响目标';
      if (/破拆|地震|直升机|船舶|爆破/.test(query) && !disasterProfileById.has(eventId) && !vueDemoResourcesForEvent(eventId).length) {
        return {
          capability,
          agentId: 'agent-resource',
          title: '资源查询结果',
          summary: '当前所选演示资料中没有与该用途匹配的有效资源记录。',
          sections: [
            { title: '检索需求', text: query },
            {
              title: '下一步核对',
              text: '请补充授权台账或相关专业资源资料；未查到不代表实际无资源，不替换为排涝装备。投送堵点提示：通行保障（高速免费/快速通行）与对外协调。',
            },
          ],
          notice: NOTICE,
          dataTime,
        };
      }
      const demoTable = demoResourceTable(eventId);
      if (demoTable) return searchResultFromResources(eventId, userInput, demoTable);
      const floodRows: string[][] = hasAuthorizedResourceLedger(eventId)
        ? [
            ['一号工程应急救援队（演示）', '队伍', '模拟编制', `${ctx.location} / 模拟距离`, '可出动状态待核 / 演示记录'],
            ['二号工程应急救援队（演示）', '队伍', '模拟编制', `${ctx.location} / 模拟距离`, '可出动状态待核 / 演示记录'],
            ['保障单元、专家及物资', '保障', '未取得有效记录', '待核', '待接入授权台账'],
          ]
        : [
            ['保障单元、专家及物资', '保障', '未取得有效记录', '待核', '待接入授权台账'],
          ];
      return searchResultFromResources(eventId, userInput, {
        headers: ['资源', '类型', '数量', '位置 / 距离', '状态 / 能力'],
        rows: floodRows,
      });
    }
    case 'resourceReport': {
      const demo = vueDemoResourcesForEvent(eventId);
      const teams = demo.filter((r) => r.kind === 'team');
      const equipment = demo.filter((r) => r.kind === 'equipment' || r.kind === 'warehouse');
      const targets = demo.filter((r) =>
        r.kind === 'hospital' || r.kind === 'school' || r.kind === 'hotel' || r.kind === 'gasStation',
      );
      const teamText = formatDemoResources(
        teams,
        '未取得本事件有效安能队伍记录，所属工程局、梯队、人数、装备数、联系人及距事发地距离待补核。',
      );
      const equipText = formatDemoResources(
        equipment,
        vueWorkspaceEventById.get(eventId)?.equipment
          ? `${resources}\n现有记录不代表周边库存总量。技术状态、占用和更新时间待核。`
          : '未取得本事件安能装备明细，类型、名称、数量、所属队伍及技术状态待补。',
      );
      const targetText = formatDemoResources(
        targets,
        '学校、医院、宾馆、加油站及其他重点防护目标的名称、地址、数量、距离、联系人和可用性待核。学校不自动认定为安全安置场所，医院接诊条件须另核实。',
      );
      return {
        capability,
        agentId: 'agent-resource',
        title: `${ctx.title}周边资源分析报告初稿`,
        summary: '参照一期周边资源分析报告七段结构组织初稿；有演示资源的章节已填入本事件候选，缺项保留待核。',
        tables: (() => {
          const table = demoResourceTable(eventId);
          return table ? [{ title: '本事件资源候选明细', ...table }] : undefined;
        })(),
        sections: [
          {
            title: '一、抢险基本信息',
            text: `${timeline}\n编写单位：待补；统计截止时刻：待补（到场时刻不等于统计截止时刻）；编写人：待补；审阅人：待确认。`,
          },
          {
            title: '二、安能队伍情况',
            text: `${teamText}\n明细字段：所属工程局、队伍名称、地址、所属梯队、人数、装备数、业务联系人、工作联系电话和距事发地距离；缺失字段待核。`,
          },
          {
            title: '三、其他央企队伍情况',
            text: '未取得本事件有效其他央企队伍记录，数量、所属央企、位置、人装及可出动状态待补核。',
          },
          {
            title: '四、安能装备情况',
            text: `${equipText}\n现有记录不代表周边库存总量。按装备类型、名称、数量、所属队伍及业务联络字段形成明细，技术状态、占用和更新时间待核。`,
          },
          {
            title: '五、其他央企装备情况',
            text: '未取得授权资料，装备类型、名称、所属央企及数量待补，不按零值汇总。',
          },
          {
            title: '六、重点防护目标情况',
            text: targetText,
          },
          {
            title: '七、范围与数据核验',
            text: `一期样例资源查询采用300公里、重点目标采用10公里。本事件查询半径尚未指定，不沿用样例固定数值；查询范围不代表灾害影响边界。${LEDGER_MAINTENANCE_HINT}各类汇总须注明统计时间、单位和去重口径。`,
          },
        ],
        notice: NOTICE,
        dataTime,
      };
    }
    case 'update': {
      const demo = vueDemoResourcesForEvent(eventId);
      return {
        capability,
        agentId: 'agent-resource',
        title: '资源状态待核清单',
        summary: `数量与可出动状态分开核对，不将历史台账直接当作实时可用资源。${LEDGER_MAINTENANCE_HINT}`,
        table: {
          headers: ['记录', '待核字段', '建议动作'],
          rows: demo.length
            ? demo.map((r) => [r.name, '数量 / 占用 / 更新时间', '联系资源维护岗位补核'])
            : [
                ['队伍 / 人员', '在岗、任务占用、更新时间', '联系资源维护岗位补核'],
                ['装备', '单件标识、技术状态、库存占用', '核对台账与现场记录'],
                ['物联网 / 人工填报', '采集时间、来源、冲突值', '保留来源并人工确认'],
              ],
        },
        sections: [
          { title: '当前材料', text: resources },
          {
            title: '更新方式',
            text: '可在对话中补充校正信息，形成待核材料。正式台账更新机制、IoT接入与写入接口由平台确认。',
          },
        ],
        notice: NOTICE,
        dataTime,
      };
    }
    case 'group': {
      const cars = userInput.match(/(\d+)\s*台/)?.[1];
      const count = cars ? Number(cars) : null;
      return {
        capability,
        agentId: 'agent-resource',
        title: '力量编组建议草稿',
        summary: '按装备编组的经验模板给出建议；精干高效，数量由经验人员最终敲定。梯队：先遣队 + 机动中队，按第一、二、三梯队派出。',
        sections: [
          {
            title: '编组依据',
            text: count
              ? `本次输入 ${count} 台排涝车。参考“一车一组、人员随车”经验，建议 ${count} 组；每组人数和专业岗位待负责人确认。`
              : ctx.isFlood
                ? '可参考“一车一组、人员随车”的经验模板。当前未明确排涝车辆数量，不自动生成组数；请在对话中补充。'
                : '按本灾种专业任务核定技术、作业、安全和保障岗位。当前候选人装未确认，不直接套用排涝编组或推定组数。展开空间受限时坚持精干高效。',
          },
          {
            title: '人装配置',
            text: count
              ? '每组驾驶、操作、安全与保障岗位由负责人核定，人数待确认。所选演示到场记录仅用于背景参考。'
              : resources,
          },
          {
            title: '精干高效与缺口',
            text: '结合现场空间、道路、装备展开条件控制编组规模。先确认运输、驾驶、操作、安全与保障岗位，未确认数量不计入正式出动力量。',
          },
          {
            title: '梯队与通行堵点',
            text: '组织方式：先遣队 + 机动中队，按第一、二、三梯队派出。堵点：通行保障（高速免费/快速通行）、交通票务、对外协调。',
          },
        ],
        notice: NOTICE,
        dataTime,
      };
    }
    case 'plan': {
      const siteCondition = ctx.isFlood
        ? '勘察排水设施、工程尺寸、排水去向和现场空间；道路、供电及通信条件待核实。'
        : `按「${ctx.disasterType}」勘察现场作业面、进入条件、道路通行与供电通信；所需材料、展开空间及安全检测资料待专业岗位核实。`;
      return {
        capability,
        agentId: 'agent-plan',
        title: '工程救援处置方案初稿',
        summary: '对齐一期处置方案骨架；主要措施含救援基本条件、战法、人装编组、安全预警撤离与综合保障。先专家组评估再救援。正式模板与签发仍走原系统。',
        sections: [
          {
            title: '一、基本情况',
            text: `${timeline}\n研判口径：先成立专家组完成风险隐患评估，再展开救援。\n历史案例参考（案例库·演示）：同类处置强调先遣评估与通行条件核对，不写入他案人数或联系人。`,
          },
          {
            title: '二、任务受领与力量抽组',
            text: `${resources}\n编组原则：精干高效，数量由经验人员敲定；正式抽组、报备与锁定仍走原系统流程。`,
          },
          {
            title: '三、指挥机构',
            text: '现场指挥机构、技术组、安全组及保障组岗位名单待原系统确认；本草稿不成立新的指挥关系。',
          },
          {
            title: '四、主要措施',
            text: `（一）救援基本条件\n${siteCondition} ${roadWeatherDemo(ctx.disasterType, ctx.isFlood)}\n（二）战法要点（内部战法参考·演示）\n${planText} 工法和工程参数须由专家组论证；行动战法禁止下载。\n（三）人装编组\n${resources}\n（四）安全预警与撤离\n补齐风险检测、进入条件、停工撤离触发条件、撤离路线及人员清点；次生风险变化时推送责任岗位。\n（五）综合保障\n核实运输、供电、餐食、服装、医疗、通信及人员轮换，明确责任岗位。宣传口径待宣传岗位确认。`,
          },
          {
            title: '五、风险困难与附件落款',
            text: `主要风险：${ctx.risks}。未核实事项：人员情况（${ctx.casualty}）、影响范围（${ctx.impact}）。\n附件：现场照片、监测材料、人装清单、历史案例索引（待补）。落款与审签沿用原处置方案模块。`,
          },
        ],
        notice: NOTICE,
        dataTime,
      };
    }
    case 'revise':
      return {
        capability,
        agentId: 'agent-plan',
        title: '现场反馈修订建议',
        summary: '先遣回传 + 历史案例对照 → 后方一边抢险一边完善方案。请补充现场变化，可直接在对话中描述或粘贴记录。',
        sections: [
          { title: '本次反馈', text: userInput || '（尚未粘贴现场反馈，请补充后再修订）' },
          {
            title: '建议修订章节',
            text: '重点核对救援基本条件、人装编组、战法适用、安全预警撤离及后勤保障；逐项注明新事实来源、变化原因与受影响任务。',
          },
          {
            title: '修订边界',
            text: '原方案有效版本、现场记录和批准变更须补齐。当前只能形成调整建议，不自动重新部署人员装备或覆盖正式方案。',
          },
        ],
        notice: NOTICE,
        dataTime,
      };
    case 'deviation':
      return {
        capability,
        agentId: 'agent-eval',
        title: '资源投入偏差分析',
        summary: '对照本事件演示计划与实际记录，偏差原因待核。',
        table: ctx.isFlood
          ? {
              headers: ['对照项', '计划 / 实际', '偏差'],
              rows: [
                ['首批人员', '12人 / 12人', '0人'],
                ['排水泵', '2套 / 1套', '-1套'],
                ['首批到场', '12:00 / 12:18', '晚18分钟（演示）'],
              ],
            }
          : {
              headers: ['对照项', '计划 / 实际', '偏差'],
              rows: [
                ['首批人员', '36人 / 32人', '-4人（演示）'],
                ['挖掘机', '4台 / 4台', '0台'],
                ['首批到场', '目标20分钟 / 18分钟', '达到模拟目标'],
              ],
            },
        sections: [
          { title: '口径与依据', text: resources },
          { title: '资料缺项', text: '缺少消耗、处置量与有效回执，暂不计算效率或绩效等级。' },
        ],
        notice: NOTICE,
        dataTime,
      };
    case 'summary':
      return {
        capability,
        agentId: 'agent-eval',
        title: '反思式总结初稿',
        summary: '按项目复盘四部组织：实际处置过程、处置方案、存在不足、下一步改进计划。',
        sections: [
          { title: '一、实际处置过程', text: `${timeline}\n${resources}` },
          { title: '二、处置方案', text: planText },
          {
            title: '三、存在不足',
            text: `${gaps} 重点复核通信与后勤保障问题；人员情况仍记为：${ctx.casualty}。`,
          },
          {
            title: '四、下一步改进计划',
            text: '补核装备差额原因、通信保障、服装食物和人员轮换；每项改进由责任岗位确认负责人、期限及验证材料。',
          },
        ],
        notice: NOTICE,
        dataTime,
      };
  }
}

/** 将建设结果格式化为任务卡可读文本（保留关键句供既有断言命中）。 */
export function formatConstructionText(result: ConstructionResult, extraTail = ''): string {
  const tableLines = result.table
    ? [
        result.table.headers.join(' | '),
        ...result.table.rows.map((r) => r.join(' | ')),
      ].join('\n')
    : '';
  const body = [
    `${result.title}（模拟）`,
    result.summary,
    tableLines,
    ...result.sections.map((s) => `${s.title}\n${s.text}`),
    result.notice,
    extraTail,
  ]
    .filter(Boolean)
    .join('\n\n');
  return body;
}

function clipPlain(text: string, max: number): string {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= max) return normalized;
  return `${normalized.slice(0, max - 1)}…`;
}

/**
 * 聊天区材料类回复：1～2 段摘要，对应提问意图；完整章节进右侧文书，避免与文稿重复堆叠。
 * 摘要中保留事件类别与演示资源名，便于事件隔离断言。
 */
export function buildChatMaterialSummary(
  result: ConstructionResult,
  userInput = '',
  extraTail = '',
): string {
  const ask = userInput.replace(/\s+/g, ' ').trim();
  const askBit = ask ? `针对「${clipPlain(ask, 42)}」` : '按当前指令';
  const resourceTables = (result.tables ?? []).filter(t => /资源|队伍|装备|人装/.test(t.title));
  const resourceNames = [
    ...(result.table?.rows ?? []).map(row => String(row[0] ?? '').trim()),
    ...resourceTables.flatMap(t => t.rows.map(row => String(row[0] ?? '').trim())),
    // 回落：从章节正文中提取「名称（模拟）」类演示资源称呼
    ...result.sections
      .flatMap(s => s.text.match(/[\u4e00-\u9fa5A-Za-z0-9]+（模拟）/g) ?? []),
  ].filter(Boolean);
  // 去重并保留前几个，供摘要与事件隔离断言命中
  const uniqNames = [...new Set(resourceNames)].slice(0, 4);
  const resourceHint = uniqNames.length
    ? `演示资源含${uniqNames.join('、')}等，数量与可出动状态待岗位核对。`
    : '';

  let focus: string;
  if (/协调|技术.*安全|保障协调|需协调/.test(ask)) {
    const picks = result.sections
      .filter(s => /安全|保障|协调|组织|措施|风险|待核/.test(s.title + s.text))
      .slice(0, 2);
    const lines = (picks.length ? picks : result.sections.slice(0, 2))
      .map(s => `${s.title}：${clipPlain(s.text, 72)}`);
    focus = `已梳理现场技术、安全与保障协调待核事项（模拟）：${lines.join('；')}。${clipPlain(result.summary, 100)}`;
  } else if (/修订|现场反馈|调整方案|完善方案/.test(ask)) {
    focus = `已按现场反馈整理方案修订要点（模拟）。${clipPlain(result.summary, 140)}`;
  } else if (/要情|简报/.test(ask)) {
    focus = `已形成阶段要情要点摘要（模拟）。${clipPlain(result.summary, 140)}`;
  } else if (/资源|队伍|编组|抽组|状态/.test(ask)) {
    focus = clipPlain(result.summary, 140);
  } else {
    focus = clipPlain(result.summary, 160);
  }

  const closer =
    '完整稿件与章节已同步到右侧文书工作区，聊天区仅保留摘要；正式结论以岗位核对为准。';
  return [askBit + '已完成整理（模拟）。', [focus, resourceHint, extraTail].filter(Boolean).join(' '), closer]
    .filter(Boolean)
    .join('\n\n');
}
