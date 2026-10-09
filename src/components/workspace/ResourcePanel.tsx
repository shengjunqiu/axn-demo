import { exportResourceExcel } from '@/services/prototypeExports';
/**
 * 资源与态势页（T-009）：Tab 切换「资源列表 / 态势地图」+ 候选管理与派生汇总。
 * 数据源：session.lastResourceResultIds（查询结果）优先；为空时回退本事件种子资源，
 * 便于客户演示打开抽屉即见内容。候选管理仍走 candidateResourceIds。
 * 全部为模拟数据。
 */
import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Button, Checkbox, Empty, Space, Table, Tabs, Tag, Tooltip, Typography } from 'antd';
import type { TableColumnsType } from 'antd';
import { useConversationStore } from '@/store/conversationStore';
import { useDemoStore } from '@/store/demoStore';
import { useSessionStore } from '@/store/sessionStore';
import { computeDerived, DERIVED_META } from '@/seed/derived';
import type { DerivedKey } from '@/seed/derived';
import { factNumber, factText, teamById, warehouseById } from '@/seed/scenario';
import { seedResourceIdsForEvent, vueDemoResourceById, type VueDemoResourceKind } from '@/seed/vueDemoResources';
import { resourceAllowed } from '@/services/factLookup';
import { resetDemoData } from '@/store/resetDemo';
import SchematicMap, { type SchematicOverlayMarker } from './SchematicMap';
import './workspace.css';

const { Text } = Typography;

type SortKey = 'default' | 'eta' | 'distance';
type PanelTab = 'list' | 'map';

interface ResourceRow {
  id: string;
  kind: VueDemoResourceKind;
  name: string;
  people: number | null;
  excavators: number | null;
  distanceKm: number | null;
  etaMinutes: number | null;
  statusText: string;
  statusKey: string;
  material: string | null;
  stock: number | null;
  distanceLabel?: string;
  amountLabel?: string;
  demo: boolean;
  selectable: boolean;
}

const CANDIDATE_KEYS: DerivedKey[] = [
  'candidate_team_count',
  'candidate_people_count',
  'candidate_excavator_count',
];

function statusTag(key: string, text: string): ReactNode {
  if (key === 'available') return <Tag color="green">可调派</Tag>;
  if (key === 'busy' || key === 'on_mission') return <Tag color="orange">{text || '忙碌'}</Tag>;
  if (key === 'demo') return <Tag color="blue">{text || '演示'}</Tag>;
  return <Tag>{text || '未知'}</Tag>;
}

function kindTag(kind: ResourceRow['kind']): ReactNode {
  if (kind === 'team') return <Tag color="green">队伍</Tag>;
  if (kind === 'warehouse') return <Tag color="blue">仓库</Tag>;
  if (kind === 'equipment') return <Tag color="cyan">装备</Tag>;
  if (kind === 'hospital') return <Tag color="purple">医院</Tag>;
  if (kind === 'hotel') return <Tag color="gold">宾馆</Tag>;
  if (kind === 'gasStation') return <Tag color="orange">加油站</Tag>;
  if (kind === 'supportUnit') return <Tag color="lime">保障单元</Tag>;
  if (kind === 'expert') return <Tag color="magenta">专家</Tag>;
  if (kind === 'school') return <Tag color="geekblue">学校</Tag>;
  return <Tag>其他</Tag>;
}

export default function ResourcePanel({ initialTab = 'list' }: { initialTab?: PanelTab }) {
  const currentEventId = useDemoStore((s) => s.currentEventId);
  const activeConversationId = useConversationStore((s) => s.activeConversationId);
  const sessionId = useSessionStore((s) => {
    const byConversation = activeConversationId ? s.sessionByConversation[activeConversationId] : undefined;
    return byConversation ?? s.sessionByEvent[currentEventId] ?? '';
  });
  const session = useSessionStore((s) => s.sessions[sessionId]);
  const toggleCandidate = useSessionStore((s) => s.toggleCandidate);
  const removeCandidate = useSessionStore((s) => s.removeCandidate);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<PanelTab>(initialTab);

  useEffect(() => {
    setSelectedId(null);
    setActiveTab(initialTab);
  }, [session?.sessionId, initialTab]);

  const queriedIds = useMemo(() => session?.lastResourceResultIds ?? [], [session?.lastResourceResultIds]);
  const eventId = session?.eventId ?? currentEventId;
  const isSeedPreview = queriedIds.length === 0;
  const displayIds = useMemo(
    () => (queriedIds.length > 0 ? queriedIds : seedResourceIdsForEvent(eventId)),
    [queriedIds, eventId],
  );
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
          demo: false,
          selectable: resourceAllowed(id, eventId) && factText(team.factRefs.status) === 'available',
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
          demo: false,
          selectable: false,
        };
      }
      const demo = vueDemoResourceById.get(id);
      if (demo && demo.eventId === eventId) {
        return {
          id,
          kind: demo.kind,
          name: demo.name,
          people: null,
          excavators: null,
          distanceKm: null,
          etaMinutes: null,
          statusText: demo.status,
          statusKey: 'demo',
          material: demo.capability,
          stock: null,
          distanceLabel: demo.distanceLabel,
          amountLabel: demo.amountLabel,
          demo: true,
          selectable: demo.selectable,
        };
      }
      return null;
    };
    return displayIds.map(build).filter((r): r is ResourceRow => r != null);
  }, [displayIds, eventId]);

  const overlayMarkers: SchematicOverlayMarker[] = useMemo(
    () => rows.filter((row) => row.demo).map((row) => {
      const demo = vueDemoResourceById.get(row.id)!;
      return {
        id: row.id,
        kind: row.kind,
        x: demo.schematicPosition.x,
        y: demo.schematicPosition.y,
        name: row.name,
      };
    }),
    [rows],
  );

  const derivedStats = useMemo(
    () => CANDIDATE_KEYS.map((key) => computeDerived(key, candidateIds.filter((id) => teamById.has(id)))),
    [candidateIds],
  );

  if (!session) {
    return (
      <Alert
        type="error"
        showIcon
        title="会话未初始化"
        description="请稍候或重置模拟环境后重试（模拟数据）。"
        action={
          <Button size="small" onClick={() => resetDemoData()}>
            重置演示数据
          </Button>
        }
      />
    );
  }

  const sortResults = (by: SortKey) => {
    const ledgerRows = rows.filter((row) => !row.demo);
    const orderedIds = by === 'default'
      ? [...teamById.keys(), ...warehouseById.keys()].filter((id) => displayIds.includes(id))
        .concat(displayIds.filter((id) => vueDemoResourceById.has(id)))
      : [...ledgerRows].sort((a, b) => {
        const av = by === 'eta' ? a.etaMinutes : a.distanceKm;
        const bv = by === 'eta' ? b.etaMinutes : b.distanceKm;
        if (av == null) return bv == null ? 0 : 1;
        return bv == null ? -1 : av - bv;
      }).map((row) => row.id)
        .concat(displayIds.filter((id) => vueDemoResourceById.has(id)));
    useSessionStore.getState().setLastResourceResult(session.sessionId, orderedIds, by === 'default' ? null : by);
  };

  const columns: TableColumnsType<ResourceRow> = [
    {
      title: '候选',
      width: 56,
      render: (_, row) => {
        const reason = !row.selectable
          ? row.demo ? '演示叠加资源：待核/外部项不可加入正式候选' : row.kind === 'warehouse' ? '仓库为物资储备，不能加入候选救援队伍'
            : !resourceAllowed(row.id, session.eventId) ? '未获当前事件授权' : '队伍当前不可调派'
          : '';
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
        row.material ? (
          <Tooltip title={`${row.demo ? '能力' : '物资'}：${row.material}${row.stock != null ? ` · 库存 ${row.stock}` : ''}（模拟数据）`}>
            <span>{row.name}</span>
          </Tooltip>
        ) : (
          <span>{row.name}</span>
        ),
    },
    {
      title: '类型',
      width: 80,
      render: (_, row) => kindTag(row.kind),
    },
    {
      title: '数量',
      width: 96,
      render: (_, row) => {
        if (row.amountLabel) return row.amountLabel;
        if (row.people != null) return `${row.people} 人`;
        if (row.stock != null) return `${row.stock}`;
        return '—';
      },
    },
    {
      title: '挖掘机',
      width: 72,
      render: (_, row) => (row.excavators != null ? `${row.excavators} 台` : '—'),
    },
    {
      title: '距离',
      width: 100,
      render: (_, row) => row.distanceLabel ?? (row.distanceKm != null ? `${row.distanceKm} km` : '—'),
    },
    {
      title: 'ETA',
      width: 80,
      render: (_, row) => (row.etaMinutes != null ? `${row.etaMinutes} 分钟` : row.demo ? '—' : '—'),
    },
    {
      title: '状态',
      width: 120,
      render: (_, row) =>
        row.kind === 'warehouse' && !row.demo
          ? <Tag color="blue">物资储备</Tag>
          : statusTag(row.statusKey, row.statusText),
    },
  ];

  const sortOptions: { label: string; value: SortKey }[] = [
    { label: '默认顺序', value: 'default' },
    { label: '按 ETA', value: 'eta' },
    { label: '按距离', value: 'distance' },
  ];

  const listPane = rows.length === 0 ? (
    <Empty
      style={{ marginTop: 32 }}
      description={
        <span>
          当前事件暂无演示资源种子。
          <br />
          可在左侧对话发送“查询周边救援资源”，或改选其他建设/灾种事件（模拟数据）。
        </span>
      }
    />
  ) : (
    <>
      {isSeedPreview ? (
        <Text type="secondary" className="axn-tc-fs12" data-testid="resource-seed-preview-hint" style={{ display: 'block', marginBottom: 8 }}>
          本事件演示资源（未执行查询时预览）；发送“查询周边救援资源”可刷新为查询结果。
        </Text>
      ) : null}
      <Table<ResourceRow>
        size="small"
        columns={columns}
        dataSource={rows}
        rowKey="id"
        pagination={false}
        scroll={{ x: 'max-content', y: 360 }}
        onRow={(row) => ({
          onClick: () => {
            setSelectedId((prev) => (prev === row.id ? null : row.id));
            setActiveTab('map');
          },
          style: { cursor: 'pointer' },
        })}
        rowClassName={(row) => (row.id === selectedId ? 'axn-row-selected' : '')}
      />
    </>
  );

  return (
    <div className="axn-resource-panel" data-testid="resource-panel">
      <div className="axn-panel-head">
        <Space size={8} align="center">
          <Text strong>资源与态势</Text>
          <Button size="small" disabled={!rows.length} onClick={() => exportResourceExcel(['资源ID', '名称', '类型', '人数', '设备数', '模拟距离(km)', '模拟ETA(分钟)'], rows.map(row => [row.id, row.name, row.kind, String(row.people ?? '待核'), String(row.excavators ?? '待核'), String(row.distanceKm ?? '待核'), String(row.etaMinutes ?? '待核')]))}>导出资源 Excel</Button>
          <Tag color="orange">模拟数据</Tag>
        </Space>
        <Space size={4}>
          {sortOptions.map((opt) => (
            <Button
              key={opt.value}
              size="small"
              type={(session.resourceSortBy ?? 'default') === opt.value ? 'primary' : 'default'}
              onClick={() => sortResults(opt.value)}
              disabled={rows.every((row) => row.demo) && opt.value !== 'default'}
            >
              {opt.label}
            </Button>
          ))}
        </Space>
      </div>
      <Alert
        type="info"
        showIcon
        style={{ marginBottom: 8 }}
        title="数据更新时效"
        description="台账常见维护周期最长约半年；可出动状态必须以状态更新时间为准，过期快照不直接出动。列表含队伍/装备/物资/专家/保障单元及学校、医院、宾馆、加油站等影响目标（演示）。"
      />

      <Tabs
        className="axn-resource-tabs"
        activeKey={activeTab}
        onChange={(key) => setActiveTab(key as PanelTab)}
        destroyOnHidden
        items={[
          {
            key: 'list',
            label: '资源列表',
            children: (
              <div className="axn-resource-tab-body" data-testid="resource-tab-list">
                {listPane}
              </div>
            ),
          },
          {
            key: 'map',
            label: '态势地图',
            children: (
              <div className="axn-resource-tab-body" data-testid="resource-tab-map">
                <SchematicMap
                  highlightIds={candidateIds}
                  selectedResourceId={selectedId}
                  onSelectResourceId={setSelectedId}
                  resultIds={displayIds}
                  overlayMarkers={overlayMarkers}
                />
                <Text type="secondary" className="axn-resource-map-hint">
                  点击地图标记或列表行可联动高亮；建设场景点位为分布示意，不用于计算公里数或 ETA。
                </Text>
              </div>
            ),
          },
        ]}
      />

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
            const demo = vueDemoResourceById.get(id);
            const name = team ? factText(team.factRefs.name) : wh ? factText(wh.factRefs.name) : demo?.name ?? id;
            return (
              <Tag
                key={id}
                closable
                onClose={(e) => {
                  e.preventDefault();
                  removeCandidate(session.sessionId, id);
                }}
                color={team ? 'green' : demo ? 'cyan' : 'blue'}
              >
                {name || id}
              </Tag>
            );
          })}
        </Space>

        <div className="axn-derived-row">
          {candidateIds.length > 0 && candidateIds.every(id => vueDemoResourceById.has(id)) ? <Space wrap><Text strong>模拟候选 {candidateIds.length} 项</Text>{candidateIds.map(id => { const resource = vueDemoResourceById.get(id)!; return <Tag key={id}>{resource.name} · {resource.amountLabel}</Tag>; })}<Text type="secondary">示例数量分别列示，尚未形成批准的人装编组。</Text></Space> : derivedStats.map((d) => (
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
            {candidateIds.length > 0 && candidateIds.every(id => vueDemoResourceById.has(id)) ? '当前事件独立资源样例 · 模拟数据' : '由种子事实即时计算 · 模拟数据'}
          </Text>
        </div>
      </div>
    </div>
  );
}
