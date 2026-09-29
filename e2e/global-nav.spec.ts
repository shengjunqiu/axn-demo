/**
 * 全局导航 E2E（需求十一验收路径 1~10）。
 * 覆盖：新建会话浮层与模板、搜索过滤、收藏、菜单切换、跨会话数据隔离与恢复、
 * 异步任务污染防护、刷新恢复、演示重置、侧栏折叠、导航页可达。
 * 前置：playwright.config webServer = preview(4173)，需先 pnpm build。
 */
import { expect, test } from '@playwright/test';

const TEMPLATE_KEYS = ['blank', 'nandi', 'water', 'dispatch', 'daily'];

async function openNav(page: import('@playwright/test').Page, label: string) {
  await page.locator('.axn-gs-nav-item', { hasText: label }).first().click();
}

async function sendInChat(page: import('@playwright/test').Page, text: string) {
  await page.getByPlaceholder(/向安小能发送指令/).fill(text);
  await page.keyboard.press('Enter');
}

/** 执行资源查询并等待表格出现（表格仅在查询完成后渲染）。 */
async function ensureResourceTable(page: import('@playwright/test').Page) {
  await sendInChat(page, '查询周边救援资源');
  await expect(page.locator('table tr', { hasText: '演示一号工程救援队' }).first()).toBeVisible({ timeout: 30000 });
}

async function checkFirstCandidate(page: import('@playwright/test').Page) {
  await page.locator('table tr', { hasText: '演示一号工程救援队' }).first().locator('span.ant-checkbox').click();
  // 候选区以 Tag 呈现所选力量；出现一号队 Tag 即候选已生效
  await expect(page.locator('.axn-candidate-zone').getByText('演示一号工程救援队')).toBeVisible({ timeout: 10000 });
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.axn-global-sidebar')).toBeVisible();
});

test('1. 新建任务 → 模板浮层五项 → Escape 取消', async ({ page }) => {
  await openNav(page, '新建任务');
  await expect(page.getByRole('dialog')).toBeVisible();
  for (const key of TEMPLATE_KEYS) {
    await expect(page.getByTestId(`template-${key}`)).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toBeHidden();
});

test('2. 选择"南堤堤防管涌险情"模板 → 会话出现在历史列表并自动激活', async ({ page }) => {
  const before = await page.locator('.axn-gs-conversation').count();
  await openNav(page, '新建任务');
  await page.getByTestId('template-nandi').click();
  await expect(page.getByRole('dialog')).toBeHidden();
  const after = await page.locator('.axn-gs-conversation').count();
  expect(after).toBe(before + 1);
  await expect(page.locator('.axn-gs-conversation.is-active').first()).toContainText('南堤堤防管涌险情');
  // 新会话进入智能助理工作台（右侧页签可见）
  await expect(page.getByRole('button', { name: '资源与态势' })).toBeVisible();
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

test('4. 收藏/取消收藏（is-fav 状态切换）', async ({ page }) => {
  const first = page.locator('.axn-gs-conversation').first();
  await first.hover();
  const fav = first.locator('.axn-gs-conv-action').first();
  const hasFavBefore = (await fav.getAttribute('class'))?.includes('is-fav') ?? false;
  await fav.click();
  const hasFavAfter = (await fav.getAttribute('class'))?.includes('is-fav') ?? false;
  expect(hasFavAfter).toBe(!hasFavBefore);
  // 取消收藏还原
  await fav.click();
  expect(((await fav.getAttribute('class'))?.includes('is-fav')) ?? false).toBe(hasFavBefore);
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
  await expect(page.getByText('尚未选择候选力量')).toBeVisible();
  await expect(page.locator('.axn-task-card')).toHaveCount(0);
  await expect(page.getByText('尚未查询周边救援资源')).toBeVisible();
});

test('7. 从 B 切回 A：候选恢复（1 支）', async ({ page }) => {
  await ensureResourceTable(page);
  await checkFirstCandidate(page);
  await page.locator('.axn-gs-conversation', { hasText: '漳河镇' }).first().click();
  await expect(page.getByText('尚未选择候选力量')).toBeVisible();
  await page.locator('.axn-gs-conversation', { hasText: '南堤' }).first().click();
  await expect(page.locator('.axn-candidate-zone').getByText('演示一号工程救援队')).toBeVisible({ timeout: 10000 });
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
  await expect(page.locator('.axn-candidate-zone', { hasText: '演示一号工程救援队' })).toBeVisible({ timeout: 15000 });
});

test('10. 演示重置 → 恢复种子初始状态', async ({ page }) => {
  await ensureResourceTable(page);
  await checkFirstCandidate(page);
  await page.getByRole('button', { name: '演示控制' }).click();
  await page.getByRole('button', { name: /重置演示/ }).click();
  await page.getByRole('button', { name: '确认重置' }).click();
  await page.waitForTimeout(1200);
  await page.keyboard.press('Escape');
  await expect(page.getByText('尚未选择候选力量')).toBeVisible({ timeout: 10000 });
  // 种子会话恢复
  await expect(page.locator('.axn-gs-conversation', { hasText: '南堤' }).first()).toBeVisible();
});

test('11. 折叠/展开侧栏（宽度切换）', async ({ page }) => {
  const collapseBtn = page.locator('.axn-gs-collapse-btn');
  const width = () => page.evaluate(() => document.querySelector('.axn-global-sidebar')?.getBoundingClientRect().width ?? 0);
  const w1 = await width();
  await collapseBtn.click();
  await page.waitForTimeout(400);
  const w2 = await width();
  expect(w2).toBeLessThan(w1);
  await collapseBtn.click();
  await page.waitForTimeout(400);
  expect(await width()).toBeGreaterThan(w2);
});

test('12. 智能体与 Skill / 定时任务 / 知识库导航页可访问', async ({ page }) => {
  await openNav(page, '智能体与 Skill');
  await expect(page.getByTestId('agents-page')).toBeVisible();
  await expect(page.getByText('态势感知智能体')).toBeVisible();
  await openNav(page, '定时任务');
  await expect(page.getByTestId('schedules-page')).toBeVisible();
  await expect(page.getByText('每日值班日报')).toBeVisible();
  await openNav(page, '知识库');
  await expect(page.getByTestId('knowledge-page')).toBeVisible();
});
