import { amapConfig } from '@/config/amap';
import { incidentById, factText } from '@/seed/scenario';
import { useSessionStore } from '@/store/sessionStore';

export function roadWeatherReply(eventId: string): string {
  const event = incidentById.get(eventId);
  if (!event) return '请先关联事件，再核对道路与天气。';
  const category = factText(event.factRefs.disasterType);
  const terrain = /滑坡|崩塌|泥石流|地震/.test(category)
    ? '绕开塌方、落石与坡脚危险路段，检查点设在受影响区域外。'
    : /冰雪|低温/.test(category)
      ? '避开积雪结冰路段，装备车辆采用防滑措施，人员可分批转运。'
      : /洪涝|内涝|积水|堤防|堰塞|水库/.test(category)
        ? '避开低洼积水及临水路段，沿绕行道路进入前方集结点。'
        : '优先采用外围通道，经过通行检查点后分批进场。';
  return `路线规划：已按照出发地与目的地，为您整理驾车路线。演示起点为${amapConfig.origin}，终点为${amapConfig.destination}。路线信息展示途经道路、行驶方向、距离与预计耗时，以地图路线结果为准。\n\n天气与沿途道路提醒：${terrain}按降雨影响场景，建议注意湿滑路面与能见度变化，出发前再次查看天气预报和沿途路况。`;
}

export function startRouteConversation(sessionId: string, request: string, weather = true) {
  const store = useSessionStore.getState();
  const session = store.sessions[sessionId];
  if (!session) return;
  const parts = roadWeatherReply(session.eventId).split('\n\n');
  store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text: request, taskId: null });
  store.appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', taskId: null,
    text: '需要我用地图为您展示这条线路吗？',
    reviewSummary: { conclusion: '已设置演示起终点，可通过高德地图查看驾车路线。', rows: [
      { label: '路线规划', value: `${amapConfig.origin} → ${amapConfig.destination}（演示起终点）。地图中展示途经道路、行驶方向、里程和预计耗时。` },
      ...(weather ? [{ label: '天气与道路提醒', value: parts[1]?.replace('天气与沿途道路提醒：', '') ?? '出发前查看天气预报与沿途路况，注意降雨和湿滑路面。' }] : []),
    ] }, summaryOffer: { kind: 'map' } });
}
