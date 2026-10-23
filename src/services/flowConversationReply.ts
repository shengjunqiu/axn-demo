import { disasterProfileById } from '@/seed/disasterScenarios';
import { tenderName } from '@/seed/tenderNames';
import { buildFlowSeedSnapshot, flowTabMode, type FlowTask } from './flowStageConfig';
import type { EventStage } from './agentFlow';

/** 与右侧流程使用同一份事件及阶段数据，避免只打开面板而没有对话答复。 */
export function flowConversationReply(task: FlowTask, eventId: string, eventName: string, stage: EventStage): string {
  const mode = flowTabMode(stage, task);
  if (mode === 'future') return `当前事件处于“${stage}”，尚未进入${tenderName(task)}环节。我已打开对应内容供您查看，完成前置阶段后再继续操作。`;
  const seed = buildFlowSeedSnapshot(eventId, disasterProfileById.get(eventId), eventName);
  const replies: Partial<Record<FlowTask, string>> = {
    规划梯队投送: `已经按照“${eventName}”的事件位置、道路条件和投送需求，为您规划好路线${mode === 'past' ? '回放' : '草案'}（模拟）。\n\n道路条件：${seed.road}\n建议路线：${seed.route}\n协调负责人：${seed.owner}\n\n建议按“基地出发 → 通行检查点 → 前方集结点 → 现场到达”组织投送，出动前核实道路通行、车辆条件和现场接应。右侧可查看路线图、节点进度及导出计划；以上为本事件的模拟投送方案。`,
    资源维护与导出: '已打开资源数据更新清单。请补充需要核对的资源名称、数量和状态，逐项核实后再更新；当前为本地模拟，不会自动回写正式台账。',
    方案修订对比: '已打开方案修订对比。请补充现场发生了哪些变化，我会据此核对受影响的部署、安全条件和方案章节，并展示版本差异。',
    编组确认: '已打开人装编组清单。请核对车辆、人员、操作手和负责人，再确认本次编组。',
    回撤归建: '已打开撤收归建清单，请逐项核对人员归队、装备回收、物资消耗和遗留任务。',
    复盘评估分析: '已打开本事件的复盘评估结果，可对照救援目标、实际投入和处置成效，继续梳理问题与改进建议。',
    知识沉淀入库: '已整理本事件的经验候选，请在右侧核对内容及依据，再提交审核；审核前不作为正式知识发布。',
    资料核验与总结: '已打开总结资料核验，请先核对过程记录、完成量与消耗凭证，缺少的材料会保留为待补项。',
    现场智能勘察: '已打开本事件的现场勘察资料，可核对影像、监测记录和风险线索，再补充专业复核意见。',
    资源预警通知: '已打开资源协调通知，请核对需要协调的问题、接收责任人和通知内容，再确认发送。',
  };
  return replies[task] ?? `已打开“${tenderName(task)}”，可结合“${eventName}”的资料继续核对并补充要求。`;
}
