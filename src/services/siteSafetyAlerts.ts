import type { DisasterProfile } from '@/seed/disasterScenarios';

export type SiteAlert = {
  id: string; category: string; title: string; state: '已有模拟线索' | '还没核实';
  place: string; impact: string; action: string; contact: string; source: string;
};

/** 只归纳当前事件已有线索；没有设施位置和影响分析时，不编造学校/医院受灾结论。 */
export function siteSafetyAlerts(p: DisasterProfile): SiteAlert[] {
  const roads = p.riskDistribution.filter(r => /路|桥|道/.test(r.area)).map(r => r.area);
  const rain = p.monitoring.find(m => /雨/.test(m.label));
  const rainValue = rain?.values.at(-1);
  const hospitals = p.resources.filter(r => r.kind === 'hospital');
  const plainRisk = /滑坡/.test(p.category)
    ? '山坡可能继续移动、掉石头或再次滑塌。'
    : /泥石流/.test(p.category) ? '沟里可能再次冲下泥石流，堵塞后可能积水回流，车辆可能受困。'
    : `需要注意：${p.risks}。`;
  return [
    { id: 'people', category: '人员房屋', title: '先看现场人员和房屋', state: '已有模拟线索',
      place: p.impactScope, impact: `${plainRisk} 人员记录：${p.casualty}。`,
      action: '先核对危险区域是否还有人员，按现场指挥和安全岗位要求设置警戒、组织避险，不自行进入危险区。', contact: '现场指挥、安全员、属地村镇人员', source: '当前事件概况和风险记录（模拟）' },
    { id: 'roads', category: '道路桥梁', title: '哪些路要核实，车辆还能不能走', state: roads.length ? '已有模拟线索' : '还没核实',
      place: roads.length ? roads.join('、') : '通往现场的道路、桥梁和便道，具体路段待补',
      impact: roads.length ? `这些地方有风险线索；${p.impactScope}。是否封路、哪些车能通过、能否绕行，还没核实。` : '没有取得具体路段的通行情况，不能当作道路畅通。',
      action: '出车前确认路段、车型限制和绕行路线；未确认的路线不要按“可通行”安排。', contact: '交通联络员、交警、道路管理或属地人员', source: '当前事件影响范围和风险位置记录（模拟），未接实时路况' },
    { id: 'schools', category: '学校医院', title: '附近学校会不会受影响', state: '还没核实',
      place: '学校名称、位置和师生在校情况待补', impact: '还没有学校位置与灾害影响范围的对照资料，目前不能判断哪所学校受威胁；也不能把学校直接当作安置点。',
      action: '请属地核实学校位置、进出道路、师生人数，以及是否需要停课或转移，再由现场指挥协调处置。', contact: '属地政府、教育部门、学校负责人', source: '缺少学校位置及影响核查资料' },
    { id: 'hospitals', category: '学校医院', title: '附近医院和送医道路是否受影响', state: '还没核实',
      place: hospitals.length ? `${hospitals.map(r => r.name).join('、')}（仅为候选资源）` : '医院名称、位置和送医路线待补',
      impact: '尚未核实医院是否受影响、能否正常接诊、救护车走哪条路。资源清单里有医院，不代表医院安全或道路可用。',
      action: '联系医疗联络员确认接诊能力、送医路线和备用医院，再安排伤员转运。', contact: '医疗联络员、医院和急救人员', source: hospitals.length ? '本事件医疗资源候选，受影响情况未核实' : '缺少医院及送医路线核查资料' },
    { id: 'weather', category: '天气变化', title: '天气会不会让危险加重', state: rainValue == null ? '还没核实' : '已有模拟线索',
      place: p.location, impact: rainValue == null ? '尚无可用的降雨监测资料，也没有最新气象预警。' : `本地模拟记录：${rain!.label} ${rainValue}${rain!.unit}，记录时间 ${rain!.times.at(-1)}。尚未取得最新气象预报和正式预警，不能据此判断后面是否继续下雨。`,
      action: '请气象联络或值班人员核实最新降雨、雷电、大风和能见度提醒，及时告知现场安全员和司机。', contact: '气象或值班联络员、现场安全员', source: rainValue == null ? '气象资料待补' : `${rain!.source}；正式气象预警未接入` },
    { id: 'facilities', category: '其他隐患', title: '供电、通信和其他危险点要不要注意', state: '还没核实',
      place: '现场周边电力线路、通信设施、加油站及其他危险点待核查', impact: '没有取得这些设施的位置和受影响情况，可能影响现场联络、用电、加油和后勤保障。',
      action: '安排属地和保障人员核查，补齐断电断网、燃油泄漏等异常线索；发现异常先报告现场安全员，由专业人员处置。', contact: '属地人员、电力通信及综合保障人员', source: '设施位置、运行状态及现场反馈待补' },
  ];
}

export function safetyAlertDraft(p: DisasterProfile, alerts: SiteAlert[]): string {
  return `${p.name} · 现场危险提醒（模拟草稿，待核实）\n资料时间：${p.capturedAt}\n${alerts.map(a => `【${a.title}｜${a.state}】\n位置：${a.place}\n需要注意：${a.impact}\n建议核查：${a.action}\n联系岗位：${a.contact}\n依据：${a.source}`).join('\n\n')}\n以上不是正式预警或作业指令；有效期和处置安排由现场负责人确认。`;
}
