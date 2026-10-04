/**
 * 本地 SVG 态势示意图（T-008）：河道 / 事件点 / 救援队伍 / 物资仓库 / 水位站。
 * 几何数据来自种子 schematicMap 与各实体 schematicPosition，名称取自种子事实；
 * 图上位置不用于计算距离或 ETA（示意，非真实地图）。
 *
 * 配色：品牌蓝（仓库、候选高亮）一律取主题 token，随 theme.ts 联动；队伍绿 / 事件橙 /
 * 水位站紫 / 河道蓝属于图元语义色（数据可视化专用），与 UI 主题无关，故保留字面量。
 */
import { Alert, Space, Tag, Typography, theme } from 'antd';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { factText, incidentById, schematicMap, station, teamById, warehouseById } from '@/seed/scenario';

import { useDemoStore } from '@/store/demoStore';
import { resourceAllowed } from '@/services/factLookup';

const { Text } = Typography;

export interface SchematicMapProps {
  /** 高亮（描边）的资源 id，一般是候选力量 */
  highlightIds?: string[];
  /** 当前选中的资源 id（与资源表格联动） */
  selectedResourceId?: string | null;
  /** 点击标记或空白处回调（传 null 表示取消选择） */
  onSelectResourceId?: (id: string | null) => void;
}

interface MarkerEntity {
  id: string;
  x: number;
  y: number;
  name: string;
}

export default function SchematicMap({
  highlightIds = [],
  selectedResourceId = null,
  onSelectResourceId,
}: SchematicMapProps) {
  const { token } = theme.useToken();
  const eventId = useDemoStore(s => s.currentEventId);
  const vb = schematicMap?.viewBox;
  const riverPath = schematicMap?.riverPath ?? '';
  if (!vb || vb.length < 4 || !riverPath) {
    return <Alert type="error" showIcon title="态势示意数据不可用（模拟数据缺失）" />;
  }
  const viewBoxStr = `${vb[0]} ${vb[1]} ${vb[2]} ${vb[3]}`;

  const teamMarkers: MarkerEntity[] = [...teamById.values()].filter(t => resourceAllowed(t.resourceId, eventId)).map((t) => ({
    id: t.resourceId,
    x: t.schematicPosition.x,
    y: t.schematicPosition.y,
    name: factText(t.factRefs.name) || t.resourceId,
  }));
  const warehouseMarkers: MarkerEntity[] = [...warehouseById.values()].filter(w => resourceAllowed(w.resourceId, eventId)).map((w) => ({
    id: w.resourceId,
    x: w.schematicPosition.x,
    y: w.schematicPosition.y,
    name: factText(w.factRefs.name) || w.resourceId,
  }));
  const incidentMarkers: MarkerEntity[] = [...incidentById.values()].filter(i => i.eventId === eventId).map((i) => ({
    id: i.eventId,
    x: i.schematicPosition.x,
    y: i.schematicPosition.y,
    name: factText(i.factRefs.title) || i.eventId,
  }));

  const pickMarker = (id: string) => (event: ReactMouseEvent) => {
    event.stopPropagation();
    onSelectResourceId?.(id);
  };

  return (
    <div className="axn-schematic">
      <svg
        viewBox={viewBoxStr}
        role="img"
        aria-label="救援力量空间示意图（模拟）"
        onClick={() => onSelectResourceId?.(null)}
      >
        {/* 河道 */}
        <path d={riverPath} fill="none" stroke="#a8cdf5" strokeWidth={18} strokeLinecap="round" opacity={0.7} />
        <path d={riverPath} fill="none" stroke="#69a5ef" strokeWidth={8} strokeLinecap="round" opacity={0.8} />

        {/* 水位站（菱形） */}
        {station.eventId === eventId && <g>
          <title>{`水位站（模拟）· 观测 ${factText(station?.latestObservationId ?? '') || '—'}`}</title>
          <polygon
            points={`${station.schematicPosition.x},${station.schematicPosition.y - 9} ${station.schematicPosition.x + 9},${station.schematicPosition.y} ${station.schematicPosition.x},${station.schematicPosition.y + 9} ${station.schematicPosition.x - 9},${station.schematicPosition.y}`}
            fill="#722ed1"
            stroke={token.colorBgContainer}
            strokeWidth={1.5}
          />
        </g>}

        {/* 事件点（橙色圆） */}
        {incidentMarkers.map((m) => (
          <g key={m.id}>
            <title>{`${m.name}（模拟事件）`}</title>
            <circle cx={m.x} cy={m.y} r={9} fill="#ff8c1f" stroke={token.colorBgContainer} strokeWidth={2} />
            <text x={m.x + 13} y={m.y + 4} fontSize={12} fill="#ad4e00">
              {m.name}
            </text>
          </g>
        ))}

        {/* 物资仓库（蓝色三角） */}
        {warehouseMarkers.map((m) => {
          const selected = selectedResourceId === m.id;
          return (
            <g key={m.id} onClick={pickMarker(m.id)}>
              <title>{`${m.name}（物资仓库 · 模拟）`}</title>
              <polygon
                points={`${m.x},${m.y - 11} ${m.x - 10},${m.y + 8} ${m.x + 10},${m.y + 8}`}
                fill={selected ? token.colorPrimaryHover : token.colorPrimary}
                stroke={selected ? '#fa541c' : token.colorPrimaryActive}
                strokeWidth={selected ? 3 : 1.5}
              />
              <text x={m.x} y={m.y + 22} fontSize={11} textAnchor="middle" fill="#1c4d80">
                {m.name}
              </text>
            </g>
          );
        })}

        {/* 救援队伍（绿色方块，候选高亮描边） */}
        {teamMarkers.map((m) => {
          const highlighted = highlightIds.includes(m.id);
          const selected = selectedResourceId === m.id;
          const stroke = selected ? '#fa541c' : highlighted ? token.colorPrimary : '#2e7d0e';
          const strokeWidth = selected ? 3 : highlighted ? 2.5 : 1.5;
          return (
            <g key={m.id} onClick={pickMarker(m.id)}>
              <title>{`${m.name}${highlighted ? ' · 候选力量（≠已调派）' : ''}（模拟）`}</title>
              {highlighted && <rect x={m.x - 12} y={m.y - 12} width={24} height={24} rx={5} fill="none" stroke={token.colorPrimary} strokeWidth={1.2} opacity={0.6} />}
              <rect
                x={m.x - 9}
                y={m.y - 9}
                width={18}
                height={18}
                rx={3}
                fill={selected ? '#73d13d' : '#52c41a'}
                stroke={stroke}
                strokeWidth={strokeWidth}
              />
              <text x={m.x} y={m.y + 24} fontSize={11} textAnchor="middle" fill="#26641a">
                {m.name}
              </text>
            </g>
          );
        })}
      </svg>

      <Space size={6} wrap className="axn-legend" align="center">
        <Tag color="orange">模拟数据</Tag>
        <Text type="secondary" className="axn-legend-text">
          {schematicMap?.label ?? '空间示意 · 非真实地图'}
        </Text>
        <span className="axn-legend-item">
          <span className="axn-legend-swatch axn-legend-swatch--team" /> 队伍
        </span>
        <span className="axn-legend-item">
          <span className="axn-legend-swatch axn-legend-swatch--warehouse" /> 仓库
        </span>
        <span className="axn-legend-item">
          <span className="axn-legend-swatch axn-legend-swatch--event" /> 事件
        </span>
        <span className="axn-legend-item">
          <span className="axn-legend-swatch axn-legend-swatch--station" /> 水位站
        </span>
        <Text type="secondary" className="axn-legend-text">
          {schematicMap?.distanceRule ?? '图上位置不用于算公里数或 ETA。'}
        </Text>
      </Space>
    </div>
  );
}
