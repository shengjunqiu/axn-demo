/**
 * 全局导航 E2E（需求十一验收路径 1~10）。
 * 覆盖：新建会话浮层与模板、搜索过滤、收藏移除、菜单切换、删除对话、跨会话数据隔离与恢复、
 * 异步任务污染防护、刷新恢复、折叠移除、导航页可达。
 * 前置：playwright.config webServer = preview(4173)，需先 pnpm build。
 */
import { expect, test, type Page } from '@playwright/test';
import { AGENT_INVITATIONS } from '../src/seed/agentInvitations';

async function openNav(page: Page, label: string) {
  if (label === '文书库') { await page.goto('/#/library'); return; }
  await page.locator('.axn-gs-nav-item', { hasText: label }).first().click();
}

/** 新建对话：侧栏置顶的实心按钮（不再是导航项）。「新建任务」工作模式入口已按下线标注移除，
 *  原依赖该按钮的用例改走本 helper。 */
async function newConversation(page: Page) {
  await page.getByTestId('new-conversation-btn').click();
}

async function sendInChat(page: Page, text: string) {
  await page.getByPlaceholder(/向安小能发送指令/).fill(text);
  await page.keyboard.press('Enter');
}

/** 打开“资源与态势”抽屉并切到资源列表 Tab（表格仅在该 Tab 可见时可点）。 */
async function openResourceDrawer(page: Page) {
  await page.getByRole('button', { name: '查看资源列表' }).first().click();
  const drawer = page.getByTestId('document-workspace');
  await expect(drawer).toBeVisible();
  await drawer.getByRole('tab', { name: '资源列表' }).click();
  // antd Table 会拆成表头/表体两张 table，断言落在含数据行的那张。
  await expect(page.getByTestId('resource-tab-list').getByRole('table').filter({ hasText: '一号工程应急救援队' })).toBeVisible();
}

async function closeDrawer(page: Page) {
  await page.getByTestId('workspace-close-btn').click();
  await expect(page.getByTestId('document-workspace')).toBeHidden({ timeout: 5000 });
}

/** 执行资源查询并打开抽屉等待表格出现（表格仅在抽屉内渲染）。 */
async function ensureResourceTable(page: Page) {
  await sendInChat(page, '查询周边救援资源');
  await openResourceDrawer(page);
  await expect(page.getByTestId('resource-tab-list').getByRole('table').filter({ hasText: '一号工程应急救援队' })).toBeVisible({ timeout: 30000 });
}

async function checkFirstCandidate(page: Page) {
  const row = page.getByTestId('resource-tab-list').getByRole('table').filter({ hasText: '一号工程应急救援队' }).locator('tr', { hasText: '一号工程应急救援队' }).first();
  await row.locator('span.ant-checkbox').click();
  // 候选区以 Tag 呈现所选力量；出现一号队 Tag 即候选已生效
  await expect(page.locator('.axn-candidate-zone').getByText('一号工程应急救援队')).toBeVisible({ timeout: 10000 });
  // 关闭抽屉，避免遮罩阻挡后续对话/侧栏操作
  await closeDrawer(page);
}

test.beforeEach(async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.axn-global-sidebar')).toBeVisible();
});

test('1. 新建对话 → 直接创建空白对话并激活（无弹窗，标注 vibe_1790652706390）', async ({ page }) => {
  const before = await page.locator('.axn-gs-conversation').count();
  await newConversation(page);
  await page.waitForTimeout(400);
  const after = await page.locator('.axn-gs-conversation').count();
  expect(after).toBe(before + 1);
  await expect(page.locator('.axn-gs-conversation.is-active').first()).toContainText('新的对话');
  // 对话区出现关联灾情选择，当前为未关联；未开始对话（无消息）时头部不显示事件标题（标注 vibe_1791303121889）
  await expect(page.getByTestId('chat-link-incident')).toContainText('未关联事件');
  await expect(page.getByTestId('header-event')).toHaveCount(0);
});

test('2. 对话区内关联灾情 → 切换事件上下文与共享 session', async ({ page }) => {
  await newConversation(page);
  await page.getByTestId('chat-link-incident').click();
  await page.getByTestId('incident-picker').getByRole('option', { name: /青岭村山体滑坡/ }).first().click();
  await page.getByTestId('incident-picker').getByRole('button', { name: /^(确认绑定|新开会话并绑定|确认选择)$/ }).click();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('chat-link-incident')).toContainText('青岭村山体滑坡');
  await expect(page.getByText('【当前状态】')).toBeVisible();
  await expect(page.getByTestId('event-next-steps')).toBeVisible();
  await expect(page.getByTestId('event-next-steps-task-生成救援方案')).toBeVisible();
  await expect(page.getByTestId('open-event-timeline')).toBeVisible();
  await page.getByTestId('open-event-timeline').click();
  await expect(page.getByTestId('event-timeline-drawer')).toBeVisible();
  await expect(page.getByTestId('event-timeline-drawer')).toContainText('事件接报');
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('header-event')).toContainText('青岭村山体滑坡');
  // 取消选择不会解除当前会话的关联。
  await page.getByTestId('chat-link-incident').click();
  await expect(page.getByTestId('incident-picker').getByRole('option', { name: /不关联灾情/ })).toHaveCount(0);
  await page.getByRole('button', { name: '取消选择事件' }).click();
  await expect(page.getByTestId('chat-link-incident')).toContainText('青岭村山体滑坡');
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
  // 保留删除覆盖（图标已由 antd 迁到 lucide，故用可访问名断言，不依赖图标 class）
  // 会话行操作现为「置顶 + 删除」两个（置顶按标注加入；收藏入口已按上列断言确认不存在）
  await expect(first.locator('.axn-gs-conv-actions button')).toHaveCount(2);
  await expect(first.locator('.axn-gs-conv-action--pin')).toHaveCount(1);
  await expect(first.getByRole('button', { name: /^删除对话/ })).toHaveCount(1);
});

test('4b. 删除对话（Popconfirm 确认 → 条目移除 → active 切换）', async ({ page }) => {
  const before = await page.locator('.axn-gs-conversation').count();
  const first = page.locator('.axn-gs-conversation').first();
  const firstTitle = await first.locator('.axn-gs-conv-title-text').textContent();
  await first.hover();
  await first.getByRole('button', { name: /^删除对话/ }).click();
  await page.getByRole('button', { name: /^删\s*除$/ }).click();
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
  // 文书库侧栏入口隐藏，通过深链验证页面仍可访问。
  await openNav(page, '文书库');
  await expect(page.getByTestId('document-library-page')).toBeVisible();
  await openNav(page, '安小能');
  await expect(page.locator('.axn-gs-conversation.is-active .axn-gs-conv-title-text').first()).toHaveText(activeTitle ?? '');
});

test('6. 会话列表切换 A→B：B 空上下文（无候选、无任务卡）', async ({ page }) => {
  await ensureResourceTable(page);
  await checkFirstCandidate(page);
  await page.locator('.axn-gs-conversation', { hasText: '漳河镇' }).first().click();
  await expect(page.locator('.axn-task-card')).toHaveCount(0);
  // B 无查询任务卡：显示欢迎空态（候选区在资源抽屉内，无任务卡即无查询）
  await expect(page.locator('.axn-home-title')).toContainText('我是安小能');
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

test('10b. 文书库入口隐藏，应急专家与定时任务入口可用，知识库管理可访问', async ({ page }) => {
  for (const label of ['文书库', '应急项目', '智能体与 Skill']) {
    await expect(page.locator('.axn-gs-nav-item', { hasText: label })).toHaveCount(0);
  }
  // 保留的入口仍在（含已恢复的「知识库」）
  for (const label of ['安小能', '应急专家', '定时任务', '技能管理', '我的文件', '知识库']) {
    await expect(page.locator('.axn-gs-nav-item', { hasText: label })).toHaveCount(1);
  }
  // 知识库入口进入管理模块
  const knowledgeNav = page.locator('.axn-gs-nav-item', { hasText: '知识库' });
  await expect(knowledgeNav).toBeEnabled();
  await knowledgeNav.click();
  await expect(page.getByTestId('knowledge-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: '知识库管理', exact: true })).toBeVisible();
});

test('应急专家展示已有能力，每次召唤新开对话并能选择任务', async ({ page }) => {
  await newConversation(page);
  const activeConversation = page.locator('.axn-gs-conversation.is-active');
  const conversationId = await activeConversation.getAttribute('data-testid');
  await expect(page.locator('.axn-chips')).toBeVisible();
  const count = await page.locator('.axn-gs-conversation').count();
  for (const [index, agent] of AGENT_INVITATIONS.entries()) {
    await page.getByRole('button', { name: '应急专家', exact: true }).click();
    await expect(page.getByRole('heading', { name: '应急专家', exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '应急专家', exact: true })).toBeVisible();
    const card = page.locator(`.axn-agent-card[data-agent-id="${agent.agentId}"]`);
    await expect(card.getByRole('heading', { name: agent.name, exact: true })).toBeVisible();
    await expect(card.locator('.axn-np-desc')).not.toBeEmpty();
    await card.getByRole('button', { name: `召唤${agent.name}`, exact: true }).click();
    await expect(page.locator('.axn-chat-page')).toBeVisible();
    await expect(page.locator('.axn-cp-chips-wrap')).toHaveCount(0);
    const invitation = page.getByTestId('agent-summon-card').filter({ has: page.locator(`[data-agent-id="${agent.agentId}"].axn-doc-choices`) }).last();
    await expect(invitation).toContainText(agent.intro);
    for (const option of agent.options) {
      await expect(invitation.getByRole('button', { name: option.label, exact: true })).toBeEnabled();
    }
    await expect(activeConversation).not.toHaveAttribute('data-testid', conversationId!);
    await expect(activeConversation).toContainText(`与${agent.name}对话`);
    await expect(page.getByTestId('agent-summon-card')).toHaveCount(1);
    await expect(page.locator('.axn-gs-conversation')).toHaveCount(count + index + 1);
  }
  const summonedId = await activeConversation.getAttribute('data-testid');
  await page.getByTestId(conversationId!).click();
  await expect(page.locator('.axn-chips')).toBeVisible();
  await page.getByTestId(summonedId!).click();
  await expect(page.locator('.axn-cp-chips-wrap')).toHaveCount(0);
  await page.reload();
  await expect(page.locator('.axn-cp-chips-wrap')).toHaveCount(0);
  await expect(page.getByTestId('agent-summon-card')).toHaveCount(1);
  await page.getByRole('button', { name: '应急专家', exact: true }).click();
  await page.getByRole('button', { name: '召唤救援资源管理智能体', exact: true }).click();
  await page.locator('.axn-doc-choices[data-agent-id="agent-resource"]').getByRole('button', { name: '周边救援资源', exact: true }).click();
  await page.getByTestId('incident-picker').getByRole('option', { name: /青岭村山体滑坡/ }).first().click();
  await page.getByTestId('incident-picker').getByRole('button', { name: /^(确认绑定|新开会话并绑定|确认选择)$/ }).click();
  await expect(page.locator('.axn-task-card').first()).toBeVisible();
});

test('11. 应急专家 / 定时任务 / 知识库导航页可访问，文书库导航独立成页', async ({ page }) => {
  // 应用用 HashRouter，深链形式为 /#/agents
  await page.goto('/#/agents');
  await expect(page.getByTestId('agents-page')).toBeVisible();
  await expect(page.getByRole('heading', { name: '态势感知智能体', exact: true })).toBeVisible();
  await page.goto('/#/schedules');
  await expect(page.getByTestId('schedules-page')).toBeVisible();
  await expect(page.getByText('每日灾情摘要', { exact: true })).toBeVisible();
  await page.goto('/#/knowledge');
  await expect(page.getByTestId('knowledge-page')).toBeVisible();
  await openNav(page, '文书库');
  await expect(page.getByTestId('document-library-page')).toBeVisible();
  await expect(page.getByTestId('document-workspace')).toHaveCount(0);
  await openNav(page, '安小能');
  await expect(page.locator('.axn-chat-page')).toBeVisible();
});


test('更换事件创建新会话，原会话与记录在刷新后保留', async ({ page }) => {
  await newConversation(page);
  const originalId = await page.locator('.axn-gs-conversation.is-active').getAttribute('data-testid');
  const count = await page.locator('.axn-gs-conversation').count();
  const text = '请保留这段对话记录';
  const input = page.getByPlaceholder(/向安小能发送指令/);
  await input.fill(text);
  await input.press('Enter');
  await expect(page.getByText(text, { exact: true })).toBeVisible();
  const trigger = page.getByTestId('chat-link-incident');
  const picker = page.getByTestId('incident-picker');
  await trigger.click();
  await picker.getByRole('option', { name: /清河段堤防险情/ }).click();
  await expect(trigger).toHaveAttribute('aria-description', '未关联灾情');
  await picker.getByRole('button', { name: '确认绑定', exact: true }).click();
  await expect(page.locator('.axn-gs-conversation.is-active')).toHaveAttribute('data-testid', originalId!);
  await trigger.click();
  await picker.getByRole('option', { name: /漳河镇水位上涨预警/ }).click();
  await expect(picker).toContainText('原会话仍关联原事件');
  await expect(trigger).toHaveAttribute('aria-description', '清河段堤防险情');
  await picker.getByRole('button', { name: '新开会话并绑定', exact: true }).click();
  await expect(page.locator('.axn-gs-conversation')).toHaveCount(count + 1);
  await expect(page.locator('.axn-gs-conversation.is-active')).not.toHaveAttribute('data-testid', originalId!);
  await expect(trigger).toHaveAttribute('aria-description', '漳河镇水位上涨预警');
  await expect(page.getByText(text, { exact: true })).toHaveCount(0);
  await page.getByTestId(originalId!).click();
  await page.reload();
  await expect(trigger).toHaveAttribute('aria-description', '清河段堤防险情');
  await expect(page.getByText(text, { exact: true })).toBeVisible();
});
