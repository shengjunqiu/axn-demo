import { disasterProfileById } from '@/seed/disasterScenarios';
import type { DisasterSourceGroup } from '@/domain/multiSource';

/** 根据本地读数与事件场景生成模拟研判；不代表真实模型或影像识别结果。 */
export function multiSourceBrief(source: DisasterSourceGroup, eventId?: string): string {
  const records = source.records.filter(record => !record.duplicateOf);
  if (!records.length) return '已按事件场景梳理核查重点，建议优先确认现场风险。';
  const first = records[0];
  const content = first.content;
  const profile = eventId ? disasterProfileById.get(eventId) : undefined;
  const context = `${profile?.category ?? ''} ${profile?.risks ?? ''} ${content}`;
  const debris = /泥石流/.test(context);
  const landslide = /滑坡|边坡/.test(context);
  const flood = /洪涝|决口|堤防|内涝/.test(context);
  if (source.kind === '现场影像') return debris
    ? '沟道淤堵可能影响通行，需关注回水及受困车辆。'
    : landslide ? '滑坡体可能影响道路和房屋，需排查受威胁区域。'
    : flood ? '堤段及周边存在受淹风险，需核查漫溢范围。'
    : '现场作业与通行条件仍需复核，优先排查受威胁点。';
  if (source.kind === '舆情') return /道路受影响/.test(content)
    ? '道路通行与救援进展关注集中，需及时核实回应。'
    : '险情信息尚需交叉核实，避免误报影响救援判断。';
  if (source.kind === '接报记录') return debris
    ? '泥石流清障仍有受困与再发风险，优先排险救人。'
    : landslide ? '滑坡威胁人员及道路，优先搜救并防范二次滑塌。'
    : flood ? '洪涝险情影响周边安全，优先转移并控制险情。'
    : '接报显示存在救援需求，需先核实影响范围和人员。';
  // 监测时间序列只描述末两次读数的变化，不外推未来趋势。
  const readings = [...content.matchAll(/\d{1,2}:\d{2}\s+(-?\d+(?:\.\d+)?)([^；\s]*)/g)];
  if (readings.length) {
    const latest = readings.at(-1)!;
    const previous = readings.at(-2);
    if (!previous) return '仅有单次监测，变化趋势尚不能判断。';
    const change = previous ? Number(latest[1]) > Number(previous[1]) ? '有所上升' : Number(latest[1]) < Number(previous[1]) ? '有所回落' : '与上次持平' : '已有读数';
    const label = first.title.replace(/样例记录$/, '');
    const unit = ({ mm: '毫米', m: '米' } as Record<string, string>)[latest[2]] ?? latest[2];
    const trend = previous ? Number(latest[1]) - Number(previous[1]) : 0;
    const brief = source.kind === '气象' && /雨量/.test(label)
      ? trend > 0 ? '降雨增强，需关注道路受阻及次生灾害风险。' : '降雨有所减弱，仍需关注积水和次生灾害。'
      : source.kind === '水文'
        ? trend > 0 ? '水文读数上升，需关注积水及下游受影响情况。' : '水文读数趋稳或回落，仍需核查现场水情。'
        : source.kind === '地质'
          ? trend > 0 ? '变形监测读数上升，需加强边坡与作业区巡查。' : '变形读数趋稳或回落，仍不能排除局部失稳。'
          : `${label}${change}，最新${latest[1]}${unit}。`;
    if (Array.from(brief).length <= 30) return brief;
    return `${source.kind}监测已更新，具体读数见详情。`;
  }
  if (source.kind === '气象') {
    const rain = content.match(/降雨量([\d.]+)毫米/);
    return rain ? '存在降雨背景，出动前需复核道路与天气条件。' : '按降雨影响场景，重点防范道路积水与次生灾害。';
  }
  if (source.kind === '水文') {
    const level = content.match(/水位\s*([\d.]+)\s*(?:米|m)/);
    return level ? '单次水位不足以判断趋势，需结合现场核查。' : '重点关注积水变化及下游受影响区域。';
  }
  const displacement = content.match(/位移([\d.]+)毫米/);
  const crack = content.match(/裂缝宽度([\d.]+)毫米/);
  if (displacement && crack) return '存在位移和裂缝线索，需复核局部失稳风险。';
  return '优先排查边坡变形、裂缝与局部失稳风险。';
}
