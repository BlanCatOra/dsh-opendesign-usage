# AGENTS.md

本文件给 **AI 编码 agent** 看：**怎么改这个仓库**。
人类请看 [README.md](./README.md)；想**用**这个插件看 [llms.txt](./llms.txt)；
DSH 客户端插件的通用机制与事故复盘见 [docs/plugin-development.md](./docs/plugin-development.md)。

## 版本基线（2026-10-18 更新）

- 开发与验证基线：**DSH 0.2.1-rc.2**（内置 runtime `0.2.1-rc.2`；Arch 包 `0.2.1rc.2-1`）。
- 支持范围：**>= 0.2.0**，由 `package.json` 的 `engines.dsh: ">=0.2.0-0"` 显式声明。
- 宿主判定规则（`dsh-app-boot` 的 `unmetRequirements()`，源码已核实）：**声明了
  `engines.dsh` 就由它单独决定**，`peerDependencies` 被忽略；否则才逐个检查
  `@deepseek-ai/dsh` / `@deepseek-ai/dsh-*` peer。本仓库两者都写清，避免歧义。
- 改 `engines.dsh` 是**破坏性**的：不满足时插件会在 profile 加载阶段被跳过
  （`skippedBundles`）或让启动 preflight 禁用该行 —— 放宽范围前先确认真的验证过。
- 版本相关原文只维护在：`package.json` 的 `engines.dsh`、README 的「前置条件」与
  「兼容性」、以及本节。改版本号时几处一起看。

## 验证（改完必须跑）

```sh
npm test        # = node src/build-client.mjs + node --test test/*.test.mjs（103 项），一条命令
npm run check   # 仅语法检查（不含构建，单独跑不够）
```

- **改过 `src/` 就必须重建**：`npm test` 第一步就是构建；接线层测试测的是**真实产物**
  `lib/client.js`，不是 `src/`。只跑单元测试会漏掉产物层面的问题。
- **clone 后先启用钩子**：`node scripts/enable-hooks.mjs`。
  `core.hooksPath` 存在 `.git/config`（不进版本控制），不跑这一步 `.githooks/pre-push` 不生效。
- **不要用 `--no-verify`**：pre-push 会重建 bundle、跑静态守卫与全量测试，并断言
  `lib/client.js` 与已提交版本一致。CI（`.github/workflows/verify.yml`）做同样四件事，绕不过去。

## 产物

- `lib/client.js` 是**构建产物，必须提交**（DSH 宿主按文件加载，不会替你构建）。
- **只改 `src/`，然后 `node src/build-client.mjs`；永远不要手改 `lib/`。**
- 构建期守卫 `assertBundleShape()`（`src/build-client.mjs`）做两件事：
  ① `new Function(code)` 解析产物，语法坏掉立即失败；
  ② 扫 `require(...)`，只允许白名单里的 **9 个模块**（rc.2 的 seed 表是 **11 项**，
  多了 `zod` 与 `@tanstack/react-virtual`；本仓库**故意只放行更窄的 9 项** —— 越窄越安全，
  不要因为 seed 表变宽就跟着放宽）：
  `react`、`react/jsx-runtime`、`react-dom`、`react-dom/client`、`@deepseek-ai/cordis`、
  `@deepseek-ai/dsh-client-store`、`@deepseek-ai/dsh-client-ui-slots`、
  `@deepseek-ai/dsh-client-ui-primitives`、`@deepseek-ai/dsh-client-ui-dockkit`。
  超出即**构建失败**。
  ⚠️ 定位 seed 表要**按 `staticModules` 找**，不要 grep 函数名 —— rc.2 里它是 `SZ()`，
  以前是 `gM()`，每次构建都可能变。
- `package.json` 的 `dsh.client.immediately: true` 是 **host 侧 manifest 字段**，
  改完要**重启 DSH 应用**才生效（不属于客户端 bundle 的热重载）。
- 打包器只支持窄语法子集（静态 `import` / `export` 声明），不支持的写法会**显式报错**；
  新增语法前先扩展 `src/build-client.mjs`。

## 硬性约束（违反会静默失效 / 整站白屏）

1. **两套 `inject` 不是一回事。**
   `package.json` 的 `dsh.client.inject` 列**包名**（只管模块加载顺序）；
   `src/client.js` 导出的 `inject` 列**服务名**（cordis 的白名单）。
   漏声明服务 → `apply` 抛 `cannot get property "X" without inject` → fiber FAILED →
   `web boot: N entry did not activate` → **整个 DSH 白屏**，crash log 只有一行 `<包名>: failed`。
   `test/inject-coverage.test.mjs` 会双向静态断言（每个 `ctx.<service>` 都在 `inject` 里，且没有多余项）。
2. **`apply` 绝不允许把异常抛出去。** 每个表面各自 `guardStep`，失败只降级 + 记录：
   `console.error` + 写 `localStorage` 启动报告（用 `~/.dsh/bin/dsh-boot-report --key odp` 读）。
3. **`require` 只允许白名单里的 9 个模块**（名单见「产物」；rc.2 的 seed 表有 11 项，
   我们故意用更窄的 9 项）。
   宿主只读 `package.json` 的 `dsh.client.external`，**不扫描 bundle 文本** ——
   不要为"注释里出现 require 字面量"做无效修改。
4. **插件设置注册到 `plugins.bundle.config`（key = 插件包名）= 插件详情页配置区。**
   不是 `plugins.item`（那是官方插件的「内置插件配置分组」，第三方注册过去会错位），
   也不是 `settings.section`（设置总页只保留只读插件列表）。
5. **Rules of Hooks**：宿主的 selector hooks（如 `useProjection`）必须在组件**顶层无条件**调用。
   条件调用 → 渲染期抛错 → 该插槽条目被 `SlotErrorBoundary` **永久**撤销（表现为点按钮没反应）。
6. **list 槽必须自带 `id`**（复用别人的 id 会顶掉对方那一格）。
7. **模板字符串内部**的注释不能出现反引号 —— 会提前闭合字符串，产物语法坏掉。
   `assertBundleShape()` 的 `new Function` 能拦住，但报错位置不直观。
8. **文案全走 locale**（`src/locale.js`，zh/en 1:1）；缺 key 时界面直接显示 key 字面量。
   配置卡片的 `FALLBACK_TEXT` 必须覆盖所有 `settings.*` key。
9. **渲染期禁止抛错**（抛一次该条目就被永久撤销）；`src/boot-diagnostics.js` 的降级报告不要换成不可靠路径。

## 禁区

- `~/.dsh/profiles/` —— 运行时配置（插件真正挂载的地方），改它不影响仓库。
- `lib/` —— 生成物，只能由构建脚本写。
- `node_modules/`、`HANDOFF-*.md` —— 不进版本控制（后者是内部资料，`.gitignore` 已排除）。
- **任何 tracked 文件里不得出现真实凭据**（workspaceId、sessionCookie、cookie token）。
  `cordis.patch.yml` 只是注册模板，不含凭据。
- 公开内容里不得出现号主私人邮箱、内网 IP、`/home/<用户>/` 绝对路径；
  对外联系方式只用 `blancatora@agent.qq.com`。
- 不要给 `package.json` 加回 `prepare` 脚本 —— 它会让所有 git URL 安装在 pnpm 下被拒绝
  （已修，见 `CHANGELOG.md`）。

## 提交

本机没有全局 git 身份，**每次提交都显式署名**（AI 代理名 + agent 邮箱）：

```sh
git -c user.name="blancatora" -c user.email="blancatora@agent.qq.com" \
  commit -m "fix: ..." \
  -m "Generated-by: blancatora (DeepSeek Harness / <model-id>)" \
  -m "AI-Disclosure: 本提交由 AI 编码代理生成；可能含未经人工复核的改动。"
```

- `<model-id>` 写**你实际运行的**模型 id，不要照抄历史提交（本仓库历史提交用的是
  `deepseek-v4.1-flash`，之后的模型可能不同）。
- 不要用 `Co-Authored-By:` 冒充人类共同作者；不要用号主名字/邮箱署名。
- `git push`、建 tag / release、改远端设置之前先问用户（除非用户已明确要求）。
- Release notes / PR 正文开头同样放 AI 声明（模板见 [CREDITS.md](./CREDITS.md)）。

## 本仓库特有的坑（每条都有实测依据）

1. **「测试全绿、真机全废」（2026-10-15）**：插件曾在真机上**从未注册过任何表面** ——
   `loadReact()` 读了不存在的 `ctx.import` / `ctx.require`，异常被 try/catch 吞掉后 `apply`
   提前返回；而测试自己塞了假的 `ctx.import` 通道，所以全绿。
   **别用 mock 补实现搞错的外部契约**：接线层测真实 `lib/client.js`（自己的 `__ModuleLoader__`
   + `require` 桩），并由 `test/inject-coverage.test.mjs` 守住服务声明。
2. **刷新偶发白屏 `import failed`（2026-10-15/16）**：第三方客户端 bundle 在 `application`
   阶段只被 `script-preload`、不执行，代码由 `entries.start()` 之后的惰性拉取提供，
   与 entry 创建并发 → 偶尔赶不上 → `web boot: 1 entry did not activate`。
   修法是 `dsh.client.immediately: true`（已设），改完重启应用。**不是** require 白名单的问题。
3. **`import failed (see console for the import error)` 是兜底文案**，不是"模块导入失败"：
   它是 web boot 里 `fiber === undefined` 且 `importError()` 无记录时的措辞，真原因在相邻分支。
   按字面猜会浪费很久。
4. **「注入了但没调用」（2026-10-16）**：`loadReactDom` 定义了却从没在 `apply` 里调用，
   面板的 `createPortal` 分支永不成立 —— 表现为"点击按钮无反应"，而测试全绿。
   静态守卫已覆盖 `bind*` 的调用关系；新增能力时先确认调用链。
5. **`plugins.item` 是错名字**（2026-10-16 二次修正）：见硬性约束第 4 条。
   历史注释/文档里出现过，已同步修正；再看到 `plugins.item` 就当 bug 处理。
6. **`scripts/enable-hooks.mjs` 曾劫持宿主仓库的 `core.hooksPath`**（2026-10-15 复现）：
   本包被当作依赖装进别人仓库时，`git rev-parse` 会往上找到宿主的 `.git`，
   无条件写 `core.hooksPath` 会把宿主钩子全关掉。现脚本只在「本包目录 ==
   `git rev-parse --show-toplevel`」时才写，且不覆盖已有非空值 —— **不要拆掉这道守卫**。
7. **pnpm `file:` 依赖是硬链接快照**：改了源仓库的 `src/` 后 profile 里那份不会自动更新，
   测试也发现不了。同步到真机要 `rm -rf node_modules/<包名> && pnpm install`。
8. **`loopbackOrigin()` 必须放行 `dsh-app:` / `dsh:` 协议**：DSH 桌面页 origin 是
   `dsh-app://app`，把它当非法 origin 会让宿主请求 403 `origin-not-trusted`，
   读数显示 `OD · —`，而 curl（不带 Origin）是 200。路由测试必须带 Origin 头。
9. **secret 字段是 write-only**：`SettingsSecretField` 的空草稿不产生写入，所以
   「清空输入框删除已保存 cookie」做不到（primitives 契约）。要改这个行为先读
   [docs/design-guidelines.md](./docs/design-guidelines.md)。
10. **构建器语法子集很窄**：不支持的语法**显式报错**（不会静默产出坏 bundle）；
    但它只做文本变换，不理解的边界情况先写一个最小用例验证。

## 工作区说明（软链，单向）

本仓库在工作区「dsh插件」里以**软链**出现：

```
~/Projects/dsh-plugin/plugins/dsh-opendesign-usage → ~/Projects/dsh-opendesign-usage
```

- 软链是**单向**的：改真身（`~/Projects/dsh-opendesign-usage`）软链跟着变；
  软链里**不存副本**，往软链里写就是在改真身。
- 构造上不存在"只写在工作区、不进仓库"的文件：在软链路径下新建的文件会落在真身里，
  直接出现在 `git status` 里。要放**只属于工作区**的东西，放到软链之外。
- 工作区同层的 `docs/`、`skills/` 也是指向外部真身的软链（规范文档与插件开发技能），
  不是本仓库的目录，`git` 不会跟踪它们。
- 在软链路径或真身路径下跑 `npm test` / 构建，效果完全相同（Node 解析的是真实路径）。

## 目录地图

| 路径 | 作用 |
|---|---|
| `src/index.js` | Host 半侧：两条同源路由（套餐额度、钱包余额） |
| `src/client.js` | 浏览器入口：注册输入框控件 + 插件详情页配置卡片 |
| `src/composer-usage.js` | 读数与展开面板（纯逻辑 + 组件） |
| `src/plugin-settings-card.js` | 配置卡片（全部用 `primitives`） |
| `src/config.js` | schemastery 配置（全部 `volatile()` 活引用） |
| `src/build-client.mjs` | 打包器 + `assertBundleShape()` 产物守卫 |
| `test/` | 7 个测试文件；接线层测真实产物，`agent-facing.test.mjs` 守仓库规范 |
| `docs/` | 规范文档（开发红线、UI 规范） |
