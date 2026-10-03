/**
 * 全局导航 E2E（需求十一验收路径 1~10）。
 * 覆盖：新建会话浮层与模板、搜索过滤、收藏移除、菜单切换、删除对话、跨会话数据隔离与恢复、
 * 异步任务污染防护、刷新恢复、折叠移除、导航页可达。
 * 前置：playwright.config webServer = preview(4173)，需先 pnpm build。
 */
import { expect, test } from '@playwright/test';

async function openNav(page: import('@playwright/test').Page, label: string) {
  await page.locator('.axn-gs-nav-item', { hasText: label }).first().click();
}

async function sendInChat(page: import('@playwright/test').Page, text: string) {
  await page.getByPlaceholder(/向安小能发送指令/).fill(text);
  await page.keyboard.press('Enter');
}

/** 打开“资源与态势”抽屉（资源/知识页签已按标注移除，改为对话任务卡触发的抽屉）。 */
async function openResourceDrawer(page: import('@playwright/test').Page) {
  await page.getByRole('button', { name: '查看资源与态势' }).first().click();
  await expect(page.locator('.ant-drawer', { hasText: '资源与态势（模拟）' })).toBeVisible();
}

async function closeDrawer(page: import('@playwright/test').Page) {
  await page.keyboard.press('Escape');
  await expect(page.locator('.ant-drawer', { hasText: '资源与态势（模拟）' })).toBeHidden({ timeout: 5000 });
}

/** 执行资源查询并打开抽屉等待表格出现（表格仅在抽屉内渲染）。 */
async function ensureResourceTable(page: import('@playwright/test').Page) {
  await sendInChat(page, '查询周边救援资源');
  await openResourceDrawer(page);
  await expect(page.locator('table tr', { hasText: '一号工程应急救援队' }).first()).toBeVisible({ timeout: 30000 });
}

async function checkFirstCandidate(page: import('@playwright/test').Page) {
  await page.locator('table tr', { hasText: '一号工程应急救援队' }).first().locator('span.ant-checkbox').click();
  // 候选区以 Tag 呈现所选力量；出现一号队 Tag 即候选已生效
  await expect(page.locator('.axn-candidate-zone').getByText('一号工程应急救援队')).toBeVisible({ timeout: 10000 });
  // 关闭抽屉，避免遮罩阻挡后续对话/侧栏操作
  await closeDrawer(page);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.axn-global-sidebar')).toBeVisible();
});

test('1. 新建任务 → 直接创建空白对话并激活（无弹窗，标注 vibe_1790652706390）', async ({ page }) => {
  const before = await page.locator('.axn-gs-conversation').count();
  await openNav(page, '新建任务');
  await page.waitForTimeout(400);
  const after = await page.locator('.axn-gs-conversation').count();
  expect(after).toBe(before + 1);
  await expect(page.locator('.axn-gs-conversation.is-active').first()).toContainText('新的应急对话');
  // 对话区头部出现关联灾情选择，当前为未关联
  await expect(page.getByTestId('chat-link-incident')).toBeVisible();
  await expect(page.getByText('空白对话（未关联事件）').first()).toBeVisible();
});

test('2. 对话区内关联灾情 → 切换事件上下文与共享 session', async ({ page }) => {
  await openNav(page, '新建任务');
  await page.getByTestId('chat-link-incident').click();
  await page.locator('.ant-select-item-option', { hasText: '清河段堤防险情' }).click();
  await page.waitForTimeout(500);
  // 头部上下文切到关联事件
  await expect(page.getByTestId('header-event')).toContainText('清河段堤防险情', { timeout: 10000 });
  await expect(page.getByText('空白对话（未关联事件）')).toHaveCount(0);
  // 取消关联 → 回到未关联（专属虚拟事件）
  await page.getByTestId('chat-link-incident').click();
  await page.locator('.ant-select-item-option', { hasText: '未关联事件' }).click();
  await page.waitForTimeout(500);
  await expect(page.getByText('空白对话（未关联事件）').first()).toBeVisible({ timeout: 10000 });
});

test('3. 搜索"南堤"→过滤；清空→恢复', async ({ page }) => {
  await page.getByPlaceholder('搜索对话或事件').fill('南堤');
  const visible = await page.locator('.axn-gs-conversation').allTextContents();
  expect(visible.length).toBeGreaterThan(0);
  for (const t of visible) expect(t).toContain('南堤');
  await page.getByPlaceholder('搜索对话或事件').fill('');
  await expect(page.locator('.axn-gs-conversation').first()).toBeVisible();
  const restored = await page.locator('.axn-gs-conversation').count();
  expect(restored).toBeGreaterThan(visible.length);
});

test('4. 收藏功能已按标注移除（无入口、无星标；删除入口保留）', async ({ page }) => {
  await expect(page.getByText('我的收藏')).toHaveCount(0);
  const first = page.locator('.axn-gs-conversation').first();
  await first.hover();
  // 明确断言不存在星标/收藏控件（会话行内唯一操作是删除）
  await expect(page.locator('.axn-gs-conv-action .anticon-star')).toHaveCount(0);
  await expect(page.locator('.axn-gs-conv-action [aria-label*="收藏"]')).toHaveCount(0);
  await expect(page.locator('.axn-gs-conv-favorite')).toHaveCount(0);
  // 保留删除覆盖
  await expect(first.locator('.axn-gs-conv-action .anticon-delete')).toHaveCount(1);
});

test('4b. 删除对话（Popconfirm 确认 → 条目移除 → active 切换）', async ({ page }) => {
  const before = await page.locator('.axn-gs-conversation').count();
  const first = page.locator('.axn-gs-conversation').first();
  const firstTitle = await first.locator('.axn-gs-conv-title-text').textContent();
  await first.hover();
  await first.locator('button', { hasText: '' }).filter({ has: page.locator('.anticon-delete') }).first().click();
  await page.getByRole('button', { name: '删 除' }).click();
  await expect(page.locator('.axn-gs-conversation', { hasText: firstTitle ?? '' })).toHaveCount(0);
  expect(await page.locator('.axn-gs-conversation').count()).toBe(before - 1);
  // 激活态仍存在（切换到剩余最近会话）或全部删光
  const after = await page.locator('.axn-gs-conversation').count();
  if (after > 0) {
    await expect(page.locator('.axn-gs-conversation.is-active').first()).toBeVisible();
  }
  // 刷新后删除仍生效（持久化）
  await page.reload();
  await expect(page.locator('.axn-gs-conversation')).toHaveCount(after);
});

test('5. 菜单切换不丢 active 会话', async ({ page }) => {
  const activeTitle = await page.locator('.axn-gs-conversation.is-active .axn-gs-conv-title-text').first().textContent();
  await openNav(page, '知识库');
  await expect(page.getByTestId('knowledge-page')).toBeVisible();
  await openNav(page, '智能体与 Skill');
  await expect(page.getByTestId('agents-page')).toBeVisible();
  await openNav(page, '智能助理');
  await expect(page.locator('.axn-gs-conversation.is-active .axn-gs-conv-title-text').first()).toHaveText(activeTitle ?? '');
});

test('6. 会话列表切换 A→B：B 空上下文（无候选、无任务卡）', async ({ page }) => {
  await ensureResourceTable(page);
  await checkFirstCandidate(page);
  await page.locator('.axn-gs-conversation', { hasText: '漳河镇' }).first().click();
  await expect(page.locator('.axn-task-card')).toHaveCount(0);
  // B 无查询任务卡：显示欢迎空态（候选区在资源抽屉内，无任务卡即无查询）
  await expect(page.getByText('您好，我是安小能')).toBeVisible();
});

test('7. 从 B 切回 A：候选恢复（1 支）', async ({ page }) => {
  await ensureResourceTable(page);
  await checkFirstCandidate(page);
  await page.locator('.axn-gs-conversation', { hasText: '漳河镇' }).first().click();
  await page.locator('.axn-gs-conversation', { hasText: '南堤' }).first().click();
  await openResourceDrawer(page);
  await expect(page.locator('.axn-candidate-zone').getByText('一号工程应急救援队')).toBeVisible({ timeout: 10000 });
});

test('8. 事件 A 任务卡 → 切 B 无污染 → 切回 A 保留', async ({ page }) => {
  await sendInChat(page, '生成灾情摘要');
  await expect(page.locator('.axn-task-card', { hasText: '汇总灾情摘要' }).first()).toBeVisible({ timeout: 30000 });
  await page.locator('.axn-gs-conversation', { hasText: '漳河镇' }).first().click();
  await expect(page.locator('.axn-task-card')).toHaveCount(0);
  await page.locator('.axn-gs-conversation', { hasText: '南堤' }).first().click();
  await expect(page.locator('.axn-task-card', { hasText: '汇总灾情摘要' }).first()).toBeVisible({ timeout: 10000 });
});

test('9. 刷新后 active Conversation 与业务上下文恢复（候选勾选保留）', async ({ page }) => {
  await ensureResourceTable(page);
  await checkFirstCandidate(page);
  await page.reload();
  await expect(page.locator('.axn-global-sidebar')).toBeVisible({ timeout: 15000 });
  await openResourceDrawer(page);
  await expect(page.locator('.axn-candidate-zone', { hasText: '一号工程应急救援队' })).toBeVisible({ timeout: 15000 });
});

test('10. 折叠功能已按标注移除（无折叠按钮，侧栏固定宽度）', async ({ page }) => {
  await expect(page.locator('.axn-gs-collapse-btn')).toHaveCount(0);
  const width = await page.evaluate(() => document.querySelector('.axn-global-sidebar')?.getBoundingClientRect().width ?? 0);
  expect(width).toBeGreaterThan(200);
});

test('11. 智能体与 Skill / 定时任务 / 知识库导航页可访问，文书库导航独立成页', async ({ page }) => {
  await openNav(page, '智能体与 Skill');
  await expect(page.getByTestId('agents-page')).toBeVisible();
  await expect(page.getByText('态势感知智能体')).toBeVisible();
  await openNav(page, '定时任务');
  await expect(page.getByTestId('schedules-page')).toBeVisible();
  await expect(page.getByText('每日值班日报')).toBeVisible();
  await openNav(page, '知识库');
  await expect(page.getByTestId('knowledge-page')).toBeVisible();
  await openNav(page, '文书库');
  await expect(page.getByTestId('document-library-page')).toBeVisible();
  await expect(page.getByTestId('document-workspace')).toHaveCount(0);
  await openNav(page, '智能助理');
  await expect(page.locator('.axn-chat-page')).toBeVisible();
});
