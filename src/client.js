/**
 * dsh-opendesign-usage —— 浏览器侧入口。
 *
 * 注册两个表面：
 *
 *  1. **`conversation.input.left`** —— 输入框工具行的只读用量控件，随会话的
 *     provider 选择由 gate 决定是否渲染；
 *  2. **`plugins.item`** —— 「插件」侧栏页里本插件条目下的配置卡片
 *     （新规范：插件自己的设置**不放** `settings.section`，见 `UI-STANDARDS.md` §0.2）。
 *
 * 控件的渲染数据由三样东西组成：
 *
 *  1. **locale**：本插件的文案命名空间（中英 1:1）；
 *  2. **flagsStore**：三个功能开关的本地即时镜像 —— 配置卡片写它、控件订阅它，
 *     因此用户在插件页里一改，输入框控件立刻重渲染，不必等下一次网络刷新
 *     （这是 workbuddy 4.3.0「设置页改了没用」缺陷的直接对策）；
 *  3. **settings**：当前设置文档的只读视图，控件只从中取 `refreshIntervalMs`。
 *
 * 注册是**无条件**的：gate 自己读 `modelSelection` 决定是否渲染。条件注册会
 * 在 provider 切换时留下一个空位（注册表按 id 记账，撤掉再注册有竞态），而
 * 无条件注册 + `return null` 是零成本的。
 *
 * ⚠️ **两条硬性规矩（2026-10-15 实测事故后补）**：
 *
 *  1. **`apply` 绝不允许把异常抛出去。** DSH 的 web boot 把每个客户端插件的 fiber
 *     当成必须 ACTIVE 的条目，`apply` 抛错 → fiber FAILED → 整页白屏，而日志只有
 *     一行 `<包名>: failed`。每一步都各自守卫（见 `./boot-diagnostics.js`）。
 *  2. **`ctx.<service>` 只放行本文导出的 `inject` 里声明过的服务名。** package.json
 *     的 `dsh.client.inject` 只管**模块加载顺序**，不管服务访问权限；漏声明的服务
 *     读一下就抛 `cannot get property "X" without inject`。需要"可能不存在"的服务时
 *     用 `ctx.get('name')`（Context 自带方法，不受这道闸限制）。
 *
 * @module dsh-opendesign-usage/client
 */
import {
  COMPOSER_SLOT_ID,
  COMPOSER_SLOT_ORDER,
  PLUGIN_DETAIL_CONFIG_KEY,
  PLUGIN_DETAIL_CONFIG_SLOT,
  PLUGIN_ID,
  SETTINGS_NAMESPACE,
  SETTINGS_SLOT_ORDER,
} from './constants.js';
import { createFlagsStore, resolveFlags } from './flags-store.js';
import { createLocale } from './locale.js';
import { UsageGate, bindPrimitives, bindReact, bindReactDom } from './composer-usage.js';
import { SettingsCard, bindPrimitives as bindCardPrimitives, bindReact as bindCardReact } from './plugin-settings-card.js';
import { guardStep, recordFailure, writeBootReport } from './boot-diagnostics.js';

export const name = PLUGIN_ID;

/**
 * 必需服务：缺任何一个 cordis 都不会 activate 本插件，因此由这一行保证服务就绪。
 *
 * ⚠️ 必须与 `apply` 里真正用到的 `ctx.*` 服务一一对应（`test/inject-coverage.test.mjs`
 * 会静态断言这一点，且反向断言没有无用项）。
 *
 * `configForms` 是 2026-10-16 重构后**新增**的：设置卡片改为注册进 `plugins.item`
 * 后，官方范式（内核 `dsh-client-ui-settings-subagent`，`inject` =
 * `["slots","locale","remote","remote.session","configForms"]`）要求用
 * `ctx.configForms.whileServed(...)` 跟随命名空间的上线/下线边沿 ——
 * 那是"读服务属性"，不写进 `inject` 会同步抛 `cannot get property "configForms" without inject`。
 *
 * 同时**保留** `apply` 内部的 `ctx.get?.('configForms')` 能力探测（见 `settings` 包装）：
 * 声明只保证"服务在时我们 activate"，`ctx.get` 负责"服务不在时降级不抛"（UI-STANDARDS §3.2）。
 */
export const inject = ['slots', 'locale', 'configForms'];

/**
 * 取宿主冻结基座表里的 react。
 *
 * **为什么不用 `ctx.import` / `ctx.require`**（旧实现的缺陷）：这两个名字既不是
 * Context 自带成员，也不是本插件声明的服务，读它会抛
 * `cannot get property "import" without inject`。旧代码把它塞在 try/catch 里，
 * 异常被吞掉后 `apply` 直接 `return` —— **控件与设置页都不注册**，日志里只有一行
 * warn，表现得像"插件装了但什么都没发生"。
 *
 * 正确通道是 bundle 外壳的 `require`（就是宿主那张 `staticModules` 基座表，
 * 含 `react` / `react/jsx-runtime` / `react-dom/client` / `@deepseek-ai/cordis`
 * 等）。官方客户端插件一律用静态 `import ... from 'react'`，由模块系统解析到同一张表；
 * 本项目要求 `src/` 下的模块能被 Node 直接 `import()` 冒烟测试（node_modules 里没有
 * react），所以把顶层 import 换成函数内的惰性 `require` —— 见 `build-client.mjs` 里
 * `factory: (require) => ...` 与 `__dshExternal(name) { return require(name) }`。
 *
 * @returns react 模块，取不到时返回 undefined（调用方降级，绝不抛错）。
 */
function loadReact() {
  try {
    // bundle 里 `require` 是外壳 factory 的形参；Node 里它不存在，
    // 对未声明标识符用 typeof 是安全的。
    if (typeof require !== 'function') return undefined;
    const module_ = require('react');
    if (module_ === null || module_ === undefined) return undefined;
    return module_.default ?? module_;
  } catch (error) {
    console.error(`[${PLUGIN_ID}] 取宿主基座表里的 react 失败：`, error);
    return undefined;
  }
}

/**
 * 取宿主冻结基座表里的 react-dom（**只为 `createPortal`**）。
 *
 * ⚠️ 与 react 同样走函数内惰性 `require`：`react-dom` 在冻结基座表里（baseline），
 * 但顶层 `import` 会让本模块在 Node 里直接求值失败（纯逻辑测试跑不了）。
 *
 * ⚠️ **可选能力**：取不到时只记一条并继续 —— `UsagePanel` 会退回内联渲染，
 * 控件本身照常可用。绝不因为拿不到它而让整个插件不注册。
 *
 * @returns react-dom 模块，取不到时返回 undefined（调用方降级，绝不抛错）。
 */
function loadReactDom() {
  try {
    if (typeof require !== 'function') return undefined;
    const module_ = require('react-dom');
    if (module_ === null || module_ === undefined) return undefined;
    return module_.default ?? module_;
  } catch (error) {
    console.error(`[${PLUGIN_ID}] 取宿主基座表里的 react-dom 失败（面板将退回内联渲染）：`, error);
    return undefined;
  }
}

/**
 * 取宿主冻结基座表里的 UI 原语 `@deepseek-ai/dsh-client-ui-primitives`。
 *
 * 它在 seed 表（`gM()`）里，所以生产路径上 `require` 必定成功。
 * 拿到它，本插件的控件（读数按钮、展开面板、设置卡片）就与宿主**共用同一套组件与
 * `--dsw-*` token**，不会随宿主升级而漂移 —— 这是 `UI-STANDARDS.md` §0.1 的硬要求。
 *
 * ⚠️ 顶层**绝不** `require`：本模块要被 Node `import()` 做纯逻辑测试，顶层 require 会
 * 直接求值失败。所以做成函数内惰性取。
 *
 * ⚠️ **可选能力**：取不到时 `composer-usage.js` / `plugin-settings-card.js` 各自退化成
 * 原生元素，功能不减、只是外观可能与宿主不一致。**绝不因为拿不到它而让插件不注册。**
 *
 * @returns 原语模块，取不到时返回 undefined（调用方降级，绝不抛错）。
 */
function loadPrimitives() {
  try {
    if (typeof require !== 'function') return undefined;
    const module_ = require('@deepseek-ai/dsh-client-ui-primitives');
    if (module_ === null || module_ === undefined) return undefined;
    return module_.default ?? module_;
  } catch (error) {
    console.error(`[${PLUGIN_ID}] 取宿主基座表里的 UI 原语失败（控件将退回原生元素）：`, error);
    return undefined;
  }
}

/** 注册全部表面。**无论内部出什么错，本函数都不会向外抛异常。** */
export function apply(ctx) {
  const failures = [];
  try {
    applySources(ctx, failures);
  } catch (error) {
    guardStep(failures, 'apply', () => {
      throw error;
    });
  } finally {
    guardStep(failures, 'report', () =>
      writeBootReport(failures, {
        plugin: PLUGIN_ID,
        href: typeof globalThis.location?.href === 'string' ? globalThis.location.href : '',
      }),
    );
  }
}

/**
 * 逐个注册各表面。
 *
 * @param ctx 客户端上下文。
 * @param failures 失败记录收集数组。
 */
function applySources(ctx, failures) {
  /* ── 0. 文案 ─────────────────────────────────────────────────────── */
  const localT = (() => {
    const dict = createLocale().zh;
    return (key, params) => {
      const template = typeof dict?.[key] === 'string' ? dict[key] : key;
      if (params === undefined) return template;
      return template.replace(/\{(\w+)\}/g, (match, name) => (name in params ? String(params[name]) : match));
    };
  })();

  const t =
    guardStep(failures, 'locale', () => {
      ctx.effect(() => ctx.locale.register(PLUGIN_ID, createLocale()), `${PLUGIN_ID}: copy`);
      return ctx.locale.bind(PLUGIN_ID);
    }) ?? localT;

  /* ── 1. react（取不到就整体降级，但要说清楚为什么） ──────────────── */
  const react = guardStep(failures, 'react', loadReact);
  if (react === undefined || typeof react.createElement !== 'function') {
    recordFailure(failures, 'react:unavailable', new Error('宿主基座表里取不到 react（typeof require 不是函数，或取 react 没返回模块）'));
    console.warn(`[${PLUGIN_ID}] 取不到 react，输入框用量控件与设置页都不会注册。`);
    return;
  }
  bindReact(react);
  // 三个模块各自持有自己的 react 引用（都走函数内惰性 `require`，避免顶层 import
  // 让纯逻辑测试跑不起来），因此必须**分别绑定**：
  // 只绑一个会让另一个在渲染时抛「react 尚未就绪」。
  //   - `composer-usage.js` → 输入框用量控件
  //   - `plugin-settings-card.js` → 插件详情页配置卡片
  bindCardReact(react);

  /* ── 1b. react-dom（**必需**：面板靠它的 `createPortal` 才能渲染） ────
   *
   * ⚠️⚠️ 这一行曾经丢失，导致一个非常隐蔽的缺陷（2026-10-16 实测）：
   * `loadReactDom()` 定义了却从没被调用 → `reactDom` 恒为 undefined →
   * `UsageReadout` 里 `typeof reactDom?.createPortal === 'function'` 恒为 false →
   * **面板的分支永远返回 null，面板根本不渲染**。
   * 用户侧看到的现象是"点击没反应"（其实点击事件到了、`open` 也翻转了，
   * 只是没有任何东西被画出来）。
   *
   * 取证过程：诊断里 `portalUsable: false / hasReactDom: false` 直接指出了它。
   * 所以这里**不**把它当可选能力 —— `react-dom` 在前端 boot 的 seed 表里
   * （`gM()` 含 `react-dom` 与 `react-dom/client`），生产路径上 `require` 必定成功。
   * 取不到时记一条 failure（那是真故障，不是可接受的降级）。
   */
  const reactDom = guardStep(failures, 'react-dom', loadReactDom);
  bindReactDom(reactDom);
  if (reactDom === undefined || typeof reactDom.createPortal !== 'function') {
    recordFailure(
      failures,
      'react-dom:unavailable',
      new Error('取不到 react-dom（面板的 createPortal 依赖它，展开面板将无法渲染）'),
    );
  }

  /* ── 1c. UI 原语（可选能力：取不到就退化成原生元素，不记 failure） ────
   *
   * `@deepseek-ai/dsh-client-ui-primitives` 在前端 boot 的 seed 表里（`gM()`），
   * 所以生产路径上 `require` 必定成功；但在**纯逻辑测试**与极端降级场景下可能没有，
   * 而控件此时应当仍然可用（只是外观退回原生元素）。
   * 因此这里走 `guardStep` 但**不把失败写进 failures** —— 那会让卡片显示假的"启动降级"提示。
   */
  const primitives = loadPrimitives();
  bindPrimitives(primitives);
  bindCardPrimitives(primitives);
  if (primitives === undefined) {
    console.warn(`[${PLUGIN_ID}] 取不到 UI 原语，控件与配置卡片退回原生元素（外观可能与宿主不一致）。`);
  }

  /* ── 2. 开关的本地镜像 ───────────────────────────────────────────── */
  /**
   * 用 `defaultSettings()` 的语义初始化（缺字段一律视为开启）。随后的真值来自
   * 两条路径：设置页写入（即时）与宿主 `/plan-usage` 响应里的 `flags`（冷启动
   * 兜底）。两条路径共用同一个 store，因此不存在「本地值」与「宿主值」两个真相。
   */
  const flagsStore = guardStep(failures, 'flags-store', () =>
    createFlagsStore(resolveFlags(undefined, undefined)),
  );
  if (flagsStore === undefined) {
    // 后面的表面都要用这个 store，没有它就别硬撑出半成品注册。
    return;
  }

  /* ── 3. 设置文档的只读视图 ───────────────────────────────────────── */
  /**
   * 供控件读 `refreshIntervalMs`。
   *
   * 刻意做成薄包装：设置作用域由异步的 `settings.describe()` 填充，`apply` 时
   * 通常还没有本插件的命名空间。这里不强绑，控件每次渲染现读，晚到的命名空间
   * 自然被下一次渲染看到（不会像 workbuddy 4.3.0 那样「启动读一次、之后再不读」）。
   *
   * ⚠️ 用 `ctx.get('configForms')` 而**不是** `ctx.configForms`：后者是要声明进
   * `inject` 的服务，未声明时读它直接抛；而 `configForms` 本来就"可能还没到"，
   * 不该把它变成必需依赖。
   */
  const settings = {
    getSnapshot: () => {
      try {
        const forms = ctx.get?.('configForms');
        const scope = forms?.get?.(PLUGIN_ID);
        const raw = scope?.getSnapshot?.().value ?? scope?.get?.() ?? scope?.value;
        return raw !== null && typeof raw === 'object' ? raw : undefined;
      } catch {
        return undefined;
      }
    },
  };

  const face = () => ({ t, flagsStore, settings, bootFailures: failures });

  /* ── 4. 输入框工具行的只读用量控件 ───────────────────────────────── */
  guardStep(failures, 'composer-control', () => {
    ctx.slots.inject('conversation.input.left', () =>
      ctx.slots.register(
        {
          name: 'conversation.input.left',
          id: COMPOSER_SLOT_ID,
          order: COMPOSER_SLOT_ORDER,
          locale: PLUGIN_ID,
          inject: face,
        },
        UsageGate,
      ),
    );
  });

  /* ── 5. 插件详情页的配置卡片（`plugins.item`） ─────────────────────
   *
   * ⚠️ 2026-10-16 重构：**不再注册 `settings.section`**。新规范
   * （`UI-STANDARDS.md` §0.2）要求插件配置放在「插件」侧栏页里自己的条目下，
   * 「设置」总页只保留只读的插件列表。`plugins.item` 是 plugin-manager 声明的
   * list/root 子插槽（权威列表见 `README.zh.md`）。
   *
   * 注册结构逐字照抄内核官方实现 `dsh-client-ui-settings-subagent/lib/client.js`
   * （line 839-847）：
   *
   *   ctx.effect(() => ctx.configForms.whileServed([NS], () => ctx.slots.inject(...)), "...")
   *
   * ⚠️ `whileServed` 是关键，不能省：设置命名空间由 Host 异步 serve，
   * 可能晚于 `apply` 到达，也可能中途下线。`apply` 时读一次快照会得到"命名空间未就绪"
   * 的默认值，且**永不更新** —— 这正是 `dsh-connect-workbuddy` 4.3.0「设置页改了没用」
   * 的形状。`whileServed` 跟随上线/下线边沿，重新注册/撤销。
   *
   * 这里同时用 `ctx.configForms`（声明式读取）与 `ctx.get?.('configForms')`（能力探测兜底）：
   * 声明进 `inject` 保证"服务在时才 activate"，`ctx.get` 保证"声明与服务万一不同步时
   * 降级不抛"（UI-STANDARDS §3.2）。两者并存，缺一不可。
   *
   * `ctx` 一并传给卡片：它要写字段（设置表单作用域）并自己打「测试连接」请求。
   * `flagsStore` 与 `bootFailures` 也照旧传 —— 前者让开关 onChange 零延迟反映到
   * 输入框控件，后者让"启动降级"在界面上如实说出来。
   */
  guardStep(failures, 'settings-card', () => {
    // ① 声明式读取：`configForms` 已在导出的 inject 里，服务在时这条必定成功。
    //    用 try/catch 静默兜底 —— 服务缺席是**合法降级路径**，不是一步失败，
    //    不该在启动报告里留下一条会让卡片显示"降级提示"的假故障。
    // ② `ctx.get` 是 Context 自带方法、不受 inject 闸限制，二次兜底拿不到也不抛。
    const forms = (() => {
      try {
        return ctx.configForms;
      } catch {
        return undefined;
      }
    })() ?? ctx.get?.('configForms');
    const registerCard = () =>
      ctx.slots.inject(PLUGIN_DETAIL_CONFIG_SLOT, () =>
        ctx.slots.register(
          {
            name: PLUGIN_DETAIL_CONFIG_SLOT,
            // ⚠️ 详情页配置区是 **keyed 槽**，键是「插件包名」（内核传 entryKey: pkg.name），
            // 不是 list 槽的 `id`、也不是行页的 `<包名>#<行 id>`。
            key: PLUGIN_DETAIL_CONFIG_KEY,
            order: SETTINGS_SLOT_ORDER,
            locale: PLUGIN_ID,
            inject: () => ({ ...face(), ctx }),
          },
          SettingsCard,
        ),
      );
    if (typeof forms?.whileServed === 'function') {
      ctx.effect(
        () => forms.whileServed([SETTINGS_NAMESPACE], registerCard),
        `${PLUGIN_ID}: settings card`,
      );
    } else {
      // 服务未就绪：降级为直接注册（卡片自己会用 ctx.get 探测作用域），
      // 至少不让配置入口整个消失。失败原因留在启动报告里。
      recordFailure(
        failures,
        'settings-card:whileServed',
        new Error('configForms 没有 whileServed，降级为直接注册（命名空间边沿可能漏掉）'),
      );
      registerCard();
    }
  });
}
