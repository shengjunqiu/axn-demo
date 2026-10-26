import { amapConfig } from '@/config/amap';
export interface AmapMap { destroy(): void; clearMap(): void; add(items: unknown[]): void; setFitView(): void; resize(): void }
export interface DrivingResult { routes?: { distance: number; time: number; steps: { path: unknown[]; instruction: string }[] }[]; start?: { location: unknown }; end?: { location: unknown } }
export interface AmapSDK {
  DrivingPolicy: { LEAST_TIME: number; LEAST_FEE: number; LEAST_DISTANCE: number };
  Map: new (element: HTMLElement, options: object) => AmapMap;
  Driving: new (options: object) => { search(points: { keyword: string; city: string }[], callback: (status: string, result: DrivingResult) => void): void; clear(): void };
  Polyline: new (options: object) => unknown;
  Marker: new (options: object) => unknown;
}
declare global { interface Window { AMap?: AmapSDK; _AMapSecurityConfig?: { securityJsCode?: string; serviceHost?: string } } }
let loading: Promise<AmapSDK> | undefined;
export function loadAmap(): Promise<AmapSDK> {
  if (!amapConfig.key) return Promise.reject(new Error('请填写 .env.local 中的高德地图配置并重启开发服务。'));
  if (window.AMap) return Promise.resolve(window.AMap);
  if (loading) return loading;
  loading = new Promise<AmapSDK>((resolve, reject) => {
    window._AMapSecurityConfig = amapConfig.serviceHost ? { serviceHost: amapConfig.serviceHost } : { securityJsCode: amapConfig.securityJsCode };
    const script = document.createElement('script');
    script.src = `https://webapi.amap.com/maps?v=2.0&key=${encodeURIComponent(amapConfig.key)}&plugin=AMap.Driving`;
    script.async = true;
    const timeout = window.setTimeout(() => fail(), 20000);
    function fail() { window.clearTimeout(timeout); script.remove(); loading = undefined; reject(new Error('高德地图加载失败，请检查网络、Key及域名配置。')); }
    script.onerror = fail;
    script.onload = () => { window.clearTimeout(timeout); if (window.AMap) resolve(window.AMap); else fail(); };
    document.head.appendChild(script);
  });
  return loading;
}

export type DrivingRoute = NonNullable<DrivingResult['routes']>[number];
export interface RouteOption { route: DrivingRoute; labels: string[] }
/** 相同几何线路只展示一次，并合并命中的规划偏好。 */
export function mergeRouteOptions(results: { label: string; data: DrivingResult }[]): RouteOption[] {
  const options: RouteOption[] = [];
  const known = new Map<string, RouteOption>();
  for (const { label, data } of results) for (const route of data.routes ?? []) {
    const key = JSON.stringify(route.steps.flatMap(step => step.path));
    if (!route.steps.some(step => step.path.length)) continue;
    const existing = known.get(key);
    if (existing) { if (!existing.labels.includes(label)) existing.labels.push(label); }
    else { const option = { route, labels: [label] }; known.set(key, option); options.push(option); }
  }
  return options;
}
