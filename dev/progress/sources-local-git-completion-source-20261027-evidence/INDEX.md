---
title: "Sources local Git：完成归属源码候选静态原件"
type: reference
status: active
phase: M7
updated: 2026-10-27
summary: "固定7e2e后仅两host runGitAction与两既有test独立suite的作者AST/no-cache lint及保护元数据；114仅静态展开，旧red/新green与真实组件资格未达。"
---

# Sources local Git：源码候选静态原件

输入为 clean `7e2ee718e682721e61d5ef4fb1c5f6ccd9f082b9`（parent source tree `90d6092dbbca80114db7f55a75e137bb1d7bef76`）；root 在固定 accepted 文档核验后另行授权作者只改四 TS 与必要主题文档。本页只记录作者静态检查，完整合同见[方案 §7](../../plans/sources-local-git-completion-ownership.md#7-d-最小源码候选与作者静态边界2026-10-27)。

| 原件 | 含义 |
| --- | --- |
| [commands.json](commands.json) | 实际 AST / ESLint 命令、exit code、NODE_DISABLE_COMPILE_CACHE=1 与资格 flags；不是运行 lane 工具。 |
| [ast-only.json](ast-only.json) | 四路径实际 createSourceFile-only stdout：各 parseDiagnostics 空；没有 Program、checker、transpile 或 emit。 |
| [eslint-no-cache.json](eslint-no-cache.json) | 四路径实际 --no-cache / 不fix 的原始 stdout 字段（含原末尾空行）：0 errors、1 warning，原 Panel test :637 的 in-operator 警告保持。 |
| [source-scope.json](source-scope.json) | 四 TS 精确父/候选 bytes/hash；两生产在 runGitAction 外逐字相同，两test移除新增suite/必要imports即可完整还原父文件，保护旧72/全部旧helpers/assertions。 |
| [metadata-before.json](metadata-before.json) | 开始前实际只读 guard 的结构化快照；记录 clean 父、旧分支及 out/.build/node_modules/72.node lstat 摘要。 |
| [metadata-after-checks.json](metadata-after-checks.json) | AST/lint 后实际 guard stdout；完整 metadata 与开始前精确相等，只列四 TS 未暂存，随后仅同步主题文档。 |

新 suite 每文件8个 test 模板；按源码常量循环静态展开 Pane60 / Panel54，共114。R1/R2/R3 分别覆盖 clean/unstage 两入口；R4/R5 对三 local 动作覆盖 replace/clear/同对象恢复/dispose，Pane另有 input.dispose；P1 当前完成，P2 反序与真实 local Stage 交错，P3 session/connection/readiness/pairing/read-failed。该计数只描述源码结构，**不是实际注册、启动、通过或运行验收数**。

候选使用真实 widget/model/resolver 与完整 progress 依赖，公共 DI、CommandsRegistry Deferred、实际可见可用 DOM 按钮和公共 lifecycle；当前均未运行。R5 代码包含实际 DOM对象/同值写/转发先行校准与 finally descriptor 恢复，安装、捕获或清理失败必须算资格未达；尚无校准成功、反馈写0、R3 collapse 或旧业务red/新green的运行证据。

当前不执行 compile/typecheck/transpile/emit/tests/runtime/UI/engine/after，不准备运行工具，不改任何旧证据或 lease 工具。当前旧native54fe、Sources4原不匹配保持，D元数据连续性不给pre-localGit producer credit。匹配依赖/组件临时产物协议与唯一lane验证仍另审/另释；lease运行最高优先、独立after仍必需。固定候选commit先交root核，再原Astra源码peer。
