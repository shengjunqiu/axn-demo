import { describe, expect, it } from 'vitest';
import { rescuePlanAlternatives, generateRescuePlanAlternatives, openRescuePlan } from '@/services/rescuePlanAlternatives';
import { DISASTER_PROFILES } from '@/seed/disasterScenarios';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useSessionStore } from '@/store/sessionStore';
import { DEFAULT_SESSION_ID } from '@/seed/scenario';

describe('直接生成三种救援方案', () => {
  it('每种灾情生成三份不同实施安排的文书', () => {
    for (const event of DISASTER_PROFILES) {
      const plans = rescuePlanAlternatives(event.eventId);
      expect(plans).toHaveLength(3);
      expect(plans.every(p => p.sections.length === 5)).toBe(true);
      expect(new Set(plans.map(p => p.title)).size).toBe(3);
      expect(plans.every(p => p.sections.length === 5)).toBe(true);
      expect(new Set(plans.map(p => p.sections.find(([heading]) => heading === '四、救援行动安排')?.[1])).size).toBe(3);
    }
  });
  it('三种候选有独立标识，选定后才创建文书，并保持原查看状态', () => {
    const eventId = useSessionStore.getState().sessions[DEFAULT_SESSION_ID].eventId;
    const beforeCount = useMockDocumentStore.getState().libraries[DEFAULT_SESSION_ID]?.documents.length ?? 0;
    const previous = useMockDocumentStore.getState().libraries[DEFAULT_SESSION_ID]?.selected ?? null;
    generateRescuePlanAlternatives(DEFAULT_SESSION_ID, eventId);
    const message = useSessionStore.getState().sessions[DEFAULT_SESSION_ID].messages.at(-1)!;
    expect(message.rescuePlans).toHaveLength(3);
    expect(new Set(message.rescuePlans!.map(p => p.documentId)).size).toBe(3);
    const library = useMockDocumentStore.getState().libraries[DEFAULT_SESSION_ID];
    expect(library?.selected ?? null).toEqual(previous);
    expect(library?.documents.length ?? 0).toBe(beforeCount);
    for (const plan of message.rescuePlans!) expect(library?.documents.find(d => d.id === plan.documentId)).toBeUndefined();
    useMockDocumentStore.setState({ libraries: {} });
    for (const plan of message.rescuePlans!) openRescuePlan(DEFAULT_SESSION_ID, plan);
    for (const plan of message.rescuePlans!) expect(useMockDocumentStore.getState().libraries[DEFAULT_SESSION_ID].documents.find(d => d.id === plan.documentId)?.sections).toEqual(plan.sections);
  });
});
