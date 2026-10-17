# 更新日志

本项目遵循 [Keep a Changelog](https://keepachangelog.com/zh-CN/1.1.0/)，
版本号遵循 [语义化版本](https://semver.org/lang/zh-CN/)。

## [Unreleased]

### 兼容性

- **声明 DSH 版本范围：`engines.dsh: ">=0.2.1-rc.1"`**（2026-10-18）。开发与验证基线从
  `0.2.1-alpha.2` 提升到 **`0.2.1-rc.2`**（内置 runtime `0.2.1-rc.2`，Arch 包
  `0.2.1rc.2-1`）。宿主判定规则（`dsh-app-boot` 的 `unmetRequirements()`，源码核实）：
  **声明了 `engines.dsh` 就由它单独决定**，不再看 `peerDependencies`。本插件的
  `peerDependencies` 里本来就没有 DSH 包，所以显式声明消除了歧义。
- **rc.2 兼容性结论**：rc.1 的破坏性变更均未踩到（`invariant` 导出移除、
  `toolPresentation: both` 移除、`azure-openai-responses` 改名、输入区 `stats` 拆分、
  agent-instructions 的 `dshHome`）。插件用到的插槽在 rc.2 全部仍存在；
  会话格式 v4 → v4、workspace 存储 v2 → v2，**数据零迁移**。
- **文档同步 rc.2 的 seed 表变化**：宿主前端 seed 表从 **9 项增至 11 项**
  （新增 `zod`、`@tanstack/react-virtual`）。本仓库的 `SEED_MODULES` 白名单
  **仍保持更窄的 9 项**（越窄越安全，宿主新增项我们用不上）。同时修正文档里
  「seed 表函数名 = `gM()`」的定位法 —— rc.2 里它叫 `SZ()`，**每次构建都会变**，
  已改成「搜 `staticModules`，不要 grep 函数名」。

### 测试

- **新增 `test/agent-facing.test.mjs`（7 条断言）**：把「面向 agent 的仓库规范」从
  纸面要求变成 `npm test` 的门槛 —— 断言 `AGENTS.md` / `llms.txt` 存在且有实质内容、
  结构合规、README 所有语言版本在前 1/3 处有相对链接指路、链接目标真实存在，
  并对这几个会公开的文件做脱敏扫描（私人邮箱 / 内网 IP / 本机绝对路径）。

### 文档

- **`AGENTS.md` 补「工作区说明（软链）」**：本仓库在「dsh插件」工作区里以单向软链
  `~/Projects/dsh-plugin/plugins/dsh-opendesign-usage` 出现；软链不存副本、往里写就是改真身。
  同时把验证命令里的测试数量更新为 103 项。
- **补齐「面向 agent 的仓库」三件套**（2026-10-17，按
  `dsh-plugin-standards/docs/AGENT-FACING-STANDARDS.md`）：
  - 新增根目录 **`AGENTS.md`**：验证命令、构建产物、硬性约束、禁区、提交规范、
    本仓库特有的坑（每条都有实测依据）；
  - 新增根目录 **`llms.txt`**：H1 + 一句话摘要 + 指向 markdown 的文档索引；
  - `README.md` / `README.en.md` 正文靠前处加**指路行**（README 是给人看的，
    agent 需要先被指到上面两个文件）。
- **同步数处过时注释**：`src/client.js`、`src/plugin-settings-card.js`、
  `test/inject-coverage.test.mjs`、`test/settings.test.mjs` 里仍把插件设置插槽写成
  `plugins.item`；实际注册的是 **`plugins.bundle.config`**（2026-10-16 二次修正只改了
  文档与注册代码，注释漏了）。

- **`docs/plugin-development.md` 修正 4 处会误导人的内容**（2026-10-16 实测后同步）：
  - §1：`inject` 举例更新为实际值，并说明 `configForms` 为什么是
    「声明 + `ctx.get` 探测」并存的；
  - §8.3 **整节重写**：旧版教「注册到 `settings.section`」是**错的** ——
    那是官方领域基座的位置。改为 `plugins.bundle.config`（插件详情页），
    并给出三个 `plugins.*` 子插槽的分工表、权威原文与官方范式；
  - 新增 §9.5「注入了但**没调用**：最隐蔽的一类静默失效」—— 记录本次
    「点击无效」的真因（`loadReactDom` 定义了但 `apply` 从没调用它，
    导致面板的 `createPortal` 分支永不成立），含静态守卫写法与两条取证纪律
    （诊断自身不得派发合成事件、诊断必须按 sessionId 分桶）。

## [0.2.0] - 2026-10-16

按 `dsh-plugin-standards/docs/UI-STANDARDS.md` 与 DSH 插件开发规范**重构 UI 层**。

### 变更（破坏性）

- **UI 全面改用 `@deepseek-ai/dsh-client-ui-primitives`**，删掉所有自写控件。
  它是前端 boot 的冻结 seed 表（`gM()`）里的基座模块，`require` 必定成功；
  官方 10 个 `dsh-client-ui-settings-*` 里 9 个都 require 它。
  - 输入框读数：自写 `<div role="button">` + 自写 CSS → `Button`（`variant="ghost"`）
  - 读数展开面板：自写材质 → `MenuSurface`（共享菜单材质），
    定位与"点外部收起"改用官方 `useAnchoredPosition` / `useDismissOnOutsidePointer`
    （此前手写了两份功能等价的实现，属白维护，且少了 `overlayTopMargin` 等细节）
  - 设置卡片：自写开关/输入框/按钮 → `SettingsForm` + `SettingsFormModel` +
    `SettingsValueField` + `SettingsSecretField` + `Switch` + `Button` + `Tag`
  - ⚠️ **旧说法"第三方插件禁止 require 任何 Harness Client 包、只能抄 markup/CSS"已作废** ——
    那是把白屏事故归错了因（真因是漏声明 `inject` 服务名）。唯一的红线是
    **seed 表 9 模块白名单**，现由构建期守卫强制。
- **设置从 `settings.section` 迁到 `plugins.bundle.config`（插件详情页）**。
  权威原句（`dsh-client-ui-plugin-manager/README.zh.md`）：「注册了配置页的插件在这里、
  在它自己的页面上编辑；设置里只保留只读的插件列表。」
  用官方范式 `ctx.configForms.whileServed(...)` 跟随命名空间上线/下线边沿。
  为此 `inject` 新增 `configForms`（由 `@deepseek-ai/dsh-client-ui-settings` 提供，
  该包已在 `dsh.client.inject` 里）。
  ⚠️ **不要用 `plugins.item`**：按 README 原文那是「用于**官方插件**，按其 label 列在
  **内置插件配置分组**里」—— 第三方插件注册到那里会出现在「内置插件配置」下（实测踩过）。
- 新增构建期守卫白名单（`SEED_MODULES`，9 个），并给客户端 bundle 加
  `dsh.client.immediately: true`（见下）。
- 删除 `src/settings-section.js`（867 行自写 UI），由 `src/plugin-settings-card.js` 取代。

### 修复

- **刷新页面偶发整站白屏**（`web boot: 1 entry did not activate` +
  `<包名>: import failed (see console for the import error)`）。
  同一个 bundle 一次崩、一次不崩 —— 是竞态：DSH 把客户端 bundle 分两批，
  `bootstrap` 阶段（**只有官方固定清单**）阻塞执行，`application` 阶段
  （**所有第三方插件**）只发 `script-preload`、**不执行**；于是第三方插件的代码
  由 `entries.start()` 之后的 `internal.import → arrive()` 惰性拉取，与 entry 创建并发。
  修法：`dsh.client.immediately: true` —— web boot 的 `prefetchImmediateTier()`
  会在建 entry **之前** `await` 预取完毕，从构造上消除竞态。
  官方所有客户端包都设了它，第三方插件普遍不设。
- **cookie 不再明文回显**。旧实现把已保存的 sessionCookie 放进 `type=password` 的
  `value` 回显，屏幕上被看到等同泄露。改用 `SettingsSecretField`（写-only）。
  ⚠️ 代价：无法再靠"清空输入框"**删除**已保存的 cookie（secret 空草稿不产生写入，
  这是 primitives 的既有契约）。

### 变更（行为）

- **三个开关与各输入框统一为"暂存后保存"**：拨动只改草稿，点保存才落盘
  （旧实现是拨一下即写）。保存落地后同步本地镜像，输入框控件仍零延迟反映。
- 刷新间隔从滑块改为数值输入框（primitives 的字段组件只有这一种），区间校验仍在。
- 启动降级提示改用 primitives `Tag`（`tone="danger"`）+ 明细列表，不再自写徽章。

## [Unreleased]

### 修复

- **插件此前在真机上从未注册过任何表面**（严重）。`loadReact()` 走的是
  `ctx.import ?? ctx.require ?? globalThis.__DSH_IMPORT__`，而 DSH 的 cordis 上下文里
  **没有** `import` / `require` 这两个成员 —— `ctx.<name>` 代理只放行 Context 自带成员
  与插件自己 `inject` 里声明过的服务名，读它会抛
  `cannot get property "import" without inject`。这条异常被 `try/catch` 吞掉后
  `apply` 直接 `return`，于是**输入框控件与设置页都不注册**，日志里只有一行 warn，
  表现得像"插件装了但什么都没发生"。
  - 现在 react 从 **bundle 外壳的 `require('react')`** 取，也就是宿主那张
    `staticModules` 基座表（官方客户端插件用的同一条通道）；
  - 已在运行中的 DSH 里实测：`dsh.opendesign-usage.boot` 报告 `ok: true, failures: []`。
- **`ctx.configForms` 改为 `ctx.get('configForms')`**。前者是要声明进 `inject` 的服务，
  未声明时读它直接抛；而设置命名空间本来就"可能还没到"，不该变成必需依赖。
  （⚠️ 0.2.0 起此条**部分回退**：`configForms` 已正式声明进 `inject`，因为设置卡片
  改用官方 `whileServed` 范式读服务属性；`ctx.get` 探测作为降级路径同时保留。）
- Host 侧 `ctx.webServer` 同样改成 `ctx.get?.('webServer')`，不留同类隐患。

### 变更（2026-10-15，按用户反馈收窄读数）

- **折叠态读数改为只显示两个额度窗口**：`OD · 90% · 97%`。
  原先 `OD · 50% · 12k · $1.50` 四段挤在一格，用户反馈"太长了"。
  钱包余额与本会话 token 移入面板明细（点开仍可见，含重置倒计时与分项）。
- 伴随的语义收窄：`flagVisibilityOf().any` 现在等价于 `planQuota`
  （折叠态只剩额度，所以"有没有东西可显示"完全由它决定）。
  `enableTokenUsage` 仍然生效 —— 它控制面板明细里的 token 分项。
- 取不到的窗口显示 `—` 而**不是省略**：两个位置恒定，避免把 7 天错读成 5 小时。

### 新增

- **启动自检与降级**（`src/boot-diagnostics.js`）：`apply` 每一步各自守卫，
  **任何一步失败都只降级、只记录，绝不向外抛异常**——一个插件的接线错误不该让用户白屏。
  报告写进 `localStorage`（键 `dsh.opendesign-usage.boot`），用
  `~/.dsh/bin/dsh-boot-report --key odp` 读；设置页顶部也会列出降级详情。
- **静态守卫测试**（`test/inject-coverage.test.mjs`）：
  - 扫描客户端源码里所有 `ctx.<service>` 访问，断言每个都出现在导出的 `inject` 里，
    并反向断言 `inject` 无冗余项；
  - 禁止源码里再出现 `ctx.import` / `ctx.require`；
  - `apply` 在「服务全抛错 / 空 ctx / 拿不到 react」下都不得外抛。
- **接线层改为测真实 bundle**（`test/helpers/load-client.mjs`）：此前测试直接
  `import('../src/client.js')` 并靠假 `ctx.import` 提供 react，于是"测试全绿、真机全废"。
  现在从 `lib/client.js` 装载，react 走生产那条 `require('react')`。
  `npm test` 会先重建 bundle。

## [0.1.0] - 2026-10-15

首个版本。

### 新增

- 输入框工具行（`conversation.input.left`）的只读用量读数，仅在会话选中
  `opendesign` provider 时显示。
- Open Design 套餐额度显示：5 小时与 7 天两个滚动窗口的剩余百分比、
  剩余额度、重置倒计时。
- **钱包余额显示**：控制台「Design Plan 额度用尽后，自动使用此余额按量付费」那个数字。
  与额度窗口同一次请求取回（宿主并发打两个上游接口），两个数据源互相独立失败。
- 本会话 token 用量显示（读宿主 `tokenUsage` 投影，无需凭据）。
- 设置页：三个独立开关、workspaceId 与 sessionCookie 输入、
  「测试连接」按钮（用草稿值验证，不必先保存）。
- Host 侧 loopback-only 同源路由，凭据不出宿主进程。
- 中英双语界面文案。

### 说明

- 上游接口 `GET /api/v1/workspaces/{id}/billing/coding-plan-usage` 于
  2026-10-15 实测可用；`usedCredits` / `limitCredits` / `remainingCredits`
  是**字符串**，插件已做数值归一。
- 钱包余额走 `GET /api/v1/billing/summary`（**注意路径不含 workspaceId**，
  与额度接口不同）；金额同样是字符串，且美元与 credits 两种单位都保留。
- 上游文档里写的 `https://api.amr.dev/v1` 域名同日实测**无 DNS 记录**，
  是旧构件的残留；真实接口在 `amr-api.open-design.ai`。这正是本插件把
  API 根写成常量的原因，便于将来一处修改。
