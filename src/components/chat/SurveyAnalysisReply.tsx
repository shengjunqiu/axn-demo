import { useState } from 'react';
import { Button } from 'antd';
import { KvTable, Section, SourceList, Notice } from '@/components/common/ChatPrimitives';
import type { ScenarioSectionsArtifact } from '@/domain/types';
import { useSessionStore } from '@/store/sessionStore';
import { buildMultiSourceSnapshot } from '@/services/multiSourceAggregation';
import { multiSourceBrief } from '@/services/multiSourceBrief';
import { disasterProfileById } from '@/seed/disasterScenarios';
import './survey-analysis.css';

export default function SurveyAnalysisReply({ payload, sessionId }: { payload: ScenarioSectionsArtifact; sessionId: string }) {
  const eventId = useSessionStore(s => s.sessions[sessionId]?.eventId ?? '');
  const [showSources, setShowSources] = useState(false);
  const snapshot = buildMultiSourceSnapshot(eventId);
  const profile = disasterProfileById.get(eventId);
  const image = snapshot.event.sources.find(source => source.kind === '现场影像')!;
  const receipt = snapshot.event.sources.find(source => source.kind === '接报记录')!;
  const category = profile?.category ?? '灾害类型尚需现场确认';
  const debris = /泥石流/.test(category);
  const landslide = /滑坡/.test(category);
  const imageConclusion = multiSourceBrief(image, eventId);
  const monitoring = payload.tables?.find(table => table.title === '监测数据与勘察关注表');
  const hasMonitoring = !!monitoring?.rows.some(row => row[1] && !/资料不足|待补/.test(row[1]));
  const indicator = profile?.monitoring.find(item => /位移|裂缝|水位/.test(item.label)) ?? profile?.monitoring[0];
  const delta = indicator && indicator.values.length >= 2 ? indicator.values.at(-1)! - indicator.values.at(-2)! : null;
  const monitoringConclusion = indicator && delta !== null
    ? `${indicator.label}${delta > 0 ? '有所上升' : delta < 0 ? '有所回落' : '暂时持平'}，仍需持续监测。`
    : '已有模拟读数，暂不足以判断现场风险变化。';
  const items = [
    { name: '灾害类型', result: profile ? `现场呈现${category}特征，需现场复核。` : '现有资料不足以明确灾害类型。', action: '请先遣人员确认灾种及受影响范围。' },
    { name: '主要隐患', result: imageConclusion, action: debris ? '核查沟道堵塞、上游来水及受困车辆。' : landslide ? '核查滑坡边界、受威胁房屋及道路。' : '核查受淹范围、险情位置及周边人员。' },
    { name: '侦测装备', result: hasMonitoring ? monitoringConclusion : '缺少有效侦测读数，暂不能判断风险变化。', action: '核对设备状态，补采并对比最新侦测数据。' },
    { name: '作业条件', result: '现有资料尚不能确认进场和作业安全。', action: '核实警戒范围、进场通道与撤离路线。' },
    { name: '资料时效', result: '资料为历史快照，是否反映现场现状待确认。', action: '确认影像与读数时间，现场变化后重新采集。' },
  ];
  const sourceTable = payload.tables?.find(table => table.title === '现场资料与来源核对表');
  const imageRows = sourceTable?.rows.filter(row => row[0] === '现场影像') ?? [];
  const sources = [
    { title: '现场影像与接报资料', section: `${imageRows.length} 份影像资料 · 采集时间见原始记录`, excerpt: imageRows.length ? imageRows.map(row => `${row[2]}；${row[3]}；${row[4]}`).join('\n') : '缺少现场影像原件，需补充采集时间、位置与来源。' },
    { title: '侦测装备与监测记录', section: `资料快照：${payload.dataTime}`, excerpt: monitoring?.rows.map(row => `${row[0]}：${row[1]}；记录时间：${row[2]}`).join('\n') || '暂无有效装备读数，不能据此认定现场安全。' },
    { title: profile?.planTitle ?? '专业预案与指导材料', section: '本地参考 · 适用版本待复核', excerpt: '用于辅助核对风险、监测与撤离条件，须由技术岗位确认现场适用性。' },
  ];
  return <div className="axn-survey-reply" data-testid="survey-analysis-reply">
    <Section title="勘察总结">
      <p className="axn-agent-result-lead">{imageConclusion}{multiSourceBrief(receipt, eventId)}</p>
      <Notice tone="info" title="AI模拟分析">依据本地事件场景及监测样例生成，未进行真实视觉识别；现场情况需专业复核。</Notice>
    </Section>
    <Section title="现场核查清单">
      <KvTable rows={[
        { label: '核查项', value: <span className="axn-survey-check-value axn-survey-check-head"><strong>模拟分析结果</strong><strong>AI建议操作</strong></span> },
        ...items.map(item => ({ label: item.name, value: <span className="axn-survey-check-value"><span><small>模拟分析结果</small>{item.result}</span><span><small>AI建议操作</small>{item.action}</span></span> })),
      ]} />
    </Section>
    <Section title="来源依据">
      <KvTable rows={[
        { label: '现场资料', value: `${imageRows.length} 份影像资料，原文件及拍摄信息待核` },
        { label: '监测依据', value: hasMonitoring ? `${monitoring?.rows.length} 项模拟监测指标，设备与读数需现场核对` : '缺少有效侦测数据，需补充' },
        { label: '资料时间', value: payload.dataTime.replace('T', ' ').replace(/\+08:00$/, '') },
      ]} actions={<Button size="small" onClick={() => setShowSources(value => !value)} aria-expanded={showSources}>{showSources ? '收起来源详情' : '查看来源详情'}</Button>} />
      {showSources && <><SourceList sources={sources} /><details className="axn-result-details"><summary>查看原始资料与核实状态</summary><SourceList sources={(sourceTable?.rows ?? []).map((row, index) => ({ title: row[2], section: `${row[0]} · ${row[3]} · ${row[4]} · ${index + 1}`, excerpt: row[1] }))} /></details></>}
    </Section>
  </div>;
}
