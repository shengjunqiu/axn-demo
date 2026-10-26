/**
 * 【下一步建议】操作按钮条：事件切换提示、任务完成、文书完成后共用。
 */
import { Button, Space, Typography } from 'antd';
import { FolderOpen } from 'lucide-react';
import { tenderName } from '@/seed/tenderNames';
import { isHiddenPrototypeAction } from '@/seed/prototypeVisibility';
import type { EventNextStepAction } from '@/services/eventSwitchBriefing';

const { Title } = Typography;

export default function NextStepActionsBar({
  actions,
  onTask,
  onNavigate,
  busy = false,
  testId = 'event-next-steps',
}: {
  actions: EventNextStepAction[];
  onTask: (prompt: string) => void;
  onNavigate: (path: string) => void;
  busy?: boolean;
  testId?: string;
}) {
  if (actions.length === 0) return null;

  return (
    <div className="axn-event-next-steps" data-testid={testId}>
      <Title level={5} className="axn-event-next-title">【下一步建议】</Title>
      <Space wrap className="axn-event-next-buttons" data-testid={`${testId}-actions`}>
        {actions.filter(action=>!isHiddenPrototypeAction(action.label)).map((action) => (
          <Button
            key={`${action.kind}:${action.payload}`}
            size="small"
            type={action.kind === 'navigate' ? 'default' : 'primary'}
            ghost={action.kind !== 'navigate'}
            disabled={busy || (action.kind === 'task' && !action.payload)}
            icon={action.kind === 'navigate' ? <FolderOpen size={14} /> : undefined}
            aria-label={tenderName(action.label)}
            title={action.hint}
            data-testid={`${testId}-${action.kind}-${action.label}`}
            onClick={() => {
              if (action.kind === 'navigate') onNavigate(action.payload);
              else onTask(action.payload);
            }}
          >
            {tenderName(action.label)}
          </Button>
        ))}
      </Space>
    </div>
  );
}
