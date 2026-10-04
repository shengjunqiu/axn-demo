import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { App } from 'antd';
import { NAV_PATH } from '@/components/nav/navRoutes';
import { useActiveScope, useWorkspaceStore, type WorkspaceSelection } from '@/store/workspaceStore';

/** 文书库与聊天产物共用的打开动作，保护当前未保存的工作副本。 */
export function useDocumentNavigation() {
  const scope = useActiveScope();
  const { modal } = App.useApp();
  const navigate = useNavigate();
  return useCallback((targetScope: string, selection: WorkspaceSelection) => {
    const workspace = useWorkspaceStore.getState();
    const current = workspace.selectionOf(scope);
    if (targetScope === scope && current?.kind === selection.kind && current.id === selection.id) {
      navigate(NAV_PATH.assistant);
      return;
    }
    const open = () => {
      workspace.select(targetScope, selection);
      navigate(NAV_PATH.assistant);
    };
    if (!workspace.isDirty(scope)) { open(); return; }
    modal.confirm({
      title: '有未保存的文书修改',
      // 该动作只解除当前作用域的编辑状态，工作副本留在 store 里，不会丢弃改动。
      content: '当前修改会保留在本次会话（尚未保存），可随时回来继续编辑。',
      okText: '打开并保留修改',
      cancelText: '继续编辑',
      onOk: () => { workspace.setDirty(scope, false); workspace.close(scope); open(); },
    });
  }, [modal, navigate, scope]);
}
