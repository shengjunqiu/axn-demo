import { describe, expect, it } from 'vitest';
import { flowConversationReply } from '@/services/flowConversationReply';
import { buildFlowSeedSnapshot } from '@/services/flowStageConfig';
import { disasterProfileById } from '@/seed/disasterScenarios';

describe('流程按钮的对话回复', () => {
  it('投送回复与右侧地图的路线和路况保持一致', () => {
    const id = 'evt-demo-001';
    const seed = buildFlowSeedSnapshot(id, disasterProfileById.get(id), '事件A');
    const reply = flowConversationReply('规划梯队投送', id, '事件A', '力量投送中');
    expect(reply).toContain(seed.route);
    expect(reply).toContain(seed.road);
    expect(reply).toContain(seed.owner);
    expect(reply).toContain('未接入实时路况');
  });
  it('未到阶段不声称已生成结果', () => {
    const reply = flowConversationReply('复盘评估分析', 'evt-demo-001', '事件A', '待研判');
    expect(reply).toContain('尚未进入');
    expect(reply).not.toContain('已打开本事件的复盘评估结果');
  });
  it('数据更新解释下一步及本地模拟边界', () => {
    expect(flowConversationReply('资源维护与导出', 'evt-demo-001', '事件A', '已归档')).toContain('不会自动回写正式台账');
  });
});
