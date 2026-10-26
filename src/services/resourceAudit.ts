export type ResourceLedgerRow = {
  id: string; assetId: string; name: string; owner: string; quantity: number | null;
  unit: string; source: string; updatedAt: string;
};
export type ResourceAuditIssue = {
  id: string; type: '归属异常' | '重复记录' | '必填空缺' | '数量不一致';
  assetId: string; detail: string; records: ResourceLedgerRow[];
};

/** 同一物资标识在集团汇总与基地台账中对照，不把正常汇总记录当重复。 */
export function auditResourceLedger(rows: ResourceLedgerRow[]): ResourceAuditIssue[] {
  const issues: ResourceAuditIssue[] = [];
  const groups = new Map<string, ResourceLedgerRow[]>();
  for (const row of rows) {
    if (!row.assetId.trim() || !row.owner.trim() || row.quantity === null || !row.name.trim()) {
      issues.push({ id: `missing:${row.id}`, type: '必填空缺', assetId: row.assetId || '未填写',
        detail: '物资标识、名称、归属或数量缺失，需补充原台账后重新核验。', records: [row] });
    }
    if (row.assetId.trim()) groups.set(row.assetId, [...(groups.get(row.assetId) ?? []), row]);
  }
  for (const [assetId, records] of groups) {
    const bases = records.filter(r => r.source === '基地台账');
    const totals = records.filter(r => r.source === '集团汇总');
    for (const source of new Set(records.map(r => r.source))) {
      const sameSource = records.filter(r => r.source === source);
      if (sameSource.length > 1) issues.push({ id: `duplicate:${assetId}:${source}`, type: '重复记录', assetId,
        detail: `${source}中同一物资标识出现${sameSource.length}次；需核对是否为重复登记或合法拆分。`, records: sameSource });
    }
    if (new Set(records.map(r => r.owner).filter(Boolean)).size > 1) {
      issues.push({ id: `owner:${assetId}`, type: '归属异常', assetId,
        detail: '相同物资标识的归属不一致，需核对调拨记录及生效时间；不自动判定哪方正确。', records });
    }
    if (bases.length === 1 && totals.length === 1 && bases[0].quantity !== null && totals[0].quantity !== null) {
      if (bases[0].unit !== totals[0].unit) {
        issues.push({ id: `unit:${assetId}`, type: '数量不一致', assetId, detail: '计量单位不一致，不能直接比较数量。', records });
      } else if (bases[0].quantity !== totals[0].quantity) {
        issues.push({ id: `quantity:${assetId}`, type: '数量不一致', assetId,
          detail: `基地${bases[0].quantity}${bases[0].unit}，集团${totals[0].quantity}${totals[0].unit}，差额${bases[0].quantity - totals[0].quantity}${bases[0].unit}。`, records });
      }
    }
  }
  return issues;
}

export function resourceAuditSample(mode: '异常样例' | '正常样例' | '资料不足'): ResourceLedgerRow[] {
  if (mode === '资料不足') return [];
  const row = (id: string, assetId: string, name: string, owner: string, quantity: number | null, source: string): ResourceLedgerRow =>
    ({ id, assetId, name, owner, quantity, source, unit: '台', updatedAt: '2026-10-11 09:00' });
  const normal = [row('n1', 'EQ-001', '排水泵', '辽宁基地', 3, '基地台账'), row('n2', 'EQ-001', '排水泵', '辽宁基地', 3, '集团汇总')];
  if (mode === '正常样例') return normal;
  return [...normal,
    row('a1', 'EQ-002', '挖掘机', '贵州基地', 2, '基地台账'), row('a2', 'EQ-002', '挖掘机', '南宁基地', 3, '集团汇总'),
    row('a3', 'EQ-003', '发电机', '辽宁基地', 1, '基地台账'), row('a4', 'EQ-003', '发电机', '辽宁基地', 1, '基地台账'),
    row('a5', 'EQ-004', '运输车', '', null, '基地台账')];
}

/** 对话内直接回复：汇总当前资源台账哪里不对，并给出基地/集团对照要点。 */
export function formatResourceAuditChatReply(
  mode: '异常样例' | '正常样例' | '资料不足' = '异常样例',
): string {
  const rows = resourceAuditSample(mode);
  const issues = auditResourceLedger(rows);
  const checkedAt = new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' });
  if (!rows.length) {
    return [
      '已按装备清单台账规则做智能校验（模拟）。',
      '',
      '结论：当前资料不足，无法判断整体数据是否正确，也不能给出对比差额。',
      '请先补齐物资标识、名称、归属、数量及更新时点后，再发起校验。',
      `核验时点：${checkedAt}。`,
    ].join('\n');
  }
  if (!issues.length) {
    return [
      '已按装备清单台账规则做智能校验（模拟）。',
      '',
      `共核对 ${rows.length} 条记录：归属、必填字段、同源重复、基地台账与集团汇总数量均未发现异常。`,
      `核验时点：${checkedAt}。本次不修改原系统数据。`,
    ].join('\n');
  }
  const lines = issues.map((issue, index) => {
    const compare = issue.records
      .map((r) => `${r.source}：${r.name || '未命名'} / ${r.owner || '归属缺失'} / ${r.quantity === null ? '数量缺失' : `${r.quantity}${r.unit}`}`)
      .join('；');
    return `${index + 1}. 【${issue.type}】${issue.assetId}\n   ${issue.detail}\n   对照：${compare}`;
  });
  return [
    '已通过救援资源管理智能体自动校验当前资源管理数据（模拟），发现问题如下：',
    '',
    `共核对 ${rows.length} 条记录，发现 ${issues.length} 项问题：`,
    ...lines,
    '',
    '说明：基地台账与集团汇总按同一物资标识对照；不自动改写原系统，请人工核对调拨与登记后再修正。',
    `核验时点：${checkedAt}。`,
  ].join('\n');
}
