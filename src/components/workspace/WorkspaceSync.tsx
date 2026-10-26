import { V2_AI_DOCUMENT_CODES } from '@/pages/v2/aiNodes';
import { constructionToMockSections } from '@/services/agentMaterialDocument';
import { EMPTY_LIBRARY } from '@/store/mockDocumentStore';
import { AGENT_MATERIAL_CODES, DOCUMENT_CATEGORIES } from '@/seed/mockDocuments';
import type { ConstructionCapability } from '@/seed/constructionScenarios';
import { resolveConstructionCapability } from '@/seed/constructionScenarios';
import { needsResultDocument } from '@/services/resultPresentation';
import { useEffect, useRef } from 'react';
import { ensureWorkSummaryDocument } from '@/services/workSummaryWorkflow';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useSessionStore } from '@/store/sessionStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import DocumentReviewSync from '@/components/doc/DocumentReviewSync';

/**
 * 常驻观察所有会话的产物迁移；可见视图仍只读取当前会话作用域。
 * 从 DocumentWorkspace.tsx 抽出以支持懒加载该文件的主体组件。
 */
export default function WorkspaceSync() {
  const tasks = useSessionStore((s) => s.tasks);
  const sessions = useSessionStore((s) => s.sessions);
  const libraries = useMockDocumentStore((s) => s.libraries);
  const observed = useRef(new Map<string, string>());
  const mockJobs = useRef(new Map<string, { code: string | null; token: string }>());
  const serial = useRef(0);

  useEffect(() => {
    const workspace = useWorkspaceStore.getState();
    // 每个会话只处理最新文书任务；步骤更新不会覆盖用户手动打开的文书。
    for (const session of Object.values(sessions)) {
      const scope = session.sessionId;
      const task = Object.values(tasks)
        .filter((t) => t.sessionId === scope && t.eventId === session.eventId && ['doc_brief', 'doc_daily'].includes(t.intent))
        .sort((a, b) => b.seq - a.seq)[0];
      if (task) {
        const base = `run:${task.taskId}:${task.attemptId}`;
        const artifact = task.artifacts.find((a) => a.payload.kind === 'document' && a.payload.state === 'draft_created');
        const documentId = artifact?.payload.kind === 'document' ? artifact.payload.documentId : null;
        const pending = ['queued', 'running', 'waiting_input'].includes(task.status);
        // 生成中与完成后使用不同 token：关闭「生成中」不应抑制完成后的自动打开。
        const token = pending ? `${base}:pending` : `${base}:done:${documentId ?? task.status}`;
        const signature = token;
        if (observed.current.get(`task:${scope}`) !== signature) {
          observed.current.set(`task:${scope}`, signature);
          if (pending) workspace.autoOpen(scope, token, { kind: 'generating' });
          else if (documentId) workspace.autoOpen(scope, token, { kind: 'draft', id: documentId });
          else workspace.finish(scope, `${base}:pending`);
        }
      }

      // 四智能体材料/方案：scenario_sections 物化为 mock 红头文书后自动打开右侧工作区。
      // 优先跟踪「仍在跑」的任务；若无，则跟踪最近一份已物化文书的任务（避免被后续无文书任务抢走）。
      const agentTasks = Object.values(tasks)
        .filter((t) => t.sessionId === scope && t.eventId === session.eventId
          && t.displayTitle !== '多源数据汇聚'
          && t.displayTitle !== '汇总灾情摘要'
          && needsResultDocument(
            t.artifacts.find(a => a.payload.kind === 'scenario_sections')?.payload.kind === 'scenario_sections'
              ? (t.artifacts.find(a => a.payload.kind === 'scenario_sections')!.payload as { capability: string }).capability
              : resolveConstructionCapability(t.intent, session.messages.find(m => m.messageId === t.userMessageId)?.text ?? '') ?? '',
          )
          && ['summary', 'proposal', 'evaluation', 'resource_query'].includes(t.intent))
        .sort((a, b) => b.seq - a.seq);
      const runningAgent = agentTasks.find((t) => ['queued', 'running', 'waiting_input'].includes(t.status));
      const materialAgent = agentTasks.find((t) =>
        t.artifacts.some((a) => a.payload.kind === 'scenario_sections' && a.payload.documentId));
      const agentTask = runningAgent ?? materialAgent;
      if (agentTask) {
        const base = `agent-material:${agentTask.taskId}:${agentTask.attemptId}`;
        const scenario = agentTask.artifacts.find((a) => a.payload.kind === 'scenario_sections');
        const mockId = scenario?.payload.kind === 'scenario_sections' ? scenario.payload.documentId ?? null : null;
        // 所有智能体产物均可恢复：任务落盘而mock库仅驻内存，不能只恢复勘察/编组。
        if (scenario?.payload.kind === 'scenario_sections' && mockId
          && !useMockDocumentStore.getState().libraries[scope]?.documents.some(d => d.id === mockId)) {
          const payload = scenario.payload;
          const capability = payload.capability as ConstructionCapability;
          const code = AGENT_MATERIAL_CODES[capability];
          const category = DOCUMENT_CATEGORIES.find(item => item.code === code);
          const now = new Date();
          if (category && payload.sections.length) {
          const restored = {
            id: mockId, code, title: `${payload.title}（模拟）`,
            date: now.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric' }),
            number: `${category.prefix}〔${now.getFullYear()}〕模拟草稿`,
            sections: constructionToMockSections({ ...payload, capability }),
          };
          useMockDocumentStore.setState(state => ({ libraries: { ...state.libraries, [scope]: {
            ...(state.libraries[scope] ?? EMPTY_LIBRARY),
            documents: [restored, ...(state.libraries[scope] ?? EMPTY_LIBRARY).documents],
          } } }));
          }
        }
        const pending = ['queued', 'running', 'waiting_input'].includes(agentTask.status);
        const hasDoc = !!mockId && !!useMockDocumentStore.getState().libraries[scope]?.documents.some((d) => d.id === mockId);
        // 文书一旦写入库即用 done token 打开正文；勿在「仍 running 但已有 documentId」时停留在生成中壳层。
        const token = hasDoc && mockId
          ? `${base}:done:${mockId}`
          : pending
            ? `${base}:pending`
            : `${base}:wait:${mockId ?? agentTask.status}`;
        const signature = token;
        if (observed.current.get(`agent:${scope}`) !== signature) {
          observed.current.set(`agent:${scope}`, signature);
          if (hasDoc && mockId) workspace.autoOpen(scope, token, { kind: 'mock', id: mockId });
          else if (pending) workspace.autoOpen(scope, token, { kind: 'generating' });
          else workspace.finish(scope, `${base}:pending`);
        }
      }

      const message = session.messages.filter((m) => m.documentWorkflow).at(-1);
      const workflow = message?.documentWorkflow;
      const newerPlanReply = session.messages.some((item, index) => item.rescuePlans && index > session.messages.findIndex(item => item.messageId === message?.messageId));
      if (message && workflow && workflow.presentation !== 'inline' && !(workflow.stage === 'completed' && newerPlanReply)) {
        let documentId = workflow.documentId;
        if (workflow.stage === 'completed' && workflow.reportSections?.length) {
          const libDocs = useMockDocumentStore.getState().libraries[scope]?.documents ?? [];
          const missing = !documentId || !libDocs.some((d) => d.id === documentId);
          if (missing) {
            const restored = ensureWorkSummaryDocument(scope, workflow, message.messageId);
            documentId = restored?.id ?? documentId;
          }
        }
        const base = `workflow:${message.messageId}`;
        const inProgress = ['collecting', 'calling', 'generating', 'waiting_input'].includes(workflow.stage);
        const libHas = !!documentId && (
          libraries[scope]?.documents.some((d) => d.id === documentId)
          || !!useMockDocumentStore.getState().libraries[scope]?.documents.some((d) => d.id === documentId)
        );
        const token = inProgress
          ? `${base}:pending:${workflow.stage}`
          : workflow.stage === 'completed' && documentId
            ? `${base}:done:${documentId}`
            : `${base}:${workflow.stage}`;
        const signature = token;
        if (observed.current.get(`workflow:${scope}`) !== signature) {
          observed.current.set(`workflow:${scope}`, signature);
          if (inProgress) {
            // 周边资源报告在对话中展示整理/调用/编排步骤，完成后才打开正文。
            // 手机窄视口中提前打开工作区会把智能体进度卡整个隐藏。
            if (!['救援资源管理智能体', '救援方案生成智能体', '态势感知智能体', '救援效果评估智能体'].includes(message.agentName ?? '') || !V2_AI_DOCUMENT_CODES.includes(workflow.documentCode ?? '')) {
              workspace.autoOpen(scope, token, { kind: 'generating' });
            }
          } else if (workflow.stage === 'completed' && documentId && libHas) {
            workspace.autoOpen(scope, token, { kind: 'mock', id: documentId });
          } else {
            for (const stage of ['collecting', 'calling', 'generating', 'waiting_input'] as const) {
              workspace.finish(scope, `${base}:pending:${stage}`);
            }
          }
        }
      }
    }

    // 文书库分类直接生成没有聊天 workflow。为每次生成保留同一个作业标记，
    // 即使切到别的会话，完成后也仅更新原会话；关闭该作业后不会在完成时再次弹出。
    for (const [scope, library] of Object.entries(libraries)) {
      const workflow = sessions[scope]?.messages.filter((m) => m.documentWorkflow).at(-1)?.documentWorkflow;
      if (workflow && ['collecting', 'calling', 'generating', 'waiting_input'].includes(workflow.stage)) continue;
      const previous = mockJobs.current.get(scope);
      if (library.generatingCode) {
        if (!previous?.code) {
          const token = `library:${scope}:${++serial.current}`;
          mockJobs.current.set(scope, { code: library.generatingCode, token });
          workspace.autoOpen(scope, token, { kind: 'generating' });
        }
      } else if (previous?.code) {
        mockJobs.current.set(scope, { ...previous, code: null });
        if (library.selected) workspace.autoOpen(scope, previous.token, { kind: 'mock', id: library.selected.id });
        else workspace.finish(scope, previous.token);
      }
    }
  }, [tasks, sessions, libraries]);

  return <DocumentReviewSync />;
}
