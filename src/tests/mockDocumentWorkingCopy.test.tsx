/**
 * 模拟文书编辑缓冲回归（task #4）：未保存的工作副本放在 store 里，
 * 离开详情页再回来不丢，只有「保存」或「放弃修改」才让它消失。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import MockDocumentDetail from '@/components/doc/MockDocumentDetail';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { MOCK_DOCUMENTS, sameMockDocument } from '@/seed/mockDocuments';

// antd 的 message 走 portal 渲染，会造成 act 噪声；这里不测提示条，直接替掉。
vi.mock('antd', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('antd');
  return { ...actual, message: { info: vi.fn(), success: vi.fn(), warning: vi.fn() } };
});

const SCOPE = 'session-test';
const DOCUMENT = MOCK_DOCUMENTS[0];
const workingOf = () => useMockDocumentStore.getState().libraries[SCOPE]?.working[DOCUMENT.id];

function mount(onSave = vi.fn(), onDirtyChange = vi.fn()) {
  const view = render(
    <MockDocumentDetail scope={SCOPE} document={DOCUMENT} onClose={() => {}} onSave={onSave} onDirtyChange={onDirtyChange} />,
  );
  return { view, onSave, onDirtyChange };
}

beforeEach(() => {
  useMockDocumentStore.setState({ libraries: {} });
});

describe('模拟文书编辑缓冲', () => {
  it('输入即写入 store，并上报未保存状态', () => {
    const { onDirtyChange } = mount();

    fireEvent.click(screen.getByRole('button', { name: '在线编辑' }));
    fireEvent.change(screen.getByLabelText('文书标题'), { target: { value: '改过的标题' } });

    expect(workingOf()?.title).toBe('改过的标题');
    expect(onDirtyChange).toHaveBeenLastCalledWith(true);
  });

  it('离开详情页再回来，未保存的改动仍在，且直接回到编辑态', () => {
    const first = mount();
    fireEvent.click(screen.getByRole('button', { name: '在线编辑' }));
    fireEvent.change(screen.getByLabelText('文书标题'), { target: { value: '离开前改的标题' } });
    first.view.unmount();

    mount();

    expect((screen.getByLabelText('文书标题') as HTMLInputElement).value).toBe('离开前改的标题');
    expect(screen.getByTestId('mock-dirty-note')).toBeTruthy();
  });

  it('「放弃修改」清除工作副本', () => {
    const { onDirtyChange } = mount();
    fireEvent.click(screen.getByRole('button', { name: '在线编辑' }));
    fireEvent.change(screen.getByLabelText('文书标题'), { target: { value: '不要的标题' } });

    fireEvent.click(screen.getByRole('button', { name: '放弃修改' }));

    expect(workingOf()).toBeUndefined();
    expect(onDirtyChange).toHaveBeenLastCalledWith(false);
  });

  it('保存写回文书库并清掉工作副本', () => {
    const { onSave } = mount();
    fireEvent.click(screen.getByRole('button', { name: '在线编辑' }));
    fireEvent.change(screen.getByLabelText('文书标题'), { target: { value: '保存的标题' } });

    fireEvent.click(screen.getByRole('button', { name: '保存修改' }));

    // 父组件（DocCenterPanel）的 onSave 就是写回当前会话的模拟文书库。
    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0];
    expect(saved.title).toBe('保存的标题');
    act(() => { useMockDocumentStore.getState().update(SCOPE, saved); });
    expect(workingOf()).toBeUndefined();    expect(useMockDocumentStore.getState().libraries[SCOPE].documents[0].title).toBe('保存的标题');
  });

  it('连续输入不做整篇文书序列化（性能回归）', () => {
    const original = JSON.stringify;
    let documentSerializations = 0;
    const isDocument = (value: unknown) =>
      typeof value === 'object' && value !== null && 'sections' in value && 'title' in value;
    JSON.stringify = function (value: unknown, ...rest: unknown[]) {
      if (isDocument(value)) documentSerializations += 1;
      return (original as (...args: unknown[]) => string)(value, ...rest);
    } as typeof JSON.stringify;
    try {
      mount();
      fireEvent.click(screen.getByRole('button', { name: '在线编辑' }));
      documentSerializations = 0;
      const field = screen.getByLabelText('文书标题') as HTMLInputElement;
      for (let i = 0; i < 30; i++) fireEvent.change(field, { target: { value: `标题第 ${i} 版` } });
      // 原来是「每次击键 4 次整篇 JSON.stringify」（dirty 判断 ×1 + 改回原文判断 ×1，各序列化两份）。
      expect(documentSerializations).toBe(0);
    } finally {
      JSON.stringify = original;
    }
  });
});

describe('sameMockDocument', () => {
  it('逐字段比较：sections 长度与标题/正文任一不同即不等', () => {
    const base = MOCK_DOCUMENTS[0];
    expect(sameMockDocument(base, { ...base })).toBe(true);
    expect(sameMockDocument(base, base)).toBe(true);
    expect(sameMockDocument(base, { ...base, title: '改过的标题' })).toBe(false);
    expect(sameMockDocument(base, { ...base, number: '应急值〔2026〕999号' })).toBe(false);
    expect(sameMockDocument(base, { ...base, sections: [...base.sections.slice(0, -1)] })).toBe(false);
    expect(sameMockDocument(base, { ...base, sections: base.sections.map((s, i) => (i === 0 ? (['改了标题', s[1]] as const) : s)) })).toBe(false);
    expect(sameMockDocument(base, { ...base, sections: base.sections.map((s, i) => (i === 0 ? ([s[0], '改了正文'] as const) : s)) })).toBe(false);
  });
});

describe('模拟文书提交到原系统', () => {
  it('工具栏可打开确认框并写回 handoff 回执', async () => {
    const onSave = vi.fn();
    mount(onSave);

    fireEvent.click(screen.getByTestId('submit-to-original-btn'));
    expect(screen.getByText('确认提交到原系统')).toBeTruthy();

    fireEvent.click(screen.getByTestId('transfer-check'));
    fireEvent.click(screen.getByTestId('confirm-submit-original'));

    expect(onSave).toHaveBeenCalledTimes(1);
    const saved = onSave.mock.calls[0][0] as typeof DOCUMENT;
    expect(saved.handoff?.status).toBe('uploaded');
    expect(saved.handoff?.target?.length).toBeGreaterThan(0);
    expect(saved.handoff?.receiptId).toMatch(/^AXN-RCPT-/);
  });
});
