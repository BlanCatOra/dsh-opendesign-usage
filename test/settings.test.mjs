/**
 * dsh-opendesign-usage —— 插件详情页配置卡片测试。
 *
 * ⚠️ 2026-10-16 重构后本文件的测试对象变了：
 *   - 旧：`src/settings-section.js` 的 `SettingsSection`（全自写 UI，注册在 `settings.section`）
 *   - 新：`src/plugin-settings-card.js` 的 `SettingsCard`（用 `primitives`，注册在 `plugins.item`）
 *
 * 旧的 `createSettingsFace` / `normalizeSettings` / `isWritable` / `snapshotValueOf`
 * 是**旧实现内部**的辅助函数（因为旧卡片自己管作用域）。新卡片把这些交给了官方的
 * `SettingsFormModel`，所以那几个测试随之删除 —— **不是放宽断言，而是那些函数已不存在**。
 * 保留下来的两个纯函数（`pickWindowPercents` / `interpretTestResult`）仍然逐条钉死。
 *
 * 本文件重点覆盖**只有测试能提前发现**的失败：
 *  1. **纯函数**：窗口匹配按 label 而不是下标；错误码映射不串位、不泄漏原始响应。
 *  2. **primitives 可用性判定**：官方 `Button` / `MenuSurface` 是 `forwardRef` 产物
 *     （运行时是**对象**，带 `$$typeof`），用 `typeof === 'function'` 判会把真 primitives
 *     误判成"缺件"→ 外观静默降级且零报错。这是实际踩过的缺陷，必须钉死。
 *  3. **渲染期绝不抛错**：`t`/`ctx`/`flagsStore`/`primitive` 缺失、恶意 getter（读属性就抛）
 *     都不得把异常交给 `SlotErrorBoundary`（抛一次插槽条目被**永久撤销**）。
 *
 * ⚠️ 本文件必须能自然退出（不留下 interval/timer）。
 *
 * @module dsh-opendesign-usage/test/settings
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  bindPrimitives,
  bindReact,
  interpretTestResult,
  pickWindowPercents,
  primitivesComplete,
  SettingsCard,
  usePrimitives,
} from '../src/plugin-settings-card.js';

/* ── react 桩 ───────────────────────────────────────────────────────────────
 * 够用即可：本测试关心渲染输出与回调行为，不重实现 React 调度。
 * effect 被记下来由测试手动执行，这样「渲染后发生了哪些副作用」是可控的。
 */
function makeReact() {
  const effects = [];
  const cleanups = [];
  const states = [];
  let cursor = 0;
  return {
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
    useLayoutEffect: (fn) => { effects.push(fn); },
    __effects: effects,
    __cleanups: cleanups,
    /** 跑掉所有已注册的清理函数，让事件循环能排空。 */
    __dispose: () => {
      for (const cleanup of cleanups.splice(0)) cleanup?.();
      effects.length = 0;
    },
    /** 每次「重新渲染」等于一次全新的挂载：state 与 effect 都必须清空。 */
    __reset: () => {
      cursor = 0;
      states.length = 0;
      effects.length = 0;
      for (const cleanup of cleanups.splice(0)) cleanup?.();
    },
  };
}

/**
 * primitives 桩：**必须模拟官方真实形态**。
 *
 * 官方 `Button` / `MenuSurface` / `Switch` 是 `forwardRef(...)` 的产物 ——
 * 运行时是**对象**（带 `$$typeof`），不是 function。若用普通函数桩，
 * 就测不出"判定写错会把真 primitives 当缺件"那个缺陷。
 */
function forwardRefShim(name) {
  const component = function Stub() {
    return null;
  };
  component.displayName = name;
  return { $$typeof: Symbol.for('react.forward_ref'), render: component };
}

function makePrimitives() {
  return {
    Button: forwardRefShim('Button'),
    MenuSurface: forwardRefShim('MenuSurface'),
    Switch: forwardRefShim('Switch'),
    Tag: forwardRefShim('Tag'),
    SettingsForm: forwardRefShim('SettingsForm'),
    SettingsValueField: forwardRefShim('SettingsValueField'),
    SettingsSecretField: forwardRefShim('SettingsSecretField'),
    // 这两个是**函数**（不是 forwardRef 产物），两类形态都要覆盖。
    SettingsFormModel: class StubFormModel {
      constructor() {
        this.store = { subscribe: () => () => {}, set: () => {} };
      }
      snapshot() {
        return { available: true, writable: true, dirty: false, invalid: false, saving: false, failed: false };
      }
      field() {
        return { text: '', overridden: false, invalid: false };
      }
      flagValues() {
        return {};
      }
      actions() {
        return { edit: () => {}, resetField: () => {}, save: () => {}, discard: () => {} };
      }
      dispose() {}
    },
    settingsTextField: (field) => ({ field }),
    settingsNumberField: (field) => ({ field }),
  };
}

/** 把 React 元素树里所有会成为文本节点的字符串收集起来。 */
function collectText(node, out = []) {
  if (node === null || node === undefined || typeof node === 'boolean') return out;
  if (typeof node === 'string' || typeof node === 'number') {
    out.push(String(node));
    return out;
  }
  if (Array.isArray(node)) {
    for (const item of node) collectText(item, out);
    return out;
  }
  if (typeof node === 'object' && node.props !== undefined) collectText(node.props.children, out);
  return out;
}

/* ── 纯函数 ───────────────────────────────────────────────────────── */

test('pickWindowPercents 按 label 找而不是按下标', () => {
  // 上游两个窗口的顺序不保证；按下标取会把 5h/7d 的数值对调。
  const reversed = [
    { label: '7d', remainingPercent: 88 },
    { label: '5h', remainingPercent: 65 },
  ];
  const percents = pickWindowPercents(reversed);
  assert.equal(percents.h5, 65);
  assert.equal(percents.d7, 88);

  // 缺一个窗口时那一个必须是 undefined，不能被另一个顶替。
  const onlyFiveHour = [{ label: '5h', remainingPercent: 42 }];
  assert.equal(pickWindowPercents(onlyFiveHour).h5, 42);
  assert.equal(pickWindowPercents(onlyFiveHour).d7, undefined);

  // 非数组 / 脏数据不得抛错。
  assert.deepEqual(pickWindowPercents(undefined), { h5: undefined, d7: undefined });
  assert.deepEqual(pickWindowPercents([null, 'x', { label: '5h' }]), { h5: undefined, d7: undefined });
});

test('interpretTestResult 成功路径给 tier 与两个百分比', () => {
  const result = interpretTestResult(
    {
      ok: true,
      tier: 'go',
      windows: [
        { label: '5h', remainingPercent: 65.3 },
        { label: '7d', remainingPercent: 88.3 },
      ],
    },
    200,
  );
  assert.equal(result.ok, true);
  assert.equal(result.tier, 'go');
  assert.deepEqual(result.percents, { h5: 65.3, d7: 88.3 });
  // 成功也要给文案键 —— 组件靠它渲染，缺了会显示空白。
  assert.equal(result.messageKey, 'settings.testOk');
  assert.equal(result.params.tier, 'go');

  // 成功但没有窗口：是另一种文案（不是"失败"）。
  const noWindows = interpretTestResult({ ok: true, tier: 'go', windows: [] }, 200);
  assert.equal(noWindows.ok, true);
  assert.equal(noWindows.messageKey, 'settings.testOkNoWindows');
});

test('interpretTestResult 把错误码映射到不同文案', () => {
  // 每种错误码必须映射到**不同**的 messageKey —— 全用同一个的话用户分不清
  // 是"凭据过期"还是"上游挂了"，而这两件事的处理方式完全不同。
  const unauthorized = interpretTestResult({ ok: false, code: 'UNAUTHORIZED' }, 200);
  const forbidden = interpretTestResult({ ok: false, code: 'FORBIDDEN' }, 200);
  const upstream = interpretTestResult({ ok: false, code: 'UPSTREAM' }, 200);
  const noCreds = interpretTestResult({ ok: false, code: 'NO_CREDENTIALS' }, 200);

  assert.equal(unauthorized.ok, false);
  assert.equal(unauthorized.messageKey, 'settings.unauthorized');
  // FORBIDDEN 与 UNAUTHORIZED 同类（都是"凭据不被接受"）。
  assert.equal(forbidden.messageKey, 'settings.unauthorized');
  assert.equal(upstream.messageKey, 'settings.upstream');
  assert.equal(noCreds.messageKey, 'settings.testNeedInput');

  // 凭据类与上游类必须是不同的文案。
  assert.notEqual(unauthorized.messageKey, upstream.messageKey);
  assert.notEqual(noCreds.messageKey, unauthorized.messageKey);
});

test('interpretTestResult 对未知错误码与不可解析响应兜底', () => {
  // 未知错误码：仍走"失败"形态，且 messageKey 是通用失败键（不得 undefined）。
  const unknown = interpretTestResult({ ok: false, code: 'WAT' }, 200);
  assert.equal(unknown.ok, false);
  assert.equal(unknown.messageKey, 'settings.testFailed');

  // 非对象 / null：都走失败态，且带上 HTTP 状态便于诊断。
  for (const payload of [null, undefined, 'not json', 42]) {
    const result = interpretTestResult(payload, 502);
    assert.equal(result.ok, false);
    assert.equal(result.params.message, 'HTTP 502');
  }

  // ⚠️ 上游返回的 error 文本只作为**参数**进 params.message，由 locale 模板决定怎么显示。
  // 这里只断言它没有被拼进 messageKey（键名是固定的枚举值，不是动态字符串）。
  const withDetail = interpretTestResult({ ok: false, code: 'WAT', error: 'boom' }, 500);
  assert.equal(withDetail.messageKey, 'settings.testFailed');
  assert.equal(withDetail.params.message, 'boom');
});

/* ── primitives 可用性判定 ─────────────────────────────────────────── */

test('primitivesComplete 接受 forwardRef 形态（这是实际踩过的缺陷）', () => {
  // 完整的官方形态：只有接受它，控件才会真的用上 primitives。
  assert.equal(primitivesComplete(makePrimitives()), true);

  // 普通函数组件形态也必须接受。
  assert.equal(
    primitivesComplete({
      Button: function Button() {},
      MenuSurface: function MenuSurface() {},
      Switch: function Switch() {},
      Tag: function Tag() {},
      SettingsForm: function SettingsForm() {},
      SettingsValueField: function SettingsValueField() {},
      SettingsSecretField: function SettingsSecretField() {},
      SettingsFormModel: function SettingsFormModel() {},
      settingsTextField: () => ({}),
      settingsNumberField: () => ({}),
    }),
    true,
  );

  // 缺件、null、垃圾值一律不可用 —— 不可以"部分可用"。
  assert.equal(primitivesComplete(undefined), false);
  assert.equal(primitivesComplete(null), false);
  assert.equal(primitivesComplete({}), false);
  assert.equal(primitivesComplete({ Button: function Button() {} }), false);
  assert.equal(primitivesComplete('nope'), false);
  assert.equal(primitivesComplete({ ...makePrimitives(), SettingsFormModel: undefined }), false);
});

test('bindPrimitives 注入后 usePrimitives 立即返回；未注入时不抛错', () => {
  bindPrimitives(makePrimitives());
  assert.notEqual(usePrimitives(), undefined);
  // 注入 null 视为"没有"，不得抛错。
  assert.doesNotThrow(() => bindPrimitives(null));
});

/* ── 组件渲染 ─────────────────────────────────────────────────────── */

test('SettingsCard 在什么都没有时也不崩（渲染期不得抛错）', () => {
  const react = makeReact();
  bindReact(react);
  bindPrimitives(makePrimitives());
  react.__reset();
  assert.doesNotThrow(() => {
    const tree = SettingsCard({});
    assert.ok(tree !== null && tree !== undefined, '应渲染一个节点（降级说明），而不是 null');
  });
  assert.doesNotThrow(() => {
    for (const effect of react.__effects.splice(0)) {
      const cleanup = effect();
      react.__cleanups.push(cleanup);
    }
  });
  react.__reset();
});

test('SettingsCard 拿不到 t 时不暴露 locale 键名', () => {
  const react = makeReact();
  bindReact(react);
  bindPrimitives(makePrimitives());
  react.__reset();
  const tree = SettingsCard({ t: undefined });
  // 只看**真正会成为文本节点**的 children：组件内部把 locale 键名当标识符携带是正常的。
  const texts = collectText(tree);
  for (const text of texts) {
    assert.ok(!/^settings\./.test(text), `文案泄漏了 locale 键名：${text}`);
  }
  react.__reset();
});

test('SettingsCard 容忍恶意 getter（读属性就抛）', () => {
  const react = makeReact();
  bindReact(react);
  bindPrimitives(makePrimitives());
  react.__reset();
  // 注入面在某个键上抛是"能力探测失败"的常见形状 —— 必须只降级，不把异常送给 SlotErrorBoundary。
  const hostile = new Proxy(
    {},
    {
      get() {
        throw new Error('boom:props');
      },
    },
  );
  assert.doesNotThrow(() => SettingsCard(hostile));
  react.__reset();
});

test('SettingsCard 在拿不到 react 时返回 null（而不是抛错）', () => {
  const react = makeReact();
  bindReact(react);
  react.__reset();
  bindReact(undefined);
  assert.equal(SettingsCard({}), null);
  // 还原本文件其余用例的状态。
  bindReact(makeReact());
});

test('SettingsCard 在 primitives 全缺时如实说明，不自绘替代控件', () => {
  const react = makeReact();
  bindReact(react);
  bindPrimitives(undefined);
  react.__reset();
  const tree = SettingsCard({ bootFailures: [{ where: 'locale', message: 'boom' }] });
  assert.ok(tree !== null && tree !== undefined);
  const texts = collectText(tree).join('\n');
  // 降级时仍要把失败明细说出来（那是用户唯一能看到的诊断入口）。
  assert.ok(texts.includes('locale'), `降级说明里应含失败步骤：${texts}`);
  react.__reset();
});

test('SettingsCard 响应 view=summary（插件列表里那一行简介）', () => {
  const react = makeReact();
  bindReact(react);
  bindPrimitives(makePrimitives());
  react.__reset();
  const summary = SettingsCard({ view: 'summary' });
  // summary 是纯文本一小段，不是元素树。
  assert.equal(typeof summary, 'string');
  assert.ok(summary.length > 0);
  react.__reset();
});
