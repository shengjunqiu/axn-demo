import { beforeEach, describe, expect, it, vi } from 'vitest';
vi.mock('@/services/taskRunner', () => ({ sendMessage: vi.fn().mockResolvedValue('task') }));
import { answerStageQuestion } from '@/services/questionConversation';
import { respondToSummaryOffer } from '@/services/summaryConversation';
import { sendMessage } from '@/services/taskRunner';
import { useSessionStore } from '@/store/sessionStore';

beforeEach(() => { useSessionStore.getState().resetAll(); vi.clearAllMocks(); });
describe('提问先答复，确认后生成材料', () => {
  it('周边资源问题先答复，确认后才按原意图生成一次', () => {
    const sid = useSessionStore.getState().ensureSessionForEvent('evt-sim-breach');
    expect(answerStageQuestion(sid, '需要核查哪些周边资源？')).toBe(true);
    const reply = useSessionStore.getState().sessions[sid].messages.at(-1)!;
    expect(reply.reviewSummary?.conclusion).toContain('优先核查');
    expect(reply.summaryOffer?.title).toBe('周边资源分析报告');
    expect(sendMessage).not.toHaveBeenCalled();
    expect(respondToSummaryOffer(sid, '需要')).toBe(true);
    expect(sendMessage).toHaveBeenCalledWith(sid, expect.objectContaining({ interpretationText: expect.stringContaining('周边资源分析报告'), skipAssess: true }));
  });
  it('拒绝后不生成；明确生成请求保留原路径', () => {
    const sid = useSessionStore.getState().ensureSessionForEvent('evt-sim-breach');
    expect(answerStageQuestion(sid, '生成周边资源报告')).toBe(false);
    answerStageQuestion(sid, '这段现场情况有哪些风险？');
    expect(respondToSummaryOffer(sid, '不需要')).toBe(true);
    expect(sendMessage).not.toHaveBeenCalled();
    expect(respondToSummaryOffer(sid, '是')).toBe(false);
  });
});
