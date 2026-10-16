import { Flame, Lightbulb, ShieldCheck } from 'lucide-react';
import { useCustomerOperations } from '@/store/customerOperationsStore';
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
import { Button, Card, Drawer, Empty, Input, Space, Tag, Timeline, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { NAV_PATH } from './navRoutes';
import type { NavPage } from '@/domain/types';
import { useConversationStore } from '@/store/conversationStore';
import { knowledgeChunks } from '@/seed/scenario';
import PageHeader from '@/components/common/PageHeader';

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
      <PageHeader title="应急项目" sub="项目为业务组织维度；进入工作台后继续在智能助理中操作" />
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

interface AgentCard {
  agentId: string;
  name: string;
  icon: React.ReactNode;
  desc: string;
  tasks: string[];
  skills: string[];
  status: '已接入' | '规划中';
}

const AGENTS: AgentCard[] = [
  {
    agentId: 'agent-situation',
    name: '态势感知智能体',
    icon: <Flame />,
    desc: '汇聚监测与人工补录数据，形成事件态势摘要，标注待核实信息。',
    tasks: ['生成灾情摘要', '水位变化跟踪', '影响范围梳理'],
    skills: ['灾情摘要生成', '数据待核实标注'],
    status: '已接入',
  },
  {
    agentId: 'agent-resource',
    name: '资源管理智能体',
    icon: <Wrench />,
    desc: '查询周边救援资源，按距离/预计到达排序，维护候选力量池。',
    tasks: ['查询周边救援资源', '候选力量增删', '资源汇总统计'],
    skills: ['资源检索', 'ETA 排序问答', '派生汇总'],
    status: '已接入',
  },
  {
    agentId: 'agent-plan',
    name: '救援方案生成智能体',
    icon: <Lightbulb />,
    desc: '基于态势与资源生成处置建议与依据引用，建议等级需人工确认。',
    tasks: ['形成处置建议', '预置力量方案', '风险提示'],
    skills: ['建议生成', '知识引用', '建议等级标注'],
    status: '已接入',
  },
  {
    agentId: 'agent-doc',
    name: '文书生成智能体',
    icon: <FileCheck />,
    desc: '按模板生成应急要情/值班日报草稿，支持事实绑定与来源溯源。',
    tasks: ['生成应急要情', '生成值班日报', '缺项补录'],
    skills: ['模板填充', '事实芯片', '来源锚点'],
    status: '已接入',
  },
  {
    agentId: 'agent-eval',
    name: '效果评估智能体',
    icon: <ShieldCheck />,
    desc: '对比救援目标与实际进展，评估响应时效、人员救助和处置成效，识别剩余风险。',
    tasks: ['评估救援效果', '阶段成效复盘', '改进建议'],
    skills: ['目标完成率分析', '响应时效评估', '剩余风险识别'],
    status: '已接入',
  },
];

export function AgentsPage() {
  return (
    <div className="axn-np-section" data-testid="agents-page">
      <PageHeader
        title="智能体与 Skill"
        sub="智能助理已默认协同以下能力，无需手动选择即可直接工作"
      />
      <div className="axn-np-grid">
        {AGENTS.map((a) => (
          <Card key={a.agentId} size="small" title={<Space size={10}><span className="axn-np-icon-tile">{a.icon}</span><span>{a.name}</span></Space>} extra={<span className={`axn-np-status${a.status === '规划中' ? ' is-idle' : ''}`}>{a.status}</span>}>
            <div className="axn-np-desc">{a.desc}</div>
            <div className="axn-np-mt10 axn-np-fs12">
              <div className="axn-np-label">典型任务</div>
              <Space size={4} wrap>
                {a.tasks.map((t) => (
                  <Tag key={t} className="axn-np-fs12">
                    {t}
                  </Tag>
                ))}
              </Space>
            </div>
            <div className="axn-np-mt8 axn-np-fs12">
              <div className="axn-np-label">示例 Skill</div>
              <Space size={4} wrap>
                {a.skills.map((s) => (
                  <Tag key={s} className="axn-np-fs12 axn-np-skill">
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

export function SchedulesPage() {
  const operations = useCustomerOperations();
  const schedules = operations.rules.map(r => ({ scheduleId: r.id, name: r.name, cron: `每${r.intervalSeconds}秒`, desc: `${r.metric}${r.operator}${r.threshold} → ${r.target}`, lastRun: r.lastRunAt ?? '尚未运行', status: r.enabled ? '页面运行期间启用' : '已暂停' }));
  return (
    <div className="axn-np-section" data-testid="schedules-page">
      <PageHeader title="定时任务" sub="按计划自动执行的值守任务" />
      <div className="axn-np-col">
        {!schedules.length && <Empty description="暂无监测规则（「资源数据与预警」入口已暂时下线）" />}
        {schedules.map((s) => (
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
        sub="六大领域知识，是问答与文书生成的依据来源"
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
            <span className="axn-np-icon-tile">{lib.icon}</span>
            <div className="axn-np-flex-1">
              <div className="axn-np-flex-row">
                <Typography.Text strong className="axn-np-fs14">
                  {lib.name}
                </Typography.Text>
                <span className="axn-np-count">{lib.count} 条</span>
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

      {!keyword.trim() && (
        <section className="axn-np-recent" aria-label="近期被引用的条目">
          <h2 className="axn-np-subhead">近期被引用</h2>
          <ul className="axn-np-recent-list">
            {knowledgeChunks.map((k) => (
              <li key={k.chunkId}>
                <span className="axn-np-recent-title">{k.title}</span>
                <span className="axn-np-recent-meta">{k.category} · {k.version}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <Drawer
        title={detail ? `${detail.name} · 详情` : ''}
        size={480}
        open={!!detail}
        onClose={() => setDetail(null)}
      >
        {detail && (
          <div>
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
