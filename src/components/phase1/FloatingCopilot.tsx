/**
 * 一期系统嵌入页悬浮机器人：默认收起为 FAB；
 * 点击后可选「展开聊天框」或「进入安小能 /assistant」。
 */
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button, Tooltip } from 'antd';
import { MessageCircle, Sparkles, X } from 'lucide-react';
import { NAV_PATH } from '@/components/nav/navRoutes';
import ChatPanel from '@/components/chat/ChatPanel';

type Mode = 'collapsed' | 'chooser' | 'chat';

export default function FloatingCopilot() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<Mode>('collapsed');
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (mode === 'collapsed') return;
    const onPointerDown = (event: MouseEvent) => {
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

  return (
    <div className="axn-float-copilot" data-testid="floating-copilot" ref={rootRef}>
      {mode === 'chat' ? (
        <div className="axn-float-copilot-panel" role="dialog" aria-label="安小能悬浮对话">
          <header className="axn-float-copilot-head">
            <div className="axn-float-copilot-brand">
              <span className="axn-float-copilot-mark" aria-hidden>
                <Sparkles size={14} />
              </span>
              <div>
                <strong>安小能</strong>
                <small>一期系统内嵌助手（模拟）</small>
              </div>
            </div>
            <div className="axn-float-copilot-head-actions">
              <Button
                size="small"
                type="primary"
                data-testid="floating-copilot-open-assistant"
                onClick={() => navigate(NAV_PATH.assistant)}
              >
                进入工作台
              </Button>
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

      <div className="axn-float-copilot-fab-wrap">
        {mode === 'chooser' ? (
          <div className="axn-float-copilot-menu" role="menu" data-testid="floating-copilot-menu">
            <button
              type="button"
              role="menuitem"
              className="axn-float-copilot-menu-item"
              data-testid="floating-copilot-expand"
              onClick={() => setMode('chat')}
            >
              <MessageCircle size={14} aria-hidden />
              展开聊天框
            </button>
            <button
              type="button"
              role="menuitem"
              className="axn-float-copilot-menu-item"
              data-testid="floating-copilot-goto-assistant"
              onClick={() => navigate(NAV_PATH.assistant)}
            >
              <Sparkles size={14} aria-hidden />
              进入安小能
            </button>
          </div>
        ) : null}
        <button
          type="button"
          className={`axn-float-copilot-fab${mode !== 'collapsed' ? ' is-open' : ''}`}
          aria-label={mode === 'collapsed' ? '打开安小能助手' : '关闭安小能助手'}
          aria-expanded={mode !== 'collapsed'}
          data-testid="floating-copilot-fab"
          onClick={() => setMode((prev) => (prev === 'collapsed' ? 'chooser' : 'collapsed'))}
        >
          {mode === 'collapsed' ? <Sparkles size={22} /> : <X size={22} />}
          {mode === 'collapsed' ? <span className="axn-float-copilot-fab-label">安小能</span> : null}
        </button>
      </div>
    </div>
  );
}
