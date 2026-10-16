import { openInlineSituation } from '@/services/inlineSituation';
import { ResultSection as Card } from '@/components/common/AgentResultPrimitives';
import { Sender } from '@ant-design/x';
import { useDocumentNavigation } from '@/components/workspace/useDocumentNavigation';
import { minutesSections, dailySummarySections, tacticOptions } from '@/services/customerDocuments';
import { useEffect, useRef, useState } from 'react';
import { generateRescuePlanAlternatives } from '@/services/rescuePlanAlternatives';
import { Button,  Input, Modal, Space, Typography, App } from 'antd';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useSessionStore } from '@/store/sessionStore';
import { documentGeneratedReply, glanceFromSections } from '@/services/documentGeneratedReply';
import { disasterProfileById } from '@/seed/disasterScenarios';
import { vueDemoResourcesForEvent } from '@/seed/vueDemoResources';
import { vueWorkspaceEventById } from '@/seed/vueWorkspaceEvents';
import { eventDisplayName } from '@/services/factLookup';
import { resolveDocumentSections } from '@/seed/resolveDocumentSections';

export const CUSTOMER_ACTIONS = [
  '预警推送',
  '资源预警通知',
  // 「资源数据与预警」暂时下线（SHOW_RESOURCE_DATA_ALERT）；恢复时取消下一行注释并同步 prototypeVisibility。
  // '资源数据与预警',
  '救援复盘与知识',
  '生成值班日报',
  '生成会议纪要',
  '生成日常工作总结',
  '生成救援方案',
] as const;
export type CustomerAction = typeof CUSTOMER_ACTIONS[number];

/** 方案约束条件默认草稿（模拟）；打开面板即展示多套备选方案，无需再点生成。 */
export function defaultPlanConstraintDraft(eventId: string): string {
  const profile = disasterProfileById.get(eventId);
  if (profile) {
    const force = profile.resources.slice(0, 3).map((r) => `${r.name}/${r.amount}/${r.status}`).join('；');
    return [
      `处置重点：围绕「${profile.objective}」推进（进度 ${profile.completed}/${profile.target}${profile.unit}，模拟）；优先化解 ${profile.risks}。`,
      `可用力量（候选示意，≠已调派）：${force || '待补核'}。`,
      `道路与安全约束：作业区「${profile.location}」；${profile.gaps}；撤离与通信双通道待岗位复核。`,
      `预案参考：${profile.planTitle}。`,
    ].join('\n');
  }
  const vue = vueWorkspaceEventById.get(eventId);
  const demos = vueDemoResourcesForEvent(eventId).slice(0, 3);
  const force = demos.length
    ? demos.map((r) => `${r.name}/${r.amountLabel}/${r.status}`).join('；')
    : '以本事件已登记候选力量为准，未确认项不写入正式编成';
  return [
    `处置重点：围绕「${vue?.name ?? eventDisplayName(eventId)}」核实现场条件与优先任务（${vue?.category ?? '处置'}·模拟）；关注 ${vue?.risks ?? '作业与次生风险'}。`,
    `可用力量（候选示意，≠已调派）：${force}。`,
    `道路与安全约束：作业区「${vue?.location ?? '待核'}」；${vue?.description ?? '通行、撤离与通信保障待岗位复核'}；缺证不推断。`,
  ].join('\n');
}

function CustomerMaterialPanel({ action, sessionId, eventId, onClose }: {
  action: CustomerAction; sessionId: string; eventId: string; onClose: () => void;
}) {
  const { message } = App.useApp();
  const isPlan = action === '生成救援方案';
  const [subject, setSubject] = useState('');
  const [period, setPeriod] = useState('');
  const [records, setRecords] = useState(() => (isPlan ? defaultPlanConstraintDraft(eventId) : ''));
  const [decisions, setDecisions] = useState('');
  const [variant, setVariant] = useState(() => tacticOptions(eventId)[0]?.name ?? '稳妥处置');
  const [preview, setPreview] = useState(false);
  const [saving, setSaving] = useState(false);
  const [customTactic, setCustomTactic] = useState({ name: '', tactic: '', applicability: '', resources: '', risk: '', basis: '', organization: '', tradeoff: '人工补充专业战法，须经专家审定' });
  const [customPlans, setCustomPlans] = useState<typeof customTactic[]>([]);
  const isMinutes = action === '生成会议纪要';
  const isDaily = action === '生成值班日报';
  const profile = disasterProfileById.get(eventId);
  const plans = [
    { name: '稳妥处置', tactic: '分区核查后逐区推进', organization: '先遣侦测、主力处置、保障支援分批投入，风险核查后扩大作业面。', tradeoff: '强调安全核查与顺序推进；完成时间待现场测算。' },
    { name: '并行处置', tactic: '条件具备的作业点并行推进', organization: '按作业区分配独立任务组，共享保障力量；需核实人员、装备和通信是否足以支持并行作业。', tradeoff: '增加协同与资源需求；不保证耗时最短。' },
    { name: '分阶段增援', tactic: '先期处置后按缺口增援', organization: '先用已核实的可用力量处理优先任务，依据监测变化与缺口分阶段申请增援。', tradeoff: '减少未确认资源依赖；需持续核实增援到位时间。' },
  ];
  const professional = [...tacticOptions(eventId), ...customPlans];
  const availablePlans = professional.length ? professional : plans.map(p => ({ ...p, applicability: '缺少专业预案，须补充专家审定条件', resources: '待核', risk: '待专业勘察', basis: '组织方式参考，非专业战法' }));
  const selectedPlan = availablePlans.find(p => p.name === variant) ?? availablePlans[0];

  const sections = (): [string, string][] => {
    if (isPlan) return [
      ...resolveDocumentSections(eventId, 'RESCUE_PLAN').map(([h, b]): [string, string] => [h, b.replaceAll('待原系统锁定', '待负责人确认').replaceAll('审签沿用原处置方案模块', '本稿导出后由用户按现行业务办理')]),
      ['六、所选备选战法与组织方式', `方案：${variant}（${professional.length ? '专业任务备选，待专家审定' : '组织方式参考，缺专业预案'}）\n战法：${selectedPlan.tactic}\n${selectedPlan.organization}\n${selectedPlan.tradeoff}\n适用条件：${selectedPlan.applicability}\n必要资源：${selectedPlan.resources}\n风险与限制：${selectedPlan.risk}\n预案依据：${selectedPlan.basis}\n处置重点与约束：${records || '待补充'}\n${profile ? `预案参考：${profile.planTitle}；资源：${profile.resources.map(r => `${r.name} ${r.amount} ${r.status}`).join('；')}` : `当前事件资料：${eventDisplayName(eventId)}；预案与可用资源需补充核对。`}\n成本与到位时间：尚未测算。`],
    ];
    if (isMinutes) return minutesSections(subject, period, records, decisions);
    if (isDaily) return [
      ['一、值班基本情况', `值班日期：${period}\n值班岗位及人员：${subject}`],
      ['二、值班记录', records],
      ['三、交接及待办事项', decisions || '待补充交接事项'],
      ['四、资料依据', '按本次输入的值班资料整理，未自动调用正式值班台账。'],
    ];
    return dailySummarySections(subject, period, records, decisions);
  };

  const save = () => {
    if (saving) return;
    if (!isPlan && (!subject.trim() || !period.trim() || !records.trim())) return;
    setSaving(true);
    const code = isPlan ? 'RESCUE_PLAN' : isMinutes ? 'MEETING_MINUTES' : isDaily ? 'DUTY_DAILY' : 'DAILY_WORK_SUMMARY';
    const reportSections = sections();
    const title = isPlan ? `${eventDisplayName(eventId)} · ${variant}行动方案` : `${subject} · ${isMinutes ? '会议纪要' : isDaily ? '值班日报' : '日常工作总结'}`;
    const document = useMockDocumentStore.getState().publishAgentMaterial(sessionId, { code, title, sections: reportSections });
    if (!document) { setSaving(false); message.error('文书生成失败，请重试'); return; }
    const store = useSessionStore.getState();
    store.appendMessage(sessionId, { sessionId, role: 'user', kind: 'text', taskId: null, text: action });
    store.appendMessage(sessionId, { sessionId, role: 'assistant', kind: 'agent', taskId: null,
      text: '依据本次输入整理文书', agentName: isPlan ? '救援方案生成智能体' : '文书生成智能体', agentRole: action,
      documentWorkflow: { stage: 'completed', documentCode: code, documentTitle: title, elements: [{ label: '资料来源', value: isPlan ? '当前事件预案样例与本次约束条件' : '本次输入资料' }], reportSections, documentId: document.id } });
    store.appendMessage(sessionId, {
      sessionId, role: 'assistant', kind: 'text', taskId: null,
      text: documentGeneratedReply(document.title, glanceFromSections(reportSections)),
    });
    onClose();
  };

  return <Modal open title={action} onCancel={onClose} width={900} footer={null} destroyOnHidden>
    <Space orientation="vertical" style={{ width: '100%' }} size="middle">
      {isPlan ? <>
        <Input.TextArea aria-label="方案约束条件" value={records} onChange={e => setRecords(e.target.value)} placeholder="补充处置重点、可用力量、道路或安全约束" rows={3} />
        {availablePlans.map(p => (
          <Card
            key={p.name}
            size="small"
            title={p.name}
            extra={
              <Button type={variant === p.name ? 'primary' : 'default'} onClick={() => setVariant(p.name)}>
                {variant === p.name ? '已选择' : '选择方案'}
              </Button>
            }
          >
            <Typography.Paragraph>{p.tactic}：{p.organization}</Typography.Paragraph>
            <Typography.Text type="secondary">{p.tradeoff}</Typography.Text>
            {'basis' in p && <Typography.Paragraph>适用条件：{String(p.applicability)}<br />资源：{String(p.resources)}<br />风险：{String(p.risk)}<br />依据：{String(p.basis)}</Typography.Paragraph>}
          </Card>
        ))}
        <Typography.Text type="secondary">
          预案依据：{profile?.planTitle ?? `${eventDisplayName(eventId)}资料（预案待补充核对）`}；专业战法与安全条款在生成的完整方案中保留。
        </Typography.Text>
        <Card size="small" title="补充适用的专业备选战法">
          <Space orientation="vertical" style={{ width: '100%' }}>
            {([['name', '战法名称'], ['tactic', '专业处置方法与步骤'], ['applicability', '适用条件'], ['resources', '必要资源'], ['risk', '风险与限制'], ['basis', '依据预案名称、版本、条款']] as const).map(([key, label]) => <Input key={key} aria-label={label} placeholder={label} value={customTactic[key]} onChange={e => setCustomTactic(p => ({ ...p, [key]: e.target.value, ...(key === 'tactic' ? { organization: e.target.value } : {}) }))} />)}
            <Button disabled={!customTactic.name.trim() || !customTactic.tactic.trim() || !customTactic.basis.trim() || !customTactic.applicability.trim() || !customTactic.resources.trim() || !customTactic.risk.trim()} onClick={() => { if (professional.some(p => p.name === customTactic.name)) { message.error('战法名称已存在'); return; } setCustomPlans(p => [...p, customTactic]); setVariant(customTactic.name); }}>加入备选方案并选择</Button>
          </Space>
        </Card>
        <Button type="primary" loading={saving} onClick={save}>生成所选方案并在线修改</Button>
      </> : <>
        <Input aria-label="文书主题" value={subject} onChange={e => setSubject(e.target.value)} placeholder={isDaily ? '值班岗位及人员' : '会议／工作主题'} />
        <Input aria-label="文书时段" value={period} onChange={e => setPeriod(e.target.value)} placeholder={isMinutes ? '会议时间、地点、参会人员' : '日期／总结起止时段'} />
        {isMinutes ? <><Typography.Text type="secondary">可粘贴转写文本，或点击麦克风使用浏览器语音识别；识别可用性取决于浏览器与语音服务。</Typography.Text><Sender value={records} onChange={setRecords} allowSpeech autoSize={{ minRows: 5, maxRows: 12 }} placeholder="会议原始转写记录" onSubmit={() => setPreview(true)} /></> : <Input.TextArea aria-label="文书原始资料" value={records} onChange={e => setRecords(e.target.value)} rows={7} placeholder="逐行填写：时间—工作事项—结果及资料依据" />}
        <label>导入转写／工作记录文本 <input aria-label="导入原始记录文件" type="file" accept=".txt,.md" onChange={e => { const file = e.target.files?.[0]; if (file) { if (file.size > 2_000_000) { message.error('请导入2MB以内的文本'); return; } void file.text().then(text => { setRecords(text); setPreview(false); }).catch(() => message.error('读取文本失败')); } }} /></label>
        <Input.TextArea aria-label="确认事项" value={decisions} onChange={e => setDecisions(e.target.value)} rows={3} placeholder={isMinutes ? '确认的议定事项、责任人、时限（可留待核）' : isDaily ? '交接及待办事项' : '亮点及对应时间轴记录'} />
        <Button disabled={!records.trim()} onClick={() => setPreview(true)}>自动提炼并预览</Button>
        {preview && sections().map(([heading, body]) => <Card key={heading} size="small" title={heading}><Typography.Paragraph style={{ whiteSpace: 'pre-wrap' }}>{body}</Typography.Paragraph></Card>)}
        <Button type="primary" disabled={!subject.trim() || !period.trim() || !records.trim()} loading={saving} onClick={save}>生成初稿并在线修改</Button>
      </>}
    </Space>
  </Modal>;
}

export default function CustomerRequestPanel(props: { action: CustomerAction; sessionId: string; eventId: string; onClose: () => void }) {
  const generated = useRef(false);
  const openWorkspace = useDocumentNavigation();
  // 预警推送 / 资源预警通知走流程工作区 WarningPushPanel；复盘仍走 operations。
  const openAsFlow = props.action === '预警推送' || props.action === '资源预警通知';
  const openAsOperations = props.action === '救援复盘与知识';
  useEffect(() => {
    if (generated.current) return;
    if (openAsFlow) {
      generated.current = true;
      if (props.action === '预警推送') openInlineSituation(props.sessionId, '预警推送');
      else openWorkspace(props.sessionId, { kind: 'flow', id: props.action });
      props.onClose();
      return;
    }
    if (openAsOperations) {
      generated.current = true;
      openWorkspace(props.sessionId, { kind: 'operations', id: props.action });
      props.onClose();
      return;
    }
    if (props.action !== '生成救援方案') return;
    generated.current = true;
    generateRescuePlanAlternatives(props.sessionId, props.eventId);
    props.onClose();
  }, [props, openAsFlow, openAsOperations, openWorkspace]);
  if (openAsFlow || openAsOperations || props.action === '生成救援方案') return null;
  return <CustomerMaterialPanel {...props} />;
}
