import { Card, Typography } from 'antd';
import type { DisasterProfile } from '@/seed/disasterScenarios';
import './events.css';

/** 每幅图单独标明单位、时间、来源，原始读数可展开，避免混合量纲。 */
export default function DisasterMonitoring({ profile }: { profile: DisasterProfile }) {
  return <div className="axn-disaster-charts" data-testid="disaster-monitoring">
    {profile.monitoring.map((m, index) => {
      const low = Math.min(...m.values); const high = Math.max(...m.values);
      const padding = Math.max((high - low) * .2, .1);
      const min = low >= 0 ? Math.max(0, low - padding) : low - padding; const max = high + padding;
      const point = (v: number, i: number) => ({ x: 54 + i * 72, y: 140 - (v - min) / (max - min) * 100 });
      const color = ['#267aaf', '#c57b23', '#5c70a8'][index % 3];
      return <Card size="small" key={m.label} title={`${m.label} · ${m.unit}`}>
        <Typography.Text strong className="axn-disaster-reading">{m.values.at(-1)} <small>{m.unit}</small></Typography.Text>
        <svg viewBox="0 0 310 180" role="img" aria-label={`${profile.category} ${m.label}模拟趋势：${m.values.join('、')}${m.unit}`}>
          <title>{m.label}（模拟记录，不预测趋势）</title>
          {[min, (min + max) / 2, max].map(v => {
            const y = point(v, 0).y;
            return <g key={v}><line x1="48" x2="292" y1={y} y2={y} stroke="#e8edf2"/><text x="42" y={y + 4} textAnchor="end" fontSize="10" fill="#697586">{Number(v.toFixed(2))}</text></g>;
          })}
          <polyline points={m.values.map((v, i) => `${point(v, i).x},${point(v, i).y}`).join(' ')} fill="none" stroke={color} strokeWidth="2.5"/>
          {m.values.map((v, i) => <g key={m.times[i]}><circle cx={point(v, i).x} cy={point(v, i).y} r="4" fill={color}><title>{m.times[i]}：{v}{m.unit}</title></circle><text x={point(v, i).x} y="164" textAnchor="middle" fontSize="10" fill="#697586">{m.times[i]}</text></g>)}
        </svg>
        <details><summary>查看读数与来源</summary><table className="axn-disaster-raw"><thead><tr><th>采集时间</th><th>{m.label}（{m.unit}）</th></tr></thead><tbody>{m.times.map((t,i) => <tr key={t}><td>{t}</td><td>{m.values[i]??'缺测'}</td></tr>)}</tbody></table><Typography.Text type="secondary">{m.source} · {profile.capturedAt}</Typography.Text><p>测点标识：{profile.eventId}:M{index+1}（模拟）</p><p>质量：本地样例，缺测不按零处理；专业阈值、有效期{ /水位/.test(m.label)?'及高程基准':''}待核定。</p></details>
      </Card>;
    })}
  </div>;
}
