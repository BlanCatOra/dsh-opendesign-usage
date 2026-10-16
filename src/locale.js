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
export function createLocale() {
  return {
    zh: { ...USAGE_ZH, ...SETTINGS_ZH },
    en: { ...USAGE_EN, ...SETTINGS_EN },
  };
}

/** 中英键是否一一对应（供测试/自检用）。 */
export function localeKeysAligned() {
  const { zh, en } = createLocale();
  const zhKeys = Object.keys(zh).sort();
  const enKeys = Object.keys(en).sort();
  return (
    zhKeys.length === enKeys.length && zhKeys.every((key, index) => key === enKeys[index])
  );
}
