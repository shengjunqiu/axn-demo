/**
 * 一级导航对应的业务页面（需求七）：应急项目 / 智能体与 Skill / 定时任务 / 知识库。
 * 轻量展示页：企业级浅色卡片，全部数据为模拟数据。
 */
import { useMemo, useState } from 'react';
import SkillPlanningPage from '@/components/skills/SkillPlanningPage';
import {
  BookOpen,
  Clock,
  FileCheck,
  Heart,
  Network,
  Presentation,
  Search,
  Wrench,
  Zap,
} from 'lucide-react'
import { Alert, Button, Card, Drawer, Empty, Input, Space, Tag, Timeline, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { NAV_PATH } from './navRoutes';
import type { NavPage } from '@/domain/types';
import { useConversationStore } from '@/store/conversationStore';
import { knowledgeChunks } from '@/seed/scenario';

const MOCK_TAG = (
  <Tag color="orange" className="axn-np-fs12">
    模拟数据
  </Tag>
);

function PageHeader({ title, sub, extra }: { title: string; sub: string; extra?: React.ReactNode }) {
  return (
    <div className="axn-np-header">
      <Typography.Title level={5} className="axn-np-title-sm">
        {title}
      </Typography.Title>
      <Typography.Text type="secondary" className="axn-np-fs12">
        {sub}
      </Typography.Text>
      <div className="axn-np-mla">{extra}</div>
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
  const navigate = useNavigate();

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
    navigate(NAV_PATH.assistant);
  };

  return (
    <div className="axn-np-section" data-testid="projects-page">
      <PageHeader title="应急项目" sub="项目为业务组织维度；进入工作台后继续在智能助理中操作" extra={MOCK_TAG} />
      <div className="axn-np-col">
        {PROJECTS.filter(p => !/值班|值守/.test(p.name)).map((p) => (
          <Card key={p.projectId} size="small" styles={{ body: { display: 'flex', alignItems: 'center', gap: 14 } }}>
            <Presentation className="axn-np-icon-huge" />
            <div className="axn-np-flex-1">
              <div className="axn-np-flex-row">
                <Typography.Text strong className="axn-np-fs14">
                  {p.name}
                </Typography.Text>
                <Tag color={p.status === '进行中' ? 'processing' : p.status === '筹备中' ? 'default' : 'success'}>
                  {p.status}
                </Tag>
              </div>
              <div className="axn-np-meta-nowrap">
                {p.desc}
              </div>
              <div className="axn-np-meta">
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
export { default as AgentsPage } from '@/components/skills/SkillPlanningPage';

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
    <div className="axn-np-section" data-testid="schedules-page">
      <PageHeader title="定时任务" sub="模拟环境中的定时任务，不执行真实调度" extra={MOCK_TAG} />
      <div className="axn-np-col">
        {SCHEDULES.filter(s => !/值班|值守/.test(s.name)).map((s) => (
          <Card key={s.scheduleId} size="small" styles={{ body: { display: 'flex', alignItems: 'center', gap: 14 } }}>
            <Clock className="axn-np-icon-med" />
            <div className="axn-np-flex-1">
              <Space size={8}>
                <Typography.Text strong className="axn-np-fs13">
                  {s.name}
                </Typography.Text>
                <Tag>{s.cron}</Tag>
                <Tag color={s.status === '已暂停' ? 'default' : 'success'}>{s.status}</Tag>
              </Space>
              <div className="axn-np-meta">{s.desc}</div>
            </div>
            <Typography.Text type="secondary" className="axn-np-text-sm">
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
  { libraryId: 'lib-plan', name: '预案库', icon: <FileCheck />, desc: '应急预案与处置流程文档', count: 12 },
  { libraryId: 'lib-law', name: '法规规范库', icon: <BookOpen />, desc: '相关法规、规程与标准条目', count: 8 },
  { libraryId: 'lib-case', name: '典型案例库', icon: <Network />, desc: '中国安能集团抢险救灾典型案例与复盘', count: 15 },
  { libraryId: 'lib-tactic', name: '救援技战法', icon: <Zap />, desc: '典型场景技战法与操作要点', count: 10 },
  { libraryId: 'lib-equipment', name: '装备知识库', icon: <Wrench />, desc: '救援装备参数与使用要点', count: 22 },
  { libraryId: 'lib-team', name: '队伍能力库', icon: <Heart />, desc: '救援队伍能力档案与擅长场景', count: 6 },
];

export function KnowledgePage() {
  const [keyword, setKeyword] = useState('');
  const [detail, setDetail] = useState<KnowledgeLibrary | null>(null);

  const filteredLibs = useMemo(
    () => LIBRARIES.filter((l) => !keyword.trim() || l.name.includes(keyword.trim()) || l.desc.includes(keyword.trim())),
    [keyword],
  );

  return (
    <div className="axn-np-section" data-testid="knowledge-page">
      <PageHeader
        title="知识库"
        sub="六大知识库视图；详情引用本种子知识包"
        extra={
          <Space>
            <Input
              allowClear
              size="small"
              prefix={<Search className="axn-np-icon-gray" />}
              placeholder="搜索知识库"
              className="axn-np-search"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              data-testid="knowledge-search"
            />
            {MOCK_TAG}
          </Space>
        }
      />
      <div className="axn-np-grid-wide">
        {filteredLibs.map((lib) => (
          <Card
            key={lib.libraryId}
            size="small"
            hoverable
            onClick={() => setDetail(lib)}
            styles={{ body: { display: 'flex', gap: 12, alignItems: 'flex-start' } }}
          >
            <div className="axn-np-icon-med-mt">{lib.icon}</div>
            <div className="axn-np-flex-1">
              <div className="axn-np-flex-row">
                <Typography.Text strong className="axn-np-fs13">
                  {lib.name}
                </Typography.Text>
                <Tag className="axn-np-fs12">{lib.count} 条</Tag>
              </div>
              <div className="axn-np-meta">{lib.desc}</div>
            </div>
          </Card>
        ))}
        {filteredLibs.length === 0 && (
          <div className="axn-np-full-span">
            <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={`未找到与「${keyword}」匹配的知识库`} />
          </div>
        )}
      </div>

      <Drawer
        title={detail ? `${detail.name} · 详情` : ''}
        size={480}
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <div>
            <Alert type="info" showIcon title="以下条目来自本种子知识包，全部为虚构模拟数据。" className="axn-np-mb12" />
            <Timeline
              items={knowledgeChunks.map((k) => ({
                color: 'blue',
                children: (
                  <div>
                    <div className="axn-np-k-title">{k.title}</div>
                    <div className="axn-np-meta">{k.content}</div>
                    <div className="axn-np-meta">
                      {k.category} · {k.version} · {k.sourceLabel}
                    </div>
                    <div className="axn-np-k-notice">{k.notice}</div>
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
      return <SkillPlanningPage />;
    case 'schedules':
      return <SchedulesPage />;
    case 'knowledge':
      return <KnowledgePage />;
    default:
      return null;
  }
}
