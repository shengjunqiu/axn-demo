import { clickQuickTask } from './helpers/quickTasks';
/**
 * UI 改版 E2E：参考图外壳（260px 侧栏 + 宽敞主区）、首页知识库引导问题、
 * 文书库与文书工作区（打开/关闭/重开/独立库）、待补充工作总结刷新恢复、
 * 迟到的跨会话完成隔离、未保存编辑保护、窄视口文书独占主区。
 * 截图输出到 artifacts/ui-polish/。
 */
import { expect, test, type Page } from '@playwright/test';

async function openLibrary(page: Page) {
  await page.locator('.axn-gs-nav-item', { hasText: '文书库' }).first().click();
  await expect(page.getByTestId('document-library-page')).toBeVisible();
}

async function openFirstSample(page: Page) {
  await openLibrary(page);
  await page.getByTestId('document-library').locator('.doc-sample-row').first().click();
  await expect(page.getByTestId('document-workspace')).toBeVisible();
}

const DESKTOPS = [
  { width: 1366, height: 768, name: 'desktop-1366' },
  { width: 1440, height: 900, name: 'desktop-1440' },
  { width: 1920, height: 1080, name: 'desktop-1920' },
];

for (const { width, height, name } of DESKTOPS) {
  test(`桌面布局 ${width}x${height}：260px 侧栏、首页建议、分列文书区无横向裁切`, async ({ page }) => {
    await page.setViewportSize({ width, height });
    await page.goto('/');
    await expect(page.getByText('安小能 · 应急智能工作台')).toBeVisible();

    const sidebarWidth = await page.evaluate(() => document.querySelector('.axn-shell-sidebar')?.getBoundingClientRect().width ?? 0);
    expect(sidebarWidth).toBeGreaterThanOrEqual(240);
    expect(sidebarWidth).toBeLessThanOrEqual(280);

    // 首页：知识库引导问题 + 一体化输入区
    await expect(page.getByTestId('home-chat-recommend')).toBeVisible();
    await expect(page.getByTestId('home-chat-recommend').locator('.axn-question-item')).toHaveCount(4);
    const inner = await page.locator('.axn-home-inner').boundingBox();
    expect(inner?.width ?? 0).toBeGreaterThanOrEqual(780);
    expect(inner?.width ?? 0).toBeLessThanOrEqual(920);
    await expect(page.locator('.axn-composer-shell .axn-chips')).toBeVisible();
    await page.screenshot({ path: `artifacts/ui-polish/${name}-home.png` });

    // 打开文书 → 分列：对话 420-500，文书区占剩余宽度
    await openFirstSample(page);
    await expect(page.getByTestId('split-chat-empty')).toBeVisible();
    await expect(page.locator('.axn-chat-pane .axn-home-hero')).toHaveCount(0);
    await expect(page.getByTestId('document-toolbar')).toHaveCount(1);
    const paperBox = await page.getByTestId('mock-redhead-document').boundingBox();
    expect(paperBox?.y ?? Infinity).toBeLessThan(160);
    const chatBox = await page.locator('.axn-chat-pane').boundingBox();
    expect(chatBox?.width ?? 0).toBeGreaterThanOrEqual(415);
    expect(chatBox?.width ?? 0).toBeLessThanOrEqual(500);
    const docBox = await page.getByTestId('document-workspace-shell').boundingBox();
    expect(docBox?.width ?? 0).toBeGreaterThan(chatBox?.width ?? 0);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
    await page.screenshot({ path: `artifacts/ui-polish/${name}-split.png` });
  });
}

test('新建任务与新建对话都显示知识库引导问题', async ({ page }) => {
  await page.goto('/');
  const questions = page.getByTestId('home-chat-recommend').locator('.axn-question-item');
  // 新建任务
  await page.getByTestId('new-task-btn').click();
  await expect(page.locator('.axn-gs-conversation.is-active')).toContainText('新的应急对话');
  await expect(questions).toHaveCount(4);
  await expect(questions.first()).toBeVisible();
  // 新建应急对话
  await page.getByTestId('new-conversation-btn').click();
  await expect(questions).toHaveCount(4);
  // 问题取自知识库原文，点击后应命中对应答案
  await questions.first().click();
  await expect(page.getByTestId('home-chat-recommend')).toHaveCount(0);
  await expect(page.locator('.axn-task-card').last()).toContainText('建议动作', { timeout: 30000 });
});

test('文书库打开 → 工作区显示 → 关闭回宽对话 → 同份重开不重新生成', async ({ page }) => {
  await page.goto('/');
  await openLibrary(page);
  const rows = page.getByTestId('document-library').locator('.doc-sample-row');
  await expect(rows).toHaveCount(8);
  const title = (await rows.first().locator('.doc-file-copy > span').first().textContent())?.trim() ?? '';
  expect(title.length).toBeGreaterThan(0);
  await rows.first().click();
  await expect(page.getByTestId('document-workspace')).toBeVisible();
  await expect(page.getByTestId('mock-redhead-document')).toContainText(title);

  // 关闭 → 宽对话（无文书列），数据保留
  await page.getByTestId('workspace-close-btn').click();
  await expect(page.getByTestId('document-workspace')).toHaveCount(0);
  await expect(page.locator('.axn-chat-pane')).toBeVisible();

  // 同一预览重开：仍是同一份模拟稿，不触发重新生成
  await openLibrary(page);
  await page.getByTestId('document-library').locator('.doc-sample-row').filter({ hasText: title }).first().click();
  await expect(page.getByTestId('mock-redhead-document')).toContainText(title);
  await expect(page.getByTestId('mock-redhead-document')).not.toContainText('（新生成）');
});

test('生成文书自动打开工作区；关闭后同一完成不再自动弹出；产物可显式打开', async ({ page }) => {
  await page.goto('/');
  await clickQuickTask(page, '生成应急要情');
  await expect(page.getByTestId('document-workspace')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('workspace-close-btn').click();
  await expect(page.getByTestId('document-workspace')).toHaveCount(0);
  // 任务完成 / 无关重渲染后不再自动弹出（关闭标记生效）
  await expect(page.getByTestId('document-generation-card').last()).toContainText('红头文书已生成', { timeout: 15000 });
  await expect(page.getByTestId('document-workspace')).toHaveCount(0);
  // 已完成的模拟文书预览可显式重开；真实草稿重开由业务主线覆盖
  await page.getByRole('button', { name: '查看文书', exact: true }).last().click();
  await expect(page.getByTestId('document-workspace')).toBeVisible();
  await expect(page.getByTestId('mock-redhead-document')).toContainText('新生成');
});

test('待补充的工作总结在刷新后恢复到文书工作区', async ({ page }) => {
  await page.goto('/');
  await openLibrary(page);
  await page.getByTestId('document-library').getByRole('button', { name: '生成工作总结', exact: true }).click();
  await expect(page.getByTestId('document-generation-card').last()).toContainText('待补充', { timeout: 30000 });
  await page.reload();
  await expect(page.getByText('安小能 · 应急智能工作台')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('document-workspace')).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId('document-workspace')).toContainText('等待补充改进计划');
  await expect(page.getByTestId('document-toolbar')).toHaveCount(1);
  await expect(page.getByTestId('workspace-close-btn')).toBeVisible();
  await expect(page.getByRole('button', { name: '导出 Word', exact: true })).toHaveCount(0);
});

test('迟到的 A 会话完成不会在 B 会话打开文书', async ({ page }) => {
  await page.goto('/');
  await clickQuickTask(page, '生成应急要情');
  await expect(page.getByTestId('document-workspace')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('workspace-close-btn').click();
  await expect(page.getByTestId('document-workspace')).toHaveCount(0);
  // 切到另一会话：其上下文为空
  await page.locator('.axn-gs-conversation', { hasText: '漳河镇' }).first().click();
  await expect(page.locator('.axn-task-card')).toHaveCount(0);
  // A 会话后台完成期间，B 会话不得出现文书工作区
  await page.waitForTimeout(4000);
  await expect(page.getByTestId('document-workspace')).toHaveCount(0);
  await expect(page.locator('.axn-chat-page')).toBeVisible();
  await page.locator('.axn-gs-conversation', { hasText: '南堤' }).first().click();
  await expect(page.getByTestId('document-generation-card').last()).toContainText('红头文书已生成');
  await expect(page.getByTestId('document-workspace')).toHaveCount(0);
  await page.getByRole('button', { name: '查看文书', exact: true }).last().click();
  await expect(page.getByTestId('mock-redhead-document')).toContainText('新生成');
});

test('未保存编辑：关闭需确认，取消保留、放弃丢弃', async ({ page }) => {
  await page.goto('/');
  await openFirstSample(page);
  const ws = page.getByTestId('document-workspace');
  await ws.getByRole('button', { name: '在线编辑', exact: true }).click();
  await ws.getByRole('textbox', { name: '文书标题', exact: true }).fill('未保存的标题');
  await expect(page.getByTestId('mock-dirty-note')).toBeVisible();

  // 关闭 → 确认框；选择继续编辑保留修改
  await page.getByTestId('workspace-close-btn').click();
  await expect(page.getByRole('dialog', { name: '有未保存的文书修改', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '继续编辑' }).click();
  await expect(ws).toBeVisible();
  await expect(ws.getByRole('textbox', { name: '文书标题', exact: true })).toHaveValue('未保存的标题');

  // 再关闭 → 放弃修改并关闭
  await page.getByTestId('workspace-close-btn').click();
  await page.getByRole('button', { name: '放弃修改并关闭' }).click();
  await expect(ws).toHaveCount(0);

  // 重新打开：未保存修改已丢弃（保存作用域未被污染）
  await openFirstSample(page);
  await expect(page.getByTestId('mock-redhead-document')).not.toContainText('未保存的标题');
});

test('窄视口（<=1000px）文书视图独占主区且关闭控件可用', async ({ page }) => {
  await page.setViewportSize({ width: 980, height: 768 });
  await page.goto('/');
  await openFirstSample(page);
  const box = await page.getByTestId('document-workspace-shell').boundingBox();
  expect(box?.width ?? 0).toBeGreaterThan(600);
  expect(await page.locator('.axn-chat-pane').isVisible()).toBe(false);
  await expect(page.getByTestId('workspace-close-btn')).toBeVisible();
  await page.screenshot({ path: 'artifacts/ui-polish/narrow-980-document.png' });
  await page.getByTestId('workspace-close-btn').click();
  await expect(page.locator('.axn-chat-pane')).toBeVisible();
});


test('未保存修改在导航、会话和关联事件切换时受到保护', async ({ page }) => {
  await page.goto('/');
  await openFirstSample(page);
  const title = page.getByRole('textbox', { name: '文书标题', exact: true });
  await page.getByRole('button', { name: '在线编辑', exact: true }).click();
  await title.fill('保护中的工作副本');
  await page.locator('.axn-gs-nav-item', { hasText: '应急项目' }).click();
  await page.getByRole('button', { name: '继续编辑' }).click();
  await expect(title).toHaveValue('保护中的工作副本');
  await page.locator('.axn-gs-conversation', { hasText: '漳河镇' }).first().click();
  await page.getByRole('button', { name: '继续编辑' }).click();
  await expect(title).toHaveValue('保护中的工作副本');
  await page.getByTestId('chat-link-incident').click();
  await page.getByTitle('未关联事件（空白对话）', { exact: true }).click();
  await page.getByRole('button', { name: '继续编辑' }).click();
  await expect(title).toHaveValue('保护中的工作副本');
  await page.locator('.axn-gs-nav-item', { hasText: '应急项目' }).click();
  await page.getByRole('button', { name: '放弃修改并继续' }).click();
  await openFirstSample(page);
  await page.getByRole('button', { name: '在线编辑', exact: true }).click();
  await expect(title).not.toHaveValue('保护中的工作副本');
});

test('从聊天预览切换文书时取消保留编辑、确认放弃后切换', async ({ page }) => {
  await page.goto('/');
  for (const name of ['生成值班日报', '生成应急要情']) {
    await clickQuickTask(page, name);
    await expect(page.getByTestId('document-generation-card').last()).toContainText('红头文书已生成', { timeout: 20000 });
  }
  await page.getByRole('button', { name: '在线编辑', exact: true }).click();
  const title = page.getByRole('textbox', { name: '文书标题', exact: true });
  await title.fill('切换前未保存标题');
  await page.getByRole('button', { name: '查看文书', exact: true }).first().click();
  await page.getByRole('button', { name: '继续编辑' }).click();
  await expect(title).toHaveValue('切换前未保存标题');
  await page.getByRole('button', { name: '查看文书', exact: true }).first().click();
  await page.getByRole('button', { name: '放弃修改并继续' }).click();
  await expect(page.getByTestId('mock-redhead-document')).toContainText('防汛值守日报（新生成）');
  await expect(title).toHaveCount(0);
});


test('精简分屏保留未发送输入，关闭后恢复首页', async ({ page }) => {
  await page.goto('/');
  await openFirstSample(page);
  await expect(page.getByTestId('split-chat-empty')).toBeVisible();
  await expect(page.getByTestId('home-chat-recommend')).toHaveCount(0);
  await expect(page.getByTestId('document-toolbar')).toContainText('防汛值守日报');
  await expect(page.getByTestId('document-toolbar')).toContainText('2026年9月28日');
  const input = page.getByPlaceholder(/向安小能发送指令/);
  await input.fill('尚未发送的补充资料');
  await page.getByTestId('workspace-close-btn').click();
  await expect(page.getByTestId('home-chat-recommend')).toBeVisible();
  await expect(input).toHaveValue('尚未发送的补充资料');
  await expect(page.getByTestId('document-workspace')).toHaveCount(0);
});

test('三个常用任务与更多任务均可操作，菜单支持键盘退出并遵守运行状态', async ({ page }) => {
  await page.goto('/');
  const chips = page.locator('.axn-chips');
  await expect(chips.getByRole('button')).toHaveCount(4);
  const more = page.getByRole('button', { name: '更多任务', exact: true });
  await more.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('quick-task-menu')).toBeVisible();
  for (const name of ['生成灾情摘要', '查询周边救援资源', '生成救援方案', '生成应急要情', '生成值班日报', '生成工作总结', '评估救援效果']) {
    await expect(chips.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await page.screenshot({ path: 'artifacts/ui-polish/more-tasks.png' });
  await page.keyboard.press('Escape');
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await expect(page.getByTestId('quick-task-menu')).toBeHidden();
  await clickQuickTask(page, '生成值班日报');
  await expect(more).toBeDisabled();
  await expect(chips.getByRole('button', { name: '生成灾情摘要', exact: true })).toBeDisabled();
  await expect(page.getByTestId('document-generation-card').last()).toContainText('红头文书已生成', { timeout: 20000 });
  await expect(page.getByTestId('mock-redhead-document')).toContainText('防汛值守日报（新生成）');
  await expect(more).toBeEnabled();
  await expect(more).toHaveAttribute('aria-expanded', 'false');
});
