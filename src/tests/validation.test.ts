/**
 * 校核引擎测试：R-002/R-004/R-005/R-006/R-007 阻断级 + R-009/R-010 warning。
 * 对应产品红线：待核实≠0、处置中≠已控制、候选≠已调派、建议≠已确认。
 */
import { describe, expect, it } from 'vitest';
import { validateContent, applySuggestion } from '@/services/validation';
import { buildSnapshot } from '@/services/snapshot';
import type { DocumentContent, InlineRun } from '@/domain/types';
import { DEFAULT_EVENT_ID } from '@/seed/scenario';
import { useSessionStore } from '@/store/sessionStore';
import { useDemoStore } from '@/store/demoStore';

function para(id: string, runs: InlineRun[]) {
  return { id, role: 'narrative' as const, runs };
}

function makeContent(paragraphs: ReturnType<typeof para>[]): DocumentContent {
  return {
    title: '测试文书',
    templateCode: 'EMERGENCY_BRIEF',
    templateVersion: '1.0.0-demo',
    sections: [{ id: 'sec-test', heading: '测试小节', paragraphs }],
    footerNote: '本内容为模拟数据，仅用于产品演示。',
  };
}

function snapshotFor() {
  return buildSnapshot({
    scopeKind: 'event',
    eventId: DEFAULT_EVENT_ID,
    shiftId: null,
    sessionId: useSessionStore.getState().ensureSessionForEvent(DEFAULT_EVENT_ID),
    extraFactIds: [
      'fact-incident-001-casualty',
      'fact-incident-001-controlStatus',
      'fact-situation-001-suggestionStatus',
    ],
    label: '测试快照',
  });
}

function ruleIds(issues: ReturnType<typeof validateContent>['issues']) {
  return issues.map((i) => i.ruleId);
}

describe('校核引擎', () => {
  it('合法表述不出阻断级问题', () => {
    const content = makeContent([
      para('p-1', [{ type: 'text', text: '现场正在持续处置。人员伤亡情况待核实。相关队伍为拟预置候选。建议响应等级为 III 级（尚未确认）。' }]),
    ]);
    const report = validateContent({ documentId: 'doc-test', content, snapshot: snapshotFor() });
    expect(ruleIds(report.issues).filter((r) => ['R-004', 'R-005', 'R-006', 'R-007'].includes(r))).toEqual([]);
  });

  it('R-004：伤亡待核实时写“无人员伤亡”为 block，并给出修改建议', () => {
    const content = makeContent([para('p-1', [{ type: 'text', text: '经了解，现场无人员伤亡。' }])]);
    const report = validateContent({ documentId: 'doc-test', content, snapshot: snapshotFor() });
    const issue = report.issues.find((i) => i.ruleId === 'R-004');
    expect(issue?.level).toBe('block');
    expect(issue?.suggestionText).toContain('待核实');
  });

  it('R-005：处置中写“险情已得到有效控制”为 block', () => {
    const content = makeContent([para('p-1', [{ type: 'text', text: '目前险情已得到有效控制。' }])]);
    const report = validateContent({ documentId: 'doc-test', content, snapshot: snapshotFor() });
    expect(report.issues.find((i) => i.ruleId === 'R-005')?.level).toBe('block');
  });

  it('R-006：候选力量写“已调派”为 block（候选≠已调派）', () => {
    const content = makeContent([para('p-1', [{ type: 'text', text: '已调派 2 支队伍赶赴现场。' }])]);
    const report = validateContent({ documentId: 'doc-test', content, snapshot: snapshotFor() });
    expect(report.issues.find((i) => i.ruleId === 'R-006')?.level).toBe('block');
  });

  it('R-007：建议等级写“已确认 III 级”为 block', () => {
    const content = makeContent([para('p-1', [{ type: 'text', text: '已确认 III 级响应。' }])]);
    const report = validateContent({ documentId: 'doc-test', content, snapshot: snapshotFor() });
    expect(report.issues.find((i) => i.ruleId === 'R-007')?.level).toBe('block');
  });

  it('R-002：快照中不存在的来源绑定为 block', () => {
    const content = makeContent([para('p-1', [{ type: 'text', text: '水位' }, { type: 'fact', factId: 'fact-missing-waterLevel-demo' }])]);
    const report = validateContent({ documentId: 'doc-test', content, snapshot: snapshotFor() });
    expect(report.issues.find((i) => i.ruleId === 'R-002')?.level).toBe('block');
  });

  it('R-010：无来源数值为 block（规范第 11 章）', () => {
    const content = makeContent([para('p-1', [{ type: 'text', text: '出动车辆 12 辆。' }])]);
    const report = validateContent({ documentId: 'doc-test', content, snapshot: snapshotFor() });
    expect(report.issues.find((i) => i.ruleId === 'R-010')?.level).toBe('block');
  });

  it('applySuggestion 整段替换为规范表述（多 run 段落不残留矛盾片段）', () => {
    const content = makeContent([
      para('p-1', [
        { type: 'text', text: '经初步了解，现场无人员伤亡。已确认响应等级：' },
        { type: 'fact', factId: 'fact-situation-001-confirmedLevel' },
      ]),
    ]);
    const next = applySuggestion(content, 'p-1', '人员伤亡情况待核实。');
    expect(next.sections[0].paragraphs[0].runs).toEqual([{ type: 'text', text: '人员伤亡情况待核实。' }]);
  });

  // ── 审查缺口补充：绕过变体回归（M-4~M-7）─────────────────────────

  it('R-004 绕过变体全部命中：伤亡 0 人 / 未发现伤亡 / 暂无伤亡报告', () => {
    for (const text of ['伤亡 0 人。', '伤亡人数为 0。', '未发现伤亡。', '暂无伤亡报告。']) {
      const content = makeContent([para('p-1', [{ type: 'text', text }])]);
      const report = validateContent({ documentId: 'doc-test', content, snapshot: snapshotFor() });
      expect(report.issues.find((i) => i.ruleId === 'R-004')?.level, `未命中：${text}`).toBe('block');
    }
  });

  it('R-005 绕过变体命中：险情已得到控制（无“有效”）', () => {
    const content = makeContent([para('p-1', [{ type: 'text', text: '险情已得到控制。' }])]);
    const report = validateContent({ documentId: 'doc-test', content, snapshot: snapshotFor() });
    expect(report.issues.find((i) => i.ruleId === 'R-005')?.level).toBe('block');
  });

  it('R-006 绕过变体命中：已调派候选救援队伍 / 调派了两支队伍 / 出动了三支队伍', () => {
    for (const text of ['已调派候选救援队伍赶赴现场。', '调派了两支队伍。', '出动了三支队伍。']) {
      const content = makeContent([para('p-1', [{ type: 'text', text }])]);
      const report = validateContent({ documentId: 'doc-test', content, snapshot: snapshotFor() });
      expect(report.issues.find((i) => i.ruleId === 'R-006')?.level, `未命中：${text}`).toBe('block');
    }
  });

  it('R-006 合法表述不误报：候选力量作为限定词', () => {
    const content = makeContent([para('p-1', [{ type: 'text', text: '拟预置候选救援队伍 2 支，尚未调派。' }])]);
    const report = validateContent({ documentId: 'doc-test', content, snapshot: snapshotFor() });
    expect(report.issues.find((i) => i.ruleId === 'R-006')).toBeUndefined();
  });

  it('R-007 断言性表述命中：按 III 级响应启动 / 已确定为 III 级 / 响应等级提升至 III 级', () => {
    for (const text of ['按 III 级响应启动。', '已确定为 III 级。', '响应等级提升至 III 级。', '启动 Ⅲ 级响应。']) {
      const content = makeContent([para('p-1', [{ type: 'text', text }])]);
      const report = validateContent({ documentId: 'doc-test', content, snapshot: snapshotFor() });
      expect(report.issues.find((i) => i.ruleId === 'R-007')?.level, `未命中：${text}`).toBe('block');
    }
  });

  it('R-004/R-005/R-007 按事件动态解析事实（M-12）：B 事件伤亡待核实仍拦截，已控制/无建议等级的合规表述不误报', () => {
    useDemoStore.getState().switchEvent('evt-demo-002');
    try {
      const snapshotB = buildSnapshot({
        scopeKind: 'event',
        eventId: 'evt-demo-002',
        shiftId: null,
        sessionId: useSessionStore.getState().ensureSessionForEvent('evt-demo-002'),
        extraFactIds: ['fact-incident-002-casualty', 'fact-incident-002-controlStatus', 'fact-situation-002-suggestionStatus'],
        label: '测试快照 B',
      });
      // B 事件：controlStatus=controlled、situationFactRefs 为空（无建议等级）。
      const content = makeContent([para('p-1', [{ type: 'text', text: '现场无人员伤亡，险情已得到控制。' }])]);
      const report = validateContent({ documentId: 'doc-test', content, snapshot: snapshotB });
      // B 伤亡同样“待核实”→ R-004 必须拦截（不因切换事件失效）
      expect(report.issues.find((i) => i.ruleId === 'R-004')?.level).toBe('block');
      // B 处置状态本就是已控制 → “已得到控制”为合规表述，不误报
      expect(report.issues.find((i) => i.ruleId === 'R-005')).toBeUndefined();
      // B 无建议响应等级 → R-007 不适用
      expect(report.issues.find((i) => i.ruleId === 'R-007')).toBeUndefined();
    } finally {
      useDemoStore.getState().switchEvent('evt-demo-001');
    }
  });
});
