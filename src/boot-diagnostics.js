/**
 * dsh-opendesign-usage —— 启动自检：任何一步失败都只降级、只留痕，**绝不外抛**。
 *
 * 为什么必须有这一层（2026-10-15 实测事故）：DSH 的 web boot 把每个客户端插件的
 * cordis fiber 都当成必须 ACTIVE 的条目。`apply` 里冒出的任何异常都会把 fiber 打成
 * FAILED（cordis `Fiber._reload()` 捕获后置 `_error`），web boot 随即
 * `throw new Error("web boot: N entry did not activate")` —— **整个界面白屏**，
 * 而 crash log 只有一行 `<包名>: failed`，**没有堆栈**（异常交给了渲染进程 logger，
 * 它不落盘）。
 *
 * 本插件之前恰好是「反过来」的隐患：`loadReact()` 把 `ctx.import` 取进 try/catch，
 * 那条异常被吞掉后 `apply` 直接 `return`，于是**控件和设置页都不注册**，日志里
 * 只有一行 warn —— 没有白屏，但插件等于没装，而且无从排查。
 *
 * 所以这里的规矩是两条：
 *  1. 每个步骤各自守卫，失败只记一条并继续下一面；
 *  2. 报告写进 `localStorage`（渲染进程里**唯一**事后能从磁盘读回来的地方），
 *     用 `~/.dsh/bin/dsh-boot-report` 读；同时 `console.error` 一份。
 *
 * @module dsh-opendesign-usage/boot-diagnostics
 */

/** 留痕键。读法：在 Electron 的 Local Storage leveldb 里 grep 这个键。 */
export const BOOT_REPORT_KEY = 'dsh.opendesign-usage.boot';

/** 取一个可用的 Web Storage；被禁用/不存在一律当成「没有」。 */
function safeStorage(kind) {
  try {
    const store = globalThis[kind];
    if (store === undefined || store === null) return undefined;
    void store.length;
    return store;
  } catch {
    return undefined;
  }
}

/**
 * 包一个启动步骤：抛错时记一条记录并返回兜底值，**绝不外抛**。
 *
 * @param failures 失败记录收集数组（就地追加）。
 * @param where 步骤标识。
 * @param run 步骤本体。
 * @param onError 失败时的兜底值工厂，可选。
 * @returns `run()` 的返回值，失败时是 `onError?.()` 或 undefined。
 */
export function guardStep(failures, where, run, onError) {
  try {
    return run();
  } catch (error) {
    recordFailure(failures, where, error);
    if (onError === undefined) return undefined;
    try {
      return onError(error);
    } catch (nested) {
      recordFailure(failures, `${where}:fallback`, nested);
      return undefined;
    }
  }
}

/** 记一条失败：`console.error` 一份，并追加到收集数组。 */
export function recordFailure(failures, where, error, extra) {
  const message = error instanceof Error ? error.message : String(error);
  const stack = error instanceof Error && typeof error.stack === 'string' ? error.stack : '';
  failures.push({
    where: String(where),
    message,
    stack: stack.slice(0, 4000),
    ...(extra === undefined ? {} : { extra: String(extra).slice(0, 500) }),
  });
  try {
    console.error(`[dsh-opendesign-usage] 启动步骤「${where}」失败：`, error);
  } catch {
    // 连 console 都不可用就没什么能做的了。
  }
}

/**
 * 写一份启动报告。**任何一步失败都只吞掉，绝不外抛。**
 *
 * @param failures 本次启动累积的失败记录。
 * @param context 额外环境信息，可选。
 * @returns 写进去的报告对象（便于测试断言）。
 */
export function writeBootReport(failures, context) {
  const report = {
    at: new Date().toISOString(),
    ok: failures.length === 0,
    ...(context === undefined ? {} : { context }),
    failures,
  };
  for (const kind of ['localStorage', 'sessionStorage']) {
    const store = safeStorage(kind);
    if (store === undefined) continue;
    try {
      store.setItem(BOOT_REPORT_KEY, JSON.stringify(report));
    } catch {
      // 配额/序列化/被拒——留痕失败不该影响启动。
    }
  }
  return report;
}

/** 读回最近一次启动报告；没有、损坏或读不到时返回 undefined。 */
export function readBootReport(kind = 'localStorage') {
  const store = safeStorage(kind);
  if (store === undefined) return undefined;
  try {
    const raw = store.getItem(BOOT_REPORT_KEY);
    if (typeof raw !== 'string') return undefined;
    const parsed = JSON.parse(raw);
    return parsed !== null && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}
