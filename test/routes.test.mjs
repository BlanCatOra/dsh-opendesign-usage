/**
 * dsh-opendesign-usage —— 宿主路由层测试。
 *
 * 覆盖 `apply()` 真正注册出去的东西：路由路径、loopback 来源检查、
 * 各错误码形状、以及「开关关闭时不出网」。
 *
 * ⚠️ 与本项目其它测试一致：**绝不打真网络**。路由内部调用 `fetchPlanUsage`，
 * 而这里通过注入的假 `fetch` 拦住它 —— 因此这些断言在任何机器、任何网络
 * 状态下都可复现，CI 不会因为「上游改了行为」或「没网」而飘。
 *
 * 假 `webServer` 上下文只实现被真正用到的三个成员（register / effect / get），
 * 这样测试不会因为宿主内部结构变化而假性通过。
 *
 * @module dsh-opendesign-usage/test/routes
 */
import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

import { apply } from '../src/index.js';

/** 上游真实响应形状（credits 是字符串）。 */
const UPSTREAM_OK = {
  workspaceId: 'ws-1',
  generatedAt: '2026-10-14T21:23:33.867Z',
  eligible: true,
  tier: 'go',
  windows: [
    {
      durationSeconds: 18000,
      usedCredits: '19082',
      limitCredits: '50000',
      remainingCredits: '30918',
      resetsAt: '2026-10-14T23:44:46.000Z',
    },
    {
      durationSeconds: 604800,
      usedCredits: '19082',
      limitCredits: '150000',
      remainingCredits: '130918',
      resetsAt: '2026-10-21T18:44:46.000Z',
    },
  ],
};

/**
 * 装一次插件并收集它注册的路由。
 *
 * `fetchImpl` 会被装到 `globalThis.fetch` 上：路由内部调用 `fetchPlanUsage(...)`
 * 时没有传入自定义实现，因此它走全局 `fetch`。测试在 finally 里还原，
 * 保证任何断言失败都不会把 stub 泄漏给同进程的其它测试文件。
 *
 * @param settings 传给 apply 的配置（即 Config 的普通值）。
 * @param fetchImpl 假 fetch。
 * @returns `{ routes, restore }`
 */
function mountPlugin(settings, fetchImpl) {
  const routes = new Map();
  const fakeWebServer = {
    register({ path, handler }) {
      routes.set(path, handler);
      return () => routes.delete(path);
    },
  };
  const ctx = {
    inject(names, cb) {
      if (names.includes('webServer')) {
        cb({ ...ctx, webServer: fakeWebServer, effect: (fn) => fn() });
      }
    },
    effect(fn) {
      fn();
    },
    get() {
      return undefined;
    },
  };
  const original = globalThis.fetch;
  globalThis.fetch = fetchImpl;
  // 记下来由 afterEach 统一还原：若把 restore 交给每个测试手动调用，
  // 中途一条断言失败就会把 stub 泄漏给后续测试，产生「假性通过」。
  pendingRestores.push(() => {
    globalThis.fetch = original;
  });
  apply(ctx, settings);
  return { routes };
}

/** 每次挂载前的原始 fetch，由 afterEach 统一还原。 */
const pendingRestores = [];

afterEach(() => {
  for (const restore of pendingRestores.splice(0)) restore();
});

/** 最小响应桩：记录 status/headers/body。 */
function makeRes() {
  return {
    statusCode: 0,
    headers: null,
    body: '',
    writeHead(status, headers) {
      this.statusCode = status;
      this.headers = headers;
      return this;
    },
    setHeader() {},
    end(chunk) {
      this.body = chunk ?? '';
    },
  };
}

/** 最小请求桩：异步派发 body，模拟真实流的时序。 */
function makeReq(method, origin, body) {
  const listeners = {};
  const req = {
    method,
    url: '/',
    headers: origin === undefined ? {} : { origin },
    on(event, cb) {
      (listeners[event] ??= []).push(cb);
      return req;
    },
    destroy() {},
  };
  queueMicrotask(() => {
    if (body !== undefined) for (const cb of listeners.data ?? []) cb(Buffer.from(body));
    for (const cb of listeners.end ?? []) cb();
  });
  return req;
}

const PLAN = '/plugins/dsh-opendesign-usage/plan-usage';
const TEST_CONN = '/plugins/dsh-opendesign-usage/test-connection';

/** 完整的可用配置。 */
const FULL = {
  enableComposerUsage: true,
  enablePlanQuota: true,
  enableTokenUsage: true,
  workspaceId: 'ws-1',
  sessionCookie: 'tok-1',
  refreshIntervalMs: 300000,
};

/* ── 路由注册 ─────────────────────────────────────────────────────── */

test('apply 注册两条路由，路径与常量一致', () => {
  const { routes } = mountPlugin(FULL, async () => ({ ok: true, status: 200, json: async () => UPSTREAM_OK }));
  assert.deepEqual([...routes.keys()].sort(), [PLAN, TEST_CONN]);
});

/* ── 成功路径 ─────────────────────────────────────────────────────── */

test('plan-usage 成功时返回归一化窗口与 flags', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => UPSTREAM_OK });
  const { routes } = mountPlugin(FULL, fetchImpl);
  const res = makeRes();
  await routes.get(PLAN)(makeReq('GET', 'http://127.0.0.1:35601'), res);

  assert.equal(res.statusCode, 200);
  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.tier, 'go');
  assert.equal(payload.windows.length, 2);
  assert.deepEqual(
    payload.windows.map((w) => w.label),
    ['5h', '7d'],
  );
  // 字符串额度已转数字。
  assert.equal(payload.windows[0].used, 19082);
  assert.equal(payload.windows[0].remainingPercent, 61.8);
  // flags 必须存在（客户端拿它做开关判定）。
  assert.deepEqual(payload.flags, { composerUsage: true, planQuota: true, tokenUsage: true });
  // ⚠️ 安全性质：响应里绝不能出现凭据。
  assert.ok(!res.body.includes('tok-1'), '响应体不应回显凭据');
  assert.ok(!res.body.includes('session_token'), '响应体不应出现 cookie 名');
});

/* ── 凭据缺失：不出网 ─────────────────────────────────────────────── */

test('凭据缺失时返回 NO_CREDENTIALS 且完全不出网', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return { ok: true, status: 200, json: async () => UPSTREAM_OK };
  };
  const { routes } = mountPlugin({ ...FULL, workspaceId: '', sessionCookie: '' }, fetchImpl);
  const res = makeRes();
  await routes.get(PLAN)(makeReq('GET', 'http://127.0.0.1:35601'), res);

  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'NO_CREDENTIALS');
  // 关键：没凭据就不该打上游。
  assert.equal(called, false, '凭据缺失时不应发出上游请求');
  // 失败分支也必须带 flags，否则客户端无法判定开关状态。
  assert.deepEqual(payload.flags, { composerUsage: true, planQuota: true, tokenUsage: true });
});

/* ── 开关关闭：不出网 ─────────────────────────────────────────────── */

test('planQuota 关闭时返回 DISABLED 且完全不出网', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return { ok: true, status: 200, json: async () => UPSTREAM_OK };
  };
  const { routes } = mountPlugin({ ...FULL, enablePlanQuota: false, enableTokenUsage: false }, fetchImpl);
  const res = makeRes();
  await routes.get(PLAN)(makeReq('GET', 'http://127.0.0.1:35601'), res);

  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, false);
  // ⚠️ 这个 code 客户端必须当「正常态」处理，不是错误。
  assert.equal(payload.code, 'DISABLED');
  assert.equal(called, false, '开关关闭时不应发出上游请求');
  assert.equal(payload.flags.planQuota, false);
  assert.equal(payload.flags.tokenUsage, false);
});

/* ── loopback 来源检查 ────────────────────────────────────────────── */

test('跨站 Origin 被 403 拒绝，不触达上游', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return { ok: true, status: 200, json: async () => UPSTREAM_OK };
  };
  const { routes } = mountPlugin(FULL, fetchImpl);
  const res = makeRes();
  await routes.get(PLAN)(makeReq('GET', 'https://evil.example.com'), res);

  assert.equal(res.statusCode, 403);
  assert.equal(JSON.parse(res.body).code, 'FORBIDDEN');
  // 这条路由会带上用户的 cookie，跨站请求绝不能放行。
  assert.equal(called, false, '跨站请求不应触达上游');
});

test('loopback、dsh-app 协议与无 Origin 都放行', async () => {
  const fetchImpl = async () => ({ ok: true, status: 200, json: async () => UPSTREAM_OK });
  // ⚠️ `dsh-app://app` 是**桌面版 DSH 页面的真实 origin**，必须放行。
  // 2026-10-15 实测事故：原实现只认 loopback 主机名，把插件自己的合法请求
  // 挡成 403 —— 控件显示 `OD · —` 并提示"额度暂时取不到"，而 curl 直打是 200。
  // 这个缺陷此前漏掉，正是因为测试的 req 从不带 Origin，所以这里逐个列全。
  const allowed = [
    'http://127.0.0.1:35601',
    'http://localhost:35601',
    'http://[::1]:35601',
    'https://127.0.0.1:41219',
    'dsh-app://app',
    'dsh-app://app/',
    undefined, // 同源 fetch 可能不带 Origin
  ];
  for (const origin of allowed) {
    const { routes } = mountPlugin(FULL, fetchImpl);
    const res = makeRes();
    await routes.get(PLAN)(makeReq('GET', origin), res);
    assert.equal(res.statusCode, 200, `origin=${String(origin)} 应放行`);
    assert.equal(JSON.parse(res.body).ok, true, `origin=${String(origin)} 应成功`);
  }
});

test('非本机 origin 一律 403，且不触达上游', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return { ok: true, status: 200, json: async () => UPSTREAM_OK };
  };
  // 放行 dsh-app 之后，更要确认没有把口子开成"什么都放"。
  const denied = [
    'https://evil.example.com',
    'http://192.168.1.10:35601', // 内网其它主机不是 loopback
    'https://open-design.ai', // 上游站点本身也不行（它不该来打我们的路由）
    'file://',
    'about:blank',
    'dsh-app-evil://app', // 前缀像但不是我们的协议
    'not a url',
  ];
  for (const origin of denied) {
    called = false;
    const { routes } = mountPlugin(FULL, fetchImpl);
    const res = makeRes();
    await routes.get(PLAN)(makeReq('GET', origin), res);
    assert.equal(res.statusCode, 403, `origin=${String(origin)} 应拒绝`);
    assert.equal(JSON.parse(res.body).code, 'FORBIDDEN');
    assert.equal(called, false, `origin=${String(origin)} 不应触达上游`);
  }
});

/* ── 上游错误归一 ─────────────────────────────────────────────────── */

test('上游 401 归一成 UNAUTHORIZED 并保留 flags', async () => {
  const fetchImpl = async () => ({ ok: false, status: 401, json: async () => ({}) });
  const { routes } = mountPlugin(FULL, fetchImpl);
  const res = makeRes();
  await routes.get(PLAN)(makeReq('GET', 'http://127.0.0.1:35601'), res);

  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'UNAUTHORIZED');
  assert.deepEqual(payload.flags, { composerUsage: true, planQuota: true, tokenUsage: true });
});

test('上游异常归一成 UPSTREAM', async () => {
  const fetchImpl = async () => {
    throw new Error('ECONNREFUSED');
  };
  const { routes } = mountPlugin(FULL, fetchImpl);
  const res = makeRes();
  await routes.get(PLAN)(makeReq('GET', 'http://127.0.0.1:35601'), res);

  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'UPSTREAM');
});

/* ── test-connection ──────────────────────────────────────────────── */

test('test-connection 用请求体里的草稿凭据，而不是已保存的配置', async () => {
  let seenHeaders;
  const fetchImpl = async (url, init) => {
    seenHeaders = init.headers;
    return { ok: true, status: 200, json: async () => UPSTREAM_OK };
  };
  // 已保存的配置是空凭据 —— 草稿值必须能覆盖它，否则「先测再存」就不成立。
  const { routes } = mountPlugin({ ...FULL, workspaceId: '', sessionCookie: '' }, fetchImpl);
  const res = makeRes();
  const draft = JSON.stringify({ workspaceId: 'draft-ws', sessionCookie: 'draft-tok' });
  await routes.get(TEST_CONN)(makeReq('POST', 'http://127.0.0.1:35601', draft), res);

  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.tier, 'go');
  assert.equal(seenHeaders['x-vela-workspace-id'], 'draft-ws');
  assert.ok(String(seenHeaders.cookie).includes('draft-tok'));
  // 仍然不回显凭据。
  assert.ok(!res.body.includes('draft-tok'), '响应体不应回显凭据');
});

test('test-connection 对非法 JSON 给 BAD_REQUEST', async () => {
  const { routes } = mountPlugin(FULL, async () => ({ ok: true, status: 200, json: async () => UPSTREAM_OK }));
  const res = makeRes();
  await routes.get(TEST_CONN)(makeReq('POST', 'http://127.0.0.1:35601', '{not json'), res);

  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'BAD_REQUEST');
});

test('test-connection 缺凭据时给 NO_CREDENTIALS', async () => {
  const { routes } = mountPlugin(FULL, async () => ({ ok: true, status: 200, json: async () => UPSTREAM_OK }));
  const res = makeRes();
  await routes.get(TEST_CONN)(makeReq('POST', 'http://127.0.0.1:35601', JSON.stringify({})), res);

  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'NO_CREDENTIALS');
});

/* ── 钱包余额随额度一起返回 ───────────────────────────────────────── */

/** 真实的上游账单摘要形状。 */
const WALLET_OK = {
  balanceUsd: '1.5000',
  creditsPerUsd: 10000,
  balances: { subscriptionCredits: '10000', rechargeCredits: '5000', totalAvailableCredits: '15000' },
  subscriptionCreditsUsd: '1.0000',
  rechargeCreditsUsd: '0.5000',
  totalAvailableCreditsUsd: '1.5000',
  membershipTier: 'go',
  subscriptionStatus: 'active',
  usageCount: 2079,
};

/** 按 URL 分派的假 fetch：额度与钱包是两个不同路径。 */
function routedFetch({ plan = UPSTREAM_OK, wallet = WALLET_OK, planStatus = 200, walletStatus = 200 } = {}) {
  return async (url) => {
    if (String(url).includes('coding-plan-usage')) {
      return {
        ok: planStatus >= 200 && planStatus < 300,
        status: planStatus,
        json: async () => plan,
      };
    }
    return {
      ok: walletStatus >= 200 && walletStatus < 300,
      status: walletStatus,
      json: async () => wallet,
    };
  };
}

test('plan-usage 同时带回钱包余额，且两者单位都在', async () => {
  const { routes } = mountPlugin(FULL, routedFetch());
  const res = makeRes();
  await routes.get(PLAN)(makeReq('GET', 'http://127.0.0.1:35601'), res);

  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.windows.length, 2);
  // 钱包随同一个响应回来，省掉一次往返。
  assert.equal(payload.wallet.ok, true);
  assert.equal(payload.wallet.totalUsd, 1.5);
  assert.equal(payload.wallet.totalCredits, 15000);
  assert.equal(payload.wallet.membershipTier, 'go');
  assert.ok(!res.body.includes('tok-1'), '响应体不应回显凭据');
});

test('钱包接口挂掉不影响额度显示（两个数据源互相独立）', async () => {
  // 额度正常、钱包 500：用户仍应看到套餐额度。
  const { routes } = mountPlugin(FULL, routedFetch({ walletStatus: 500 }));
  const res = makeRes();
  await routes.get(PLAN)(makeReq('GET', 'http://127.0.0.1:35601'), res);

  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true, '额度不应因钱包失败而失败');
  assert.equal(payload.windows.length, 2);
  assert.equal(payload.wallet.ok, false);
  assert.equal(payload.wallet.code, 'UPSTREAM');
});

test('额度挂掉但钱包正常时，钱包仍可用', async () => {
  const { routes } = mountPlugin(FULL, routedFetch({ planStatus: 500 }));
  const res = makeRes();
  await routes.get(PLAN)(makeReq('GET', 'http://127.0.0.1:35601'), res);

  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, 'UPSTREAM');
  // 反过来也一样：钱包不该被额度的失败拖没。
  assert.equal(payload.wallet.ok, true);
  assert.equal(payload.wallet.totalUsd, 1.5);
});

test('test-connection 也带回钱包，用的是草稿凭据', async () => {
  let sawHeader;
  const fetchImpl = async (url, init) => {
    sawHeader = init.headers['x-vela-workspace-id'];
    return String(url).includes('coding-plan-usage')
      ? { ok: true, status: 200, json: async () => UPSTREAM_OK }
      : { ok: true, status: 200, json: async () => WALLET_OK };
  };
  const { routes } = mountPlugin({ ...FULL, workspaceId: '', sessionCookie: '' }, fetchImpl);
  const res = makeRes();
  await routes.get(TEST_CONN)(
    makeReq('POST', 'http://127.0.0.1:35601', JSON.stringify({ workspaceId: 'draft-ws', sessionCookie: 'draft-tok' })),
    res,
  );

  const payload = JSON.parse(res.body);
  assert.equal(payload.ok, true);
  assert.equal(payload.wallet.ok, true);
  assert.equal(sawHeader, 'draft-ws', '两个上游请求都该用草稿 workspaceId');
  assert.ok(!res.body.includes('draft-tok'), '响应体不应回显凭据');
});
