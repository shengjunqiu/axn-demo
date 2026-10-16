import { ResultSection as Card, ResultRecords as Table } from '@/components/common/AgentResultPrimitives';
import { useMemo, useState } from 'react'
import { Button, Checkbox, Radio, Space, Tag, Typography } from 'antd'
import type { ColumnsType } from 'antd/es/table'
import type { DisasterProfile } from '@/seed/disasterScenarios'
import { resourceComposition } from '@/services/tenderScenario'
import OriginalSystemLink from '@/components/chat/OriginalSystemLink'

const PLAN_OPTIONS = [
  { scale: 1, label: '方案一 · 基线任务', hint: '按当前目标配置推荐力量' },
  { scale: 1.5, label: '方案二 · 增援任务（扩大50%）', hint: '扩大需求，突出缺口与增援量' },
  { scale: 2, label: '方案三 · 增援任务（扩大100%）', hint: '加倍配置，适合高强度处置想定' },
] as const

type CompositionRow = ReturnType<typeof resourceComposition>[number]

const COLUMNS: ColumnsType<CompositionRow> = [
  { title: '推荐资源', dataIndex: 'name' },
  { title: '专业能力', dataIndex: 'capability' },
  {
    title: '需求／库存',
    render: (_, r) => `${r.requested ?? '待核'}${r.unit} / ${r.amount}`,
  },
  {
    title: '缺口',
    render: (_, r) => (
      <Tag color={r.gap ? 'orange' : 'default'}>
        {r.gap ?? '待核'}
        {r.unit}
      </Tag>
    ),
  },
  { title: '通行条件', dataIndex: 'route' },
  { title: '可调用状态', dataIndex: 'status' },
]

export default function ResourceComposition({ profile }: { profile: DisasterProfile }) {
  const [selectedScale, setSelectedScale] = useState<number>(1)
  const [blocked, setBlocked] = useState(false)
  const [confirmed, setConfirmed] = useState(false)

  const plans = useMemo(
    () =>
      PLAN_OPTIONS.map((opt) => ({
        ...opt,
        rows: resourceComposition(profile, opt.scale, blocked),
      })),
    [profile, blocked],
  )

  const selected = plans.find((p) => p.scale === selectedScale) ?? plans[0]
  const text = `灾种：${profile.category}\n目标：${profile.objective}\n选用方案：${selected.label}；${blocked ? '主路阻断，备用通道待核' : '主通道待核'}\n${selected.rows.map((r) => `${r.name} / 需求 ${r.requested ?? '待核'}${r.unit} / 现有 ${r.amount} / 缺口 ${r.gap ?? '待核'}${r.unit} / ${r.capability}`).join('\n')}\n${confirmed ? '已确认模拟建议' : '待确认'}\n定位、距离、ETA、适配参数和实际可调用状态待核；未正式调派。`

  const selectPlan = (scale: number) => {
    setSelectedScale(scale)
    setConfirmed(false)
  }

  return (
    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
      <Checkbox
        checked={blocked}
        onChange={(e) => {
          setBlocked(e.target.checked)
          setConfirmed(false)
        }}
      >
        主路灾害阻断（模拟）
      </Checkbox>

      <Radio.Group
        aria-label="编组推荐方案"
        value={selectedScale}
        onChange={(e) => selectPlan(e.target.value)}
        style={{ width: '100%' }}
      >
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          {plans.map((plan) => {
            const active = plan.scale === selectedScale
            return (
              <Card
                key={plan.scale}
                size="small"
                data-testid={`composition-plan-${plan.scale}`}
                style={{
                  width: '100%',
                  borderColor: active ? 'var(--ant-color-primary)' : undefined,
                  boxShadow: active ? '0 0 0 1px var(--ant-color-primary)' : undefined,
                }}
                title={
                  <Space wrap size={8}>
                    <Radio value={plan.scale} aria-label={plan.label}>
                      {plan.label}
                    </Radio>
                    {active && <Tag color="blue">已选中</Tag>}
                    {confirmed && active && <Tag color="success">已确认</Tag>}
                  </Space>
                }
                extra={
                  <Typography.Text type="secondary" style={{ fontSize: 12 }}>
                    {plan.hint}
                  </Typography.Text>
                }
                onClick={() => selectPlan(plan.scale)}
              >
                <Table
                  size="small"
                  pagination={false}
                  rowKey="id"
                  scroll={{ x: 720 }}
                  dataSource={plan.rows}
                  columns={COLUMNS}
                />
              </Card>
            )
          })}
        </Space>
      </Radio.Group>

      <Space wrap>
        <Button type="primary" onClick={() => setConfirmed(true)}>
          确认模拟编组建议
        </Button>
        {confirmed && (
          <Tag color="blue">
            {selected.label} · 已核对 · 待正式调派
          </Tag>
        )}
        <OriginalSystemLink
          code="编组确认"
          eventId={profile.eventId}
          title={`${profile.name} · 智能编组推荐（模拟）`}
          sourceId={`${profile.eventId}:composition:${selected.scale}:${blocked}`}
          sections={[['资源建议', text]]}
        />
      </Space>
    </Space>
  )
}
