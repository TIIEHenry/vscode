---
title: "本机引擎信任锚：同一系统用户可读的引擎 home 文件"
type: plan
status: draft
phase: M7
updated: 2026-10-01
summary: "ELR-11：本机自动连接不再扫固定端口、不再不 pin 的 TLS。先找 agent-home 下 0700 目录里的 UDS；否则读 0600 的 server.lock 取端口、读 0600 的 engine-tls.crt 作 pin。没有锚就不自动连接。无 token 时先探一次 Session/List，回 16 即判为强制鉴权、不提交。签收时写 ADR-012 修订 ADR-003 Decision 7。"
---

# 本机引擎信任锚：同一系统用户可读的引擎 home 文件

> **slice_id**：`local-engine-trust-anchor`
> **来源**：[引擎链接架构审查](../progress/engine-link-architecture-review-2026-09-28.md) ELR-11。
> **本稿是方案，未签收。**
> **基线**：HEAD `7cf1474419e`，行号以此为准。以 `node/`、`common/`、`electron-main/`、`test/` 开头的路径在 `src/vs/platform/universeAgent/` 下。仓外引擎路径相对钉死工位 `vscode-debug-engine/universe-agent/grpc-server/src/jvmMain/kotlin/universe/agentic/grpc/`（PIN `748e7698e6`）。
> **冲突域**：`node/localEngineDiscovery.ts`（重写）、`node/universeAgentChannel.ts`（删不 pin 的 loopback 凭据）、`node/grpc/grpcClient.ts`（删 `createLoopbackTlsGrpcClient`，加 UDS 与 pinned 本机两个工厂）、`node/universeAgentConnectionService.ts`（**只**改服务选项 `findLocalEnginePort` / `openLocalEngineTransport` 的类型与默认值、`_discoverAndConnectLocalEngine` 与 `_connectLocalSkipAuth` 的入参、S5 在 `_connectLocalSkipAuth` 里加一次 `probeRpc`），以及 `test/node/localEngineDiscovery.test.ts`。
> **依赖**：[loopback-link-commit](loopback-link-commit.md)（ELR-10）先落，或与本稿同一切片。本稿沿用它的提交路径，只换目标与凭据。
> **不发明**协议字段、RPC、失败码或引擎侧文件。用到的三个文件都是引擎既有产物。
> **不升** PRD-008。需求文档没有规定自动连接行为（`docs/product/requirements.md` 无此条），规则 10a 不触发。

## Problem class

- **症状：** 生产构建启动即连本机 50061 / 50051 上任何回应 `HealthCheck` 的进程，不 pin 证书、不经 SAS；按默认参数启动的引擎（Linux / macOS 只听 UDS）反而连不上。
- **类标签：** **信任来自端口号** + **发现目标与引擎默认形态不符** + **ADR 判据未随实现修订**。
- **复发机制：** 本机路径以「回环即可信」为前提，没写「怎样确认这是本用户的引擎」；钉死引擎用 `--no-uds`，把 UDS 默认形态遮住了。

## 0. 一句话结论

「这是本用户的引擎」由文件系统权限证明：引擎把 UDS 放在 0700 目录里，把 `server.lock` 与 `engine-tls.crt` 写成仅 owner 可读。IDE 在 main 进程里读这些文件：有 UDS 就走 UDS；否则从 `server.lock` 取回环端口、用 `engine-tls.crt` 作 pin 走 TLS。文件不存在、属主不是当前用户、权限放宽、绑定不是回环，一律不自动连接。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| 生产装配无条件 `autoConnectLocalEngine: true` | `electron-main/universeAgentMainService.ts` L49 |
| 发现顺序探 `[50061, 50051]`，每口 800 ms `HealthCheck`，第一口成功即用 | `node/localEngineDiscovery.ts` L12-48 |
| 本机凭据 `createSsl(null, null, null, { rejectUnauthorized: false, checkServerIdentity: () => undefined })` | `node/universeAgentChannel.ts` L46-51 |
| `createLoopbackTlsGrpcClient(address, deadline)` 用上面的凭据与 `DIRECT_ADDRESS_SNI_PLACEHOLDER` | `node/grpc/grpcClient.ts` L3374-3381 |
| pin 基础设施已有：`PinnedTlsPlanInput { trustAnchorLeafDer, expectedLeafSha256Hex, hostnameVerification: 'replaced-by-pin' }`，`createPinnedTlsChannelCredentials`、`createPinnedChannelOptions`、`deriveEngineLeafFingerprintHex` | `node/deviceGrant/tls-pin.ts`；`node/universeAgentChannel.ts` L53-75 |
| 服务选项 `findLocalEnginePort: () => Promise<number \| undefined>`、`openLocalEngineTransport: (address) => GrpcUniverseAgentClient`；拨号固定拼 `127.0.0.1:${port}` | `node/universeAgentConnectionService.ts` L677-678、L2478 |
| `isEngineConnected()` 对跳过鉴权且相位 connected 的链路放行 | L696-704 |
| ADR-003 Decision 7：已连接 = 非空 `session_token` + 活 channel；pairing-pending 不算 | `dev/decisions/003-engine-adapter-boundary.md` |
| renderer 的已连接 = 相位 connected 且非配对，不看 `channelAlive` | `common/universeAgentRendererSync.ts` L229-231 |
| 引擎 UDS：Linux / macOS 默认启用，`--no-uds` 关闭，Hub 模式强制 TCP；socket 在 `<agent-home>/server.sock`，父目录设为 owner rwx；UDS 服务端无 TLS、装 `AuthInterceptor.skipAuth()`；启用 UDS 时不再听 TCP | 仓外 `HeadlessServer.kt` L1061-1073、L1078-1127、L1427-1430、L507-513 |
| 引擎 TCP 跳过鉴权的条件：未开 Hub 且绑定为回环 | 仓外 `HeadlessServer.kt` L1288-1307、L1161-1166 |
| 引擎在监听前写 `<agent-home>/server.lock`：JSON `pid`（不可用时 -1）、`port`、`bind`、`token`、`protocolVersion`、`startedAt`；仅 owner 可读写 | 仓外 `ServerLockfile.kt` L22-49、L67、L81-130；`HeadlessServer.kt` L500-501 |
| 引擎 TLS 叶证书持久化在 `<agent-home>/engine-tls.crt`（PEM），私钥与证书都设仅 owner 读写；ConfigStore 的 `tls.cert` / `tls.key` 可改用别处的证书 | 仓外 `auth/EngineTlsMaterial.kt` L68-133、L254-258；`HeadlessServer.kt` L1376-1384 |
| agent-home：钉死工位的本地补丁让 `AgentHome.defaultHomePath()` 读 `UNIVERSE_AGENT_HOME`，否则 `~/.universe-agent` | [钉死引擎调试](../../docs/guides/debug-engine.md) §4 |
| 钉死工位实测：`engine-tls.crt` 为 `-rw-------`；`start-engine.sh` 以 `--port 50061 --bind 127.0.0.1 --no-uds` 启动并导出 `UNIVERSE_AGENT_HOME` | 仓外 `vscode-debug-engine/agent-home/`、`start-engine.sh` L15、L65-66 |
| 不带 `device_auth` 的 `Connect` 不论鉴权模式都成功、不带 token；`Connect`、`GetAuthNonce`、`HealthCheck` 在鉴权拦截器豁免名单里 | 仓外 `SystemGrpcService.kt` L72-73；`interceptor/AuthInterceptor.kt` L166-170 |
| 本机拨号拿到「无 token、无 pairing nonce」即置 `_loopbackSkipAuth = true`；拦截器只在这次调用带了它写的 token 时才上报 `UNAUTHENTICATED`，无 token 的链路不会收口 | `node/universeAgentConnectionService.ts` L2484-2495；[remote-link-auth-and-relay](remote-link-auth-and-relay.md) §3 S2 |
| `probeRpc(service, method)` 发空请求并返回 gRPC 状态码，不抛错 | `node/grpc/grpcClient.ts` L1275 起 |

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 引擎 home 文件作信任锚：UDS 优先，TCP 用 lock + 证书 pin** | 见 §3 | **选定** |
| B 首次信任（TOFU）：记住第一次见到的叶证书 | 第一次就可能是冒充者；与 bug-hunt 01 拒绝的「观测即信任」同类 | **拒绝** |
| C 本机也走 Device Grant + SAS | 引擎对回环且未开 Hub 的连接跳过鉴权，`Connect` 不回 SAS；要改引擎 | **拒绝**（不改引擎） |
| D 只把自动连接收到开发开关后 | 挡住生产暴露，但开发机上仍是端口信任；也不解决 UDS 发现不了 | **拒绝作为主方案**；A 失败时文件不在，本来就不连 |
| E 只做 UDS | Windows 无 UDS；钉死工位用 TCP；Hub 模式强制 TCP | **拒绝单用**；A 含 UDS |
| F 读 lock 里的 `token` 作 Bearer | 引擎 ADR-261 已退役静态 Bearer，跳过鉴权路径不校验它；当凭据用即发明合同 | **拒绝**；不读该字段 |

## 3. 选定设计（A）

1. **S1 定位 agent-home 与文件校验（纯 node，可单测）。** 新文件仍放 `node/localEngineDiscovery.ts`。
   - `resolveLocalEngineHome(env, homedir)`：`env.UNIVERSE_AGENT_HOME` 非空则取其绝对路径，否则 `path.join(homedir, '.universe-agent')`。只在 main 进程调用，读的是 main 进程环境。
   - `checkOwnerOnly(stat, uid)`（POSIX）：`stat.uid === uid` 且 `(stat.mode & 0o077) === 0`。Windows 不做 mode 检查（见 §4 残余风险）。
   - 读文件用 `fs.promises.lstat` 再读；符号链接一律拒绝（防止把锚指向别处）。
2. **S2 UDS 锚（仅 POSIX）。**
   - 条件：`<home>/server.sock` 存在且 `lstat` 为 socket；父目录 `checkOwnerOnly` 通过。
   - 目标 `{ kind: 'uds', path }`。transport 用 `unix:<绝对路径>`、`createInsecure()`：UDS 上引擎不开 TLS，信任来自目录权限。
   - 失败（文件不在、权限不符、连接拒绝）即落到 S3，不报错。
3. **S3 TCP 锚。**
   - 读 `<home>/server.lock`：`checkOwnerOnly` 通过；JSON 解析；`port` 为 1–65535 的整数；`bind` 必须是回环字面量（`127.0.0.0/8` 或 `::1`）。`0.0.0.0`、`::`、主机名都拒绝：引擎在这些绑定上不跳过鉴权，也不是本机专属。`pid > 0` 时 `process.kill(pid, 0)` 抛 `ESRCH` 即视为陈旧 lock，不连；其余错误不拦。不读 `token`。
   - 读 `<home>/engine-tls.crt`：`checkOwnerOnly` 通过；PEM 取第一张证书转 DER；`expectedLeafSha256Hex = deriveEngineLeafFingerprintHex(der)`。
   - 目标 `{ kind: 'tcp', address: bind 为 ::1 时 '[::1]:port' 否则 '127.0.0.1:port', tls: { trustAnchorLeafDer: der, expectedLeafSha256Hex, hostnameVerification: 'replaced-by-pin' } }`。transport 用 `createPinnedTlsChannelCredentials(tls)` 与 `createPinnedChannelOptions(DIRECT_ADDRESS_SNI_PLACEHOLDER)`，不设 relay。
   - ConfigStore 配了 `tls.cert` 指向别处时，home 下的证书与引擎实际出示的叶不符，TLS 校验失败，不连。fail-closed，不另做兼容。
4. **S4 接线与删除。**
   - `node/localEngineDiscovery.ts` 导出 `LocalEngineTarget = { kind: 'uds'; path: string } | { kind: 'tcp'; address: string; tls: PinnedTlsPlanInput }` 与 `findLocalEngine(deps): Promise<LocalEngineTarget | undefined>`。依赖（`env`、`homedir`、`uid`、`fs`、`isPidAlive`、`platform`）可注入；顺序 S2 → S3。找到目标后仍在该目标上做一次 800 ms `HealthCheck`，不通即视为没有。
   - 服务选项改为 `findLocalEngine?: () => Promise<LocalEngineTarget | undefined>` 与 `openLocalEngineTransport?: (target: LocalEngineTarget) => GrpcUniverseAgentClient`。`_discoverAndConnectLocalEngine` 与 `_connectLocalSkipAuth` 改吃 `LocalEngineTarget`；其余（ELR-10 的提交路径、`connectWithoutDeviceAuth`、退避重发现）不变。相位 path 仍是 `'loopback'`。
   - 删除 `LOCAL_ENGINE_PROBE_PORTS`、`findLocalEnginePort`、`probeLocalEnginePort`、`createLoopbackTlsChannelCredentials`、`createLoopbackTlsGrpcClient`。`grpcClient.ts` 新增 `createLocalUdsGrpcClient(path, deadline?)` 与 `createLocalPinnedGrpcClient(address, tls, deadline?)`。
   - `autoConnectLocalEngine: true` 保留：有锚才连，信任等同于「同一系统用户」。
5. **S5 确认引擎确实跳过鉴权。** TCP 锚上，本机 `--hub` 引擎同样绑回环、同样有 lock 与证书，但强制鉴权。
   - `_connectLocalSkipAuth` 拿到「无 token、无 pairing nonce」之后、能力探针之前，在 captured 上 `probeRpc(UniverseAgentGrpcServices.Session.service, UniverseAgentGrpcServices.Session.List)` 一次。返回 `UNAUTHENTICATED`（16）即判定这台引擎要求鉴权：关 captured，`_suppressLocalEngineDiscovery = true`（本进程不再自动发现，避免对同一台引擎退避空转），相位写 `disconnected` 并广播，日志记一行。用户要连它就走 Direct Address 与 Device Grant。
   - 其他状态码不拦，交给既有能力探针。拿到 token 的本机链路（引擎给了 token）不做这一步。
   - 这一步在 ELR-10 的 epoch 闸之内：await 之后同样先过 `_localDialCurrent(epoch)`。
6. **S0 ADR-012（签收时写，不在本稿）。** 标题「本机引擎信任锚与已连接判据」，修订 [ADR-003](../decisions/003-engine-adapter-boundary.md) Decision 7（规则 5：accepted ADR 正文不改，以新 ADR 取代该条）：
   - 已连接 = 非配对 ∧ channel 活 ∧（非空 `session_token` ∨ 经本机信任锚建立的跳过鉴权链路）。
   - 本机信任锚只有两种：0700 目录下的 UDS；回环绑定 + 仅 owner 可读的 `server.lock` 与 `engine-tls.crt` pin。不 pin 的回环 TLS 与固定端口探测不构成信任。
   - main 只在 `isEngineConnected()` 为真时发布相位 `connected`；renderer 以快照相位与 `pairingPending` 派生已连接，不另设判据。
   - ADR-003 其余 Decision 不变。

## 4. 不变量

- 自动连接的每一条链路都能追溯到一个通过属主与权限校验的本地文件。
- 不 pin 的 TLS 凭据在生产代码中不存在。
- `server.lock` 的 `bind` 不是回环字面量时不连接。
- 读不到、读不懂、权限不对，都静默不连并按既有退避重发现；不弹窗、不写失败相位。
- 手填 Direct Address 与 Hub 路径不受影响。
- 残余风险（写入 ADR-012）：Windows 不做 mode 检查，依赖用户 profile 目录的默认 ACL；同一系统用户下的恶意进程不在防护范围内（它本来就能读写该用户的引擎 home）。

## 5. 切片

顺序：S1 → S2、S3（可并行）→ S4。S5 只依赖 ELR-10，可先于 S1 落。S0 在签收时写。

| Slice | Goal | Files | Tests | Exit |
|:------|:-----|:------|:------|:-----|
| **S1** | home 定位与属主校验 | `localEngineDiscovery.ts` | §8 S1 | 纯函数测试覆盖 env、缺省、属主、mode、符号链接 |
| **S2** | UDS 锚 | `localEngineDiscovery.ts`、`grpcClient.ts` | §8 S2 | POSIX 上默认参数启动的引擎可被发现 |
| **S3** | TCP 锚 | `localEngineDiscovery.ts`、`grpcClient.ts` | §8 S3 | 钉死工位（`--no-uds`）在 IDE 带 `UNIVERSE_AGENT_HOME` 启动时可被发现并 pin |
| **S4** | 接线与删除 | `universeAgentConnectionService.ts`（选项与入参）、`universeAgentChannel.ts`、`grpcClient.ts`、`localEngineDiscovery.ts` | §8 S4 | 生产代码不再有固定端口探测与不 pin 的凭据 |
| **S5** | 确认跳过鉴权 | `universeAgentConnectionService.ts`（`_connectLocalSkipAuth` 一处探测） | §8 S5 | 本机强制鉴权的引擎不再被提交为 connected |

## 6. 与已签收方案的接缝

- **loopback-link-commit（ELR-10）。** 本稿只替换它 S2 里的「建 captured transport」一步的目标与凭据，不改 epoch、探针、提交、订阅。
- **connection-hub-client。** §3 的「skip-auth 只允许 loopback / UDS」由本稿补上「怎样确认是本用户的」。`ConnectionTarget.loopback` 这一 profile 形态仍不存在，本稿不新增。
- **remote-link-auth-and-relay。** 本机链路没有 token，S2 的宽限分支不适用；S4 的 `UNAVAILABLE` 收口照旧，走本机重发现。
- **bug-hunt 01 方案 S1（私网分类）。** 只管 profile 解析出的地址；本机锚不经 resolver，不受影响。

## 7. 不做

- 改引擎（新 RPC、新文件、改权限）。
- 读 `server.lock` 的 `token` 当凭据。
- 本机路径的 Device Grant / SAS。
- 设置项或 UI 开关。
- `ConnectionTarget.loopback` profile。
- 重开托管 CI。

## 8. 验证

本地，点名文件跑 `scripts/test.sh --run`；门禁沿用 [health-gates](../progress/health-gates.md)。

| 切片 | 测试 | 断言 |
|:-----|:-----|:-----|
| S1 | `test/node/localEngineDiscovery.test.ts` | `UNIVERSE_AGENT_HOME` 优先，空串回落 `~/.universe-agent`；属主不符、group / other 任一位、符号链接都拒绝；Windows 跳过 mode 检查 |
| S2 | 同上（POSIX 才跑）：临时目录 0700，起一个绑 `unix:` 的进程内 grpc-js 明文服务端回应 `HealthCheck` | 目录 0700 时返回 `{ kind: 'uds' }`；目录 0755 时不返回 UDS 并落到 TCP；socket 不在时落到 TCP |
| S3 | 同上：临时 home 写 `server.lock` 与自签证书，起进程内 TLS 服务端 | 正确 lock + 证书时返回 `{ kind: 'tcp' }` 且 `expectedLeafSha256Hex` 等于证书 DER 的 SHA-256；用该目标的 pinned 客户端能完成 `HealthCheck`；换一张证书的服务端握手失败；`bind` 为 `0.0.0.0` / `::` / 主机名时不返回；lock 权限 0644 或证书权限 0644 时不返回；`pid` 不存在时不返回；lock 无 `port` 或越界时不返回 |
| S4 | `test/node/localEngineDiscovery.test.ts`、`test/node/universeAgentConnection.test.ts` | 服务以注入的 `findLocalEngine` 返回 UDS / TCP 目标时都提交 `connected{loopback}`；返回 `undefined` 时按退避重发现、相位保持 `disconnected`；`rg createLoopbackTls src/vs` 无生产命中 |
| S5 | `test/node/localEngineDiscovery.test.ts` | 无 token 的本机链路上 `probeRpc(Session/List)` 回 16：不提交 connected，captured 已关，相位 `disconnected`，此后不再排发现；回 0 或 12：照常进入能力探针并提交；带 token 的本机链路不调用这次 `probeRpc`；探测期间用户拨号则只关 captured、不写压制旗 |

真引擎冒烟（非退出条件，实施后补证据）：钉死工位照常 `--no-uds` 启动，IDE 以 `UNIVERSE_AGENT_HOME=<vscode-debug-engine/agent-home>` 启动，状态栏变 **Engine · Loopback**；另用 `nc -l 127.0.0.1 50051` 之类的占位进程验证不再被连接。

## 9. 知识层回填（实施 commit 时，不在本稿）

- [钉死引擎调试](../../docs/guides/debug-engine.md) §3：IDE 要以同一个 `UNIVERSE_AGENT_HOME` 启动；不再扫 50061 / 50051；去掉 `--no-uds` 也能连。
- `docs/reference/universe-agent/INDEX.md` 钉死引擎一行与 `engine-protocol-surface.md` 的 `SystemService` 两行改口。
- `dev/decisions/012-*.md`（S0）与 `dev/decisions/INDEX.md`。
- [审查文](../progress/engine-link-architecture-review-2026-09-28.md) ELR-11 的「已知」指向本稿。

## 审查记录

| 轮 | Assessment | 处置 |
|:---|:-----------|:-----|
