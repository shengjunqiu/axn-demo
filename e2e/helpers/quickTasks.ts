import { expect, type Page } from '@playwright/test';
import { tenderName, tenderTaskPrompt } from '../../src/seed/tenderNames';

/**
 * 通过输入框上方快捷任务发起：优先点关键推荐 chip；
 * 若不在主推区，则打开「更多动作」折叠菜单再点选。
 * `label` 可为内部动作键或界面展示名。
 */
export async function clickQuickTask(page: Page, label: string) {
  const internal = tenderTaskPrompt(label);
  const names = [...new Set([tenderName(internal), tenderName(label), label, internal])];
  const chips = page.locator('.axn-chips');
  for (const name of names) {
    const chip = chips.getByRole('button', { name, exact: true });
    if (await chip.count()) {
      await expect(chip).toBeVisible();
      await chip.click();
      return;
    }
  }
  await chips.getByTestId('chip-more-actions').click();
  const pattern = names.map(escapeRegExp).join('|');
  const item = page.getByRole('menuitem', { name: new RegExp(`^(${pattern})`) });
  await expect(item).toBeVisible();
  await item.click();
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
