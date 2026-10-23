import { SUPPLY_AUDIT_TEXT } from '@/pages/v2/businessData';
import { EVENT_NAME } from '@/pages/v2/constants';
import { useConversationStore } from '@/store/conversationStore';
import { useSessionStore } from '@/store/sessionStore';
import { embeddedQaIntro } from './embeddedQa';

const handled = new Set<string>();
/** 直接创建核验对话，不调用文书生成、不写入物资台账。 */
export function startEmbeddedSuppliesAudit(requestId: string): void {
  if (handled.has(requestId)) return;
  handled.add(requestId);
  const conversation = useConversationStore.getState().createConversation({
    title: `${EVENT_NAME} · 物资核验`, type: 'resource', summary: 'V2物资管理页核验（模拟），直接对话',
  });
  const sessionId = useSessionStore.getState().ensureSessionForConversation(conversation.id, conversation.eventId!);
  const store = useSessionStore.getState();
  store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', taskId: null, text: '请核验当前物资管理页的数据完整性和供需核对条件。' });
  store.appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', taskId: null,
    agentName: '救援资源管理智能体', agentRole: 'v2-supplies',
    text: `当前事件：${EVENT_NAME}\n\n${SUPPLY_AUDIT_TEXT}`,
  });
  store.appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', taskId: null, text: embeddedQaIntro('supplies') });
}
