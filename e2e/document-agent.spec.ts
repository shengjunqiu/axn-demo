import { expect, test } from '@playwright/test';

test('文书智能体：列表、详情与对话生成', async ({ page }) => {
  await page.goto('/');
  const panel = page.locator('.doc-center');
  await expect(panel.getByRole('heading', { name: '文书生成智能体' })).toBeVisible();
  await expect(panel.locator('.doc-library-row')).toHaveCount(4);
  await expect(panel.locator('.doc-sample-row')).toHaveCount(8);
  for (const name of ['值班日报', '应急要情', '会议纪要', '工作总结']) {
    const category = panel.locator('.doc-category').filter({ hasText: name });
    await category.locator('.doc-sample-row').first().click();
    await expect(panel.getByTestId('mock-redhead-document')).toBeVisible();
    await expect(panel.locator('.axn-redhead-org')).toHaveText('应急管理');
    await panel.getByRole('button', { name: '返回文书列表' }).click();
    await category.getByRole('button', { name: `生成${name}`, exact: true }).click();
    await expect(panel.getByText('正在生成文书', { exact: true })).toBeVisible();
    await expect(panel.getByTestId('mock-redhead-document')).toContainText('新生成');
    await panel.getByRole('button', { name: '返回文书列表' }).click();
    await expect(category.locator('.doc-sample-row')).toHaveCount(3);
  }
  await page.screenshot({ path: 'artifacts/document-agent-library.png' });
  const send = async (text: string) => {
    await page.getByPlaceholder(/向安小能发送指令/).fill(text);
    await page.keyboard.press('Enter');
  };
  await send('生成应急要情');
  await expect(panel.getByText('正在生成文书', { exact: true })).toBeVisible();
  await expect(panel.getByText('正在生成文书', { exact: true })).toBeHidden({ timeout: 20000 });
  await expect(panel.locator('.doc-library-row')).toHaveCount(4);
  await send('报送单位是清河防汛分指挥部值班室');
  await expect(page.locator('.axn-task-card', { hasText: '补录报送单位' }).last().getByText('已完成')).toBeVisible({ timeout: 20000 });
  await send('生成应急要情');
  await expect(panel.getByText('正在生成文书', { exact: true })).toBeVisible();
  await expect(panel.locator('article.doc-detail-paper')).toBeVisible({ timeout: 20000 });
  await expect(panel.locator('article.doc-detail-paper')).toContainText('清河防汛分指挥部值班室');
  await page.screenshot({ path: 'artifacts/document-agent-detail.png' });
  await panel.getByRole('button', { name: '返回文书列表' }).click();
  await expect(panel.locator('article.doc-detail-paper')).toHaveCount(0);
  await panel.locator('.doc-card .ant-btn-link').click();
  await expect(panel.locator('article.doc-detail-paper')).toBeVisible();
});

test('聊天文书快捷操作无需补录即可生成右侧模拟红头文书', async ({ page }) => {
  await page.goto('/');
  const panel = page.locator('.doc-center');
  for (const [name, title] of [['值班日报', '防汛值守日报'], ['应急要情', '重点河段险情处置要情']]) {
    await page.locator('.axn-chips').getByRole('button', { name: `生成${name}`, exact: true }).click();
    const workflow = page.getByTestId('document-generation-card').last();
    await expect(workflow).toContainText('正在整理已收集的文书要素');
    await expect(workflow).toContainText('编制单位');
    await expect(workflow).toContainText('以下模拟用户已提供并确认的信息');
    await expect(workflow).toContainText('正在调用文书生成智能体…');
    await expect(workflow).toContainText('正在生成文书…');
    await expect(panel.getByText('正在生成文书', { exact: true })).toBeVisible();
    await expect(panel.getByTestId('mock-redhead-document')).toContainText(`${title}（新生成）`);
    await expect(panel.locator('.axn-redhead-org')).toHaveText('应急管理');
    await expect(workflow).toContainText('红头文书已生成');
    await expect(workflow).toContainText('要素齐备，已确认（模拟）');
    await expect(panel.getByTestId('mock-redhead-document')).not.toContainText('文书要素（模拟收集）');
    await expect(page.getByText(`已生成《${title}（新生成）》（模拟文书），请在右侧文书生成智能体查看红头文书详情。`)).toBeVisible();
    await panel.getByRole('button', { name: '返回文书列表' }).click();
    await expect(panel.locator('.doc-category').filter({ hasText: name }).locator('.doc-sample-row')).toHaveCount(3);
  }
});
