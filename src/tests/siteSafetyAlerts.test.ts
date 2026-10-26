import { describe, expect, it } from 'vitest';
import { DISASTER_PROFILES } from '@/seed/disasterScenarios';
import { safetyAlertDraft, siteSafetyAlerts } from '@/services/siteSafetyAlerts';

describe('一线危险提醒依据', () => {
  it.each(DISASTER_PROFILES.slice(0, 3))('$name只使用本事件线索，学校医院缺资料时不判断安全或受灾', profile => {
    const alerts = siteSafetyAlerts(profile);
    expect(alerts).toHaveLength(6);
    expect(alerts.find(a => a.id === 'people')?.place).toBe(profile.impactScope);
    expect(alerts.find(a => a.id === 'schools')?.state).toBe('还没核实');
    expect(alerts.find(a => a.id === 'hospitals')?.state).toBe('还没核实');
    expect(alerts.every(a => a.action && a.contact && a.source)).toBe(true);
    const school = alerts.find(a => a.id === 'schools')!;
    const draft = safetyAlertDraft(profile, [school]);
    expect(draft).toContain(profile.name);
    expect(draft).toContain(profile.capturedAt);
    expect(draft).not.toContain('缺口约');
  });
  it('乡道边坡属于道路风险线索，但不据此声称封路', () => {
    const p = DISASTER_PROFILES.find(p => p.eventId === 'evt-sim-landslide')!;
    const road = siteSafetyAlerts(p).find(a => a.id === 'roads')!;
    expect(road.place).toContain('乡道边坡');
    expect(road.state).toBe('已有模拟线索');
    expect(road.impact).toContain('是否封路');
    expect(road.impact).toContain('还没核实');
  });
});
