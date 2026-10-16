/**
 * dsh-opendesign-usage —— 共享常量与纯函数。
 *
 * 这一层**不 import 任何 DSH 包**，浏览器与 Node 都能加载，因此配置 schema、
 * 客户端控件、设置页与单元测试共用同一份规则，不会出现两份实现漂移。
 *
 * @module dsh-opendesign-usage/constants
 */

/** 插件的设置文档命名空间（设置页与该命名空间一一对应）。 */
export const SETTINGS_NAMESPACE = 'dsh-opendesign-usage';

/** 插件身份。插槽 id、HTTP 路由、locale 命名空间都由它派生。 */
export const PLUGIN_ID = 'dsh-opendesign-usage';

/**
 * 输入框工具行里那个只读控件的插槽 id。
 *
 * `conversation.input.left` 是 `kind: 'list'` 的 session 级插槽，list 槽
 * **必须**提供 id：复用别人的 id 会顶掉对方那一格，用新 id 才会并排出现。
 */
export const COMPOSER_SLOT_ID = `${PLUGIN_ID}-usage`;

/** 控件在同排里的次序（越小越靠左）。工具行已有控件占用小数值，这里排在它们之后。 */
export const COMPOSER_SLOT_ORDER = 40;

/**
 * 插件配置卡片的登记插槽。
 *
 * ⚠️ 新规范（`~/Projects/dsh-plugin-standards/docs/UI-STANDARDS.md` §0.2）：
 * 插件自己的设置**不再**注册进 `settings.section`（那是"设置"总页，只给官方领域基座用），
 * 而是注册进「插件」侧栏页里的**本插件详情页**。
 *
 * ⚠️⚠️ 2026-10-16 **二次修正**：详情页那一格用的是 **`plugins.bundle.config`**，
 * 不是 `plugins.item`。内核 `dsh-client-ui-plugin-manager/lib/client.js` 详情页：
 *
 *   <section data-plugin-config>
 *     renderSlot("plugins.bundle.config", { view: "page" }, { entryKey: pkg.name })
 *   </section>
 *
 * 即「以组合包包名为键、以 `view:"page"` 渲染在插件详情页里」。
 *
 * README 原文明确三者的分工：
 *  - 「`plugins.item`（list）用于**官方插件**，按其 label 列在**内置插件配置分组**里」
 *    → 第三方插件注册到这里会出现在"内置插件配置"下（用户反馈过这个错位）；
 *  - 「`plugins.bundle.config`（以组合包的包名为键）用于**组合包自己的配置**，
 *    显示在组合包页面的描述与行之间」→ 单包插件在详情页的配置区；
 *  - 「`plugins.row.config`（以 `<包名>#<行 id>` 为键）用于某一行的配置，
 *    这一行由此多出一个**配置**控件，打开该行**自己的页面**」→ 是"行页"，不是"详情页"。
 */
export const PLUGIN_DETAIL_CONFIG_SLOT = 'plugins.bundle.config';

/**
 * 详情页配置区的键 = **插件包名**（内核传的是 `entryKey: pkg.name`）。
 *
 * ⚠️ 与 keyed 槽不同：这里是 `entryKey`，不是 list 槽的 `id`、也不是行页的
 * `<包名>#<行 id>`。三者的键语义互不通用。
 */
export const PLUGIN_DETAIL_CONFIG_KEY = PLUGIN_ID;

/** 配置卡片在同一插槽内的次序（越小越靠前）。 */
export const SETTINGS_SLOT_ORDER = 10;

/**
 * 本插件服务的 provider。
 *
 * 之所以要一张表而不是直接写字符串：控件的 gate 与宿主路由的归属检查
 * 都读它，将来若 Open Design 再开一个 provider id（例如国际版），
 * 只需要在这里加一行，两处一起生效。
 */
export const PROVIDERS = { opendesign: 'opendesign' };

/** 上游计划的 5 小时窗口。 */
export const WINDOW_5H = 18000;
/** 上游计划的 7 天窗口。 */
export const WINDOW_7D = 604800;

/**
 * 上游 API 根。
 *
 * ⚠️ 注意它**不是**文档里写的 `api.amr.dev`（那个域名 2026-10-15 实测无 DNS 记录，
 * 是旧构件的残留）；也不是提供模型推理的 `amr-link.open-design.ai`。
 * 控制台的额度接口在同为 Cloudflare 后的 `amr-api` 主机上。
 */
export const API_ORIGIN = 'https://amr-api.open-design.ai';

/** 控制台站点源，上游接口会校验 Origin/Referer，因此必须带上。 */
export const CONSOLE_ORIGIN = 'https://open-design.ai';

/**
 * 承载登录态的 cookie 名。
 *
 * 上游控制台用 better-auth，会话 token 存在这个 cookie 里（带 `__Secure-` 前缀，
 * 因此只在 HTTPS 下回传）。用户需要从浏览器里把它抄进来 —— 见设置页说明。
 */
export const SESSION_COOKIE_NAME = '__Secure-better-auth.session_token';

/** 三个功能开关的字段名（设置页与 Config schema 共用，避免字符串写两遍）。 */
export const FLAG_COMPOSER_USAGE = 'enableComposerUsage';
export const FLAG_PLAN_QUOTA = 'enablePlanQuota';
export const FLAG_TOKEN_USAGE = 'enableTokenUsage';

/** 凭据字段名。 */
export const FIELD_WORKSPACE_ID = 'workspaceId';
export const FIELD_SESSION_COOKIE = 'sessionCookie';
export const FIELD_REFRESH_INTERVAL = 'refreshIntervalMs';

/** 额度刷新间隔的允许区间（毫秒）。 */
export const DEFAULT_REFRESH_INTERVAL_MS = 300000;
export const MIN_REFRESH_INTERVAL_MS = 60000;
export const MAX_REFRESH_INTERVAL_MS = 3600000;

/** 单个请求体上限：这里只有小 JSON，超过 64 KiB 直接拒绝。 */
export const MAX_BODY_BYTES = 64 * 1024;

/** 上游请求超时。额度接口实测 < 1s，10s 足够且不至于把界面卡住。 */
export const UPSTREAM_TIMEOUT_MS = 10000;

/** 宿主侧两条同源路由。 */
export const ROUTE_PLAN_USAGE = `/plugins/${PLUGIN_ID}/plan-usage`;
export const ROUTE_TEST_CONNECTION = `/plugins/${PLUGIN_ID}/test-connection`;

/** 默认设置。设置的「未配置」状态一律由这里定义，不在各处写零散默认值。 */
export function defaultSettings() {
  return {
    [FLAG_COMPOSER_USAGE]: true,
    [FLAG_PLAN_QUOTA]: true,
    [FLAG_TOKEN_USAGE]: true,
    [FIELD_WORKSPACE_ID]: '',
    [FIELD_SESSION_COOKIE]: '',
    [FIELD_REFRESH_INTERVAL]: DEFAULT_REFRESH_INTERVAL_MS,
  };
}

/**
 * 规范化开关值。
 *
 * 只有真正的布尔才被接受，其余（undefined、字符串 'false'、null）都退回
 * `fallback`。设置作用域在命名空间尚未绑定时会给出 undefined，这时退回默认值
 * 而不是把「未配置」误判成「已关闭」。
 *
 * @param value 原始值。
 * @param fallback 无法判定时使用的值。
 * @returns 布尔值。
 */
export function normalizeFlag(value, fallback) {
  return typeof value === 'boolean' ? value : fallback;
}

/**
 * 规范化刷新间隔：夹在允许区间内，非数字退回默认。
 *
 * @param value 原始值。
 * @returns 毫秒数。
 */
export function normalizeRefreshInterval(value) {
  const number = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(number)) return DEFAULT_REFRESH_INTERVAL_MS;
  return Math.min(MAX_REFRESH_INTERVAL_MS, Math.max(MIN_REFRESH_INTERVAL_MS, Math.round(number)));
}

/**
 * 规范化一串文本设置：只保留字符串并去掉首尾空白。
 *
 * @param value 原始值。
 * @returns 去掉首尾空白的字符串，非字符串时为空串。
 */
export function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/**
 * workspaceId 是否形如上游的 id。
 *
 * 上游用的是 24 位小写 base32 风格串；这里放宽到「非空且只含字母数字」，
 * 因为把格式判得过死会在上游改 id 规则时误伤，而真正的校验是「测试连接」。
 *
 * @param value 原始值。
 * @returns 是否看起来可用。
 */
export function looksLikeWorkspaceId(value) {
  const text = normalizeText(value);
  return /^[A-Za-z0-9_-]{6,64}$/.test(text);
}

/**
 * 把用户粘贴的 cookie 输入收敛成**裸 token**。
 *
 * 用户可能整段粘贴 `__Secure-better-auth.session_token=xxx; other=y`，也可能
 * 只粘 `xxx`，还可能带上 `Cookie:` 前缀。三种都要能用，否则设置页会显得
 * 「填了却连不上」。解析结果里绝不保留 cookie 名与分号。
 *
 * @param value 用户输入。
 * @returns 裸 token；无法解析时为空串。
 */
export function normalizeSessionCookie(value) {
  let text = normalizeText(value);
  if (text === '') return '';
  // 容忍整段头部粘贴。
  text = text.replace(/^cookie\s*:\s*/i, '');
  // 从 `k=v; k2=v2` 里挑出目标 cookie。
  if (text.includes('=')) {
    for (const part of text.split(';')) {
      const at = part.indexOf('=');
      if (at === -1) continue;
      const name = part.slice(0, at).trim();
      const value2 = part.slice(at + 1).trim();
      if (name === SESSION_COOKIE_NAME || name === 'session_token') return value2;
    }
    // 没有任何已知 cookie 名：把整段当作 `name=value` 取右侧。
    const eq = text.indexOf('=');
    const only = text.slice(eq + 1).trim();
    if (only !== '') return only;
  }
  return text;
}

/**
 * 把上游窗口的 `durationSeconds` 归一成界面标签键。
 *
 * 上游目前给 18000 与 604800 两种；未来若新增窗口，返回 undefined 让调用方
 * 用通用文案兜底，而不是把它错标成 5 小时或 7 天。
 *
 * @param seconds 上游的 durationSeconds。
 * @returns '5h' | '7d' | undefined
 */
export function windowLabelOf(seconds) {
  if (seconds === WINDOW_5H) return '5h';
  if (seconds === WINDOW_7D) return '7d';
  return undefined;
}

/**
 * 计算剩余百分比。
 *
 * 上限按 `limit` 而不是「剩余 + 已用」算 —— 所以「已超额」会自然给出 0，
 * 而不是出现负数或被夹到 100。
 *
 * @param remaining 剩余额度。
 * @param limit 总额度。
 * @returns 0-100 之间的数，保留一位小数；无法计算时返回 undefined。
 */
export function remainingPercentOf(remaining, limit) {
  if (!Number.isFinite(remaining) || !Number.isFinite(limit) || limit <= 0) return undefined;
  const percent = (remaining / limit) * 100;
  const clamped = Math.min(100, Math.max(0, percent));
  return Math.round(clamped * 10) / 10;
}

/**
 * 把一个毫秒时长说成人话（用于「X 后重置」）。
 *
 * 只给两级单位：`2小时21分`、`6天21小时`。已经过期则给 `即将重置`。
 *
 * @param ms 毫秒数。
 * @param locale 'zh' | 'en'
 * @returns 可读文本。
 */
export function formatDuration(ms, locale = 'zh') {
  if (!Number.isFinite(ms)) return '';
  if (ms <= 0) return locale === 'en' ? 'resetting now' : '即将重置';
  const totalMinutes = Math.floor(ms / 60000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (locale === 'en') {
    if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`;
    if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
    return `${minutes}m`;
  }
  if (days > 0) return hours > 0 ? `${days}天${hours}小时` : `${days}天`;
  if (hours > 0) return minutes > 0 ? `${hours}小时${minutes}分` : `${hours}小时`;
  return `${minutes}分`;
}

/**
 * 把 token 数说成紧凑形式：`12.3k`、`1.2M`。
 *
 * 工具行那格只有几十像素宽，完整数字放不下；精确值放在 tooltip 里。
 *
 * @param value token 数。
 * @returns 紧凑文本。
 */
export function formatTokenCount(value) {
  if (!Number.isFinite(value) || value < 0) return '0';
  if (value < 1000) return String(Math.round(value));
  if (value < 1000000) {
    const k = value / 1000;
    return `${k < 10 ? k.toFixed(1) : Math.round(k)}k`;
  }
  const m = value / 1000000;
  return `${m < 10 ? m.toFixed(1) : Math.round(m)}M`;
}
