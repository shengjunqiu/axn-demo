/**
 * E2E 主线（AC-001~AC-023 覆盖）：灾情摘要 → 资源查询 → 连续追问 → 候选管理 →
 * 处置建议 → 生成要情 → 补录 → 编辑 → 校核发现问题 → 采用建议 → 提交 → 签发 → 导出/打印 → 持久化。
 * 全部断言基于真实 UI 行为，不 mock 网络（本应用本身即本地模拟）。
 */
import { expect, test, type Page } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';

async function sendChat(page: Page, text: string) {
  // 统一走主输入框：规则识别支持“报送单位是…/交接事项是…”整句，产品侧会剥离重复前缀
  await page.getByPlaceholder(/向安小能发送指令/).fill(text);
  await page.keyboard.press('Enter');
}

async function waitTaskDone(page: Page, title: string, timeout = 30000) {
  const card = page.locator('.axn-task-card', { hasText: title }).last();
  await expect(card).toBeVisible({ timeout });
  await expect(card.getByText('已完成').first()).toBeVisible({ timeout });
  return card;
}

test.describe('安小能演示主线（要情全链路）', () => {
  let consoleErrors: string[] = [];
  const errorStacks: string[] = [];

  test.beforeEach(async ({ page }) => {
    consoleErrors = [];
    page.on('pageerror', (err) => {
      consoleErrors.push(String(err));
      errorStacks.push(err.stack ?? '(no stack)');
    });
    await page.goto('/');
    await expect(page.getByText('安小能 · 应急智能工作台')).toBeVisible();
    await expect(page.getByText('演示环境 · 模拟数据', { exact: false }).first()).toBeVisible();
  });

  test('灾情摘要 → 资源 → 追问 → 候选 → 建议 → 要情 → 编辑校核 → 签发 → 导出打印', async ({ page }, testInfo) => {
    test.setTimeout(240000);
    const shot = (name: string) =>
      page.screenshot({ path: path.join('artifacts/screens', `${testInfo.repeatIter ?? ''}${name}.png`), fullPage: false });

    // 1. 灾情摘要
    await sendChat(page, '生成灾情摘要');
    await waitTaskDone(page, '汇总灾情摘要');
    await expect(page.getByText('待核实', { exact: false }).first()).toBeVisible();
    await shot('01-summary');

    // 2. 资源查询（任务卡显示结果概要；队伍明细在资源与态势页签）
    await sendChat(page, '查询周边救援资源');
    await waitTaskDone(page, '查询周边救援资源');
    await page.getByRole('button', { name: '资源与态势', exact: true }).click();
    await expect(page.locator('.ant-table, table').getByText('演示一号工程救援队').first()).toBeVisible();
    await expect(page.locator('.ant-table, table').getByText('演示二号应急救援队').first()).toBeVisible();
    await expect(page.locator('svg').first()).toBeVisible(); // 本地 SVG 态势图
    await shot('02-resources');

    // 3. 连续追问：谁最快能到
    await sendChat(page, '它们谁最快能到');
    const etaCard = await waitTaskDone(page, '按预计到达排序');
    await expect(etaCard.getByText('演示一号工程救援队').first()).toBeVisible();

    // 4. 勾选前两支候选 → 汇总 2 支 / 64 人 / 7 台
    await page.locator('table tr', { hasText: '演示一号工程救援队' }).first().locator('span.ant-checkbox').click();
    await page.locator('table tr', { hasText: '演示二号应急救援队' }).first().locator('span.ant-checkbox').click();
    await expect(page.locator('.axn-derived-value', { hasText: '64' }).first()).toBeVisible();
    await expect(page.locator('.axn-derived-value', { hasText: '7' }).first()).toBeVisible();
    await expect(page.getByText('候选 ≠ 已调派').first()).toBeVisible();
    await shot('03-candidates');

    // 5. 移除二号队 → 1 支 / 36 人 / 4 台
    await page.locator('.axn-candidate-zone .ant-tag', { hasText: '演示二号应急救援队' }).locator('.anticon-close').click();
    await expect(page.locator('.axn-derived-value', { hasText: '36' }).first()).toBeVisible();
    await expect(page.locator('.axn-derived-value', { hasText: '4' }).first()).toBeVisible();

    // 6. 处置建议 + 采纳
    await sendChat(page, '给我处置建议');
    await waitTaskDone(page, '形成处置建议');
    await page.getByRole('button', { name: '建议与知识' }).click();
    await page.getByRole('button', { name: '采纳为当前建议' }).click();
    await expect(page.getByText('已采纳').first()).toBeVisible();
    await shot('04-proposal');

    // 7. 生成应急要情 → 缺报送单位 → 补录
    await sendChat(page, '生成应急要情');
    const clarifyCard = page.locator('.axn-task-card', { hasText: '生成应急要情' }).last();
    await expect(clarifyCard.getByText('待补充信息')).toBeVisible({ timeout: 20000 });
    await sendChat(page, '报送单位是清河段防汛值班室');
    await expect(page.locator('.axn-task-card', { hasText: '补录报送单位' }).last().getByText('已完成')).toBeVisible({ timeout: 20000 });

    // 8. 再次生成 → 草稿建立 → 打开文书中心
    await sendChat(page, '生成应急要情');
    await waitTaskDone(page, '生成应急要情');
    await page.locator('button', { hasText: '文书中心' }).last().click();
    const docCard = page.locator('.doc-card', { hasText: '应急要情' }).first();
    await expect(docCard).toBeVisible();
    await shot('05-doc-center');

    // 9. 首次校核（生成内容合法，应无阻断）
    await docCard.getByRole('button', { name: /校\s*核/ }).click();
    await expect(docCard.getByText(/最近校核/)).toBeVisible({ timeout: 15000 });
    await expect(docCard.getByText(/无问题|阻断 0/)).toBeVisible({ timeout: 15000 });

    // 10. 编辑注入“无人员伤亡” → 保存 → 重新校核出现 R-004 阻断
    await docCard.getByRole('button', { name: /编\s*辑/ }).click();
    const editorDrawer = page.locator('.ant-drawer', { hasText: '工作副本' }).last();
    await expect(editorDrawer).toBeVisible();
    // 定位到“五、下一步工作”段落末尾（避免把矛盾句混入其他事实段，导致建议替换时波及无关绑定）
    const nextStepPara = editorDrawer.locator('.ProseMirror p', { hasText: '持续跟踪险情发展' }).first();
    await nextStepPara.click();
    await page.keyboard.press('Control+End');
    await page.keyboard.press('Enter');
    await page.keyboard.type('经初步了解，现场无人员伤亡。');
    await expect(editorDrawer.getByText('有未保存修改')).toBeVisible({ timeout: 10000 });
    // 若误点事实芯片打开了来源抽屉，先关闭（Esc 只关最上层）
    const sourceDrawer = page.locator('.ant-drawer', { hasText: '事实来源' }).last();
    if (await sourceDrawer.isVisible().catch(() => false)) {
      await sourceDrawer.locator('.ant-drawer-close').click();
      await expect(sourceDrawer).toBeHidden({ timeout: 5000 });
    }
    await editorDrawer.getByRole('button', { name: '保存工作副本' }).click();
    // 保存成功提示为全局 message（挂在 body），另以“有未保存修改”标签消失为辅证
    await expect(page.getByText('工作副本已保存', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    await expect(editorDrawer.getByText('有未保存修改')).toBeHidden({ timeout: 10000 });

    // 编辑器内校核面板应显示阻断问题
    await editorDrawer.getByRole('button', { name: '重新校核' }).click();
    await expect(editorDrawer.getByText('伤亡表述与来源矛盾', { exact: false }).first()).toBeVisible({ timeout: 15000 });
    await shot('06-validation-block');

    // 11. 采用建议 → 阻断清零
    await editorDrawer.getByRole('button', { name: '采用建议' }).first().click();
    await expect(editorDrawer.getByText('人员伤亡情况待核实', { exact: false }).first()).toBeVisible({ timeout: 10000 });
    await expect(editorDrawer.locator('.validation-issue--block, [class*="block"]').first()).toBeHidden({ timeout: 15000 }).catch(() => {
      // 校核面板以分组呈现；阻断清零以最近校核文案在文书中心复核
    });
    await page.keyboard.press('Escape');
    await expect(docCard.getByText(/无问题|阻断 0/)).toBeVisible({ timeout: 20000 });
    await shot('07-validation-clean');

    // 12. 提交送审 → 切指挥员 → 签发 → 锁定
    await docCard.getByRole('button', { name: '提交送审' }).click();
    await expect(docCard.getByText('待签发')).toBeVisible({ timeout: 15000 });
    await page.getByLabel('切换角色').click();
    await page.getByTitle('演示指挥员').click();
    await docCard.getByRole('button', { name: /签\s*发/ }).click();
    await expect(docCard.getByText('已签发')).toBeVisible({ timeout: 15000 });
    await expect(docCard.getByText('签发人 演示指挥员', { exact: false })).toBeVisible();
    await shot('08-signed');

    // 13. 版本抽屉：导出 Word（真实下载）+ 打印预览
    await docCard.getByRole('button', { name: /版\s*本/ }).click();
    const versionDrawer = page.locator('.ant-drawer', { hasText: '版本历史' }).last();
    await expect(versionDrawer).toBeVisible();
    await expect(versionDrawer.getByText(/V\d+\.\d+/, { exact: false }).first()).toBeVisible();
    // FR-013：送审快照即首版 V1.0
    await expect(versionDrawer.getByText('V1.0', { exact: true }).first()).toBeVisible();
    const downloadPromise = page.waitForEvent('download', { timeout: 30000 });
    await versionDrawer.getByRole('button', { name: '导出 Word' }).first().click();
    const download = await downloadPromise;
    const docxPath = path.join('artifacts/downloads', download.suggestedFilename());
    fs.mkdirSync(path.dirname(docxPath), { recursive: true });
    await download.saveAs(docxPath);
    expect(download.suggestedFilename()).toMatch(/\.docx$/);
    const bytes = fs.readFileSync(docxPath);
    expect(bytes.length).toBeGreaterThan(8000);
    expect(bytes.subarray(0, 2).toString()).toBe('PK'); // ZIP 容器 = 真 DOCX
    // 审查 B-1 回归：解包断言 document.xml 含真实数值（派生值不得为“（重算中）”占位）
    const JSZip = (await import('jszip')).default;
    const zip = await JSZip.loadAsync(bytes);
    const docXml = await zip.file('word/document.xml')!.async('string');
    expect(docXml).toContain('36'); // 候选人员总数（步骤 5 移除二号队后为 1 支 / 36 人 / 4 台）
    expect(docXml).toContain('42.3'); // 水位事实值
    expect(docXml).not.toContain('（重算中）');
    expect(docXml).toContain('模拟'); // 模拟数据声明必须在导出内容中
    await shot('09-version-drawer');

    // 14. 打印预览（另存为 PDF 入口）
    await versionDrawer.getByRole('button', { name: /打\s*印/ }).first().click();
    const printDrawer = page.locator('.ant-drawer', { hasText: '打印预览' }).last();
    await expect(printDrawer).toBeVisible();
    await expect(printDrawer.getByText('打印 / 另存为 PDF', { exact: false }).or(printDrawer.getByText('另存为 PDF', { exact: false })).first()).toBeVisible();
    await shot('10-print-preview');
    await page.keyboard.press('Escape');

    // 15. 刷新恢复（AC-025）：已签发文书与校核状态保留，不回初始空态
    await page.reload();
    await expect(page.getByText('安小能 · 应急智能工作台')).toBeVisible({ timeout: 15000 });
    await page.locator('button', { hasText: '文书中心' }).last().click();
    const signedAfterReload = page.locator('.doc-card', { hasText: '应急要情' }).filter({ hasText: '已签发' }).first();
    await expect(signedAfterReload).toBeVisible({ timeout: 15000 });

    // 16. 控制台无阻断性错误（错误堆栈输出到 reporter 便于定位）
    if (consoleErrors.length > 0) {
      console.warn('=== PAGE ERROR STACKS ===\n' + errorStacks.join('\n\n'));
    }
    expect(consoleErrors, consoleErrors.join('\n')).toEqual([]);
  });
});
