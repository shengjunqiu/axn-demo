import { splitPipeContent } from './pipeTable';
/**
 * 红头文书正文的富文本工具。
 *
 * 「在线编辑」把正文从 antd TextArea 换成 contentEditable 后，store 里存的是 HTML 片段；
 * 旧数据（纯文本）保持原样，渲染时才按纯文本处理。本模块集中两件事：
 * 1. 字符串侧：可见文本提取（字数统计 / 聊天卡片摘要用）；
 * 2. DOM 侧：白名单的 HTML ↔ DOM 互转（读写正文都用它，见下）+ document.execCommand 的封装。
 *
 * 为什么不用 innerHTML：正文的 HTML 会被写回 store、也来自 store，
 * 这里用「白名单重建 DOM」代替直接注入 —— 渲染侧不认识 script/on* 属性、也不认识图片，
 * 存储侧只序列化白名单标签与属性，两侧共用同一份白名单，格式不会被悄悄改掉。
 */

/** 工具条命令白名单：不把任意字符串透给 document.execCommand。 */
export type RichCommand =
  | 'undo' | 'redo'
  | 'fontSize' | 'bold' | 'italic' | 'underline' | 'strikeThrough'
  | 'foreColor' | 'hiliteColor'
  | 'justifyLeft' | 'justifyCenter' | 'justifyRight' | 'justifyFull'
  | 'insertUnorderedList' | 'insertOrderedList'
  | 'removeFormat';

export type RichAlign = 'left' | 'center' | 'right' | 'justify';

/** 工具条按下态。fontSize 只在选区真的带 <font size> 时才有值（null = 用正文默认字号）。 */
export type RichFormatState = {
  bold: boolean; italic: boolean; underline: boolean; strike: boolean;
  align: RichAlign | null;
  list: 'ordered' | 'unordered' | null;
  fontSize: string | null;
};

export const RICH_EDITOR_CLASS = 'doc-rich-editor';
const EDITOR_SELECTOR = `.${RICH_EDITOR_CLASS}`;

/** 正文允许出现的标签（contentEditable + execCommand 会产生的就是这些）。 */
const RICH_TAGS = new Set(['p', 'div', 'br', 'span', 'font', 'b', 'strong', 'i', 'em', 'u', 's', 'strike', 'sub', 'sup', 'ul', 'ol', 'li', 'h3', 'h4', 'table', 'thead', 'tbody', 'tfoot', 'tr', 'th', 'td', 'caption', 'colgroup', 'col']);
/** 连内容一起丢掉的标签（内容不是可见正文）。其余未知标签只保留其内容。 */
const DROP_TAGS = new Set(['script', 'style', 'iframe', 'object', 'embed', 'link', 'meta', 'form', 'svg', 'img', 'video', 'audio', 'canvas', 'input', 'button', 'select', 'textarea']);
const RICH_ATTRS = new Set(['style', 'color', 'size', 'face', 'align', 'start', 'colspan', 'rowspan']);
const RICH_STYLE_PROPS = new Set(['font-size', 'font-weight', 'font-style', 'font-family', 'color', 'background-color', 'text-align', 'text-decoration', 'text-decoration-line', 'text-indent', 'line-height', 'margin-left']);
/** 样式值里出现这些一律丢弃（防止 url() 拉外部资源）。 */
const UNSAFE_STYLE_VALUE = /url\(|expression\(|javascript:/i;
/** 块边界折成空格，避免两段文字粘成一个词。 */
const BLOCK_BOUNDARY = /<\/(p|div|li|h[1-6]|ul|ol|tr|td|th)\s*>|<br\s*\/?>/gi;
/** 只有形如 <p> 的东西才算富文本——老数据里的「3 < 5」不能当 HTML 塞进 DOM。 */
const TAG_PATTERN = /<\/?[a-z][^>]*>/i;

export function isRichHtml(value: string): boolean {
  return TAG_PATTERN.test(value);
}

/** 按段落取可见文本（段间用 \n），版本对比按段比较时用。 */
export function richTextToLines(value: string): string {
  const text = isRichHtml(value)
    ? decodeEntities(value.replace(BLOCK_BOUNDARY, '\n').replace(/<[^>]*>/g, ''))
    : value;
  return text.split('\n').map(line => line.replace(/[ \t\u00a0]+/g, ' ').trim()).filter(Boolean).join('\n');
}

/** 可见文本：字数统计、聊天卡片摘要用（去标签 → 还原实体 → 折叠空白）。 */
export function richTextToPlain(value: string): string {
  if (!isRichHtml(value)) return value;
  return decodeEntities(value.replace(BLOCK_BOUNDARY, ' ').replace(/<[^>]*>/g, ''))
    .replace(/\s+/g, ' ')
    .trim();
}

function decodeEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&amp;/gi, '&');
}

/**
 * HTML → 文档片段：只重建白名单标签与属性，其余标签保留内容、白名单外的属性丢弃。
 * 纯文本（老数据）按行包成段落，空值也给一个空段落，好让光标有落点。
 * 调用方直接用 replaceChildren 塞进 DOM，不经过 innerHTML。
 */
export function parseRichHtml(html: string): DocumentFragment {
  const fragment = document.createDocumentFragment();
  if (!isRichHtml(html)) {
    appendPlainBlocks(fragment, html);
    return fragment;
  }
  const parsed = new DOMParser().parseFromString(html, 'text/html');
  for (const child of Array.from(parsed.body.childNodes)) fragment.appendChild(adoptRichNode(child));
  restorePipeTables(fragment);
  return fragment;
}

/** 用 DOM 构造表格，单元格内容始终按文字处理。 */
function appendPlainBlocks(holder: Node, text: string): void {
  const blocks = splitPipeContent(text);
  if (!blocks.length) holder.appendChild(document.createElement('p'));
  for (const block of blocks) {
    if (block.kind === 'text') {
      for (const line of block.text.split('\n').filter(line => line.trim())) {
        const paragraph = document.createElement('p');
        paragraph.textContent = line;
        holder.appendChild(paragraph);
      }
      continue;
    }
    const table = document.createElement('table');
    const head = table.createTHead().insertRow();
    for (const value of block.headers) {
      const cell = document.createElement('th');
      cell.textContent = value;
      head.appendChild(cell);
    }
    const body = table.createTBody();
    for (const values of block.rows) {
      const row = body.insertRow();
      for (const value of values) row.insertCell().textContent = value;
    }
    holder.appendChild(table);
  }
}

/** 兼容旧编辑器已保存为多个段落的管道表。 */
function restorePipeTables(fragment: DocumentFragment): void {
  const nodes = Array.from(fragment.childNodes);
  for (let i = 0; i < nodes.length; i += 1) {
    const run: HTMLElement[] = [];
    let j = i;
    while (j < nodes.length) {
      const node = nodes[j];
      if (node.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) { j += 1; continue; }
      if (!(node instanceof HTMLElement) || !['P', 'DIV'].includes(node.tagName)
        || !(/[|]|\s\/\s/.test(node.textContent ?? '')) || node.querySelector('table')) break;
      run.push(node);
      j += 1;
    }
    const text = run.map(node => node.textContent).join('\n');
    if (run.length && splitPipeContent(text).some(block => block.kind === 'table')) {
      const replacement = document.createDocumentFragment();
      appendPlainBlocks(replacement, text);
      fragment.insertBefore(replacement, run[0]);
      run.forEach(node => node.remove());
    }
    if (j > i) i = j - 1;
  }
}

/** 白名单克隆一个节点：返回元素、文档片段（原标签不在白名单，只要内容）或空片段（标签要丢）。 */
function adoptRichNode(node: Node): Node {
  if (node.nodeType === Node.TEXT_NODE) return document.createTextNode(node.nodeValue ?? '');
  if (!(node instanceof HTMLElement)) return document.createDocumentFragment();
  const tag = node.tagName.toLowerCase();
  if (DROP_TAGS.has(tag)) return document.createDocumentFragment();
  const element = RICH_TAGS.has(tag) ? document.createElement(tag) : null;
  const holder: Node = element ?? document.createDocumentFragment();
  if (element) {
    for (const attribute of Array.from(node.attributes)) {
      const value = richAttributeValue(attribute.name, attribute.value);
      if (value !== null) element.setAttribute(attribute.name.toLowerCase(), value);
    }
  }
  for (const child of Array.from(node.childNodes)) holder.appendChild(adoptRichNode(child));
  return holder;
}

/** 属性过滤：白名单外的属性返回 null；style 只保留白名单属性。 */
function richAttributeValue(name: string, value: string): string | null {
  const key = name.toLowerCase();
  if (key.startsWith('on') || !RICH_ATTRS.has(key)) return null;
  if (key === 'colspan' || key === 'rowspan') return /^[1-9]\d{0,2}$/.test(value) ? value : null;
  if (key !== 'style') return value;
  const kept = value.split(';').map(declaration => {
    const separator = declaration.indexOf(':');
    if (separator < 0) return null;
    const property = declaration.slice(0, separator).trim().toLowerCase();
    const styleValue = declaration.slice(separator + 1).trim();
    if (!RICH_STYLE_PROPS.has(property) || UNSAFE_STYLE_VALUE.test(styleValue)) return null;
    return `${property}: ${styleValue}`;
  }).filter((declaration): declaration is string => declaration !== null);
  return kept.length > 0 ? `${kept.join('; ')};` : null;
}

/** 编辑器 DOM → HTML 字符串（存储用）。与 parseRichHtml 共用同一份白名单，往返稳定。 */
export function serializeRichDom(root: Node): string {
  return Array.from(root.childNodes).map(serializeRichNode).join('');
}

function serializeRichNode(node: Node): string {
  if (node.nodeType === Node.TEXT_NODE) return escapeRichText(node.nodeValue ?? '');
  if (!(node instanceof HTMLElement)) return '';
  const tag = node.tagName.toLowerCase();
  if (DROP_TAGS.has(tag)) return '';
  const inner = Array.from(node.childNodes).map(serializeRichNode).join('');
  if (!RICH_TAGS.has(tag)) return inner;
  if (tag === 'br') return '<br>';
  const attributes = Array.from(node.attributes)
    .filter(attribute => RICH_ATTRS.has(attribute.name.toLowerCase()))
    .map(attribute => ` ${attribute.name.toLowerCase()}="${escapeRichText(attribute.value)}"`)
    .join('');
  return `<${tag}${attributes}>${inner}</${tag}>`;
}

function escapeRichText(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/**
 * 命令作用的对象：正在编辑的正文。先看焦点，再看选区——
 * 点工具条按钮时会在 mousedown 阶段 preventDefault，焦点始终留在编辑器上。
 */
export function activeRichEditor(): HTMLElement | null {
  const focused = document.activeElement instanceof HTMLElement
    ? document.activeElement.closest(EDITOR_SELECTOR)
    : null;
  if (focused instanceof HTMLElement) return focused;
  return richEditorOfRange(window.getSelection()?.anchorNode ?? null);
}

function richEditorOfRange(node: Node | null): HTMLElement | null {
  const holder = node instanceof HTMLElement ? node : node?.parentElement ?? null;
  const editor = holder?.closest(EDITOR_SELECTOR) ?? null;
  return editor instanceof HTMLElement ? editor : null;
}

/**
 * 最近一次落在正文里的选区。点字号下拉这类控件会夺走焦点（选区随之离开编辑器），
 * 命令执行前要把这段选区接回来，否则 execCommand 无从下手；选区在正文里才记录，别处不动它。
 */
let lastRichRange: Range | null = null;

export function rememberRichSelection(): void {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0 || !activeRichEditor()) return;
  lastRichRange = selection.getRangeAt(0).cloneRange();
}

function restoreRichRange(root: HTMLElement): void {
  const selection = window.getSelection();
  if (!selection || !lastRichRange || !root.contains(lastRichRange.commonAncestorContainer)) return;
  selection.removeAllRanges();
  selection.addRange(lastRichRange);
}

/** 光标处显式设置过的字号（<font size>），没有则 null。 */
export function currentRichFontSize(): string | null {
  const anchor = window.getSelection()?.anchorNode ?? null;
  const holder = anchor instanceof HTMLElement ? anchor : anchor?.parentElement ?? null;
  return holder?.closest('font[size]')?.getAttribute('size') ?? null;
}

export const DEFAULT_FORMAT_STATE: RichFormatState = {
  bold: false, italic: false, underline: false, strike: false,
  align: null, list: null, fontSize: null,
};

/** 选区当前格式（工具条按下态）。jsdom 没实现 queryCommandState，这里兜底成默认值。 */
export function readRichFormatState(): RichFormatState {
  try {
    const align: RichAlign | null = document.queryCommandState('justifyCenter') ? 'center'
      : document.queryCommandState('justifyRight') ? 'right'
        : document.queryCommandState('justifyFull') ? 'justify'
          : document.queryCommandState('justifyLeft') ? 'left'
            : null;
    return {
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      strike: document.queryCommandState('strikeThrough'),
      align,
      list: document.queryCommandState('insertOrderedList') ? 'ordered'
        : document.queryCommandState('insertUnorderedList') ? 'unordered'
          : null,
      fontSize: currentRichFontSize(),
    };
  } catch {
    return DEFAULT_FORMAT_STATE;
  }
}

/**
 * Chromium 在 <p> 里执行 insertOrderedList / insertUnorderedList 时会生成
 * `<p><ol><li>…</li></ol></p>` 这种非法嵌套（真实 DOM 确实如此，只有重新解析时浏览器才会改），
 * 结果列表继承了段落的首行缩进。这里把列表从段落里搬到段落前面（div 根下的列表本来就合法，不动），
 * 并返回一个「接回原光标」的收尾函数——挪动 DOM 会把光标挤到别处。
 */
export function mendNestedLists(root: HTMLElement): (() => void) | null {
  const nested = Array.from(root.querySelectorAll('p > ul, p > ol, h3 > ul, h3 > ol'));
  if (nested.length === 0) return null;
  const selection = window.getSelection();
  const anchor = selection?.anchorNode ?? null;
  const offset = selection?.anchorOffset ?? 0;
  for (const list of nested) {
    const block = list.parentElement;
    if (!block?.parentElement) continue;
    block.parentElement.insertBefore(list, block);
    if (block.childElementCount === 0 && !block.textContent?.trim()) block.remove();
  }
  return () => {
    if (!selection || !anchor || !root.contains(anchor)) return;
    const range = document.createRange();
    try { range.setStart(anchor, offset); } catch { return; }
    range.collapse(true);
    selection.removeAllRanges();
    selection.addRange(range);
  };
}

/**
 * 执行格式化命令。所有按钮统一走这里，好把三件收尾的事放在一处：
 * 1. 先 focus 编辑器——焦点不在 contentEditable 上时 execCommand 会静默失效；
 * 2. 列表命令后修掉非法嵌套并接回光标；
 * 3. 补发 input 事件，让 React 侧读到修补后的 HTML（改 DOM 不会自动触发 input）。
 */
export function runRichCommand(command: RichCommand, value?: string): void {
  // 焦点可能已经被工具条里的下拉夺走，此时靠记住的选区认领编辑器。
  const root = activeRichEditor() ?? richEditorOfRange(lastRichRange?.commonAncestorContainer ?? null);
  if (!root || typeof document.execCommand !== 'function') return;
  root.focus();
  restoreRichRange(root);
  // fontSize 走不带 CSS 的 <font size>，再由样式表映射成公文常用字号；其余用内联样式。
  document.execCommand('styleWithCSS', false, command === 'fontSize' ? 'false' : 'true');
  document.execCommand(command, false, value);
  mendNestedLists(root)?.();
  root.dispatchEvent(new Event('input', { bubbles: true }));
}
