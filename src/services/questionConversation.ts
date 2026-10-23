import { disasterProfileById } from '@/seed/disasterScenarios';
import { useSessionStore } from '@/store/sessionStore';
import { stageChoices, type StageChoice } from './stageConversation';

/** 提问入口先给出业务答复，报告仅在后续明确确认后生成。 */
export function answerStageQuestion(sessionId: string, text: string, selected?: StageChoice | null): boolean {
  if (/(?:生成|出具|编制|起草).*(?:报告|公文|文书|要情|方案|材料)/.test(text)) return false;
  const inferred = /资源/.test(text) && /哪些|什么|多少|缺口|核查|核对/.test(text)
    ? stageChoices('待研判').flatMap(group => group.options).find(item => item.id === 'nearby') : undefined;
  const choice = selected?.kind === 'question' && selected.label === text ? selected :
    (['待研判', '力量投送中', '救援中', '待复盘'] as const).flatMap(stage => stageChoices(stage).flatMap(group => group.options)).find(item => item.kind === 'question' && item.label === text) ?? inferred;
  if (!choice || !['resourceReport', 'situationReport', 'group', 'delivery', 'document', 'plan', 'revise'].includes(choice.capability ?? '')) return false;
  const store = useSessionStore.getState();
  const session = store.sessions[sessionId];
  if (!session) return false;
  const profile = disasterProfileById.get(session.eventId);
  const resource = choice.capability === 'resourceReport';
  const situation = choice.capability === 'situationReport';
  const grouping = choice.capability === 'group';
  const delivery = choice.capability === 'delivery';
  const title = resource ? '周边资源分析报告' : situation ? '灾情研判报告' : grouping ? '力量编组建议' : delivery ? '投送分析报告' : choice.capability === 'document' ? '阶段要情' : '处置分析报告';
  let conclusion: string;
  let rows: { label: string; value: string }[];
  if (resource) {
    conclusion = /缺口|多少能用/.test(text) ? '已按任务需求梳理队伍、装备与保障资源，建议优先补强专业作业和现场接应力量（模拟）。' : /防护|医疗/.test(text) ? '建议先确认受威胁人员和重点设施，再核查医疗接应、安置和现场保障条件。' : '建议优先核查专业救援队伍、工程装备、医疗接应和现场保障，重点确认能否及时到场。';
    rows = [
      { label: '队伍与装备', value: profile?.resources.length ? `${profile.resources.map(item => `${item.name}（${item.amount}）`).join('、')}，需核实可用状态和任务占用。` : '核实专业队伍、装备数量、任务占用及可出动状态。' },
      { label: '医疗与保障', value: '确认接诊医院、救护车辆、安置点，以及通信、供电和物资保障。' },
      { label: '到场条件', value: '核实驻地、通行条件、集结时间和联络人；候选资源不等于已调派。' },
    ];
  } else if (situation) {
    conclusion = /确定.*灾情/.test(text) ? '已结合监测告警和事件场景识别重点风险，建议先遣组优先核查受威胁人员与影响范围（模拟）。' : profile ? `当前需重点关注${profile.risks}。现有资料可用于初步研判，现场变化仍需最新资料确认。` : '应先核实灾害位置、影响范围和受威胁对象，再结合最新监测判断风险。';
    rows = [{ label: '核查重点', value: profile?.gaps ?? '补充位置、影响范围、人员情况和现场风险。' }, { label: '补充依据', value: '采集带时间、地点的现场影像、侦测数据与核查反馈。' }];
  } else {
    conclusion = grouping ? '建议按侦测、安全、专业救援和保障岗位组织力量，先核实人员装备可用情况，再确定编组。' : delivery ? '已按道路条件、车辆适配和保障需求安排先遣核路、分批投送与集结接应（模拟）。' : choice.capability === 'document' ? '阶段要情应说明已开展的工作、当前进展和待核事项；未验收的处置量应标明为过程记录。' : '建议先核实现场变化及其影响，再由技术、安全和保障岗位确认调整措施。';
    rows = [{ label: '当前重点', value: profile?.risks ?? '确认现场风险及受影响任务。' }, { label: '建议下一步', value: grouping ? '逐项核对岗位、人数、装备状态与负责人。' : delivery ? '核对通行反馈、车辆、通信、批次及接应联系人。' : '补充最新作业记录、监测反馈和责任岗位意见。' }];
  }
  store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', text, taskId: null });
  store.appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'text', taskId: null,
    text: `需要我帮您下一步生成${title}吗？`, reviewSummary: { conclusion, rows },
    summaryOffer: { kind: 'analysis', request: choice.prompt, title } });
  return true;
}
