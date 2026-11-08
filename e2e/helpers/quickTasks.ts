import { expect, type Page } from '@playwright/test';

/** 智能体入口在当前对话追加自我介绍，能力按钮横排展示在输入框上方。兼容调用处使用的简短名称。 */
export async function openQuickTaskMenu(page: Page, label: string) {
  const name = label.endsWith('智能体') ? label : `${label}智能体`;
  const chip = page.locator('.axn-chips').getByRole('button', { name, exact: true });
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(page.getByTestId('agent-capability-bar')).toBeVisible();
}

export async function clickQuickTask(page: Page, label: string, task?: string) {
  await openQuickTaskMenu(page, label);
  if (task) await page.getByTestId('agent-capability-bar').getByRole('button', { name: task, exact: true }).click();
}

export async function clickDocTask(page: Page, name: string) {
  // 文书类型按钮只填模板句，回车发送后才开始生成
  await openQuickTaskMenu(page, '文书生成智能体');
  await expect(page.locator('.ant-sender-input')).toHaveValue(/帮我写一份/);
  await page.getByTestId('agent-capability-bar').getByRole('button', { name, exact: true }).click();
  await expect(page.locator('.ant-sender-input')).toHaveValue(new RegExp(name));
  await page.locator('.ant-sender-input').press('Enter');
}

/** 应急要情生成前先在会话流里铺一张表头表单（用户 m00167）：期号/审阅人/报送/承办/值班员/值班电话。
 *  默认值已预填，直接确认即出件；传 overrides 可改其中几项（键是输入框的 data-testid）；
 *  传 images 会先通过附图选择器上传（用户 m00215）。 */
export async function submitBriefForm(page: Page, overrides: Record<string, string> = {}, images: { name: string; mimeType: string; buffer: Buffer }[] = []) {
  const form = page.getByTestId('brief-form');
  await expect(form).toBeVisible();
  for (const [testId, value] of Object.entries(overrides)) await form.getByTestId(testId).fill(value);
  if (images.length) {
    await form.getByTestId('brief-form-images').locator('input[type=file]').setInputFiles(images);
    await expect(form.locator('.axn-brief-form-thumb')).toHaveCount(images.length);
  }
  await form.getByTestId('brief-form-submit').click();
  await expect(form).toHaveCount(0);
}
