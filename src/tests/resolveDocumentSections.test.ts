import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_SKELETON_FORBIDDEN,
  resolveDocumentSections,
  resolveDocumentTitle,
} from '@/seed/resolveDocumentSections';
import { DOCUMENT_CATEGORIES, MOCK_DOCUMENTS } from '@/seed/mockDocuments';
import { useMockDocumentStore, EMPTY_LIBRARY } from '@/store/mockDocumentStore';
import { useSessionStore } from '@/store/sessionStore';

const CODES = [
  'EMERGENCY_BRIEF',
  'DUTY_DAILY',
  'SITUATION_REPORT',
  'RESOURCE_REPORT',
  'RESCUE_PLAN',
  'RESCUE_EVAL',
  'WORK_SUMMARY',
  'MEETING_MINUTES',
  'RESOURCE_QUERY',
  'RESOURCE_STATUS',
] as const;

function bodyOf(eventId: string, code: string): string {
  return resolveDocumentSections(eventId, code).map(([, b]) => b).join('\n');
}

describe('resolveDocumentSections 消除纯架子占位', () => {
  it.each([
    ['evt-sim-breach', '南湾|决口|洪涝'],
    ['evt-sim-landslide', '青岭|滑坡'],
    ['evt-demo-001', '清河'],
  ] as const)('%s 要情/方案正文含事件线索且不含占位万能句', (eventId, tip) => {
    for (const code of ['EMERGENCY_BRIEF', 'RESCUE_PLAN', 'RESOURCE_REPORT'] as const) {
      const body = bodyOf(eventId, code);
      expect(body).not.toContain(DOCUMENT_SKELETON_FORBIDDEN);
      expect(body).toMatch(new RegExp(tip));
    }
  });

  it('各文种标题齐套且段落均有场景化正文', () => {
    for (const eventId of ['evt-sim-breach', 'evt-sim-landslide', 'evt-demo-001']) {
      for (const code of CODES) {
        const sections = resolveDocumentSections(eventId, code);
        expect(sections.length).toBeGreaterThan(0);
        expect(sections.every(([, body]) => body.trim().length > 8)).toBe(true);
        expect(sections.every(([, body]) => !body.includes(DOCUMENT_SKELETON_FORBIDDEN))).toBe(true);
      }
    }
  });

  it('文书标题优先用事件名而非通用 topics', () => {
    expect(resolveDocumentTitle('evt-sim-breach', '应急抢险要情', '险情处置要情')).toContain('南湾');
    expect(resolveDocumentTitle('evt-sim-landslide', '应急抢险要情')).toContain('青岭');
    expect(resolveDocumentTitle('evt-demo-001', '应急抢险要情')).toMatch(/清河|堤防/);
  });

  it('文书库预置样稿与分类默认正文不含占位万能句', () => {
    for (const category of DOCUMENT_CATEGORIES) {
      const body = category.sections.map(([, b]) => b).join('\n');
      expect(body).not.toContain(DOCUMENT_SKELETON_FORBIDDEN);
    }
    for (const doc of MOCK_DOCUMENTS) {
      const body = doc.sections.map((s) => s[1]).join('\n');
      expect(body).not.toContain(DOCUMENT_SKELETON_FORBIDDEN);
      expect(body.length).toBeGreaterThan(40);
    }
  });

  it('mockDocumentStore.generate 对实战事件写入填充正文', async () => {
    useSessionStore.getState().resetAll();
    const sid = useSessionStore.getState().ensureSessionForEvent('evt-sim-breach');
    useMockDocumentStore.setState({ libraries: { [sid]: { ...EMPTY_LIBRARY, documents: [], selected: null, generatingCode: null, working: {} } } });
    const doc = await useMockDocumentStore.getState().generate(sid, 'EMERGENCY_BRIEF');
    expect(doc).toBeTruthy();
    expect(doc!.title).toContain('南湾');
    const body = doc!.sections.map((s) => s[1]).join('\n');
    expect(body).not.toContain(DOCUMENT_SKELETON_FORBIDDEN);
    expect(body).toMatch(/南湾|决口|洪涝/);
    useSessionStore.getState().resetAll();
  });
});
