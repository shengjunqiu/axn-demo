/**
 * 一级导航对应的业务页面（需求七）：应急项目 / 智能体与 Skill / 定时任务 / 知识库。
 * 轻量展示页：企业级浅色卡片，全部数据为模拟数据。
 */
import { Presentation } from 'lucide-react';
import { Button, Card, Space, Tag, Typography } from 'antd';
import { useNavigate } from 'react-router-dom';
import { NAV_PATH } from './navRoutes';
import type { NavPage } from '@/domain/types';
import { useConversationStore } from '@/store/conversationStore';
import PageHeader from '@/components/common/PageHeader';
import SkillsPage from './SkillsPage';
import MyFilesPage from './MyFilesPage';
import SchedulesPage from './SchedulesPage';
import KnowledgeModule from '@/components/knowledge/KnowledgeModule';
import { AGENT_INVITATIONS } from '@/seed/agentInvitations';
import { agentIcon } from '@/components/chat/agentIcons';
import { summonAgentFromManagement } from '@/services/agentConversation';

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
        {PROJECTS.map((p) => (
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

/* ================= 数字专家 ================= */

const AGENT_DESCRIPTIONS: Record<string, string> = {
  'agent-doc': '把现场资料整理成规范文书，支持应急要情、值班日报、周工作动态和工作总结，协助补齐要素并生成草稿。',
  'agent-situation': '汇聚监测与人工补录数据，形成事件态势摘要，标注待核实信息。',
  'agent-resource': '查询周边救援资源，按距离与预计到达排序，维护候选力量池。',
  'agent-plan': '基于态势与资源生成处置建议与依据引用，建议等级需人工确认。',
  'agent-eval': '对比救援目标与实际进展，评估响应时效、人员救助和处置成效，识别剩余风险。',
};

export function AgentsPage() {
  const navigate = useNavigate();
  const summon = (agentId: string) => {
    if (summonAgentFromManagement(agentId)) navigate(NAV_PATH.assistant);
  };

  return (
    <div className="axn-np-section" data-testid="agents-page">
      <PageHeader
        title="应急专家"
        sub="认识你的应急协作伙伴。召唤后开启新对话，再选择需要的任务。"
        extra={<Tag>{AGENT_INVITATIONS.length} 个智能体</Tag>}
      />
      <div className="axn-np-grid axn-agents-grid">
        {AGENT_INVITATIONS.map((agent) => {
          const Icon = agentIcon(agent.agentId);
          return (
            <Card key={agent.agentId} className="axn-agent-card" data-agent-id={agent.agentId}>
              <div className="axn-agent-card-heading">
                <span className="axn-np-icon-tile"><Icon /></span>
                <div className="axn-np-flex-1">
                  <h2 className="axn-np-title-sm">{agent.name}</h2>
                  <div className="axn-np-meta">{agent.role}</div>
                </div>
                <span className="axn-np-status">已接入</span>
              </div>
              <p className="axn-np-desc">{AGENT_DESCRIPTIONS[agent.agentId]}</p>
              <div className="axn-np-label axn-np-fs12">可以帮你</div>
              <Space size={[4, 6]} wrap>
                {agent.options.map(option => <Tag key={option.task}>{option.label}</Tag>)}
              </Space>
              <div className="axn-agent-card-footer">
                <Button type="primary" icon={<Icon size={16} />} aria-label={`召唤${agent.name}`}
                  onClick={() => summon(agent.agentId)}>召唤</Button>
              </div>
            </Card>
          );
        })}
      </div>
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
    case 'skills':
      return <SkillsPage />;
    case 'files':
      return <MyFilesPage />;
    case 'schedules':
      return <SchedulesPage />;
    case 'knowledge':
      return <KnowledgeModule />;
    default:
      return null;
  }
}
