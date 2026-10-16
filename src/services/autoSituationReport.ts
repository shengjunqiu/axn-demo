/**
 * 态势报告自动生成：按变更指纹去重后物化标准化研判报告，并往对话推一条可查看消息。
 * 手动「生成态势报告」与自动稿共用 buildConstructionResult('situationReport')。
 */
import { isFocusCombatEvent, disasterProfileById } from '@/seed/disasterScenarios';
import { buildConstructionGlanceSummary, buildConstructionResult } from '@/seed/constructionScenarios';
import { vueDemoResourcesForEvent } from '@/seed/vueDemoResources';
import { publishConstructionMaterial } from '@/services/agentMaterialDocument';
import { documentGeneratedReply } from '@/services/documentGeneratedReply';
import { useSessionStore } from '@/store/sessionStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
import { useConversationStore } from '@/store/conversationStore';

export type AutoSituationReason = 'event_link' | 'multi_source' | 'data_changed' | 'manual';

const lastFingerprintBySession = new Map<string, string>();
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();

/** 供单测重置。 */
export function resetAutoSituationReportState(): void {
  lastFingerprintBySession.clear();
  for (const timer of debounceTimers.values()) clearTimeout(timer);
  debounceTimers.clear();
}

/** 事件 + 阶段 + 监测最新值 + 资源状态 → 变更指纹。 */
export function situationReportFingerprint(eventId: string): string {
  if (!eventId || eventId.startsWith('evt-blank-')) return `blank:${eventId}`;
  const profile = disasterProfileById.get(eventId);
  const monitor = profile
    ? profile.monitoring
      .map((m) => `${m.label}:${m.values.at(-1) ?? '缺测'}${m.unit}@${m.times.at(-1) ?? ''}`)
      .join('|')
    : '';
  const resources = vueDemoResourcesForEvent(eventId)
    .map((r) => `${r.id}:${r.status}:${r.amountLabel}`)
    .join('|');
  const stage = profile?.stage ?? '';
  return `${eventId}#${stage}#${monitor}#${resources}`;
}

function reasonLabel(reason: AutoSituationReason): string {
  if (reason === 'event_link') return '关联事件后';
  if (reason === 'multi_source') return '多源/研判资料更新后';
  if (reason === 'data_changed') return '业务数据变化后';
  return '手动';
}

/**
 * 若指纹相对上次推送有变化，则生成并推送自动态势报告。
 * @returns 是否实际推送
 */
export function pushAutoSituationReport(
  sessionId: string,
  eventId: string,
  reason: AutoSituationReason,
): boolean {
  if (!sessionId || !eventId || eventId.startsWith('evt-blank-')) return false;
  if (!isFocusCombatEvent(eventId) && !disasterProfileById.has(eventId)) return false;

  const fingerprint = situationReportFingerprint(eventId);
  if (lastFingerprintBySession.get(sessionId) === fingerprint) return false;

  const result = buildConstructionResult('situationReport', eventId);
  if (reason !== 'manual') {
    result.title = '态势报告（自动）';
    result.summary = `${reasonLabel(reason)}已按最新模拟资料汇总标准化研判报告。${result.summary}`;
  }

  const document = publishConstructionMaterial(sessionId, result.capability, result);
  lastFingerprintBySession.set(sessionId, fingerprint);

  if (document) {
    useWorkspaceStore.getState().autoOpen(
      sessionId,
      `auto-situation:${document.id}`,
      { kind: 'mock', id: document.id },
    );
  }

  const glance = buildConstructionGlanceSummary(result);
  const generated = documentGeneratedReply(document?.title ?? result.title, glance);
  const store = useSessionStore.getState();
  store.appendMessage(sessionId, {
    sessionId,
    role: 'assistant',
    kind: 'text',
    taskId: null,
    text: reason === 'manual'
      ? generated
      : `已根据最新资料自动汇总态势报告（模拟）。\n\n${generated}`,
    situationReportAuto: {
      eventId,
      documentId: document?.id,
      reason,
      openMap: true,
    },
  });
  return true;
}

/** 仅刷新指纹（例如用户刚手动生成过同内容），避免紧接着再自动推一次。 */
export function rememberSituationReportFingerprint(sessionId: string, eventId: string): void {
  if (!sessionId || !eventId) return;
  lastFingerprintBySession.set(sessionId, situationReportFingerprint(eventId));
}

/**
 * 防抖推送：短时间多次数据变更合并为一次。
 * 事件关联用即时推送（delayMs=0）。
 */
export function scheduleAutoSituationReport(
  sessionId: string,
  eventId: string,
  reason: AutoSituationReason,
  delayMs = 1200,
): void {
  if (!sessionId || !eventId || eventId.startsWith('evt-blank-')) return;
  const key = `${sessionId}:${eventId}`;
  const existing = debounceTimers.get(key);
  if (existing) clearTimeout(existing);
  if (delayMs <= 0) {
    pushAutoSituationReport(sessionId, eventId, reason);
    return;
  }
  debounceTimers.set(
    key,
    setTimeout(() => {
      debounceTimers.delete(key);
      pushAutoSituationReport(sessionId, eventId, reason);
    }, delayMs),
  );
}

/** 业务数据变更：对当前关联该事件的活跃会话尝试推送。 */
export function notifySituationDataChanged(eventId: string): void {
  if (!eventId || eventId.startsWith('evt-blank-')) return;
  const conversations = useConversationStore.getState().conversations;
  const sessions = useSessionStore.getState().sessions;
  const sessionByConversation = useSessionStore.getState().sessionByConversation;
  const activeId = useConversationStore.getState().activeConversationId;

  const targets = new Set<string>();
  if (activeId) {
    const conv = conversations[activeId];
    const sid = sessionByConversation[activeId];
    if (conv?.eventId === eventId && sid) targets.add(sid);
  }
  for (const [convId, conv] of Object.entries(conversations)) {
    if (conv.eventId !== eventId) continue;
    const sid = sessionByConversation[convId];
    if (sid && sessions[sid]) targets.add(sid);
  }
  for (const sessionId of targets) {
    scheduleAutoSituationReport(sessionId, eventId, 'data_changed');
  }
}
