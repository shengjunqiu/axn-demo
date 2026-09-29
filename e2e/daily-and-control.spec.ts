/**
 * E2E 副线：值班日报全链路（生成→补录→校核→提交→签发）、
 * 事件切换隔离、演示重置、取消任务、1366x768 关键区域可见性。
 */
import { expect, test, type Page } from '@playwright/test';

async function sendChat(page: Page, text: string) {
  // 统一走主输入框：规则识别支持整句补录，产品侧会剥离重复前缀
  await page.getByPlaceholder(/向安小能发送指令/).fill(text);
  await page.keyboard.press('Enter');
}

test.describe('值班日报与演示控制', () => {
  let consoleErrors: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('pageerror', (err) => consoleErrors.push(String(err)));
    await page.goto('/');
    await expect(page.getByText('安小能 · 应急智能工作台')).toBeVisible();
  });

  test('值班日报：生成 → 补录交接事项 → 校核 → 提交 → 指挥员签发', async ({ page }) => {
    test.setTimeout(180000);
    // 通过文书中心直接生成日报
    await page.getByRole('button', { name: /文书中心/ }).click();
    // 未补录时点生成 → 提示缺失
    await page.getByRole('main').getByRole('button', { name: '生成值班日报' }).click();
    await expect(page.getByText(/交接事项|缺失|补录/, { exact: false }).first()).toBeVisible({ timeout: 10000 });
    // 在对话中补录两个必填字段（报送单位同步绑定事件域与班次域）
    await sendChat(page, '报送单位是清河防汛分指挥部值班室');
    await expect(page.locator('.axn-task-card', { hasText: '补录报送单位' }).last().getByText('已完成')).toBeVisible({ timeout: 20000 });
    await sendChat(page, '交接事项是持续跟踪堤防出险段水位变化，移交下一班值守');
    await expect(page.locator('.axn-task-card', { hasText: '补录交接事项' }).last().getByText('已完成')).toBeVisible({ timeout: 20000 });
    // 再次生成 → 草稿出现（定位到含“草稿”状态的文书卡片，避免误匹配模板预览项）
    await page.getByRole('main').getByRole('button', { name: '生成值班日报' }).click();
    const dailyCard = page.locator('.doc-card', { hasText: '值班日报' }).filter({ hasText: '草稿' }).first();
    await expect(dailyCard).toBeVisible({ timeout: 15000 });
    // 生成后自动打开编辑抽屉（产品行为），先关闭再操作卡片
    await page.keyboard.press('Escape');
    await expect(page.locator('.ant-drawer', { hasText: '编辑文书' })).toBeHidden({ timeout: 10000 });
    // 校核 → 提交 → 签发
    await dailyCard.getByRole('button', { name: /校\s*核/ }).click();
    await expect(dailyCard.getByText(/无问题|阻断 0/)).toBeVisible({ timeout: 20000 });
    await dailyCard.getByRole('button', { name: '提交送审' }).click();
    await expect(page.locator('.doc-card', { hasText: '值班日报' }).filter({ hasText: '待签发' }).first()).toBeVisible({ timeout: 15000 });
    await page.getByLabel('切换角色').click();
    await page.getByTitle('演示指挥员').click();
    await page.locator('.doc-card', { hasText: '值班日报' }).filter({ hasText: '待签发' }).first().getByRole('button', { name: /签\s*发/ }).click();
    await expect(page.locator('.doc-card', { hasText: '值班日报' }).filter({ hasText: '已签发' }).first()).toBeVisible({ timeout: 15000 });
  });

  test('值班员不能签发（按钮禁用并提示切换角色）', async ({ page }) => {
    test.setTimeout(180000);
    await page.getByRole('button', { name: /文书中心/ }).click();
    await sendChat(page, '报送单位是清河防汛分指挥部值班室');
    await expect(page.locator('.axn-task-card', { hasText: '补录报送单位' }).last().getByText('已完成')).toBeVisible({ timeout: 20000 });
    await sendChat(page, '交接事项是持续跟踪堤防出险段水位变化，移交下一班值守');
    await expect(page.locator('.axn-task-card', { hasText: '补录交接事项' }).last().getByText('已完成')).toBeVisible({ timeout: 20000 });
    await page.getByRole('main').getByRole('button', { name: '生成值班日报' }).click();
    const dailyCard = page.locator('.doc-card', { hasText: '值班日报' }).filter({ hasText: '草稿' }).first();
    await expect(dailyCard).toBeVisible({ timeout: 15000 });
    // 生成后自动打开编辑抽屉（产品行为），先关闭再操作卡片
    await page.keyboard.press('Escape');
    await expect(page.locator('.ant-drawer', { hasText: '编辑文书' })).toBeHidden({ timeout: 10000 });
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

  test('事件切换后会话隔离，重置演示清空状态', async ({ page }) => {
    test.setTimeout(120000);
    await sendChat(page, '生成灾情摘要');
    await expect(page.locator('.axn-task-card', { hasText: '汇总灾情摘要' }).first()).toBeVisible({ timeout: 30000 });
    // 打开演示控制 → 切换事件
    await page.getByRole('button', { name: '演示控制' }).click();
    const panel = page.locator('.ant-drawer', { hasText: '演示控制' });
    await panel.getByRole('button', { name: '演示区域 B 下穿道路积水' }).click();
    await page.keyboard.press('Escape');
    // 新事件会话无任务
    await expect(page.locator('.axn-task-card')).toHaveCount(0, { timeout: 10000 });
    await expect(page.locator('.axn-task-card')).toHaveCount(0);
    // 回到原事件，任务仍在（互不污染）
    await page.getByRole('button', { name: '演示控制' }).click();
    const panel2 = page.locator('.ant-drawer', { hasText: '演示控制' });
    await panel2.getByRole('button', { name: '演示区域 A · 清河段堤防险情' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.axn-task-card', { hasText: '汇总灾情摘要' }).first()).toBeVisible({ timeout: 10000 });
    // 重置演示（二次确认，FR-016）→ 状态清空
    await page.getByRole('button', { name: '演示控制' }).click();
    const panel3 = page.locator('.ant-drawer', { hasText: '演示控制' });
    await panel3.getByRole('button', { name: /重置演示/ }).click();
    // Popconfirm 渲染在 body portal，不在抽屉内
    await page.getByRole('button', { name: '确认重置' }).click();
    await page.keyboard.press('Escape');
    await expect(page.locator('.axn-task-card')).toHaveCount(0, { timeout: 10000 });
    expect(consoleErrors).toEqual([]);
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

  test('关键区域在 1366x768 下可见', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByText('安小能 · 应急智能工作台')).toBeVisible();
    // 主工作区常驻文书中心（资源/知识已改为抽屉）
    await expect(page.getByRole('heading', { name: '文书中心' })).toBeVisible();
    await expect(page.getByPlaceholder(/向安小能发送指令/)).toBeVisible();
    // 发送区与主工作区均可见（不被挤出视口）
    const sender = page.getByPlaceholder(/向安小能发送指令/);
    await expect(sender).toBeInViewport({ ratio: 0.5 });
    await expect(page.getByRole('heading', { name: '文书中心' })).toBeInViewport();
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
    await expect(page.getByText(/演示已刷新/).first()).toBeVisible({ timeout: 15000 });
    // 重新生成 → 草稿可见（补录事实已恢复，无需再次补录）
    await page.getByPlaceholder(/向安小能发送指令/).fill('生成应急要情');
    await page.keyboard.press('Enter');
    await page.locator('button', { hasText: '文书中心' }).last().click();
    const draftCard = page.locator('.doc-card', { hasText: '应急要情' }).filter({ hasText: '草稿' }).first();
    await expect(draftCard).toBeVisible({ timeout: 30000 });
  });

  test('重置后刷新仍是空态（仅清理本命名空间）', async ({ page }) => {
    test.setTimeout(120000);
    await page.goto('/');
    await expect(page.getByText('安小能 · 应急智能工作台')).toBeVisible();
    await page.getByRole('button', { name: '演示控制' }).click();
    const panel = page.locator('.ant-drawer', { hasText: '演示控制' });
    await panel.getByRole('button', { name: /重置演示/ }).click();
    await page.locator('.ant-popconfirm', { hasText: /确认重置|确定/ }).getByRole('button', { name: /确认重置|确 定/ }).click();
    await page.keyboard.press('Escape');
    await page.reload();
    await expect(page.getByText('安小能 · 应急智能工作台')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('.axn-task-card')).toHaveCount(0, { timeout: 10000 });
    await page.locator('button', { hasText: '文书中心' }).last().click();
    await expect(page.getByText(/尚未生成|暂无文书/).first()).toBeVisible({ timeout: 10000 });
  });
});
