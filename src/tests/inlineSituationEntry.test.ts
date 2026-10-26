import { beforeEach, expect, it } from 'vitest';
import { openInlineSituation } from '@/services/inlineSituation';
import { useSessionStore } from '@/store/sessionStore';
import { useWorkspaceStore } from '@/store/workspaceStore';
beforeEach(() => { useSessionStore.getState().resetAll(); useWorkspaceStore.getState().resetAll(); });
it('旧工作区预警入口转为当前事件对话卡并关闭右侧', () => {
  const sid = useSessionStore.getState().ensureSessionForEvent('evt-sim-landslide');
  useWorkspaceStore.getState().select(sid, { kind: 'flow', id: '预警推送' });
  openInlineSituation(sid, '预警推送');
  expect(useWorkspaceStore.getState().isOpen(sid)).toBe(false);
  expect(useSessionStore.getState().sessions[sid].messages.at(-1)?.inlineSituation).toEqual({ kind: 'warning', eventId: 'evt-sim-landslide' });
});
