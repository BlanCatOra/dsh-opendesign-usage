# Git 钩子

## 怎么启用

`git config core.hooksPath` 存在 **`.git/config`** 里，那是不进版本控制的本地文件，
所以 clone 之后**默认没有这道闸门**。三选一：

```sh
# 1) 装了依赖就会自动启用（package.json 的 prepare 钩子）
npm install        # 或 pnpm install

# 2) 手动启用（--ignore-scripts 安装、或 prepare 失败时）
git config core.hooksPath .githooks

# 3) 什么都不做 —— CI 会做同样的三项检查，只是要等推上去之后才知道
```

> ⚠️ `pnpm install --ignore-scripts` **不会**跑 `prepare`。那种情况下请用手动方式 2。
> `scripts/enable-hooks.mjs` 在装不上时会打印显眼警告，不会静默假装成功 ——
> 静默失效的防线比没有防线更危险。

## pre-push 拦什么

推送前依次做三件事，任一不满足即拒绝推送：

1. 重建 `lib/client.js`（bundle 必须与 `src/` 同源）；
2. 跑 `test/*.test.mjs` 全量测试（含 `inject-coverage.test.mjs` 的静态服务守卫）；
3. 断言重建后的 `lib/` 与已提交版本一致 —— 防止把过期产物推上去。

确实要跳过时显式写 `git push --no-verify`，并在提交信息里说明原因。

## 为什么本地钩子之外还要 CI

`.github/workflows/verify.yml` 做**同样**的三项检查。两者分工：

| | 本地 pre-push | CI |
|---|---|---|
| 依赖本地配置 | 是（`core.hooksPath`） | **否** |
| 可被 `--no-verify` 绕过 | 是 | **否** |
| 反馈速度 | 推之前就拦 | 推之后 |

本地钩子负责快，CI 负责绕不过去。**只靠本地钩子保护不了 clone 者。**

## 这道闸门的来历

来自一次真实事故（2026-10-15）：本插件在真机上**从未注册过任何表面**，
而测试全绿 —— 因为测试自己塞了生产里不存在的 `ctx.import` 通道，
把"实现搞错的外部契约"补齐了。

由此固化了三条：

1. 接线层必须测**真实 `lib/client.js`**（`test/helpers/load-client.mjs`），不测 `src/`；
2. 每个 `ctx.<service>` 都必须在导出的 `inject` 里（`test/inject-coverage.test.mjs`）；
3. 产物与 `src/` 必须同源 —— 否则守卫会在测一个旧版本而静默通过。

第 3 条是复核时补的：原先的守卫读 `lib/client.js`，只改 `src/` 不重建时它比对的
仍是旧产物，**静默通过**。变异验证时必须先重建产物才看得到红。
