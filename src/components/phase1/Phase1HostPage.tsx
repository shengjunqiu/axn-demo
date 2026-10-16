/**
 * 一期系统嵌入演示页：整页展示原系统工作台为背景，
 * 右下角悬浮安小能（默认收起），可展开聊天或进入 /assistant。
 */
import OriginalSystemWorkspace from '@/components/workspace/OriginalSystemWorkspace';
import FloatingCopilot from './FloatingCopilot';
import './phase1-host.css';

export default function Phase1HostPage() {
  return (
    <div className="axn-phase1-host" data-testid="phase1-host-page">
      <div className="axn-phase1-host-bg">
        <OriginalSystemWorkspace linkBase="/phase1" />
      </div>
      <FloatingCopilot />
    </div>
  );
}
