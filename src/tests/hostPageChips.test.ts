import { describe, expect, it } from 'vitest';
import { hostPageChipOverride } from '@/seed/hostPageChips';

describe('hostPageChips', () => {
  it('装备清单 W02 仅配置资源数据校验对比一个按钮', () => {
    const override = hostPageChipOverride('/phase1/business', '?page=W02&event=');
    expect(override).toBeTruthy();
    expect(override!.hideMoreActions).toBe(true);
    expect(override!.hideScenarioLabel).toBe(true);
    expect(override!.primary).toHaveLength(1);
    expect(override!.primary[0]?.label).toBe('资源数据校验对比');
    expect(override!.primary[0]?.action).toBe('资源数据校验对比');
    expect(override!.primary[0]?.title).toMatch(/自动校验资源管理的数据问题/);
  });

  it('未配置页面不覆盖默认 chips', () => {
    expect(hostPageChipOverride('/phase1/business', '?page=W01')).toBeNull();
    expect(hostPageChipOverride('/assistant', '?page=W02')).toBeNull();
    expect(hostPageChipOverride('/phase1/business', '')).toBeNull();
  });
});
