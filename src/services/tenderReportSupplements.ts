/**
 * 招标四智能体能力缺口在报告正文中的「模拟·待接入」补齐文案。
 * 仅供文书/建设场景材料展示，不接真实 IoT / RAG / LLM / 推送通道。
 */
import { tableToText } from '@/services/pipeTable';

export interface TenderSupplementContext {
  eventName: string;
  disasterType: string;
  location: string;
  risks?: string;
  planTitle?: string;
}

const MOCK_TAG = '（模拟·待接入）';

/** 态势感知：多源接入、影响范围/响应等级、内部资源叠加、预警推送草稿 */
export function situationCapabilitySupplement(ctx: TenderSupplementContext): {
  multiSourceAndLevel: string;
  resourceOverlay: string;
  warningPush: string;
} {
  const sources = tableToText(
    ['信源类型', '接入说明', '本事件摘录', '核验状态'],
    [
      ['互联网公开信息', `新闻/政务公开检索 API${MOCK_TAG}`, `${ctx.disasterType}相关线索已结构化摘要`, '待岗位核'],
      ['综合平台·气象', `暴雨等自然灾害信息接口${MOCK_TAG}`, '短时强降雨/致灾阈值跟踪（演示）', '待岗位核'],
      ['综合平台·地震地质', `地震/地质灾害信息接口${MOCK_TAG}`, `${ctx.disasterType}影响线索（演示）`, '待岗位核'],
      ['接报与内部台账', '综合管理平台接报/力量部署字段', `${ctx.eventName}；地点 ${ctx.location}`, '已模拟汇聚'],
    ],
  );
  return {
    multiSourceAndLevel: [
      '动态研判·多源信息汇聚' + MOCK_TAG,
      sources,
      `影响范围与建议响应等级：按灾害类型、发生时间、地点、影响范围、应急响应等级与救援力量部署等要素动态跟踪（演示）。建议响应等级：Ⅲ级（模拟）；影响范围以专业勘察为准，演示圈层不等于灾害边界。主要风险关注：${ctx.risks || '待核'}。`,
    ].join('\n'),
    resourceOverlay: [
      '态势报告·内部系统资源叠加' + MOCK_TAG,
      '已叠加本事件候选队伍、装备与保障单元状态时效（演示台账）；正式力量部署与占用以原系统实时台账为准，过期快照不直接计入可出动。',
    ].join('\n'),
    warningPush: [
      '预警推送·精准内容草稿' + MOCK_TAG,
      tableToText(
        ['推送对象', '渠道', '内容要点', '状态'],
        [
          ['现场指挥 / 值班岗', '模拟短信+系统消息', `${ctx.eventName}风险升级提示；关注${ctx.risks || '次生风险'}`, '草稿待批准'],
          ['技术组 / 安全岗', '模拟系统消息', '监测阈值与停工撤离触发条件待核', '草稿待批准'],
          ['属地协同单位', '模拟外发待审', '影响范围与通行管控建议（演示）', '待责任人确认'],
        ],
      ),
      '正式推送须经批准；不接真实短信/即时通讯通道。',
    ].join('\n'),
  };
}

/** 救援资源：IoT+填报校正、NL 模糊检索、多约束最优组合推荐 */
export function resourceCapabilitySupplement(ctx: TenderSupplementContext): {
  dataUpdate: string;
  nlSearch: string;
  multiConstraint: string;
  full: string;
} {
  const dataUpdate = [
    '数据更新·物联网与填报校正' + MOCK_TAG,
    tableToText(
      ['数据来源', '校正动作', '涉及对象', '结果'],
      [
        ['物联网采集', 'AI 比对占用/在线状态', '关键装备在线心跳', '冲突值已标红待人工确认'],
        ['管理人员填报', '与台账字段对齐校正', '队伍在岗人数/任务占用', '形成待核清单'],
        ['授权接口写入', '正式台账更新', '原系统资源库', '接口待平台确认'],
      ],
    ),
  ].join('\n');
  const nlSearch = [
    '资源检索·自然语言模糊匹配' + MOCK_TAG,
    `演示查询如「需要能破拆的装备」：按能力标签秒级匹配物资、特殊装备、队伍底数台账（本地模拟检索引擎）。本事件关联：${ctx.eventName}（${ctx.location}）。未命中不代表实际无资源。`,
  ].join('\n');
  const multiConstraint = [
    '资源建议·多约束组合推荐' + MOCK_TAG,
    tableToText(
      ['方案档', '距离', '时效ETA', '专业匹配度', '优先级', '推荐组合（演示）'],
      [
        ['精干方案', '近圈优先', '≤60分钟', '高', 'P1', '先遣组+关键装备1组'],
        ['标准方案', '近/中圈', '≤120分钟', '高', 'P1', '先遣+主力梯队+保障'],
        ['加强方案', '含远端备援', '≤180分钟', '中高', 'P2', '标准方案+备援装备'],
      ],
    ),
    '约束含距离、时效、专业匹配度、优先级；正式最优求解与锁定仍走原系统，本草稿不自动下达调派。',
  ].join('\n');
  return {
    dataUpdate,
    nlSearch,
    multiConstraint,
    full: [dataUpdate, nlSearch, multiConstraint].join('\n\n'),
  };
}

/** 救援方案：预案 RAG、专家规则、版本对比、安全红线 */
export function planCapabilitySupplement(ctx: TenderSupplementContext): {
  ragAndRules: string;
  versionAndRedline: string;
  reviseNote: string;
} {
  const planRef = ctx.planTitle || `${ctx.disasterType}相关预案（模拟参考）`;
  return {
    ragAndRules: [
      '生成依据·预案RAG与专家规则' + MOCK_TAG,
      tableToText(
        ['依据类型', '引用/命中', '说明'],
        [
          ['预案RAG', planRef, '向量检索有效条款、版本号与适用范围（演示引用，非正式签发）'],
          ['专家规则', '先专家组评估再投入主力；进入条件/停工撤离', '结构化规则引擎命中（演示）'],
          ['LLM结构化生成', '章节骨架+字段强制引用', '抑制幻觉：未授权人数/联系人不写入'],
        ],
      ),
    ].join('\n'),
    versionAndRedline: [
      '方案版本对比与安全红线' + MOCK_TAG,
      tableToText(
        ['对照项', '基线版', '修订版', '差异'],
        [
          ['版本号', 'V1（初稿）', 'V1.1（现场反馈）', '侦测条件与人装规模微调（演示）'],
          ['力量编成', '先遣+主力', '先遣+主力+保障加强', '+保障组岗位（演示）'],
        ],
      ),
      tableToText(
        ['红线规则', '校验结果', '处置'],
        [
          ['防违规·禁止无评估盲目施救', '通过（演示）', '正文强制写入专家组评估口径'],
          ['防幻觉·禁止编造未授权联系人/人数', '通过（演示）', '他案人数与联系人已屏蔽'],
          ['安全红线·进入/停工撤离条件', '待安全岗确认', '未确认不得视为可作业指令'],
        ],
      ),
    ].join('\n'),
    reviseNote: [
      '快速修订说明' + MOCK_TAG,
      '支持依据现场反馈修订建议并导出基线/修订差异；正式覆盖原系统方案版本库与审签流程待对接。',
    ].join('\n'),
  };
}

/** 效果评估：全维偏差、资料校验、知识沉淀与迭代触发 */
export function evalCapabilitySupplement(ctx: TenderSupplementContext): {
  deviationFull: string;
  materialCheck: string;
  knowledgeLoop: string;
  reflectExtra: string;
} {
  const deviationFull = [
    '资源投入偏差评估（计划 vs 实际）' + MOCK_TAG,
    tableToText(
      ['维度', '计划（预案/批准）', '实际（执行回执）', '偏差与量化'],
      [
        ['投送力量', '编制人数/装备套数（演示）', '实际调动记录（演示）', '人员/装备差额待核'],
        ['资源分配', '任务面分配方案', '现场分配记录', '分配偏差项待核'],
        ['时间节点', '目标到场/关键节点', '实际到场时刻', '响应时效偏差（分钟）待核'],
        ['任务分工', '岗位与责任分工', '实际处置动作记录', '分工执行偏差待核'],
        ['消耗数量', '预计消耗', '消耗凭证', '资源消耗效率待凭证齐全后计算'],
        ['处置动作', '方案规定步骤', '现场处置日志', '动作符合度待核'],
      ],
    ),
    `关联事件：${ctx.eventName}。量化评估资源消耗效率与响应时效后生成评估报告；缺有效回执时不给出绩效等级。`,
  ].join('\n');
  const materialCheck = [
    '过程资料完整度与真实程度校验' + MOCK_TAG,
    tableToText(
      ['资料项', '完整度', '真实程度核验', '结论'],
      [
        ['接报与派发记录', '已登记（演示）', '与原系统字段对照（模拟）', '可引用'],
        ['到场回执 / 消耗凭证', '尚不完整', '待人工核对影像/单据', '待补'],
        ['监测曲线 / 处置日志', '部分具备', '采集时刻与仪器校验待核', '待补'],
        ['批准方案版本', '待确认', '版本号与审签链待核', '待补'],
      ],
    ),
  ].join('\n');
  const knowledgeLoop = [
    '数据及知识沉淀闭环' + MOCK_TAG,
    tableToText(
      ['能力点', '本轮动作', '状态'],
      [
        ['过程数据抽取复用', `抽取${ctx.eventName}处置过程关键字段`, '已形成知识候选（模拟）'],
        ['时间序列比对', '监测/到场/消耗时序对照', '演示比对，正式引擎待建'],
        ['因果推理', '偏差原因候选与待核证据', '演示结论，待专家确认'],
        ['知识库增量更新接口', '评估结果写入案例候选', '本地模拟，不接真实 API'],
        ['知识库迭代任务', '评估完成自动触发迭代任务', '已触发（模拟）'],
      ],
    ),
  ].join('\n');
  return {
    deviationFull,
    materialCheck,
    knowledgeLoop,
    reflectExtra: [materialCheck, knowledgeLoop].join('\n\n'),
  };
}
