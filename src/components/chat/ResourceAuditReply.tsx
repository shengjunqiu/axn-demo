import { useState } from 'react';
import { ChoiceChips, KvTable, Notice, Section, StatusPill } from '@/components/common/ChatPrimitives';
import { auditResourceLedger, type ResourceLedgerRow } from '@/services/resourceAudit';
import './agent-results.css';

/** 消息内核验：摘要 → 问题筛选 → 差异依据 → 可展开的原始台账，不改动源记录。 */
export default function ResourceAuditReply({ rows, checkedAt }: { rows: ResourceLedgerRow[]; checkedAt: string }) {
  const issues = auditResourceLedger(rows);
  const [filter, setFilter] = useState('全部');
  const options = ['全部', ...new Set(issues.map(issue => issue.type))];
  return <div className="axn-resource-audit" data-testid="resource-audit-reply">
    <KvTable rows={[{ label: '物资核验', value: !rows.length ? '资料不足，无法核验。' : `已核对 ${rows.length} 条记录，发现 ${issues.length} 项问题。` }, { label: '核验时点', value: checkedAt }]} />
    <Notice tone={issues.length || !rows.length ? 'warn' : 'ok'} title={issues.length ? '存在待核差异' : rows.length ? '未发现规则内异常' : '请先补齐台账资料'}>当前为本地模拟台账；请核对原始单据和调拨记录后修正，不自动修改原系统。</Notice>
    {issues.length > 0 && <ChoiceChips options={options} value={filter} onChange={setFilter} />}
    {issues.filter(issue => filter === '全部' || issue.type === filter).map(issue => <Section key={issue.id} title={`${issue.type} · ${issue.assetId}`} warn>
      <StatusPill tone="warn">待核实</StatusPill><p>{issue.detail}</p>
      <details className="axn-result-details"><summary>查看对照记录 · {issue.records.length} 条</summary>
        {issue.records.map(record => <KvTable key={record.id} rows={[
          { label: '来源', value: record.source }, { label: '名称', value: record.name || '缺失' },
          { label: '归属', value: record.owner || '缺失' }, { label: '数量', value: record.quantity === null ? '缺失' : `${record.quantity}${record.unit}` },
          { label: '更新时点', value: record.updatedAt },
        ]} />)}
      </details>
    </Section>)}
  </div>;
}
