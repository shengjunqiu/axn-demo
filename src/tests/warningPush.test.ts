/**
 * @vitest-environment node
 */
import { describe, expect, it } from 'vitest';
import { disasterProfileById } from '@/seed/disasterScenarios';
import {
  buildResourceWarningDraft,
  buildSituationWarningDraft,
  buildWarningPushSeed,
  defaultTargetsForKind,
  emptyWarningPushState,
} from '@/services/warningPush';
import { flowTabMode, FLOW_TASK_META, minStageForFlowTab } from '@/services/flowStageConfig';
import { useSessionStore } from '@/store/sessionStore';

describe('warningPush', () => {
  const profile = disasterProfileById.get('evt-demo-001');

  it('态势草稿含次生风险与资源缺口摘要', () => {
    const draft = buildSituationWarningDraft('evt-demo-001', profile, '演示事件');
    expect(draft.targets).toEqual(defaultTargetsForKind('situation'));
    expect(draft.warning).toMatch(/次生风险预警草稿/);
    expect(draft.warning).toMatch(/资源需求与缺口/);
  });

  it('资源草稿含缺口与路况', () => {
    const draft = buildResourceWarningDraft('evt-demo-001', profile, '演示事件', {
      roadHint: '主路阻断（示例）',
      resourceIds: [],
    });
    expect(draft.targets).toEqual(defaultTargetsForKind('resource'));
    expect(draft.warning).toMatch(/资源预警通知草稿/);
    expect(draft.warning).toMatch(/主路阻断/);
  });

  it('资源预警通知门控在力量投送中为 current', () => {
    expect(minStageForFlowTab('资源预警通知')).toBe('力量投送中');
    expect(FLOW_TASK_META['资源预警通知'].owner).toBe('resource');
    expect(flowTabMode('待研判', '资源预警通知')).toBe('future');
    expect(flowTabMode('力量投送中', '资源预警通知')).toBe('current');
    expect(flowTabMode('救援中', '资源预警通知')).toBe('past');
  });

  it('会话可持久化推送态并在改草稿时覆盖', () => {
    useSessionStore.getState().resetAll();
    const sid = useSessionStore.getState().currentSessionId;
    const seed = buildWarningPushSeed('situation', 'evt-demo-001', profile, '演示');
    useSessionStore.getState().setWarningPush(sid, 'situation', seed);
    expect(useSessionStore.getState().sessions[sid].warningPushByKind?.situation?.receipts).toHaveLength(3);

    useSessionStore.getState().setWarningPush(sid, 'situation', {
      ...emptyWarningPushState('situation'),
      targets: ['现场安全员（演示）'],
      warning: '新草稿',
      approved: false,
      receipts: [],
    });
    const next = useSessionStore.getState().sessions[sid].warningPushByKind?.situation;
    expect(next?.warning).toBe('新草稿');
    expect(next?.receipts).toEqual([]);
  });

  it('默认预填草稿正文非空且含岗位', () => {
    const situation = buildSituationWarningDraft('evt-demo-001', profile, '演示事件');
    const resource = buildResourceWarningDraft('evt-demo-001', profile, '演示事件');
    expect(situation.warning.trim().length).toBeGreaterThan(20);
    expect(situation.targets.length).toBeGreaterThan(0);
    expect(resource.warning.trim().length).toBeGreaterThan(20);
    expect(resource.targets.length).toBeGreaterThan(0);
  });
});
