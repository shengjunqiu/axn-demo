import { simulatedKnowledgeSearchReply } from './knowledgeSearchSimulation';
/** 评估快捷回复与复盘总结共用正文模块；查询状态不执行正式发布或伪造外部检索。 */
import { RESCUE_EVALUATION_MOCK } from '@/seed/rescueEvaluation';
import { disasterProfileById } from '@/seed/disasterScenarios';
import { incidentById } from '@/seed/scenario';
import { eventDisplayName } from './factLookup';
import { buildEventTimeline } from './eventTimeline';
import { comparePlanAndSummary } from './customerDocuments';
import { useCustomerOperations } from '@/store/customerOperationsStore';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useKnowledgeCaseStore } from './knowledgePublish';

export const EVALUATION_TEXT_ACTIONS = ['七环节救援时间轴', '预案条款对照', '正式知识库审核发布', '正式知识检索'] as const;
export type EvaluationTextAction = typeof EVALUATION_TEXT_ACTIONS[number];
export function evaluationModuleTexts(eventId: string, sessionId: string, actualText?: string): Record<string,string> {
  if (!incidentById.has(eventId)) return Object.fromEntries(['救援效果评估','资源投入偏差评估',...EVALUATION_TEXT_ACTIONS,'事件沉淀'].map(name=>[name,'请先关联有效灾情，再读取本事件资料。']));
  const record = RESCUE_EVALUATION_MOCK[eventId];
  const profile = disasterProfileById.get(eventId);
  const timeline = buildEventTimeline(eventId);
  const cases = useKnowledgeCaseStore.getState().casesForEvent(eventId);
  const operations = useCustomerOperations.getState();
  const summary = actualText ?? useMockDocumentStore.getState().libraries[sessionId]?.documents.find(d=>/WORK_SUMMARY/.test(d.code))?.sections.map(([h,b])=>`${h}：${b}`).join('\n') ?? '';
  const plan = profile?.planSections.map(([h,b])=>`${h}：${b}`).join('\n') ?? '';
  const comparisons = plan && summary ? comparePlanAndSummary(plan,summary) : [];
  return {
    救援效果评估: record ? `阶段目标：${record.objective}；目标${record.target}${record.unit}，样例完成${record.completed}${record.unit}。${record.target>0?`样例进度${Math.round(record.completed/record.target*100)}%，不等于验收完成率。`:'缺少有效分母，不计算完成率。'}\n投入：${record.personnel}人、${record.equipment}台；响应${record.responseMinutes}分钟（均为模拟）。\n剩余风险：${record.risk}\n改进建议：${record.next}` : '实际作业量、投入、验收与消耗记录不足，暂不形成成效结论。',
    资源投入偏差评估: `计划与实际口径：${record?`响应目标${record.targetMinutes}分钟，样例响应${record.responseMinutes}分钟，时效偏差${record.responseMinutes-record.targetMinutes}分钟；实际投入样例${record.personnel}人、${record.equipment}台。`:'缺少计划与实际数据。'}\n尚无经批准的人装投入计划和正式到场／消耗凭证，不推算人员装备数量偏差；需核对计划版本、统计时点和单位。`,
    七环节救援时间轴: `${timeline.items.map((item,i)=>`${i+1}. ${item.time} · ${item.title}：${item.detail}`).join('\n')}\n${timeline.notice}\n可在“救援复盘与知识”面板补录七环节与来源，未取得实际节点不补造。`,
    预案条款对照: `预案依据：${profile?.planTitle ?? '未取得适用预案'}（本地参考，正式版本待核）。\n${comparisons.length?comparisons.slice(0,6).map((c,i)=>`${i+1}. ${c.plan}\n对照：${c.result}；证据：${c.evidence}\n建议：${c.hint}`).join('\n'):'尚缺本事件总结或预案条款，请补齐后定位对应证据。'}\n文字关联仅辅助定位，不判定落实、合规或因果。`,
    事件沉淀: `本事件案例候选${cases.length}条。${cases.length?cases.map(c=>`${c.title}：${c.status}`).join('\n'):'尚无保存的案例候选；可在总结完成后整理案例。'}\n沉淀内容应保留事件、预案版本、过程时间轴、偏差及改进证据。候选／本地模拟入库不等于正式知识发布。`,
    正式知识库审核发布: `本事件候选${cases.length}条；正式知识库接口${operations.connection.knowledge?'已配置，尚需人工审核确认':'未配置，当前未执行正式发布'}。\n${cases.map(c=>{const p=operations.publications.find(p=>p.caseId===`${c.id}:${c.updatedAt}`);return `${c.title}：${p?.status ?? '未发布'}；${p?.receipt ?? '无正式回执'}`;}).join('\n')}\n本按钮仅查看发布准备与状态，不执行发送。在“救援复盘与知识”中核对来源、版本和内容后审核发布。`,
    正式知识检索: `正式知识库接口${operations.connection.knowledge?'已配置，请在“救援复盘与知识”输入检索词发起真实查询':'未配置，未查询正式库，不生成虚构正式检索结果'}。\n本事件本地候选${cases.length}条，仅供参考，不冒充正式库返回。`,
  };
}
export function evaluationActionReply(action: EvaluationTextAction,eventId:string,sessionId:string): string {
  if (action === '正式知识检索') return simulatedKnowledgeSearchReply(eventId);
  const modules=evaluationModuleTexts(eventId,sessionId);
  return `${action} · ${incidentById.has(eventId)?eventDisplayName(eventId):'待关联事件'}\n\n${modules[action]}\n\n以上为原型资料整理与状态说明，需复核。`;
}
