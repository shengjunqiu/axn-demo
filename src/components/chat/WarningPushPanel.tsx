import { ResultSection as Card } from '@/components/common/AgentResultPrimitives';
import { KvTable, StatusPill } from '@/components/common/ChatPrimitives';
/**
 * 预警推送 / 资源预警通知共用面板：选人 → 草稿 → 批准 → 模拟推送 → 回执。
 * 状态写入会话，关闭工作区不丢；打开 current 时默认预填演示草稿。
 */
import { useEffect, useMemo, useState } from 'react';
import { Button, Checkbox, Input, Select, Space, Typography } from 'antd';
import { disasterProfileById } from '@/seed/disasterScenarios';
import type { FlowTabMode } from '@/services/flowStageConfig';
import {
  buildResourceWarningDraft,
  buildSituationWarningDraft,
  buildWarningPushSeed,
  defaultTargetsForKind,
  emptyWarningPushState,
  type WarningPushKind,
  type WarningPushState,
} from '@/services/warningPush';
import { useConversationStore } from '@/store/conversationStore';
import { useSessionStore } from '@/store/sessionStore';

type Props = {
  kind: WarningPushKind;
  mode: FlowTabMode;
  eventId: string;
  eventName: string;
  /** 不传则按当前会话解析 */
  sessionId?: string | null;
  roadHint?: string;
  draftText?: string;
};

function buildCurrentDraft(
  kind: WarningPushKind,
  eventId: string,
  eventName: string,
  roadHint?: string,
  resourceIds: string[] = [],
): WarningPushState {
  const profile = disasterProfileById.get(eventId);
  const draft = kind === 'situation'
    ? buildSituationWarningDraft(eventId, profile, eventName)
    : buildResourceWarningDraft(eventId, profile, eventName, {
        resourceIds,
        roadHint: roadHint ?? '主路阻断（示例），绕行条件待确认',
      });
  return {
    kind,
    targets: draft.targets,
    warning: draft.warning,
    approved: false,
    receipts: [],
    updatedAt: new Date().toISOString(),
  };
}

function resolveDisplayState(
  kind: WarningPushKind,
  mode: FlowTabMode,
  stored: WarningPushState | undefined,
  eventId: string,
  eventName: string,
  roadHint?: string,
  resourceIds: string[] = [],
): WarningPushState {
  if (stored) return stored;
  if (mode === 'past') {
    return buildWarningPushSeed(kind, eventId, disasterProfileById.get(eventId), eventName);
  }
  if (mode === 'current') {
    return buildCurrentDraft(kind, eventId, eventName, roadHint, resourceIds);
  }
  return emptyWarningPushState(kind);
}

export default function WarningPushPanel({
  kind,
  mode,
  eventId,
  eventName,
  sessionId: sessionIdProp,
  roadHint,
  draftText,
}: Props) {
  const profile = disasterProfileById.get(eventId);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const sessionIdFromConv = useSessionStore((s) =>
    s.sessionByConversation[activeConversationId ?? ''] ?? null,
  );
  const sessionId = sessionIdProp ?? sessionIdFromConv;
  const stored = useSessionStore((s) =>
    sessionId ? s.sessions[sessionId]?.warningPushByKind?.[kind] : undefined,
  );
  const lastResourceResultIds = useSessionStore((s) =>
    sessionId ? (s.sessions[sessionId]?.lastResourceResultIds ?? []) : [],
  );
  const setWarningPush = useSessionStore((s) => s.setWarningPush);

  const display = useMemo(
    () => {
      const state = resolveDisplayState(
      kind,
      mode,
      stored,
      eventId,
      eventName,
      roadHint,
      lastResourceResultIds,
      );
      return !stored && draftText ? { ...state, warning: draftText } : state;
    },
    [kind, mode, stored, eventId, eventName, roadHint, lastResourceResultIds, draftText],
  );

  const [fail, setFail] = useState(false);
  const readOnly = mode === 'past' || mode === 'future';
  const targetOptions = defaultTargetsForKind(kind);

  /** 首次打开 current 且会话无记录时，把默认草稿写入会话。 */
  useEffect(() => {
    if (readOnly || !sessionId || stored) return;
    setWarningPush(
      sessionId,
      kind,
      { ...buildCurrentDraft(kind, eventId, eventName, roadHint, lastResourceResultIds), ...(draftText ? { warning: draftText } : {}) },
    );
  }, [
    readOnly,
    sessionId,
    stored,
    kind,
    eventId,
    eventName,
    roadHint,
    lastResourceResultIds,
    setWarningPush,
    draftText,
  ]);

  const persist = (next: Partial<WarningPushState>) => {
    if (!sessionId || readOnly) return;
    const base = stored ?? buildCurrentDraft(kind, eventId, eventName, roadHint, lastResourceResultIds);
    setWarningPush(sessionId, kind, {
      ...base,
      ...next,
      kind,
      updatedAt: new Date().toISOString(),
    });
  };

  const resetApproval = () => {
    persist({
      targets: display.targets,
      warning: display.warning,
      approved: false,
      receipts: [],
    });
  };

  const generateDraft = () => {
    const draft = kind === 'situation'
      ? buildSituationWarningDraft(eventId, profile, eventName)
      : buildResourceWarningDraft(eventId, profile, eventName, {
          resourceIds: lastResourceResultIds,
          roadHint: roadHint ?? '主路阻断（示例），绕行条件待确认',
        });
    persist({
      targets: draft.targets,
      warning: draftText ?? draft.warning,
      approved: false,
      receipts: [],
    });
  };

  return (
    <Space orientation="vertical" size={12} style={{ width: '100%' }} data-testid={`warning-push-${kind}`}>
      {readOnly ? (
        <>
          <Card size="small" title={kind === 'situation' ? '预警内容（回放）' : '资源预警内容（回放）'}>
            <Typography.Paragraph>{display.warning}</Typography.Paragraph>
            <p>责任岗位：{display.targets.join('、') || '（无）'}</p>
          </Card>
          {display.receipts.map((r) => (
            <Card size="small" key={r.id} title={r.target}>
              <KvTable rows={[
                { label: '状态', value: <StatusPill tone="ok">{r.status}（模拟）</StatusPill> },
                { label: '回执编号', value: r.id },
              ]} />
            </Card>
          ))}
        </>
      ) : (
        <>
          <Select
            mode="multiple"
            aria-label={kind === 'situation' ? '预警责任人' : '资源预警责任人'}
            placeholder="选择责任岗位"
            value={display.targets}
            onChange={(targets) => {
              persist({
                targets,
                warning: display.warning,
                approved: false,
                receipts: [],
              });
            }}
            options={targetOptions.map((value) => ({ value, label: value }))}
            style={{ width: '100%' }}
          />
          <Input.TextArea
            aria-label={kind === 'situation' ? '预警内容' : '资源预警内容'}
            placeholder={
              kind === 'situation'
                ? '风险、依据、资源缺口、影响范围、建议措施、有效期'
                : '缺口、状态异常、路况核实、建议措施'
            }
            value={display.warning}
            rows={5}
            onChange={(e) => {
              persist({
                targets: display.targets,
                warning: e.target.value,
                approved: false,
                receipts: [],
              });
            }}
          />
          <Space wrap>
            <Button onClick={generateDraft}>
              {kind === 'situation' ? '重新生成预警草稿' : '重新生成资源预警草稿'}
            </Button>
            {(display.approved || display.receipts.length > 0) && (
              <Button onClick={resetApproval}>重置批准与回执</Button>
            )}
          </Space>
          <Checkbox
            checked={display.approved}
            onChange={(e) => {
              persist({
                targets: display.targets,
                warning: display.warning,
                approved: e.target.checked,
                receipts: [],
              });
            }}
          >
            已核对内容和责任岗位，批准本地模拟发送
          </Checkbox>
          <Checkbox checked={fail} onChange={(e) => setFail(e.target.checked)}>
            模拟发送失败
          </Checkbox>
          <Button
            type="primary"
            disabled={
              !display.approved
              || !display.targets.length
              || !display.warning.trim()
              || display.receipts.length > 0
            }
            onClick={() =>
              persist({
                targets: display.targets,
                warning: display.warning,
                approved: true,
                receipts: display.targets.map((target) => ({
                  id: crypto.randomUUID(),
                  target,
                  status: fail ? '失败' : '已送达',
                })),
              })}
          >
            模拟推送
          </Button>
          {display.receipts.map((r) => (
            <Card size="small" key={r.id} title={r.target}>
              <KvTable rows={[
                { label: '状态', value: <StatusPill tone={r.status === '失败' ? 'err' : 'ok'}>{r.status}（模拟）</StatusPill> },
                { label: '回执编号', value: r.id },
              ]} />
              {r.status === '失败' ? (
                <Button
                  onClick={() =>
                    persist({
                      targets: display.targets,
                      warning: display.warning,
                      approved: true,
                      receipts: display.receipts.map((v) =>
                        (v.id === r.id ? { ...v, status: '已送达' } : v)),
                    })}
                >
                  重试模拟发送
                </Button>
              ) : (
                <Button
                  disabled={r.status === '已响应'}
                  onClick={() =>
                    persist({
                      targets: display.targets,
                      warning: display.warning,
                      approved: true,
                      receipts: display.receipts.map((v) =>
                        (v.id === r.id ? { ...v, status: '已响应' } : v)),
                    })}
                >
                  记录模拟响应
                </Button>
              )}
            </Card>
          ))}
        </>
      )}
    </Space>
  );
}
