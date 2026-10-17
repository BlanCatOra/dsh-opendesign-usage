/**
 * dsh-opendesign-usage —— 极简客户端打包器（无第三方依赖）。
 *
 * 为什么需要它：DSH 浏览器侧只消费**一个** `./client` bundle，且
 * `window.__ModuleLoader__` 只解析 `./` 开头的相对请求到同包的分块文件。
 * 本项目不引入构建工具链，因此这里把 `src/` 下的若干 ESM 模块合并成
 * 一个自包含的 factory，既保有模块边界（可单测、可复用），又满足单文件
 * 交付要求。
 *
 * 本文件复用自 dsh-prompt-expander（同为 MIT，作者 blancat）的同类打包器，
 * 仅替换了产物的包名与说明；那份实现经过实际装载验证，不重新发明。
 *
 * 支持的语法子集（足够本项目，且刻意保持窄）：
 *   - `import { a, b as c } from './x.js'`
 *   - `import name from './x.js'`
 *   - `export function f / export const x / export class C`
 *   - `export { a, b as c }`
 *
 * 不支持的语法会**显式报错**而不是静默产出坏 bundle——静默是关键失败，
 * 一个跑得起来但行为不对的 bundle 比构建失败难查得多。
 *
 * @module dsh-opendesign-usage/build
 */
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

/** 匹配静态 import 语句，捕获子句与模块说明符。 */
const IMPORT_RE = /^[ \t]*import\s+([\s\S]*?)\s+from\s+['"]([^'"]+)['"]\s*;?[ \t]*$/gm;

/** 匹配 `export function/const/class/let/var` 顶层声明。 */
const EXPORT_DECL_RE = /^[ \t]*export\s+(async\s+function|function|const|let|var|class)\s+([A-Za-z_$][\w$]*)/gm;

/** 匹配 `export { ... }` 汇总语句。 */
const EXPORT_LIST_RE = /^[ \t]*export\s*\{([^}]*)\}\s*;?[ \t]*$/gm;

/**
 * 把 `a, b as c` 解析成 `{ inside, outside }` 列表。
 *
 * `inside` 是模块内部的真实名字，`outside` 是跨模块边界的名字。两个方向
 * 的含义**相反**，这正是最容易写错的一处：
 *   - import 的 `b as c`：外部提供 `b`，本地叫 `c` → inside=c, outside=b
 *   - export 的 `b as c`：本地叫 `b`，对外暴露 `c` → inside=b, outside=c
 * 因此调用方必须显式说明方向，不能共用一种解读。
 */
function parseSpecifiers(text, direction) {
  return text
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .map((part) => {
      const asMatch = /^([\w$]+)\s+as\s+([\w$]+)$/.exec(part);
      if (asMatch === null) return { inside: part, outside: part };
      return direction === 'import'
        ? { inside: asMatch[2], outside: asMatch[1] }
        : { inside: asMatch[1], outside: asMatch[2] };
    });
}

/**
 * 把单个模块的 ESM 源码转成 factory 体，并回传它导出的名字。
 *
 * @param source 模块源码。
 * @param moduleId 该模块在 bundle 内的键（相对 src/ 的路径）。
 * @returns `{ body, exports }`。
 */
export function transformModule(source, moduleId) {
  const exports = new Set();
  const importedModules = new Set();
  let body = source;

  // 先处理 import，把它们替换成对本地 registry（相对）或宿主 require（裸名）的绑定。
  body = body.replace(IMPORT_RE, (match, clause, specifier) => {
    const external = !specifier.startsWith('.');
    if (!external) importedModules.add(specifier);
    const from = external ? `__dshExternal(${JSON.stringify(specifier)})` : `__dshRequire(${JSON.stringify(specifier)})`;
    const trimmed = clause.trim();
    const lines = [];
    const namedMatch = /\{([\s\S]*)\}/.exec(trimmed);
    const defaultPart = trimmed.replace(/\{[\s\S]*\}/, '').replace(/,\s*$/, '').trim();
    if (defaultPart !== '') {
      // 宿主基座模块（react / react/jsx-runtime）用各自的真实形状：
      // react 是 CJS 默认导出，jsx-runtime 也是，因此取 `.default ?? 自身`。
      lines.push(`const ${defaultPart} = (${from}).default ?? ${from};`);
    }
    if (namedMatch !== null) {
      const specs = parseSpecifiers(namedMatch[1], 'import');
      if (specs.length > 0) {
        // 解构模式里 `{ outside: inside }` 的冒号左侧才是对象上的键。
        const pattern = specs.map((s) => (s.inside === s.outside ? s.inside : `${s.outside}: ${s.inside}`)).join(', ');
        lines.push(`const { ${pattern} } = ${from};`);
      }
    }
    if (lines.length === 0) throw new Error(`${moduleId}: 无法解析 import 子句 "${trimmed}"`);
    return lines.join('\n');
  });

  // 顶层 export 声明：记录名字并去掉 export 前缀。
  body = body.replace(EXPORT_DECL_RE, (match, kind, exportedName) => {
    exports.add(exportedName);
    return match.replace(/^([ \t]*)export\s+/, '$1');
  });

  // export { ... } 汇总：只记录名字，语句本身删掉。
  body = body.replace(EXPORT_LIST_RE, (match, list) => {
    for (const spec of parseSpecifiers(list, 'export')) exports.add(spec.outside);
    return '';
  });

  // 任何残留的顶层 export 都是未支持的写法，必须报错。
  const leftover = /^[ \t]*export\s+/m.exec(body);
  if (leftover !== null) {
    const line = body.slice(leftover.index).split('\n')[0].trim();
    throw new Error(`${moduleId}: 不支持的 export 写法 "${line}"`);
  }

  return { body, exports: [...exports], importedModules: [...importedModules] };
}

/** 从入口出发，按依赖顺序解析出所有需要的模块。 */
async function collect(entryPath, rootDir) {
  const modules = new Map();
  const visiting = new Set();
  let entryId;

  async function visit(filePath) {
    const key = filePath;
    if (modules.has(key)) return;
    if (visiting.has(key)) throw new Error(`循环 import：${filePath}`);
    visiting.add(key);
    const source = await readFile(filePath, 'utf8');
    const moduleId = filePath.slice(rootDir.length).replace(/^[/\\]/, '').split('\\').join('/');
    const { body, exports, importedModules } = transformModule(source, moduleId);
    // 先解析依赖，保证输出里依赖定义在消费者之前。
    for (const specifier of importedModules) {
      const depPath = resolve(dirname(filePath), specifier);
      await visit(depPath);
    }
    visiting.delete(key);
    modules.set(key, { id: moduleId, body, exports });
  }

  await visit(entryPath);
  entryId = entryPath.slice(rootDir.length).replace(/^[/\\]/, '').split('\\').join('/');
  // Map 的插入顺序已经是「依赖先于消费者」，因为 visit 是后序返回。
  return { modules: [...modules.values()], entryId };
}

/**
 * 构建 bundle。
 *
 * @param options.entry 入口文件绝对路径。
 * @param options.root 模块键的基准目录。
 * @param options.packageId bundle 的 id（与 package.json 名称一致）。
 * @param options.output 输出文件绝对路径。
 * @param options.banner 输出文件顶部的注释。
 */
export async function build({ entry, root, packageId, output, banner = '' }) {
  const { modules, entryId } = await collect(entry, root);
  const parts = [];
  parts.push(banner.trim() === '' ? '' : `${banner.trim()}\n`);
  parts.push('window.__ModuleLoader__.load({');
  parts.push(`\tid: ${JSON.stringify(packageId)},`);
  parts.push('\tfactory: (require) => {');
  parts.push('\t\tvar __dshRegistry = new Map();');
  parts.push('\t\tvar __dshCache = new Map();');
  parts.push('\t\t/** 宿主基座模块（react 等）由外壳的冻结模块表提供。 */');
  parts.push('\t\tfunction __dshExternal(name) { return require(name); }');
  parts.push('\t\t/** 按模块键懒加载；每个模块只执行一次。 */');
  parts.push('\t\tfunction __dshRequire(key) {');
  // 模块键是相对 src/ 的裸路径（`constants.js`），而源码里的 import 写的是
  // `./constants.js`；在这里统一，否则查表必然落空。
  parts.push('\t\t\tkey = key.replace(/^\\.\\//, \"\");');
  parts.push('\t\t\tif (__dshCache.has(key)) return __dshCache.get(key);');
  parts.push('\t\t\tvar factory = __dshRegistry.get(key);');
  parts.push('\t\t\tif (factory === undefined) throw new Error("dsh-opendesign-usage: unknown module " + key);');
  parts.push('\t\t\tvar exports = {};');
  parts.push('\t\t\t__dshCache.set(key, exports);');
  parts.push('\t\t\tfactory(exports);');
  parts.push('\t\t\treturn exports;');
  parts.push('\t\t}');
  for (const mod of modules) {
    parts.push(`\t\t__dshRegistry.set(${JSON.stringify(mod.id)}, (__exports) => {`);
    parts.push(`\t\t\tvar module = { exports: __exports };`);
    // 模块体缩进一层，便于阅读生成结果。
    parts.push(
      mod.body
        .split('\n')
        .map((line) => (line.trim() === '' ? '' : `\t\t\t${line}`))
        .join('\n'),
    );
    if (mod.exports.length > 0) {
      const pairs = mod.exports.map((name) => `${JSON.stringify(name)}: ${name}`).join(', ');
      parts.push(`\t\t\tObject.assign(__exports, { ${pairs} });`);
    }
    parts.push('\t\t});');
  }
  parts.push(`\t\tvar __entry = __dshRequire(${JSON.stringify(entryId)});`);
  parts.push('\t\tvar module = { exports: {} };');
  parts.push('\t\tvar exports = module.exports;');
  parts.push('\t\tObject.defineProperty(exports, Symbol.toStringTag, { value: "Module" });');
  // 三个字段是 DSH 浏览器侧真正消费的：apply 挂载插件，inject 声明所需服务，
  // name 让宿主日志与插件清单能报到正确的插件名（缺了它日志里是 undefined）。
  parts.push('\t\texports.apply = __entry.apply;');
  parts.push('\t\texports.inject = __entry.inject ?? [];');
  parts.push('\t\texports.name = __entry.name;');
  parts.push('\t\treturn module.exports;');
  parts.push('\t},');
  parts.push('});');
  const code = `${parts.join('\n')}\n`;
  assertBundleShape(code, packageId);
  await writeFile(output, code, 'utf8');
  return { modules: modules.map((m) => m.id), bytes: Buffer.byteLength(code) };
}

/**
 * 前端 boot 的 **seed 表白名单**（`staticModules`）—— 冻结基座模块。
 *
 * 只有白名单里的 9 个模块能出现在产物的 `require(...)` 里：它们是 DSH 前端启动时**先于**
 * 一切插件装载进冻结模块表的基座，`require` 必定成功。
 *
 * ⚠️ **宿主 seed 表会随版本变宽**：0.2.1-rc.2 实测是 **11 项**（新增 `zod` 与
 * `@tanstack/react-virtual`）。本仓库**故意只放行更窄的 9 项** —— 我们不需要那两项，
 * 放行面越窄越安全（宿主将来移除时不会连带白屏）。
 * ⚠️ 定位宿主 seed 表要搜 `staticModules`，**不要 grep 函数名**：rc.2 里是 `SZ()`、
 * 旧版是 `gM()`，每次构建都可能变。
 *
 * 规范出处：`~/Projects/dsh-plugin-standards/docs/UI-STANDARDS.md` §0.1 与 §4。
 *
 * ⚠️ 旧名单只有 react 系 4 个，注释里写着「官方规范禁止第三方插件加载 Harness Client 包」
 * —— 那个结论**已作废**：它是把白屏事故**归错了因**（真因是漏声明插件的 `inject`
 * 服务名，与 require primitives 无关）。现在允许 require `primitives` 等基座包，
 * 因为第三方插件要统一外观就必须用官方组件；超出 seed 表的包仍然构建失败。
 *
 * 注意：这里禁的是**产物文本里能被静态扫到的 `require(...)`**（也就是 `src/` 里的顶层
 * `import ... from '<裸包名>'`，由 `transformModule` 换成 `__dshExternal(...)`）。
 */
const SEED_MODULES = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]);

/**
 * 构建期守卫：产物必须是可解析的 JS，且只 require 白名单里的 9 个基座模块
 * （宿主 seed 表在 rc.2 有 11 项，本仓库只放行更窄的 9 项）。
 *
 * 为什么放在构建里而不只放测试：这两类错误都不是逻辑错误，而是**产物层面**的
 * 结构性损坏，而真机加载的是 `lib/client.js`。构建期直接拦下，坏产物根本不会落盘。
 *
 * 实测教训（2026-10-15）：CSS 模板字符串里的注释写了反引号，提前闭合了字符串，
 * 产物语法坏掉；真机表现为整站白屏 + crash log 只有一行
 * `dsh-opendesign-usage: import failed`，没有任何堆栈，排查成本极高。
 *
 * @param code 生成的 bundle 文本。
 * @param packageId 包名，用于报错前缀。
 * @throws {Error} 产物语法非法，或 require 了 seed 表之外的模块。
 */
function assertBundleShape(code, packageId) {
  try {
    // 只编译、不执行：new Function 会解析函数体，语法错误在此抛出。
    new Function(code);
  } catch (error) {
    throw new Error(
      `${packageId}: 生成的 bundle 语法非法（真机会表现为整站白屏）：${error.message}`,
    );
  }
  const requested = [...code.matchAll(/require\((['"])([^'"]+)\1\)/g)].map((match) => match[2]);
  const illegal = [...new Set(requested)].filter((name) => !SEED_MODULES.has(name));
  if (illegal.length > 0) {
    throw new Error(
      `${packageId}: bundle 请求了 seed 表之外的模块 ${illegal.join(', ')}；` +
        '只允许前端 boot 的 9 个冻结基座模块（UI-STANDARDS.md §4），' +
        '需要别的 Harness Client 包时说明它不在 seed 表里，require 必然失败。',
    );
  }
}

/**
 * 产物顶部的 banner。
 *
 * 提成导出常量而不是在 CLI 分支里内联：`test/inject-coverage.test.mjs` 要拿
 * 它做「产物与 src 同源」的比对，两处各写一份必然漂移（漂移的表现是守卫
 * 永远报"不同源"，然后被人当成噪音忽略掉——那比没有守卫更糟）。
 *
 * @param packageId 包名。
 * @returns banner 文本。
 */
export function bannerFor(packageId) {
  return `/**\n * ${packageId} —— 浏览器侧 bundle。\n *\n * 本文件由 build-client.mjs 从 src/ 生成，请勿手改；改 src/ 后重新运行：\n *   node build-client.mjs\n */`;
}

if (process.argv[1] !== undefined && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  const pkg = JSON.parse(await readFile(join(here, '..', 'package.json'), 'utf8'));
  const result = await build({
    entry: join(here, "client.js"),
    root: here,
    packageId: pkg.name,
    output: join(here, '..', 'lib', 'client.js'),
    banner: bannerFor(pkg.name),
  });
  console.log(`built lib/client.js — ${result.bytes} bytes, ${result.modules.length} modules`);
  for (const id of result.modules) console.log(`  ${id}`);
}
