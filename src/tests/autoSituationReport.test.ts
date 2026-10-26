import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  pushAutoSituationReport,
  rememberSituationReportFingerprint,
  resetAutoSituationReportState,
  situationReportFingerprint,
} from '@/services/autoSituationReport';
import { buildDisasterSections, SITUATION_REPORT_TITLES } from '@/seed/documentTemplates';
import { DISASTER_PROFILES } from '@/seed/disasterScenarios';
import { buildConstructionResult } from '@/seed/constructionScenarios';
import { useSessionStore } from '@/store/sessionStore';
import { useConversationStore } from '@/store/conversationStore';
import { useMockDocumentStore } from '@/store/mockDocumentStore';

beforeEach(() => {
  resetAutoSituationReportState();
  useSessionStore.getState().resetAll();
  useConversationStore.getState().resetAll();
  useMockDocumentStore.setState({ libraries: {} });
  vi.useRealTimers();
});

describe('autoSituationReport', () => {
  it('三类实战态势报告四章标题一致且含灾种监测侧重', () => {
    for (const profile of DISASTER_PROFILES) {
      const sections = buildDisasterSections(profile, 'SITUATION_REPORT');
      expect(sections.map(([t]) => t)).toEqual([...SITUATION_REPORT_TITLES]);
      const body = sections.map(([, b]) => b).join('\n');
      expect(body).toContain('灾种关键监测');
      expect(body).toContain(profile.monitoring[0].label);
      expect(body).toContain('态势地图');
      const result = buildConstructionResult('situationReport', profile.eventId);
      // 建设结果前置「事件关键要素」，其后为四章标准标题
      expect(result.sections.map((s) => s.title)).toEqual(['事件关键要素', ...SITUATION_REPORT_TITLES]);
    }
  });

  it('指纹相同不重复推送；切换事件可再推', () => {
    const conversation = useConversationStore.getState().createConversation({
      title: '态势自动推送测试',
      type: 'emergency',
      eventId: 'evt-sim-landslide',
    });
    const sessionId = useSessionStore.getState().ensureSessionForConversation(
      conversation.id,
      'evt-sim-landslide',
    );

    expect(pushAutoSituationReport(sessionId, 'evt-sim-landslide', 'event_link')).toBe(true);
    const afterFirst = useSessionStore.getState().sessions[sessionId].messages.filter(
      (m) => m.situationReportAuto,
    );
    expect(afterFirst).toHaveLength(1);
    expect(afterFirst[0].situationReportAuto?.openMap).toBe(true);
    expect(afterFirst[0].text).toMatch(/自动汇总态势报告/);

    expect(pushAutoSituationReport(sessionId, 'evt-sim-landslide', 'event_link')).toBe(false);
    expect(
      useSessionStore.getState().sessions[sessionId].messages.filter((m) => m.situationReportAuto),
    ).toHaveLength(1);

    expect(pushAutoSituationReport(sessionId, 'evt-sim-breach', 'event_link')).toBe(true);
    expect(
      useSessionStore.getState().sessions[sessionId].messages.filter((m) => m.situationReportAuto),
    ).toHaveLength(2);
  });

  it('手动生成后记住指纹，避免立即再自动推同一稿', () => {
    const conversation = useConversationStore.getState().createConversation({
      title: '手动指纹测试',
      type: 'emergency',
      eventId: 'evt-sim-debris',
    });
    const sessionId = useSessionStore.getState().ensureSessionForConversation(
      conversation.id,
      'evt-sim-debris',
    );
    rememberSituationReportFingerprint(sessionId, 'evt-sim-debris');
    expect(pushAutoSituationReport(sessionId, 'evt-sim-debris', 'multi_source')).toBe(false);
    expect(situationReportFingerprint('evt-sim-debris')).toContain('evt-sim-debris');
  });
});
