/** 智能编组推荐演示：在本事件候选范围内比较完整人装物资组合。 */
import type { ConstructionResult } from '@/seed/constructionScenarios';
import { disasterProfileById } from '@/seed/disasterScenarios';
import { incidentById, teams, warehouses } from '@/seed/scenario';
import { vueDemoResourcesForEvent } from '@/seed/vueDemoResources';
import { factDisplay, resourceAllowed } from './factLookup';
import { rankResourceCandidates, type RecommendationCandidate } from './resourceRecommendation';

export type GroupCandidate = RecommendationCandidate & { road: 'passable' | 'blocked' | 'unknown' };
export function optimizeGroup(candidates: GroupCandidate[], keywords: string[], deadline = 90) {
  const ranked = rankResourceCandidates(candidates.filter(c => c.road !== 'blocked' && c.eta <= deadline), keywords).map(c => ({ ...c, road: candidates.find(original => original.id === c.id)!.road }));
  const teamOptions = ranked.filter(c => c.kind === 'team');
  const equipmentOptions = ranked.filter(c => c.kind === 'equipment');
  const materialOptions = ranked.filter(c => ['warehouse', 'supportUnit'].includes(c.kind));
  const combinations = teamOptions.flatMap(team => equipmentOptions.flatMap(equipment => materialOptions.map(material => {
    const selected = [team, equipment, material];
    const arrival = Math.max(...selected.map(c => c.eta));
    const spread = arrival - Math.min(...selected.map(c => c.eta));
    const roadPenalty = selected.filter(c => c.road === 'unknown').length * 5;
    return { selected, arrival, score: selected.reduce((sum, c) => sum + c.score, 0) / 3 - spread * 0.1 - roadPenalty };
  }))).sort((a,b) => b.score - a.score || a.arrival - b.arrival || a.selected.map(c=>c.id).join().localeCompare(b.selected.map(c=>c.id).join()));
  const best = combinations[0];
  return { best, alternatives: combinations.slice(1,3), missing: [!teamOptions.length ? '专业队伍' : '', !equipmentOptions.length ? '作业装备' : '', !materialOptions.length ? '物资／保障单元' : ''].filter(Boolean), excluded: candidates.filter(c=>c.road==='blocked' || c.eta > deadline || /不可|维修|停用|无法/.test(c.status)) };
}

export function buildGroupRecommendation(eventId: string, input = ''): ConstructionResult {
  const incident = incidentById.get(eventId);
  if (!incident) throw Error('请先关联有效灾情');
  const scope = { kind: 'event' as const, eventId };
  const profile = disasterProfileById.get(eventId);
  const category = factDisplay(incident.factRefs.disasterType, scope);
  const name = factDisplay(incident.factRefs.title, scope);
  const keywords = /滑坡|泥石流|崩塌/.test(category) ? ['地质','监测','清障','搜救'] : /地震/.test(category) ? ['搜救','破拆','医疗'] : /冰雪/.test(category) ? ['除雪','保通','运输'] : ['抢险','工程','排水','救援'];
  const roadBlocked = /主路.*阻断|道路.*封闭|无法通行/.test(input);
  const roadConfirmed = !roadBlocked && /道路.*(?:确认畅通|已核实可通行)/.test(input);
  const deadlineMatch = input.match(/(\d+)分钟(?:内)?(?:到场|到达)/);
  const deadline = deadlineMatch ? Math.max(1, Number(deadlineMatch[1])) : 90;
  const road: GroupCandidate['road'] = roadBlocked ? 'blocked' : roadConfirmed ? 'passable' : 'unknown';
  const candidates: GroupCandidate[] = vueDemoResourcesForEvent(eventId).filter(r=>['team','equipment','warehouse','supportUnit','expert'].includes(r.kind)).map((r,index)=>{
    const actualDistance = Number(r.distanceLabel.match(/[\d.]+/)?.[0]);
    const distance = Number.isFinite(actualDistance) ? actualDistance : 8 + index * 12;
    return { id:r.id, name:r.name, kind:r.kind, capability:r.capability, amount:r.amountLabel, status:r.status, distance:Number.isFinite(distance)?distance:0, eta:Math.ceil(distance/40*60+15), estimated:true, road };
  });
  if (!candidates.length) {
    for (const team of teams.filter(t=>resourceAllowed(t.resourceId,eventId))) {
      const value=(key:string)=>factDisplay(team.factRefs[key],scope);
      const distance=Number(value('distanceKm').match(/[\d.]+/)?.[0]);
      const eta=Number(value('etaMinutes').match(/[\d.]+/)?.[0]);
      candidates.push({id:team.resourceId,name:value('name'),kind:'team',capability:value('capabilityTags'),amount:`${value('peopleCount')}人`,status:team.unavailableReason?'不可用':value('status'),distance:Number.isFinite(distance)?distance:0,eta:Number.isFinite(eta)?eta:deadline+1,estimated:true,road});
    }
    for (const warehouse of warehouses.filter(w=>resourceAllowed(w.resourceId,eventId))) candidates.push({id:warehouse.resourceId,name:factDisplay(warehouse.factRefs.name,scope),kind:'warehouse',capability:'抢险物资保障',amount:'库存待核',status:'候选待确认',distance:20,eta:45,estimated:true,road});
  }
  const requestedKeywords = ['破拆','搜救','监测','清障','医疗','排水','运输','抢险','工程'].filter(word => input.includes(word));
  const result = optimizeGroup(candidates, requestedKeywords.length ? requestedKeywords : keywords, deadline);
  const roadText = roadBlocked ? '主路阻断，未取得可通行备用路线；暂停生成完整编组，需补核通道、限高限载与绕行时间' : roadConfirmed ? '用户补充道路已核实可通行（仍须核对适用路段与车辆）' : '道路通行、交通管制及装备限高限载未取得，推荐须核路后确认';
  const objective = input.match(/任务需求[：:]([^；\n]+)/)?.[1]?.trim() || profile?.objective || `围绕${category}现场专业处置与人员安全保障`;
  const selected = result.best?.selected ?? [];
  const groupText = selected.length ? selected.map((c,i)=>`${i+1}. ${c.name}：${c.amount}；${c.capability}；约${c.distance}公里，预计${c.eta}分钟；状态：${c.status}`).join('\n') : `未形成完整编组：缺少${result.missing.join('、') || '满足时效和通行约束的组合'}，请补充本事件资源。`;
  const summary = result.best ? `已按${category}、${objective}、道路条件及${deadline}分钟到场窗口，在${candidates.length}个本地候选中比较人装物资组合，推荐综合分${result.best.score.toFixed(1)}的相对优选组合。通行、数量、操作手资质及真实到位时间待负责人确认。` : `本事件候选尚不能形成满足条件的完整人装物资编组，缺口：${result.missing.join('、') || '完整可用组合'}。不以空组合冒充最优方案。`;
  const tableRows = (items: typeof selected) => items.map(c=>[c.kind==='team'?'救援力量':c.kind==='equipment'?'作业装备':'物资保障',c.name,c.amount,c.capability,`${c.distance}公里／${c.eta}分钟`,roadText,c.score.toFixed(1)]);
  return { capability:'group',agentId:'agent-resource',title:`${name} · 智能编组推荐方案`,summary,dataTime:profile?.capturedAt ?? '本地台账时点待核',
    sections:[
      {title:'任务与推荐约束',text:`灾种：${category}\n任务需求：${objective}\n到场窗口：${deadline}分钟（默认模拟目标，可输入调整）\n距离与时效：未接真实定位时，以8＋候选顺序×12公里作为演示距离；按40公里/小时＋15分钟准备时间估算。不是实际距离或通行时间\n道路条件：${roadText}\n资源数量：保留原台账数量，实际任务量、需求数与可出动数不全时不自动确定派遣数量。`},
      {title:'推荐力量与装备物资组合',text:groupText},
      {title:'比较规则与推荐理由',text:'专业匹配40%、时效25%、距离15%、任务优先级20%；枚举队伍＋装备＋物资保障的完整组合，按平均得分减到场衔接差和道路未知惩罚排序，过滤不可用、已知阻断及超时候选。仅为当前模拟候选中的相对优选，不是实战全域最优。'},
      {title:'缺口与确认事项',text:`${result.missing.length?`缺少：${result.missing.join('、')}。`:'现有组合覆盖队伍、装备与物资保障类别，数量和专业胜任仍需核对。'}\n${profile?.gaps ?? '需求数量和工程参数待核'}\n核对驾驶员／操作手资质、装备装载、轮换、通行许可及正式可出动状态；编组不自动占用资源或形成调度命令。`},
    ],
    tables:[
      {title:'推荐编组与装备物资搭配表',headers:['组成','资源','台账数量','能力','距离／估算到场','通行条件','单项得分'],rows:tableRows(selected).length?tableRows(selected):[['待补','暂无完整组合','待核','待核','待核',roadText,'不评分']]},
      {title:'备选组合比较表',headers:['组合','队伍','装备','物资保障','最晚到场','综合分'],rows:[...(result.best?[result.best]:[]),...result.alternatives].map((c,i)=>[i===0?'推荐组合':`备选${i}`,c.selected[0].name,c.selected[1].name,c.selected[2].name,`${c.arrival}分钟（估算）`,c.score.toFixed(1)])},
      {title:'未纳入候选与原因',headers:['资源','状态','到场估算','未纳入原因'],rows:result.excluded.map(c=>[c.name,c.status,`${c.eta}分钟`,c.road==='blocked'?'通行阻断':c.eta>deadline?'超过到场窗口':'资源不可用'])},
    ].filter(t=>t.rows.length),notice:'本地规则与模拟资源推荐；距离、时效及道路均需复核，数量未按完整任务参数优化，不代表正式调派或实战最优。' };
}
