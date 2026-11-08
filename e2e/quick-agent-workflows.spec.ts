import { clickQuickTask } from './helpers/quickTasks';
import { expect, test } from '@playwright/test';

test('快捷任务在智能体卡片内展示执行过程和模拟结果', async ({ page }) => {
  await page.goto('/');
  for (const [index, [label, task, agent, result]] of ([
    ['态势感知', '灾情摘要', '态势感知智能体', '人员伤亡情况'],
    ['救援资源管理', '周边救援资源', '资源管理智能体', '预计到达'],
  ] as const).entries()) {
    // 召唤首个智能体后入口行被能力按钮接替，换智能体先开新对话
    if (index > 0) await page.getByTestId('new-conversation-btn').click();
    await clickQuickTask(page, label, task);
    const card = page.getByTestId('agent-summon-card').filter({ hasText: agent }).last();
    await expect(card).toBeVisible();
    await expect(card).toHaveClass(/is-running/);
    await expect(card.locator('.axn-step-running')).toBeVisible();
    await expect(card).toContainText('任务已完成，执行过程与结果如下', { timeout: 20000 });
    await expect(card).not.toHaveClass(/is-running/);
    await card.getByRole('button', { name: '展开执行过程', exact: true }).click();
    await expect(card.locator('.axn-step-completed')).toHaveCount(3);
    await expect(card).toContainText(result);
    if (label === '救援资源管理') {
      await expect(card.locator('.axn-resource-result')).toHaveCount(4);
      await expect(card).toContainText('库存');
    }
  }
  await page.screenshot({ path: 'artifacts/quick-agent-workflows.png' });
});

test('空白对话选择事件后自动生成摘要', async ({ page }) => {
  await page.goto('/');
  await page.getByTestId('new-conversation-btn').click();
  await clickQuickTask(page, '态势感知', '灾情摘要');
  await expect(page.locator('.axn-task-card')).toHaveCount(0);
  await expect(page.getByTestId('incident-picker')).toContainText('选择要分析的事件');
  await page.getByTestId('incident-picker').getByRole('option', { name: /清河段堤防险情/ }).click();
  await page.getByTestId('incident-picker').getByRole('button', { name: /^(确认绑定|新开会话并绑定|确认选择)$/ }).click();
  await expect(page.getByTestId('agent-summon-card').last()).toContainText('任务已完成，执行过程与结果如下', { timeout: 20000 });
  await expect(page.getByTestId('agent-summon-card').last()).toContainText('人员伤亡情况');
  await expect(page.getByTestId('header-event')).toContainText('清河段堤防险情');
});

test('五类智能体均有入口，方案与评估可执行并展示结果', async ({ page }) => {
  await page.goto('/');
  for (const id of ['agent-situation', 'agent-resource', 'agent-plan', 'agent-doc', 'agent-eval']) {
    await expect(page.locator(`.axn-chips [data-agent-id="${id}"]`).first()).toBeVisible();
  }
  await clickQuickTask(page, '救援方案生成', '现场处置行方案');
  const plan = page.getByTestId('agent-summon-card').filter({ hasText: '救援方案生成智能体' }).last();
  await expect(plan).toHaveClass(/is-running/);
  await expect(plan).toContainText('任务已完成，执行过程与结果如下', { timeout: 20000 });
  await expect(plan).toContainText('信息核实');
  await expect(plan).toContainText('专业审核');
  // 入口行已被能力按钮接替，换智能体先开新对话
  await page.getByTestId('new-conversation-btn').click();
  await clickQuickTask(page, '救援效果评估', '复盘评估分析');
  const evaluation = page.getByTestId('agent-summon-card').filter({ hasText: '效果评估智能体' }).last();
  await expect(evaluation).toHaveClass(/is-running/);
  await expect(evaluation).toContainText('任务已完成，执行过程与结果如下', { timeout: 20000 });
  await expect(evaluation).toContainText('群众转移安置 108/120人');
  await expect(evaluation).toContainText('完成率 90%');
  await expect(evaluation).toContainText('剩余风险');
  await expect(evaluation).toContainText('评估结论');
});
