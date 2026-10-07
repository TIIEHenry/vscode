---
title: "方案 r05：universe-agent"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 5，drop 0，weaken 0。五条发现的行为仍在引用处，方案只写改法。"
---

hold 5，drop 0，weaken 0

## r05-1

问题类：Hub 刷新令牌在加密等待期间，或新令牌无法落盘时，磁盘上会留下上一份密钥。

不变量：同一 Hub 的磁盘 refresh 密钥只反映最后一次代际仍有效的 `applyAuthSession`。代际已变则放弃这次写入。新会话带了 `refreshToken` 但无法加密落盘时，删掉该 Hub 的旧密钥。内存桶仍写成这次会话。下次启动仍由 `restorePersistedHubSessionIfNeeded` 按磁盘上还在的密钥调用 `refreshIfNeeded`。

要动的符号或文件：

- `HubSessionStore.applyAuthSession`（`src/vs/platform/universeAgent/node/hubSessionStore.ts` 262–296 行）
- `InMemoryHubSessionStore.applyAuthSession`（同文件 451–477 行）里「有 `refreshToken` 且加密不可用」的分支，与磁盘实现用同一条删除规则

改法：

1. `bumpSessionGeneration` 之后立刻记下代际。
2. `refreshToken` 为空时，仍同步 `remove` 密钥。
3. `refreshToken` 非空时，`await isEncryptionAvailable()` 返回后先比对代际。代际已变则不 `remove`、不 `store`。
4. 加密不可用且代际未变：`remove` 该 Hub 的 refresh 密钥。内存桶保持这次写入。
5. 加密可用：`await encrypt` 之后再比对代际。代际未变才 `store`。代际已变则不写入。
6. `InMemoryHubSessionStore` 的 `applyAuthSession` 没有 `encrypt` 的 await。有新 `refreshToken` 且 `encryptionAvailable` 为 false 时，删除 `refreshSecrets` 里的旧项。

明确不改什么：

- `doRefreshIfNeeded` 在 HTTP 返回后、调用 `applyAuthSession` 之前的代际比较（磁盘实现 361–379 行，内存实现 526–537 行）
- `refreshFlights` 单飞
- `clear` 先删内存桶、再 `remove` 密钥、再 `bumpSessionGeneration`
- 无 `refreshToken` 时删密钥并保留新内存会话

怎样本地验证：

- 保持 `in-flight refresh does not apply after clear (logout)`、`HubSessionStore clear removes persisted refresh secret`、`HubSessionStore drops and rewrites the encrypted secret with the memory session`、`HubSessionStore encrypts refresh token to APPLICATION/MACHINE storage`
- 新增断言：`HubSessionStore` 已有加密密钥，加密服务推迟 `encrypt`；等待期间调用 `clear` 或另一次 `applyAuthSession`；先发起的那次加密不得把旧 payload 写回 `universeAgent.secret.hubRefresh.*`
- 新增断言：已有密钥时，`applyAuthSession` 带新 `refreshToken` 且加密不可用，旧密钥被删除，`getAccessTokenForHub` 仍是新会话。现有 `HubSessionStore does not persist refresh when encryption unavailable` 从空存储起步，覆盖不到旧密钥残留

## r05-2

问题类：空存储上并发的 `getOrCreateIdentity` 会各造一把密钥，磁盘只留下后写入的那把。

不变量：同一次进程里，重叠的 `getOrCreateIdentity` 得到同一份已落盘材料。磁盘 `universeAgent.secret.deviceIdentity` 与返回值的私钥是一对。

要动的符号或文件：

- `ClientIdentityStore.getOrCreateIdentity`、`persistIdentity`（`src/vs/platform/universeAgent/node/clientIdentityStore.ts` 105–157 行）

改法：

1. 在任何 `await` 之前，把「没有则创建并写完」放进同一个 in-flight Promise。后到的调用等待这一份。
2. 飞行内部：加密不可用则返回 `encryption_unavailable`。`loadIdentity` 已有身份则返回它。
3. 否则 `mintClientIdentityMaterial`。`encrypt` 之后、`store` 之前再 `loadIdentity` 一次。此时已有身份则沿用它，不覆盖 `store`，也不把本把密钥写入 `cachedIdentity`。
4. 没有已有身份才 `store`，然后把 `cachedIdentity` 设为刚写入的那把，并返回它。

明确不改什么：

- `getState` 在没有身份时只 mint、不落盘
- `InMemoryClientIdentityStore`：检查与赋值之间没有 await
- `createSigner` 仍只调用 `getOrCreateIdentity`

怎样本地验证：

- 保持 `ClientIdentityStore persists encrypted identity to APPLICATION/MACHINE storage`、`ClientIdentityStore does not persist identity when encryption unavailable`
- 新增断言：`encrypt` 推迟完成时，两次重叠的 `ClientIdentityStore.getOrCreateIdentity` 返回同一个 `clientIdentityId`，解密后的 `universeAgent.secret.deviceIdentity` 与该返回值的私钥一致

## r05-3

问题类：插件根路径拼进钩子命令后，`$()`、反引号和 `$VAR` 仍会被执行该命令的 shell 展开。

不变量：`shellQuotePluginRootInCommand` 把插件根路径收成执行该钩子的 shell 的字面量。路径里的 `$`、反引号和引号不触发展开，也不提前结束引号。token 不在命令里时原样返回。后缀仍只吃 `[\w./\\~:-]*`，紧邻的 shell 运算符留在路径外面。

要动的符号或文件：

- `shellUnsafeChars`、`shellQuotePluginRootInCommand`（`src/vs/platform/agentPlugins/common/pluginParsers.ts` 522–549 行）
- `interpolateHookPluginRoot` 的 `mutateHookCommand`（同文件 832–836 行）

改法：

1. `shellQuotePluginRootInCommand` 增加 shell 参数，取值为 sh 或 cmd。函数不读 `process.platform`。
2. 调用点按字段传入 shell。`linux` 与 `osx` 用 sh。`windows` 用 cmd。`command` 与 `executeHookCommand` 的选择一致：当前进程是 Windows 时用 cmd，否则用 sh。`executeHookCommand` 本身仍是非 Windows `/bin/sh -c`、Windows `cmd.exe /c`。
3. sh：用单引号包住完整路径。路径中的每个 `'` 写成 `'\''`。原命令里包着 token 的引号一并换成这个字面量，避免路径里的 `$`、反引号或引号留在双引号里。
4. cmd：用双引号包住路径，按 cmd 转义 `%`、`^`、`&`、`|`、`<`、`>`、`"`。路径里的 `$` 保持原字符。
5. 含 `$` 的路径不再走「安全则原样替换」那条分支。

明确不改什么：

- `interpolateMcpPluginRoot` 的 argv 与 URL 替换
- `executeHookCommand` 的 `spawn` 参数
- token 不存在时返回原命令
- 后缀字符类，以及紧邻 `&&` 不被吃进路径

怎样本地验证：

- 套件 `shellQuotePluginRootInCommand`：`src/vs/workbench/contrib/chat/test/common/plugins/shellQuotePluginRootInCommand.test.ts` 与 `src/vs/platform/agentPlugins/test/common/pluginParsers.test.ts`
- sh 下这些断言改成单引号字面量：`quotes path with spaces`、`quotes path with ampersand`、`quotes multiple occurrences with unsafe path`、`does not double-quote when already in double quotes`、`does not double-quote when already in single quotes`、`escapes embedded double-quote characters in path`、`handles token without trailing path suffix`、`does not consume shell operators adjacent to token`、`handles token at start, middle and end of command`、`uses default CLAUDE_PLUGIN_ROOT token with quoting`、`handles path with parentheses`，以及 pluginParsers 里的 `quotes path with spaces`、`handles already-quoted token`
- `handles Windows-style paths with spaces` 在 cmd 下仍是双引号
- 新增断言：sh 下路径含 `$VAR`、`$(...)`、反引号或单引号时，结果是单引号字面量，单引号写成 `'\''`，结果里不留下未转义的 `$` 或反引号。cmd 下路径含 `$` 时不插入反斜杠

## r05-4

问题类：`server.lock` 接受整个 `127.0.0.0/8`，拨号却把 IPv4 回环改成 `127.0.0.1`。

不变量：TCP 目标地址等于锁里的回环字面量加端口。`::1` 写成 `[::1]:port`。其余已接受的 IPv4 回环写成 `lock.bind:port`。健康检查和 `createDiscoveredLocalEngineClient` 都用这个地址。

要动的符号或文件：

- `readTcpTarget` 拼 `address` 的表达式（`src/vs/platform/universeAgent/node/localEngineDiscovery.ts` 267 行）
- 测试 `loopback binds dial 127.0.0.1 unless the literal is ::1`（`src/vs/platform/universeAgent/test/node/localEngineDiscovery.test.ts`）
- `dev/plans/local-engine-trust-anchor.md` S3 里「`::1` 否则 `127.0.0.1:port`」那句，改成与 `lock.bind` 一致

改法：

1. `lock.bind === '::1'` 时地址仍为 `` `[::1]:${lock.port}` ``。
2. 其余已通过 `isLoopbackBind` 的地址改为 `` `${lock.bind}:${lock.port}` ``。
3. 测试期望改为：`bind: '127.0.0.2'` → `127.0.0.2:9`；`bind: '127.255.255.255'` → `127.255.255.255:65535`；`bind: '::1'` → `[::1]:1`。

明确不改什么：

- `isLoopbackBind`（347–369 行）仍只接受 `::1`，以及四段、首段为 127 的地址
- `0.0.0.0`、`::`、主机名、带括号的 `[::1]` 仍拒绝
- UDS 优先、证书 pin、不读 lock 的 `token`、pid 陈旧则不连

怎样本地验证：

- 更新 `loopback binds dial 127.0.0.1 unless the literal is ::1` 的期望地址
- 保持 `non-loopback binds and bad ports are not anchors`

## r05-5

问题类：没有可用根代理时，普通 `submitInput` 直接返回，不入队，也不发出送失败。

不变量：聊天流已开、租约还在、解析不到根代理时，普通提交不进入 `enqueueOrWriteChat`，租约上收到一次 `send_failed`，其 `message` 不是 `chat_send_stream_closed`。再生提交缺根代理时仍留下 `pendingRegenerateTurn`，等 `rootAgentBound` 再写。

要动的符号或文件：

- `onSubmitInput` 里 `agentId === null` 的分支（`src/vs/platform/universeAgent/node/sessionCore/session-actor-local-fact.ts` 188–191 行）
- `src/vs/platform/universeAgent/node/sessionCore/session-actor-chat-outbox.ts` 里现有 `SEND_FAILED_*` 常量旁，增加一条专用于缺根代理的失败码，交给 `emitSendFailureEffect`

改法：

1. 该分支在 `blockSubmitMissingRootAgent` 的 warn 之外调用 `emitSendFailureEffect`，传入新失败码。
2. 然后 return。不调用 `upsertLocalPendingSendFromSubmit`，不调用 `enqueueOrWriteChat`。
3. 新失败码与 `SEND_FAILED_STREAM_CLOSED` 分开。
4. 这次 `emitSendFailureEffect` 只写在 `onSubmitInput` 的分支里。`blockSubmitMissingRootAgent` 仍只 warn，这样 `emitRegenerateSubmit` 返回 false 时不会先报失败。

明确不改什么：

- 无 chat stream 时仍 `emitSendFailureEffect(SEND_FAILED_STREAM_CLOSED)`（176–182 行）
- `emitRegenerateSubmit` 缺根代理时 warn 后返回 false（654–656 行）
- `onCommandOutcome` 在返回 false 时保留 `pendingRegenerateTurn` 并标 `editAccepted`
- `onRootAgentBound` 调用 `retryAcceptedRegenerateSubmit`
- `emitSendFailureEffect` 在 `leases.size === 0` 时不发帧

怎样本地验证：

- 保持 `edit success without a root agent keeps the latch until the agent binds`
- 新增断言：chat stream 已建立且有租约、`liveRootAgentId` 为空时，`submitInput` 不产生 chat write，`localPendingSends` 不增加，租约收到 `kind === 'send_failed'` 且 `message` 不是 `chat_send_stream_closed`
