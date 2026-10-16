import { expect, type Page } from '@playwright/test';
import { tenderName, tenderTaskPrompt } from '../../src/seed/tenderNames';

/** 与 ChatPanel 能力块一致（勿 import agentQuickTasks：其依赖 JSON，Playwright 无法直接加载）。 */
const PARENTS = [
  { label: '文书生成', agentId: 'agent-doc' },
  { label: '态势感知', agentId: 'agent-situation' },
  { label: '救援资源管理', agentId: 'agent-resource' },
  { label: '救援方案生成', agentId: 'agent-plan' },
  { label: '救援效果评估', agentId: 'agent-eval' },
] as const;

function displayCandidates(raw: string): string[] {
  const key = tenderTaskPrompt(raw) || raw;
  return [...new Set([tenderName(key), tenderName(raw), raw, key])];
}

function parentButton(chips: ReturnType<Page['locator']>, agentId: string) {
  return chips.locator(`[data-agent-id="${agentId}"]`);
}

/** 点能力块打开对话内邀请选项（五块统一）。 */
export async function openQuickTaskMenu(page: Page, label: string) {
  const parent = PARENTS.find((p) => p.label === label);
  expect(parent, `未知能力块：${label}`).toBeTruthy();
  const chip = parentButton(page.locator('.axn-chips'), parent!.agentId);
  await expect(chip).toBeVisible();
  await chip.click();
  await expect(page.getByTestId('agent-invite-choices').last()).toBeVisible();
}

/**
 * 通过能力块发起任务。
 * - `(page, 父块 label, task 展示名)`：点能力块后在邀请气泡中选功能
 * - `(page, task 或展示名)`：依次点各能力块，在邀请选项中匹配
 */
export async function clickQuickTask(page: Page, labelOrTask: string, task?: string) {
  const chips = page.locator('.axn-chips');

  if (task != null) {
    const parent = PARENTS.find((p) => p.label === labelOrTask.replace(/智能体$/, ''));
    expect(parent, `未知能力块：${labelOrTask}`).toBeTruthy();
    await parentButton(chips, parent!.agentId).click();
    await page.getByTestId('agent-invite-choices').last().getByRole('button', { name: task, exact: true }).click();
    return;
  }

  const names = displayCandidates(labelOrTask);
  const parentLabels = new Set(PARENTS.map((p) => p.label));

  // host override 平铺 / 已出现在最新邀请气泡中的选项
  for (const name of names) {
    if (parentLabels.has(name)) continue;
    const inviteChoice = page.getByTestId('agent-invite-choices').last().getByRole('button', { name, exact: true });
    if (await inviteChoice.count()) {
      await inviteChoice.click();
      return;
    }
    const flat = chips.getByRole('button', { name, exact: true });
    if (await flat.count()) {
      await flat.first().click();
      return;
    }
  }

  for (const parent of PARENTS) {
    await parentButton(chips, parent.agentId).click();
    const choices = page.getByTestId('agent-invite-choices').last();
    await expect(choices).toBeVisible();
    for (const name of names) {
      const choice = choices.getByRole('button', { name, exact: true });
      if (await choice.count()) {
        await choice.click();
        return;
      }
    }
  }

  throw new Error(`未找到快捷任务：${labelOrTask}`);
}

/** 文书生成：先点能力块，再点气泡选项（展示名）。 */
export async function clickDocTask(page: Page, name: string) {
  await clickQuickTask(page, `生成${name}`);
}
