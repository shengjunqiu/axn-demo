/** 建设目录来源：Vue 产品设计专属 Skill 清单、8.4.6.7 运行规范。
 * 这里只描述契约与规划；状态不代表真实 Function Calling 服务已接入。
 */
import type { AgentTask } from '@/domain/types';

export type SkillOwner = 'interaction' | 'document' | 'situation' | 'resource' | 'plan' | 'evaluation';
export interface SkillPlan {
  id: string;
  owner: SkillOwner;
  name: string;
  input: string;
  output: string;
  phase: '感知' | '决策' | '执行';
  status: '本地模拟' | '待建设';
  boundary: string;
}
export const SKILL_AGENTS: { id: SkillOwner; name: string; scene: string; role: string; gate: string }[] = [
  { id: 'situation', name: '态势感知智能体', scene: '灾情研判', role: '汇聚灾情证据、分析态势，形成可追溯的研判建议。', gate: '等级确认、报告签发与预警发布由有权业务岗位办理。' },
  { id: 'resource', name: '救援资源管理智能体', scene: '力量投送', role: '核对资源、形成编组建议，衔接投送与消耗记录。', gate: '编组、资源占用和路书下发须确认；候选不等于已派遣。' },
  { id: 'plan', name: '救援方案生成智能体', scene: '实施救援', role: '检索有效依据，草拟方案，核对安全条件与现场变化。', gate: '红线阻断不可跳过；方案签发与调控由指挥、技术、安全岗位确认。' },
  { id: 'evaluation', name: '救援效果评估智能体', scene: '实施救援', role: '对齐有效计划与实际，核验过程证据，形成改进建议。', gate: '缺少分母不计算完成率；总结审定与知识发布须人工审核。' },
  { id: 'interaction', name: '交互与呈现智能体', scene: '共用支撑', role: '关联事件与任务意图，组织对话、地图和协同结果。', gate: '消费统一权限和降级状态；不代替原业务岗位执行审批。' },
  { id: 'document', name: '文书生成智能体', scene: '共用支撑', role: '匹配模板、组织正文与明细，校核引用并导出材料。', gate: '草稿与正式签发分开；导出不代表审核或归档完成。' },
];
type Definition = [string, string, SkillPlan['phase'], string, string];
const definitions: Record<SkillOwner, Definition[]> = {
  situation: [
    ['collect', '多源数据汇聚', '感知', '舆情、气象、水文、地质、现场影像、接报记录与事件标识', '证据快照、来源与缺项'],
    ['extract', '要素抽取去重', '感知', '原始记录、对象标识与时间', '结构化要素、重复与冲突清单'],
    ['forecast', '时序推演', '决策', '同对象时序数据、模型与参数', '趋势候选、假设与适用范围'],
    ['graph', '图谱扩展召回', '决策', '事件要素、授权图谱与关联规则', '关联风险与证据链'],
    ['vision', 'CV识别', '感知', '现场影像、时间与位置', '识别候选、标注与人工复核项'],
    ['overlay', '内部资源叠加', '感知', '资源台账、状态时点与授权范围', '队伍、装备、安全区域与医院示意'],
    ['report', '报告模板', '决策', '已核事实、工程条件与材料模板', '态势报告草稿与待核项'],
    ['push', '推送路由', '执行', '已确认内容、责任人及审批凭据', '发送回执与失败原因'],
    ['level', '等级建议规则', '决策', '灾情证据、有效规则与版本', '建议等级、依据与确认点'],
  ],
  resource: [
    ['iot', '物联接入', '感知', '设备数据、采集时点与接口', '设备状态、来源与时效'],
    ['sync', '填报同步', '感知', '原系统填报、记录号与版本', '资源记录与同步冲突'],
    ['correct', '数据校正', '决策', '多源台账、授权与核验记录', '差异清单与校正建议'],
    ['ledger', '台账查询', '感知', '任务需求、事件与授权资源范围', '候选资源、来源字段与状态'],
    ['match', '模糊匹配', '决策', '自然语言需求、能力与约束', '候选匹配与排除理由'],
    ['group', '编组优化', '决策', '已核资源、需求数量与约束', '主备组合、缺口与保障建议'],
    ['route', '路径可达性', '决策', '起终点、车辆参数与动态路况', '路线候选、限载与人工核路项'],
    ['cross', '跨平台资源', '感知', '跨区域授权与平台接口', '授权资源与数据时间'],
    ['writeback', '消耗回写', '执行', '已审消耗凭证、对象版本与确认令牌', '回写回执、幂等结果与审计记录'],
  ],
  plan: [
    ['rag', '预案RAG', '决策', '灾种、工程条件与授权知识范围', '有效条款、版本与引用'],
    ['case', '案例检索', '感知', '任务特征、有效案例与适用条件', '参考案例与适用边界'],
    ['rules', '规则引擎', '决策', '已核条件、技术参数与规则版本', '规则命中、方案草稿与缺项'],
    ['redline', '红线拦截', '决策', '方案、安全条款与检测记录', '阻断项、依据与补证要求'],
    ['assess', '多维评估', '决策', '方案与安全、可行性、合规约束', '分维度结果与专业复核项'],
    ['version', '版本管理', '决策', '原方案、修改建议与基准版本', '差异、变更理由与版本关系'],
    ['link', '编成联动', '决策', '有效方案、资源编组与占用状态', '受影响任务与协调建议'],
    ['export', '方案导出', '执行', '用户核对的方案版本与引用', '可下载方案材料'],
    ['adjust', '动态修订', '决策', '现场变化、有效方案与资源状态', '调整建议与待审路径'],
  ],
  evaluation: [
    ['parse', '计划解析', '感知', '已签发计划、任务与批准变更', '任务目标、有效基线与口径'],
    ['aggregate', '执行数据聚合', '感知', '过程记录、消耗与到场凭证', '同任务同周期的实际记录'],
    ['deviation', '偏差检测', '决策', '同口径计划、实际与确认时点', '投入、进度与到场偏差'],
    ['metrics', '指标计算', '决策', '已核作业量、分母与指标规则', '指标、输入版本与计算依据'],
    ['complete', '资料完整度校验', '决策', '必备资料目录与凭证', '缺项、补证清单与审定阻断项'],
    ['cause', '因果推理', '决策', '可比差异、环境证据与专家意见', '原因候选、假设与待核证据'],
    ['extract', '知识抽取', '决策', '已审定总结与案例规则', '案例候选与适用条件'],
    ['publish', '知识库增量更新', '执行', '已审核案例、权限与确认令牌', '入库回执与知识版本'],
    ['iterate', '迭代任务触发', '执行', '已确认改进项与责任岗位', '迭代任务与办理回执'],
  ],
  interaction: [
    ['context', '事件上下文与意图路由', '感知', '用户问题、事件与会话上下文', '任务意图与负责智能体'],
    ['present', '对话与可视化呈现', '决策', '同事件的任务产物与来源', '结果卡、业务示意图与下一动作'],
    ['browser', '原系统读取与办理核验', '感知', '已授权页面、原字段与回执', '页面快照、字段映射与办理结果'],
  ],
  document: [
    ['template', '模板匹配', '感知', '文书类型、场景与模板版本', '章节、字段与明细结构'],
    ['compose', '正文与明细编排', '决策', '专业分析、事实与用户补充', '可编辑的文书草稿'],
    ['citation', '字段与来源校验', '决策', '材料版本、事实与引用映射', '缺失引用与待核清单'],
    ['export', '材料导出', '执行', '核对后的正文、明细与引用', '可下载材料'],
  ],
};
// 只标记现有 mock provider / 文书工作流中有对应演示的能力，绝不表示生产接入。
const localMocks = new Set(['situation.collect', 'situation.overlay', 'situation.report', 'resource.ledger', 'resource.match', 'plan.export', 'interaction.context', 'interaction.present', 'document.template', 'document.compose', 'document.citation', 'document.export']);
export const SKILL_PLANS: SkillPlan[] = SKILL_AGENTS.flatMap(agent => definitions[agent.id].map(([key, name, phase, input, output]) => ({
  id: `${agent.id}.${key}`, owner: agent.id, name, phase, input, output,
  status: localMocks.has(`${agent.id}.${key}`) ? '本地模拟' : '待建设',
  boundary: agent.gate,
})));

export const SKILL_GOVERNANCE = [
  { title: '统一调用契约', desc: '声明输入、输出、版本、权限、超时、错误与降级返回；数字、专名和坐标需能点回来源。', state: '待平台联调' },
  { title: '权限与人工确认', desc: '贯穿角色、日常/演训/应急场景与数据域。写操作核对确认令牌、对象版本和幂等键。', state: '待平台联调' },
  { title: '版本与热插拔', desc: '注册、契约测试、灰度、摘流与回滚；在途任务保留原版本，已签发材料不自动覆盖。', state: '待建设' },
  { title: '来源与 Trace 审计', desc: '回查输入版本、引用依据、人工处理和最终结果；当前原型仅展示本地任务步骤与来源。', state: '本地步骤可查看' },
  { title: '弱网与异常降级', desc: '会话中台统一下发可用能力；缓存显示数据时间，写操作暂停，恢复后鉴权并核对版本。', state: '待平台联调' },
];

/** 规划对照只选与任务相关的能力，不伪造逐 Skill 执行记录。 */
export function skillOwnerForTask(task: Pick<AgentTask, 'intent' | 'artifacts'>): SkillOwner | null {
  const scenario = task.artifacts.find(a => a.payload.kind === 'scenario_sections');
  if (scenario?.payload.kind === 'scenario_sections') {
    const owners: Record<string, SkillOwner> = { 'agent-situation': 'situation', 'agent-resource': 'resource', 'agent-plan': 'plan', 'agent-eval': 'evaluation', 'agent-doc': 'document' };
    if (owners[scenario.payload.agentId]) return owners[scenario.payload.agentId];
  }
  if (task.intent === 'summary') return 'situation';
  if (task.intent.startsWith('resource_') || task.intent.startsWith('candidate_')) return 'resource';
  if (task.intent === 'proposal') return 'plan';
  if (task.intent === 'evaluation') return 'evaluation';
  if (task.intent.startsWith('doc_') || task.intent.startsWith('fill_')) return 'document';
  return null;
}
