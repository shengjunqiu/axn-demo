import { expect, it } from 'vitest';
import { DISASTER_PROFILES } from '@/seed/disasterScenarios';
import { buildEventSwitchBriefing } from '@/services/eventSwitchBriefing';
import { buildConstructionResult } from '@/seed/constructionScenarios';
const fields = ['灾害类型：', '发生时间：', '事发地点：', '影响范围：', '应急响应等级：', '救援力量部署：'];
it('各事件切换总结与态势文稿均包含六项关键要素且区分候选与实际部署', () => {
  for (const event of [...DISASTER_PROFILES, { eventId: 'evt-demo-001' }]) {
    const briefing = buildEventSwitchBriefing(event.eventId);
    const report = buildConstructionResult('situationReport', event.eventId);
    const body = report.sections.map(s => s.text).join('\n');
    for (const field of fields) { expect(briefing).toContain(field); expect(body).toContain(field); }
    expect(body).toContain('候选资源不等于已调派');
  }
});
