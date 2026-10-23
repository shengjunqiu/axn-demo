/**
 * 悬浮/内嵌安小能：默认收起；可挂 FAB，或由外部（如常用应用图标）打开。
 * 打开后可选「展开聊天框」或「进入安小能 /assistant」。
 */
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Button, Drawer, Tooltip } from 'antd';
import { Sparkles, X } from 'lucide-react';
import ChatPanel from '@/components/chat/ChatPanel';
import { useActiveScope, useWorkspaceStore } from '@/store/workspaceStore';
import './floating-copilot.css';
const DocumentWorkspace = lazy(() => import('@/components/workspace/DocumentWorkspace'));

type Mode = 'collapsed' | 'chat';

export default function FloatingCopilot({
  subtitle = '一期系统内嵌助手（模拟）',
  className,
  showFab = true,
  /** 递增时从外部打开选择菜单（常用应用入口） */
  openSignal = 0,
}: {
  subtitle?: string;
  className?: string;
  showFab?: boolean;
  openSignal?: number;
} = {}) {
  const scope = useActiveScope();
  const selection = useWorkspaceStore(s => s.scopes[scope]?.selection);
  const [mode, setMode] = useState<Mode>('collapsed');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (openSignal > 0) setMode('chat');
  }, [openSignal]);

  useEffect(() => {
    if (mode === 'collapsed') return;
    const onPointerDown = (event: MouseEvent) => {
      if (event.target instanceof Element && event.target.closest('.ant-modal-root, .ant-select-dropdown, .ant-dropdown, .ant-tooltip, .ant-drawer')) return;
      if (!rootRef.current?.contains(event.target as Node)) {
        setMode('collapsed');
      }
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMode('collapsed');
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [mode]);

  if (mode === 'collapsed' && !showFab) return null;

  return (
    <div
      className={`axn-float-copilot${className ? ` ${className}` : ''}`}
      data-testid="floating-copilot"
      ref={rootRef}
    >
      {mode === 'chat' ? (
        <div className="axn-float-copilot-panel" role="dialog" aria-label="安小能悬浮对话">
          <header className="axn-float-copilot-head">
            <div className="axn-float-copilot-brand">
              <span className="axn-float-copilot-mark" aria-hidden>
                <Sparkles size={14} />
              </span>
              <div>
                <strong>安小能</strong>
                <small>{subtitle}</small>
              </div>
            </div>
            <div className="axn-float-copilot-head-actions">
              <Tooltip title="收起">
                <Button
                  size="small"
                  type="text"
                  icon={<X size={16} />}
                  aria-label="收起聊天框"
                  data-testid="floating-copilot-collapse"
                  onClick={() => setMode('collapsed')}
                />
              </Tooltip>
            </div>
          </header>
          <div className="axn-float-copilot-body">
            <ChatPanel compact />
          </div>
        </div>
      ) : null}

      <Drawer title="文书与分析结果" open={mode === 'chat' && !!selection} size="large" onClose={() => window.dispatchEvent(new Event('axn:close-document'))}>
        {selection && <Suspense fallback="正在打开结果…"><DocumentWorkspace /></Suspense>}
      </Drawer>
      <div className="axn-float-copilot-fab-wrap">
        {showFab ? (
          <button
            type="button"
            className={`axn-float-copilot-fab${mode !== 'collapsed' ? ' is-open' : ''}`}
            aria-label={mode === 'collapsed' ? '打开安小能助手' : '关闭安小能助手'}
            aria-expanded={mode !== 'collapsed'}
            data-testid="floating-copilot-fab"
            onClick={() => setMode((prev) => (prev === 'collapsed' ? 'chat' : 'collapsed'))}
          >
            {mode === 'collapsed' ? <Sparkles size={22} /> : <X size={22} />}
            {mode === 'collapsed' ? <span className="axn-float-copilot-fab-label">安小能</span> : null}
          </button>
        ) : null}
      </div>
    </div>
  );
}
