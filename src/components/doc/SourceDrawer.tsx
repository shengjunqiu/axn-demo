/**
 * 来源溯源抽屉（T-013）：展示事实绑定值的完整来源链路（值/核实状态/来源系统/字段/版本/时间）。
 * 人工补录事实展示补录人信息；底部展示来源记录全部字段；全部数据为模拟数据。
 */
import { useMemo } from 'react';
import { Alert, Descriptions, Drawer, Empty, Spin, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useDocumentStore } from '@/store/documentStore';
import { resolveDocumentFact } from '@/services/documentFactScope';
import type { FactValue } from '@/domain/types';

export interface SourceDrawerProps {
  factId: string | null;
  documentId: string | null;
  open: boolean;
  onClose: () => void;
}

const VERIFICATION_TAG: Record<string, { color: string; label: string }> = {
  confirmed: { color: 'green', label: '已核实' },
  pending: { color: 'orange', label: '待核实' },
  suggested: { color: 'blue', label: '系统建议' },
};

function displayValue(value: FactValue): string {
  if (value == null) return '（来源缺失）';
  if (Array.isArray(value)) return value.join('、');
  return String(value);
}

function formatIso(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

interface FieldRow {
  key: string;
  value: string;
}

const FIELD_COLUMNS: TableColumnsType<FieldRow> = [
  { title: '字段', dataIndex: 'key', key: 'key', width: 130 },
  { title: '值（模拟）', dataIndex: 'value', key: 'value' },
];

export default function SourceDrawer({ factId, documentId, open, onClose }: SourceDrawerProps) {
  const draft = useDocumentStore((s) => documentId ? s.drafts[documentId] : undefined);
  const derived = factId?.startsWith('derived:') ? draft?.snapshot.derived[factId.slice(8)] : undefined;
  const resolved = factId ? resolveDocumentFact(factId, draft) : null;
  const sourceRecord = resolved ? draft?.snapshot.sources?.[resolved.sourceRecordId] : null;
  const fieldRows: FieldRow[] = useMemo(
    () =>
      sourceRecord
        ? Object.entries(sourceRecord.fields).map(([key, value]) => ({ key, value: displayValue(value) }))
        : [],
    [sourceRecord],
  );

  const title = resolved
    ? `事实来源 · ${resolved.sourceFieldKey}`
    : factId
      ? '事实来源'
      : '来源溯源';

  return (
    <Drawer
      title={title}
      size={520}
      open={open} onClose={onClose} destroyOnHidden>
      {!factId && <Empty description="未选择正文数据（点击正文中的蓝色数据芯片查看来源）" />}
      {factId && !resolved && !derived && (
        <Alert
          type="error"
          showIcon
          title="来源无法解析"
          description={`绑定标识 ${factId} 在本文书范围内无法解析，可能来源缺失或不属于本文书授权范围。校核会以阻断级问题提示（模拟数据）。`}
        />
      )}
      {derived && <Descriptions column={1} bordered items={[
        { key: 'value', label: '快照派生值', children: `${derived.value}${derived.unit ?? ''}` },
        { key: 'formula', label: '公式', children: derived.formula },
        { key: 'inputs', label: '输入事实', children: derived.inputFactIds.join('、') || '无输入事实' },
        { key: 'summary', label: '计算范围', children: derived.inputSummary },
      ]} />}
      {factId && resolved && (
        <Spin spinning={false}>
          {resolved.verification === 'pending' && (
            <Alert
              style={{ marginBottom: 12 }}
              type="warning"
              showIcon
              title="该数据处于待核实状态"
              description="签发前请通过电话或其他渠道人工复核（边界说明）。"
            />
          )}
          <Descriptions
            size="small"
            bordered
            column={1}
            items={[
              { key: 'value', label: '快照值', children: <strong>{displayValue(resolved.value)}{resolved.unit ?? ''}</strong> },
              {
                key: 'verification',
                label: '核实状态',
                children: (
                  <Tag color={VERIFICATION_TAG[resolved.verification]?.color ?? 'default'}>
                    {VERIFICATION_TAG[resolved.verification]?.label ?? resolved.verification}
                  </Tag>
                ),
              },
              { key: 'sourceSystem', label: '来源系统', children: resolved.sourceSystem },
              {
                key: 'sourceLabel',
                label: '来源记录',
                children: sourceRecord?.label ?? resolved.sourceLabel,
              },
              ...(sourceRecord
                ? [
                    { key: 'table', label: '来源表', children: sourceRecord.sourceTable },
                    { key: 'objectId', label: '对象标识', children: sourceRecord.objectId },
                  ]
                : []),
              { key: 'field', label: '来源字段', children: resolved.sourceFieldKey },
              { key: 'version', label: '来源版本', children: `v${resolved.sourceVersion}` },
              { key: 'capturedAt', label: '采集时间', children: formatIso(resolved.capturedAt) },
              { key: 'factId', label: '事实标识', children: <Typography.Text code>{resolved.factId}</Typography.Text> },
            ]}
          />

          {sourceRecord && (
            <>
              <Typography.Title level={5} style={{ margin: '16px 0 8px' }}>
                来源记录字段
              </Typography.Title>
              <Table<FieldRow>
                size="small"
                columns={FIELD_COLUMNS}
                dataSource={fieldRows}
                rowKey="key"
                pagination={false}
                scroll={{ x: 'max-content', y: 200 }}
              />
            </>
          )}

          <Typography.Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
            模拟数据声明：本抽屉展示的来源链路均为种子模拟数据（dataMode: mock），不代表真实系统记录。
          </Typography.Paragraph>
        </Spin>
      )}
    </Drawer>
  );
}
