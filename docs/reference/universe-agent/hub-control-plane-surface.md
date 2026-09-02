---
title: "Connection Hub 控制面（本仓消费口径）"
type: reference
status: accepted
phase: N/A
updated: 2026-09-02
summary: "Hub HTTPS JSON 端点、AuthSession v1、refresh/身份加密落盘（§3.5）、运行中 withHubAccessRetry（@ 23fd9d70）、设备目录 DTO、relay ticket 与 Hub 失败码闭集；宿主 = electron-main（ADR-003）"
---

# Connection Hub 控制面（本仓消费口径）

> 导航：[索引](INDEX.md)。**权威在外仓** `UniverseAgent/connection-hub` 与 `UniverseAgent/grpc-api` proto；本页只登记 IDE 作为 **Hub Client 设备**要消费的 HTTPS 控制面与失败码口径。产品陈述见 [PRD-024](../../product/requirements.md#prd-024-远程引擎连接connection-hub)；实施方案 [connection-hub-client](../../../dev/plans/connection-hub-client.md)（`accepted` @2026-09-02）。

## 1. 控制面 vs 数据面

| 面 | 协议 | 本仓落点 | 备注 |
|----|------|----------|------|
| **控制面** | HTTPS JSON（WebPKI） | `platform/universeAgent/node/hub/**`（vendored Desktop）+ `hubDirectoryClient.ts` | 登录、目录、ticket、设备管理 |
| **数据面** | TLS 端到端到 Engine | `universeAgentChannel.ts` pinned TLS + `ssl_target_name_override` | 中继 SNI = 一次性 `r-<nonce>` authority；Hub 只做 splice |

Hub **不做**：Agent 对话、LLM、会话内容、替 Engine 授权、终结中继 TLS、持有可冒充客户端的凭证。

## 2. REST 端点

基路径 `{hubBaseUrl}/api/v1`。全部经 **electron-main** 宿主进程发起（renderer 只见 `IUniverseAgentHubService` 投影）。

| 方法 | 路径 | 用途 | 本仓消费 |
|------|------|------|----------|
| `POST` | `/auth/login` | 邮箱 + 密码 → AuthSession v1 | `IUniverseAgentHubService.login` |
| `POST` | `/auth/refresh` | `hub_refresh` HttpOnly cookie + `hub_csrf` double-submit | `hubSessionStore` 单飞 refresh |
| `POST` | `/auth/change-password` | 强制改密（ADR-318） | `changePassword`；`mustChangePassword` 态禁 ticket |
| `POST` | `/auth/logout` | 吊销 refresh + 清本地 secret | `logout`；**不删**客户端身份与 Engine trust |
| `GET` | `/devices` | 设备目录 live 快照 | `listDevices`；拨号 **必须** live，禁止用离线快照拨号（v1） |
| `PATCH` | `/devices/{id}` | 重命名 | `renameDevice` |
| `POST` | `/devices/{id}/revoke` | 吊销设备 | `revokeDevice` |
| `POST` | `/device-codes/confirm` | 确认设备码 | `confirmDeviceCode` |
| `POST` | `/relay-tickets` | 签发中继 ticket | `connectionResolver` → `ResolvedEndpoint.authority` |

默认 TTL（上游 `connection-hub/internal/config/config.go`）：access token **15 min**、refresh **30 天**、relay ticket **5 min**（一次性原子 claim）。

## 3. AuthSession v1（fail-closed 解析）

| 字段 | 含义 | renderer 可见性 |
|------|------|-----------------|
| `accessToken` | Bearer；**仅 node 内存** | **否** |
| `expiresIn` | 秒；推导 `expiresAtMs` | **否** |
| `csrfToken` | refresh double-submit | **否** |
| `mustChangePassword` | 须改密才可用 ticket / 目录写 | 是（`HubAuthStatus.mustChangePassword`） |
| `user` | 账号信息（含 email） | 是（`signedIn{email}`） |

refresh + csrf 经 `IEncryptionMainService`（`safeStorage`）加密后写 `IApplicationStorageMainService`（`APPLICATION` / `MACHINE`）；**不复用** renderer 侧 `ISecretStorageService` 实例（宿主是 main，见 [connection-hub-client §3.2](../../../dev/plans/connection-hub-client.md#32-落层adr-003-的增量不改其-decision-编号)）。

## 3.1 Hub 会话与客户端身份落盘（§3.5 / §3.6 @ `321a4e0b`）

生产路径在 **electron-main** 装配：`UniverseAgentConnectionService`（`electron-main/universeAgentMainService.ts`）注入加密版 `HubSessionStore` 与 `ClientIdentityStore`；`node/` 内 `InMemoryHubSessionStore` / `InMemoryClientIdentityStore` 仅单测 fallback。

| 对象 | 内存 | 持久化（加密可用时） | 键 |
|------|------|----------------------|-----|
| access token | `HubSessionStore` 按 `hubBaseUrl` 分桶 | **否** | — |
| refresh + csrf | 同上（与 access 同桶） | **是** | `universeAgent.secret.hubRefresh.{encodeURIComponent(normalizedHubBaseUrl)}` |
| Ed25519 客户端身份（每 IDE 安装一把） | `ClientIdentityStore` 缓存 | **是** | `universeAgent.secret.deviceIdentity` |

**登录 capture：** `POST /auth/login` 成功时 `hub-auth-client` 从 `Set-Cookie` 解析 `hub_refresh`（及响应对齐的 `csrfToken`），经 `applyAuthSession(..., refreshToken)` 写入加密 secret；`logout` 清内存桶并 `remove` 对应 secret 键，**不删**设备身份与 Engine trust。

**加密不可用（`IEncryptionMainService.isEncryptionAvailable() === false`）：**

| 行为 | 裁定 |
|------|------|
| refresh | **不落盘**；当前进程内 access 仍可用至过期 |
| 客户端身份 | `getOrCreateIdentity()` 返回 `encryption_unavailable`，**不 mint、不 persist** |
| pane | `IUniverseAgentHubService.isEncryptionAvailable()` → 诚实提示「Secure storage unavailable — sign in again after restart.」（`connectionPreferencesPane`） |
| 配对 / DeviceAuth | 无可用身份 ⇒ 连接路径 fail-closed（对齐 ADR-261 §5） |

**`refreshIfNeeded` / `withHubAccessRetry`：** store 已实现单飞 refresh（读持久化 secret → `POST /auth/refresh` → 轮换 refresh 写回）。**启动恢复已落 @ `dba63c70`（合入 `17968447`）：** `UniverseAgentHubService` 构造时经 `restorePersistedHubSessionIfNeeded` / `whenStartupRestoreComplete` 扫描 `listPersistedHubBaseUrls()`；有加密 refresh 且 access 过期则调用 `refreshIfNeeded`——成功 → `signedIn` 并 `refreshDirectory`；refresh 401/403 → `authExpired`；无持久化 → `signedOut`（单测见 `universeAgentHubService.test.ts`）。**运行中 refresh 已落 @ `23fd9d70`（合入 `a00fafc7`）：** `withHubAccessRetry`（`hubAuthAccess.ts`）在 access TTL 过期或目录 / ticket / 控制面 mutation 遇 401/403 时调用 `refreshIfNeeded({ force: true })` 后重试一次；成功则继续原请求；refresh 401/403 或无 token → `authExpired` / `hub_auth_expired`（单测见 `connectionResolver.test.ts`、`universeAgentHubService.test.ts`）。

## 4. 设备目录 DTO（`GET /devices` 条目）

| 字段 | 用途 |
|------|------|
| `id`, `name` | 列表键与显示名 |
| `presence` | `ONLINE` / `OFFLINE`（= 经 Hub 可达） |
| `engineStatus` | `SERVING` / `NOT_SERVING`（engineReady） |
| `engineIdentityId`, `certFingerprint` | 交叉校验提示；**不作** trust 锚（trust 来自 TLS 观测叶 + SAS） |
| `ipv4`, `ipv6`, `enginePort` | v2 GUA 直连候选（**H6 未做**）；v1 只签 ticket |
| `revoked`, `lastHeartbeatAt` | 吊销与快照时效（目录快照 30 天，**不用于拨号**） |

presence 矩阵与 pane 文案见 [connection-hub-client §3.7](../../../dev/plans/connection-hub-client.md#37-两个正交状态与-presence-矩阵)。

## 5. Relay ticket 响应

`POST /relay-tickets` → `{ ticketId, authority: "r-<nonce>.<suffix>", expiresAt }`。

- `authority` 用作 gRPC TLS SNI 与 `ssl_target_name_override`。
- `ResolvedEndpoint.relayTicketId` 非 null ⇒ 路径标签「Hub relay」；`DirectAddress` 路径 ticket 为 null。
- ticket **禁止持久化**；transport 重连须重新解析并签新 ticket（上游 I4）。

## 6. Hub 失败码（renderer 按码画文案）

闭集（与 [connection-hub-client §3.3](../../../dev/plans/connection-hub-client.md#33-领域模型ts-契约) 对齐）：

`hub_session_required` · `hub_password_change_required` · `hub_auth_expired`（目录 401/403，≠ 不可达）· `hub_unreachable` · `hub_device_not_in_directory` · `hub_device_revoked` · `engine_not_serving` · `hub_ticket_failed` · `hub_rate_limited`

Hub 账号状态（`signedOut` / `signedIn` / `mustChangePassword`）与引擎 `ConnectionPhase` **正交**；Hub 登录成功 **不**改变 `isEngineConnected()`。

## 7. 相关

- 数据面 Device Grant：[engine-protocol-surface §1](engine-protocol-surface.md)（`GetAuthNonce` / `Connect.device_auth` / `pairing_nonce` / `sas_code`）
- 连接态映射：[stub-and-fixtures §5](../../systems/conversation/stub-and-fixtures.md)
- Connection pane 空态：[settings-ua-access §7](../../reference/code-oss-b2/settings-ua-access.md)
- 宿主裁定：[ADR-003 审查记录](../../../dev/decisions/003-engine-adapter-boundary.md#审查记录)
