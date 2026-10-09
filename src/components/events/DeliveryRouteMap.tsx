/**
 * 投送路径示意图（本地 SVG）：主通道阻断 + 东侧绕行 / 铁路投送示意。
 * 不接高德或实时路况，里程与 ETA 仅为演示。
 */
import { Space, Tag, Typography } from 'antd';
import type { DisasterProfile } from '@/seed/disasterScenarios';
import './events.css';

const NODES = [
  { key: 'base', label: '基地出发', x: 48, y: 148 },
  { key: 'check', label: '通行检查点', x: 168, y: 96 },
  { key: 'rally', label: '前方集结点', x: 292, y: 118 },
  { key: 'site', label: '现场到达', x: 412, y: 72 },
] as const;

export default function DeliveryRouteMap({
  profile,
  route = '东侧绕行（示例）',
  road = '主路阻断（示例）',
  progress = 0,
}: {
  profile?: DisasterProfile;
  route?: string;
  road?: string;
  /** 0–3，对应 NODES 已到达下标（回放轨迹） */
  progress?: number;
}) {
  const rail = /铁路/.test(route);
  const location = profile?.location ?? '事发地';
  const reached = Math.min(3, Math.max(0, progress));

  const detourPath = 'M48 148 C 90 148, 120 110, 168 96 S 240 130, 292 118 S 360 70, 412 72';
  const mainPath = 'M48 148 C 140 140, 240 100, 412 72';
  const railPath = 'M48 148 C 100 170, 220 175, 320 140 S 390 90, 412 72';

  return (
    <div className="axn-delivery-map" data-testid="delivery-route-map">
      <div className="axn-delivery-map-head">
        <Typography.Text strong>投送路径示意（模拟）</Typography.Text>
        <Space size={6} wrap>
          <Tag color="red">主通道阻断</Tag>
          <Tag color="blue">{rail ? '铁路投送' : '东侧绕行'}</Tag>
          <Tag>{location}</Tag>
        </Space>
      </div>
      <svg viewBox="0 0 460 210" role="img" aria-label={`${location}投送路径示意图：${route}`}>
        <title>
          {route}；{road}；轨迹节点 {reached + 1}/4（示意，非真实导航）
        </title>
        <rect width="460" height="210" fill="#f4f7fa" />
        {/* 地形底纹 */}
        <path d="M0 175 Q115 150 230 168 T460 155 L460 210 L0 210 Z" fill="#e5edf3" />
        <path d="M0 40 Q120 55 240 28 T460 48" fill="none" stroke="#d5e0ea" strokeWidth="18" opacity="0.7" />

        {/* 主通道（阻断） */}
        <path d={mainPath} fill="none" stroke="#c45c4a" strokeWidth="5" strokeDasharray="8 6" opacity="0.85" />
        <text x="200" y="88" fontSize="11" fill="#c45c4a">
          主通道 · 阻断
        </text>

        {/* 选用路线 */}
        <path
          d={rail ? railPath : detourPath}
          fill="none"
          stroke="#267aaf"
          strokeWidth="6"
          strokeLinecap="round"
        />
        {!rail && (
          <path d={detourPath} fill="none" stroke="#9ec7e3" strokeWidth="2" strokeDasharray="2 8" opacity="0.9" />
        )}

        {/* 阻断叉 */}
        <g transform="translate(230 105)" aria-hidden>
          <circle r="11" fill="#fff" stroke="#c45c4a" strokeWidth="2" />
          <path d="M-5 -5 L5 5 M5 -5 L-5 5" stroke="#c45c4a" strokeWidth="2.5" />
        </g>

        {NODES.map((node, index) => {
          const done = index < reached;
          const current = index === reached;
          const fill = done || current ? '#267aaf' : '#fff';
          const stroke = done || current ? '#145782' : '#8aa0b4';
          return (
            <g key={node.key}>
              {index < NODES.length - 1 && done && (
                <circle cx={node.x} cy={node.y} r="14" fill="#267aaf" opacity="0.12" />
              )}
              <circle cx={node.x} cy={node.y} r="9" fill={fill} stroke={stroke} strokeWidth="2.5" />
              {done && (
                <path
                  d={`M${node.x - 4} ${node.y} l3 3 l6 -7`}
                  fill="none"
                  stroke="#fff"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              )}
              {current && !done && (
                <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="10" fill="#fff" fontWeight="700">
                  {index + 1}
                </text>
              )}
              {!done && !current && (
                <text x={node.x} y={node.y + 4} textAnchor="middle" fontSize="10" fill="#8aa0b4">
                  {index + 1}
                </text>
              )}
              <text
                x={node.x}
                y={node.y + (index % 2 === 0 ? 28 : -18)}
                textAnchor="middle"
                fontSize="11"
                fill="#334155"
              >
                {node.label}
              </text>
            </g>
          );
        })}

        <text x="16" y="24" fontSize="12" fill="#475569">
          {rail ? '铁路人员投送示意' : '东侧绕行示意'} · {road}
        </text>
      </svg>
      <Typography.Text type="secondary" className="axn-delivery-map-hint">
        示意几何不计算真实公里数或 ETA；未接高德 / 实时路况。当前选用：{route}
      </Typography.Text>
    </div>
  );
}
