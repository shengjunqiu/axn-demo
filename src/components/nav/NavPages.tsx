/**
 * 一级导航对应的业务页面（需求七）：应急项目 / 智能体与 Skill / 定时任务 / 知识库。
 * 轻量展示页：企业级浅色卡片，全部数据为模拟数据。
 */
import { useMemo, useState } from 'react';
import {
  ApartmentOutlined,
  BookOutlined,
  BulbOutlined,
  ClockCircleOutlined,
  FileProtectOutlined,
  FireOutlined,
  FundProjectionScreenOutlined,
  HeartOutlined,
  SearchOutlined,
  SafetyCertificateOutlined,
  ThunderboltOutlined,
  ToolOutlined,
} from '@ant-design/icons';
import { Alert, Button, Card, Drawer, Empty, Input, Space, Tag, Timeline, Typography } from 'antd';
import type { NavPage } from '@/domain/types';
import { useConversationStore } from '@/store/conversationStore';
import { knowledgeChunks } from '@/seed/scenario';

const MOCK_TAG = (
  <Tag color="orange" style={{ fontSize: 12 }}>
    模拟数据
  </Tag>
);

function PageHeader({ title, sub, extra }: { title: string; sub: string; extra?: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, padding: '14px 18px 4px', flexWrap: 'wrap' }}>
      <Typography.Title level={5} style={{ margin: 0, fontSize: 16 }}>
        {title}
      </Typography.Title>
      <Typography.Text type="secondary" style={{ fontSize: 12 }}>
        {sub}
      </Typography.Text>
      <div style={{ marginLeft: 'auto' }}>{extra}</div>
    </div>
  );
}

/* ================= 应急项目 ================= */

interface ProjectRow {
  projectId: string;
  name: string;
  status: '进行中' | '已归档' | '筹备中';
  updatedAt: string;
  owner: string;
  conversationTitle: string;
  eventId?: string;
  desc: string;
}

const PROJECTS: ProjectRow[] = [
  {
    projectId: 'proj-demo-001',
    name: '清河段堤防险情处置',
    status: '进行中',
    updatedAt: '2026-09-28 10:24',
    owner: '指挥员',
    conversationTitle: '南堤堤防管涌险情',
    eventId: 'evt-demo-001',
    desc: '堤防管涌险情研判、资源预置与处置跟踪（虚构模拟项目）',
  },
  {
    projectId: 'proj-demo-002',
    name: '城镇内涝防御响应',
    status: '进行中',
    updatedAt: '2026-09-28 09:56',
    owner: '值班员',
    conversationTitle: '漳河镇水位上涨预警',
    eventId: 'evt-demo-002',
    desc: '下穿道路积水预警与防御调度（虚构模拟项目）',
  },
  {
    projectId: 'proj-demo-003',
    name: '汛期值班保障专项',
    status: '筹备中',
    updatedAt: '2026-09-27 17:05',
    owner: '值班员',
    conversationTitle: '防汛资源调度',
    eventId: 'evt-demo-001',
    desc: '值班安排、日报整理与资源状态检查（虚构模拟项目）',
  },
];

export function ProjectsPage() {
  const createConversation = useConversationStore((s) => s.createConversation);
  const conversations = useConversationStore((s) => s.conversations);
  const selectConversation = useConversationStore((s) => s.selectConversation);
  const setActiveNav = useConversationStore((s) => s.setActiveNav);

  const enterWorkspace = (project: ProjectRow) => {
    // 优先进入项目关联的既有会话；不存在则新建
    const existing = Object.values(conversations).find((c) => c.title === project.conversationTitle);
    if (existing) {
      selectConversation(existing.id);
    } else {
      createConversation({
        title: project.conversationTitle,
        type: 'emergency',
        eventId: project.eventId,
        summary: `${project.name} · 项目会话`,
      });
    }
    setActiveNav('assistant');
  };

  return (
    <div style={{ padding: '6px 18px 18px' }} data-testid="projects-page">
      <PageHeader title="应急项目" sub="项目为业务组织维度；进入工作台后继续在智能助理中操作" extra={MOCK_TAG} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10, maxWidth: 860 }}>
        {PROJECTS.map((p) => (
          <Card key={p.projectId} size="small" styles={{ body: { display: 'flex', alignItems: 'center', gap: 14 } }}>
            <FundProjectionScreenOutlined style={{ fontSize: 22, color: '#1d6ff2', flexShrink: 0 }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Typography.Text strong style={{ fontSize: 14 }}>
                  {p.name}
                </Typography.Text>
                <Tag color={p.status === '进行中' ? 'processing' : p.status === '筹备中' ? 'default' : 'success'}>
                  {p.status}
                </Tag>
              </div>
              <div style={{ fontSize: 12, color: '#8a94a6', marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {p.desc}
              </div>
              <div style={{ fontSize: 12, color: '#a0a8b8', marginTop: 2 }}>
                更新 {p.updatedAt} · 负责人 {p.owner} · 关联会话「{p.conversationTitle}」
              </div>
            </div>
            <Button type="primary" ghost onClick={() => enterWorkspace(p)}>
              进入工作台
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ================= 智能体与 Skill ================= */

interface AgentCard {
  agentId: string;
  name: string;
  icon: React.ReactNode;
  desc: string;
  tasks: string[];
  skills: string[];
  status: '已接入（模拟）' | '规划中';
}

const AGENTS: AgentCard[] = [
  {
    agentId: 'agent-situation',
    name: '态势感知智能体',
    icon: <FireOutlined />,
    desc: '汇聚监测与人工补录数据，形成事件态势摘要，标注待核实信息。',
    tasks: ['生成灾情摘要', '水位变化跟踪', '影响范围梳理'],
    skills: ['灾情摘要生成', '数据待核实标注'],
    status: '已接入（模拟）',
  },
  {
    agentId: 'agent-resource',
    name: '资源管理智能体',
    icon: <ToolOutlined />,
    desc: '查询周边救援资源，按距离/预计到达排序，维护候选力量池。',
    tasks: ['查询周边救援资源', '候选力量增删', '资源汇总统计'],
    skills: ['资源检索', 'ETA 排序问答', '派生汇总'],
    status: '已接入（模拟）',
  },
  {
    agentId: 'agent-plan',
    name: '救援方案生成智能体',
    icon: <BulbOutlined />,
    desc: '基于态势与资源生成处置建议与依据引用，建议等级需人工确认。',
    tasks: ['形成处置建议', '预置力量方案', '风险提示'],
    skills: ['建议生成', '知识引用', '建议等级标注'],
    status: '已接入（模拟）',
  },
  {
    agentId: 'agent-doc',
    name: '文书生成智能体',
    icon: <FileProtectOutlined />,
    desc: '按模板生成应急要情/值班日报草稿，支持事实绑定与来源溯源。',
    tasks: ['生成应急要情', '生成值班日报', '缺项补录'],
    skills: ['模板填充', '事实芯片', '来源锚点'],
    status: '已接入（模拟）',
  },
  {
    agentId: 'agent-eval',
    name: '效果评估智能体',
    icon: <SafetyCertificateOutlined />,
    desc: '对比救援目标与实际进展，评估响应时效、人员救助和处置成效，识别剩余风险。',
    tasks: ['评估救援效果', '阶段成效复盘', '改进建议'],
    skills: ['目标完成率分析', '响应时效评估', '剩余风险识别'],
    status: '已接入（模拟）',
  },
];

export function AgentsPage() {
  return (
    <div style={{ padding: '6px 18px 18px' }} data-testid="agents-page">
      <PageHeader
        title="智能体与 Skill"
        sub="能力展示页；智能助理已默认协同以上能力，无需手动选择即可直接工作"
        extra={MOCK_TAG}
      />
      <Alert
        style={{ margin: '8px 0 12px', maxWidth: 860 }}
        type="info"
        showIcon
        message="以下智能体能力已内置于智能助理工作流（模拟实现），此处仅展示能力说明，不作为使用前置条件。"
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(330px, 1fr))', gap: 12, maxWidth: 1100 }}>
        {AGENTS.map((a) => (
          <Card key={a.agentId} size="small" title={<Space size={8}>{a.icon}<span>{a.name}</span></Space>} extra={<Tag color={a.status === '规划中' ? 'default' : 'geekblue'}>{a.status}</Tag>}>
            <div style={{ fontSize: 12.5, color: '#4a5568', lineHeight: 1.6 }}>{a.desc}</div>
            <div style={{ marginTop: 10, fontSize: 12 }}>
              <div style={{ color: '#8a94a6', marginBottom: 4 }}>典型任务</div>
              <Space size={4} wrap>
                {a.tasks.map((t) => (
                  <Tag key={t} style={{ fontSize: 12 }}>
                    {t}
                  </Tag>
                ))}
              </Space>
            </div>
            <div style={{ marginTop: 8, fontSize: 12 }}>
              <div style={{ color: '#8a94a6', marginBottom: 4 }}>示例 Skill</div>
              <Space size={4} wrap>
                {a.skills.map((s) => (
                  <Tag key={s} color="blue" style={{ fontSize: 12 }}>
                    {s}
                  </Tag>
                ))}
              </Space>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ================= 定时任务 ================= */

interface ScheduleRow {
  scheduleId: string;
  name: string;
  cron: string;
  desc: string;
  lastRun: string;
  status: '运行中（模拟）' | '已暂停';
}

const SCHEDULES: ScheduleRow[] = [
  { scheduleId: 'sched-daily', name: '每日值班日报', cron: '每天 08:00', desc: '生成当日值班日报草稿并推送待补录提醒（模拟）', lastRun: '2026-09-28 08:00', status: '运行中（模拟）' },
  { scheduleId: 'sched-patrol', name: '防汛监测巡检', cron: '每 2 小时', desc: '巡检水位监测数据并标记异常（模拟）', lastRun: '2026-09-28 20:00', status: '运行中（模拟）' },
  { scheduleId: 'sched-resource', name: '资源状态检查', cron: '每天 07:30', desc: '检查救援队伍与装备状态并更新可用性（模拟）', lastRun: '2026-09-28 07:30', status: '已暂停' },
];

export function SchedulesPage() {
  return (
    <div style={{ padding: '6px 18px 18px' }} data-testid="schedules-page">
      <PageHeader title="定时任务" sub="模拟环境中的定时任务，不执行真实调度" extra={MOCK_TAG} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10, maxWidth: 860 }}>
        {SCHEDULES.map((s) => (
          <Card key={s.scheduleId} size="small" styles={{ body: { display: 'flex', alignItems: 'center', gap: 14 } }}>
            <ClockCircleOutlined style={{ fontSize: 20, color: '#1d6ff2' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <Space size={8}>
                <Typography.Text strong style={{ fontSize: 13.5 }}>
                  {s.name}
                </Typography.Text>
                <Tag>{s.cron}</Tag>
                <Tag color={s.status === '已暂停' ? 'default' : 'success'}>{s.status}</Tag>
              </Space>
              <div style={{ fontSize: 12, color: '#8a94a6', marginTop: 2 }}>{s.desc}</div>
            </div>
            <Typography.Text type="secondary" style={{ fontSize: 12, flexShrink: 0 }}>
              上次 {s.lastRun}
            </Typography.Text>
          </Card>
        ))}
      </div>
    </div>
  );
}

/* ================= 知识库 ================= */

interface KnowledgeLibrary {
  libraryId: string;
  name: string;
  icon: React.ReactNode;
  desc: string;
  count: number;
}

const LIBRARIES: KnowledgeLibrary[] = [
  { libraryId: 'lib-plan', name: '预案库', icon: <FileProtectOutlined />, desc: '应急预案与处置流程文档', count: 12 },
  { libraryId: 'lib-law', name: '法规规范库', icon: <BookOutlined />, desc: '相关法规、规程与标准条目', count: 8 },
  { libraryId: 'lib-case', name: '历史案例库', icon: <ApartmentOutlined />, desc: '历史事件处置案例与复盘', count: 15 },
  { libraryId: 'lib-tactic', name: '救援技战法', icon: <ThunderboltOutlined />, desc: '典型场景技战法与操作要点', count: 10 },
  { libraryId: 'lib-equipment', name: '装备知识库', icon: <ToolOutlined />, desc: '救援装备参数与使用要点', count: 22 },
  { libraryId: 'lib-team', name: '队伍能力库', icon: <HeartOutlined />, desc: '救援队伍能力档案与擅长场景', count: 6 },
];

export function KnowledgePage() {
  const [keyword, setKeyword] = useState('');
  const [detail, setDetail] = useState<KnowledgeLibrary | null>(null);

  const filteredLibs = useMemo(
    () => LIBRARIES.filter((l) => !keyword.trim() || l.name.includes(keyword.trim()) || l.desc.includes(keyword.trim())),
    [keyword],
  );

  return (
    <div style={{ padding: '6px 18px 18px' }} data-testid="knowledge-page">
      <PageHeader
        title="知识库"
        sub="六大知识库视图；详情引用本种子知识包"
        extra={
          <Space>
            <Input
              allowClear
              size="small"
              prefix={<SearchOutlined style={{ color: '#a0a8b8' }} />}
              placeholder="搜索知识库"
              style={{ width: 220 }}
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              data-testid="knowledge-search"
            />
            {MOCK_TAG}
          </Space>
        }
      />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12, marginTop: 10, maxWidth: 1100 }}>
        {filteredLibs.map((lib) => (
          <Card
            key={lib.libraryId}
            size="small"
            hoverable
            onClick={() => setDetail(lib)}
            styles={{ body: { display: 'flex', gap: 12, alignItems: 'flex-start' } }}
          >
            <div style={{ fontSize: 20, color: '#1d6ff2', marginTop: 2 }}>{lib.icon}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Typography.Text strong style={{ fontSize: 13.5 }}>
                  {lib.name}
                </Typography.Text>
                <Tag style={{ fontSize: 12 }}>{lib.count} 条</Tag>
              </div>
              <div style={{ fontSize: 12, color: '#8a94a6', marginTop: 2 }}>{lib.desc}</div>
            </div>
          </Card>
        ))}
        {filteredLibs.length === 0 && (
          <div style={{ gridColumn: '1 / -1' }}>
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`未找到与「${keyword}」匹配的知识库`} />
          </div>
        )}
      </div>

      <Drawer
        title={detail ? `${detail.name} · 详情` : ''}
        width={480}
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <div>
            <Alert type="info" showIcon message="以下条目来自本种子知识包，全部为虚构模拟数据。" style={{ marginBottom: 12 }} />
            <Timeline
              items={knowledgeChunks.map((k) => ({
                color: 'blue',
                children: (
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{k.title}</div>
                    <div style={{ fontSize: 12, color: '#8a94a6', marginTop: 2 }}>{k.content}</div>
                    <div style={{ fontSize: 12, color: '#a0a8b8', marginTop: 2 }}>
                      {k.category} · {k.version} · {k.sourceLabel}
                    </div>
                    <div style={{ fontSize: 12, color: '#d48806', marginTop: 2 }}>{k.notice}</div>
                  </div>
                ),
              }))}
            />
          </div>
        )}
      </Drawer>
    </div>
  );
}

/** 主工作区按导航页分发。 */
export function NavPageContent({ page }: { page: NavPage }) {
  switch (page) {
    case 'projects':
      return <ProjectsPage />;
    case 'agents':
      return <AgentsPage />;
    case 'schedules':
      return <SchedulesPage />;
    case 'knowledge':
      return <KnowledgePage />;
    default:
      return null;
  }
}
