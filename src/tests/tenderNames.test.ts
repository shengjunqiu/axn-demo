import { beforeAll, describe, expect, it } from 'vitest';
import { ensureQaLoaded } from '@/services/qaKnowledge';
import { tenderName, tenderTaskPrompt } from '@/seed/tenderNames';
import { recognize } from '@/services/mock/provider';

describe('招标名称与任务兼容', () => {
  beforeAll(() => ensureQaLoaded());
  it.each([
    ['生成灾情摘要', '多源数据汇聚'], ['生成态势报告', '态势报告自动生成'],
    ['查询周边救援资源', '资源智能检索'], ['生成救援方案', '方案智能生成'],
    ['评估救援效果', '复盘评估分析'], ['现场智能勘察', '智能勘察分析'],
    ['规划梯队投送', '投送路径优化'], ['编组确认', '智能编组推荐'],
    ['方案修订对比', '过程动态调控'], ['资源管理智能体', '救援资源管理智能体'],
  ])('%s 显示为 %s', (old, name) => expect(tenderName(old)).toBe(name));
  it.each(['多源数据汇聚','态势报告自动生成','资源智能检索','方案智能生成','复盘评估分析','智能编组推荐','过程动态调控','生成总结报告'])('%s 能沿用原任务处理', name => {
    const ctx={lastResourceResultIds:[],candidateResourceIds:[]};
    expect(recognize(name,ctx)).toEqual(recognize(tenderTaskPrompt(name),ctx));
    expect(recognize(name,ctx).intent).not.toBe('unknown');
  });
  it('保留未被招标命名的辅助操作及用户原有指令', () => {
    expect(tenderName('登记现场资料')).toBe('登记现场资料');
    expect(tenderTaskPrompt('生成灾情摘要')).toBe('生成灾情摘要');
  });
});
