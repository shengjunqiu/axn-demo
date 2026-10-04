/**
 * 模拟文书编辑缓冲回归（task #4）：未保存的工作副本放在 store 里，
 * 离开详情页再回来不丢，只有「保存」或「放弃修改」才让它消失。
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import MockDocumentDetail from '@/components/doc/MockDocumentDetail';
import { useMockDocumentStore } from '@/store/mockDocumentStore';
import { MOCK_DOCUMENTS } from '@/seed/mockDocuments';

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
});
