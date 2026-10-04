/**
 * 导航单向同步回归（task #5）：URL 是导航的唯一权威。
 *
 * 这里测的是 App 真正在用的 `useUrlNavSync`，不是复刻一份同样的 effect——
 * 「测试里复刻实现」正是当初没拦住这个 bug 的原因（复刻的实现里两个方向都在，
 * 于是测试自己也跟着挂住）。
 */
import { act, fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { NAV_PATH, PATH_TO_NAV, useUrlNavSync } from '@/components/nav/navRoutes';
import { useConversationStore } from '@/store/conversationStore';
import { resetDemoData } from '@/store/resetDemo';

let renders = 0;

function Shell() {
  renders += 1;
  const location = useLocation();
  useUrlNavSync();
  return (
    <div>
      <span data-testid="path">{location.pathname}</span>
      <Link to={NAV_PATH.library}>去文书库</Link>
      <Routes>
        <Route path="/assistant" element={<div>助理页</div>} />
        <Route path="/library" element={<div>文书库页</div>} />
      </Routes>
    </div>
  );
}

beforeEach(() => {
  resetDemoData();
  renders = 0;
});

describe('URL → store 单向同步', () => {
  it('路径表与 NavPage 一一对应（互反）', () => {
    for (const [path, nav] of Object.entries(PATH_TO_NAV)) {
      expect(NAV_PATH[nav]).toBe(path);
    }
  });

  it('URL 变了，侧栏高亮跟着变', () => {
    render(<MemoryRouter initialEntries={[NAV_PATH.assistant]}><Shell /></MemoryRouter>);
    expect(useConversationStore.getState().activeNav).toBe('assistant');

    fireEvent.click(screen.getByText('去文书库'));

    expect(screen.getByTestId('path').textContent).toBe(NAV_PATH.library);
    expect(useConversationStore.getState().activeNav).toBe('library');
  });

  it('外部改 store 的 activeNav：不动 URL、也不会无限渲染（死循环回归）', () => {
    render(<MemoryRouter initialEntries={[NAV_PATH.assistant]}><Shell /></MemoryRouter>);
    renders = 0;

    act(() => {
      useConversationStore.getState().setActiveNav('library');
    });

    // 旧实现里这里会被 store→URL 那个 effect 推成 /library，并且两个 effect 互推导致死循环。
    expect(screen.getByTestId('path').textContent).toBe(NAV_PATH.assistant);
    expect(renders).toBeLessThan(10);
  });
});
