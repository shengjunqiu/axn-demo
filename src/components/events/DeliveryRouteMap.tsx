import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Space, Spin, Tag, Typography } from 'antd';
import type { DisasterProfile } from '@/seed/disasterScenarios';
import { amapConfig } from '@/config/amap';
import { loadAmap, type AmapMap, mergeRouteOptions, type RouteOption, type DrivingRoute, type DrivingResult } from '@/services/amap';
import './events.css';

export default function DeliveryRouteMap(_props: { profile?: DisasterProfile; route?: string; road?: string; progress?: number }) {
  const container = useRef<HTMLDivElement>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [retry, setRetry] = useState(0);
  const [options, setOptions] = useState<RouteOption[]>([]);
  const [selected, setSelected] = useState(0);
  const drawRoute = useRef<(route: DrivingRoute) => void>(() => {});
  useEffect(() => {
    let disposed = false;
    let map: AmapMap | undefined;
    const planners: { clear(): void }[] = [];
    const timers: number[] = [];
    let observer: ResizeObserver | undefined;
    loadAmap().then(sdk => {
      if (disposed || !container.current) return;
      map = new sdk.Map(container.current, { zoom: 11, center: [104.066, 30.573], viewMode: '2D', resizeEnable: true });
      observer = new ResizeObserver(() => map?.resize());
      observer.observe(container.current);
      drawRoute.current = route => {
        if (disposed || !map) return;
        map.clearMap();
        const path = route.steps.flatMap(step => step.path);
        map.add([new sdk.Polyline({ path, strokeColor: '#1677ff', strokeWeight: 7, showDir: true, lineJoin: 'round' }), new sdk.Marker({ position: path[0], title: amapConfig.origin, label: { content: '起点', direction: 'top' } }), new sdk.Marker({ position: path.at(-1), title: amapConfig.destination, label: { content: '终点', direction: 'top' } })]);
        map.setFitView();
      };
      const policies = [
        { label: '时间优先', policy: sdk.DrivingPolicy.LEAST_TIME },
        { label: '少收费', policy: sdk.DrivingPolicy.LEAST_FEE },
        { label: '距离优先', policy: sdk.DrivingPolicy.LEAST_DISTANCE },
      ];
      const requests = policies.map(({ label, policy }) => new Promise<{ label: string; data: DrivingResult }>((resolve, reject) => {
        const planner = new sdk.Driving({ policy, extensions: 'all' });
        planners.push(planner);
        const timer = window.setTimeout(() => reject(new Error('路线查询超时')), 15000);
        timers.push(timer);
        planner.search([{ keyword: amapConfig.origin, city: amapConfig.city }, { keyword: amapConfig.destination, city: amapConfig.city }], (status, data) => {
          window.clearTimeout(timer);
          if (status === 'complete' && data.routes?.length) resolve({ label, data });
          else reject(new Error('路线查询失败'));
        });
      }));
      void Promise.allSettled(requests).then(results => {
        if (disposed) return;
        setLoading(false);
        const successful = results.flatMap(result => result.status === 'fulfilled' ? [result.value] : []);
        const choices = mergeRouteOptions(successful);
        if (!choices.length) { setError('路线规划未完成，请检查起终点、服务权限及调用额度后重试。'); return; }
        setOptions(choices);
        setSelected(0);
        drawRoute.current(choices[0].route);
      });
    }).catch(reason => { if (!disposed) { setError(reason instanceof Error ? reason.message : '地图加载失败，请重试。'); setLoading(false); } });
    return () => { disposed = true; observer?.disconnect(); timers.forEach(window.clearTimeout); planners.forEach(planner => planner.clear()); drawRoute.current = () => {}; map?.destroy(); };
  }, [retry]);
  const route = options[selected]?.route;
  return <div className="axn-delivery-map" data-testid="delivery-route-map">
    <div className="axn-delivery-map-head"><Typography.Text strong>投送路线规划</Typography.Text><Tag color="blue">高德地图 · 驾车</Tag></div>
    <div className="axn-delivery-map-location">{amapConfig.origin} → {amapConfig.destination} <Typography.Text type="secondary">（演示起终点）</Typography.Text></div>
    {options.length > 0 && <div role="group" aria-label="备选驾车路线" style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
      {options.map((option, index) => <Button key={index} type={selected === index ? 'primary' : 'default'} aria-pressed={selected === index} style={{ height: 'auto', padding: '10px 16px', textAlign: 'left', whiteSpace: 'normal' }} onClick={() => { setSelected(index); drawRoute.current(option.route); }}>
        <div><strong>方案{index + 1}</strong> · {option.labels.join(' / ')}</div>
        <div style={{ marginTop: 4 }}>约 {Math.ceil(option.route.time / 60)} 分钟 · {(option.route.distance / 1000).toFixed(1)} 公里</div>
      </Button>)}
    </div>}
    {options.length === 1 && <Typography.Text type="secondary">当前规划偏好返回相同路线，已合并为一个方案。</Typography.Text>}
    <div style={{ position: 'relative' }}>
      <div ref={container} aria-label="高德驾车路线地图" style={{ width: '100%', height: 'clamp(360px, 52vh, 640px)', borderRadius: 10, overflow: 'hidden', background: '#f5f7fa' }} />
      {loading && <div style={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: '#ffffffb3' }}><Spin description="正在比较驾车备选路线…" /></div>}
    </div>
    {error && <Alert style={{ marginTop: 12 }} type="info" title={error} action={<Button size="small" onClick={() => { setError(''); setOptions([]); setSelected(0); setLoading(true); setRetry(value => value + 1); }}>重新加载</Button>} />}
    {route && <><Space wrap style={{ marginTop: 12 }}><Typography.Text strong>全程 {(route.distance / 1000).toFixed(1)} 公里</Typography.Text><Typography.Text>预计 {Math.ceil(route.time / 60)} 分钟</Typography.Text><Typography.Text type="secondary">高德路线规划结果</Typography.Text></Space><details style={{ marginTop: 12 }}><summary>查看行驶指引</summary><ol>{route.steps.map((step, index) => <li key={index}>{step.instruction}</li>)}</ol></details></>}
  </div>;
}
