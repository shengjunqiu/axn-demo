import { describe, expect, it } from 'vitest';
import {
  conversationMatchesAgent,
  optionalEventsForAgent,
  SIDEBAR_AGENTS,
} from '@/services/sidebarAgentFilter';
import type { Conversation } from '@/domain/types';

function conv(partial: Partial<Conversation> & Pick<Conversation, 'id' | 'eventId'>): Conversation {
  return {
    title: partial.title ?? partial.id,
    type: 'emergency',
    status: 'active',
    createdAt: '2026-09-28T10:00:00+08:00',
    updatedAt: '2026-09-28T10:00:00+08:00',
    ...partial,
  };
}

describe('sidebarAgentFilter', () => {
  it('建设四智能体入口齐全', () => {
    expect(SIDEBAR_AGENTS.map((a) => a.id)).toEqual([
      'situation',
      'resource',
      'plan',
      'evaluation',
    ]);
  });

  it('按阶段过滤可选事件', () => {
    const judgment = optionalEventsForAgent('situation');
    expect(judgment.length).toBeGreaterThan(0);
    expect(judgment.every((e) => e.stage === '待研判')).toBe(true);
    expect(judgment.some((e) => e.eventId === 'evt-sim-landslide')).toBe(true);

    const force = optionalEventsForAgent('resource');
    expect(force.every((e) => e.stage === '力量投送中')).toBe(true);
    expect(force.some((e) => e.eventId === 'evt-sim-breach')).toBe(true);

    const rescue = optionalEventsForAgent('plan');
    expect(rescue.every((e) => e.stage === '救援中')).toBe(true);

    const review = optionalEventsForAgent('evaluation');
    expect(review.every((e) => e.stage === '待复盘' || e.stage === '已归档')).toBe(true);
    expect(review).toHaveLength(3);
    expect(review.every((e) => e.eventId.endsWith('-review'))).toBe(true);
  });

  it('会话匹配：空白会话不计入智能体筛选', () => {
    expect(conversationMatchesAgent(conv({ id: 'c1', eventId: 'evt-blank-c1' }), 'situation')).toBe(false);
    expect(conversationMatchesAgent(conv({ id: 'c2', eventId: 'evt-sim-debris' }), 'plan')).toBe(true);
    expect(conversationMatchesAgent(conv({ id: 'c3', eventId: 'evt-sim-debris' }), 'situation')).toBe(false);
    expect(conversationMatchesAgent(conv({ id: 'c4', eventId: 'evt-sim-debris' }), 'evaluation')).toBe(false);
    expect(conversationMatchesAgent(conv({ id: 'c5', eventId: 'evt-sim-debris-review' }), 'evaluation')).toBe(true);
  });
});
