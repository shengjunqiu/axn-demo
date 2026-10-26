/**
 * 聊天标准控件：对话里每一类控件的用途与样式。
 * 预览取自 ChatSpecimens（与真实对话同一套 class / chat.css），保证规范页与产品一致。
 */
import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, BookOpen, FileText, Map as MapIcon, Paperclip, RefreshCw, Send, X } from 'lucide-react';
import { App, Button, Drawer, Empty, Form, Image, Input, Segmented, Timeline, Upload } from 'antd';
import { NAV_PATH } from '@/components/nav/navRoutes';
import PageHeader from '@/components/common/PageHeader';
import { agentIcon } from '@/components/chat/agentIcons';
import {
  AgentMessage, AssistantMessage, ChoiceChips, Cite, Confidence, FileRow, InlineFlag, KvTable, Notice,
  NumberedSteps, Prose, ResourceList, RunBar, Section, SourceList, StatusPill, UserMessage,
} from './ChatSpecimens';
import { ColumnChart, DonutChart, HorizontalBarChart, MetricCards, TrendChart } from './ChatChartSpecimens';
import './chat-controls.css';

const GROUPS = ['全部', '内容展示', '统计图表', '信息反馈', '交互操作'] as const;
type Group = typeof GROUPS[number];
type Control = { id: string; name: string; group: Exclude<Group, '全部'>; description: string; preview: ReactNode };

const DocIcon = agentIcon('agent-doc');
const SOURCES = [
  { title: '堤防工程抢险技术规程', section: '第 4.2 节 · 管涌抢护', excerpt: '发现管涌应立即在出口处抢筑反滤围井，严禁用不透水材料强行堵塞出口。' },
  { title: '现场处置记录', section: '第二节 · 信息核对', excerpt: '现场工作组已完成第一轮信息核对，2 支队伍、36 人进场。' },
];

export default function ChatControlsPage() {
  const { message } = App.useApp();
  const [keyword, setKeyword] = useState('');
  const [group, setGroup] = useState<Group>('全部');
  const [choice, setChoice] = useState('情况报告');
  const [detail, setDetail] = useState<{ kind: 'document' } | { kind: 'source'; index: number } | null>(null);
  const [running, setRunning] = useState(false);
  const [files, setFiles] = useState([{ name: '现场情况.docx', size: '24 KB' }]);
  const [form] = Form.useForm<{ unit: string }>();

  const controls: Control[] = [
    {
      id: 'identity', name: '身份标识', group: '内容展示',
      description: '28px 头像列 + 「名称 · 职责」同一行。安小能用品牌标识，智能体用各自的职能图标。',
      preview: <div className="axn-controls-stack">
        <AssistantMessage><div className="axn-agent-summon-head"><span className="axn-agent-summon-name">安小能</span><span className="axn-agent-summon-role">应急智能助手</span></div></AssistantMessage>
        <AgentMessage icon={<DocIcon size={16} />} name="文书生成智能体" role="文书撰写" />
      </div>,
    },
    {
      id: 'user', name: '用户消息', group: '内容展示',
      description: '靠右的浅灰气泡，正文色；主色只留给主操作，不用整块主蓝。',
      preview: <UserMessage>帮我汇总南堤险情的最新情况，并生成一份情况报告。</UserMessage>,
    },
    {
      id: 'text', name: '文本', group: '内容展示',
      description: 'AI 回答不套框，直接平铺；结论加粗前置，正文 15px / 1.75 行高。',
      preview: <Prose>
        <p className="axn-qa-lead">已汇总本次处置进展，两项信息待补充。</p>
        <p>现场排查已完成第一轮，抢险队伍已进场；报送单位与影响范围仍需确认后才能生成正式报告。</p>
      </Prose>,
    },
    {
      id: 'sections', name: '分节内容', group: '内容展示',
      description: '用小标题按「建议动作 / 禁忌 / 上报」分节，段距代替分割线；禁忌类用警示色标题。',
      preview: <Prose>
        <Section title="建议动作">在管涌出口抢筑反滤围井，按「砂—石—土工布」分层铺设。</Section>
        <Section title="禁忌提醒" warn>严禁用不透水材料强行堵塞出口。</Section>
        <Section title="协同上报">每 30 分钟向防指报告一次水位与出水量变化。</Section>
      </Prose>,
    },
    {
      id: 'image', name: '图片展示', group: '内容展示',
      description: '现场照片两列排布、带说明，点击可放大预览并切换。',
      preview: <Image.PreviewGroup>
        <div className="axn-controls-images">
          {[
            { src: '/doc-assets/qinghe-site-1.jpg', caption: '现场抢险作业' },
            { src: '/doc-assets/qinghe-site-2.jpg', caption: '处置方案会商' },
          ].map(item => <figure key={item.src}>
            <Image src={item.src} alt={item.caption} width="100%" />
            <figcaption>{item.caption}</figcaption>
          </figure>)}
        </div>
      </Image.PreviewGroup>,
    },
    {
      id: 'fields', name: '字段摘要', group: '内容展示',
      description: '细线键值表，标签列固定宽度；「建议值 / 待确认」以行内小标记跟在值后，不另起一列。',
      preview: <KvTable rows={[
        { label: '事件地点', value: '清河段 K12+300' },
        { label: '最新水位', value: <>42.3 米<InlineFlag tone="info">建议值</InlineFlag></> },
        { label: '影响范围', value: <>下游 2 个村<InlineFlag tone="warn">待确认</InlineFlag></> },
        { label: '接报时间', value: '2026-09-28 20:18' },
      ]} foot="数据来源：现场接报记录、监测台账" />,
    },
    {
      id: 'resources', name: '资源清单', group: '内容展示',
      description: '同类记录一行一项：图标 · 名称 / 类型 · 关键参数，右侧对齐到达时间与距离。替代通用表格。',
      preview: <ResourceList
        summary={{ label: '查询结果', value: '2 支队伍 · 1 处仓库' }}
        items={[
          { name: '清河抢险突击队', kind: 'team', meta: '人员 24 · 挖掘机 2', eta: '18 分钟', dist: '6.2 公里' },
          { name: '城东应急救援队', kind: 'team', meta: '人员 12 · 挖掘机 1', eta: '32 分钟', dist: '11.5 公里' },
          { name: '河东防汛物资库', kind: 'store', meta: '编织袋 · 库存 8000 条' },
        ]}
        actions={<Button size="small" icon={<MapIcon size={14} />}>查看资源与态势</Button>}
      />,
    },
    {
      id: 'steps', name: '编号步骤', group: '内容展示',
      description: '处置建议、方案类内容用编号步骤，标题加粗、说明次级色。',
      preview: <NumberedSteps
        summary={{ label: '处置建议', value: '已生成（版本 1 · 待人工审核）' }}
        items={[
          { title: '抢筑反滤围井', text: '突击队携砂石料先期到场，控制管涌出口。' },
          { title: '加密水位监测', text: '每 30 分钟回报一次，超 42.5 米启动转移预案。' },
        ]}
        actions={<Button size="small" icon={<BookOpen size={14} />}>查看建议与知识</Button>}
      />,
    },
    {
      id: 'artifact', name: '产物条目', group: '内容展示',
      description: '文书等产物收成一行文件条：图标 · 名称 · 说明，右侧唯一的查看入口。',
      preview: <FileRow name="清河段堤防险情情况报告" sub="情况报告 · 草稿 · 09:32"
        action={<Button size="small" type="primary" icon={<ArrowUpRight size={14} />} onClick={() => setDetail({ kind: 'document' })}>查看文书</Button>} />,
    },
    {
      id: 'attachment', name: '附件条目', group: '内容展示',
      description: '与产物条目同一外形，展示文件名、大小，可移除。仅在本页展示，不上传。',
      preview: <div className="axn-controls-stack">
        {files.map(f => <FileRow key={f.name} icon={<Paperclip size={16} />} name={f.name} sub={f.size}
          action={<Button size="small" type="text" aria-label={`移除 ${f.name}`} icon={<X size={14} />} onClick={() => setFiles(list => list.filter(x => x.name !== f.name))} />} />)}
        <Upload multiple showUploadList={false} beforeUpload={file => { setFiles(list => [...list, { name: file.name, size: `${Math.max(1, Math.round(file.size / 1024))} KB` }]); return false; }}>
          <Button size="small" icon={<Paperclip size={14} />}>选择示例附件</Button>
        </Upload>
      </div>,
    },
    {
      id: 'source', name: '来源引用', group: '内容展示',
      description: '正文用 [1][2] 角标，回答末尾列编号来源卡（书名 · 章节 · 原文摘录），点开看原文。',
      preview: <Prose>
        <p>发现管涌应立即抢筑反滤围井<Cite n={1} />，现场已有 2 支队伍进场<Cite n={2} />。</p>
        <SourceList sources={SOURCES} onOpen={index => setDetail({ kind: 'source', index })} />
      </Prose>,
    },
    {
      id: 'metrics', name: '指标卡', group: '统计图表',
      description: '突出关键数值、单位和变化说明，用于汇总人员、装备、转移人数等核心指标。',
      preview: <MetricCards />,
    },
    {
      id: 'line-chart', name: '折线图', group: '统计图表',
      description: '展示随时间变化的趋势，支持切换时间范围；悬停或聚焦数据点查看具体数值。',
      preview: <TrendChart />,
    },
    {
      id: 'column-chart', name: '柱状图', group: '统计图表',
      description: '比较不同区域、队伍或类别的数量，保留零基线和数值标注，便于直观对比。',
      preview: <ColumnChart title="各区域救援力量" unit="人" data={[
        { label: '城东', value: 24 }, { label: '清河', value: 36 }, { label: '河西', value: 18 }, { label: '南堤', value: 30 },
      ]} />,
    },
    {
      id: 'donut-chart', name: '环形图', group: '统计图表',
      description: '展示少量类别的构成占比，中心显示总量，图例同时列出数量和比例。',
      preview: <DonutChart title="救援资源构成" unit="项" data={[
        { label: '救援队伍', value: 12 }, { label: '救援装备', value: 18 }, { label: '物资仓库', value: 6 },
      ]} />,
    },
    {
      id: 'bar-chart', name: '横向条形图', group: '统计图表',
      description: '适合标签较长的项目对比，统一量程；示例展示各项处置任务的完成率。',
      preview: <HorizontalBarChart title="处置任务完成率" data={[
        { label: '现场排查', value: 100 }, { label: '群众转移', value: 90 }, { label: '围井抢筑', value: 75 }, { label: '物资调配', value: 60 },
      ]} />,
    },
    {
      id: 'status', name: '状态', group: '信息反馈',
      description: '小圆点 + 文字的轻量状态，语义色只落在圆点和文字上，不用整块彩色标签。',
      preview: <div className="axn-controls-row">
        <StatusPill tone="busy">执行中</StatusPill>
        <StatusPill tone="warn">待补充</StatusPill>
        <StatusPill tone="ok">已完成</StatusPill>
        <StatusPill tone="warn">部分完成</StatusPill>
        <StatusPill tone="err">执行失败</StatusPill>
        <StatusPill tone="idle">已取消</StatusPill>
      </div>,
    },
    {
      id: 'confidence', name: '置信度', group: '信息反馈',
      description: '知识问答的可信度提示，按高 / 中 / 低给语义色，紧跟在分类后面。',
      preview: <div className="axn-controls-row">
        <Confidence level="high" value={88} /><Confidence level="mid" value={72} /><Confidence level="low" value={41} />
      </div>,
    },
    {
      id: 'progress', name: '任务运行条', group: '信息反馈',
      description: '任务名与步骤信息分行展示，右侧保留状态；窄屏下操作区自动换行，点开查看执行过程。',
      preview: <div className="axn-controls-stack">
        <RunBar title="汇总灾情摘要" status={{ tone: 'busy', label: '执行中' }} defaultOpen steps={[
          { name: '读取现场接报', status: 'completed', output: '3 条记录', time: '0.6s' },
          { name: '核对水位与响应等级', status: 'running' },
          { name: '生成摘要', status: 'pending' },
        ]} />
        <RunBar title="查询可调派资源" status={{ tone: 'ok', label: '已完成' }} meta="2.4s" steps={[
          { name: '定位事件', status: 'completed' }, { name: '检索队伍与仓库', status: 'completed' }, { name: '按到达时间排序', status: 'completed' },
        ]} />
      </div>,
    },
    {
      id: 'notice', name: '提示信息', group: '信息反馈',
      description: '一行图标 + 标题（可带一句说明），按信息 / 成功 / 警告 / 错误区分，不用整块色底。',
      preview: <div className="axn-controls-stack">
        <Notice tone="info" title="已收到补充材料" />
        <Notice tone="ok" title="要素核对完成" />
        <Notice tone="warn" title="报送单位待确认">确认后才能生成正式报告。</Notice>
        <Notice tone="err" title="监测接口连接超时">已保留上一轮数据，可重试。</Notice>
      </div>,
    },
    {
      id: 'actions', name: '操作按钮', group: '交互操作',
      description: '结果卡底部的操作栏；一处只放一个主按钮，其余为次按钮。',
      preview: <KvTable rows={[{ label: '任务', value: '生成情况报告' }]} actions={<>
        <Button type="primary" size="small" icon={<FileText size={14} />} onClick={() => setDetail({ kind: 'document' })}>查看文书</Button>
        <Button size="small" icon={<RefreshCw size={14} />} loading={running} onClick={() => { setRunning(true); message.info('示例任务执行中，可点击取消'); }}>重试</Button>
        <Button size="small" disabled={!running} onClick={() => { setRunning(false); message.info('示例任务已取消'); }}>取消</Button>
      </>} />,
    },
    {
      id: 'choices', name: '选项按钮', group: '交互操作',
      description: '让用户在几项中选一项，选中项描边 + 浅底，不用分段控件。',
      preview: <div className="axn-controls-stack">
        <ChoiceChips options={['情况报告', '工作总结', '周工作动态']} value={choice} onChange={setChoice} />
        <span className="axn-controls-meta">当前选择：{choice}</span>
      </div>,
    },
    {
      id: 'input', name: '信息输入', group: '交互操作',
      description: '智能体需要补充信息时，在消息内收集，提示与校验就近显示。',
      preview: <Form form={form} layout="vertical" className="axn-controls-form" onFinish={values => { message.success(`示例已提交：${values.unit.trim()}`); }}>
        <Form.Item name="unit" label="报送单位" rules={[{ required: true, whitespace: true, message: '请输入报送单位' }]}>
          <Input placeholder="例如：南堤现场工作组" maxLength={60} />
        </Form.Item>
        <Button htmlType="submit" type="primary" icon={<Send size={14} />} size="small">提交</Button>
      </Form>,
    },
    {
      id: 'timeline', name: '时间轴', group: '内容展示',
      description: '使用 Ant Design Timeline 按时间先后展示事件进展。时间、节点名称与简短说明分层呈现；绿色表示已完成，蓝色表示当前进展，灰色表示后续安排。',
      preview: <Timeline className="axn-controls-timeline" items={[
        { color: 'green', title: '08:30', content: <><strong>接报核实</strong><p>收到险情报告，核对事发位置与受影响人员。</p></> },
        { color: 'green', title: '09:00', content: <><strong>力量出动</strong><p>先遣组携侦测装备出发，沿途核实通行条件。</p></> },
        { color: 'blue', title: '09:40', content: <><strong>现场处置</strong><p>队伍已到场，正在排查隐患并开展救援。</p></> },
        { color: 'gray', title: '后续安排', content: <><strong>撤收与复盘</strong><p>任务结束后核对人装物资，整理处置成效。</p></> },
      ]} />,
    },
  ];

  const query = keyword.trim().toLowerCase();
  const visible = controls.filter(control =>
    (group === '全部' || control.group === group)
    && (!query || [control.name, control.description].join(' ').toLowerCase().includes(query)),
  );
  const source = detail?.kind === 'source' ? SOURCES[detail.index] : null;

  return (
    <section className="axn-controls-page" aria-label="聊天标准控件展示">
      <nav className="axn-controls-page-nav"><Link to={NAV_PATH.assistant}>← 返回智能助理</Link></nav>
      <PageHeader
        title="聊天标准控件"
        sub={`对话中可用的 ${controls.length} 类控件，样式与智能助理一致。`}
        extra={<Link to={NAV_PATH.controlExamples}><Button icon={<ArrowUpRight size={15} />}>查看气泡用例</Button></Link>}
      />
      <div className="axn-controls-toolbar">
        <Segmented aria-label="控件分类" options={[...GROUPS]} value={group} onChange={setGroup} />
        <Input.Search aria-label="搜索标准控件" placeholder="搜索控件名称或用途" allowClear value={keyword} onChange={event => setKeyword(event.target.value)} />
      </div>
      <div className="axn-controls-grid">
        {visible.map(control => (
          <article key={control.id} className="axn-controls-card" aria-label={control.name}>
            <header className="axn-controls-card-head">
              <span className="axn-controls-number">{String(controls.indexOf(control) + 1).padStart(2, '0')}</span>
              <h3>{control.name}</h3>
              <span className="axn-controls-group">{control.group}</span>
            </header>
            <p className="axn-controls-description">{control.description}</p>
            <div className="axn-controls-preview">{control.preview}</div>
          </article>
        ))}
      </div>
      {visible.length === 0 && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="未找到匹配的控件，请更换关键词或分类。" />}
      <Drawer title={source ? '依据原文' : '文书预览'} open={detail !== null} onClose={() => setDetail(null)} size={440}>
        {source
          ? <div className="axn-controls-drawer"><h4>《{source.title}》</h4><span className="axn-controls-meta">{source.section}</span><blockquote>{source.excerpt}</blockquote></div>
          : <div className="axn-controls-drawer"><h4>清河段堤防险情情况报告</h4><span className="axn-controls-meta">情况报告 · 草稿</span><p>一、基本情况：清河段 K12+300 出现管涌险情，现场已开展排查。</p><p>二、处置进展：2 支队伍、36 人进场，反滤围井抢筑中。</p></div>}
      </Drawer>
    </section>
  );
}
