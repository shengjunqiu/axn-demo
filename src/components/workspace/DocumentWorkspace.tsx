/**
 * 右侧文书工作区（参考图 DB2 的窄对话 + 宽敞阅读面板）：
 * 工具条提供 关闭文书（回到宽对话）与 文书库（独立页面）两个明确操作，内容复用 DocCenterPanel view='workspace'。
 * 关闭只改 UI 可见性：不清空会话/文书数据，也不重新触发生成。
 * 全部数据为模拟数据。
 */
import { useCallback, useEffect, useRef } from 'react';
import { App as AntdApp } from 'antd';
import { useConversationStore } from '@/store/conversationStore';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useSessionStore } from '@/store/sessionStore';
import { useActiveScope, useWorkspaceStore } from '@/store/workspaceStore';
import DocCenterPanel from './DocCenterPanel';
import '../doc/doc.css';

export default function DocumentWorkspace() {
  const scope = useActiveScope();
  const close = useWorkspaceStore((s) => s.close);
  const { modal } = AntdApp.useApp();

  /** 关闭文书：不带 token → 抑制最近一次自动打开标记，同一完成不再弹出。 */
  const requestClose = useCallback(() => {
    if (!useWorkspaceStore.getState().isDirty(scope)) {
      close(scope);
      return;
    }
    modal.confirm({
      title: '有未保存的文书修改',
      content: '关闭后这些修改将丢失。',
      okText: '放弃修改并关闭',
      cancelText: '继续编辑',
      okButtonProps: { danger: true },
      onOk: () => {
        useWorkspaceStore.getState().setDirty(scope, false);
        close(scope);
      },
    });
  }, [close, modal, scope]);

  useEffect(() => {
    window.addEventListener('axn:close-document', requestClose);
    return () => window.removeEventListener('axn:close-document', requestClose);
  }, [requestClose]);

  const openLibrary = useCallback(() => {
    if (!useWorkspaceStore.getState().isDirty(scope)) {
      useConversationStore.getState().setActiveNav('library');
      return;
    }
    modal.confirm({
      title: '有未保存的文书修改',
      content: '前往文书库前将放弃这些修改。',
      okText: '放弃修改并前往',
      cancelText: '继续编辑',
      okButtonProps: { danger: true },
      onOk: () => {
        useWorkspaceStore.getState().setDirty(scope, false);
        close(scope);
        useConversationStore.getState().setActiveNav('library');
      },
    });
  }, [close, modal, scope]);

  return (
    <div className="doc-workspace" data-testid="document-workspace-shell">
      <div className="doc-workspace-body">
        <DocCenterPanel view="workspace" onClose={requestClose} onOpenLibrary={openLibrary} />
      </div>
    </div>
  );
}

/** 常驻观察所有会话的产物迁移；可见视图仍只读取当前会话作用域。 */
export function WorkspaceSync() {
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
        const token = `run:${task.taskId}:${task.attemptId}`;
        const artifact = task.artifacts.find((a) => a.payload.kind === 'document' && a.payload.state === 'draft_created');
        const documentId = artifact?.payload.kind === 'document' ? artifact.payload.documentId : null;
        const pending = ['queued', 'running', 'waiting_input'].includes(task.status);
        const signature = `${token}:${pending ? 'pending' : documentId ?? task.status}`;
        if (observed.current.get(`task:${scope}`) !== signature) {
          observed.current.set(`task:${scope}`, signature);
          if (pending) workspace.autoOpen(scope, token, { kind: 'generating' });
          else if (documentId) workspace.autoOpen(scope, token, { kind: 'draft', id: documentId });
          else workspace.finish(scope, token);
        }
      }

      const message = session.messages.filter((m) => m.documentWorkflow).at(-1);
      const workflow = message?.documentWorkflow;
      if (message && workflow) {
        const token = `workflow:${message.messageId}`;
        const signature = `${token}:${workflow.stage}:${workflow.documentId ?? ''}`;
        if (observed.current.get(`workflow:${scope}`) !== signature) {
          observed.current.set(`workflow:${scope}`, signature);
          if (['collecting', 'calling', 'generating', 'waiting_input'].includes(workflow.stage)) {
            workspace.autoOpen(scope, token, { kind: 'generating' });
          } else if (workflow.stage === 'completed' && workflow.documentId && libraries[scope]?.documents.some((d) => d.id === workflow.documentId)) {
            workspace.autoOpen(scope, token, { kind: 'mock', id: workflow.documentId });
          } else workspace.finish(scope, token);
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

  return null;
}
