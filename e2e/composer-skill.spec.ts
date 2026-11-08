import { expect, test } from '@playwright/test';

for (const width of [320, 375, 390, 430]) {
  test(`移动端输入框分区布局稳定 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    const skill = page.getByRole('button', { name: '选择技能', exact: true });
    await skill.click();
    await page.getByRole('region', { name: '选择技能', exact: true }).getByRole('option', { name: /现场记录提炼/ }).click();
    const incident = page.getByTestId('chat-link-incident');
    await incident.click();
    await page.getByTestId('incident-picker').getByRole('option', { name: /清河段堤防险情/ }).click();
    await page.getByTestId('incident-picker').getByRole('button', { name: /^(确认绑定|新开会话并绑定|确认选择)$/ }).click();
    const shell = (await page.locator('.axn-composer-shell').boundingBox())!;
    const context = (await skill.boundingBox())!;
    const event = (await incident.boundingBox())!;
    const more = page.getByRole('button', { name: '输入工具', exact: true });
    const plus = (await more.boundingBox())!;
    const sendButton = page.getByRole('button', { name: '发送', exact: true });
    const send = (await sendButton.boundingBox())!;
    for (const box of [context, event, plus]) expect(Math.abs(box.y + box.height / 2 - send.y - send.height / 2)).toBeLessThan(1);
    expect(plus.x + plus.width).toBeLessThan(context.x);
    expect(context.x + context.width).toBeLessThan(event.x);
    expect(event.x + event.width).toBeLessThan(send.x);
    for (const box of [context, event, plus, send]) {
      expect(box.x).toBeGreaterThanOrEqual(shell.x);
      expect(box.x + box.width).toBeLessThanOrEqual(shell.x + shell.width);
      expect(box.y + box.height).toBeLessThanOrEqual(shell.y + shell.height);
    }
    expect(shell.x + shell.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `/tmp/axn-mobile-composer-redesign-${width}.png` });
    await more.click();
    await expect(page.getByTestId('composer-upload')).toBeVisible();
    await expect(page.getByTestId('composer-speech')).toBeVisible();
    // 联网搜索按钮已下线（方案一/方案二统一移除）
    await expect(page.getByRole('switch', { name: '联网搜索', exact: true })).toHaveCount(0);
    await more.click();
    await page.getByTestId('composer-speech').click();
    await expect(page.getByRole('button', { name: '停止语音输入', exact: true })).toBeVisible();
    await page.getByRole('button', { name: '停止语音输入', exact: true }).click();
    const input = page.getByPlaceholder(/向安小能发送指令/);
    await input.fill('请整理相关资料');
    await expect(page.getByTestId('composer-speech')).toBeVisible();
    await expect(sendButton).toBeEnabled();
    const typed = (await sendButton.boundingBox())!;
    expect(Math.abs(typed.x - send.x)).toBeLessThan(1);
    await input.fill('第一行\n第二行\n第三行\n第四行\n第五行\n第六行');
    const expanded = (await sendButton.boundingBox())!;
    expect(Math.abs(expanded.x - send.x)).toBeLessThan(1);
    expect(Math.abs(expanded.y - send.y)).toBeLessThan(1);
  });
}

// 移动端方案二工作模式：智能体入口必须直接露在工具栏上，不能跟上传一起收进「输入工具」加号浮层。
for (const width of [320, 390]) {
  test(`移动端应急专家按钮不藏进输入工具 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    await page.goto('/');
    await page.evaluate(() => {
      localStorage.setItem('anneng-demo:v1:demo', JSON.stringify({ __schema: 2, data: { designPlan: 'two', interactionMode: 'work' } }));
    });
    await page.reload();
    const picker = page.getByTestId('composer-agent-picker');
    await expect(picker).toBeVisible();
    await expect(picker).toHaveAttribute('aria-label', '应急专家');
    // 没打开「输入工具」时它就在工具栏上
    await expect(page.locator('.axn-composer-tool-menu')).toHaveCount(0);
    const more = page.getByRole('button', { name: '输入工具', exact: true });
    await more.click();
    const menu = page.locator('.axn-composer-tool-menu');
    await expect(menu.getByTestId('composer-upload')).toBeVisible();
    await expect(menu.getByTestId('composer-agent-picker')).toHaveCount(0);
    await expect(picker).toBeVisible();
    // 工具栏不横向溢出，按钮完整落在输入框内
    const overflow = await page.locator('.axn-composer-tools').evaluate(el => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
    const shell = (await page.locator('.axn-composer-shell').boundingBox())!;
    const button = (await picker.boundingBox())!;
    expect(button.x + button.width).toBeLessThanOrEqual(shell.x + shell.width + 0.5);
    await page.screenshot({ path: `/tmp/axn-mobile-agent-picker-${width}.png` });
    await picker.click();
    await expect(page.getByTestId('agent-picker-menu')).toBeVisible();
  });
}

for (const width of [1440, 390]) {
  test(`输入框选择技能支持搜索、切换对话和清除 ${width}px`, async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const picker = page.getByRole('button', { name: '选择技能', exact: true });
    await expect(picker).toContainText('技能');
    await picker.click();
    const dialog = page.getByRole('region', { name: '选择技能', exact: true });
    await expect(dialog.getByRole('option')).toHaveCount(5);
    await expect(dialog.getByRole('tab')).toHaveCount(0);
    const search = dialog.getByRole('textbox', { name: '搜索对话技能', exact: true });
    await search.fill('不存在的技能');
    await expect(dialog).toContainText('未找到匹配的技能');
    await search.fill('现场');
    await expect(dialog.getByRole('option')).toHaveCount(1);
    await dialog.getByRole('option', { name: /现场记录提炼/ }).click();
    await expect(dialog).toBeHidden();
    await expect(picker).toHaveAttribute('aria-description', '现场记录提炼');
    const selectedConversation = page.locator('.axn-gs-conversation.is-active');
    const previousId = await selectedConversation.getAttribute('data-testid');
    await page.screenshot({ path: `/tmp/axn-composer-skill-${width}.png` });
    if (width < 768) await page.getByRole('button', { name: '打开导航', exact: true }).click();
    await page.getByTestId('new-conversation-btn').click();
    if (width < 768) {
      await page.mouse.move(width - 10, 600);
      await expect(page.locator('.ant-message-notice')).toHaveCount(0);
      await page.getByRole('button', { name: '关闭导航', exact: true }).click();
    }
    await expect(picker).toHaveText('技能');
    if (width < 768) await page.getByRole('button', { name: '打开导航', exact: true }).click();
    await page.getByTestId(previousId!).click();
    if (width < 768) await page.getByRole('button', { name: '关闭导航', exact: true }).click();
    await expect(picker).toHaveAttribute('aria-description', '现场记录提炼');
    await picker.click();
    await expect(dialog.getByRole('option', { name: /现场记录提炼/ })).toHaveAttribute('aria-selected', 'true');
    await dialog.getByRole('button', { name: '清除选择', exact: true }).click();
    await expect(picker).toHaveText('技能');
    const outside = await page.locator('.axn-composer-shell').evaluate(el => el.getBoundingClientRect().right > innerWidth);
    expect(outside).toBe(false);
    expect(errors).toEqual([]);
  });
}

for (const width of [1366, 1680]) {
  test(`工作区展开后输入框按分栏宽度切换布局 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 928 });
    await page.goto('/');
    const shell = page.locator('.axn-composer-shell');
    await expect(shell).not.toHaveClass(/is-mobile/);
    await page.goto('/#/library');
    await page.getByTestId('document-library').locator('.doc-sample-row').first().click();
    await expect(page.getByTestId('document-workspace')).toBeVisible();
    await expect(shell).toHaveClass(/is-mobile/);
    const boxes = await Promise.all([
      page.getByRole('button', { name: '输入工具', exact: true }),
      page.getByTestId('composer-skill-picker'),
      page.getByTestId('chat-link-incident'),
      page.getByTestId('composer-speech'),
      page.getByRole('button', { name: '发送', exact: true }),
    ].map(locator => locator.boundingBox()));
    const boundary = (await shell.boundingBox())!;
    for (let index = 0; index < boxes.length; index++) {
      const box = boxes[index]!;
      expect(box.x).toBeGreaterThanOrEqual(boundary.x);
      expect(box.x + box.width).toBeLessThanOrEqual(boundary.x + boundary.width);
      if (index > 0) expect(box.x).toBeGreaterThan(boxes[index - 1]!.x + boxes[index - 1]!.width);
      expect(Math.abs(box.y + box.height / 2 - boxes[0]!.y - boxes[0]!.height / 2)).toBeLessThan(1);
    }
    await page.screenshot({ path: `/tmp/axn-workspace-composer-${width}.png` });
    await page.getByTestId('workspace-close-btn').click();
    await expect(shell).not.toHaveClass(/is-mobile/);
    await expect(page.getByTestId('composer-upload')).toBeVisible();
  });
}

for (const width of [1440, 390]) {
  test(`斜杠技能浮层支持直接筛选、键盘选择与取消 ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const input = page.getByPlaceholder(/向安小能发送指令/);
    const menu = page.getByRole('region', { name: '选择技能', exact: true });
    const picker = page.getByTestId('composer-skill-picker');
    await input.fill('/');
    await expect(menu).toBeVisible();
    await expect(menu.getByRole('option')).toHaveCount(5);
    await expect(input).toBeFocused();
    await expect(input).toHaveValue('/');
    await expect(page.locator('.ant-modal')).toHaveCount(0);
    const box = (await menu.boundingBox())!;
    const shell = (await page.locator('.axn-composer-shell').boundingBox())!;
    expect(box.y + box.height).toBeLessThanOrEqual(shell.y);
    expect(box.x).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width).toBeLessThanOrEqual(width);
    await page.screenshot({ path: `/tmp/axn-skill-command-menu-${width}.png` });
    await input.press('ArrowDown');
    await input.press('Enter');
    await expect(menu).toBeHidden();
    await expect(picker).toHaveAttribute('aria-description', '资源清单整理');
    await expect(input).toHaveValue('');
    await expect(input).toBeFocused();
    await input.fill('/现场');
    await expect(menu.getByRole('option')).toHaveCount(1);
    await input.press('Enter');
    await expect(menu).toBeHidden();
    await expect(picker).toHaveAttribute('aria-description', '现场记录提炼');
    await expect(input).toHaveValue('');
    await input.fill('参考 https://example.com/files/');
    await expect(menu).toBeHidden();
    await input.fill('请整理现场记录 /不存在的技能');
    await expect(menu).toBeVisible();
    await expect(menu).toContainText('未找到匹配的技能');
    await input.press('Escape');
    await expect(menu).toBeHidden();
    await expect(input).toHaveValue('请整理现场记录 ');
    await input.press('/');
    await expect(menu.getByRole('option')).toHaveCount(5);
    await menu.getByRole('option', { name: /现场记录提炼/ }).click();
    await expect(menu).toBeHidden();
    await expect(input).toHaveValue('请整理现场记录 ');
    await expect(input).toBeFocused();
  });
}
