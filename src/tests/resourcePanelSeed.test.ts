/**
 * @vitest-environment node
 * 资源抽屉种子回退契约：未查询时 displayIds = seedResourceIdsForEvent(eventId)。
 */
import { describe, expect, it } from 'vitest';
import { DISASTER_PROFILES } from '@/seed/disasterScenarios';
import {
  LEDGER_RESOURCE_IDS,
  seedResourceIdsForEvent,
  vueDemoResourcesForEvent,
} from '@/seed/vueDemoResources';

describe('资源列表种子补全与抽屉回退', () => {
  it('三类实战事件与 demo-002 各 ≥3 条，且至少一条可选', () => {
    for (const eventId of ['evt-sim-landslide', 'evt-sim-breach', 'evt-sim-debris', 'evt-demo-002']) {
      const resources = vueDemoResourcesForEvent(eventId);
      expect(resources.length).toBeGreaterThanOrEqual(3);
      expect(resources.every((item) => item.eventId === eventId)).toBe(true);
      expect(resources.some((item) => item.selectable)).toBe(true);
    }
  });

  it('三类实战事件 seedResourceIds 非空（抽屉可预览）', () => {
    for (const profile of DISASTER_PROFILES) {
      expect(seedResourceIdsForEvent(profile.eventId).length).toBeGreaterThanOrEqual(3);
    }
    expect(seedResourceIdsForEvent('evt-demo-002').length).toBeGreaterThanOrEqual(2);
  });

  it('demo-001 回退授权台账 ID', () => {
    expect(seedResourceIdsForEvent('evt-demo-001')).toEqual([...LEDGER_RESOURCE_IDS]);
  });

  it('回退 ID 与本事件演示资源一致（非台账事件）', () => {
    const eventId = 'evt-sim-landslide';
    expect(seedResourceIdsForEvent(eventId)).toEqual(
      vueDemoResourcesForEvent(eventId).map((item) => item.id),
    );
  });
});
