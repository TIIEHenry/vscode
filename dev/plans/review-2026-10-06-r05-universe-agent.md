---
title: "审查 r05：universe-agent"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "Hub 刷新令牌与设备身份会被并发写回旧值；插件根路径进 shell 时未按字面量引用；本机引擎拨错回环地址；缺根代理时发送被静默丢掉。"
---

## r05-1 高
- 症状：登出或更新登录之后，磁盘上仍可能留下上一份 Hub refresh token，下次启动按旧会话重新登录。
- 位置：`src/vs/platform/universeAgent/node/hubSessionStore.ts` 第 262–303 行
- 引用：`if (refreshToken && (await this.encryptionService.isEncryptionAvailable())) { … await this.encryptionService.encrypt … this.applicationStorage.store(...) }`；`clear` 只是 `remove` 后 `bumpSessionGeneration`。
- 为什么是问题：`applyAuthSession` 在 `await` 加密之后无条件 `store`，不再看代际。`clear` 或另一次登录若落在这次 `await` 中间，会先删掉密钥，随后又被这份旧 payload 写回去。加密不可用时，有新 `refreshToken` 也不删旧密钥，内存已是新会话，磁盘仍是上一份。
- 方向：加密完成后再对一次代际，过期则放弃写入；新会话无法落盘时删掉旧 refresh 密钥。

## r05-2 高
- 症状：首次创建设备身份时，两个并发调用会各签各的密钥，磁盘只留下后写入的那一把，已完成的配对对不上重启后的身份。
- 位置：`src/vs/platform/universeAgent/node/clientIdentityStore.ts` 第 105–157 行
- 引用：`const existing = await this.loadIdentity(); if (existing) return …; const identity = mintClientIdentityMaterial(); await this.persistIdentity(identity);`，`persistIdentity` 在 `encrypt` 之后直接 `store` 并覆盖 `cachedIdentity`。
- 为什么是问题：空存储时两次 `getOrCreateIdentity` 都会看见「还没有身份」，各自 `mint` 再 `persist`。握手用的是调用方拿到的那把公钥，磁盘和缓存是后写完的那把。引擎记下的客户端身份与下次启动加载的私钥不是同一对。
- 方向：用单一 in-flight 把「没有则创建并写完」串起来，写完前再读一次，已有身份就沿用已有的。

## r05-3 高
- 症状：插件目录名里如果带 `$()`、反引号或 `$VAR`，钩子命令会在 shell 里展开这些字符，而不是把插件根路径当字面量。
- 位置：`src/vs/platform/agentPlugins/common/pluginParsers.ts` 第 522–548 行
- 引用：`const shellUnsafeChars = /[\s&|<>()^;!`"']/;` 未覆盖 `$`；不安全路径走 `'"' + fullPath.replace(/"/g, '\\"') + '"'`，已有引号时是 `leadingQuote + fullPath`。
- 为什么是问题：`$` 不在危险字符里时，路径被原样拼进命令，`$VAR` 会展开。路径含 `()` 或反引号时虽然套了双引号，双引号里命令替换和反引号仍然执行。函数注释写的是避免 shell 解释路径。
- 方向：用单引号包住路径，并把路径里的单引号写成 `'\''`，不要只转义双引号。

## r05-4 中
- 症状：`server.lock` 里绑定地址是 `127.0.0.0/8` 的其它地址时，发现逻辑仍去拨 `127.0.0.1`，本机引擎对不上或连到同端口的另一个进程。
- 位置：`src/vs/platform/universeAgent/node/localEngineDiscovery.ts` 第 265–267 行（接受范围在第 347–368 行）
- 引用：仅当 `lock.bind === '::1'` 时地址为 `[::1]:port`，否则写成 `127.0.0.1:` 加端口；`isLoopbackBind` 对首段为 127 的四段地址返回 true。
- 为什么是问题：锁文件允许整个 `127.0.0.0/8`，拨号却只区分 `::1` 和 `127.0.0.1`。引擎若绑在 `127.0.0.2` 这类地址，健康检查打到 `127.0.0.1` 的同一端口。
- 方向：IPv4 回环按 `lock.bind` 原地址拨号，不要一律改成 `127.0.0.1`。

## r05-5 中
- 症状：会话还没有可用的根代理时，用户发出的消息不会进入发送队列，界面上也没有失败提示。
- 位置：`src/vs/platform/universeAgent/node/sessionCore/session-actor-local-fact.ts` 第 188–192 行（实现在第 287–292 行）
- 引用：`if (agentId === null) { this.blockSubmitMissingRootAgent(fact.correlation); return }`；`blockSubmitMissingRootAgent` 只有 `diagnostics.warn`。
- 为什么是问题：同一条 `onSubmitInput` 在没有 chat stream 时会 `emitSendFailureEffect`。缺根代理这条直接 return，不入队、不挂失败效果。`emitRegenerateSubmit` 走同一函数时还会留下 `pendingRegenerateTurn` 再试，普通发送没有这笔账。
- 方向：缺根代理时和流已关闭一样给出发送失败，或把这条提交留到根代理绑定后再写。
