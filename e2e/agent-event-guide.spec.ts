import { expect, test } from '@playwright/test';

for (const [agent, label] of [['态势感知智能体', '灾情摘要'], ['救援资源管理智能体', '周边救援资源'], ['救援方案生成智能体', '现场处置行方案'], ['救援效果评估智能体', '复盘评估分析']]) {
  test(`${agent}先选事件再自动执行`, async ({ page }) => {
    await page.goto('/#/agents');
    await page.getByRole('button', { name: `召唤${agent}`, exact: true }).click();
    await expect(page.getByRole('button', { name: '选择事件', exact: true })).toHaveCount(0);
    const picker = page.getByTestId('incident-picker');
    await expect(picker).toHaveCount(0);
    const choices = page.getByTestId('agent-capability-bar');
    await choices.getByRole('button', { name: label, exact: true }).click();
    await expect(picker).toContainText('选择要分析的事件');
    await expect(picker).toContainText(label);
    await expect(picker).toContainText('确认绑定后将开始');
    await expect(picker.getByRole('option', { name: '不关联灾情', exact: true })).toHaveCount(0);
    await expect(page.locator('.axn-task-card')).toHaveCount(0);
    await page.getByRole('combobox', { name: '搜索灾情' }).press('Escape');
    await expect(picker).toHaveCount(0);
    await expect(page.locator('.axn-task-card')).toHaveCount(0);
    await choices.getByRole('button', { name: label, exact: true }).click();
    await page.screenshot({ path: `/tmp/axn-agent-event-guide-${agent}.png` });
    await picker.getByRole('option', { name: '清河段堤防险情', exact: true }).click();
    await expect(picker).toBeVisible();
    await expect(page.locator('.axn-task-card')).toHaveCount(0);
    await page.getByTestId('incident-picker').getByRole('button', { name: /^(确认绑定|新开会话并绑定|确认选择)$/ }).click();
    await expect(picker).toHaveCount(0);
    await expect(page.locator('.axn-task-card')).toHaveCount(1);
    await expect(page.getByTestId('chat-link-incident')).toHaveAttribute('aria-description', '清河段堤防险情');
    await expect(page.locator('.axn-task-card')).toContainText('已完成', { timeout: 20000 });
    if (agent === '态势感知智能体') {
      await choices.getByRole('button', { name: '多源数据汇聚', exact: true }).click();
      await expect(page.locator('.axn-task-card')).toHaveCount(2);
      await expect(picker).toHaveCount(0);
    }
  });
}

test('直接输入需求先关联，取消保留草稿，选择后自动继续', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 928 });
  await page.goto('/#/agents');
  await page.getByRole('button', { name: '召唤态势感知智能体', exact: true }).click();
  const input = page.getByPlaceholder(/向安小能发送指令/);
  await input.fill('生成灾情摘要');
  await input.press('Enter');
  const picker = page.getByTestId('incident-picker');
  await expect(picker).toBeVisible();
  await expect(input).toHaveValue('生成灾情摘要');
  await expect(page.locator('.axn-task-card')).toHaveCount(0);
  await page.getByRole('combobox', { name: '搜索灾情' }).press('Escape');
  await expect(input).toHaveValue('生成灾情摘要');
  await input.press('Enter');
  await picker.getByRole('option', { name: '清河段堤防险情', exact: true }).click();
  await page.getByTestId('incident-picker').getByRole('button', { name: /^(确认绑定|新开会话并绑定|确认选择)$/ }).click();
  await expect(input).toHaveValue('');
  await expect(page.locator('.axn-task-card')).toHaveCount(1);
});

test('取消选择并切换对话后不再继续待关联任务', async ({ page }) => {
  await page.goto('/#/agents');
  await page.getByRole('button', { name: '召唤态势感知智能体', exact: true }).click();
  const original = await page.locator('.axn-gs-conversation.is-active').getAttribute('data-testid');
  await page.getByTestId('agent-capability-bar').getByRole('button', { name: '灾情摘要', exact: true }).click();
  await expect(page.getByTestId('incident-picker')).toBeVisible();
  await page.getByRole('combobox', { name: '搜索灾情' }).press('Escape');
  await page.getByTestId('new-conversation-btn').click();
  await page.getByTestId('chat-link-incident').click();
  await page.getByTestId('incident-picker').getByRole('option', { name: '清河段堤防险情', exact: true }).click();
  await page.getByTestId('incident-picker').getByRole('button', { name: /^(确认绑定|新开会话并绑定|确认选择)$/ }).click();
  await expect(page.locator('.axn-task-card')).toHaveCount(0);
  await page.getByTestId(original!).click();
  await expect(page.locator('.axn-task-card')).toHaveCount(0);
  await expect(page.getByTestId('chat-link-incident')).toHaveAttribute('aria-description', '未关联灾情');
});

test('文书生成不需要事件，可直接选择文书类型', async ({ page }) => {
  await page.goto('/#/agents');
  await page.getByRole('button', { name: '召唤文书生成智能体', exact: true }).click();
  await expect(page.getByRole('button', { name: '选择事件', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: '值班日报', exact: true }).click();
  await expect(page.getByTestId('document-workspace')).toBeVisible({ timeout: 20000 });
  await expect(page.getByTestId('incident-picker')).toHaveCount(0);
});
