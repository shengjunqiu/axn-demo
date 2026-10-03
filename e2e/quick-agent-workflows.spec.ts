import { clickQuickTask } from './helpers/quickTasks';
import { expect, test } from '@playwright/test';

test('快捷任务在智能体卡片内展示执行过程和模拟结果', async ({ page }) => {
  await page.goto('/');
  for (const [label, agent, result] of [
    ['生成灾情摘要', '态势感知智能体', '人员伤亡情况'],
    ['查询周边救援资源', '资源管理智能体', '预计到达'],
  ]) {
    await clickQuickTask(page, label);
    const card = page.getByTestId('agent-summon-card').filter({ hasText: agent }).last();
    await expect(card).toBeVisible();
    await expect(card).toHaveClass(/is-running/);
    await expect(card.locator('.axn-step-running')).toBeVisible();
    await expect(card).toContainText('任务已完成，执行过程与结果如下', { timeout: 20000 });
    await expect(card).not.toHaveClass(/is-running/);
    await expect(card.locator('.axn-step-completed')).toHaveCount(3);
    await expect(card).toContainText(result);
    if (label === '查询周边救援资源') {
      await expect(card.locator('.axn-resource-result')).toHaveCount(4);
      await expect(card).toContainText('库存');
    }
  }
  await page.screenshot({ path: 'artifacts/quick-agent-workflows.png' });
});

test('空白对话提示关联灾情，关联后可正常生成摘要', async ({ page }) => {
  await page.goto('/');
  await page.locator('.axn-gs-nav-item', { hasText: '新建任务' }).first().click();
  await expect(page.getByText('空白对话（未关联事件）').first()).toBeVisible();
  await clickQuickTask(page, '生成灾情摘要');
  const card = page.getByTestId('agent-summon-card').last();
  await expect(card).toContainText('当前对话尚未关联有效灾情');
  await expect(card).toContainText('待补充信息');
  await expect(card).not.toContainText('INTERNAL');
  await page.getByTestId('chat-link-incident').click();
  await page.locator('.ant-select-item-option', { hasText: '清河段堤防险情' }).click();
  await clickQuickTask(page, '生成灾情摘要');
  await expect(page.getByTestId('agent-summon-card').last()).toContainText('任务已完成，执行过程与结果如下', { timeout: 20000 });
  await expect(page.getByTestId('agent-summon-card').last()).toContainText('人员伤亡情况');
});

test('五类智能体均有入口，方案与评估可执行并展示结果', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: '更多任务', exact: true }).click();
  for (const id of ['agent-situation', 'agent-resource', 'agent-plan', 'agent-doc', 'agent-eval']) {
    await expect(page.locator(`.axn-chips [data-agent-id="${id}"]`).first()).toBeVisible();
  }
  await page.keyboard.press('Escape');
  await clickQuickTask(page, '生成救援方案');
  const plan = page.getByTestId('agent-summon-card').filter({ hasText: '救援方案生成智能体' }).last();
  await expect(plan).toHaveClass(/is-running/);
  await expect(plan).toContainText('任务已完成，执行过程与结果如下', { timeout: 20000 });
  await expect(plan).toContainText('信息核实');
  await expect(plan).toContainText('专业审核');
  await clickQuickTask(page, '评估救援效果');
  const evaluation = page.getByTestId('agent-summon-card').filter({ hasText: '效果评估智能体' }).last();
  await expect(evaluation).toHaveClass(/is-running/);
  await expect(evaluation).toContainText('任务已完成，执行过程与结果如下', { timeout: 20000 });
  await expect(evaluation).toContainText('群众转移安置 108/120人');
  await expect(evaluation).toContainText('完成率 90%');
  await expect(evaluation).toContainText('剩余风险');
  await expect(evaluation).toContainText('评估结论');
});
