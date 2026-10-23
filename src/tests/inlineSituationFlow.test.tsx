import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import InlineSituationFlow from '@/components/chat/InlineSituationFlow';
import { useSessionStore } from '@/store/sessionStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

beforeEach(() => { useSessionStore.getState().resetAll(); useWorkspaceStore.getState().resetAll(); });
afterEach(cleanup);
describe('对话内态势研判与预警推送', () => {
  it('打开直接显示提醒，按学校医院筛选，并把单条提醒带入通知草稿', () => {
    const sid = useSessionStore.getState().ensureSessionForEvent('evt-sim-landslide');
    render(<MemoryRouter><InlineSituationFlow eventId="evt-sim-landslide" sessionId={sid} initial="forecast" /></MemoryRouter>);
    expect(screen.getByText('哪些路要核实，车辆还能不能走')).toBeTruthy();
    expect(screen.queryByLabelText('资源需求情景')).toBeNull();
    expect(screen.queryByRole('button', { name: '生成研判情景（模拟）' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /^学校医院$/ }));
    expect(screen.getByText('附近学校会不会受影响')).toBeTruthy();
    expect(screen.queryByText('哪些路要核实，车辆还能不能走')).toBeNull();
    fireEvent.click(screen.getAllByRole('button', { name: '把这条提醒告诉相关人员' })[0]);
    const draft = (screen.getByLabelText('预警内容') as HTMLTextAreaElement).value;
    expect(draft).toContain('学校名称、位置和师生在校情况待补');
    expect(draft).not.toContain('缺口约');
    expect(draft).not.toContain('【附近医院');
    fireEvent.click(screen.getByRole('button', { name: '重新生成预警草稿' }));
    expect((screen.getByLabelText('预警内容') as HTMLTextAreaElement).value).toBe(draft);
    expect(useWorkspaceStore.getState().isOpen(sid)).toBe(false);
  });
  it('未批准不能推送，批准后生成会话内回执，改稿使批准失效', () => {
    const sid = useSessionStore.getState().ensureSessionForEvent('evt-sim-landslide');
    render(<MemoryRouter><InlineSituationFlow eventId="evt-sim-landslide" sessionId={sid} initial="warning" /></MemoryRouter>);
    const send = screen.getByRole('button', { name: /^模拟推送$/ });
    expect((send as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(screen.getByLabelText('已核对内容和责任岗位，批准本地模拟发送'));
    fireEvent.click(send);
    expect(useSessionStore.getState().sessions[sid].warningPushByKind?.situation?.receipts.length).toBeGreaterThan(0);
    fireEvent.change(screen.getByLabelText('预警内容'), { target: { value: '补充待核降雨信息，不发送真实通知。' } });
    const state = useSessionStore.getState().sessions[sid].warningPushByKind?.situation;
    expect(state?.approved).toBe(false);
    expect(state?.receipts).toEqual([]);
    expect(useWorkspaceStore.getState().isOpen(sid)).toBe(false);
  });
});
