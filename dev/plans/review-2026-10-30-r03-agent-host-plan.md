---
title: "十六路审查 r03：agentHost 方案"
type: plan
status: draft
phase: N/A
updated: 2026-10-30
summary: "保留 4 条：hold 4，weaken 0。"
---

# 十六路审查 r03：agentHost 方案

状态：草案。
覆盖需求：无（正文未引用需求编号）。

核对范围是发现稿里的 4 条。引用都在 `src/vs/platform/agentHost` 内，行为仍在。

| 编号 | 判定 | 严重度 |
|---|---|---|
| r03-1 | hold | 高 |
| r03-2 | hold | 高 |
| r03-3 | hold | 高 |
| r03-4 | hold | 中 |

### r03-1

问题类：`write_bash` / `write_powershell` 把含换行的文本写进已有 PTY 时，换行已被换成 `\r`，新命令在 shell 提示符上执行，且不经确认、也不经主 shell 的沙箱包装。

不变量：

- 不含 `\n` / `\r` 的 stdin（回答正在运行的程序、发送 Ctrl+C）仍不弹确认。`copilotShellTools.test.ts` 里 `shell helper tools (read/write/shutdown/list/redirect) are registered with skipPermission: true` 的意图是交互流不能为每次 `write_*` 弹权限。
- 不把「凡含换行一律拒绝」写成不变量。同文件把 `answer\n` 收成 `answer\r` 且成功定成合同，这条保持。`formatTerminalText(..., { shouldExecute: false })` 把 `\n` 换成 `\r`，不另加回车。
- shell 不在忙（`_busyShellIds` 不含该 shell，前台命令已经结束，shell 仍留在 `listShells()`）时，`args.command` 含 `\n` 或 `\r`（含中间的 `\r`，不只是结尾）则失败，不调用 `sendText`。忙时含换行仍按现有合同写入。
- 主 shell 工具仍是唯一的 `wrapCommand` 入口。`write_*` 不另造包装字符串，也不改走主工具的批准流程。

要动的符号或文件：

- `src/vs/platform/agentHost/node/copilot/copilotShellTools.ts` 的 `writeTool` handler。先按现在的方式取 `listShells()` 的最后一个 shell；没有 shell 时仍返回 `no_shell`。有 shell 且该 shell 不在 `_busyShellIds` 时，若 `args.command` 含 `\n` 或 `\r`，直接失败返回，不要调用 `terminalManager.sendText`。忙时仍走现有 `sendText(..., { shouldExecute: false })`。
- 失败文案说明空闲提示符上这条工具不提交新命令，提交新命令必须用 `bash` / `powershell`。

明确不改什么：

- 不改 `formatTerminalText`。主 shell 和哨兵命令依赖 `\n` → `\r`，以及 `shouldExecute: true` 时补回车。
- 不改 `read_*` / `list_*` / `shutdown` 的 `skipPermission: true`。
- 不改 `write_*` 的 `skipPermission: true`，也不给它加 `shell_id`。
- 不改 `ShellManager._makeReference`、`_busyShellIds` 和命令结束后 shell 仍留在 `listShells()` 的复用。

怎样本地验证：

- 保持 `src/vs/platform/agentHost/test/node/copilotShellTools.test.ts` 的 `shell helper tools (read/write/shutdown/list/redirect) are registered with skipPermission: true` 和 `primary shell tool normalizes multiline command input`。
- 在同一文件新增断言：已有 shell 且不在忙时，`write_bash` 对不含换行的文本仍 `sendText(..., { shouldExecute: false })` 并成功；对含 `\n`、以 `\r` 结尾、以及中间含 `\r`（`foo\rbar`）的文本失败，且 `terminalManager` 没有新的 write。shell 在忙时，`answer\n` 仍成功并收成 `answer\r`。无 shell 时仍是 `no_shell`。不要改掉现有 `answer\n` 成功那条。
- `scripts/test.sh --grep "shell helper tools|primary shell tool normalizes multiline|write_bash"`

### r03-2

问题类：自定义终端关闭时，shell 自动批准只看宿主配置能否算出沙箱策略，不看这次 `options.update` 有没有真正写到当前 SDK 会话。

不变量：

- 现有 `auto-approves sandboxed-by-default shell command without prompting` 保持：自定义终端关闭、沙箱 On、这次构造没有成功的 SDK 写入时，仍返回 `approve-once`。假 launcher 不下发沙箱，不能把「必须先有一次成功写入」加到这条上。
- 曾经成功写入过之后，用结构化相等比较上一份成功写入的 `sandboxConfig` 与本次 `_computeSdkSandboxConfig()`。`buildSandboxConfigForSdk` 每次返回新对象，不要用引用相等。两者结构化相等且配置表示启用时，才 `approve-once`。计算值变了且这次写入失败时，不返回 `approve-once`。不把「失败时 SDK 仍留着上一份 sandboxConfig」写成合同。
- `_prepareSdkTurn` 与回合中 `_syncPermissionModeAfterConfigChange` 里成功的 `_applyEffectiveSandboxConfig` 都更新这份记录。两处用同一份结构化比较。
- 自定义终端开启时仍只问 `TerminalSandboxEngine.isEnabled()`。`_applyEffectiveSandboxConfig` 在这条路径上继续直接返回，不向 SDK 推 `sandboxConfig`。
- `requestSandboxBypass`、文件范围 surface、已中止回合、`managedApprovalRequired` 仍不走这条自动批准。
- 回合进行中的配置变更仍用 `failOnError = true`，失败就中止回合。回合开始的 `_prepareSdkTurn` 不把沙箱更新失败升级成中止。

要动的符号或文件：

- `CopilotAgentSession._applyEffectiveSandboxConfig`：成功（RPC 未抛错且 `result.success`）后记下本次写入的 `sandboxConfig`；失败只打现有警告，不改记录。记录的初始值是空。`_prepareSdkTurn` 和回合中的同步都走这里。
- `CopilotAgentSession._isShellSandboxedByDefault`：没有成功记录时，保持现在「沙箱 On 即 `approve-once`」。已有成功记录时，与 `_computeSdkSandboxConfig()` 做结构化比较。
- `CopilotSessionLauncher._applySandboxConfig`：抛错或返回 `success !== true` 都算失败，不得打 `Applied SDK sandboxConfig`。launcher 的结果不单独决定自动批准。

明确不改什么：

- 不改 `buildSandboxConfigForSdk` 的策略形状。
- 不改自定义终端开启时 `copilotShellTools.ts` 里主 shell 的 `wrapCommand`。
- 不改 `_syncPermissionModeAfterConfigChange` 里沙箱更新失败后 `abort()` 的行为。

怎样本地验证：

- 保持 `src/vs/platform/agentHost/test/node/copilotAgentSession.test.ts` 的 `auto-approves sandboxed-by-default shell command without prompting`、`does not auto-approve a sandboxed shell command for a file-scoped surface`、`does not auto-approve a sandboxed shell command after an aborted turn`、`does not auto-approve a shell command that opted out of the sandbox`、`aborts when a live sandbox update fails`。
- 在同一文件新增断言：自定义终端关闭、沙箱 `Enabled` 为 On、此前没有成功写入时，仍 `approve-once`（与现有用例一致）。曾经成功写入过一份配置后，计算值按结构变了且这次 `options.update` 抛错或 `success: false` 时，不返回 `approve-once`。同一份配置的重复更新失败、结构化比较仍相等时，仍 `approve-once`。grep 要带上 `does not auto-approve a sandboxed shell command for a file-scoped surface` 和 `after an aborted turn`，不能只写 `sandboxed-by-default shell command`。
- `scripts/test.sh --grep "sandboxed-by-default shell command|live sandbox update fails|opted out of the sandbox"`

### r03-3

问题类：Claude `setPermissionMode` 失败时 Promise 仍成功结束，本回合继续按 SDK 上的旧权限模式跑。

不变量：

- SDK 调用抛错时，`ClaudeSdkPipeline.setPermissionMode` 向调用方 reject。`_appliedPermissionMode` 保持失败前的值。`_currentPermissionMode` 仍记下用户要的模式，以便下次 `mode !== _appliedPermissionMode` 再试。
- `ClaudeAgentSession.send` 在 `setPermissionMode` 或 `_rebindForSyncedState` reject 时，这次 `send` 的 Promise 必须拒绝，不得正常返回，也不得调用 `pipeline.send`。`ClaudeAgent._sendMessage` 只在 `await session.send` 成功之后写工作目录；下发失败时不得走到那一步。
- 走 rebind 时，`_replayCurrentConfig` 里权限模式下发失败同样让 rebind reject，`send` 不得继续。模型与 effort 的失败仍只记日志。
- 回合中配置监听在下发失败时中止当前回合。今天这段 `.catch` 接不到失败，因为 pipeline 把错误吃掉后 Promise 是成功的；传播改完之后，这里要 `abort()`，不能只打警告。
- 重叠调用仍把最后一次请求的模式留在 query 上。

要动的符号或文件：

- `ClaudeSdkPipeline.setPermissionMode`：内部 `catch` 打完警告后重新抛出。`_permissionModeUpdateChain = run.catch(...)` 只保活队列；调用方 `await` 的是抛错的那个 promise，不要被这条保活 catch 吞掉。
- `ClaudeSdkPipeline._replayCurrentConfig`：权限模式那一次 `setPermissionMode` 失败时把错误抛出 `_rebindQuery` / `rebindForRestart`。模型与 effort 的失败留在现有 `catch` 里。
- `ClaudeAgentSession.send`：`setPermissionMode` 或 `_rebindForSyncedState` reject 时，把该错误作为这次 `send` 的拒绝传出，不进入 `pipeline.send`。不要只 `return` 成成功的 Promise。
- `ClaudeAgentSession` 里 `onDidSessionConfigChange` 回调：`setInheritedPermissionMode` reject 时调用已有的 `abort()`。

明确不改什么：

- 不改 `resolveCurrentPermissionMode` / `readClaudePermissionMode`。
- 不改 `claudeCanUseTool.ts` 里禁止在 `canUseTool` 同步调用 `session.setPermissionMode` 的约定。
- 不改 `seedCurrentConfig` 把启动 Options 同时记成 current 和 applied。
- 不改模型与 effort 的 best-effort 日志。

怎样本地验证：

- 保持 `src/vs/platform/agentHost/test/node/claudeSdkPipeline.test.ts` 的 `overlapping setPermissionMode keeps the latest mode on the query`。
- 在同一文件新增断言：`Query.setPermissionMode` reject 时，`pipeline.setPermissionMode` reject，且已应用模式仍是旧值。
- 在 `src/vs/platform/agentHost/test/node/claudeAgent.test.ts` 新增断言：下发失败时 `send` 不把提示交给 SDK；回合中把模式改严且 `setPermissionMode` 失败时，当前回合被 `abort`。可对照现有 `Test 16 — live permissionMode update forwards via Query.setPermissionMode on the next sendMessage` 的成功路径。
- `scripts/test.sh --grep "overlapping setPermissionMode|setPermissionMode|live permissionMode update"`

### r03-4

问题类：工作目录本身是符号链接时，写和 shell 重定向只拿未解析的工作目录字符串做包含判断，真实路径对不上，目录内写入不能自动批准；读路径会同时用工作目录的真实路径。

不变量：

- 每个写候选（字面路径和 realpath）都要通过 `assertPathIsSafe`、平台限制目录和编辑 glob。
- 包含判断与读路径对齐：工作目录先走 `_resolveResourcesForApproval`，每个候选只要落在该根的字面路径或真实路径之一下面即可。
- 链到工作目录外的符号链接、从一个根链到另一个根、realpath 得到 `EPERM` / `EACCES`、动态重定向（`$HOME`、命令替换等）仍不自动批准。
- `isAutoApproveRuleResolvable` 继续忽略符号链接解析，仍用现在的单个未解析工作目录调用 `_checkWriteResource`。

要动的符号或文件：

- `SessionPermissionManager._isEditAutoApproved` 和 `_isShellWriteDestApproved`。对每个工作目录解析出字面路径加真实路径，再做包含判断。不要只把文件真实路径塞进 `resourcesToCheck` 却仍要求它落在未解析的工作目录字符串下。
- 包含判断可以抽成与 `_isReadContainedByRoot` 相同的「候选 ⊆ 根的任一解析路径」。平台限制和 glob 仍对每个候选调用，不要为了复用去改 `_checkWriteResource` 的单目录签名。

明确不改什么：

- 不改 `_isReadAutoApproved` / `_isReadContainedByRoot`。
- 不改 `isAutoApproveRuleResolvable` 及其注释里的「规则可解析性忽略符号链接」。
- 不改 `_resolveShellRedirectResource` 对动态重定向返回 `undefined` 的行为。
- 不改 `_isPlatformRestrictedResource` 和编辑 glob。

怎样本地验证：

- 保持 `src/vs/platform/agentHost/test/node/sessionPermissions.test.ts` 的 `auto-approves a normal file inside the working directory`、`requires confirmation for writes outside the working directory`、`requires confirmation when a symlink redirects outside the working directory`、`auto-approves when a symlink stays inside the working directory`、`requires confirmation when a shell redirect targets a symlink outside the working directory`、`auto-approves shell redirects through symlinks that stay inside the working directory`、`auto-approves reads when the working directory is itself symlinked`、`requires confirmation when only the real read path is inside the working directory`、`requires confirmation for a symlink that crosses from one root into another (fail-closed)`。
- 在同一文件新增断言：工作目录是指向真实目录的符号链接时，对该链接路径下文件的写入返回 `ToolCallConfirmationReason.NotNeeded`；shell 重定向到该目录内的相对路径同样自动批准；链接指向目录外时写和重定向仍不自动批准。
- `scripts/test.sh --grep "working directory is itself symlinked|symlink redirects outside|crosses from one root"`。新断言要含 realpath 返回 `EPERM` 或 `EACCES` 的写路径，现有拒绝解析的用例只覆盖读。

## 审查

2026-10-30 只读审查的结论是须改稿。Critical 已改：r03-1 不再拒绝一切换行。`answer\n` → `answer\r` 且成功的现有测试保持；拒绝范围收成空闲 shell 上的 `\n` 或 `\r`，含中间的 `\r`。r03-2 不再要求「没有成功写入就不得自动批准」，那条和现有 `auto-approves sandboxed-by-default` 相反。已有成功记录之后才做结构化比较，两处成功写入都更新记录。r03-3 的 `send` 在下发失败时必须拒绝这次 Promise。
