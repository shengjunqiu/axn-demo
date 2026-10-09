import { useMemo, useState } from 'react';
import { Alert, Button, Card, Empty, Input, Segmented, Space, Table, Tabs, Tag, Typography } from 'antd';
import { Search } from 'lucide-react';
import { SKILL_AGENTS, SKILL_GOVERNANCE, SKILL_PLANS, type SkillOwner, type SkillPlan } from '@/seed/skillPlanning';
import {
  FLOW_SCENARIO_RAIL,
  ownersForFlowScenario,
  type FlowScenarioKey,
} from '@/services/flowStageConfig';
import SkillDetailDrawer from './SkillDetailDrawer';
import SkillRuntimeDemo from './SkillRuntimeDemo';
import './skills.css';

type ScenarioFilter = FlowScenarioKey | 'all';

export default function SkillPlanningPage() {
  const [scenarioFilter, setScenarioFilter] = useState<ScenarioFilter>('all');
  const [owner, setOwner] = useState<SkillOwner>('situation');
  const [query, setQuery] = useState('');
  const [status, setStatus] = useState('全部');
  const [selected, setSelected] = useState<SkillPlan | null>(null);
  const visibleOwners = useMemo(() => ownersForFlowScenario(scenarioFilter), [scenarioFilter]);
  const agent = SKILL_AGENTS.find(a => a.id === owner)!;
  const skills = useMemo(() => SKILL_PLANS.filter(s => s.owner === owner && (status === '全部' || s.status === status) && `${s.name} ${s.input} ${s.output}`.includes(query.trim())), [owner, query, status]);

  const selectScenarioFilter = (next: ScenarioFilter) => {
    setScenarioFilter(next);
    const owners = ownersForFlowScenario(next);
    if (!owners.includes(owner)) setOwner(owners[0]);
  };

  return <div className="axn-np-section axn-skills-page" data-testid="agents-page">
    <div className="axn-skills-heading"><div><Typography.Title level={4}>智能体与 Skill</Typography.Title><Typography.Text type="secondary">从业务建设规划到能力契约，查看每项能力的输入、输出与人工确认边界。</Typography.Text></div><Tag color="orange">模拟原型</Tag></div>
    <Alert type="info" showIcon title={`四类业务智能体 · 两类共用支撑 · ${SKILL_PLANS.length} 项规划能力`} description="业务工作仍从智能助理发起。本地模拟仅说明已有对应演示；真实模型、外部接口及平台治理能力仍需建设或联调。" />
    <Tabs defaultActiveKey="catalog" destroyOnHidden items={[
      {key:'runtime',label:'能力调用演示',children:<SkillRuntimeDemo/>},
      { key: 'catalog', label: '建设能力目录', children: <>
        <div data-testid="skills-scenario-rail" style={{ marginBottom: 12 }}>
          <Segmented
            aria-label="按建设场景筛选智能体"
            value={scenarioFilter}
            onChange={(v) => selectScenarioFilter(v as ScenarioFilter)}
            options={[
              { label: '全部', value: 'all' },
              ...FLOW_SCENARIO_RAIL.map((s) => ({ label: s.label, value: s.id })),
              { label: '共用支撑', value: 'support' },
            ]}
          />
        </div>
        <div className="axn-skills-agents">{SKILL_AGENTS.filter(a => visibleOwners.includes(a.id)).map(a => <Button key={a.id} className="axn-skills-agent" type={owner === a.id ? 'primary' : 'default'} onClick={() => setOwner(a.id)} aria-pressed={owner === a.id}><span>{a.name}</span><small>{a.scene} · {SKILL_PLANS.filter(s => s.owner === a.id).length} 项</small></Button>)}</div>
        <Card size="small" className="axn-skills-intro"><Typography.Text strong>{agent.name}</Typography.Text><p>{agent.role}</p><Typography.Text type="secondary">人工责任门：{agent.gate}</Typography.Text></Card>
        <div className="axn-skills-filters"><Input aria-label="搜索 Skill" placeholder="搜索能力、输入或输出" prefix={<Search size={16} />} value={query} onChange={e => setQuery(e.target.value)} allowClear /><Segmented aria-label="能力状态筛选" options={['全部', '本地模拟', '待建设']} value={status} onChange={v => setStatus(String(v))} /></div>
        <Table<SkillPlan> rowKey="id" dataSource={skills} size="middle" pagination={false} scroll={{ x: 720 }} locale={{ emptyText: <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="没有匹配能力，请调整关键词或状态" /> }} columns={[
          { title: '专属 Skill', dataIndex: 'name', width: 175, render: (_, s) => <Button type="link" className="axn-skills-link" onClick={() => setSelected(s)}>{s.name}</Button> },
          { title: '层次', dataIndex: 'phase', width: 70 },
          { title: '输入 → 输出', key: 'io', render: (_, s) => <div className="axn-skills-io"><span>{s.input}</span><Typography.Text type="secondary">→ {s.output}</Typography.Text></div> },
          { title: '当前状态', dataIndex: 'status', width: 110, render: value => <Tag color={value === '本地模拟' ? 'blue' : 'orange'}>{value}</Tag> },
          { title: '契约', key: 'detail', width: 85, render: (_, s) => <Button size="small" onClick={() => setSelected(s)}>查看详情</Button> },
        ]} />
      </> },
      { key: 'governance', label: '共用运行规范', children: <div className="axn-skills-governance">{SKILL_GOVERNANCE.map(g => <Card key={g.title} size="small" title={g.title} extra={<Tag>{g.state}</Tag>}><p>{g.desc}</p></Card>)}<Alert type="warning" showIcon title="平台协同建设边界" description="注册目录、鉴权、灰度回滚与服务级弱网探测由统一平台协同建设，业务智能体提供契约、测试样例和降级返回。原型不宣称这些服务已完成。" /></div> },
      { key: 'roadmap', label: '建设与验收路径', children: <Space orientation="vertical" size={16} className="axn-skills-roadmap">{[
        ['1. 业务契约确认', '确认每项能力的输入、输出、来源、责任岗位和原系统办理位置；形成可评审契约。'],
        ['2. 数据与平台联调', '接入授权台账、监测、预案与视觉/路线服务；校验事件隔离、版本和权限。'],
        ['3. 闭环验证', '以感知 → 决策建议 → 人工确认 → 执行回执验证业务链；测试缺项、超时和拒绝访问。'],
        ['4. 试运行与迭代', '核对 Trace、引用、灰度回退和统一降级；专业指标经业务评审与试点标定后纳入验收。'],
      ].map(([title, desc]) => <Card size="small" key={title} title={title}><p>{desc}</p></Card>)}<Typography.Text type="secondary">上述为依据产品文档整理的建设顺序，不表示已完成的里程碑或合同验收承诺。</Typography.Text></Space> },
    ]} />
    <SkillDetailDrawer skill={selected} onClose={() => setSelected(null)} />
  </div>;
}
