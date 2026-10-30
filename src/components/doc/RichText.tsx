/**
 * 正文的富文本渲染与编辑。
 * 编辑态：contentEditable，格式由 RichTextToolbar 通过 document.execCommand 施加。
 * 进出编辑器都走 richText 的白名单互转（parseRichHtml / serializeRichDom），不使用 innerHTML。
 */
import { useEffect, useRef } from 'react';
import { parseRichHtml, serializeRichDom } from '@/services/richText';

export default function RichTextEditor({ value, onChange, ariaLabel, autoFocus, placeholder }: {
  value: string; onChange: (value: string) => void; ariaLabel: string; autoFocus?: boolean;
  /** 正文为空时用 ::after 画的一行浅灰提示（提示不进正文、不参与序列化） */ placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  // 记住最近一次报出去的值：store 回流同一个字符串时不能再重建 DOM，否则光标会跳到开头。
  const emitted = useRef<string | null>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element || emitted.current === value) return;
    element.replaceChildren(parseRichHtml(value));
    emitted.current = value;
  }, [value]);
  // 进入编辑态即聚焦第一段正文：工具条的按下态与命令都需要编辑器有焦点（Word 里也是双击即可输入）。
  useEffect(() => { if (autoFocus) ref.current?.focus(); }, [autoFocus]);
  const emit = () => {
    const element = ref.current;
    if (!element) return;
    const html = serializeRichDom(element);
    emitted.current = html;
    onChange(html);
  };
  return <div ref={ref} className="doc-rich doc-rich-editor doc-inline-edit" data-testid="rich-text-editor" data-placeholder={placeholder} contentEditable suppressContentEditableWarning
    role="textbox" aria-multiline="true" aria-label={ariaLabel} onInput={emit}
    onPaste={event => {
      // 粘贴一律落成纯文本：外部 HTML 带进来的字体/颜色会污染公文排版。
      event.preventDefault();
      document.execCommand('insertText', false, event.clipboardData.getData('text/plain'));
    }} />;
}
