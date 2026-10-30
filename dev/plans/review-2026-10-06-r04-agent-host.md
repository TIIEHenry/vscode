---
title: "审查 r04：agent-host"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "shell 重定向不解析符号链接就会自动放行；Claude 权限/effort 回放与 Codex 截断会留下错误的会话状态。"
---
# 审查 r04：agent-host

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r04-1 高
- 症状：工作区内的符号链接被当成目录内文件，带重定向的 shell 命令无需确认就自动放行，实际写入落到链接目标。
- 位置：`src/vs/platform/agentHost/node/sessionPermissions.ts` 第 549–560 行
- 引用：`this path is synchronous and does not resolve symlinks`；`return (workingDirectories ?? []).some(workingDirectory => this._checkWriteResource(resource, workingDirectory))`
- 为什么是问题：`_resolveShellRedirectResource` 只做 `path.resolve`，随后 `_checkWriteResource` 只看字面路径是否落在某个工作目录里。`date > ./link` 这类命中默认允许规则的命令因此被批准；shell 执行时跟随符号链接，可写到工作区外。终端自动批准的配置默认是 `true`（`src/vs/platform/agentHost/common/agentHostSchema.ts` 第 760–764 行），且 `sessionPermissions.ts` 第 335 行只有显式 `=== false` 才跳过这套规则。
- 方向：重定向目标要像读/写工具一样先解析真实路径，解析失败就要求确认。

## r04-2 中
- 症状：连续切换 Claude 权限模式时，较慢的旧请求后返回，会话仍停在用户已经换掉的模式上。
- 位置：`src/vs/platform/agentHost/node/claude/claudeSdkPipeline.ts` 第 520–525 行
- 引用：`await this._query.setPermissionMode(mode); this._appliedPermissionMode = mode;`
- 为什么是问题：配置监听（`src/vs/platform/agentHost/node/claude/claudeAgentSession.ts` 第 684–692 行）每次变更都直接调用、不等上一次结束。后发起的模式先完成之后，先发起的 `await` 仍会把旧模式写进 SDK 和 `_appliedPermissionMode`，而 `_currentPermissionMode` 已是新值。更严的选择若被更宽的旧请求盖掉，后续工具会按已放弃的模式执行。同文件 `setModel`（第 369–372 行）在写回前核对了当前值。
- 方向：`await` 之后只在模式仍是本次请求的值时写 `_appliedPermissionMode`，并串行化权限更新。

## r04-3 中
- 症状：切到不支持 reasoning effort 的模型并重绑后，旧 effort 仍留在新会话上，下一轮请求会 400。
- 位置：`src/vs/platform/agentHost/node/claude/claudeSdkPipeline.ts` 第 580–582 行
- 引用：`if (this._currentEffort !== undefined && this._currentEffort !== this._appliedEffort)`
- 为什么是问题：`setEffort(undefined)` 的注释写明必须 `applyFlagSettings({ effortLevel: null })`，否则上一个模型的 `'high'` 会被重放到不支持 effort 的模型上。重绑却把 `_appliedEffort` 清空后交给 `_replayCurrentConfig`（第 640–648 行），而这里在 `_currentEffort === undefined` 时直接跳过，清除不会发出。
- 方向：重放时对 `undefined` 同样下发 `effortLevel: null`。

## r04-4 中
- 症状：在同一条 Codex turn 拆出的较早一条用户消息上截断，后面同 turn 的消息会在恢复时重新出现。
- 位置：`src/vs/platform/agentHost/node/codex/codexAgent.ts` 第 6003–6009 行
- 引用：`const codexTurnId = resolveCodexTurnIdFromHostTurnId(turnId, ...); numTurns = turns.length - (index + 1);`
- 为什么是问题：回放把一条 Codex turn 里的第二条及以后用户消息拆成独立 host turn（`codexReplayMapper.ts` 第 172–176 行）。`resolveCodexTurnIdFromHostTurnId` 把这种 id 折回整条父 turn（`codexReplayTurnIds.ts` 第 43–45 行）。截断只按父 turn 计算尾部条数，父 turn 内部更晚的分段不会被 `thread/rollback` 去掉；宿主状态已经按 `ChatTruncated` 删掉这些消息，下次按线程回放又会把它们显示出来。
- 方向：截断点落在拆分分段时，按该分段而不是整条父 turn 计算要丢掉的内容，无法表达就拒绝截断。

## r04-5 中
- 症状：Codex 回滚失败时界面上的历史已经删掉，线程里的原消息还在，重新打开后会回来。
- 位置：`src/vs/platform/agentHost/node/codex/codexAgent.ts` 第 6014–6021 行
- 引用：`await conn.client.request('thread/rollback', ...); } catch (err) { this._logService.warn(...); }`
- 为什么是问题：`ChatTruncated` 的副作用在调用 `truncateChat` 之前，会话状态已经截断（`agentSideEffects.ts` 第 1513–1529 行）。这里捕获 `thread/rollback` 失败后只打日志并正常返回，调用方看不到失败。宿主记录与 Codex 线程分叉，下一次 `thread/read` 回放会把用户刚删掉的回合装回来。
- 方向：回滚失败时向外抛出，让宿主保留或恢复截断前的会话状态。
