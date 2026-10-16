/**
 * dsh-opendesign-usage —— 输入框工具行的只读用量控件。
 *
 * 位置：注册进 `conversation.input.left`（session 级 list 插槽），与「权限」
 * 「模型」等控件同排。它**只读** —— 绝不向宿主写任何 state，只消费两个投影
 * （`modelSelection`、`tokenUsage`）与宿主自己的一条同源路由。
 *
 * 三件事决定本文件的形状：
 *
 *  1. **provider gate 而不是条件注册**。注册是无条件的，由 `UsageGate` 读
 *     `modelSelection` 决定渲染不渲染。条件注册会在 provider 切换时留下一个
 *     空位（注册表按 id 记账），而无条件注册 + `return null` 什么都不画。
 *
 *  2. **任何网络失败都静默降级**。请求失败保留上一次读数、只把控件标成低调
 *     的错误态；不弹窗、不打日志噪音。工具行那格是壳体的公共空间，插件没有
 *     资格用 toast 抢它。
 *
 *  3. **纯逻辑与 React 分离**。`providerOfSelection`、`tokenTotalsOf`、
 *     `planViewOf`、`collapseLabelOf` 都是无依赖纯函数并单独导出，因此可以在
 *     Node 里直接冒烟测试（React 组件本身在 Node 里 import 会因缺少宿主运行时
 *     而不可直接求值）。
 *
 *  4. **UI 一律取自 `@deepseek-ai/dsh-client-ui-primitives`**（2026-10-16 重构）。
 *     触发控件用它的 `Button`，展开面板用它的 `MenuSurface`，定位与外部点击
 *     收起用它导出的 `useAnchoredPosition` / `useDismissOnOutsidePointer`。
 *     本文件**不再自己实现**任何定位/收起 hook，也不自己画面板材质。
 *     ⚠️ 旧说法"第三方插件禁止 require 任何 Harness Client 包"**已作废** ——
 *     当年白屏的真因是漏声明 `inject` 服务名，与 require primitives 无关；
 *     primitives 在前端 boot 的 seed 表（`staticModules`）里，require 必定成功。
 *     规范出处：`dsh-plugin-standards/docs/UI-STANDARDS.md` §0.1。
 *
 * @module dsh-opendesign-usage/composer-usage
 */

import {
  FIELD_REFRESH_INTERVAL,
  PLUGIN_ID,
  PROVIDERS,
  ROUTE_PLAN_USAGE,
  formatDuration,
  formatTokenCount,
  normalizeFlag,
  normalizeRefreshInterval,
  remainingPercentOf,
  windowLabelOf,
} from './constants.js';
import { FLAG_COMPOSER_USAGE, FLAG_PLAN_QUOTA, FLAG_TOKEN_USAGE } from './constants.js';
import { pickFlags } from './flags-store.js';


/** 样式只注入一次。 */
const CSS_ID = `${PLUGIN_ID}/composer-usage.css`;

/**
 * 工具行的**布局**样式。
 *
 * 重构后这里只剩「布局与排版」，不再有任何材质：圆角、hover 底色、禁用态
 * 透明度、面板填充/描边/模糊/圆角全部由 primitives 的 `Button`（`ghost` +
 * `sm`）与 `MenuSurface` 提供，它们消费 `--dsw-*` token。
 *
 * 控件是「读数」而不是按钮，所以视觉低调：`ghost` 默认透明，hover 才浮出
 * 一层 `--dsw-alias-interactive-bg-hover`（与工具行其它控件一致）。
 * `sm` 给出 28px 高 + 12px 字号，与 composer 工具行的其它控件同高。
 *
 * ⚠️ 本段在模板字符串内，注释里绝不能出现反引号，否则会提前闭合字符串。
 */
const CSS = `
.dsh-odu-root{display:inline-flex;align-items:center;flex:none}
.dsh-odu-readout{gap:6px;flex:none;padding:0 8px;font-weight:500;color:var(--dsw-alias-label-secondary,currentColor);white-space:nowrap}
.dsh-odu-readout[data-stale="true"]{color:var(--dsw-alias-label-tertiary,currentColor);opacity:.75}
.dsh-odu-glyph{font-weight:600;font-size:11px;letter-spacing:.02em;color:var(--dsw-alias-label-primary,currentColor)}
.dsh-odu-sep{opacity:.45}
.dsh-odu-pct{font-variant-numeric:tabular-nums}
/* 键位：--dsh-menu-anchor 由 MenuSurface 用 useId 生成，作为材质层的 CSS 锚点。 */
.dsh-odu-pop{position:fixed;z-index:60;min-width:200px;max-width:300px;padding:8px 10px;color:var(--dsw-alias-label-primary,currentColor);font-size:12px;line-height:1.55}
.dsh-odu-row{display:flex;align-items:baseline;justify-content:space-between;gap:12px}
.dsh-odu-row+.dsh-odu-row{margin-top:4px}
.dsh-odu-row-label{color:var(--dsw-alias-label-secondary,currentColor)}
.dsh-odu-row-value{font-variant-numeric:tabular-nums}
.dsh-odu-row-note{display:block;color:var(--dsw-alias-label-secondary,currentColor)}
.dsh-odu-reset{color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,currentColor));font-size:11px}
.dsh-odu-note{margin-top:6px;padding-top:6px;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.2));color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,currentColor));font-size:11px}
.dsh-odu-breakdown{margin-top:6px;padding-top:6px;border-top:1px solid var(--dsw-alias-border-l1,rgba(127,127,127,.2));color:var(--dsw-alias-label-tertiary,var(--dsw-alias-label-secondary,currentColor));font-size:11px;font-variant-numeric:tabular-nums}
`;

/**
 * 幂等注入样式。
 *
 * ⚠️ **全包 try/catch，返回 false 表示降级**（UI-STANDARDS §1.3）：`ui-renderer`
 * 给每个插槽条目套 `SlotErrorBoundary`，渲染期抛一次错该条目就进 `abdicated`
 * 弱集，**从此永久跳过** —— 症状是"装了别的插件之后本插件的控件不见了"。
 * `document` 必须当作不可信输入（head 可能被冻结、querySelector 可能被桩掉）。
 *
 * @returns 样式可用时为 true；任何一步失败都返回 false（调用方继续渲染，只是没样式）。
 */
function ensureCss() {
  try {
    if (typeof document === 'undefined' || document === null) return false;
    if (typeof document.querySelector !== 'function') return false;
    if (document.querySelector(`style[data-plugin-css=${JSON.stringify(CSS_ID)}]`) !== null) return true;
    if (typeof document.createElement !== 'function') return false;
    const tag = document.createElement('style');
    tag.dataset.plugin = PLUGIN_ID;
    tag.dataset.pluginCss = CSS_ID;
    tag.textContent = CSS;
    document.head.appendChild(tag);
    return true;
  } catch (error) {
    console.error(`[${PLUGIN_ID}] 注入工具行样式失败（控件仍会显示，只是没样式）：`, error);
    return false;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * 纯逻辑（无 React 依赖，Node 可直接测试）
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 从 `modelSelection` 投影里取本会话选中的 provider。
 *
 * `next` 优先于 `lastUsed`：用户在模型选择器里刚换的那个才是「本会话将要
 * 使用的」，而 `lastUsed` 是上一次真正跑过的。切换瞬间两者会不一致，用
 * `lastUsed` 会让控件滞后一步（切到 opendesign 时还不出现，切走时还留着）。
 *
 * @param projection `useProjection('modelSelection')` 的返回值。
 * @returns provider 字符串；无法判定时返回 undefined。
 */
export function providerOfSelection(projection) {
  const provider = (projection?.next ?? projection?.lastUsed)?.provider;
  return typeof provider === 'string' && provider !== '' ? provider : undefined;
}

/** 该 provider 是否由本插件服务（用 constants 的表，将来加 id 只改一处）。 */
export function isOwnProvider(provider) {
  if (typeof provider !== 'string') return false;
  return Object.values(PROVIDERS).includes(provider);
}

/**
 * 汇总本会话 token 用量。
 *
 * wire view 的四个字段全是 number 且可能为 0；缺字段按 0 处理（投影可能只带
 * 部分字段）。合计是四者之和 —— 缓存读写也算进去，因为用户关心的是「这次
 * 会话总共花了多少」。
 *
 * @param view `useProjection('tokenUsage')` 的返回值。
 * @returns `{ input, output, cacheRead, cacheWrite, total }`
 */
export function tokenTotalsOf(view) {
  const num = (value) => (typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : 0);
  const input = num(view?.uncachedInputTokens);
  const output = num(view?.outputTokens);
  const cacheRead = num(view?.cacheReadTokens);
  const cacheWrite = num(view?.cacheWriteTokens);
  return { input, output, cacheRead, cacheWrite, total: input + output + cacheRead + cacheWrite };
}

/**
 * 把宿主响应归一成界面要用的形状。
 *
 * 宿主已经算好了 `remainingPercent`，但这里**不信任**它 —— 客户端与宿主可能
 * 不同版本，百分比是可以从 `remaining` / `limit` 现算的派生值，用 constants 里
 * 那份实现重算一次，两端就不会各说各话。宿主没给或算不出来时才退回它给的值。
 *
 * @param payload 宿主 `/plan-usage` 的响应体（`{ ok, tier, eligible, windows, flags, ... }`）。
 * @returns `{ ok, code, tier, windows, flags, secondsUntilRefresh }`；非法输入给出 `ok:false`。
 */
export function planViewOf(payload) {
  if (payload === null || typeof payload !== 'object') {
    return { ok: false, code: 'UPSTREAM', tier: undefined, windows: [], flags: {} };
  }
  const flags = pickFlags(payload.flags);
  if (payload.ok !== true) {
    return {
      ok: false,
      code: typeof payload.code === 'string' ? payload.code : 'UPSTREAM',
      error: typeof payload.error === 'string' ? payload.error : undefined,
      tier: typeof payload.tier === 'string' ? payload.tier : undefined,
      windows: [],
      flags,
    };
  }
  const raw = Array.isArray(payload.windows) ? payload.windows : [];
  const windows = raw
    .map((window_) => {
      if (window_ === null || typeof window_ !== 'object') return undefined;
      const durationSeconds = typeof window_.durationSeconds === 'number' ? window_.durationSeconds : undefined;
      const label = windowLabelOf(durationSeconds);
      const remaining = typeof window_.remaining === 'number' && Number.isFinite(window_.remaining)
        ? window_.remaining
        : Number(window_.remaining);
      const limit =
        typeof window_.limit === 'number' && Number.isFinite(window_.limit) ? window_.limit : Number(window_.limit);
      // 现算优先；算不出来才用宿主给的（并把它归一成数字）。
      const computed = remainingPercentOf(remaining, limit);
      const fromHost = Number(window_.remainingPercent);
      const remainingPercent = computed ?? (Number.isFinite(fromHost) ? fromHost : undefined);
      const resetsInMs = Number(window_.resetsInMs);
      return {
        label,
        durationSeconds,
        remaining: Number.isFinite(remaining) ? remaining : undefined,
        limit: Number.isFinite(limit) ? limit : undefined,
        remainingPercent,
        resetsAt: typeof window_.resetsAt === 'string' ? window_.resetsAt : undefined,
        resetsInMs: Number.isFinite(resetsInMs) ? resetsInMs : undefined,
      };
    })
    .filter((window_) => window_ !== undefined);
  return {
    ok: true,
    code: undefined,
    tier: typeof payload.tier === 'string' ? payload.tier : undefined,
    eligible: payload.eligible === true,
    windows,
    flags,
  };
}

/**
 * 折叠态（那格窄读数）显示什么。
 *
 * 优先 5 小时窗口 —— 它是用户真正会顶到的那个限制，7 天窗口动得慢，放 tooltip。
 * 没有 5 小时窗口时退回第一个。
 *
 * @param windows planViewOf 产出的窗口数组。
 * @returns 选中的窗口，或 undefined。
 */
export function primaryWindowOf(windows) {
  if (!Array.isArray(windows) || windows.length === 0) return undefined;
  return windows.find((window_) => window_.label === '5h') ?? windows[0];
}

/**
 * 折叠态文案：`91% · 97%`（5 小时窗口、7 天窗口）。
 *
 * ⚠️ 只留两个额度窗口 —— **钱包与 token 都不常驻**。工具行那格宽度有限，
 * 四段挤在一起明显过长；钱包与 token 属于"想知道才看"的信息，点开面板看即可。
 *
 * 取不到的那个窗口显示 `—` 而**不是省略**：两个位置恒定，用户扫一眼就知道哪一侧
 * 缺数据，不会因为"少了一格"把 7 天错读成 5 小时。
 *
 * @param options `{ h5, d7, planOn, separator }`，h5/d7 是剩余百分比。
 * @returns 文本；额度开关关闭时返回空串（调用方据此不渲染读数）。
 */
export function collapseLabelOf(options) {
  const { h5, d7, planOn = true, separator = ' · ' } = options ?? {};
  if (!planOn) return '';
  const text = (percent) =>
    typeof percent === 'number' && Number.isFinite(percent) ? `${Math.round(percent)}%` : '—';
  return `${text(h5)}${separator}${text(d7)}`;
}

/**
 * 从窗口数组里取出 5 小时与 7 天两个剩余百分比。
 *
 * 按 `label` 找而**不是按下标** —— 上游将来多给一个窗口时，按下标会把 7 天
 * 当成 5 小时显示。
 *
 * @param windows planViewOf 产出的窗口数组。
 * @returns `{ h5, d7 }`，取不到的为 undefined。
 */
export function windowPercentsOf(windows) {
  const list = Array.isArray(windows) ? windows : [];
  const find = (label) => {
    const hit = list.find((window_) => window_?.label === label);
    return typeof hit?.remainingPercent === 'number' && Number.isFinite(hit.remainingPercent)
      ? hit.remainingPercent
      : undefined;
  };
  return { h5: find('5h'), d7: find('7d') };
}

/**
 * 窗口标签的本地化文本。
 *
 * @param label '5h' | '7d' | undefined
 * @param durationSeconds 未知窗口时用它推算小时数。
 * @param t 取词函数。
 * @returns 可读标签。
 */
export function windowLabelText(label, durationSeconds, t) {
  if (label === '5h') return t('usage.window5h');
  if (label === '7d') return t('usage.window7d');
  const hours = typeof durationSeconds === 'number' ? Math.round(durationSeconds / 3600) : undefined;
  return t('usage.windowUnknown', { hours: hours ?? '?' });
}

/**
 * 一个窗口的 tooltip 行文本：`5 小时剩余 62%（2 小时 21 分后重置）`。
 *
 * 倒计时用 `resetsInMs`（宿主返回的**服务端**相对值）而不是拿 `resetsAt`
 * 与本地时钟相减 —— 用户机器的时钟可能偏，服务端相对值不会。
 *
 * @param window_ planViewOf 产出的窗口。
 * @param t 取词函数。
 * @param locale 'zh' | 'en'。
 * @returns 文本。
 */
export function windowTooltipText(window_, t, locale = 'zh') {
  if (window_ === undefined || window_ === null) return '';
  const label = windowLabelText(window_.label, window_.durationSeconds, t);
  const percent =
    typeof window_.remainingPercent === 'number' && Number.isFinite(window_.remainingPercent)
      ? window_.remainingPercent
      : '—';
  const head = t('usage.remaining', { label, percent });
  if (typeof window_.resetsInMs !== 'number' || !Number.isFinite(window_.resetsInMs)) return head;
  const reset = formatDuration(window_.resetsInMs, locale);
  return `${head}（${t('usage.resetsIn', { duration: reset })}）`;
}

/** cookie/token 都没配时，额度请求必然 401，没必要发。由宿主返回的 code 判定。 */
export function isUnauthorizedCode(code) {
  return code === 'UNAUTHORIZED';
}

/**
 * 钱包余额的 tooltip 行文本。
 *
 * 分成两行说明「这笔钱是什么」：套餐额度用尽后会走它。订阅额度与充值额度
 * 分开列出，因为两者来源不同（一个是套餐附带、一个是自己充的），
 * 用户看到 `$1.50` 时通常想知道其中多少是充的。
 *
 * @param wallet walletViewOf 产出的视图。
 * @param t 取词函数。
 * @returns 文本行数组（可能为空）。
 */
export function walletTooltipLines(wallet, t) {
  if (wallet === undefined || wallet === null || wallet.ok !== true) return [];
  const lines = [t('usage.walletBalance', { amount: formatUsd(wallet.totalUsd) })];
  // 只有在拆分有意义时才列明细：两个来源都为 0 时列出来只是噪音。
  if (wallet.subscriptionUsd > 0 || wallet.rechargeUsd > 0) {
    lines.push(
      t('usage.walletBreakdown', {
        subscription: formatUsd(wallet.subscriptionUsd),
        recharge: formatUsd(wallet.rechargeUsd),
      }),
    );
  }
  return lines;
}

/**
 * 把宿主返回的钱包摘要归一成界面视图。
 *
 * 钱包是**第二个独立数据源**（`/api/v1/billing/summary`），生命周期与额度不同：
 * 额度是「这一轮还能用多少」，钱包是「套餐彻底用尽后还能花多少」。
 * 因此它单独归一、单独失败，不该拖累额度显示。
 *
 * @param payload 宿主响应里的 `wallet` 字段。
 * @returns 归一化后的钱包视图。
 */
export function walletViewOf(payload) {
  const empty = { ok: false, totalUsd: undefined, subscriptionUsd: undefined, rechargeUsd: undefined };
  if (payload === null || typeof payload !== 'object') return empty;
  if (payload.ok !== true) return { ...empty, code: typeof payload.code === 'string' ? payload.code : 'UPSTREAM' };
  const num = (value) => {
    const parsed = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  };
  const totalUsd = num(payload.totalUsd);
  // 总额都拿不到就没有可显示的东西，视为失败 —— 显示 $0.00 是在撒谎。
  if (totalUsd === undefined) return empty;
  return {
    ok: true,
    totalUsd,
    subscriptionUsd: num(payload.subscriptionUsd) ?? 0,
    rechargeUsd: num(payload.rechargeUsd) ?? 0,
    creditsPerUsd: num(payload.creditsPerUsd) ?? 0,
    totalCredits: num(payload.totalCredits) ?? 0,
    membershipTier: typeof payload.membershipTier === 'string' ? payload.membershipTier : undefined,
    totalConsumedUsd: num(payload.totalConsumedUsd) ?? 0,
    todayConsumedUsd: num(payload.todayConsumedUsd) ?? 0,
    usageCount: num(payload.usageCount) ?? 0,
  };
}

/**
 * 钱包余额的显示文本：`$1.50`。
 *
 * 美元保留两位小数 —— 控制台原文是 4 位（`"1.5000"`），但余额动的是分这一级，
 * 两位足够且更易读；0 元也显示 `$0.00` 而不是省略，因为「余额为 0」
 * 本身是用户需要知道的信息。
 *
 * @param usd 美元金额。
 * @returns 文本；非数字返回空串。
 */
export function formatUsd(usd) {
  if (typeof usd !== 'number' || !Number.isFinite(usd)) return '';
  return `$${usd.toFixed(2)}`;
}

/**
 * 把宿主的 `code` 归类成界面该有的反应。
 *
 * 宿主实测会给出这些码，**它们不是同一种东西**，混成一个通用错误态是错的：
 *
 *  - `NO_CREDENTIALS`：用户还没填凭据 —— 这是最常见的**初始状态**，不是故障。
 *    显示 `—` 即可，报错只会让刚装好插件的用户以为坏了。
 *  - `DISABLED`：用户自己关掉了额度开关。**正常状态**。若落到错误态，用户
 *    关掉显示后会看到一个莫名的报错（host-dev 额外加了这个码，正是为了
 *    「关了开关就不出网」，客户端必须配合）。
 *  - `UNAUTHORIZED`：凭据真的失效了 —— 唯一值得提示用户去处理的。
 *  - `UPSTREAM` / 其余：网络或程序错误，静默。
 *
 * @param code 宿主返回的 code。
 * @returns `'ok'`（正常态，不提示） | `'unauthorized'` | `'error'`
 */
export function classifyPlanCode(code) {
  if (code === undefined || code === null) return 'ok';
  if (code === 'DISABLED' || code === 'NO_CREDENTIALS') return 'ok';
  if (code === 'UNAUTHORIZED') return 'unauthorized';
  return 'error';
}

/**
 * 把开关注射进「折叠态能显示什么」。
 *
 * ⚠️ `any` 现在等价于 `planOn`，**不再是** `planOn || tokenOn`。
 *
 * 折叠态只显示两个额度窗口（钱包与 token 已移入面板），所以「有没有东西可显示」
 * 完全由 `planQuota` 决定。早期版本折叠态里还带 token，`any` 才需要或上 `tokenOn`；
 * 若沿用旧写法，会出现"关掉额度、只留 token 开关"时控件照旧渲染、却因为
 * `collapseLabelOf` 返回空串而露出一个空壳的怪状态。
 *
 * `tokenOn` 仍然有效 —— 它决定**面板明细**里显不显示 token 分项。
 *
 * @param flags 开关对象。
 * @returns `{ planOn, tokenOn, any }`
 */
export function flagVisibilityOf(flags) {
  const planOn = normalizeFlag(flags?.[FLAG_PLAN_QUOTA], true);
  const tokenOn = normalizeFlag(flags?.[FLAG_TOKEN_USAGE], true);
  return { planOn, tokenOn, any: planOn };
}

/** 控件的总开关（关掉后连插槽内容都不画）。 */
export function composerEnabledOf(flags) {
  return normalizeFlag(flags?.[FLAG_COMPOSER_USAGE], true);
}

/**
 * 刷新间隔：优先宿主设置，其次默认值；夹在允许区间内。
 *
 * @param settings 设置文档（可能带 volatile 活引用）。
 * @returns 毫秒数。
 */
export function refreshIntervalOf(settings) {
  const raw = settings?.[FIELD_REFRESH_INTERVAL];
  const value = raw !== null && typeof raw === 'object' && typeof raw.get === 'function' ? safeGet(raw) : raw;
  return normalizeRefreshInterval(value);
}

function safeGet(reference) {
  try {
    return reference.get();
  } catch {
    return undefined;
  }
}

/* ────────────────────────────────────────────────────────────────────────────
 * React 组件
 * ──────────────────────────────────────────────────────────────────────────── */

/**
 * 惰性取 React 绑定。
 *
 * 刻意不用顶层 `import { useState } from 'react'`：本模块要在 Node 里被
 * `import()` 冒烟测试（验收要求），而 Node 环境没有宿主提供的 `react` 解析路径，
 * 顶层 import 会直接让整个模块求值失败 —— 那样连纯函数也测不到。
 * 放进函数里，只有真正渲染时才需要 react，Node 侧只加载纯逻辑。
 *
 * ⚠️ 绝不 import 'react-dom'：workbuddy 踩过，它被 bundle 进去后因 process.env
 * 报错导致整个客户端加载失败。
 */
let reactModule;
function useReact() {
  if (reactModule === undefined) throw new Error(`[${PLUGIN_ID}] react 尚未就绪`);
  return reactModule;
}

/** 供入口在浏览器侧注入 React（避免顶层 import）。 */
export function bindReact(module_) {
  reactModule = module_;
}

/**
 * `react-dom`：只为 `createPortal` 一处需要。
 *
 * ⚠️ `react-dom` 是 baseline（在宿主冻结模块表里），所以可以 require。
 * 但**绝不要 import 整个 `react-dom`**（workbuddy 踩过：它被 bundle 进去后因
 * `process.env` 报错导致整个客户端加载失败）——这里同样只在函数内惰性取，
 * 且取不到时**降级为内联渲染**，不让整个控件不显示。
 */
let reactDomModule;
function useReactDom() {
  return reactDomModule;
}

/** 注入 react-dom（由 client.js 在 apply 里调用）。 */
export function bindReactDom(module_) {
  reactDomModule = module_;
}

/**
 * `@deepseek-ai/dsh-client-ui-primitives` 的惰性引用。
 *
 * ⚠️ **绝不在模块顶层 require**：本模块要在 Node 里被 `import()` 做纯逻辑
 * 冒烟测试，Node 环境没有那条基座表通道，顶层 require 会让整个模块求值失败
 * （连纯函数都测不到）。这里只持有一个引用，由 `bindPrimitives` 注入。
 */
let primitivesModule;

/**
 * `@deepseek-ai/dsh-client-ui-primitives` 绑定。
 *
 * 只放行这份**最小必需集**：缺任何一项都视为「没拿到原语」，整体退回
 * 旧的自绘面板路径（降级，但绝不抛错 —— 渲染期抛错会让插槽条目被
 * `SlotErrorBoundary` 永久撤销）。
 *
 * 为什么要点名而不是「有就用」：只拿到半份（例如没有 `MenuSurface`）时
 * 渲染到一半才发现缺失，比一开始就降级更糟 —— 后者行为可预期。
 *
 * @param module_ 原语模块；由 client.js 的 `loadPrimitives()` 惰性注入。
 */
export function bindPrimitives(module_) {
  primitivesModule = module_ ?? undefined;
}

/**
 * 判定一份原语模块是否完整可用。缺件返回 false。
 *
 * ⚠️ 组件判定不能用 `typeof x === 'function'`：官方 `Button` 与 `MenuSurface`
 * 都是 `forwardRef(...)` 的产物，运行时是**对象**（`{ $$typeof: Symbol(react.forward_ref), render }`），
 * 只有普通函数组件才是 function。用 `typeof === 'function'` 会把真 primitives
 * 判成"不可用"，于是永远走降级路径 —— 外观静默不统一，且没有任何报错。
 * 这里接受 function 或 object 两种可渲染形态。
 *
 * @param module_ 候选原语模块。
 * @returns 四项最小必需集齐全时为 true。
 */
export function primitivesUsable(module_) {
  if (module_ === null || module_ === undefined) return false;
  // React 组件类型只可能是：普通/函数组件（function），或 `forwardRef` /
  // `memo` / `lazy` / context 的产物（对象，且带 `$$typeof`）。按这个判，
  // 数组、字符串、随便一个普通对象都会被正确拒绝。
  const renderable = (value) =>
    typeof value === 'function' ||
    (value !== null && typeof value === 'object' && value.$$typeof !== undefined);
  return (
    renderable(module_.Button) &&
    renderable(module_.MenuSurface) &&
    typeof module_.useAnchoredPosition === 'function' &&
    typeof module_.useDismissOnOutsidePointer === 'function'
  );
}

/**
 * 惰性兜底：注入缺席时，直接在**函数内**从宿主基座表取原语。
 *
 * 任务契约是 `client.js` 在 `apply` 里调 `bindPrimitives(...)`（显式注入，
 * 首选路径）。这里再留一条兜底，理由：`bindPrimitives` 是新增接线，
 * 万一入口忘了调，插件会静默退化成"自绘外观"——没有任何报错，只有外观不统一
 * （属于最难发现的一类缺陷）。两条路都走基座表，取到的是同一个模块实例。
 *
 * ⚠️ 只在这里（**函数内**）用 `require`，模块顶层绝不 require：本模块要在
 * Node 里被 `import()` 冒烟测试，Node 没有那条通道，顶层 require 会让整个
 * 模块求值失败（连纯函数都测不到）。`typeof require === 'function'` 对未声明
 * 标识符是安全的。
 *
 * 结果缓存（成功与失败都缓存），避免每次渲染都 try/catch。
 */
let lazyPrimitives;
let lazyPrimitivesAttempted = false;
function requirePrimitivesLazily() {
  if (lazyPrimitivesAttempted) return lazyPrimitives;
  lazyPrimitivesAttempted = true;
  try {
    if (typeof require !== 'function') return undefined;
    const module_ = require('@deepseek-ai/dsh-client-ui-primitives');
    lazyPrimitives = module_?.default ?? module_;
  } catch {
    // 取不到就是降级路径，不需要噪音（`bindPrimitives` 通常已经成功）。
    lazyPrimitives = undefined;
  }
  return lazyPrimitives;
}

/** 取原语模块。注入优先，其次函数内惰性 require；都没有则返回 undefined（降级）。 */
function usePrimitives() {
  if (primitivesUsable(primitivesModule)) return primitivesModule;
  const lazy = requirePrimitivesLazily();
  return primitivesUsable(lazy) ? lazy : undefined;
}

/**
 * 取原语里的一个 hook。**必须无条件调用**（Rules of Hooks），所以这里不用
 * 三元短路去决定"调不调"，而是返回一个签名相同的兜底实现 —— hook 数量恒定。
 *
 * 兜底实现：
 *  - `useAnchoredPosition` 返回 `null`（面板隐藏定位 → 面板自身用
 *    `visibility:hidden` 兜住，绝不闪到左上角）；
 *  - `useDismissOnOutsidePointer` 空转（面板仍可用 Esc/再次点击收起）。
 *
 * ⚠️ 每次渲染都重新从 `primitivesModule` 读，而不是缓存函数引用：注入发生在
 * `apply` 时，可能晚于首次渲染；缓存会让"先渲染后注入"这一路永远拿不到原语。
 */
function usePrimitiveHook(name) {
  const primitives = usePrimitives();
  if (primitives !== undefined && typeof primitives[name] === 'function') return primitives[name];
  return NOOP_HOOKS[name];
}

/**
 * 兜底 hook 表。签名与 primitives 的官方导出一致：
 *  - `useAnchoredPosition(options)` → `{ left, top } | null`
 *  - `useDismissOnOutsidePointer(root, open, setOpen, portal)` → void
 *
 * ⚠️ 兜底实现**必须占用与官方实现相同的 hook 槽位**（官方分别是
 * `useState` + `useLayoutEffect` 与 `useEffect`）。理由：原语由 `bindPrimitives`
 * 在 `apply` 时注入，万一注入时机晚于本组件首次渲染，React 会在同一次渲染
 * 里看到 hook 数量变化，直接抛「Rendered more hooks than during the previous
 * render」—— 组件渲染失败、点击无反应（2026-10-15 事故的同款形状）。
 * 让两条路槽位数相同，注入早晚都不影响。
 */
const NOOP_HOOKS = {
  useAnchoredPosition: () => {
    const react = useReact();
    react.useState(null);
    react.useLayoutEffect(() => undefined);
    return null;
  },
  useDismissOnOutsidePointer: () => {
    const react = useReact();
    react.useEffect(() => undefined);
  },
};

/**
 * 组装触发控件。
 *
 * 原语可用时用 `Button`（`ghost` + `sm`），否则退回宿主原生 `<button type="button">`。
 * 两条路都是**真的 button 元素** —— 2026-10-15 实测：`div` + `onClick` 在真实宿主里
 * 点击无响应（同机已跑通的 `dsh-connect-workbuddy` 用的就是真 button）。
 *
 * ⚠️ 读数结构保持不变：`span` 包 glyph / sep / pct 三段。
 *
 * @returns 触发控件的 React 元素。
 */
function buildTrigger(options) {
  const { label, stale, expandable, openNow, ariaLabel, onToggle } = options;
  const primitives = usePrimitives();
  const children = [
    h('span', { className: 'dsh-odu-glyph', 'aria-hidden': true, key: 'glyph' }, 'OD'),
    h('span', { className: 'dsh-odu-sep', 'aria-hidden': true, key: 'sep' }, '·'),
    h('span', { className: 'dsh-odu-pct', key: 'pct' }, label),
  ];
  const shared = {
    className: 'dsh-odu-readout',
    'data-stale': stale ? 'true' : undefined,
    disabled: !expandable,
    'aria-haspopup': expandable ? 'dialog' : undefined,
    'aria-expanded': expandable ? openNow : undefined,
    'aria-label': ariaLabel,
    onClick: onToggle,
  };
  if (primitives !== undefined) {
    // `Button` 默认 `variant="ghost"` / `size="md"`；这里显式给 `sm`（28px 控件，
    // 与 composer 工具行同高）。`ghost` 的语义就是"默认透明、hover 浮一层"，
    // 正是读数该有的低调观感（`toolbar` 是常驻填充的工具条底色，太重）。
    return h(primitives.Button, { ...shared, variant: 'ghost', size: 'sm' }, ...children);
  }
  // 降级：宿主原生 button。className 与 Button 的 `sm` 几何对齐（28px / 12px）。
  return h('button', { ...shared, type: 'button' }, ...children);
}

/**
 * 组装展开面板。
 *
 * 原语可用时用 `MenuSurface` 做**材质层**（半透明填充 + 模糊 + 共享圆角 +
 * macOS 不透明底层），本插件只提供布局类与位置。原语缺失时退回裸 `div`。
 *
 * ⚠️ 为什么不套 `Menu`：`Menu` 的每一行都是 `<button role="menuitem">`
 * （可点选项语义），而这里是**只读信息**。硬套会把信息渲染成"点了会做某事"
 * 的假按钮，语义与无障碍都不对。`MenuSurface` 是纯材质层，官方 README 明确
 * 它是共享的（「`Menu` 将卡片材质交给 `MenuSurface`，自定义菜单也使用该组件」）。
 *
 * ⚠️ `MenuSurface` **转发 div 属性和 ref**，所以 `ref={panelRef}`、
 * `className`、`style`、`role` 都照常生效；它自己额外 portal 一个仅 darwin 可见的
 * 不透明底层到 `document.body`（CSS 锚点跟随），**这不是面板本身的 portal**。
 *
 * @param options 面板的 props 与子节点。
 * @returns 面板的 React 元素。
 */
function buildPanel(options) {
  const { panelRef, position, ariaLabel, children } = options;
  const primitives = usePrimitives();
  const shared = {
    ref: panelRef,
    className: 'dsh-odu-pop',
    // 定位由 useAnchoredPosition 给出（portal 到 body 之后面板脱离文档流，
    // 必须显式给坐标）。未定位完成时先藏着，避免闪一下左上角。
    // ⚠️ 定位回退（2026-10-16 实测修复）。
    //
    // `useAnchoredPosition` 在首次打开的那一帧可能返回 `null`（它要等
    // `useLayoutEffect` 量完锚点与面板尺寸才 setPosition）。旧写法是
    // `visibility:hidden` 藏着等下一次渲染 —— 但实测出现**永久隐藏**：
    // 面板已 portal、已挂载、`panelRef.current` 有值，`position` 却始终是 null
    // （`openEver` 涨到 5 次、面板一次都没被看见）。
    // 原因：`useAnchoredPosition` 的 `place()` 里 `anchorRef.current?.getBoundingClientRect()`
    // 若那一刻拿不到锚点就直接 return，`position` 保持 null；而 effect 的依赖
    // 在 `open` 不变时不会重跑，于是永远停在 null。
    //
    // 现在改成：定位未就绪时**仍然可见**，用一个贴近视口左下角的回退位置兜住
    // （工具行就在输入框左下角，这个位置与最终位置同区，不会"闪到左上角"）。
    // 定位一就绪就用真实坐标覆盖。宁可位置略偏，也绝不面板整块看不见。
    style: (() => {
      if (position !== null && position !== undefined) {
        return {
          position: 'fixed',
          left: `${position.left}px`,
          top: `${position.top}px`,
          visibility: 'visible',
        };
      }
      // 官方 hook 未就绪时的**同步兜底定位**。
      //
      // ⚠️ 为什么不能只写 `visibility:hidden` 等它：实测面板会**永久隐藏**
      // （`openEver` 涨到 5 次、一次都没被看见）。`useAnchoredPosition` 的
      // `place()` 里 `anchorRef.current?.getBoundingClientRect()` 拿不到锚点就直接
      // return，`position` 停在 null；而它的 effect 依赖在 `open` 不变时不会重跑。
      //
      // 这里直接量锚点自己算：锚点在工具行、面板浮在它**上方**（工具行贴着屏幕
      // 底部，朝下会被裁）。拿不到锚点时才退到视口左下角。
      try {
        const rect = rootRef.current?.getBoundingClientRect?.();
        if (rect !== undefined && rect !== null && rect.width > 0) {
          const width = 240; // 与 CSS 的 min/max-width 中间值一致，仅用于收边计算
          const left = Math.max(12, Math.min(rect.left, window.innerWidth - width - 12));
          const top = Math.max(12, rect.top - 8 - 160); // 面板高度未知，按典型高度上移
          return { position: 'fixed', left: `${left}px`, top: `${top}px`, visibility: 'visible' };
        }
      } catch {
        // 量不到就退到固定角落。
      }
      return { position: 'fixed', left: '12px', bottom: '96px', visibility: 'visible' };
    })(),
    role: 'dialog',
    'aria-label': ariaLabel,
    // 面板是只读信息，不接收键盘焦点：打开时不抢焦点，也不会让工具行的
    // Tab 序列多出一站。
    tabIndex: -1,
  };
  if (primitives !== undefined) return h(primitives.MenuSurface, shared, ...children);
  return h('div', shared, ...children);
}

/** `createElement` 的惰性包装：与上面的理由相同，Node 侧不碰 react。 */
function h(type, props, ...children) {
  const react = useReact();
  return react.createElement(type, props, ...children);
}

/**
 * Esc 收起：primitives 的 `useDismissOnOutsidePointer` **只处理 pointerdown**，
 * 不含键盘（读内核源码确认：它只注册 `pointerdown`）。面板是只读信息层，
 * Esc 关掉是工具行浮层的一致行为，所以这里补一个文档级 keydown。
 *
 * ⚠️ 与官方 hook 一样**必须无条件调用**（Rules of Hooks）；`open` 为假时不注册。
 *
 * @param open 面板是否展开。
 * @param setOpen open 的 setter。
 */
function useDismissOnEscape(open, setOpen) {
  const react = useReact();
  react.useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
    };
  }, [open, setOpen]);
}

/**
 * 只读读数控件。
 *
 * props 由插槽框架注入：`t`、`useProjection`、`flagsStore`、`settings`、
 * `sessionId`。
 */
export function UsageReadout(props) {
  ensureCss();
  const { useState, useEffect, useMemo, useCallback, useRef } = useReact();
  const { t, useProjection, flagsStore, settings } = props;
  
  const selection = typeof useProjection === 'function' ? useProjection('modelSelection') : undefined;
  const provider = providerOfSelection(selection);

  // 订阅本地开关 store：设置页一改这里立刻重渲染（不经过网络）。
  const [flags, setFlags] = useState(() => (flagsStore?.get() ?? {}));
  useEffect(() => {
    if (flagsStore === undefined || typeof flagsStore.subscribe !== 'function') return undefined;
    setFlags(flagsStore.get());
    return flagsStore.subscribe((next) => setFlags(next));
  }, [flagsStore]);

  const enabled = composerEnabledOf(flags) && isOwnProvider(provider);
  const { planOn, tokenOn, any } = flagVisibilityOf(flags);
  const tokenTotals = tokenTotalsOf(typeof useProjection === 'function' ? useProjection('tokenUsage') : undefined);
  const intervalMs = useMemo(() => refreshIntervalOf(settings), [settings]);

  const [plan, setPlan] = useState(undefined);
  // 钱包与额度分开存：它们是两个上游接口，任何一个失败都不该清掉另一个的读数。
  const [wallet, setWallet] = useState(undefined);
  const [stale, setStale] = useState(false);
  const [errorCode, setErrorCode] = useState(undefined);
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const inFlight = useRef(false);

  /**
   * 取额度。
   *
   * 只在「控件可见 + 额度开关打开」时调用 —— 切到别的 provider 后不该继续
   * 打着上游。失败保留上一次读数（只置 stale），这是静默降级：界面继续显示
   * 已知的数字，而不是清空成 `—`。
   */
  const load = useCallback(
    async (signal) => {
      if (inFlight.current) return;
      inFlight.current = true;
      try {
        const response = await fetch(ROUTE_PLAN_USAGE, {
          headers: { accept: 'application/json' },
          credentials: 'same-origin',
          ...(signal === undefined ? {} : { signal }),
        });
        if (!response.ok && response.status !== 401) throw new Error(`HTTP ${response.status}`);
        const payload = await response.json();
        if (signal?.aborted === true) return;
        const view = planViewOf(payload);
        // 钱包随同一个响应回来（宿主并发取了两个上游接口）。
        // 它**独立于额度**成功或失败：额度拿到、钱包没有时仍然显示额度。
        const walletView = walletViewOf(payload.wallet);
        setWallet(walletView.ok ? walletView : undefined);
        const fromNetwork = pickFlags(view.flags);
        if (Object.keys(fromNetwork).length > 0) flagsStore?.set(fromNetwork);
        if (view.ok) {
          setPlan(view);
          setStale(false);
          setErrorCode(undefined);
        } else {
          const kind = classifyPlanCode(view.code);
          // `NO_CREDENTIALS` / `DISABLED` 是正常态：不报错，只是没有数字可显示。
          // 前者清掉旧读数（凭据被删了就别再展示过期数字），后者保留 ——
          // 用户只是关了显示，数据本身仍然有效。
          if (kind === 'ok') {
            if (view.code === 'NO_CREDENTIALS') setPlan(undefined);
            setErrorCode(undefined);
            setStale(false);
          } else {
            setStale(true);
            setErrorCode(kind === 'unauthorized' ? 'UNAUTHORIZED' : 'UPSTREAM');
          }
        }
      } catch {
        // 网络错误/超时/JSON 解析失败：静默降级，保留上次数值。
        if (signal?.aborted !== true) {
          setStale(true);
          setErrorCode((previous) => previous ?? 'UPSTREAM');
        }
      } finally {
        inFlight.current = false;
      }
    },
    [flagsStore],
  );

  useEffect(() => {
    if (!enabled || !planOn) return undefined;
    const controller = new AbortController();
    load(controller.signal);
    const timer = setInterval(() => load(controller.signal), intervalMs);
    return () => {
      controller.abort();
      clearInterval(timer);
    };
  }, [enabled, planOn, intervalMs, load]);

    // ⚠️ 依赖数组必须是 `[]`：`openNow` 在本 hook **之后**才定义（它是从
  // `open` 与 `expandable` 推出来的），写进依赖会触发 TDZ
  // `Cannot access 'openNow' before initialization`（实测踩过，测试立刻变红）。
  // 而"每次打开都重测"这个诉求由下面的独立 effect 满足：它用 `openNow` 做依赖，
  // 位置在 `openNow` 定义**之后**。

  
  // ⚠️⚠️ 所有 hook 必须在这两条提前 return **之前**调用（Rules of Hooks）。
  // 2026-10-15 实测事故：`useCallback` 原本写在下面两条 return 之后，于是
  // `enabled`/`any`/`label` 变化时本组件的 hook 数量会变 —— React 抛
  // 「Rendered more hooks than during the previous render」，组件渲染失败。
  // 加任何新 hook 前先确认它在 return 之上。
  const panelRef = useRef(null);
  const expandable = planOn && (plan?.windows ?? []).length > 0;
  const openNow = open && expandable;
  // 锚点定位 + 外部点击收起 + Esc 收起：三者都必须无条件调用。
  // ⚠️ 两个 hook 来自 primitives 的官方导出，签名与本插件旧的手写实现完全一致：
  //    useAnchoredPosition({ open, anchorRef, panelRef, side, align, gap, margin })
  //      → { left, top } | null                      （side 默认 'bottom'，这里保持 'top'）
  //    useDismissOnOutsidePointer(root, open, setOpen, portal)
  //      → void                                      （portal = 面板 ref，算作"内部"）
  const useAnchoredPosition = usePrimitiveHook('useAnchoredPosition');
  const useDismissOnOutsidePointer = usePrimitiveHook('useDismissOnOutsidePointer');
  const position = useAnchoredPosition({
    open: openNow,
    anchorRef: rootRef,
    panelRef,
    // ⚠️ 保持 'top'：面板浮在输入框**上方**（工具行贴着屏幕底部，朝下会被裁）。
    // 官方默认是 'bottom'，所以这里必须显式传。
    side: 'top',
    gap: 8,
    margin: 12,
  });
  useDismissOnOutsidePointer(rootRef, openNow, setOpen, panelRef);
  useDismissOnEscape(openNow, setOpen);

  // ⚠️ 在两条提前 return **之前**记一次"为什么没渲染"。
  // 否则控件不出现时，诊断里只有 gate 那一行，看不出是开关关了、没有额度可显示、
  // 还是数据还没回来 —— 三种成因在用户侧都表现为"这里什么都没有"。

  if (!enabled || !any) return null;

  // 折叠态只显示两个额度窗口的百分比；钱包与 token 不常驻（太长），
  // 它们仍在下面的 tooltip 明细里。
  const percents = windowPercentsOf(plan?.windows);
  const label = collapseLabelOf({
    h5: planOn ? percents.h5 : undefined,
    d7: planOn ? percents.d7 : undefined,
    planOn,
  });
  if (label === '') return null;

  const problems = [];
  if (stale && errorCode === 'UNAUTHORIZED') problems.push(t('usage.unauthorized'));
  else if (stale && errorCode === 'UPSTREAM') problems.push(t('usage.upstreamError'));

  const reactDom = useReactDom();

  // 渲染留痕：这是唯一能看到「控件真的渲染出来了、长什么样」的通道
  // （渲染进程没有 CDP 端口）。只记类型名与布尔，不含任何用户数据。
  {
    const primitives = usePrimitives();
    const triggerKind =
      primitives !== undefined && primitivesUsable(primitives)
        ? 'primitives.Button'
        : 'native-button(fallback)';
    const panelKind =
      openNow && typeof reactDom?.createPortal === 'function'
        ? 'portal+MenuSurface'
        : openNow
          ? 'inline(fallback)'
          : 'closed';
  }

  if (openNow) {
  }

  return h(
    'span',
    { ref: rootRef, className: 'dsh-odu-root' },
    // ⚠️ 触发控件由 `buildTrigger` 组装：原语可用时是 primitives 的 `Button`
    // （`ghost` + `sm`，内部渲染的就是**真的** `<button type="button">`），
    // 否则退回宿主原生 button。两条路都是真 button —— 2026-10-15 实测：
    // `div` + onClick 在真实宿主里点击无响应（同机的 dsh-connect-workbuddy
    // 用的就是真 button，它的运行行为已在本机验证）。
    // 另外**不要**加 `onMouseDown: preventDefault()` —— 它会干扰宿主的点击派发。
    buildTrigger({
      label,
      stale,
      expandable,
      openNow,
      ariaLabel: t('usage.label'),
      onToggle: () => {
        if (!expandable) return;
        setOpen((value) => !value);
      },
    }),
    // ⚠️ 面板**必须 portal 到 `document.body`**。
    // 2026-10-15 实测：内联渲染 + `position:fixed` 时面板打不开/看不见 ——
    // composer 工具行上有 transform / overflow 之类的祖先，会把 fixed 定位的
    // containing block 改掉或直接裁掉。同机的 dsh-connect-workbuddy 正是用
    // createPortal 挂到 body（见其 lib/client.js 的 ComposerCredits）。
    // 代价：portal 之后面板**不再是 rootRef 的后代**，所以「点外部收起」必须
    // 把 panelRef 传给 primitives 的 useDismissOnOutsidePointer 的 portal 参数。
    // ⚠️ `MenuSurface` 自己**不做面板 portal** —— 它额外 portal 到 body 的只是
    // macOS 那条不可交互的不透明底层（CSS 锚点跟随），所以这里的 createPortal
    // 仍然必需，不能因为换了材质层就删掉。
    openNow && typeof reactDom?.createPortal === 'function'
      ? reactDom.createPortal(
          h(UsagePanel, {
            panelRef,
            position,
            plan,
            wallet,
            totals: tokenTotals,
            tokenOn,
            problems,
            t,
          }),
          document.body,
        )
      : null,
  );
}

/**
 * 展开面板：只读信息 + 官方菜单材质（`MenuSurface`）。
 *
 * 材质（半透明填充、模糊、共享圆角、macOS 不透明底层）由 primitives 的
 * `MenuSurface` 提供，本插件只给布局类 `.dsh-odu-pop` 与定位 style。
 * 原语缺失时 `buildPanel` 退回裸 `div`（外观降级，功能不变）。
 *
 * ⚠️ 为什么不套官方 `Menu`：`Menu` 的每一行都是 `<button role="menuitem">`
 * （可点选项语义），而这里是**只读信息**。硬套会把信息渲染成"点了会做某事"
 * 的假按钮，语义与无障碍都不对。
 *
 * @param props `{ panelRef, position, plan, wallet, totals, tokenOn, problems, t }`
 */
function UsagePanel(props) {
  const { panelRef, position, plan, wallet, totals, tokenOn, problems, t } = props;

  const rows = (plan?.windows ?? []).map((window_, index) =>
    h(
      'div',
      { className: 'dsh-odu-row', key: `${window_.label ?? 'window'}-${index}` },
      h('span', { className: 'dsh-odu-row-label' }, windowLabelText(window_.label, window_.durationSeconds, t)),
      h(
        'span',
        { className: 'dsh-odu-row-value' },
        typeof window_.remainingPercent === 'number' ? `${window_.remainingPercent}%` : '—',
        typeof window_.resetsInMs === 'number' && Number.isFinite(window_.resetsInMs)
          ? h(
              'span',
              { className: 'dsh-odu-reset' },
              ` · ${t('usage.resetsIn', { duration: formatDuration(window_.resetsInMs) })}`,
            )
          : null,
      ),
    ),
  );

  const walletLines = walletTooltipLines(wallet, t).map((text, index) =>
    h('div', { className: 'dsh-odu-row dsh-odu-row-note', key: `wallet-${index}` }, text),
  );

  const breakdown = tokenOn
    ? h(
        'div',
        { className: 'dsh-odu-breakdown' },
        `${t('usage.total')} ${formatTokenCount(totals.total)} · in ${formatTokenCount(totals.input)} · out ${formatTokenCount(totals.output)} · cr ${formatTokenCount(totals.cacheRead)} · cw ${formatTokenCount(totals.cacheWrite)}`,
      )
    : null;

  const notes = problems.map((text, index) => h('div', { className: 'dsh-odu-note', key: index }, text));

  const body = [...rows, ...walletLines, breakdown, ...notes].filter((node) => node !== null);

  return buildPanel({
    panelRef,
    position,
    ariaLabel: t('usage.label'),
    children: body,
  });
}

/**
 * provider gate。
 *
 * 注册是无条件的，这里决定渲染不渲染：`modelSelection` 的 provider 不属于
 * 本插件时 `return null`。因此切到别的 provider 不会留下空位，也不会继续
 * 发额度请求。
 */
export function UsageGate(props) {
  const { useProjection } = props;
  const selection = typeof useProjection === 'function' ? useProjection('modelSelection') : undefined;
  const provider = providerOfSelection(selection);
  const mine = isOwnProvider(provider);
  // 诊断留痕：gate 是最容易被误判的一环 —— "控件不见了"与"点击没反应"在用户侧
  // 都表现为"我点它没反应"，但成因完全不同。把每次 gate 判定记下来（含 provider
  // 名），才能区分这两种。
  if (!mine) return null;
  return h(UsageReadout, props);
}
