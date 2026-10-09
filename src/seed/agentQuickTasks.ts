/**
 * 底部快捷任务：对齐 Vue BlankChatShortcuts + 建设四智能体能力入口。
 * 点击后走本项目 AgentSummonCard + TaskCard 展示链路，内容来自 constructionScenarios。
 */
export const AGENT_QUICK_TASKS = [
  { agentId: 'agent-situation', agentName: '态势感知智能体', label: '生成灾情摘要' },
  { agentId: 'agent-situation', agentName: '态势感知智能体', label: '生成态势报告' },
  { agentId: 'agent-situation', agentName: '态势感知智能体', label: '态势研判预警' },
  { agentId: 'agent-situation', agentName: '态势感知智能体', label: '核对道路天气' },
  { agentId: 'agent-resource', agentName: '救援资源管理智能体', label: '查询周边救援资源' },
  { agentId: 'agent-resource', agentName: '救援资源管理智能体', label: '生成周边资源报告' },
  { agentId: 'agent-resource', agentName: '救援资源管理智能体', label: '核对资源状态' },
  { agentId: 'agent-plan', agentName: '救援方案生成智能体', label: '生成救援方案' },
  { agentId: 'agent-doc', agentName: '文书生成智能体', label: '生成应急要情' },
  { agentId: 'agent-doc', agentName: '文书生成智能体', label: '生成会议纪要' },
  { agentId: 'agent-doc', agentName: '文书生成智能体', label: '生成工作总结' },
  { agentId: 'agent-doc', agentName: '文书生成智能体', label: '生成全面总结' },
  { agentId: 'agent-eval', agentName: '救援效果评估智能体', label: '评估救援效果' },
] as const;
