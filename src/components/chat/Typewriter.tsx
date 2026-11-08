import { useEffect, useRef, useState, type ReactNode } from 'react';

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * 逐字呈现文本（模拟流式输出）。provider 的 text_delta 往往整句一次到达，
 * 这里在前端按字展开，让回答「写出来」而不是「贴出来」。
 * - 只对挂载时仍在生成中的回答生效（animate=true），历史消息直接整段显示；
 * - 总时长封顶 1.2s，长文本不拖沓；尊重「减少动态效果」。
 * DOM 里始终保留完整文本（visually-hidden），读屏与 e2e 读到的都是全文。
 */
export default function Typewriter({ text, animate, render = (t) => <span>{t}</span>, maxDuration = 1200 }: {
  text: string; animate: boolean;
  /** 把（部分）文本排成结构化版式；逐字展开时也按同一版式长出来，结束时不跳版 */
  render?: (visible: string) => ReactNode;
  /** 逐字展开的最长时长（毫秒），默认 1200；模拟思考时可放慢 */
  maxDuration?: number;
}) {
  const enabled = useRef(animate && !prefersReducedMotion());
  const [shown, setShown] = useState(enabled.current ? 0 : text.length);

  useEffect(() => {
    if (!enabled.current) { setShown(text.length); return; }
    let raf = 0;
    const start = performance.now();
    const from = Math.min(shown, text.length);
    const remaining = text.length - from;
    const duration = Math.min(maxDuration, Math.max(240, remaining * 22));
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / duration);
      setShown(from + Math.round(remaining * t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [text]); // 只在全文变化时续写（shown 是续写起点，不作为依赖）

  if (shown >= text.length) return <>{render(text)}</>;
  return (
    <>
      <div aria-hidden className="axn-typing">{render(text.slice(0, shown))}</div>
      <span className="axn-sr-only">{text}</span>
    </>
  );
}
