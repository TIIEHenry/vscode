---
title: "潜在缺陷：Hub"
type: progress
status: draft
phase: M7
updated: 2026-09-24
summary: "Hub 改密不落新 CSRF、撤设备不限当前 Hub，以及目录失败后仍显示登录过期。"
---

# 潜在缺陷：Hub

## 结论

读过 Hub 控制面、会话库、目录客户端和渲染进程通道缓存。有 7 条会让用户看到错账号、错配置被撤掉，或登录态与设备列表对不上。有意失败关闭（刷新令牌缺失、加密不可用、Web 不支持 Hub）未立条。

## 发现

### BH-02-1：high、高

- 位置：`UniverseAgentHubService.changePassword`（`src/vs/platform/universeAgent/node/universeAgentHubService.ts` 约 212 行）、`HubSessionStore.applyAuthSession`（`src/vs/platform/universeAgent/node/hubSessionStore.ts` 约 242–271 行）、`doRefreshIfNeeded`（同文件约 336–349 行）
- 行为：改密成功后只把新 access / csrf 放进内存，调用 `applyAuthSession` 时不传 refreshToken。磁盘上的 refresh 与 csrf 只在传入 refreshToken 且加密可用时覆盖；省略时旧密文原样留下。之后 `refreshIfNeeded` 读的是磁盘 csrf，不是内存里的新 csrf。
- 为何是缺陷：改密响应里的新会话被丢掉一半。access 过期后刷新仍带旧 csrf，Hub 回 401/403 时界面变成 authExpired，用户刚改完密码却被要求重登。若新登录没有解析到新的 `hub_refresh` cookie（`loginHub` 只认 `getSetCookie`），磁盘仍是上一账号的 refresh，过期刷新会把内存会话刷回上一账号。
- 触发：同一 Hub 改密后等到 access 过期再刷目录或重启；或未登出就换账号登录且响应里没有新的 refresh cookie。
- 已知：无对应 D 号。
- 修复方向：改密与登录在没有新 refresh cookie 时也要替换或清除该 Hub 的持久化 csrf/refresh，不能留旧密文。

### BH-02-2：high、高

- 位置：`UniverseAgentHubService._markHubDeviceProfilesRevoked`（`src/vs/platform/universeAgent/node/universeAgentHubService.ts` 约 494–508 行）。相邻：`UniverseAgentConnectionService.revokeDevice`（`src/vs/platform/universeAgent/node/universeAgentConnectionService.ts` 约 1960–1968 行）只按 `hubDeviceId` 断开当前连接。
- 行为：Hub 撤设备成功后，把所有 `target.hubDeviceId` 相同的配置标成 revoked，不看 `hubBaseUrl`。连接层同样只比设备 id，会把当前已连接配置断开。
- 为何是缺陷：配置模型是「Hub URL + 设备 id」。两个 Hub 的设备 id 相同时，撤其中一个会把另一个的配对配置标成已撤，并可能断开正在用的那台引擎。
- 触发：配置库里有两个 hubDevice 配置，设备 id 相同、Hub URL 不同，对当前 Hub 执行撤设备。
- 已知：无对应 D 号。
- 修复方向：标 revoked 和断开连接都要同时匹配当前 Hub URL 与设备 id。

### BH-02-3：medium、高

- 位置：`UniverseAgentHubService.login` / `setActiveHubBaseUrl`（`src/vs/platform/universeAgent/node/universeAgentHubService.ts` 约 134–136、171 行）、`refreshDirectory`（约 230–236 行）、`addHubDeviceProfile`（约 423–429 行）。会话键用 `hubBaseUrlIdentityKey`（`src/vs/platform/universeAgent/node/hubSessionStore.ts` 约 55–64 行），会走 `normalizeHttpsUrl`。
- 行为：活动 Hub URL 只做 trim，持久化列表和会话桶用规范化 URL（主机小写、去掉默认 443、路径去掉末尾斜杠）。`listPersistedHubBaseUrls().includes(活动 URL)` 和已有 hubDevice 配置的 `hubBaseUrl === 活动 URL` 都是原始字符串比较。
- 为何是缺陷：access 过期后 `readBucket` 会删掉内存令牌，状态变成 signedOut。活动 URL 与规范化 URL 不一致时，刷新目录认为没有持久化 refresh，直接回到 idle，不再换票。重启后活动 URL 变成规范化形式，按原始 URL 存的设备配置对不上，再次添加会多出一条配对配置。
- 触发：用 `https://Example.com`、带 `:443` 或带末尾斜杠的 Hub 地址登录，等 access 过期后点刷新设备；或重启后再添加同一设备。
- 已知：无对应 D 号。
- 修复方向：写入活动 URL 和比较配置前都用同一套 `normalizeHttpsUrl` 结果。

### BH-02-4：medium、高

- 位置：`UniverseAgentHubService.refreshDirectory`（`src/vs/platform/universeAgent/node/universeAgentHubService.ts` 约 250–266 行）、`mapAuthProjection`（约 66–72 行）
- 行为：只有目录请求成功才把 `_directoryAuthExpired` 清掉。网络失败或非 401 的目录错误只改目录状态，不清这个标志。`getAuthStatus` 在标志为真时一律返回 authExpired，不再看内存里是否已有新 access。
- 为何是缺陷：刷新其实已经换到新令牌，但设备列表请求失败时，登录徽章仍停在过期。用户会以为必须重新登录，目录却显示的是不可达或错误。
- 触发：先有一次刷新失败把标志设为真；之后 `withHubAccessRetry` 换票成功，但 `listHubDevices` 返回 `hub_directory_http_failed` 或其他非过期错误。
- 已知：无对应 D 号。
- 修复方向：只要本次已经拿到 access，非会话类目录失败就要清掉 authExpired，登录态与目录失败分开显示。

### BH-02-5：medium、高

- 位置：`loginHub`、`refreshHubAuthSession`、`authorizedFetch`、`issueHubRelayTicket` 里的 `new URL('/api/v1/...', hubUrl.url)`（`src/vs/platform/universeAgent/node/hub/hub-auth-client.ts` 约 197 行、`src/vs/platform/universeAgent/node/hubSessionStore.ts` 约 135 行、`src/vs/platform/universeAgent/node/hubDirectoryClient.ts` 约 236 行、`src/vs/platform/universeAgent/node/hub/hub-relay-ticket-client.ts` 约 182 行）。`normalizeHttpsUrl` 会保留非根路径（`src/vs/platform/universeAgent/node/hub/host-normalize.ts` 约 142–148 行）。
- 行为：规范化结果把路径算进 Hub 身份，但请求路径以 `/` 开头。按 URL 标准，这会丢掉 base 的路径，打到该主机的 `/api/v1/...`。
- 为何是缺陷：带路径前缀的 Hub 地址会被当成不同会话存起来，实际登录、刷新、目录和中继票都打到站点根上。用户要么登录失败，要么在同一主机的另一个服务上完成登录，会话桶却记在带前缀的地址下。
- 触发：把 Hub 地址设成 `https://主机/路径前缀` 后登录或刷目录。
- 已知：无对应 D 号。
- 修复方向：非根路径直接拒绝，或把 API 路径接到规范化前缀后面，身份与请求使用同一 origin。

### BH-02-6：medium、中

- 位置：`UniverseAgentHubChannelClient.hydrate`（`src/vs/platform/universeAgent/common/universeAgentHubChannelClient.ts` 约 87–104 行）。缓存写入无版本：`UniverseAgentHubSyncCache.applyAuth` / `applyHubBaseUrl`（`src/vs/platform/universeAgent/common/universeAgentRendererSync.ts` 约 254–264 行）。
- 行为：构造时并行拉取配置、登录态、目录和 Hub URL，返回后整段覆盖缓存并再广播。等待期间主进程事件已经先写入缓存的话，会被这次旧快照盖掉。
- 为何是缺陷：启动过程中用户刚登录或刚改 Hub 地址，界面会闪回 signedOut、空目录或旧地址，直到下一次主进程事件。失败分支已保留旧缓存（D84），成功分支仍会用过期快照覆盖更新。
- 触发：hydrate 的 IPC 尚未返回时，主进程已经 fire 了登录或 `setActiveHubBaseUrl`。
- 已知：D84 / D554 只收了 hydrate 失败和未处理 rejection，没有这条覆盖。
- 修复方向：hydrate 只填尚未被事件更新过的字段，或带世代号，旧响应用到已更新字段上就丢弃。

### BH-02-7：medium、高

- 位置：`UniverseAgentHubService.addHubDeviceProfile`（`src/vs/platform/universeAgent/node/universeAgentHubService.ts` 约 423–429 行）
- 行为：已有相同 Hub URL 与设备 id 的配置时，不论 `state` 是否已是 revoked，都直接返回旧 `profileId`。
- 为何是缺陷：撤掉设备后再从目录添加，界面得到成功，拿回的仍是已撤配置。后续连接走这条配置，配对起不来，用户会看成设备加不回去。
- 触发：对某 hubDevice 撤设备成功后，不忘记该配置，再次 `addHubDeviceProfile` 同一设备。
- 已知：无对应 D 号。
- 修复方向：已撤配置不要复用；先忘记或新建一条 pairingPending 配置。

## 看过但未立条

- `restorePersistedHubSessionIfNeeded` 只恢复排序后的第一个 Hub，注释写明 v1 单桶。
- `logoutHub` 失败吞掉，注释写明本地清除为准。
- Web 实现 `isEncryptionAvailable` 固定 true，注释写明避免被画成钥匙串故障；登录等写操作返回不支持。
- `withHubAccessRetry` 在控制面 401/403 时只强制刷新一次，注释写明失败关闭。
- `UniverseAgentHubChannelClient.setActiveHubBaseUrl` 先改本地缓存、IPC 失败不回滚。D562 已写明该行为不在那一刀，行本身已关闭。
- `common/hub.ts` 里 `addHubDeviceProfile` 重复声明，返回类型是别名，运行时没有第二套实现。
- 主机规范化拒绝 userinfo、裸端口、IPv4 映射地址，与注释一致的失败关闭。

## 未读完

- `connectionResolver.ts` 只读了 directAddress / hubDevice 如何消费配置，没有逐行读中继票拨号。
- `universeAgentConnectionService.ts` 只对过撤设备后的断开，没有读整份连接服务。
- Hub 单测只抽读了启动恢复、刷目录、添加设备、撤设备标记和 refresh 加密，没有跑测试。
- 未读 `src/vs/sessions`、workbench Connection 面板，以及 `dev/progress/deferred-gaps.md` 里与 Hub 无关的行。
