/**
 * 装载**真实的** `lib/client.js`（浏览器侧 bundle），并回传它导出的模块。
 *
 * 为什么必须测 bundle 而不是直接 `import('../src/client.js')`：
 * DSH 浏览器侧把 `react` 这类基座模块放在宿主的冻结模块表里，客户端代码只能通过
 * bundle 外壳的 `require` 拿到。直接 `import()` src/ 时那条通道根本不存在 ——
 * 于是测试被迫自己塞一个 `ctx.import` 之类的假通道，**测试全绿、真机全废**。
 * 2026-10-15 的实测事故正是这个形状：真机 apply 里读 `ctx.import` 直接抛
 * `cannot get property "import" without inject`，被 try/catch 吞掉后整个插件
 * 静默不注册，而测试因为有假通道一直通过。
 *
 * 从 bundle 装载后，`require('react')` 走的就是生产那条路径。
 *
 * @param overrides 基座表内容（目前只有 `react`）；缺省时 `require('react')` 抛错，
 *                  用来复现「拿不到 react」的降级路径。
 * @returns bundle 导出的 `{ apply, inject, name }`。
 */
import { readFile } from 'node:fs/promises';

export default async function loadClient(overrides = {}) {
  const code = await readFile(new URL('../../lib/client.js', import.meta.url), 'utf8');
  const registered = [];
  const window = {
    __ModuleLoader__: {
      load: ({ id, factory }) => {
        const require = (name) => {
          if (Object.hasOwn(overrides, name)) {
            const value = overrides[name];
            if (value === undefined) throw new Error(`host module table has no ${name}`);
            return value;
          }
          throw new Error(`unexpected external: ${name}`);
        };
        registered.push({ id, exports: factory(require) });
      },
    },
  };
  // eslint-disable-next-line no-new-func
  new Function('window', `${code}\n`)(window);
  if (registered.length !== 1) throw new Error(`bundle 必须恰好注册一个模块，实际 ${registered.length}`);
  return registered[0].exports;
}
