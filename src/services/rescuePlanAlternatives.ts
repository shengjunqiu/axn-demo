import type { ChatMessage } from '@/domain/types';
import { EMPTY_LIBRARY } from '@/store/mockDocumentStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { tacticOptions, type TacticOption } from './customerDocuments';
import { resolveDocumentSections } from '@/seed/resolveDocumentSections';
import { eventDisplayName } from './factLookup';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useSessionStore } from '@/store/sessionStore';

export function rescuePlanAlternatives(eventId: string) {
  const professional = tacticOptions(eventId);
  const options: TacticOption[] = professional.length >= 2 ? [professional[0], professional[1], {
    ...professional[0], name: '综合协同处置', tactic: `${professional[0].tactic}与${professional[1].tactic}协同实施`,
    organization: `先核实现场条件、人员安全和作业许可，再按任务依赖衔接两项战法。\n${professional[0].organization}\n${professional[1].organization}`,
    applicability: `${professional[0].applicability}；${professional[1].applicability}`,
    tradeoff: '统筹两项专业任务，明确先后顺序与协同接口；资源冲突和作业条件需经负责人核实。',
  }] : ['分区稳妥处置', '多点协同处置', '分阶段增援处置'].map((name, index) => ({
    name, tactic: name,
    organization: ['先开展侦测与风险核查，再逐区组织人员转移和救援。', '核实各作业点安全条件后，分组并行处置，统一协调通信与保障。', '先遣力量完成侦测和先期处置，根据现场进展与资源缺口分阶段增援。'][index],
    applicability: '现场条件、安全作业范围与专业授权须核实。', resources: '以当前事件可用资源为准，数量、状态与到位时间须确认。',
    risk: '持续监测次生风险，明确撤离条件与人员安全责任。', basis: '当前事件资料；专业预案待补充核实。', tradeoff: '组织方式参考，具体专业战法须结合事件预案审定。',
  }));
  return options.map(option => ({
    code: 'RESCUE_PLAN' as const,
    title: `${eventDisplayName(eventId)} · ${option.name}行动方案`,
    sections: resolveDocumentSections(eventId, 'RESCUE_PLAN').map(([heading, body]): [string, string] => {
      const text = body.replaceAll('待原系统锁定', '待负责人确认').replaceAll('审签沿用原处置方案模块', '本稿导出后由用户按现行业务办理');
      return [heading, heading === '四、救援行动安排' ? `${text}\n\n所选方向与实施安排\n方案：${option.name}\n战法：${option.tactic}\n实施步骤：${option.organization}\n适用条件：${option.applicability}\n必要资源：${option.resources}\n风险与限制：${option.risk}\n方案特点：${option.tradeoff}\n预案依据：${option.basis}\n成本与到位时间：尚未测算；本方案为本地原型草稿，执行前需专业审定。` : text];
    }),
  }));
}

export function generateRescuePlanAlternatives(sessionId: string, eventId: string) {
  const now = new Date();
  const plans = rescuePlanAlternatives(eventId).map(input => ({
    documentId: `candidate-${crypto.randomUUID()}`, title: input.title, sections: input.sections,
    date: now.toLocaleDateString('zh-CN'), number: '候选草稿 · 待审定',
  }));
  if (plans.length !== 3) return;
  const sessions = useSessionStore.getState();
  sessions.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text: '生成救援方案', taskId: null });
  sessions.appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', text: '已整理三种处置方向。先比较适用条件、资源与风险，选择后再生成工程救援处置方案草稿。', rescuePlans: plans, taskId: null });
}

export function openRescuePlan(sessionId: string, plan: NonNullable<ChatMessage['rescuePlans']>[number]) {
  const documents = useMockDocumentStore.getState();
  if (!documents.libraries[sessionId]?.documents.some(doc => doc.id === plan.documentId)) {
    useMockDocumentStore.setState(state => ({ libraries: {
      ...state.libraries,
      [sessionId]: { ...(state.libraries[sessionId] ?? EMPTY_LIBRARY), documents: [
        ...(state.libraries[sessionId]?.documents ?? EMPTY_LIBRARY.documents),
        { id: plan.documentId, code: 'RESCUE_PLAN', title: plan.title, sections: plan.sections, date: plan.date, number: plan.number },
      ] },
    } }));
  }
  useWorkspaceStore.getState().select(sessionId, { kind: 'mock', id: plan.documentId });
}
