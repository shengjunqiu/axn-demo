/** 聊天气泡用统计控件：轻量 SVG 图形配合现有统计、提示和进度控件。 */
import { useId, useState, type ReactNode } from 'react';
import { Progress, Segmented, Statistic, Tooltip } from 'antd';
import './chat-charts.css';

type Datum = { label: string; value: number };
const COLORS = ['var(--axn-primary)', 'color-mix(in srgb, var(--axn-primary) 62%, var(--axn-surface))', 'color-mix(in srgb, var(--axn-primary) 30%, var(--axn-surface))'];

function ChartFrame({ title, note, extra, children }: { title: string; note: string; extra?: ReactNode; children: ReactNode }) {
  return <figure className="axn-chart">
    <div className="axn-chart-heading"><strong>{title}</strong>{extra}</div>
    {children}
    <figcaption>{note} · 模拟数据</figcaption>
  </figure>;
}

export function MetricCards() {
  return <ChartFrame title="现场处置概览" note="今日 18:00 更新">
    <div className="axn-chart-metrics">
      {[
        { title: '到场人员', value: 72, unit: '人', note: '较上一时段增加 12 人' },
        { title: '投入装备', value: 18, unit: '台', note: '已覆盖 4 个作业点' },
        { title: '转移安置', value: 108, unit: '人', note: '计划转移 120 人' },
        { title: '处置完成率', value: 90, unit: '%', note: '较上一时段提升 15 个百分点' },
      ].map(item => <div className="axn-chart-metric" key={item.title}>
        <Statistic title={item.title} value={item.value} suffix={item.unit} />
        <span>{item.note}</span>
      </div>)}
    </div>
  </ChartFrame>;
}

export function TrendChart({ series, title = '到场人员趋势', unit = '人', note }: { series?: Datum[]; title?: string; unit?: string; note?: string } = {}) {
  const [period, setPeriod] = useState('今日');
  const gradientId = useId();
  const data: Datum[] = series ?? (period === '今日'
    ? [12, 24, 36, 48, 60, 72].map((value, i) => ({ label: `${8 + i * 2}:00`, value }))
    : [24, 36, 30, 48, 54, 60, 72].map((value, i) => ({ label: `9/${22 + i}`, value })));
  const min = Math.min(0, ...data.map(item => item.value));
  const max = Math.max(min + 1, ...data.map(item => item.value));
  const ceiling = series ? max : 85;
  const y = (value: number) => 164 - (value - min) / (ceiling - min) * 136;
  const points = data.map((item, i) => ({ ...item, x: 32 + i * 304 / Math.max(1, data.length - 1), y: y(item.value) }));
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ');
  return <ChartFrame title={title} note={note ?? (period === '今日' ? '今日 08:00—18:00' : '9 月 22 日—28 日')}
    extra={!series && <Segmented size="small" options={['今日', '近7日']} value={period} onChange={setPeriod} aria-label="趋势时间范围" />}>
    <span className="axn-chart-unit">单位：{unit}</span>
    <svg className="axn-chart-plot" viewBox="0 0 360 200" role="img" aria-label={title}>
      <defs><linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="var(--axn-primary)" stopOpacity=".15" /><stop offset="100%" stopColor="var(--axn-primary)" stopOpacity="0" /></linearGradient></defs>
      {[0, 1, 2, 3, 4].map(i => <g key={i}><line className="axn-chart-gridline" x1="32" x2="336" y1={164 - i * 34} y2={164 - i * 34} /><text x="24" y={168 - i * 34} textAnchor="end">{Number((min + (ceiling - min) * i / 4).toFixed(1))}</text></g>)}
      <path d={`${path} L336,164 L32,164 Z`} fill={`url(#${gradientId})`} />
      <path d={path} fill="none" stroke="var(--axn-primary)" strokeWidth="2.5" strokeLinejoin="round" />
      {points.map(p => <g key={p.label}>
        <text x={p.x} y="187" textAnchor="middle">{p.label}</text>
        <Tooltip trigger={['hover', 'focus']} title={`${p.label} · ${p.value} ${unit}`}><g className="axn-chart-target" tabIndex={0} aria-label={`${p.label}，${p.value} ${unit}`}>
          <circle cx={p.x} cy={p.y} r="13" fill="transparent" />
          <circle cx={p.x} cy={p.y} r="4" fill="var(--axn-surface)" stroke="var(--axn-primary)" strokeWidth="2" />
        </g></Tooltip>
      </g>)}
    </svg>
  </ChartFrame>;
}

export function ColumnChart({ data, title, unit }: { data: Datum[]; title: string; unit: string }) {
  const max = Math.max(1, ...data.map(d => d.value));
  const ceiling = Math.ceil(max / 10) * 10;
  const width = 304 / data.length;
  return <ChartFrame title={title} note="今日 18:00 更新">
    <span className="axn-chart-unit">单位：{unit}</span>
    <svg className="axn-chart-plot" viewBox="0 0 360 200" role="img" aria-label={title}>
      {[0, 1, 2, 3, 4].map(i => <g key={i}><line className="axn-chart-gridline" x1="32" x2="336" y1={164 - i * 34} y2={164 - i * 34} /><text x="24" y={168 - i * 34} textAnchor="end">{ceiling * i / 4}</text></g>)}
      {data.map((d, i) => {
        const x = 32 + width * (i + .5);
        const height = d.value / ceiling * 136;
        return <g key={d.label}>
          <Tooltip trigger={['hover', 'focus']} title={`${d.label} · ${d.value} ${unit}`}><rect className="axn-chart-target" tabIndex={0} aria-label={`${d.label}，${d.value} ${unit}`} x={x - 18} y={164 - height} width="36" height={height} rx="5" fill="var(--axn-primary)" /></Tooltip>
          <text className="axn-chart-value" x={x} y={156 - height} textAnchor="middle">{d.value}</text>
          <text x={x} y="187" textAnchor="middle">{d.label}</text>
        </g>;
      })}
    </svg>
  </ChartFrame>;
}

export function DonutChart({ data, title, unit }: { data: Datum[]; title: string; unit: string }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const circumference = 2 * Math.PI * 62;
  const portions = data.map((d, index) => ({ ...d, offset: data.slice(0, index).reduce((sum, item) => sum + item.value, 0) / (total || 1) }));
  return <ChartFrame title={title} note="可用资源台账 · 今日 18:00">
    <div className="axn-chart-donut-layout">
      <svg className="axn-chart-donut" viewBox="0 0 180 180" role="img" aria-label={`${title}，合计 ${total} ${unit}`}>
        <circle cx="90" cy="90" r="62" fill="none" stroke="var(--axn-soft)" strokeWidth="22" />
        {portions.map((d, index) => <Tooltip key={d.label} trigger={['hover', 'focus']} title={`${d.label} · ${d.value} ${unit} · ${Math.round(d.value / (total || 1) * 100)}%`}>
          <circle className="axn-chart-target" tabIndex={0} aria-label={`${d.label}，${d.value} ${unit}`} cx="90" cy="90" r="62" fill="none" stroke={COLORS[index % COLORS.length]} strokeWidth="22"
            strokeDasharray={`${Math.max(0, d.value / (total || 1) * circumference - 3)} ${circumference}`} strokeDashoffset={-d.offset * circumference} transform="rotate(-90 90 90)" />
        </Tooltip>)}
        <text className="axn-chart-total" x="90" y="89" textAnchor="middle">{total}</text>
        <text x="90" y="110" textAnchor="middle">资源总量 / {unit}</text>
      </svg>
      <ul className="axn-chart-legend">{portions.map((d, i) => <li key={d.label}>
        <span className="axn-chart-legend-name"><i style={{ background: COLORS[i % COLORS.length] }} />{d.label}</span>
        <strong>{d.value}<small>{unit}</small></strong>
        <span>{Math.round(d.value / (total || 1) * 100)}%</span>
      </li>)}</ul>
    </div>
  </ChartFrame>;
}

export function HorizontalBarChart({ data, title }: { data: Datum[]; title: string }) {
  return <ChartFrame title={title} note="现场处置台账 · 今日 18:00">
    <div className="axn-chart-bars">{data.map(d => <div key={d.label}>
      <div className="axn-chart-bar-label"><span>{d.label}</span><strong>{d.value}%</strong></div>
      <Tooltip trigger={['hover', 'focus']} title={`${d.label} · 完成率 ${d.value}%`}><div tabIndex={0} aria-label={`${d.label}完成率 ${d.value}%`}>
        <Progress percent={d.value} showInfo={false} strokeColor="var(--axn-primary)" railColor="var(--axn-soft)" size="small" />
      </div></Tooltip>
    </div>)}</div>
  </ChartFrame>;
}
