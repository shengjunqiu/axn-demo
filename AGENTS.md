# AGENTS.md

## 验证范围约定（UI 改动）

改动量级和验证范围要匹配。**不要默认跑全量 e2e。**

### 基础（任何改动都做）

- `pnpm typecheck`
- `pnpm lint`
- 删改符号后这两条是主要防线（unused 变量 / 导入）。

### UI 微调（文案、样式、删除叶子节点、调整布局属性）

1. 先 `grep` 涉及的 `data-testid` / 文案 / class 在 `src/`、`e2e/`、`src/tests/` 的全部引用。
2. 只跑命中的 spec：`pnpm exec playwright test <file>...`，必要时用 `E2E_PORT` 避开已占用的预览端口。
3. **不跑全量 e2e。**

### e2e 前置（重要）

`playwright.config.ts` 的 webServer 跑 `pnpm preview`，**服务的是 `dist/` 静态产物，不是源码**。

- 跑 e2e 前必须先 `pnpm build`，否则测的是上一次构建的旧包（改动不会生效，断言只能等到超时）。
- `reuseExistingServer: true`（本地）：4173 上若有残留 preview server 会被直接复用，不会重启；
  若 4173 被 dev server 占着，测的会是源码而非产物。
- 配置里没有 `use.actionTimeout`，定位不到元素时会一直等到整个 test timeout
  （默认 90s；关键用例 `test.setTimeout` 到 180–240s）——**失败一次就是 3–4 分钟**，
  且只在失败时写 trace（单个 trace 可达 20MB）。
- 用 `-g` 收窄到用例粒度，不要整文件跑：全仓目前只有 2 个用例依赖角色切换，
  即 `e2e/mainline.spec.ts:43`、`e2e/daily-and-control.spec.ts:45`（两者都带 180–240s 超时，本身就很慢）。

### 需要全量 e2e 或更完整验证的场景

- 跨页共享的布局 / CSS token（`src/styles/global.css`、`src/theme.ts`）变更
- store、持久化、路由结构、构建配置变更
- 增删依赖、公共组件接口变更

**例外**：用户明确要求全量，或影响面确实不确定时，跑全量并说明原因。

**背景**：本仓库 e2e 对选择器 / 文案漂移较敏感（见 `77dcaab test(e2e): 修 9 处选择器/文案漂移`）。用 grep 消除「某条看似无关的 spec 恰好断言了被删元素」的不确定性，比用全量去撞更便宜。
