# 设计验证（2026-10-09）

## 2026-10-15：助手内态势研判与预警推送

final result: passed（本次两个功能的对话迁移范围）

参考：用户截图 `codex-clipboard-e2372de6-d2cc-4d03-b069-762cd6f31ca4.png` 标识的两个右侧页签；目标按用户要求改为助手内交互，采用 `/settings/chat-controls` 对应的真实共用控件，不作原右侧面板的像素复刻。

本轮在同一次图像检查中并列查看参考图、`../output/playwright/assistant-inline-warning.png` 和 `assistant-inline-warning-receipts.png`。原图只截取页签（446×185），实现为完整助手页面（1280×720），因此对比功能归属、文字层级和控件可读性，不将画幅差异算作样式缺陷。

- 两个入口在聊天内通过 ChoiceChips 切换；字段使用 KvTable，内容分节使用 Section，核对提醒使用 Notice，状态及回执使用 StatusPill。
- 浏览器完成研判依据输入、生成模拟情景、切换预警、批准本地模拟推送和查看三条回执；右侧业务流程数量为 0。
- 首轮发现回执编号与按钮在同一行挤压（P2），已改成字段摘要、操作独立排列；修复后截图编号与按钮没有覆盖。初始空结果改成等待依据的轻提示，避免空白页感。
- 两个功能切换保留研判输入与结果；编辑预警清除批准和旧回执。保留原始会话的目标岗位与回执数据，不连接外部发送渠道。
- 当前范围未发现未解决的 P0/P1/P2。未声明覆盖所有屏幕尺寸或真实专业预测能力。


最终结果：passed（本轮修改范围）。

依据：招标《4 高价值应用场景与智能体建设技术要求v2》与现有 React 原型。沿用现有配色、字体、导航、卡片和抽屉组件；本轮增加交互，暂时隐藏值班功能。

## 截图对比

参考与实现截图均位于 ../outputs/招标原型完善-20261009/。在同一次图像检查中比较 before.png 与 after-shell.png，以及 library-hidden-duty.png 与 library-after-layout.png；视口截图约 662 × 773。新流程检查 forecast.png、original-handoff.png、meeting-minutes.png 和 skill-permission.png。

检查布局层级、字体、间距、颜色、图标、交互状态和窄屏可读性。原有助手外壳保留。发现文书分类标题与数量在窄屏碎字换行（P2），已修复标题不拆字、数量整体换行并重新截图验证。当前本轮范围没有未解决的 P0/P1/P2。未声称覆盖全部设备或所有历史页面。

## 交互验证

- 矿难研判生成后，一期 A01 路由展示同一事件、资料时间、依据、监测与资源正文。
- 洪涝与矿难展示独立指标及资源；洪涝事件页预警按钮进入同一事件预警抽屉。
- 专业编组跳转使用专业资源清单，移除重复旧车辆编组入口。
- 文书库隐藏值班分类与相关文书；会议纪要生成当前事件草稿。
- Skill 未授权调用返回 PERMISSION_DENIED。
- 输入变更撤销旧情景、编组确认或复盘结果；复盘不把缺失实际值当作零。

## 验证边界

96 项相关测试通过，末轮修复另执行研判、灾种与流程测试。TypeScript、ESLint、生产构建通过。未运行全部端到端用例。真实数据接口、专业预测、视觉识别、跨端客户端、实际调派和权限系统仍待接入，本结果仅为原型设计验证。


## 2026-10-15 一线人员危险提醒

结果：passed（本次对话内提醒范围）。将专业情景参数表单改为直接阅读危险提醒，保留聊天标准控件 ChoiceChips、Notice、Section、KvTable、StatusPill。六类提醒分别说明影响、位置、现在怎么做和找谁核实；学校、医院缺少空间与状态数据时明确待核，不推断受灾或安全。

浏览器验证学校医院筛选、单条学校提醒进入通知草稿，右侧业务面板数量为 0；截图 `../output/playwright/assistant-school-hospital-alerts.png` 已检查文字、字段换行、筛选和输入区。内容在消息区滚动，未发现本次范围的压盖。未声称完成真实预警或空间分析。

11 项相关测试通过，包含三种灾害数据边界、筛选、单条草稿重新生成、批准与回执失效；TypeScript 和目标文件 ESLint 通过。


## 2026-10-15 预警推送入口修复

旧 CustomerRequestPanel 入口先于对话流程匹配，导致仍打开右侧；已统一助手快捷入口、事件页入口和旧工作区恢复入口至 openInlineSituation。浏览器输入“预警推送”后看到对话内责任岗位、草稿、核对批准和模拟推送，右侧 operational-flows 数量为 0。保留已有草稿、批准与回执状态。截图：../output/playwright/assistant-warning-inline-fixed.png。8 项相关测试、目标文件 ESLint 和 TypeScript 检查通过。


## 2026-10-15 V2 文书目录与助手模块对齐

本次范围 passed。六类 V2 输出集中定义章节结构，处置方案九段归并为五章、投送归并四章、编组归并三章，保留勘察、安全、边界和原始数据小节。方案模板与文种显示名称同步为工程救援处置方案、梯队投送方案。周边资源页与生成文书对齐七章；无资料的目标和其他央企明确待补。

助手完成卡片新增可展开内容目录，文书编辑区使用现有 Section 组件配合章节定位按钮，目录随 working.sections 更新，不写入正文、版本和导出。浏览器验证 V2 方案生成、嵌入助手五章目录及点击第一章定位，再到独立助手检查目录布局：../output/playwright/assistant-document-directory.png；窄屏检查见 ../output/playwright/v2-plan-document-chapters.png。未发现此次范围的压盖或横向溢出；历史已保存正文不自动重写。

18 项相关测试通过（四文件17项及灾种章节对齐1项），TypeScript、目标文件 ESLint 与 diff 空白检查通过。额外运行 disasterScenarios 完整文件时，另有2项页面用例因重复匹配图像或队伍文字失败，位于事件切换和候选资源显示断言，未将它们计入本次通过结果；未执行全量发布测试。


2026-10-15 用户要求撤回：删除文书编辑区新增的章节目录按钮及定位属性，保留正文结构调整和聊天完成卡片摘要。此前目录定位验证仅作历史记录，不代表当前界面。


2026-10-15 报告内容顺序修复：正文骨架先于附表、附录和说明；新报告的多源汇聚与事件要素归为资料附录，避免重复“一、”。旧文书在编辑视图按同一顺序展示，不直接改写历史版本；保存/导出使用当前展示顺序。相关章节排序与管道表测试通过。此次未改变富文本表格支持，管道形式的附表内容仍保留原数据。


2026-10-15 同类问题排查：覆盖三类实战灾种的态势、周边资源、处置及总结正文与附表顺序，另覆盖六个 V2 节点的目录。发现候选处置方向额外追加第六章，现归入第四章并兼容旧候选卡片元数据读取；直接 Word/PDF 导出入口补齐正文优先排序。版本比较继续保留历史原稿顺序。相关20项测试及额外三灾种顺序用例通过；未改动附表的富文本表格渲染能力。

## 2026-10-16：V2事件列表补回处置响应详情

### Comparison target and evidence
- Source: `/var/folders/vt/rfyhpssn77z55c3vks4zvdqh0000gn/T/codex-clipboard-8403dbfe-c2b6-4d2b-97e9-2e27357730b6.png` (5054 × 2544).
- Implementation: `output/playwright/v2-event-detail-restored.png` (2048 × 1031).
- Combined full-view and focused-region evidence: `output/playwright/v2-event-detail-comparison.png`.
- Viewport: 2048 × 1031 CSS pixels; screenshot 1×. Source downsampled to the same size before comparison.
- State: `/v2/events?event=1`, second event, original casualty counts, no modal open.
- Scope: restore missing event detail content and compact detail navigation frame. Existing V2 brand, demo mode controls and sidebar icon system are reused; this is not a replacement of the entire system chrome with a screenshot.

### Comparison history
1. P1: list action bypassed the detail page and went directly to response criteria. Fixed by selecting the clicked event using the URL query, while keeping the independent response menu.
2. P2: first capture used the larger list-page frame, shifting content right and down. Added detail-scoped compact header/sidebar sizing; confirmed left content begins at x186 and top bar at y100 in the revised capture.
3. P2: attachment icon scaled too small; map sat below the task-time row. Reused the supplied original attachment asset, corrected its dimensions, reduced owner-row padding and aligned map to the first task row. Revised capture included in combined comparison.

### Required fidelity surfaces
- Typography: 14px detail body and timeline labels; blue labels, dark gray values; existing Microsoft YaHei/PingFang fallback preserved.
- Layout: left facts with right-aligned map, separated right process rail; original large lower white space retained. Map, attachment, casualty counts and divider align with source structure.
- Colors: pale blue event bar, blue process labels, colored casualty figures, white content and light gray separators checked against source.
- Assets: original map, Word attachment icon and process decoration extracted from supplied source; no generated map substituted. Existing system chrome remains from the project.
- Copy: screenshot task fields and process entries restored for the electrical event; title and dispatch unit selected from the clicked list row. Other events use local prototype values, not live data.

### Interaction and validation
- Browser: second-row detail, return to list, first-row detail and second-row detail again; casualty editor open/save; no browser console errors.
- Regression: `src/tests/v2EventDetail.test.tsx`, 2 tests passed (matching event selection/back navigation; direct URL and casualty/process update).
- Typecheck and lint passed.
- Attachment opens local metadata modal; original file download backend is not connected.
- No unresolved P0/P1/P2 within restored event-detail content. Existing outer-shell brand/mode-controls differences are intentionally retained, not claimed as full-frame pixel identity.

final result: passed
