import { describe, expect, it } from 'vitest';
import {
  auditResourceLedger,
  formatResourceAuditChatReply,
  resourceAuditSample,
} from '@/services/resourceAudit';
import { useSessionStore } from '@/store/sessionStore';
import { DEFAULT_EVENT_ID } from '@/seed/scenario';

describe('物资核验与独立功能调用', () => {
  it('集团和基地正常对照不是重复，合法零库存也不是缺失', () => {
    const rows = resourceAuditSample('正常样例').map(row => ({ ...row, quantity: 0 }));
    expect(auditResourceLedger(rows)).toEqual([]);
  });
  it('差异结果保留来源记录，重复记录不参与数量累加', () => {
    const issues = auditResourceLedger(resourceAuditSample('异常样例'));
    expect(issues.map(issue => issue.type)).toEqual(expect.arrayContaining(['归属异常', '重复记录', '必填空缺', '数量不一致']));
    expect(issues.find(issue => issue.type === '数量不一致')?.records).toHaveLength(2);
    expect(issues.find(issue => issue.type === '重复记录')?.assetId).toBe('EQ-003');
    expect(issues.some(issue => issue.assetId === 'EQ-003' && issue.type === '数量不一致')).toBe(false);
  });
  it('不同单位不得直接计算数量差额', () => {
    const rows = resourceAuditSample('正常样例');
    rows[1] = { ...rows[1], unit: '套' };
    expect(auditResourceLedger(rows)[0].detail).toContain('不能直接比较');
  });
  it('执行功能不推进事件阶段或生成交接包', () => {
    const store = useSessionStore.getState();
    const sessionId = store.ensureSessionForEvent(DEFAULT_EVENT_ID);
    const before = store.sessions[sessionId];
    store.recordFlowProgress(sessionId, '生成灾情摘要');
    const after = useSessionStore.getState().sessions[sessionId];
    expect(after.eventStageOverride).toBe(before.eventStageOverride);
    expect(after.handoffBundle).toBe(before.handoffBundle);
    expect(after.completedFlowActions).toContain('生成灾情摘要');
  });

  it('对话回复直接列出整体资源数据问题与对照', () => {
    const reply = formatResourceAuditChatReply('异常样例');
    expect(reply).toMatch(/发现问题如下/);
    expect(reply).toMatch(/归属异常/);
    expect(reply).toMatch(/重复记录/);
    expect(reply).toMatch(/必填空缺/);
    expect(reply).toMatch(/数量不一致/);
    expect(reply).toMatch(/基地台账/);
    expect(reply).toMatch(/集团汇总/);
  });
});
