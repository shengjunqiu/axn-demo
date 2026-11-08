/**
 * 「深度思考」折叠块（参考 WorkBuddy）：运行中展开并逐字显示推理过程，结束后收起成一行耗时。
 * 任务卡与普通 AI 文本回复共用这份版式。
 */
import { useEffect, useRef, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import Typewriter from './Typewriter';

export default function ThinkingPanel({ text, running, seconds, animate = running, typeDuration }: {
  text: string;
  running: boolean;
  /** running=false 时展示的耗时（秒） */
  seconds: number;
  /** 是否逐字展开；历史消息直接整段显示 */
  animate?: boolean;
  /** 思考文本逐字展开的总时长（毫秒） */
  typeDuration?: number;
}) {
  const [open, setOpen] = useState(running);
  useEffect(() => { setOpen(running); }, [running]);
  const bodyRef = useRef<HTMLDivElement>(null);
  // 思考正文高度固定（见 chat.css），逐字展开时跟随底部，保证刚写出的推理始终在视野内。
  useEffect(() => {
    if (!running || !open) return;
    const el = bodyRef.current;
    if (!el) return;
    let raf = 0;
    const follow = () => {
      el.scrollTop = el.scrollHeight;
      raf = requestAnimationFrame(follow);
    };
    raf = requestAnimationFrame(follow);
    return () => cancelAnimationFrame(raf);
  }, [running, open]);
  return (
    <div className={`axn-thinking${open ? ' is-open' : ''}${running ? ' is-thinking' : ''}`}>
      <button
        type="button"
        className="axn-thinking-toggle"
        aria-expanded={open}
        aria-label={`${open ? '收起' : '展开'}深度思考`}
        data-testid="thinking-toggle"
        onClick={() => setOpen(value => !value)}
      >
        <ChevronRight size={14} aria-hidden className="axn-thinking-caret" />
        <span className="axn-thinking-title">深度思考</span>
        <span className="axn-thinking-meta">{running ? '思考中…' : `${seconds < 1 ? seconds.toFixed(1) : Math.round(seconds)}s`}</span>
      </button>
      {open && (
        <div className="axn-thinking-body" data-testid="thinking-body" ref={bodyRef}>
          <Typewriter
            text={text}
            animate={animate}
            maxDuration={typeDuration}
            render={value => <>{value.split('\n').map((line, index) => <p key={index}>{line}</p>)}</>}
          />
        </div>
      )}
    </div>
  );
}
