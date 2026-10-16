/**
 * dsh-opendesign-usage —— 浏览器侧 bundle。
 *
 * 本文件由 build-client.mjs 从 src/ 生成，请勿手改；改 src/ 后重新运行：
 *   node build-client.mjs
 */

window.__ModuleLoader__.load({
	id: "dsh-opendesign-usage",
	factory: (require) => {
		var __dshRegistry = new Map();
		var __dshCache = new Map();
		/** 宿主基座模块（react 等）由外壳的冻结模块表提供。 */
		function __dshExternal(name) { return require(name); }
		/** 按模块键懒加载；每个模块只执行一次。 */
		function __dshRequire(key) {
			key = key.replace(/^\.\//, "");
			if (__dshCache.has(key)) return __dshCache.get(key);
			var factory = __dshRegistry.get(key);
			if (factory === undefined) throw new Error("dsh-opendesign-usage: unknown module " + key);
			var exports = {};
			__dshCache.set(key, exports);
			factory(exports);
			return exports;
		}
		__dshRegistry.set("constants.js", (__exports) => {
			var module = { exports: __exports };
			/**
			 * dsh-opendesign-usage —— 共享常量与纯函数。
			 *
			 * 这一层**不 import 任何 DSH 包**，浏览器与 Node 都能加载，因此配置 schema、
			 * 客户端控件、设置页与单元测试共用同一份规则，不会出现两份实现漂移。
			 *
			 * @module dsh-opendesign-usage/constants
			 */

			/** 插件的设置文档命名空间（设置页与该命名空间一一对应）。 */
			const SETTINGS_NAMESPACE = 'dsh-opendesign-usage';

			/** 插件身份。插槽 id、HTTP 路由、locale 命名空间都由它派生。 */
			const PLUGIN_ID = 'dsh-opendesign-usage';

			/**
			 * 输入框工具行里那个只读控件的插槽 id。
			 *
			 * `conversation.input.left` 是 `kind: 'list'` 的 session 级插槽，list 槽
			 * **必须**提供 id：复用别人的 id 会顶掉对方那一格，用新 id 才会并排出现。
			 */
			const COMPOSER_SLOT_ID = `${PLUGIN_ID}-usage`;

			/** 控件在同排里的次序（越小越靠左）。工具行已有控件占用小数值，这里排在它们之后。 */
			const COMPOSER_SLOT_ORDER = 40;

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
			const PLUGIN_DETAIL_CONFIG_SLOT = 'plugins.bundle.config';

			/**
			 * 详情页配置区的键 = **插件包名**（内核传的是 `entryKey: pkg.name`）。
			 *
			 * ⚠️ 与 keyed 槽不同：这里是 `entryKey`，不是 list 槽的 `id`、也不是行页的
			 * `<包名>#<行 id>`。三者的键语义互不通用。
			 */
			const PLUGIN_DETAIL_CONFIG_KEY = PLUGIN_ID;

			/** 配置卡片在同一插槽内的次序（越小越靠前）。 */
			const SETTINGS_SLOT_ORDER = 10;

			/**
			 * 本插件服务的 provider。
			 *
			 * 之所以要一张表而不是直接写字符串：控件的 gate 与宿主路由的归属检查
			 * 都读它，将来若 Open Design 再开一个 provider id（例如国际版），
			 * 只需要在这里加一行，两处一起生效。
			 */
			const PROVIDERS = { opendesign: 'opendesign' };

			/** 上游计划的 5 小时窗口。 */
			const WINDOW_5H = 18000;
			/** 上游计划的 7 天窗口。 */
			const WINDOW_7D = 604800;

			/**
			 * 上游 API 根。
			 *
			 * ⚠️ 注意它**不是**文档里写的 `api.amr.dev`（那个域名 2026-10-15 实测无 DNS 记录，
			 * 是旧构件的残留）；也不是提供模型推理的 `amr-link.open-design.ai`。
			 * 控制台的额度接口在同为 Cloudflare 后的 `amr-api` 主机上。
			 */
			const API_ORIGIN = 'https://amr-api.open-design.ai';

			/** 控制台站点源，上游接口会校验 Origin/Referer，因此必须带上。 */
			const CONSOLE_ORIGIN = 'https://open-design.ai';

			/**
			 * 承载登录态的 cookie 名。
			 *
			 * 上游控制台用 better-auth，会话 token 存在这个 cookie 里（带 `__Secure-` 前缀，
			 * 因此只在 HTTPS 下回传）。用户需要从浏览器里把它抄进来 —— 见设置页说明。
			 */
			const SESSION_COOKIE_NAME = '__Secure-better-auth.session_token';

			/** 三个功能开关的字段名（设置页与 Config schema 共用，避免字符串写两遍）。 */
			const FLAG_COMPOSER_USAGE = 'enableComposerUsage';
			const FLAG_PLAN_QUOTA = 'enablePlanQuota';
			const FLAG_TOKEN_USAGE = 'enableTokenUsage';

			/** 凭据字段名。 */
			const FIELD_WORKSPACE_ID = 'workspaceId';
			const FIELD_SESSION_COOKIE = 'sessionCookie';
			const FIELD_REFRESH_INTERVAL = 'refreshIntervalMs';

			/** 额度刷新间隔的允许区间（毫秒）。 */
			const DEFAULT_REFRESH_INTERVAL_MS = 300000;
			const MIN_REFRESH_INTERVAL_MS = 60000;
			const MAX_REFRESH_INTERVAL_MS = 3600000;

			/** 单个请求体上限：这里只有小 JSON，超过 64 KiB 直接拒绝。 */
			const MAX_BODY_BYTES = 64 * 1024;

			/** 上游请求超时。额度接口实测 < 1s，10s 足够且不至于把界面卡住。 */
			const UPSTREAM_TIMEOUT_MS = 10000;

			/** 宿主侧两条同源路由。 */
			const ROUTE_PLAN_USAGE = `/plugins/${PLUGIN_ID}/plan-usage`;
			const ROUTE_TEST_CONNECTION = `/plugins/${PLUGIN_ID}/test-connection`;

			/** 默认设置。设置的「未配置」状态一律由这里定义，不在各处写零散默认值。 */
			function defaultSettings() {
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
			function normalizeFlag(value, fallback) {
			  return typeof value === 'boolean' ? value : fallback;
			}

			/**
			 * 规范化刷新间隔：夹在允许区间内，非数字退回默认。
			 *
			 * @param value 原始值。
			 * @returns 毫秒数。
			 */
			function normalizeRefreshInterval(value) {
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
			function normalizeText(value) {
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
			function looksLikeWorkspaceId(value) {
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
			function normalizeSessionCookie(value) {
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
			function windowLabelOf(seconds) {
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
			function remainingPercentOf(remaining, limit) {
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
			function formatDuration(ms, locale = 'zh') {
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
			function formatTokenCount(value) {
			  if (!Number.isFinite(value) || value < 0) return '0';
			  if (value < 1000) return String(Math.round(value));
			  if (value < 1000000) {
			    const k = value / 1000;
			    return `${k < 10 ? k.toFixed(1) : Math.round(k)}k`;
			  }
			  const m = value / 1000000;
			  return `${m < 10 ? m.toFixed(1) : Math.round(m)}M`;
			}

			Object.assign(__exports, { "SETTINGS_NAMESPACE": SETTINGS_NAMESPACE, "PLUGIN_ID": PLUGIN_ID, "COMPOSER_SLOT_ID": COMPOSER_SLOT_ID, "COMPOSER_SLOT_ORDER": COMPOSER_SLOT_ORDER, "PLUGIN_DETAIL_CONFIG_SLOT": PLUGIN_DETAIL_CONFIG_SLOT, "PLUGIN_DETAIL_CONFIG_KEY": PLUGIN_DETAIL_CONFIG_KEY, "SETTINGS_SLOT_ORDER": SETTINGS_SLOT_ORDER, "PROVIDERS": PROVIDERS, "WINDOW_5H": WINDOW_5H, "WINDOW_7D": WINDOW_7D, "API_ORIGIN": API_ORIGIN, "CONSOLE_ORIGIN": CONSOLE_ORIGIN, "SESSION_COOKIE_NAME": SESSION_COOKIE_NAME, "FLAG_COMPOSER_USAGE": FLAG_COMPOSER_USAGE, "FLAG_PLAN_QUOTA": FLAG_PLAN_QUOTA, "FLAG_TOKEN_USAGE": FLAG_TOKEN_USAGE, "FIELD_WORKSPACE_ID": FIELD_WORKSPACE_ID, "FIELD_SESSION_COOKIE": FIELD_SESSION_COOKIE, "FIELD_REFRESH_INTERVAL": FIELD_REFRESH_INTERVAL, "DEFAULT_REFRESH_INTERVAL_MS": DEFAULT_REFRESH_INTERVAL_MS, "MIN_REFRESH_INTERVAL_MS": MIN_REFRESH_INTERVAL_MS, "MAX_REFRESH_INTERVAL_MS": MAX_REFRESH_INTERVAL_MS, "MAX_BODY_BYTES": MAX_BODY_BYTES, "UPSTREAM_TIMEOUT_MS": UPSTREAM_TIMEOUT_MS, "ROUTE_PLAN_USAGE": ROUTE_PLAN_USAGE, "ROUTE_TEST_CONNECTION": ROUTE_TEST_CONNECTION, "defaultSettings": defaultSettings, "normalizeFlag": normalizeFlag, "normalizeRefreshInterval": normalizeRefreshInterval, "normalizeText": normalizeText, "looksLikeWorkspaceId": looksLikeWorkspaceId, "normalizeSessionCookie": normalizeSessionCookie, "windowLabelOf": windowLabelOf, "remainingPercentOf": remainingPercentOf, "formatDuration": formatDuration, "formatTokenCount": formatTokenCount });
		});
		__dshRegistry.set("flags-store.js", (__exports) => {
			var module = { exports: __exports };
			/**
			 * dsh-opendesign-usage —— 三个功能开关的本地即时镜像。
			 *
			 * 为什么需要这一层：开关的真源在 Host 的 Config（volatile 字段），而输入框
			 * 控件在**另一个渲染子树**里，它只能通过插槽拿到的 face 读值。如果让它靠
			 * 「每次请求顺带回来的 flags」来反映设置变化，用户改完开关要等一个刷新周期
			 * （默认 5 分钟）才能看到反应 —— 那正是 workbuddy 4.3.0「设置页改了没用」
			 * 的缺陷形状，必须避免。
			 *
			 * 所以这里放一个极小的订阅式 store：
			 *  - 设置页写入（`set`）→ 立刻通知订阅者 → 输入框控件同步重渲染，零网络延迟；
			 *  - 网络回来的 `flags` 也写进来（`set`），作为**冷启动**与**兜底**来源，
			 *    这样重新加载页面后、设置页还没打开时控件也能拿到正确开关。
			 *
			 * 两条写入路径共用同一个 store，因此不会出现「本地值」与「宿主值」两个真相。
			 *
			 * @module dsh-opendesign-usage/flags-store
			 */
			const { FLAG_COMPOSER_USAGE, FLAG_PLAN_QUOTA, FLAG_TOKEN_USAGE, normalizeFlag } = __dshRequire("./constants.js");

			/** 本 store 内部使用的规范字段名（= Config schema 的字段名，也是设置页写入用的名字）。 */
			const FLAG_KEYS = [FLAG_COMPOSER_USAGE, FLAG_PLAN_QUOTA, FLAG_TOKEN_USAGE];

			/**
			 * 同一批开关的**短名**别名。
			 *
			 * 为什么需要这张表：三个方向用的名字不一样，这是实测出来的事实，不是猜测 ——
			 *  - 宿主 `flagsOf()` 在 `/plan-usage` 响应里返回**短名**（`composerUsage`）；
			 *  - 设置页经 `flagsStore.set()` 写入的是**长名**（`enableComposerUsage`，即
			 *    Config 字段名），因为它直接复用 `FLAG_*` 常量；
			 *  - 控件从 store 读，也只能是长名。
			 *
			 * 于是宿主是唯一的短名生产者。如果只在长名上做匹配，宿主回来的 flags 会被
			 * 整个丢弃 —— 冷启动兜底静默失效（页面刷新后控件拿到的是默认值），而设置页
			 * 的即时写入看起来又是正常的，这种「一半能用」最难查。
			 *
			 * 处理方式：**内部一律规范化成长名**，在入口处把短名翻译过来。这样 store 只有
			 * 一套真相，宿主与设置页都只需各自记住自己的那份名字。
			 */
			const FLAG_ALIASES = {
			  composerUsage: FLAG_COMPOSER_USAGE,
			  planQuota: FLAG_PLAN_QUOTA,
			  tokenUsage: FLAG_TOKEN_USAGE,
			};

			/**
			 * 把任意来源里的开关字段规范化成长名。
			 *
			 * 长名优先于短名（同一个对象里两者都给且矛盾时，长名是设置文档的真源）。
			 * 只接受真正的布尔，其余原样跳过。
			 *
			 * @param source 任意对象（可为 undefined / null）。
			 * @returns 只含长名的对象（只收有效布尔）。
			 */
			function canonicalFlags(source) {
			  const out = {};
			  if (source === null || typeof source !== 'object') return out;
			  for (const [alias, key] of Object.entries(FLAG_ALIASES)) {
			    if (typeof source[alias] === 'boolean' && typeof source[key] !== 'boolean') out[key] = source[alias];
			  }
			  for (const key of FLAG_KEYS) {
			    if (typeof source[key] === 'boolean') out[key] = source[key];
			  }
			  return out;
			}

			/**
			 * 从任意来源（Host 响应、设置草稿、getSnapshot）里挑出开关值。
			 *
			 * 只接受真正的布尔：`undefined`／缺字段／字符串 `'false'` 一律**不覆盖**
			 * 现有值。这条规则是刻意的 —— 「宿主没说」和「用户关掉了」必须区分开，
			 * 否则一次请求失败就会把用户打开的开关悄悄关掉。
			 *
			 * 短名（宿主响应）会被翻译成长名，见 {@link FLAG_ALIASES}。
			 *
			 * @param source 任意对象（可为 undefined / null）。
			 * @returns 只含有效布尔字段的补丁对象（长名）。
			 */
			function pickFlags(source) {
			  const nested = source !== null && typeof source === 'object' && typeof source.value === 'object' && source.value !== null
			    ? source.value
			    : undefined;
			  // 与 resolveFlags 保持同样的解包规则：`{ value: {...} }` 是 settings scope 的形状。
			  return canonicalFlags(nested === undefined ? source : { ...source, ...nested });
			}

			/**
			 * 从设置文档里读开关，缺字段时按 `fallback` 解析。
			 *
			 * 与 {@link pickFlags} 的区别：这里**每个字段都会给值**（缺字段落下兜底），
			 * 用于「从设置面初始化 store」；pickFlags 用于「增量补丁」。
			 *
			 * @param source 设置文档（可为 undefined）。
			 * @param fallback 缺字段时的兜底（通常是 defaultSettings()）。
			 * @returns 完整的开关对象（长名）。
			 */
			function resolveFlags(source, fallback) {
			  const base = canonicalFlags(fallback);
			  const normalized = canonicalFlags(source);
			  const out = {};
			  for (const key of FLAG_KEYS) {
			    out[key] = typeof normalized[key] === 'boolean' ? normalized[key] : normalizeFlag(base[key], true);
			  }
			  return out;
			}

			/**
			 * 建一个开关 store。
			 *
			 * 接口刻意做得极小（get/set/subscribe），因为 settings-dev 那边要 import 它
			 * 写值、控件这边要订阅它；接口越小越不容易在两边理解不一致。
			 *
			 * @param initial 初始开关对象（缺字段按「开启」）。
			 * @returns `{ get, set, subscribe }`
			 *   - `get()`：当前开关快照（新对象，调用方可安全持有）。
			 *   - `set(patch)`：写入，只接受布尔值；**值未变化时不通知**（避免无谓重渲染）。
			 *   - `subscribe(fn)`：订阅，返回退订函数。
			 */
			function createFlagsStore(initial) {
			  let state = resolveFlags(initial, undefined);
			  const listeners = new Set();

			  const get = () => ({ ...state });

			  const set = (patch) => {
			    const next = pickFlags(patch);
			    let changed = false;
			    for (const [key, value] of Object.entries(next)) {
			      if (state[key] !== value) {
			        state = { ...state, [key]: value };
			        changed = true;
			      }
			    }
			    if (!changed) return false;
			    for (const listener of [...listeners]) {
			      try {
			        listener(get());
			      } catch {
			        // 单个订阅者出错不能影响其他订阅者，也不能冒泡到设置页的写入路径。
			      }
			    }
			    return true;
			  };

			  const subscribe = (listener) => {
			    if (typeof listener !== 'function') return () => {};
			    listeners.add(listener);
			    return () => {
			      listeners.delete(listener);
			    };
			  };

			  return { get, set, subscribe };
			}

			/**
			 * 把 store 适配成 React 组件能用的「订阅 + 取快照」对。
			 *
			 * 放在这里而不是组件里，是为了让 composer-usage.js 只关心界面；
			 * 同时也是 `useSyncExternalStore` 的形状（该 API 要求 getSnapshot 返回
			 * **同一个**引用直到真的变化，因此这里缓存快照对象）。
			 *
			 * @param store createFlagsStore() 的返回值。
			 * @returns `{ subscribe, getSnapshot }`；store 缺失时返回 undefined。
			 */
			function reactFlagsSource(store) {
			  if (store === undefined || store === null || typeof store.subscribe !== 'function') return undefined;
			  return {
			    subscribe: (onChange) => store.subscribe(() => onChange()),
			    getSnapshot: () => store.get(),
			  };
			}

			Object.assign(__exports, { "FLAG_KEYS": FLAG_KEYS, "pickFlags": pickFlags, "resolveFlags": resolveFlags, "createFlagsStore": createFlagsStore, "reactFlagsSource": reactFlagsSource });
		});
		__dshRegistry.set("locale.js", (__exports) => {
			var module = { exports: __exports };
			/**
			 * dsh-opendesign-usage —— 文案。
			 *
			 * 约定（沿用 dsh-prompt-expander）：`zh` 与 `en` 的键**必须一一对应**，
			 * 不允许一边多键。缺键在界面上会直接显示成键名，所以对齐是硬要求。
			 *
			 * 命名空间划分：
			 *  - `usage.*`    —— 输入框工具行的只读控件；
			 *  - `settings.*` —— 设置页（task-4 由 settings-dev 增量使用，本文件负责预留）。
			 *
			 * @module dsh-opendesign-usage/locale
			 */

			/** 工具行控件的文案（中英键一一对应）。 */
			const USAGE_ZH = {
			  'usage.label': 'Open Design 用量',
			  'usage.planOnly': 'OD · {percent}%',
			  'usage.planUnknown': 'OD · —',
			  'usage.tokens': '{count} tokens',
			  'usage.separator': ' · ',
			  'usage.window5h': '5 小时',
			  'usage.window7d': '7 天',
			  'usage.windowUnknown': '{hours} 小时窗口',
			  'usage.remaining': '{label}剩余 {percent}%',
			  'usage.resetsIn': '{duration}后重置',
			  'usage.resetsNow': '即将重置',
			  'usage.noCredentials': '未配置 Open Design 凭据（见 设置 → Open Design 用量）',
			  'usage.unauthorized': '登录凭据已失效，请在设置里更新 session cookie',
			  'usage.upstreamError': '额度暂时取不到，显示的是上次的数据',
			  'usage.stale': '数据可能已过期',
			  'usage.tokenBreakdown': '本会话 token：输入 {input}、输出 {output}、缓存读 {cacheRead}、缓存写 {cacheWrite}',
			  'usage.total': '合计',
			  'usage.disabled': '该功能已在设置里关闭',
			  // 钱包余额：套餐额度用尽后的按量付费余额。
			  'usage.walletBalance': '钱包余额 {amount}（套餐额度用尽后自动按量付费）',
			  'usage.walletBreakdown': '其中套餐附带 {subscription}、自行充值 {recharge}',
			};

			const USAGE_EN = {
			  'usage.label': 'Open Design usage',
			  'usage.planOnly': 'OD · {percent}%',
			  'usage.planUnknown': 'OD · —',
			  'usage.tokens': '{count} tokens',
			  'usage.separator': ' · ',
			  'usage.window5h': '5-hour',
			  'usage.window7d': '7-day',
			  'usage.windowUnknown': '{hours}-hour window',
			  'usage.remaining': '{label} {percent}% left',
			  'usage.resetsIn': 'resets in {duration}',
			  'usage.resetsNow': 'resetting now',
			  'usage.noCredentials': 'No Open Design credentials yet (see Settings → Open Design usage)',
			  'usage.unauthorized': 'Sign-in expired — update the session cookie in Settings',
			  'usage.upstreamError': 'Quota is temporarily unavailable; showing the last reading',
			  'usage.stale': 'This reading may be out of date',
			  'usage.tokenBreakdown': 'This session: input {input}, output {output}, cache read {cacheRead}, cache write {cacheWrite}',
			  'usage.total': 'total',
			  'usage.disabled': 'Switched off in Settings',
			  // Wallet balance: pay-as-you-go funds used after the plan quota runs out.
			  'usage.walletBalance': 'Wallet balance {amount} (pay-as-you-go once plan quota runs out)',
			  'usage.walletBreakdown': 'Includes {subscription} from the plan and {recharge} topped up',
			};

			/**
			 * 设置页文案（task-4 使用）。
			 *
			 * ⚠️ settings-dev 只 import 这些键，**不要**改本文件；缺键由 Lead 在合并阶段补。
			 */
			const SETTINGS_ZH = {
			  'settings.title': 'Open Design 用量',
			  'settings.intro': '在输入框工具行显示 Open Design 的套餐额度与本会话 token 用量。只读，不会修改任何会话状态。',
			  'settings.composerUsage': '启用输入框用量控件',
			  'settings.composerUsageHint': '关闭后输入框工具行完全不显示本插件的控件。仅当本会话选中 Open Design 的模型时才出现。',
			  'settings.planQuota': '显示套餐额度',
			  'settings.planQuotaHint': '显示 5 小时与 7 天窗口的剩余百分比。需要下面的 workspaceId 与 session cookie。',
			  'settings.tokenUsage': '显示本会话 token 用量',
			  'settings.tokenUsageHint': '累计输入、输出与缓存 token。读的是 DSH 自己的投影，不需要凭据。',
			  'settings.credentials': '凭据',
			  'settings.credentialsHint': '凭据只保存在本机 DSH 设置里，插件不会把它发往 Open Design 以外的任何地方。',
			  'settings.workspaceId': 'Workspace ID',
			  'settings.workspaceIdPlaceholder': '例如 ws_0123456789abcdef',
			  'settings.workspaceIdHint': '在 Open Design 控制台地址或接口请求头 x-vela-workspace-id 里可以找到。',
			  'settings.sessionCookie': 'Session Cookie',
			  'settings.sessionCookiePlaceholder': '__Secure-better-auth.session_token 的值',
			  'settings.sessionCookieHint': '只填 token 本身即可；整段 Cookie 头粘贴进来也能识别。',
			  'settings.howTo': '如何获取：浏览器登录 open-design.ai → F12 → Network → 找 billing/coding-plan-usage 请求 → 复制请求头 Cookie 里 __Secure-better-auth.session_token 的值（分号之前的那一段）。',
			  'settings.test': '测试连接',
			  'settings.testing': '测试中…',
			  'settings.testHint': '用上面填写的值测试，不必先保存。',
			  'settings.save': '保存凭据',
			  'settings.saving': '保存中…',
			  'settings.saved': '已保存',
			  'settings.unsaved': '有未保存的改动',
			  'settings.saveFailed': '保存失败，设置服务没有接受写入。',
			  'settings.testOk': '连接成功 · 套餐 {tier}',
			  'settings.testOkWindows': '5 小时剩余 {h5}%，7 天剩余 {d7}%',
			  'settings.testOkNoWindows': '连接成功，但上游没有返回任何窗口',
			  'settings.testFailed': '测试失败：{message}',
			  'settings.testNeedInput': '请先填写 workspaceId 与 session cookie。',
			  'settings.unauthorized': '凭据被上游拒绝，请重新复制 session cookie。',
			  'settings.upstream': '请求上游失败，请检查网络或稍后重试。',
			  'settings.notConfigured': '未配置',
			  'settings.refreshInterval': '刷新间隔',
			  'settings.refreshIntervalHint': '毫秒。范围 60 秒 – 60 分钟，默认 5 分钟。',
			  'settings.unavailable': 'DSH 设置服务不可用，这里的改动不会保存。',
			  'settings.bootFailed': '插件启动时有步骤失败，已自动降级（详情）：',
			  // ── 2026-10-16 重构（primitives 化）新增 ──────────────────────────────
			  'settings.features': '功能开关',
			  'settings.notServed': '该插件当前未加载，暂时无法配置。',
			  'settings.formSave': '保存',
			  'settings.overridden': '已覆盖',
			  'settings.resetField': '恢复默认',
			  'settings.invalidNumber': '请输入区间内的整数。',
			  'settings.secretConfigured': '已配置',
			  // ⚠️ 徽章用**短标签**，不能复用带 `{tier}` / `{message}` 占位的
			  // `settings.testOk` / `settings.testFailed` —— 占位符没参数可填就会原样露出来。
			  'settings.testOkBadge': '连接成功',
			  'settings.testFailedBadge': '测试失败',
			};

			const SETTINGS_EN = {
			  'settings.title': 'Open Design usage',
			  'settings.intro': 'Show the Open Design plan quota and this session’s token usage in the composer tool row. Read-only — it never writes session state.',
			  'settings.composerUsage': 'Enable the composer usage readout',
			  'settings.composerUsageHint': 'When off, this plugin draws nothing in the composer tool row. It only appears while a session has an Open Design model selected.',
			  'settings.planQuota': 'Show plan quota',
			  'settings.planQuotaHint': 'Show the remaining percentage of the 5-hour and 7-day windows. Requires the workspaceId and session cookie below.',
			  'settings.tokenUsage': 'Show this session’s token usage',
			  'settings.tokenUsageHint': 'Cumulative input, output and cached tokens, read from DSH’s own projection — no credentials needed.',
			  'settings.credentials': 'Credentials',
			  'settings.credentialsHint': 'They are stored only in your local DSH settings and are never sent anywhere except Open Design.',
			  'settings.workspaceId': 'Workspace ID',
			  'settings.workspaceIdPlaceholder': 'e.g. ws_0123456789abcdef',
			  'settings.workspaceIdHint': 'Find it in the Open Design console URL, or in the x-vela-workspace-id request header.',
			  'settings.sessionCookie': 'Session cookie',
			  'settings.sessionCookiePlaceholder': 'the value of __Secure-better-auth.session_token',
			  'settings.sessionCookieHint': 'The bare token is enough; pasting the whole Cookie header also works.',
			  'settings.howTo': 'How to get it: sign in at open-design.ai → F12 → Network → find the billing/coding-plan-usage request → copy the __Secure-better-auth.session_token value from its Cookie header (the part before the semicolon).',
			  'settings.test': 'Test connection',
			  'settings.testing': 'Testing…',
			  'settings.testHint': 'Tested with the values above; no need to save first.',
			  'settings.save': 'Save credentials',
			  'settings.saving': 'Saving…',
			  'settings.saved': 'Saved',
			  'settings.unsaved': 'Unsaved changes',
			  'settings.saveFailed': 'Save failed — the settings service did not accept the write.',
			  'settings.testOk': 'Connected · plan {tier}',
			  'settings.testOkWindows': '5-hour {h5}% left, 7-day {d7}% left',
			  'settings.testOkNoWindows': 'Connected, but the upstream returned no windows',
			  'settings.testFailed': 'Test failed: {message}',
			  'settings.testNeedInput': 'Fill in the workspaceId and session cookie first.',
			  'settings.unauthorized': 'The upstream rejected these credentials — copy the session cookie again.',
			  'settings.upstream': 'The upstream request failed; check your network and try again.',
			  'settings.notConfigured': 'Not configured',
			  'settings.refreshInterval': 'Refresh interval',
			  'settings.refreshIntervalHint': 'Milliseconds. Between 60 s and 60 min; 5 min by default.',
			  'settings.unavailable': 'The DSH settings service is unavailable, so changes here will not be saved.',
			  'settings.bootFailed': 'Some startup steps failed and were skipped (details):',
			  // ── 2026-10-16 refactor (primitives) added ───────────────────────────
			  'settings.features': 'Features',
			  'settings.notServed': 'This plugin is not loaded, so it cannot be configured right now.',
			  'settings.formSave': 'Save',
			  'settings.overridden': 'Overridden',
			  'settings.resetField': 'Reset to default',
			  'settings.invalidNumber': 'Enter a whole number within the allowed range.',
			  'settings.secretConfigured': 'Configured',
			  'settings.testOkBadge': 'Connected',
			  'settings.testFailedBadge': 'Test failed',
			};

			/** 中英文案（键必须一一对应）。 */
			function createLocale() {
			  return {
			    zh: { ...USAGE_ZH, ...SETTINGS_ZH },
			    en: { ...USAGE_EN, ...SETTINGS_EN },
			  };
			}

			/** 中英键是否一一对应（供测试/自检用）。 */
			function localeKeysAligned() {
			  const { zh, en } = createLocale();
			  const zhKeys = Object.keys(zh).sort();
			  const enKeys = Object.keys(en).sort();
			  return (
			    zhKeys.length === enKeys.length && zhKeys.every((key, index) => key === enKeys[index])
			  );
			}

			Object.assign(__exports, { "createLocale": createLocale, "localeKeysAligned": localeKeysAligned });
		});
		__dshRegistry.set("composer-usage.js", (__exports) => {
			var module = { exports: __exports };
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

			const { FIELD_REFRESH_INTERVAL, PLUGIN_ID, PROVIDERS, ROUTE_PLAN_USAGE, formatDuration, formatTokenCount, normalizeFlag, normalizeRefreshInterval, remainingPercentOf, windowLabelOf } = __dshRequire("./constants.js");
			const { FLAG_COMPOSER_USAGE, FLAG_PLAN_QUOTA, FLAG_TOKEN_USAGE } = __dshRequire("./constants.js");
			const { pickFlags } = __dshRequire("./flags-store.js");


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
			function providerOfSelection(projection) {
			  const provider = (projection?.next ?? projection?.lastUsed)?.provider;
			  return typeof provider === 'string' && provider !== '' ? provider : undefined;
			}

			/** 该 provider 是否由本插件服务（用 constants 的表，将来加 id 只改一处）。 */
			function isOwnProvider(provider) {
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
			function tokenTotalsOf(view) {
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
			function planViewOf(payload) {
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
			function primaryWindowOf(windows) {
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
			function collapseLabelOf(options) {
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
			function windowPercentsOf(windows) {
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
			function windowLabelText(label, durationSeconds, t) {
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
			function windowTooltipText(window_, t, locale = 'zh') {
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
			function isUnauthorizedCode(code) {
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
			function walletTooltipLines(wallet, t) {
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
			function walletViewOf(payload) {
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
			function formatUsd(usd) {
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
			function classifyPlanCode(code) {
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
			function flagVisibilityOf(flags) {
			  const planOn = normalizeFlag(flags?.[FLAG_PLAN_QUOTA], true);
			  const tokenOn = normalizeFlag(flags?.[FLAG_TOKEN_USAGE], true);
			  return { planOn, tokenOn, any: planOn };
			}

			/** 控件的总开关（关掉后连插槽内容都不画）。 */
			function composerEnabledOf(flags) {
			  return normalizeFlag(flags?.[FLAG_COMPOSER_USAGE], true);
			}

			/**
			 * 刷新间隔：优先宿主设置，其次默认值；夹在允许区间内。
			 *
			 * @param settings 设置文档（可能带 volatile 活引用）。
			 * @returns 毫秒数。
			 */
			function refreshIntervalOf(settings) {
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
			function bindReact(module_) {
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
			function bindReactDom(module_) {
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
			function bindPrimitives(module_) {
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
			function primitivesUsable(module_) {
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
			function UsageReadout(props) {
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
			function UsageGate(props) {
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

			Object.assign(__exports, { "providerOfSelection": providerOfSelection, "isOwnProvider": isOwnProvider, "tokenTotalsOf": tokenTotalsOf, "planViewOf": planViewOf, "primaryWindowOf": primaryWindowOf, "collapseLabelOf": collapseLabelOf, "windowPercentsOf": windowPercentsOf, "windowLabelText": windowLabelText, "windowTooltipText": windowTooltipText, "isUnauthorizedCode": isUnauthorizedCode, "walletTooltipLines": walletTooltipLines, "walletViewOf": walletViewOf, "formatUsd": formatUsd, "classifyPlanCode": classifyPlanCode, "flagVisibilityOf": flagVisibilityOf, "composerEnabledOf": composerEnabledOf, "refreshIntervalOf": refreshIntervalOf, "bindReact": bindReact, "bindReactDom": bindReactDom, "bindPrimitives": bindPrimitives, "primitivesUsable": primitivesUsable, "UsageReadout": UsageReadout, "UsageGate": UsageGate });
		});
		__dshRegistry.set("plugin-settings-card.js", (__exports) => {
			var module = { exports: __exports };
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

			const { FIELD_REFRESH_INTERVAL, FIELD_SESSION_COOKIE, FIELD_WORKSPACE_ID, FLAG_COMPOSER_USAGE, FLAG_PLAN_QUOTA, FLAG_TOKEN_USAGE, MAX_REFRESH_INTERVAL_MS, MIN_REFRESH_INTERVAL_MS, PLUGIN_ID, ROUTE_TEST_CONNECTION, SETTINGS_NAMESPACE, defaultSettings, normalizeFlag, normalizeSessionCookie, normalizeText } = __dshRequire("./constants.js");
			const { createLocale } = __dshRequire("./locale.js");

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
			function bindReact(module_) {
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
			function bindPrimitives(module_) {
			  injectedPrimitives = module_ ?? undefined;
			}

			/**
			 * 判定一份 primitives 模块够不够本卡片用。
			 *
			 * 要求的是**本卡片真正会渲染的每一项**：少一项就整体判为不可用并显示如实说明，
			 * 而不是「渲染到一半才发现缺件」。宁可整块说"暂时无法配置"，也不自绘替代控件
			 * —— 后者正是 §0.1 禁止的形状。
			 */
			function primitivesComplete(module_) {
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
			function usePrimitives() {
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
			function formLabels(t) {
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
			function pickWindowPercents(windows) {
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
			function interpretTestResult(payload, status) {
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
			function SettingsCard(props) {
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

			Object.assign(__exports, { "bindReact": bindReact, "bindPrimitives": bindPrimitives, "primitivesComplete": primitivesComplete, "usePrimitives": usePrimitives, "formLabels": formLabels, "pickWindowPercents": pickWindowPercents, "interpretTestResult": interpretTestResult, "SettingsCard": SettingsCard });
		});
		__dshRegistry.set("boot-diagnostics.js", (__exports) => {
			var module = { exports: __exports };
			/**
			 * dsh-opendesign-usage —— 启动自检：任何一步失败都只降级、只留痕，**绝不外抛**。
			 *
			 * 为什么必须有这一层（2026-10-15 实测事故）：DSH 的 web boot 把每个客户端插件的
			 * cordis fiber 都当成必须 ACTIVE 的条目。`apply` 里冒出的任何异常都会把 fiber 打成
			 * FAILED（cordis `Fiber._reload()` 捕获后置 `_error`），web boot 随即
			 * `throw new Error("web boot: N entry did not activate")` —— **整个界面白屏**，
			 * 而 crash log 只有一行 `<包名>: failed`，**没有堆栈**（异常交给了渲染进程 logger，
			 * 它不落盘）。
			 *
			 * 本插件之前恰好是「反过来」的隐患：`loadReact()` 把 `ctx.import` 取进 try/catch，
			 * 那条异常被吞掉后 `apply` 直接 `return`，于是**控件和设置页都不注册**，日志里
			 * 只有一行 warn —— 没有白屏，但插件等于没装，而且无从排查。
			 *
			 * 所以这里的规矩是两条：
			 *  1. 每个步骤各自守卫，失败只记一条并继续下一面；
			 *  2. 报告写进 `localStorage`（渲染进程里**唯一**事后能从磁盘读回来的地方），
			 *     用 `~/.dsh/bin/dsh-boot-report` 读；同时 `console.error` 一份。
			 *
			 * @module dsh-opendesign-usage/boot-diagnostics
			 */

			/** 留痕键。读法：在 Electron 的 Local Storage leveldb 里 grep 这个键。 */
			const BOOT_REPORT_KEY = 'dsh.opendesign-usage.boot';

			/** 取一个可用的 Web Storage；被禁用/不存在一律当成「没有」。 */
			function safeStorage(kind) {
			  try {
			    const store = globalThis[kind];
			    if (store === undefined || store === null) return undefined;
			    void store.length;
			    return store;
			  } catch {
			    return undefined;
			  }
			}

			/**
			 * 包一个启动步骤：抛错时记一条记录并返回兜底值，**绝不外抛**。
			 *
			 * @param failures 失败记录收集数组（就地追加）。
			 * @param where 步骤标识。
			 * @param run 步骤本体。
			 * @param onError 失败时的兜底值工厂，可选。
			 * @returns `run()` 的返回值，失败时是 `onError?.()` 或 undefined。
			 */
			function guardStep(failures, where, run, onError) {
			  try {
			    return run();
			  } catch (error) {
			    recordFailure(failures, where, error);
			    if (onError === undefined) return undefined;
			    try {
			      return onError(error);
			    } catch (nested) {
			      recordFailure(failures, `${where}:fallback`, nested);
			      return undefined;
			    }
			  }
			}

			/** 记一条失败：`console.error` 一份，并追加到收集数组。 */
			function recordFailure(failures, where, error, extra) {
			  const message = error instanceof Error ? error.message : String(error);
			  const stack = error instanceof Error && typeof error.stack === 'string' ? error.stack : '';
			  failures.push({
			    where: String(where),
			    message,
			    stack: stack.slice(0, 4000),
			    ...(extra === undefined ? {} : { extra: String(extra).slice(0, 500) }),
			  });
			  try {
			    console.error(`[dsh-opendesign-usage] 启动步骤「${where}」失败：`, error);
			  } catch {
			    // 连 console 都不可用就没什么能做的了。
			  }
			}

			/**
			 * 写一份启动报告。**任何一步失败都只吞掉，绝不外抛。**
			 *
			 * @param failures 本次启动累积的失败记录。
			 * @param context 额外环境信息，可选。
			 * @returns 写进去的报告对象（便于测试断言）。
			 */
			function writeBootReport(failures, context) {
			  const report = {
			    at: new Date().toISOString(),
			    ok: failures.length === 0,
			    ...(context === undefined ? {} : { context }),
			    failures,
			  };
			  for (const kind of ['localStorage', 'sessionStorage']) {
			    const store = safeStorage(kind);
			    if (store === undefined) continue;
			    try {
			      store.setItem(BOOT_REPORT_KEY, JSON.stringify(report));
			    } catch {
			      // 配额/序列化/被拒——留痕失败不该影响启动。
			    }
			  }
			  return report;
			}

			/** 读回最近一次启动报告；没有、损坏或读不到时返回 undefined。 */
			function readBootReport(kind = 'localStorage') {
			  const store = safeStorage(kind);
			  if (store === undefined) return undefined;
			  try {
			    const raw = store.getItem(BOOT_REPORT_KEY);
			    if (typeof raw !== 'string') return undefined;
			    const parsed = JSON.parse(raw);
			    return parsed !== null && typeof parsed === 'object' ? parsed : undefined;
			  } catch {
			    return undefined;
			  }
			}

			Object.assign(__exports, { "BOOT_REPORT_KEY": BOOT_REPORT_KEY, "guardStep": guardStep, "recordFailure": recordFailure, "writeBootReport": writeBootReport, "readBootReport": readBootReport });
		});
		__dshRegistry.set("client.js", (__exports) => {
			var module = { exports: __exports };
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
			const { COMPOSER_SLOT_ID, COMPOSER_SLOT_ORDER, PLUGIN_DETAIL_CONFIG_KEY, PLUGIN_DETAIL_CONFIG_SLOT, PLUGIN_ID, SETTINGS_NAMESPACE, SETTINGS_SLOT_ORDER } = __dshRequire("./constants.js");
			const { createFlagsStore, resolveFlags } = __dshRequire("./flags-store.js");
			const { createLocale } = __dshRequire("./locale.js");
			const { UsageGate, bindPrimitives, bindReact, bindReactDom } = __dshRequire("./composer-usage.js");
			const { SettingsCard, bindPrimitives: bindCardPrimitives, bindReact: bindCardReact } = __dshRequire("./plugin-settings-card.js");
			const { guardStep, recordFailure, writeBootReport } = __dshRequire("./boot-diagnostics.js");

			const name = PLUGIN_ID;

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
			const inject = ['slots', 'locale', 'configForms'];

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
			function apply(ctx) {
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

			Object.assign(__exports, { "name": name, "inject": inject, "apply": apply });
		});
		var __entry = __dshRequire("client.js");
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		exports.apply = __entry.apply;
		exports.inject = __entry.inject ?? [];
		exports.name = __entry.name;
		return module.exports;
	},
});
