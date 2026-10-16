/**
 * 客户端静态守卫：**服务访问必须与 `inject` 声明一一对应**，且 `apply` 永不外抛。
 *
 * 为什么必须有这一条（2026-10-15 实测事故）：
 *
 * cordis 的 `ctx.<service>` 是个代理，只放行 Context 自带成员与插件自己 `inject`
 * 里声明过的**服务名**；其余一律抛 `cannot get property "X" without inject`。
 * 而 `package.json` 的 `dsh.client.inject` 列的是**包名**，只管模块加载顺序 ——
 * 两者长得像、作用完全不同，混淆的代价是把整个 DSH 启动打挂：
 *
 *   apply 抛错 → cordis 把 fiber 置 FAILED → web boot
 *   `throw new Error("web boot: N entry did not activate")` → **整页白屏**，
 *   且 crash log 只有一行 `<包名>: failed`，没有堆栈。
 *
 * 运行时测试抓不到这一条：测试里的假 ctx 是普通对象，没有代理拦截。
 * 所以只能在源码上静态断言。
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFile, readdir, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import loadClient from './helpers/load-client.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '..', 'src');

/** Context 自带的方法/属性：不经过服务代理，不需要写进 inject。 */
const CONTEXT_MEMBERS = new Set([
  'effect', 'inject', 'get', 'on', 'off', 'emit', 'plugin', 'fiber', 'logger',
  'reflect', 'provide', 'waterfall', 'set', 'start', 'stop', 'scope', 'isolate',
  'extend', 'config', 'registry', 'root', 'intercept', 'parallel', 'serial', 'bail',
]);

/** 只扫描浏览器侧模块（Host 侧的 index.js/config.js 有自己的 inject 语义）。 */
// ⚠️ 2026-10-16 重构：`settings-section.js` → `plugin-settings-card.js`（设置卡片改用
// primitives 并迁到 `plugins.item`）。新文件必须在这个集合里，否则它引入的
// `ctx.<service>` 不会被静态守卫覆盖 —— 那正是本项目白屏事故的形状。
const CLIENT_ONLY = new Set(['client.js', 'composer-usage.js', 'plugin-settings-card.js', 'flags-store.js', 'locale.js', 'constants.js', 'boot-diagnostics.js']);

/**
 * 去掉注释与字符串字面量，只留代码。
 *
 * 必需：文档注释里会写 `ctx.configForms` 这种反面例子，真正的代码走的是
 * `ctx.get('configForms')`。不剥注释就会误报。
 */
function stripCommentsAndStrings(code) {
  let out = '';
  let mode = 'code';
  let index = 0;
  while (index < code.length) {
    const char = code[index];
    const next = code[index + 1];
    if (mode === 'code') {
      if (char === '/' && next === '*') {
        mode = 'block';
        index += 2;
        continue;
      }
      if (char === '/' && next === '/') {
        mode = 'line';
        index += 2;
        continue;
      }
      if (char === '"' || char === "'" || char === '`') {
        mode = char;
        out += ' ';
        index += 1;
        continue;
      }
      out += char;
      index += 1;
      continue;
    }
    if (mode === 'block') {
      if (char === '*' && next === '/') {
        mode = 'code';
        index += 2;
        continue;
      }
      index += 1;
      continue;
    }
    if (mode === 'line') {
      if (char === '\n') {
        mode = 'code';
        out += '\n';
      }
      index += 1;
      continue;
    }
    if (char === '\\') {
      index += 2;
      continue;
    }
    if (char === mode) mode = 'code';
    index += 1;
  }
  return out;
}

/** 造一个够用的 react 桩（只为让 bundle 的 require('react') 有东西可用）。 */
function makeReactStub() {
  return {
    createElement: (type, props, ...children) => ({ type, props: { ...(props ?? {}), children: children.length <= 1 ? children[0] : children } }),
    useCallback: (fn) => fn,
    useMemo: (fn) => fn(),
    useRef: (initial) => ({ current: initial }),
    useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => undefined],
    useEffect: () => undefined,
  };
}

/**
 * 断言 `lib/client.js` 与当前 `src/` 同源。
 *
 * 做法：用打包器把 src 重新生成到内存（`build()` 支持任意输出路径），与磁盘上
 * 的产物逐字节比对。不同就说明产物过期 —— 那会让本文件的所有断言在测一个
 * 已经不存在的版本。
 *
 * 之所以是"内存生成再比对"而不是"重建并覆盖"：测试不该有写产物的副作用，
 * 否则并行跑测试或中途失败会留下半成品。
 */
async function assertBundleMatchesSource() {
  const { build, bannerFor } = await import('../src/build-client.mjs');
  const freshPath = join(tmpdir(), `dsh-opendesign-usage-guard-${process.pid}.js`);
  try {
    await build({
      entry: join(srcDir, 'client.js'),
      root: srcDir,
      packageId: 'dsh-opendesign-usage',
      output: freshPath,
      // banner 从打包器导出取，不在这里重写一份 —— 两处各写必然漂移，
      // 而漂移的表现是"守卫永远报不同源"，最后被人当噪音关掉。
      banner: bannerFor('dsh-opendesign-usage'),
    });
    const [fresh, onDisk] = await Promise.all([
      readFile(freshPath, 'utf8'),
      readFile(join(here, '..', 'lib', 'client.js'), 'utf8'),
    ]);
    if (onDisk === fresh) return;
    // 给出可操作的差异摘要：只报"不同源"会让人无从下手。
    const firstDiff = [...onDisk].findIndex((char, index) => char !== fresh[index]);
    assert.fail(
      'lib/client.js 与 src/ 不同源（产物过期）——先跑 `node src/build-client.mjs`，' +
        '否则本文件的静默守卫会在测一个旧版本。' +
        `\n  产物 ${onDisk.length} 字节 / 预期 ${fresh.length} 字节，首个差异在第 ${firstDiff} 字节附近：` +
        `\n  产物: ${JSON.stringify(onDisk.slice(Math.max(0, firstDiff - 40), firstDiff + 40))}` +
        `\n  预期: ${JSON.stringify(fresh.slice(Math.max(0, firstDiff - 40), firstDiff + 40))}`,
    );
  } finally {
    await rm(freshPath, { force: true });
  }
}

test('导出的 inject 必须覆盖源码里用到的每一个 ctx 服务', async () => {
  // ⚠️ 先确认 `lib/client.js` 与 src 同源。本测试比对的是「产物导出的 inject」
  // 与「源码用到的 ctx 服务」——若产物是旧的，比对就失去意义：
  // 实测（2026-10-15 复核）把 `slots` 从 src 的 inject 里删掉、但不重建产物时，
  // 读数取的是旧的 `lib/client.js`（inject 仍含 slots），本守卫**静默通过**。
  // 正常路径（`npm test` / pre-push 钩子）都会先 build，所以这不会漏到线上；
  // 但"直接 `node --test` 文件"时就会测到过期产物 —— 这里显式堵住。
  await assertBundleMatchesSource();

  const client = await loadClient({ react: makeReactStub(), 'react-dom': { createPortal: (n) => n } });
  assert.ok(Array.isArray(client.inject), 'client 必须导出 inject 数组');

  const files = (await readdir(srcDir)).filter((name) => CLIENT_ONLY.has(name));
  assert.ok(files.length > 0, '至少要有客户端侧源文件');

  const needed = new Set();
  for (const name of files) {
    const code = stripCommentsAndStrings(await readFile(join(srcDir, name), 'utf8'));
    for (const match of code.matchAll(/(?<![.\w$])ctx\.([A-Za-z_$][A-Za-z0-9_$]*)/g)) {
      if (!CONTEXT_MEMBERS.has(match[1])) needed.add(match[1]);
    }
  }

  assert.ok(needed.size > 0, '静态扫描必须真的扫到服务访问（否则这条守卫是空转）');
  for (const service of needed) {
    assert.ok(
      client.inject.includes(service),
      `ctx.${service} 被使用了，但没写进 inject —— cordis 会同步抛 ` +
        `"cannot get property \\"${service}\\" without inject"，把 apply 打挂、进而让整个 DSH 启动白屏`,
    );
  }
  for (const service of client.inject) {
    assert.ok(needed.has(service), `inject 里的 ${service} 已经没人用了，删掉（多余声明会把本插件绑死在别人的可用性上）`);
  }
});

test('源码里不得再出现 ctx.import / ctx.require（宿主没有这两个成员）', async () => {
  for (const name of CLIENT_ONLY) {
    const path = join(srcDir, name);
    const code = await readFile(path, 'utf8').catch(() => undefined);
    if (code === undefined) continue;
    const stripped = stripCommentsAndStrings(code);
    for (const banned of ['ctx.import', 'ctx.require']) {
      assert.ok(
        !stripped.includes(banned),
        `${name} 里出现了 ${banned}：它既不是 Context 成员也不是服务，读它会抛 ` +
          `"without inject"；react 要从 bundle 外壳的 require 取（见 client.js 的 loadReact）`,
      );
    }
  }
});

test('apply 在「服务全抛错 / 空 ctx / 拿不到 react」下都不得把异常抛给 web boot', async () => {
  const client = await loadClient({ react: makeReactStub(), 'react-dom': { createPortal: (n) => n } });
  const boom = (label) => () => {
    throw new Error(`boom:${label}`);
  };
  assert.doesNotThrow(() =>
    client.apply({
      slots: { inject: boom('slots.inject'), register: boom('slots.register') },
      locale: { register: boom('locale.register'), bind: boom('locale.bind') },
      effect: boom('effect'),
      get: boom('get'),
      inject: boom('inject'),
    }),
  );
  assert.doesNotThrow(() => client.apply({}), '缺服务时 apply 也不能抛');

  // 拿不到 react：整体降级为不注册，但同样不得外抛。
  const noReact = await loadClient({ react: undefined, 'react-dom': { createPortal: (n) => n } });
  const registrations = [];
  const ctx = {
    effect: (fn) => fn(),
    locale: { register: () => () => undefined, bind: () => (key) => key },
    get: () => undefined,
    slots: {
      inject: (slotName, register) => register(),
      register: (options) => {
        registrations.push(options);
        return () => undefined;
      },
    },
  };
  assert.doesNotThrow(() => noReact.apply(ctx));
  assert.equal(registrations.length, 0, '拿不到 react 时两个表面都不注册');
});

/* ────────────────────────────────────────────────────────────────────────────
 * 静态守卫：**每个 import 进来的 binder 都必须在 apply 体内真的被调用**
 *
 * 为什么需要它（2026-10-16 实测的真凶）：`src/client.js` 里
 * `import { ..., bindReactDom }` 与 `function loadReactDom()` 都在，
 * 但 `apply` 里**从没调用过** —— 于是 `composer-usage.js` 的 `reactDom` 恒为
 * undefined，而展开面板的条件写作
 *   `openNow && typeof reactDom?.createPortal === 'function'`
 * → **面板永远不渲染**。用户侧看到的是"点击没反应"（点击其实到达了、
 * `open` 也翻转了，只是没有任何东西被画出来）。
 *
 * 这类"接线漏了一行"的缺陷：纯逻辑测试测不到、构建期守卫测不到、真机只表现为
 * 功能静默失效。静态断言 import 与调用成对，是唯一能在 CI 拦住它的办法。
 * ──────────────────────────────────────────────────────────────────────────── */

test('client.js：每个 import 的 binder / loader 都必须在 apply 里被调用', async () => {
  const source = await readFile(new URL('../src/client.js', import.meta.url), 'utf8');

  // ⚠️ import 要在**原始源码**上扫（多行 + 带引号路径）；剥字符串会把路径抹掉。
  // 注释里的 `import` 示例不在行首，用行首锚定排除。
  const importBlocks = [...source.matchAll(/^import\s*\{([\s\S]*?)\}\s*from\s*['"]\.\/[^'"]+['"];?$/gm)];
  const imported = [];
  for (const match of importBlocks) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/).pop()?.trim();
      if (name !== undefined && name !== '') imported.push(name);
    }
  }
  // 调用位置在**剥注释后**的代码里找（注释里的名字不算调用）。
  const code = stripCommentsAndStrings(source);
  assert.ok(imported.length > 0, '应当从本插件的客户端模块 import 一些东西');

  // ⚠️ 只盯"注入/装载"类名字：它们漏调 = 静默功能失效。
  // 组件类（UsageGate / SettingsCard）由 slots.register 以引用方式使用，不在此列。
  const mustCall = imported.filter(
    (name) =>
      name.startsWith('bind') ||
      name.startsWith('load') ||
      name.startsWith('create') ||
      name.startsWith('guard') ||
      name.startsWith('record') ||
      name.startsWith('reset') ||
      name.startsWith('write'),
  );
  assert.ok(mustCall.length >= 4, `应识别出若干注入点，实际 ${mustCall.length}: ${mustCall.join(', ')}`);

  const missing = mustCall.filter((name) => {
    // 调用形态：`name(`（排除它自己的 import / 定义行 —— 去掉注释后定义行形如
    // `function name(` 或 `const name =`，这里只算"出现在调用位置"）。
    const callSite = new RegExp(`(?<!function\\s)(?<!const\\s)\\b${name}\\s*\\(`, 'g');
    const matches = [...code.matchAll(callSite)];
    return matches.length === 0;
  });

  assert.deepEqual(
    missing,
    [],
    `以下注入点在 apply 里从未被调用（漏一行 = 功能静默失效）：${missing.join(', ')}`,
  );
});
