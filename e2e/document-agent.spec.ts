import { clickQuickTask } from './helpers/quickTasks';
/**
 * 文书智能体 E2E（UI 改版适配）：
 * 独立「文书库」页负责分类浏览 / 生成 / 样稿打开；样稿与草稿的阅读详情在助理页右侧「文书工作区」呈现，
 * 由显式「关闭文书」回到宽对话。业务断言（分类 4、样稿 8、生成回写、工作总结补充、真实草稿打开、
 * 在线编辑/取消/导出为预览不下载）保持不降级。
 */
import { expect, test, type Page } from '@playwright/test';

async function openLibrary(page: Page) {
  await page.locator('.axn-gs-nav-item', { hasText: '文书库' }).first().click();
  await expect(page.getByTestId('document-library-page')).toBeVisible();
}

async function closeWorkspace(page: Page) {
  await page.getByTestId('workspace-close-btn').click();
  await expect(page.getByTestId('document-workspace')).toHaveCount(0);
}

test('文书库：分类浏览、样稿与生成回写', async ({ page }) => {
  await page.goto('/');
  await openLibrary(page);
  const library = page.getByTestId('document-library');
  await expect(library.getByRole('heading', { name: '文书库' })).toBeVisible();
  // 值班日报、会议纪要入口暂时隐藏；智能体物化文种仍展示分类行
  await expect(library.getByText('会议纪要', { exact: true })).toHaveCount(0);
  await expect(library.getByText('值班日报', { exact: true })).toHaveCount(0);
  await expect(library.locator('.doc-sample-row')).toHaveCount(4);
  for (const name of ['应急抢险要情', '抢险总结']) {
    const category = library.locator('.doc-category').filter({ hasText: name });
    // 点开样稿 → 回到助理页并展示右侧文书工作区
    await category.locator('.doc-sample-row').first().click();
    await expect(page.getByTestId('document-workspace')).toBeVisible();
    await expect(page.getByTestId('mock-redhead-document')).toBeVisible();
    await expect(page.locator('.axn-redhead-org')).toHaveText('中国安能建设集团有限公司');
    await closeWorkspace(page);
    // 分类生成 → 生成中自动打开工作区 → 完成后回写该分类
    await openLibrary(page);
    await category.getByRole('button', { name: `生成${name}`, exact: true }).click();
    await expect(page.getByTestId('document-workspace')).toContainText('正在生成文书');
    if (name === '抢险总结') {
      await page.getByRole('textbox', { name: '下一步改进措施' }).fill('完善通信保障和人员轮换机制。');
      await page.getByRole('button', { name: '提交并生成抢险总结' }).click();
    }
    await expect(page.getByTestId('document-toolbar')).toContainText('新生成');
    await closeWorkspace(page);
    await openLibrary(page);
    await expect(category.locator('.doc-sample-row')).toHaveCount(3);
  }
  await page.screenshot({ path: 'artifacts/document-agent-library.png' });

  // 真实草稿：缺必填 → 补录 → 再次生成 → 草稿在文书工作区打开
  const send = async (text: string) => {
    await page.getByPlaceholder(/向安小能发送指令/).fill(text);
    await page.keyboard.press('Enter');
  };
  await page.locator('.axn-gs-nav-item', { hasText: '智能助理' }).first().click();
  await send('生成应急要情');
  await expect(page.locator('.axn-task-card', { hasText: '生成应急要情' }).last()).toContainText('待补充信息', { timeout: 20000 });
  await send('报送单位是清河防汛分指挥部值班室');
  await expect(page.locator('.axn-task-card', { hasText: '补录报送单位' }).last().getByText('已完成')).toBeVisible({ timeout: 20000 });
  await send('生成应急要情');
  await expect(page.locator('article.doc-detail-paper')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('article.doc-detail-paper')).toContainText('清河防汛分指挥部值班室');
  await page.screenshot({ path: 'artifacts/document-agent-detail.png' });
  await closeWorkspace(page);
  // 已完成任务的产物提供真实草稿预览/打开动作（重新打开同一草稿，不重新生成）
  await expect(page.getByTestId('task-open-draft').first()).toBeVisible();
  await page.getByTestId('task-open-draft').first().click();
  await expect(page.locator('article.doc-detail-paper')).toBeVisible();
});

test('聊天文书快捷操作无需补录即可生成右侧模拟红头文书', async ({ page }) => {
  await page.goto('/');
  const panel = page.locator('.doc-center');
  for (const [name, title] of [['应急抢险要情', '重点河段险情处置要情']]) {
    await clickQuickTask(page, `生成${name}`);
    const workflow = page.getByTestId('document-generation-card').last();
    await expect(workflow).toContainText('正在整理已收集的文书要素');
    await expect(workflow).toContainText('编制单位');
    await expect(workflow).toContainText('以下模拟用户已提供并确认的信息');
    await expect(workflow).toContainText('正在调用文书生成智能体…');
    await expect(workflow).toContainText('正在生成文书…');
    await expect(panel).toContainText('正在生成文书');
    await expect(panel.getByTestId('document-toolbar')).toContainText(`${title}（新生成）`);
    await expect(panel.locator('.axn-redhead-org')).toHaveText('中国安能建设集团有限公司');
    await expect(workflow).toContainText('红头文书已生成');
    await expect(workflow).toContainText('要素齐备，已确认（模拟）');
    await expect(panel.getByTestId('mock-redhead-document')).not.toContainText('文书要素（模拟收集）');
    await expect(page.getByText(`已生成《${title}（新生成）》（模拟文书），已在右侧文书工作区打开。`)).toBeVisible();
    await closeWorkspace(page);
    await openLibrary(page);
    await expect(page.getByTestId('document-library').locator('.doc-category').filter({ hasText: name }).locator('.doc-sample-row')).toHaveCount(3);
    await page.locator('.axn-gs-nav-item', { hasText: '智能助理' }).first().click();
  }
});

test('模拟文书详情支持在线编辑、取消保留与放弃修改、导出为预览', async ({ page }) => {
  await page.goto('/');
  await openLibrary(page);
  await page.getByTestId('document-library').locator('.doc-sample-row').first().click();
  const panel = page.locator('.doc-center');
  await panel.getByRole('button', { name: '在线编辑', exact: true }).click();
  await panel.getByRole('textbox', { name: '文书标题', exact: true }).fill('防汛值守日报（修订）');
  await panel.getByRole('textbox', { name: '第1节正文', exact: true }).fill('本班次已完成重点区域巡查，并记录交接事项（模拟）。');
  await expect(page.getByTestId('mock-dirty-note')).toBeVisible();
  await panel.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(panel.getByTestId('mock-redhead-document')).toContainText('本班次已完成重点区域巡查');
  await closeWorkspace(page);
  await openLibrary(page);
  await page.getByTestId('document-library').locator('.doc-sample-row').filter({ hasText: '防汛值守日报（修订）' }).click();
  await expect(panel.getByTestId('mock-redhead-document')).toContainText('本班次已完成重点区域巡查');
  // 取消编辑保留本次编辑内容（未保存），放弃修改才真正丢弃
  await panel.getByRole('button', { name: '在线编辑', exact: true }).click();
  await panel.getByRole('textbox', { name: '文书标题', exact: true }).fill('未保存标题');
  await panel.getByRole('button', { name: '取消编辑', exact: true }).click();
  await expect(panel.getByTestId('mock-redhead-document')).not.toContainText('未保存标题');
  await panel.getByRole('button', { name: '在线编辑', exact: true }).click();
  await expect(panel.getByRole('textbox', { name: '文书标题', exact: true })).toHaveValue('未保存标题');
  await panel.getByRole('button', { name: '放弃修改', exact: true }).click();
  await panel.getByRole('button', { name: '在线编辑', exact: true }).click();
  await expect(panel.getByRole('textbox', { name: '文书标题', exact: true })).toHaveValue('防汛值守日报（修订）');
  await panel.getByRole('button', { name: '保存修改', exact: true }).click();
  const downloads: string[] = [];
  page.on('download', download => downloads.push(download.suggestedFilename()));
  for (const format of ['Word', 'PDF']) {
    await panel.getByRole('button', { name: `导出 ${format}`, exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('不生成或下载实际文件');
    await page.getByRole('button', { name: '知道了' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  }
  expect(downloads).toEqual([]);
  await page.screenshot({ path: 'artifacts/document-detail-refined.png' });
});
