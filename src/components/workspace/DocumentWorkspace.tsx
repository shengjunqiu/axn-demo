import { openInlineSituation } from '@/services/inlineSituation';
import CustomerOperationsPanel from '@/components/chat/CustomerOperationsPanel';
/**
 * 右侧工作区：与对话分栏内嵌，承载——
 * 1) 公文（模拟文书 / 真实草稿）
 * 2) 业务流程补充
 * 3) 资源与态势（不再用抽屉盖住对话）
 * 关闭只改 UI 可见性：不清空会话数据，也不重新触发生成。
 */
import { useCallback, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Alert, App as AntdApp, Button } from 'antd';
import { NAV_PATH } from '@/components/nav/navRoutes';
import OperationalFlows from '@/components/chat/OperationalFlows';
import type { FlowTask } from '@/services/flowStageConfig';
import { eventDisplayName } from '@/services/factLookup';
import { resolveEventStage } from '@/services/eventSwitchBriefing';
import { SHOW_RESOURCE_DATA_ALERT } from '@/seed/prototypeVisibility';
import { useConversationStore } from '@/store/conversationStore';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { useActiveScope, useWorkspaceStore } from '@/store/workspaceStore';
import DocCenterPanel from './DocCenterPanel';
import ResourcePanel from './ResourcePanel';
import '../doc/doc.css';
import '@/components/chat/chat.css';

export default function DocumentWorkspace() {
  const scope = useActiveScope();
  const selection = useWorkspaceStore((s) => s.selectionOf(scope));
  const close = useWorkspaceStore((s) => s.close);
  const navigate = useNavigate();
  const { modal } = AntdApp.useApp();
  const eventId = useDemoStore((s) => s.currentEventId);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const session = useSessionStore((s) =>
    s.sessions[s.sessionByConversation[activeConversationId ?? ''] ?? ''],
  );
  const eventStage = resolveEventStage(eventId, session);
  const inlineFlow = selection?.kind === 'flow' && (selection.id === '预警推送' || selection.id === '态势研判预警') ? selection.id : null;
  useEffect(() => {
    if (!inlineFlow || !session) return;
    const current = useWorkspaceStore.getState().selectionOf(scope);
    if (current?.kind !== 'flow' || current.id !== inlineFlow || !useWorkspaceStore.getState().isOpen(scope)) return;
    openInlineSituation(session.sessionId, inlineFlow);
    close(scope);
  }, [inlineFlow, session, scope, close]);


  /** 关闭工作区：不带 token → 抑制最近一次自动打开标记。 */
  const requestClose = useCallback(() => {
    if (!useWorkspaceStore.getState().isDirty(scope)) {
      close(scope);
      return;
    }
    modal.confirm({
      title: '有未保存的文书修改',
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
      navigate(NAV_PATH.library);
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
        navigate(NAV_PATH.library);
      },
    });
  }, [close, modal, navigate, scope]);

  const runFlowTask = useCallback((text: string) => {
    close(scope);
    window.dispatchEvent(new CustomEvent('axn:flow-task', { detail: { text } }));
  }, [close, scope]);

  if (inlineFlow) return null;

  if (selection?.kind === 'operations') {
    const isReview = selection.id === '救援复盘与知识';
    // 「资源数据与预警」整块暂时下线；预警类改走 flow / WarningPushPanel。
    if (!isReview && !SHOW_RESOURCE_DATA_ALERT) {
      return (
        <div className="doc-workspace" data-testid="operations-workspace-shell">
          <div className="doc-workspace-body" style={{ padding: 16 }}>
            <Alert
              type="info"
              showIcon
              title="「资源数据与预警」暂未开放"
              description="设备采集、出入库、定期监测与接口配置入口已暂时下线。预警推送请从业务流程中的「预警推送 / 资源预警通知」进入。"
              action={<Button size="small" onClick={requestClose}>关闭</Button>}
            />
          </div>
        </div>
      );
    }
    return <div className="doc-workspace" data-testid="operations-workspace-shell"><div className="doc-workspace-body">
      <CustomerOperationsPanel key={`${scope}:${eventId}:${selection.id}`} eventId={eventId} sessionId={scope}
        review={isReview}
        onClose={requestClose} />
    </div></div>;
  }

  if (selection?.kind === 'flow') {
    return (
      <div className="doc-workspace" data-testid="flow-workspace-shell">
        <div className="doc-workspace-body">
          <OperationalFlows
            key={`${scope}:${eventId}:${selection.id}`}
            eventId={eventId}
            eventName={eventDisplayName(eventId)}
            initial={selection.id as FlowTask}
            eventStage={eventStage}
            onClose={requestClose}
            onTask={runFlowTask}
          />
        </div>
      </div>
    );
  }

  if (selection?.kind === 'resource') {
    return (
      <div className="doc-workspace" data-testid="resource-workspace-shell">
        <div className="doc-workspace-body">
          <ResourcePanel
            key={`${scope}:${eventId}:${selection.id}`}
            initialTab={selection.id}
            onClose={requestClose}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="doc-workspace" data-testid="document-workspace-shell">
      <div className="doc-workspace-body">
        <DocCenterPanel view="workspace" onClose={requestClose} onOpenLibrary={openLibrary} />
      </div>
    </div>
  );
}
