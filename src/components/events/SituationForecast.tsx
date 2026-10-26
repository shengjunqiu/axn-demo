import { ResultSection as Card, ResultRecords as Table } from '@/components/common/AgentResultPrimitives';
import { useState } from 'react';
import { Button, Input, Select, Space, Tag, Typography } from 'antd';
import { KvTable, Notice } from '@/components/common/ChatPrimitives';
import type { DisasterProfile } from '@/seed/disasterScenarios';
import { monitoringTrend, resourceComposition } from '@/services/tenderScenario';
import OriginalSystemLink from '@/components/chat/OriginalSystemLink';

export default function SituationForecast({
  profile,
  onWarning,
  mode = 'interactive',
}: {
  profile: DisasterProfile;
  onWarning?: () => void;
  mode?: 'interactive' | 'replay';
}) {
  const replay = mode === 'replay';
  const [minutes, setMinutes] = useState(30);
  const [scale, setScale] = useState(1);
  const [supplement, setSupplement] = useState('');
  const basis = `自动采用${profile.capturedAt}的${profile.monitoring.length}项监测指标、当前影响范围及资源候选资料；监测来源与缺测情况在结果中保留。`;
  const [result, setResult] = useState(replay);
  const reset = () => {
    if (!replay) setResult(false);
  };
  const trends = profile.monitoring.map((m) => ({ ...m, ...monitoringTrend(m, minutes) }));
  const needs = resourceComposition(profile, scale, false);
  const text = `事件：${profile.name}\n资料时间：${profile.capturedAt}\n情景时长：${minutes}分钟；以末两次记录的时间间隔线性外推（模拟，非专业预测）\n${trends.map((m) => `${m.label}：${m.latest} ${m.unit}；情景值 ${m.projection ?? '无法推演'} ${m.unit}`).join('\n')}\n影响范围：${profile.impactScope}（模拟既有范围，未计算未来边界）\n资源需求：${needs.map((n) => `${n.name} / 情景需求 ${n.requested ?? '待核'}${n.unit} / 缺口 ${n.gap ?? '待核'}${n.unit}`).join('；')}\n情景依据：${basis}\n补充现场情况（待核）：${supplement.trim() || '无新增补充'}\n次生风险：${profile.risks}\n待核：${profile.gaps}`;

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <KvTable rows={[
        { label: '关联事件', value: profile.name },
        { label: '资料时间', value: profile.capturedAt },
        { label: '当前影响范围', value: profile.impactScope },
        { label: '研判依据', value: basis },
      ]} />
      {!replay && (
        <>
          <Space wrap>
            <label>
              情景时长{' '}
              <Select
                aria-label="研判情景时长"
                value={minutes}
                onChange={(v) => {
                  setMinutes(v);
                  reset();
                }}
                options={[15, 30, 60].map((v) => ({ value: v, label: `${v} 分钟` }))}
              />
            </label>
            <label>
              任务规模{' '}
              <Select
                aria-label="资源需求情景"
                value={scale}
                onChange={(v) => {
                  setScale(v);
                  reset();
                }}
                options={[
                  { value: 1, label: '基线需求（模拟）' },
                  { value: 1.5, label: '扩大 50%（模拟）' },
                  { value: 2, label: '扩大 100%（模拟）' },
                ]}
              />
            </label>
          </Space>
          <details className="axn-result-details">
            <summary>补充现场情况（选填）</summary>
            <Typography.Paragraph type="secondary">可补充新增裂缝、降雨变化或道路阻断等线索。补充文字仅作待核说明，不会自动改变监测数值或模拟计算。</Typography.Paragraph>
            <Input.TextArea
            aria-label="补充现场情况（选填）"
            value={supplement}
            onChange={(e) => {
              setSupplement(e.target.value);
              reset();
            }}
            placeholder="例如：现场发现新增裂缝，位置和发现时间待核实"
            rows={2}
          />
          </details>
          <Button type="primary" onClick={() => setResult(true)}>
            生成研判情景（模拟）
          </Button>
        </>
      )}
      {result ? (
        <>
          {supplement.trim() && <Notice tone="info" title="补充现场情况 · 待核">{supplement.trim()}</Notice>}
          {replay && (
            <Typography.Paragraph type="secondary" style={{ marginBottom: 0 }}>
              情景时长 {minutes} 分钟 · 基线需求 · 依据已按事件资料回放
            </Typography.Paragraph>
          )}
          <Table
            size="small"
            pagination={false}
            rowKey="label"
            scroll={{ x: 650 }}
            dataSource={trends}
            columns={[
              { title: '指标／单位', render: (_, m) => `${m.label} / ${m.unit}` },
              { title: '最新记录', render: (_, m) => m.latest ?? '缺测' },
              { title: '末两次变化', render: (_, m) => m.delta ?? '无法比较' },
              {
                title: `${minutes}分钟情景值`,
                render: (_, m) =>
                  m.projection
                  ?? (/已联系|已转移|登记|获救|恢复用户|完成量/.test(m.label)
                    ? '处置进展不外推'
                    : '资料不足'),
              },
              { title: '来源', dataIndex: 'source' },
            ]}
          />
          <Card size="small" title="灾害影响范围与次生风险">
            <Typography.Paragraph>{profile.impactScope}</Typography.Paragraph>
            <Tag color="orange">未来边界待专业模型核定</Tag>
            <p>{profile.risks}</p>
            <p>专业依据及有效期：{profile.gaps}</p>
          </Card>
          <Table
            size="small"
            pagination={false}
            rowKey="id"
            scroll={{ x: 650 }}
            dataSource={needs}
            columns={[
              { title: '专业资源需求', dataIndex: 'name' },
              { title: '基线库存（模拟）', render: (_, r) => r.amount },
              { title: '情景需求', render: (_, r) => `${r.requested ?? '待核'}${r.unit}` },
              {
                title: '增援缺口',
                render: (_, r) => (
                  <Tag color={r.gap ? 'orange' : 'default'}>
                    {r.gap ?? '待核'}
                    {r.unit}
                  </Tag>
                ),
              },
              { title: '适配能力', dataIndex: 'capability' },
            ]}
          />
          <Space wrap>
            {!replay && onWarning && <Button onClick={onWarning}>预警推送</Button>}
            <OriginalSystemLink
              code="SITUATION_REPORT"
              eventId={profile.eventId}
              sourceId={`${profile.eventId}:forecast:${minutes}:${scale}`}
              title={`${profile.name} · 态势研判预警（模拟）`}
              sections={[['态势研判预警', text]]}
            />
          </Space>
        </>
      ) : (
        <Notice tone="info" title="资料已自动带入">可直接生成本事件的模拟研判，也可先调整时长与任务规模；情景值仅为模拟外推，不是专业预报。</Notice>
      )}
    </Space>
  );
}
