/**
 * dsh-opendesign-usage —— 三个功能开关的本地即时镜像。
 *
 * 为什么需要这一层：开关的真源在 Host 的 Config（volatile 字段），而输入框
 * 控件在**另一个渲染子树**里，它只能通过插槽拿到的 face 读值。如果让它靠
 * 「每次请求顺带回来的 flags」来反映设置变化，用户改完开关要等一个刷新周期
 * （默认 5 分钟）才能看到反应 —— 那正是 workbuddy 4.3.0「设置页改了没用」
 * 的缺陷形状，必须避免。
 *
 * 所以这里放一个极小的订阅式 store：
 *  - 设置页写入（`set`）→ 立刻通知订阅者 → 输入框控件同步重渲染，零网络延迟；
 *  - 网络回来的 `flags` 也写进来（`set`），作为**冷启动**与**兜底**来源，
 *    这样重新加载页面后、设置页还没打开时控件也能拿到正确开关。
 *
 * 两条写入路径共用同一个 store，因此不会出现「本地值」与「宿主值」两个真相。
 *
 * @module dsh-opendesign-usage/flags-store
 */
import {
  FLAG_COMPOSER_USAGE,
  FLAG_PLAN_QUOTA,
  FLAG_TOKEN_USAGE,
  normalizeFlag,
} from './constants.js';

/** 本 store 内部使用的规范字段名（= Config schema 的字段名，也是设置页写入用的名字）。 */
export const FLAG_KEYS = [FLAG_COMPOSER_USAGE, FLAG_PLAN_QUOTA, FLAG_TOKEN_USAGE];

/**
 * 同一批开关的**短名**别名。
 *
 * 为什么需要这张表：三个方向用的名字不一样，这是实测出来的事实，不是猜测 ——
 *  - 宿主 `flagsOf()` 在 `/plan-usage` 响应里返回**短名**（`composerUsage`）；
 *  - 设置页经 `flagsStore.set()` 写入的是**长名**（`enableComposerUsage`，即
 *    Config 字段名），因为它直接复用 `FLAG_*` 常量；
 *  - 控件从 store 读，也只能是长名。
 *
 * 于是宿主是唯一的短名生产者。如果只在长名上做匹配，宿主回来的 flags 会被
 * 整个丢弃 —— 冷启动兜底静默失效（页面刷新后控件拿到的是默认值），而设置页
 * 的即时写入看起来又是正常的，这种「一半能用」最难查。
 *
 * 处理方式：**内部一律规范化成长名**，在入口处把短名翻译过来。这样 store 只有
 * 一套真相，宿主与设置页都只需各自记住自己的那份名字。
 */
const FLAG_ALIASES = {
  composerUsage: FLAG_COMPOSER_USAGE,
  planQuota: FLAG_PLAN_QUOTA,
  tokenUsage: FLAG_TOKEN_USAGE,
};

/**
 * 把任意来源里的开关字段规范化成长名。
 *
 * 长名优先于短名（同一个对象里两者都给且矛盾时，长名是设置文档的真源）。
 * 只接受真正的布尔，其余原样跳过。
 *
 * @param source 任意对象（可为 undefined / null）。
 * @returns 只含长名的对象（只收有效布尔）。
 */
function canonicalFlags(source) {
  const out = {};
  if (source === null || typeof source !== 'object') return out;
  for (const [alias, key] of Object.entries(FLAG_ALIASES)) {
    if (typeof source[alias] === 'boolean' && typeof source[key] !== 'boolean') out[key] = source[alias];
  }
  for (const key of FLAG_KEYS) {
    if (typeof source[key] === 'boolean') out[key] = source[key];
  }
  return out;
}

/**
 * 从任意来源（Host 响应、设置草稿、getSnapshot）里挑出开关值。
 *
 * 只接受真正的布尔：`undefined`／缺字段／字符串 `'false'` 一律**不覆盖**
 * 现有值。这条规则是刻意的 —— 「宿主没说」和「用户关掉了」必须区分开，
 * 否则一次请求失败就会把用户打开的开关悄悄关掉。
 *
 * 短名（宿主响应）会被翻译成长名，见 {@link FLAG_ALIASES}。
 *
 * @param source 任意对象（可为 undefined / null）。
 * @returns 只含有效布尔字段的补丁对象（长名）。
 */
export function pickFlags(source) {
  const nested = source !== null && typeof source === 'object' && typeof source.value === 'object' && source.value !== null
    ? source.value
    : undefined;
  // 与 resolveFlags 保持同样的解包规则：`{ value: {...} }` 是 settings scope 的形状。
  return canonicalFlags(nested === undefined ? source : { ...source, ...nested });
}

/**
 * 从设置文档里读开关，缺字段时按 `fallback` 解析。
 *
 * 与 {@link pickFlags} 的区别：这里**每个字段都会给值**（缺字段落下兜底），
 * 用于「从设置面初始化 store」；pickFlags 用于「增量补丁」。
 *
 * @param source 设置文档（可为 undefined）。
 * @param fallback 缺字段时的兜底（通常是 defaultSettings()）。
 * @returns 完整的开关对象（长名）。
 */
export function resolveFlags(source, fallback) {
  const base = canonicalFlags(fallback);
  const normalized = canonicalFlags(source);
  const out = {};
  for (const key of FLAG_KEYS) {
    out[key] = typeof normalized[key] === 'boolean' ? normalized[key] : normalizeFlag(base[key], true);
  }
  return out;
}

/**
 * 建一个开关 store。
 *
 * 接口刻意做得极小（get/set/subscribe），因为 settings-dev 那边要 import 它
 * 写值、控件这边要订阅它；接口越小越不容易在两边理解不一致。
 *
 * @param initial 初始开关对象（缺字段按「开启」）。
 * @returns `{ get, set, subscribe }`
 *   - `get()`：当前开关快照（新对象，调用方可安全持有）。
 *   - `set(patch)`：写入，只接受布尔值；**值未变化时不通知**（避免无谓重渲染）。
 *   - `subscribe(fn)`：订阅，返回退订函数。
 */
export function createFlagsStore(initial) {
  let state = resolveFlags(initial, undefined);
  const listeners = new Set();

  const get = () => ({ ...state });

  const set = (patch) => {
    const next = pickFlags(patch);
    let changed = false;
    for (const [key, value] of Object.entries(next)) {
      if (state[key] !== value) {
        state = { ...state, [key]: value };
        changed = true;
      }
    }
    if (!changed) return false;
    for (const listener of [...listeners]) {
      try {
        listener(get());
      } catch {
        // 单个订阅者出错不能影响其他订阅者，也不能冒泡到设置页的写入路径。
      }
    }
    return true;
  };

  const subscribe = (listener) => {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  };

  return { get, set, subscribe };
}

/**
 * 把 store 适配成 React 组件能用的「订阅 + 取快照」对。
 *
 * 放在这里而不是组件里，是为了让 composer-usage.js 只关心界面；
 * 同时也是 `useSyncExternalStore` 的形状（该 API 要求 getSnapshot 返回
 * **同一个**引用直到真的变化，因此这里缓存快照对象）。
 *
 * @param store createFlagsStore() 的返回值。
 * @returns `{ subscribe, getSnapshot }`；store 缺失时返回 undefined。
 */
export function reactFlagsSource(store) {
  if (store === undefined || store === null || typeof store.subscribe !== 'function') return undefined;
  return {
    subscribe: (onChange) => store.subscribe(() => onChange()),
    getSnapshot: () => store.get(),
  };
}
