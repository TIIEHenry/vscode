---
title: "Connection Hub 客户端接入：IDE 作为 Hub Client 设备"
type: plan
status: accepted
phase: M6+
updated: 2026-09-02
summary: "IDE 扮演 Hub Client 设备；切片 H0–H5 已落 @ `058ed9d0`–`83df4497`；H6 GUA 直连仍 v2；H4a 真 Hub 冒烟 / PRD-024 implemented 未签收"
---

# Connection Hub 客户端接入

> **上游事实（外仓只读）：** `UniverseAgent/dev/plans/connection-hub/{architecture,backend,frontend}.md`、`UniverseAgent/dev/decisions/{261,318,374,375}-*.md`、`UniverseAgent/grpc-api/src/main/proto/{system_service,common}.proto`、`UniverseAgent/connection-hub/docs/config.md`。  
> **Donor（外仓只读）：** `UniverseAgentDesktop/apps/desktop/src/main/engine/**`（ADR-025 relay ticket / ADR-026 Hub 登录 / ADR-027 TLS 首配 orchestrator）与 `UniverseAgentDesktop/docs/architecture/connection-and-auth.md`；Singularity `shared/connection/ConnectionResolver.kt`、`shared/hub/HubApiClient.kt`（Kotlin，只移植逻辑）。  
> **本仓边界：** [ADR-003](../decisions/003-engine-adapter-boundary.md)（adapter 落层）· [m6-engine-wave](m6-engine-wave.md) M6-A1（gRPC 宿主）· [page-access-schemes](page-access-schemes.md) §2.2 / §15.10（`ua.connection` pane、StatusBar B10）· [PRD-007](../../docs/product/requirements.md#prd-007-诚实降级) 验收 4–5 · [PRD-008](../../docs/product/requirements.md#prd-008-引擎与会话权威)。  
> **状态：** `accepted` @2026-09-02。**H0–H5 代码已落**（`058ed9d0`–`83df4497`）；**H6** 仍 v2。H4a 真 Hub 冒烟 / PRD-024 升 `implemented` 仍待验。

---

## 0. 一句话结论

在 Hub 体系里 IDE 是 **Client 设备**——与 Singularity、UniverseAgentDesktop 同一角色；它**不是** `hub-client`（那是 Engine 侧的隧道模块），也不运行 Hub 服务端。「接入 Connection Hub」= 在 M6-A1 的 `platform/universeAgent/node` gRPC 宿主上再长一条 **「Hub 解析 + Device Grant 认证」拨号臂**，把 `IUniverseAgentConnection` 的连接目标从 loopback 扩到 `HubDevice` / `DirectAddress`，其余（roster 投影、时间线 fold、Engine 页 catalog）一律不变。Hub 只提供发现与传输，**从不构成会话权威或信任依据**。

---

## 1. 现状分析

### 1.1 上游 Hub 提供什么（事实）

| 面 | 内容 | 本仓消费 |
|----|------|----------|
| **控制面**（HTTPS JSON，WebPKI） | `POST /api/v1/auth/{login,refresh,change-password,logout}`（AuthSession v1：`accessToken` / `expiresIn` / `csrfToken` / `mustChangePassword` / `user`；refresh 走 `hub_refresh` HttpOnly cookie + `hub_csrf` double-submit）· `GET /api/v1/devices`（`id, name, presence, engineStatus, engineIdentityId, certFingerprint, ipv4, ipv6, enginePort, revoked, lastHeartbeatAt`）· `PATCH /devices/{id}` · `POST /devices/{id}/revoke` · `POST /device-codes/confirm` · `POST /relay-tickets` → `{ticketId, authority: "r-<nonce>.<suffix>", expiresAt}` | 全部 |
| **数据面** | 中继：TLS **端到端**到 Engine，SNI = 一次性 `r-<nonce>` authority，Hub 只做 splice；ticket 默认 TTL 5m、一次性原子 claim。直连（ADR-374 Phase 3，已编码、HUMAN 未签）：GUA / 公网 IPv4 + 同一套 TLS/pin/Grant | 中继 v1；直连 v2 |
| **Engine 认证（ADR-261）** | `SystemService.GetAuthNonce` → `Connect(device_auth: DeviceAuth{client_identity_id, client_public_key, auth_nonce, signature})`；transcript = `engineIdentityId ‖ engineCertFingerprint ‖ authNonce ‖ clientIdentityId ‖ protocolVersion`；未配对 → `ConnectResponse.pairing_nonce + sas_code`（无 `session_token`）；SAS = Crockford base32 8 字符 `XXXX-XXXX`，**不可跳过**；KAT-1/2 双端必须一致 | 全部 |
| **presence 两级** | `presence ∈ ONLINE/OFFLINE`（= 经 Hub 可达）× `engine_status ∈ SERVING/NOT_SERVING`（engineReady）；ONLINE 且 NOT_SERVING 必须显示「Engine 异常」而非可连接 | 设备列表 |
| **默认 TTL**（`connection-hub/internal/config/config.go`） | access token **15 min**、refresh 30 天、relay ticket 5 min | 决定 §3.5 |

Hub **不做**：Agent 对话、LLM、会话内容、替 Engine 授权、终结中继 TLS、持有可冒充客户端的凭证。

### 1.2 本仓现状（HEAD）

- `src/vs/platform/universeAgent/` 只有 S1 vendored 的 `common/sessionView/**` 与 `node/sessionCore/**`；**没有** gRPC 客户端、没有 `IUniverseAgentConnection`（M6-A1 尚未开）。`package.json` 无 `@grpc/grpc-js`。
- `ua.connection` pane（`contrib/conversation/browser/connectionPreferencesPane.ts`）是纯 UI 占位：空列表 + Test Connection 恒「Not connected — no engine.」；无 `ConnectionProfileStore`（page-access §2.2 切片 1 有意为之）。
- ADR-003 Decision 7 已钉：`isEngineConnected()` = 非空 `session_token` + 活 channel；**pairing-pending 不算 connected**。Decision 8 / M6 §6 已钉断连回退。这两条正好是 Hub 接入的连接态 SSOT，本稿不重开。
- 可用基础设施：`IEncryptionMainService`（safeStorage）+ `IApplicationStorageMainService` 可作 main 侧 keyring 替身（renderer 侧同源实现是 `BaseSecretStorageService`）；`IDialogService` 可作 SAS 原生确认；Node 内建 Ed25519（`node:crypto`），无需第三方库。

### 1.3 可复用 donor

| Donor | 内容 | 复用方式 |
|-------|------|----------|
| Desktop `device-grant-crypto.ts`（105 行） | transcript 拼接、SAS 派生、Ed25519 签名器，纯 `node:crypto` | **vendor**（同 sessionCore 的 `SYNC.md` + sync 脚本机制） |
| Desktop `tls-pin.ts` / `observe-candidate-leaf.ts` | leaf DER 指纹、TLS 观测候选叶 | vendor |
| Desktop `hub-auth-client.ts` / `hub-relay-ticket-client.ts` / `host-normalize.ts` | AuthSession v1 fail-closed 解析、relay ticket 解析（authority 正则）、URL 归一化 | vendor；refresh 路径本仓补（Desktop ADR-026 故意不做） |
| Desktop `create-engine-channel.ts` | `ChannelCredentials.createFromSecureContext` + `checkServerIdentity` pin + `grpc.ssl_target_name_override = authority` | **对表改写**进 M6-A1 的 channel 工厂（Desktop 版耦合其 deps） |
| Desktop `pairing-orchestrator.ts`（1130 行）· ADR-027 S1–S7 | 首配 typestate：观测叶 → provisional pin → GetAuthNonce/Connect → SAS 原生确认 → 正式 Connect → 原子写 trust | **改写**（耦合 `desktop-domain` 与 IPC）；序列照抄 |
| Desktop `types.ts` | `LogicalTarget` / `ConnectionProfile` / `EngineTrustRecord{leafDer, leafSha256Hex, engineIdentityId}` / `ResolvedDialTarget`（仅内存） | 作为 §3.3 TS 契约起点 |
| Singularity `ConnectionResolver.kt` | 目录快照、`hubAuthExpired`、直连探测 → 中继回落顺序、`allowRelayFallback` 随 resolve 返回 | 移植逻辑（v1 只取快照 / 4xx 区分；直连 v2） |
| Singularity `HubApiClient.kt` | `GET /devices`、`PATCH`、`revoke`、`device-codes/confirm`、refresh cookie 捕获 | 移植逻辑（Desktop 无设备目录） |

### 1.4 差距（IDE 缺什么）

1. 全部数据面：TLS pin channel、`GetAuthNonce`/`DeviceAuth`、pairing、ticket、authority SNI。
2. 全部控制面：Hub 登录 / 会话、设备目录、ticket 签发、设备管理。
3. 身份与信任落盘：客户端 Ed25519 身份、Engine 信任锚、连接 profile。
4. 产品面：`ua.connection` pane 的真实内容、SAS 对话框、StatusBar 连接态、PRD 条目（现无 Hub 相关 PRD）。
5. 上游残差需知：Singularity 生产路径的 HubDevice **首配 pin 引导缺位**（`HubConnectionApiAdapter` 遇无 pin 直接「pair first」失败，仅 Android 直连有手填 pin）；Desktop 用 ADR-027「观测叶 + SAS 三票」闭合。本仓**采 Desktop 路径**，不等上游。

---

## 2. 目标 / 非目标

**目标（本稿）**

1. IDE 能以 Hub 账号登录、看到自己的 Engine 设备（两级状态诚实显示）、对某台设备完成「首配 SAS → Grant → 连接」，之后零交互重连。
2. 连接建立后交给 M6-A2：`isEngineConnected()` 为真、roster / 时间线走 UA；Hub 不出现在 roster 路径。
3. `DirectAddress`（手填 host:port）与 `HubDevice` 走同一套 TLS pin + Device Grant（ADR-261 单一认证模型）。
4. 密钥、trust、token 的落点与可见性有明确分层；renderer 永不见私钥 / access token / ticket。

**非目标**

| 不做 | 去哪 |
|------|------|
| Engine 侧 `hub-client`（隧道、heartbeat、enroll）或 Hub 服务端 | 外仓 |
| Hub 官网 / 管理面（admin 建号、用量） | 外仓 `connection-hub/web` |
| IPv6 GUA / 公网 IPv4 直连探测（ADR-374 D3/D8/D9） | **v2**（§3.8，切片 H6）；v1 只留 `ResolvedEndpoint` 形状与路径标签 |
| 静态 Bearer / `auth_token` 兼容 | 永久禁止（ADR-261） |
| 用 AHP tunnel / `agentHost` 的 relay 传输代替 Hub | 永久禁止（ADR-003 Decision 2） |
| Web / 远程窗口的 Hub 连接控件 | PRD-019：Web 形态 `IUniverseAgentConnection` 诚实 `disconnected`，不画控件 |
| 把 Hub 账号会话当「已连接引擎」 | Hub 登录态与引擎连接态是两个正交状态（§3.7） |

---

## 3. 设计

### 3.1 角色、信任域与不变量

```
信任域 A：Hub（账号 + 发现 + 传输）        信任域 B：Engine（访问授权，最终权威）
  IDE 登录态、设备目录、relay ticket           IDE 客户端公钥 Grant（Engine 本地）、SAS 首配
  → 让设备「可见」、让字节「可达」              → 让 IDE「可用」
```

沿用上游不变量，本仓落点：

| 上游 | 本仓翻译 |
|------|----------|
| **I1** CONNECTED 只能由 Engine `Connect` 握手成功确认 | = ADR-003 Decision 7；Hub 目录 ONLINE / ticket 签发成功 **都不**改变 `isEngineConnected()` |
| **I2** presence ≠ Engine 可用 | 设备列表按 §3.7 矩阵渲染；`NOT_SERVING` 行禁止连接按钮 |
| **I4** transport 重连 = **重新解析**（新 ticket）+ 新 channel；session 重附着 = 同 `engineSessionId` + `sessionVersion` 对账（stream-timeline 已落） | resolver 无缓存；`ResolvedEndpoint` 禁止持久化；重附着归 session-core，本稿不新造 |
| **I6** Grant 吊销 ≤30s 断连；Hub 设备吊销只拆隧道 | IDE 收到 `UNAUTHENTICATED` → `failed(grant_revoked)`，不自动重配；Hub 吊销 → transport 断 → 走 I4，目录 `revoked` → 拒绝重拨（INV-DC-6） |
| **I7** transcript 绑定 nonce + 观测指纹 | transcript 里的 `engineCertFingerprint` 用**本地 TLS 观测**的 leaf 指纹（Desktop SEC-3），不用 `AuthNonceResponse.engine_cert_fingerprint` 自述值；两者不一致 → fail-closed |

### 3.2 落层（ADR-003 的增量，不改其 Decision 编号）

```
src/vs/platform/universeAgent/
  common/
    universeAgentConnection.ts      (M6-A1) IUniverseAgentConnection — 本稿扩 connect(targetId)/disconnect/state
    connectionTarget.ts             ConnectionTarget · ConnectionProfile · ConnectionState · 失败码（TS 契约，无 DOM）
    hub.ts                          IUniverseAgentHubService 契约 · HubDevice DTO · HubAuthStatus · Hub 失败码
  node/
    deviceGrant/                    ← vendored Desktop：device-grant-crypto · tls-pin · observe-candidate-leaf（SYNC.md）
    hub/                            ← vendored Desktop：hub-auth-client · hub-relay-ticket-client · host-normalize（SYNC.md）
    hubDirectoryClient.ts           本仓新写：GET/PATCH devices · revoke · device-codes/confirm · refresh（移植 Singularity）
    hubSessionStore.ts              access 内存 + refresh/csrf 经 secret 存储（§3.5）
    clientIdentityStore.ts          Ed25519 身份（§3.6）
    engineTrustStore.ts             EngineTrustRecord 持久化（§3.6）
    connectionProfileStore.ts       ConnectionProfile 持久化（§3.6）
    connectionResolver.ts           本仓新写：target → ResolvedEndpoint（§3.4；移植 Singularity 顺序）
    pairingOrchestrator.ts          改写 Desktop ADR-027 S1–S7（§3.4）
    universeAgentChannel.ts         (M6-A1) 增 pinned TLS + ssl_target_name_override 分支
  electron-browser/
    universeAgentConnectionService.ts (M6-A1 ProxyChannel) — 同一代理增 hub 面方法与事件
```

- 全部 HTTP / TLS / crypto / 密钥在 **`node`**，与 gRPC channel **同一宿主进程**。renderer 只见 `common` 契约 + 代理。
- **宿主进程裁定（2026-09-02，用户委托「架构你定」；同时供 M6-A1 采用，写入 ADR-003 审查记录）：v1 = electron-main。** 理由：① 身份私钥的解密只能靠 `safeStorage`，其原生宿主就是 main（`IEncryptionMainService`），选 main 则密钥材料**零跨进程传递**；② Desktop 同款（全部在 Electron Main），donor 代码零改动落位；③ vscode 已有 `registerMainProcessRemoteService` / ProxyChannel 惯例，renderer 代理装配最短；④ ADR-003 只禁止复用 agentHost UtilityProcess，未要求新建 utility。**约束**：`platform/universeAgent/node/**` 必须保持进程无关（不 import `electron`、不持 `BrowserWindow`），装配只在 `electron-main/universeAgentMainService.ts`；session-core fold 与 gRPC 流处理若实测拖慢 main（阈值：单帧 fold > 16 ms 或 main 事件循环 lag 告警），迁到独立 UtilityProcess 只改 `electron-main` 装配 + 一层 MessagePort，不改 `node`。**不选 shared process**（它是 renderer 语义的 utility，且无 `safeStorage`）。
- **「进程无关」如何守住：** 扩 S1 的 platform boundary 测（`test/node/universeAgentImportBoundaries`）增两条断言——`platform/universeAgent/node/**` 生产文件禁 import `electron`、`vs/platform/*/electron-main/**`、`vs/base/parts/sandbox/electron-main/**`；`platform/universeAgent/electron-main/**` 是唯一允许同时 import `node/**` 与 `electron` 的目录。**迁移阈值如何测：** ① 单测层用 `sessionCore` 现有 fixture 跑 1,000 回合 `historyResult` fold 计时（PRD-020 上限）→ 单帧 > 16 ms 记入 evidence；② 冒烟层 main 进程挂 `perf_hooks.monitorEventLoopDelay()`，连接 + 首屏 history 期间 p99 > 50 ms 记为触发。两项任一触发即开「迁 UtilityProcess」切片，不阻塞 v1。
- 命名不得含 `agentHost`；不 import `platform/agentHost/**` 的 tunnel / relay 传输。
- `contrib/conversation` 只依赖 `common`（经代理）；`ua.connection` pane 注入 `IUniverseAgentHubService` + `IUniverseAgentConnection`。
- 分层门与 M6 相同：ESLint `local/code-layering` + S1 boundary 测（`workbench/**`、`sessions/**` 禁 import `platform/universeAgent/node/**`）。

### 3.3 领域模型（TS 契约）

```ts
// common/connectionTarget.ts
type ConnectionTarget =
  | { kind: 'loopback'; socketOrPort: ... }                                   // M6-A1 已有形态（UDS / 127.0.0.1，skip-auth）
  | { kind: 'directAddress'; host: string; port: number }                     // 手填；同一套 Grant
  | { kind: 'hubDevice'; hubBaseUrl: string; accountId: string; hubDeviceId: string };

interface EngineTrustRecord {            // 信任锚 = leaf DER 本体；指纹为派生冗余，加载自检
  leafDer: Uint8Array; leafSha256Hex: string; engineIdentityId: string;
  establishedAt: number; establishedVia: 'sas';
}

interface ConnectionProfile {            // 持久化（§3.6）；不含 token / ticket / 私钥
  profileId: string; displayName: string; target: ConnectionTarget;
  trust: EngineTrustRecord | null;       // 远程形态 null ⇒ 常规拨号 fail-closed（trust_missing）→ 走 pairing
  state: 'active' | 'pairingPending' | 'revoked' | 'disabled';
  allowPrivateNetwork: boolean;          // 默认 false：directAddress / hubDevice 解析出的 RFC1918 / ULA / loopback 地址一律拒拨（failed: private_network_denied）；
                                         // 只能由用户在 pane 显式勾选，renderer 不得代填（Desktop network-policy 同款）；loopback 形态不受此约束
}

interface ResolvedEndpoint {             // 仅内存、单次 attempt、禁止持久化
  attemptId: string; authority: string; port: number; resolvedIp: string;
  servername: string;                    // 中继 = r-<nonce> authority；直连 = host
  relayTicketId: string | null;          // null ⇒ 路径标签「Direct」，否则「Hub relay」
  tls: { trustAnchorLeafDer: Uint8Array; expectedLeafSha256Hex: string; hostnameVerification: 'replaced-by-pin' } | null;
  expiresAtMs: number;
}

type ConnectionPhase =                   // 对齐上游 ClientConnection；不新增 RECONNECTING
  | { kind: 'disconnected' }
  | { kind: 'connecting'; reason: 'initial' | 'transport_lost' }
  | { kind: 'connected'; path: 'direct' | 'hubRelay' | 'loopback' }
  | { kind: 'failed'; code: ConnectionFailureCode; reason: string }
  | { kind: 'closed' };

interface ConnectionState {
  phase: ConnectionPhase;
  pairing: { sasCode: string; engineIdentityId: string; leafSha256Hex: string; displayName: string } | null; // 非 phase；pairing-pending ≠ connected
}
```

失败码闭集（renderer 只按码画文案，不解析 reason）：`trust_missing` · `private_network_denied` · `pairing_required` · `sas_mismatch` · `grant_pending`（Engine 尚未批准）· `grant_revoked` · `pin_mismatch` · `hub_session_required` · `hub_password_change_required` · `hub_auth_expired`（4xx，≠ 不可达）· `hub_unreachable` · `hub_device_not_in_directory` · `hub_device_revoked` · `engine_not_serving` · `hub_ticket_failed` · `hub_rate_limited` · `transport_failed`。

**对上游 `ClientConnection` 转换表（architecture.md §2.2）逐行映射，确认无漏格：**

| 上游转换 | 本仓 `ConnectionPhase` / 失败码 |
|----------|-------------------------------|
| 初始 → CONNECTING(initial) | `connecting{initial}` |
| CONNECTING → FAILED（TLS / pin 失败） | `failed{pin_mismatch}`；SNI / 握手超时 → `failed{transport_failed}` |
| CONNECTING → FAILED（验签失败） | Grant 缺失 → `failed{pairing_required}`（同时 `pairing` sidecar 置位）；Grant 吊销 → `failed{grant_revoked}` |
| CONNECTING → FAILED（超时） | `failed{transport_failed}` |
| CONNECTING → CONNECTED（Connect 握手成功） | `connected{path}` |
| CONNECTED → CONNECTING(transport_lost) | `connecting{transport_lost}` |
| CONNECTED → CLOSED（用户断开 / 删除 Agent Session） | `closed`；删除 Agent Session 属 M6-A2 roster 语义，不改 phase 以外的状态 |
| FAILED → CONNECTING(initial)（用户重试） | `connecting{initial}` |
| FAILED / CLOSED 终态 | 仅可新建 attempt（新 `ResolvedEndpoint`） |
| （上游未列）解析阶段失败 | 本仓在 CONNECTING 内细分：`hub_*` / `engine_not_serving` / `trust_missing` / `private_network_denied` 均为 `failed{…}`，不新增 phase |

presence 矩阵（§3.7）三行 × 两列全部有对应格；上游无 pairing 状态，本仓以 `pairing` sidecar 表达且**不改 phase**——与 Desktop `profile.state='pairingPending'` 同思路。

`IUniverseAgentHubService`（common）：`login(hubBaseUrl, email, password)` · `logout()` · `changePassword()` · `getAuthStatus(): signedOut | signedIn{email} | mustChangePassword` · `listDevices()` · `renameDevice()` · `revokeDevice()` · `confirmDeviceCode(code)` · `onDidChangeAuthStatus` · `onDidChangeDirectory`。**不**暴露 token / csrf / ticket。

### 3.4 拨号与认证序列

**A. 已配对（`profile.trust != null`）——日常连接，零交互**

```
connect(profileId)
 1. resolver：
    hubDevice → GET /devices（live）
        成功且含 id 且 !revoked → presence/engine_status 判定（§3.7）→ POST /relay-tickets → authority
        成功但 id 缺失 / revoked → failed(hub_device_not_in_directory | hub_device_revoked)（禁止用快照拨旧地址，INV-DC-6）
        401/403 → hub_auth_expired（v1 无直连 ⇒ 直接 failed；v2 可快照直连、不签 ticket）
        网络错 → hub_unreachable（v1 直接 failed；v2 同上）
    directAddress → 直接 host:port，无 ticket
 2. channel：DNS 解析 authority → resolvedIp；TLS：ca = trust.leafDer（PEM），checkServerIdentity = 比对 sha256(leaf DER) == trust.leafSha256Hex；
    servername / grpc.ssl_target_name_override = authority（中继）或 host（直连）；默认 hostname 校验被 pin 取代（S21）
 3. SystemService.GetAuthNonce{client_identity_id, client_public_key}
 4. transcript = engineIdentityId ‖ 观测 leaf 指纹 ‖ auth_nonce ‖ clientIdentityId ‖ "1"；Ed25519 签名
 5. SystemService.Connect{…, device_auth}
      session_token 非空 → phase=connected(path)；isEngineConnected()=true；交 M6-A2
      pairing_nonce 非空、无 token → 意外（trust 已在却未获 Grant，如 Engine 重装）→ phase=failed(grant_pending)，pairing 提示重配；不静默进 pairing
      UNAUTHENTICATED → failed(grant_revoked)
 6. transport 断 → phase=connecting(transport_lost) → 回到 1（新 ticket、新 channel）；session 重附着由 session-core 按 sessionVersion 对账
```

**B. 首配（`profile.trust == null`）——pairing orchestrator（照抄 Desktop ADR-027 S1–S7）**

| 阶段 | 做什么 | 备注 |
|------|--------|------|
| S0 | 用户在 `ua.connection` 显式点「连接」某 `hubDevice` / `directAddress` | 无自动拨号 |
| S1 | 观测候选叶：Hub → **先签一张 ticket**，TLS 到 authority，`rejectUnauthorized:false` 仅取 leaf DER，立即断；直连 → 到 host:port 同上 | 目录 `certFingerprint` 只作**交叉校验提示**（不一致 → 警示但以 SAS 为准），**不作信任锚** |
| S2–S4 | provisional pin = 观测叶；**新 ticket** 建 channel；只跑 `GetAuthNonce` + `Connect`（`supported_tools=[]`）；期望 `pairing_nonce + sas_code` | S4 若意外拿到 `session_token`：**丢弃、不 install**，进 `recoverTrust`（Desktop ADR-031：展示 identity + 指纹让用户人工确认后写 trust，0× SAS） |
| S5 | 本地重算 SAS（`engineIdentityId ‖ 观测指纹 ‖ clientPublicKey ‖ pairing_nonce ‖ "1"`）；与 `sas_code` 不等 → `sas_mismatch` fail-closed；相等 → **原生 `IDialogService` 确认框**显示 `XXXX-XXXX`，按钮仅「已在 Engine 上核对一致」/「取消」，**无跳过** | 用户在 Engine 侧（CLI / 本地 DeviceService）核对同一码并批准 Grant |
| S6–S7 | **新 ticket** 正式 Connect（序列 A 第 2–5 步）；拿到 `session_token` → 原子写 `EngineTrustRecord` + `profile.state=active`；仍 `pairing_nonce` → `grant_pending`（提示「Engine 尚未批准，批准后再点确认」，可重试） | Hub 首配共**三票**（observe / provisional / commit，authority 各不同）；直连无票 |

不一致 / 取消：不落 trust；3 次失败按 Engine 冷却 10 min 的返回诚实转述。**重配对** = 用户显式「忘记此 Engine」删 trust → 走 B。

### 3.5 Hub 会话（登录、token 落点）

| 项 | 裁定 | 理由 |
|----|------|------|
| access token | **仅内存**（node 宿主），随 `hubBaseUrl` 分桶；`expiresAtMs` 由 `expiresIn` 推导 | Desktop ADR-026 同款 |
| refresh + csrf | **加密持久化**（main 侧等价 secret 存储，见 §3.6 落点行；加密不可用则内存、并诚实提示「重启需重登」）；`POST /auth/refresh` 单飞、按需（access 过期或 401 一次） | **与 Desktop 不同、与 Singularity 相同**：Hub access 默认 **15 min**，IDE 进程长命且 I4 自动重连每次要新 ticket；不持久化 refresh 会让每次网络抖动都变成「请重新登录」 |
| logout | `POST /auth/logout`（Bearer）+ 清内存 + 删 secret + 清目录快照；**不删**身份私钥与 trust（另有「忘记此 Engine」） | 上游 §1.4 本地数据边界 |
| `mustChangePassword` | 存会话但 `hub_password_change_required`：禁 ticket、禁目录写操作；pane 引导改密 | ADR-318 |
| renderer 可见 | 仅 `HubAuthStatus`（`signedOut | signedIn{email} | mustChangePassword`） | 无 token / cookie / csrf 过 IPC |
| email / password | 只在一次 invoke 入参 transit；不落任何存储 | |

### 3.6 密钥、信任与 profile 落盘

| 对象 | 落点 | 可见性 |
|------|------|--------|
| 客户端 Ed25519 身份（`clientIdentityId = sha256(pubkey)`；**每 IDE 安装一把**，非每 Engine 一把）与 Hub refresh / csrf | pkcs8 DER / token 经 **`IEncryptionMainService.encrypt`（safeStorage）** 后写 **`IApplicationStorageMainService`**（`APPLICATION` / `MACHINE`，键前缀 `universeAgent.secret.`）——这是 renderer 侧 `BaseSecretStorageService` 的同一落点与同一加密源，但**不复用** renderer 的 `ISecretStorageService` 实例（宿主是 main，见 §3.2）；`isEncryptionAvailable()===false` → 身份**不生成**、refresh 只留内存，Connection pane 诚实报错（对齐 ADR-261 §5「无桌面 session 显式报错」） | 仅 main 宿主 |
| `EngineTrustRecord[]` | `IStorageService` `APPLICATION` / `MACHINE`（公开指纹 + leaf DER，非机密；键按 `engineIdentityId`） | 指纹 / identity 可给 renderer 展示 |
| `ConnectionProfile[]` | 同上（含 `hubBaseUrl`、`hubDeviceId`、`displayName`、`trust`、`state`）；**不**进 `settings.json`（page-access §1.1 / §15 B8 已钉「零 `ua.connection.*` setting key」） | 列表投影给 pane |
| Hub 目录快照 | `APPLICATION` storage，key 按 `hubBaseUrl+accountId` 分域，条目按 `lastHeartbeatAt` 30 天时效（ADR-375 D2）；v1 只用于 pane 离线展示，**不用于拨号**（直连 v2 才用） | 可给 pane |
| `ResolvedEndpoint` / ticket / nonce / session_token | **禁止持久化**；session_token 仅 channel metadata | 不过 IPC |

「忘记此 Engine」= 删 trust + profile；不动身份私钥。「删除身份」= 独立危险操作，删后所有 Engine 需重配（Grant 键即公钥）。

### 3.7 两个正交状态与 presence 矩阵

**Hub 账号状态**（pane 顶部）与 **引擎连接状态**（StatusBar / pane 设备行）**各说各的**，与 PRD-007 验收 4 的「连接级 vs 会话级」再叠一层：

| 层 | 值域 | 显示位置 |
|----|------|----------|
| Hub 账号 | signedOut / signedIn / mustChangePassword / authExpired | `ua.connection` 顶部 |
| 连接级（引擎） | `ConnectionPhase` + path | StatusBar 芯片（B10：connected → Engine pane，否则 Connection pane）· pane 设备行 |
| 会话级 | 未连接 / 同步中 / 已连接 / 降级 / 已断开（stream-timeline） | 会话标题条（不变） |

设备行渲染（上游 frontend §1.2；v1 无直连，所以 OFFLINE 一律不可连）：

| presence | engine_status | 显示 | 「连接」按钮 |
|----------|---------------|------|--------------|
| OFFLINE | — | 「离线（经由 Hub 不可达）」 | 否（v2 有合格直连候选时可试，且不签 ticket） |
| ONLINE | NOT_SERVING | 「Engine 异常」 | 否 |
| ONLINE | SERVING | 「可用」 | 是 |
| `revoked` | — | 「已吊销」 | 否；已有 profile 标 `revoked` |
| 目录 401/403 | — | 顶部「Hub 登录已过期」+ 行灰显 | 否（不得写成「Hub 不可达」） |
| 目录网络错 | — | 「Hub 不可达」+ 快照灰显 | 否 |

已 `connected` 的会话在 presence 变 OFFLINE / NOT_SERVING 时**不主动断开**，等 transport 失败再转 `connecting(transport_lost)` / `failed`。

### 3.8 直连（ADR-374）处置

先分清两个词：**`DirectAddress`** = 用户手填 `host:port` 的调试 / LAN / 降级入口，属上游 **Phase 0** 既有功能（`ConnectionTarget.DirectAddress`，Singularity / Desktop `directRemote` 均已落），不涉及 Hub、不签 ticket，认证与中继完全同套；**「直连」（ADR-374）** = `HubDevice` 目标下由 Hub 目录广告的 GUA / 公网 IPv4 候选**自动**优先探测、失败回落中继，属上游 **Phase 3**、HUMAN 未签。本节只裁后者。

v1 **中继 + DirectAddress**，GUA 直连留 v2。理由：上游直连整项「不勾」（HUMAN S* 未签）；Desktop 亦为 relay-only；IDE 首要目标是把 M6 接通到远程 Engine，不该同时背两条未验路径。v1 必须为 v2 预留：`ResolvedEndpoint.relayTicketId: string | null` 与 `ConnectionPhase.connected.path`；resolver 的返回值携带 `allowRelayFallback`（不作 resolver 状态，Singularity INV-DC-5）。v2（切片 H6）按 ADR-374 D3 顺序：短超时 TLS+pin 探测 GUA / 公网 IPv4 → 失败才签 ticket；OFFLINE / 4xx / Hub-down 用快照直连、不签 ticket；`TeardownHubDirect` 的 `direct-address` header 语义按 ADR-375 D1。

### 3.9 Web / 远程窗口

`platform/universeAgent/node` 不在 Web 形态加载；`IUniverseAgentConnection` 在 Web 报 `disconnected`，`IUniverseAgentHubService` 报 `unavailable`，`ua.connection` pane 显示「本形态不支持连接引擎」，不画登录表单（PRD-019 / D15）。

### 3.10 绕过分析（规则 16 第四轮要求写明）

| 攻击面 | 路径 | 结论 |
|--------|------|------|
| 同机其他进程读 storage DB 取 refresh / 私钥 | 值经 `safeStorage` 加密：Linux 依赖 libsecret / kwallet 的用户会话解锁，macOS Keychain 按应用 ACL，Windows DPAPI 按用户。**同用户恶意进程可解密**——与 vscode 自身 `BaseSecretStorageService`（扩展 token）、Desktop `SecretStore`、Singularity keyring 处于同一残余风险面 | **接受，不扩大**：refresh 可由 Hub logout / admin 吊销；Hub 侧 spent-refresh 重放在 grace 外触发 sibling 吊销（上游 HW-P1-4）；私钥泄露 = 攻击者可冒充本 IDE 对已 Grant 的 Engine，与任何客户端设备失陷等价，Engine 侧「吊销设备」是既有对策（ADR-261 §4） |
| 恶意 Hub 在 `AuthNonceResponse.engine_cert_fingerprint` 塞假指纹 | transcript 只用**本地 TLS 观测**的 leaf 指纹；自述值 ≠ 观测值 → fail-closed | **未发现绕过** |
| 恶意 Hub 在目录 `certFingerprint` 塞假指纹诱导 pin | 目录值只作提示，不写 trust；trust 只在 SAS 人工核对通过后由**观测叶**写入；SAS 输入串含 `engineCertFingerprint`，假指纹使双端 SAS 不等 | **未发现绕过**（残余 = 用户不核对 SAS 直接点确认，与上游 S4 同） |
| 中继 authority 的 DNS 被劫持到攻击者 IP | TLS pin 到 Engine leaf；攻击者无 Engine 私钥 → 握手失败 `pin_mismatch` | **未发现绕过** |
| S4 provisional 通道意外返回 `session_token` | 丢弃、不 install、进 recoverTrust；期间 `isEngineConnected()` 恒 false | **未发现绕过** |
| 目录快照拨过期 / 已吊销地址 | v1 快照**不用于拨号**；live 目录缺 id / revoked 直接拒绝（INV-DC-6） | **未发现绕过**（v2 直连启用时须重审） |
| renderer 被攻破读 token / 私钥 | ProxyChannel 契约不含任何 secret 字段；`common` 无 secret 类型；序列化面测试断言 | **未发现绕过** |
| 重放旧 `DeviceAuth` | `auth_nonce` 单次 + TTL 5 min，Engine 侧作废（ADR-261 I7）；IDE 不缓存签名 | **未发现绕过**（Engine 侧保证，本仓只测「不复用」） |

### 3.11 与 M6 的接缝

- M6-A1 的 `IUniverseAgentConnection` 今天只需 loopback；本稿把 `connect(target)` 抽象为 `connect(profileId)` + resolver，loopback 是 `ConnectionTarget.loopback` 一种，**skip-auth 只允许 loopback / UDS**（非 loopback 一律 DeviceAuth，ADR-261）。
- M6-A2 roster 只看 `isEngineConnected()` 与 channel；Hub 登录态、pairing 态对 roster 不可见。首次 `SessionService.List` 前不投影 stub 种子（ADR-003 Decision 7）— 对 Hub 连接同样成立。
- 断连回退（M6 §6）对 Hub 路径无新增：中继断 = transport 断。

---

## 4. 产品面

### 4.1 需求条目（规则 10a：实施前先落 `requirements.md`，本稿只给草案）

**PRD-024 远程引擎连接（Connection Hub）— `proposed`**（编号：PRD-022 / 023 已被 navigator-engine-segments / sources-review-progress 占用；落 `requirements.md` 时以当时下一空号为准）

- 用户价值：用户在 IDE 里用 Hub 账号找到自己的 Engine 设备并安全连接，不装 VPN、不填 IP；首配需人工核对一次短码，之后零交互。
- 用户可观察陈述：Connection 页能登录 Hub、列出设备（离线 / Engine 异常 / 可用三态）、对可用设备发起连接；首配弹出 8 字符 SAS 需与 Engine 端核对，无「跳过」；连接成功后状态栏显示引擎名与路径（「Engine · Hub relay」/「Engine · Direct」）——**连接级不使用「已连接」措辞**，该词按 PRD-007 验收 4 仅归会话标题条；Hub 登录过期与 Hub 不可达文案不同。
- 验收标准（草案）：① 未登录 / 登录过期 / 不可达三种 Hub 态文案互不混用；② `NOT_SERVING` 设备无连接按钮；③ SAS 对话框无跳过，取消不写 trust；④ 错误 pin 握手失败、正确 pin 成功、nonce 主机名不妨碍握手（S21）；⑤ 重启 IDE 后已配对设备重连无 SAS；⑥ 状态栏文案集合中不含「已连接 / connected」字样；Hub 登录态为真但引擎未连时，状态栏仍为「Engine not connected」且会话标题条不出现「已连接」；⑦ Web 形态不画连接控件。
- 可测方式：①②③⑥⑦ 单测（pane / StatusBar 文案表 + 负向断言）；④ mock TLS 单测；⑤ 隔离 profile 重启冒烟（真 Hub）。
- 依赖：PRD-008（M6-A1/A2）；上游 Hub 部署与 Engine `--hub --enroll`。

同时 `traceability.md` 加行；`docs/glossary.md` 增「Hub / Client 设备 / SAS / Grant」四词条链到本稿与外仓。

### 4.2 `ua.connection` pane 内容（替换今日占位；宿主与 id 不变）

| 区 | 内容 | 空 / 错误态 |
|----|------|-------------|
| Hub 账号 | `hubBaseUrl` 输入（默认空，无预填）、邮箱 / 密码、登录 / 注销 / 改密；状态徽标 | 未登录：只显示表单；加密不可用：提示重启需重登 |
| 设备列表 | §3.7 矩阵；重命名 / 吊销（二次确认）/ 「确认设备码」入口 | 未登录：整节省略；目录失败：按 §3.7 文案 |
| Direct Address | host:port 添加（定位调试 / 降级，不是主路径；默认拒 RFC1918 除非显式勾 `allowPrivateNetwork`） | — |
| 连接 profiles | 已配对 / 待配对 / 已吊销列表；「连接 / 断开 / 忘记此 Engine」 | 空：「No connection profiles yet」（现文案保留） |
| Test Connection | 改为对**当前 active profile** 跑序列 A 第 1–3 步（不 Connect），报告到 `GetAuthNonce` 成功与否；无 profile 时仍「Not connected — no engine.」 | 不假成功 |
| Remote I/O 提示 | 连接远程 Engine 时文件 / Shell 在**本机**执行的说明（上游 §4.3） | 常显一行 |

SAS 对话框：`IDialogService.prompt`，正文含 Engine 显示名、`XXXX-XXXX`、`engineIdentityId` 前 8 位；按钮「已核对一致」/「取消」；**不含**「跳过」「信任」之类第三按钮。

StatusBar：沿用 B10 command；文案随 `ConnectionPhase`：`disconnected` → 「Engine not connected」；`connecting(initial)` → 「Connecting…」；`connecting(transport_lost)` → 「Reconnecting…」；`connected` → 「Engine · Hub relay」/「Engine · Direct」；`failed(code)` → 码对应短句。**pairing 中仍是「Engine not connected」**。

---

## 5. 切片（串行依赖；冲突域标注）

```
H0（docs：PRD-024 / traceability / glossary / ADR-003 审查记录）—— 先于一切 H*，独立开刀
  → M6-A1（gRPC 宿主 + loopback）─┬─ H1 crypto / trust / hub http（node，独立文件，可与 A1 并行）
                                  └─ H2 pinned channel + DeviceAuth（需 A1 channel 工厂）
                                       → H3 Hub 目录 + resolver + ticket + 重连
                                         → H4a ua.connection pane + SAS 对话框（不碰 StatusBar；可与 M6-A2 并行）
                                             → H4b StatusBar 文案随 ConnectionPhase（排 M6-B 之后，同文件单写者）
                                               → H5 DirectAddress
                                                 → H6 直连 GUA（v2，ADR-374 上游签收后）
```

H4a 的关门不依赖 StatusBar：pane 自身显示 `ConnectionPhase`，PRD-024 验收 ⑥ 里的「状态栏」在 H4b 前以「状态栏仍显示『Engine not connected』」为通过条件。

| 切片 | 做什么 | 验证 | 冲突域 |
|------|--------|------|--------|
| **H0** **已落** @ `01cd5018` | PRD-024 `proposed`（编号以落盘时下一空号为准）、traceability、glossary；ADR-003 审查记录已补「宿主 = electron-main；Hub 客户端同宿主」（本轮已写入，H0 只需核对） | `check-docs-health.py` 0 warning | docs（`requirements.md` / `traceability.md` 当前有 W3-r 在途改动，H0 须等其合入或同一写者） |
| **H1** **已落** @ `058ed9d0` | vendor Desktop `deviceGrant/**`、`hub/**`（sync 脚本 + `SYNC.md`）；`clientIdentityStore` / `engineTrustStore` / `connectionProfileStore` / `hubSessionStore`（含 refresh）；`hubDirectoryClient` | **KAT-1 / KAT-2** 断言（SAS 码 `0H4X-JVFQ` / `C1RD-95QA`，transcript sha256 对齐 ADR-261 §3b）；AuthSession / ticket 合同负例；refresh 单飞；secret 不可用 fail-closed | `platform/universeAgent/node/{deviceGrant,hub,*Store,hubDirectoryClient}.ts`；`package.json`（若需 sync 脚本依赖） |
| **H1a** **已落** @ `321a4e0b` | electron-main 装配加密 `HubSessionStore` / `ClientIdentityStore`（§3.5 / §3.6）；`loginHub` 解析 `hub_refresh` Set-Cookie → `applyAuthSession` 加密落盘；不可加密时 refresh / 身份**不落盘**、pane 诚实报错。**不含**启动 `refreshIfNeeded` 恢复（槽 A） | `hubSessionStore.test.ts`：加密落盘 / `clear` 删 secret / 不可用时不 persist；`ClientIdentityStore` 不可用时不 persist | `electron-main/universeAgentMainService.ts`、`node/hub/hub-auth-client.ts` |
| **H2** **已落** @ `18da9100` | `universeAgentChannel` 增 pinned TLS 分支（leaf DER 为 ca + `checkServerIdentity` 指纹 + `ssl_target_name_override`）；`GetAuthNonce` + `DeviceAuth` Connect；`pairingOrchestrator`（S1–S7 + recoverTrust） | mock TLS server：错误 pin 失败 / 正确 pin 成功 / nonce 主机名不妨碍（S21）；观测指纹 ≠ 自述指纹 → fail-closed；pairing 返回不置 connected；S4 意外 token 不 install | `universeAgentChannel.ts`（与 A1 共文件，**A1 合入后**开） |
| **H3** **已落** @ `7ebd7618` | `connectionResolver`（live 目录判定、ticket、4xx / 网络错分流、`allowRelayFallback` 随返回）；transport 断 → 重新解析；`IUniverseAgentConnection.connect(profileId)` | 单测：目录缺 id / revoked 拒拨；401 → `hub_auth_expired` 且不签 ticket；ticket TTL 过期不复用；重连产生新 ticket | `connectionResolver.ts`、`universeAgentConnection*.ts` |
| **H4a** **已落** @ `127c0586` | pane 四区 + SAS 对话框；ProxyChannel 增 hub 面；**不改** StatusBar | `connectionPreferencesPane.test.ts` 扩：矩阵六行文案、SAS 无第三按钮、Hub 登录态不改 `isEngineConnected`；`conversationSessionStatusBar` 既有测加一条负向断言「Hub signedIn + `connected` 前，entry 文案仍 `Engine not connected`」；隔离 profile 冒烟对**真 Hub**（`connection-hub` 本地 `go run` + Engine `--hub --enroll`）：登录 → 列表 → SAS → 连接 → roster 出现 UA 会话（需 M6-A2 已合入；否则只验到 `connected`） | `contrib/conversation/browser/connectionPreferencesPane*.ts`、`common/uaPreferencesPanes.ts`、`electron-browser` 代理 |
| **H4b** **已落** @ `dd28cbc3` | StatusBar 文案随 `ConnectionPhase`（§4.2）；B10 command 不变 | `conversationSessionStatusBar` 单测：六态文案；pairing 中仍「Engine not connected」 | `conversationSessionStatusBar.ts`（**排 M6-B 之后**，同文件单写者） |
| **H5** **已落** @ `83df4497` | DirectAddress 添加 / 配对 / 连接；`allowPrivateNetwork` | 无 ticket 路径；RFC1918 默认拒 | pane + resolver |
| **H6**（v2） | GUA / 公网 IPv4 探测优先、快照直连、`TeardownHubDirect` header、路径标签「Direct」 | 上游 ADR-374 S13 环境矩阵 | resolver + channel |

**已落：** **H0–H5**（`058ed9d0`–`83df4497`；H0 知识层 @ `01cd5018`）。**H6** 仍 v2。H4a **真 Hub 冒烟**（`dev/progress/h4a-evidence/`）与 PRD-024 升 `implemented` **未签收**。

PRD-008 升 `implemented` 的启动冒烟证据可来自 loopback（M6-A2）；**PRD-024 的证据必须来自 H4a 真 Hub 冒烟**，两者不互替。

---

## 6. 验证总表

| 项 | 方式 |
|----|------|
| 加密向量一致 | KAT-1 / KAT-2（ADR-261 §3b）单测；任一不等即阻塞 H2 |
| pin / hostname 契约（S21） | 自签 mock Engine：错误 pin 失败、正确 pin 成功、SNI 为随机 `r-…` 时握手成功 |
| 重放（S7） | 同一 `auth_nonce` 二次 Connect 必 `UNAUTHENTICATED`（对真 Engine） |
| 连接态诚实 | pairing-pending / Hub signedIn / ticket 成功三者下 `isEngineConnected()===false` |
| 断连语义 | transport 断后 `connecting(transport_lost)`；resolver 被再次调用且签新 ticket；UA 会话 id 不回填 stub 种子（M6 §6 既有测） |
| 秘密不过边界 | ProxyChannel 契约测：序列化面无 `accessToken` / `csrf` / `ticketId` / 私钥字段 |
| 分层 | `npm run eslint`（`code-layering`）+ S1 boundary 测 |
| 产品冒烟 | 隔离 profile + 真 Hub + 真 Engine：PRD-024 验收 ①–⑥；证据目录 `dev/progress/h4a-evidence/` |

---

## 7. 风险与开放问题

| # | 风险 / 问题 | 处置 |
|---|-------------|------|
| R1 | 上游 Phase 1/2 **HUMAN S\* 未签**（S1/S18/S21 等）；本仓接入不等于 Hub 已验收 | 本稿与 PRD-024 均写明依赖外仓 `phase-connection-hub` h1；本仓证据只证明 IDE 客户端行为 |
| R2 | 宿主 = electron-main（§3.2 已裁）可能拖慢主进程 | `node/**` 保持进程无关；实测阈值（单帧 fold > 16 ms / main 事件循环 lag 告警）触发即迁 UtilityProcess，只改 `electron-main` 装配；M6-A1 实施时在 mock channel 单测外加一条 main lag 采样 |
| R3 | 首配三票消耗 Hub `relayTicketRateLimit` | 与上游 Desktop 同款；pane 对 429 显示 `Retry-After` |
| R4 | `@grpc/grpc-js` 打包与 `protobufjs` allowScripts=false | 归 M6-A1；本稿不新增 native 依赖（Ed25519 用 `node:crypto`） |
| R5 | 企业代理 / 自签 Hub 证书 | Hub 控制面 WebPKI（上游 ADR-277 拒 Hub pin）；v1 不做代理配置，跟随 Node 默认；失败码 `hub_unreachable` |
| R6 | Desktop `pairing-orchestrator.ts` 1130 行、深耦合 | 只搬序列与 typestate，不 vendor；H2 单测覆盖 S1–S7 各出口 |
| R7 | 与 Singularity 差异：Singularity 首配 pin 引导缺位、Desktop 无目录列表 | IDE = Desktop 首配 + Singularity 目录；两处差异在 §1.3 / §1.4 已登记，不在本仓修上游 |
| Q1 | `hubBaseUrl` 是否允许多 Hub | v1 单 Hub（一个 signedIn 桶）；`ConnectionProfile.target.hubBaseUrl` 已可多值，多 Hub 只需 pane 支持 |
| Q2 | Engine 侧批准 Grant 的用户路径（CLI `grant approve` / 本地 DeviceService） | 属 Engine UX；pane 只转述 `grant_pending` 并给外仓文档链接 |
| Q3 | `session_token` 生命周期与刷新 | 外仓未见刷新 RPC；transport 存续期内 token 有效；断连即重握手（I4） |

---

## 8. 知识层回填（实施 commit 时，不在本稿）

- `docs/reference/universe-agent/hub-control-plane-surface.md`（REST 端点 / DTO / §3.1 secret 落盘）**@ H1a / 槽 D**；`engine-protocol-surface.md` §1 补 `SystemService.GetAuthNonce` / `Connect.device_auth` / `ConnectResponse.pairing_nonce, sas_code` 行。
- `docs/systems/conversation/stub-and-fixtures.md` §5 连接态映射补 Hub secret 落盘 / 加密不可用矩阵 **@ H1a / 槽 D**。
- `docs/reference/code-oss-b2/settings-ua-access.md` §7 Connection 空态改为本稿 §4.2 事实。
- `docs/modules/platform/overview.md` `platform/universeAgent` 条目补 secret 落盘与 electron-main 装配 **@ H1a / 槽 D**。
- `docs/glossary.md`：Hub、Client 设备、SAS、Grant、DirectAddress。
- [ADR-003](../decisions/003-engine-adapter-boundary.md) 审查记录：宿主进程 + 「Hub 客户端同宿主」。

---

## 相关文档

- [ADR-003](../decisions/003-engine-adapter-boundary.md)（审查记录：宿主 = electron-main） · [m6-engine-wave](m6-engine-wave.md) · [conversation-stream-timeline](conversation-stream-timeline.md)
- [page-access-schemes](page-access-schemes.md) §2.2 / §15.10 · [settings-two-surfaces](settings-two-surfaces.md)
- [PRD-007](../../docs/product/requirements.md#prd-007-诚实降级) · [PRD-008](../../docs/product/requirements.md#prd-008-引擎与会话权威) · [PRD-019](../../docs/product/requirements.md#prd-019-web--远程窗口一致性)
- [engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md)
- 外仓只读：`UniverseAgent/dev/plans/connection-hub/*.md` · `UniverseAgent/dev/decisions/261-engine-device-grant-auth.md` · `UniverseAgent/dev/decisions/374-direct-connector-positioning.md` · `UniverseAgent/dev/decisions/375-direct-connect-teardown-trust-and-snapshot-lifecycle.md` · `UniverseAgentDesktop/docs/architecture/connection-and-auth.md` · `UniverseAgentDesktop/dev/decisions/{025,026,027,031}-*.md`（031 = recoverTrust）

## 审查记录（规则 16）

- 2026-09-02：发现稿 `draft`（主仓 working tree）。分析来源：上游 connection-hub 三稿 + ADR-261/318/374/375 + proto；Desktop `apps/desktop/src/main/engine/**`；Singularity `ConnectionResolver.kt` / `HubApiClient.kt` / `HubConnectionApiAdapter.kt`；本仓 HEAD `platform/universeAgent`、`connectionPreferencesPane.ts`。

**2026-09-02 第一轮：** 用户授权「用 Cursor CLI Grok 审查，架构由本会话裁定」。Cursor CLI（`agent -p --mode ask --model cursor-grok-4.6-high`）被账单拦截（`ActionRequiredError: unpaid invoice`）无输出，改用本机 Grok Build CLI（`grok --prompt-file … --no-subagents`，default `grok-4.6`，只读；审后 sha256 核对方案未被改动）。**Approve with changes**（3 Critical + 5 Important + 5 Minor）。处理：

| 意见 | 处理 |
|------|------|
| C1 / I2 宿主进程未定，M6-A1 无法实施 | **采纳并裁定**：§3.2 宿主 = electron-main（理由与迁移阈值写明）；已写入 [ADR-003 审查记录](../decisions/003-engine-adapter-boundary.md#审查记录)；R2 改为「main 拖慢」风险 |
| C2 / I3 H4 依赖 M6-B，无法独立关门 | **采纳**：拆 H4a（pane + SAS，不碰 StatusBar）/ H4b（StatusBar，排 M6-B 后）；PRD-024 验收 ⑥ 在 H4b 前的通过条件写明 |
| C3 「DirectAddress v1 理由不足（上游未签）」 | **不采纳，改口以防再误读**：reviewer 把手填 `DirectAddress`（上游 Phase 0 既有、无 Hub 参与）与 ADR-374 GUA 自动直连（Phase 3 未签）混为一谈；§3.8 开头新增两词区分 |
| I1 立即在 `requirements.md` 落 PRD-024 | **不在本轮**：`requirements.md` / `traceability.md` 当前有 W3-r（PRD-022/023）在途改动，规则 3b 禁止与他人抢同一文件；H0 已是全部 H* 的前置刀，规则 10a 顺序由此保证 |
| I4 pairing-orchestrator 只搬序列不 vendor | 原稿 §1.3 / R6 已如此写；无改动 |
| I5 refresh 持久化分歧写进 m6 / ADR-003 | **不采纳**：该决策属本稿 §3.5，m6 已 `accepted` 不重开；ADR-003 只记宿主与同宿主两句 |
| Minor 1 H0 应先于全部 H* | 采纳：§5 图与表改 H0 独立首刀 |
| Minor 2 补 Desktop connection-and-auth 引用 | 文头 Donor 行已含；相关文档段补 ADR-031 |
| Minor 3 网络策略进契约 | 采纳：§3.3 `allowPrivateNetwork` 语义 + 新失败码 `private_network_denied` |
| Minor 4 Web 空态写 `unavailable` | §3.9 已含；无改动 |
| Minor 5 知识层 | 无改动 |

审查本身偏浅（41 s 返回，事实核验段为整体性陈述、无逐条锚点），因此本轮**不据此翻 `accepted`**。

**2026-09-02 第二轮（作废）：** 同 CLI + `--reasoning-effort high`，14 条事实全部回「未核验」——工具日志显示它一个文件都没读（提示词用了相对路径）。不计入。

**2026-09-02 第三轮（事实核验）：** 提示词改绝对路径 + 「未 `read_file` 不得判 ✅」，streaming-json 日志证实 17 次 read / grep / list_dir。14 条事实 13 条 ✅ 带 `文件:行号`（TTL `config.go:109-111`、proto `common.proto:160-232`、KAT-1/2、`HubDeviceDto:70-88`、Desktop donor 五文件、`ConnectionResolver.kt` 三规则、Singularity 首配缺位、HEAD `platform/universeAgent` 目录、`connectionPreferencesPane.ts`、ADR-003 审查记录末行、page-access 三处引用）；第 10 条 ⚠️ = `package.json` 无 grpc（方案 §1.2 / R4 已写明，归 M6-A1）；**第 14 条它未实际读 `secrets.ts` 却判 ✅，由本会话自行核验**：`secrets.ts:227-236` 加密不可用退化内存属实，`platform/encryption/electron-main/encryptionMainService.ts` 属实——并据此**修正 §3.5 / §3.6**：宿主为 main 时 secret 落点是 `IEncryptionMainService` + `IApplicationStorageMainService`（`storageMainService.ts:331`），不是 renderer 侧 `ISecretStorageService` 实例。Assessment：Approve with changes（仅 grpc 依赖一项，非方案缺陷）。reviewer 未覆盖维度 A–E。

**2026-09-02 第四轮（设计维度 A–F）：** 11 个文件全部 read_file（含 `electronAgentHostStarter.ts`、`encryptionMainService.ts`、`storageMainService.ts`、上游 architecture §2.2 / §2.5、Desktop connection-and-auth §2 / §5）。**Approve with changes**。六条「Critical」中三条是把审查问题原样抛回（B「请写未发现」、C「请确认未漏」、F「请补一致性声明」），本会话自行完成并写入方案；有效意见处理：

| 意见 | 处理 |
|------|------|
| A 「`node/**` 进程无关」无测试守门；迁移阈值不可测 | **采纳**：§3.2 增 boundary 测两条断言（禁 import `electron` / `*/electron-main/**`；`electron-main/` 为唯一桥）+ 两级阈值测法（1,000 回合 fold 计时；main `monitorEventLoopDelay` p99 > 50 ms） |
| B 绕过分析未写 | **采纳**：新增 §3.10 八行攻击面表；同用户进程可解 safeStorage 为已知残余风险，与 vscode / Desktop / Singularity 同面，不扩大 |
| C 与上游 §2.2 转换表逐格核对 | **采纳**：§3.3 增转换表映射（上游 9 行 + 本仓解析阶段 1 行，无漏格） |
| D H4a 自动化测缺 StatusBar 负向断言 | **采纳**：H4a 验证列加「Hub signedIn + 未 connected 时 entry 仍 `Engine not connected`」 |
| E PRD-024 陈述「状态栏显示已连接」撞 PRD-007 验收 4 | **采纳（真冲突）**：改为「显示引擎名与路径，连接级不使用『已连接』」；验收 ⑥ 增「状态栏文案集合不含『已连接 / connected』」；补可测方式行 |
| F 内部一致性 | 本会话 grep 核对：H4 → H4a/H4b 全部改齐；§3.10 / §3.11 编号无悬挂引用 |

**签收（2026-09-02）：** 用户授权「用 Cursor CLI Grok 审查、架构由本会话裁定」。Cursor CLI 因账单不可用，改 Grok Build CLI 四轮（一轮作废）；事实 14 条全部有锚点（13 条 reviewer 核验 + 1 条本会话核验），设计维度有效意见全部改入，无未决 Critical。据此 **`status: accepted`**；宿主 = electron-main 已写入 ADR-003 审查记录。**H0 可开**（待 `requirements.md` W3-r 在途改动合入）；H1 可与 W1-A 并行；H2 起等 M6-A1。若用户不同意签收，回退 `review` 即可，不影响已写入 ADR-003 的宿主裁定（那是 ADR-003 Consequences 预留、M6-A1 本就要定的项）。
