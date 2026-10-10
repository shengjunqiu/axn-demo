/**
 * 原系统业务原型工作区：对齐 Vue OriginalSystemWorkspace 骨架。
 * 展示系统正式名称、栏目导航、业务列表/详情与历史截图；AI 材料接收为演示联动。
 */
import { useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import {
  Alert,
  App,
  Button,
  Card,
  Descriptions,
  Empty,
  Space,
  Table,
  Tag,
  Typography,
} from 'antd';
import { eventDisplayName } from '@/services/factLookup';
import {
  originalPage,
  originalSystem,
  readOriginalMaterials,
  receiveOriginalMaterial,
  systems,
  type OriginalSystemDef,
} from '@/services/originalSystem';
import { isDutyContent } from '@/seed/prototypeVisibility';
import { vueWorkspaceEventById } from '@/seed/vueWorkspaceEvents';
import './original-system.css';

const vueWorkspaceEvents = [...vueWorkspaceEventById.values()];

type Mode = 'work' | 'source';

function evidenceSrc(path: string): string {
  const cleaned = path.replace(/^\//, '');
  return `${import.meta.env.BASE_URL}${cleaned}`;
}

export default function OriginalSystemWorkspace({
  /** 栏目内跳转前缀；一期嵌入页传 `/phase1`，默认原系统独立路由 */
  linkBase = '/originalSystems',
}: {
  linkBase?: string;
} = {}) {
  const { system = 'coordination' } = useParams();
  const [query] = useSearchParams();
  const navigate = useNavigate();
  const { message } = App.useApp();
  const [revision, setRevision] = useState(0);
  const [mode, setMode] = useState<Mode>('work');
  const [imageIndex, setImageIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const [filterDraft, setFilterDraft] = useState<Record<string, string>>({});
  const [applied, setApplied] = useState<Record<string, string>>({});

  const sys = originalSystem(system) as OriginalSystemDef | undefined;
  const pageId = query.get('page') ?? sys?.pages[0]?.id ?? '';
  const page = originalPage(system, pageId);
  const eventId = query.get('event') ?? '';
  const reportId = query.get('report');
  const systemPath = (nextSystem: string, search: string) => `${linkBase}/${nextSystem}?${search}`;

  let records: ReturnType<typeof readOriginalMaterials> = [];
  let error = '';
  try {
    records = readOriginalMaterials();
  } catch {
    error = '本地联动材料无法读取，请保留原会话并检查浏览器存储。';
  }
  // revision 用于接收后强制重读
  void revision;
  const rows = records.filter(
    r =>
      r.system === system &&
      r.page === pageId &&
      r.eventId === eventId &&
      !isDutyContent(r.title),
  );
  const selected = rows.find(r => r.id === reportId);

  const groups = useMemo(() => {
    if (!sys) return [] as { number: string; title: string }[];
    if (sys.groups?.length) return sys.groups;
    const seen = new Set<string>();
    const list: { number: string; title: string }[] = [];
    for (const p of sys.pages) {
      if (seen.has(p.group)) continue;
      seen.add(p.group);
      list.push({ number: String(list.length + 1), title: p.group });
    }
    return list;
  }, [sys]);

  const open = (nextSystem: string, nextPage: string, report?: string) => {
    setMode('work');
    setImageIndex(0);
    setFilterDraft({});
    setApplied({});
    navigate(
      systemPath(
        nextSystem,
        new URLSearchParams({
          page: nextPage,
          event: eventId,
          ...(report ? { report } : {}),
        }).toString(),
      ),
    );
  };

  const isEventList =
    (system === 'business' && ['I01', 'I07'].includes(pageId)) ||
    (system === 'coordination' && ['E01', 'E03'].includes(pageId));
  const isEventDetail =
    (system === 'coordination' && pageId === 'E02') ||
    (system === 'business' && pageId === 'I02');
  const isExercise = ['I07', 'E03'].includes(pageId);

  const demoEventRows = useMemo(() => {
    if (!isEventList || isExercise) return [];
    return vueWorkspaceEvents.map(e => ({
      id: e.eventId,
      标题: `${e.name}（演示）`,
      抢险类别: e.category,
      调用单位: '未核实',
      更新时间: e.occurredAt,
      发送单位: '演示填报单位',
      填报单位: '演示填报单位',
      信息类型: '同步信息',
      抢险状态: `${e.stage}（演示）`,
    }));
  }, [isEventList, isExercise]);

  const listColumns = useMemo(() => {
    if (!page) return [] as string[];
    if (isEventList) {
      const base = ['标题', '抢险类别', '调用单位', '更新时间', '填报单位'];
      return system === 'business'
        ? [...base.slice(0, 4), '发送单位', '填报单位', '信息类型']
        : [...base, '抢险状态'];
    }
    return page.columns.filter(c => !['序号', '操作'].includes(c) && !isDutyContent(c));
  }, [page, isEventList, system]);

  const filterFields = useMemo(() => {
    if (!page) return [] as string[];
    if (isEventList) {
      return system === 'business'
        ? ['标题', '抢险类别', '信息类型', '发送单位']
        : ['标题'];
    }
    return (page.filters ?? []).filter(f => !/时间|日期|范围/.test(f));
  }, [page, isEventList, system]);

  const matchedDemoRows = useMemo(() => {
    const source = isEventList ? demoEventRows : [];
    return source.filter(row =>
      Object.entries(applied).every(([key, value]) => {
        if (!value) return true;
        return String((row as Record<string, string>)[key] ?? '').includes(value);
      }),
    );
  }, [applied, demoEventRows, isEventList]);

  const images = page?.images ?? [];
  const currentEvent = vueWorkspaceEvents.find(e => e.eventId === eventId);

  if (!sys || !page) {
    return (
      <div style={{ padding: 24 }}>
        <Alert type="error" title="业务系统栏目不存在" />
        <Button onClick={() => navigate('/assistant')}>返回安小能</Button>
      </div>
    );
  }

  return (
    <div
      className={`axn-os ${system === 'coordination' ? 'axn-os--coordination' : ''}`}
      data-testid="original-system-workspace"
      data-revision={revision}
    >
      <aside className="axn-os-sidebar" aria-label={`${sys.title}导航`}>
        <div className="axn-os-brand">
          <span aria-hidden>▰</span>
          <small>应急救援综合平台</small>
          <strong>{sys.title}</strong>
        </div>
        <nav className="axn-os-nav" aria-label="业务功能导航">
          {groups.map(g => (
            <details key={g.title} open={g.title === page.group}>
              <summary>{g.title}</summary>
              {sys.pages
                .filter(p => p.group === g.title && !isDutyContent(p.title))
                .map(p => (
                  <button
                    key={p.id}
                    type="button"
                    className={`axn-os-nav-btn${p.id === pageId ? ' is-active' : ''}`}
                    onClick={() => open(system, p.id)}
                  >
                    {p.title}
                  </button>
                ))}
            </details>
          ))}
        </nav>
        <footer className="axn-os-side-foot">
          <span>演示工作空间</span>
          <Button size="small" type="link" onClick={() => navigate('/assistant')}>
            返回安小能
          </Button>
        </footer>
      </aside>

      <main className="axn-os-main">
        <header className="axn-os-toolbar">
          <div className="axn-os-switch" role="group" aria-label="切换业务系统">
            {(systems as OriginalSystemDef[]).map(s => (
              <button
                key={s.id}
                type="button"
                className={`axn-os-switch-btn${s.id === system ? ' is-active' : ''}`}
                onClick={() => open(s.id, s.pages[0].id)}
              >
                {s.title}
              </button>
            ))}
          </div>
          <Tag color="blue">业务原型（模拟）</Tag>
        </header>

        <nav className="axn-os-module-nav" aria-label="系统模块">
          {groups.map(g => {
            const first = sys.pages.find(p => p.group === g.title);
            if (!first) return null;
            return (
              <button
                key={g.title}
                type="button"
                className={`axn-os-module-btn${g.title === page.group ? ' is-active' : ''}`}
                onClick={() => open(system, first.id)}
              >
                {g.title}
              </button>
            );
          })}
        </nav>

        {system === 'coordination' && (
          <div className="axn-os-event-bar">
            <span>当前事件</span>
            <strong>
              {eventId
                ? currentEvent?.name || eventDisplayName(eventId)
                : '未指定（请从安小能对话带入）'}
            </strong>
            {eventId ? <code>{eventId}</code> : null}
            <Button size="small" onClick={() => open(system, 'E01')}>
              切换事件
            </Button>
          </div>
        )}

        <section className="axn-os-card">
          <div className="axn-os-heading">
            <div>
              <small>
                {page.group} / {page.id}
                {page.number ? ` · ${page.number}` : ''}
              </small>
              <h1>{page.title}</h1>
            </div>
            <div className="axn-os-mode">
              <button
                type="button"
                className={mode === 'work' ? 'is-active' : undefined}
                onClick={() => setMode('work')}
              >
                业务原型
              </button>
              <button
                type="button"
                className={mode === 'source' ? 'is-active' : undefined}
                onClick={() => setMode('source')}
              >
                原系统截图 {images.length ? <span>· {images.length}</span> : null}
              </button>
            </div>
          </div>

          <p className="axn-os-boundary">
            当前为「{sys.title}」演示页面。草稿与 AI 材料仅保存在本浏览器；审批、签发、发送、调度和库存过账需在已接入的正式业务系统办理。本页不操作真实业务库。
          </p>

          {error && <Alert style={{ marginTop: 12 }} type="error" title={error} />}
          {reportId && !selected && (
            <Alert
              style={{ marginTop: 12 }}
              type="warning"
              title="关联材料不存在，或不属于此事件与栏目"
              description="未展示其他事件内容，请从原生成结果重新进入。"
            />
          )}

          {mode === 'source' ? (
            images.length ? (
              <>
                <div className="axn-os-evidence-tools">
                  <Button
                    size="small"
                    disabled={imageIndex === 0}
                    onClick={() => setImageIndex(i => i - 1)}
                  >
                    上一张
                  </Button>
                  <span>
                    {imageIndex + 1} / {images.length} · 历史截图（来自实施材料）
                  </span>
                  <Button
                    size="small"
                    disabled={imageIndex >= images.length - 1}
                    onClick={() => setImageIndex(i => i + 1)}
                  >
                    下一张
                  </Button>
                  <Button size="small" onClick={() => setZoom(z => !z)}>
                    {zoom ? '适应宽度' : '原尺寸查看'}
                  </Button>
                </div>
                <div className="axn-os-evidence-scroll">
                  <img
                    src={evidenceSrc(images[imageIndex])}
                    alt={`${sys.title} · ${page.title}原系统截图`}
                    className={zoom ? 'is-zoom' : undefined}
                  />
                </div>
              </>
            ) : (
              <div className="axn-os-empty">
                本功能未提供专用截图
                <small>可对照实施材料中的系统截图文档查看界面形态</small>
              </div>
            )
          ) : (
            <>
              {isEventDetail && currentEvent ? (
                <>
                  <h2 className="axn-os-section-title">任务信息</h2>
                  <dl className="axn-os-facts">
                    {(
                      [
                        ['任务地点', currentEvent.location || currentEvent.name],
                        ['任务类型', currentEvent.category],
                        ['当前状态', `${currentEvent.stage}（演示）`],
                        ['任务来源', '演示接报'],
                        ['调用单位', '未核实'],
                        ['更新时间', currentEvent.occurredAt],
                        ['伤亡情况', currentEvent.casualty || '死亡、受伤、被困、失联均未核实'],
                      ] as const
                    ).map(([label, value]) => (
                      <div key={label} style={{ display: 'contents' }}>
                        <dt>{label}</dt>
                        <dd>{value}</dd>
                      </div>
                    ))}
                  </dl>
                  <h2 className="axn-os-section-title">处理过程</h2>
                  <div className="axn-os-empty">尚无已核实的处理回执</div>
                </>
              ) : (
                <>
                  {filterFields.length > 0 && (
                    <form
                      className="axn-os-query"
                      onSubmit={e => {
                        e.preventDefault();
                        setApplied({ ...filterDraft });
                      }}
                    >
                      {filterFields.map(f => (
                        <label key={f}>
                          {f}
                          <input
                            aria-label={f}
                            value={filterDraft[f] ?? ''}
                            placeholder={`请输入${f}`}
                            onChange={e =>
                              setFilterDraft(prev => ({ ...prev, [f]: e.target.value }))
                            }
                          />
                        </label>
                      ))}
                      <Button type="primary" htmlType="submit">
                        查询
                      </Button>
                      <Button
                        htmlType="button"
                        onClick={() => {
                          setFilterDraft({});
                          setApplied({});
                        }}
                      >
                        重置
                      </Button>
                    </form>
                  )}

                  {isEventList ? (
                    <>
                      <div className="axn-os-list-tools">
                        <span>事件记录 · 共 {matchedDemoRows.length} 条（演示）</span>
                      </div>
                      <div className="axn-os-table-wrap">
                        {matchedDemoRows.length ? (
                          <table className="axn-os-table">
                            <thead>
                              <tr>
                                <th>序号</th>
                                {listColumns.map(c => (
                                  <th key={c}>{c}</th>
                                ))}
                                <th>操作</th>
                              </tr>
                            </thead>
                            <tbody>
                              {matchedDemoRows.map((row, i) => (
                                <tr key={row.id}>
                                  <td>{i + 1}</td>
                                  {listColumns.map(c => (
                                    <td key={c} title={String((row as Record<string, string>)[c] ?? '')}>
                                      {(row as Record<string, string>)[c] ?? '未填报'}
                                    </td>
                                  ))}
                                  <td>
                                    <Button
                                      size="small"
                                      type="link"
                                      onClick={() =>
                                        navigate(
                                          systemPath(
                                            'coordination',
                                            new URLSearchParams({
                                              page: 'E02',
                                              event: row.id,
                                            }).toString(),
                                          ),
                                        )
                                      }
                                    >
                                      处置响应
                                    </Button>
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        ) : (
                          <div className="axn-os-empty">
                            {Object.values(applied).some(Boolean)
                              ? '暂无匹配记录，请调整查询条件'
                              : '暂无本次业务记录'}
                            <small>历史截图中的数量及人员信息不作为当前事件数据</small>
                          </div>
                        )}
                      </div>
                    </>
                  ) : (
                    <>
                      <div className="axn-os-list-tools">
                        <span>栏目字段（规格对齐）</span>
                        <Space wrap>
                          {listColumns.slice(0, 12).map(c => (
                            <Tag key={c}>{c}</Tag>
                          ))}
                          {listColumns.length > 12 ? (
                            <Tag>+{listColumns.length - 12}</Tag>
                          ) : null}
                        </Space>
                      </div>
                      <Alert
                        type="info"
                        showIcon
                        style={{ marginTop: 8 }}
                        title={`${sys.title} · ${page.title}`}
                        description="本地草稿与正式审批未在本演示页开通完整表单；安小能生成的材料见下方「关联材料」接收区。可切换「原系统截图」对照实施材料界面。"
                      />
                    </>
                  )}
                </>
              )}

              <Card
                className="axn-os-materials"
                title={`${page.title} · 关联材料（安小能联动）`}
                size="small"
              >
                <Table
                  rowKey="id"
                  pagination={{ pageSize: 8 }}
                  scroll={{ x: 950 }}
                  dataSource={rows}
                  locale={{ emptyText: <Empty description="暂无安小能传入本栏目的材料" /> }}
                  columns={[
                    { title: '材料标题', width: 200, dataIndex: 'title' },
                    { title: '来源对象', width: 240, dataIndex: 'sourceId' },
                    { title: '生成时间', width: 210, dataIndex: 'createdAt' },
                    {
                      title: '状态',
                      width: 180,
                      render: (_, r) => (
                        <Tag color={r.receivedAt ? 'blue' : 'orange'}>
                          {r.receivedAt ? '已接收 · 待审核' : 'AI材料 · 待接收'}
                        </Tag>
                      ),
                    },
                    {
                      title: '操作',
                      width: 120,
                      render: (_, r) => (
                        <Button onClick={() => open(system, pageId, r.id)}>查看材料</Button>
                      ),
                    },
                  ]}
                />
              </Card>

              {selected ? (
                <Card
                  title={selected.title}
                  style={{ marginTop: 16 }}
                  extra={<Tag>{selected.receivedAt ? '已接收（模拟）' : '待人工接收'}</Tag>}
                  className="axn-os-material-body"
                >
                  <Descriptions
                    size="small"
                    column={1}
                    items={[
                      {
                        key: 'event',
                        label: '关联事件',
                        children: eventDisplayName(selected.eventId),
                      },
                      { key: 'source', label: '来源对象', children: selected.sourceId },
                      { key: 'id', label: '材料编号', children: selected.id },
                      {
                        key: 'target',
                        label: '接收系统',
                        children: `${sys.title} / ${page.title}`,
                      },
                    ]}
                  />
                  {selected.sections.map(([heading, body], i) => (
                    <section key={i}>
                      <Typography.Title level={5}>{heading}</Typography.Title>
                      <Typography.Paragraph>{body}</Typography.Paragraph>
                    </section>
                  ))}
                  <Button
                    type="primary"
                    disabled={!!selected.receivedAt}
                    onClick={() => {
                      try {
                        receiveOriginalMaterial(selected.id, eventId, system, pageId);
                        setRevision(r => r + 1);
                        message.success(
                          `已接收至「${sys.title} · ${page.title}」（模拟）· 待业务岗位审核`,
                        );
                      } catch (e) {
                        message.error(e instanceof Error ? e.message : '接收失败');
                      }
                    }}
                  >
                    {selected.receivedAt ? '已接收 · 待审核' : '确认接收至此栏目（模拟）'}
                  </Button>
                </Card>
              ) : (
                <Empty style={{ marginTop: 24 }} description="选择上方关联材料查看正文" />
              )}
            </>
          )}

          <details className="axn-os-req">
            <summary>业务要求与依据</summary>
            <p>{page.description || '详见产品功能与开发设计规格对应章节。'}</p>
            {(page.dataSections ?? []).map(section => (
              <dl key={section.title} className="axn-os-facts" style={{ marginTop: 8 }}>
                <dt>{section.title}</dt>
                <dd>
                  {section.fields.join('、')}
                  <br />
                  {section.note}
                </dd>
              </dl>
            ))}
            <small>
              依据：{sys.title}产品功能与开发设计规格
              {page.number ? ` · ${page.number}` : ''}。本地演示未接入正式业务接口。
            </small>
          </details>
        </section>
      </main>
    </div>
  );
}
