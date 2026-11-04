import { beforeEach, describe, expect, it } from 'vitest';
import { diffDocuments, diffText, summarizeDiff } from '@/services/docDiff';
import { MOCK_DOCUMENTS as mockDocuments } from '@/seed/mockDocuments';
import { useMockDocumentStore, versionsOf, mockVersionHistory } from '@/store/mockDocumentStore';

const join = (ops: { t: number; s: string }[], t: number) => ops.filter(o => o.t === t || o.t === 0).map(o => o.s).join('');

describe('diffText', () => {
  it('按字标出中文修订，并能还原两端原文', () => {
    const a = '截至20时，清河段水位42.3米，管涌点2处。';
    const b = '截至21时，清河段水位42.8米，管涌点3处，已组织抢护。';
    const ops = diffText(a, b);
    expect(join(ops, -1)).toBe(a);
    expect(join(ops, 1)).toBe(b);
    // 数字整段替换，不拆成半个
    expect(ops).toContainEqual({ t: -1, s: '42.3' });
    expect(ops).toContainEqual({ t: 1, s: '42.8' });
  });

  it('相同文本没有改动', () => {
    expect(diffText('一致', '一致')).toEqual([{ t: 0, s: '一致' }]);
  });
});

describe('diffDocuments / summarizeDiff', () => {
  it('统计改动处数、增删字数并按章节归类', () => {
    const before = mockDocuments[0];
    const after = {
      ...before,
      title: `${before.title}（修订）`,
      sections: before.sections.map(([h, b], i) => [h, i === 0 ? `${b}补充一句说明。` : b] as const),
    };
    const diff = diffDocuments(before, after);
    expect(diff.hunks).toBe(2);
    expect(diff.added).toBeGreaterThan(0);
    expect(diff.removed).toBe(0);
    expect(summarizeDiff(diff)).toMatch(/^改了 2 处：标题、/);
  });
});

describe('公文版本', () => {
  beforeEach(() => useMockDocumentStore.getState().reset());
  const author = { kind: 'user' as const, name: '张明远', role: '值班员' };

  it('模拟历史包含三个不同快照，最新版保留当前正文', () => {
    const doc = mockDocuments[0];
    const history = mockVersionHistory(doc);
    expect(history.map(v => v.no)).toEqual([1, 2, 3]);
    expect(history[2].snapshot).toBe(doc);
    expect(history[0].snapshot.sections).not.toEqual(history[1].snapshot.sections);
    expect(history[1].snapshot.sections).not.toEqual(doc.sections);
    expect(history[2].stats?.hunks).toBeGreaterThan(0);
  });

  it('自动保存合并同一轮编辑，手动保存后另起一版', () => {
    const store = useMockDocumentStore.getState();
    const doc = mockDocuments[0];
    store.update('library', { ...doc, title: '自动稿一' }, { author, source: 'autosave' });
    store.update('library', { ...doc, title: '自动稿二' }, { author, source: 'autosave' });
    let history = versionsOf(useMockDocumentStore.getState().libraries.library, doc);
    expect(history.map(v => v.no)).toEqual([1, 2, 3, 4]);
    expect(history[0].snapshot.title).toBe(doc.title);
    expect(history[3].snapshot.title).toBe('自动稿二');

    store.update('library', { ...doc, title: '自动稿二' }, { author });
    store.update('library', { ...doc, title: '下一轮自动稿' }, { author, source: 'autosave' });
    history = versionsOf(useMockDocumentStore.getState().libraries.library, doc);
    expect(history.map(v => v.no)).toEqual([1, 2, 3, 4, 5]);
    expect(history[3]).toMatchObject({ source: 'edit', snapshot: { title: '自动稿二' } });
  });

  it('自动保存不覆盖定稿版本', () => {
    const store = useMockDocumentStore.getState();
    const doc = mockDocuments[0];
    store.update('library', { ...doc, title: '定稿内容' }, { author, source: 'autosave' });
    store.toggleFinal('library', doc.id, 4);
    store.update('library', { ...doc, title: '后续修改' }, { author, source: 'autosave' });
    const history = versionsOf(useMockDocumentStore.getState().libraries.library, doc);
    expect(history).toHaveLength(5);
    expect(history[3]).toMatchObject({ final: true, snapshot: { title: '定稿内容' } });
  });

  it('每次保存生成新版本，恢复不删除历史', () => {
    const store = useMockDocumentStore.getState();
    const doc = mockDocuments[0];
    expect(versionsOf(useMockDocumentStore.getState().libraries.library, doc)).toHaveLength(3);

    store.update('library', { ...doc, title: '改后标题' }, { author });
    store.update('library', { ...doc, title: '再改标题' }, { author, note: '按领导意见' });
    let versions = versionsOf(useMockDocumentStore.getState().libraries.library, doc);
    expect(versions.map(v => v.no)).toEqual([1, 2, 3, 4, 5]);
    expect(versions[4].note).toBe('按领导意见');
    expect(versions[4].stats?.summary).toMatch(/标题/);

    // 内容没变不生成版本
    store.update('library', { ...doc, title: '再改标题' }, { author });
    expect(versionsOf(useMockDocumentStore.getState().libraries.library, doc)).toHaveLength(5);

    store.restoreVersion('library', doc.id, 1, author);
    versions = versionsOf(useMockDocumentStore.getState().libraries.library, doc);
    expect(versions).toHaveLength(6);
    expect(versions[5]).toMatchObject({ no: 6, source: 'restore', restoredFrom: 1 });
    expect(versions[5].snapshot.title).toBe(doc.title);
  });
});
