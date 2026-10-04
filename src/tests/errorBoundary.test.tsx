/**
 * 兜底错误页测试（task #2）：出错时不白屏、可重试、可一键回到种子状态。
 * 对应产品红线：演示现场不允许出现无提示的白屏。
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render } from '@testing-library/react';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { resetDemoData } from '@/store/resetDemo';
import { useConversationStore } from '@/store/conversationStore';
import { useDemoStore } from '@/store/demoStore';
import { useWorkspaceStore } from '@/store/workspaceStore';

/** 渲染即抛错的子组件；failFlag 由测试控制，用于验证「重试」能否恢复。 */
let failFlag = true;
function Bomb() {
  if (failFlag) throw new Error('boom-测试异常');
  return <div>恢复后的内容</div>;
}

let errorSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  failFlag = true;
  resetDemoData();
  // React 会把边界捕获的异常照常打到 console.error，这里静音以免污染测试输出。
  errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  errorSpy.mockRestore();
});

describe('兜底错误页', () => {
  it('未出错时原样渲染子树', () => {
    failFlag = false;
    const view = render(
      <ErrorBoundary>
        <div>正常内容</div>
      </ErrorBoundary>,
    );
    expect(view.getByText('正常内容')).toBeTruthy();
    expect(view.queryByText('页面出错了')).toBeNull();
  });

  it('子树抛错时显示兜底页，并保留技术细节', () => {
    const view = render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );

    expect(view.getByText('页面出错了')).toBeTruthy();
    expect(view.getByRole('button', { name: /^重\s*试$/ })).toBeTruthy();
    expect(view.getByRole('button', { name: '重置演示数据' })).toBeTruthy();
    // 技术细节默认折叠，但错误信息已在 DOM 内，便于现场排查。
    expect(view.getByText(/boom-测试异常/)).toBeTruthy();
    expect(errorSpy).toHaveBeenCalled();
  });

  it('「重试」在错误消失后重新渲染子树', () => {
    const view = render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(view.getByText('页面出错了')).toBeTruthy();

    failFlag = false;
    fireEvent.click(view.getByRole('button', { name: /^重\s*试$/ }));

    expect(view.getByText('恢复后的内容')).toBeTruthy();
    expect(view.queryByText('页面出错了')).toBeNull();
  });

  it('「重置演示数据」回到种子状态并退出兜底页', () => {
    useDemoStore.getState().setPace('fast');
    useConversationStore.getState().setActiveNav('library');
    useWorkspaceStore.getState().setDirty('scope-test', true);

    const view = render(
      <ErrorBoundary>
        <Bomb />
      </ErrorBoundary>,
    );
    expect(view.getByText('页面出错了')).toBeTruthy();

    failFlag = false;
    fireEvent.click(view.getByRole('button', { name: '重置演示数据' }));

    expect(useDemoStore.getState().pace).toBe('normal');
    expect(useConversationStore.getState().activeNav).toBe('assistant');
    expect(useWorkspaceStore.getState().isDirty('scope-test')).toBe(false);
    expect(view.queryByText('页面出错了')).toBeNull();
  });
});
