import { expect, type Page } from '@playwright/test';

/** 通过输入框上方的快捷任务 chip 发起任务（全部 chip 常驻平铺，不再有「更多任务」浮层）。 */
export async function clickQuickTask(page: Page, label: string) {
  const chip = page.locator('.axn-chips').getByRole('button', { name: label, exact: true });
  await expect(chip).toBeVisible();
  await chip.click();
}
