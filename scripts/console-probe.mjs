/** 抓取编辑器流程中的 pageerror 完整堆栈（诊断用）。 */
import { chromium } from '@playwright/test';

const base = process.argv[2] ?? 'http://127.0.0.1:4180';
const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
const errors = [];
page.on('pageerror', (err) => errors.push(`PAGEERROR: ${err.stack ?? err.message}`));
page.on('console', (msg) => {
  if (msg.type() === 'error' || msg.type() === 'warning') {
    errors.push(`CONSOLE-${msg.type()}: ${msg.text()}\n  at ${JSON.stringify(msg.location())}`);
  }
});
await page.goto(base);
await page.waitForTimeout(1200);

// 补录报送单位
await page.getByPlaceholder(/向安小能发送指令/).fill('报送单位是清河防汛值班室');
await page.keyboard.press('Enter');
await page.waitForTimeout(5000);
// 生成要情
await page.getByPlaceholder(/向安小能发送指令/).fill('生成应急要情');
await page.keyboard.press('Enter');
await page.waitForTimeout(9000);
// 打开编辑器
await page.locator('button', { hasText: '文书中心' }).last().click();
await page.waitForTimeout(600);
const card = page.locator('.doc-card', { hasText: '应急要情' }).filter({ hasText: '草稿' }).first();
await card.getByRole('button', { name: /编\s*辑/ }).click();
await page.waitForTimeout(1200);
// 输入
await page.locator('.ProseMirror').click();
await page.keyboard.press('Control+End');
await page.keyboard.type('测试第一行');
await page.keyboard.press('Enter');
await page.keyboard.type('经初步了解，现场无人员伤亡。');
await page.waitForTimeout(600);
// 保存 + 校核
await page.locator('.ant-drawer', { hasText: '工作副本' }).last().getByRole('button', { name: '保存工作副本' }).click();
await page.waitForTimeout(2500);
await page.locator('.ant-drawer', { hasText: '工作副本' }).last().getByRole('button', { name: /重新校核|校\s*核/ }).click();
await page.waitForTimeout(3000);
// 采用建议（若出现）
const adopt = page.locator('.ant-drawer', { hasText: '工作副本' }).last().getByRole('button', { name: '采用建议' }).first();
if (await adopt.isVisible().catch(() => false)) {
  await adopt.click();
  await page.waitForTimeout(3000);
}
console.log('=== ERRORS ===');
console.log(errors.length ? errors.join('\n---\n') : '(none)');
await b.close();
