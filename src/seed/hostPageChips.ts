/**
 * 一期原系统嵌入页（/phase1/:system?page=）的安小能底部快捷按钮覆盖。
 * 未配置的页面仍走阶段主推 chips；有配置时仅展示该页指定按钮。
 */

export type HostPageChipItem = {
  label: string;
  agentId: string;
  agentName: string;
  /** 点击后实际触发的动作键（可与展示 label 相同） */
  action: string;
  /** 悬停说明 */
  title?: string;
};

export type HostPageChipOverride = {
  system: string;
  pageId: string;
  primary: HostPageChipItem[];
  hideMoreActions?: boolean;
  hideScenarioLabel?: boolean;
};

/** 页面级 chips：暂时仅装备清单（W02）配置资源校验对比一个按钮。 */
export const HOST_PAGE_CHIP_OVERRIDES: HostPageChipOverride[] = [
  {
    system: 'business',
    pageId: 'W02',
    hideMoreActions: true,
    hideScenarioLabel: true,
    primary: [
      {
        label: '资源数据校验对比',
        action: '资源数据校验对比',
        agentId: 'agent-resource',
        agentName: '救援资源管理智能体',
        title: '通过智能体自动校验资源管理的数据问题，并给出对比',
      },
    ],
  },
];

function phase1System(pathname: string): string | null {
  const match = pathname.match(/^\/phase1\/([^/?#]+)/);
  return match?.[1] ?? null;
}

export function hostPageChipOverride(
  pathname: string,
  search: string,
): HostPageChipOverride | null {
  const system = phase1System(pathname);
  if (!system) return null;
  const pageId = new URLSearchParams(search.startsWith('?') ? search.slice(1) : search).get('page');
  if (!pageId) return null;
  return HOST_PAGE_CHIP_OVERRIDES.find((item) => item.system === system && item.pageId === pageId) ?? null;
}
