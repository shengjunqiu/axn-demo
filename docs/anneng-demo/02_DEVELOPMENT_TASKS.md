# 安小能客户演示 Demo｜开发任务与验收计划

版本：0.1  
日期：2026-09-28  
任务状态：全部待开发。本文是给 Codex 的实施任务，不是已经完成开发/测试的报告。  
产品依据：[01_PRODUCT_SPEC.md](01_PRODUCT_SPEC.md)。业务来源与选型依据：[03_SOURCES_AND_DECISIONS.md](03_SOURCES_AND_DECISIONS.md)。

## 0. 执行合同

本轮只做产品说明中的 P0，不接真实模型，不做真实派单，不搭建生产后端。交互和数据联动必须真实可用；不能用静态图片、空按钮或固定成功提示代替功能。

请先读取仓库现有 AGENTS.md、package.json、锁文件、目录结构和未提交改动，遵循已有约束。不要覆盖用户已有代码或回滚无关改动。空仓库才初始化项目；已有 React 仓库应增量集成，不私自升级无关依赖。

按阶段实际编码、运行、检查，再进入下一阶段；不要仅输出一份计划就结束，也不要在未执行验证时把任务标 completed。不可执行的验证记录 blocked 及原因。

**最低完成定义**：可启动、可构建、可操作完整主线；来源、编辑、校核、版本和签发门禁相互一致；Word 真导出；打印版式可用；异常和重置不破坏主线；有测试与截图证据。

## 1. 技术选型与依赖约束

### 1.1 默认技术栈 [设、技]

| 层 | 选型 | 约束 |
|---|---|---|
| UI 基础 | React 19.x + TypeScript | 新项目默认；react/react-dom 精确同版；实际按 peerDependencies 验证 |
| 构建 | Vite | 纯浏览器 SPA，不引入 Next.js 或 SSR |
| 业务组件 | Ant Design 6.x、@ant-design/icons | 表单、Tabs、Drawer、Modal、Tag、Button、Splitter/布局 |
| AI 组件 | @ant-design/x 2.x | 使用 Bubble.List、Sender、Conversations、Prompts、ThoughtChain 等 |
| Markdown | @ant-design/x-markdown | 只渲染普通回答/建议描述；不渲染任意 JSX 或不可信 HTML |
| 状态 | Zustand | 一份领域状态；按 selector 订阅；本地持久化 |
| 文书编辑 | @tiptap/react、@tiptap/pm、@tiptap/starter-kit | 本地基础编辑及自定义 fact 节点；各 Tiptap 包版本相容 |
| 图表 | echarts | 按需引入，明确注册 LineChart/BarChart 和渲染器 |
| 空间呈现 | 本地 SVG + React | 交互示意图；不用真实地图底图、经纬度和 API Key |
| Word | docx | 从 DocumentRevision 生成真 DOCX；不是 HTML 改扩展名 |
| PDF P0 | 浏览器打印预览 | 按钮明确“打印 / 另存为 PDF”，不承诺自动保存 |
| 单元/组件测试 | Vitest + Testing Library | 实际安装兼容版本；中文输入、编辑、门禁需组件测试 |
| 浏览器测试 | Playwright | 本机服务下主线、下载、异常、视口截图 |
| 样式 | CSS Modules + 主题 token | 不叠加另一套完整 UI 库，不引入 Tailwind 全局 reset 冲突 |
| 包管理 | pnpm（新项目默认） | 已有项目沿用唯一锁文件对应工具 |

必要时加入 schema/校验或 diff 小工具，但先证明需求，不为了“架构完整”引入大量库。不要加入 x-sdk、AI SDK、LangChain、LangGraph、x-card 或真实 Agent Runtime；本轮采用自己的受控 Mock provider。

### 1.2 Ant Design X 2.x 接入注意

依据官方迁移指南 W-02：不使用旧 useXAgent；不从 @ant-design/x 导入已迁移的运行时 Hook；Bubble 的自定义渲染核对 contentRender；Sender 核对 suffix 等当前 API，不能复制旧 actions 属性。Bubble.List 必须有明确可滚动高度。

Ant Design X 提供交互组件，不提供本项目的事件事实、业务权限、校核规则和文书生命周期。Conversations 用于事件会话，不用它的示例文案创建 Agent 选择器。ThoughtChain 在本项目展示“执行过程与依据”，只使用可审计业务步骤。

### 1.3 安装前检查

新项目可先执行只读查询，例如：

```bash
node -v
pnpm -v
pnpm view @ant-design/x@2 version peerDependencies --json
pnpm view antd@6 version peerDependencies --json
pnpm view @ant-design/x-markdown version peerDependencies --json
pnpm view vite version engines --json
pnpm view @tiptap/react version peerDependencies --json
pnpm view docx version engines --json
```

同时确认测试库和构建插件对 Node/React/Vite 的要求。不要直接把所有依赖装成 latest 后靠 --force/--legacy-peer-deps 掩盖冲突。文档里的版本线是建议，不是安装验证结论。

已存在锁文件时先读取现有版本，不强制替换工具或全局 Node。需要改变原项目主版本必须说明影响，不能无声迁移。

## 2. 建议目录结构

```text
src/
  app/                    # router、providers、theme、error boundary
  domain/
    types.ts              # 事实、会话、任务、文书、校核等统一类型
    selectors.ts          # 资源汇总/状态推导；不写 UI
    document-model.ts     # 文书内容树与快照
    validation-rules.ts   # 可测试纯函数规则
    transitions.ts        # 任务/文书状态转换与门禁
  features/
    assistant/            # 对话、输入框、任务卡、澄清卡
    situation/            # 摘要、示意地图、趋势
    resources/            # 查询结果、候选清单
    knowledge/            # 知识卡与详情
    proposals/            # 上游建议展示
    documents/            # 生成、编辑、校核、来源、版本、签发
    demo/                 # 引导、角色、场景注入、重置
  services/
    assistant-provider.ts # UI 无关的统一接口
    mock/                 # 有限意图、调度器、业务适配器
    document-service.ts   # 字段绑定、快照、校核及生命周期
    export-service.ts     # DOCX 和打印模型
    persistence.ts        # 本地存储 schema、恢复、重置
  store/                  # 唯一领域状态；按 feature 拆 slice
  fixtures/               # 从本包 scenario.json 转换/加载的种子
  shared/                 # 纯展示组件、formatter、ID/Clock
  styles/
  tests/
e2e/
public/                   # 必须的本地静态资源
artifacts/                # 截图、测试证据，按仓库规则管理
docs/anneng-demo/          # 本文档包
```

可适当合并目录，不要求照抄每个文件名。必须保持 UI、领域规则、种子和服务边界，不允许一个 App.tsx 填入全部页面/数据/定时器/校核逻辑。

## 3. 里程碑

| 阶段 | 任务 | 可交付结果 | 退出门槛 |
|---|---|---|---|
| M0 基线与模型 | T-001～T-002 | 可运行壳、版本记录、统一事实种子 | 构建和基础数据校验通过 |
| M1 交互骨架 | T-003～T-006 | 两个路由壳、会话与受控消息、可取消任务 | 首屏可演示；状态不靠页面硬编码 |
| M2 安小能主线 | T-007～T-010 | 摘要→资源→追问→建议→文书入口 | 数据全链同源；未知问题有兜底 |
| M3 文书闭环 | T-011～T-016 | 补项→编辑→溯源→校核→版本→模拟签发→导出 | 要情与日报可运行；文件与快照一致 |
| M4 演示加固 | T-017～T-022 | 引导、故障、持久化、测试、视觉和交付说明 | AC-001～AC-030 通过或真实列出阻塞 |

不要把测试全部拖到 M4。各任务需要自己的定向测试；T-019/T-020 用于补齐交叉回归与证据。

## 4. 任务总览与依赖

| 任务 | 名称 | 前置 | 对应需求 |
|---|---|---|---|
| T-001 | 仓库检查、依赖验证、初始化 | 无 | FR-018 |
| T-002 | 领域类型、种子及来源索引 | T-001 | FR-001、004、006、010、011 |
| T-003 | Store、状态机与门禁基础 | T-002 | FR-001、003、012～014 |
| T-004 | 主题、路由、双工作台骨架 | T-001 | FR-001、011、018 |
| T-005 | Ant Design X 对话交互 | T-003、004 | FR-002 |
| T-006 | Mock 意图与任务调度器 | T-002、003、005 | FR-003、017 |
| T-007 | 摘要、待核与时效标识 | T-006 | FR-004 |
| T-008 | 本地态势图与图表联动 | T-004、007 | FR-005 |
| T-009 | 资源查询、指代与候选 | T-006、008 | FR-006 |
| T-010 | 知识和上游建议 | T-006、009 | FR-007、008 |
| T-011 | 模板、字段绑定、缺项续办 | T-003、006、010 | FR-009、010 |
| T-012 | Tiptap 编辑器与来源面板 | T-004、011 | FR-011 |
| T-013 | 校核引擎及交互 | T-012 | FR-012 |
| T-014 | 版本快照、diff、过期更新 | T-012、013 | FR-013 |
| T-015 | 提交、模拟签发、本地归档 | T-013、014 | FR-014 |
| T-016 | DOCX 与打印预览 | T-008、012、014、015 | FR-015 |
| T-017 | 引导、持久化、重置 | T-006、014、015 | FR-016 |
| T-018 | 故障注入与异常恢复 | T-006、013、016、017 | FR-017、018 |
| T-019 | 单元与组件回归补齐 | T-002～T-018 | 全部领域和组件需求 |
| T-020 | 浏览器主线与文件验证 | T-016～T-019 | AC-001～AC-030 |
| T-021 | 视觉、键盘和视口修正 | T-020 | FR-018、AC-028、029 |
| T-022 | 演示脚本、运行说明与交付 | T-021 | 全部 P0 |

## 5. 详细开发任务

### T-001 仓库检查、依赖验证、初始化

状态：`[ ] pending`。产出：运行壳、唯一锁文件、依赖记录、脚本。

工作内容：
1. 检查现有规则、结构、脏工作区及 package manager；记录可复用部分，不移除用户代码。
2. 核对 React/antd/x/Vite/Tiptap 的安装兼容性和 Node engines；在 IMPLEMENTATION_LOG.md 记录实际版本与查证结果。
3. 空仓库初始化 React TypeScript Vite；已有项目则增加必要路由/依赖。
4. 建立 dev、build、typecheck、lint、test、test:e2e、preview 脚本。未实现脚本不写成空返回 0。
5. 创建 src/app 与主题入口，至少渲染一个 antd 与一个 Ant Design X 组件，验证基本样式。

验收：依赖安装不靠强制忽略冲突；页面能启动；typecheck/build 基础通过。测试环境未安装需真实记录，不伪造通过。

### T-002 领域类型、种子及来源索引

状态：`[ ] pending`。产出：domain/types、fixtures、source resolver、selectors。

工作内容：
1. 读取 fixtures/scenario.json，保持虚构名称、数值、时间、ID 和模拟标识；可规范化结构但不能随意改变剧情。
2. 建立 Incident、Resource、StructuredFact、Proposal、Session、Document、Revision、Validation、Task 类型。枚举避免任意字符串。
3. 建立事实/源记录索引，引用能从 factId 追到 sourceFieldId、recordId、sourceVersion 和 capturedAt。
4. 单独实现候选人数/装备汇总、ETA/距离排序、班次统计和最新水位 selector。
5. 生成派生事实时附输入 ID 和公式，不给汇总结果伪造一个数据库字段。
6. 对第二事件保留隔离数据；保持 unknown 与 0、建议与确认、候选与调派的差异。
7. 日期使用带时区的 ISO 值，界面显式按 Asia/Shanghai 格式化；测试浏览器时区变化时仍显示 21:10。

验收：AC-002、003、005、006 的领域测试通过。删除一个引用会被验证器识别；更改二号队人数能同步改变派生统计，不需修改 UI 文本。

### T-003 Store、状态机与门禁基础

状态：`[ ] pending`。产出：store slices、transitions、guards。

工作内容：
1. 创建按 sessionId/eventId/documentId 索引的领域状态，UI 状态与业务对象分开。
2. 实现任务状态及文书生命周期/校核/新鲜度三个维度，不使用一个万能 status。
3. 实现明确 action：选择事件、发送请求、接收任务事件、候选更新、补录确认、文书修改、保存快照、设置校核、提交、签发、重置。
4. guards 不依赖按钮是否 disabled；领域层重复校验角色、版本、校核 hash 和 snapshot。
5. 引入 runGeneration/attemptId 防止取消或重置后的晚到事件污染状态。
6. 状态中不保存 ReactNode、函数、AbortController 或定时器句柄；在服务层管理资源。

验收：对 draft/ submitted/ signed 的合法转换及非法签发编写测试；已签发快照不可变；跨事件写回被拒绝。

### T-004 主题、路由、双工作台骨架

状态：`[ ] pending`。产出：Shell、WorkbenchPage、DocumentPage、PrintPage 壳。

工作内容：
1. 用主题 token 实现产品说明的浅色业务 AI 风格；只使用一套业务组件体系。
2. 建立主工作台导航/对话/工作区，以及文书目录/正文/辅助面板布局。
3. 实现顶栏事件、演示标识、演示身份与控制入口；不放未实现 Agent 菜单。
4. 声明各滚动区域和最小高度，预留移动断点但不开发完整移动端。
5. 实现无效路由、空工作区、无文书、局部错误边界和返回安小能行为。

验收：1440×900 首屏和文书壳截图。1366×768 下输入与工具栏可见。此阶段允许骨架数据，但标记未完成，不能以截图冒充主线已跑通。

### T-005 Ant Design X 对话交互

状态：`[ ] pending`。产出：ChatPanel、Composer、MessageRenderer、Conversations。

工作内容：
1. 用 Bubble.List 受控渲染消息；消息数据保留业务类型和 artifact 引用，不把 ReactNode 存入 store。
2. 用 Sender 实现发送/停止、空输入保护、换行和中文组合态处理；按实际版本文档配置。
3. 用 Conversations 展示事件会话，用 Prompts 展示灾情摘要/查资源/生成要情/日报。
4. 对流式文字使用 x-markdown；业务卡片采用专门组件，不用 Markdown 表格替代全部交互。
5. 当用户上滚时不强拉到底；新消息提示可跳回。
6. 可实现“语音输入（模拟）”预设文本弹层，不触发真实录音。

验收：AC-001、021、028 的基础组件测试；发送只产生一条 user message；IME Enter 不误提交；模拟语音确认走同一发送 action。

### T-006 Mock 意图与任务调度器

状态：`[ ] pending`。产出：AssistantProvider、MockAssistantProvider、intent rules、scheduler。

工作内容：
1. 定义 UI 无关的请求/事件契约，有限意图覆盖按产品说明 12.1 执行。
2. commandId 与自然语言共用同一能力；处理 pendingClarification 时优先匹配当前待补字段。
3. 建立步骤依赖，不将需要上游结果的文书/建议无条件并行；独立数据预取可并行。
4. 使用可注入 Clock、sleep(signal) 和 ID factory；每一步都能取消。
5. step、text_delta、artifact、clarification、error 都通过标准事件处理；ThoughtChain 只显示执行摘要和依据。
6. 支持失败的新 attempt 重试；取消后 status 终结，旧 attempt 事件被拒绝。
7. 统一“一个顶层请求”的并发限制；新任务要通过确认停止旧任务。

验收：fake timers 下正常/部分失败/取消/重试单元测试；AC-022、023、026。未知意图不创建假成功任务。StrictMode 下不重复启动。

### T-007 灾情摘要、待核与时效标识

状态：`[ ] pending`。产出：SummaryCard、SituationPanel、source status。

工作内容：
1. 摘要由主事件事实拼装，时间、地点、灾种、已确认等级与建议等级分别展示。
2. 获取事实→生成摘要→呈现工作区，阶段变化真实由 mock runner 驱动。
3. 呈现伤亡/影响待核项；数据时间使用演示时钟，不与系统当前时间混淆。
4. 来源超时仅返回可用事实并标记 partial；不把缓存当实时。
5. 工作区结果绑定 eventId、snapshotId 与 sourceVersion。

验收：AC-002；summary 中 42.30 与 latest 事实一致；缺水文时不假造最新值；建议 III 级不能显示为已启动。

### T-008 本地态势图与图表联动

状态：`[ ] pending`。产出：SituationMap、TrendChart、ResourceChart、snapshot helper。

工作内容：
1. React/SVG 绘制可操作的示意图，不需要在线底图；标注“非真实地图”。
2. 从同一实体记录渲染险情/队伍/仓库/监测点，支持图层开关、点选详情、高亮、缩放复位。
3. 列表和地图共用 selectedResourceId，不通过屏幕位置匹配对象。
4. 按需引入 ECharts，注册渲染器并处理 ResizeObserver、销毁，避免多次实例泄漏。
5. 提供趋势/装备数的文字表格摘要；图表的单位、时间和模拟标签齐全。
6. 暴露从指定 sourceSnapshot 生成附图的函数，导出时不抓另一个事件或最新版本。

验收：AC-002、005、027；图表 resize 正常；关闭外网仍可看全部图形；点选地图和列表一致；缩略快照带版本/时间。

### T-009 资源查询、指代与候选

状态：`[ ] pending`。产出：ResourceList、CandidatePanel、query/sort actions。

工作内容：
1. 实现状态/名称/类型筛选及 ETA/距离排序，明确排除理由。
2. 保存“实际展示给用户的有序结果 ID”；“前两支”必须据此解析。
3. 支持候选添加/去重/移除，忙碌资源不可加入；无上下文时澄清。
4. 候选汇总绑定 selector 和派生事实，列表、图表、建议和文书使用同一结果。
5. 保留所有候选为 proposed，不触发 confirmedDeployments 或资源 status 更新。

验收：AC-003～AC-006；改排序后“前两支”仍准确；移除资源汇总同步；跨事件候选不继承。

### T-010 知识问答和上游建议

状态：`[ ] pending`。产出：KnowledgeCard、KnowledgeDrawer、ProposalPanel。

工作内容：
1. 预置要情字段问答、模拟预案和案例详情；所有内容带模拟标识，不用假真实法规名。
2. 构造上游结构化建议，引用当前事件快照、候选和知识 ID；不输出危险工程参数。
3. 显示建议版本、风险、待核实条件，专业建议始终为“示例、待审核”。
4. “按此建议生成要情”设置 selectedProposalId/version 后调用文书入口，不直接塞入固定成文。
5. 无候选、未选建议时仍给合理空态，不捏造力量和已执行行为。

验收：AC-007、008；知识详情可点；选定建议后文书上下文引用一致；未知问答有兜底。

### T-011 模板、字段绑定、缺项续办

状态：`[ ] pending`。产出：TemplateRegistry、field binder、ClarificationCard、DocumentService。

工作内容：
1. 注册 EMERGENCY_BRIEF 与 DUTY_DAILY，定义章节、必填/可待核字段、映射和生成范围。
2. 纪要/总结仅预览，不复用要情正文冒充另一类型。
3. 生成前构造 contextSnapshot；检查 reportingUnit/handOverNotes 等缺项。
4. 返回 waiting_input 与结构化缺项；输入确认后创建 manual record，再恢复同一个请求。
5. 映射通过后拼装事实节点和有限叙述；统计由 selector/聚合函数计算。
6. 生成 draft 后保存原会话与文书关联；重复点击有 loading/去重，不产生重复草稿。
7. 直接生成要情而没有资源/建议时，也能基于已有事实工作，不依赖固定演示顺序。

验收：AC-008～AC-010、030；缺项时没有完整成稿成功消息；补项引用能追到人工记录；日报统计截至演示时钟。

### T-012 Tiptap 编辑器与来源面板

状态：`[ ] pending`。产出：DocumentEditor、FactNode、serializer、SourceDrawer。

工作内容：
1. 配置基础富文本和工具栏；不用收费协同/快照扩展。
2. 建立领域段落树 ↔ Tiptap JSON 的转换；保留稳定段落 ID 和 fact/chunk 引用。
3. fact 节点按文书 sourceSnapshot 取值；文本点击、键盘 Enter 均可打开来源。
4. 显示来源时间、版本、核实状态、值；派生值显示计算输入。
5. 修改叙述更新 workingVersion/contentHash，使旧校核 stale；自动保存工作副本。
6. 处理复制粘贴、全选删除、撤销重做、离开页面；事实被删除后不残留“来源完整”假状态。
7. 已签发快照使用只读渲染；来源面板仍可打开。

验收：AC-011、012、015；serializer round-trip 测试；编辑正文后快照及导出模型一致；关键数据无法原地改成另一个值后通过。

### T-013 校核引擎与交互

状态：`[ ] pending`。产出：validation-rules、ValidationPanel、IssueCard、定位/建议应用。

工作内容：
1. 将 R-001～R-012 实现成纯函数或可组合规则，输入是文书和其引用快照，不从 DOM 抓字。
2. 引用存在、值一致、派生计算与字段覆盖分别校验；不只判断 reference 数组长度。
3. 识别预置的“已有效控制”“无伤亡”“已调派”等与事实冲突的样例；规则范围如实标示。
4. 对自由叙述新增数字做有限检查，明确忽略模板编号等非事实位置。
5. 报告绑定 hash/snapshot/rulesetVersion；规则运行失败本身也不能当作通过。
6. 提供按级别过滤、正文定位、采用建议；应用建议只作用目标段落并使报告失效。
7. 来源覆盖数、问题数、通过状态从结果计算。

验收：AC-013～AC-015；修改用户输入真的影响结果；覆盖缺引用、错值、中文数词、旧报告等正反样本；别用“一键清除所有错误”跳过检测。

### T-014 版本快照、差异与过期更新

状态：`[ ] pending`。产出：RevisionService、VersionDrawer、diff、refresh source action。

工作内容：
1. 保存版本深拷贝/不可变序列化内容及来源，自动保存不等于无限生成正式版本。
2. 用稳定章节 ID 对比文本、事实、候选和来源变化；不要仅显示“修改 1 处”。
3. 演示数据更新后标记未签发稿 stale，显示“42.30→42.35”的变化预览。
4. 显式更新引用生成新工作快照，保留未冲突手改段落；再校核。
5. 已签发稿新增修订 v2.0，需说明，旧版仍只读；历史导出使用旧版。
6. 源数据演示时钟单调递增，不出现采集时间晚于演示当前时间的隐性矛盾。

验收：AC-016、017；旧版 hash 在后续修改后保持不变；修改 3 处能实际对比 3 处；刷新源不吞掉人工叙述修改。

### T-015 提交、模拟签发与本地归档

状态：`[ ] pending`。产出：SubmitAction、SignModal、ArchiveDrawer、AuditStore。

工作内容：
1. 校核通过的当前稿可 submitted；指挥员可退回/模拟签发。
2. 在 service/guard 二次检查角色、待签发版本、hash、新鲜度和 blocking issues。
3. 弹层显示当前版本与来源时间；按钮明确“模拟签发”；无真实接口和印章。
4. 幂等签发，写入 isSimulated、actor、performedAt、documentId、revisionId、contentHash。
5. 签发冻结版本；归档在本地列表可查看、返回会话和导出。
6. 已提交后编辑必须先退回草稿；不能边修改边沿用已提交校核。

验收：AC-018；直接调用 service 绕过 UI 也不能越过门禁；双击只有一条签发记录；提示明确未对外报送。

### T-016 DOCX 与打印预览

状态：`[ ] pending`。产出：DocxExporter、PrintDocument、ExportActions。

工作内容：
1. 以选定 DocumentRevision/当前通过校核快照作为唯一导出输入。
2. DOCX 生成真实段落、表格、页眉/演示标识、来源附录；态势图由相同 snapshot 生成，可本地转 PNG。
3. 图片不可引用外网，导出等待本地图片就绪；正文不截图，中文可选可编辑。
4. 下载 .docx 文件名包含事件、文书类型、版本、演示；正确 Blob MIME；完成后释放 URL。
5. 打印预览不含聊天/按钮/控制抽屉；@page A4，合理边距，表头可重复，图片不过页，禁止固定屏幕高度截断正文。
6. 打印打开时写“已打开打印预览”，不要伪报“PDF 已保存”。异常给重试，不吞掉错误。
7. 原生 Word track changes、一键 PDF 不在 P0；应用内历史 diff 不冒充两者。

验收：AC-019、020；测试下载的 OOXML ZIP 中有预期正文和来源，人工在可用 Word/WPS/兼容查看工具抽检可编辑性。打印 CSS 用浏览器检查真实分页。若设备无法验证 Word，标记待人工核验，不能宣称验证通过。

### T-017 引导、持久化和重置

状态：`[ ] pending`。产出：DemoController、ScenarioGuide、persistence/rehydration。

工作内容：
1. 引导步骤只触发已经实现的 action，不使用独立静态轮播模拟主线。
2. 维护正常/加速节奏，计时反映实际 Mock 执行，不能伪造 SLA。
3. 本地命名空间 `anneng-demo:v1`；设置 schemaVersion、迁移/损坏兜底，节流保存。
4. 保存会话、候选、手动补录、文书和版本；恢复 pending；running 重置为明确 interrupted/可重试状态。
5. 重置前确认，只删本 Demo 数据；取消全部任务、清理订阅和临时 URL，再恢复种子。
6. 存储失败时提示“本地保存不可用，刷新可能丢失”，不显示保存成功。

验收：AC-025、026；连续重复主线三次结果一致；重置后旧任务不回写；外部 localStorage 测试键不被删除。

### T-018 故障注入和异常恢复

状态：`[ ] pending`。产出：fault configuration、ErrorCard、retry flow。

工作内容：
1. 提供服务超时、引用缺失、监测更新三个可控入口；开关明确“演示故障”。
2. 超时返回可用子结果，错误列出失败步骤；重试新 attempt 不复制用户消息和已完成副作用。
3. 引用缺失阻断生成/签发/导出，不能只让面板变红而操作仍成功。
4. 测试无结果、指代歧义、非覆盖意图、无签发权限、导出异常、存储异常。
5. 事件切换/路由离开/取消时清理资源；晚到结果 guard 完整。
6. 防 HTML/脚本注入，只允许明确安全内容；不向外网发任何运行期请求。

验收：AC-021～AC-027；打开错误后能回正常主线；错误处理不偷偷更正数据或关闭全部校核。

### T-019 单元和组件回归补齐

状态：`[ ] pending`。产出：测试套件及真实执行记录。

最低覆盖：
- 事实/来源索引、缺失和跨事件引用。
- 筛选/排序、有序指代、候选添加去重/删除、2/64/7 派生统计。
- 时间与班次统计、unknown vs 0、confirmed vs suggested。
- 模板必填、待补续办、manual source、没有建议仍可生成事实要情。
- R-001～R-012 每条至少有命中与不命中样例；引用存在但值错误不能通过。
- contentHash 与校核失效；签发 guard、幂等、已签发不可变。
- provider 取消、重试、StrictMode、事件切换、重置晚到事件。
- 编辑器 serializer、段落定位、采用建议不覆盖其他文本。
- IME、键盘按钮、无权限和异常提示。

测试不能仅断言“mock函数被调用”。必须断言用户可观察结果和领域对象变化。测不动的测试不能用 skip/宽松断言掩盖而不记录。

验收：实际 test 命令退出成功；失败列表为零或如实标阻塞；不能用手工改 expected 迁就错误逻辑。

### T-020 浏览器主线与文件验证

状态：`[ ] pending`。产出：Playwright spec、trace/report、下载验证和截图。

主线至少包括：进入→摘要→资源→连续追问→候选→建议→要情缺项→人工补录→编辑→校核失败→应用建议→再校核→保存版本→提交→切角色→模拟签发→Word 下载。

独立场景至少包括：日报、未知输入、取消与重试、跨事件隔离、数据更新、历史版本导出、刷新恢复、重置、禁外网。

断言要求：
1. 优先使用 role、label、可读按钮名定位；仅必要复杂组件加稳定 data-testid。
2. 校核失败是真由编辑内容触发，不只开调试开关伪造一张错误卡。
3. DOCX 解压后检查关键正文、版本、演示标记；不得只断言文件大小大于 0。
4. 打印样式可在 Chromium 自动产出测试 PDF/截图验证页面，但不据此声称 UI 实现了一键 PDF 下载。原生打印保存动作可作为人工验收项。
5. 阻断非 localhost 请求并执行主线；不要把本机应用请求也阻断。
6. 记录控制台异常，正常主线不得存在未处理错误。

验收：AC-001～AC-030 对应到 spec 或明确的人工步骤；截图/trace 路径真实存在；缺浏览器依赖必须记录，不能写“全部通过”。

### T-021 视觉、键盘和视口修正

状态：`[ ] pending`。产出：修正后的页面及最终截图。

工作内容：
1. 检查 1366×768、1440×900、1920×1080 的工作台、长对话、文书、来源、校核、签发状态。
2. 修复地图/卡片布局、长标题省略、表格溢出、编辑纸张宽度、按钮挤压、抽屉遮挡。
3. 检查键盘焦点、抽屉返回焦点、事实来源按钮名称、只用颜色表达错误、图表文字备选。
4. 去掉多余动效、占位英文、调试 JSON、无效操作、重复长回答。
5. 打印版检查来源附录分页、图题、不截断长中文段落，保留演示说明。

验收：AC-028、029；必须打开生成的截图检查，不只说“应该适配”。截图中的数据、时间、版本与实际场景一致。

### T-022 运行说明、演示脚本与交付

状态：`[ ] pending`。产出：应用 README、DEMO_SCRIPT.md、IMPLEMENTATION_LOG.md、证据索引。

应用 README 至少说明：环境版本、安装/启动/构建/预览/测试命令、默认入口、演示数据说明、重置方式、已实现/未实现、Word 与 PDF 的实际能力、演示身份的限制。

DEMO_SCRIPT.md 给出 10～15 分钟流程和客户可能插入操作的恢复方法；主线按钮和话术必须与实际实现一致。

IMPLEMENTATION_LOG.md 记录每项 task 的 status、files、commands、结果、截图/trace、已知限制；不把本包的待开发清单直接打勾当作证据。

最终交付说明要区分：可运行代码、模拟服务、真实文件输出、未接入能力、尚需人工核验的事项。未经用户要求不自动 push、部署公网或发客户通知。

验收：从干净 localStorage 按 README 启动并完整走查；复核所有路径、命令和证据文件；同一主线连续重复三次无状态污染。

## 6. 验收映射矩阵

| 验收用例 | 主责任任务 | 验证方式 |
|---|---|---|
| AC-001 | T-004、005 | 组件 + E2E + 截图 |
| AC-002 | T-002、007、008 | 单元 + E2E |
| AC-003、004 | T-009 | 单元 + E2E |
| AC-005、006 | T-002、009、011 | 单元 + E2E |
| AC-007、008 | T-010、011 | 组件 + E2E |
| AC-009、010 | T-011 | 单元 + E2E |
| AC-011、012 | T-012 | serializer/组件 + E2E |
| AC-013、014、015 | T-013 | 规则正反样例 + E2E |
| AC-016、017 | T-014 | 不可变测试 + E2E |
| AC-018 | T-015 | guard/幂等单元 + E2E |
| AC-019、020 | T-016 | 文件结构 + 浏览器打印 + 人工抽检 |
| AC-021、022、023 | T-006、018 | fake timer + E2E |
| AC-024 | T-003、009、018 | 跨会话单元 + E2E |
| AC-025、026 | T-017 | 持久化/晚到事件 + E2E |
| AC-027 | T-008、016、018 | 禁外网 E2E |
| AC-028、029 | T-005、012、021 | 组件/键盘 + 多视口截图 |
| AC-030 | T-011 | 模板预览 E2E |

## 7. 推荐检查命令与证据规范

以新 pnpm 项目为例；实际必须匹配仓库脚本：

```bash
pnpm install --frozen-lockfile
pnpm typecheck
pnpm lint
pnpm test --run
pnpm build
pnpm test:e2e
```

浏览器测试的 webServer 由测试配置管理；开发服务器要记录端口，避免占用用户其他服务。若任务完成后仍需保留用于用户查看，交付说明给出已启动状态；不能声称会在对话结束后继续无人值守工作。

建议证据路径：

```text
artifacts/screenshots/workbench-summary-1440.png
artifacts/screenshots/workbench-resources-1440.png
artifacts/screenshots/document-validation-error-1440.png
artifacts/screenshots/document-source-drawer-1440.png
artifacts/screenshots/document-signed-1440.png
artifacts/screenshots/workbench-1366.png
artifacts/screenshots/workbench-1920.png
artifacts/exports/brief-demo-v1_1.docx
artifacts/exports/print-preview-test.pdf
artifacts/test-results/
```

这些是将来开发的建议输出路径，本文件没有声称它们已经存在。

每个任务完成后用如下简短格式记录：

```text
Task: T-013
Status: completed / in_progress / blocked
Changed: 实际文件路径
Checks: 实际执行的命令与退出结果
Evidence: 实際存在的测试报告/截图路径
Notes: 已知限制、未验证部分、与原定方案的差异
Next: 下一个依赖已满足的任务
```

## 8. 多任务/多 Agent 实施约束

一个 Codex 会话顺序实施即可，不需要真实多 Agent 系统。若执行环境允许并行，只在领域类型、消息事件与文书快照契约冻结后拆分互不冲突的工作区。

可并行：地图/图表与编辑器纯展示壳；独立领域规则的测试；不修改共享类型的视觉调整。

不宜并行：多个执行者同时修改 domain/types、store、路由和 package.json；在未定文书模型时分别实现编辑器/导出/校核。共享契约由同一负责人合入。

每次范围扩展先记录受影响需求和验收项；不因某个 UI 组件难用就换整套技术栈，也不能跳过中间状态、溯源和签发门禁来赶进度。

## 9. 防止“看起来完成”的检查清单

- [ ] 资源统计确实由选择结果计算，不是固定 2/64/7。
- [ ] 校核错误由修改内容或缺来源真实触发，不是开关直接换绿勾。
- [ ] 关键字段可以追到模拟源值；错误值不会因为有一个引用 ID 就通过。
- [ ] 旧校核在正文修改后失效，已签发稿不被新数据改写。
- [ ] 加入候选不等于已调派，模拟签发不等于正式报送。
- [ ] Word 真文件包含当前修订内容，不是预先放好的样本文档。
- [ ] PDF 按钮如实写打印/另存为，取消不谎报成功。
- [ ] 自然语言未知请求有兜底，不能任何输入都匹配成功。
- [ ] 停止、重置和切换事件后，旧异步结果不能回写。
- [ ] 缺项、待核实、来源过期和权限不足都有可观察状态。
- [ ] 主线不依赖外网地图/字体/模型，能本地反复演示。
- [ ] 交付记录区分实测、未测和模拟；未实现内容没有成功按钮。

## 10. 建议交给 Codex 的首轮范围

首轮先完成 M0 和 M1，产出可运行双工作台与消息/任务基础，再继续 M2～M4。这样能先确认页面结构和状态基础，避免一次生成一个难以维护的大文件。

若用户直接授权完成全部 P0，仍按任务顺序推进并保留阶段验证，不把“分阶段”理解为只能做计划或每完成一小步都等待用户重复授权。遇到确实不可自行确定的业务写入、费用、部署或破坏性改动才停下来询问。
