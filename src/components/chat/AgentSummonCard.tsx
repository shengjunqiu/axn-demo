/**
 * 智能体召唤卡（kind='agent' 消息）：主任务执行中协同调用其他智能体的过程展示。
 * 纯演示动效：脉冲光圈表示“协同中”，不伪造真实耗时或真实多智能体系统。
 */
import { RobotOutlined } from '@ant-design/icons';
import { Typography } from 'antd';

const { Text } = Typography;

export default function AgentSummonCard({
  agentName,
  agentRole,
  action,
}: {
  agentName: string;
  agentRole: string;
  action: string;
}) {
  return (
    <div className="axn-agent-summon" data-testid="agent-summon-card">
      <span className="axn-agent-summon-avatar" aria-hidden>
        <RobotOutlined />
      </span>
      <div className="axn-agent-summon-body">
        <div className="axn-agent-summon-head">
          <Text strong style={{ fontSize: 13 }}>
            {agentName}
          </Text>
          <span className="axn-agent-summon-badge">协同中</span>
        </div>
        <div className="axn-agent-summon-role">
          <Text type="secondary" style={{ fontSize: 12 }}>
            {agentRole}
          </Text>
        </div>
        <div className="axn-agent-summon-action">
          <Text style={{ fontSize: 12 }}>{action}</Text>
        </div>
        <div className="axn-agent-summon-foot">
          <Text type="secondary" style={{ fontSize: 11 }}>
            模拟协同 · 非真实多智能体调用
          </Text>
        </div>
      </div>
    </div>
  );
}
