import { expect, it, vi } from 'vitest';
vi.mock('@/config/amap', () => ({ amapConfig: { key: '', securityJsCode: '', serviceHost: '', origin: '成都东站', destination: '都江堰市人民政府', city: '成都' } }));
import { loadAmap } from '@/services/amap';
it('未填写Key时不发送地图请求，不显示虚构线路', async () => {
  const append = vi.spyOn(document.head, 'appendChild');
  await expect(loadAmap()).rejects.toThrow('.env.local');
  expect(append).not.toHaveBeenCalled();
  append.mockRestore();
});

it('多规划策略返回相同路径时合并，保留不同备选路线', async () => {
  const { mergeRouteOptions } = await import('@/services/amap');
  const fast = { distance: 10000, time: 900, steps: [{ path: [[104, 30], [104.1, 30.1]], instruction: '直行' }] };
  const short = { distance: 9000, time: 1000, steps: [{ path: [[104, 30], [104.05, 30.2], [104.1, 30.1]], instruction: '右转' }] };
  const options = mergeRouteOptions([
    { label: '时间优先', data: { routes: [fast] } },
    { label: '少收费', data: { routes: [fast] } },
    { label: '距离优先', data: { routes: [short] } },
  ]);
  expect(options).toHaveLength(2);
  expect(options[0].labels).toEqual(['时间优先', '少收费']);
  expect(options[1].route).toEqual(short);
  expect(mergeRouteOptions([{ label: '无结果', data: {} }])).toEqual([]);
});
