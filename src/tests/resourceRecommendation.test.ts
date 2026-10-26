import { expect, it } from 'vitest';
import { rankResourceCandidates, resourceRecommendationReply, type RecommendationCandidate } from '@/services/resourceRecommendation';
const candidate: RecommendationCandidate = { id: 'a', name: '排涝队', kind: 'team', capability: '排水排涝', amount: '12人', status: '可用', distance: 10, eta: 30, estimated: true };
it('专业匹配优先并排除不可用资源，相同能力优先更快更近', () => {
  const ranked = rankResourceCandidates([candidate, { ...candidate, id: 'far', distance: 60, eta: 100 }, { ...candidate, id: 'wrong', capability: '供电', name: '供电队' }, { ...candidate, id: 'off', status: '不可用' }], ['排水', '排涝']);
  expect(ranked[0].id).toBe('a'); expect(ranked.some(c => c.id === 'off')).toBe(false);
});
it('建议绑定所选事件且说明缺项、模拟估算与未调派', () => {
  const landslide = resourceRecommendationReply('evt-sim-landslide');
  expect(landslide).toContain('青岭'); expect(landslide).toContain('地质'); expect(landslide).toContain('推荐组合'); expect(landslide).toContain('未形成实际调派');
  expect(resourceRecommendationReply('evt-sim-debris')).toContain('泥石流');
  expect(resourceRecommendationReply('missing')).toContain('请先关联');
});
