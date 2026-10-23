import { clickQuickTask } from './helpers/quickTasks';
/**
 * UI 改版 E2E：参考图外壳（260px 侧栏 + 宽敞主区）、首页知识库引导问题、
 * 文书库与文书工作区（打开/关闭/重开/独立库）、待补充工作总结刷新恢复、
 * 迟到的跨会话完成隔离、未保存编辑保护、窄视口文书独占主区。
 * 截图输出到 artifacts/ui-polish/。
 */
import { expect, test, type Page } from '@playwright/test';

async function openLibrary(page: Page) {
  await page.goto('/#/library');
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
    await expect(page.locator('.axn-chips')).toBeVisible();
    await page.screenshot({ path: `artifacts/ui-polish/${name}-home.png` });

    // 打开文书 → 分列：对话 420-500，文书区占剩余宽度
    await openFirstSample(page);
    await expect(page.getByTestId('split-chat-empty')).toBeVisible();
    await expect(page.locator('.axn-chat-pane .axn-home-hero')).toHaveCount(0);
    await expect(page.getByTestId('document-toolbar')).toHaveCount(1);
    const paperBox = await page.getByTestId('mock-redhead-document').boundingBox();
    // 打开文书即富文本编辑态（3471277）：纸面上方固定占着 118px 文书头 + Word 风格工具条
    //（1366/1440 下工具条换行到 75px），纸面 top 约 220 —— 这里断言的是「纸面仍在首屏上部」，
    // 不再是「在线编辑」按钮时代 118px 单头的 <160
    expect(paperBox?.y ?? Infinity).toBeLessThan(260);
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

test('新建对话显示知识库引导问题', async ({ page }) => {
  await page.goto('/');
  const questions = page.getByTestId('home-chat-recommend').locator('.axn-question-item');
  // 新建对话（「新建任务」工作模式入口已下线，原「新建任务」分支随之移除）
  await page.getByTestId('new-conversation-btn').click();
  await expect(page.locator('.axn-gs-conversation.is-active')).toContainText('新的对话');
  await expect(questions).toHaveCount(4);
  await expect(questions.first()).toBeVisible();
  // 问题取自知识库原文，点击后应命中对应答案
  await questions.first().click();
  await expect(page.getByTestId('home-chat-recommend')).toHaveCount(0);
  await expect(page.locator('.axn-task-card').last()).toContainText('建议动作', { timeout: 30000 });
});

test('文书库打开 → 工作区显示 → 关闭回宽对话 → 同份重开不重新生成', async ({ page }) => {
  await page.goto('/');
  await openLibrary(page);
  const rows = page.getByTestId('document-library').locator('.doc-sample-row');
  await expect(rows).toHaveCount(10);
  const title = (await rows.first().locator('.doc-file-copy > span').first().textContent())?.trim() ?? '';
  expect(title.length).toBeGreaterThan(0);
  await rows.first().click();
  await expect(page.getByTestId('document-workspace')).toBeVisible();
  await expect(page.getByTestId('document-toolbar')).toContainText(title);

  // 关闭 → 宽对话（无文书列），数据保留
  await page.getByTestId('workspace-close-btn').click();
  await expect(page.getByTestId('document-workspace')).toHaveCount(0);
  await expect(page.locator('.axn-chat-pane')).toBeVisible();

  // 同一预览重开：仍是同一份模拟稿，不触发重新生成
  await openLibrary(page);
  await page.getByTestId('document-library').locator('.doc-sample-row').filter({ hasText: title }).first().click();
  await expect(page.getByTestId('document-toolbar')).toContainText(title);
  await expect(page.getByTestId('document-toolbar')).not.toContainText('（新生成）');
});

test('生成文书自动打开工作区；关闭后同一完成不再自动弹出；产物可显式打开', async ({ page }) => {
  await page.goto('/');
  await clickQuickTask(page, '生成应急要情');
  await expect(page.getByTestId('document-workspace')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('workspace-close-btn').click();
  await expect(page.getByTestId('document-workspace')).toHaveCount(0);
  // 任务完成 / 无关重渲染后不再自动弹出（关闭标记生效）
  await expect(page.getByTestId('document-generation-card').last().getByTestId('doc-collect-done')).toBeVisible( { timeout: 15000 });
  await expect(page.getByTestId('document-workspace')).toHaveCount(0);
  // 已完成的模拟文书预览可显式重开；真实草稿重开由业务主线覆盖
  await page.getByRole('button', { name: '查看文书', exact: true }).last().click();
  await expect(page.getByTestId('document-workspace')).toBeVisible();
  await expect(page.getByTestId('document-toolbar')).toContainText('新生成');
});

test('待补充的工作总结在刷新后恢复到文书工作区', async ({ page }) => {
  await page.goto('/');
  await openLibrary(page);
  await page.getByTestId('document-library').getByRole('tab', { name: /^抢险总结 / }).click();
  await page.getByTestId('document-library').getByRole('button', { name: '生成抢险总结', exact: true }).click();
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
  await expect(page.getByTestId('document-generation-card').last().getByTestId('doc-collect-done')).toBeVisible();
  await expect(page.getByTestId('document-workspace')).toHaveCount(0);
  await page.getByRole('button', { name: '查看文书', exact: true }).last().click();
  await expect(page.getByTestId('document-toolbar')).toContainText('新生成');
});

test('未保存编辑：关闭需确认，关闭保留、放弃丢弃', async ({ page }) => {
  await page.goto('/');
  await openFirstSample(page);
  const ws = page.getByTestId('document-workspace');
  // 打开样稿就是编辑态，不需要先点「在线编辑」
  await ws.getByRole('textbox', { name: '文书标题', exact: true }).fill('未保存的标题');
  await expect(page.getByTestId('mock-dirty-note')).toBeVisible();

  // 关闭 → 确认框；选择继续编辑保留修改
  await page.getByTestId('workspace-close-btn').click();
  await expect(page.getByRole('dialog', { name: '有未保存的文书修改', exact: true })).toBeVisible();
  await page.getByRole('button', { name: '继续编辑' }).click();
  await expect(ws).toBeVisible();
  await expect(ws.getByRole('textbox', { name: '文书标题', exact: true })).toHaveValue('未保存的标题');

  // 再关闭 → 「关闭并保留修改」（关闭只收起工作区，不回滚工作副本）
  await page.getByTestId('workspace-close-btn').click();
  await page.getByRole('button', { name: '关闭并保留修改' }).click();
  await expect(ws).toHaveCount(0);

  // 重新打开：工作副本仍在（受保护，可继续编辑），未被回滚
  await openFirstSample(page);
  await expect(page.getByTestId('mock-dirty-note')).toBeVisible();
  await expect(ws.getByRole('textbox', { name: '文书标题', exact: true })).toHaveValue('未保存的标题');

  // 真正丢弃只发生在编辑器内的「放弃修改」
  await ws.getByRole('button', { name: '放弃修改', exact: true }).click();
  await expect(page.getByTestId('mock-dirty-note')).toHaveCount(0);
  await page.getByTestId('workspace-close-btn').click();
  await expect(ws).toHaveCount(0);

  // 放弃后重开：修改已丢弃（保存作用域未被污染）
  await openFirstSample(page);
  await expect(page.getByRole('textbox', { name: '文书标题', exact: true })).toHaveValue('防汛值守日报');
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
  await title.fill('保护中的工作副本');
  await page.locator('.axn-gs-nav-item', { hasText: '定时任务' }).click();
  await page.getByRole('button', { name: '继续编辑' }).click();
  await expect(title).toHaveValue('保护中的工作副本');
  await page.locator('.axn-gs-conversation', { hasText: '漳河镇' }).first().click();
  await page.getByRole('button', { name: '继续编辑' }).click();
  await expect(title).toHaveValue('保护中的工作副本');
  await page.getByTestId('chat-link-incident').click();
  await page.getByTestId('incident-picker').getByRole('option', { name: /南湾堤段洪涝决口/ }).first().click();
  await expect(page.getByTestId('incident-picker')).toContainText('更换事件将新开一个会话');
  await page.getByRole('button', { name: '取消选择事件' }).click();
  await expect(title).toHaveValue('保护中的工作副本');
  // 多轮取消期间可能已自动保存；重新编辑以验证最后一次导航的未保存保护。
  await title.fill('保护中的工作副本（继续导航）');
  await page.locator('.axn-gs-nav-item', { hasText: '定时任务' }).click();
  await page.getByRole('button', { name: /^继\s*续$/ }).click();
  // 四条切换路径（导航 / 会话 / 关联事件 / 再导航）都不回滚工作副本
  await openFirstSample(page);
  await expect(page.getByTestId('mock-dirty-note')).toBeVisible();
  await expect(title).toHaveValue('保护中的工作副本（继续导航）');
  // 真正丢弃只发生在编辑器内的「放弃修改」
  await page.getByTestId('document-workspace').getByRole('button', { name: '放弃修改', exact: true }).click();
  await expect(page.getByTestId('mock-dirty-note')).toHaveCount(0);
  await page.getByTestId('workspace-close-btn').click();
  await expect(page.getByTestId('document-workspace')).toHaveCount(0);
});

test('从聊天预览切换文书：确认后切换，工作副本不丢弃', async ({ page }) => {
  await page.goto('/');
  for (const name of ['生成值班日报', '生成应急要情']) {
    await clickQuickTask(page, name);
    await expect(page.getByTestId('document-generation-card').last()).toContainText('已完成', { timeout: 20000 });
  }
  const title = page.getByRole('textbox', { name: '文书标题', exact: true });
  await title.fill('切换前未保存标题');
  await page.getByRole('button', { name: '查看文书', exact: true }).first().click();
  await page.getByRole('button', { name: '继续编辑' }).click();
  await expect(title).toHaveValue('切换前未保存标题');
  await page.getByRole('button', { name: '查看文书', exact: true }).first().click();
  await page.getByRole('button', { name: '打开并保留修改' }).click();
  await expect(page.getByTestId('document-toolbar')).toContainText('防汛值守日报（新生成）');
  // 切过去的是另一篇文书：同一个标题输入框里已经是新文书的标题
  await expect(title).toHaveValue('防汛值守日报（新生成）');
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

test('快捷任务五能力块邀请气泡，运行中父块禁用', async ({ page }) => {
  await page.goto('/');
  const chips = page.locator('.axn-chips');
  for (const name of ['文书生成', '态势感知', '救援资源管理', '救援方案生成', '救援效果评估']) {
    await expect(chips.getByRole('button', { name, exact: true })).toBeVisible();
  }
  await expect(chips.getByTestId('chip-more-actions')).toHaveCount(0);
  // 点救援方案生成：对话内邀请气泡含现场处置行动方案
  await chips.getByRole('button', { name: '救援方案生成', exact: true }).click();
  const invite = page.getByTestId('agent-invite-choices').last();
  await expect(invite.getByRole('button', { name: '现场处置行动方案', exact: true })).toBeVisible();
  await page.screenshot({ path: 'artifacts/ui-polish/quick-tasks.png' });
  await clickQuickTask(page, '生成应急要情');
  await expect(chips.getByRole('button', { name: '文书生成', exact: true })).toBeDisabled();
  await expect(page.getByTestId('document-generation-card').last()).toContainText(/已完成|红头文书已生成/, { timeout: 20000 });
  await expect(chips.getByRole('button', { name: '文书生成', exact: true })).toBeEnabled();
});

// 语音输入模拟（标注 vibe_1791960862035）：演示环境没有麦克风，点语音按钮改为「逐字实时转写」一段示例话语。
const SPEECH_SAMPLE = '请汇总南堤堤防管涌险情的最新处置进展，并生成一份情况报告';

test('语音按钮：点击后模拟实时转写，文字逐字填入输入框，完成后回到发送态', async ({ page }) => {
  await page.goto('/');
  const input = page.locator('.ant-sender textarea');
  const speech = page.getByTestId('composer-speech');
  await expect(speech).toBeEnabled();

  await speech.click();
  await expect(speech).toHaveAttribute('aria-label', '停止语音输入');
  // 转写中：文字在增长
  const len1 = (await input.inputValue()).length;
  await page.waitForTimeout(600);
  expect((await input.inputValue()).length).toBeGreaterThan(len1);

  // 转写完：填入完整示例句，语音按钮自动换成发送按钮
  await expect(input).toHaveValue(SPEECH_SAMPLE, { timeout: 8000 });
  await expect(speech).toHaveCount(0);
  await expect(page.locator('.ant-sender-actions-btn').last()).toBeEnabled();
});

test('语音按钮：转写中再点一下可停止，文字不再增长', async ({ page }) => {
  await page.goto('/');
  const input = page.locator('.ant-sender textarea');
  const speech = page.getByTestId('composer-speech');

  await speech.click();
  await expect(speech).toHaveAttribute('aria-label', '停止语音输入');
  await page.waitForTimeout(400);
  await speech.click(); // 中途停止

  const frozen = await input.inputValue();
  expect(frozen.length).toBeGreaterThan(0);
  expect(SPEECH_SAMPLE.startsWith(frozen)).toBe(true);
  expect(frozen).not.toBe(SPEECH_SAMPLE);
  await page.waitForTimeout(700);
  expect(await input.inputValue()).toBe(frozen); // 已停下，不再增长
});


for (const width of [1440, 390]) {
  test(`关联灾情保留在输入框内部 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto('/');
    const trigger = page.getByTestId('chat-link-incident');
    await expect(trigger).toBeVisible();
    await expect(page.locator('.axn-composer-shell').getByTestId('chat-link-incident')).toHaveCount(1);
    const button = (await trigger.boundingBox())!;
    const shell = (await page.locator('.axn-composer-shell').boundingBox())!;
    expect(button.x).toBeGreaterThan(shell.x);
    const textInput = (await page.locator('.axn-composer-shell textarea').boundingBox())!;
    expect(button.y).toBeGreaterThanOrEqual(textInput.y + textInput.height);
    expect(button.y + button.height).toBeLessThanOrEqual(shell.y + shell.height);
    await trigger.click();
    await page.getByTestId('incident-picker').getByRole('option', { name: /青岭村山体滑坡/ }).first().click();
    await page.getByTestId('incident-picker').getByRole('button', { name: /^(确认绑定|新开会话并绑定|确认选择)$/ }).click();
    await expect(trigger).toHaveAttribute('aria-description', /青岭村山体滑坡/);
    await expect(page.getByTestId('incident-picker')).not.toBeVisible();
    await page.screenshot({ path: `artifacts/ui-polish/incident-inside-composer-${width}.png` });
  });
}


test('文书库分类列表支持筛选、搜索、窄屏和打开文书', async ({ page }) => {
  await page.goto('/');
  await openLibrary(page);
  const library = page.getByTestId('document-library');
  await expect(library.locator('.doc-sample-row')).toHaveCount(10);
  await expect(library.locator('.doc-category-grid')).toHaveCount(0);
  await library.getByRole('button', { name: '新建文书', exact: true }).click();
  await expect(page.getByRole('menuitem', { name: '生成值班日报', exact: true })).toBeVisible();
  await page.keyboard.press('Escape');
  for (const name of ['值班日报', '应急抢险要情', '应急救援周工作动态', '会议纪要', '抢险总结']) {
    await library.getByRole('tab', { name: new RegExp(`^${name} `) }).click();
    await expect(library.locator('.doc-sample-row')).toHaveCount(2);
    await expect(library.locator('.doc-file-type-cell').filter({ hasText: name })).toHaveCount(2);
    await expect(library.getByRole('button', { name: `生成${name}`, exact: true })).toBeVisible();
  }
  const search = library.getByPlaceholder('搜索文书名称或文号');
  await search.fill('不存在的文书');
  await expect(library).toContainText('没有找到匹配的文书');
  await expect(library.locator('.doc-sample-row')).toHaveCount(0);
  await search.fill('');
  await library.getByRole('tab', { name: /^全部文书 / }).click();
  await expect(library.locator('.doc-sample-row')).toHaveCount(10);
  await page.screenshot({ path: 'artifacts/ui-polish/document-library-list.png' });
  await library.getByRole('tab', { name: /^应急抢险要情 / }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(library.locator('.doc-sample-row').first()).toBeInViewport();
  expect((await library.getByRole('heading', { name: '文书库', exact: true }).boundingBox())!.y).toBeGreaterThan(40);
  expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false);
  await page.screenshot({ path: 'artifacts/ui-polish/document-library-list-mobile.png' });
  await library.locator('.doc-sample-row').first().click();
  await expect(page.getByTestId('mock-redhead-document')).toBeVisible();
});
