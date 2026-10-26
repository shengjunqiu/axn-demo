import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { useEffect, useState } from 'react';
import { Alert, App, Button, Card, Input, InputNumber, Popconfirm, Select, Space, Switch, Table, Tabs, Typography } from 'antd';
import { useCustomerOperations } from '@/store/customerOperationsStore';
import { type MonitorRule, RESCUE_STAGES, parseSnapshot, requestConnection, connectionUrl } from '@/services/customerOperations';
import { comparePlanAndSummary } from '@/services/customerDocuments';
import { resolveDocumentSections } from '@/seed/resolveDocumentSections';
import { useKnowledgeCaseStore } from '@/services/knowledgePublish';
import { exportMaterial } from '@/services/prototypeExports';

export default function CustomerOperationsPanel({ eventId, review, sessionId, initialTab, onClose }: { eventId: string; review: boolean; sessionId: string; initialTab?: string; onClose: () => void }) {
  const state = useCustomerOperations();
  useEffect(() => {
    if (review) return;
    const store = useCustomerOperations.getState();
    if (store.readings.some(row => row.eventId === eventId && row.id === `DEMO-${eventId}-pump-sensor-initial`)) return;
    const examples = [
      { key: 'pump', name: '排水泵', device: '电量传感器', metric: '电量', value: 78, unit: '%', quantity: 3 },
      { key: 'vehicle', name: '救援运输车', device: '油量传感器', metric: '油量', value: 65, unit: '%', quantity: 2 },
      { key: 'generator', name: '便携发电机', device: '温度传感器', metric: '温度', value: 42, unit: '℃', quantity: 4 },
    ];
    const now = Date.now();
    const rows = examples.map((item, index) => {
      const assetId = `DEMO-${eventId}-${item.key}`;
      const deviceId = `${assetId}-sensor`;
      if (!useCustomerOperations.getState().assets.some(a => a.id === assetId)) store.registerAsset({ id: assetId, name: `${item.name}（模拟）`, owner: '演示救援基地', quantity: item.quantity, unit: '台' });
      if (!useCustomerOperations.getState().devices.some(d => d.id === deviceId)) store.registerDevice({ id: deviceId, name: `${item.name}${item.device}（模拟）`, assetId, eventId, metric: item.metric, unit: item.unit });
      return { id: `${deviceId}-initial`, deviceId, assetId, eventId, metric: item.metric, unit: item.unit, value: item.value, collectedAt: new Date(now - index * 60000).toISOString(), source: '本地演示采集记录（模拟）' };
    });
    useCustomerOperations.getState().ingest(rows, []);
  }, [eventId, review]);

  useEffect(() => {
    if (review) return;
    const now = new Date().toISOString();
    const defaults = [
      { key: 'fuel', target: '装备保障岗（模拟）', text: '模拟预警：运输车油量65%，低于演示阈值70%；请核对补给计划。', status: '待处理' as const },
      { key: 'stale', target: '资源值班岗（模拟）', text: '模拟问题：一处备用设备超过30分钟未更新采集记录，请核实通信及设备状态。', status: '已读' as const },
      { key: 'temperature', target: '设备维护岗（模拟）', text: '模拟预警：发电机温度42℃超过演示阈值40℃；维护岗位已登记检查完成（模拟）。', status: '已处理' as const },
    ];
    useCustomerOperations.setState(current => ({
      notices: [...current.notices, ...defaults.filter(item => !current.notices.some(notice => notice.id === `DEMO-NOTICE-${eventId}-${item.key}`)).map(item => ({
        id: `DEMO-NOTICE-${eventId}-${item.key}`, eventId, ruleId: `DEMO-RULE-${eventId}-${item.key}`, readingId: `DEMO-EVIDENCE-${eventId}-${item.key}`,
        target: item.target, text: item.text, createdAt: now, status: item.status, externalStatus: '未发送' as const, receipt: '',
      }))],
      issues: [...current.issues, ...[
        { id: 'DEMO-ISSUE-OWNER', detail: '模拟校验：同一物资在基地台账与汇总台账中的归属单位不一致，需核对调拨单据。', status: '待核对' as const },
        { id: 'DEMO-ISSUE-QUANTITY', detail: '模拟校验：出库数量与签收数量相差1台，需补齐签收凭证并复核库存。', status: '待核对' as const },
        { id: 'DEMO-ISSUE-DUPLICATE', detail: '模拟校验：重复采集记录已核对为同一批次重传，已登记复核（模拟）。', status: '已复核' as const },
      ].filter(item => !current.issues.some(issue => issue.id === item.id)).map(item => ({ ...item, at: now, source: '本地演示校验记录（模拟）' }))],
    }));
  }, [eventId, review]);
  const documents = useMockDocumentStore(s => s.libraries[sessionId]?.documents) ?? [];
  const cases = useKnowledgeCaseStore(s => s.cases).filter(c => c.eventId === eventId);
  const { message } = App.useApp();
  const [asset, setAsset] = useState({ id: '', name: '', owner: '', quantity: 0, unit: '台' });
  const [device, setDevice] = useState({ id: '', name: '', assetId: '', metric: '电量', unit: '%', eventId });
  const [value, setValue] = useState(0);
  const [deviceId, setDeviceId] = useState('');
  const [source, setSource] = useState('');
  const [time, setTime] = useState(new Date().toISOString());
  const [movement, setMovement] = useState({ id: '', assetId: '', direction: '入库' as '入库' | '出库', quantity: 1 });
  const [raw, setRaw] = useState('');
  const [rule, setRule] = useState<MonitorRule>({ id: crypto.randomUUID(), name: '设备低电量预警', eventId, metric: '电量', operator: '<' as '<' | '>', threshold: 20, intervalSeconds: 30, staleMinutes: 10, enabled: true, target: '资源值班岗', lastRunAt: null });
  const [connection, setConnection] = useState(state.connection);
  const [stage, setStage] = useState<string>('接报');
  const [detail, setDetail] = useState('');
  const [plan, setPlan] = useState(resolveDocumentSections(eventId, 'RESCUE_PLAN').map(([h, b]) => `${h}\n${b}`).join('\n'));
  const [version, setVersion] = useState('');
  const [actual, setActual] = useState('');
  const [compared, setCompared] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<{ id: string; title: string; body: string }[]>([]);
  const [searchStatus, setSearchStatus] = useState('尚未查询正式知识库');
  const timeline = state.timeline.filter(t => t.eventId === eventId);
  const comparison = compared ? comparePlanAndSummary(plan, actual) : [];
  const attempt = (action: () => void) => { try { action(); message.success('已保存'); } catch (e) { message.error(e instanceof Error ? e.message : '操作失败'); } };
  const execute = async (action: () => Promise<void>) => { try { await action(); message.success('操作完成'); } catch (e) { message.error(e instanceof Error ? e.message : '操作失败'); } };
  const fields = (values: Record<string, string>, change: (key: string, value: string) => void) => Object.entries(values).map(([key, val]) => <Input key={key} style={{ width: 200, maxWidth: '100%' }} aria-label={key} placeholder={key} value={val} onChange={e => change(key, e.target.value)} />);
  const evidence = `预案版本：${version || '未确认'}\n${actual}\n\n救援时间轴：\n${timeline.map(t => `${t.occurredAt} ${t.stage} ${t.detail}（来源：${t.source}）`).join('\n')}\n\n条款对照：\n${comparison.map(c => `${c.plan}\n${c.result}：${c.evidence}\n${c.hint}`).join('\n')}`;
  const inputMeta = <Space wrap><Input aria-label="记录时间" value={time} onChange={e => setTime(e.target.value)} placeholder="带时区的采集/单据/节点时间" style={{ width: 280 }} /><Input aria-label="记录来源" value={source} onChange={e => setSource(e.target.value)} placeholder="原始单据、设备或回执来源（必填）" style={{ width: 300 }} /></Space>;
  const operationTabs = [
    { key: 'devices', label: '设备与采集', children: <Space orientation="vertical" style={{ width: '100%' }}>
      <Card size="small" title="物资登记"><Space wrap>{fields({ '物资标识': asset.id, '物资名称': asset.name, '归属单位': asset.owner, '计量单位': asset.unit }, (k, v) => setAsset(a => ({ ...a, [{ '物资标识': 'id', '物资名称': 'name', '归属单位': 'owner', '计量单位': 'unit' }[k]!]: v })))}<InputNumber aria-label="初始库存" min={0} value={asset.quantity} onChange={v => setAsset(a => ({ ...a, quantity: v ?? 0 }))} /><Button onClick={() => attempt(() => state.registerAsset(asset))}>登记物资</Button></Space></Card>
      <Card size="small" title="绑定采集设备"><Space wrap>{fields({ '设备编号': device.id, '设备名称': device.name, '绑定物资': device.assetId, '采集指标': device.metric, '指标单位': device.unit }, (k, v) => setDevice(d => ({ ...d, [{ '设备编号': 'id', '设备名称': 'name', '绑定物资': 'assetId', '采集指标': 'metric', '指标单位': 'unit' }[k]!]: v })))}<Button onClick={() => attempt(() => state.registerDevice(device))}>绑定设备</Button></Space></Card>
      {inputMeta}<Space wrap><Select aria-label="采集设备" placeholder="选择当前事件设备" style={{ width: 260 }} value={deviceId || undefined} options={state.devices.filter(d => d.eventId === eventId).map(d => ({ label: `${d.name} / ${d.id}`, value: d.id }))} onChange={setDeviceId} /><InputNumber aria-label="采集数值" value={value} onChange={v => setValue(v ?? 0)} /><Button onClick={() => attempt(() => { const d = state.devices.find(x => x.id === deviceId); if (!d) throw Error('请先选择已绑定设备'); state.ingest([{ id: crypto.randomUUID(), deviceId: d.id, assetId: d.assetId, eventId, metric: d.metric, unit: d.unit, value, collectedAt: time, source }], []); })}>接收采集记录</Button><Button onClick={() => attempt(() => state.sample(eventId))}>载入明确标记的流程样例</Button></Space>
      <Table scroll={{ x: 850 }} size="small" rowKey="id" dataSource={state.readings.filter(r => r.eventId === eventId).slice().reverse()} columns={[{ title: '设备', dataIndex: 'deviceId', render: id => state.devices.find(d => d.id === id)?.name ?? id }, { title: '指标', render: (_, r) => `${r.metric} ${r.value}${r.unit}` }, { title: '采集时间', dataIndex: 'collectedAt', render: time => new Date(time).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) }, { title: '来源', dataIndex: 'source' }]} />
    </Space> },
    { key: 'stock', label: '出入库同步', children: <Space orientation="vertical" style={{ width: '100%' }}>{inputMeta}<Space wrap><Input aria-label="单据编号" placeholder="原始单据编号（重复编号不重复记账）" value={movement.id} onChange={e => setMovement(m => ({ ...m, id: e.target.value }))} /><Select aria-label="出入库物资" style={{ width: 180 }} placeholder="物资" options={state.assets.map(a => ({ label: a.name, value: a.id }))} onChange={v => setMovement(m => ({ ...m, assetId: v }))} /><Select value={movement.direction} options={['入库', '出库'].map(v => ({ label: v, value: v }))} onChange={v => setMovement(m => ({ ...m, direction: v }))} /><InputNumber min={1} value={movement.quantity} onChange={v => setMovement(m => ({ ...m, quantity: v ?? 1 }))} /><Button onClick={() => attempt(() => { const a = state.assets.find(a => a.id === movement.assetId); if (!a) throw Error('请选择物资'); state.ingest([], [{ ...movement, unit: a.unit, occurredAt: time, source }]); })}>校验并同步库存</Button></Space><Table scroll={{ x: 850 }} rowKey="id" dataSource={state.assets} columns={[{ title: '物资', dataIndex: 'name' }, { title: '归属', dataIndex: 'owner' }, { title: '当前库存', render: (_, a) => `${a.quantity}${a.unit}` }]} /><Table scroll={{ x: 850 }} rowKey="id" dataSource={state.movements} columns={[{ title: '单据', dataIndex: 'id' }, { title: '方向', dataIndex: 'direction' }, { title: '数量', dataIndex: 'quantity' }, { title: '时间', dataIndex: 'occurredAt' }, { title: '依据', dataIndex: 'source' }]} /></Space> },
    { key: 'rules', label: '定期监测', children: <Space orientation="vertical" style={{ width: '100%' }}><Alert type="info" title="页面打开期间按间隔自动检查，命中后自动进入站内通知；全天候运行需要后台调度服务。" /><Space wrap><Input aria-label="规则名称" value={rule.name} onChange={e => setRule(r => ({ ...r, name: e.target.value }))} /><Input aria-label="规则指标" value={rule.metric} onChange={e => setRule(r => ({ ...r, metric: e.target.value }))} /><Select value={rule.operator} options={['<', '>'].map(v => ({ label: v, value: v }))} onChange={v => setRule(r => ({ ...r, operator: v }))} /><InputNumber aria-label="预警阈值" value={rule.threshold} onChange={v => setRule(r => ({ ...r, threshold: v ?? 0 }))} /><Input aria-label="通知岗位" value={rule.target} onChange={e => setRule(r => ({ ...r, target: e.target.value }))} /><Typography.Text>间隔秒</Typography.Text><InputNumber min={5} value={rule.intervalSeconds} onChange={v => setRule(r => ({ ...r, intervalSeconds: v ?? 30 }))} /><Typography.Text>数据有效分钟</Typography.Text><InputNumber min={1} value={rule.staleMinutes} onChange={v => setRule(r => ({ ...r, staleMinutes: v ?? 10 }))} /><Button onClick={() => attempt(() => { state.addRule(rule); setRule(r => ({ ...r, id: crypto.randomUUID() })); })}>保存并启用规则</Button><Button onClick={() => state.tick(Date.now(), true)}>立即检查</Button></Space><Table scroll={{ x: 850 }} rowKey="id" dataSource={state.rules.filter(r => r.eventId === eventId)} columns={[{ title: '规则', dataIndex: 'name' }, { title: '条件', render: (_, r) => `${r.metric}${r.operator}${r.threshold}，每${r.intervalSeconds}秒` }, { title: '最近运行', dataIndex: 'lastRunAt' }, { title: '启用', render: (_, r) => <Switch checked={r.enabled} onChange={v => state.toggleRule(r.id, v)} /> }, { title: '操作', render: (_, r) => <Button onClick={() => setRule({ ...r, lastRunAt: null })}>编辑规则</Button> }]} /><Table scroll={{ x: 850 }} rowKey="id" dataSource={state.runs.filter(r => state.rules.some(rule => rule.id === r.ruleId && rule.eventId === eventId))} columns={[{ title: '时间', dataIndex: 'at' }, { title: '结果', dataIndex: 'result' }, { title: '检查依据', dataIndex: 'detail' }]} /></Space> },
    { key: 'notices', label: `通知与问题 (${state.notices.filter(n => n.eventId === eventId && n.status === '待处理').length})`, children: <Space orientation="vertical" style={{ width: '100%' }}><Table scroll={{ x: 850 }} rowKey="id" dataSource={state.notices.filter(n => n.eventId === eventId)} columns={[{ title: '责任岗位', dataIndex: 'target' }, { title: '预警依据', dataIndex: 'text' }, { title: '处理状态', dataIndex: 'status' }, { title: '外部接收', render: (_, n) => `${n.externalStatus} ${n.receipt}` }, { title: '操作', render: (_, n) => <Space><Button onClick={() => state.markNotice(n.id, '已读')}>已读</Button><Button onClick={() => state.markNotice(n.id, '已处理')}>处理完成</Button><Popconfirm title={`确认向 ${n.target} 发送上述内容？`} onConfirm={() => state.sendNotice(n.id)}><Button disabled={!state.connection.notification || n.externalStatus === '已确认接收'} loading={n.externalStatus === '发送中'}>发送外部通知</Button></Popconfirm></Space> }]} /><Table scroll={{ x: 850 }} rowKey="id" dataSource={state.issues} columns={[{ title: '校验问题', dataIndex: 'detail' }, { title: '状态', dataIndex: 'status' }, { title: '操作', render: (_, i) => <Button disabled={i.status === '已复核'} onClick={() => state.resolveIssue(i.id)}>登记已复核</Button> }]} /></Space> },
  ];
  const reviewTabs = [
    { key: 'timeline', label: '完整救援时间轴', children: <Space orientation="vertical" style={{ width: '100%' }}><Alert type="info" title={`七环节记录覆盖：${RESCUE_STAGES.filter(s => timeline.some(t => t.stage === s)).length}/7；缺失环节：${RESCUE_STAGES.filter(s => !timeline.some(t => t.stage === s)).join('、') || '无'}`} />{inputMeta}<Select aria-label="救援环节" value={stage} options={RESCUE_STAGES.map(s => ({ label: s, value: s }))} onChange={setStage} /><Input.TextArea aria-label="救援节点内容" value={detail} onChange={e => setDetail(e.target.value)} placeholder="实际动作、人员、数量、回执等" /><Button onClick={() => attempt(() => state.ingest([], [], [{ id: crypto.randomUUID(), eventId, stage, occurredAt: time, detail, source }]))}>记录救援节点</Button><Table scroll={{ x: 850 }} rowKey="id" dataSource={timeline} columns={[{ title: '时间', dataIndex: 'occurredAt' }, { title: '环节', dataIndex: 'stage' }, { title: '记录', dataIndex: 'detail' }, { title: '来源', dataIndex: 'source' }]} /><Button onClick={() => void exportMaterial('救援过程时间轴', [['过程记录', timeline.map(t => `${t.occurredAt} ${t.stage} ${t.detail}（来源：${t.source}）`).join('\n') || '暂无实际节点'], ['待补环节', RESCUE_STAGES.filter(s => !timeline.some(t => t.stage === s)).join('、') || '七环节均有记录，真实性仍须复核']], 'Word').catch(() => message.error('导出失败'))}>导出时间轴</Button></Space> },
    { key: 'comparison', label: '预案条款对照', children: <Space orientation="vertical" style={{ width: '100%' }}><Alert type="warning" title="初始预案为本地参考。请替换为适用预案并填写版本；文字相关仅定位证据，不能判定完成或合规。" /><Input aria-label="预案版本" placeholder="预案名称、版本、批准日期或正式文档编号" value={version} onChange={e => { setVersion(e.target.value); setCompared(false); }} /><Input.TextArea aria-label="预案条款" rows={6} value={plan} onChange={e => { setPlan(e.target.value); setCompared(false); }} /><Select aria-label="选用本会话总结" placeholder="选用本会话已生成文书，自动读取正文（原型文书须复核）" style={{ width: '100%' }} options={documents.map(d => ({ label: `${d.title} / ${d.date}`, value: d.id }))} onChange={id => { const d = documents.find(d => d.id === id); if (d) { setActual(`文书：${d.title}；文书标识：${d.id}；日期：${d.date}\n${d.sections.map(([h, b]) => `${h}\n${b}`).join('\n')}`); setCompared(false); } }} /><Input.TextArea aria-label="实际救援总结" rows={6} value={actual} onChange={e => { setActual(e.target.value); setCompared(false); }} placeholder="粘贴本次实际救援总结，保留时间、来源与执行结果" /><Button disabled={!version.trim() || !actual.trim() || !plan.trim()} onClick={() => setCompared(true)}>逐条定位差异与证据</Button><Table scroll={{ x: 850 }} rowKey="clause" dataSource={comparison} columns={[{ title: '预案要求', dataIndex: 'plan' }, { title: '实际记录', dataIndex: 'evidence' }, { title: '对照结果', dataIndex: 'result' }, { title: '复核与修订建议', dataIndex: 'hint' }]} /></Space> },
    { key: 'knowledge', label: '知识沉淀与正式检索', children: <Space orientation="vertical" style={{ width: '100%' }}><Button disabled={!timeline.length && !actual.trim()} onClick={() => attempt(() => { useKnowledgeCaseStore.getState().publishEventCase({ eventId, body: evidence, source: 'summary', tags: ['救援复盘', version || '版本待核'] }); })}>保存可追溯案例候选</Button>{cases.map(c => { const publication = state.publications.find(p => p.caseId === `${c.id}:${c.updatedAt}`); return <Card size="small" title={c.title} key={c.id}><Typography.Paragraph>{c.status}；正式库：{publication?.status ?? '未发布'} {publication?.receipt}</Typography.Paragraph><Popconfirm title="确认已复核案例内容、来源与预案版本，发布至配置的正式知识库？" onConfirm={() => state.publish(`${c.id}:${c.updatedAt}`, { eventId, title: c.title, body: c.body, tags: c.tags })}><Button disabled={!state.connection.knowledge}>审核并发布正式库</Button></Popconfirm><Typography.Paragraph ellipsis={{ rows: 4, expandable: true, symbol: '展开案例正文' }} style={{ whiteSpace: 'pre-wrap' }}>{c.body}</Typography.Paragraph></Card>; })}<Space><Input aria-label="正式知识检索词" value={query} onChange={e => setQuery(e.target.value)} placeholder="正式知识库查询词" /><Button disabled={!state.connection.knowledge || !query.trim()} onClick={() => { setResults([]); setSearchStatus('查询中'); void (async () => { try { const url = new URL(connectionUrl(state.connection.knowledge)); url.searchParams.set('q', query); const data = await requestConnection(url.href) as { items?: unknown }; if (!data || !Array.isArray(data.items) || !data.items.every(i => i && typeof i.id === 'string' && typeof i.title === 'string' && typeof i.body === 'string')) throw Error('知识检索返回格式不合法'); setResults(data.items); setSearchStatus(`正式接口返回 ${data.items.length} 条结果`); } catch (e) { setSearchStatus(`查询失败：${e instanceof Error ? e.message : '未知错误'}`); } })(); }}>查询正式知识库</Button></Space><Typography.Text>{searchStatus}</Typography.Text>{results.map(r => <Card key={r.id} title={r.title}>{r.body}</Card>)}</Space> },
  ];
  const integration = { key: 'connection', label: '数据导入与接口', children: <Space orientation="vertical" style={{ width: '100%' }}><Alert type={state.syncError ? 'error' : 'info'} title={state.syncError || `最近数据接收：${state.syncAt || '尚未接收'}；接口未配置时不会产生外部成功回执`} /><Input.TextArea aria-label="数据导入JSON" rows={5} value={raw} onChange={e => setRaw(e.target.value)} placeholder='数据对象包含 readings、movements、timeline 三个数组；时间为带时区 ISO 格式。' /><Button onClick={() => attempt(() => { const snapshot = parseSnapshot(JSON.parse(raw)); state.ingest(snapshot.readings, snapshot.movements, snapshot.timeline); })}>校验并导入数据</Button>{fields({ '物联网与库存接口': connection.snapshot, '通知接口': connection.notification, '知识库接口': connection.knowledge }, (k, v) => setConnection(c => ({ ...c, [{ '物联网与库存接口': 'snapshot', '通知接口': 'notification', '知识库接口': 'knowledge' }[k]!]: v })))}<Space><Typography.Text>同步间隔（秒）</Typography.Text><InputNumber min={5} value={connection.pollSeconds} onChange={v => setConnection(c => ({ ...c, pollSeconds: v ?? 30 }))} /><Switch checked={connection.enabled} onChange={v => setConnection(c => ({ ...c, enabled: v }))} checkedChildren="自动同步" unCheckedChildren="暂停同步" /><Button onClick={() => attempt(() => state.configure(connection))}>保存接入配置</Button><Button disabled={!state.connection.snapshot} onClick={() => void execute(() => state.sync())}>立即从接口同步</Button></Space></Space> };
  return <section className="axn-flow-workspace" data-testid="customer-operations-workspace">
    <div className="axn-flow-workspace-head"><Typography.Text strong>{review ? '救援复盘与知识' : '资源数据与预警'}</Typography.Text><Button size="small" aria-label="关闭资源工作区" onClick={onClose}>关闭</Button></div>
    <div className="axn-flow-workspace-body"><Tabs defaultActiveKey={initialTab} items={[...(review ? reviewTabs : operationTabs), integration]} /></div>
  </section>;
}
