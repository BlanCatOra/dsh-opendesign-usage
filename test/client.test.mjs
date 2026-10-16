/**
 * dsh-opendesign-usage —— 客户端（输入框 usage 控件）测试。
 *
 * 分三层，对应三种真实的失败模式：
 *
 *  1. **纯逻辑**：provider 判定、token 合计、百分比与倒计时格式化。这些函数
 *     是界面所有数字的来源，错了不会有异常，只会显示错的东西 —— 所以逐个断言。
 *  2. **接线**：真的跑一遍 `client.js` 的 `apply()`，断言插槽注册的 id/order/
 *     locale/face 正确。注册错 id 会顶掉别的插件的格子，这种错误单元测试看不出来。
 *  3. **行为**：用 react 桩 + fetch 桩真渲染组件，断言 gate 的 provider 判定、
 *     开关联动，以及「网络失败静默降级、不该发请求时一个请求都不发」。
 *
 * 第 3 层是重点：静默降级与「不发无谓请求」是任务里明确要求的约束，而它们
 * 只在真实渲染路径上才存在。
 *
 * @module dsh-opendesign-usage/test/client
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

const R = new URL('../src', import.meta.url).pathname.replace(/\/$/, '');

const { createLocale, localeKeysAligned } = await import(`${R}/locale.js`);
const { createFlagsStore, pickFlags, resolveFlags, FLAG_KEYS, reactFlagsSource } = await import(`${R}/flags-store.js`);
const CU = await import(`${R}/composer-usage.js`);
// ⚠️ 接线层必须跑**真实的 bundle**，不能直接 import src/client.js：
// 真机里 react 只能从 bundle 外壳的 require（宿主冻结基座表）取到，直接 import src/
// 时那条通道不存在，测试就只能自己塞一个假通道 —— 于是"测试全绿、真机全废"
// （2026-10-15 事故正是这样漏掉的）。详见 test/helpers/load-client.mjs。
const loadClient = (await import('./helpers/load-client.mjs')).default;

/**
 * `react-dom` 桩：本插件只用它的 `createPortal`。
 *
 * 桩的行为刻意与真货一致 —— **返回面板节点本身**，而不是塞进 container。
 * 因为测试是在返回的 React 元素树上找 `.dsh-odu-pop` 的；如果这里模拟成
 * "挂到 body"，测试就得去 `document.body` 里找，而那需要真 DOM。
 * 真机上 `createPortal` 把节点挂到 `document.body` 这件事由集成验证覆盖，
 * 单元测试只关心「面板确实被渲染出来了、且带着 --portal 标记」。
 */
function makeReactDom() {
  return {
    createPortal: (node, container) => ({
      ...node,
      props: { ...node.props, __portal: container },
    }),
  };
}

/* ── react 桩 ───────────────────────────────────────────────────────────────
 * 够用即可：本测试关心 render 的输出结构与回调行为，不重实现 React 调度。
 * effect 被记下来由测试手动执行，这样「渲染后发生了哪些副作用」是可控的。
 */
function makeReact() {
  const effects = [];
  const cleanups = [];
  const states = [];
  let cursor = 0;
  const react = {
    createElement: (type, props, ...children) => ({
      type,
      props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children },
    }),
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useRef: (initial) => ({ current: initial }),
    useState: (initial) => {
      const index = cursor++;
      if (states[index] === undefined) states[index] = typeof initial === 'function' ? initial() : initial;
      return [states[index], (next) => { states[index] = typeof next === 'function' ? next(states[index]) : next; }];
    },
    useEffect: (fn) => { effects.push(fn); },
    // `useAnchoredPosition` 用 `useLayoutEffect` 测量锚点。测试环境（无真实 DOM
    // 布局）下按 effect 同样收集即可 —— 它注册的 scroll/resize 监听会被 cleanup 摘掉，
    // 不摘会泄漏到后续用例（本文件曾经就因为没清 interval 挂住 60 秒）。
    useLayoutEffect: (fn) => { effects.push(fn); },
    __effects: effects,
    __cleanups: cleanups,
    /** 跑掉所有已注册的清理函数（含 clearInterval），让事件循环能排空。 */
    __dispose: () => {
      for (const cleanup of cleanups.splice(0)) cleanup?.();
      effects.length = 0;
    },
    // 每次「重新渲染」等于一次全新的挂载：state 与 effect 都必须清空，
    // 否则上一轮的 flags 会按 index 泄漏进这一轮（会掩盖真正的 gate 缺陷）。
    __reset: () => {
      cursor = 0;
      states.length = 0;
      effects.length = 0;
      for (const cleanup of cleanups.splice(0)) cleanup?.();
    },
  };
  return react;
}

/**
 * 跑掉本次渲染收集到的 effect。
 *
 * 返回的清理函数按 React 的语义留到**下一轮 reset** 时执行；这一点不是装饰：
 * 组件里有一个 `setInterval`，不执行清理就会让 node:test 永远等不到事件循环
 * 排空（表现为测试挂死 60s 后被取消）。
 */
function runEffects(react) {
  const pending = react.__effects.splice(0);
  for (const effect of pending) {
    const cleanup = effect();
    if (typeof cleanup === 'function') react.__cleanups.push(cleanup);
  }
}

const flush = async () => {
  for (let i = 0; i < 6; i += 1) await new Promise((resolve) => setTimeout(resolve, 1));
};

const t = (key, vars) => {
  const { zh } = createLocale();
  let text = zh[key] ?? key;
  for (const [name, value] of Object.entries(vars ?? {})) text = text.replaceAll(`{${name}}`, String(value));
  return text;
};

/* ── 1. 纯逻辑 ───────────────────────────────────────────────────────────── */

test('provider 判定：next 优先于 lastUsed', () => {
  assert.equal(CU.providerOfSelection({ next: { provider: 'opendesign' }, lastUsed: { provider: 'other' } }), 'opendesign');
  assert.equal(CU.providerOfSelection({ lastUsed: { provider: 'opendesign' } }), 'opendesign');
  // next 为 null 时必须继续看 lastUsed，不能因为「键存在」就返回 undefined。
  assert.equal(CU.providerOfSelection({ next: null, lastUsed: { provider: 'opendesign' } }), 'opendesign');
  assert.equal(CU.providerOfSelection({ next: { provider: '' } }), undefined);
  assert.equal(CU.providerOfSelection(undefined), undefined);
  assert.equal(CU.providerOfSelection({}), undefined);
});

test('isOwnProvider 只认 constants 表里的 provider', () => {
  assert.equal(CU.isOwnProvider('opendesign'), true);
  assert.equal(CU.isOwnProvider('anthropic'), false);
  assert.equal(CU.isOwnProvider(undefined), false);
  assert.equal(CU.isOwnProvider(42), false);
});

test('token 合计是四项之和，脏值按 0', () => {
  assert.deepEqual(
    CU.tokenTotalsOf({ uncachedInputTokens: 1200, outputTokens: 340, cacheReadTokens: 5000, cacheWriteTokens: 60 }),
    { input: 1200, output: 340, cacheRead: 5000, cacheWrite: 60, total: 6600 },
  );
  assert.equal(CU.tokenTotalsOf({ uncachedInputTokens: 10 }).total, 10);
  assert.equal(CU.tokenTotalsOf(undefined).total, 0);
  assert.equal(CU.tokenTotalsOf({ uncachedInputTokens: -5, outputTokens: 7 }).total, 7);
  assert.equal(CU.tokenTotalsOf({ uncachedInputTokens: NaN, outputTokens: 7 }).total, 7);
});

test('planViewOf 归一化：labelling、类型转换、不信任宿主百分比', () => {
  const view = CU.planViewOf({
    ok: true,
    tier: 'go',
    eligible: true,
    flags: { enablePlanQuota: true },
    windows: [
      { durationSeconds: 18000, remaining: 30918, limit: 50000, remainingPercent: 61.8, resetsInMs: 8460000 },
      { durationSeconds: 604800, remaining: 130918, limit: 150000, remainingPercent: 87.3, resetsInMs: 5e8 },
    ],
  });
  assert.equal(view.ok, true);
  assert.equal(view.tier, 'go');
  assert.equal(view.windows[0].label, '5h');
  assert.equal(view.windows[1].label, '7d');
  assert.equal(view.windows[0].remainingPercent, 61.8);
  assert.deepEqual(view.flags, { enablePlanQuota: true });

  // 宿主给的百分比若与 remaining/limit 矛盾，以现算为准（两端版本可能不同）。
  const distrust = CU.planViewOf({ ok: true, windows: [{ durationSeconds: 18000, remaining: 25000, limit: 50000, remainingPercent: 99.9 }] });
  assert.equal(distrust.windows[0].remainingPercent, 50);

  // 上游的 credits 是字符串；宿主理论上已转，但客户端遇上是数字字符串也要能算。
  const strings = CU.planViewOf({ ok: true, windows: [{ durationSeconds: 18000, remaining: '30918', limit: '50000' }] });
  assert.equal(strings.windows[0].remainingPercent, 61.8);

  // 未知窗口不能被误标成 5h / 7d。
  assert.equal(CU.planViewOf({ ok: true, windows: [{ durationSeconds: 3600, remaining: 1, limit: 2 }] }).windows[0].label, undefined);
});

test('planViewOf 对失败与畸形输入不抛错', () => {
  assert.equal(CU.planViewOf(null).ok, false);
  assert.equal(CU.planViewOf({ ok: false, code: 'UNAUTHORIZED' }).code, 'UNAUTHORIZED');
  assert.equal(CU.planViewOf({ ok: false, code: 'UNAUTHORIZED' }).ok, false);
  assert.deepEqual(CU.planViewOf({ ok: true, windows: 'nope' }).windows, []);
  assert.deepEqual(CU.planViewOf({ ok: true, windows: [null, 0, 'x'] }).windows, []);
});

test('折叠态读数：两个额度窗口，钱包与 token 不常驻', () => {
  // 形状：`91% · 97%`（5 小时、7 天）。
  assert.equal(CU.collapseLabelOf({ h5: 91.2, d7: 96.9, planOn: true }), '91% · 97%');
  // 取整到整数（那格只有几十像素，小数没有意义）。
  assert.equal(CU.collapseLabelOf({ h5: 61.8, d7: 87.3, planOn: true }), '62% · 87%');
  // ⚠️ 取不到的窗口显示 `—` 而不是省略：位置恒定，用户才知道是哪一侧缺数据，
  // 不会因为"少了一格"把 7 天错读成 5 小时。
  assert.equal(CU.collapseLabelOf({ h5: undefined, d7: 87.3, planOn: true }), '— · 87%');
  assert.equal(CU.collapseLabelOf({ h5: 61.8, d7: undefined, planOn: true }), '62% · —');
  assert.equal(CU.collapseLabelOf({ planOn: true }), '— · —');
  // 额度开关关闭时整格不渲染（调用方据此 return null）。
  assert.equal(CU.collapseLabelOf({ h5: 61.8, d7: 87.3, planOn: false }), '');
  assert.equal(CU.collapseLabelOf(undefined), '— · —');
});

test('windowPercentsOf 按 label 取，缺哪个就 undefined', () => {
  const windows = [
    { label: '7d', remainingPercent: 87.3 },
    { label: '5h', remainingPercent: 61.8 },
  ];
  // 顺序颠倒也必须取对 —— 按下标会把 7 天当成 5 小时。
  assert.deepEqual(CU.windowPercentsOf(windows), { h5: 61.8, d7: 87.3 });
  assert.deepEqual(CU.windowPercentsOf([{ label: '5h', remainingPercent: 50 }]), { h5: 50, d7: undefined });
  assert.deepEqual(CU.windowPercentsOf([]), { h5: undefined, d7: undefined });
  assert.deepEqual(CU.windowPercentsOf(undefined), { h5: undefined, d7: undefined });
  // 未知窗口不认（上游将来多给窗口时不能被错标）。
  assert.deepEqual(CU.windowPercentsOf([{ label: '30d', remainingPercent: 10 }]), {
    h5: undefined,
    d7: undefined,
  });
  // 非数字的百分比不认。
  assert.deepEqual(CU.windowPercentsOf([{ label: '5h', remainingPercent: '61.8' }]), {
    h5: undefined,
    d7: undefined,
  });
});

test('窗口 tooltip 用服务端相对时间而不是本地时钟相减', () => {
  const window5h = { label: '5h', durationSeconds: 18000, remainingPercent: 61.8, resetsInMs: 8460000 };
  assert.equal(CU.windowTooltipText(window5h, t), '5 小时剩余 61.8%（2小时21分后重置）');
  assert.equal(CU.windowTooltipText({ label: '7d', remainingPercent: 87.3, resetsInMs: 5e8 }, t), '7 天剩余 87.3%（5天18小时后重置）');
  assert.equal(CU.windowTooltipText({ durationSeconds: 3600, remainingPercent: 50 }, t), '1 小时窗口剩余 50%');
  assert.equal(CU.windowTooltipText(undefined, t), '');
});

test('开关判定：缺字段视为开启，字符串 false 不算关闭', () => {
  assert.deepEqual(CU.flagVisibilityOf(undefined), { planOn: true, tokenOn: true, any: true });
  assert.equal(CU.flagVisibilityOf({ enablePlanQuota: false }).planOn, false);
  assert.equal(CU.flagVisibilityOf({ enablePlanQuota: 'false' }).planOn, true);
  assert.equal(CU.composerEnabledOf({}), true);
  assert.equal(CU.composerEnabledOf({ enableComposerUsage: false }), false);
});

test('刷新间隔：默认值、区间夹取、volatile 活引用', () => {
  assert.equal(CU.refreshIntervalOf(undefined), 300000);
  assert.equal(CU.refreshIntervalOf({ refreshIntervalMs: 1000 }), 60000);
  assert.equal(CU.refreshIntervalOf({ refreshIntervalMs: 1e9 }), 3600000);
  assert.equal(CU.refreshIntervalOf({ refreshIntervalMs: { get: () => 120000 } }), 120000);
  assert.equal(CU.refreshIntervalOf({ refreshIntervalMs: { get: () => { throw new Error('boom'); } } }), 300000);
});

/* ── 2. flags store ─────────────────────────────────────────────────────── */

test('store：set 只接受真布尔，值未变不通知，get 返回副本', () => {
  const store = createFlagsStore();
  assert.deepEqual(store.get(), { enableComposerUsage: true, enablePlanQuota: true, enableTokenUsage: true });
  assert.deepEqual(new Set(FLAG_KEYS), new Set(['enableComposerUsage', 'enablePlanQuota', 'enableTokenUsage']));

  let notified = 0;
  const off = store.subscribe(() => { notified += 1; });
  assert.equal(store.set({ enablePlanQuota: false }), true);
  assert.equal(notified, 1);
  // 无变化 → 不通知，避免设置页每次 onChange 都触发重渲染风暴。
  assert.equal(store.set({ enablePlanQuota: false }), false);
  assert.equal(notified, 1);
  // 非布尔补丁被忽略：「宿主没说」不能把用户关掉的开关悄悄改回去。
  store.set({ enablePlanQuota: 'false', enableTokenUsage: undefined });
  assert.equal(store.get().enablePlanQuota, false);
  assert.equal(notified, 1);
  off();
  store.set({ enablePlanQuota: true });
  assert.equal(notified, 1);
  const snapshot = store.get();
  snapshot.enablePlanQuota = 'mutated';
  assert.equal(store.get().enablePlanQuota, true);
});

test('store：订阅者抛错不影响其他订阅者与写入方', () => {
  const store = createFlagsStore();
  let second = 0;
  store.subscribe(() => { throw new Error('bad subscriber'); });
  store.subscribe(() => { second += 1; });
  assert.doesNotThrow(() => store.set({ enablePlanQuota: false }));
  assert.equal(second, 1);
});

test('flags 短名与长名都能读：宿主回短名，设置页写长名', () => {
  // 宿主 flagsOf() 在响应里返回短名，必须在入口翻译成长名，
  // 否则冷启动兜底会静默失效（设置页的即时写入却看起来正常，最难查）。
  assert.deepEqual(pickFlags({ composerUsage: false }), { enableComposerUsage: false });
  assert.deepEqual(pickFlags({ planQuota: false, tokenUsage: true }), { enablePlanQuota: false, enableTokenUsage: true });
  // 设置页写的是长名（Config 字段名），必须照旧可用。
  assert.deepEqual(pickFlags({ enablePlanQuota: false }), { enablePlanQuota: false });
  // 同一对象两者都有且矛盾时，长名（设置文档真源）优先。
  assert.deepEqual(pickFlags({ planQuota: true, enablePlanQuota: false }), { enablePlanQuota: false });
  // 非布尔仍然被忽略。
  assert.deepEqual(pickFlags({ planQuota: 'false' }), {});

  // 端到端：宿主回 planQuota:false → store → 组件能读到 false。
  const view = CU.planViewOf({ ok: true, flags: { planQuota: false }, windows: [] });
  assert.equal(CU.flagVisibilityOf(view.flags).planOn, false);
  const store = createFlagsStore();
  store.set(pickFlags({ composerUsage: false }));
  assert.equal(CU.composerEnabledOf(store.get()), false);
});

test('宿主 code 分类：DISABLED / NO_CREDENTIALS 不是错误', () => {
  // 这两个是正常态；落到错误态会让用户「关掉额度显示后看到一个莫名报错」。
  assert.equal(CU.classifyPlanCode('DISABLED'), 'ok');
  assert.equal(CU.classifyPlanCode('NO_CREDENTIALS'), 'ok');
  assert.equal(CU.classifyPlanCode(undefined), 'ok');
  assert.equal(CU.classifyPlanCode('UNAUTHORIZED'), 'unauthorized');
  for (const code of ['UPSTREAM', 'BAD_REQUEST', 'METHOD', 'FORBIDDEN']) {
    assert.equal(CU.classifyPlanCode(code), 'error', code);
  }
});

test('pickFlags / resolveFlags 的职责分工', () => {
  assert.deepEqual(pickFlags({ enablePlanQuota: false, enableTokenUsage: 1, nope: true }), { enablePlanQuota: false });
  assert.deepEqual(pickFlags(undefined), {});
  assert.deepEqual(
    resolveFlags({ enablePlanQuota: false }, { enableComposerUsage: true, enablePlanQuota: true, enableTokenUsage: true }),
    { enableComposerUsage: true, enablePlanQuota: false, enableTokenUsage: true },
  );
  assert.equal(typeof reactFlagsSource(createFlagsStore()).subscribe, 'function');
  assert.equal(reactFlagsSource(undefined), undefined);
});

/* ── 3. 接线：真跑 client.apply() ────────────────────────────────────────── */

function makeCtx(react) {
  const registrations = [];
  return {
    __registrations: registrations,
    effect: (fn) => fn(),
    locale: { register: () => () => undefined, bind: () => t },
    // ⚠️ 2026-10-16：`configForms` 现在是**声明进导出 `inject` 的服务**，
    // 所以 apply 里会直接读 `ctx.configForms`（不再只走 ctx.get）。
    // 它必须提供 `whileServed` —— 官方范式用它跟随设置命名空间的上线/下线边沿。
    configForms: {
      get: () => undefined,
      whileServed: (namespaces, register) => register(),
    },
    get: () => undefined,
    slots: {
      inject: (slotName, register) => register(),
      register: (options, component) => {
        registrations.push({ options, component });
        return () => undefined;
      },
    },
  };
}

/**
 * primitives 桩：**必须模拟官方真实形态**。
 *
 * ⚠️ 官方 `Button` / `MenuSurface` / `Switch` 都是 `forwardRef(...)` 的产物，
 * 运行时是**对象**（带 `$$typeof`）而不是 function。插件按
 * `function || (object && $$typeof !== undefined)` 判可用性 —— 这里若用普通函数桩，
 * 就测不出"用 typeof === 'function' 判可用性会把真 primitives 误判成缺件"那个真实缺陷
 * （前一个任务实际踩到过：外观静默降级且零报错）。
 */
function makePrimitivesStub() {
  const forwardRefShim = (name) => {
    const component = function Stub() {
      return null;
    };
    component.displayName = name;
    return { $$typeof: Symbol.for('react.forward_ref'), render: component };
  };
  return {
    Button: forwardRefShim('Button'),
    MenuSurface: forwardRefShim('MenuSurface'),
    Switch: forwardRefShim('Switch'),
    Tag: forwardRefShim('Tag'),
    SettingsForm: forwardRefShim('SettingsForm'),
    SettingsValueField: forwardRefShim('SettingsValueField'),
    SettingsSecretField: forwardRefShim('SettingsSecretField'),
    // 下面这些是**函数**（不是 forwardRef 产物），两类形态都要覆盖。
    SettingsFormModel: class StubSettingsFormModel {},
    settingsTextField: (field) => ({ field }),
    settingsNumberField: (field) => ({ field }),
    useAnchoredPosition: () => null,
    useDismissOnOutsidePointer: () => undefined,
    useAnchoredMaxHeight: () => undefined,
  };
}

/** 接线层用的 client：从 bundle 装载，react 走生产那条 require('react')。 */
const client = await loadClient({
  react: makeReact(),
  'react-dom': makeReactDom(),
  '@deepseek-ai/dsh-client-ui-primitives': makePrimitivesStub(),
});

test('apply 注册两个表面：输入框控件 + 插件详情页配置卡片', () => {
  const react = makeReact();
  const ctx = makeCtx(react);
  client.apply(ctx);

  assert.equal(ctx.__registrations.length, 2);
  const { options, component } = ctx.__registrations[0];
  // ⚠️ 2026-10-16（二次修正）：设置不注册 `settings.section`，也**不**注册 `plugins.item`。
  // 后者按 README 原文是「用于**官方插件**，按其 label 列在**内置插件配置分组**里」——
  // 第三方插件注册到那里会出现在"内置插件配置"下，是错位的。
  // 插件**自己的详情页**配置区用的是 `plugins.bundle.config`：内核详情页
  //   renderSlot("plugins.bundle.config", { view: "page" }, { entryKey: pkg.name })
  // 即 keyed 槽、键是**插件包名**（不是 list 槽的 id，也不是行页的 `<包名>#<行 id>`）。
  assert.equal(ctx.__registrations[1].options.name, 'plugins.bundle.config');
  assert.equal(ctx.__registrations[1].options.key, 'dsh-opendesign-usage');
  // 关键回归防线：不能再用 `plugins.item`（官方插件分组）。
  assert.notEqual(ctx.__registrations[1].options.name, 'plugins.item');
  assert.notEqual(ctx.__registrations[1].options.name, 'settings.section');
  assert.equal(options.name, 'conversation.input.left');
  // list 槽必须有 id：复用别人的 id 会顶掉对方那一格。
  assert.equal(options.id, 'dsh-opendesign-usage-usage');
  assert.equal(options.order, 40);
  assert.equal(options.locale, 'dsh-opendesign-usage');
  // 注册的必须是 gate（gate 自己按 provider 返回 null），不是直接渲染的组件。
  // 注意：这里的组件来自 bundle，而 `CU` 来自 src/ —— 两者是不同实例，
  // 所以按函数名断言而不是对象身份。
  assert.equal(typeof component, 'function');
  assert.equal(component.name, CU.UsageGate.name);

  const face = options.inject();
  assert.equal(typeof face.t, 'function');
  assert.equal(typeof face.flagsStore?.set, 'function');
  assert.equal(typeof face.settings?.getSnapshot, 'function');

  // 设置卡片：必须传 ctx（它要写字段），且要拿到同一个 flagsStore 实例语义。
  const settingsOptions = ctx.__registrations[1].options;
  assert.equal(settingsOptions.locale, 'dsh-opendesign-usage');
  // ⚠️ keyed 槽（bundle.config）**不带 `label`** —— 详情页自己画标题/图标/面包屑。
  // 官方 `plugins.row.config` 范式就是 `{ name, key, locale }` 三项。
  assert.equal(settingsOptions.label, undefined);
  const settingsFace = settingsOptions.inject();
  assert.equal(settingsFace.ctx, ctx, '设置卡片必须拿到 ctx 才能写字段与测试连接');
  assert.equal(typeof settingsFace.flagsStore?.set, 'function');
  assert.equal(settingsFace.t('settings.title'), t('settings.title'));
});

/**
 * ⚠️ 回归防线（2026-10-16 那次"点击没反应"的真凶）。
 *
 * 缺陷形状：**binder 定义了、也 import 了，但 `apply` 里从没调用**。
 * 具体是 `loadReactDom()` / `bindReactDom()` —— 结果 `composer-usage.js` 里
 * `reactDom` 恒为 undefined，而展开面板的分支写作
 * `openNow && typeof reactDom?.createPortal === 'function'`
 * → **面板永远不渲染**。用户侧表现为"点了没反应"（点击其实到了、`open` 也翻了）。
 *
 * 这类缺陷**纯逻辑测试与构建守卫都抓不到**，只有真机翻车。所以在接线层
 * （装载真实 bundle）直接监视 binder 的调用，缺任何一个就变红。
 */
test('apply 必须真的调用每一个注入点（缺一即面板/卡片失效）', async () => {
  const react = makeReact();
  // 用可观测的原语桩：记录 hook 是否真的被组件用到。
  const bundle = await loadClient({
    react,
    'react-dom': makeReactDom(),
    '@deepseek-ai/dsh-client-ui-primitives': makePrimitivesStub(),
  });
  const ctx = makeCtx(react);
  assert.doesNotThrow(() => bundle.apply(ctx));

  // 两个表面都必须在（注册本身走的是 slots.inject/register）。
  assert.equal(ctx.__registrations.length, 2, '输入框控件与配置卡片都必须注册');
  // 配置卡片要拿到 ctx；输入框控件要拿到 settings 包装。
  const composerFace = ctx.__registrations[0].options.inject();
  assert.equal(typeof composerFace.settings?.getSnapshot, 'function');
  const cardFace = ctx.__registrations[1].options.inject();
  assert.equal(cardFace.ctx, ctx);
});

test('apply 导出契约与「拿不到 react 时静默退化」', async () => {
  assert.equal(client.name, 'dsh-opendesign-usage');
  // ⚠️ 2026-10-16 重构新增 `configForms`：设置卡片注册进 `plugins.bundle.config` 后，
  // 用官方范式 `ctx.configForms.whileServed(...)` 跟随设置命名空间的上线/下线边沿；
  // `configForms` 由 `@deepseek-ai/dsh-client-ui-settings` 提供（内核源码：
  // `super(ctx, "configForms")`），且该包已在 `dsh.client.inject` 里 —— 成对写法。
  // 这三个服务名必须与 `apply` 里真正读到的 `ctx.<service>` 一一对应
  // （`test/inject-coverage.test.mjs` 会双向断言）。
  assert.deepEqual(client.inject, ['slots', 'locale', 'configForms']);
  assert.equal(typeof client.apply, 'function');

  // ⚠️ 用**另一份 bundle 实例**、并把基座表里的 react 抠掉，复现真实的降级路径
  // （而不是像旧测试那样改一个只有测试才认识的 ctx.import）。
  const noReact = await loadClient({ react: undefined, 'react-dom': makeReactDom() });
  const ctx = makeCtx(makeReact());
  assert.doesNotThrow(() => noReact.apply(ctx));
  // 拿不到 react 时两个表面都不注册：宁可什么都不显示，也不能让宿主整页挂掉。
  assert.equal(ctx.__registrations.length, 0);
});

/* ── 4. 行为：gate 与渲染 ───────────────────────────────────────────────── */

test('gate：非 opendesign 返回 null，opendesign 才渲染', () => {
  const react = makeReact();
  CU.bindReact(react);
  const store = createFlagsStore();
  const projectionFor = (selection) => (name) => (name === 'modelSelection' ? selection : undefined);

  react.__reset();
  assert.equal(CU.UsageReadout({ t, useProjection: projectionFor({ next: { provider: 'anthropic' } }), flagsStore: store }), null);
  react.__reset();
  assert.equal(CU.UsageReadout({ t, useProjection: projectionFor({ next: { provider: 'openai' } }), flagsStore: store }), null);
  react.__reset();
  assert.equal(CU.UsageReadout({ t, useProjection: undefined, flagsStore: store }), null);

  // 无条件注册的关键：gate 对别的 provider 返回 null（什么都不画），
  // 对本插件 provider 返回元素交给 React 渲染。
  const other = CU.UsageGate({ t, useProjection: projectionFor({ next: { provider: 'anthropic' } }), flagsStore: store });
  assert.equal(other, null);
  const mine = CU.UsageGate({ t, useProjection: projectionFor({ next: { provider: 'opendesign' } }), flagsStore: store });
  assert.equal(mine?.type, CU.UsageReadout);

  const rendered = CU.UsageReadout({ t, useProjection: projectionFor({ next: { provider: 'opendesign' } }), flagsStore: store });
  // 根是 portal 宿主 span，真正的可点控件是它里面的 `<button type="button">`。
  // ⚠️ 必须是**真的** button（不是 div[role=button]）：2026-10-15 实测 div + onClick
  // 在真实宿主里点击无响应，而同机已跑通的 dsh-connect-workbuddy 用的就是真 button。
  assert.equal(rendered?.props?.className, 'dsh-odu-root');
  const trigger = rendered?.props?.children?.[0];
  assert.equal(trigger?.type, 'button');
  assert.equal(trigger?.props?.type, 'button');
  assert.equal(typeof trigger?.props?.onClick, 'function');
});

test('gate：控件总开关关闭、或额度开关关闭时都不渲染', () => {
  const react = makeReact();
  CU.bindReact(react);
  // 每次调用前 reset：本桩不做调度，复用 state 会让上一轮的 flags 泄漏进来。
  const projectionFor = (selection) => (name) => (name === 'modelSelection' ? selection : undefined);
  const props = (store) => ({ t, useProjection: projectionFor({ next: { provider: 'opendesign' } }), flagsStore: store });

  // 控件总开关关闭 → 不渲染。
  react.__reset();
  assert.equal(CU.UsageReadout(props(createFlagsStore({ enableComposerUsage: false }))), null);

  // ⚠️ 额度开关关闭 → 不渲染。折叠态只显示两个额度窗口（钱包与 token 已移入面板），
  // 所以没有额度就没有可显示的内容。这里曾经断言"只开 token 时仍渲染"——那是
  // 折叠态还带 token 时的语义，已随产品决定一起改掉。
  react.__reset();
  assert.equal(CU.UsageReadout(props(createFlagsStore({ enablePlanQuota: false }))), null);

  // 自检：确认桩真的重新初始化了 state，而不是复用了上一轮的 flags。
  assert.deepEqual(
    CU.flagVisibilityOf(createFlagsStore({ enablePlanQuota: false }).get()),
    { planOn: false, tokenOn: true, any: false },
  );
  // `any` 等价于 planOn：额度关了就是没东西可显示。
  assert.equal(CU.flagVisibilityOf({ enablePlanQuota: false, enableTokenUsage: true }).any, false);
  assert.equal(CU.flagVisibilityOf({ enablePlanQuota: true, enableTokenUsage: false }).any, true);

  // 额度开着 → 渲染。
  react.__reset();
  assert.ok(CU.UsageReadout(props(createFlagsStore({ enablePlanQuota: true }))) !== null);
});

test('只在该发请求时发请求，且失败静默降级', async () => {
  const react = makeReact();
  CU.bindReact(react);
  const calls = [];
  let response = async () => ({
    ok: true,
    status: 200,
    json: async () => ({
      ok: true,
      tier: 'go',
      flags: { enablePlanQuota: true },
      windows: [{ durationSeconds: 18000, remaining: 31000, limit: 50000, resetsInMs: 3600000 }],
    }),
  });
  globalThis.fetch = async (url, init) => { calls.push({ url, init }); return response(); };
  globalThis.document = { addEventListener: () => {}, removeEventListener: () => {}, querySelector: () => ({}) };

  const selection = { next: { provider: 'opendesign' } };
  const projectionFor = (sel) => (name) => (name === 'modelSelection' ? sel : name === 'tokenUsage' ? { uncachedInputTokens: 10 } : undefined);

  // 正常路径：打到宿主同源路由。
  react.__reset(); calls.length = 0;
  CU.UsageReadout({ t, useProjection: projectionFor(selection), flagsStore: createFlagsStore(), settings: {} });
  runEffects(react);
  await flush();
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, '/plugins/dsh-opendesign-usage/plan-usage');
  assert.equal(calls[0].init.headers.accept, 'application/json');
  assert.equal(calls[0].init.credentials, 'same-origin');
  assert.equal(typeof calls[0].init.signal?.aborted, 'boolean');

  // 网络失败：不抛错、不产生 unhandledRejection。
  const rejections = [];
  const onRejection = (error) => rejections.push(error);
  process.on('unhandledRejection', onRejection);
  react.__reset(); calls.length = 0;
  response = async () => { throw new Error('network down'); };
  assert.doesNotThrow(() => {
    CU.UsageReadout({ t, useProjection: projectionFor(selection), flagsStore: createFlagsStore(), settings: {} });
    runEffects(react);
  });
  await flush();
  process.off('unhandledRejection', onRejection);
  assert.deepEqual(rejections, []);

  // 401：同样静默。
  react.__reset(); calls.length = 0;
  response = async () => ({ ok: false, status: 401, json: async () => ({ ok: false, code: 'UNAUTHORIZED' }) });
  assert.doesNotThrow(() => {
    CU.UsageReadout({ t, useProjection: projectionFor(selection), flagsStore: createFlagsStore(), settings: {} });
    runEffects(react);
  });
  await flush();

  // 额度开关关闭 → 一个请求都不发。
  react.__reset(); calls.length = 0;
  response = async () => ({ ok: true, status: 200, json: async () => ({ ok: true, windows: [] }) });
  CU.UsageReadout({ t, useProjection: projectionFor(selection), flagsStore: createFlagsStore({ enablePlanQuota: false }), settings: {} });
  runEffects(react);
  await flush();
  assert.equal(calls.length, 0);

  // 别的 provider → 一个请求都不发。
  react.__reset(); calls.length = 0;
  CU.UsageReadout({ t, useProjection: projectionFor({ next: { provider: 'openai' } }), flagsStore: createFlagsStore(), settings: {} });
  runEffects(react);
  await flush();
  assert.equal(calls.length, 0);

  // 收尾：把前面几轮注册的定时器全部清掉，否则进程不退出。
  react.__dispose();
});

test('网络回来的 flags 会写进 store（冷启动兜底）', async () => {
  const react = makeReact();
  CU.bindReact(react);
  globalThis.fetch = async () => ({
    ok: true,
    status: 200,
    json: async () => ({ ok: true, windows: [], flags: { enableTokenUsage: false } }),
  });
  globalThis.document = { addEventListener: () => {}, removeEventListener: () => {}, querySelector: () => ({}) };
  const store = createFlagsStore();
  react.__reset();
  CU.UsageReadout({
    t,
    useProjection: (name) => (name === 'modelSelection' ? { next: { provider: 'opendesign' } } : undefined),
    flagsStore: store,
    settings: {},
  });
  runEffects(react);
  await flush();
  assert.equal(store.get().enableTokenUsage, false);
  // 必须收尾：这个 effect 里有一个 setInterval，不清理 node:test 会一直等
  // 事件循环排空（表现为整个文件挂死到超时被取消）。
  react.__dispose();
});

/* ── 6. locale ──────────────────────────────────────────────────────────── */

test('locale 中英键 1:1 对齐，且已为设置页预留 settings.* 键', () => {
  assert.equal(localeKeysAligned(), true);
  const { zh, en } = createLocale();
  const settingsKeys = Object.keys(zh).filter((key) => key.startsWith('settings.'));
  assert.ok(settingsKeys.length > 25, `settings.* 键太少：${settingsKeys.length}`);
  // settings-dev 明确点名的键，缺一个它的组件就会退回文件内中文兜底。
  for (const key of ['settings.save', 'settings.saving', 'settings.saved', 'settings.unsaved', 'settings.saveFailed', 'settings.testHint']) {
    assert.equal(typeof zh[key], 'string', `zh 缺 ${key}`);
    assert.equal(typeof en[key], 'string', `en 缺 ${key}`);
  }
  for (const key of settingsKeys) assert.ok(typeof en[key] === 'string' && en[key] !== '', `en 缺 ${key}`);
  // 占位符两边都要有，否则某种语言会漏掉数字。
  for (const key of settingsKeys) {
    const placeholders = (text) => (text.match(/\{(\w+)\}/g) ?? []).sort();
    assert.deepEqual(placeholders(zh[key]), placeholders(en[key]), `${key} 占位符不一致`);
  }
});

/* ── 钱包余额显示 ───────────────────────────────────────────────────── */

test('walletViewOf 归一化并拒绝不可用数据', () => {
  const ok = CU.walletViewOf({
    ok: true,
    totalUsd: 1.5,
    subscriptionUsd: 1,
    rechargeUsd: 0.5,
    creditsPerUsd: 10000,
    totalCredits: 15000,
    membershipTier: 'go',
  });
  assert.equal(ok.ok, true);
  assert.equal(ok.totalUsd, 1.5);
  assert.equal(ok.totalCredits, 15000);

  // 失败与畸形输入都不该产出可显示的余额。
  assert.equal(CU.walletViewOf(undefined).ok, false);
  assert.equal(CU.walletViewOf({ ok: false, code: 'UNAUTHORIZED' }).ok, false);
  assert.equal(CU.walletViewOf({ ok: false, code: 'UNAUTHORIZED' }).code, 'UNAUTHORIZED');
  // ⚠️ 拿不到总额时必须视为失败，而不是显示 $0.00（那是在撒谎）。
  assert.equal(CU.walletViewOf({ ok: true }).ok, false);
  assert.equal(CU.walletViewOf({ ok: true, totalUsd: 'abc' }).ok, false);
});

test('formatUsd 两位小数，0 也显示', () => {
  assert.equal(CU.formatUsd(1.5), '$1.50');
  assert.equal(CU.formatUsd(0), '$0.00');
  assert.equal(CU.formatUsd(12.345), '$12.35');
  assert.equal(CU.formatUsd(undefined), '');
  assert.equal(CU.formatUsd(Number.NaN), '');
});

test('钱包不再常驻读数，但仍出现在 tooltip 明细里', () => {
  // ⚠️ 这是刻意的产品决定：工具行那格宽度有限，四段（两个额度 + token + 钱包）
  // 挤在一起明显过长；钱包属于"想知道才看"的信息，移到 tooltip。
  // 所以这里断言的是「**不**出现在折叠态」，防止日后有人又把它加回来。
  const label = CU.collapseLabelOf({ h5: 53.5, d7: 87.3, planOn: true, walletUsd: 1.5, walletOn: true });
  assert.equal(label, '54% · 87%');
  assert.ok(!label.includes('$'), `折叠态不应含钱包金额，实际：${label}`);
  assert.ok(!label.includes('k'), `折叠态不应含 token，实际：${label}`);
});

test('token 不再常驻读数', () => {
  const label = CU.collapseLabelOf({ h5: 53.5, d7: 87.3, planOn: true, tokens: 12345, tokenOn: true });
  assert.equal(label, '54% · 87%');
});

test('钱包 tooltip 说明这笔钱是什么，并在有意义时才拆账', () => {
  const t = (key, params) => {
    if (key === 'usage.walletBalance') return `余额 ${params.amount}`;
    if (key === 'usage.walletBreakdown') return `含 ${params.subscription} + ${params.recharge}`;
    return key;
  };
  const lines = CU.walletTooltipLines(
    { ok: true, totalUsd: 1.5, subscriptionUsd: 1, rechargeUsd: 0.5 },
    t,
  );
  assert.equal(lines.length, 2);
  assert.ok(lines[0].includes('$1.50'));
  assert.ok(lines[1].includes('$1.00'));
  assert.ok(lines[1].includes('$0.50'));
  // 两个来源都为 0 时不列明细（只是噪音）。
  const only = CU.walletTooltipLines({ ok: true, totalUsd: 0, subscriptionUsd: 0, rechargeUsd: 0 }, t);
  assert.equal(only.length, 1);
  // 失败的视图不产出任何行。
  assert.deepEqual(CU.walletTooltipLines({ ok: false }, t), []);
  assert.deepEqual(CU.walletTooltipLines(undefined, t), []);
});

/* ── 官方 UI 原语（面板材质与定位） ──────────────────────────────────── */

test('拿到 primitives 时 apply 正常，且原语缺失不算 failure', async () => {
  const react = makeReact();

  // ① 拿到原语：apply 不抛错，且不该记 failure —— 原语只影响外观，
  //    取不到是**降级**而不是启动失败（把它记成 failure 会让启动报告误报 ok:false）。
  // ⚠️ 桩必须用官方**真实**签名：`useAnchoredPosition` 返回 `{ left, top } | null`，
  //    没有 `position` 字段（旧桩写的 `{position:'fixed',...}` 是与实现不符的假契约）。
  const primitives = {
    Button: function Button(props) {
      return react.createElement('button', props, props.children);
    },
    MenuSurface: function MenuSurface(props) {
      return react.createElement('div', props, props.children);
    },
    useAnchoredPosition: () => ({ left: 0, top: 0 }),
    useDismissOnOutsidePointer: () => undefined,
  };
  const withPrimitives = await loadClient({ react, 'react-dom': makeReactDom(), '@deepseek-ai/dsh-client-ui-primitives': primitives });
  const ctxA = makeCtx(react);
  assert.doesNotThrow(() => withPrimitives.apply(ctxA));

  // ② 完全没有原语（宿主基座表里没有那个包）：同样不得抛错，只降级。
  const withoutPrimitives = await loadClient({ react, 'react-dom': makeReactDom() });
  const ctxB = makeCtx(react);
  assert.doesNotThrow(() => withoutPrimitives.apply(ctxB));

  // ③ 两者的导出面一致 —— 原语不影响插件契约。
  assert.deepEqual(withPrimitives.inject, withoutPrimitives.inject);
  assert.equal(withPrimitives.name, withoutPrimitives.name);
});

test('原语包缺 MenuSurface 时视为不可用（不是部分可用）', async () => {
  const react = makeReact();
  // 只有 useAnchoredPosition、没有 MenuSurface：应判定为不可用，
  // 于是走降级路径（原生元素），而不是拿一个缺件去渲染。
  const partial = { useAnchoredPosition: () => null };
  const bundle = await loadClient({ react, 'react-dom': makeReactDom(), '@deepseek-ai/dsh-client-ui-primitives': partial });
  const ctx = makeCtx(react);
  assert.doesNotThrow(() => bundle.apply(ctx));
});
