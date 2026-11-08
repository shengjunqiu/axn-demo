import { expect, test } from '@playwright/test';

for (const width of [1440, 390]) {
  test(`文书模板里点 #灾情事件 可弹出事件选择并替换 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.getByPlaceholder(/向安小能发送指令/).waitFor();
    // 召唤文书生成智能体后输入框的灾情按钮隐藏，模板占位符仍要能打开事件选择器
    await page.locator('.axn-chips [data-agent-id="agent-doc"]').click();
    const input = page.locator('.ant-sender-input');
    await expect(input).toHaveValue(/帮我写一份/);
    await expect(page.getByTestId('chat-link-incident')).toHaveCount(0);
    await page.locator('.axn-token[data-token="灾情事件"]').click();
    const picker = page.getByTestId('incident-picker');
    await expect(picker).toBeVisible();
    await picker.getByRole('option', { name: /清河段堤防险情/ }).click();
    await expect(picker).toBeHidden();
    await expect(input).toHaveValue(/针对的事件是清河段堤防险情/);
  });
}

for (const { width, workspace } of [{ width: 1440, workspace: false }, { width: 390, workspace: false }, { width: 1366, workspace: true }]) {
  test(`居中事件弹窗支持搜索、键盘选择和确认绑定 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 928 });
    await page.goto(workspace ? '/#/library' : '/');
    if (workspace) {
      await page.getByTestId('document-library').locator('.doc-sample-row').first().click();
      await expect(page.getByTestId('document-workspace')).toBeVisible();
    }
    const input = page.getByPlaceholder(/向安小能发送指令/);
    await input.fill('请保留这段草稿');
    const trigger = page.getByTestId('chat-link-incident');
    const menu = page.getByTestId('incident-picker');
    const search = page.getByRole('combobox', { name: '搜索灾情', exact: true });
    await trigger.click();
    await expect(menu).toBeVisible();
    await expect(search).toBeFocused();
    await expect(page.getByRole('dialog', { name: '选择关联灾情', exact: true })).toBeVisible();
    const box = (await page.locator('.axn-incident-modal .ant-modal-container').boundingBox())!;
    expect(Math.abs(box.x + box.width / 2 - width / 2)).toBeLessThan(2);
    expect(Math.abs(box.y + box.height / 2 - 928 / 2)).toBeLessThan(20);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `/tmp/axn-event-command-menu-${width}.png` });
    await expect(menu.getByRole('option')).toHaveCount(11);
    await expect(menu.getByRole('button', { name: /查看全部事件/ })).toHaveCount(0);
    await expect(menu).toContainText('全部事件');
    await search.fill('不存在的事件');
    await expect(menu).toContainText('没有找到');
    await search.fill('清河');
    await expect(menu.getByRole('option')).toHaveCount(1);
    await search.press('Enter');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('option', { name: '清河段堤防险情', exact: true })).toHaveAttribute('aria-selected', 'true');
    await expect(menu.getByRole('button', { name: /^(确认绑定|新开会话并绑定|确认选择)$/ })).toBeFocused();
    await page.screenshot({ path: `/tmp/axn-event-confirm-${width}.png` });
    await page.keyboard.press('Enter');
    await expect(menu).toBeHidden();
    await expect(trigger).toHaveAttribute('aria-description', '清河段堤防险情');
    await expect(input).toHaveValue('请保留这段草稿');
    await expect(input).toBeFocused();
    await trigger.click();
    await menu.getByRole('option', { name: '漳河镇水位上涨预警', exact: true }).click();
    await expect(menu.getByRole('button', { name: '新开会话并绑定', exact: true })).toBeVisible();
    await expect(menu).toContainText('原会话仍关联原事件');
    await expect(trigger).toHaveAttribute('aria-description', '清河段堤防险情');
    await page.screenshot({ path: `/tmp/axn-event-rebind-${width}.png` });
    await menu.getByRole('button', { name: '取消选择事件' }).click();
    await expect(trigger).toHaveAttribute('aria-description', '清河段堤防险情');
    await trigger.click();
    await search.press('Escape');
    await expect(menu).toBeHidden();
    await trigger.click();
    await page.locator('.ant-modal-wrap').click({ position: { x: 4, y: 4 } });
    await expect(menu).toBeHidden();
    await page.getByTestId('composer-skill-picker').click();
    await expect(menu).toBeHidden();
    await expect(page.getByRole('region', { name: '选择技能', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '关闭技能选择', exact: true }).click();
    await trigger.click();
    await page.locator('.ant-modal-wrap').click({ position: { x: 4, y: 4 } });
    await expect(menu).toBeHidden();
    await expect(input).toHaveValue('请保留这段草稿');
  });
}
