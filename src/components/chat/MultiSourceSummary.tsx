import { useState } from 'react';
import { Alert, Button, Card, Descriptions, Drawer, Empty, Segmented, Space, Table, Tag, Typography } from 'antd';
import { Database, ExternalLink } from 'lucide-react';
import type { DisasterSourceEvent, DisasterSourceGroup, MultiSourceSnapshot } from '@/domain/multiSource';
import { aggregationCounts } from '@/services/multiSourceAggregation';
import './multi-source.css';

export default function MultiSourceSummary({ snapshot }: { snapshot: MultiSourceSnapshot }) {
  const [view, setView] = useState('当前事件');
  const [selected, setSelected] = useState<DisasterSourceGroup | null>(null);
  const [domainEvent, setDomainEvent] = useState<DisasterSourceEvent | null>(null);
  const counts = aggregationCounts(snapshot.event.sources);
  return <section className="axn-multi-source" aria-label="多源数据汇聚" data-testid="multi-source-summary">
    <div className="axn-ms-heading"><Space><Database size={17} /><Typography.Text strong>多源数据汇聚</Typography.Text></Space><Tag color="blue">自动汇总 · 模拟</Tag></div>
    <Typography.Paragraph type="secondary">舆情、气象、水文、地质、现场影像、接报记录统一关联事件，保留来源与数据时间。</Typography.Paragraph>
    <Segmented options={['当前事件', '授权数据域汇总']} value={view} onChange={v => setView(String(v))} />
    {view === '当前事件' ? <>
      <div className="axn-ms-counts">覆盖 {counts.covered}/6 类 · 原始 {counts.raw} 条 · 归并后 {counts.merged} 条 · 待核 {counts.pending} 条</div>
      <div className="axn-ms-grid">{snapshot.event.sources.map(source => <Card size="small" key={source.kind} title={source.kind} extra={<Tag color={source.state === '暂无记录' ? 'orange' : 'blue'}>{source.state}</Tag>}>
        <p>{source.records.length ? `${source.records.length} 条记录 · ${source.records.filter(r => !r.duplicateOf).length} 条归并线索` : source.missing}</p>
        <Typography.Paragraph className="axn-ms-preview" type="secondary">{source.records[0]?.content ?? '数据缺失不代表没有灾情。'}</Typography.Paragraph>
        <Button size="small" icon={<ExternalLink size={13} />} onClick={() => setSelected(source)} aria-label={`查看${source.kind}来源`}>查看来源</Button>
      </Card>)}</div>
      <Alert type="warning" showIcon title="待核线索不写入已确认结论" description="新增舆情、气象、地质和影像为演示样例；影像仅登记线索，未做AI识别。重复转发归并但保留原记录，缺项继续提示补证。" />
    </> : <>
      <Typography.Paragraph type="secondary" className="axn-ms-counts">{snapshot.scopeLabel} · {snapshot.domainEvents.length} 个事件。按事件分别归并，跨事件不合并。真实全域采集服务待接入。</Typography.Paragraph>
      <Table size="small" pagination={false} rowKey="eventId" scroll={{x:560}} dataSource={snapshot.domainEvents} columns={[
        {title:'事件',dataIndex:'title',render:(_, event) => <Button type="link" style={{padding:0,whiteSpace:'normal',height:'auto',textAlign:'left'}} onClick={() => setDomainEvent(event)}>{event.title}</Button>}, {title:'位置',dataIndex:'location'},
        {title:'六类来源覆盖',render:(_, event) => `${aggregationCounts(event.sources).covered}/6 类`},
        {title:'归并线索',render:(_, event) => `${aggregationCounts(event.sources).merged} 条`},
        {title:'待核',render:(_, event) => `${aggregationCounts(event.sources).pending} 条`},
      ]} locale={{emptyText:<Empty description="当前事件不在授权数据域内，未读取跨域记录" />}} />
    </>}
    <div className="axn-ms-foot">汇聚快照：{snapshot.gatheredAt} · 本地模拟 · 招标 4.2 多源数据汇聚</div>
    <Drawer title={domainEvent ? `${domainEvent.title} · 授权汇聚` : '授权汇聚'} open={!!domainEvent} onClose={() => setDomainEvent(null)} size={560}>
      {domainEvent && <><Alert type="info" showIcon title="按事件独立汇总 · 模拟" description="仅展示授权清单，不将其他事件记录写入当前事件摘要。" />{domainEvent.sources.map(source => <Card className="axn-ms-record" size="small" key={source.kind} title={source.kind} extra={<Tag>{source.state}</Tag>}>
        {source.records.length ? source.records.filter(r => !r.duplicateOf).map(record => <div key={record.id}><Typography.Paragraph>{record.content}</Typography.Paragraph><Typography.Paragraph type="secondary">{record.source} · {record.capturedAt} · {record.verification}<br />引用：{record.refs.join('、')}</Typography.Paragraph></div>) : <Typography.Text type="secondary">{source.missing}</Typography.Text>}
      </Card>)}</>}
    </Drawer>
    <Drawer title={selected ? `${selected.kind} · 汇聚来源` : '汇聚来源'} open={!!selected} onClose={() => setSelected(null)} size={560}>
      {selected && <><Alert type="info" showIcon title={`${snapshot.event.title} · ${selected.state}`} description="来源与核实状态独立展示。模拟记录不等于真实接口已接入。" />
        {!selected.records.length && <Empty description={selected.missing} />}
        {selected.records.map(record => <Card key={record.id} size="small" className="axn-ms-record" title={record.title} extra={<Tag color="orange">{record.verification}</Tag>}>
          <Typography.Paragraph>{record.content}</Typography.Paragraph>
          <Descriptions size="small" column={1} items={[
            {key:'id',label:'原记录',children:record.id}, {key:'source',label:'来源',children:record.source},
            {key:'time',label:'采集时间',children:record.capturedAt}, {key:'version',label:'版本',children:record.version},
            {key:'refs',label:'引用标识',children:record.refs.join('、')},
            {key:'merge',label:'归并依据',children:record.duplicateOf ? `同事件、同线索转发，归并至 ${record.duplicateOf}` : '独立保留；仅演示已知重复记录归并'},
          ]}/>
        </Card>)}
      </>}
    </Drawer>
  </section>;
}
