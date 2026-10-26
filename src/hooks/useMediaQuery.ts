import { useEffect, useState } from 'react';

/**
 * 响应式媒体查询 hook：监听窗口宽度并返回是否命中 `query`。
 * 折叠 inline style 会压掉 media query（inline 优先级更高），所以窄屏判断必须走 JS。
 * 使用 `change` 事件订阅并在卸载时移除监听。
 *
 * ⚠ 断点必须与 src/styles/global.css 的 @media (max-width: 767px) 保持一致。
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia(query).matches : false,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = (e: MediaQueryListEvent) => setMatches(e.matches);
    setMatches(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

/** 窄屏（手机 / 抽屉形态）判定 —— 全应用只此一个来源，避免各处写死同一个 query。 */
export const COMPACT_QUERY = '(max-width: 767px)';

export function useIsCompact(): boolean {
  return useMediaQuery(COMPACT_QUERY);
}
