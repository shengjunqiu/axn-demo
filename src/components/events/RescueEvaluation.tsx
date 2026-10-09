import { useMemo, useState } from 'react';
import {
  Alert, Button, Card, Checkbox, Input, InputNumber, Space, Table, Tag, Typography, Upload,
} from 'antd';
import type { DisasterProfile } from '@/seed/disasterScenarios';
import OriginalSystemLink from '@/components/chat/OriginalSystemLink';

type RecordRow = {
  id: string;
  name: string;
  unit: string;
  planned: number | null;
  actual: number | null;
  plannedMinutes: number | null;
  actualMinutes: number | null;
};

type ImpactKey = 'metrics' | 'chapters' | 'knowledge';

type EvalVersion = {
  id: string;
  label: string;
  parentId: string | null;
  createdAt: string;
  frozen: boolean;
  planLabel: string;
  evidence: string;
  supplements: string[];
  impact: ImpactKey[];
  rows: RecordRow[];
  body: string;
  knowledgeNote: string;
};

const IMPACT_OPTIONS: { key: ImpactKey; label: string }[] = [
  { key: 'metrics', label: '投入/时效指标' },
  { key: 'chapters', label: '总结章节' },
  { key: 'knowledge', label: '知识候选' },
];

function cloneRows(rows: RecordRow[]): RecordRow[] {
  return rows.map((r) => ({ ...r }));
}

function buildBody(
  profile: DisasterProfile,
  evidence: string,
  rows: RecordRow[],
  planLabel: string,
  supplements: string[],
): string {
  return [
    `事件：${profile.name}`,
    `有效计划版本（模拟）：${planLabel}`,
    `统计口径：${evidence}`,
    supplements.length ? `补证材料：${supplements.join('；')}` : '补证材料：无',
    ...rows.map((r) => `${r.name}：计划 ${r.planned ?? '未填'}${r.unit}，实际 ${r.actual ?? '未填'}${r.unit}，投入差额 ${r.planned === null || r.actual === null ? '资料不足' : r.actual - r.planned}${r.unit}；计划到位 ${r.plannedMinutes ?? '未填'}min，实际到位 ${r.actualMinutes ?? '未填'}min，时间偏差 ${r.plannedMinutes === null || r.actualMinutes === null ? '资料不足' : r.actualMinutes - r.plannedMinutes}min`),
    `阶段成效（事件模拟基线）：${profile.completed}/${profile.target}${profile.unit}；${profile.objective}`,
    `剩余风险：${profile.risks}`,
    `改进：${profile.gaps}`,
    '上述投入及到位值由演示人员填写并核对，未取得真实调派凭证；计划与实际差额不直接等于资源效率或浪费。',
  ].join('\n');
}

/** 复盘评估 + E05 补证重算与评估版本（本地模拟字段）。 */
export default function RescueEvaluation({ profile }: { profile: DisasterProfile }) {
  const [rows, setRows] = useState<RecordRow[]>(() => profile.resources.map((r, i) => ({
    id: `${profile.eventId}-${i}`,
    name: r.name,
    unit: r.amount.replace(/^[\d.]+/, '') || '项',
    planned: null,
    actual: null,
    plannedMinutes: null,
    actualMinutes: null,
  })));
  const [evidence, setEvidence] = useState('');
  const [planLabel, setPlanLabel] = useState('执行计划 V1（模拟）');
  const [verified, setVerified] = useState(false);
  const [supplements, setSupplements] = useState<string[]>([]);
  const [impact, setImpact] = useState<ImpactKey[]>(['metrics']);
  const [versions, setVersions] = useState<EvalVersion[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [compareId, setCompareId] = useState<string | null>(null);
  const [knowledgeNote, setKnowledgeNote] = useState('');

  const active = versions.find((v) => v.id === activeId) ?? null;
  const compare = versions.find((v) => v.id === compareId) ?? null;

  const edit = (
    id: string,
    key: keyof Pick<RecordRow, 'planned' | 'actual' | 'plannedMinutes' | 'actualMinutes'>,
    value: number | null,
  ) => {
    setRows((old) => old.map((r) => (r.id === id ? { ...r, [key]: value } : r)));
    setVerified(false);
  };

  const number = (
    key: keyof Pick<RecordRow, 'planned' | 'actual' | 'plannedMinutes' | 'actualMinutes'>,
    title: string,
  ) => ({
    title,
    render: (_: unknown, r: RecordRow) => (
      <InputNumber
        aria-label={`${r.name}${title}`}
        min={0}
        value={r[key]}
        onChange={(v) => edit(r.id, key, v)}
        style={{ width: 110 }}
      />
    ),
  });

  const canSave = evidence.trim() && verified && rows.some((r) => r.planned !== null && r.actual !== null);

  const saveVersion = (asRecalc: boolean) => {
    const id = crypto.randomUUID();
    const parent = versions.at(-1) ?? null;
    if (parent) {
      setVersions((old) => old.map((v) => (v.id === parent.id ? { ...v, frozen: true } : v)));
    }
    const body = buildBody(profile, evidence, rows, planLabel, supplements);
    const kn = impact.includes('knowledge')
      ? (knowledgeNote.trim() || `候选待审变更：依据 ${planLabel} 补证后更新适用边界（模拟）`)
      : '未勾选知识候选影响';
    const next: EvalVersion = {
      id,
      label: asRecalc ? `补证重算 V${versions.length + 1}` : `评估 V${versions.length + 1}`,
      parentId: parent?.id ?? null,
      createdAt: new Date().toISOString(),
      frozen: false,
      planLabel,
      evidence,
      supplements: [...supplements],
      impact: [...impact],
      rows: cloneRows(rows),
      body,
      knowledgeNote: kn,
    };
    setVersions((old) => [...old, next]);
    setActiveId(id);
    if (parent) setCompareId(parent.id);
  };

  const diffLines = useMemo(() => {
    if (!active || !compare) return [];
    return active.rows.map((r) => {
      const prev = compare.rows.find((x) => x.id === r.id);
      const fmt = (a: number | null, b: number | null, unit: string) => {
        if (a === null || b === null) return '资料不足';
        return `${b - a}${unit}`;
      };
      return {
        id: r.id,
        name: r.name,
        qty: prev ? `${prev.actual ?? '—'} → ${r.actual ?? '—'}（差额变化 ${fmt(prev.actual, r.actual, r.unit)}）` : `${r.actual ?? '—'}`,
        time: prev
          ? `${prev.actualMinutes ?? '—'} → ${r.actualMinutes ?? '—'} min`
          : `${r.actualMinutes ?? '—'} min`,
      };
    });
  }, [active, compare]);

  return (
    <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
      <Alert
        type="info"
        showIcon
        title="复盘评估分析 · 补证重算与评估版本"
        description="核对审定计划与执行证据；支持补证、勾选影响范围、冻结前版并局部重算对照。缺值不计算偏差；正式审定走原系统。"
      />
      <Space wrap>
        <Typography.Text>有效计划版本</Typography.Text>
        <Input
          aria-label="有效计划版本"
          value={planLabel}
          onChange={(e) => { setPlanLabel(e.target.value); setVerified(false); }}
          style={{ width: 260 }}
        />
      </Space>
      <Table
        size="small"
        pagination={false}
        rowKey="id"
        scroll={{ x: 1050 }}
        dataSource={rows}
        columns={[
          { title: '专业资源／单位', render: (_, r) => `${r.name} / ${r.unit}` },
          number('planned', '计划数量'),
          number('actual', '实际数量'),
          {
            title: '投入偏差',
            render: (_, r) => (r.planned === null || r.actual === null ? '资料不足' : `${r.actual - r.planned}${r.unit}`),
          },
          number('plannedMinutes', '计划到位（min）'),
          number('actualMinutes', '实际到位（min）'),
          {
            title: '时效偏差',
            render: (_, r) => (r.plannedMinutes === null || r.actualMinutes === null ? '资料不足' : `${r.actualMinutes - r.plannedMinutes}min`),
          },
        ]}
      />
      <Typography.Text>
        当前阶段目标（模拟）：{profile.objective} {profile.completed}/{profile.target}{profile.unit}；不等同综合救援成效。
      </Typography.Text>
      <Input.TextArea
        aria-label="评估证据与统计口径"
        value={evidence}
        onChange={(e) => { setEvidence(e.target.value); setVerified(false); }}
        rows={3}
        placeholder="填写计划版本、统计截止时刻、实际回执来源及偏差原因；可注明缺证事项"
      />
      <Card size="small" title="E05 · 补充证据或修订执行记录">
        <Upload
          beforeUpload={(file) => {
            setSupplements((old) => [...old, file.name]);
            setVerified(false);
            return false;
          }}
          showUploadList={false}
        >
          <Button>登记补证文件（模拟，仅文件名）</Button>
        </Upload>
        <div style={{ marginTop: 8 }}>
          {supplements.length === 0
            ? <Typography.Text type="secondary">尚未登记补证</Typography.Text>
            : supplements.map((name) => <Tag key={name}>{name}</Tag>)}
        </div>
      </Card>
      <Card size="small" title="E05 · 确认受影响范围">
        <Checkbox.Group
          options={IMPACT_OPTIONS.map((o) => ({ label: o.label, value: o.key }))}
          value={impact}
          onChange={(v) => setImpact(v as ImpactKey[])}
        />
        {impact.includes('knowledge') && (
          <Input.TextArea
            aria-label="知识候选变更说明"
            style={{ marginTop: 8 }}
            rows={2}
            value={knowledgeNote}
            onChange={(e) => setKnowledgeNote(e.target.value)}
            placeholder="描述受影响知识候选、适用边界与待审变更建议（模拟）"
          />
        )}
      </Card>
      <Checkbox checked={verified} onChange={(e) => setVerified(e.target.checked)}>
        已人工核对填写值与过程资料（模拟）
      </Checkbox>
      <Space wrap>
        <Button type="primary" disabled={!canSave} onClick={() => saveVersion(false)}>
          保存评估版本（模拟）
        </Button>
        <Button disabled={!canSave || versions.length === 0} onClick={() => saveVersion(true)}>
          局部重算并生成新版本（模拟）
        </Button>
      </Space>
      {versions.length > 0 && (
        <Card size="small" title="评估版本列表">
          <Table
            size="small"
            pagination={false}
            rowKey="id"
            dataSource={[...versions].reverse()}
            columns={[
              { title: '版本', dataIndex: 'label' },
              { title: '计划基线', dataIndex: 'planLabel', width: 160 },
              {
                title: '状态',
                width: 90,
                render: (_, v) => (v.frozen ? <Tag>已冻结</Tag> : <Tag color="blue">当前</Tag>),
              },
              {
                title: '影响',
                render: (_, v) => v.impact.map((k) => IMPACT_OPTIONS.find((o) => o.key === k)?.label).join('、'),
              },
              {
                title: '操作',
                width: 180,
                render: (_, v) => (
                  <Space>
                    <Button size="small" onClick={() => setActiveId(v.id)}>查看</Button>
                    <Button size="small" disabled={v.id === activeId} onClick={() => setCompareId(v.id)}>对照</Button>
                  </Space>
                ),
              },
            ]}
          />
        </Card>
      )}
      {active && (
        <>
          <Alert type="success" title={`${active.label} 已生成（模拟）`} description="前版证据保持可查；未勾选范围不改写。" />
          <Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{active.body}</Typography.Paragraph>
          <Typography.Text type="secondary">{active.knowledgeNote}</Typography.Text>
          <OriginalSystemLink
            code="RESCUE_EVAL"
            eventId={profile.eventId}
            title={`${profile.name} · ${active.label}（模拟）`}
            sourceId={`${profile.eventId}:evaluation:${active.id}`}
            sections={[['复盘评估分析', active.body], ['知识候选影响', active.knowledgeNote]]}
          />
        </>
      )}
      {active && compare && active.id !== compare.id && (
        <Card size="small" title={`版本对照：${compare.label} → ${active.label}`}>
          <Table
            size="small"
            pagination={false}
            rowKey="id"
            dataSource={diffLines}
            columns={[
              { title: '资源', dataIndex: 'name' },
              { title: '实际数量变化', dataIndex: 'qty' },
              { title: '实际到位变化', dataIndex: 'time' },
            ]}
          />
        </Card>
      )}
    </Space>
  );
}
