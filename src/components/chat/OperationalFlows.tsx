import { disasterProfileById } from '@/seed/disasterScenarios';
import { tenderName } from '@/seed/tenderNames';
import OriginalSystemLink from './OriginalSystemLink';
import { useMemo, useState } from 'react';
import {
  Alert, Button, Card, Checkbox, Drawer, Input, InputNumber, Segmented, Select, Space, Steps, Table, Tabs, Tag, Upload, Typography,
} from 'antd';
import { exportMaterial, exportResourceExcel } from '@/services/prototypeExports';
import { WORK_SUMMARY_REFLECT_TITLES, WORK_SUMMARY_TEMPLATE_TITLES } from '@/seed/documentTemplates';
import { buildConstructionResult } from '@/seed/constructionScenarios';
import SituationForecast from '@/components/events/SituationForecast';
import ResourceComposition from '@/components/events/ResourceComposition';
import AssistantInteraction from './AssistantInteraction';
import RescueEvaluation from '@/components/events/RescueEvaluation';
import WithdrawalReturn from '@/components/events/WithdrawalReturn';
import RouteComparison from '@/components/events/RouteComparison';
import DeliveryRouteMap from '@/components/events/DeliveryRouteMap';
import {
  checkPlanRules,
  hasRuleConflict,
  ruleDimensionLabel,
  ruleStatusLabel,
  type RuleHit,
} from '@/services/planRuleCheck';
import { resolveSeedEventStage, type EventStage, type ScenarioId } from '@/services/agentFlow';
import {
  FLOW_SCENARIO_RAIL,
  buildFlowSeedSnapshot,
  defaultFlowForScenario,
  flowTabMode,
  flowTaskMeta,
  flowsForScenario,
  scenarioIntro,
  scenarioRailForFlow,
  type FlowReceipt,
  type FlowRecordRow,
  type FlowTabMode,
  type FlowTask,
} from '@/services/flowStageConfig';

export { FLOW_TASKS, type FlowTask } from '@/services/flowStageConfig';

function HistoryBanner({ mode }: { mode: FlowTabMode }) {
  if (mode === 'past') {
    return (
      <Alert
        showIcon
        type="success"
        title="历史过程 · 只读回放"
        description="该环节早于当前事件阶段，已按种子资料回放结果；演示不要求再逐步点选。"
      />
    );
  }
  if (mode === 'future') {
    return (
      <Alert
        showIcon
        type="info"
        title="尚未进入该阶段"
        description="当前事件尚未推进到本环节。完成前置阶段后可在此继续操作。"
      />
    );
  }
  return null;
}

export default function OperationalFlows({
  eventId,
  eventName,
  initial,
  onClose,
  onTask,
  eventStage: eventStageProp,
}: {
  eventId: string;
  eventName: string;
  initial: FlowTask;
  onClose: () => void;
  onTask?: (prompt: string) => void;
  eventStage?: EventStage | null;
}) {
  const profile = disasterProfileById.get(eventId);
  const eventStage = eventStageProp ?? resolveSeedEventStage(eventId);
  const seed = buildFlowSeedSnapshot(eventId, profile, eventName);
  const equipmentLabel = profile?.resources[1]?.name.replace('（模拟）', '') ?? '排涝车';

  const [scenarioRail, setScenarioRail] = useState<ScenarioId>(() => scenarioRailForFlow(initial, eventStage));
  const [tab, setTab] = useState<string>(initial);
  const visibleFlows = useMemo(() => flowsForScenario(scenarioRail), [scenarioRail]);
  const intro = useMemo(() => scenarioIntro(scenarioRail), [scenarioRail]);

  const selectScenario = (next: ScenarioId) => {
    setScenarioRail(next);
    const nextFlows = flowsForScenario(next);
    if (!nextFlows.includes(tab as FlowTask)) {
      setTab(defaultFlowForScenario(eventStage, next));
    }
  };
  const [records, setRecords] = useState<FlowRecordRow[]>(() =>
    flowTabMode(eventStage, '现场智能勘察') === 'past' || flowTabMode(eventStage, '资料核验与总结') === 'past'
      ? seed.records
      : [],
  );
  const [source, setSource] = useState('先遣组');
  const [time, setTime] = useState('');
  const [analysis, setAnalysis] = useState(
    () => flowTabMode(eventStage, '现场智能勘察') === 'past' && seed.analysis,
  );
  const [reviewed, setReviewed] = useState(
    () => flowTabMode(eventStage, '现场智能勘察') === 'past' && seed.reviewed,
  );
  const [feedback, setFeedback] = useState(
    () => (flowTabMode(eventStage, '现场智能勘察') === 'past' ? seed.feedback : ''),
  );
  const [route, setRoute] = useState(seed.route);
  const [road, setRoad] = useState(seed.road);
  const [dispatch, setDispatch] = useState(
    () => flowTabMode(eventStage, '规划梯队投送') === 'past' && seed.dispatch,
  );
  const [progress, setProgress] = useState(
    () => (flowTabMode(eventStage, '规划梯队投送') === 'past' ? seed.progress : 0),
  );
  const [owner, setOwner] = useState(
    () => (
      flowTabMode(eventStage, '规划梯队投送') === 'past'
      || flowTabMode(eventStage, '编组确认') === 'past'
        ? seed.owner
        : ''
    ),
  );
  const [targets, setTargets] = useState<string[]>(
    () => (flowTabMode(eventStage, '预警推送') === 'past' ? seed.targets : []),
  );
  const [warning, setWarning] = useState(
    () => (flowTabMode(eventStage, '预警推送') === 'past' ? seed.warning : ''),
  );
  const [approved, setApproved] = useState(
    () => flowTabMode(eventStage, '预警推送') === 'past' && seed.approved,
  );
  const [fail, setFail] = useState(false);
  const [receipts, setReceipts] = useState<FlowReceipt[]>(
    () => (flowTabMode(eventStage, '预警推送') === 'past' ? seed.receipts : []),
  );
  const [caseText, setCaseText] = useState(
    () => (flowTabMode(eventStage, '知识沉淀入库') === 'past' ? seed.caseText : ''),
  );
  const [classified, setClassified] = useState(true);
  const [caseStatus, setCaseStatus] = useState(
    () => (flowTabMode(eventStage, '知识沉淀入库') === 'past' ? seed.caseStatus : '草稿'),
  );
  const [reason, setReason] = useState(
    () => (flowTabMode(eventStage, '知识沉淀入库') === 'past' ? seed.reason : ''),
  );
  const [cars, setCars] = useState(seed.cars);
  const [people, setPeople] = useState(seed.people);
  const [groupConfirmed, setGroupConfirmed] = useState(
    () => flowTabMode(eventStage, '编组确认') === 'past' && seed.groupConfirmed,
  );
  const [revision, setRevision] = useState('');
  const [versions, setVersions] = useState<string[]>([]);
  const [revisionBasis, setRevisionBasis] = useState('');
  const [safetyBlocked, setSafetyBlocked] = useState(false);
  const [ruleHits, setRuleHits] = useState<RuleHit[]>([]);
  const [ruleChecked, setRuleChecked] = useState(false);
  const [summaryType, setSummaryType] = useState(seed.summaryType);
  const [summary, setSummary] = useState(
    () => (flowTabMode(eventStage, '资料核验与总结') === 'past' ? seed.summary : ''),
  );
  const [resourceName, setResourceName] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState('待核实');
  const [resources, setResources] = useState<string[][]>(
    () => (flowTabMode(eventStage, '资源维护与导出') === 'past' ? seed.resources : []),
  );
  const [published, setPublished] = useState(
    () => flowTabMode(eventStage, '知识沉淀入库') === 'past' && seed.published,
  );

  const saveResult = (title: string, body: string) => {
    void exportMaterial(
      `${eventName}·${title}（模拟）`,
      [
        ['事件', `${eventName} / ${eventId}`],
        ['结果', body],
        ['边界', '本地演示，未接真实模型或外部系统'],
      ],
      'Word',
    );
  };
  const sample = () => {
    setRecords(seed.records.map((r) => ({ ...r, id: crypto.randomUUID(), verified: false })));
    setAnalysis(false);
    setReviewed(false);
  };
  const resetWarning = () => {
    setApproved(false);
    setReceipts([]);
  };
  const basePlan = buildConstructionResult('plan', eventId).sections.map((s) => `${s.title}：${s.text}`).join('\n');

  const modeOf = (name: FlowTask) => flowTabMode(eventStage, name);

  return (
    <Drawer title={`${eventName} · 业务流程补充`} size={900} open onClose={onClose} destroyOnHidden>
      <Alert
        type="info"
        showIcon
        title={`当前事件阶段：${eventStage} · 本地模拟`}
        description="早于当前阶段的过程已按事件状态回放展示；当前阶段仍可交互确认。样例识别、路线、推送和入库只在本面板演示，不发送实际消息或修改原系统。关闭面板后本次操作状态不保留。"
        style={{ marginBottom: 12 }}
      />
      <div data-testid="flow-scenario-rail" style={{ marginBottom: 12 }}>
        <Typography.Text type="secondary" style={{ display: 'block', marginBottom: 8 }}>
          按建设场景查看流程能力（主责智能体）
        </Typography.Text>
        <Segmented
          aria-label="建设场景"
          block
          value={scenarioRail}
          onChange={(v) => selectScenario(v as ScenarioId)}
          options={FLOW_SCENARIO_RAIL.map((s) => ({ label: s.label, value: s.id }))}
        />
      </div>
      <Card size="small" style={{ marginBottom: 12 }} data-testid="flow-scenario-intro">
        <Typography.Text strong>{intro.label}</Typography.Text>
        <Typography.Paragraph type="secondary" style={{ marginBottom: 4, marginTop: 4 }}>
          主责：{intro.agentLabel} · 阶段：{intro.stages.join(' / ')}
        </Typography.Paragraph>
        <Typography.Text type="secondary">{intro.handoffSummary}</Typography.Text>
      </Card>
      <Tabs
        activeKey={tab}
        onChange={setTab}
        destroyOnHidden
        items={visibleFlows.map((name) => {
          const mode = modeOf(name);
          const meta = flowTaskMeta(name);
          return {
            key: name,
            label: (
              <span>
                {tenderName(name)}
                <Typography.Text type="secondary" style={{ marginInlineStart: 6, fontSize: 12 }}>
                  {meta.agentLabel.replace(/智能体$/, '')}
                </Typography.Text>
                {mode === 'past' ? <Tag color="success" style={{ marginInlineStart: 6 }}>已回放</Tag> : null}
                {mode === 'future' ? <Tag style={{ marginInlineStart: 6 }}>未到达</Tag> : null}
              </span>
            ),
            children: (
              <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
                <HistoryBanner mode={mode} />
                {mode === 'future' ? null : (
                  <>
                    {name === '应急助手场景' && <AssistantInteraction onTask={onTask} />}
                    {name === '态势研判预警' && (
                      profile
                        ? (
                          <SituationForecast
                            profile={profile}
                            mode={mode === 'past' ? 'replay' : 'interactive'}
                            onWarning={mode === 'past' ? undefined : () => setTab('预警推送')}
                          />
                        )
                        : (
                          <Alert
                            type="info"
                            title="请在灾种事件库选择当前事件"
                            description="十类模拟事件已配置独立监测指标；当前事件尚未配置专业趋势序列，不套用其他事件数据。"
                          />
                        )
                    )}
                    {name === '复盘评估分析' && (
                      <>
                        {profile
                          ? <RescueEvaluation profile={profile} />
                          : (
                            <Alert
                              title="当前事件未配置专业投入基线"
                              description="请从已生成的评估任务查看既有材料，或选择十类灾种事件填写计划与实际。"
                            />
                          )}
                      </>
                    )}
                    {name === '回撤归建' && (
                      profile
                        ? <WithdrawalReturn profile={profile} />
                        : (
                          <Alert
                            title="当前事件未配置回撤归建样例"
                            description="请选择十类灾种事件后登记分波次回撤、损耗待修与移交签收。"
                          />
                        )
                    )}
                    {name === '现场智能勘察' && (
                      <>
                        <Steps
                          size="small"
                          current={reviewed ? 3 : analysis ? 2 : records.length ? 1 : 0}
                          items={[
                            { title: '采集资料' },
                            { title: '样例分析' },
                            { title: '专家复核' },
                            { title: '形成材料' },
                          ]}
                        />
                        <Alert
                          type="info"
                          title="先评估再救援"
                          description="到达现场不盲目施救：须完成专家组风险隐患评估后再展开救援。政府渠道资料（微信群/传真）为非正式台账，待结构化入库。"
                        />
                        {mode === 'current' && (
                          <Space wrap>
                            <Select
                              aria-label="资料来源"
                              value={source}
                              onChange={setSource}
                              options={['先遣组', '属地政府·微信群', '属地政府·传真', '监测装备'].map((value) => ({
                                value,
                                label: value,
                              }))}
                            />
                            <Input
                              aria-label="采集时间"
                              placeholder="采集时间（必填）"
                              value={time}
                              onChange={(e) => setTime(e.target.value)}
                            />
                            <Upload
                              accept="image/*,.pdf"
                              showUploadList={false}
                              beforeUpload={(file) => {
                                if (!time.trim()) return false;
                                setRecords((old) => [
                                  ...old,
                                  {
                                    id: crypto.randomUUID(),
                                    name: file.name,
                                    source,
                                    time,
                                    verified: false,
                                  },
                                ]);
                                setAnalysis(false);
                                setReviewed(false);
                                return false;
                              }}
                            >
                              <Button disabled={!time.trim()}>登记现场资料</Button>
                            </Upload>
                            <Button onClick={sample}>载入灾前灾后演示资料</Button>
                          </Space>
                        )}
                        <Table
                          size="small"
                          pagination={false}
                          rowKey="id"
                          dataSource={records}
                          columns={[
                            { title: '资料', dataIndex: 'name' },
                            { title: '来源', dataIndex: 'source' },
                            { title: '采集时间', dataIndex: 'time' },
                            {
                              title: '资料核实',
                              render: (_, r) => (
                                mode === 'past'
                                  ? <Tag color="green">已核实</Tag>
                                  : (
                                    <Checkbox
                                      checked={r.verified}
                                      onChange={(e) => {
                                        setRecords((old) =>
                                          old.map((v) =>
                                            v.id === r.id ? { ...v, verified: e.target.checked } : v,
                                          ),
                                        );
                                        setReviewed(false);
                                      }}
                                    >
                                      核实
                                    </Checkbox>
                                  )
                              ),
                            },
                          ]}
                        />
                        {mode === 'current' && (
                          <Button
                            type="primary"
                            disabled={!records.length}
                            onClick={() => {
                              setAnalysis(true);
                              setReviewed(false);
                            }}
                          >
                            回放视觉分析样例
                          </Button>
                        )}
                        {analysis && (
                          <Card title={mode === 'past' ? '样例识别结果 · 已复核（回放）' : '样例识别结果 · 待专家复核'}>
                            <Tag color="orange">
                              {profile ? `${profile.risks}（预设关注，未识别确认）` : '疑似渗流风险（预设样例）'}
                            </Tag>
                            <p>
                              灾前：未取得完整基准；灾后：模拟观察区出现异常线索。疑似区域A需核查，不能据此确认灾种或开展作业。
                            </p>
                            <svg
                              viewBox="0 0 400 130"
                              role="img"
                              aria-label="模拟影像异常区域标注"
                              style={{ maxWidth: 400, width: '100%' }}
                            >
                              <rect width="400" height="130" fill="#eef4fa" />
                              <path d="M0 85L400 60" stroke="#679fb4" strokeWidth="22" />
                              <rect x="180" y="35" width="100" height="65" fill="none" stroke="#d65c33" strokeWidth="3" />
                              <text x="185" y="27">疑似区域 A（示意）</text>
                            </svg>
                            <Tag color="default">三维对比（演示占位·未接入）</Tag>
                            <Typography.Text type="secondary">
                              三维图/灾前灾后三维对比尚未接入引擎，当前仅 2D 示意。
                            </Typography.Text>
                            {mode === 'past' ? (
                              <>
                                <Alert
                                  type="success"
                                  title="复核意见已记录（模拟回放）"
                                  description={`评估结论待核：${feedback}`}
                                  style={{ marginTop: 12 }}
                                />
                                <Button
                                  style={{ marginTop: 8 }}
                                  onClick={() =>
                                    saveResult(
                                      '勘察复核',
                                      `评估结论待核（专家组先评估再救援）\n${records.map((r) => `${r.name} / ${r.source} / ${r.time}`).join('\n')}\n专家意见：${feedback}`,
                                    )}
                                >
                                  导出勘察材料
                                </Button>
                              </>
                            ) : (
                              <>
                                <Input.TextArea
                                  aria-label="勘察专家意见"
                                  placeholder="专家复核意见、时效及需要补证事项"
                                  value={feedback}
                                  onChange={(e) => {
                                    setFeedback(e.target.value);
                                    setReviewed(false);
                                  }}
                                />
                                <Button
                                  disabled={!feedback.trim() || !records.every((r) => r.verified)}
                                  onClick={() => setReviewed(true)}
                                >
                                  确认专家复核
                                </Button>
                                {reviewed && (
                                  <Alert
                                    type="success"
                                    title="复核意见已记录（模拟）"
                                    description={`评估结论待核：${feedback}。未完成专家组评估前不展开救援作业。`}
                                  />
                                )}
                                <Button
                                  disabled={!reviewed}
                                  onClick={() =>
                                    saveResult(
                                      '勘察复核',
                                      `评估结论待核（专家组先评估再救援）\n${records.map((r) => `${r.name} / ${r.source} / ${r.time}`).join('\n')}\n专家意见：${feedback}`,
                                    )}
                                >
                                  导出勘察材料
                                </Button>
                              </>
                            )}
                          </Card>
                        )}
                      </>
                    )}
                    {name === '规划梯队投送' && (
                      <>
                        {mode === 'current' && (
                          <RouteComparison
                            profile={profile}
                            selectedRoute={route}
                            onSelect={(v) => {
                              setRoute(v || '东侧绕行（示例）');
                              setDispatch(false);
                              setProgress(0);
                            }}
                          />
                        )}
                        {mode === 'past' ? (
                          <Card size="small" title="投送计划 · 已确认（回放）">
                            <DeliveryRouteMap
                              profile={profile}
                              route={route}
                              road={road}
                              progress={progress}
                            />
                            <p>路线：{route}</p>
                            <p>道路条件：{road}</p>
                            <p>负责人：{owner}</p>
                            <Steps
                              current={progress}
                              items={['基地出发', '通行检查点', '前方集结点', '现场到达'].map((title) => ({
                                title,
                              }))}
                            />
                            <Button
                              style={{ marginTop: 12 }}
                              onClick={() =>
                                saveResult(
                                  '梯队投送',
                                  `${route}\n${road}\n负责人${owner}\n轨迹回放节点${progress}/3`,
                                )}
                            >
                              导出投送计划
                            </Button>
                          </Card>
                        ) : (
                          <>
                            <Input
                              aria-label="道路天气条件"
                              placeholder="道路、天气、交通管制及来源"
                              value={road}
                              onChange={(e) => {
                                setRoad(e.target.value);
                                setDispatch(false);
                                setProgress(0);
                              }}
                            />
                            <Alert
                              type="warning"
                              title="道路条件需核实"
                              description="示例：主路封闭、东侧绕行待通行保障确认。组织方式：先遣队 + 机动中队，按第一、二、三梯队派出。堵点集中在通行保障、交通票务、对外协调。未接高德或实时路况，不计算真实最优路线。"
                            />
                            <Select
                              aria-label="投送路线"
                              value={route}
                              onChange={(v) => {
                                setRoute(v);
                                setDispatch(false);
                                setProgress(0);
                              }}
                              options={['东侧绕行（示例）', '铁路人员投送（示例）'].map((value) => ({
                                value,
                                label: value,
                              }))}
                            />
                            <Table
                              size="small"
                              pagination={false}
                              rowKey="stage"
                              dataSource={[
                                { stage: '先遣组', task: '勘察、联络与通行核实', time: 'T+0', support: '属地联系与安全许可' },
                                { stage: '第一梯队', task: '核心技术与首批装备', time: 'T+30（示例）', support: '高速免费/快速通行申请' },
                                { stage: '第二梯队', task: '机动中队及增援', time: 'T+60（示例）', support: '票务与运输协调' },
                                { stage: '第三梯队', task: '保障与轮换', time: 'T+120（示例）', support: '食物、服装、医疗、通信' },
                              ]}
                              columns={[
                                { title: '梯队', dataIndex: 'stage' },
                                { title: '任务', dataIndex: 'task' },
                                { title: '计划节点', dataIndex: 'time' },
                                { title: '协调事项', dataIndex: 'support' },
                              ]}
                            />
                            <Input
                              aria-label="投送负责人"
                              placeholder="确认负责人"
                              value={owner}
                              onChange={(e) => {
                                setOwner(e.target.value);
                                setDispatch(false);
                              }}
                            />
                            <Button
                              type="primary"
                              disabled={!owner.trim() || !road.trim()}
                              onClick={() => {
                                setDispatch(true);
                                setProgress(0);
                              }}
                            >
                              确认模拟投送计划
                            </Button>
                            {dispatch && (
                              <Card title="轨迹节点回放（模拟）">
                                <DeliveryRouteMap
                                  profile={profile}
                                  route={route}
                                  road={road}
                                  progress={progress}
                                />
                                <Steps
                                  current={progress}
                                  items={['基地出发', '通行检查点', '前方集结点', '现场到达'].map((title) => ({
                                    title,
                                  }))}
                                />
                                <p>
                                  路线：{route}；条件：{road}；负责人：{owner}
                                </p>
                                <Button disabled={progress === 3} onClick={() => setProgress((p) => p + 1)}>
                                  回放下一节点
                                </Button>
                                <Button
                                  onClick={() =>
                                    saveResult(
                                      '梯队投送',
                                      `${route}\n${road}\n负责人${owner}\n轨迹回放节点${progress}/3`,
                                    )}
                                >
                                  导出投送计划
                                </Button>
                              </Card>
                            )}
                          </>
                        )}
                      </>
                    )}
                    {name === '预警推送' && (
                      mode === 'past' ? (
                        <>
                          <Card size="small" title="预警内容（回放）">
                            <Typography.Paragraph>{warning}</Typography.Paragraph>
                            <p>责任岗位：{targets.join('、')}</p>
                          </Card>
                          {receipts.map((r) => (
                            <Card size="small" key={r.id} title={r.target}>
                              <Tag color="green">{r.status}（模拟）</Tag>
                              <Typography.Text type="secondary">回执 {r.id}</Typography.Text>
                            </Card>
                          ))}
                        </>
                      ) : (
                        <>
                          <Select
                            mode="multiple"
                            aria-label="预警责任人"
                            placeholder="选择责任岗位"
                            value={targets}
                            onChange={(v) => {
                              setTargets(v);
                              resetWarning();
                            }}
                            options={['现场安全员（演示）', '应急协调员（演示）', '技术负责人（演示）'].map((value) => ({
                              value,
                              label: value,
                            }))}
                          />
                          <Input.TextArea
                            aria-label="预警内容"
                            placeholder="风险、依据、影响范围、建议措施、有效期"
                            value={warning}
                            onChange={(e) => {
                              setWarning(e.target.value);
                              resetWarning();
                            }}
                          />
                          <Button
                            onClick={() => {
                              setWarning(
                                `${eventName}次生风险预警草稿（模拟）：关注${profile?.risks ?? '现场风险'}。依据现场待核线索，请技术、安全岗位复核；关注条件变化，保持撤离路线可用。有效期与风险阈值待确认。`,
                              );
                              resetWarning();
                            }}
                          >
                            生成预警草稿
                          </Button>
                          <Checkbox
                            checked={approved}
                            onChange={(e) => {
                              setApproved(e.target.checked);
                              setReceipts([]);
                            }}
                          >
                            已核对内容和责任岗位，批准本地模拟发送
                          </Checkbox>
                          <Checkbox checked={fail} onChange={(e) => setFail(e.target.checked)}>
                            模拟发送失败
                          </Checkbox>
                          <Button
                            type="primary"
                            disabled={!approved || !targets.length || !warning.trim() || receipts.length > 0}
                            onClick={() =>
                              setReceipts(
                                targets.map((target) => ({
                                  id: crypto.randomUUID(),
                                  target,
                                  status: fail ? '失败' : '已送达',
                                })),
                              )}
                          >
                            模拟推送
                          </Button>
                          {receipts.map((r) => (
                            <Card size="small" key={r.id} title={r.target}>
                              <Tag color={r.status === '失败' ? 'red' : 'green'}>{r.status}（模拟）</Tag>
                              <Typography.Text type="secondary">回执 {r.id}</Typography.Text>
                              {r.status === '失败' ? (
                                <Button
                                  onClick={() =>
                                    setReceipts((old) =>
                                      old.map((v) => (v.id === r.id ? { ...v, status: '已送达' } : v)),
                                    )}
                                >
                                  重试模拟发送
                                </Button>
                              ) : (
                                <Button
                                  disabled={r.status === '已响应'}
                                  onClick={() =>
                                    setReceipts((old) =>
                                      old.map((v) => (v.id === r.id ? { ...v, status: '已响应' } : v)),
                                    )}
                                >
                                  记录模拟响应
                                </Button>
                              )}
                            </Card>
                          ))}
                        </>
                      )
                    )}
                    {name === '知识沉淀入库' && (
                      mode === 'past' ? (
                        <>
                          <Card size="small" title="复盘知识材料（回放）">
                            <Typography.Paragraph>{caseText}</Typography.Paragraph>
                            <Tag>{caseStatus}</Tag>
                            <p>审核意见：{reason}</p>
                          </Card>
                          {published && (
                            <Alert
                              type="success"
                              title="模拟知识条目 V1 已入库，迭代任务已创建"
                              description={`事件 ${eventId}；审核意见：${reason}；范围：${classified ? '内部核心人员、禁止下载' : '当前事件授权范围'}。真实知识库接口尚未接入。`}
                            />
                          )}
                        </>
                      ) : (
                        <>
                          <Input.TextArea
                            aria-label="复盘知识材料"
                            value={caseText}
                            onChange={(e) => {
                              setCaseText(e.target.value);
                              setCaseStatus('草稿');
                              setPublished(false);
                            }}
                            placeholder="案例事实、原因分析、经验、适用条件及来源"
                          />
                          <Button
                            onClick={() => {
                              setCaseText(
                                `${eventName}复盘案例草稿：现有资料存在通信与交接缺口。建议复核作业记录，完善双通道通信与轮换交接。因果关系尚待专家确认，未经审核不作为战法。`,
                              );
                              setCaseStatus('草稿');
                              setPublished(false);
                            }}
                          >
                            提炼当前事件案例草稿
                          </Button>
                          <Checkbox
                            checked={classified}
                            onChange={(e) => {
                              setClassified(e.target.checked);
                              setCaseStatus('草稿');
                              setPublished(false);
                            }}
                          >
                            包含内部战法，限制核心人员可见、禁止下载
                          </Checkbox>
                          <Input
                            aria-label="知识审核意见"
                            placeholder="审核意见 / 退回原因"
                            value={reason}
                            onChange={(e) => setReason(e.target.value)}
                          />
                          <Space wrap>
                            <Button
                              disabled={!caseText.trim() || caseStatus === '待审核'}
                              onClick={() => setCaseStatus('待审核')}
                            >
                              提交入库审核
                            </Button>
                            <Button
                              disabled={caseStatus !== '待审核' || !reason.trim()}
                              onClick={() => setCaseStatus('退回修改')}
                            >
                              退回修改
                            </Button>
                            <Button
                              type="primary"
                              disabled={caseStatus !== '待审核' || !reason.trim()}
                              onClick={() => {
                                setCaseStatus('已入库');
                                setPublished(true);
                              }}
                            >
                              模拟审批通过并入库
                            </Button>
                          </Space>
                          <Tag>{caseStatus}</Tag>
                          {published && (
                            <Alert
                              type="success"
                              title="模拟知识条目 V1 已入库，迭代任务已创建"
                              description={`事件 ${eventId}；审核意见：${reason}；范围：${classified ? '内部核心人员、禁止下载' : '当前事件授权范围'}。任务：重新核对案例索引与引用。真实知识库接口尚未接入。`}
                            />
                          )}
                        </>
                      )
                    )}
                    {name === '编组确认' && (
                      <>
                        {profile && <ResourceComposition profile={profile} />}
                        {!profile && mode === 'current' && (
                          <>
                            <Space wrap>
                              <label>
                                {equipmentLabel}{' '}
                                <InputNumber
                                  aria-label="编组车辆数"
                                  min={1}
                                  max={100}
                                  value={cars}
                                  onChange={(v) => {
                                    setCars(v ?? 1);
                                    setGroupConfirmed(false);
                                  }}
                                />
                              </label>
                              <label>
                                每组人数{' '}
                                <InputNumber
                                  aria-label="每组人数"
                                  min={1}
                                  max={50}
                                  value={people}
                                  onChange={(v) => {
                                    setPeople(v ?? 1);
                                    setGroupConfirmed(false);
                                  }}
                                />
                              </label>
                            </Space>
                            <Alert
                              title={`一车一组经验模板：${cars}组，共${cars * people}人（拟编组）`}
                              description="驾驶、操作、安全、保障岗位由负责人核定；现场空间和可用库存待核。不自动下达调派命令。"
                            />
                            <Input
                              aria-label="编组确认人"
                              placeholder="经验负责人"
                              value={owner}
                              onChange={(e) => {
                                setOwner(e.target.value);
                                setGroupConfirmed(false);
                              }}
                            />
                            <Button disabled={!owner.trim()} onClick={() => setGroupConfirmed(true)}>
                              确认模拟编组
                            </Button>
                            {groupConfirmed && (
                              <>
                                <Tag color="green">已由 {owner} 确认（模拟）</Tag>
                                <Button
                                  onClick={() =>
                                    saveResult(
                                      '编组清单',
                                      `${cars}组 / ${cars}台车辆 / ${cars * people}人\n确认人：${owner}`,
                                    )}
                                >
                                  导出编组清单
                                </Button>
                              </>
                            )}
                          </>
                        )}
                        {(mode === 'past' || (profile && mode === 'current' && groupConfirmed)) && (
                          <Alert
                            type="success"
                            title={mode === 'past' ? '编组已确认（回放）' : '编组已确认（模拟）'}
                            description={
                              profile
                                ? `按本事件资源样例回放；确认人：${owner || '先遣组负责人（演示）'}。不代表已调派。`
                                : `${cars}组 / ${cars * people}人；确认人：${owner}`
                            }
                          />
                        )}
                        {mode === 'past' && !profile && (
                          <Button
                            onClick={() =>
                              saveResult(
                                '编组清单',
                                `${cars}组 / ${cars}台车辆 / ${cars * people}人\n确认人：${owner}`,
                              )}
                          >
                            导出编组清单
                          </Button>
                        )}
                      </>
                    )}
                    {name === '方案修订对比' && (
                      <>
                        {profile && (
                          <Card size="small" title="过程动态调控 · 进展与风险">
                            <p>
                              {profile.objective}：{profile.completed}/{profile.target}
                              {profile.unit}（模拟）；资料时间 {profile.capturedAt}
                            </p>
                            <p>现场风险：{profile.risks}</p>
                            <p>当前缺口：{profile.gaps}</p>
                            <Tag>实际调派、资源占用与作业进展须由现场回执确认</Tag>
                          </Card>
                        )}
                        <Card size="small" title="当前事件方案基线（模拟）">
                          <Typography.Paragraph ellipsis={{ rows: 4, expandable: true }}>
                            {basePlan}
                          </Typography.Paragraph>
                        </Card>
                        {mode === 'current' && (
                          <>
                            <Input.TextArea
                              aria-label="方案修订依据"
                              value={revisionBasis}
                              onChange={(e) => {
                                setRevisionBasis(e.target.value);
                                setRuleChecked(false);
                              }}
                              placeholder="填写现场反馈时间、预案版本、证据来源、力量调整及技术安全核对事项"
                              rows={2}
                            />
                            <Input.TextArea
                              aria-label="方案修订内容"
                              value={revision}
                              onChange={(e) => {
                                setRevision(e.target.value);
                                setRuleChecked(false);
                              }}
                              placeholder="输入现场变化、调整章节和变化依据"
                            />
                            <Card size="small" title="P04-4 · 安全/可行性/合规规则命中（模拟）">
                              <Space wrap>
                                <Button
                                  disabled={!revision.trim() && !revisionBasis.trim()}
                                  onClick={() => {
                                    const hits = checkPlanRules({
                                      revision,
                                      basis: revisionBasis,
                                      risks: profile?.risks ?? '',
                                      gaps: profile?.gaps ?? '',
                                      forceConflict: safetyBlocked,
                                    });
                                    setRuleHits(hits);
                                    setRuleChecked(true);
                                    setSafetyBlocked(hasRuleConflict(hits));
                                  }}
                                >
                                  运行规则校验
                                </Button>
                                <Checkbox
                                  checked={safetyBlocked}
                                  onChange={(e) => {
                                    setSafetyBlocked(e.target.checked);
                                    setRuleChecked(false);
                                  }}
                                >
                                  人工标记安全红线阻断
                                </Checkbox>
                              </Space>
                              {ruleChecked && (
                                <Table
                                  style={{ marginTop: 12 }}
                                  size="small"
                                  pagination={false}
                                  rowKey="id"
                                  dataSource={ruleHits}
                                  columns={[
                                    {
                                      title: '维度',
                                      width: 90,
                                      render: (_, r) => ruleDimensionLabel(r.dimension),
                                    },
                                    {
                                      title: '结果',
                                      width: 110,
                                      render: (_, r) => (
                                        <Tag color={r.status === 'pass' ? 'success' : r.status === 'conflict' ? 'error' : 'warning'}>
                                          {ruleStatusLabel(r.status)}
                                        </Tag>
                                      ),
                                    },
                                    { title: '条款', dataIndex: 'clause' },
                                    { title: '章节定位', dataIndex: 'sectionRef', width: 140 },
                                    {
                                      title: '建议',
                                      render: (_, r) => r.remedy ?? '—',
                                    },
                                  ]}
                                />
                              )}
                            </Card>
                            {safetyBlocked && (
                              <Alert
                                type="error"
                                showIcon
                                title="安全红线检查未通过"
                                description="当前版本不可形成可执行方案；先补充风险评估、许可与撤离条件，再由技术安全岗位核对。"
                              />
                            )}
                            <Button
                              disabled={!revision.trim() || !revisionBasis.trim() || safetyBlocked || !ruleChecked || hasRuleConflict(ruleHits)}
                              onClick={() => {
                                setVersions((old) => [
                                  ...old,
                                  `${revision}\n修订依据：${revisionBasis}\n规则命中：${ruleHits.map((h) => `${ruleDimensionLabel(h.dimension)}=${ruleStatusLabel(h.status)}`).join('；')}\n安全红线：模拟检查未发现阻断，正式会签待核`,
                                ]);
                                setRevision('');
                                setRuleChecked(false);
                              }}
                            >
                              保存修订版本
                            </Button>
                            {versions.map((v, i) => (
                              <Card size="small" title={`V${i + 2} · 修订差异（未批准）`} key={i}>
                                <Typography.Text delete>
                                  {i === 0 ? '基线：原方案尚无本次反馈' : versions[i - 1]}
                                </Typography.Text>
                                <p style={{ color: '#207748' }}>新增反馈：{v}</p>
                                <Button
                                  onClick={() =>
                                    saveResult(
                                      `方案V${i + 2}`,
                                      `${basePlan}\n修订依据与反馈：${versions.slice(0, i + 1).join('\n')}`,
                                    )}
                                >
                                  导出此版本
                                </Button>
                              </Card>
                            ))}
                          </>
                        )}
                      </>
                    )}
                    {name === '资料核验与总结' && (
                      mode === 'past' ? (
                        <>
                          <Alert
                            type="success"
                            title="过程资料已核验（回放）"
                            description={`${records.length} 份演示资料均已人工核对；以下为反思式总结初稿。`}
                          />
                          {records.map((r) => (
                            <Tag key={r.id} color="green" style={{ marginBottom: 4 }}>
                              {r.name} · 已核验
                            </Tag>
                          ))}
                          <Input.TextArea aria-label="总结初稿" value={summary} rows={9} readOnly />
                          <Button onClick={() => saveResult(`${summaryType}总结`, summary)}>导出总结</Button>
                        </>
                      ) : (
                        <>
                          <Alert
                            title="按应用场景选择报告结构"
                            description="反思式总结与全面总结分属不同应用场景：反思式用于复盘短板改进；全面总结用于阶段性工作归档。核验由人员判断，不自动证明真实性。"
                          />
                          <Button onClick={sample}>载入演示过程资料</Button>
                          {records.map((r) => (
                            <Checkbox
                              key={r.id}
                              checked={r.verified}
                              onChange={(e) => {
                                setRecords((old) =>
                                  old.map((v) =>
                                    v.id === r.id ? { ...v, verified: e.target.checked } : v,
                                  ),
                                );
                                setSummary('');
                              }}
                            >
                              {r.name} · {r.source} · {r.time}：来源与时间已人工核对
                            </Checkbox>
                          ))}
                          <Select
                            aria-label="总结类型"
                            value={summaryType}
                            onChange={(v) => {
                              setSummaryType(v);
                              setSummary('');
                            }}
                            options={[
                              {
                                value: '反思式',
                                label: '反思式（实际处置过程/处置方案/存在不足/下一步改进计划）',
                              },
                              {
                                value: '全面总结',
                                label: '全面总结（基本情况/主要经验做法/深刻启示/下一步工作打算）',
                              },
                            ]}
                          />
                          <Button
                            type="primary"
                            disabled={!records.length || !records.every((r) => r.verified)}
                            onClick={() =>
                              setSummary(
                                (summaryType === '反思式'
                                  ? WORK_SUMMARY_REFLECT_TITLES
                                  : WORK_SUMMARY_TEMPLATE_TITLES
                                )
                                  .map((h) =>
                                    `${h}：${/不足|问题|启示/.test(h)
                                      ? '通信类、保障类（人员轮换、食物、服装）等重复短板需复核，并结合历史案例沉淀改进'
                                      : `根据${records.length}份已人工核对的模拟资料整理，详细内容待补`}`,
                                  )
                                  .join('\n'),
                              )}
                          >
                            生成所选总结初稿
                          </Button>
                          {summary && (
                            <>
                              <Input.TextArea
                                aria-label="总结初稿"
                                value={summary}
                                rows={9}
                                onChange={(e) => setSummary(e.target.value)}
                              />
                              <Button onClick={() => saveResult(`${summaryType}总结`, summary)}>
                                导出总结
                              </Button>
                            </>
                          )}
                        </>
                      )
                    )}
                    {name === '资源维护与导出' && (
                      <>
                        {mode === 'past' && resources.length > 0 && (
                          <Alert
                            type="success"
                            title="校正记录已回放"
                            description="以下为按本事件种子生成的本地校正样例，未写原系统。"
                          />
                        )}
                        {mode === 'current' && (
                          <>
                            <Alert
                              title="人工校正与写回确认（模拟）"
                              description="更新记录关联当前事件和维护岗位；本地保存不写原系统。IoT记录仅可登记来源，未接实时设备。"
                            />
                            <Input
                              aria-label="资源名称"
                              placeholder="资源/队伍/专家/保障单元名称"
                              value={resourceName}
                              onChange={(e) => setResourceName(e.target.value)}
                            />
                            <Space wrap>
                              <InputNumber
                                aria-label="资源数量"
                                min={0}
                                value={quantity}
                                onChange={(v) => setQuantity(v ?? 0)}
                              />
                              <Select
                                aria-label="资源状态"
                                value={status}
                                onChange={setStatus}
                                options={['待核实', '可出动', '占用', '维护中'].map((value) => ({
                                  value,
                                  label: value,
                                }))}
                              />
                              <Input
                                aria-label="资源维护人"
                                placeholder="维护人"
                                value={owner}
                                onChange={(e) => setOwner(e.target.value)}
                              />
                            </Space>
                            <Button
                              disabled={!resourceName.trim() || !owner.trim()}
                              onClick={() => {
                                setResources((old) => [
                                  ...old,
                                  [
                                    resourceName,
                                    String(quantity),
                                    status,
                                    owner,
                                    new Date().toISOString(),
                                    eventId,
                                  ],
                                ]);
                                setResourceName('');
                              }}
                            >
                              确认本地校正记录
                            </Button>
                          </>
                        )}
                        <Table
                          size="small"
                          scroll={{ x: 700 }}
                          pagination={false}
                          rowKey={(_, i) => String(i)}
                          dataSource={resources}
                          columns={['资源', '数量', '状态', '维护人', '更新时间', '事件'].map(
                            (title, i) => ({
                              title,
                              render: (_: unknown, row: string[]) => row[i],
                            }),
                          )}
                        />
                        <Button
                          disabled={!resources.length}
                          onClick={() =>
                            exportResourceExcel(
                              ['资源', '数量', '状态', '维护人', '更新时间', '事件'],
                              resources,
                            )}
                        >
                          下载资源 Excel
                        </Button>
                      </>
                    )}
                    {!['应急助手场景', '态势研判预警', '复盘评估分析', '回撤归建'].includes(name)
                      && !(profile && name === '编组确认') && (
                      <OriginalSystemLink
                        code={name}
                        eventId={eventId}
                        title={`${eventName}·${tenderName(name)}（模拟）`}
                        sourceId={`${eventId}:${name}`}
                        sections={[
                          ['当前流程', tenderName(name)],
                          [
                            '本次内容',
                            name === '现场智能勘察'
                              ? `${records.map((r) => `${r.name} / ${r.source} / ${r.time}`).join('\n')}\n专家意见：${feedback || '待补'}`
                              : name === '规划梯队投送'
                                ? `路线：${route}\n道路条件：${road}\n负责人：${owner || '待确认'}\n轨迹节点：${progress}/3`
                                : name === '预警推送'
                                  ? `${warning}\n责任人：${targets.join('、')}\n回执：${receipts.map((r) => `${r.target} ${r.status}`).join('、')}`
                                  : name === '知识沉淀入库'
                                    ? `${caseText}\n审核：${caseStatus} ${reason}\n权限：${classified ? '内部核心人员，禁止下载' : '当前事件授权范围'}`
                                    : name === '编组确认'
                                      ? `${cars}台车辆 / ${cars}组 / ${cars * people}人\n负责人：${owner}\n${groupConfirmed ? '已模拟确认' : '待确认'}`
                                      : name === '方案修订对比'
                                        ? `${basePlan}\n${versions.map((v, i) => `V${i + 2}：${v}`).join('\n')}`
                                        : name === '资料核验与总结'
                                          ? summary || '待资料核验与总结生成'
                                          : resources.map((r) => r.join(' | ')).join('\n') || '尚无校正记录',
                          ],
                        ]}
                      />
                    )}
                  </>
                )}
              </Space>
            ),
          };
        })}
      />
    </Drawer>
  );
}
