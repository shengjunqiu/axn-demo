import { expect, type Page } from '@playwright/test';

/**
 * 通过输入框上方快捷任务发起：优先点关键推荐 chip；
 * 若不在主推区，则打开「更多动作」折叠菜单再点选。
 */
export async function clickQuickTask(page: Page, label: string) {
  const chips = page.locator('.axn-chips');
  const chip = chips.getByRole('button', { name: label, exact: true });
  if (await chip.count()) {
    await expect(chip).toBeVisible();
    await chip.click();
    return;
  }
  await chips.getByTestId('chip-more-actions').click();
  const item = page.getByRole('menuitem', { name: new RegExp(`^${label}`) });
  await expect(item).toBeVisible();
  await item.click();
}
