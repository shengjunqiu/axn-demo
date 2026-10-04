/**
 * HashRouter 路由回归测试（task #3 新增行为保护）。
 *
 * 覆盖：
 * 1. URL→页面映射——每个合法路径渲染对应的导航页
 * 2. 非法路径→回退到 /assistant
 * 3. URL→store 单向同步（真实行为，不存在反方向同步）
 * 4. 映射表完整性（从源码导入，不自建副本）
 */
import { act, render, waitFor } from '@testing-library/react';
import { useEffect } from 'react';
import { MemoryRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';
import { useConversationStore } from '@/store/conversationStore';
import { resetDemoData } from '@/store/resetDemo';
import { PATH_TO_NAV, NAV_PATH } from '@/components/nav/navRoutes';

/** 精简版路由外壳，不含 antd/lazy 依赖，只验证路由同步逻辑。 */
function RoutingShell() {
  const location = useLocation();
  const activeNav = useConversationStore((s) => s.activeNav);
  const setActiveNav = useConversationStore((s) => s.setActiveNav);

  // URL→store 单向同步（与 App.tsx 的 useUrlNavSync 一致；store 从不推回 URL）。
  useEffect(() => {
    const page = PATH_TO_NAV[location.pathname];
    if (page && page !== activeNav) {
      setActiveNav(page);
    }
  }, [location.pathname, activeNav, setActiveNav]);

  return (
    <Routes>
      <Route path="/assistant" element={<div data-testid="page" className="page-assistant">Assistant</div>} />
      <Route path="/library" element={<div data-testid="page" className="page-library">Library</div>} />
      <Route path="/projects" element={<div data-testid="page" className="page-projects">Projects</div>} />
      <Route path="/agents" element={<div data-testid="page" className="page-agents">Agents</div>} />
      <Route path="/schedules" element={<div data-testid="page" className="page-schedules">Schedules</div>} />
      <Route path="/knowledge" element={<div data-testid="page" className="page-knowledge">Knowledge</div>} />
      <Route path="*" element={<Navigate to="/assistant" replace />} />
    </Routes>
  );
}

function renderRouting(initialEntries: string[] = ['/assistant']) {
  return render(
    <MemoryRouter initialEntries={initialEntries}>
      <RoutingShell />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  resetDemoData();
});

describe('HashRouter 路由同步', () => {
  it('1. /assistant 路由匹配 assistant 页', () => {
    renderRouting(['/assistant']);
    expect(document.querySelector('.page-assistant')).toBeTruthy();
    expect(document.querySelector('.page-library')).toBeNull();
  });

  it('2. 每个合法路由渲染对应页面', () => {
    const cases = [
      { path: '/assistant', cls: 'page-assistant' },
      { path: '/library', cls: 'page-library' },
      { path: '/projects', cls: 'page-projects' },
      { path: '/agents', cls: 'page-agents' },
      { path: '/schedules', cls: 'page-schedules' },
      { path: '/knowledge', cls: 'page-knowledge' },
    ];
    for (const { path, cls } of cases) {
      const { unmount } = renderRouting([path]);
      expect(document.querySelector(`.${cls}`)).toBeTruthy();
      unmount();
    }
  });

  it('3. 非法路径回退到 /assistant', async () => {
    renderRouting(['/nope']);
    await waitFor(() => {
      expect(document.querySelector('.page-assistant')).toBeTruthy();
    });
  });

  it('4. URL→store 同步：URL 改变后 activeNav 跟随更新', () => {
    renderRouting(['/projects']);
    expect(useConversationStore.getState().activeNav).toBe('projects');
  });

  it('5. store→URL 不同步：setActiveNav 不应改变渲染的页面', () => {
    renderRouting(['/assistant']);
    expect(document.querySelector('.page-assistant')).toBeTruthy();

    act(() => {
      useConversationStore.getState().setActiveNav('knowledge');
    });
    // store→URL 不存在，页面应当仍然是 assistant
    expect(document.querySelector('.page-assistant')).toBeTruthy();
    expect(document.querySelector('.page-knowledge')).toBeNull();
  });

  it('6. 映射表从源码导入且双向一致', () => {
    const navPages = ['assistant', 'library', 'projects', 'agents', 'schedules', 'knowledge'] as const;
    for (const page of navPages) {
      expect(PATH_TO_NAV[NAV_PATH[page]]).toBe(page);
      expect(NAV_PATH[PATH_TO_NAV[`/${page}`]]).toBe(`/${page}`);
    }
  });
});