import { useState, useRef, useEffect } from 'react';
import { Layers, Minus, Plus, RotateCcw, MapPin } from 'lucide-react';
import { eventDisplayName } from '@/services/factLookup';
import './schematic-map.css';
/**
 * 本地 GIS 风格态势示意图：v5 参考影像 / 事件点 / 救援资源 / 图层与缩放。
 * 几何数据来自种子 schematicMap 与各实体 schematicPosition，名称取自种子事实；
 * 图上位置不用于计算距离或 ETA（示意，非真实地图）。
 *
 * 配色：品牌蓝（仓库、候选高亮）一律取主题 token；队伍绿 / 事件橙 / 水位站紫 /
 * 当前选中 / 常态连线 / 高亮 取 --axn-legend-* / --axn-map-* 语义色 token。
 */
import { Alert, Space, Tag, Typography, theme } from 'antd';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { factText, incidentById, schematicMap, station, teamById, warehouseById } from '@/seed/scenario';

import { useDemoStore } from '@/store/demoStore';
import { resourceAllowed } from '@/services/factLookup';

const { Text } = Typography;

export interface SchematicOverlayMarker {
  id: string;
  /** 与建设场景演示资源 kind 对齐（含宾馆/加油站等影响目标）。 */
  kind: 'team' | 'warehouse' | 'equipment' | 'hospital' | 'hotel' | 'gasStation' | 'supportUnit' | 'expert' | 'school';
  x: number;
  y: number;
  name: string;
}

export interface SchematicMapProps {
  /** 高亮（描边）的资源 id，一般是候选力量 */
  highlightIds?: string[];
  /** 当前选中的资源 id（与资源表格联动） */
  selectedResourceId?: string | null;
  /** 点击标记或空白处回调（传 null 表示取消选择） */
  onSelectResourceId?: (id: string | null) => void;
  /** 最近一次查询结果 id（授权台账）；为空时仍展示事件周边全部授权资源。 */
  resultIds?: string[];
  /** 建设场景演示叠加点位（分布示意，不走授权台账）。 */
  overlayMarkers?: SchematicOverlayMarker[];
}

interface MarkerEntity {
  id: string;
  x: number;
  y: number;
  name: string;
}

function shortenLabel(name: string, max = 11): string {
  const cleaned = name.replace(/（模拟）/g, '').trim();
  return cleaned.length > max ? `${cleaned.slice(0, max - 1)}…` : cleaned;
}

function MarkerLabel({
  x,
  y,
  text,
  color,
  anchor = 'middle',
}: {
  x: number;
  y: number;
  text: string;
  color: string;
  anchor?: 'middle' | 'start';
}) {
  const label = shortenLabel(text);
  const width = Math.min(132, Math.max(48, label.length * 8.2 + 16));
  const left = anchor === 'start' ? x : x - width / 2;
  return (
    <g className="axn-schematic-label" pointerEvents="none">
      <rect
        x={left}
        y={y}
        width={width}
        height={20}
        rx={4}
        fill="rgba(255,255,255,0.95)"
        stroke="rgba(15, 23, 42, 0.12)"
        strokeWidth={1}
      />
      <text
        x={anchor === 'start' ? left + 8 : x}
        y={y + 14}
        fontSize={10.5}
        fontWeight={600}
        textAnchor={anchor === 'start' ? 'start' : 'middle'}
        fill={color}
      >
        {label}
      </text>
    </g>
  );
}

/** 按可见点位收紧视野，减少大片留白。 */
function fitViewBox(
  points: { x: number; y: number }[],
  full: number[],
): { minX: number; minY: number; width: number; height: number } {
  const [ox, oy, ow, oh] = full;
  if (!points.length) {
    return { minX: ox, minY: oy, width: ow, height: oh };
  }
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  const padX = 160;
  const padY = 130;
  let minX = Math.min(...xs) - padX;
  const maxX = Math.max(...xs) + padX;
  let minY = Math.min(...ys) - padY;
  const maxY = Math.max(...ys) + padY;
  let width = Math.max(420, maxX - minX);
  let height = Math.max(300, maxY - minY);
  // 宽高比贴近面板，避免裁切过扁
  const targetRatio = 1.55;
  if (width / height < targetRatio) {
    const nextW = height * targetRatio;
    minX -= (nextW - width) / 2;
    width = nextW;
  } else if (width / height > 2.1) {
    const nextH = width / 1.7;
    minY -= (nextH - height) / 2;
    height = nextH;
  }
  minX = Math.max(ox - 40, Math.min(minX, ox + ow - width + 40));
  minY = Math.max(oy - 40, Math.min(minY, oy + oh - height + 40));
  return { minX, minY, width, height };
}

export default function SchematicMap({
  highlightIds = [],
  selectedResourceId = null,
  onSelectResourceId,
  resultIds,
  overlayMarkers = [],
}: SchematicMapProps) {
  const { token } = theme.useToken();
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<HTMLDivElement>(null);
  const [aspect, setAspect] = useState(1.7);
  const [canvasWidth, setCanvasWidth] = useState(720);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry.contentRect.height > 0) {
        setAspect(entry.contentRect.width / entry.contentRect.height);
        setCanvasWidth(entry.contentRect.width);
      }
    });
    observer.observe(canvas);
    return () => observer.disconnect();
  }, []);
  const [showResources, setShowResources] = useState(true);
  const [showEvents, setShowEvents] = useState(true);
  const eventId = useDemoStore(s => s.currentEventId);
  const vb = schematicMap?.viewBox;
  const riverPath = schematicMap?.riverPath ?? '';
  const mapReady = Boolean(vb && vb.length >= 4 && riverPath);
  const inResult = (id: string) => !resultIds || resultIds.length === 0 || resultIds.includes(id);

  const teamMarkers: MarkerEntity[] = mapReady
    ? [...teamById.values()]
      .filter((t) => resourceAllowed(t.resourceId, eventId) && inResult(t.resourceId))
      .map((t) => ({
        id: t.resourceId,
        x: t.schematicPosition.x,
        y: t.schematicPosition.y,
        name: factText(t.factRefs.name) || t.resourceId,
      }))
    : [];
  const warehouseMarkers: MarkerEntity[] = mapReady
    ? [...warehouseById.values()]
      .filter((w) => resourceAllowed(w.resourceId, eventId) && inResult(w.resourceId))
      .map((w) => ({
        id: w.resourceId,
        x: w.schematicPosition.x,
        y: w.schematicPosition.y,
        name: factText(w.factRefs.name) || w.resourceId,
      }))
    : [];
  const incidentMarkers: MarkerEntity[] = mapReady
    ? [...incidentById.values()].filter(i => i.eventId === eventId).map((i) => ({
      id: i.eventId,
      x: i.schematicPosition.x,
      y: i.schematicPosition.y,
      name: factText(i.factRefs.title) || i.eventId,
    }))
    : [];

  const fitted = fitViewBox(
    [
      ...incidentMarkers,
      ...teamMarkers,
      ...warehouseMarkers,
      ...overlayMarkers,
      ...(mapReady && station.eventId === eventId ? [station.schematicPosition] : []),
    ],
    vb ?? [0, 0, 1000, 650],
  );

  // 视野随面板比例展开，点位保持原坐标与比例，宽屏不再出现两侧空带。
  const width = Math.max(fitted.width, fitted.height * aspect);
  const height = Math.max(fitted.height, fitted.width / aspect);
  const frame = { minX: fitted.minX - (width - fitted.width) / 2, minY: fitted.minY - (height - fitted.height) / 2, width, height };

  const viewBoxStr = `${frame.minX + frame.width * (1 - 1 / zoom) / 2} ${frame.minY + frame.height * (1 - 1 / zoom) / 2} ${frame.width / zoom} ${frame.height / zoom}`;
  const { minX: fx, minY: fy, width: fw, height: fh } = frame;

  const markerScale = frame.width / zoom / Math.max(canvasWidth, 1);
  const markerTransform = (x: number, y: number) => `translate(${x} ${y}) scale(${markerScale}) translate(${-x} ${-y})`;

  if (!mapReady) {
    return <Alert type="error" showIcon title="态势示意数据不可用（模拟数据缺失）" />;
  }

  const pickMarker = (id: string) => (event: ReactMouseEvent) => {
    event.stopPropagation();
    onSelectResourceId?.(id);
  };

  return (
    <div className="axn-schematic axn-schematic--gis">
      <div ref={canvasRef} className="axn-gis-canvas" data-resources={showResources} data-events={showEvents}>
      <div className="axn-gis-heading">
        <span className="axn-gis-heading-icon"><MapPin size={18} /></span>
        <div><strong title={eventDisplayName(eventId)}>{eventDisplayName(eventId)}</strong>
          <span>救援力量态势 · <b>模拟演示</b></span></div>
      </div>
      <div className="axn-gis-layers" aria-label="地图图层">
        <span><Layers size={14} /> 图层</span>
        <button type="button" aria-pressed={showEvents} onClick={() => setShowEvents(value => !value)}>事件点</button>
        <button type="button" aria-pressed={showResources} onClick={() => setShowResources(value => !value)}>救援资源</button>
      </div>
      <div className="axn-gis-zoom" aria-label="地图缩放">
        <button type="button" aria-label="放大地图" disabled={zoom >= 2} onClick={() => setZoom(value => Math.min(2, value + 0.25))}><Plus size={17} /></button>
        <span>{Math.round(zoom * 100)}%</span>
        <button type="button" aria-label="缩小地图" disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - 0.25))}><Minus size={17} /></button>
        <button type="button" aria-label="重置地图视野" onClick={() => { setZoom(1); setShowEvents(true); setShowResources(true); }}><RotateCcw size={15} /></button>
      </div>
      <div className="axn-gis-image-note">参考影像 · 非事发地实景 / 点位仅示意</div>
      <svg
        viewBox={viewBoxStr}
        preserveAspectRatio="xMidYMid meet"
        className="axn-gis-overlay"
        role="img"
        aria-label="救援力量空间示意图"
        onClick={() => onSelectResourceId?.(null)}
      >
        <defs>
          <filter id="axn-map-soft" x="-50%" y="-50%" width="200%" height="200%">
            <feDropShadow dx="0" dy="1.2" stdDeviation="1.8" floodColor="#0f172a" floodOpacity="0.22" />
          </filter>
        </defs>

        {/* 复用 v5 原型的参考影像；点位仍沿用原有示意坐标，不作真实地理配准。 */}
        <image href="/map-assets/situation-satellite.png" x={fx} y={fy} width={fw} height={fh} preserveAspectRatio="xMidYMid slice" />
        <rect x={fx} y={fy} width={fw} height={fh} fill="var(--axn-text)" opacity={0.12} pointerEvents="none" />
        <g transform={`translate(${fx + fw - 42} ${fy + fh - 52})`} aria-hidden>
          <circle r={20} fill="var(--axn-surface)" opacity={0.94} />
          <polygon points="0,-12 4.5,5 0,1.5 -4.5,5" fill="var(--axn-text)" />
          <text y={16} textAnchor="middle" fontSize={9} fontWeight={600} fill="var(--axn-text)">N</text>
        </g>

        {/* 水位站 */}
        {station.eventId === eventId && (
          <g className="axn-gis-resource" transform={markerTransform(station.schematicPosition.x, station.schematicPosition.y)}>
            <title>{`水位站（模拟）· 观测 ${factText(station?.latestObservationId ?? '') || '—'}`}</title>
            <polygon
              points={`${station.schematicPosition.x},${station.schematicPosition.y - 11} ${station.schematicPosition.x + 11},${station.schematicPosition.y} ${station.schematicPosition.x},${station.schematicPosition.y + 11} ${station.schematicPosition.x - 11},${station.schematicPosition.y}`}
              fill="var(--axn-legend-station)"
              stroke="#fff"
              strokeWidth={2}
              filter="url(#axn-map-soft)"
            />
            <MarkerLabel
              x={station.schematicPosition.x}
              y={station.schematicPosition.y + 14}
              text="水位站"
              color="#5b21b6"
            />
          </g>
        )}

        {/* 事件点 */}
        {incidentMarkers.map((m) => (
          <g key={m.id} className="axn-gis-event" transform={markerTransform(m.x, m.y)}>
            <title>{`${m.name}（模拟事件）`}</title>
            <circle cx={m.x} cy={m.y} r={46} fill="var(--axn-legend-event)" opacity={0.08} />
            <circle
              cx={m.x}
              cy={m.y}
              r={34}
              fill="none"
              stroke="var(--axn-legend-event)"
              strokeWidth={1.4}
              strokeDasharray="5 4"
              opacity={0.55}
            />
            <circle cx={m.x} cy={m.y} r={18} fill="var(--axn-legend-event)" opacity={0.2} />
            <circle
              cx={m.x}
              cy={m.y}
              r={11}
              fill="var(--axn-legend-event)"
              stroke="#fff"
              strokeWidth={2.5}
              filter="url(#axn-map-soft)"
            />
            <circle cx={m.x} cy={m.y} r={3.5} fill="#fff" />
            <MarkerLabel x={m.x + 14} y={m.y - 30} text={m.name} color="#9a3412" anchor="start" />
          </g>
        ))}

        {/* 物资仓库 */}
        {warehouseMarkers.map((m) => {
          const selected = selectedResourceId === m.id;
          return (
            <g key={m.id} className="axn-gis-resource" transform={markerTransform(m.x, m.y)} onClick={pickMarker(m.id)}>
              <title>{`${m.name}（物资仓库 · 模拟）`}</title>
              <polygon
                points={`${m.x},${m.y - 13} ${m.x - 12},${m.y + 10} ${m.x + 12},${m.y + 10}`}
                fill={selected ? token.colorPrimaryHover : token.colorPrimary}
                stroke={selected ? 'var(--axn-map-active)' : '#fff'}
                strokeWidth={selected ? 3 : 2}
                filter="url(#axn-map-soft)"
              />
              <MarkerLabel x={m.x} y={m.y + 14} text={m.name} color="#1c4d80" />
            </g>
          );
        })}

        {/* 救援队伍 */}
        {teamMarkers.map((m) => {
          const highlighted = highlightIds.includes(m.id);
          const selected = selectedResourceId === m.id;
          const stroke = selected ? 'var(--axn-map-active)' : highlighted ? token.colorPrimary : '#fff';
          const strokeWidth = selected ? 3 : highlighted ? 2.5 : 2;
          return (
            <g key={m.id} className="axn-gis-resource" transform={markerTransform(m.x, m.y)} onClick={pickMarker(m.id)}>
              <title>{`${m.name}${highlighted ? ' · 候选力量（≠已调派）' : ''}（模拟）`}</title>
              {highlighted && (
                <rect
                  x={m.x - 16}
                  y={m.y - 16}
                  width={32}
                  height={32}
                  rx={7}
                  fill="none"
                  stroke={token.colorPrimary}
                  strokeWidth={1.4}
                  opacity={0.55}
                />
              )}
              <rect
                x={m.x - 10}
                y={m.y - 10}
                width={20}
                height={20}
                rx={4}
                fill={selected ? 'var(--axn-map-selected)' : 'var(--axn-legend-team)'}
                stroke={stroke}
                strokeWidth={strokeWidth}
                filter="url(#axn-map-soft)"
              />
              <MarkerLabel x={m.x} y={m.y + 14} text={m.name} color="#26641a" />
            </g>
          );
        })}

        {/* 建设场景叠加点位 */}
        {overlayMarkers.map((m) => {
          const highlighted = highlightIds.includes(m.id);
          const selected = selectedResourceId === m.id;
          const fill = m.kind === 'hospital' || m.kind === 'school' || m.kind === 'hotel'
            ? 'var(--axn-legend-station)'
            : m.kind === 'equipment' || m.kind === 'warehouse' || m.kind === 'gasStation'
              ? token.colorPrimary
              : 'var(--axn-legend-team)';
          const shape = m.kind === 'team' || m.kind === 'expert' || m.kind === 'supportUnit'
            ? 'team'
            : m.kind === 'hospital' || m.kind === 'school'
              ? 'hospital'
              : 'site';
          const labelColor = shape === 'team' ? '#26641a' : shape === 'hospital' ? '#5b21b6' : '#1c4d80';
          return (
            <g key={`overlay-${m.id}`} className="axn-gis-resource" transform={markerTransform(m.x, m.y)} onClick={pickMarker(m.id)}>
              <title>{`${m.name}（建设场景示意 · 模拟）`}</title>
              {highlighted && (
                <circle cx={m.x} cy={m.y} r={18} fill="none" stroke={token.colorPrimary} strokeWidth={1.4} opacity={0.55} />
              )}
              {shape === 'team' ? (
                <rect
                  data-testid={`map-marker-${m.id}`}
                  x={m.x - 10}
                  y={m.y - 10}
                  width={20}
                  height={20}
                  rx={4}
                  fill={selected ? 'var(--axn-map-selected)' : fill}
                  stroke={selected ? 'var(--axn-map-active)' : '#fff'}
                  strokeWidth={selected ? 3 : 2}
                  filter="url(#axn-map-soft)"
                />
              ) : shape === 'hospital' ? (
                <polygon
                  data-testid={`map-marker-${m.id}`}
                  points={`${m.x},${m.y - 11} ${m.x + 11},${m.y} ${m.x},${m.y + 11} ${m.x - 11},${m.y}`}
                  fill={fill}
                  stroke={selected ? 'var(--axn-map-active)' : '#fff'}
                  strokeWidth={selected ? 3 : 2}
                  filter="url(#axn-map-soft)"
                />
              ) : (
                <polygon
                  data-testid={`map-marker-${m.id}`}
                  points={`${m.x},${m.y - 12} ${m.x - 11},${m.y + 9} ${m.x + 11},${m.y + 9}`}
                  fill={fill}
                  stroke={selected ? 'var(--axn-map-active)' : '#fff'}
                  strokeWidth={selected ? 3 : 2}
                  filter="url(#axn-map-soft)"
                />
              )}
              <MarkerLabel x={m.x} y={m.y + 14} text={m.name} color={labelColor} />
            </g>
          );
        })}
      </svg>
      </div>

      <Space size={6} wrap className="axn-legend" align="center">
        <Tag color="orange">模拟数据</Tag>
        <Text type="secondary" className="axn-legend-text">
          {schematicMap?.label ?? '空间示意 · 非真实地图'}
        </Text>
        <span className="axn-legend-item">
          <span className="axn-legend-swatch axn-legend-swatch--team" /> 队伍
        </span>
        <span className="axn-legend-item">
          <span className="axn-legend-swatch axn-legend-swatch--warehouse" /> 仓库/装备
        </span>
        <span className="axn-legend-item">
          <span className="axn-legend-swatch axn-legend-swatch--event" /> 事件
        </span>
        <span className="axn-legend-item">
          <span className="axn-legend-swatch axn-legend-swatch--station" /> 水位站/医院
        </span>
        <Text type="secondary" className="axn-legend-text">
          {schematicMap?.distanceRule ?? '图上位置不用于算公里数或 ETA。'}
        </Text>
      </Space>
    </div>
  );
}
