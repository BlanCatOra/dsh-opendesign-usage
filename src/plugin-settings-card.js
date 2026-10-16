/**
 * dsh-opendesign-usage —— 插件详情页的配置卡片（`plugins.item`）。
 *
 * 这是 `src/settings-section.js`（867 行自写 UI）的替代实现。控件一律取自
 * `@deepseek-ai/dsh-client-ui-primitives`，本文件**不再自绘**开关 / 输入框 /
 * 密码框 / 按钮 / 徽章。规范出处：
 *  - §0.1 控件只能来自 primitives；
 *  - §0.2 插件设置注册到 `plugins.item`（不是 `settings.section`）；
 *  - §1.3 渲染期绝不允许抛错（抛一次插槽条目就被 `SlotErrorBoundary` 永久撤销）。
 *
 * 结构逐字照抄内核官方实现 `dsh-client-ui-settings-subagent/lib/client.js`（已解包在
 * `/tmp/ref/`）：
 *  - `SubagentLimitsCardController`（~line 489）：`new SettingsFormModel(scope, specs, secrets)`
 *    → `.bind(projection)` → `.actions()` → `.dispose()`；
 *  - `SubagentCard`（~line 420）：`SettingsForm({ labels, state, onSave, onDiscard, children })`；
 *  - `SubagentLimitsFields`（~line 121）：`SettingsValueField` 的完整 props 用法；
 *  - `limitField(field, min)`（~line 471）：数值字段的区间校验写法（本文件 `rangeSpec` 同形）；
 *  - `settings-web-search/lib/client.js`：`SettingsSecretField` + 构造函数第 3 参
 *    `secrets: [{ field, write }]` 的写-only 凭据用法。
 *
 * ── 三个 boolean 怎么接 `SettingsFormModel`（**读内核源码确认，不是自创**）──────
 * 官方 `SubagentModelSelectionFields` 的 `Switch`（line 276）绑的是
 * `checked: state.enabled` + `onChange: props.toggleEnabled` —— 一个**独立回调**，
 * 完全不经过 `form.field()`。原因是 primitives 只导出 `settingsTextField` /
 * `settingsNumberField` 两个 spec 工厂，**没有布尔 spec**，所以官方让布尔走自己的
 * draft + 自己的 `scope.mutate`。
 *
 * 本卡片不能照搬这一点：`SettingsForm` 只有**一个**保存按钮，三个开关必须和其它字段
 * 一起保存。若布尔单独 `scope.mutate`，它会推进文档 revision，让同一次保存里
 * `form.save()` 持有的 `baseline.revision` 立即过期（乐观并发 → 保存被拒）。
 * 因此按任务书允许的「`settingsTextField` 的变体」，给布尔写一个**同形状**的 spec
 * （`{ field, format, parse }`）：三个开关与两个输入框于是由 `plan()` 合成**一次**
 * `scope.mutate(ops, revision)`，原子且栅栏正确，`shell().dirty/invalid` 也自动覆盖开关。
 *
 * ── 与旧实现的有意行为变化（`SettingsForm` 契约要求，不是遗漏）──────────────
 *  1. 开关改为**暂存**：拨动只改草稿，点「保存」才写入（旧实现点一下即写）。
 *     保存落地后立刻把三个开关同步进 `flagsStore`，所以输入框控件仍是零延迟反映。
 *  2. 会话凭据走 `secrets`（写-only）：**不回显**已保存的值，空草稿不写（保留旧值）。
 *     旧实现把已保存的 cookie 明文塞进 `type=password` 的 `value` 里回显 —— 屏幕上
 *     被人看到等同于泄露，新行为更安全。
 *     ⚠️ 代价：无法再「清空输入框」来**删除**已保存的 cookie（`plan()` 对空草稿的
 *     secret 不产生任何写入）。这是 primitives 的既有契约，没有自创绕过路径。
 *  3. 「有未保存的改动 / 已保存」两行状态文案由 `SettingsForm` 保存按钮的禁用态取代。
 *  4. 刷新间隔从 range 滑块改为**数值输入框**：primitives 的字段组件只有这一种，
 *     数值区间校验仍在 spec 里（`rangeSpec`），越界即 `invalid`、保存按钮禁用。
 *
 * 接口契约（`client.js` 的 `inject` 提供；每个 prop 都容忍 undefined）：
 *  - `t`           locale 绑定函数；缺失/抛错/键未注册时用本地兜底字典，绝不露键名
 *  - `ctx`         用于 `ctx.get('configForms')` 取设置作用域 + 打「测试连接」请求
 *  - `flagsStore`  三个开关的本地即时镜像（保存成功后同步写它）
 *  - `bootFailures` 启动降级记录数组（非空时如实显示）
 *
 * 本模块**没有顶层 `import react` / `import primitives`**：它要被 Node `import()` 做
 * 纯逻辑冒烟测试，而 Node 没有宿主那条冻结基座表通道，顶层 import 会让整个模块求值
 * 失败（连纯函数都测不到）。因此两者都在函数内惰性 `require`，也支持
 * `bindReact()` / `bindPrimitives()` 显式注入。
 *
 * @module dsh-opendesign-usage/plugin-settings-card
 */

import {
  FIELD_REFRESH_INTERVAL,
  FIELD_SESSION_COOKIE,
  FIELD_WORKSPACE_ID,
  FLAG_COMPOSER_USAGE,
  FLAG_PLAN_QUOTA,
  FLAG_TOKEN_USAGE,
  MAX_REFRESH_INTERVAL_MS,
  MIN_REFRESH_INTERVAL_MS,
  PLUGIN_ID,
  ROUTE_TEST_CONNECTION,
  SETTINGS_NAMESPACE,
  defaultSettings,
  normalizeFlag,
  normalizeSessionCookie,
  normalizeText,
} from './constants.js';
import { createLocale } from './locale.js';

/* ────────────────────────────────────────────────────────────────────────────
 * 本文件**不设**局部文案兜底表。
 *
 * 2026-10-16：重构期间曾有一个 `EXTRA_COPY` 局部表（9 个 `settings.*` 新键），
 * 现已**全部合并进 `src/locale.js`** 的 `SETTINGS_ZH` / `SETTINGS_EN`，
 * 由 `createLocale()` 统一提供 —— 这样中英键 1:1 的对齐由 locale 模块自己保证，
 * 不会出现"卡片里加了键、locale.js 里没有"的漂移。
 * ──────────────────────────────────────────────────────────────────────────── */

/** 三个功能开关的字段名（数组顺序即界面顺序）。 */
const FLAG_FIELDS = [FLAG_COMPOSER_USAGE, FLAG_PLAN_QUOTA, FLAG_TOKEN_USAGE];

/** 每个开关的「标题键 / 说明键」。 */
const FLAG_COPY_KEYS = {
  [FLAG_COMPOSER_USAGE]: ['settings.composerUsage', 'settings.composerUsageHint'],
  [FLAG_PLAN_QUOTA]: ['settings.planQuota', 'settings.planQuotaHint'],
  [FLAG_TOKEN_USAGE]: ['settings.tokenUsage', 'settings.tokenUsageHint'],
};

/**
 * 只读展示用的内联布局样式。
 *
 * ⚠️ 这里**只有布局与排版**（间距、字号、文字色），没有任何控件材质：圆角、填充、
 * 描边、悬停底色、焦点环、禁用态透明度全部由 primitives 组件与 `--dsw-*` token 负责。
 * 这是 §0.1 的边界 —— 版式可以自己排，控件不能自己画。
 */
const STYLE = {
  section: { minWidth: 0, padding: '8px 0 16px' },
  heading: {
    margin: 0,
    padding: '8px 0 0',
    fontSize: 13,
    fontWeight: 600,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-primary)',
  },
  hint: {
    margin: 0,
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-tertiary)',
  },
  note: {
    margin: 0,
    padding: '8px 10px',
    borderRadius: 8,
    background: 'var(--dsw-alias-interactive-bg-hover, rgba(127,127,127,.08))',
    fontSize: 12,
    lineHeight: 1.6,
    color: 'var(--dsw-alias-label-secondary)',
  },
  flagRow: {
    display: 'flex',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 16,
    padding: '12px 0',
    fontSize: 13,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-primary)',
  },
  flagText: { flex: '1 1 auto', minWidth: 0 },
  boot: { display: 'flex', flexDirection: 'column', gap: 6, padding: '8px 0' },
  bootList: {
    margin: 0,
    paddingLeft: 18,
    display: 'flex',
    flexDirection: 'column',
    gap: 2,
    wordBreak: 'break-word',
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-secondary)',
  },
  testRow: { display: 'flex', alignItems: 'center', gap: 8, paddingTop: 12, flexWrap: 'wrap' },
  testResult: {
    display: 'flex',
    alignItems: 'flex-start',
    gap: 8,
    paddingTop: 8,
    fontSize: 12,
    lineHeight: 1.5,
    color: 'var(--dsw-alias-label-secondary)',
  },
  status: { margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--dsw-alias-label-tertiary)' },
};

/* ────────────────────────────────────────────────────────────────────────────
 * react / primitives 的惰性取得
 * ──────────────────────────────────────────────────────────────────────────── */

let injectedReact;
let lazyReact;
let lazyReactTried = false;

/** 供入口注入宿主基座表里的 react（可选；缺省走函数内惰性 `require`）。 */
export function bindReact(module_) {
  injectedReact = module_ ?? undefined;
}

/** react 是否可渲染（`createElement` 是唯一的硬要求）。 */
function isReactish(module_) {
  return module_ !== null && module_ !== undefined && typeof module_.createElement === 'function';
}

/**
 * 取 react。**绝不抛错**：拿不到就返回 undefined，调用方退化为不渲染。
 *
 * ⚠️ 只在函数内 `require`：Node 侧没有基座表通道，顶层 `require` 会让整个模块求值
 * 失败。失败结果也缓存，避免每次渲染都进 try/catch。
 */
function resolveReact() {
  if (isReactish(injectedReact)) return injectedReact;
  if (!lazyReactTried) {
    lazyReactTried = true;
    try {
      if (typeof require === 'function') {
        const module_ = require('react');
        lazyReact = module_?.default ?? module_;
      }
    } catch {
      lazyReact = undefined;
    }
  }
  return isReactish(lazyReact) ? lazyReact : undefined;
}

/** 惰性 `createElement`：只有真正渲染时才需要 react。 */
function h(type, props, ...children) {
  const react = resolveReact();
  if (react === undefined) return null;
  return react.createElement(type, props, ...children);
}

let injectedPrimitives;
let lazyPrimitives;
let lazyPrimitivesTried = false;

/** 供入口注入 `@deepseek-ai/dsh-client-ui-primitives`（可选；缺省走惰性 `require`）。 */
export function bindPrimitives(module_) {
  injectedPrimitives = module_ ?? undefined;
}

/**
 * 判定一份 primitives 模块够不够本卡片用。
 *
 * 要求的是**本卡片真正会渲染的每一项**：少一项就整体判为不可用并显示如实说明，
 * 而不是「渲染到一半才发现缺件」。宁可整块说"暂时无法配置"，也不自绘替代控件
 * —— 后者正是 §0.1 禁止的形状。
 */
export function primitivesComplete(module_) {
  if (module_ === null || typeof module_ !== 'object') return false;
  const renderable = (value) =>
    typeof value === 'function' || (value !== null && typeof value === 'object');
  const callable = (value) => typeof value === 'function';
  return (
    callable(module_.SettingsFormModel) &&
    renderable(module_.SettingsForm) &&
    renderable(module_.SettingsValueField) &&
    renderable(module_.SettingsSecretField) &&
    renderable(module_.Switch) &&
    renderable(module_.Tag) &&
    renderable(module_.Button) &&
    callable(module_.settingsTextField) &&
    callable(module_.settingsNumberField)
  );
}

/** 取 primitives：注入优先，其次函数内惰性 `require`，都没有则 undefined。 */
export function usePrimitives() {
  if (primitivesComplete(injectedPrimitives)) return injectedPrimitives;
  if (!lazyPrimitivesTried) {
    lazyPrimitivesTried = true;
    try {
      if (typeof require === 'function') {
        const module_ = require('@deepseek-ai/dsh-client-ui-primitives');
        lazyPrimitives = module_?.default ?? module_;
      }
    } catch {
      lazyPrimitives = undefined;
    }
  }
  return primitivesComplete(lazyPrimitives) ? lazyPrimitives : undefined;
}

/* ────────────────────────────────────────────────────────────────────────────
 * 文案
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 读一个 prop，**永不抛错**。
 *
 * props 由插槽渲染器组装；正常路径上是普通对象，但「渲染期绝不抛错」是硬要求
 * （§1.3 —— 抛一次插槽条目就被永久撤销），所以把属性读取也当作不可信输入：
 * 万一宿主用 getter、或注入面在某个键上抛（能力探测失败的常见形状），
 * 这里返回 undefined 让卡片走降级分支，而不是把异常送给 `SlotErrorBoundary`。
 *
 * @param props props 对象（可为 undefined / null）。
 * @param key 属性名。
 * @returns 属性值；读不到或读取抛错时为 undefined。
 */
function readProp(props, key) {
  if (props === null || props === undefined) return undefined;
  try {
    return props[key];
  } catch {
    return undefined;
  }
}

/** `{name}` 占位替换；参数缺失时原样保留占位符（宁可露出 `{x}` 也不要 `undefined`）。 */
function substitute(text, params) {
  if (typeof text !== 'string') return '';
  if (params === undefined || params === null) return text;
  return text.replace(/\{(\w+)\}/g, (match, name) =>
    params[name] === undefined ? match : String(params[name]),
  );
}

/**
 * 造一个**永不露键名**的取词器。
 *
 * `t` 缺失、抛错、或键未注册（原样返回键名）时，退回 `createLocale()` 的
 * zh/en 字典（与 `client.js` 的 `localT` 同源）。语言由 `t('settings.title')`
 * 的探针值判定（中英标题不同），于是兜底文案也跟着语言切换，不硬编码任何一句话。
 *
 * @param t locale 绑定函数（可为 undefined，也可能抛错）。
 * @returns `(key, params) => string`
 */
function makeTranslator(t) {
  const dictionary = createLocale();
  const zh = dictionary?.zh ?? {};
  const en = dictionary?.en ?? {};
  let probe = '';
  try {
    probe = typeof t === 'function' ? t('settings.title') : '';
  } catch {
    probe = '';
  }
  const language = probe === en['settings.title'] ? 'en' : 'zh';
  const base = language === 'en' ? en : zh;
  return (key, params) => {
    let value;
    try {
      value = typeof t === 'function' ? t(key, params) : undefined;
    } catch {
      value = undefined;
    }
    // 宿主已给出真实文案（并且已替换过参数）：原样返回。
    if (typeof value === 'string' && value !== '' && value !== key) return value;
    const replacement = base[key];
    if (typeof replacement !== 'string') return String(key);
    return substitute(replacement, params);
  };
}

/**
 * `SettingsForm` 的框架文案 —— 照抄官方 `formLabels(t)` 的形状（subagent line 94）。
 *
 * @param t 取词器。
 * @returns `{ unavailable, readOnly, saveFailed, save, saving }`
 */
export function formLabels(t) {
  return {
    unavailable: t('settings.notServed'),
    readOnly: t('settings.unavailable'),
    saveFailed: t('settings.saveFailed'),
    save: t('settings.formSave'),
    saving: t('settings.saving'),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * 纯函数（从 settings-section.js 原样搬来；那份文件删除时测试可以只改 import 路径）
 * ──────────────────────────────────────────────────────────────────────────── */

/** 剥一层活引用：schemastery 的 volatile 字段是 `{ get() }` 而不是普通值。 */
function unwrapValue(value) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    try {
      return value.get();
    } catch {
      return undefined;
    }
  }
  return value;
}

/**
 * 从窗口数组里取「5 小时 / 7 天」两个剩余百分比。
 *
 * 按 `label` 找而**不是**按下标取 —— 上游将来多给一个窗口时，按下标会把 7 天
 * 当成 5 小时显示。
 *
 * @param windows 窗口数组（宿主归一化后的形状）。
 * @returns `{ h5, d7 }`，取不到的为 undefined。
 */
export function pickWindowPercents(windows) {
  const list = Array.isArray(windows) ? windows : [];
  const find = (label) => {
    const hit = list.find((item) => item?.label === label);
    return typeof hit?.remainingPercent === 'number' ? hit.remainingPercent : undefined;
  };
  return { h5: find('5h'), d7: find('7d') };
}

/**
 * 把「测试连接」响应翻译成界面要显示的东西（**键 + 参数**，不成句）。
 *
 * @param payload 路由响应体（已 JSON.parse，可能为 undefined）。
 * @param status HTTP 状态码（响应体不可解析时用于兜底）。
 * @returns `{ ok, messageKey, params, tier?, windows, percents? }`
 */
export function interpretTestResult(payload, status) {
  if (payload === null || typeof payload !== 'object') {
    return {
      ok: false,
      messageKey: 'settings.testFailed',
      params: { message: `HTTP ${status}` },
      windows: [],
    };
  }
  if (payload.ok !== true) {
    const code = typeof payload.code === 'string' ? payload.code : '';
    if (code === 'UNAUTHORIZED' || code === 'FORBIDDEN') {
      return { ok: false, messageKey: 'settings.unauthorized', params: {}, windows: [] };
    }
    if (code === 'NO_CREDENTIALS' || code === 'BAD_REQUEST') {
      return { ok: false, messageKey: 'settings.testNeedInput', params: {}, windows: [] };
    }
    if (code === 'UPSTREAM' || code === 'DISABLED') {
      return { ok: false, messageKey: 'settings.upstream', params: {}, windows: [] };
    }
    const detail =
      typeof payload.error === 'string' && payload.error !== '' ? payload.error : `HTTP ${status}`;
    return { ok: false, messageKey: 'settings.testFailed', params: { message: detail }, windows: [] };
  }
  const windows = Array.isArray(payload.windows) ? payload.windows : [];
  const tier = typeof payload.tier === 'string' ? payload.tier : '';
  if (windows.length === 0) {
    return { ok: true, messageKey: 'settings.testOkNoWindows', params: {}, tier, windows: [] };
  }
  return {
    ok: true,
    messageKey: 'settings.testOk',
    params: { tier: tier === '' ? '—' : tier },
    tier,
    windows,
    percents: pickWindowPercents(windows),
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * 字段 spec（`{ field, format, parse }` —— `SettingsFormModel` 的公开契约）
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 布尔字段的 spec —— `settingsTextField` 的**同形状变体**（任务书明确允许）。
 *
 * 为什么不照搬官方「布尔走独立 draft + 自己的 mutate」：本卡片只有一个保存按钮，
 * 布尔若单独 `scope.mutate` 会推进 revision，让同一次保存里 `form.save()` 的
 * `baseline.revision` 立即过期（乐观并发拒绝）。做成 spec 后三个开关与两个输入框
 * 合成**一次** `scope.mutate`，原子且栅栏正确。
 *
 * `format` 缺值/非布尔时给 `true`（`defaultSettings()` 三个开关默认开启，与旧实现
 * 「缺字段一律视为开启」的语义一致）。`parse` 只认 `'true'` / `'false'`，其余一律
 * undefined → `invalid` → `SettingsForm` 的保存按钮被禁用。
 *
 * @param field 字段名。
 * @returns 字段 spec。
 */
function flagSpec(field) {
  return {
    field,
    format: (value) => (unwrapValue(value) === false ? 'false' : 'true'),
    parse: (text) =>
      text === 'true'
        ? { kind: 'set', value: true }
        : text === 'false'
          ? { kind: 'set', value: false }
          : undefined,
  };
}

/**
 * 给数值 spec 加区间校验 —— 照抄官方 `limitField(field, minimum)` 的做法
 * （subagent line 471）：基础 spec 解析出 `set` 之后，再校验是否为安全整数且在区间内。
 *
 * @param base `settingsNumberField(field)` 的结果。
 * @param field 字段名。
 * @param min 允许的最小值（含）。
 * @param max 允许的最大值（含）。
 * @returns 带区间校验的字段 spec。
 */
function rangeSpec(base, field, min, max) {
  return {
    ...base,
    field,
    parse: (text) => {
      const write = base.parse(text);
      if (write?.kind !== 'set') return write;
      const value = write.value;
      if (!Number.isSafeInteger(value) || value < min || value > max || Object.is(value, -0)) {
        return undefined;
      }
      return write;
    },
  };
}

/* ────────────────────────────────────────────────────────────────────────────
 * 作用域解析
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 能力探测取 `configForms`。
 *
 * ⚠️ 一律走 `ctx.get('configForms')`（Context 自带方法，**不受 cordis 的 inject 闸
 * 限制**），绝不写 `ctx.configForms` —— 后者要求把服务名声明进导出的 `inject`
 * （漏声明就会把整个 DSH 启动打挂，见 §3）。
 */
function getForms(ctx) {
  if (ctx === null || ctx === undefined) return undefined;
  try {
    if (typeof ctx.get !== 'function') return undefined;
    return ctx.get('configForms') ?? undefined;
  } catch {
    return undefined;
  }
}

/**
 * 从一个 configForms 服务里取命名空间作用域。
 *
 * 形状要求：`getSnapshot()`（必）+ `subscribe()`（必）。缺 `subscribe` 的话
 * `SettingsFormModel` 的构造函数会抛，整张卡片渲染不出来 —— 那种作用域宁可不要。
 */
function scopeOf(forms, namespace) {
  try {
    if (typeof forms?.get !== 'function') return undefined;
    const scope = forms.get(namespace);
    if (scope === null || scope === undefined) return undefined;
    if (typeof scope.getSnapshot !== 'function') return undefined;
    if (typeof scope.subscribe !== 'function') return undefined;
    return scope;
  } catch {
    return undefined;
  }
}

/**
 * 解析本卡片要编辑的设置作用域。顺序（先具体后兜底）：
 *  1. `ctx.get('configForms').get(SETTINGS_NAMESPACE)` —— 生产主路径；
 *  2. `props.scope` / `props.settingsScope` —— 调用方直接给的作用域（测试常用）；
 *  3. 都拿不到 → undefined（卡片显示如实的不可用说明，不自绘替代控件）。
 *
 * ⚠️ 入参是**已经安全读出**的三个值（调用方用 `readProp` 取好）：本函数可能在
 * 渲染期被调用，任何一步失败都只能返回 undefined，绝不抛错。
 *
 * @param candidates `{ ctx, scope, settingsScope }`
 * @returns 可用作用域，或 undefined。
 */
function resolveScope(candidates) {
  const fromForms = scopeOf(getForms(candidates?.ctx), SETTINGS_NAMESPACE);
  if (fromForms !== undefined) return fromForms;
  // 直接给的作用域只要求「可读 + 可订阅」：不经过 configForms 的命名空间表。
  return adaptDirectScope(candidates?.scope) ?? adaptDirectScope(candidates?.settingsScope);
}

/** 调用方直接给的作用域：形状合格就原样使用。 */
function adaptDirectScope(candidate) {
  if (candidate === null || candidate === undefined) return undefined;
  try {
    if (typeof candidate.getSnapshot !== 'function') return undefined;
    if (typeof candidate.subscribe !== 'function') return undefined;
    return candidate;
  } catch {
    return undefined;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 卡片控制器（照抄 `SubagentLimitsCardController` / `WebSearchCardController`）
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 把本插件的设置作用域变成一个暂存表单：
 *  - 三个开关（布尔 spec）、workspaceId（文本）、刷新间隔（区间数值）走 `specs`；
 *  - 会话凭据走 `secrets` 第 3 参（写-only：不回显、空草稿不覆盖）。
 */
class SettingsCardController {
  /**
   * @param scope `configForms.get(SETTINGS_NAMESPACE)` 给出的设置作用域。
   * @param primitives 已确认完备的 primitives 模块。
   */
  constructor(scope, primitives) {
    this.scope = scope;
    this.primitives = primitives;
    this.form = new primitives.SettingsFormModel(
      scope,
      [
        flagSpec(FLAG_COMPOSER_USAGE),
        flagSpec(FLAG_PLAN_QUOTA),
        flagSpec(FLAG_TOKEN_USAGE),
        primitives.settingsTextField(FIELD_WORKSPACE_ID),
        rangeSpec(
          primitives.settingsNumberField(FIELD_REFRESH_INTERVAL),
          FIELD_REFRESH_INTERVAL,
          MIN_REFRESH_INTERVAL_MS,
          MAX_REFRESH_INTERVAL_MS,
        ),
      ],
      [
        {
          field: FIELD_SESSION_COOKIE,
          // 写-only：值只在这里落地，并且仍然过一遍 normalize —— 用户可能把整段
          // Cookie 头粘进来。
          write: (raw) => {
            if (typeof scope?.set !== 'function') return Promise.resolve(false);
            try {
              return Promise.resolve(scope.set(FIELD_SESSION_COOKIE, normalizeSessionCookie(raw)));
            } catch {
              return Promise.resolve(false);
            }
          },
        },
      ],
    );
    this.actions = this.form.actions();
    this.store = this.form.bind(() => this.projection());
  }

  /**
   * 投影出组件需要的全部状态。
   *
   * ⚠️ **必须整体兜底**：投影是在 `store.set()` 里跑的（`publish()` 的直接调用栈上），
   * 抛出会顺着宿主的订阅回调冒出去；而渲染期抛错会让插槽条目被永久撤销。
   *
   * @returns 组件用的快照。
   */
  projection() {
    try {
      const snapshot = this.scope.getSnapshot();
      const value = snapshot?.value ?? {};
      const flags = {};
      for (const field of FLAG_FIELDS) flags[field] = this.form.field(field);
      return {
        ...this.form.shell(),
        flags,
        // ⚠️ 字段一律**按字段常量名**存（不要另起一个短名）：组件用同一个常量名读，
        // 两处各写一份名字迟早会漂移 —— 实测过一次（`refreshInterval` vs
        // `refreshIntervalMs`），表现为「输入框永远是空的」而没有任何报错。
        fields: {
          [FIELD_WORKSPACE_ID]: this.form.field(FIELD_WORKSPACE_ID),
          [FIELD_REFRESH_INTERVAL]: this.form.field(FIELD_REFRESH_INTERVAL),
          [FIELD_SESSION_COOKIE]: this.form.field(FIELD_SESSION_COOKIE),
        },
        cookieConfigured: cookieConfiguredIn(snapshot, value),
      };
    } catch (error) {
      console.error(`[${PLUGIN_ID}] 配置卡片投影失败，退回不可用状态：`, error);
      const empty = { text: '', overridden: false, invalid: false };
      return {
        available: false,
        writable: false,
        dirty: false,
        invalid: false,
        saving: false,
        failed: false,
        flags: {},
        fields: {
          [FIELD_WORKSPACE_ID]: empty,
          [FIELD_REFRESH_INTERVAL]: empty,
          [FIELD_SESSION_COOKIE]: empty,
        },
        cookieConfigured: false,
      };
    }
  }

  /** 当前快照；组件渲染用（订阅由组件挂在 `this.store` 上）。 */
  snapshot() {
    return this.store.getSnapshot();
  }

  /** 一个字段的渲染状态；缺失时给安全空壳（组件读到 undefined 会崩）。 */
  field(name) {
    const state = this.snapshot()?.fields?.[name];
    return isFieldState(state) ? state : { text: '', overridden: false, invalid: false };
  }

  /** 一个开关的渲染状态；`checked` 由 `text === 'true'` 决定。 */
  flag(field) {
    const state = this.snapshot()?.flags?.[field];
    return isFieldState(state) ? state : { text: 'true', overridden: false, invalid: false };
  }

  /** 暂存一个字段的新值（不写盘）。 */
  edit(name, text) {
    try {
      this.actions.edit(name, String(text ?? ''));
    } catch (error) {
      console.error(`[${PLUGIN_ID}] 暂存字段 ${name} 失败：`, error);
    }
  }

  /** 拨动一个开关（只暂存）。 */
  toggle(field, next) {
    this.edit(field, next === true ? 'true' : 'false');
  }

  /**
   * 把一个普通字段重置回默认（staged clear）。
   *
   * ⚠️ **密文字段绝不能走这里**：官方 `SettingsFormModel.resetField()` 会调
   * `this.spec(field)`，而 secret 只登记在 `secretSpecs` 里 —— 对 cookie 调用它会
   * 抛 `plugin card has no field sessionCookie`。因此 `SettingsCard` 不为 cookie
   * 提供重置入口。
   */
  reset(name) {
    try {
      this.actions.resetField(name);
    } catch (error) {
      console.error(`[${PLUGIN_ID}] 重置字段 ${name} 失败：`, error);
    }
  }

  /** 丢弃全部草稿。 */
  discard() {
    try {
      this.actions.discard();
    } catch (error) {
      console.error(`[${PLUGIN_ID}] 丢弃草稿失败：`, error);
    }
  }

  /**
   * 「测试连接」要用的**草稿值**（用户还没保存也能测）。
   *
   * workspaceId 的草稿由 `field().text` 给出（未暂存时就是已保存值）。
   * cookie 是写-only：未暂存时读不到草稿，此时退回作用域里的已保存值 —— 两种都过
   * `normalizeSessionCookie`，所以整段 Cookie 头也能直接测。
   *
   * @returns `{ workspaceId, sessionCookie }`（都是收敛过的裸值）
   */
  drafts() {
    let workspaceId = '';
    let sessionCookie = '';
    try {
      workspaceId = normalizeText(this.field(FIELD_WORKSPACE_ID).text);
      const staged = normalizeText(this.field(FIELD_SESSION_COOKIE).text);
      let saved = '';
      try {
        saved = this.scope.getSnapshot()?.value?.[FIELD_SESSION_COOKIE] ?? '';
      } catch {
        saved = '';
      }
      sessionCookie = normalizeSessionCookie(staged !== '' ? staged : saved);
    } catch (error) {
      console.error(`[${PLUGIN_ID}] 读取测试连接草稿失败：`, error);
    }
    return { workspaceId, sessionCookie };
  }

  /**
   * 三个开关**当前生效**的值（保存落地后同步进 `flagsStore` 用）。
   *
   * @returns `{ enableComposerUsage, enablePlanQuota, enableTokenUsage }`
   */
  flagValues() {
    const fallback = defaultSettings();
    let value = {};
    try {
      value = this.scope.getSnapshot()?.value ?? {};
    } catch {
      value = {};
    }
    const out = {};
    for (const field of FLAG_FIELDS) {
      out[field] = normalizeFlag(unwrapValue(value[field]), fallback[field]);
    }
    return out;
  }

  /**
   * 保存。返回是否**确实落地**。
   *
   * `SettingsFormModel.save()` 在写入后会把结果从作用域读回来，所以「草稿清空且
   * 不再 failed」就是落地的判据（官方注释：*The Host is the only authority on
   * whether a value was accepted … the outcome is read back from the section*）。
   *
   * @returns 落地为 true。
   */
  async save() {
    const before = this.snapshot() ?? {};
    if (before.dirty !== true || before.writable !== true || before.saving === true) return false;
    try {
      await this.form.save();
    } catch (error) {
      console.error(`[${PLUGIN_ID}] 保存设置失败：`, error);
      return false;
    }
    const after = this.snapshot() ?? {};
    return after.failed !== true && after.dirty !== true;
  }

  /** 释放作用域订阅。 */
  dispose() {
    try {
      this.form.dispose();
    } catch (error) {
      console.error(`[${PLUGIN_ID}] 释放配置表单失败：`, error);
    }
  }
}

/** 字段状态形状检查（`{ text, overridden, invalid }`）。 */
function isFieldState(state) {
  return state !== null && typeof state === 'object' && typeof state.text === 'string';
}

/** 凭据是否已配置：值非空，或用户层含有这个键（覆盖成空串也算「配置过」）。 */
function cookieConfiguredIn(snapshot, value) {
  const saved = unwrapValue(value?.[FIELD_SESSION_COOKIE]);
  if (typeof saved === 'string' && saved !== '') return true;
  const user = snapshot?.user;
  return user !== null && typeof user === 'object' && Object.hasOwn(user, FIELD_SESSION_COOKIE);
}

/* ────────────────────────────────────────────────────────────────────────────
 * 组件
 * ──────────────────────────────────────────────────────────────────────────── */

/** 一节的小标题。 */
function Section(props) {
  return h('h3', { style: STYLE.heading }, props?.children);
}

/**
 * 一行开关。
 *
 * 布局照抄官方 `SubagentModelSelectionFields.toggleRow`（左文案、右 `Switch`）；
 * 开关本身是 primitives 的 `Switch`（36×20，`label` 必填）。
 */
function FlagRow(props) {
  const { primitives, t, field, state, disabled, onToggle } = props;
  const [titleKey, hintKey] = FLAG_COPY_KEYS[field] ?? [];
  return h(
    'div',
    { style: STYLE.flagRow },
    h(
      'div',
      { style: STYLE.flagText },
      h('div', null, t(titleKey)),
      h('div', { style: STYLE.hint }, t(hintKey)),
    ),
    h(primitives.Switch, {
      label: t(titleKey),
      checked: state.text === 'true',
      disabled: disabled === true,
      onChange: (next) => onToggle(field, next),
    }),
  );
}

/** 启动降级提示：primitives 的 `Tag`（不自写徽章）+ 明细列表。 */
function BootNotice(props) {
  const { primitives, t, failures } = props;
  return h(
    'div',
    { style: STYLE.boot },
    h(primitives.Tag, { tone: 'danger' }, t('settings.bootFailed')),
    h(
      'ul',
      { style: STYLE.bootList },
      failures.map((failure, index) =>
        h(
          'li',
          { key: `${String(failure?.where ?? '')}-${index}` },
          `${String(failure?.where ?? '')}: ${String(failure?.message ?? '')}`,
        ),
      ),
    ),
  );
}

/**
 * 「测试连接」。
 *
 * 必须是**独立组件**：它有自己的 `testing / ok / error` 状态，塞进 `SettingsCard`
 * 会让后者的 hook 数量随测试状态变化（Rules of Hooks）。用法与旧实现一致 ——
 * 用**当前草稿值** POST，与是否已保存无关。
 */
function TestConnection(props) {
  const { primitives, t, controller, disabled } = props;
  const react = resolveReact();
  const [status, setStatus] = react.useState('idle');
  const [result, setResult] = react.useState(undefined);

  const run = () => {
    const drafts = controller.drafts();
    if (drafts.workspaceId === '' || drafts.sessionCookie === '') {
      setResult({ ok: false, messageKey: 'settings.testNeedInput', params: {}, windows: [] });
      setStatus('error');
      return;
    }
    setStatus('testing');
    setResult(undefined);
    void (async () => {
      try {
        if (typeof fetch !== 'function') throw new Error('fetch is unavailable');
        const response = await fetch(ROUTE_TEST_CONNECTION, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({
            [FIELD_WORKSPACE_ID]: drafts.workspaceId,
            [FIELD_SESSION_COOKIE]: drafts.sessionCookie,
          }),
        });
        let payload;
        try {
          payload = await response.json();
        } catch {
          payload = undefined;
        }
        const interpreted = interpretTestResult(payload, response.status);
        setResult(interpreted);
        setStatus(interpreted.ok ? 'ok' : 'error');
      } catch (error) {
        // 网络层失败（宿主路由没起来等）：如实说，不吞。
        setResult({
          ok: false,
          messageKey: 'settings.testFailed',
          params: { message: error instanceof Error ? error.message : String(error) },
          windows: [],
        });
        setStatus('error');
      }
    })();
  };

  const busy = status === 'testing';
  const children = [
    h(
      'div',
      { key: 'action', style: STYLE.testRow },
      h(
        primitives.Button,
        { variant: 'outline', size: 'sm', disabled: disabled === true || busy, onClick: run },
        busy ? t('settings.testing') : t('settings.test'),
      ),
      // 用草稿值测试是刻意的：不必先保存。
      h('span', { style: { ...STYLE.hint, flex: '1 1 auto', minWidth: 0 } }, t('settings.testHint')),
    ),
  ];

  if (status === 'ok' || status === 'error') {
    const messageKey =
      typeof result?.messageKey === 'string' ? result.messageKey : 'settings.testFailed';
    children.push(
      h(
        'div',
        { key: 'result', style: STYLE.testResult, role: 'status' },
        h(
          primitives.Tag,
          { tone: status === 'ok' ? 'success' : 'danger' },
          t(status === 'ok' ? 'settings.testOkBadge' : 'settings.testFailedBadge'),
        ),
        h('span', { style: { flex: '1 1 auto', minWidth: 0 } }, t(messageKey, result?.params)),
      ),
    );
    if (status === 'ok' && Array.isArray(result?.windows) && result.windows.length > 0) {
      const { h5, d7 } = result.percents ?? pickWindowPercents(result.windows);
      if (h5 !== undefined || d7 !== undefined) {
        children.push(
          h(
            'div',
            { key: 'detail', style: { ...STYLE.hint, paddingTop: 4 } },
            t('settings.testOkWindows', {
              h5: typeof h5 === 'number' ? String(h5) : '—',
              d7: typeof d7 === 'number' ? String(d7) : '—',
            }),
          ),
        );
      }
    }
  }

  return h('div', { style: STYLE.section }, ...children);
}

/**
 * 插件详情页的配置卡片。
 *
 * ⚠️ 全函数**绝不允许抛错**：`ui-renderer` 给每个插槽条目套 `SlotErrorBoundary`，
 * 渲染期抛一次该条目就进 `abdicated` 弱集、**从此永久跳过**（§1.3）。因此每一步都
 * 自带兜底：react 拿不到返回 null、primitives 拿不到显示如实说明、作用域拿不到显示
 * 「未加载」、投影失败退回不可用状态。
 *
 * @param props `t` / `ctx` / `flagsStore` / `bootFailures`（全部容忍 undefined）。
 * @returns 配置表单，或一条如实的不可用说明。
 */
export function SettingsCard(props) {
  const react = resolveReact();
  // react 缺失时什么都渲染不了：返回 null（此分支零 hook，hook 数量稳定）。
  if (react === undefined) return null;

  const primitives = usePrimitives();
  // ⚠️ 全部 prop 都走 `readProp`：属性读取失败（注入面在某个键上抛）也必须只降级，
  // 不允许把异常送到 `SlotErrorBoundary`。
  const view = readProp(props, 'view');
  const ctx = readProp(props, 'ctx');
  const flagsStore = readProp(props, 'flagsStore');
  const rawFailures = readProp(props, 'bootFailures');
  const t = makeTranslator(readProp(props, 't'));

  const [scope, setScope] = react.useState(() => resolveScope({ ctx, scope: readProp(props, 'scope'), settingsScope: readProp(props, 'settingsScope') }));

  /**
   * 命名空间由 Host 异步 serve：`apply` 时通常还没到。`whileServed` 跟随「上线 /
   * 下线」边沿重新解析作用域（照抄官方 subagent line 839 / shell line 182），避免
   * 「启动读一次、之后永不更新」（workbuddy 4.3.0 的缺陷形状）。
   *
   * `whileServed` 不存在时（服务形状不同，或测试桩）退化为在本 effect 里**直接重新
   * 解析一次** —— 否则 `ctx` 换了而作用域会一直停在首次渲染时读到的那个。
   */
  react.useEffect(() => {
    const forms = getForms(ctx);
    const reread = () => {
      const next = scopeOf(forms, SETTINGS_NAMESPACE);
      setScope((previous) => (previous === next ? previous : next));
    };
    if (typeof forms?.whileServed !== 'function') {
      reread();
      return undefined;
    }
    let dispose;
    try {
      dispose = forms.whileServed([SETTINGS_NAMESPACE], () => {
        reread();
        return () => {};
      });
    } catch (error) {
      console.error(`[${PLUGIN_ID}] 跟随设置命名空间失败：`, error);
      return undefined;
    }
    return () => {
      try {
        dispose?.();
      } catch {
        // 退订失败无所谓。
      }
    };
  }, [ctx]);

  /** 作用域 + primitives 任一变化就重建表单模型（两者的引用都是稳定的）。 */
  const controller = react.useMemo(() => {
    if (scope === undefined || primitives === undefined) return undefined;
    try {
      return new SettingsCardController(scope, primitives);
    } catch (error) {
      console.error(`[${PLUGIN_ID}] 建立配置表单失败：`, error);
      return undefined;
    }
  }, [scope, primitives]);

  const [snapshot, setSnapshot] = react.useState(() => controller?.snapshot());

  /** 订阅暂存表单：草稿、保存状态、作用域变化都从这一个快照来。 */
  react.useEffect(() => {
    if (controller === undefined) {
      setSnapshot(undefined);
      return undefined;
    }
    setSnapshot(controller.snapshot());
    return controller.store.subscribe(() => setSnapshot(controller.snapshot()));
  }, [controller]);

  /** 卸载时退订，避免留下悬空订阅。 */
  react.useEffect(() => {
    if (controller === undefined) return undefined;
    return () => controller.dispose();
  }, [controller]);

  // 官方卡片都响应 `view: 'summary'`（插件列表里的一行简介）。
  // ⚠️ 必须在全部 hook 之后：提前 return 会改变 hook 数量。
  if (view === 'summary') return t('settings.intro');

  const bootFailures = Array.isArray(rawFailures) ? rawFailures.filter(Boolean) : [];

  // 没法渲染表单时如实说明，绝不假装有控件（也绝不自绘替代控件）。
  if (primitives === undefined) {
    console.warn(
      `[${PLUGIN_ID}] 取不到 @deepseek-ai/dsh-client-ui-primitives，配置卡片暂时无法渲染。`,
    );
    return h(
      'div',
      { style: STYLE.section },
      // 连 `Tag` 都没有，这里只能用纯文本列出降级明细 —— 不画徽章就不算自绘控件。
      bootFailures.length > 0
        ? h(
            'div',
            { style: STYLE.boot },
            h('div', null, t('settings.bootFailed')),
            h(
              'ul',
              { style: STYLE.bootList },
              bootFailures.map((failure, index) =>
                h(
                  'li',
                  { key: `${String(failure?.where ?? '')}-${index}` },
                  `${String(failure?.where ?? '')}: ${String(failure?.message ?? '')}`,
                ),
              ),
            ),
          )
        : null,
      h('p', { role: 'status', style: STYLE.status }, formLabels(t).unavailable),
    );
  }

  if (controller === undefined || snapshot === undefined || snapshot.available !== true) {
    return h(
      'div',
      { style: STYLE.section },
      bootFailures.length > 0 ? h(BootNotice, { primitives, t, failures: bootFailures }) : null,
      h('p', { role: 'status', style: STYLE.status }, formLabels(t).unavailable),
    );
  }

  const writable = snapshot.writable === true;
  const busy = snapshot.saving === true;
  const disabled = !writable || busy;
  const labels = formLabels(t);
  const workspaceId = controller.field(FIELD_WORKSPACE_ID);
  const refreshInterval = controller.field(FIELD_REFRESH_INTERVAL);
  const sessionCookie = controller.field(FIELD_SESSION_COOKIE);

  /**
   * 保存：先写暂存表单，**落地后**才把三个开关同步进 `flagsStore`。
   *
   * 同步 store 是「改完立刻生效」的关键：只写设置的话，输入框那个控件要等下一次
   * 网络刷新（默认 5 分钟）才看到变化 —— 那正是「设置页改了没用」的缺陷形状。
   * `flagsStore` 是可选优化，写失败不影响设置本身落盘；任何异常都不许冒到渲染层。
   */
  const onSave = () => {
    void (async () => {
      try {
        const landed = await controller.save();
        if (!landed) return;
        try {
          flagsStore?.set?.(controller.flagValues());
        } catch (error) {
          console.error(`[${PLUGIN_ID}] 同步开关镜像失败（设置本身已保存）：`, error);
        }
      } catch (error) {
        console.error(`[${PLUGIN_ID}] 保存流程出错：`, error);
      }
    })();
  };

  const sections = [];

  if (bootFailures.length > 0) {
    sections.push(h(BootNotice, { key: 'boot', primitives, t, failures: bootFailures }));
  }

  /* ── 三个功能开关 ───────────────────────────────────────────────── */
  sections.push(
    h(
      'div',
      { key: 'flags', style: STYLE.section },
      h(Section, null, t('settings.features')),
      ...FLAG_FIELDS.map((field) =>
        h(FlagRow, {
          key: field,
          primitives,
          t,
          field,
          state: controller.flag(field),
          disabled,
          onToggle: (name, next) => controller.toggle(name, next),
        }),
      ),
    ),
  );

  /* ── 凭据 ──────────────────────────────────────────────────────── */
  sections.push(
    h(
      'div',
      { key: 'credentials', style: STYLE.section },
      h(Section, null, t('settings.credentials')),
      h('p', { style: STYLE.hint }, t('settings.credentialsHint')),
      h(primitives.SettingsValueField, {
        id: `${PLUGIN_ID}-workspace`,
        label: t('settings.workspaceId'),
        hint: t('settings.workspaceIdHint'),
        placeholder: t('settings.workspaceIdPlaceholder'),
        overriddenLabel: t('settings.overridden'),
        resetLabel: t('settings.resetField'),
        invalidLabel: t('settings.invalidNumber'),
        disabled,
        text: workspaceId.text,
        overridden: workspaceId.overridden === true,
        invalid: workspaceId.invalid === true,
        onEdit: (text) => controller.edit(FIELD_WORKSPACE_ID, text),
        onReset: () => controller.reset(FIELD_WORKSPACE_ID),
      }),
      h(primitives.SettingsSecretField, {
        id: `${PLUGIN_ID}-cookie`,
        label: t('settings.sessionCookie'),
        hint: t('settings.sessionCookieHint'),
        // 密文字段每次为空：只报告「是否已配置」，绝不回显已保存的 token。
        // 也因此**不提供重置按钮** —— 官方模型对 secret 调 resetField 会抛。
        text: sessionCookie.text,
        configured: snapshot.cookieConfigured === true,
        stateLabel:
          snapshot.cookieConfigured === true
            ? t('settings.secretConfigured')
            : t('settings.notConfigured'),
        disabled,
        onEdit: (text) => controller.edit(FIELD_SESSION_COOKIE, text),
      }),
      // 摘取步骤：用户唯一需要动手的地方，写清楚比写短重要。
      h('p', { style: STYLE.note }, t('settings.howTo')),
    ),
  );

  /* ── 刷新间隔 ──────────────────────────────────────────────────── */
  sections.push(
    h(
      'div',
      { key: 'refresh', style: STYLE.section },
      h(primitives.SettingsValueField, {
        id: `${PLUGIN_ID}-refresh`,
        label: t('settings.refreshInterval'),
        hint: t('settings.refreshIntervalHint'),
        overriddenLabel: t('settings.overridden'),
        resetLabel: t('settings.resetField'),
        invalidLabel: t('settings.invalidNumber'),
        numeric: true,
        disabled,
        text: refreshInterval.text,
        overridden: refreshInterval.overridden === true,
        invalid: refreshInterval.invalid === true,
        onEdit: (text) => controller.edit(FIELD_REFRESH_INTERVAL, text),
        onReset: () => controller.reset(FIELD_REFRESH_INTERVAL),
      }),
    ),
  );

  /* ── 测试连接 ──────────────────────────────────────────────────── */
  sections.push(h(TestConnection, { key: 'test', primitives, t, controller, disabled: busy }));

  return h(
    primitives.SettingsForm,
    { labels, state: snapshot, onSave, onDiscard: () => controller.discard() },
    ...sections,
  );
}
