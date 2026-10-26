import { multiSourceFollowUp } from '@/services/multiSourceFollowUp';
import { multiSourceBrief } from '@/services/multiSourceBrief';
import { useState } from 'react';
import { Button, Drawer, Empty } from 'antd';
import { Database, MapPin } from 'lucide-react';
import type { DisasterSourceEvent, MultiSourceSnapshot } from '@/domain/multiSource';
import { aggregationCounts } from '@/services/multiSourceAggregation';
import { FileRow, KvTable, Notice, Section, SourceList, StatusPill, InlineFlag } from '@/components/common/ChatPrimitives';
import './multi-source.css';

export default function MultiSourceSummary({ snapshot, regionalOnly = false }: { snapshot: MultiSourceSnapshot; regionalOnly?: boolean }) {
  const [detailEvent, setDetailEvent] = useState<DisasterSourceEvent | null>(null);
  const [sourceKind, setSourceKind] = useState<string | null>(null);
  const counts = aggregationCounts(snapshot.event.sources);
  const pending = multiSourceFollowUp(snapshot.event.sources);
  const openDetails = (event: DisasterSourceEvent, kind: string | null = null) => {
    setDetailEvent(event);
    setSourceKind(kind);
  };

  return (
    <section className="axn-multi-source" aria-label="多源数据汇聚" data-testid="multi-source-summary">
      {!regionalOnly && <>
      <div className="axn-ms-heading"><Database size={17} aria-hidden /><strong>多源数据汇聚</strong><StatusPill tone="ok">已汇聚 · 模拟</StatusPill></div>
      <p className="axn-ms-lead">已整理{snapshot.event.title}的六类数据来源，覆盖 {counts.covered}/6 类，归并后 {counts.merged} 条线索，{counts.pending} 条待核实。</p>
      <KvTable rows={[
        { label: '当前事件', value: snapshot.event.title },
        { label: '汇聚概览', value: `覆盖 ${counts.covered}/6 类 · 原始 ${counts.raw} 条 · 归并后 ${counts.merged} 条 · 待核 ${counts.pending} 条` },
        { label: '汇聚快照', value: snapshot.gatheredAt },
      ]} />
      <Notice tone="info" title="AI模拟研判">结合事件场景与监测数据模拟分析，非真实模型或影像识别结果；原始记录与核实状态可查看详情。</Notice>

      <Section title="当前事件六源汇聚">
        <div className="axn-ms-source-summary">
          <KvTable
            rows={snapshot.event.sources.map(source => {
              const records = source.records.filter(record => !record.duplicateOf);
              const unverified = records.filter(record => record.verification === '待核实').length;
              return {
                label: source.kind,
                value: <span className="axn-ms-field-value">
                  <span className="axn-ms-field-copy">{multiSourceBrief(source, snapshot.event.eventId)}</span>
                  <span className="axn-ms-field-meta">
                    <span>{source.records.length} 条记录</span>
                    {unverified > 0 ? <InlineFlag tone="warn">{unverified} 条待核实</InlineFlag> : <InlineFlag tone={records.length ? 'info' : 'warn'}>{records.length ? '来源已核 · 模拟' : '待补充'}</InlineFlag>}
                    {!!source.records.length && <Button type="link" size="small" aria-label={`查看${source.kind}来源与记录`} onClick={() => openDetails(snapshot.event, source.kind)}>查看详情</Button>}
                  </span>
                </span>,
              };
            })}
            foot={`数据来源：${snapshot.event.sources.map(source => source.kind).join('、')}（本地模拟，AI模拟研判，非真实影像识别；依据见详情）`}
          />
        </div>
      </Section>

      </>}

      {regionalOnly && <Section title="我负责区域的灾情">
        <p className="axn-ms-meta">根据当前可查看的事件记录，共有 {snapshot.domainEvents.length} 起灾情。以下为本地模拟数据，尚未接入实时区域灾情。</p>
        <div className="axn-ms-events">
          {snapshot.domainEvents.map(event => {
            const total = aggregationCounts(event.sources);
            return <FileRow key={event.eventId} icon={<MapPin size={16} />} name={event.title}
              sub={`${event.location} · 覆盖 ${total.covered}/6 类 · ${total.merged} 条线索 · ${total.pending} 条待核`}
              action={<Button size="small" aria-label={`查看${event.title}汇聚详情`} onClick={() => openDetails(event)}>查看详情</Button>} />;
          })}
          {!snapshot.domainEvents.length && <Empty description="当前事件不在授权数据域内，未读取跨域记录" />}
        </div>
      </Section>}

      {!regionalOnly && pending.length > 0 && <Section title="还需要您确认的情况" warn>
        <p className="axn-ms-followup-intro">以下信息尚未核实，可能影响救援判断。已将 {counts.pending} 条资料合并为 {pending.length} 项需要确认的事情：</p>
        <KvTable rows={pending.map(item => ({
          label: item.title,
          value: <span className="axn-ms-field-value">
            <span>{item.question}</span>
            <span className="axn-ms-field-meta"><span>{item.count} 份相关资料</span><Button type="link" size="small" onClick={() => openDetails(snapshot.event, item.kind)}>查看相关资料</Button></span>
          </span>,
        }))} foot="核实后，可直接在对话中补充结果或上传材料，供后续分析参考。" />
      </Section>}
      <div className="axn-ms-foot">本地模拟 · 招标 4.2 多源数据汇聚</div>
      <Drawer title={detailEvent ? `${detailEvent.title} · ${sourceKind ?? '授权汇聚'}` : '汇聚详情'} open={!!detailEvent} onClose={() => setDetailEvent(null)} size={560}>
        <div className="axn-ms-drawer">
          <Notice tone="info" title="AI模拟研判说明">结论根据本地事件场景、风险描述及监测读数模拟生成；影像结论为场景推演，未调用真实视觉识别。原始记录及核实状态如下。</Notice>
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
