# 安小能客户演示 Demo · 实施日志（终版）

> 主控 Agent 维护。多 Agent 模式：主控（基础/集成/验收）+ Worker A（安小能工作流 UI）+ Worker B（文书工作流 UI）+ 独立审查 Agent（只读审查 + 缺陷修复复核）。
> 项目根：`/home/xx/Code/axn-demo`。已提交并推送：`e353891` → `origin/main`（60 文件，生成物已由 .gitignore 排除）。

## 一、启动与构建

```bash
cd /home/xx/Code/axn-demo
pnpm install          # 依赖已锁定（Node 22 / pnpm 12）
pnpm dev              # http://localhost:5173（host=true 监听全部网卡，局域网如 http://192.168.77.1:5173 可访问）
pnpm build && pnpm preview   # 生产构建预览 → http://127.0.0.1:4173
pnpm test             # 单元/组件测试（44 项）
pnpm test:e2e         # Playwright E2E（8 项，含主线全链路）
```

## 二、任务与状态

| 任务 | 负责人 | 状态 |
| --- | --- | --- |
| T-001~T-004 基础（依赖/种子/类型/Store/协议/布局/主题/外壳） | 主控 | 完成 |
| 服务层（mock provider / taskRunner / validation / snapshot / documentFactory / factLookup / docRender / contentRuns） | 主控 | 完成 |
| T-005~T-010 安小能工作流 UI（ChatPanel/TaskCard/ResourcePanel/SchematicMap/KnowledgePanel） | Worker A | 完成 |
| T-011~T-016 文书工作流 UI（DocCenterPanel/DocumentEditor/SourceDrawer/ValidationPanel/VersionDrawer/docxExport） | Worker B | 完成 |
| T-017~T-019 集成加固 / 演示控制 / 持久化（localStorage 命名空间 anneng-demo:v1） | 主控 | 完成 |
| T-020~T-022 测试（单测 44 + E2E 8）/ 视觉视口修正 / 交付材料 | 主控 | 完成 |
| 独立审查 | 审查 Agent | 完成（1 blocker + 12 major + 9 minor 全部修复） |

## 二点五、全局导航迭代（用户追加需求，2026-09-29 后）

**需求**：三栏布局（全局导航+历史会话 / 安小能对话 / 主工作区），新建会话模板浮层、搜索过滤、收藏、导航页（智能体与 Skill / 定时任务 / 知识库）、跨会话隔离与恢复、演示重置、侧栏折叠。

| 检查 | 结果 |
| --- | --- |
| `pnpm typecheck` | ✅ 0 错误 |
| `pnpm lint` | ✅ 0 错误（4 条既有 warning） |
| `pnpm test` | ✅ 113/113 |
| `pnpm build` | ✅ tsc -b + vite 24.5s |
| `pnpm test:e2e` | ✅ 20/20（主线 8 + 全局导航 12） |

本轮修复：
1. 生产包 TDZ 崩溃（白屏）：sessionStore 模块初始化经 factLookup→demoStore 循环引用；emptySession 改种子直查（seedEventTitle）
2. R-006 误报：reference 段（知识引用/已采纳建议）不参与调派矛盾校核；豁免“候选尚未形成正式调派”类否定声明（“已调派候选…”仍拦截）
3. R-010 漏检：中文金额（九千万元）纳入自由数字扫描
4. 信任链防线补齐：addDraft 拒绝同 ID 已签发覆盖；getRevision 返回深冻结副本；addReport 入库即冻结
5. 采用建议后旧报告失效（校核已过期状态）→ 需显式重新校核；E2E 同步真实产品流程

## 三、最终验证结果（2026-09-29）

| 检查 | 结果 |
| --- | --- |
| `pnpm typecheck` | ✅ 0 错误 |
| `pnpm lint` | ✅ 0 警告 0 错误 |
| `pnpm test` | ✅ 44/44 |
| `pnpm build` | ✅ tsc -b + vite 22.5s |
| `pnpm test:e2e` | ✅ 8/8（主线全链路 + 日报签发链 + 值班员禁签 + 事件隔离 + 重置 + 取消 + 1366 视口 + 持久化×2） |
| DOCX 导出 | ✅ 真 DOCX（PK zip 头 / Microsoft Word 2007+），E2E 解包断言 document.xml 含真实数值（36、42.3 等）；文件名 `标题_V版本_时间戳.docx` |
| 浏览器控制台 | ✅ 主线无页面错误（pageerror 监听） |
| 交付截图 | ✅ artifacts/screens/d01~d09 |

## 四、AC-001~AC-030 验收状态

| AC | 结论 | 依据（验证方式） |
| --- | --- | --- |
| 001 | 通过 | E2E 主线第 1 步：首屏主事件+模拟标识+快捷任务；无 Agent 选择器 |
| 002 | 通过 | 摘要 rows 全部 factText 绑定种子事实；来源抽屉与水位一致；待核实不显示 0（E2E + derived.test） |
| 003 | 通过 | provider 资源过滤排除 team-003（不可调）并在卡片说明；E2E 断言"未列入" |
| 004 | 通过 | 意图 resource_sort_eta 基于上一查询结果排序；无结果时返回澄清引导（单测 + E2E 追问步） |
| 005 | 通过 | 2/64/7 → 1/36/4 全面板同步（E2E 断言 + derived.test 与种子 expectedChecks 对齐） |
| 006 | 通过 | 候选≠已调派标注 + R-006 校核拦截"已调派"表述 + 生成文书不改台账（单测 validation.test） |
| 007 | 通过 | 知识卡含版本/演示标识/notice；模拟知识不冒充真实来源（KnowledgePanel + 单测） |
| 008 | 通过 | 建议与文书共享 selectedProposalId；未采纳时文书不虚构建议版本 |
| 009 | 通过 | E2E 主线：缺报送单位→澄清→补录→生成；来源抽屉显示人工补录记录 |
| 010 | 通过 | 日报接报数由班次窗口事件事实计算（derived daily_*）；交接事项独立补录流程（E2E 日报链） |
| 011 | 通过 | Tiptap 编辑叙述自由文本；factChip 为受控 atomInline 不可改值（编辑器实现 + E2E 编辑步） |
| 012 | 通过 | 点击芯片→SourceDrawer 显示快照/原值/公式/补录人（d07 截图 + E2E 溯源步） |
| 013 | 通过 | R-005 命中"已有效控制"等变体；采用建议只改对应段落（validation.test 5 组变体 + E2E 校核阻断步） |
| 014 | 通过 | R-006 拦截"已调派 N 台/支"；同段其他引用不豁免（R-010 数字级判定 + 单测） |
| 015 | 通过 | 修改后 invalidateReportForDocument→stale；checkSubmit/checkSign 双门禁（单测 lifecycle + E2E） |
| 016 | 通过 | 水位更新→freshness 过期提示+R-009；重新校核重建快照（updateDraftSnapshot 接入校核流，单测） |
| 017 | 通过 | 多版本 Timeline+行级 diff；已签发快照用 factsSnapshot 冻结，不受源更新影响（versionDrawer + 单测） |
| 018 | 通过 | 值班员签发禁用+提示；指挥员签发；markSigned 幂等防双击（E2E 两个用例 + 单测） |
| 019 | 通过 | 真 DOCX 打开/编辑（PK 头+Word 2007+）；含修改后内容/版本/来源声明/演示标识（E2E 内容断言） |
| 020 | 通过 | 打印预览 renderRevision 与选定版本同源；取消打印无成功提示（print preview 独立于导出动作） |
| 021 | 通过 | unknown 意图兜底说明未覆盖，不清空已有结果；不重复固定答案（单测） |
| 022 | 通过 | 超时故障 RESOURCE_TIMEOUT 可恢复错误；已产出的子结果保留；重试新 attempt 不重复副作用（单测 + 故障注入） |
| 023 | 通过 | 取消立即结束+cancelled；晚到事件不写回（task 状态守卫）；重试新 attemptId（单测 taskFlow） |
| 024 | 通过 | 事件切换后会话隔离（E2E 用例：B 空会话、A 任务保留）；文书按 originSession 绑定候选（审查 M-9 修复） |
| 025 | 通过 | localStorage 命名空间持久化：刷新恢复草稿/待补/已签发；运行中任务降级为可重试失败态（E2E 持久化×2） |
| 026 | 通过 | 重置仅清理 anneng-demo:v1:*；重置后刷新仍空态；晚到事件因 tasks 清空而 no-op（E2E + 单测） |
| 027 | 通过 | 无外部网络请求（种子/图片全本地）；构建产物本地可跑（E2E 于无外网 CI 环境通过） |
| 028 | 通过 | IME composition 守卫不误发送；Sender/按钮/抽屉/芯片可键盘操作（Tab/Enter/Esc；manual 验证） |
| 029 | 通过 | 1366×768 / 1440×900 布局检查脚本无溢出；E2E 视口用例关键区域可见（1920×1080 线性更宽松，抽检） |
| 030 | 通过 | 纪要/总结仅模板预览 Modal；未实现功能不弹伪造成功提示（DocCenterPanel 模板预览实现） |

| 对话删除 | 主控 | 完成 | conversationStore（deleteConversation）/ GlobalSidebar（Popconfirm 删除按钮）/ 单测+2 / E2E 4b | typecheck ✓ lint ✓ 单测 114 ✓ 冒烟 ✓ | - |

## 五、独立审查结论与修复记录

审查报告：1 blocker + 12 major + 9 minor，全部修复并复核：
- B-1 导出派生值"（重算中）"→ saveRevision 双写裸键+前缀键；E2E 增加 DOCX 内容断言
- M-2 版本号违反 FR-013 → 首存 V1.0、签发后修订 V2.0，E2E 断言同步修正
- M-3 新鲜度门缺失 → checkSubmit/checkSign 增加 contextVersion 硬门
- M-4~M-7 校核绕过 → R-004/R-005/R-006/R-007 正则重构 + 中文数词 + 断言动词共现判定；规则按事件动态解析
- M-8 快照冻结取实时值 → 优先 draft.snapshot.facts
- M-9 跨会话候选污染 → 工厂按 originSessionId 取候选
- M-10 重置不清文书 → 链式清空 + Popconfirm
- M-11/M-12 + 9 minor → R-010 升 block（数字级豁免）、枚举标签（处置中/已控制/待确认）、observedAt 成对覆盖、markSigned 幂等、候选空文案等
- 追加修复：Tiptap SectionTitle Enter 全局快捷键导致 clearNodes 崩溃与栈溢出（isActive 守卫）；页头双行内容裁剪（headerHeight 56 + 行高）

## 六、多 Agent 分工与集成

- 主控：契约（types.ts）、种子适配、三 Store、provider/taskRunner、校核引擎、快照/工厂/渲染、App 外壳、集成排障、全部测试与验收
- Worker A：T-005~T-010 五组件（builtin worker，15 分钟，无越界写入）
- Worker B：T-011~T-016 七文件（builtin worker，16 分钟，无越界写入）
- 审查 Agent：只读审查 13 项清单，输出 blocker/major/minor 分级报告
- 协作机制：仓库无 Captain/herdr；使用 pi-subagents builtin worker 串行委派（单写入者），接口以 CONTRACTS_UI.md 冻结

## 六点五、导出样品复核（最终轮）

对 E2E 导出的 DOCX 逐段人工复核时发现并修复 3 个残余缺陷：
1. 枚举裸值入文（"ongoing / awaiting_confirmation"）→ 快照冻结链路复用 formatFactValue（枚举→中文标签）
2. 补录值双前缀（"报送单位：报送单位是…"）→ 识别层防御性剥离重复前缀；E2E 统一走主输入框
3. 采用建议残留同段矛盾片段 → applySuggestion 改为整段替换；E2E 编辑位置移至"下一步工作"段（等级行保留）
复核结论（最终 V1.0 DOCX）：处置状态=处置中（持续跟踪）；等级行完整；伤亡=待核实表述；候选 1/36/4+未调派声明；报送值干净；无裸枚举值；总字符 444。

## 七、已知限制

- 会议纪要/工作总结为模板预览（Modal），无编辑流 —— 按文档 P0 范围
- PDF 为浏览器"打印 / 另存为 PDF"路径（按钮如实命名），非直接生成 PDF 文件
- 版本对比为行级文本 diff（非 word-level）
- docx 正文字体 SimSun 12pt 为模拟公文样式
- p-user-N 段落 id 编辑会话内递增，极端并发可能重号（demo 可接受）
- 1920×1080 未做专门 E2E（布局为弹性尺寸，抽检正常）

## 八、交付物索引

- 截图：`artifacts/screens/d01~d09.png`
- DOCX 样例：`artifacts/downloads/*.docx`（E2E 产物）
- 测试报告：`artifacts/test-results/`（Playwright HTML）
- 契约：`docs/anneng-demo/CONTRACTS_UI.md`
- 种子：`src/fixtures/scenario.json`（源自文档包，未改动业务值）
| T-NAV-11 | 新建对话关联灾情（用户 m02495） | 主控 | 完成 | CreateConversationModal 增加关联灾情下拉（不关联=空白对话/两个种子事件）；createConversation 绑定所选 eventId；关联会话与同事件会话共享 session 消息；选项标题用 eventDisplayName 带 scope 解析 | typecheck/lint/单测 116 ✓ 冒烟：关联后 header 切到对应事件、纯空白对话仍为虚拟事件 ✓ | E2E 2b 用例待全量 |
| T-NAV-12 | 新建不弹窗+对话区内关联灾情（标注 vibe_1790652706390） | 主控 | 完成 | 删除 CreateConversationModal/模板；新建任务直接创建空白对话（标题递增）并激活；ChatPanel 头部新增关联灾情 Select（未关联/两个种子事件）；linkConversationToEvent action（取消关联回专属虚拟事件保留独立消息） | typecheck/lint/单测 117 ✓ 冒烟：无弹窗、关联→header 切事件、取消→空白 ✓ | E2E 1/2/2b/4b 已重写待全量 |

| 消息按会话隔离 | 主控 | 完成 | sessionStore（sessionByConversation 映射+ensureSessionForConversation）、conversationStore.syncBusinessContext、ChatPanel、App、tests | typecheck ✓ lint ✓ 单测118（+1 同事件两会话隔离）✓ 冒烟：关联灾情不出旧消息/切换隔离/刷新持久化 ✓ |

## 2026-09-29 抢险救援知识问答接入（qa.json）
- 负责人：主控
- 需求：安小能问答可回答 qa.json 的 126 条抢险救援问题，并标注模拟文档来源
- 修改范围：
  - qa.json（git 拉取）→ src/fixtures/qaKnowledge.json（应用内副本）
  - 新增 src/services/qaKnowledge.ts（126 条解析、归一化规则匹配 matchQa、状态文案）
  - src/domain/types.ts：IntentId+qa_knowledge、QaKnowledgeArtifact
  - src/services/mock/provider.ts：recognize 优先命中 QA（在 stop/补录之后、业务意图之前）；runQaKnowledge 流式生成（步骤卡→答案卡→分段正文含来源行）
  - src/components/chat/TaskCard.tsx：QaKnowledgeBlock（答案分区/需现场数据 chips/置信度/模拟文档来源卡/免责声明）
  - src/tests/qaKnowledge.test.ts（12 用例）；conversation.test.ts 类型修复（非空断言）
- 验证：typecheck ✓；lint 0 错误 ✓；单测 129 ✓；冒烟：QA 卡（建议动作/禁忌/现场数据/置信度/3 来源卡/手册标题/免责声明）✓、流式正文含来源行 ✓、业务主线（资源查询）不被误吞 ✓、无页面错误 ✓
- 已知限制：匹配为本地规则（精确+双向包含≥6字），非语义检索；未跑全量 E2E

| 2026-09-29 | 标注驱动修复 | 主控 | ①任务气泡占满会话栏宽度（styles root/body/content 三层 flex 修复，QA/摘要卡 242→292+）②Alert message=→title= 清理 antd 弃用警告（9 处）③会话栏 350→420px 加宽（标注 vibe_1790658377137） | typecheck✓ lint 0err✓ 单测129✓ 冒烟: 1680(420+1004)/1440(420+764)✓ 卡片362/422宽✓ 无页面错误✓ | 待用户复看 |

| 2026-09-29 | 标注驱动修复 | 主控 | ①QA 问答重复修复：provider 不再流式输出答案全文（与 QA 卡内容重复），仅补充来源提示一行；任务卡气泡宽度修复收尾（root padding 归零+body flex 撑满）②会话栏 420px 下任务卡 336 宽、QA 卡高 734（原窄条 1711） | typecheck✓ lint✓ 单测129✓ 冒烟: 答案出现次数 1（原 2）✓ 无页面错误✓ | 待用户复看 |

| 2026-09-29 | 新需求 | 主控 | 欢迎卡"你可以问我"引导问题：关联灾情/空白对话两套（4题各），点击即发送；去重 WELCOME_QUESTIONS 常量（Vite 已声明报错）；chat.css 引导样式 | typecheck✓ lint 0err✓ 单测129✓ 冒烟: 空白4题/关联切换4题/点击发送出答/切换隔离✓ | 待用户复看 |

| 2026-09-29 | 撤回 | 主控 | 用户要求撤回 94e3f53（chips 上下文区分），已 revert（fbb6510）并推送：chips 恢复全局 6 个常驻、欢迎卡引导恢复 4 题含日报 | typecheck✓ 单测129✓ 冒烟✓ | — |
| 2026-09-29 | 主控 | 智能体召唤效果（用户需求 m03213）| types.ts（TaskEvent+agent_summon、ChatMessage+agent kind/agent 字段、AgentSummonMessage）、sessionStore.ts（applyTaskEvent agent_summon 分支→插入 kind='agent' 消息）、mock/provider.ts（summonFor 意图映射：摘要→态势感知、资源类→资源管理、建议→救援方案、文书类→文书生成；知识问答/停止/未知不召唤）、AgentSummonCard.tsx（新组件，脉冲光圈+协同中 badge+"模拟协同"脚注）、ChatPanel.tsx（agent 分支渲染）、chat.css（召唤卡动画） | typecheck ✓ lint ✓ 单测 129 ✓ 冒烟：摘要/资源/文书三类任务均出现对应召唤卡、QA 不召唤、刷新持久化 ✓ |
| 2026-09-29 | 主控 | 文书中心空态改为值班日报红头样稿（标注 vibe_1790660356403/1790660369177）| RedheadDailyMock.tsx（新：Word 公文红头排版 mock，安能市应急管理局红头+文号+红线+三段正文）、doc.css（axn-redhead-* 样式）、DocCenterPanel.tsx（空态 Empty→红头样稿）| typecheck ✓ lint ✓ 单测 129 ✓ 冒烟：空态样稿可见/无 Empty、"待核实"口径✓无"无伤亡"✓模拟标识✓、补录后生成成功样稿消失列表出现 ✓；注意"生成值班日报"按钮在页面有 2 个（聊天 chip+文书中心），冒烟用 last() |
| 2026-09-29 | 主控 | 引导问题换一批（用户 m03375）| ChatPanel.tsx WELCOME_QUESTIONS [1,5,9,17]→[38,43,16,67]（堤防险情征兆与抢护/水情数据调整方案/抵达现场路线/溺水急救）| typecheck ✓ 单测 132 ✓ 冒烟：新 4 题渲染、点击命中 QA 卡有回答 ✓ |
| 2026-10-03 | 标注驱动移除 | 主控 | 移除侧栏「模拟控制」功能（标注 vibe_1790999863933_lpar22eus）：GlobalSidebar 删除按钮+Badge+Drawer 及 controlOpen/DemoControlPanel/Badge/Drawer 引用，删除 src/components/demo/DemoControlPanel.tsx，清理 App.tsx/sidebar.css 注释与 .axn-gs-demo-btn 规则；同步删除依赖该入口的 3 个 E2E（global-nav 10 模拟环境重置、daily-and-control 事件切换隔离/重置后空态）| typecheck ✓ lint 0err ✓ 单测 139 ✓ build ✓ 冒烟：footer=当前事件/角色/对话与通知设置，无「模拟控制」、无 badge、DOM 无 .axn-gs-demo-btn ✓ | 待用户复看 |
| 2026-10-03 | 标注驱动样式 | 主控 | 左侧菜单选中态改为实心主色（与上方「新建任务」按钮一致）：`.axn-gs-nav-item.is-active` background/border → var(--nav-primary)、color #fff，删除右侧 5px 蓝点 `::after`；hover 不会冲淡选中态（`.is-active` 在 `:hover` 之后，同特异性）| typecheck ✓ lint 0err ✓ 单测 139 ✓ 冒烟：active bg rgb(29,111,242)/color #fff/icon #fff/`::after` none，未选中项仍透明无底色 ✓ | 待用户复看 |
| 2026-10-03 | 标注驱动移除 | 主控 | 移除聊天首页「对话/工作」模式切换（标注 vibe_1791022651872_1l5h64wps）：ChatPanel 删除 Segmented 及 MODE_OPTIONS/WELCOME_QUESTIONS/getQaItem，首页始终展示 AGENT_QUICK_TASKS 任务卡，底部提示改「也可直接输入指令，或在下方输入区使用快捷任务。」；chat.css 清理 `.axn-chat-mode*`/`.axn-home-mode*`/`.axn-home-hello`/`.axn-question-item*` 死规则；分屏空态排版对齐房屋规范（Typography.Title level={5}+Text secondary，删除手写 font-size 覆盖）；补齐丢失的「更多任务」chips 收纳浮层（常驻 3 个常用任务 + Popover，Esc 关闭/运行中禁用/aria-expanded，`.axn-more-tasks` 样式钩子复用）；e2e/ui-redesign.spec.ts 去除模式切换引用并同步「更多任务」断言；.gitignore 补 .vitest；删除 ChatPanel.tsx.bak 陈旧备份 | typecheck ✓ lint 0err ✓ 单测 139/139 ✓ build ✓ e2e/ui-redesign 14/14 ✓ | 待用户复看 |
