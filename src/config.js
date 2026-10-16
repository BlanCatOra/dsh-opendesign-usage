/**
 * dsh-opendesign-usage —— Host 配置 schema。
 *
 * `volatile()` 的语义（沿用 dsh-prompt-expander 里实测确认的结论，不是照猜）：
 * 被标记的字段在插值结果里不是普通值，而是一个 `{ get(), [write] }` 活引用。
 * 读取时必须 `.get()`，否则拿到的是个对象，比较与赋值全都不成立 ——
 * 这是「设置页改了没反应」这类缺陷的根源。
 *
 * 所以本模块导出两样东西：
 *  - `Config`：交给 DSH 的 settings 服务（它自己知道怎么处理活引用）；
 *  - `resolveConfig(raw)`：给 Host 代码用的普通值视图，统一剥掉引用并规整。
 *
 * @module dsh-opendesign-usage/config
 */
import z from '@deepseek-ai/schemastery';
import {
  DEFAULT_REFRESH_INTERVAL_MS,
  FIELD_REFRESH_INTERVAL,
  FIELD_SESSION_COOKIE,
  FIELD_WORKSPACE_ID,
  FLAG_COMPOSER_USAGE,
  FLAG_PLAN_QUOTA,
  FLAG_TOKEN_USAGE,
  MAX_REFRESH_INTERVAL_MS,
  MIN_REFRESH_INTERVAL_MS,
  defaultSettings,
  normalizeFlag,
  normalizeRefreshInterval,
  normalizeSessionCookie,
  normalizeText,
} from './constants.js';

/** 兼容不支持 volatile() 的 schemastery：原样返回，行为退化为普通字段。 */
function asVolatile(schema) {
  return typeof schema.volatile === 'function' ? schema.volatile() : schema;
}

/** Host 侧配置。 */
export const Config = z.object({
  /** 在输入框工具行显示只读用量控件。关掉后控件完全不注册任何请求。 */
  [FLAG_COMPOSER_USAGE]: asVolatile(
    z.boolean().default(true).description('在输入框显示 Open Design 用量控件（仅在该 provider 被选中时出现）'),
  ),
  /** 显示套餐额度。需要下面的 workspaceId 与 sessionCookie。 */
  [FLAG_PLAN_QUOTA]: asVolatile(
    z.boolean().default(true).description('显示 Open Design 套餐额度（5 小时 / 7 天窗口），需要凭据'),
  ),
  /** 显示本会话 token 用量。纯读宿主投影，不需要凭据。 */
  [FLAG_TOKEN_USAGE]: asVolatile(
    z.boolean().default(true).description('显示本会话累计 token 用量（读宿主投影，无需凭据）'),
  ),
  /** 控制台工作区 id。 */
  [FIELD_WORKSPACE_ID]: asVolatile(
    z.string().default('').description('Open Design 控制台的工作区 id（dashboard URL 里的 workspaceId 参数）'),
  ),
  /** 控制台登录态 token。 */
  [FIELD_SESSION_COOKIE]: asVolatile(
    z.string().default('').description('控制台登录态：__Secure-better-auth.session_token 的值'),
  ),
  /** 额度刷新间隔。 */
  [FIELD_REFRESH_INTERVAL]: asVolatile(
    z
      .natural()
      .min(MIN_REFRESH_INTERVAL_MS)
      .max(MAX_REFRESH_INTERVAL_MS)
      .default(DEFAULT_REFRESH_INTERVAL_MS)
      .description('额度刷新间隔（毫秒）'),
  ),
});

/** 剥掉一层 volatile 活引用。 */
function unwrap(value) {
  if (value !== null && typeof value === 'object' && typeof value.get === 'function') {
    try {
      return value.get();
    } catch {
      return undefined;
    }
  }
  return value;
}

/** 递归剥掉所有 volatile 活引用。 */
export function unwrapDeep(value) {
  const once = unwrap(value);
  if (once === null || typeof once !== 'object') return once;
  if (Array.isArray(once)) return once.map(unwrapDeep);
  const out = {};
  for (const [key, item] of Object.entries(once)) out[key] = unwrapDeep(item);
  return out;
}

/**
 * 把 Host 配置（可能含活引用）变成普通值设置对象。
 *
 * 每个字段都过一遍 `normalize*`，所以调用方拿到的设置一定合法：
 * 布尔一定是布尔、间隔一定在区间内、cookie 一定是**裸 token**（不是整段
 * cookie 头），因此路由代码不需要再做防御式判断。
 *
 * @param raw 行配置或插值后的配置。
 * @returns 规整过的设置，字段一定存在且合法。
 */
export function resolveConfig(raw = {}) {
  const plain = unwrapDeep(raw) ?? {};
  const base = defaultSettings();
  return {
    [FLAG_COMPOSER_USAGE]: normalizeFlag(plain[FLAG_COMPOSER_USAGE], base[FLAG_COMPOSER_USAGE]),
    [FLAG_PLAN_QUOTA]: normalizeFlag(plain[FLAG_PLAN_QUOTA], base[FLAG_PLAN_QUOTA]),
    [FLAG_TOKEN_USAGE]: normalizeFlag(plain[FLAG_TOKEN_USAGE], base[FLAG_TOKEN_USAGE]),
    [FIELD_WORKSPACE_ID]: normalizeText(plain[FIELD_WORKSPACE_ID]),
    [FIELD_SESSION_COOKIE]: normalizeSessionCookie(plain[FIELD_SESSION_COOKIE]),
    [FIELD_REFRESH_INTERVAL]: normalizeRefreshInterval(
      plain[FIELD_REFRESH_INTERVAL] ?? base[FIELD_REFRESH_INTERVAL],
    ),
  };
}

/**
 * 判断凭据是否齐备到可以打上游。
 *
 * 单独抽出来是因为「开关开着但没填凭据」是最常见的状态，界面应当直接提示
 * 「去设置里填」而不是发一个注定 401 的请求。
 *
 * @param settings resolveConfig 的结果。
 * @returns 是否可用。
 */
export function hasCredentials(settings) {
  return settings[FIELD_WORKSPACE_ID] !== '' && settings[FIELD_SESSION_COOKIE] !== '';
}
