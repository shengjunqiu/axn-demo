/**
 * 通用 mock 执行日志（所有会话共用一份）。
 *
 * 纯展示用：任何对话（历史种子会话、默认会话、新建对话）首次打开时，
 * 都铺同一份对话记录与执行轨迹 —— 让「执行日志」页签在每个对话里长得一模一样。
 * 已经有消息的会话不再铺，避免盖掉现场跑出来的真实记录。
 *
 * 数据全部是虚构模拟数据；步骤/耗时/结论只为演示版式，不做业务断言依据。
 * 每个会话拿到的是同一份内容的不同实例（id 带 sessionId 前缀），互不影响。
 */
import type { AgentTask, ChatMessage, TaskStatus, TaskStep } from '@/domain/types';

interface MockStep {
  /** 任务卡里显示的中文步骤名 */
  name: string;
  /** 执行日志里显示的工具名（英文，真实的调用名） */
  tool: string;
  /** 执行日志里显示的调用入参（JSON 字符串） */
  args: string;
  /** 执行日志里显示的执行记录（英文一行） */
  returns?: string;
  input?: string;
  output?: string;
  /** 步骤耗时（毫秒） */
  ms: number;
  status?: TaskStep['status'];
  errorCode?: string;
}

interface MockTurn {
  /** 相对演示时钟的偏移（分钟，负数表示之前） */
  offsetMin: number;
  prompt: string;
  agent: string;
  steps: MockStep[];
  answer: string;
  status?: TaskStatus;
  error?: { errorCode: string; message: string; hint: string };
}

const MOCK_TURNS: MockTurn[] = [
  {
    offsetMin: -58,
    prompt: '帮我把漳河镇水位上涨的预警信息整理一下',
    agent: '态势感知智能体',
    steps: [
      { name: '读取预警来源', tool: 'fetch_alert_sources', returns: ['status=200 time=0.0412', 'sources=12 cached=false', 'exit=0'].join('\n'), args: JSON.stringify({ endpoint: 'http://127.0.0.1:18787/__gateway/alert/sources', method: 'POST', body: { eventId: 'evt-demo-001', since: '2026-09-28T20:00:00+08:00' }, timeout_ms: 3000 }, null, 2), input: '值班室汛情快报（模拟）+ 水情简报', output: '12 条原始要素', ms: 620 },
      { name: '校验水情监测数据', tool: 'verify_hydro_observations', returns: ['checked=2 passed=2 rejected=0', 'drift=[0.02,0.03]', 'exit=0'].join('\n'), args: JSON.stringify({ station: 'zhanghe', at: ['08:00', '09:00'], tolerance_m: 0.05, reject_on_gap: true }, null, 2), input: '漳河站 08:00 / 09:00 两组观测', output: '2 组观测通过校验', ms: 1180 },
      { name: '汇总预警要素', tool: 'extract_alert_elements', returns: ['level=橙色 scope=4villages', 'measures=3 items', 'tokens=184'].join('\n'), args: JSON.stringify({ input: 'alert://latest', fields: ['level', 'scope', 'measures'], locale: 'zh-CN' }, null, 2), input: '预警级别、影响范围、建议措施', output: '6 项要素已汇总', ms: 940 },
    ],
    answer: [
      '一、预警概况',
      '漳河站水位：当前 42.36 m，较 08:00 上涨 0.28 m，距警戒水位 0.64 m（模拟数据，未确认）。',
      '',
      '二、影响范围',
      '漳河镇沿河 4 个村（河湾村、新桥村、双河村、柳林村）低洼地带；镇区主干道北段易积水。',
      '',
      '三、建议措施',
      '1. 加密水情监测至每 30 分钟一次；2. 提前转移低洼地带独居老人 3 人；3. 泵站预排空管网。',
      '',
      '说明：以上要素均来自模拟数据源，实际处置须以现场核实为准。',
    ].join('\n'),
  },
  {
    offsetMin: -44,
    prompt: '把附近可调用的抢险队伍按到场时间排一下',
    agent: '救援资源管理智能体',
    status: 'partial',
    steps: [
      { name: '查询候选队伍与装备', tool: 'query_resources', returns: ['rows=9 teams=6 depots=3', 'time=0.1186'].join('\n'), args: JSON.stringify({ radius_km: 25, types: ['team', 'warehouse'], status: ['available', 'standby'], limit: 20 }, null, 2), input: '半径 25 km · 已入库资源', output: '候选 6 支队伍、3 处仓库', ms: 810 },
      { name: '计算到场时间', tool: 'estimate_eta', returns: ['eta=[12,26,41,46] unit=min', 'note="load time 6 min"'].join('\n'), args: JSON.stringify({ graph: 'drill_roadnet', include_load_time: true, depart_window_min: 15 }, null, 2), input: '演练路网通行速度 + 装车耗时', output: '估算 12–46 分钟', ms: 1420 },
      { name: '核对装备库存', tool: 'check_inventory', args: JSON.stringify({ items: ['pump', 'sandbag', 'light_truck'], warehouse: 'wh-north-02', as_of: '2026-09-28T21:00:00+08:00' }, null, 2), input: '抽水泵、编织袋、照明车', ms: 1020, status: 'failed', errorCode: 'RESOURCE_INVENTORY_STALE' },
      { name: '生成到场顺序清单', tool: 'rank_teams_by_eta', returns: ['ranked=3 first=镇属应急排 eta=12'].join('\n'), args: JSON.stringify({ sort: 'eta_asc', top: 3, tie_break: 'capacity' }, null, 2), input: '按 ETA 升序', output: '3 支队伍进入首选序列', ms: 700 },
    ],
    error: {
      errorCode: 'RESOURCE_INVENTORY_STALE',
      message: '仓库库存数据超过有效期（模拟环境）',
      hint: '到场顺序已按路网估算给出；装备数量需现场核实后确认。',
    },
    answer: [
      '到场顺序（按估算 ETA 升序）：',
      '',
      '1. 镇属应急排 · 12 分钟 · 28 人（装车耗时已计入）',
      '2. 区防汛机动队 · 26 分钟 · 36 人 · 抽水泵 4 台',
      '3. 临近街道支援组 · 41 分钟 · 22 人',
      '',
      '装备库存这一项数据已过有效期，数量未核准，建议现场核实后再下单调拨。',
    ].join('\n'),
  },
  {
    offsetMin: -29,
    prompt: '按上面的结论生成一份处置要点，给值班领导看',
    agent: '文书生成智能体',
    steps: [
      { name: '检索处置模板与先例', tool: 'search_knowledge', returns: ['hits=3 top_score=0.87', 'took_ms=142'].join('\n'), args: JSON.stringify({ query: '管涌 水位上涨 处置', top_k: 3, min_score: 0.62, index: 'rescue-kb-v3' }, null, 2), input: '知识库 · 管涌与水位上涨处置', output: '命中 3 份模板', ms: 880 },
      { name: '组装处置要点', tool: 'compose_response_points', returns: ['sections=4 points=11', 'tokens=642'].join('\n'), args: JSON.stringify({ sections: ['principle', 'measures', 'force', 'sla'], max_points: 12, style: 'brief' }, null, 2), input: '原则、措施、力量、时限', output: '4 节 11 条', ms: 1610 },
      { name: '生成文书草稿', tool: 'write_document', returns: ['documentId=doc-7c91', 'draft=1 status=pending_review'].join('\n'), args: JSON.stringify({ template: '处置要点', draft: 1, storage: 'files', review: 'required' }, null, 2), input: '处置要点（第 1 稿）', output: '已生成草稿，待审核', ms: 2340 },
    ],
    answer: [
      '处置要点（第 1 稿）已生成，共 4 节：',
      '',
      '一、处置原则：先控险、后处置，边监测边转移。',
      '二、现场措施：反滤围井、导渗沟、24 小时巡查。',
      '三、力量编成：镇属应急排为第一梯队，区机动队为第二梯队。',
      '四、时限要求：2 小时内完成围井，6 小时内完成首轮转移。',
      '',
      '草稿已存入「我的文件」，可在文书编辑器里继续修订。',
    ].join('\n'),
  },
  {
    offsetMin: -16,
    prompt: '复盘一下这次响应的效率',
    agent: '救援效果评估智能体',
    steps: [
      { name: '拉取响应时间线', tool: 'fetch_timeline', returns: ['nodes=4 span_min=47', 'gaps=none'].join('\n'), args: JSON.stringify({ nodes: ['report', 'assess', 'dispatch', 'arrive'], tz: 'Asia/Shanghai', interval: '1m' }, null, 2), input: '接报、研判、出动、到场', output: '4 个节点，跨度 47 分钟', ms: 960 },
      { name: '比对预案时限要求', tool: 'compare_plan_sla', returns: ['actual=36 sla=30', 'delta=+6 min verdict=over'].join('\n'), args: JSON.stringify({ plan: 'flood-response-v2', clause: '4.2', sla_min: 30 }, null, 2), input: '预案规定：接报后 30 分钟首发', output: '超时 6 分钟', ms: 840 },
      { name: '生成复盘结论', tool: 'build_review_report', returns: ['findings=3 words=412'].join('\n'), args: JSON.stringify({ inputs: ['timeline', 'plan_sla'], format: 'markdown', lang: 'zh-CN' }, null, 2), input: '时间线 + 预案条款', output: '3 条改进建议', ms: 1210 },
    ],
    answer: [
      '一、总体评价',
      '接报至首发力量出动用时 36 分钟，较预案要求超时 6 分钟；到场后处置动作顺序正确。',
      '',
      '二、主要问题',
      '1. 值班室核实环节重复问询；2. 装车清单未预置；3. 装备库存数据未及时更新。',
      '',
      '评估依据：模拟时间线与预案条款比对，结论仅用于演练复盘。',
    ].join('\n'),
  },
  {
    offsetMin: -4,
    prompt: '顺手把今天这些事整理进值班日报',
    agent: '文书生成智能体',
    steps: [
      { name: '汇总本日交互与产出', tool: 'collect_session_outputs', returns: ['items=5 artifacts=3 docs=1'].join('\n'), args: JSON.stringify({ session: 'conv-seed-dispatch', turns: 5, artifacts: 3, since: '2026-09-28T00:00:00+08:00' }, null, 2), input: '本会话 4 轮 · 3 份产物', output: '5 条值班事项', ms: 740 },
      { name: '套用值班日报模板', tool: 'apply_daily_template', returns: ['sections=3 filled=3', 'missing=2'].join('\n'), args: JSON.stringify({ template: '防汛值班日报', sections: ['水情', '险情', '力量', '文书', '待办'], fill: 'auto' }, null, 2), input: '防汛值班日报模板', output: '已填充 3 节', ms: 1330 },
    ],
    answer: '值班日报已按今日 5 条事项整理好（水情、险情、力量、文书、待办），草稿存在「我的文件」里，可继续补充交接班信息。',
  },
];

/** 演示时钟（模拟数据环境固定为 2026-09-28 21:10），mock 时间戳全部相对它展开。 */
const CLOCK = Date.parse('2026-09-28T21:10:00+08:00');

function at(offsetMin: number): string {
  return new Date(CLOCK + offsetMin * 60_000).toISOString();
}

export function seedMockTrajectory(sessionId: string, eventId: string): { messages: ChatMessage[]; tasks: AgentTask[] } {
  const messages: ChatMessage[] = [];
  const tasks: AgentTask[] = [];

  MOCK_TURNS.forEach((turn, index) => {
    const n = index + 1;
    const userMessageId = `${sessionId}-mock-m${n}-user`;
    const taskMessageId = `${sessionId}-mock-m${n}-task`;
    const taskId = `${sessionId}-mock-t${n}`;
    const startedAt = at(turn.offsetMin);

    messages.push({
      messageId: userMessageId,
      sessionId,
      role: 'user',
      kind: 'text',
      text: turn.prompt,
      taskId: null,
      createdAt: startedAt,
      performedAt: startedAt,
    });
    messages.push({
      messageId: taskMessageId,
      sessionId,
      role: 'assistant',
      kind: 'task',
      text: null,
      taskId,
      createdAt: startedAt,
      performedAt: startedAt,
    });

    const steps: TaskStep[] = turn.steps.map((step, si) => ({
      stepId: `${taskId}-s${si + 1}`,
      name: step.name,
      tool: step.tool,
      returns: step.returns ?? null,
      args: step.args,
      inputSummary: step.input ?? null,
      status: step.status ?? 'completed',
      outputSummary: step.output ?? null,
      sourceRefs: [],
      elapsedMs: step.ms,
      errorCode: step.errorCode ?? null,
    }));
    const finishAt = new Date(Date.parse(startedAt) + steps.reduce((sum, step) => sum + (step.elapsedMs ?? 0), 0) + steps.length * 15_000).toISOString();

    tasks.push({
      taskId,
      sessionId,
      eventId,
      userMessageId,
      attemptId: `${taskId}-a1`,
      attempt: 1,
      status: turn.status ?? 'succeeded',
      intent: 'mock-trajectory',
      displayTitle: turn.agent.replace(/智能体$/, '') + ' · ' + turn.prompt.slice(0, 14),
      steps,
      artifacts: [],
      textAnswer: turn.answer,
      error: turn.error ?? null,
      startedAt,
      finishedAt: finishAt,
      demoElapsedMs: steps.reduce((sum, step) => sum + (step.elapsedMs ?? 0), 0),
      seq: 9000 + n,
    });

    // 结论写在 task.textAnswer 上（任务卡自己渲染），不再另发一条文本消息，避免执行日志里同一句出现两次。
  });

  return { messages, tasks };
}
