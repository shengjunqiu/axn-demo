import { clickQuickTask } from './helpers/quickTasks';
import { expect, test } from '@playwright/test';

for (const entry of ['分类按钮', '对话输入', '快捷操作']) {
  test(`工作总结通过${entry}逐轮收集复盘要素并生成报告`, async ({ page }) => {
    await page.goto('/');
    if (entry === '分类按钮') {
      await page.locator('.axn-gs-nav-item', { hasText: '文书库' }).first().click();
      await page.getByTestId('document-library').getByRole('button', { name: '生成工作总结', exact: true }).click();
    } else if (entry === '快捷操作') {
      await clickQuickTask(page, '生成工作总结');
    } else {
      await page.getByPlaceholder(/向安小能发送指令/).fill('请生成工作总结');
      await page.keyboard.press('Enter');
    }
    const card = page.getByTestId('document-generation-card').last();
    await expect(card).toContainText('正在收集复盘要素');
    await expect(card.locator('.axn-summary-round').first()).toContainText('总结什么阶段');
    await expect(card).toContainText('模拟补充 · 已确认');
    await expect(card).toContainText('待补充', { timeout: 15000 });
    await expect(page.getByTestId('mock-redhead-document')).toHaveCount(0);
    await expect(page.locator('.doc-center .doc-generation')).toContainText('等待补充改进计划');
    await expect(page.locator('.doc-center .doc-library-row')).toHaveCount(0);
    const submit = card.getByRole('button', { name: '提交并生成工作总结' });
    await expect(submit).toBeDisabled();
    const answer = '通信保障组下周完成采购需求评估，后勤组完善服装与餐食保障，落实人员轮换机制。';
    if (entry === '分类按钮') {
      await page.reload();
      await expect(card).toContainText('待补充');
      await expect(page.locator('.doc-center .doc-generation')).toContainText('等待补充改进计划');
      await card.getByRole('textbox', { name: '下一步改进措施' }).fill(answer);
      await submit.click();
    } else {
      await page.getByPlaceholder(/向安小能发送指令/).fill(answer);
      await page.keyboard.press('Enter');
    }
    await expect(card).toContainText('用户补充 · 已确认');
    await expect(page.locator('.doc-center .doc-generation')).toContainText('正在生成文书');
    await expect(card).toContainText('红头文书已生成', { timeout: 15000 });
    await expect(card.locator('.axn-summary-round')).toHaveCount(6);
    for (const text of ['资源消耗', '通信', '人员轮换', '餐食', '服装', '集合列队', '采购']) {
      await expect(card).toContainText(text);
    }
    const doc = page.getByTestId('mock-redhead-document');
    await expect(doc).toContainText('深刻启示');
    await expect(doc).toContainText('下一步工作');
    await expect(doc).toContainText(answer);
    await expect(doc).not.toContainText('模拟补充 · 已确认');
    await expect(doc).not.toContainText('文书要素（模拟收集）');
  });
}
