import { Alert, Descriptions, Drawer, Tag } from 'antd';
import { SKILL_AGENTS, type SkillPlan } from '@/seed/skillPlanning';
import SkillRuntimeDemo from './SkillRuntimeDemo';

export default function SkillDetailDrawer({ skill, onClose }: { skill: SkillPlan | null; onClose: () => void }) {
  return <Drawer title={skill ? `${skill.name} · Skill 详情` : 'Skill 详情'} open={!!skill} onClose={onClose} size={560}>
    {skill && <>
      <Alert type="info" showIcon title="建设契约展示" description="本地模拟表示已有对应演示流程；待建设表示尚未接入。此处不执行真实模型或业务接口。" style={{ marginBottom: 20 }} />
      <Descriptions column={1} bordered size="small" items={[
        { key: 'owner', label: '负责智能体', children: SKILL_AGENTS.find(a => a.id === skill.owner)?.name },
        { key: 'code', label: '能力标识（草案）', children: <code>anneng.{skill.id}</code> },
        { key: 'version', label: '契约版本', children: 'v0.1.0 · 展示草案，待详细设计确认' },
        { key: 'phase', label: '调用层次', children: <Tag>{skill.phase}</Tag> },
        { key: 'status', label: '当前状态', children: <Tag color={skill.status === '本地模拟' ? 'blue' : 'orange'}>{skill.status}</Tag> },
        { key: 'input', label: '输入', children: skill.input },
        { key: 'output', label: '输出', children: skill.output },
        { key: 'gate', label: '人工核对边界', children: skill.boundary },
        { key: 'source', label: '来源要求', children: '返回来源记录、字段标识、采集时点与输入版本；缺项保留待核。' },
        { key: 'permission', label: '权限范围', children: '沿用事件、角色、场景与数据域授权；跨区域须审批。' },
        { key: 'write', label: '执行前置', children: skill.phase === '执行' ? '正式写操作须确认令牌、对象版本、幂等键与审计；本地文件导出由用户操作。' : '感知仅读取；决策仅形成建议，不写正式业务字段。' },
        { key: 'fallback', label: '异常与降级', children: '超时、拒绝访问、上游不可用时保留原因与待补事项；按统一能力白名单降级。' },
        { key: 'reference', label: '规划依据', children: '四类智能体总体产品设计（专属 Skill）；产品设计 v4（来源与人工责任门）；8.4.6.7 Skill与运行规范。' },
      ]} />
      <div style={{marginTop:16}}><SkillRuntimeDemo key={skill.id} skill={skill}/></div>
    </>}
  </Drawer>;
}
