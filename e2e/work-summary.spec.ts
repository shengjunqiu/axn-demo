import { clickQuickTask } from './helpers/quickTasks';
import { expect, test } from '@playwright/test';

for (const entry of ['分类按钮', '对话输入', '快捷操作'] as const) {
  test(`抢险总结通过${entry}自动汇总并生成报告`, async ({ page }) => {
    await page.goto('/');
    if (entry === '分类按钮') {
      await page.goto('/#/library');
      await page.getByTestId('document-library').getByRole('tab', { name: /^工作总结 / }).click();
      await page.getByTestId('document-library').getByRole('button', { name: '生成工作总结', exact: true }).click();
    } else if (entry === '快捷操作') {
      await clickQuickTask(page, '生成工作总结');
    } else {
      await page.getByPlaceholder(/向安小能发送指令/).fill('请生成抢险总结');
      await page.keyboard.press('Enter');
    }
    const card = page.getByTestId('document-generation-card').last();
    await expect(card).toContainText(/自动汇总复盘要素|正在生成文书|已完成/, { timeout: 20000 });
    await expect(card).toContainText(/已完成|红头文书已生成/, { timeout: 20000 });
    const doc = page.getByTestId('mock-redhead-document');
    await expect(doc).toBeVisible({ timeout: 15000 });
    await expect(doc).not.toContainText('文书要素（模拟收集）');
  });
}
