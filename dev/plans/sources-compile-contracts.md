---
title: "Sources 编译基线：注入、空编辑器与测试生命周期合同"
type: plan
status: implemented
phase: M7
updated: 2026-10-26
summary: "D1375：三类 Sources 合同根因已修；merge 当前 compile-client 中 Sources 0 诊断、全仓仍 160 条 / 58 文件；官方 Electron 六套件 171 passing，新增 6 条行为通过；范围内验收完成。"
---

# Sources 编译基线合同修复

> 基线：`0ea26634bed`，工位 `loop/J`。诊断入口为 [旧 compile-client 日志](../progress/ui-visual-review-2026-10-26-evidence/compile-client.log) 的 Sources 9 条；当前源码复核不把 D1368–D1372 的已修诊断再算本轮。

## 1. 根因与边界

| 根因 | 当前源码事实 | 旧日志对应诊断 |
| --- | --- | --- |
| 装饰服务类型被写成可缺失 | `SourcesTabsHost`、`SourcesFilesExplorer` 的最后一个 `@IAgentSessionContext` 是 union，`SourcesReviewProgressService` 是 optional。`GetLeadingNonServiceArgs` 只能剥离 `BrandedService`，因此工厂把服务参数当成静态参数；singleton 构造合同也失败 | contribution 1、Explorer 工厂 1、Tabs/PartFocus 工厂 3、Review singleton 1，共 6 |
| 编辑器组空值和打开结果不一致 | `IEditorGroup.activeEditor` 为 `EditorInput | null`，SCM 打开助手返回 `EditorInput | undefined` 却原样返回组值 | `sourcesChangeEntryOpen.ts` 2 |
| 测试生命周期容器漏接 | list-mode 套件创建了 disposable 检查器，却没保存返回的 `store`，后续测试引用未定义名字 | `sourcesFilesListMode.test.ts` 1 |

只改 Sources 模块及本方案/行动层。保留现有 session/work-root 可选方法兼容；生产装饰参数使用正式 `IAgentSessionContext`。不改构造注入框架、不增加 `any` 或错误压制、不删除测试、不改 Sessions/AgentHost 或 Conversation CSS。

## 2. 修复

1. 三个服务装饰参数改为必需的 `IAgentSessionContext`，清除只为容忍缺服务而存在的分支；服务的可选功能方法仍按接口判断。TabsHost 保留构造注入的 ReviewHost 服务供 dispose 使用，避免 dispose 期间重新向容器取依赖。
2. Sources Tabs / PartFocus / ReviewProgress / ReviewList 测试提供明确的正式会话夹具；夹具放在测试目录，用完整必需字段及事件表达无活动会话或指定工作根。生产类不为测试发明 subset 服务接口。
3. SCM 打开助手在读到 `activeEditor` 后将 `null` 归一为 `undefined`，继续保持 newTab pin 与 replace close 语义。`activeEditor === null` 时不记录身份；`resource.open()` 若保留旧 activeEditor 属已有语义，不在本次空值归一中改判。
4. list-mode 套件保存 leak-checker 的 `store`，由套件统一释放 filter，避免依赖测试手动提前 dispose。

## 3. 有意义的回归

- TabsHost 通过真实 `IAgentSessionContext` 活动会话事件：A 的 Changes、B 的 Review 往返恢复，dispose 后不再保存/响应事件。
- ReviewProgress 通过注入的 session 工作根，使同一路径分别按两个会话的根匹配 mutation；一个会话的 mutation 不清掉另一个会话的已审记录。
- SCM open 的 replace/newTab：组 `activeEditor === null` 时无异常、不 pin/close 空值、不记录错误身份；同时覆盖已有编辑器的 pin/close 顺序与新编辑器身份记录。
- list-mode 的 filter 可访问名称原回归保留，并纳入套件释放检查。

## 4. 验证与落账

- J 只做静态源码/调用点复核、目标 ESLint、`git diff --check`、文档健康与生成状态检查，不编译、不转译、不启动 watch、不写 `out/`。
- merge 的唯一新编译实际诊断决定本轮消除数；旧日志的 9 条只作预计，不把全仓通过或 176→167 当作已验证事实。
- merge 新产物定向运行 `sourcesTabs`、`sourcesPartFocus`、`sourcesReviewProgress`、`sourcesReviewList`、`sourcesFilesListMode` 与 SCM 打开行为所在套件。失败按 [health-gates](../progress/health-gates.md) 分类，不改既定编译门政策。
- D1375 已由 merge 当前编译无本轮合同诊断与官方 Electron 回归通过闭合；只翻转本方案，不升 PRD 或既有 Sources 总方案状态。

## 5. 只读审查与实施

- [x] 规则 16：D / `conversation_status_visual` 于 2026-10-26 完成只读审查（未改 J 文件）：Strengths 为三根因与正式服务合同吻合、行为回归及 merge 验证边界清晰；Critical / Important 无；Minor 两项已改入本文（null 归一边界、实际审查者身份）；Assessment 可进入方案独立提交及实施。
- [x] 三类合同修复与行为回归：生产 4 文件、测试 6 文件及 1 份完整 session 夹具；新增 SCM null/newTab/replace 4 项、TabsHost 会话/销毁 1 项、ReviewProgress 双会话工作根 1 项。merge 已用当前新产物完成官方 Electron 六套件 171 passing（含清理检查），新增 6 项全部通过。
- [x] 静态检查：11 个改动 TS 文件 ESLint exit 0（0 errors / 31 既有 warnings），直接构造与工厂调用点已全仓复核；文档健康、生成状态与 diff-check 通过；行动层与下列当前 merge 验收结果一并落账。
- [x] merge 新编译与新产物定向回归：`a4c5e30896f` 上唯一 `compile-client` exit 1，160 条 / 58 文件；Sources 0、本轮改动 TS 0；命名旧 9 条均消失。Chromium 六套件 162 passing / 8 既有 process 环境失败，转官方 Electron + 隔离 Xvfb / `--no-sandbox` 同六套件 171 passing / 0 failing。目标 ESLint 0 errors / 31 既有 warnings。真实日志与新输出清单见 [本轮看板](../parallel/active/ui-visual-review-2026-10-26.md)。
