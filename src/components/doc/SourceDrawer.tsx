/**
 * 来源溯源抽屉（T-013）：展示事实绑定值的完整来源链路（值/核实状态/来源系统/字段/版本/时间）。
 * 人工补录事实展示补录人信息；底部展示来源记录全部字段；全部数据为模拟数据。
 */
import { useMemo } from 'react';
import { Alert, Descriptions, Drawer, Empty, Spin, Table, Tag, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useDemoStore } from '@/store/demoStore';
import { resolveFact } from '@/services/factLookup';
import { sourceById } from '@/seed/scenario';
import type { FactValue } from '@/domain/types';

export interface SourceDrawerProps {
  factId: string | null;
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

export default function SourceDrawer({ factId, open, onClose }: SourceDrawerProps) {
  const manualFacts = useDemoStore((s) => s.manualFacts);
  const resolved = useMemo(() => (factId ? resolveFact(factId) : null), [factId]);
  const manualEntry = useMemo(
    () => (factId ? manualFacts.find((m) => m.factId === factId) ?? null : null),
    [factId, manualFacts],
  );
  const sourceRecord = useMemo(
    () => (resolved ? sourceById.get(resolved.sourceRecordId) ?? null : null),
    [resolved],
  );

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
    <Drawer title={title} width={520} open={open} onClose={onClose} destroyOnHidden>
      {!factId && <Empty description="未选择正文数据（点击正文中的蓝色数据芯片查看来源）" />}
      {factId && !resolved && (
        <Alert
          type="error"
          showIcon
          message="来源无法解析"
          description={`绑定标识 ${factId} 在当前演示数据中不存在，可能来源已被移除。校核会以阻断级问题提示（模拟数据）。`}
        />
      )}
      {factId && resolved && (
        <Spin spinning={false}>
          {resolved.verification === 'pending' && (
            <Alert
              style={{ marginBottom: 12 }}
              type="warning"
              showIcon
              message="该数据处于待核实状态"
              description="签发前请通过电话或其他渠道人工复核（演示边界说明）。"
            />
          )}
          <Descriptions
            size="small"
            bordered
            column={1}
            items={[
              { key: 'value', label: '当前值', children: <strong>{displayValue(resolved.value)}{resolved.unit ?? ''}</strong> },
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

          {manualEntry && (
            <Alert
              style={{ marginTop: 12 }}
              type="info"
              showIcon
              message="人工补录（模拟）"
              description={`补录人：${manualEntry.actorName} · 演示时钟 ${manualEntry.demoClockAt} · 聊天确认后生成本补录事实，聊天原文不直接作为来源。`}
            />
          )}

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
                scroll={{ y: 200 }}
              />
            </>
          )}

          <Typography.Paragraph type="secondary" style={{ marginTop: 16, fontSize: 12 }}>
            模拟数据声明：本抽屉展示的来源链路均为演示种子数据（dataMode: mock），不代表真实系统记录。
          </Typography.Paragraph>
        </Spin>
      )}
    </Drawer>
  );
}
