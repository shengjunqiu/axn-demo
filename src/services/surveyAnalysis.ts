/** 现场勘察分析演示：仅整理本事件资料和本地专业参考，不冒充真实CV或模型服务。 */
import type { ConstructionResult } from '@/seed/constructionScenarios';
import { disasterProfileById } from '@/seed/disasterScenarios';
import { incidentById } from '@/seed/scenario';
import { factDisplay } from './factLookup';
import { buildMultiSourceSnapshot } from './multiSourceAggregation';

export function buildSurveyAnalysis(eventId: string): ConstructionResult {
  const incident = incidentById.get(eventId);
  if (!incident) throw Error('请先关联有效灾情');
  const scope = { kind: 'event' as const, eventId };
  const name = factDisplay(incident.factRefs.title, scope);
  const profile = disasterProfileById.get(eventId);
  const snapshot = buildMultiSourceSnapshot(eventId);
  const records = snapshot.event.sources.flatMap(source => source.records.filter(record => !record.duplicateOf).map(record => ({ ...record, category: source.kind })));
  const guidance = profile?.planSections.filter(([title]) => /侦测|战法|安全|监测|撤离|风险/.test(title)) ?? [];
  const risks = profile?.risks ?? '现场灾害风险、作业面稳定性、供电通信及撤离条件待专业岗位核实';
  const basis = profile?.planTitle ?? '尚无匹配的专业预案，需补充适用版本和批准依据';
  const summary = `针对${name}，已模拟整理${records.length}条现场与多源资料，结合${guidance.length}项本地专业参考形成勘察分析。主要关注：${risks}。资料为演示记录，现场安全条件及预案适用性需专业复核。`;
  const clean = (value: string) => value.replaceAll('|', '／').replaceAll('\n', '；');
  return {
    capability: 'survey', agentId: 'agent-situation', title: `${name} · 现场智能勘察分析报告`, summary,
    dataTime: snapshot.gatheredAt,
    sections: [
      { title: '勘察对象与资料范围', text: `${name}\n地点：${factDisplay(incident.factRefs.location, scope)}\n灾种：${factDisplay(incident.factRefs.disasterType, scope)}\n资料时点：${snapshot.gatheredAt}。仅使用当前事件资料，不混入其他事件数据。` },
      { title: '现场资料综合分析', text: `本地AI分析演示：依据接报描述、现场影像目录及监测样例整理风险线索。\n主要风险：${risks}。\n资料不足：${profile?.gaps ?? '现场影像原件、侦测读数、作业条件与有效预案版本待补充'}。\n影像目录只作为资料线索，不声称已识别图像、裂缝或灾害边界。` },
      { title: '预案与专业指导依据', text: `参考预案：${basis}（本地参考，非正式生效版本）。\n${guidance.length ? guidance.map(([title, body]) => `${title}：${body}`).join('\n') : '无匹配条款，不生成虚构专业战法或引用；请补充预案与专业指导材料。'}\n需技术岗位核对条款适用条件和实际批准版本。` },
      { title: '勘察建议与补证事项', text: `1. 核对现场原始影像的位置、拍摄时间和来源，补充灾前对照及先遣记录。\n2. 核对${risks}相关的侦测读数及设备状态，监测缺项不按正常处理。\n3. 核实进入条件、作业许可、警戒范围、撤离路线和通信保障。\n4. 由技术、安全及现场负责人复核本报告；复核前不据此认定可安全作业。` },
    ],
    tables: [
      { title: '现场资料与来源核对表', headers: ['资料类别', '资料内容', '来源', '资料时间', '核实状态'], rows: records.length ? records.map(record => [record.category, clean(record.content), clean(record.source), record.capturedAt, record.verification]) : [['现场资料', '暂无有效记录', '待补', '待补', '待核实']] },
      { title: '监测数据与勘察关注表', headers: ['监测指标', '最新样例值', '样例时间', '勘察关注'], rows: profile?.monitoring.length ? profile.monitoring.map(record => [record.label, `${record.values.at(-1) ?? '资料不足'}${record.unit}`, record.times.at(-1) ?? '待核', '本地模拟监测，须核对真实检测记录；不据此判断安全阈值']) : [['侦测指标', '资料不足', '待核', '补充本事件专业监测资料']] },
      { title: '风险与专业指导对照表', headers: ['分析对象', '现有依据', '指导建议', '复核岗位'], rows: [
        ['现场风险', clean(risks), '补齐监测与原始影像，核实风险范围', '技术／安全岗位'],
        ['作业与撤离', clean(basis), '核实许可、警戒、通信与撤离条件', '现场负责人／安全岗位'],
        ['资料缺口', clean(profile?.gaps ?? '适用预案与现场资料待补'), '补充来源、时间及有效版本', '先遣组／技术岗位'],
      ] },
    ],
    notice: 'AI分析为本地规则与模板模拟，未连接真实视觉模型、LLM或正式预案库；报告为草稿，须专业复核，不代替现场安全判定与指挥审批。',
  };
}
