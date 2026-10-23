import { clickQuickTask } from './helpers/quickTasks';
/**
 * 文书智能体 E2E（UI 改版适配）：
 * 独立「文书库」页负责分类浏览 / 生成 / 样稿打开；样稿与草稿的阅读详情在助理页右侧「文书工作区」呈现，
 * 由显式「关闭文书」回到宽对话。业务断言（分类 5、样稿 10、生成回写、工作总结补充、真实草稿打开、
 * 在线编辑/放弃修改/导出为预览不下载）保持不降级。
 */
import { expect, test, type Page } from '@playwright/test';

async function openLibrary(page: Page) {
  await page.goto('/#/library');
  await expect(page.getByTestId('document-library-page')).toBeVisible();
}

async function closeWorkspace(page: Page) {
  await page.getByTestId('workspace-close-btn').click();
  await expect(page.getByTestId('document-workspace')).toHaveCount(0);
}

test('文书库：分类浏览、样稿与生成回写', async ({ page }) => {
  await page.goto('/');
  await openLibrary(page);
  const library = page.getByTestId('document-library');
  await expect(library.getByRole('heading', { name: '文书库' })).toBeVisible();
  await expect(library.locator('.doc-sample-row')).toHaveCount(10);
  for (const name of ['应急抢险要情', '抢险总结']) {
    await library.getByRole('tab', { name: new RegExp(`^${name} `) }).click();
    const category = library;
    // 点开样稿 → 回到助理页并展示右侧文书工作区
    await category.locator('.doc-sample-row').first().click();
    await expect(page.getByTestId('document-workspace')).toBeVisible();
    await expect(page.getByTestId('mock-redhead-document')).toBeVisible();
    await expect(page.locator('.axn-redhead-org')).toHaveText('中国安能建设集团有限公司');
    if (name === '应急抢险要情') {
      // 正文尾部现场图片（用户 m01044）：只给「重点河段险情处置要情」这篇样稿挂了两张模拟照片
      const figures = page.getByTestId('mock-document-figures').first();
      await expect(figures).toBeVisible();
      await expect(figures.locator('figure')).toHaveCount(2);
      await expect(figures).toContainText('图2');
    }
    await closeWorkspace(page);
    // 分类生成 → 生成中自动打开工作区 → 完成后回写该分类
    await openLibrary(page);
    await library.getByRole('tab', { name: new RegExp(`^${name} `) }).click();
    await category.getByRole('button', { name: `生成${name}`, exact: true }).click();
    await expect(page.getByTestId('document-workspace')).toContainText('正在生成文书');
    if (name === '抢险总结') {
      await page.getByRole('textbox', { name: '下一步改进措施' }).fill('完善通信保障和人员轮换机制。');
      await page.getByRole('button', { name: '提交并生成抢险总结' }).click();
    }
    await expect(page.getByTestId('document-toolbar')).toContainText('新生成');
    await closeWorkspace(page);
    await openLibrary(page);
    await library.getByRole('tab', { name: new RegExp(`^${name} `) }).click();
    await expect(category.locator('.doc-sample-row')).toHaveCount(3);
  }
  await page.screenshot({ path: 'artifacts/document-agent-library.png' });

});

test('文书任务生成真实草稿与重新打开', async ({ page }) => {
  await page.goto('/');
  // 真实草稿：缺必填 → 补录 → 再次生成 → 草稿在文书工作区打开
  const send = async (text: string) => {
    await page.getByPlaceholder(/向安小能发送指令/).fill(text);
    await page.keyboard.press('Enter');
  };
  await page.locator('.axn-gs-nav-item', { hasText: '安小能' }).first().click();
  await send('生成应急要情');
  await expect(page.locator('.axn-task-card', { hasText: '生成应急要情' }).last()).toContainText('待补充信息', { timeout: 20000 });
  await send('报送单位是清河防汛分指挥部值班室');
  await expect(page.locator('.axn-task-card', { hasText: '补录报送单位' }).last().getByText('已完成')).toBeVisible({ timeout: 20000 });
  await send('生成应急要情');
  await expect(page.locator('article.doc-detail-paper')).toBeVisible({ timeout: 30000 });
  await expect(page.locator('article.doc-detail-paper')).toContainText('清河防汛分指挥部值班室');
  await page.screenshot({ path: 'artifacts/document-agent-detail.png' });
  await closeWorkspace(page);
  // 已完成任务的产物提供真实草稿预览/打开动作（重新打开同一草稿，不重新生成）
  await expect(page.getByTestId('task-open-draft').first()).toBeVisible();
  await page.getByTestId('task-open-draft').first().click();
  await expect(page.locator('article.doc-detail-paper')).toBeVisible();
});

test('聊天文书快捷操作无需补录即可生成右侧模拟红头文书', async ({ page }) => {
  await page.goto('/');
  const panel = page.locator('.doc-center');
  for (const name of ['应急抢险要情']) {
    await clickQuickTask(page, `生成${name}`);
    const workflow = page.getByTestId('document-generation-card').last();
    // 气泡里只有「要素收集」一个过程（用户 m00705）：调用/生成的过程流水账不再展示
    await expect(workflow).toContainText('正在收集文书要素 ·');
    // 收集动画（用户 m01044）：进度条按要素条数走（6 条）
    await expect(workflow.getByTestId('doc-collect-progress')).toHaveAttribute('aria-valuemax', '6');
    // 要素表（文书类型/编制单位/…）不再展示（用户 m00861）：气泡里只留「要素收集」这一个过程
    await expect(workflow).not.toContainText('编制单位');
    await expect(panel).toContainText('正在生成文书');
    await expect(panel.getByTestId('document-toolbar')).toContainText(`${name}（新生成）`);
    await expect(panel.locator('.axn-redhead-org')).toHaveText('中国安能建设集团有限公司');
    await expect(workflow).toContainText(/已完成|红头文书已生成/);
    await expect(panel.getByTestId('mock-redhead-document')).not.toContainText('文书要素（模拟收集）');
    await expect(page.getByText(new RegExp(`已生成《.*${name}（新生成）》`))).toBeVisible();
    await closeWorkspace(page);
    await openLibrary(page);
    await page.getByTestId('document-library').getByRole('tab', { name: new RegExp(`^${name} `) }).click();
    await expect(page.getByTestId('document-library').locator('.doc-sample-row')).toHaveCount(3);
    await page.locator('.axn-gs-nav-item', { hasText: '安小能' }).first().click();
  }
});

test('周工作动态：先在气泡卡片里上传参考文档与附件，再生成红头文书', async ({ page }) => {
  await page.goto('/');
  await clickDocTask(page, '周工作动态');
  const workflow = page.getByTestId('document-generation-card').last();
  // 上传入口就在卡里（用户 m00994）：卡里说明要哪三份统计表，并给「上传参考文档与附件」+「开始生成」
  await expect(workflow).toContainText('等待上传参考文档与附件');
  await expect(workflow).toContainText('工程练兵情况统计表（附件1）');
  await expect(workflow).toContainText('安全应急产业营收情况统计表（附件2）');
  await expect(workflow).not.toContainText('至少 1 份'); // 「（至少 1 份）」这类量词不进文案（用户 m00972）
  await expect(workflow.getByTestId('doc-upload-gate')).toHaveCount(0);
  // 没材料时生成按钮是灰的、清单还没出现
  const generate = workflow.getByTestId('doc-source-generate');
  await expect(generate).toBeDisabled();
  await expect(workflow.getByTestId('doc-source-list')).toHaveCount(0);
  // 输入框的 📎 仍然是「把文件发给智能体」的入口：门开着时那些文件也算材料（m00994 只是把按钮加进卡里）
  const composerInput = page.locator('.axn-composer-upload-wrap input[type="file"]');
  await composerInput.setInputFiles({ name: '工程练兵情况统计表.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('工程练兵（模拟）') });
  await expect(page.getByTestId('composer-submit-sources')).toBeVisible();
  await page.locator('.axn-attach-tag .ant-tag-close-icon').click(); // 撤掉，下面只验卡里这条入口
  await expect(page.getByTestId('composer-submit-sources')).toHaveCount(0);
  // 传两份材料（演示环境不落盘：Upload 的 beforeUpload 返回 false，不发请求）
  await workflow.locator('input[type="file"]').setInputFiles([
    { name: '工程练兵情况统计表.xlsx', mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('工程练兵（模拟）') },
    { name: '本周中标项目汇总表.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('中标项目（模拟）') },
  ]);
  // 传完列成清单（名字 + 大小 + 可移除）并放行生成（用户 m00994：上传之后的样式）
  const list = workflow.getByTestId('doc-source-list');
  await expect(list.locator('li')).toHaveCount(2);
  await expect(list).toContainText('工程练兵情况统计表.xlsx');
  await expect(list).toContainText('本周中标项目汇总表.docx');
  await expect(list.locator('.axn-source-size').first()).toHaveText('24 B');
  await expect(generate).toBeEnabled();
  // 逐份移除后还能再传回来
  await list.getByRole('button', { name: '移除 本周中标项目汇总表.docx' }).click();
  await expect(list.locator('li')).toHaveCount(1);
  await workflow.locator('input[type="file"]').setInputFiles({ name: '本周中标项目汇总表.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', buffer: Buffer.from('中标项目（模拟）') });
  await expect(list.locator('li')).toHaveCount(2);
  await generate.click();
  // 材料到位：上传件进对话流，气泡里接着走要素收集
  await expect(page.getByTestId('message-attachments').last()).toContainText('工程练兵情况统计表.xlsx');
  await expect(workflow).toContainText(/要素已收集/, { timeout: 20000 });
  await expect(workflow.getByTestId('doc-collect-done')).toContainText('已生成《防汛应急周工作动态（新生成）》', { timeout: 20000 });
  const panel = page.locator('.doc-center');
  await expect(panel.getByTestId('document-toolbar')).toContainText('防汛应急周工作动态（新生成）');
  // 正文骨架来自该文种，但「附件」一节换成本轮真上传的清单
  const paper = panel.getByTestId('mock-redhead-document');
  // 节标题渲染成可编辑的 <input>，文本不进 innerText，得按 value 断言
  await expect(paper.locator('.doc-edit-heading').first()).toHaveValue('一、上周工作完成情况');
  await expect(paper.locator('.doc-edit-heading').last()).toHaveValue('附件');
  await expect(paper).toContainText('附件1：工程练兵情况统计表.xlsx');
  await expect(paper).toContainText('附件2：本周中标项目汇总表.docx');
  await expect(paper).toContainText('各附件表体见下方');
  // 附件表体（用户 m01163）：三张统计表按参考真件的表头与数据渲染，数值不是占位符
  const tables = paper.getByTestId('mock-document-tables');
  await expect(tables).toBeVisible();
  await expect(tables.locator('table')).toHaveCount(3);
  await expect(tables).toContainText('工程练兵情况统计表');
  await expect(tables).toContainText('安全应急产业营收情况统计表');
  await expect(tables).toContainText('本周中标项目（直接签订合同项目）汇总表');
  await expect(tables).toContainText('1294');     // 附件1：总计投入人数
  await expect(tables).toContainText('10051.35'); // 附件2：合计年度累计营收
  await expect(tables).toContainText('61.35');    // 附件3：三局新疆公司合同金额
  // 附件1 的「分类」列是真件里的合并单元格（每组跳三行）
  await expect(tables.locator('th[rowspan="3"]')).toHaveCount(5);
});

test('文书停止输入后自动保存，刷新后内容保留', async ({ page }) => {
  await page.goto('/');
  await openLibrary(page);
  await page.getByTestId('document-library').locator('.doc-sample-row').first().click();
  const panel = page.getByTestId('document-workspace');
  const title = panel.getByRole('textbox', { name: '文书标题', exact: true });
  await title.fill('南堤情况报告（自动保存验证）');
  await expect(page.getByTestId('mock-dirty-note')).toBeVisible();
  await expect(panel.getByTestId('document-toolbar')).toContainText('已自动保存', { timeout: 8000 });
  await expect(page.getByTestId('mock-dirty-note')).toHaveCount(0);
  await expect(panel.getByTestId('doc-version-toggle')).toHaveText('V2');
  await title.fill('南堤情况报告（再次自动保存）');
  await expect(panel.getByTestId('document-toolbar')).toContainText('已自动保存', { timeout: 8000 });
  await expect(panel.getByTestId('doc-version-toggle')).toHaveText('V2');
  await page.reload();
  await openLibrary(page);
  await page.getByTestId('document-library').locator('.doc-sample-row').filter({ hasText: '南堤情况报告（再次自动保存）' }).click();
  await expect(title).toHaveValue('南堤情况报告（再次自动保存）');
});

test('模拟文书详情就是编辑态：边改边存、放弃修改、导出为预览', async ({ page }) => {
  await page.goto('/');
  await openLibrary(page);
  await page.getByTestId('document-library').locator('.doc-sample-row').first().click();
  const panel = page.locator('.doc-center');
  // 打开即是编辑态：标题、正文直接可改，不需要先点「在线编辑」
  await panel.getByRole('textbox', { name: '文书标题', exact: true }).fill('防汛值守日报（修订）');
  await panel.getByRole('textbox', { name: '第1节正文', exact: true }).fill('本班次已完成重点区域巡查，并记录交接事项（模拟）。');
  await expect(page.getByTestId('mock-dirty-note')).toBeVisible();
  await panel.getByRole('button', { name: '保存修改', exact: true }).click();
  await expect(panel.getByTestId('rich-text-editor').first()).toContainText('本班次已完成重点区域巡查');
  await expect(page.getByTestId('mock-dirty-note')).toHaveCount(0);
  await closeWorkspace(page);
  await openLibrary(page);
  await page.getByTestId('document-library').locator('.doc-sample-row').filter({ hasText: '防汛值守日报（修订）' }).click();
  await expect(panel.getByTestId('rich-text-editor').first()).toContainText('本班次已完成重点区域巡查');
  // 未保存的改动离开详情页不丢，只有「放弃修改」才丢弃（离开再回来由单元测试盖）
  await panel.getByRole('textbox', { name: '文书标题', exact: true }).fill('未保存标题');
  await expect(page.getByTestId('mock-dirty-note')).toBeVisible();
  await panel.getByRole('button', { name: '放弃修改', exact: true }).click();
  await expect(panel.getByRole('textbox', { name: '文书标题', exact: true })).toHaveValue('防汛值守日报（修订）');
  await expect(page.getByTestId('mock-dirty-note')).toHaveCount(0);
  const downloads: string[] = [];
  page.on('download', download => downloads.push(download.suggestedFilename()));
  for (const format of ['Word', 'PDF']) {
    await panel.getByRole('button', { name: `导出 ${format}`, exact: true }).click();
    await expect(page.getByRole('dialog')).toContainText('不生成或下载实际文件');
    await page.getByRole('button', { name: '知道了' }).click();
    await expect(page.getByRole('dialog')).toBeHidden();
  }
  expect(downloads).toEqual([]);
  await page.screenshot({ path: 'artifacts/document-detail-refined.png' });
});

test('直接编辑支持 Word 风格富文本（字号/加粗/标黄/红字/居中/列表），保存后重开仍带格式', async ({ page }) => {
  await page.goto('/');
  await openLibrary(page);
  await page.getByTestId('document-library').locator('.doc-sample-row').first().click();
  const panel = page.locator('.doc-center');
  const editor = panel.getByRole('textbox', { name: '第1节正文', exact: true });
  const toolbar = panel.getByTestId('rich-text-toolbar');
  await expect(toolbar).toBeVisible();

  /** execCommand 走 styleWithCSS 时写的是行内样式，所以按计算样式断言「格式真的生效了」。 */
  const computed = (property: 'fontWeight' | 'color' | 'backgroundColor') =>
    editor.evaluate((el, prop) => Array.from(el.querySelectorAll('*')).map(node => getComputedStyle(node)[prop as 'fontWeight']), property);

  await editor.selectText();
  await panel.getByTestId('rich-text-size').click();
  await page.locator('.ant-select-item-option', { hasText: '小二 24' }).click();
  await expect(editor.locator('font[size="4"]')).not.toHaveCount(0);

  await editor.selectText();
  await toolbar.getByRole('button', { name: '加粗' }).click();
  expect(await computed('fontWeight')).toContain('700');

  await editor.selectText();
  await toolbar.getByRole('button', { name: '标黄' }).click();
  expect(await computed('backgroundColor')).toContain('rgb(255, 229, 143)');

  await editor.selectText();
  await toolbar.getByRole('button', { name: '红字' }).click();
  expect(await computed('color')).toContain('rgb(198, 40, 40)');

  await editor.click();
  await toolbar.getByRole('button', { name: '居中' }).click();
  await expect(editor.locator('p, div').first()).toHaveAttribute('style', /text-align: center/);

  await editor.click();
  await toolbar.getByRole('button', { name: '无序列表' }).click();
  await expect(editor.locator('ul > li').first()).toBeVisible();
  // 列表不能嵌成 p>ul（Chromium 默认会把菜单式内容包成段落）
  await expect(editor.locator('p > ul')).toHaveCount(0);
  await expect(toolbar.getByRole('button', { name: '无序列表' })).toHaveAttribute('aria-pressed', 'true');
  await page.screenshot({ path: 'artifacts/rich-text-toolbar.png' });

  await panel.getByRole('button', { name: '保存修改', exact: true }).click();
  // 保存后仍是编辑态（工具条和编辑器都在），格式已经落进 store
  await expect(toolbar).toBeVisible();
  await closeWorkspace(page);
  await openLibrary(page);
  await page.getByTestId('document-library').locator('.doc-sample-row').first().click();
  const reopened = panel.getByRole('textbox', { name: '第1节正文', exact: true });
  await expect(reopened.locator('font[size="4"]')).not.toHaveCount(0);
  await expect(reopened.locator('ul > li')).not.toHaveCount(0);
});
