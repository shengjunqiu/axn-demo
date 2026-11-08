/**
 * 输入框里的模板占位符：`#文书类型` / `#灾情事件` 以斜体展示，并可点击。
 *
 * 原生 textarea 不能只给部分文字上样式，所以这里保留 textarea（打字、光标、输入法都不受影响），
 * 在它上面盖一层内容完全一致、字体行高一致的展示层：普通文字透明让位，占位符斜体可点。
 * 展示层默认 pointer-events:none，只有占位符节点接收点击，点其他位置仍然落到 textarea。
 */
import { forwardRef, useRef } from 'react';
import { Input } from 'antd';
import type { TextAreaRef } from 'antd/es/input/TextArea';

const TOKEN_NAMES = ['文书类型', '灾情事件'] as const;
const TOKEN_RE = new RegExp(`#(${TOKEN_NAMES.join('|')})`, 'g');

function renderTokens(text: string) {
  const nodes: React.ReactNode[] = [];
  let last = 0;
  let key = 0;
  let match: RegExpExecArray | null;
  TOKEN_RE.lastIndex = 0;
  while ((match = TOKEN_RE.exec(text))) {
    if (match.index > last) nodes.push(text.slice(last, match.index));
    nodes.push(
      <em key={`token-${key++}`} className="axn-token" data-token={match[1]}>
        {match[0]}
      </em>,
    );
    last = match.index + match[0].length;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

export interface TokenTextAreaProps extends React.ComponentProps<typeof Input.TextArea> {
  onTokenClick?: (token: string) => void;
}

const TokenTextArea = forwardRef<TextAreaRef, TokenTextAreaProps>(function TokenTextArea(
  { value, onTokenClick, onScroll, ...rest },
  ref,
) {
  const overlayRef = useRef<HTMLDivElement>(null);
  const text = typeof value === 'string' ? value : '';
  const hasToken = TOKEN_NAMES.some(token => text.includes(`#${token}`));

  return (
    <div className="axn-token-input-wrap">
      <Input.TextArea
        ref={ref}
        value={value}
        {...rest}
        className={`${rest.className ?? ''}${hasToken ? ' axn-token-input-hidden' : ''}`}
        onScroll={event => {
          if (overlayRef.current) overlayRef.current.scrollTop = event.currentTarget.scrollTop;
          onScroll?.(event);
        }}
      />
      {hasToken && (
        <div
          ref={overlayRef}
          className="axn-token-overlay"
          aria-hidden
          onClick={event => {
            const tokenEl = (event.target as HTMLElement).closest<HTMLElement>('[data-token]');
            if (tokenEl?.dataset.token) onTokenClick?.(tokenEl.dataset.token);
          }}
        >
          {renderTokens(text)}
        </div>
      )}
    </div>
  );
});

export default TokenTextArea;
