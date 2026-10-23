import { clickQuickTask } from './helpers/quickTasks';
import { expect, test } from '@playwright/test';

test('主助手先比较处置方向，主动生成后才打开方案文书', async ({ page }) => {
  await page.goto('/#/assistant');
  await page.getByText('青岭村山体滑坡（模拟）', { exact: true }).first().click();
  await page.getByRole('button', { name: '救援方案生成', exact: true }).click();
  await page.getByRole('button', { name: '现场处置行动方案', exact: true }).last().click();
  const choices = page.getByTestId('rescue-plan-choices').last();
  await expect(choices).toContainText('先比较适用条件');
  await expect(page.getByTestId('mock-redhead-document')).toHaveCount(0);
  const option = choices.getByRole('button', { name: '专业审定后的工程清障行动方案', exact: true });
  await option.click();
  await expect(option).toHaveAttribute('aria-pressed', 'true');
  await expect(choices.locator('.axn-artifact').first()).toContainText('支撑、清障工序须专业审定');
  await choices.getByRole('button', { name: '按所选方向生成方案草稿' }).click();
  await expect(page.getByTestId('mock-redhead-document')).toBeVisible();
  await expect(page.getByRole('textbox', { name: '文书标题', exact: true })).toHaveValue(/专业审定后的工程清障/);
});

test('快捷任务在智能体卡片内展示执行过程和模拟结果', async ({ page }) => {
  await page.goto('/');
  for (const [label, agent, result] of [
    ['多源数据汇聚', '态势感知智能体', '六类数据来源'],
    ['生成态势报告', '态势感知智能体', '已生成态势报告初稿'],
    ['查询周边救援资源', '救援资源管理智能体', '资源智能检索'],
  ] as const) {
    await clickQuickTask(page, label);
    const card = page.getByTestId('agent-summon-card').filter({ hasText: agent }).last();
    await expect(card).toBeVisible();
    await expect(card).toHaveClass(/is-running/);
    await expect(card).toContainText('任务已完成，执行过程与结果如下', { timeout: 20000 });
    await expect(card).not.toHaveClass(/is-running/);
    await expect(card).toContainText(result);
    if (label === '多源数据汇聚') {
      await expect(card).toContainText('多源数据汇聚');
      await expect(card).toContainText('汇聚快照');
    }
    if (label === '生成态势报告') {
      await expect(card.getByTestId('scenario-sections')).toContainText('报告 / 方案草稿');
      await expect(card.getByTestId('scenario-sections').locator('details')).toHaveCount(0);
      await expect(card.getByTestId('scenario-sections')).toContainText('模拟数据 · 更新于');
      await expect(card.getByRole('button', { name: '查看文书' })).toBeVisible();
      await expect(page.getByTestId('mock-redhead-document')).toBeVisible({ timeout: 10000 });
      await expect(page.getByTestId('mock-redhead-document')).toContainText(/灾\s*情\s*态\s*势\s*报\s*告/);
      await expect(page.getByTestId('mock-redhead-document').locator('.doc-rich table').first()).toBeVisible();
      await expect(page.getByTestId('mock-redhead-document').locator('.doc-rich table th').first()).not.toBeEmpty();
    }
    if (label === '查询周边救援资源') {
      await expect(card).toContainText('周边资源');
      await expect(card.getByRole('button', { name: '列表' }).or(card.getByRole('button', { name: '查看资源列表' })).first()).toBeVisible();
      await expect(card.getByRole('button', { name: '地图' }).or(card.getByRole('button', { name: '查看态势地图' })).first()).toBeVisible();
    }
  }
  await page.screenshot({ path: 'artifacts/quick-agent-workflows.png' });
});

test('救援资源管理查询展示清单，明确生成报告后才打开文书', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('new-conversation-btn').click();
  await page.getByTestId('chat-link-incident').click();
  await page.getByTestId('incident-picker').getByRole('option', { name: /南湾堤段洪涝决口/ }).first().click();
  await page.getByTestId('incident-picker').getByRole('button', { name: /^(确认绑定|新开会话并绑定|确认选择)$/ }).click();
  await expect(page.getByText('【当前状态】')).toBeVisible();
  await clickQuickTask(page, '查询周边救援资源');
  const card = page.getByTestId('agent-summon-card').filter({ hasText: '救援资源管理智能体' }).last();
  await expect(card).toContainText('任务已完成，执行过程与结果如下', { timeout: 20000 });
  await expect(card).not.toContainText('暂无获授权的资源数据，不能沿用其他事件');
  await expect(card.getByTestId('scenario-sections')).toBeVisible();
  await expect(card.getByRole('button', { name: '查看态势地图' }).first()).toBeVisible();
  await expect(page.getByTestId('mock-redhead-document')).toHaveCount(0);
  await card.getByRole('button', { name: '查看态势地图' }).first().click();
  await expect(page.getByTestId('resource-tab-map')).toBeVisible();
});

test('空白对话选择事件后生成灾情摘要', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('new-conversation-btn').click();
  await expect(page.getByTestId('chat-link-incident')).toContainText('未关联事件');
  await clickQuickTask(page, '态势感知', '生成态势报告');
  await expect(page.locator('.axn-task-card')).toHaveCount(0);
  await expect(page.getByTestId('incident-picker')).toContainText('选择要分析的事件');
  await page.getByTestId('incident-picker').getByRole('option', { name: /青岭村山体滑坡/ }).first().click();
  await page.getByTestId('incident-picker').getByRole('button', { name: /^(确认绑定|新开会话并绑定|确认选择)$/ }).click();
  await expect(page.getByTestId('agent-summon-card').last()).toContainText('任务已完成，执行过程与结果如下', { timeout: 20000 });
  await expect(page.getByTestId('header-event')).toContainText('青岭村山体滑坡');
});

test('五类智能体均有入口，方案与评估可执行并展示结果', async ({ page }) => {
  await page.goto('/');
  const chips = page.locator('.axn-chips');
  for (const id of ['agent-doc', 'agent-situation', 'agent-resource', 'agent-plan', 'agent-eval']) {
    await expect(chips.locator(`[data-agent-id="${id}"]`).first()).toBeVisible();
  }
  await expect(chips.getByTestId('chip-more-actions')).toHaveCount(0);
  await clickQuickTask(page, '生成救援方案');
  const planReply = page.getByTestId('rescue-plan-choices').last();
  await expect(planReply).toContainText('救援方案生成智能体');
  await expect(planReply).toContainText('已整理三种处置方向');
  await expect(planReply.getByRole('button', { name: '按所选方向生成方案草稿' })).toBeVisible();
  await planReply.getByRole('button', { name: '查看文书' }).first().click();
  await expect(page.getByTestId('mock-redhead-document')).toBeVisible({ timeout: 10000 });
  // 评估需「待复盘」阶段：切到种子阶段已是待复盘的事件后再跑
  await page.getByTestId('new-conversation-btn').click();
  await page.getByTestId('chat-link-incident').click();
  await page.getByTestId('incident-picker').getByRole('option', { name: /待复盘/ }).first().click();
  await page.getByTestId('incident-picker').getByRole('button', { name: /^(确认绑定|新开会话并绑定|确认选择)$/ }).click();
  await clickQuickTask(page, '评估救援效果');
  const evaluation = page.getByTestId('agent-summon-card').filter({ hasText: '救援效果评估智能体' }).last();
  await expect(evaluation).toContainText('任务已完成，执行过程与结果如下', { timeout: 20000 });
  await expect(evaluation.getByTestId('scenario-sections')).toBeVisible();
  await expect(evaluation.getByRole('button', { name: '查看文书' })).toBeVisible();
  await expect(page.getByTestId('mock-redhead-document')).toBeVisible({ timeout: 10000 });
});

test('V2四场景在安小能手机端完成，明确应用前不改变原页面', async ({ page }) => {
  await page.goto('/#/v2/assembly');
  await expect(page.getByRole('button', { name: /AI编组建议|AI生成抽组/ })).toHaveCount(0);
  await page.goto('/#/v2/resources');
  await expect(page.getByRole('button', { name: '对话赋能', exact: true })).toBeVisible();
  await expect(page.locator('.paper h1')).toContainText('资源调度建议方案');
  await expect(page.getByRole('columnheader', { name: '人员数量（人）' })).toBeVisible();
  const original = await page.locator('#workspace .paper').textContent() ?? '';
  await page.getByRole('button', { name: /AI生成调度建议$/ }).click();
  await expect(page.getByRole('dialog', { name: '安小能手机端助手' })).toBeVisible();
  await expect(page.locator('dialog.v2-empowerment')).toHaveCount(0);
  const phone = page.frameLocator('iframe[title="安小能助手（手机端）"]');
  await expect(phone.getByTestId('v2-phone-workflow')).toBeVisible();
  await expect(phone.getByText('核对生成条件', { exact: true })).toHaveCount(0);
  await expect(phone.getByRole('button', { name: '确认条件并生成草稿' })).toHaveCount(0);
  await expect(phone.getByRole('textbox')).toHaveCount(1);
  await expect(phone.getByTestId('v2-phone-result')).toContainText('公文已生成');
  await expect(phone.getByTestId('v2-official-document-card')).toBeVisible();
  await expect(phone.locator('.axn-qa-sources')).toContainText('指令下发队伍列表');
  await expect(phone.locator('.axn-qa-sources')).toContainText('物资台账与下一阶段需求');
  await expect(phone.getByTestId('v2-source-reference').locator('p > sup.axn-cite').first()).toHaveText('1');
  await expect(phone.locator('.axn-qa-sources ol')).toHaveCSS('list-style-type', 'none');
  await expect(phone.locator('.axn-qa-source').first()).toHaveCSS('display', 'flex');
  await expect(phone.locator('.axn-qa-source > .axn-cite').first()).toHaveCSS('display', 'grid');
  await expect(phone.locator('.axn-qa-source-quote').first()).toHaveCSS('-webkit-line-clamp', '2');
  await phone.getByTestId('v2-source-reference').screenshot({ path: 'output/playwright/v2-source-reference.png' });
  await phone.locator('.axn-qa-source').first().click();
  await expect(phone.getByText('依据原文', { exact: true })).toBeVisible();
  await expect(phone.locator('.axn-controls-drawer blockquote')).toContainText('明坑村');
  await phone.locator('.ant-drawer-close').click();
  await phone.getByRole('button', { name: '查看文书', exact: true }).click();
  await expect(phone.getByTestId('mock-redhead-document')).toContainText('需求量不明');
  await phone.getByRole('button', { name: '关闭文书', exact: true }).click();
  await expect(page.locator('#workspace .paper')).toHaveText(original);
  await phone.getByRole('button', { name: '保存手机端草稿', exact: true }).click();
  await expect(phone.getByRole('status')).toContainText('原业务页未改变');
  await expect(page.locator('#workspace .paper')).toHaveText(original);
  await phone.getByRole('button', { name: '应用到原业务页', exact: true }).click();
  await expect(phone.getByRole('status')).toContainText('已保存并带回原业务页');
  await expect(page.locator('#workspace .paper')).toContainText('需求量不明');
  await page.getByRole('button', { name: '收起安小能', exact: true }).click();
  await page.getByRole('button', { name: /AI生成调度建议$/ }).click();
  await expect(phone.getByTestId('v2-phone-result')).toBeVisible();
  await page.goto('/#/v2/orders');
  await page.getByRole('button', { name: /AI推荐下发对象$/ }).click();
  await expect(phone.getByTestId('v2-candidate-list')).toContainText('共3条 · 推荐1条 · 不推荐2条');
  await expect(phone.getByRole('checkbox', { name: '选择南昌队常备中队' })).toBeDisabled();
  await expect(phone.getByRole('checkbox', { name: '选择梅江灌区项目部' })).toBeDisabled();
  await phone.getByRole('textbox', { name: '给安小能发消息' }).fill('100公里内');
  await phone.getByRole('button', { name: '发送消息' }).click();
  await expect(phone.getByTestId('v2-candidate-list')).toContainText('共3条 · 推荐0条 · 不推荐3条');
  await phone.getByRole('textbox', { name: '给安小能发消息' }).fill('200公里内，每队至少10人');
  await phone.getByRole('button', { name: '发送消息' }).click();
  await expect(phone.getByTestId('v2-phone-result')).toContainText('单队至少10人');
  await expect(phone.getByRole('checkbox', { name: '选择永新项目部' })).toBeVisible();
  const applyTeam = phone.getByRole('button', { name: '确认对象并带回原列表' });
  await expect(applyTeam).toBeEnabled();
  await phone.getByRole('checkbox', { name: '选择永新项目部' }).uncheck();
  await expect(applyTeam).toBeDisabled();
  await phone.getByRole('checkbox', { name: '选择永新项目部' }).check();
  await applyTeam.click();
  await expect(phone.getByRole('status')).toContainText('未下发指令');
  await expect(page.getByRole('checkbox', { name: '选择此项', exact: true }).nth(2)).toBeChecked();
  await page.goto('/#/v2/plan');
  const originalPlan = await page.locator('.paper').textContent() ?? '';
  await page.getByRole('button', { name: /AI生成处置方案$/ }).click();
  await expect(phone.getByTestId('v2-official-document-card')).toBeVisible();
  await phone.getByRole('button', { name: '查看文书', exact: true }).click();
  await expect(phone.getByTestId('mock-redhead-document')).toBeVisible();
  const first = phone.getByRole('textbox', { name: '第1节正文', exact: true });
  await first.fill('人工保留的灾情描述');
  await phone.getByRole('button', { name: '保存修改', exact: true }).click();
  await phone.getByRole('button', { name: '关闭文书', exact: true }).click();
  await expect(page.locator('.paper')).toHaveText(originalPlan);
  await phone.getByRole('button', { name: '应用到原业务页', exact: true }).click();
  await expect(page.locator('.paper')).toContainText('人工保留的灾情描述');
  await page.goto('/#/v2/summary');
  const rowCount = await page.locator('#workspace .data-table tbody tr').count();
  await page.getByRole('button', { name: '新建报告' }).click();
  await expect(phone.getByTestId('v2-phone-result')).toContainText('现场反馈5条');
  await phone.getByRole('textbox', { name: '给安小能发消息' }).fill('截止2026-09-05 18:00');
  await phone.getByRole('button', { name: '发送消息' }).click();
  await expect(phone.getByTestId('v2-phone-result')).toContainText('现场反馈1条');
  await expect(phone.locator('.axn-qa-sources')).toContainText('r1 ·');
  await expect(phone.locator('.axn-qa-sources')).not.toContainText('r5 ·');
  await phone.getByRole('button', { name: '查看文书', exact: true }).click();
  await expect(phone.getByTestId('mock-redhead-document')).toContainText('【r1 ');
  await expect(phone.getByTestId('mock-redhead-document')).not.toContainText('累计救出12人');
  await phone.getByRole('button', { name: '关闭文书', exact: true }).click();
  await expect(page.locator('#workspace .data-table tbody tr')).toHaveCount(rowCount);
  await phone.getByRole('button', { name: '保存并带回原报告列表', exact: true }).click();
  await expect(page.locator('#workspace .data-table tbody tr')).toHaveCount(rowCount + 1);
});
