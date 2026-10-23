/** 知识检索效果演示：仅检索本事件本地资料，不调用或伪造正式库接口。 */
import { disasterProfileById } from '@/seed/disasterScenarios';
import { incidentById } from '@/seed/scenario';
import { factDisplay, eventDisplayName } from './factLookup';
import { useKnowledgeCaseStore } from './knowledgePublish';

export function simulatedKnowledgeSearchReply(eventId: string): string {
  const incident = incidentById.get(eventId);
  if (!incident) return '正式知识检索 · 模拟\n\n请先关联有效灾情，再模拟检索本事件资料。';
  const profile = disasterProfileById.get(eventId);
  const category = factDisplay(incident.factRefs.disasterType, { kind:'event', eventId });
  const source = profile?.planTitle ?? `${category}专业指导资料（模拟示例）`;
  const cases = useKnowledgeCaseStore.getState().casesForEvent(eventId);
  const guidance = profile?.planSections.find(([heading]) => /安全红线|撤离/.test(heading));
  const tactic = profile?.planSections.find(([heading]) => /主战法/.test(heading));
  const items = [
    { title: `${category}处置预案与作业步骤`, type:'预案规范', source, version:'本地参考 V1（模拟版本）', match:`灾种“${category}”与当前任务“${profile?.objective ?? '专业处置'}”匹配`, body:tactic?.[1] ?? '示例指导：先开展专业侦测与风险核查，核对适用预案和作业条件，再组织经审定的现场处置；专业战法条款待补。' },
    { title: `${category}安全预警与撤离指导`, type:'专业指导', source:guidance ? `${source}／${guidance[0]}` : '现场安全指导样例（模拟）', version:'本地参考 V1（模拟版本）', match:`匹配当前风险“${profile?.risks ?? '现场作业风险待核'}”`, body:guidance?.[1] ?? '示例指导：核实警戒、进入许可、通信和撤离路线；监测异常时由技术与安全岗位决定停工及撤离，样例不作为安全阈值。' },
    ...(cases.length ? cases.slice(0,2).map(c=>({ title:c.title,type:'本地案例候选',source:'本事件复盘／事件沉淀记录（本地）',version:`${c.updatedAt}；${c.status}`,match:'事件标识与当前事件一致；作为可追溯复盘参考',body:c.body })) : [{ title:`${category}复盘改进案例（模拟示例）`,type:'案例参考',source:'原型模拟案例，非真实历史案例',version:'演示样例 V1',match:`围绕“${profile?.objective ?? '本事件任务'}”和本灾种风险整理参考`,body:`案例摘要（模拟）：围绕${profile?.objective ?? '专业救援任务'}，复盘现场侦测、通信交接与物资保障。改进重点：${profile?.gaps ?? '补齐过程、验收、消耗和轮换证据'}。适用性及实际成效需复核。` }]),
  ];
  return `正式知识检索 · ${eventDisplayName(eventId)}\n\n【模拟检索完成】\n检索词：${category}、${profile?.objective ?? '处置预案'}、安全预警、复盘经验\n检索范围：本事件本地预案、专业指导及案例样例\n匹配结果：${items.length}条\n\n${items.map((item,i)=>`【${i+1}】${item.title}\n类型：${item.type}\n来源：${item.source}\n版本：${item.version}\n匹配理由：${item.match}\n内容详情：${item.body.slice(0,650)}${item.body.length>650?'……（原文较长，可到复盘与知识面板查看完整候选）':''}`).join('\n\n')}\n\n建议：先核对预案版本与现场条件，再选用适用条款；案例仅作参考。\n模拟说明：本次为本地检索效果演示，未查询正式库；来源、版本和案例均按上述标识区分，不代表正式知识已发布。`;
}
