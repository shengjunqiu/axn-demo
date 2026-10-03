import { expect, type Page } from '@playwright/test';

/** 通过用户可见入口发起任务；收纳的任务先展开菜单。 */
export async function clickQuickTask(page: Page, label: string) {
  const task = page.locator('.axn-chips').getByRole('button', { name: label, exact: true });
  const more = page.getByRole('button', { name: '更多任务', exact: true });
  const menuTask = page.getByTestId('quick-task-menu').getByRole('button', { name: label, exact: true, includeHidden: true });
  // 退出动画期间按钮仍可能可见；以菜单的展开状态决定是否需要重开。
  if (!await task.isVisible() || (await menuTask.count() > 0 && await more.getAttribute('aria-expanded') === 'false')) {
    await more.click();
    await expect(more).toHaveAttribute('aria-expanded', 'true');
  }
  await expect(task).toBeVisible();
  await task.click();
}
