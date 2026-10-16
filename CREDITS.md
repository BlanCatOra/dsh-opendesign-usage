# 贡献者与署名

## 作者

- **blancatora** —— AI 编码代理（DeepSeek Harness 编码代理 / deepseek-v4.1-flash）。
  **本项目的全部代码由本代理编写。**
- 联系方式：blancatora@agent.qq.com

> 本项目**没有人类代码作者**。下方「协作与责任」如实说明谁承担了哪些环节。

## 协作与责任

按开源透明的要求，如实声明人机分工：

| 环节 | 承担者 | 说明 |
|---|---|---|
| 代码实现（Host 路由、客户端控件、插件配置卡片、打包器、测试、文档） | **blancatora**（AI 代理） | 全部由本代理编写 |
| 需求定义、上游 API 实测、方案裁决、最终验收 | **账号所有者**（人类） | 决定「做什么」「这样做对不对」，并在真机上逐项验收 |
| 真机行为验证 | **账号所有者** | 每个接受的行为都在本机 DSH 上实际运行过 |

**责任归属**：AI 生成的内容**可能包含错误**。本项目在开发过程中经过人类逐项验收与实机验证，
但使用者仍应自行评估其是否适用于自己的场景。LICENSE 中的免责条款同样适用于 AI 生成的部分。

**署名说明**：本项目对外署名使用 AI 代理名 `blancatora`（含其 agent 邮箱），
GitHub 账号 `BlanCatOra` 仅作为**提交通道**，不代表人类作者身份。

## 第三方代码

本项目 `src/build-client.mjs` 的**打包器结构**复用自同一作者的 `dsh-prompt-expander`
（MIT 许可）。复用而非重新发明的原因：那份实现已经过实际装载验证，重新写一个等价的
构建脚本只会引入新的失败面。文件头保留了来源说明。

> ⚠️ 该来源项目**目前未公开发布**，因此这里不给链接 —— 与其编一个打不开的仓库地址，
> 不如如实说明。若将来它公开，在此补上 URL。

本项目的 slot 注册方式、`ensureCss` 幂等样式注入、以及 Host 侧
`loopbackOrigin` / `readBody` / `mount` 的写法，参考了同一作者的 `dsh-prompt-expander`。

`useProjection` 的 provider 判定与「点击读数弹出面板」的交互形状，参考了
[dsh-connect-workbuddy](https://github.com/dingminhua/dsh-connect-workbuddy)
（MIT，Copyright (c) 2026 LaoDing）的 `ComposerCreditsGate` 实现。
**该项目的实现本身又继承自**
[dsh-subagent-default-model](https://github.com/dingminhua/dsh-subagent-default-model)
与 `dsh-connect-trae`（MIT，Copyright (c) 2026 LaoDing）—— 一并致谢。

⚠️ 本项目的 UI 组件**不复制**上述项目的代码：控件全部来自 DSH 官方共享包
`@deepseek-ai/dsh-client-ui-primitives`。参考的是**接线与交互形状**，不是代码。

## 上游依赖

- [DeepSeek Harness (DSH)](https://github.com/deepseek-ai/deepseek-harness) —— 插件宿主。
- `@deepseek-ai/schemastery` —— 配置 schema。
- React 18 —— 客户端控件（由 DSH 外壳提供，不随本包分发）。

## 与 Open Design 的关系

本项目是**非官方的第三方插件**，与 Open Design（AMR）官方无隶属关系，未获其背书。
它读取的是用户**自己账号**在 Open Design 控制台上的额度数据，使用的凭据由用户自行提供，
插件不收集、不上传、不代理任何凭据到第三方。
