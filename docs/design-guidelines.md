# dsh-opendesign-usage —— UI 设计规范

> 本文规范本插件**浏览器侧**的外观与交互。它是
> [`dsh-plugin-standards/docs/UI-STANDARDS.md`](~/Projects/dsh-plugin-standards/docs/UI-STANDARDS.md)
> 在本项目的落地版本，并保留本项目实测得到的补充结论。
>
> ⚠️ **本文在 2026-10-16 被整体重写过。** 旧版本的核心结论
> 「要统一外观就把官方原语的 markup / CSS 抄进插件，不要 `require` 官方包」
> **已被推翻** —— 见 §0「旧结论错在哪」。

---

## 0. 首要原则：用 `dsh-client-ui-primitives`，不要自己写

**DSH 原生组件的唯一共享入口是 `@deepseek-ai/dsh-client-ui-primitives`。**
点击菜单、下拉选择、开关、输入框、弹窗、Tooltip、折叠行、状态点、tabs —— 一律从它取。

官方 README 原文：

> 「在功能包里写控件之前，先查这张表。**插件无法导入另一个插件的组件，因此本包是控件
> 唯一可以共享的地方**：合适的就复用，有意的视觉差异提升成 prop，而不是另起一份拷贝。」

### 为什么（内核事实，不是风格偏好）

1. **它是冻结基座模块，`require` 必定成功。**
   前端 boot 的 seed 表（`dsh-web-frontend` 的 `index-*.js` 里 `function gM()`）：

   ```js
   { react, "react/jsx-runtime", "react-dom", "react-dom/client",
     "@deepseek-ai/cordis", "@deepseek-ai/dsh-client-store",
     "@deepseek-ai/dsh-client-ui-slots",
     "@deepseek-ai/dsh-client-ui-primitives",     // ← 本包
     "@deepseek-ai/dsh-client-ui-dockkit" }
   ```

   它被传给 `__ModuleLoader__.create({ staticModules: gM() })`。
   **这 9 个之外的 `@deepseek-ai/*` 一律不可 require。**

2. **官方自己就是这么做的** —— 内核里 10 个官方 `dsh-client-ui-settings-*` 有 **9 个**
   `require` 了它（唯一的例外 `settings-plugins` 是纯壳、不渲染控件）。
   把内核里所有官方 `dsh-client-*` 插件的 require 去重后，**没有一个落在 seed 表 9 个之外**。

3. **自己抄的组件必然与宿主漂移。** primitives 消费 `--dsw-*` 设计 token，并处理了
   `focusWithoutRing` / `useModalLayer` / `observeComposition`（IME）等细节 ——
   抄一份等于把这些坑重新踩一遍。

### ⚠️ 旧结论错在哪（必须记住，别重蹈）

旧版本引用官方 `references/practices.md`「UI」节的原文：

> *"Do not `require('@deepseek-ai/dsh-client-ui-primitives')` or load any other Harness
> Client package as a module … a throwing component blanks your slot entry."*

并据此定下「抄不要 require」。**那是把白屏事故归错了因。**

- 该原文是**面向独立第三方包的跨版本风险警告**（宿主升级后 props 可能变），
  不是"技术上不可行"。
- 本项目两次白屏的真实根因是**漏声明 `inject` 服务名**
  （`cannot get property "X" without inject` → fiber FAILED → web boot 白屏），
  与 `require` primitives **无关**。详见
  [`docs/plugin-development.md`](plugin-development.md) 的 inject 与启动机制两节。
- 结论：**用 primitives**。唯一的红线是 **seed 表 9 模块白名单**（构建期强制）。

---

## 1. 可用组件一览

来自 primitives 官方 README 的「组件目录」表 —— **该表是 props 的权威来源，用前先查**。

| 类别 | 导出 |
|---|---|
| 操作 | `Button`（`variant`: primary/ghost/outline/toolbar）、`InlineEditor` |
| 选择 | `Switch`（36×20 双态，**`label` 必填**）、`Checkbox`、`SegmentedControl`、`SegmentedTabs` |
| 输入 | `Input`、`SettingsForm`、`SettingsFormModel`、`SettingsValueField`、`SettingsSecretField` |
| 菜单浮层 | `Menu`、`MenuItemButton`、`MenuGroup`、`MenuSurface`、`Tooltip`、`HoverCard`、`Modal`、`RiskConfirmation` |
| 几何 | `useAnchoredPosition`、`useAnchoredMaxHeight`、`useDismissOnOutsidePointer` |
| 展示 | `Pill`、`Tag`、`PathLabel`、`StateDot`、`ConnectionIndicator`、`DisclosureRow`、`TextShimmer` |
| 内容 | `JsonTree`、`JsonBlock`、`MarkdownText`、`CodeBlock`、`CommandText`、`TerminalBlock` |
| 图标 | `icons/*`（Regular/Medium 两种尺寸）、`PermissionIcon*`、`PluginArtwork*`、`GuideArtwork*`、`FileTypeIcon` |
| 其他 | `ImageLightbox`、`Toast`、`ShortcutKeys`、`writeClipboard` |

本插件实际用到的：

| 位置 | 组件 |
|---|---|
| 输入框读数（折叠态） | `Button`（圆钮）+ 内部 `span` 结构 |
| 读数展开面板 | `MenuSurface`（材质）+ `useAnchoredPosition`（定位）+ `useDismissOnOutsidePointer`（收起） |
| 插件详情页设置卡片 | `SettingsForm` + `SettingsFormModel` + `SettingsValueField` + `SettingsSecretField` + `Switch` |

> **读数不要用 `Pill`**：`Pill` 是可选中胶囊（视图切换/筛选器语义），
> 而读数是一个"点开看明细"的操作，`Button` 语义正确。

### 不要套 `Menu` 装只读信息

`Menu` 的每一行都是 `<button role="menuitem">` —— **可点选项**语义。
把额度百分比、倒计时这类**只读信息**套进 `Menu`，会渲染成"点了会做某事"的假按钮，
语义与无障碍都不对。

正确做法是取 **`MenuSurface`（材质层）** 自己排只读行。官方文档明确材质是共享的：

> 「菜单采用共享 `MenuSurface` 材质，包括用于背景模糊的 macOS 底层；自定义内容遵循菜单规则。」

---

## 2. 只用设计 token，不写死颜色

- 颜色、圆角、阴影、边框一律走 `--dsw-*` 变量（`--dsw-alias-*`、`--dsw-specific-menu`、
  `--dsw-radius-*` 等）。**字面颜色只允许出现在 `var()` 的 fallback 位置**。
- 每个 token **都要带 fallback**：`var(--dsw-alias-label-secondary, currentColor)`。
  宿主改名某个 token 时，最坏结果是外观降级，**永远不是渲染失败**。
- 改用 primitives 之后，自写 CSS 应只剩**布局**（间距、栅格、`flex`），
  不该再出现材质与配色。

---

## 3. 类名一律带插件前缀

自写类名一律 `dsh-odu-` 前缀。这一条**即使不再抄官方组件也仍适用** ——
避免与宿主或其他插件的类名相撞。

---

## 4. 交互行为跟宿主一致

用 primitives 就自动拿到了宿主的行为约定，这也是不用自己写的主要理由之一：

- **Modal**：焦点管理与 Escape 关闭
- **`Switch`**：`role="switch"` + `aria-checked`
- **`Tooltip`**：放置与延迟
- **`Menu` / `MenuSurface`**：只认 `pointerdown` 的「点外部关闭」、键盘走位、焦点归还

本插件自有的一条补充：**读数用点击展开，不用 hover。**
理由是与 DSH 的 model 选择单、权限选择单**行为一致** —— 悬停与点击给出两套交互，
用户会觉得"这个控件不是这家的"。

---

## 5. 布局与密度

- 工具行那格宽度有限：**常驻读数要尽可能短**。本插件的取舍是
  只留两个额度窗口（`OD · 65% · 88%`），钱包、token、倒计时全部放进展开面板。
- 间距、字号、行模式从**同类型的宿主页面**取（管理列表参照 Plugin Manager 页）。
- 工具行那排是 `display:flex` 且子元素有 `min-width:0`；
  **自有控件只要 `flex:none` 就拿到固有宽度** —— 不需要也不应该去改别人的样式。

---

## 6. 文案全走 locale

```js
ctx.locale.register(NS, { zh, en });
const t = ctx.locale.bind(NS);
t('usage.label')     // ✅
'用量'                // ❌
```

中英键必须 **1:1 对齐**（`test/client.test.mjs` 里有断言）。
`locale` 必须在导出的 `inject` 里声明。

---

## 7. 渲染期绝不允许抛错

`ui-renderer` 给每个插槽条目套 `SlotErrorBoundary`，捕获后调
`reportEntryError(..., { abdicate: true })`，条目进 `abdicated` 弱集后
**`entriesOfSlot` 从此永久跳过它**。

症状是"装了别的插件之后本插件的控件不见了"，很容易错归因成"插槽被挤"。

最容易破功的两处：

1. **样式注入** —— 把 `document` 当不可信输入，全包 try/catch：

   ```js
   // ❌ 一旦 head 被冻结 / document 被改写，整个插槽条目被永久撤销
   function ensureCss() { document.head.appendChild(document.createElement('style')); }

   // ✅ 返回 false 表示降级，且不在 catch 里 rethrow
   function ensureCss(css) { try { /* ... */ return true; } catch { return false; } }
   ```

2. **primitives 组件拿到不完整 props** —— 所有可能为空的（`t`、`scope`、`flagsStore`、
   `bootFailures`）都要有兜底。

### Rules of Hooks

所有 hook 必须在组件**顶层无条件**调用，**必须排在提前 `return` 之前**。

本项目实际踩过：`useCallback` 曾写在 `if (...) return null` 之后 ——
`planOn` 变化时 hook 数量改变 → React 抛「Rendered more hooks than during the previous render」
→ 组件渲染失败 → **表现是"读数在，但点击毫无反应"**，而 `apply` 仍是 `ok: true`，日志里看不出来。

---

## 8. 分层：Host 半侧 vs 浏览器半侧

| 放哪 | 内容 |
|---|---|
| Host（`src/index.js`） | 配置读取、上游 HTTP、`/plugins/<包名>/*` 路由 |
| 浏览器（`lib/client.js`） | 只用 `primitives` + `react` 渲染 UI |

- **客户端包不得依赖 Host 包**（官方注释：*"a client package must not depend on a Host package."*）。
  命名空间用字符串字面量，不要 import。
- 客户端要数据 → 打自建 Host 路由（本插件是 `GET /plugins/dsh-opendesign-usage/plan-usage`），
  **不要**在客户端直接读文件。

---

## 9. 验收清单

- [ ] 客户端 `require` 只出现 **seed 表 9 个模块**（`assertBundleShape()` 构建期强制）
- [ ] 控件、菜单、开关、输入框、按钮、Tooltip **全部来自 `primitives`**，无自写 SVG / dropdown / 开关
- [ ] 只读信息**没有**被套进 `Menu`
- [ ] 设置注册在 **`plugins.bundle.config`**（key = 插件包名）—— 那是**插件详情页**的配置区；
      不在 `settings.section`，也不在 `plugins.item`（后者是「内置插件配置」分组，只给**官方插件**用）
- [ ] 自写类名都有插件前缀；颜色/圆角/阴影全走 `--dsw-*` 且都带 fallback
- [ ] 所有 `document` 操作包在 try/catch 里，不 rethrow
- [ ] 所有 hook 在顶层、且在提前 `return` 之前
- [ ] 文案全走 `ctx.locale`，中英键 1:1
- [ ] 渲染期不抛错（primitives 组件的不完整 props 已兜底）

---

## 10. 反面模板（本项目真实发生过的）

| 做法 | 后果 |
|---|---|
| 自己写开关 / 输入框 / 弹层 | 与宿主外观漂移；用户反馈「样式不统一」 |
| 把手写定位 hook 当"抄过来的"资产留着 | 官方 `useAnchoredPosition` 签名其实**完全一致** —— 白维护了一份，还少了 `overlayTopMargin` 等细节 |
| 面板内联渲染 + `position:fixed` | 被 composer 工具行的祖先裁掉 → **面板"打开了"但看不见**（改成 `createPortal` 到 `document.body` 后正常） |
| 触发控件用 `<div role="button">` | 真实宿主里点击无响应（改成真 `<button type="button">` 后正常） |
| 在 `onMouseDown` 里 `preventDefault()` | 干扰宿主的点击派发 |
| 在提前 `return` 之后调 hook | 组件渲染失败 → 点击无反应，且日志无痕 |
| 模板字符串**内部**的注释写反引号 | 提前闭合字符串 → 产物语法坏 → 真机白屏无堆栈（构建期守卫已拦） |

---

## 11. 权威来源

| 想要什么 | 去哪里 |
|---|---|
| UI 规范全文（含内核源码依据） | `~/Projects/dsh-plugin-standards/docs/UI-STANDARDS.md` |
| primitives 的组件目录与 props | 内核 `dsh-client-ui-primitives/README.zh.md` |
| 官方设置卡片范式 | 内核 `dsh-client-ui-settings-subagent/lib/client.js` |
| 组合包级配置卡片 | 本机 `dsh-connect-workbuddy/lib/client.js` |
| 插槽名与 kind 权威列表 | 内核 `dsh-client-ui-plugin-manager/lib/client.js` 的 `slots.register({name:"main",...})` 的 `children` |
| 插件开发规范（注入/守卫/调试） | [`docs/plugin-development.md`](plugin-development.md) |
