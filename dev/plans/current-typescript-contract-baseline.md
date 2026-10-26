---
title: "当前 TypeScript 编译合同基线"
type: plan
status: accepted
phase: M7
updated: 2026-10-26
summary: "c968 全量编译真实45诊断/27文件；修正夹具与API合同、窄化可选URI及按钮类型，不改产品范围或压制诊断。"
---

# 当前 TypeScript 编译合同基线

## 事实与目标

唯一 merge 槽在 `c968c0627e7` 运行 `rtk proxy npm run compile-client`，实际 exit 1、45 诊断 / 27 文件。[本次原始日志](../progress/default-editor-contract-audit-2026-10-26-evidence/compile-baseline-initial.log)与[来源清单](../progress/default-editor-contract-audit-2026-10-26-evidence/compile-baseline-initial.json)独立保存，不覆盖旧45/27证据。目标是同一既定全量命令 exit 0，以恢复并行开发基线；不把定向通过扩大为全仓通过。

## 修复边界

- 测试夹具与现有正式 API 对齐：必需字段/构造参数、事件合同、调用返回类型、导入层数、抽象 Disposable 具体实现。优先正式 mock/upcastPartial 工具，避免新增 any/unknown/never 双重断言逃逸。
- 控制流断言保留原行为：把跨 await 后的属性读取封装成重新求值的函数或比较完整当前值，避免早先 assert 将可变 getter 永久窄化；时间线联合只读取已绑定并按 kind 窄化的同一 summary。
- Conversation 测试在 concrete part 的 instanceof 窄化后保留 getId 精确断言，补显式 StorageTarget 与异步 findGroup；switchModel 夹具保持真实响应 `resolvedModelId`、`provider`、`level`、`cost`、`speed`，保留原竞态屏障及行为断言。
- 生产只限 Sessions 的两个可选 editor resource 在调用前窄化，以及 mobileHostFilter 的焦点元素以元素身份查找按钮索引。前者将resource捕获为局部值并继续既有缺资源回退，后者使用 `findIndex(button => button === current)` 保持跨window元素身份与原焦点循环。Sessions 仍非产品验收对象；修复其编译合同不创造产品入口。
- 补齐 workbench 的 Sessions fixture 新必需 review-state 方法；不把 fixture 当产品已验证。
- 不改 tsconfig、编译范围、诊断级别、skip策略，不删/skip/弱化现有测试；不进入 Sources/D1387 行为实现，不移动其他工位或覆盖 WIP。

## 验证与交付

1. merge 是唯一编译/typecheck/transpile/out 车道；其他 agent 当前只读。先经规则16只读审查并改入 Critical/Important，再独立提交方案，之后实施。
2. 根据真实诊断一次修齐合同，再运行同一 `npm run compile-client`，以原始退出码与日志证明全量结果；失败继续按实际诊断修复。
3. 使用新产物运行受影响测试套件，至少覆盖 Conversation split/picker/竞态、UniverseAgent cleanup、键盘、debug/files/MCP、输出/扩展初始化等变更断言。Electron-main 套件与browser套件按既有官方入口分环境执行。已有与本改动无关的运行红测完整记录，不能删测试取绿。
4. 目标 ESLint、diff-check 与文档健康检查；代码与行动层同主题提交，不 push。记录所有新发现的已有代码问题并交父 agent/Astra决策。

## 当前诊断文件

- `src/vs/platform/browserView/test/electron-main/browserSessionRemote.test.ts`
- `src/vs/platform/keyboardLayout/test/electron-main/keyboardLayoutMainService.test.ts`
- `src/vs/platform/universeAgent/test/common/respondCleanup.test.ts`
- `src/vs/platform/universeAgent/test/node/grpcClientCalls.test.ts`
- `src/vs/sessions/contrib/changes/browser/changesActions.ts`
- `src/vs/sessions/contrib/changes/browser/changesetReviewActions.ts`
- `src/vs/sessions/contrib/changes/test/browser/sessionChangesEditorInput.test.ts`
- `src/vs/sessions/contrib/chat/test/browser/newChatInput.test.ts`
- `src/vs/sessions/contrib/providers/copilotChatSessions/test/browser/branchPicker.test.ts`
- `src/vs/sessions/contrib/providers/remoteAgentHost/browser/mobileHostFilterActionViewItem.ts`
- `src/vs/sessions/contrib/providers/remoteAgentHost/test/node/manageRemoteAgentHostsCatchScanD1328.test.ts`
- `src/vs/sessions/contrib/providers/remoteAgentHost/test/node/mobileHostFilterFocusScan.test.ts`
- `src/vs/sessions/test/browser/sessionsSetUpService.test.ts`
- `src/vs/workbench/contrib/conversation/test/browser/conversationComposerPicker.test.ts`
- `src/vs/workbench/contrib/conversation/test/browser/conversationLensDisposeGate.test.ts`
- `src/vs/workbench/contrib/conversation/test/browser/conversationSessionSplit.test.ts`
- `src/vs/workbench/contrib/debug/test/browser/saveBeforeDebugStart.test.ts`
- `src/vs/workbench/contrib/files/test/browser/fileImportExportCancel.test.ts`
- `src/vs/workbench/contrib/markers/test/browser/markerViewModelQuickFix.test.ts`
- `src/vs/workbench/contrib/mcp/test/common/mcpSandboxService.test.ts`
- `src/vs/workbench/contrib/mcp/test/common/mcpTypes.test.ts`
- `src/vs/workbench/contrib/output/test/browser/outputServices.test.ts`
- `src/vs/workbench/services/extensionManagement/test/browser/extensionsManagerInitialize.test.ts`
- `src/vs/workbench/services/keybinding/test/electron-browser/nativeKeyboardLayoutService.test.ts`
- `src/vs/workbench/services/mcp/test/browser/mcpGalleryManifestService.test.ts`
- `src/vs/workbench/services/textMate/test/browser/threadedBackgroundTokenizerFactory.test.ts`
- `src/vs/workbench/test/browser/componentFixtures/sessions/changesView.fixture.ts`

## 签收

- [x] 规则16：Astra 独立只读审查 Critical 0 / Important 0，Assessment 允许独立方案提交后实施；Strengths 为初始45/27逐项一致、三生产窄类型边界真实、保留竞态/断言及禁止诊断逃逸、单车道与按环境测试可行。Minor 两项已落实到修复边界：URI局部捕获且缺失回退、焦点用元素身份findIndex而不用跨window instanceof。审查回执由父 agent 转达，本执行者没有冒称独立审查。
- [ ] 实施修复，既定全量compile-client实际exit0。
- [ ] 相关运行测试与静态检查已记录。
