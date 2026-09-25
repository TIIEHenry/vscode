---
title: "Hub 改密落 CSRF、撤设备限当前 Hub、目录失败与登录徽章分开"
type: plan
status: accepted
phase: M7
updated: 2026-09-24
summary: "改密或无新 refresh cookie 时不得留旧 csrf 密文；撤设备同时匹配 Hub URL；活动 URL 用规范化结果；非会话目录失败清 authExpired；非根路径拒绝；Hub hydrate 不盖已到事件。"
---

# Hub 改密落 CSRF、撤设备限当前 Hub、目录失败与登录徽章分开

> **本稿是方案，不是实施。**
> **冲突域：** `src/vs/platform/universeAgent/node/universeAgentHubService.ts`（`login` / `changePassword` / `setActiveHubBaseUrl` / `refreshDirectory` / `_markHubDeviceProfilesRevoked`）· `src/vs/platform/universeAgent/node/hubSessionStore.ts`（`HubSessionStore.applyAuthSession` 与 `InMemoryHubSessionStore.applyAuthSession`）· `src/vs/platform/universeAgent/node/hub/hub-auth-client.ts`（仅 `changeHubPassword` 读取已有 `getSetCookie`）· `src/vs/platform/universeAgent/node/hub/host-normalize.ts`（`normalizeHttpsUrl` 拒非根路径）· `src/vs/platform/universeAgent/node/universeAgentConnectionService.ts`（**仅** `revokeDevice` 里断开匹配条件）· `src/vs/platform/universeAgent/common/universeAgentHubChannelClient.ts`（`hydrate`）· `src/vs/platform/universeAgent/common/universeAgentRendererSync.ts`（**仅** `UniverseAgentHubSyncCache`）。
> **不占** [connection-dial-generation](../connection-dial-generation.md) 已签收的 `universeAgentConnectionService` 拨号 / 握手路径（`connect` / `_connectProfileRaw` / handshake / probe / epoch）。BH-02-2 若改 `revokeDevice`，只改撤设备成功后「要不要 `disconnect`」的匹配条件，不改 `connect` / handshake。
> **不发明**协议字段、cookie 名或 API 路径。`csrfToken`、`hub_refresh`、`getSetCookie` 都是 HEAD 已有。

## 核查

对照 [扫描文](../../progress/bug-hunt-2026-09-24/02-hub.md) 与 HEAD。

| 条目 | 判定 | 理由 |
|:-----|:-----|:-----|
| BH-02-1 | 成立 | `changePassword` 约 212 行调用 `applyAuthSession` 不传 refreshToken；`applyAuthSession` 约 258–271 行只在传入 refreshToken 且加密可用时覆盖密文。`doRefreshIfNeeded` 约 336–340 行用磁盘 `secrets.csrfToken`。`changeHubPassword` 约 316–321 行不读 Set-Cookie。`login` 约 173 行只在 `loginHub` 约 235–237 行解析到 `hub_refresh` 时才覆盖；cookie 缺失则旧密文留下。 |
| BH-02-2 | 成立 | `_markHubDeviceProfilesRevoked` 约 494–501 行只比 `hubDeviceId`。`UniverseAgentConnectionService.revokeDevice` 约 1964–1967 行断开条件同样只比 `hubDeviceId`。配置模型是 Hub URL + 设备 id。 |
| BH-02-3 | 成立 | `setActiveHubBaseUrl` 约 135 行、`login` 约 171 行只 `trim`。会话键 `hubBaseUrlIdentityKey` 约 55–60 行走 `normalizeHttpsUrl`（主机小写、默认 443 去掉、路径去末尾斜杠，`host-normalize.ts` 约 141–147 行）。`refreshDirectory` 约 232 行 `listPersistedHubBaseUrls().includes(活动 URL)` 与 `addHubDeviceProfile` 约 425 行都是原始字符串比较。 |
| BH-02-4 | 成立 | `mapAuthProjection` 约 70–72 行在 `_directoryAuthExpired` 为真时直接 `authExpired`。`refreshDirectory` 约 258–266 行非成功且非 `isHubAccessAuthExpired` 时只改目录状态，约 269 行才清标志。`withHubAccessRetry` 可先换到 access 再让 `listHubDevices` 返回 `hub_directory_http_failed`。 |
| BH-02-5 | 成立 | `normalizeHttpsUrl` 约 142 行保留非根路径。`loginHub` 约 197 行、`refreshHubAuthSession` 约 135 行、`authorizedFetch` 约 236 行、`issueHubRelayTicket` 约 182 行都是 `new URL('/api/v1/...', hubUrl.url)`，以 `/` 开头会丢掉 base 路径。 |
| BH-02-6 | 成立 | `hydrate` 约 87–101 行整段覆盖缓存再广播，无世代。事件监听在约 50–61 行，早于 hydrate。`applyAuth` / `applyHubBaseUrl` 约 254–264 行无版本。失败分支约 102–104 行保留缓存（D84）；成功分支仍会盖掉等待期间已到的登录或 Hub URL。 |
| BH-02-7 | 驳回 | `addHubDeviceProfile` 约 423–429 行确实不看 `state`，会返回已撤 `profileId`。用户可见的「配对起不来」不成立：`connectionResolver.validateHubDevicePresence` 约 582–587 行只看目录 `device.revoked`，不看 `profile.state`。新建 `pairingPending` 同样得到 `hub_device_revoked`。交叉引用 [m7-gap-closeout](../m7-gap-closeout.md) 去重与「Hub revoke 不可逆、恢复靠 Forget」，以及 [connection-dial-generation](../connection-dial-generation.md) 不做项「Hub revoke 复用」。不另起切片。 |

## Problem class

- **症状：** 改密后 access 一过期就变 authExpired，或无新 refresh cookie 的登录把内存刷回上一账号；撤一个 Hub 的设备把另一个 Hub 上同 id 的配置标成已撤并可能断开；大小写 / `:443` / 末尾斜杠的活动 URL 过期后不再换票，重启后再添加多出一条配置；目录网络失败时登录徽章仍停在过期；带路径前缀的 Hub 地址打到站点根；启动 hydrate 把刚登录的界面盖回旧快照。
- **类标签：** **内存会话与密文分叉** + **身份键与活动字符串分叉** + **失败标志粘住登录徽章** + **无世代的 hydrate 成功包**。
- **复发机制：** 测锁的是「传入 refreshToken 才落盘」和「同 hubDeviceId 标 revoked」，不锁省略 refresh 时的旧密文，也不锁 Hub URL。

## 0. 一句话结论

改密成功，或登录成功但没有新的 `hub_refresh` cookie 时，清掉该 Hub 已有持久化 secret，内存桶仍写入本次 `session`；有新 cookie 才整段覆盖。撤设备标 revoked 和断开都用这次调用前捕获的 Hub URL，经 `normalizeHttpsUrl` 后与设备 id 一起比较。活动 Hub URL 只存规范化结果。非根路径直接拒绝。目录请求拿到了 access、且失败不是会话过期时，清掉 `_directoryAuthExpired`。Hub `hydrate` 的成功包不得覆盖等待期间事件已写的 auth / 目录 / profiles，也不得覆盖客户端 setter 已写的 Hub URL。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| `changePassword` 成功后 `applyAuthSession(hubBaseUrl, result.session, now)`，第四参省略 | `universeAgentHubService.ts` `changePassword` |
| `applyAuthSession` 总是写内存桶（含 `session.csrfToken`）；仅 `refreshToken &&` 加密可用时 `store` 密文 | `hubSessionStore.ts` `HubSessionStore.applyAuthSession`；`InMemoryHubSessionStore.applyAuthSession` 同构 |
| `doRefreshIfNeeded` 解密后把 `secrets.refreshToken` 与 `secrets.csrfToken` 交给 `refreshHubAuthSession` | 同文件 `doRefreshIfNeeded` |
| `changeHubPassword` 解析 AuthSession 后直接返回，不读 `getSetCookie` | `hub-auth-client.ts` `changeHubPassword` |
| `loginHub` 只从 `headers.getSetCookie()` 取 `hub_refresh`；没有则 `refreshToken` 为 undefined | 同文件 `loginHub` |
| `login` 把 `result.refreshToken` 原样传入；undefined 不触发密文覆盖 | `universeAgentHubService.ts` `login` |
| 标 revoked 与断开都只比 `target.hubDeviceId` | `_markHubDeviceProfilesRevoked`；`universeAgentConnectionService.ts` `revokeDevice` |
| 活动 URL 只 `trim`；持久化列表与会话桶用规范化 URL | `setActiveHubBaseUrl` / `login`；`hubBaseUrlIdentityKey`；`normalizeHttpsUrl` |
| access 过期时 `readBucket` 删内存桶，状态变 signedOut；`refreshDirectory` 在 signedOut 且 `includes(活动 URL)` 为假时直接 idle | `readBucket`；`refreshDirectory` |
| 重启恢复把活动 URL 设成 `listPersistedHubBaseUrls()` 排序后的第一个（已是身份键） | `restorePersistedHubSessionIfNeeded` |
| `_directoryAuthExpired` 优先于内存会话；只有目录 `ok` 才清 | `mapAuthProjection`；`refreshDirectory` |
| `withHubAccessRetry` 先 `refreshIfNeeded` 再发目录请求；非 401/403 控制面失败原样返回 | `hubAuthAccess.ts` `withHubAccessRetry` |
| 规范化保留非 `/` 路径；请求 URL 以 `/api/v1` 为绝对路径 | `host-normalize.ts`；`hub-auth-client.ts` / `hubSessionStore.ts` / `hubDirectoryClient.ts` / `hub-relay-ticket-client.ts` |
| `hydrate` 成功后无条件 `applyProfiles` / `applyAuth` / `applyDirectory` / `applyHubBaseUrl` 并 fire | `universeAgentHubChannelClient.ts` `hydrate` |
| 连接侧成功重叠 generation 已由拨号方案占住，对象是 connection channel，不是 Hub cache | [connection-dial-generation](../connection-dial-generation.md) S4 |
| GC-2 原文就是「所有 `hubDeviceId === id`」 | [m7-gap-closeout](../m7-gap-closeout.md) §2.2 |
| 改密落盘不在 H1a；H1a 只覆盖 `loginHub` 有 cookie 时加密落盘 | [connection-hub-client](../connection-hub-client.md) H1a |

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 无新 cookie 则清 secret；撤设备双键；活动 URL 规范化；非根路径拒绝；有 access 的目录失败清过期标志；Hub hydrate 按字段世代** | 见 §3 | **选定** |
| B 无新 cookie 时用旧 refresh 配新 `csrfToken` 改写密文 | 服务器若已作废旧 refresh，仍会刷错票 | **拒绝** |
| C 改密响应发明 refresh 字段 | 正文没有这个字段；`changeHubPassword` 今日只解析 AuthSession | **拒绝** |
| D 把 API 接到保留下来的路径前缀后面 | 与已写死的 `/api/v1/...` 合同分叉；前缀 Hub 不是现有控制面 | **拒绝** |
| E 本波清 trust、让 resolver 拒 `profile.state==='revoked'` | 拨号方案已拒绝，冲突域会进 resolver / 握手 | **拒绝。** 见该方案选项 F |
| F 已撤 profile 不复用、另建 pairingPending | BH-02-7 驳回 | **拒绝** |
| G 重做 GC-2 整段 Revoke UI | 工具条与确认框已落；本稿只收窄匹配 | **拒绝** |

## 3. 选定设计（A）

1. **S1 无新 refresh cookie 不留旧密文。** 不变量在 `applyAuthSession`：调用方传入非空 `refreshToken` 且加密可用时，行为与今日相同，整段覆盖 `{ refreshToken, csrfToken, userId }`。未传入 `refreshToken` 时，若该 Hub 身份键上已有持久化 secret，必须删掉这段 secret（`clear` 的存储半边，或 InMemory 的 `refreshSecrets.delete`），**然后**仍写入本次内存桶。禁止走「省略参数就 return、旧密文不动」。
   `changeHubPassword` 在解析成功后，用与 `loginHub` 相同的 `getSetCookie` + `hub_refresh` 取出 cookie；没有则结果里不带 refresh。`changePassword` 把这个值传给 `applyAuthSession`。`login` 在 `refreshToken` 缺席时同样走「先删旧 secret 再写内存」。不新增 JSON 字段。
2. **S2 撤设备双键。** `UniverseAgentHubService.revokeDevice` 在发 API **之前**已经有局部 `hubBaseUrl`（约 338 行）。`_markHubDeviceProfilesRevoked` 必须用这一份，禁止标记时再读 `_activeHubBaseUrl`（中间会 `refreshDirectory`，用户可能已换 Hub）。`UniverseAgentConnectionService.revokeDevice` 在调用 `_hub.revokeDevice` **之前**钉死当时的活动 Hub URL；`await` 之后只有「当时已连接或连接中、profile 是 hubDevice、设备 id 相同、**且** 身份键相同」才 `disconnect()`。两侧比较都走与 `hubBaseUrlIdentityKey` 相同的 `normalizeHttpsUrl` 结果（失败则退回原串），这样已存的 `https://Example.com:443/` 与活动 URL `https://example.com` 仍算同一 Hub。不改 `disconnect` 函数体，不改 `connect` / handshake。GC-2 的「同 id 即标 revoked」由此收窄，不重做 pane。
3. **S3 活动 URL 只用规范化结果。** `login` 与 `setActiveHubBaseUrl` 在写入 `_activeHubBaseUrl` 前走 `normalizeHttpsUrl`；失败则登录返回现有 `hub_auth_contract_invalid` 一类结果，`setActiveHubBaseUrl` 不把非法串存成活动 URL。`refreshDirectory` 的 `includes` 与 `addHubDeviceProfile` 的去重都用同一身份键（`normalizeHttpsUrl` 的结果），已存的 `https://Example.com:443/` 与新的活动 URL 算同一条。身份键函数保持单一实现，不另写一套规范化。
4. **S4 目录失败与登录徽章分开。** `refreshDirectory` 在 `withHubAccessRetry` 返回后：`isHubAccessAuthExpired` 仍置 `_directoryAuthExpired`。否则若 `getAccessTokenForHub` 非空，把 `_directoryAuthExpired` 置 false，再按今日规则写 `unreachable` / `error` / `ok`。没有 access 的失败不借这次清标志。`getAuthStatus` 仍是「标志优先」，不改投影形状。
5. **S5 非根路径拒绝。** `normalizeHttpsUrl` 在路径不是空（今日把 `/` 收成空）时返回失败，理由沿用现有 `reason` 字符串风格，不新增 URL 字段。登录、刷新、目录、中继票继续 `new URL('/api/v1/...', hubUrl.url)`。身份键与请求因此都停在源站根上。
6. **S6 Hub hydrate 字段世代。** 主进程 `setActiveHubBaseUrl` / `login` 只 fire auth、directory、profiles，没有 Hub URL 事件。渲染端 URL 只在 `UniverseAgentHubChannelClient.setActiveHubBaseUrl`（先 `applyHubBaseUrl` 再 IPC）和 `hydrate` 写入。世代记在这四条缓存写入上：事件三路，加上客户端 setter 的 URL。`hydrate` 在 `Promise.all` 之前记下四字段世代；返回后只写入世代未变的字段，再只 fire 实际写入的那几路。登录事件可以挡住 auth / 目录被盖回 signedOut 或空目录。旧 URL 只在客户端 setter 已写入、而飞行中的 `getActiveHubBaseUrl` 仍是旧值时丢掉。D84：`catch` 仍不通知、不半应用。不给 connection snapshot 加字段，不改 `onDidChangeConnection`。

## 4. 不做

- BH-02-7 已撤 profile 复用；不改 `addHubDeviceProfile` 去重
- 清 Hub revoke 后的 trust、resolver 拒 `profile.state`（拨号方案选项 F）
- `connect` / `_connectProfileRaw` / handshake / probe / connection epoch
- 把 `/api/v1` 改接到路径前缀上
- 重做 Connection 面板 Revoke 确认框
- 重开 GitHub Actions

## 5. 验证

本地、点名现有文件，不跑托管 CI。

| 切片 | 现有测试 | 要加的断言 |
|:-----|:---------|:-----------|
| S1 | `src/vs/platform/universeAgent/test/node/hubSessionStore.test.ts`；`src/vs/platform/universeAgent/test/node/universeAgentHubService.test.ts` | 先 `applyAuthSession` 带 refresh，再 `changePassword` 成功且无新 cookie：内存 csrf 是新 session，`listPersistedHubBaseUrls` 不再含该 Hub。登录成功且 `refreshToken` 缺席：上一账号密文被删，随后 `refreshIfNeeded` 不是用旧 csrf 换票。有新 cookie 时密文整段变成新 refresh + 新 csrf |
| S2 | `src/vs/platform/universeAgent/test/node/universeAgentHubService.test.ts`（`revokeDevice marks matching hubDevice profiles revoked`）；`src/vs/platform/universeAgent/test/node/universeAgentConnection.test.ts`（`UniverseAgentConnectionService revokeDevice disconnect`） | 两个 hubDevice，设备 id 相同、Hub 身份键不同：只标本次 API 捕获的那条，另一条 `state` 不变。标记用调用前捕获的 URL，不在 `refreshDirectory` 之后重读活动 URL。`https://Example.com:443/` 与 `https://example.com` 视为同一 Hub。当前连接的是另一个 Hub 的同 id：`disconnect` 不被调用。同身份键同 id 仍标 revoked 且断开一次 |
| S3 | `src/vs/platform/universeAgent/test/node/universeAgentHubService.test.ts`（`refreshDirectory refreshes expired access`） | 活动 URL 用 `https://Example.com:443/` 登录后，access 过期再 `refreshDirectory` 仍换票，不直接 idle。同一规范化 URL 再 `addHubDeviceProfile` 复用同一 `profileId` |
| S4 | `src/vs/platform/universeAgent/test/node/universeAgentHubService.test.ts`（`refreshDirectory maps runtime refresh 401`） | 先让刷新 401 把徽章打成 authExpired；下一轮 `withHubAccessRetry` 换票成功但 `listHubDevices` 为 `hub_directory_http_failed`：`getAuthStatus` 不再是 authExpired，目录是 unreachable |
| S5 | `src/vs/platform/universeAgent/test/node/hubSessionStore.test.ts`（今日没有 `normalizeHttpsUrl` 用例，也没有 `loginHub` 调用；断言加在该文件已有的 `refreshHubAuthSession` 套件旁，或 `hubControlPlane.test.ts` / `hubDirectoryClient.test.ts` 的新用例） | `https://hub.example.com/prefix` 规范化失败；`https://hub.example.com/` 仍成功，请求 URL 路径是 `/api/v1/...` |
| S6 | `src/vs/platform/universeAgent/test/common/universeAgentRendererSync.test.ts`（hub channel client hydrate，含 D84 reject） | 四路 IPC 尚未返回时，主进程先 fire 登录：hydrate 成功后 auth / 目录仍是事件值，不回到 signedOut 或空目录。客户端 `setActiveHubBaseUrl` 已写入新 URL、飞行中的 `getActiveHubBaseUrl` 仍是旧值：成功返回后缓存 URL 仍是 setter 写入的值。`universeAgentHubChannelClientHydrateCatch.test.ts` 只锁双 `catch` 源码形态，不把它当成 D84 行为断言。D84 reject 用例断言不改 |

门禁命令沿用 [health-gates](../../progress/health-gates.md)：`scripts/test.sh` 点名上表文件。

## 审查记录

| 轮 | Assessment | 处置 |
|:---|:-----------|:-----|
| 2026-09-24 规则 16 | Approve with changes | 无 Critical。改入 Important：S2 标记与断开都用调用前捕获的 URL，比较走 `normalizeHttpsUrl` 身份键。S6 写明主进程不 fire Hub URL；旧 URL 只来自客户端 setter 与飞行中的 `getActiveHubBaseUrl`。Minor：S5 不假装已有归一测试；D84 行为断言只在 rendererSync 测。 |
