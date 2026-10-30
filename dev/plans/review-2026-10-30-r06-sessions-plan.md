---
title: "十六路审查 r06：sessions 方案"
type: plan
status: draft
phase: N/A
updated: 2026-10-30
summary: "hold 2，weaken 1，drop 0。"
---

# 十六路审查 r06：sessions 方案
状态：草案。
覆盖需求：无（正文未引用需求编号）。


| 编号 | 判定 | 严重度 |
|:-----|:-----|:-------|
| r06-1 | hold | 高 |
| r06-2 | hold | 中 |
| r06-3 | weaken | 中（原高） |

### r06-1

问题类：同一次防抖合并里后到的 `added` 仍带着先前的 `removed`，视图把这次列表波动当成删除，清掉本窗口记住的聊天选择、关闭的聊天和最近记录，并拆掉格子槽位。

不变量：同一会话在合并结果里仍有 `added` 时，不得再出现在 `removed`，也不清当前聊天、关闭的聊天、格子位置和最近记录。只出现在 `removed` 的 id 仍按离开处理：清这些视图状态和最近记录，并拆活格子。host 的 `sessionRemoved` 和换 id 的 replace 都只发 `removed`，不发 `onDidDeleteSession`。不要收成「视图状态只在 `onDidDeleteSession` 上删」。那样这两条路径会拆掉格子，却把当前聊天、关闭聊天和最近记录留在工作区存储里。分组从属和列表置顶仍只在 `onDidDeleteSession` 上丢弃。

要动的符号或文件：

- `mergeSessionChangeEvents`（`src/vs/sessions/contrib/providers/agentHost/browser/baseAgentHostSessionsProvider.ts`）。后到的 `added` 今天写成 `{ removed: 先前的 removed, added }`，输出循环对两者都 `push`。同一 `sessionId` 最终仍有 `added` 时，丢掉 `removed`。`removed` 晚于 `added` 时保持只留 `removed`（现有 `removed` 分支会整项替换，这条不用放开）。
- `SessionsService._onDidChangeSessions`。今天对每个 `e.removed` 执行 `_sessionStates.delete` 和 `_visibility.removeMany`，不看 `e.added`。同一 id 也在 `added` 里时跳过这两步。只在 `removed` 里的 id 仍删除 `_sessionStates` 并 `removeMany`。不要把删除改到只剩构造函数里的 `onDidDeleteSession`。
- `SessionsNavigation.onDidRemoveSessions`。同一 id 也在 `added` 里时不删最近记录。只在 `removed` 里的 id 仍调用 `SessionsRecencyHistory.remove`。构造函数里对 `onDidDeleteSession` 的 `_recencyHistory.remove` 保留，它不覆盖 `sessionRemoved` 这条路径。

明确不改什么：

- `SessionGroupsService`、`SessionsListModelService` 已有的「列表消失不等于删除」。
- `_refreshSessions` 里「其它 agent 已应答则不驱逐完全没出现的命名空间」以及 `listSessions` 失败不驱逐。
- 只出现在 `removed` 时拆活格子槽位、并在活动会话被拆掉后走现有 fallback。

怎样本地验证：

- `sessionNavigation.test.ts` 的 `removed sessions are cleaned from history` 直接调用 `nav.onDidRemoveSessions`，桩的 `onDidDeleteSession` 是 `Event.None`，不构造 `SessionsService`。不要用它证明服务层监听。同一 id 同时在 `added` 和 `removed` 时历史还在，这条新断言放到已经 `createInstance(SessionsService)` 的 `sessionsManagementService.test.ts`。
- 新增断言：防抖窗口内先 `SessionRemoved` 再 `SessionAdded`（同一 id），对外 `onDidChangeSessions` 里该 id 只在 `added`。落点是 `localAgentHostSessionsProvider.test.ts`。
- 新增断言：`SessionsService` 收到同一 id 同时在 `added` 和 `removed` 时，当前聊天和关闭聊天还在，格子不拆。只含 `removed` 时，视图状态和最近记录被清，格子槽位被拆掉。不要写成「仅 `removed` 之后状态还在，要等 `onDidDeleteSession`」。
- 对照保持不动：`sessionGroupsService.test.ts` 的 `an ungrouped preference survives temporary provider eviction`，`sessionsListModelService.test.ts` 的 `sort overrides survive temporary provider eviction`。
- 本地跑上述浏览器单测（`scripts/test.sh` 或 `scripts/run-unit-custom.sh`，范围限这些文件）。

### r06-2

问题类：`disposeSession` 已经成功，但 `SessionRemoved` 抢先摘掉缓存后，`deleteSessions` 不把该 id 算进返回值，管理服务抛出删除失败，分组从属和置顶收不到 `onDidDeleteSession`。

不变量：`disposeSession` 的 promise 成功结束后，该 id 就算已删除，哪怕缓存已被通知提前摘掉。通知路径已经发过一次 `removed` 时，删除路径不再发第二次。`disposeSession` 抛错的会话仍留在缓存里，id 不进返回值。管理服务看到返回值里没有该 id 时继续抛「Failed to delete the session」，分组和置顶仍只在 `onDidDeleteSession` 上删除。

要动的符号或文件：

- `BaseAgentHostSessionsProvider.deleteSessions` 与 `_removeCachedSession`（同文件约 4341–4376、5813–5831）。`_removeCachedSession` 在缓存已被 `_handleSessionRemoved` 清掉时，用 `expected` 做清理，但 `return cached`，于是返回 `undefined`。`deleteSessions` 只在返回值非空时 `removedIds.push(sessionId)`。`await connection.disposeSession` 成功之后，无论缓存是否还在，都把该 `sessionId` 放进 `removedIds`。只有这次调用自己从 `_sessionCache` 摘下来的适配器才放进 `removed` 并 `fire`。
- 时序依据：测试桩在 `disposeSession` 返回前同步调用 `onDisposeSession`；host 侧 `deleteSession` 在 `disposeSession` 的 RPC 返回前发出 `SessionRemoved`。`_handleSessionRemoved` → `_removeCachedSession(rawId)` 会在 `deleteSessions` 的 await 恢复前跑完。

明确不改什么：

- `SessionsManagementService.deleteSession` / `deleteSessions` 对缺 id 抛错、以及只对返回 id 发 `onDidDeleteSession`。
- 现有「host 也通知时只发一次 removed」的去重。
- 失败会话仍留在缓存：`deleteSessions retains failing session in cache without disposing or clearing PR cache`，以及 `deleteSessions publishes successful removals before propagating a later failure`。

怎样本地验证：

- 扩展 `localAgentHostSessionsProvider.test.ts` 的 `deleteSession does not remove a session twice when the host also notifies`：`onDisposeSession` 里同步 `fireSessionRemoved` 之后，`deleteSessions` 的返回值仍包含该 `sessionId`，`onDidChangeSessions` 的 removed 事件仍是 1 次，会话不在 `getSessions()` 里。
- `sessionsManagementService.test.ts` 里对 `/Failed to delete the session/` 的拒绝断言保持：provider 返回的 id 列表不含该会话时仍抛错、不发 `onDidDeleteSession`。
- 本地跑上述两个浏览器单测文件。

### r06-3

问题类：会话配置的乐观写入在 host 拒绝后不回滚，随后的 resolve 又用这份被拒绝的值写回缓存，选择器读到的是新值。

不变量：不按拒绝回执把整份 values 盖回派发前快照。`IAgentConnection.dispatch` 返回 `void`。序号在协议客户端内部生成，不交给调用方。拒绝回执只有 `origin.clientSeq`，重叠的 set 与 replace 对不上某一份快照。整份回滚还会冲掉已经合并进缓存的其它回写。可达的改法是 `replaceSessionConfig` 派发时去掉 `AgentMergeController`，让宿主接受其余键。拒绝分支和 `_resolveRunningSessionConfig` 保持现状。记忆值是否在拒绝时撤回仍未定，本条不改那份存储。单键 `autoApprove` 不触发宿主对 `AgentMergeController` 的整单拒绝。

要动的符号或文件：

- `replaceSessionConfig`。组 `SessionConfigChanged` 的 values 时省略 `AgentMergeController`。宿主只在 forbidden 为空时保留自己写的键并接受其余键。含这一键的整单拒绝会把客户端其它键一起留在被拒绝的乐观值上。
- 不改 `_attachConnectionListeners` 里 `rejectionReason` 的早退。不改 `_resolveRunningSessionConfig`。不在客户端发明把回执配到某一次 `dispatch` 的序号。

明确不改什么：

- 审批级别写入被 host 接受时的乐观更新和随后 resolve。会话状态已在内存且派发队列里没有在途动作时，`setSessionConfigValue` 只派发 `{ autoApprove: normalizedValue }`。队列里已有在途动作时，这条仍会排队。
- 拒绝分支的整份回滚，以及 `STORAGE_KEY_REMEMBERED_SESSION_CONFIG_VALUES` 的撤回。`isRememberedSessionConfigKey` 还排除 `UNSAFE_SESSION_CONFIG_KEYS`，不只是 `Branch`。
- `_applySessionStateUpdate` → `_seedRunningConfigFromState`：后续 `SessionState` 快照仍用 host 的 `config.values` 覆盖缓存。
- `a rejected SessionIsArchivedChanged leaves the session unarchived` 的行为。
- `dev/plans/review-2026-10-11-r06-sessions-plan.md` 已写明：在有关联机制之前，不改拒绝分支和 `_resolveRunningSessionConfig`。本条沿用这个边界。

反证与降级：

- 稳态的审批选择器不会因为「用户把自动批准收紧」就被 host 拒绝。专用拒绝条件是 payload 含 `AgentMergeController`。`setSessionConfigValue` 的单键 `autoApprove` 不满足它。发现稿把「收紧权限后面界面已收紧、host 仍按更高权限执行」写成这条路径的直接症状，覆盖面大于活码。
- 拒绝也不是把选择器永远钉死。`_runningSessionConfigResolveSeq` 一旦有过该会话，下一次带 `state.config` 的快照会在 `_seedRunningConfigFromState` 里用 host 值覆盖 schema 里已有的键。拒绝本身不产生新快照，所以在下一次快照之前选择器仍是新值；若 resolve 在这次纠正之后完成，又会把客户端传入的新 values 写回去。
- 仍会踩中的路径：`replaceSessionConfig` 会把运行中配置里的 `AgentMergeController` 放进 replace payload，host 整单拒绝，乐观替换（含审批级别）留在缓存里；以及会话状态还不在内存、动作进了异步队列且 prelude 抛错时的 `rejectClientAction`。

降级后的严重度：中。

怎样本地验证：

- 在 `localAgentHostSessionsProvider.test.ts` 新增断言：`replaceSessionConfig` 的运行中配置含 `AgentMergeController` 时，派发出去的 values 不含该键，其余键仍被派发，host 不因这一键整单拒绝。
- 不再新增「拒绝回执后 `autoApprove` 回到旧值」或「整份 values 与派发前一致」。这两条依赖还不存在的回执关联。
- 保持 `server-echoed SessionConfigChanged merges config values into the running cache by default` 和现有「运行中会话写入会派发 `SessionConfigChanged`」的成功路径断言。
- 本地跑 `localAgentHostSessionsProvider.test.ts` 里这几条。

## 审查

2026-10-30 只读审查的结论是须改稿。Critical 已改：r06-3 不再按拒绝回执回滚整份快照。`dispatch` 不返回序号，重叠写入对不上派发前的值。本条只从 `replaceSessionConfig` 的 payload 去掉 `AgentMergeController`，拒绝分支和记忆撤回保持不动，与 `review-2026-10-11-r06-sessions-plan.md` 一致。Important 已改：r06-1 只在同一 id 同时出现在 `added` 和 `removed` 时跳过清理。只出现在 `removed` 的 `sessionRemoved` 和换 id 仍清视图状态和最近记录。
