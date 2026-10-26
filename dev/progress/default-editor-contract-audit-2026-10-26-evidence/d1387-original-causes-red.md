---
title: "D1387 原两机制精确旧生产业务红"
type: progress
status: active
phase: M7
updated: 2026-10-26
summary: "555c旧生产与J23f新测试test-only scope，12 DTO断言红+2准确目标路由业务拒绝；无加载、类型或timeout，生产out未改。"
---

# D1387 原两机制业务红

当前merge源为 `555c41e8da6aa8ae19db361d81e88680875722ed`（src仍de22绿编译树）。主工位已实查clean、安全ff同一555c；主工位独立out未写，不将源码同步称为产物刷新。随后仅取不可变 `23f8701c8d2a6bd4b47c2e098c62a5bb89649c84` 的 `sourcesChangesList.test.ts` 与 `conversationEditorFence.test.ts`，使用仓库esbuild ESM/es2024/experimentalDecorators/useDefineForClassFields:false、inline map、sourcesContent:false并替换.ts?esm为.js?esm，刷新对应**两份测试JS**。

没有将J生产/测试源码或其未提交WIP写入merge源码，没有全量编译或刷新新生产。helper、finder、slot、EditorService和Conversation routing五core源均逐字等于c968与133ef；执行前后五份生产JS SHA相等。[完整来源/命令/测试产物身份](d1387-original-causes-red-identity.json)绑定实际旧生产与新测试，这是明确的test-only混合scope，不称整out同构建。

官方Electron/Xvfb定向 `API SCM .*dispatches its DTO once|public finder and EditorService retain the exact typed Conversation` 实际 **0 passing / 14 failing、exit1**，[原始日志](d1387-original-causes-red.log)：

- 12个API open/diff×无slot/newTab/replace×保焦点组合都走`resource.open`（实际1，断言期望0），因未走API command DTO而业务AssertionError红。
- object/id准确Conversation两项在原finder抛出 `Conversation chat input requires CONVERSATION_GROUP or a conversation editor group`，这是本应获授权的精确组被旧围栏拒绝的业务异常；没有把异常冒称完成到后续pane断言。
- 无测试加载错误、类型诊断、超时或清理hook失败计入此red。两测试的后续green仍待最终J补修，不计实现完成或after。

随后独立D规则16增量文档来源 `cbac43bfde8` 真三路接入，src/out均未改；[机器门禁](d1387-custom-review-integration.json)逐路径两边保留PASS。原实现peer C0/I2依然待补修；新增custom窄例外方案C0/I0只证明设计可实施，不是源码验证。API不预pin；custom newTab保留预pin成本须单独报告，不能合并成总的零副作用承诺。
