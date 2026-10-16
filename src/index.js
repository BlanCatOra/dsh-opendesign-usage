/**
 * dsh-opendesign-usage —— Host 侧。
 *
 * 这一侧只做两件事：
 *  1. 声明本插件的 Config（交给 DSH 的设置服务持有）；
 *  2. 提供两条 loopback-only 的同源路由，替浏览器去读 Open Design 的套餐额度。
 *
 * 为什么取数要绕到宿主来做：上游接口要求带上控制台登录态的
 * `__Secure-better-auth.session_token` cookie，而它是 `__Secure-` 前缀 ——
 * 只会在 HTTPS 与 open-design.ai 这个源下回传。页面直接 fetch 上游既有跨源
 * 预检问题，也得把用户凭据暴露给页面脚本。放在宿主侧则凭据只留在设置里，
 * 浏览器只跟本机路由说话。
 *
 * 正因如此，两条路由都必须做 loopback 来源检查：它们能带着用户的 cookie 出网，
 * 绝不能被跨站页面驱动（哪怕只是打一次上游、也等于泄露「这个用户登录着」）。
 *
 * @module dsh-opendesign-usage
 */
import { Config as ConfigSchema, hasCredentials, resolveConfig } from './config.js';
import {
  API_ORIGIN,
  CONSOLE_ORIGIN,
  MAX_BODY_BYTES,
  PLUGIN_ID,
  ROUTE_PLAN_USAGE,
  ROUTE_TEST_CONNECTION,
  SESSION_COOKIE_NAME,
  UPSTREAM_TIMEOUT_MS,
  FLAG_COMPOSER_USAGE,
  FLAG_PLAN_QUOTA,
  FLAG_TOKEN_USAGE,
  remainingPercentOf,
  windowLabelOf,
} from './constants.js';

export const name = PLUGIN_ID;
/** 模块级必需依赖为空：只有 webServer，在 apply 内按需注入。 */
export const inject = [];
export const Config = ConfigSchema;

/** 上游额度接口的路径模板。`{id}` 会被 workspaceId 替换。 */
export const UPSTREAM_PATH = '/api/v1/workspaces/{id}/billing/coding-plan-usage';

/**
 * 上游钱包接口的路径。
 *
 * ⚠️ 与额度接口不同，它**不含 workspaceId**：按登录账号返回当前工作区的
 * 账单摘要（余额、订阅、累计消耗）。workspaceId 仍要带在
 * `x-vela-workspace-id` 头里参与鉴权上下文。
 */
export const WALLET_PATH = '/api/v1/billing/summary';

/* ------------------------------------------------------------------ *
 * 纯函数层：不碰网络、不碰响应对象，因此可以在测试里直接断言。
 * ------------------------------------------------------------------ */

/**
 * 把上游的字符串额度转成数字。
 *
 * 上游的 `usedCredits` / `limitCredits` / `remainingCredits` 都是**字符串**
 * （实测确认，不是 JSON 数字）。直接拿去做算术会得到 `'19082'+1 === '190821'`
 * 这种静默错误，所以统一在边界上收敛一次。
 *
 * @param value 上游给的值（字符串或数字）。
 * @returns 有限数字；无法解析时返回 undefined。
 */
export function toNumber(value) {
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed === '') return undefined;
  const parsed = Number(trimmed);
  return Number.isFinite(parsed) ? parsed : undefined;
}

/**
 * 归一化上游的单个窗口。
 *
 * 缺失字段一律给安全兜底而不是抛错：额度面板上少一个数字，远好过整个控件
 * 因为上游加了个字段就白屏。
 *
 * `label` 由 durationSeconds 推导（18000 → '5h'、604800 → '7d'）；上游将来
 * 若新增窗口则返回原秒数的通用标签，绝不把它错标成 5 小时。
 *
 * @param raw 上游的单个 window 对象。
 * @param now 计算 resetsInMs 的基准时刻（毫秒）。
 * @returns 归一化后的窗口。
 */
export function normalizeWindow(raw, now = Date.now()) {
  const source = raw !== null && typeof raw === 'object' ? raw : {};
  const durationSeconds = toNumber(source.durationSeconds);
  const used = toNumber(source.usedCredits) ?? 0;
  const limit = toNumber(source.limitCredits) ?? 0;
  // 上游有时不给 remainingCredits；用它算不出来时退回 limit - used，而不是显示 0。
  const remaining = toNumber(source.remainingCredits) ?? Math.max(0, limit - used);
  const resetsAt = typeof source.resetsAt === 'string' ? source.resetsAt : '';
  const resetAtMs = resetsAt === '' ? Number.NaN : Date.parse(resetsAt);

  return {
    label: windowLabelOf(durationSeconds) ?? (Number.isFinite(durationSeconds) ? `${durationSeconds}s` : 'unknown'),
    durationSeconds: Number.isFinite(durationSeconds) ? durationSeconds : 0,
    used,
    limit,
    remaining,
    // 上限按 limit 算，因此「已超额」自然给出 0，不会出现负数。
    remainingPercent: remainingPercentOf(remaining, limit) ?? 0,
    resetsAt,
    // 界面要显示「还有多久重置」；解析不出时间就给 0，由客户端按「即将重置」处理。
    resetsInMs: Number.isFinite(resetAtMs) ? Math.max(0, resetAtMs - now) : 0,
  };
}

/**
 * 归一化整个上游响应。
 *
 * @param raw 上游 JSON。
 * @param now 基准时刻（毫秒），注入是为了让测试可预期。
 * @returns 与成功分支同形状的载荷（不含 ok）。
 */
export function normalizeUpstream(raw, now = Date.now()) {
  const source = raw !== null && typeof raw === 'object' ? raw : {};
  const windows = Array.isArray(source.windows) ? source.windows.map((item) => normalizeWindow(item, now)) : [];
  // 5 小时窗口排前：它是用户最常看的「这一轮还剩多少」。
  windows.sort((a, b) => {
    const order = { '5h': 0, '7d': 1 };
    return (order[a.label] ?? 9) - (order[b.label] ?? 9) || a.durationSeconds - b.durationSeconds;
  });
  return {
    tier: typeof source.tier === 'string' ? source.tier : '',
    eligible: source.eligible === true,
    generatedAt: typeof source.generatedAt === 'string' ? source.generatedAt : '',
    fetchedAt: new Date(now).toISOString(),
    windows,
  };
}

/**
 * 把三个开关整理成给客户端的 `flags`。
 *
 * 浏览器端读不到宿主的 volatile 配置（没有 settingsScope），所以控件必须靠
 * 宿主顺带把开关状态带下来，否则只能靠猜 —— 那正是「设置页改了没反应」
 * 一类缺陷的来源。因此**错误分支也要带 flags**：拿不到额度时控件仍需要知道
 * 自己该不该隐藏。
 *
 * @param settings resolveConfig 的结果。
 * @returns 三个布尔开关。
 */
export function flagsOf(settings) {
  return {
    composerUsage: settings[FLAG_COMPOSER_USAGE] === true,
    planQuota: settings[FLAG_PLAN_QUOTA] === true,
    tokenUsage: settings[FLAG_TOKEN_USAGE] === true,
  };
}

/**
 * 组装上游请求头。
 *
 * 上游在 Cloudflare 后面且校验站点源，缺 Origin/Referer 会被拦；
 * `x-vela-workspace-id` 与 Cookie 一起构成鉴权。
 *
 * @param workspaceId 工作区 id。
 * @param token 裸的会话 token（不含 cookie 名）。
 * @returns 请求头对象。
 */
export function upstreamHeaders(workspaceId, token) {
  return {
    accept: 'application/json',
    origin: CONSOLE_ORIGIN,
    referer: `${CONSOLE_ORIGIN}/`,
    'x-vela-workspace-id': workspaceId,
    cookie: `${SESSION_COOKIE_NAME}=${token}`,
  };
}

/** 拼出上游 URL。 */
export function upstreamUrl(workspaceId) {
  return `${API_ORIGIN}${UPSTREAM_PATH.replace('{id}', encodeURIComponent(workspaceId))}`;
}

/** 拼出钱包接口 URL（无 workspaceId 路径参数，见 {@link WALLET_PATH}）。 */
export function walletUrl() {
  return `${API_ORIGIN}${WALLET_PATH}`;
}

/* ------------------------------------------------------------------ *
 * HTTP 层。
 * ------------------------------------------------------------------ */

/**
 * DSH 页面自身的 origin 协议。
 *
 * ⚠️ 桌面版 DSH 的页面 origin 是 **`dsh-app://app`**（自定义协议），不是
 * `http://127.0.0.1:<port>`。2026-10-15 实测踩坑：只放行 loopback 主机名时，
 * 插件**自己**发起的合法同源请求也会被挡成 403 —— 表现是控件显示 `OD · —`
 * 并提示"额度暂时取不到"，而同一个路由用 curl 直接打却是 200。
 *
 * 这类"安全逻辑过严把正常调用也拒了"的缺陷很隐蔽：宿主侧看日志一切正常、
 * 单元测试直接调 handler 也全绿（测试里的 req 不带 Origin），
 * 只有真实浏览器路径才暴露。
 */
const DSH_APP_PROTOCOLS = new Set(['dsh-app:', 'dsh:']);

/**
 * 只接受来自本机页面的请求；该路由能带用户凭据出网，不能被跨站驱动。
 *
 * 放行三类：
 *  1. **没有 Origin** —— 同源 fetch / curl 可能不带，属正常情况；
 *  2. **DSH 自己的协议**（`dsh-app://app`）—— 桌面版页面的真实 origin；
 *  3. **loopback 主机**（http/https + 127.0.0.1 / localhost / ::1）——
 *     开发模式下的 Vite 页面、以及同机工具调用。
 *
 * 其余（含任何外部站点）一律拒绝。判据是"**是否为本机宿主页面**"，
 * 而不是"是否长得像 localhost"—— 后者正是本次漏掉 `dsh-app` 的原因。
 *
 * @param req HTTP 请求。
 * @returns 是否可信。
 */
function loopbackOrigin(req) {
  const origin = req.headers.origin;
  if (typeof origin !== 'string' || origin === '') return true; // 同源 fetch 可能不带 Origin
  let parsed;
  try {
    parsed = new URL(origin);
  } catch {
    return false;
  }
  if (DSH_APP_PROTOCOLS.has(parsed.protocol)) return true;
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
  const host = parsed.hostname;
  return host === '127.0.0.1' || host === 'localhost' || host === '::1' || host === '[::1]';
}

function json(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body),
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolvePromise, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', (chunk) => {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        reject(new Error('request body too large'));
        req.destroy();
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => resolvePromise(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** 只取 message：上游的响应体可能很大，塞进错误信息只会把界面撑爆。 */
function safeMessage(error) {
  return error instanceof Error ? error.message : String(error);
}

/**
 * 打一次上游额度接口，返回**已经归一化**的结果或错误码。
 *
 * 不在这里区分 HTTP 状态码：调用方（路由）统一回 200，由 `code` 表达语义 ——
 * 浏览器端 fetch 对 4xx 只会给出一个不带 body 的 Response，让客户端去判断
 * 「401 说明 cookie 过期」反而更绕。
 *
 * @param workspaceId 工作区 id。
 * @param token 裸会话 token。
 * @param fetchImpl 便于测试注入的 fetch 实现。
 * @param now 基准时刻（毫秒）。
 * @returns `{ ok:true, ...归一化结果 }` 或 `{ ok:false, code, error }`。
 */
export async function fetchPlanUsage(workspaceId, token, fetchImpl = fetch, now = Date.now()) {
  if (typeof workspaceId !== 'string' || workspaceId === '' || typeof token !== 'string' || token === '') {
    return { ok: false, code: 'NO_CREDENTIALS', error: 'workspaceId and sessionCookie are required' };
  }

  let response;
  try {
    response = await fetchImpl(upstreamUrl(workspaceId), {
      method: 'GET',
      headers: upstreamHeaders(workspaceId, token),
      // 上游实测 < 1s；10s 是给「网络抽风」留的余量，再长就把界面挂住了。
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    // 含超时（AbortSignal.timeout 抛 TimeoutError）与 DNS/连接失败。
    return { ok: false, code: 'UPSTREAM', error: safeMessage(error) };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, code: 'UNAUTHORIZED', error: `upstream rejected credentials (${response.status})` };
  }
  if (!response.ok) {
    return { ok: false, code: 'UPSTREAM', error: `upstream responded ${response.status}` };
  }

  let raw;
  try {
    raw = await response.json();
  } catch (error) {
    return { ok: false, code: 'UPSTREAM', error: `upstream returned invalid JSON: ${safeMessage(error)}` };
  }

  return { ok: true, ...normalizeUpstream(raw, now) };
}

/**
 * 归一化钱包余额响应。
 *
 * 上游把金额都给成**字符串**（`"1.5000"`，4 位定长小数），且同一笔钱有
 * 两种单位：美元（`*Usd`）与 credits（`balances.*`，1 USD = `creditsPerUsd`
 * 个 credits）。两套都保留：界面主显示美元（与控制台原文一致），
 * credits 留着是因为套餐额度本身就是以 credits 计的，两者要能对上。
 *
 * @param raw 上游 JSON。
 * @returns 归一化后的钱包摘要（不含 ok）。
 */
export function normalizeWallet(raw) {
  const source = raw !== null && typeof raw === 'object' ? raw : {};
  const balances =
    source.balances !== null && typeof source.balances === 'object' ? source.balances : {};
  const subscriptionUsd = toNumber(source.subscriptionCreditsUsd) ?? 0;
  const rechargeUsd = toNumber(source.rechargeCreditsUsd) ?? 0;
  // 优先信上游给的合计；它缺失时才自己相加，避免两处口径不一致。
  const totalUsd =
    toNumber(source.totalAvailableCreditsUsd) ??
    toNumber(source.balanceUsd) ??
    subscriptionUsd + rechargeUsd;
  return {
    totalUsd,
    subscriptionUsd,
    rechargeUsd,
    creditsPerUsd: toNumber(source.creditsPerUsd) ?? 0,
    totalCredits: toNumber(balances.totalAvailableCredits) ?? 0,
    subscriptionCredits: toNumber(balances.subscriptionCredits) ?? 0,
    rechargeCredits: toNumber(balances.rechargeCredits) ?? 0,
    // 订阅状态决定「套餐用尽后是否自动走这个余额」。
    membershipTier: typeof source.membershipTier === 'string' ? source.membershipTier : '',
    subscriptionStatus: typeof source.subscriptionStatus === 'string' ? source.subscriptionStatus : '',
    totalConsumedUsd: toNumber(source.totalConsumedUsd) ?? 0,
    todayConsumedUsd: toNumber(source.todayConsumedUsd) ?? 0,
    usageCount: toNumber(source.usageCount) ?? 0,
    updatedAt: typeof source.updatedAt === 'string' ? source.updatedAt : '',
  };
}

/**
 * 拉取钱包余额。
 *
 * 走 {@link walletUrl}（**不含** workspaceId 路径参数），但要求 workspaceId
 * 非空：它要作为 `x-vela-workspace-id` 头参与鉴权上下文。
 *
 * @param workspaceId 工作区 id。
 * @param token 裸会话 token。
 * @param fetchImpl 便于测试注入的 fetch 实现。
 * @returns `{ ok:true, ...归一化钱包 }` 或 `{ ok:false, code, error }`。
 */
export async function fetchWalletSummary(workspaceId, token, fetchImpl = fetch) {
  if (typeof workspaceId !== 'string' || workspaceId === '' || typeof token !== 'string' || token === '') {
    return { ok: false, code: 'NO_CREDENTIALS', error: 'workspaceId and sessionCookie are required' };
  }

  let response;
  try {
    response = await fetchImpl(walletUrl(), {
      method: 'GET',
      headers: upstreamHeaders(workspaceId, token),
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    });
  } catch (error) {
    return { ok: false, code: 'UPSTREAM', error: safeMessage(error) };
  }

  if (response.status === 401 || response.status === 403) {
    return { ok: false, code: 'UNAUTHORIZED', error: `upstream rejected credentials (${response.status})` };
  }
  if (!response.ok) {
    return { ok: false, code: 'UPSTREAM', error: `upstream responded ${response.status}` };
  }

  let raw;
  try {
    raw = await response.json();
  } catch (error) {
    return { ok: false, code: 'UPSTREAM', error: `upstream returned invalid JSON: ${safeMessage(error)}` };
  }

  return { ok: true, ...normalizeWallet(raw) };
}

/**
 * 装配 Host 侧：注册两条路由。
 *
 * @param ctx Host 上下文。
 * @param config 行配置（cordis.patch.yml / 设置服务折叠后的值）。
 */
export function apply(ctx, config = {}) {
  // 本插件自带设置页，关掉按 schema 自动生成的表单，让设置服务只负责持有值。
  // schema 通过本模块导出的 Config 被发现，无需显式注册。
  if (typeof ctx.inject === 'function') {
    ctx.inject(['settings'], (settingsCtx) => {
      if (typeof settingsCtx.settings?.configure === 'function') {
        settingsCtx.effect(
          () => settingsCtx.settings.configure({ auto: false }, ctx.fiber),
          `${PLUGIN_ID}: settings policy`,
        );
      }
    });
  }

  // 路由需要 webServer；用 ctx.inject 而不是写进模块级 `inject`，
  // 这样缺少 HTTP 服务的组合里插件条目仍能加载，而不是被静默挂起。
  const mount = (webCtx) => {
    /**
     * 当前生效的设置（已剥掉 volatile 活引用）。
     *
     * `describe()` 返回的行值含活引用，必须经 `resolveConfig` 剥一层 `.get()`，
     * 否则读出来永远是对象；设置服务尚未就绪时退回行配置。
     */
    const currentSettings = () => {
      try {
        const row = webCtx.get?.('settings')?.describe?.().find((item) => item.ns === name);
        if (row?.value !== undefined) return resolveConfig(row.value);
      } catch {
        // 设置服务不可用：用行配置。
      }
      return resolveConfig(config);
    };

    /** 额度路由：用已保存的凭据取数。 */
    const disposePlanUsage = webCtx.webServer.register({
      kind: 'exact',
      path: ROUTE_PLAN_USAGE,
      handler: async (req, res) => {
        if (!loopbackOrigin(req)) return json(res, 403, { ok: false, code: 'FORBIDDEN', error: 'origin-not-trusted' });
        if (req.method !== 'GET') {
          res.setHeader('Allow', 'GET');
          return json(res, 405, { ok: false, code: 'METHOD', error: 'use GET' });
        }
        const settings = currentSettings();
        const flags = flagsOf(settings);
        // 开关关着就别去打上游：既省一次出网，也避免用户以为「关了还在后台刷」。
        if (!settings[FLAG_PLAN_QUOTA]) {
          return json(res, 200, { ok: false, code: 'DISABLED', error: 'plan quota display is disabled', flags });
        }
        if (!hasCredentials(settings)) {
          return json(res, 200, { ok: false, code: 'NO_CREDENTIALS', error: 'workspaceId and sessionCookie are not set', flags });
        }
        // 额度与余额是两个上游接口，但它们**共用同一份凭据、同一块界面**，
        // 所以并发发起、一起回来：串行会把首屏时间翻倍，而两者互不依赖。
        // 用 allSettled 而不是 all —— 余额接口将来若被上游下线，不该把额度一起拖没。
        const [plan, wallet] = await Promise.allSettled([
          fetchPlanUsage(settings.workspaceId, settings.sessionCookie),
          fetchWalletSummary(settings.workspaceId, settings.sessionCookie),
        ]);
        const planResult =
          plan.status === 'fulfilled' ? plan.value : { ok: false, code: 'UPSTREAM', error: safeMessage(plan.reason) };
        const walletResult =
          wallet.status === 'fulfilled'
            ? wallet.value
            : { ok: false, code: 'UPSTREAM', error: safeMessage(wallet.reason) };
        // 成功与失败都带 flags：客户端要靠它决定控件是否显示，
        // 不能因为额度拿不到就把开关信息一起丢掉。
        return json(res, 200, { ...planResult, wallet: walletResult, flags });
      },
    });

    /** 测试连接路由：用请求体里的**草稿**凭据试打一次，让用户先验后存。 */
    const disposeTestConnection = webCtx.webServer.register({
      kind: 'exact',
      path: ROUTE_TEST_CONNECTION,
      handler: async (req, res) => {
        if (!loopbackOrigin(req)) return json(res, 403, { ok: false, code: 'FORBIDDEN', error: 'origin-not-trusted' });
        if (req.method !== 'POST') {
          res.setHeader('Allow', 'POST');
          return json(res, 405, { ok: false, code: 'METHOD', error: 'use POST' });
        }
        const flags = flagsOf(currentSettings());
        try {
          const body = JSON.parse(await readBody(req));
          // 草稿值同样过一遍 normalize：用户可能整段粘贴 cookie 头。
          const draft = resolveConfig({
            workspaceId: body?.workspaceId,
            sessionCookie: body?.sessionCookie,
          });
          if (!hasCredentials(draft)) {
            return json(res, 200, {
              ok: false,
              code: 'NO_CREDENTIALS',
              error: 'workspaceId and sessionCookie are required',
              flags,
            });
          }
          const [plan, wallet] = await Promise.allSettled([
            fetchPlanUsage(draft.workspaceId, draft.sessionCookie),
            fetchWalletSummary(draft.workspaceId, draft.sessionCookie),
          ]);
          const planResult =
            plan.status === 'fulfilled'
              ? plan.value
              : { ok: false, code: 'UPSTREAM', error: safeMessage(plan.reason) };
          const walletResult =
            wallet.status === 'fulfilled'
              ? wallet.value
              : { ok: false, code: 'UPSTREAM', error: safeMessage(wallet.reason) };
          return json(res, 200, { ...planResult, wallet: walletResult, flags });
        } catch (error) {
          return json(res, 200, { ok: false, code: 'BAD_REQUEST', error: safeMessage(error), flags });
        }
      },
    });

    return () => {
      disposePlanUsage();
      disposeTestConnection();
    };
  };

  if (typeof ctx.inject === 'function') {
    ctx.inject(['webServer'], (webCtx) => webCtx.effect(() => mount(webCtx), `${PLUGIN_ID}: web routes`));
  } else if (ctx.get?.('webServer') !== undefined) {
    // ⚠️ 不能直接写 `ctx.webServer`：cordis 的服务代理只放行 inject 里声明过的
    // 服务名，未声明时读它会抛 `cannot get property "webServer" without inject`。
    // 这条分支只在非 cordis 上下文里走到，但两个分支都别留这个坑。
    ctx.effect(() => mount(ctx), `${PLUGIN_ID}: web routes`);
  }
}
