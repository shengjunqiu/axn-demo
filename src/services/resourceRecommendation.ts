import { factDisplay, resourceAllowed } from './factLookup';
import { vueDemoResourcesForEvent } from '@/seed/vueDemoResources';
import { disasterProfileById } from '@/seed/disasterScenarios';
import { incidentById, factText, teams, warehouses } from '@/seed/scenario';
import { eventEssentials } from './eventEssentials';
import { tacticOptions } from './customerDocuments';

export type RecommendationCandidate = { id: string; name: string; kind: string; capability: string; amount: string; status: string; distance: number; eta: number; estimated: boolean };
export function rankResourceCandidates(candidates: RecommendationCandidate[], keywords: string[]) {
  return candidates.filter(c => !/不可|不可用|维修|停用|无法/.test(c.status)).map(c => {
    const matching = keywords.filter(word => `${c.capability}${c.name}`.includes(word));
    const match = Math.min(1, matching.length / 2);
    const priority = c.kind === 'team' ? 1 : c.kind === 'equipment' || c.kind === 'expert' ? 0.9 : 0.6;
    const score = 40 * match + 25 * Math.max(0, 1 - c.eta / 120) + 15 * Math.max(0, 1 - c.distance / 100) + 20 * priority;
    return { ...c, score, matching };
  }).sort((a, b) => b.score - a.score || a.eta - b.eta || a.id.localeCompare(b.id));
}

export function resourceRecommendationReply(eventId: string): string {
  const incident = incidentById.get(eventId);
  if (!incident) return '请先关联有效灾害事件，再生成资源建议。';
  const profile = disasterProfileById.get(eventId);
  const category = factText(incident.factRefs.disasterType);
  const keywords = /滑坡|泥石流|崩塌/.test(category) ? ['地质', '监测', '清障', '搜救']
    : /地震/.test(category) ? ['搜救', '破拆', '生命', '医疗']
    : /电网/.test(category) ? ['电力', '供电', '抢修', '通信']
    : /矿/.test(category) ? ['矿', '通风', '气体', '搜救']
    : /冰雪/.test(category) ? ['除雪', '保通', '防滑', '运输']
    : /堤防|管涌|决口|水库|堰塞/.test(category) ? ['抢险', '监测', '工程', '排水'] : ['水域', '排涝', '排水', '救援'];
  const candidates = vueDemoResourcesForEvent(eventId).filter(r => ['team', 'equipment', 'expert', 'warehouse', 'supportUnit'].includes(r.kind)).map((r, index) => {
    const distance = Number(r.distanceLabel.match(/[\d.]+/)?.[0]) || 8 + index * 12;
    return { id: r.id, name: r.name, kind: r.kind, capability: r.capability, amount: r.amountLabel, status: r.status, distance, eta: Math.ceil(distance / 40 * 60 + 15), estimated: !/[\d]/.test(r.distanceLabel) };
  });
  if (!candidates.length) {
    const scope = { kind: 'event' as const, eventId };
    for (const team of teams.filter(t => resourceAllowed(t.resourceId, eventId) && !t.unavailableReason)) {
      const f = (key: string) => factDisplay(team.factRefs[key], scope);
      candidates.push({ id: team.resourceId, name: f('name'), kind: 'team', capability: f('capabilityTags'), amount: `${f('peopleCount')}人`, status: f('status'), distance: Number(f('distanceKm').match(/[\d.]+/)?.[0]) || 0, eta: Number(f('etaMinutes').match(/[\d.]+/)?.[0]) || 0, estimated: true });
    }
    for (const warehouse of warehouses.filter(w => resourceAllowed(w.resourceId, eventId))) {
      candidates.push({ id: warehouse.resourceId, name: factDisplay(warehouse.factRefs.name, scope), kind: 'warehouse', capability: '抢险物资保障', amount: '库存待核', status: '候选待确认（模拟）', distance: 20, eta: 45, estimated: true });
    }
  }
  const ranked = rankResourceCandidates(candidates, keywords);
  const selected: typeof ranked = [];
  // 满足专业队伍、作业装备、保障/专家的组合约束；同一资源仅取一次。
  for (const kinds of [['team'], ['equipment'], ['expert', 'warehouse', 'supportUnit']]) {
    const hit = ranked.find(r => kinds.includes(r.kind) && !selected.some(s => s.id === r.id));
    if (hit) selected.push(hit);
  }
  const missing = [!selected.some(r => r.kind === 'team') ? '专业救援队伍' : '', !selected.some(r => r.kind === 'equipment') ? '作业装备' : '', !selected.some(r => ['expert', 'warehouse', 'supportUnit'].includes(r.kind)) ? '专家或保障单元' : ''].filter(Boolean);
  const strategy = tacticOptions(eventId)[0];
  const recommendation = selected.length ? selected.map((r, i) => `${i + 1}. ${r.name}：${r.amount}；能力：${r.capability}；状态：${r.status}。\n   距离约${r.distance}公里${r.estimated ? '（模拟假设）' : '（演示距离）'}，预计${r.eta}分钟到场（按40公里/小时+15分钟准备时间模拟估算）；综合分${r.score.toFixed(1)}/100。推荐理由：${r.matching.length ? `匹配${r.matching.join('、')}任务` : '补齐人员、作业或保障岗位'}。`).join('\n\n') : '当前事件没有适用的候选资源，需补充资源清单后再推荐。';
  return `救援资源管理智能体 · 资源建议（模拟）\n\n${eventEssentials(eventId)}\n\n资源需求：${profile?.objective ?? `围绕${category}优先保障人员安全与专业处置`}；${profile?.gaps ?? '实际任务量、人员装备缺口待核实'}。\n救援策略：${strategy?.organization ?? '先遣核查与风险评估，专业队伍和作业装备协同投入，保障岗位跟进。'}\n优先级：人员安全与专业匹配优先，再比较到场时效、距离和保障需求。\n\n推荐组合：\n${recommendation}\n\n比较规则：专业匹配40%、时效25%、距离15%、任务优先级20%；在当前模拟候选中分别择优选取队伍、装备和保障/专家，不能认定为真实全域最优。\n约束与缺口：${missing.length ? `缺少${missing.join('、')}，组合暂不完整；` : ''}通行、数量、可出动状态及现场授权须复核；90分钟内到场优先，超时资源作为后续增援。${selected.some(r => r.eta > 90) ? '本组合存在超过90分钟的候选，需核对就近替代资源。' : ''}\n数据说明：以上使用当前事件的本地模拟资源；估算不含真实路况、装载和交通管制影响，未形成实际调派。`;
}
