/**
 * 路由映射与「URL → store」单向同步。
 *
 * 约定：**URL 是导航的唯一权威**。侧栏高亮用的 `activeNav` 只是 URL 的镜像，
 * 由 `useUrlNavSync` 写入；代码里要跳页请直接 `navigate(NAV_PATH.xxx)`。
 *
 * 这里绝不能出现反方向（store → URL）的同步：两个 effect 会在同一个提交里
 * 拿着同一份「已经对不上」的快照各改一半——一个把 URL 推回去、一个把
 * store 拉回来，于是 (pathname, activeNav) 在两个状态之间无限对推。
 * 实测外部改一次 store 后 200ms 内渲染 137 次（浏览器里就是卡死），
 * 在 act() 下则永不返回（表现为测试挂住）。
 */
import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import type { NavPage } from '@/domain/types';
import { useConversationStore } from '@/store/conversationStore';

/** URL 路径 → NavPage（App.tsx 的路由表与此处的跳转共用同一套路径）。 */
export const PATH_TO_NAV: Record<string, NavPage> = {
  '/assistant': 'assistant',
  '/library': 'library',
  '/projects': 'projects',
  '/agents': 'agents',
  '/schedules': 'schedules',
  '/knowledge': 'knowledge',
};

/** NavPage → URL 路径。代码内跳页统一用 `navigate(NAV_PATH.library)`，不要写路径字面量。 */
export const NAV_PATH: Record<NavPage, string> = {
  assistant: '/assistant',
  library: '/library',
  projects: '/projects',
  agents: '/agents',
  schedules: '/schedules',
  knowledge: '/knowledge',
};

/** URL → store（单向）：只用来驱动侧栏高亮，不参与任何跳转决策。 */
export function useUrlNavSync(): void {
  const location = useLocation();
  const activeNav = useConversationStore((s) => s.activeNav);
  const setActiveNav = useConversationStore((s) => s.setActiveNav);

  useEffect(() => {
    const page = PATH_TO_NAV[location.pathname];
    if (page && page !== activeNav) {
      setActiveNav(page);
    }
  }, [location.pathname, activeNav, setActiveNav]);
}
