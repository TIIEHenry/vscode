---
title: "审查 r08：conversation"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "列表刷新把无租约会话的缓存对话写成空并丢掉 workDir；断线缓存丢掉提问/错误行和 agentId；可见名单变窄时会删掉仍有效的 composer 草稿。"
---
# 审查 r08：conversation

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r08-1 高
- 症状：引擎 `listSessions` 成功后，当前没有视图租约的会话，断线缓存里的历史被写成空数组。重启或断线后再打开，这些会话的用户/助手消息不再出现。
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts` 第 1875–1897 行
- 引用：`turns: []` 后立刻 `this.persistEngineAwareRoster()`。落盘时无租约则 `const turns = projection ? … : session.turns`（第 2059–2063 行）。`getCachedProjection` 只在租约仍被持有时返回副本。
- 为什么是问题：刷新用新对象替换 `engineSessions`，已通过 `rememberObservedProjection` 抄到旧行上的 turns 被丢掉。随后 `buildPersistedEngineCache` 把空 turns 写入当前引擎桶。进程被杀掉或断线时，`captureEngineCache` 再把这份空数组收进模型，离线时间线只剩空会话。
- 方向：按 session id 合并已记住的 turns，没有租约时保留上一份缓存，不要用空数组覆盖。

## r08-2 中
- 症状：同一次落盘把会话工作目录从缓存里拿掉。冷启动或切回该引擎桶后，会话药丸、时间线链接和审查入口不再带这个目录。
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationEngineRosterService.ts` 第 2059–2069 行
- 引用：持久化对象只有 `id`、`title`、`turns`、`source`。列表结果里的 `workDir` 写在内存行上（第 1882 行），`captureEngineCache` 会保留它（第 1992–2000 行），这条路径不会。
- 为什么是问题：`persistEngineAwareRoster()` 在列表刷新、切换会话和删除回滚时都走 `buildPersistedEngineCache`。存储里的 `workDir` 被抹掉后，`restoreEngineCacheFromStorage` 读不回来。审查导航在会话目录为空时改用连接上的工作目录，可能打开另一份工作区的变更。
- 方向：`buildPersistedEngineCache` 与 `captureEngineCache` 一样写出非空 `workDir`。

## r08-3 中
- 症状：有租约、turns 没被清空的会话，断线或下次启动后提问、错误、未知、系统行消失，子代理身份也不见了。
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationSessionView.ts` 第 1293–1324 行
- 引用：`isStubTurnKind` 只留 user、assistant、confirmation、thinking、tool、visualization；`turns.push` 不拷贝 `agentId`。`stubTurnsToSnapshot` 的 default 分支直接丢掉 question / error / unknown / system（第 259–262 行）。
- 为什么是问题：引擎缓存经 `projectSnapshotToLegacyTurns` 走 `entriesToLegacyTurns`。断线后时间线租约回到 stub frame source，再用这些 turns 做 `stubTurnsToSnapshot`。活投影里还在的提问、错误和 `agentId` 进不了离线阅读列。
- 方向：断线缓存保存并投影完整时间线条目，包含 honest kind 和 `agentId`。

## r08-4 高
- 症状：未发送的 composer 草稿在引擎身份切换或列表变成空/绑定失败时从工作区存储里消失，切回原会话也找不回。
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationLensComposer.ts` 第 510–519 行
- 引用：`liveIds = host.stubService.getSessions().map(session => session.id)`，然后 `pruneUaClientComposerDrafts`。调用点是每次 `onDidChangeSession`（`conversationLens.ts` 第 329–330 行）。存储删除在 `uaClientComposerDrafts.ts` 第 86–98 行。
- 为什么是问题：`getSessions()` 在已连接或曾连接时只返回当前 `engineSessions`。`adoptSnapshotEngineIdentity` 先把数组清空、只恢复当前桶，再 `onDidChangeSession`（第 1941–1949 行）。其它引擎桶里的会话仍在 `engineCaches`，草稿键却被当成孤儿删掉。列表失败后若只剩绑定失败占位会话，连接前写下的草稿同样被删。
- 方向：只在会话确认删除后清它的草稿；换引擎桶或列表失败时保留不在当前可见名单里的草稿。
