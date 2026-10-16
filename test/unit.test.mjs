/**
 * dsh-opendesign-usage —— 纯函数单元测试。
 *
 * 只测**不依赖 DSH 运行时**的部分：常量层、配置层、以及宿主侧的归一化函数。
 * 这一层的价值在于：上游返回的 credits 字段是**字符串**，若归一化写错，
 * 界面会显示 `NaN%` 或把 `"19082"` 当字符串拼进百分比 —— 这类错误在真实
 * 界面里表现为「数字不对」，很难一眼归因，必须在单测里钉死。
 *
 * 运行：node --test test/*.test.mjs
 *
 * @module dsh-opendesign-usage/test
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  WINDOW_5H,
  WINDOW_7D,
  defaultSettings,
  formatDuration,
  formatTokenCount,
  looksLikeWorkspaceId,
  normalizeFlag,
  normalizeRefreshInterval,
  normalizeSessionCookie,
  normalizeText,
  remainingPercentOf,
  windowLabelOf,
} from '../src/constants.js';
import { hasCredentials, resolveConfig, unwrapDeep } from '../src/config.js';

/* ── constants：窗口标签 ───────────────────────────────────────────── */

test('windowLabelOf 只认上游真实存在的两个窗口', () => {
  assert.equal(windowLabelOf(WINDOW_5H), '5h');
  assert.equal(windowLabelOf(WINDOW_7D), '7d');
  // 未知窗口必须返回 undefined 而不是猜一个 —— 猜错会把 30 天窗口标成「7 天」。
  assert.equal(windowLabelOf(3600), undefined);
  assert.equal(windowLabelOf(undefined), undefined);
  assert.equal(windowLabelOf(null), undefined);
});

/* ── constants：剩余百分比 ─────────────────────────────────────────── */

test('remainingPercentOf 用 limit 做分母并夹到 0-100', () => {
  // 真实数据：5 小时窗口 30918/50000。
  assert.equal(remainingPercentOf(30918, 50000), 61.8);
  assert.equal(remainingPercentOf(130918, 150000), 87.3);
  // 超额不能变成负数。
  assert.equal(remainingPercentOf(-5, 100), 0);
  // 也不能超过 100。
  assert.equal(remainingPercentOf(200, 100), 100);
  // 无法计算时给 undefined，调用方据此显示「—」而不是 0%。
  assert.equal(remainingPercentOf(10, 0), undefined);
  assert.equal(remainingPercentOf(Number.NaN, 100), undefined);
  assert.equal(remainingPercentOf(10, Number.NaN), undefined);
});

/* ── constants：时长与 token 格式化 ────────────────────────────────── */

test('formatDuration 给两级单位，过期给「即将重置」', () => {
  // 8460000 ms = 2h21m，与实测的重置倒计时形状一致。
  assert.equal(formatDuration(8460000, 'zh'), '2小时21分');
  assert.equal(formatDuration(8460000, 'en'), '2h 21m');
  // 整小时不带分钟。
  assert.equal(formatDuration(7200000, 'zh'), '2小时');
  // 天级。
  assert.equal(formatDuration(604800000, 'zh'), '7天');
  // 已过期。
  assert.equal(formatDuration(0, 'zh'), '即将重置');
  assert.equal(formatDuration(-1, 'en'), 'resetting now');
  // 非数字给空串，界面据此不渲染这一行。
  assert.equal(formatDuration(Number.NaN), '');
});

test('formatTokenCount 紧凑但不撒谎', () => {
  assert.equal(formatTokenCount(999), '999');
  assert.equal(formatTokenCount(12345), '12k');
  assert.equal(formatTokenCount(1500), '1.5k');
  assert.equal(formatTokenCount(999999), '1000k');
  assert.equal(formatTokenCount(1500000), '1.5M');
  assert.equal(formatTokenCount(0), '0');
  assert.equal(formatTokenCount(-1), '0');
});

/* ── constants：凭据归一化（最容易出错的输入）──────────────────────── */

test('normalizeSessionCookie 三种粘贴方式都能用', () => {
  // 1) 只粘裸 token。
  assert.equal(normalizeSessionCookie('abc.def%3D'), 'abc.def%3D');
  // 2) 整段 Cookie 头里挑出目标 cookie。
  assert.equal(
    normalizeSessionCookie('__Secure-better-auth.session_token=abc123; other=x'),
    'abc123',
  );
  // 3) 带 `Cookie:` 前缀的整段头部。
  assert.equal(normalizeSessionCookie('Cookie: __Secure-better-auth.session_token=abc123'), 'abc123');
  // 4) 短名 session_token 也认。
  assert.equal(normalizeSessionCookie('session_token=xyz'), 'xyz');
  // 5) 空与非字符串给空串。
  assert.equal(normalizeSessionCookie(''), '');
  assert.equal(normalizeSessionCookie('   '), '');
  assert.equal(normalizeSessionCookie(null), '');
  assert.equal(normalizeSessionCookie(undefined), '');
  // 6) 首尾空白被去掉（用户复制时常带空格）。
  assert.equal(normalizeSessionCookie('  tok  '), 'tok');
});

test('normalizeSessionCookie 不把 cookie 名留在结果里', () => {
  // 这条是安全性质的：结果会被直接拼进 Cookie 头，若残留名字会拼出
  // `__Secure-...=__Secure-...=xxx` 这种坏头部。
  const out = normalizeSessionCookie('__Secure-better-auth.session_token=abc.def');
  assert.ok(!out.includes('='), `结果里不应含 "="，实际：${out}`);
  assert.ok(!out.includes('session_token'), `结果里不应含 cookie 名，实际：${out}`);
});

/* ── constants：其它规范化 ─────────────────────────────────────────── */

test('normalizeFlag 只接受真布尔', () => {
  assert.equal(normalizeFlag(true, false), true);
  assert.equal(normalizeFlag(false, true), false);
  // 未配置（undefined）必须退回默认，不能当成 false —— 否则设置命名空间
  // 尚未绑定时控件会莫名消失。
  assert.equal(normalizeFlag(undefined, true), true);
  assert.equal(normalizeFlag('false', true), true);
  assert.equal(normalizeFlag(null, true), true);
});

test('normalizeRefreshInterval 夹在允许区间内', () => {
  assert.equal(normalizeRefreshInterval(300000), 300000);
  assert.equal(normalizeRefreshInterval(1), 60000);
  assert.equal(normalizeRefreshInterval(99999999), 3600000);
  assert.equal(normalizeRefreshInterval('120000'), 120000);
  assert.equal(normalizeRefreshInterval(undefined), 300000);
  assert.equal(normalizeRefreshInterval('abc'), 300000);
});

test('normalizeText 与 looksLikeWorkspaceId', () => {
  assert.equal(normalizeText('  a  '), 'a');
  assert.equal(normalizeText(null), '');
  assert.equal(looksLikeWorkspaceId('ws_0123456789abcdef'), true);
  assert.equal(looksLikeWorkspaceId(''), false);
  assert.equal(looksLikeWorkspaceId('abc'), false); // 太短
  assert.equal(looksLikeWorkspaceId('has space'), false);
  assert.equal(looksLikeWorkspaceId('../../etc/passwd'), false);
});

/* ── config：volatile 剥壳 ────────────────────────────────────────── */

test('unwrapDeep 剥掉一层与多层活引用', () => {
  const live = (value) => ({ get: () => value });
  assert.equal(unwrapDeep(live('a')), 'a');
  // 嵌套对象里的活引用也要剥。
  assert.deepEqual(unwrapDeep({ x: live(1), y: { z: live(2) } }), { x: 1, y: { z: 2 } });
  // 抛异常的 get() 不能把整个 resolve 拖垮。
  const throwing = { get: () => { throw new Error('boom'); } };
  assert.equal(unwrapDeep(throwing), undefined);
  // 普通值原样。
  assert.equal(unwrapDeep(5), 5);
  assert.equal(unwrapDeep(null), null);
});

test('resolveConfig 对含活引用的入参给出普通值', () => {
  const live = (value) => ({ get: () => value });
  const resolved = resolveConfig({
    enableComposerUsage: live(false),
    enablePlanQuota: live(true),
    enableTokenUsage: live(true),
    workspaceId: live('  ws_0123456789abcdef  '),
    sessionCookie: live('__Secure-better-auth.session_token=tok123; x=y'),
    refreshIntervalMs: live(120000),
  });
  assert.equal(resolved.enableComposerUsage, false);
  assert.equal(resolved.workspaceId, 'ws_0123456789abcdef');
  // cookie 必须已被收敛成裸 token —— 路由不再做二次解析。
  assert.equal(resolved.sessionCookie, 'tok123');
  assert.equal(resolved.refreshIntervalMs, 120000);
});

test('resolveConfig 对空入参给出默认值', () => {
  const resolved = resolveConfig();
  assert.deepEqual(resolved, defaultSettings());
  // 默认三个开关都开，凭据为空。
  assert.equal(resolved.enableComposerUsage, true);
  assert.equal(resolved.workspaceId, '');
  assert.equal(resolved.sessionCookie, '');
});

test('hasCredentials 只在两项都非空时为真', () => {
  const base = defaultSettings();
  assert.equal(hasCredentials(base), false);
  assert.equal(hasCredentials({ ...base, workspaceId: 'ws' }), false);
  assert.equal(hasCredentials({ ...base, sessionCookie: 'tok' }), false);
  assert.equal(hasCredentials({ ...base, workspaceId: 'ws', sessionCookie: 'tok' }), true);
});
