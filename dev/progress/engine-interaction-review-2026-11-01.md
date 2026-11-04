---
title: "引擎交互与功能适配审查（2026-11-01）"
type: progress
status: draft
phase: M7
updated: 2026-11-01
summary: "IDE HEAD 6842a293306f 对 UniverseAgent 引擎 HEAD 31b60e2f42 与运行中 50061 二进制（10635d612dac）的只读审查，17 条（EIR-1…17）。运行中引擎比引擎 HEAD 落后 3913 个提交，IDE 有 6 条 RPC 在它上面不存在；引擎 HEAD 把 PERMISSION_ALLOW 改为 3，IDE 的 Chat 臂仍发 0；模型写入只按方法存在放行；IPC 属主闸只覆盖 13 个方法；任一 RPC 超时或 UNAVAILABLE 都会让整条链路重连；会话权限模式无读回；IDE 无 proto 漂移检查。功能适配矩阵登记 171 个可选方法中无默认编辑器调用方的部分。发现稿，不登记 D、不升 PRD。"
---

# 引擎交互与功能适配审查（2026-11-01）

> **范围**：默认编辑器窗口与 UniverseAgent 引擎之间的运行时交互（连接、鉴权、能力探测、会话流、写入归属、编解码）和产品入口适配。Agents Window 与 Copilot Chat 不在范围内。只读审查，没有改产品代码，没有对 50061 发业务调用，没有跑测试，没有开窗口。
> **基线**：IDE `6842a293306f`（`agent-ide`）。引擎源码 `UniverseAgent` `31b60e2f42`（`edit` 分支，工作区有 10 个未提交文件，均不在 proto）。运行中引擎见 EIR-2。下文 IDE 路径以 `platform/` 或 `workbench/` 开头的都在 `src/vs/` 下；引擎 Kotlin 路径相对 `grpc-server/src/jvmMain/kotlin/universe/agentic/grpc/`，proto 相对 `grpc-api/src/main/proto/`。
> **前文**：[功能缺口快照](../../docs/reference/universe-agent/ide-engine-feature-gaps.md)（10-26 分析，10-27 增量）· [协议面](../../docs/reference/universe-agent/engine-protocol-surface.md) · [引擎链接审查 ELR](engine-link-architecture-review-2026-09-28.md) · [钉死引擎](../../docs/guides/debug-engine.md) · [deferred-gaps](deferred-gaps.md) 的 D24、D1343、D1388、D1391。
> **编号**：EIR-N（Engine Interaction Review）。字段：严重度、位置、现状、影响、已知、方向。

## 方法

- RPC 名单：按 proto 的 `package.Service.rpc` 抽取，与 `platform/universeAgent/node/grpc/grpcTransport.ts:1023-1297` 的 `UniverseAgentGrpcServices` 做集合比较。运行中引擎的名单取自其源码 SHA 的 proto，不是线上反射。
- 字段：逐个读 IDE 手写编解码（`node/grpc/*Wire.ts`），对照引擎 HEAD 与 `10635d612dac` 的 proto；`git diff 10635d612dac 31b60e2f42 -- grpc-api/src/main/proto` 共 8 个文件变化。
- 产品调用方：对 `IUniverseAgentConnection` 的 171 个可选方法，在 `workbench/contrib/{conversation,sources,universeAgentMigration}` 与 `workbench/services` 中排除测试后 grep 调用点，并人工剔除同名误报（布局 `compact`、git `branch`、`AbortController.abort` 等）。
- 三路并行只读调查的结论由作者抽查源码复核；未复核的写“未核”。

## 协议名单

| 来源 | 业务 RPC | 与 IDE 的差 |
|------|---------:|-------------|
| 引擎 HEAD `31b60e2f42` | 211（21 个服务） | 多 `PermissionService.GetPermissionMode` |
| IDE `UniverseAgentGrpcServices` | 210 | 无独有项 |
| 运行中 50061（`10635d612dac`） | 204 | 缺 `AgentService.GetQueue`、`ToolService.SaveSkillContent`、`PermissionService.SetClientToolProfile`、`ConfigService.UpsertModel` / `DeleteModel` / `SetModelEnabled` |

[功能缺口快照 §8](../../docs/reference/universe-agent/ide-engine-feature-gaps.md#8-2026-10-27-跨仓实施增量) 的“210/210”在 10-27 成立；引擎 10-28 的 `ce39cc4967` 新增 `GetPermissionMode` 后变为 210/211。

上表的 50061 行是审查时快照（`10635d612dac`）。2026-11-01 换钉后，进程改由干净的 `027ab7ed03ac5b64023ed6090f8610b22cc2b8ac` 构建启动；未做反射或业务调用，不能把新进程的 proto 计数写成线上观测。

## 结论

协议名单基本对齐，问题集中在三处：

1. **验证对象不对**。运行中的 50061 是 9 月 23 日打包的二进制，10 月 26 日以来补的协议在它上面一半不存在，另一半字段被静默丢弃（EIR-2）。反过来，引擎 HEAD 已经改了权限枚举，IDE 的 Chat 臂编码只对旧引擎正确（EIR-1）。双方都没有自动发现这种漂移的手段（EIR-16）。
2. **写入归属不完整**。main 侧原子属主闸只覆盖 Provider/Model/Skills 的 13 个 IPC 方法，其余写入只靠 renderer 侧点击时结算（EIR-4）。模型写入按“方法是否存在”放行，而在桌面 IPC 代理上这个判断恒真（EIR-3）。
3. **链路对单次调用失败过敏**。任一 RPC 的 `UNAVAILABLE` 或 30 秒默认超时都会让整条链路进入重连并作废所有属主（EIR-7）。

产品适配方面，10-27 快照的矩阵大体仍准。新增的是：权限模式只写不读（EIR-5）、生成中输入缺投递策略字段（EIR-11）、ChatResponse 只解 `error` 臂（EIR-10）。

## 严重度总览

| 编号 | 严重度 | 标题 | 已有登记 |
|------|--------|------|----------|
| EIR-1 | P2 | 引擎 HEAD 的 `PERMISSION_ALLOW` 改为 3，IDE Chat 臂仍发 0 | 无 |
| EIR-2 | P1 | 运行中 50061 落后引擎 HEAD 3913 个提交，`PIN` 不是线上版本 | 部分（§8“50061 未替换”） |
| EIR-3 | P2 | 模型写入只按方法存在放行，桌面上恒真 | 无 |
| EIR-4 | P2 | IPC 属主闸只覆盖 13 个方法 | D1391（仅 Memory） |
| EIR-5 | P2 | 会话权限模式只写不读，引擎已有 `GetPermissionMode` | 无 |
| EIR-6 | P3 | 会话令牌 12 小时到期只被动处理 | 无 |
| EIR-7 | P2 | 单次 RPC 超时或 `UNAVAILABLE` 让整条链路重连 | 无 |
| EIR-8 | P3 | 回环免鉴权把非 16 的任何探测结果都当成确认 | 无 |
| EIR-9 | P3 | 会话流首帧即重置退避，抖动引擎每秒重开 | 无 |
| EIR-10 | P3 | ChatResponse 只解 `error`；SessionStreamEvent 多个臂被忽略 | 部分（queue_state） |
| EIR-11 | P2 | SessionInput 只发 4 个字段，缺 `delivery` 等 | 部分（附件） |
| EIR-12 | P3 | 新建会话不传 `workDir`，运行中引擎也会丢弃字段 7 | 已知（§7） |
| EIR-13 | P3 | `Agent.History` 丢 `turn_id`（ADR-458）与工具字段 | 无 |
| EIR-14 | P3 | RemoteAgent 配置保存会丢新字段且在 HEAD 被拒 | 无 |
| EIR-15 | P3 | 队列快照解码遇未知枚举整包失败 | 无 |
| EIR-16 | P2 | IDE 无 wire 与引擎 proto 的漂移检查 | 无 |
| EIR-17 | P3 | 既有文档的计数与 D24 描述已过期 | — |

## 交互问题

### EIR-1 引擎 HEAD 的 `PERMISSION_ALLOW` 改为 3，IDE Chat 臂仍发 0

- **严重度**：P2。默认编辑器已连接时走 unary，不受影响；属于潜伏缺陷。
- **位置**：`platform/universeAgent/node/grpc/grpcSessionAttachWire.ts:873-896`（`encodePermissionResponse` / `encodePermissionDecision`）；引擎 `common.proto:274-279`。
- **现状**：引擎提交 `2975cdbacd`（2026-10-16，“未设置的权限……改为失败关闭”）把枚举改为 `UNSPECIFIED=0, DENY=1, ALWAYS=2, ALLOW=3`，0 与未知值按拒绝处理。运行中的 `10635d612dac` 仍是 `ALLOW=0`。IDE 把 `allow` 编成 0，而 `encodeInt32Field` 省略 0，所以 allow 在线上是“无 decision 字段”。注释仍写 `PERMISSION_ALLOW=0`。
- **影响**：已连接时 `conversationLensSessionBinding.ts` 的权限座走 `resolveConfirmation` → roster `respondEnginePermission` → `PermissionService.Respond{granted: bool}`（`conversationEngineRosterService.ts:1319`），与该枚举无关。Chat 臂仍由 `sessionViewHost.ts:194-195` 与 sessionCore 的 `permissionRespond` 本地事实使用；凡经这条路径发出的“允许”，换上 HEAD 引擎后都会变成拒绝，且 IDE 测试会继续通过。
- **方向**：按 HEAD 编 `ALLOW=3`，同时确认还有哪些调用方经 Chat 臂回答权限；若已无产品调用方，改为拒绝编码并删除该臂。与 EIR-16 一起处理。

### EIR-2 运行中 50061 落后引擎 HEAD 3913 个提交，`PIN` 不是线上版本

- **严重度**：P1（验证层面）。
- **位置**：`engine/VERSION`（`source_sha=10635d612dac`，2026-09-23 打包，`AgentHome.kt` 有本地改动）；`vscode-debug-engine/start-engine.sh:44,65` 执行 `vscode/engine/bin/universe-agent-engine`；`vscode-debug-engine/PIN` 写 `748e7698e6`（2026-09-12）。进程 1446879 自 2026-10-10 起运行。
- **现状**：`PIN` 的注释承认线上进程是打包二进制，但 [debug-engine 指南](../../docs/guides/debug-engine.md) 只说“以 `PIN` 为准”。实际有三个版本：`PIN` 工位 `748e7698e6`、线上二进制 `10635d612dac`、引擎 HEAD `31b60e2f42`。
- **影响**：10-26 与 10-27 两个协议切片在 50061 上无法端到端验证。6 条 RPC 返回 `UNIMPLEMENTED`（见“协议名单”）。下列 HEAD 字段被运行中引擎当未知字段丢弃或从不下发：`CreateSessionRequest.work_dir=7`、`SessionInfoResponse.title=8`、`UpsertProviderCredentialsRequest.refresh_models=5`、`ProviderStatus.discovered_models=8` / `model_sync_error=9`、`AgentProfileProto.max_rewinds=20`。EIR-1 的方向相反：IDE 只在旧引擎上正确。当前所有“真实引擎”实测都对着一个与 HEAD 语义不同的引擎。
- **已知**：§8 写过“当前 50061 二进制未替换”，没写版本差距与 `PIN` 不一致。
- **方向**：先决定 IDE 对齐哪个引擎版本，再按仓外 README 换钉并重打包；同步改正指南里“以 `PIN` 为准”的说法，写清线上进程版本从 `engine/VERSION` 读。是否换钉需要用户决定。
- **后续（2026-11-01）**：用户授权后已从干净 detached worktree `027ab7ed03ac5b64023ed6090f8610b22cc2b8ac` 重编 `grpc-api`、`grpc-server`、`remote-agent-server` 与 `hook-jvm`，更新 `engine/VERSION`（`source_dirty=false`）和 `engine/lib.SHA256SUMS`。50061 已在 `127.0.0.1:50061` 监听。重启后已有 IDE 能力探测自动到达引擎，`AgentService/GetQueue` 返回 `INVALID_ARGUMENT` 而非 `UNIMPLEMENTED`，说明该 RPC 已进入服务实现；没有手工发起状态改变类业务调用，仍不把完整方法计数升级为线上反射结论。

### EIR-3 模型写入只按方法存在放行，桌面上恒真

- **严重度**：P2。
- **位置**：`workbench/contrib/conversation/browser/engineProviderModelSection.ts:1155-1163`（`canWriteModels`）；`platform/universeAgent/node/grpcCapabilityProbe.ts:62-66`（`models` 只探 `ListModels`）；`platform/universeAgent/common/universeAgentRendererSync.ts:162-185`；`base/parts/ipc/common/ipc.ts:1256-1260`。
- **现状**：`canWriteModels` 要求 `typeof upsertModel/deleteModel/setModelEnabled === 'function'`。renderer 的连接对象经 `createRemoteForwardingProxy` 落到 `ProxyChannel.toService` 的 `Proxy`，任意方法名都返回函数，所以这一检查在桌面恒真。能力快照的 `models` 只代表 `ListModels`。
- **影响**：在 50061 上 Models 列表可读，Add/Edit/Delete/Enable 都可点，每次点击才得到 `UNIMPLEMENTED`，以“Unable to save model: …”出现。Skills 有独立的 `SaveSkillContent` 探测（`universeAgentConnectionService.ts:3217`，D1343 处理首败后的界面），模型写入没有对应探测。同一个“方法存在即可写”的假设也出现在其他 `conversationEntryHookPresent(..., fn)` 调用里；它们另有能力快照兜底，本条只确认了模型写入没有。
- **方向**：为 `UpsertModel` 增加广告加探测（参照 `probeAdvertisedSupport`），模型写入入口按探测结果开关；渲染端不要再用 `typeof` 判断远程能力。

### EIR-4 IPC 属主闸只覆盖 13 个方法

- **严重度**：P2（Memory 部分为 D1391 的 P1）。
- **位置**：`platform/universeAgent/common/universeAgentConnectionIpcChannel.ts:85-99`（`EXPECTED_OWNER_ARGUMENT_INDEXES`）、`:101` 起（`FORWARDED_CONNECTION_CALLS`）、`:432-440`；`node/universeAgentConnectionService.ts:2502-2550`（`_captureTransportOwner` / `_withExpectedOwner`，省略属主时直接 `_withTransport`）。
- **现状**：带 main 侧“发前原子校验、发后旧链拒绝”的只有 Provider 凭据、Model 注册表、harness 导入与 Skills 共 13 个方法。其余写入都无属主转发，包括：createSession / deleteSession、rename、cancel、setSessionGoal、fork / kill、deleteMessage / editMessage、队列全部变更、respondPermission / respondQuestion / sendClientToolResponse、setPermissionMode、快照 create / restore / delete、Triggers、Agent profile、MCP / Plugins / Rules、Memory、设备写入。
- **影响**：status 10-30/31 记录的 renderer 侧结算（点击时记 identity + link，晚到结果不画）能挡住错画，挡不住发错。renderer 检查通过后、main 派发前若链路已切到另一引擎，这次写入会落到新引擎上。触发条件是切换 profile 或断线后重连到不同引擎。
- **方向**：按 D1391 的做法逐批扩到会话写和队列写；先补用户主流程上的 Composer 发送之外的会话写（Composer 发送走 sessionView lease，另有身份）。
- **基线边界**：本节的“13 个方法”只描述审查基线 `6842a293306f`。当前工作树已在 `587a0dbb023` 给 Memory 的 `saveMemory` / `deleteMemory` 加上 owner 闸；现行实现为 15 个 owner-indexed IPC 项，其他会话、队列、权限和设备写入缺口仍在。

### EIR-5 会话权限模式只写不读，引擎已有 `GetPermissionMode`

- **严重度**：P2。
- **位置**：`workbench/contrib/conversation/browser/conversationLensComposerChrome.ts:1174-1186`（`confirmedIndex` 初始取本地会话配置）、`:1225`（`drainSessionPermission`）；引擎 `PermissionGrpcService.kt:272-286`。
- **现状**：Ask / Agent / Permit 选择框显示的是本地记录的“上次被接受的值”。重开会话、重连、另一客户端修改或引擎重启后都不会回读。引擎 HEAD 的 `GetPermissionMode` 用 `getWithoutTouch` 读当前生效值，IDE 无合同、无 wire。
- **影响**：选择框可能显示 Ask 而引擎实际是 Permit，用户据此判断工具是否会被拦截。Permit 是放开工具执行的模式，这个误差偏向不安全的一侧。
- **方向**：补 `GetPermissionMode` 合同、wire 与能力探测（空 session 的 `INVALID_ARGUMENT` 可作无副作用探测）；会话绑定和重连后回读；不支持时选择框不显示确定值。

### EIR-6 会话令牌 12 小时到期只被动处理

- **严重度**：P3。只影响非回环链路（Hub、手填 Direct Address）。
- **位置**：引擎 `auth/SessionTokenStore.kt:93`（默认 TTL 12h）；IDE `node/grpc/grpcClient.ts` 的 `_reportLinkStatus`（带令牌的调用回 16 时触发 `onDidRejectSessionToken`）；`node/universeAgentConnectionService.ts:424`（`SESSION_TOKEN_REJECT_GRACE_MS = 60_000`）、`:3554-3613`。
- **现状**：`ConnectResponse` 不带令牌到期时间，IDE 也不主动续期。到期后第一个调用失败，链路关闭并经 `_markTransportFailed` → `_fireReconnect` → `connectProfile(profileId, { reconnect: true })` 重拨。
- **影响**：每 12 小时，恰好撞上的那次用户写入失败，所有已捕获的属主作废，界面经历一次重连。写入不会自动重放，因此没有重复写入风险。
- **方向**：在安装令牌时记下签发时间，到期前主动重拨；或请引擎在 `ConnectResponse` 里下发到期时间（跨仓需求，本仓不发明字段号）。

### EIR-7 单次 RPC 超时或 `UNAVAILABLE` 让整条链路重连

- **严重度**：P2。
- **位置**：`node/grpc/grpcClient.ts:1137`（默认 unary 截止 30 秒）；`node/grpc/grpcTransport.ts:429-432`（`isTransportFailureCode` 含 `DEADLINE_EXCEEDED`）；`node/universeAgentConnectionService.ts:2585-2601`（`_markTransportFailed`）；`grpcClient.ts:1164` 的 `_reportLinkStatus` 对任一非豁免路径的 `UNAVAILABLE` 触发 `onDidObserveUnavailable` → `_closeoutAuthenticatedLink`。
- **现状**：任何 unary 回 `DEADLINE_EXCEEDED` 都会把传输标成失败并安排重连；回 `UNAVAILABLE` 还会直接关链、清已发布 link。引擎有把业务状态映射成 `UNAVAILABLE` 的路径：`FileGrpcService.kt:370`（“Session manager not available”）、`GrpcUnaryStatusMap.kt:99`（按调用方给的码透传）。
- **影响**：`TestModelProfile`（`AgentGrpcService.kt:2428` 起，同步调用外部 LLM 验证连接）、`Compact`、harness 导入这类可能超过 30 秒的调用，一旦超时就让整个 IDE 断线重连，而引擎可能已经执行完。用户看到的是“操作失败 + 断线”，随后状态又自己出现。调用方都没有覆盖截止时间（`grpcClientCalls.ts:38` 支持显式截止，但无调用方传入）。
- **方向**：区分“这一次调用失败”和“链路失效”：`DEADLINE_EXCEEDED` 不再计为传输失败，改为由心跳或 HealthCheck 判断链路；为已知长调用设单独截止；与引擎约定 `UNAVAILABLE` 只表示传输不可用。

### EIR-8 回环免鉴权把非 16 的任何探测结果都当成确认

- **严重度**：P3。
- **位置**：`node/universeAgentConnectionService.ts:2697-2701`（探测）、`:2782-2796`（`_localSkipAuthConfirmed`）、`:2690-2695`（pairing nonce 分支）。
- **现状**：无令牌的回环 Connect 之后，用 `Session/List` 探一次；只要不是 `UNAUTHENTICATED`，包括 `UNAVAILABLE`、`DEADLINE_EXCEEDED`、`INTERNAL`，都按“引擎跳过鉴权”提交链路。另一方面，收到一次 16 或 pairing nonce 后，本进程停止自动发现直到重启或用户手动拨号。
- **影响**：引擎启动未完成时 IDE 可能提交一条马上失效的链路，随后靠 EIR-7 的重连收场；一次误判 16 会让本机自动连接整段会话失效，状态栏只显示未连接。
- **方向**：只把 `OK`、`INVALID_ARGUMENT` 等“已到达业务层”的码当确认；停止自动发现时在 Connection 面板写明原因与恢复动作。

### EIR-9 会话流首帧即重置退避，抖动引擎每秒重开

- **严重度**：P3。
- **位置**：`node/sessionViewHost.ts:1876-1880`（普通路径首个事件即 `reopenAttemptBySession = 0`）；`:2098-2107`（溢出恢复路径要求存活 30 秒才归零）。
- **现状**：两条路径的归零条件不对称。引擎每次只发 `hello` 就关流时，普通重开每次都从第一档 1 秒开始。
- **影响**：每个可见会话约每秒一次 `SessionEventStream` 订阅，持续到用户关会话或引擎恢复；同时每次都会触发 Agent tree 刷新（`:1882`）。
- **方向**：普通路径沿用 30 秒存活后归零的规则。

### EIR-10 ChatResponse 只解 `error`；SessionStreamEvent 多个臂被忽略

- **严重度**：P3。
- **位置**：`node/grpc/grpcSessionAttachWire.ts:810-829`（`decodeChatResponse` 只读 `session_id`、`agent_id`、`error=16`）；SessionStreamEvent 解码同文件约 440-560。
- **现状**：ChatResponse 的 `input_delivery=70`、`provider_retry=71`、`model_switch_scheduled=72`、`tool_circuit_broken=73`、`queue_state=76`、`llm_request_progress=77`、`trigger_fired=78` 等臂都不读。子代理逐臂核对 SessionStreamEvent 后报告：`agent_timeout=14`、`session_visibility_changed=15`、`tool_call_delta=33`、`deep_think_*=40-43`、`conditional_agent=45` 不读，`tool_call_lifecycle` 只读 `started`，`multi_agent_status` 只读 `team_created=14`（作者抽查了 `session_purged=16` 与 `team_created=14` 两处）。
- **影响**：这些事件若只在 ChatResponse 上出现，IDE 看不到 Provider 重试、模型切换计划、工具熔断与输入投递结果；另一客户端搁置会话（visibility）或 Agent 超时也不会反映到时间线。这些臂在 SessionEventStream 上是否另有对应，未逐一核对。
- **方向**：先按产品需要列出必须可见的事件（投递结果与 Provider 重试优先，它们直接影响“生成中发送”合同），再补解码；其余明确登记为不消费。

### EIR-11 SessionInput 只发 4 个字段，缺 `delivery` 等

- **严重度**：P2（`delivery` 对“生成中发送”是前置条件）。
- **位置**：`node/grpc/grpcSessionAttachWire.ts:846-853`（`encodeSessionInput` 只编 `message_id=1`、`text=2`、`model_profile_id=5`、`operation_id=10`）；`workbench/contrib/conversation/browser/conversationLensComposer.ts:430-436`。
- **现状**：从不发送 `attachments=3`、`delivery=4`（`InputDeliveryPolicy`）、`system_prompt=6`、`memory_enabled=7`、`thinking_enabled=8`、`reply_to_id=9`、`skill_name` / `skill_scope` / `skill_command_text=11-13`。Composer 的 `agentId` 是时间线筛选的 Agent，不是用户选定的 Agent profile。
- **影响**：生成中 Send/Enqueue 当前关闭（D1388）。重新开放时若不发 `delivery`，引擎按 UNSPECIFIED 默认处理，这正是 2026-10-11 实测里“第二条 Chat 把当前 turn 打进 GENERATING→WAITING”的来源之一。引用回复、显式技能调用、思考开关也无法从默认编辑器表达。
- **方向**：在“生成中输入合同”里显式选定 `delivery`（排队或打断），与 EIR-10 的 `input_delivery` 回执一起设计；附件按 PRD 现状不画，不在本条范围。

### EIR-12 新建会话不传 `workDir`，运行中引擎也会丢弃字段 7

- **严重度**：P3（已知）。
- **位置**：`node/sessionViewHost.ts:842`（`createSession({ title: localId, clientSessionId: localId })`）；编码已在 `grpcSessionAttachWire.ts:97`。
- **现状与影响**：与 [§7](../../docs/reference/universe-agent/ide-engine-feature-gaps.md#7-本轮实施进展) 一致：类型与 bytes 已补，实际调用未传，需要 owner / lease / IPC 身份设计。另补一点：即使传了，50061 的 `CreateSessionRequest` 只到字段 6，会静默丢弃（EIR-2）。

### EIR-13 `Agent.History` 丢 `turn_id`（ADR-458）与工具字段

- **严重度**：P3（无产品调用方，潜伏）。
- **位置**：`node/grpc/grpcAgentHistoryUnaryWire.ts:63-71`。
- **现状**：`HistoryEntry` 只读 1-4；不读 `tool_call_id=6`、`is_error=7`、`metadata_json=8` 与 HEAD 新增的 `turn_id=9`。引擎注释写明该字段“不得从文本或顺序推断”。
- **影响**：`getAgentHistory` 目前没有默认编辑器调用方（SessionBar History 用的是 `SessionService.GetHistory` 信封）。一旦接入，按回合分组只能靠推断，违反 ADR-458。

### EIR-14 RemoteAgent 配置保存会丢新字段且在 HEAD 被拒

- **严重度**：P3（无产品调用方，潜伏）。
- **位置**：`node/grpc/grpcSaveConfigUnaryWire.ts:116-121`；引擎 `remote_agent_service.proto` 的 `Endpoint` / `AuthConfig`。
- **现状**：IDE 编 `tls_cert_path=4`，不认识 `certificate_pin_sha256=5`、`local_skip_auth=6`、`identity_name=4`（AuthConfig）。HEAD 注释写明 `tls_cert_path` 非空即拒，`AuthConfig.type` 只接受 `DEVICE_AUTH`，`NONE` 需配合 `local_skip_auth`。`RemoteChatResult.retain_binding=12` 也未读。
- **影响**：读改写会清掉引擎侧的证书钉与身份名；带证书路径的保存会被 HEAD 拒绝。RemoteAgent 全部 18 个方法目前没有产品调用方。
- **方向**：接入远程子引擎前先按 HEAD 合同重写这组编解码。

### EIR-15 队列快照解码遇未知枚举整包失败

- **严重度**：P3。
- **位置**：`node/grpc/grpcQueueSkillWire.ts:9-13`（`enumValue` 遇未知值抛错），状态、hold、priority、pause reason 均经此。
- **现状与影响**：字段号与枚举序数当前与 HEAD 一致。引擎以后给任一队列枚举加成员，整个 `GetQueue` 结果解码失败，Inbox 进入“读回失败”只读态，所有队列操作被 ready 闸关闭。
- **方向**：未知状态映射为单行“未知”并只读该行，不让整包失败。

### EIR-16 IDE 无 wire 与引擎 proto 的漂移检查

- **严重度**：P2（EIR-1、13、14 的共同原因）。
- **现状**：IDE 编解码手写字段号，单测用同一组常量做往返，测不出与引擎的偏差。仓内没有读取引擎 `.proto` 的脚本或测试。引擎侧有 `PermissionDecisionWireParityTest.kt`，IDE 侧没有对应物。
- **方向**：加一个本地脚本：读同级 UniverseAgent 的 proto，抽出 IDE 已编解码消息的字段号、类型与枚举序数，与 IDE 常量表比较；作为 `scripts/` 下的手动门禁，不进托管 CI（托管 CI 已关）。字段常量需先从注释收拢成可读表，这是前置工作量。

### EIR-17 既有文档的计数与 D24 描述已过期

- [功能缺口快照](../../docs/reference/universe-agent/ide-engine-feature-gaps.md) §2 的“21 服务 / 208 RPC / IDE 207”与 §8 的“210/210”都已过期，当前见“协议名单”。
- [D24](deferred-gaps.md) 仍写 SaveSkillContent 走 JSON。现状：`grpcClient.ts` 的 `saveSkillContent` 走 `makeUnaryBytesClient` + `grpcQueueSkillWire`；`grpcClientCalls.ts` 的 JSON 工厂在生产代码中已无调用方。当前仍未读的是 Status `model_info=9`；Usage `context_window` / `session_usage` 已完成解码与映射，不能再列为现行缺口。
- [debug-engine 指南](../../docs/guides/debug-engine.md) 的“以 `PIN` 为准”在审查时与线上进程不符；本次换钉已改为以 `engine/VERSION` 和 `engine/lib.SHA256SUMS` 记录二进制事实。
- [progress INDEX](INDEX.md) 里 ELR 审查一行仍写“9 条”，正文已到 ELR-14。

## 功能适配矩阵

“产品入口”指默认编辑器里有用户可触发的调用点；“仅传输”指合同、node 与 IPC 已通，没有产品调用方。

| 能力 | 产品入口 | 仅传输 | 关闭或受限 | 问题 |
|------|----------|--------|------------|------|
| Composer 发送 | `submitInput`：text、modelProfileId、筛选 agentId | 附件上传 | 配对等待、KEEP 列表失败、生成中（D1388） | EIR-11 |
| 队列 | GetQueue 读回、Pause/Resume/Clear/Retry、Hold→Edit→Release | Insert、Reorder、Delete、Pin、Lock、Inject、ForkAnchor、RetryAllFailed | ready 闸；审查时旧 10635 无 GetQueue | EIR-2、EIR-15 |
| Agent 选择 | 无 | — | `switchAgent` 不在合同与 proto，恒 UNSUPPORTED，显示只读文案 | 文案像暂时不可用 |
| 会话工具范围 | 工具目录只读 + ToolInfo | `setClientToolProfile` | 50061 无该 RPC | — |
| 权限模式 | Ask/Agent/Permit 写入 | SyncPermissionRule、PromotePermissionRule、GetSessionRules、SetPermissionPolicy | — | EIR-5 |
| 会话生命周期 | 新建、删除、重命名、Cancel、Fork、Kill、回合编辑/删除、快照四操作、Regenerate、Continue | Info、Resume、Prewarm、Shelve、Unshelve、Purge、Export、Compact、SwitchWorkDir | — | Fork 不带 `anchorTurnId`（`conversationEngineRosterService.ts:1180-1205`）；EIR-12 |
| Agent 运行控制 | 无 | Status、Todo、Pause、Back、Prune、Reset、Branch、Loop 三操作、ListLoopSnapshots | — | 按用户任务挑选，不全做成按钮 |
| 目标与任务 | Goal 设/清；Navigator 读成员与任务 | Team 写操作 | PRD-022 只读 | 已连接时 AutoDrive 诚实为空（`conversationEngineRosterService.ts:685-703`） |
| Provider / Model | 凭据写、导入、预设目录、状态、TestModelProfile、模型注册表写 | — | 审查时旧 10635 上模型写入为 UNIMPLEMENTED；换钉后仍待 IDE 能力闸与业务验收 | EIR-3；`refresh_models` 只有字段无表单 |
| Skills | 列表、开关、正文新建/保存 | — | 审查时旧 10635 无 SaveSkillContent（D1343）；换钉后未做业务验收 | — |
| Hooks | 只读点位 | — | 定义写不做 | — |
| Triggers | 全局 List/Upsert/Delete/SetEnabled/Fire | RegisterSessionEngineTrigger、FireTriggerWebhook | — | 无会话级文件变化 / webhook 入口 |
| Memory | List/Search/Save/Delete | SearchDeep、Read、Reflect、Rebuild 流、Revert、History | — | D1391 |
| RemoteAgent | 无 | 全部 18 个方法 | — | EIR-14 |
| Sources | Git 读写、文件列表与读取 | GetFileInfo、WriteFile、ForceWriteFile | — | — |
| Connection | 设备、配对、撤销、轮换、探测 | Doctor、Shutdown | HealthCheck 只给本机发现用 | EIR-8 |
| 其他 | Clipboard、ContextVariable、Rules、Token Usage（全局） | SessionUsage、FileTransfer 三个、命令目录、工具后台/Shell 控制 | — | — |

会话流方法（`openChatStream`、`openContinuationStream`、`openRegenerateStream`、`openResumeStream`、`chatSync`、`syncInputDelivery`）没有经 `IUniverseAgentConnection` 的直接调用方，由 sessionView 的 `submitInput` / `regenerateTurn` / `continueGeneration` 经 sessionCore 意图间接到达。regenerate 与 resume 在宿主侧具体落到哪个方法，未核。

## 与 10-27 快照相比的变化

- 引擎新增 `GetPermissionMode`，IDE 未跟（EIR-5）。
- 引擎 `PermissionDecision` 重编号早在 10-16，快照未覆盖（EIR-1）。
- 引擎 HEAD 新增 `SubAgentCreated.depth=5`、`SubAgentCompleted.depth=4`、`HistoryEntry.turn_id=9`、`TeamAborted.task_summaries=4`、RemoteAgent 三个安全字段与 `retain_binding`。IDE 目前不读前两个所在的 ChatResponse 臂，影响为零；后几个见 EIR-13、EIR-14。
- 快照列出的其余矩阵项（Agent 选择、工具范围、会话管理停在传输层、触发器、Memory 高级、远程子引擎）在 HEAD 上不变。

## 建议顺序

1. **定引擎版本**（EIR-2）：用户决定 50061 换到哪个 SHA。不换，后面所有真实引擎验收都会继续对着旧语义。
2. **防漂移**（EIR-16、EIR-1）：先做 proto 字段比较脚本，再修权限枚举。两者都小，且能在换钉前完成。
3. **链路稳健性**（EIR-7、EIR-3）：超时不再判链路失效；模型写入改为探测放行。
4. **写入归属**（EIR-4）：沿 D1391 的方案扩到会话写与队列写。
5. **生成中输入合同**（EIR-11、EIR-10）：与 D1388 一起设计 `delivery` 与投递回执。
6. **读回**（EIR-5）：权限模式回读。
7. 其余 P3 随相关切片处理。

## 未覆盖

- 没有对 50061 做反射或业务调用，运行中引擎的 RPC 名单来自源码 SHA，不是线上实测。
- Hub 中继、配对与 recoverTrust 路径没有重读（ELR 已覆盖）；`sessionViewHostHistoryFill.ts` 的缺口回填没有重读。
- MCP、Plugin、AgentProfile 的必选方法没有逐个核调用方；Trigger 与 MCP 的读改写字段保持没有核（两者 proto 在 10635 与 HEAD 间无变化）。
- 引擎 `AgentStatus` / `AgentType` 枚举是否新增成员，未核。
