/** 与智能体能力页一致的快捷入口；同一文书智能体提供常用文书任务。 */
export const AGENT_QUICK_TASKS = [
  { agentId: 'agent-situation', agentName: '态势感知智能体', label: '生成灾情摘要' },
  { agentId: 'agent-resource', agentName: '资源管理智能体', label: '查询周边救援资源' },
  { agentId: 'agent-plan', agentName: '救援方案生成智能体', label: '生成救援方案' },
  { agentId: 'agent-doc', agentName: '文书生成智能体', label: '生成应急要情' },
  { agentId: 'agent-doc', agentName: '文书生成智能体', label: '生成值班日报' },
  { agentId: 'agent-doc', agentName: '文书生成智能体', label: '生成工作总结' },
  { agentId: 'agent-eval', agentName: '效果评估智能体', label: '评估救援效果' },
] as const;
