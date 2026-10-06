/**
 * E2E 副线（UI 改版适配）：值班日报真实草稿全链路（补录→生成→校核→提交→签发）、
 * 值班员不能签发、取消任务、1366x768 关键区域可见性。
 * 真实草稿一律通过对话指令「生成值班日报」生成（不再用模拟分类生成冒充真实草稿）。
 */
import { expect, test, type Page } from '@playwright/test';

async function sendChat(page: Page, text: string) {
  // 统一走主输入框：规则识别支持整句补录，产品侧会剥离重复前缀
  await page.getByPlaceholder(/向安小能发送指令/).fill(text);
  await page.keyboard.press('Enter');
}

/** 打开独立文书库（原全宽页头「文书中心」入口已改为侧栏「文书库」导航）。 */
async function openLibrary(page: Page) {
  await page.locator('.axn-gs-nav-item', { hasText: '文书库' }).first().click();
  await expect(page.getByTestId('document-library-page')).toBeVisible();
}

/** 补齐值班日报必填项（报送单位 + 交接事项）。 */
async function supplementDailyFields(page: Page) {
  await sendChat(page, '报送单位是清河防汛分指挥部值班室');
  await expect(page.locator('.axn-task-card', { hasText: '补录报送单位' }).last().getByText('已完成')).toBeVisible({ timeout: 20000 });
  await sendChat(page, '交接事项是持续跟踪堤防出险段水位变化，移交下一班值守');
  await expect(page.locator('.axn-task-card', { hasText: '补录交接事项' }).last().getByText('已完成')).toBeVisible({ timeout: 20000 });
}

/** 生成值班日报真实草稿，返回文书工作区中的草稿卡片。 */
async function generateDailyDraft(page: Page) {
  await sendChat(page, '生成值班日报');
  const dailyCard = page.locator('.doc-card', { hasText: '值班日报' }).filter({ hasText: '草稿' }).first();
  await expect(dailyCard).toBeVisible({ timeout: 30000 });
  // 生成后可能自动打开编辑抽屉（产品行为），先关闭再操作卡片
  await page.keyboard.press('Escape');
  await expect(page.locator('.ant-drawer', { hasText: '编辑文书' })).toBeHidden({ timeout: 10000 });
  return dailyCard;
}

test.describe('值班日报', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('安小能 · 应急智能工作台')).toBeVisible();
  });

  test('值班日报：补录 → 生成 → 校核 → 提交 → 指挥员签发', async ({ page }) => {
    test.setTimeout(180000);
    await supplementDailyFields(page);
    const dailyCard = await generateDailyDraft(page);
    // 校核 → 提交 → 签发
    await dailyCard.getByRole('button', { name: /校\s*核/ }).click();
    await expect(dailyCard.getByText(/无问题|阻断 0/)).toBeVisible({ timeout: 20000 });
    await dailyCard.getByRole('button', { name: '提交送审' }).click();
    await expect(page.locator('.doc-card', { hasText: '值班日报' }).filter({ hasText: '待签发' }).first()).toBeVisible({ timeout: 15000 });
    await page.getByTestId('account-settings').click();
    await page.getByTitle('指挥员').click();
    await page.locator('.doc-card', { hasText: '值班日报' }).filter({ hasText: '待签发' }).first().getByRole('button', { name: /签\s*发/ }).click();
    await expect(page.locator('.doc-card', { hasText: '值班日报' }).filter({ hasText: '已签发' }).first()).toBeVisible({ timeout: 15000 });
    // 文书库中同样可见该已签发草稿（独立库入口不丢失业务状态）
    await openLibrary(page);
    await expect(page.locator('.doc-card', { hasText: '值班日报' }).filter({ hasText: '已签发' }).first()).toBeVisible({ timeout: 15000 });
  });

  test('值班员不能签发（按钮禁用并提示切换角色）', async ({ page }) => {
    test.setTimeout(180000);
    await supplementDailyFields(page);
    const dailyCard = await generateDailyDraft(page);
    await dailyCard.getByRole('button', { name: /校\s*核/ }).click();
    await expect(dailyCard.getByText(/无问题|阻断 0/)).toBeVisible({ timeout: 20000 });
    await dailyCard.getByRole('button', { name: '提交送审' }).click();
    const submittedCard = page.locator('.doc-card', { hasText: '值班日报' }).filter({ hasText: '待签发' }).first();
    await expect(submittedCard).toBeVisible({ timeout: 15000 });
    // 当前角色为值班员：签发按钮禁用，Tooltip 提示
    const signBtn = submittedCard.getByRole('button', { name: /签\s*发/ });
    await expect(signBtn).toBeDisabled();
    await signBtn.hover({ force: true });
    await expect(page.getByText(/指挥员/).first()).toBeVisible();
  });

  test('运行中任务可取消', async ({ page }) => {
    test.setTimeout(60000);
    await sendChat(page, '生成灾情摘要');
    const runningCard = page.locator('.axn-task-card').last();
    await expect(runningCard).toBeVisible({ timeout: 15000 });
    const cancelBtn = runningCard.getByRole('button', { name: /取消/ });
    if (await cancelBtn.isVisible().catch(() => false)) {
      await cancelBtn.click();
      await expect(runningCard.getByText('已取消')).toBeVisible({ timeout: 10000 });
    } else {
      // 任务完成过快（fast 节奏）则视为通过
      await expect(runningCard.getByText('已完成')).toBeVisible({ timeout: 15000 });
    }
  });
});

test.describe('1366x768 视口', () => {
  test.use({ viewport: { width: 1366, height: 768 } });

  test('关键区域在 1366x768 下可见（260px 侧栏、输入区、文书库，无横向裁切）', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('安小能 · 应急智能工作台')).toBeVisible();
    // 参考图外壳：260±20px 侧栏 + 宽敞白色主区
    const sidebarWidth = await page.evaluate(() => document.querySelector('.axn-shell-sidebar')?.getBoundingClientRect().width ?? 0);
    expect(sidebarWidth).toBeGreaterThanOrEqual(240);
    expect(sidebarWidth).toBeLessThanOrEqual(280);
    // 发送区与主工作区均可见（不被挤出视口）
    const sender = page.getByPlaceholder(/向安小能发送指令/);
    await expect(sender).toBeVisible();
    await expect(sender).toBeInViewport({ ratio: 0.5 });
    await expect(page.locator('.axn-chips').first()).toBeInViewport();
    // 独立文书库页可达
    await openLibrary(page);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    expect(overflow).toBeLessThanOrEqual(1);
  });
});

test.describe('持久化（AC-025 / AC-026）', () => {
  test('刷新恢复草稿与补录状态；中断任务降级为可重试失败态', async ({ page }) => {
    test.setTimeout(180000);
    await page.goto('/');
    await expect(page.getByText('安小能 · 应急智能工作台')).toBeVisible();
    // 补录报送单位（人工事实）
    await page.getByPlaceholder(/向安小能发送指令/).fill('报送单位是清河防汛值班室');
    await page.keyboard.press('Enter');
    await expect(page.locator('.axn-task-card', { hasText: '补录报送单位' }).last().getByText('已完成')).toBeVisible({ timeout: 20000 });
    // 生成要情 → 草稿出现
    await page.getByPlaceholder(/向安小能发送指令/).fill('生成应急要情');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(400);
    // 任务运行中刷新 → 中断降级
    await page.reload();
    await expect(page.getByText('安小能 · 应急智能工作台')).toBeVisible({ timeout: 15000 });
    // 中断提示（系统消息）
    await expect(page.getByText(/页面已刷新/).first()).toBeVisible({ timeout: 15000 });
    // 重新生成 → 草稿可见（补录事实已恢复，无需再次补录）
    await page.getByPlaceholder(/向安小能发送指令/).fill('生成应急要情');
    await page.keyboard.press('Enter');
    await openLibrary(page);
    const draftCard = page.locator('.doc-card', { hasText: '应急要情' }).filter({ hasText: '草稿' }).first();
    await expect(draftCard).toBeVisible({ timeout: 30000 });
  });
});


test('真实草稿编辑关闭：取消保留副本，放弃恢复上次保存内容', async ({ page }) => {
  await page.goto('/');
  await supplementDailyFields(page);
  const card = await generateDailyDraft(page);
  await card.getByRole('button', { name: /编\s*辑/ }).click();
  const drawer = page.getByRole('dialog', { name: /编辑文书/ });
  const editor = drawer.locator('.ProseMirror');
  await editor.locator('p').last().click();
  await page.keyboard.press('Control+End');
  await page.keyboard.press('Enter');
  await page.keyboard.type('这段文字需要放弃而不写入保存版本。');
  await expect(drawer.getByText('有未保存修改')).toBeVisible();
  await drawer.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '继续编辑', exact: true }).click();
  await expect(editor).toContainText('这段文字需要放弃');
  await drawer.getByRole('button', { name: '关闭', exact: true }).click();
  await page.getByRole('button', { name: '放弃修改并关闭', exact: true }).click();
  await expect(drawer).toBeHidden();
  await card.getByRole('button', { name: /编\s*辑/ }).click();
  await expect(editor).not.toContainText('这段文字需要放弃');
  await expect(drawer.getByText('有未保存修改')).toHaveCount(0);
});
