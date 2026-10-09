import { useMemo, useState } from 'react';
import { Alert, Button, Checkbox, Input, InputNumber, Space, Table, Tag, Typography } from 'antd';
import type { DisasterProfile } from '@/seed/disasterScenarios';
import OriginalSystemLink from '@/components/chat/OriginalSystemLink';

type WaveRow = {
  id: string;
  wave: string;
  peoplePlan: number;
  peopleActual: number | null;
  equipPlan: number;
  equipActual: number | null;
  damaged: number | null;
  repair: number | null;
  route: string;
  departAt: string;
  arriveAt: string;
  handover: string;
  signed: boolean;
};

function seedWaves(profile: DisasterProfile): WaveRow[] {
  const people = Math.max(8, Math.round(profile.resources.length * 12));
  return [
    {
      id: `${profile.eventId}-w1`,
      wave: '第一波次回撤',
      peoplePlan: Math.ceil(people * 0.6),
      peopleActual: null,
      equipPlan: 4,
      equipActual: null,
      damaged: null,
      repair: null,
      route: '东侧绕行 → 集结点A（示意）',
      departAt: '',
      arriveAt: '',
      handover: '',
      signed: false,
    },
    {
      id: `${profile.eventId}-w2`,
      wave: '第二波次回撤',
      peoplePlan: Math.floor(people * 0.4),
      peopleActual: null,
      equipPlan: 2,
      equipActual: null,
      damaged: null,
      repair: null,
      route: '主通道核路后通行（示意）',
      departAt: '',
      arriveAt: '',
      handover: '',
      signed: false,
    },
  ];
}

/** 回撤归建：分波次、出动/归建对照、损耗待修、移交签收（本地模拟字段）。 */
export default function WithdrawalReturn({ profile }: { profile: DisasterProfile }) {
  const [waves, setWaves] = useState<WaveRow[]>(() => seedWaves(profile));
  const [note, setNote] = useState('');
  const [exported, setExported] = useState(false);

  const patch = (id: string, patchRow: Partial<WaveRow>) => {
    setWaves((old) => old.map((w) => (w.id === id ? { ...w, ...patchRow } : w)));
    setExported(false);
  };

  const summary = useMemo(() => {
    const peopleGap = waves.map((w) => {
      if (w.peopleActual === null) return `${w.wave}：人数资料不足`;
      return `${w.wave}：归建差额 ${w.peopleActual - w.peoplePlan} 人`;
    });
    const damaged = waves.reduce((n, w) => n + (w.damaged ?? 0), 0);
    const repair = waves.reduce((n, w) => n + (w.repair ?? 0), 0);
    return [
      `事件：${profile.name}`,
      ...peopleGap,
      `损耗合计（模拟）：${waves.every((w) => w.damaged === null) ? '资料不足' : `${damaged} 件/台`}`,
      `待修合计（模拟）：${waves.every((w) => w.repair === null) ? '资料不足' : `${repair} 件/台`}`,
      `移交签收：${waves.filter((w) => w.signed).length}/${waves.length} 波次已勾选`,
      note.trim() ? `备注：${note}` : '备注：未填',
      '边界：本地演示字段，非正式回撤令/签收回执。',
    ].join('\n');
  }, [waves, note, profile.name]);

  const ready = waves.every((w) => w.peopleActual !== null && w.equipActual !== null && w.handover.trim() && w.signed);

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        title="回撤归建"
        description="分波次登记出动/归建人数与装备、损耗待修、路线与移交签收人。缺值不按零；正式审批与签收回执仍走原系统。"
      />
      <Table
        size="small"
        pagination={false}
        rowKey="id"
        scroll={{ x: 1280 }}
        dataSource={waves}
        columns={[
          { title: '波次', dataIndex: 'wave', width: 120 },
          {
            title: '计划人数',
            width: 90,
            render: (_, r) => r.peoplePlan,
          },
          {
            title: '实际归建人数',
            width: 120,
            render: (_, r) => (
              <InputNumber
                aria-label={`${r.wave}实际归建人数`}
                min={0}
                value={r.peopleActual}
                onChange={(v) => patch(r.id, { peopleActual: v })}
                style={{ width: 100 }}
              />
            ),
          },
          {
            title: '计划装备',
            width: 90,
            render: (_, r) => r.equipPlan,
          },
          {
            title: '实际归建装备',
            width: 120,
            render: (_, r) => (
              <InputNumber
                aria-label={`${r.wave}实际归建装备`}
                min={0}
                value={r.equipActual}
                onChange={(v) => patch(r.id, { equipActual: v })}
                style={{ width: 100 }}
              />
            ),
          },
          {
            title: '损耗',
            width: 90,
            render: (_, r) => (
              <InputNumber
                aria-label={`${r.wave}损耗`}
                min={0}
                value={r.damaged}
                onChange={(v) => patch(r.id, { damaged: v })}
                style={{ width: 80 }}
              />
            ),
          },
          {
            title: '待修',
            width: 90,
            render: (_, r) => (
              <InputNumber
                aria-label={`${r.wave}待修`}
                min={0}
                value={r.repair}
                onChange={(v) => patch(r.id, { repair: v })}
                style={{ width: 80 }}
              />
            ),
          },
          {
            title: '回撤路线',
            width: 180,
            render: (_, r) => (
              <Input
                aria-label={`${r.wave}回撤路线`}
                value={r.route}
                onChange={(e) => patch(r.id, { route: e.target.value })}
              />
            ),
          },
          {
            title: '出发/到达',
            width: 160,
            render: (_, r) => (
              <Space orientation="vertical" size={4}>
                <Input
                  aria-label={`${r.wave}出发时间`}
                  placeholder="出发"
                  value={r.departAt}
                  onChange={(e) => patch(r.id, { departAt: e.target.value })}
                />
                <Input
                  aria-label={`${r.wave}到达时间`}
                  placeholder="到达"
                  value={r.arriveAt}
                  onChange={(e) => patch(r.id, { arriveAt: e.target.value })}
                />
              </Space>
            ),
          },
          {
            title: '移交签收人',
            width: 120,
            render: (_, r) => (
              <Input
                aria-label={`${r.wave}移交签收人`}
                value={r.handover}
                onChange={(e) => patch(r.id, { handover: e.target.value })}
              />
            ),
          },
          {
            title: '已签收',
            width: 80,
            render: (_, r) => (
              <Checkbox
                aria-label={`${r.wave}已签收`}
                checked={r.signed}
                onChange={(e) => patch(r.id, { signed: e.target.checked })}
              />
            ),
          },
        ]}
      />
      <Input.TextArea
        aria-label="回撤归建备注"
        rows={2}
        value={note}
        onChange={(e) => { setNote(e.target.value); setExported(false); }}
        placeholder="可注明未归建原因、待修存放点、移交清单编号（模拟）"
      />
      <Button type="primary" disabled={!ready} onClick={() => setExported(true)}>
        生成回撤归建对照材料（模拟）
      </Button>
      {exported && (
        <>
          <Alert type="success" title="回撤归建对照已生成（模拟）" description="可带入原系统回撤编成/路线栏目查看。" />
          <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{summary}</Typography.Paragraph>
          <Tag>正式回撤令与签收回执待原系统确认</Tag>
          <OriginalSystemLink
            code="WITHDRAW_RETURN"
            eventId={profile.eventId}
            title={`${profile.name} · 回撤归建对照（模拟）`}
            sourceId={`${profile.eventId}:withdraw`}
            sections={[['回撤归建', summary]]}
          />
        </>
      )}
    </Space>
  );
}
