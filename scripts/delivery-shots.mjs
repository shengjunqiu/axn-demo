/* global setTimeout, console */
/**
 * 交付截图脚本：主线各关键状态（等待 toast 消失，画面干净）。
 * 运行：pnpm build 后 node scripts/delivery-shots.mjs（需 preview 4173 已启动）
 */
import { chromium } from '@playwright/test';
import * as fs from 'node:fs';

const OUT = 'artifacts/screens';
fs.mkdirSync(OUT, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const b = await chromium.launch();
const page = await b.newPage({ viewport: { width: 1440, height: 900 } });
await page.goto('http://127.0.0.1:4173/');
await page.waitForTimeout(1500);

async function topAndShot(path) {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.screenshot({ path });
}

async function send(text) {
  await page.getByPlaceholder(/向安小能发送指令/).fill(text);
  await page.keyboard.press('Enter');
  await sleep(6500);
}

// 1. 首屏
await topAndShot(`${OUT}/d01-home.png`);

// 2. 灾情摘要（任务执行卡 + 来源标注）
await send('生成灾情摘要');
await sleep(1500);
await topAndShot(`${OUT}/d02-summary.png`);

// 3. 资源 + 候选 + 派生汇总
await send('查询周边救援资源');
await send('它们谁最快能到');
await page.getByRole('button', { name: '查看资源与态势' }).first().click();
await page.locator('.ant-drawer', { hasText: '资源与态势（模拟）' }).waitFor({ state: 'visible', timeout: 10000 });
await page.locator('table tr', { hasText: '演示一号工程救援队' }).first().locator('span.ant-checkbox').click();
await page.locator('table tr', { hasText: '演示二号应急救援队' }).first().locator('span.ant-checkbox').click();
await sleep(800);
await topAndShot(`${OUT}/d03-resource-candidates.png`);

// 4. 建议与知识（抽屉）
await page.keyboard.press('Escape'); // 关资源抽屉
await page.getByRole('button', { name: '查看建议与知识' }).first().click();
await page.locator('.ant-drawer', { hasText: '建议与知识（模拟）' }).waitFor({ state: 'visible', timeout: 10000 });
await topAndShot(`${OUT}/d04-proposal.png`);
const adoptBtn = page.getByRole('button', { name: '采纳为当前建议' });
await adoptBtn.waitFor({ state: 'visible', timeout: 25000 }).catch(() => {});
await topAndShot(`${OUT}/d04-proposal.png`);
if (await adoptBtn.isVisible().catch(() => false)) {
  await adoptBtn.click();
  await sleep(2500);
}

// 5. 生成要情 + 编辑器（事实芯片）
await page.keyboard.press('Escape'); // 关建议抽屉，回到对话区
await send('报送单位是清河防汛值班室');
await send('生成应急要情');
await page.locator('button', { hasText: '文书中心' }).last().click();
await page.locator('.doc-card', { hasText: '应急要情' }).first().getByRole('button', { name: /编\s*辑/ }).click();
await page.waitForTimeout(1200);
await topAndShot(`${OUT}/d05-editor-chips.png`);

// 6. 注入无伤亡 + 校核阻断（定位到“下一步工作”段末，避免混入事实段）
await page.locator('.ProseMirror p', { hasText: '持续跟踪险情发展' }).first().click();
await page.keyboard.press('Control+End');
await page.keyboard.press('Enter');
await page.keyboard.type('经初步了解，现场无人员伤亡。');
await page.locator('.ant-drawer', { hasText: '工作副本' }).last().getByRole('button', { name: '保存工作副本' }).click();
await sleep(2500);
await page.locator('.ant-drawer', { hasText: '工作副本' }).last().getByRole('button', { name: '重新校核' }).click();
await sleep(2500);
await topAndShot(`${OUT}/d06-validation-block.png`);

// 7. 来源抽屉（点击水位芯片）
await page.locator('[data-fact-chip*="waterLevel"]').first().click();
await sleep(1000);
await topAndShot(`${OUT}/d07-source-drawer.png`);
await page.locator('.ant-drawer', { hasText: '事实来源' }).last().locator('.ant-drawer-close').click();
await sleep(600);

// 8. 采用建议清零 → 提交 → 签发
await page.locator('.ant-drawer', { hasText: '工作副本' }).last().getByRole('button', { name: '采用建议' }).first().click();
await sleep(2500);
await page.keyboard.press('Escape');
await sleep(600);
const docCard = page.locator('.doc-card', { hasText: '应急要情' }).first();
await docCard.getByRole('button', { name: '提交送审' }).click();
await sleep(1500);
await page.getByLabel('切换角色').click();
await page.getByTitle('演示指挥员').click();
await sleep(600);
await docCard.getByRole('button', { name: /签\s*发/ }).click();
await sleep(3200);
await topAndShot(`${OUT}/d08-signed.png`);

// 9. 版本抽屉
await docCard.getByRole('button', { name: /版\s*本/ }).click();
await sleep(1000);
await topAndShot(`${OUT}/d09-version-drawer.png`);

await b.close();
console.log('screens saved to', OUT);
