---
title: "当前编译合同基线验证"
type: progress
status: completed
phase: M7
updated: 2026-10-26
summary: "真实全量compile-client45→3→0；27文件正式合同修复，Electron325过3既有红、Node10过，Astra源码审查C0/I0。"
---

# 当前编译合同基线验证

方案独立提交 `33922f0a6dc`，实施仅修27份清单内源码/夹具。没有改编译配置/范围、诊断级别、Sources实现或删除/skip测试。三生产改动仅捕获可选editor URI后窄化、缺失继续原回退，以及焦点按钮按元素身份findIndex；其余为正式API/类型/fixture合同。主工位和其他worktree未动，未push。

## 编译与源产物

| 次序 | 原始结果 | 证据 |
| --- | --- | --- |
| c968初始 | exit1、45诊断/27文件 | [原日志](compile-baseline-initial.log)、[文件清单](compile-baseline-initial.json) |
| 第一轮修复 | exit1、3诊断 | [原日志](compile-baseline-repair-1.log)；native-keymap namespace缺合成default及误移MCP事件类型import |
| 第二轮修复 | exit0、src/tsconfig 0 errors、gulp compile实际完成 | [全量green](compile-baseline-green.log) |

全部通过同一个 `rtk proxy npm run compile-client` 顺序执行，只有merge一条编译车道；这是compile-client结果，不冒称另一个npm run compile/copy构建或所有产品验收全绿。[最终来源清单](compile-baseline-final-identity.json)绑定staged src树、27份source/out SHA256/bytes/mtime与日志；最终实施commit的src子树须精确相等，后续仅文档不改变本次green源码。

## 测试、已有红与静态检查

- 官方Electron/Xvfb、隔离自动profile，20份受影响suite：**325 passing / 3 failing**、exit1，见[命令](compile-baseline-electron-command.json)与[完整日志](compile-baseline-electron.log)。BrowserSessionRemote、KeyboardLayoutMainService、SessionChangesEditorInput、NewChatInput、BranchPicker、SessionsSetUp、Conversation picker/split、四模型竞态、debug/files/markers/MCP/output/extensions/keyboard/TextMate本次合同对应断言均通过。
- 三红全部在未改断言：`pairing-hold same-session KEEP connection change paints getSessionSync closed chrome not Session live`（源码字符串pin仍期待旧拼写）；`connected live SessionBar handlers still write when engine session is ready`（期待draft而收到undefined）；`showPostFailure failed uses retry copy not disconnected`（fake classList缺toggle）。精确c968旧测试独立esbuild ESM/es2024/experimentalDecorators/useDefineForClassFields:false转译，配合同一未改生产，官方Electron定向实际复现**0 passing / 3 failing**；[旧红日志](compile-baseline-existing-red.log)、[旧测试/未改生产身份](compile-baseline-existing-red-identity.json)。结束后恢复本轮compile的测试JS，前后SHA精确相同。未将原红断言改成绿；留在D17后续主题。
- Node官方入口三份分别 **5 / 2 / 3 passing**（含各自清理检查）、exit0，日志为 [gRPC](compile-baseline-node-grpcClientCalls.test.log)、[remote-host catch](compile-baseline-node-manageRemoteAgentHostsCatchScanD1328.test.log)、[focus scan](compile-baseline-node-mobileHostFilterFocusScan.test.log)。
- 27文件 ESLint **0 errors / 20 warnings**、exit0，见[原日志](compile-baseline-eslint.log)。保留既有warning，不写全测全lint无诊断。

## 独立只读审查

Astra通过父agent转达方案与27文件实施两次只读审查，均 **Critical0 / Important0**。方案Strengths：原45/27逐项一致、三生产窄类型范围明确、竞态与行为断言完整、禁止宽type/skip/config逃逸、单车道/按环境测试可行；Minor URI局部捕获/元素身份findIndex已落实现。实施Strengths：生产原回退及焦点行为保持、精确断言/竞态/拒绝重试完整、Changes真实行fixture与Output标准spy合理。实施Minor两条文案事实在accepted前已修：正式switchModel响应是provider/level/cost/speed，part通过instanceof具体类后保留getId断言；不存在resolvedModelName或正式part.id契约变更。

本轮只完成编译合同范围，不升PRD、不关闭D17、不把Sources/D1387计为实现。后续D1387源码与非作者after由父agent单独接入。
