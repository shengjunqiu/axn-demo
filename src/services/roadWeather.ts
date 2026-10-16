import { incidentById, factText } from '@/seed/scenario';

export function roadWeatherReply(eventId: string): string {
  const event = incidentById.get(eventId);
  if (!event) return '请先关联事件，再核对道路与天气。';
  const category = factText(event.factRefs.disasterType);
  const roadChecks = /滑坡|崩塌|泥石流|地震/.test(category)
    ? '核实塌方、落石、道路阻断、便道承载能力及安全绕行路线。'
    : /冰雪|低温/.test(category)
      ? '核实积雪结冰、封路管制、防滑条件及替代运输方式。'
      : /洪涝|内涝|积水|堤防|堰塞|水库/.test(category)
        ? '核实低洼路段积水、桥涵通行、堤顶道路承载及绕行条件。'
        : '核实进场道路、桥涵承载、交通管制及备选路线。';
  return `核对范围：${factText(event.factRefs.title)}；${factText(event.factRefs.location)}。\n\n道路通行：待核实。当前未取得本事件的实时路况、交通管制或现场通行回执，不能确认道路畅通。\n天气情况：待核实。当前未取得事发区域的实况天气、预报及气象预警，不能确认降雨、风力或能见度。\n\n道路核验要点：${roadChecks}\n天气核验要点：核实降雨、风力、能见度及预警有效期，评估其对进场、投送和作业的影响。\n建议补充：现场或交管部门的通行回执，以及气象部门发布的实况、预报和预警；记录来源、发布时间和适用路段。\n核对结论：资料不足，暂不能形成可通行或适宜作业的结论。以上为原型核验提示，未接实时道路与天气服务。`;
}
