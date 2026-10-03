/**
 * 资源与态势页（T-009）：上 1/3 态势示意图（SchematicMap）+ 下 2/3 资源表格 + 候选管理与派生汇总。
 * 数据源：session.lastResourceResultIds / candidateResourceIds + 种子 teams/warehouses；
 * 人数/设备/距离/ETA 一律经 factText/factNumber 从种子事实读取，派生汇总经 computeDerived 计算。
 * 点击表格行与地图高亮联动（本组件本地 state）。全部为模拟数据。
 */
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Button, Checkbox, Empty, Space, Table, Tag, Tooltip, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { computeDerived, DERIVED_META } from '@/seed/derived';
import type { DerivedKey } from '@/seed/derived';
import { factNumber, factText, teamById, warehouseById } from '@/seed/scenario';
import { resourceAllowed } from '@/services/factLookup';
import SchematicMap from './SchematicMap';
import './workspace.css';

const { Text } = Typography;

type SortKey = 'default' | 'eta' | 'distance';

interface ResourceRow {
  id: string;
  kind: 'team' | 'warehouse';
  name: string;
  people: number | null;
  excavators: number | null;
  distanceKm: number | null;
  etaMinutes: number | null;
  statusText: string;
  statusKey: string;
  material: string | null;
  stock: number | null;
}

const CANDIDATE_KEYS: DerivedKey[] = [
  'candidate_team_count',
  'candidate_people_count',
  'candidate_excavator_count',
];

function statusTag(key: string, text: string): ReactNode {
  if (key === 'available') return <Tag color="green">可调派</Tag>;
  if (key === 'busy' || key === 'on_mission') return <Tag color="orange">{text || '忙碌'}</Tag>;
  return <Tag>{text || '未知'}</Tag>;
}

export default function ResourcePanel() {
  const currentEventId = useDemoStore((s) => s.currentEventId);
  const session = useSessionStore((s) => s.sessions[s.sessionByEvent[currentEventId] ?? '']);
  const toggleCandidate = useSessionStore((s) => s.toggleCandidate);
  const removeCandidate = useSessionStore((s) => s.removeCandidate);

  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 会话切换（事件切换/重置）后清空本地选择，避免跨事件残留
  useEffect(() => {
    setSelectedId(null);
  }, [session?.sessionId]);

  const resultIds = useMemo(() => session?.lastResourceResultIds ?? [], [session?.lastResourceResultIds]);
  const candidateIds = useMemo(() => session?.candidateResourceIds ?? [], [session?.candidateResourceIds]);

  const rows: ResourceRow[] = useMemo(() => {
    const build = (id: string): ResourceRow | null => {
      const team = teamById.get(id);
      if (team) {
        return {
          id,
          kind: 'team',
          name: factText(team.factRefs.name) || id,
          people: factNumber(team.factRefs.peopleCount),
          excavators: factNumber(team.factRefs.excavatorCount),
          distanceKm: factNumber(team.factRefs.distanceKm),
          etaMinutes: factNumber(team.factRefs.etaMinutes),
          statusText: factText(team.factRefs.status),
          statusKey: factText(team.factRefs.status),
          material: null,
          stock: null,
        };
      }
      const wh = warehouseById.get(id);
      if (wh) {
        return {
          id,
          kind: 'warehouse',
          name: factText(wh.factRefs.name) || id,
          people: null,
          excavators: null,
          distanceKm: null,
          etaMinutes: null,
          statusText: '物资储备',
          statusKey: 'warehouse',
          material: factText(wh.factRefs.materialName) || null,
          stock: factNumber(wh.factRefs.stockQuantity),
        };
      }
      return null;
    };
    return resultIds.map(build).filter((r): r is ResourceRow => r != null);
  }, [resultIds]);

  const derivedStats = useMemo(
    () => CANDIDATE_KEYS.map((key) => computeDerived(key, candidateIds)),
    [candidateIds],
  );

  if (!session) {
    return <Alert type="error" showIcon message="会话未初始化" description="请稍候或重置模拟环境后重试（模拟数据）。" />;
  }

  const sortResults = (by: SortKey) => {
    const orderedIds = by === 'default'
      ? [...teamById.keys(), ...warehouseById.keys()].filter((id) => resultIds.includes(id))
      : [...rows].sort((a, b) => {
        const av = by === 'eta' ? a.etaMinutes : a.distanceKm;
        const bv = by === 'eta' ? b.etaMinutes : b.distanceKm;
        if (av == null) return bv == null ? 0 : 1;
        return bv == null ? -1 : av - bv;
      }).map((row) => row.id);
    useSessionStore.getState().setLastResourceResult(session.sessionId, orderedIds, by === 'default' ? null : by);
  };

  const columns: TableColumnsType<ResourceRow> = [
    {
      title: '候选',
      width: 56,
      render: (_, row) => {
        const reason = row.kind === 'warehouse' ? '仓库为物资储备，不能加入候选救援队伍'
          : !resourceAllowed(row.id, session.eventId) ? '未获当前事件授权'
          : row.statusKey !== 'available' ? '队伍当前不可调派' : '';
        return (
          <Tooltip title={reason || undefined}>
            <span title={reason || undefined}>
              <Checkbox
                disabled={!!reason}
                checked={candidateIds.includes(row.id)}
                onChange={(e) => {
                  e.stopPropagation();
                  toggleCandidate(session.sessionId, row.id);
                }}
                onClick={(e) => e.stopPropagation()}
                aria-label={`选择 ${row.name} 加入候选`}
                aria-description={reason || undefined}
              />
            </span>
          </Tooltip>
        );
      },
    },
    {
      title: '名称',
      render: (_, row) =>
        row.kind === 'warehouse' && row.material ? (
          <Tooltip title={`物资：${row.material} · 库存 ${row.stock ?? '—'}（模拟数据）`}>
            <span>{row.name}</span>
          </Tooltip>
        ) : (
          <span>{row.name}</span>
        ),
    },
    {
      title: '类型',
      width: 72,
      render: (_, row) => (row.kind === 'team' ? <Tag color="green">队伍</Tag> : <Tag color="blue">仓库</Tag>),
    },
    {
      title: '人数',
      width: 64,
      render: (_, row) => (row.people != null ? `${row.people} 人` : '—'),
    },
    {
      title: '挖掘机',
      width: 72,
      render: (_, row) => (row.excavators != null ? `${row.excavators} 台` : '—'),
    },
    {
      title: '距离',
      width: 76,
      render: (_, row) => (row.distanceKm != null ? `${row.distanceKm} km` : '—'),
    },
    {
      title: 'ETA',
      width: 80,
      render: (_, row) => (row.etaMinutes != null ? `${row.etaMinutes} 分钟` : '—'),
    },
    {
      title: '状态',
      width: 88,
      render: (_, row) =>
        row.kind === 'warehouse' ? <Tag color="blue">物资储备</Tag> : statusTag(row.statusKey, row.statusText),
    },
  ];

  const sortOptions: { label: string; value: SortKey }[] = [
    { label: '默认顺序', value: 'default' },
    { label: '按 ETA', value: 'eta' },
    { label: '按距离', value: 'distance' },
  ];

  return (
    <div className="axn-resource-panel">
      <div className="axn-panel-head">
        <Space size={8} align="center">
          <Text strong>资源与态势</Text>
          <Tag color="orange">模拟数据</Tag>
        </Space>
        <Space size={4}>
          {sortOptions.map((opt) => (
            <Button
              key={opt.value}
              size="small"
              type={(session.resourceSortBy ?? 'default') === opt.value ? 'primary' : 'default'}
              onClick={() => sortResults(opt.value)}
            >
              {opt.label}
            </Button>
          ))}
        </Space>
      </div>

      {/* 态势示意图（上 1/3） */}
      <SchematicMap
        highlightIds={candidateIds}
        selectedResourceId={selectedId}
        onSelectResourceId={setSelectedId}
      />

      {/* 资源表格（下 2/3） */}
      <div style={{ flex: 1, minHeight: 0, overflow: 'auto', marginTop: 10 }}>
        {rows.length === 0 ? (
          <Empty
            style={{ marginTop: 32 }}
            description={
              <span>
                尚未查询周边救援资源。
                <br />
                在左侧对话发送“查询周边救援资源”后，这里会显示可用队伍与仓库（模拟数据）。
              </span>
            }
          />
        ) : (
          <Table<ResourceRow>
            size="small"
            columns={columns}
            dataSource={rows}
            rowKey="id"
            pagination={false}
            scroll={{ y: 240 }}
            onRow={(row) => ({
              onClick: () => setSelectedId((prev) => (prev === row.id ? null : row.id)),
              style: { cursor: 'pointer' },
            })}
            rowClassName={(row) => (row.id === selectedId ? 'axn-row-selected' : '')}
          />
        )}
      </div>

      {/* 候选力量与派生汇总 */}
      <div className="axn-candidate-zone">
        <Space size={6} wrap align="center">
          <Text strong style={{ fontSize: 13 }}>
            候选力量
          </Text>
          <Tooltip title="候选力量是拟使用的资源清单，不代表已下达调派命令（模拟边界）。">
            <Tag color="gold">候选 ≠ 已调派</Tag>
          </Tooltip>
          {candidateIds.length === 0 && <Text type="secondary">尚未选择候选力量</Text>}
          {candidateIds.map((id) => {
            const team = teamById.get(id);
            const wh = warehouseById.get(id);
            const name = team ? factText(team.factRefs.name) : wh ? factText(wh.factRefs.name) : id;
            return (
              <Tag
                key={id}
                closable
                onClose={(e) => {
                  e.preventDefault();
                  removeCandidate(session.sessionId, id);
                }}
                color={team ? 'green' : 'blue'}
              >
                {name || id}
              </Tag>
            );
          })}
        </Space>

        <div className="axn-derived-row">
          {derivedStats.map((d) => (
            <Tooltip key={d.key} title={`口径：${d.formula} · 输入：${d.inputSummary}`}>
              <div className="axn-derived-item">
                <div className="axn-derived-label">{DERIVED_META[d.key].label}</div>
                <div className="axn-derived-value">
                  {d.value} <span className="axn-derived-unit">{d.unit ?? ''}</span>
                </div>
              </div>
            </Tooltip>
          ))}
          <Text type="secondary" style={{ fontSize: 12, alignSelf: 'center' }}>
            由种子事实即时计算 · 模拟数据
          </Text>
        </div>
      </div>
    </div>
  );
}
