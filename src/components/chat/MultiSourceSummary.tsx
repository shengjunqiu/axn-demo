import { useState } from 'react';
import { Button, Drawer, Empty } from 'antd';
import { Database, MapPin } from 'lucide-react';
import type { DisasterSourceEvent, MultiSourceSnapshot } from '@/domain/multiSource';
import { aggregationCounts } from '@/services/multiSourceAggregation';
import { FileRow, KvTable, Notice, NumberedSteps, Section, SourceList, StatusPill } from '@/components/common/ChatPrimitives';
import './multi-source.css';

export default function MultiSourceSummary({ snapshot }: { snapshot: MultiSourceSnapshot }) {
  const [detailEvent, setDetailEvent] = useState<DisasterSourceEvent | null>(null);
  const [sourceKind, setSourceKind] = useState<string | null>(null);
  const counts = aggregationCounts(snapshot.event.sources);
  const pending = snapshot.event.sources.flatMap(source => source.records
    .filter(record => !record.duplicateOf && record.verification === '待核实')
    .map(record => ({ title: `${source.kind} · ${record.title}`, text: `${record.source}：需复核原始资料、时间、位置及内容。引用：${record.refs.join('、') || '待补充'}` })));
  const openDetails = (event: DisasterSourceEvent, kind: string | null = null) => {
    setDetailEvent(event);
    setSourceKind(kind);
  };

  return (
    <section className="axn-multi-source" aria-label="多源数据汇聚" data-testid="multi-source-summary">
      <div className="axn-ms-heading"><Database size={17} aria-hidden /><strong>多源数据汇聚</strong><StatusPill tone="ok">已汇聚 · 模拟</StatusPill></div>
      <p className="axn-ms-lead">已整理{snapshot.event.title}的六类数据来源，覆盖 {counts.covered}/6 类，归并后 {counts.merged} 条线索，{counts.pending} 条待核实。</p>
      <KvTable rows={[
        { label: '当前事件', value: snapshot.event.title },
        { label: '汇聚概览', value: `覆盖 ${counts.covered}/6 类 · 原始 ${counts.raw} 条 · 归并后 ${counts.merged} 条 · 待核 ${counts.pending} 条` },
        { label: '汇聚快照', value: snapshot.gatheredAt },
      ]} />
      <Notice tone="info" title="本地模拟资料">未连接真实全域采集接口；缺项不代表无灾情，线索未经核实不作为处置事实。</Notice>

      <Section title="当前事件六源汇聚">
        <div className="axn-ms-sources">
          {snapshot.event.sources.map(source => (
            <section key={source.kind} className="axn-ms-source" aria-label={`${source.kind}汇聚摘要`}>
              <div className="axn-ms-source-heading"><strong>{source.kind}</strong><StatusPill tone={source.records.length ? 'ok' : 'warn'}>{source.state}</StatusPill></div>
              <span className="axn-ms-meta">{source.records.length} 条记录 · {source.records.filter(record => !record.duplicateOf).length} 条归并线索</span>
              <p>{source.records[0]?.content ?? (source.missing || '数据缺失不代表没有灾情。')}</p>
              {!!source.records.length && <Button size="small" onClick={() => openDetails(snapshot.event, source.kind)}>查看{source.kind}来源与记录</Button>}
            </section>
          ))}
        </div>
      </Section>

      <Section title="全域灾情汇总（授权范围）">
        <p className="axn-ms-meta">{snapshot.scopeLabel} · {snapshot.domainEvents.length} 个事件。按事件分别归并，跨事件不合并。真实全域采集服务待接入。</p>
        <div className="axn-ms-events">
          {snapshot.domainEvents.map(event => {
            const total = aggregationCounts(event.sources);
            return <FileRow key={event.eventId} icon={<MapPin size={16} />} name={event.title}
              sub={`${event.location} · 覆盖 ${total.covered}/6 类 · ${total.merged} 条线索 · ${total.pending} 条待核`}
              action={<Button size="small" aria-label={`查看${event.title}汇聚详情`} onClick={() => openDetails(event)}>查看详情</Button>} />;
          })}
          {!snapshot.domainEvents.length && <Empty description="当前事件不在授权数据域内，未读取跨域记录" />}
        </div>
      </Section>

      {pending.length > 0 && <Section title="待核事项" warn><NumberedSteps summary={{ label: '核验安排', value: '先核来源与时空信息，再形成研判依据' }} items={pending} /></Section>}
      <div className="axn-ms-foot">本地模拟 · 招标 4.2 多源数据汇聚</div>
      <Drawer title={detailEvent ? `${detailEvent.title} · ${sourceKind ?? '授权汇聚'}` : '汇聚详情'} open={!!detailEvent} onClose={() => setDetailEvent(null)} size={560}>
        <div className="axn-ms-drawer">
          {detailEvent?.sources.filter(source => !sourceKind || source.kind === sourceKind).map(source => <Section title={source.kind} key={source.kind}>
            <StatusPill tone={source.records.length ? 'ok' : 'warn'}>{source.state}</StatusPill>
            {source.records.length ? <SourceList sources={source.records.map((record, index) => ({
              title: record.source,
              section: `${record.capturedAt} · ${record.version} · ${record.verification} · 记录${index + 1}`,
              excerpt: `${record.title}：${record.content}\n引用：${record.refs.join('、') || '待补充'}${record.duplicateOf ? `\n重复转发 · 归并至 ${record.duplicateOf}` : ''}`,
            }))} /> : <p>{source.missing || '暂无记录，缺项不代表无灾情。'}</p>}
          </Section>)}
        </div>
      </Drawer>
    </section>
  );
}
