/**
 * 右侧文书工作区（参考图 DB2 的窄对话 + 宽敞阅读面板）：
 * 工具条提供 关闭文书（回到宽对话）与 文书库（独立页面）两个明确操作，内容复用 DocCenterPanel view='workspace'。
 * 关闭只改 UI 可见性：不清空会话/文书数据，也不重新触发生成。
 * 全部数据为模拟数据。
 */
import { useCallback, useEffect } from 'react';
import { App as AntdApp } from 'antd';
import { useConversationStore } from '@/store/conversationStore';
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
      // 关闭只收起工作区，不会回滚工作副本（回滚只发生在编辑器自己的「放弃修改并关闭」）。
      content: '关闭后修改会保留在本次会话（尚未保存），可再次打开继续编辑。',
      okText: '关闭并保留修改',
      cancelText: '继续编辑',
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
      content: '前往文书库不会丢弃修改，改动保留在本次会话（尚未保存）。',
      okText: '继续前往',
      cancelText: '继续编辑',
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

