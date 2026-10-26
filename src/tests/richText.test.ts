/**
 * 富文本正文的白名单互转测试。
 * 对应两条红线：只读态不能把老数据里的「3 < 5」当标签吃掉；存储侧不能把格式改丢。
 */
import { describe, expect, it } from 'vitest';
import { isRichHtml, mendNestedLists, parseRichHtml, richTextToPlain, serializeRichDom } from '@/services/richText';

/** 模拟渲染/编辑：白名单重建 DOM（组件里用 replaceChildren，不走 innerHTML）。 */
function render(html: string): HTMLElement {
  const host = document.createElement('div');
  host.replaceChildren(parseRichHtml(html));
  return host;
}

function text(html: string): string {
  return render(html).textContent ?? '';
}

describe('isRichHtml / richTextToPlain', () => {
  it('纯文本里的 < 不当成标签（老数据的正文原样渲染）', () => {
    expect(isRichHtml('处置标准：3 < 5 的险情需上报')).toBe(false);
    expect(isRichHtml('<p>已经有格式了</p>')).toBe(true);
  });

  it('提取可见文本：去标签、还原实体、段落折成空格', () => {
    expect(richTextToPlain('<p>长江水位<b>上涨</b></p><p>超警戒 0.8 米</p>')).toBe('长江水位上涨 超警戒 0.8 米');
    expect(richTextToPlain('<p>3 &lt; 5 &amp; 6 &gt; 4</p>')).toBe('3 < 5 & 6 > 4');
    expect(richTextToPlain('未格式化的正文')).toBe('未格式化的正文');
  });
});

describe('parseRichHtml：白名单重建', () => {
  it('纯文本按行包成段落，空值也给一个空段落', () => {
    const lines = render('第一行\n第二行');
    expect(Array.from(lines.children).map(node => node.tagName)).toEqual(['P', 'P']);
    expect(text('第一行\n第二行')).toBe('第一行第二行');
    expect(render('').children.length).toBe(1);
    expect(render('').firstElementChild?.tagName).toBe('P');
  });

  it('丢掉 script/img 与 on* 属性，未知标签只保留内容', () => {
    const host = render('<p onclick="alert(1)">甲</p><script>alert(1)</script><img src=x onerror=alert(1)><table><tr><td>乙</td></tr></table>');
    expect(host.textContent).toBe('甲乙');
    expect(host.querySelector('script')).toBeNull();
    expect(host.querySelector('img')).toBeNull();
    expect(host.querySelector('table td')?.textContent).toBe('乙');
    expect(host.querySelector('p')?.hasAttribute('onclick')).toBe(false);
  });

  it('保留字号/颜色等格式，样式里只留白名单属性', () => {
    const host = render('<p><font size="4" color="#c62828">小标题</font><span style="font-weight: bold; background: url(http://x/y.png); color: #111">加粗</span></p>');
    expect(host.querySelector('font')?.getAttribute('size')).toBe('4');
    expect(host.querySelector('font')?.getAttribute('color')).toBe('#c62828');
    expect(host.querySelector('span')?.getAttribute('style')).toBe('font-weight: bold; color: #111;');
  });
});

describe('serializeRichDom：存回 store 的 HTML', () => {
  it('往返稳定：解析 → 序列化 → 再解析，结果一致', () => {
    const html = '<p>一段<font size="4">小标题</font></p><ul><li>一项</li><li><b>二项</b></li></ul><p style="text-align: center">居中</p>';
    const canonical = '<p>一段<font size="4">小标题</font></p><ul><li>一项</li><li><b>二项</b></li></ul><p style="text-align: center;">居中</p>';
    expect(serializeRichDom(render(html))).toBe(canonical);
    expect(serializeRichDom(render(canonical))).toBe(canonical);
  });

  it('转义文本里的尖括号，格式不乱、内容不丢', () => {
    const host = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.appendChild(document.createTextNode('处置标准：3 < 5 & 6 > 4'));
    host.appendChild(paragraph);
    const html = serializeRichDom(host);
    expect(html).toBe('<p>处置标准：3 &lt; 5 &amp; 6 &gt; 4</p>');
    expect(text(html)).toBe('处置标准：3 < 5 & 6 > 4');
  });

  it('写下划线/删除线等行内标签，丢掉白名单外的属性', () => {
    const host = document.createElement('div');
    const paragraph = document.createElement('p');
    paragraph.setAttribute('onclick', 'alert(1)');
    const underline = document.createElement('u');
    underline.appendChild(document.createTextNode('重点'));
    paragraph.appendChild(underline);
    host.appendChild(paragraph);
    expect(serializeRichDom(host)).toBe('<p><u>重点</u></p>');
  });
});

describe('mendNestedLists：修掉 Chromium 的非法列表嵌套', () => {
  it('把 <p><ol> 里的列表搬到段落前面并删掉空段落', () => {
    const host = document.createElement('div');
    const paragraph = document.createElement('p');
    const list = document.createElement('ol');
    const item = document.createElement('li');
    item.appendChild(document.createTextNode('一项'));
    list.appendChild(item);
    paragraph.appendChild(list);
    host.appendChild(paragraph);
    expect(typeof mendNestedLists(host)).toBe('function');
    expect(host.querySelector('p')).toBeNull();
    expect(Array.from(host.children).map(node => node.tagName)).toEqual(['OL']);
    expect(serializeRichDom(host)).toBe('<ol><li>一项</li></ol>');
  });

  it('div 根下的列表本来就合法，不动它', () => {
    const host = render('<ul><li>一项</li></ul>');
    expect(mendNestedLists(host)).toBeNull();
    expect(host.querySelector('ul')).not.toBeNull();
  });
});


describe('文书表格渲染与保存', () => {
  it.each([
    '说明\n来源 | 状态\n气象 | 待核\n水文 | 已汇聚\n尾注',
    '<p>说明</p><p>来源 | 状态</p><p>气象 | 待核</p><p>水文 | 已汇聚</p><p>尾注</p>',
  ])('识别新文书与旧段落中的表格并保持编辑往返', value => {
    const host = render(value);
    expect(host.querySelectorAll('table')).toHaveLength(1);
    expect(host.querySelectorAll('th')).toHaveLength(2);
    expect(host.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(host.querySelector('td')?.textContent).toBe('气象');
    const restored = render(serializeRichDom(host));
    expect(restored.querySelectorAll('tbody tr')).toHaveLength(2);
    expect(restored.textContent).toContain('尾注');
  });
});


it('旧文书的斜杠资源段落恢复为表格，复合数量不串列', () => {
  const host = render('<p>三、队伍与人员状态时效</p><p>工程分队 / 36人 / 临水工程 / 候选待确认</p><p>装备/物资候选：</p><p>集结库 / 380t / 2000只 / 物料保障 / 候选待确认</p><p>状态以更新时间为准。</p>');
  expect(host.querySelectorAll('table')).toHaveLength(2);
  expect(host.querySelectorAll('table')[1].querySelectorAll('td')[1].textContent).toBe('380t / 2000只');
  expect(render(serializeRichDom(host)).querySelectorAll('table')).toHaveLength(2);
});
