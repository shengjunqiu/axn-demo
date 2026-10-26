import { useMemo, useState } from 'react';
import { Button, Image, Radio, Space, Table, Typography } from 'antd';
import { DISASTER_SOURCE_KINDS, aggregationCounts, buildMultiSourceSnapshot } from '@/services/multiSourceAggregation';
import type { DisasterSourceKind, DisasterSourceRecord } from '@/domain/multiSource';
import { KvTable, Notice, Section, SourceList, InlineFlag } from '@/components/common/ChatPrimitives';
import { TrendChart } from '@/components/settings/ChatChartSpecimens';
import EventTimelineList from '@/components/chat/EventTimelineList';
import { multiSourceBrief } from '@/services/multiSourceBrief';

export default function MultiSourcePanel({ eventId, onClose }: { eventId: string; onClose: () => void }) {
  const [kind, setKind] = useState<DisasterSourceKind>('舆情');
  const snapshot = useMemo(() => buildMultiSourceSnapshot(eventId), [eventId]);
  const source = snapshot.event.sources.find(source => source.kind === kind)!;
  const counts = aggregationCounts(snapshot.event.sources);
  const columns = [
    { title: '记录', dataIndex: 'title', width: 190 }, { title: '内容', dataIndex: 'content', width: 300 },
    { title: '来源', dataIndex: 'source', width: 180 }, { title: '采集时间', dataIndex: 'capturedAt', width: 200 },
    { title: '版本', dataIndex: 'version', width: 110 },
    { title: '核实状态', dataIndex: 'verification', width: 150, render: (value: string) => <InlineFlag tone={value === '待核实' ? 'warn' : 'info'}>{value}</InlineFlag> },
    { title: '质量核对', key: 'quality', width: 180, render: (_: unknown, record: DisasterSourceRecord) => record.duplicateOf ? `重复资料，已归并至 ${record.duplicateOf}` : '独立记录' },
  ];
  const series = source.records.filter(record => !record.duplicateOf).map(record => ({ record, points: [...record.content.matchAll(/(\d{1,2}:\d{2})\s+(-?\d+(?:\.\d+)?)([^；\s]*)/g)].map(match => ({ label: match[1], value: Number(match[2]), unit: match[3] })) })).filter(item => item.points.length);
  return <div className="axn-agent-result" style={{ padding: 24 }} data-testid="multi-source-panel">
    <Space style={{ justifyContent: 'space-between', width: '100%' }}><Typography.Title level={4} style={{ margin: 0 }}>六类数据详情</Typography.Title><Button onClick={onClose}>关闭</Button></Space>
    <KvTable rows={[{ label: '当前事件', value: snapshot.event.title }, { label: '汇聚概览', value: `${counts.covered}/6类 · ${counts.merged}条线索 · ${counts.pending}条待核实` }, { label: '资料时间', value: snapshot.gatheredAt }]} />
    <Radio.Group optionType="button" buttonStyle="solid" value={kind} onChange={event => setKind(event.target.value)} aria-label="六类数据分类"><Space wrap>{DISASTER_SOURCE_KINDS.map(kind => <Radio.Button key={kind} value={kind}>{kind}</Radio.Button>)}</Space></Radio.Group>
    <Section title={`${kind}分析`}><p>{multiSourceBrief(source, eventId)}</p></Section>
    {['气象', '水文', '地质'].includes(kind) && series.map(({ record, points }) => <TrendChart key={record.id} title={record.title} note={record.capturedAt} unit={points[0].unit} series={points} />)}
    {kind === '接报记录' && <EventTimelineList items={source.records.map(record => ({ time: record.capturedAt, title: record.title, detail: record.content, tone: record.verification === '待核实' ? 'pending' : 'done' }))} />}
    {kind === '现场影像' && <Notice tone="info" title="影像资料">下方保留影像、微信群与传真资料的来源、拍摄信息和核实状态；有可预览原件的记录可直接查看。</Notice>}
    {kind === '现场影像' && <Image.PreviewGroup><div className="axn-controls-images">{[
      { src: '/doc-assets/qinghe-site-1.jpg', caption: '现场作业图片 · 预览演示素材' },
      { src: '/doc-assets/qinghe-site-2.jpg', caption: '现场会商图片 · 预览演示素材' },
    ].map(image => <figure key={image.src}><Image src={image.src} alt={image.caption} width="100%" /><figcaption>{image.caption}</figcaption></figure>)}</div></Image.PreviewGroup>}
    {kind === '现场影像' && <Typography.Text type="secondary">以上复用原型图片素材，仅演示预览交互，不作为本事件真实影像依据。原记录见下表。</Typography.Text>}

    <Section title="原始记录与质量核对"><Table size="small" rowKey="id" dataSource={source.records} columns={columns} pagination={false} scroll={{ x: 1300 }} /></Section>
    {source.records.some(record => record.duplicateOf) && <Notice tone="info" title="重复资料已归并">保留原始记录及版本，重复来源不会计入独立线索数量。</Notice>}
    {source.records.some(record => record.verification === '待核实') && <Notice tone="warn" title="需要确认">请核对记录的原始内容、采集时间与来源，核实结果再用于正式研判。</Notice>}
    {!source.records.length && <Notice tone="warn" title="需补充资料">{source.missing}</Notice>}
    <Section title="来源依据"><SourceList sources={source.records.map(record => ({ title: record.source, section: `${record.capturedAt} · ${record.version} · ${record.verification}`, excerpt: record.content }))} /></Section>
  </div>;
}
