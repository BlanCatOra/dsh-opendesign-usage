/**
 * dsh-opendesign-usage —— 宿主侧归一化与请求组装的测试。
 *
 * 这些函数是「上游真实数据 → 界面数字」的**唯一**转换点，所以在这里钉死：
 *  - 上游把 credits 给成字符串（`"19082"`），必须转成数字；
 *  - 缺 `remainingCredits` 时要能算出来，而不是显示 0；
 *  - 请求头必须带 Origin/Referer（上游在 Cloudflare 后校验站点源）；
 *  - cookie 一定不能出现在响应里。
 *
 * 上游样例数据取自 2026-10-15 的真实响应。
 *
 * @module dsh-opendesign-usage/test/host
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  fetchPlanUsage,
  fetchWalletSummary,
  flagsOf,
  normalizeUpstream,
  normalizeWallet,
  normalizeWindow,
  toNumber,
  upstreamHeaders,
  upstreamUrl,
  walletUrl,
} from '../src/index.js';
import { defaultSettings } from '../src/constants.js';

/** 真实的 /v1/.../coding-plan-usage 响应体（字段原样照抄，credits 是字符串）。 */
const REAL_UPSTREAM = {
  workspaceId: 'ws_0123456789abcdef',
  generatedAt: '2026-10-14T21:23:33.867Z',
  eligible: true,
  tier: 'go',
  windows: [
    {
      policyId: 'model_limit_policy_yfhv1kw691dx46efu0lgxvnf',
      durationSeconds: 18000,
      resetMode: 'anchored_recurring',
      usedCredits: '19082',
      limitCredits: '50000',
      remainingCredits: '30918',
      windowStart: '2026-10-14T18:44:46.000Z',
      resetsAt: '2026-10-14T23:44:46.000Z',
    },
    {
      policyId: 'model_limit_policy_ois3y3aw7jmck720x5bobizq',
      durationSeconds: 604800,
      resetMode: 'anchored_recurring',
      usedCredits: '19082',
      limitCredits: '150000',
      remainingCredits: '130918',
      windowStart: '2026-10-14T18:44:46.000Z',
      resetsAt: '2026-10-21T18:44:46.000Z',
    },
  ],
};

/* ── toNumber ─────────────────────────────────────────────────────── */

test('toNumber 处理上游的字符串 credits', () => {
  assert.equal(toNumber('19082'), 19082);
  assert.equal(toNumber(' 42 '), 42);
  assert.equal(toNumber(7), 7);
  // 无法解析给 undefined，让调用方决定兜底 —— 不能静默变 0。
  assert.equal(toNumber(''), undefined);
  assert.equal(toNumber('abc'), undefined);
  assert.equal(toNumber(null), undefined);
  assert.equal(toNumber(undefined), undefined);
  assert.equal(toNumber(Number.NaN), undefined);
  assert.equal(toNumber(Number.POSITIVE_INFINITY), undefined);
});

/* ── normalizeWindow ──────────────────────────────────────────────── */

test('normalizeWindow 把真实窗口转成界面数字', () => {
  const now = Date.parse('2026-10-14T21:23:13.867Z');
  const w = normalizeWindow(REAL_UPSTREAM.windows[0], now);
  assert.equal(w.label, '5h');
  assert.equal(w.durationSeconds, 18000);
  // 关键：字符串必须变成数字。
  assert.equal(w.used, 19082);
  assert.equal(w.limit, 50000);
  assert.equal(w.remaining, 30918);
  assert.equal(w.remainingPercent, 61.8);
  assert.equal(w.resetsAt, '2026-10-14T23:44:46.000Z');
  // 现在距重置 2 小时 21 分左右。
  assert.ok(w.resetsInMs > 8_000_000 && w.resetsInMs < 9_000_000, `resetsInMs=${w.resetsInMs}`);
});

test('normalizeWindow 缺 remainingCredits 时用 limit-used 兜底', () => {
  const w = normalizeWindow({ durationSeconds: 18000, usedCredits: '100', limitCredits: '500' }, 0);
  assert.equal(w.remaining, 400);
  assert.equal(w.remainingPercent, 80);
});

test('normalizeWindow 对垃圾输入不抛错', () => {
  const w = normalizeWindow(null, 0);
  assert.equal(w.used, 0);
  assert.equal(w.limit, 0);
  assert.equal(w.remainingPercent, 0);
  // 未知窗口不能被错标成 5h/7d。
  assert.equal(normalizeWindow({ durationSeconds: 86400 }, 0).label, '86400s');
  assert.equal(normalizeWindow({}, 0).label, 'unknown');
});

/* ── normalizeUpstream ────────────────────────────────────────────── */

test('normalizeUpstream 输出 5h 与 7d，且 5h 排前', () => {
  const now = Date.parse('2026-10-14T21:23:13.867Z');
  const out = normalizeUpstream(REAL_UPSTREAM, now);
  assert.equal(out.tier, 'go');
  assert.equal(out.eligible, true);
  assert.equal(out.generatedAt, '2026-10-14T21:23:33.867Z');
  assert.equal(out.fetchedAt, new Date(now).toISOString());
  assert.equal(out.windows.length, 2);
  assert.deepEqual(
    out.windows.map((w) => w.label),
    ['5h', '7d'],
  );
  assert.equal(out.windows[0].remainingPercent, 61.8);
  assert.equal(out.windows[1].remainingPercent, 87.3);
});

test('normalizeUpstream 在 windows 乱序时仍把 5h 排前', () => {
  const shuffled = { ...REAL_UPSTREAM, windows: [REAL_UPSTREAM.windows[1], REAL_UPSTREAM.windows[0]] };
  const out = normalizeUpstream(shuffled, 0);
  assert.deepEqual(
    out.windows.map((w) => w.label),
    ['5h', '7d'],
  );
});

test('normalizeUpstream 对空响应给可用形状', () => {
  const out = normalizeUpstream({}, 0);
  assert.equal(out.tier, '');
  assert.equal(out.eligible, false);
  assert.deepEqual(out.windows, []);
});

/* ── flagsOf ──────────────────────────────────────────────────────── */

test('flagsOf 映射三个开关', () => {
  const base = defaultSettings();
  assert.deepEqual(flagsOf(base), { composerUsage: true, planQuota: true, tokenUsage: true });
  assert.deepEqual(
    flagsOf({ ...base, enableComposerUsage: false, enableTokenUsage: false }),
    { composerUsage: false, planQuota: true, tokenUsage: false },
  );
});

/* ── 请求组装 ─────────────────────────────────────────────────────── */

test('upstreamUrl 用真实主机而不是文档里的 amr.dev', () => {
  const url = upstreamUrl('ws_0123456789abcdef');
  assert.equal(
    url,
    'https://amr-api.open-design.ai/api/v1/workspaces/ws_0123456789abcdef/billing/coding-plan-usage',
  );
  // api.amr.dev 实测无 DNS 记录，绝不能出现在这里。
  assert.ok(!url.includes('amr.dev'));
});

test('upstreamUrl 对 workspaceId 做编码', () => {
  // 防止把路径分隔符或查询串注入进 URL。
  assert.ok(!upstreamUrl('a/b?c=d').includes('a/b?c=d'));
});

test('upstreamHeaders 带齐鉴权与站点源，且 cookie 只出现一次', () => {
  const headers = upstreamHeaders('ws1', 'tok.abc');
  assert.equal(headers['x-vela-workspace-id'], 'ws1');
  assert.equal(headers.cookie, '__Secure-better-auth.session_token=tok.abc');
  // 上游在 Cloudflare 后校验站点源。
  assert.equal(headers.origin, 'https://open-design.ai');
  assert.equal(headers.referer, 'https://open-design.ai/');
  // 只应有一个 `=`（名字与值之间），值本身不含名字。
  assert.equal(headers.cookie.split('=').length, 2);
});

/* ── fetchPlanUsage：用假 fetch，绝不打真网络 ─────────────────────── */

test('fetchPlanUsage 成功路径返回归一化窗口', async () => {
  let seenUrl;
  let seenInit;
  const fakeFetch = async (url, init) => {
    seenUrl = url;
    seenInit = init;
    return {
      ok: true,
      status: 200,
      json: async () => REAL_UPSTREAM,
    };
  };
  const result = await fetchPlanUsage('ws_0123456789abcdef', 'tok', fakeFetch, 0);
  assert.equal(result.ok, true);
  assert.equal(result.tier, 'go');
  assert.equal(result.windows.length, 2);
  // 打的是真实主机。
  assert.ok(seenUrl.includes('amr-api.open-design.ai'));
  // 带了 cookie。
  assert.ok(String(seenInit.headers.cookie).includes('tok'));
  // ⚠️ 响应里绝不回显 cookie。
  assert.ok(!JSON.stringify(result).includes('tok'), '响应体里不应出现凭据');
});

test('fetchPlanUsage 把 401/403 归一成 UNAUTHORIZED', async () => {
  for (const status of [401, 403]) {
    const fakeFetch = async () => ({ ok: false, status, json: async () => ({}) });
    const result = await fetchPlanUsage('ws', 'tok', fakeFetch, 0);
    assert.equal(result.ok, false);
    assert.equal(result.code, 'UNAUTHORIZED');
    assert.ok(!JSON.stringify(result).includes('tok'));
  }
});

test('fetchPlanUsage 把网络异常归一成 UPSTREAM', async () => {
  const fakeFetch = async () => {
    throw new Error('ECONNREFUSED');
  };
  const result = await fetchPlanUsage('ws', 'tok', fakeFetch, 0);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'UPSTREAM');
});

test('fetchPlanUsage 把非 2xx 归一成 UPSTREAM 并不泄露响应体细节', async () => {
  const fakeFetch = async () => ({ ok: false, status: 500, json: async () => ({ secret: 'x' }) });
  const result = await fetchPlanUsage('ws', 'tok', fakeFetch, 0);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'UPSTREAM');
});

/* ── 钱包余额（/api/v1/billing/summary）─────────────────────────────── */

/** 真实的上游账单摘要响应（字段原样照抄，金额都是 4 位小数字符串）。 */
const REAL_WALLET = {
  balanceUsd: '1.5000',
  creditsPerUsd: 10000,
  balances: {
    subscriptionCredits: '10000',
    rechargeCredits: '5000',
    totalAvailableCredits: '15000',
  },
  subscriptionCreditsUsd: '1.0000',
  rechargeCreditsUsd: '0.5000',
  totalAvailableCreditsUsd: '1.5000',
  membershipTier: 'go',
  subscriptionStatus: 'active',
  totalConsumedUsd: '0.0000',
  todayConsumedUsd: '0.0000',
  usageCount: 2079,
  updatedAt: '2026-10-14T22:03:03.986Z',
};

test('normalizeWallet 把字符串金额转成数字并保留两种单位', () => {
  const w = normalizeWallet(REAL_WALLET);
  // 用户看到的控制台是 $1.50，这里必须一致。
  assert.equal(w.totalUsd, 1.5);
  assert.equal(w.subscriptionUsd, 1);
  assert.equal(w.rechargeUsd, 0.5);
  // 套餐额度那部分以 credits 计，两个单位都要留着才能对上。
  assert.equal(w.creditsPerUsd, 10000);
  assert.equal(w.totalCredits, 15000);
  assert.equal(w.subscriptionCredits, 10000);
  assert.equal(w.rechargeCredits, 5000);
  assert.equal(w.membershipTier, 'go');
  assert.equal(w.subscriptionStatus, 'active');
  assert.equal(w.usageCount, 2079);
});

test('normalizeWallet 在合计缺失时自己相加', () => {
  const partial = { ...REAL_WALLET };
  delete partial.totalAvailableCreditsUsd;
  delete partial.balanceUsd;
  const w = normalizeWallet(partial);
  assert.equal(w.totalUsd, 1.5, '应由 subscription + recharge 相加得出');
});

test('normalizeWallet 对垃圾输入不抛错且不产生 NaN', () => {
  const w = normalizeWallet(null);
  assert.equal(w.totalUsd, 0);
  assert.equal(w.totalCredits, 0);
  assert.equal(w.membershipTier, '');
  const broken = normalizeWallet({ totalAvailableCreditsUsd: 'abc', balances: 'nope' });
  assert.ok(Number.isFinite(broken.totalUsd), '不应产生 NaN');
  assert.equal(broken.totalCredits, 0);
});

test('walletUrl 不含 workspaceId 路径参数', () => {
  // ⚠️ 与额度接口不同：上游这个路径是按登录账号返回的，带 id 反而 404。
  assert.equal(walletUrl(), 'https://amr-api.open-design.ai/api/v1/billing/summary');
});

test('fetchWalletSummary 成功路径归一化且不回显凭据', async () => {
  let seenUrl;
  const fakeFetch = async (url, init) => {
    seenUrl = url;
    assert.ok(String(init.headers.cookie).includes('tok'));
    return { ok: true, status: 200, json: async () => REAL_WALLET };
  };
  const result = await fetchWalletSummary('ws-1', 'tok', fakeFetch);
  assert.equal(result.ok, true);
  assert.equal(result.totalUsd, 1.5);
  assert.equal(seenUrl, 'https://amr-api.open-design.ai/api/v1/billing/summary');
  assert.ok(!JSON.stringify(result).includes('tok'), '响应体里不应出现凭据');
});

test('fetchWalletSummary 缺凭据不出网，401 归一成 UNAUTHORIZED', async () => {
  let called = false;
  const spy = async () => {
    called = true;
    return { ok: true, status: 200, json: async () => REAL_WALLET };
  };
  const noCred = await fetchWalletSummary('', '', spy);
  assert.equal(noCred.code, 'NO_CREDENTIALS');
  assert.equal(called, false, '缺凭据不应出网');

  const unauth = await fetchWalletSummary('ws', 'tok', async () => ({ ok: false, status: 401, json: async () => ({}) }));
  assert.equal(unauth.code, 'UNAUTHORIZED');

  const boom = await fetchWalletSummary('ws', 'tok', async () => {
    throw new Error('ECONNREFUSED');
  });
  assert.equal(boom.code, 'UPSTREAM');
});
