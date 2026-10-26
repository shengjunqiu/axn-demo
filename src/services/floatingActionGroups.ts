import { tenderName } from '@/seed/tenderNames';
import type { EventStage } from './agentFlow';
import { stageChoices, type StageChoice, type StageChoiceGroup } from './stageConversation';
import { CONVERSATION_ONLY_ACTIONS } from '@/seed/agentQuickTasks';
import { conversationRequest } from '@/seed/conversationRequests';

const STAGES: { stage: EventStage; label: string; actions: string[] }[] = [
  { stage: '待研判', label: '灾情研判', actions: ['生成灾情摘要', '核对道路天气'] },
  { stage: '力量投送中', label: '力量投送', actions: ['生成周边资源报告', '核对资源状态', '物资核验', '资源预警通知', '资源数据与预警'] },
  { stage: '救援中', label: '现场救援', actions: ['预案条款对照'] },
  { stage: '待复盘', label: '撤收与复盘', actions: ['回撤归建', '七环节救援时间轴', '评估救援效果', '救援复盘与知识'] },
  { stage: '已归档', label: '归档与经验沉淀', actions: ['知识沉淀入库', '正式知识库审核发布', '正式知识检索'] },
];

/** 按事件发展顺序组织提问、操作和材料，当前阶段仅作标记，不改变顺序。 */
export function floatingActionGroups(stage: EventStage | null): StageChoiceGroup[] {
  const seen = new Set<string>();
  const unique = (options: StageChoice[]) => options.filter(option => {
    if (seen.has(option.id)) return false;
    seen.add(option.id);
    return true;
  });
  const quick = (labels: string[]): StageChoice[] => labels.filter(label => CONVERSATION_ONLY_ACTIONS.includes(label)).map(label => ({
    id: `legacy-quick:${label}`, kind: 'question', label: conversationRequest(label), prompt: conversationRequest(label),
  }));
  const groups: StageChoiceGroup[] = [{ label: '了解区域灾情', options: [{ id: 'regional-disasters', kind: 'question', label: '帮我看看我负责的区域目前有哪些灾情？', prompt: '帮我看看我负责的区域目前有哪些灾情？' }] }];
  for (const item of STAGES) {
    const choices = stageChoices(item.stage);
    const questions = choices[0].options.filter(option => option.id !== 'fuzzy-resource-search' || item.stage === '力量投送中');
    groups.push({ label: `${item.label}${stage === item.stage ? ' · 当前阶段' : ''}`, options: unique([...questions, ...quick(item.actions), ...choices[1].options]) });
  }
  // 未分配的新辅助操作保留在末尾，避免配置扩展时入口丢失。
  const remaining = unique(quick(CONVERSATION_ONLY_ACTIONS));
  if (remaining.length) groups.push({ label: '其他辅助操作', options: remaining });
  groups.push({ ...stageChoices(stage ?? '待研判')[2], options: unique(stageChoices(stage ?? '待研判')[2].options) });
  return groups.filter(group => group.options.length);
}

/** 展示备注使用业务功能名称，不暴露内部能力键。 */
export function stageChoiceFeature(option: StageChoice): string {
  if (option.id === 'regional-disasters') return '多源数据汇聚 · 区域灾情查询';
  if (option.id.startsWith('legacy-quick:')) {
    const action = option.id.slice('legacy-quick:'.length);
    return ({ 核对道路天气: '投送路径优化 · 天气与沿途道路提醒', 预案条款对照: '复盘评估分析 · 预案执行对照', 救援复盘与知识: '复盘评估分析与知识沉淀', 核对资源状态: '资源管理 · 可出动状态核对' } as Record<string, string>)[action] ?? tenderName(action);
  }
  const specific: Record<string, string> = {
    risks: '态势研判预警 · 现场风险分析', facts: '灾情摘要 · 现场情况整理',
    verification: '多源数据汇聚 · 告警与现场信息核对', evidence: '六源汇聚与质量核对 · 缺项梳理',
    nearby: '资源智能检索 · 周边资源核查', protection: '态势研判预警 · 防护目标与保障需求',
    gap: '资源建议 · 需求与资源缺口分析', availability: '资源管理 · 数量与可用状态核对',
    route: '投送路径优化 · 出动条件核查', access: '投送路径优化 · 道路通行核查',
    positions: '智能编组推荐 · 专业岗位配置', group: '智能编组推荐',
    changes: '过程动态调控 · 方案调整', safety: '过程动态调控 · 安全条件核查',
    coordination: '现场处置行动方案 · 协同安排', support: '现场处置行动方案 · 综合保障',
    bulletin: '阶段要情生成', progress: '阶段要情 · 进展与验收口径',
    summary: '生成总结报告 · 过程资料汇总', review: '复盘评估分析 · 总结查漏', full: '生成总结报告 · 全面总结',
    proof: '复盘评估分析 · 验收与消耗核对', improvement: '复盘评估分析 · 问题改进清单', traceability: '复盘评估分析 · 来源追溯',
    archive: '数据及知识沉淀 · 归档补充', supplement: '数据及知识沉淀 · 漏档补充', scope: '数据及知识沉淀 · 适用范围',
    trace: '数据及知识沉淀 · 归档依据核对', experience: '数据及知识沉淀 · 实战经验提取', limits: '数据及知识沉淀 · 案例候选整理',
    'fuzzy-resource-search': '资源智能检索 · 装备能力模糊查询',
  };
  if (specific[option.id]) return specific[option.id];
  if (option.kind === 'file') return ({ scene: '多源数据汇聚 · 现场材料采集', advice: '现场处置行动方案 · 建议材料', needs: '智能编组推荐 · 力量需求', roster: '智能编组推荐 · 人员装备清单', delivery: '投送路径优化 · 投送建议', feedback: '过程动态调控 · 现场反馈', bulletin: '阶段要情 · 进展材料', summary: '生成总结报告 · 总结材料', process: '复盘评估分析 · 过程记录', acceptance: '复盘评估分析 · 验收材料', archive: '数据及知识沉淀 · 归档材料', experience: '数据及知识沉淀 · 经验材料', unclear: '材料用途确认', missing: '材料关联事件核对', wrongEvent: '材料关联事件核对' } as Record<string, string>)[option.type ?? ''] ?? '材料采集与核对';
  return '业务问答与辅助分析';
}
