/**
 * 演示数据重置（收口）：把各 store 一起恢复到种子状态。
 *
 * 复用既有重置链路，不新增重置路径：
 * - sessionStore.resetAll() 内部已级联 documentStore.resetAll() + demoStore.reset()（审查 M-10 / FR-016）；
 * - 这里再补 conversationStore / workspaceStore —— 会话列表与工作台选择状态不在上述级联内。
 *
 * 调用方：设置弹窗的「演示数据」区、兜底错误页，以及 ResourcePanel / KnowledgePanel 的
 * “会话未初始化”提示（原先文案让用户去重置，但界面上没有入口）。
 */
import { useConversationStore } from './conversationStore';
import { useSessionStore } from './sessionStore';
import { useWorkspaceStore } from './workspaceStore';

export function resetDemoData(): void {
  window.localStorage.removeItem('anneng-demo:v1:original-materials');
  useSessionStore.getState().resetAll();
  useConversationStore.getState().resetAll();
  useWorkspaceStore.getState().resetAll();
}
