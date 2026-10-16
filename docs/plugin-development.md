# DSH 客户端插件开发规范（技术红线）

> 本文是**可照着执行的 checklist**，不是导论。每条「必须 / 禁止」都追溯到一次真实事故，
> 按 **现象 → 机制 → 正确做法** 三段写。
>
> **事实来源**：2026-10-15 本插件在真机上「从未注册过任何表面」的完整事故
> （见仓库根目录 `HANDOFF-inject-and-react-20261015.md`），以及同日
> `dsh-enhanced-prompt-editor` 因同一类缺陷把整个 DSH 打白屏的事故。
> 机制部分在 DSH 安装包 `app.asar` 里逐条比对过源码，各节标注了出处。
>
> 标注「**未验证**」的条目表示：机制推断合理但本轮没有实测证据，不要当成已知事实引用。

---

## 0. 三条一句话红线

| # | 红线 | 违反的后果 |
|---|---|---|
| 1 | `ctx.<service>` 只放行**插件自己导出的 `inject`** 里声明过的服务名；探测可能不存在的服务用 `ctx.get()` | 整个 DSH 白屏，crash log 只有 `<包名>: failed`，无堆栈 |
| 2 | `apply` **绝不允许把异常抛出去**；每个表面各自守卫，失败只降级 + 记录 | 同上：一个插件的接线错误让整站白屏 |
| 3 | `require` **只允许 seed 表 9 个模块**（含 `@deepseek-ai/dsh-client-ui-primitives`）；越界即构建失败 | 整站白屏（模块不在冻结表里，`makeRequire` 抛错） |

下面逐条展开。

---

## 1. 两个 `inject` 不是一回事（本次事故的根源概念）

### 现象

插件装上后**什么都没发生**：输入框控件、设置页都不出现，测试却全绿。
另一种表现更糟——`apply` 抛错时**整个 DSH 白屏**，crash log 只有一行 `<包名>: failed`。

### 机制

| 位置 | 内容 | 管什么 |
|---|---|---|
| `package.json` 的 `dsh.client.inject` | **包名** | 只管**模块加载顺序** |
| 插件自己导出的 `inject` | **服务名** | cordis 的**服务访问白名单** |

`ctx` 是 cordis 的代理对象，`get` 陷阱的逻辑是（`HANDOFF` 第 2 节引用的 asar 源码）：

```js
get: (target, prop, ctx) => {
  if (isSpecialProperty(prop)) return Reflect.get(target, prop, ctx);
  if (Reflect.has(target, prop)) return getTraceable(ctx, Reflect.get(target, prop, ctx));
  const error = new Error(`cannot get property "${prop}" without inject`);
  // …按服务解析：accessor / reflect.get / internal/get waterfall
}
```

也就是说**只有两类名字能读**：Context 自带成员，以及插件自己 `inject` 里声明过的服务名。
其余一律落到那条 `error` 上。于是漏声明的完整链条是：

```
读未声明的服务 → 抛 cannot get property "X" without inject
  → 异常从 apply 逸出 → cordis 把 fiber 置 FAILED
  → web boot throw new Error("web boot: N entry did not activate")
  → 整页白屏
```

crash log 里只有 `<包名>: failed`，**没有堆栈**（异常交给了渲染进程 logger，它不落盘）。

### 正确做法

- 用 `ctx.<service>` 之前，先确认该服务名在**导出的 `inject`** 数组里；
- 只把**真正的必需依赖**写进 `inject`——写进去就等于声明「没有它我起不来」，
  别人挂了你也起不来，连带整个 DSH 启动白屏；
- 需要「**可能还不存在**」的服务时，一律用 `ctx.get('name')`：
  它是 Context 自带方法，**不受这道闸限制**，服务没到就返回 `undefined`。
  **不要**为了探测把它写进 `inject`。

本插件实例：`src/client.js` 里 `export const inject = ['slots', 'locale']`；
而「设置命名空间可能还没到」的 `configForms`、host 侧「可能没有 webServer」的场景，
都走 `ctx.get(...)`（见 `HANDOFF` 第 3 节）。

### 配套自动化（必做）

写一条**静态守卫**测试，双向断言：

1. 源码里每个 `ctx.<service>` 访问都出现在导出的 `inject` 里；
2. 反向断言 `inject` 里没有冗余项。

本仓库的实现是 `test/inject-coverage.test.mjs`，可直接抄。
模板参考 `~/Projects/dsh-enhanced-prompt-editor/test/bundle.test.mjs`。

> ⚠️ **守卫本身有个坑**：守卫比对的是「`lib/client.js` 导出的 inject」与
> 「`src` 用到的 ctx 服务」。只改 `src`、不重建产物时，读到的是**旧产物**，
> 变异验证会**静默通过**。因此守卫必须能与产物做同源断言
> （本仓库的做法见 §5 的 `assertBundleMatchesSource()`）。

---

## 2. `apply` 绝不允许把异常抛出去

### 现象

一个插件的接线错误 → 整站白屏。用户看到的不是「这个功能不可用」，
而是「DSH 打不开了」。

### 机制

`apply` 抛出的异常由 cordis 记到 fiber 上并置 `FAILED`，web boot 随后
`throw new Error("web boot: N entry did not activate")`，**整页不再渲染**。
一个插件不该有这个权限。

### 正确做法

- 把 `apply` 拆成若干**独立步骤**，每步各自 `try/catch`；任何一步失败都**只降级、只记录**；
- 记录必须落在**事后能从磁盘读回来**的地方。渲染进程里唯一的选择是
  `localStorage`——crash log 只保留 **error 级** renderer console，
  cordis 的 fiber 告警**抓不到**；
- 同时 `console.error` 一份，便于当场排查；
- 提供读取工具，让用户/维护者能一句话拿到报告。本仓库：

  ```sh
  ~/.dsh/bin/dsh-boot-report --list-keys
  ~/.dsh/bin/dsh-boot-report --key odp     # 退出码 0=ok，2=有失败步骤
  ```

  报告形如（真实输出，`HANDOFF` 第 6 节）：

  ```json
  {
    "at": "2026-10-15T11:00:23.606Z",
    "ok": true,
    "context": { "plugin": "dsh-opendesign-usage", "href": "dsh-app://app/" },
    "failures": []
  }
  ```

- 用户可见的降级也要露出：本插件把降级详情逐条列在设置页顶部（`settings.bootFailed`），
  而不是只写进 console 让用户永远看不到。

实现模板：`src/boot-diagnostics.js`（`guardStep` / `recordFailure` / `writeBootReport`），
另一个可直接抄的版本在 `~/Projects/dsh-enhanced-prompt-editor/src/boot-diagnostics.js`。

### 配套自动化（必做）

断言 `apply` 在下列恶劣输入下**都不得外抛**：

- 服务全抛错；
- 空 `ctx`；
- 拿不到 react。

本仓库见 `test/inject-coverage.test.mjs`。

---

## 3. `require` 的边界：只有 seed 表 9 个模块

> ⚠️ **本节在 2026-10-16 被修正过。** 旧版本写的是「禁止 `require` 任何 Harness Client 包，
> 只能抄 markup/CSS」，**那个结论是错的**（把白屏事故归错了因）。见下面「旧结论错在哪」。

### 唯一红线：seed 表 9 个模块

前端 boot 的 seed 表（`dsh-web-frontend` 的 `index-*.js` 里 `function gM()`）被传给
`__ModuleLoader__.create({ staticModules: gM() })`，内容**恰好**是这 9 个：

```js
react
react/jsx-runtime
react-dom
react-dom/client
@deepseek-ai/cordis
@deepseek-ai/dsh-client-store
@deepseek-ai/dsh-client-ui-slots
@deepseek-ai/dsh-client-ui-primitives
@deepseek-ai/dsh-client-ui-dockkit
```

**这 9 个之外的 `@deepseek-ai/*` 一律不可 require** —— 它们不在冻结表里，
`makeRequire` 找不到就抛错。这 9 个由 `assertBundleShape()` 在**构建期**强制（§5）。

### 旧结论错在哪

旧版本引用官方 `references/practices.md`「UI」节，定下「禁止 require 任何 Harness Client 包、
把 markup/CSS 抄进插件」。那段原文确实存在：

> Do not `require('@deepseek-ai/dsh-client-ui-primitives')` or load any other
> Harness Client package as a module …

但它**不是**"技术上不可行"的依据：

1. 它是**面向独立第三方包的跨版本风险警告** —— 宿主升级后这些包的 props 可能变，
   而纯 JS 插件没有类型检查兜底。用户已明确接受这个风险，换取与宿主一致的体验。
2. **官方自己 9/10 个配置页都 require 它**（实测内核）：`settings-subagent`、`settings-account`、
   `settings-general`、`settings-models`、`settings-session-log`、`settings-plugin-inventory`、
   `settings-agent-loop`、`settings-shell`、`settings-web-search` 全都 require 了 primitives。
   把内核里所有官方 `dsh-client-*` 插件的 require 去重后，**越界 0 个**。
3. `primitives` **在** seed 表里，`require` 必定成功。
4. 本项目两次白屏的真实根因是**漏声明 `inject` 服务名**（§1），与 require primitives 无关。

→ **结论：用 `dsh-client-ui-primitives` 拼 UI，别自己抄。** 完整规范见
[`docs/design-guidelines.md`](design-guidelines.md) §0。

### `dsh.client.external` 的真实语义

- **只**用于**非本包 `./client` 分块**的运行时 import；seed 表里的模块不需要、
  也不应该列进去（声明了反而会触发"必须找到提供方"的校验）；
- 宿主**只读 `package.json`，从不扫 bundle 文本**。已在 asar 源码确认：

  ```js
  external: decl.external ?? [],
  ```

  即 crate-level 事实：**`row.external` 只来自 `dsh.client.external`**；
- 所以**不要相信**「注释里的 `require` 字面量会被扫描」这类说法 —— 它不成立。

### 不要把 react 从 `ctx` 上取

react 要从 **bundle 外壳的 `require`** 取（`factory: (require) => …`，
见 `src/build-client.mjs` 的 `__dshExternal`），**不是**从 `ctx` 上取（§4）。
`ctx.import` / `ctx.require` 不存在 —— cordis 里没有这两个方法，
全 asar 里也没有任何官方客户端插件用它们。

### 配套自动化（必做）

构建期就把坏产物拦下，见 §5。

---

## 4. react 的正确取法（惰性取也要走对通道）

### 现象

`loadReact()` 走 `ctx.import ?? ctx.require ?? globalThis.__DSH_IMPORT__`，
异常被 `try/catch` 吞掉后 `apply` 直接 `return` → 两个表面都不注册。
用户侧表现是「插件装了但什么都没发生」，**没有白屏，所以更隐蔽**。

### 机制

见 §1：`ctx.import` 抛 `cannot get property "import" without inject`，
被吞掉 → `loadReact` 返回 `undefined` → `apply` 打一行 warn 后 `return`。

### 正确做法

react 从 **bundle 外壳的 `require('react')`** 取（`src/client.js` 的 `loadReact()`）。
需要「`src/` 能被 Node 直接 `import()`」（本项目 node_modules 里没有 react）时，
可以保留**函数内惰性取**的形状，但**通道必须换对**。

---

## 5. 构建期必须断言产物（本次新增，已验证有效）

### 现象

CSS 模板字符串里的注释写了反引号。产物语法坏掉，真机表现是
**整站白屏 + crash log 只有一行 `dsh-opendesign-usage: import failed`，没有任何堆栈**，
排查成本极高。

### 机制

注释里的反引号**提前闭合了模板字符串**，后续代码被解析成另一个东西，
整个 bundle 变成非法 JS。宿主加载它时只看到「entry 没起来」。

### 正确做法：`assertBundleShape()`

`src/build-client.mjs` 的 `assertBundleShape(code, packageId)` 做两件事：

1. **可解析性**：`new Function(code)`（只编译、不执行）解析产物，
   语法错误立即让**构建失败**，坏产物根本不落盘。实测报错文案：

   ```
   dsh-opendesign-usage: 生成的 bundle 语法非法（真机会表现为整站白屏）：<原始解析错误>
   ```

2. **依赖白名单**：正则扫 `require('...')`，只允许 baseline 名单：

   ```js
   const requested = [...code.matchAll(/require\((['"])([^'"]+)\1\)/g)].map((m) => m[2]);
   const illegal = [...new Set(requested)].filter((n) => !SEED_MODULES.has(n));
   ```

   违规报错：

   ```
   <包名>: bundle 请求了 seed 表之外的模块 <名字>；宿主冻结模块表里没有它，
   真机会在 makeRequire 处抛错并白屏。
   ```

放在构建期而不是只放测试，理由：这两类错误**不是逻辑错误，而是产物层面的结构性损坏**，
而真机加载的正是 `lib/client.js`。

### 立刻可用的硬规矩

> **模板字符串内的注释绝不能出现反引号。**

配套再加一条同源断言（本仓库 `assertBundleMatchesSource()`）：
把 `src/` 重新生成到临时文件与磁盘产物**逐字节比对**——否则「记得先 build」
会变成守卫的隐含前提，而同源漂移的表现是守卫永远报「不同源」，
然后被人当成噪音忽略掉，**那比没有守卫更糟**。

---

## 6. 错误信息解读：别按字面猜（本次血亏）

### 现象

crash log 写着：

```
<包名>: import failed (see console for the import error)
```

但这条**不是**「模块导入失败」的意思，按字面排查会走偏。

### 机制

它在 DSH web boot 源码里是 `fiber === undefined` 且 `importError()` 表里**无记录**时的
**兜底文案**。已在 asar 里逐字确认，完整分支如下：

```js
for (const s of e.loader.entries()) {
  const a = s.options.name;
  if (s.fiber === void 0) {
    const f = n.importError(a);
    o.push(f === void 0
      ? `${a}: import failed (see console for the import error)`
      : `${a}: import failed: ${f.message}`);
    continue;
  }
  const u = F7[s.fiber.state];
  if (u !== "active")
    if (u === "pending") {
      const f = Object.keys(s.fiber.inject).filter((h) => e.get(h) === void 0);
      o.push(`${a}: pending (waiting for service${f.length === 1 ? "" : "s"}: ${f.join(", ") || "unknown"})`);
    } else o.push(`${a}: ${u}`);
}
if (o.length > 0) throw new Error(`web boot: ${String(o.length)} entry/entries did not activate\n${o.join("\n")}`);
```

**逐分支读法**：

| 文案 | 真正的意思 |
|---|---|
| `import failed: <原因>` | 有 importError 记录，`<原因>` 就是真因 |
| `import failed (see console for the import error)` | **兜底**：fiber 不存在，且 importError 表里没记录——**信息量为零** |
| `pending (waiting for service: X)` | 服务 `X` 没到（`inject` 依赖未满足） |
| `failed` / `active` | fiber 状态名本身 |

### 为什么常常拿不到详细原因

`importError` 表**只由 `prefetch()` 写入**（`recordingImportError()` 只在
`prefetch()` 和 `import()` 两条路径上记录）。走 `start()` 路径的 entry
**不经过 `prefetch`**，所以那种情况下**永远拿不到详细原因**——只有那条兜底文案。

### crash log 的限制

crash log 只保留 **error 级** renderer console，**cordis 的 fiber 告警抓不到**。
想看渲染进程的真实报错，要像 §2 那样**自己写 localStorage 诊断**。

### 另一个同样表现的原因

客户端 bundle **语法坏掉**（§5）的表现也是「整站白屏 + `import failed`」，
**没有任何堆栈**。所以：**构建期必须断言产物能被解析**——这一条和「读懂文案」
同等重要，因为两者在用户侧长得一模一样。

---

## 7. Rules of Hooks：host 的 selector hooks 必须顶层无条件调用

### 现象

组件在某些分支下崩溃 / hook 顺序错乱，而代码「看起来是对的」。

### 机制

host 提供的 selector hooks（`useProjection` 等）本质上就是 React hooks，
**必须在组件顶层无条件调用**。放进 `if` / 三元 / 短路表达式里，
条件变化时 hook 调用顺序就变了，违反 Rules of Hooks。

### 正确做法

```js
// ✅ 顶层无条件调用
const selection = useProjection('modelSelection');
const tokenTotals = tokenTotalsOf(useProjection('tokenUsage'));
```

```js
// ❌ 不要写进 if / 三元 / 短路
const selection = enabled ? useProjection('modelSelection') : undefined;
```

本插件实例见 `src/composer-usage.js`：`useProjection('modelSelection')`、
`useProjection('tokenUsage')` 都在组件顶层调用，**条件判断放在取值之后**
（如 `typeof useProjection === 'function' ? useProjection(...) : undefined`
仍然是在顶层求值，只是对「props 里到底有没有这个函数」做保护）。

> 注：`useProjection` 本身是否严格实现为 React hook、以及它在不同 slot props 下
> 是否始终注入，本轮**未验证**。规范要求按 hook 规则写，在任何情形下都不会错。

---

## 8. 插槽（slot）注册规范

### 8.1 `conversation.input.left`

- `kind: 'list'`、`scope: 'session'`；
- 由 `conversation.composer.bar` **声明**（slot 必须由父条目显式声明才能注册）；
- **list 槽必须自己提供 `id`**——不提供会顶掉/冲突已有控件。

本插件用 `dsh-opendesign-usage-usage` 作为自己的 id。

### 8.2 渲染期抛错 = 该条目**永久**失效

渲染期抛错 → `SlotErrorBoundary` 接管 → 该条目 `abdicated`，而且是**永久**的。
这与 §3 里官方那句 `a throwing component blanks your slot entry` 是同一件事的两种表述。
所以：

- 组件内部该守卫的地方自己守卫，不要指望框架兜；
- 组件渲染路径上不要做可能抛错的同步 IO / 断言。

### 8.3 `settings.section`

- 是 `list` / root；
- **注册无条件**，用 gate 返回 `null` 决定是否显示。
  即「先注册，后决定显示与否」，而不是「按条件决定注册不注册」。

---

## 9. 禁止用 mock 弥补实现搞错的外部契约

### 现象

「**测试全绿、真机全废**」：测试 95 项全过，真机上插件什么都没注册。

### 机制

`test/client.test.mjs` 的 `makeCtx()` 里有这一行：

```js
import: (name) => { if (name === 'react') return react; /* … */ },
```

测试**自己塞了一个假通道**，把生产里根本不存在的东西补上了。
于是测试测的是「一个不存在的契约」，实现搞错了它，测试也发现不了。

### 正确做法

- 接线层要测**真实** `lib/client.js`，不是 `src/`；
- 自己搭 `window.__ModuleLoader__` + `require` 桩，让 react 走**生产那条
  `require('react')`**；
- `npm test` **先重建 bundle** 再跑，保证测的是当前产物。

本仓库实现：`test/helpers/load-client.mjs`（装载真实 bundle），
`package.json` 的 `"test": "node src/build-client.mjs && node --test test/*.test.mjs"`。

---

## 10. 验证方法：改完不用重启（但有边界）

### 10.1 流程

1. 改 `src/` → `npm run build`；
2. 同步到 `~/.dsh/profiles/<profile>/node_modules/<包名>/`
   （`file:` 依赖是硬链接快照，`cp -p` 覆盖即可）；
3. 等约 30 秒，读该插件的启动报告确认 `ok: true`：

   ```sh
   ~/.dsh/bin/dsh-boot-report --key odp
   ```

### 10.2 什么时候会实时重载，什么时候必须重启

| 改了什么 | 是否需要重启 |
|---|---|
| **客户端 bundle** | 不需要，DSH 会实时重载（实测约 30–90 秒；`HANDOFF` 记的是约 1–2 分钟） |
| **host 代码 `src/index.js`** | **需要**——host 代码不重载 |
| `dsh.profile.bundles` | **需要** |

> ⚠️ 两处记录的实时重载延迟不完全一致（30–90 秒 vs 1–2 分钟），
> 属于观测窗口差异，**都以「等到报告 `ok: true` 为止」为准**，不要按秒数硬等。

### 10.3 只在改 `dsh.profile.bundles` 时才需要用户重启应用

其余情况自己等重载即可，**不要**让用户反复重启。

---

## 11. pnpm 与脚本：两个静默失效陷阱

### 11.1 `file:` 依赖是**硬链接快照**

- 原子替换源文件（很多编辑器/构建工具的默认保存方式）会让硬链接**脱钩**，
  你改了源、profile 里还是旧文件；
- 正确做法：

  ```sh
  rm -rf node_modules/<包名> && pnpm install
  ```

  简单覆盖用 `cp -p` 也可以，但源文件被**原子替换**后必须走上面这条。

### 11.2 装 hooks 的脚本绝不能静默改宿主配置

`scripts/enable-hooks.mjs` 这类脚本必须：

1. **先确认自己是仓库根**：用 `realpathSync` 比对 `git rev-parse --show-toplevel`；
2. **绝不覆盖已存在的 `core.hooksPath`**——否则会把宿主的 hooks **静默关掉**。

本插件实例见 `scripts/enable-hooks.mjs`，以及 `package.json` 里那段刻意留下的注释：

```
"//prepare-fail": "失败时**必须出声**：静默 || true 会让用户以为闸门已在，实际没有"
```

---

## 11.5 `dsh.client.immediately`：第三方插件的加载是**惰性**的（2026-10-15 实战）

### 现象

刷新页面时**偶发**（不是必现）整站白屏，crash log 是：

```
Error: web boot: 1 entry did not activate
<包名>: import failed (see console for the import error)
```

而**同一个 bundle** 上一次刷新崩、下一次刷新不崩；重启也多半正常。崩溃后约 27ms，
插件自己的启动报告（localStorage）却是 `ok: true, failures: []` —— **`apply` 明明跑成功了**。

### 机制

DSH 把客户端 bundle 分成两个**批次阶段**（`@deepseek-ai/dsh-client-modules` 的 `compose()`）：

```js
const bootstrap   = PARSER_PRELOAD_IDS.map(id => this.table.get(id)).filter(...); // 固定官方清单
const bootstrapIds = new Set(bootstrap.map(r => r.entry.id));
const application = entries.filter(e => !bootstrapIds.has(e.id)).map(...);        // 其余全部
for (const records of partitionComboRecords(bootstrap))   artifacts.push(buildBatch("bootstrap", ...));
for (const records of partitionComboRecords(application)) artifacts.push(buildBatch("application", ...));
```

而 `bootInjections(graph)` 注入到页面头部的行是：

```js
rows.push({ kind: "script-preload", src: batch.url });                       // application：只预取，不执行
rows.push({ kind: "script-src", placement: "head", src: batch.url });        // bootstrap：阻塞执行
```

**结论：`bootstrap` 阶段是阻塞的，`application` 阶段只是 `preload`（拉进 HTTP 缓存，不执行）。**
`PARSER_PRELOAD_IDS` 是官方固定清单 —— **所有第三方插件都在 `application` 阶段**，
它们的 bundle 只在 `entries.start()` 建 entry 之后由 `internal.import` → `arrive()` **惰性加载并执行**。

所以第三方插件的"代码到达"与"entry 创建"是并发的。正常情况 `await loader.await()` 能等到；
压力大/缓存冷时可能赶不上，于是审计看到 `entry.fiber === undefined`。

### 为什么报错文案没有细节

`internal.import` **只有一条**抛出路径不写 `importErrors`：

```js
const row = this.graphRows.get(id);
if (row === void 0) {
  if (this.factories.has(id)) return this.materialize(id).exports;
  throw new Error(`client-modules: cannot resolve "${specifier}" — ... not a row in the boot graph`);
}                                        // ↑ 这条不经过 recordingImportError
return this.recordingImportError(id, async () => { ... });
```

所以"没细节"有两种可能：走了这条路径，或**压根没走到 `internal.import`**（entry 还没被 import）。
web boot 的兜底文案（见 §6）把二者混成一句话。

### 正确做法：声明 `immediately: true`

```json
"dsh": {
  "client": {
    "platform": "web",
    "immediately": true,
    "inject": ["..."]
  }
}
```

`immediately` 的唯一消费者是 web boot 的 `prefetchImmediateTier()`：

```js
async prefetchImmediateTier() {
  await Promise.all(this.manifest.plugins.filter(e => e.immediately)
    .map(e => this.modules.prefetch(e.id).catch(() => {})));
}
```

而它**在 `entries.start()` 之前被 await**：

```js
const a = this.prefetchImmediateTier();
...
await a;                                              // ← 先预取
await fM({ ctx, modules, manifest, ... });            // ← 再建 entry + 审计
```

`prefetch(id)` 会 `arriveGraphRow(row)` → `arrive(row)` → `loadShared(batch.url)`，
**在建 entry 之前就把 factory 注册好**；随后 `internal.import` 直接命中 `factories`/`loadCache`，
**不存在到达竞态**。取不到也只是退化成原来的惰性加载（`.catch(() => {})` 吞掉）。

⚠️ **官方所有客户端包都设了 `immediately: true`**（`dsh-typert`、`dsh-client-modules`、
`dsh-client-locale` 等），而第三方插件普遍不设 —— 这是第三方插件更容易踩到这个竞态的原因。

⚠️ `immediately` 属于 **host 侧读取的 manifest 字段**，改完要**重启应用**才生效
（不是客户端 bundle 那种热重载）。

---

## 12. 发布前 checklist

- [ ] 每个 `ctx.<service>` 都在导出的 `inject` 里；静态守卫双向断言通过；
- [ ] `apply` 在「服务全抛错 / 空 ctx / 拿不到 react」下都不外抛；
- [ ] 产物能被解析、`require` 只出现 baseline 四项、产物与 `src/` 同源；
- [ ] 接线层测的是**真实** `lib/client.js`，没有假通道补契约；
- [ ] host 的 selector hooks 全在组件顶层无条件调用；
- [ ] list 槽提供了自己的 `id`；
- [ ] 真机启动报告 `ok: true`，`failures: []`：

  ```sh
  ~/.dsh/bin/dsh-boot-report --key <别名>
  ```

- [ ] `npm test` 全绿（含静态守卫与真实 bundle 接线层）；
- [ ] `lib/client.js` 是生成物——已 `npm run build` 并一并提交；
- [ ] 若要公开：commit 署名与 AI 声明按 `~/.dsh/AGENTS.md` 的硬性规范走；
      **绝不在任何仓库文件里出现号主的私人邮箱或内网 IP**
      （⚠️ 把反面示例逐字写进文档，本身就是一次泄漏——只写「见 AGENTS.md」，不要抄值）。

---

## 附：本文各条的事实出处

| 结论 | 出处 |
|---|---|
| `ctx` 代理只放行 Context 成员 + `inject` 服务名 | `HANDOFF-inject-and-react-20261015.md` §2；asar `cannot get property "..." without inject` |
| `web boot: N entry did not activate` 与三分支文案 | asar web boot 源码逐字比对（本文 §6） |
| `importError` 只由 `prefetch()` / `import()` 写入 | asar `recordingImportError()` 调用点（本文 §6） |
| `require` 的白名单边界（seed 表 9 模块） | 内核 `dsh-web-frontend` 的 `function gM()` + 官方 `dsh-client-*` 插件 require 去重核对（本文 §3） |
| `external: decl.external ?? []` | asar 客户端 manifest 解析源码 |
| `assertBundleShape()` 两件事与报错文案 | `src/build-client.mjs` 实现 + 实测 |
| 「测试全绿、真机全废」 | `HANDOFF` §2「为什么测试没抓到」 |
| 实时重载边界 | 工作区 `AGENTS.md` + `HANDOFF` §6 |
