---
title: "M7 缺口收口：Hub 设备接线、子代理 catalog 同步、Navigator / Overview 残留"
type: plan
status: implemented
phase: M7
updated: 2026-09-04
summary: "GC-1–GC-6 已落（merge d98d888a）：hubDevice/配对、设备动作与 probe、catalog 观察 lease、Navigator/Inspect、Overview Model；PRD-024 仍待真 Hub 冒烟；D21 已闭（connection.isAgentTreeFetchFailed）"
---

# M7 缺口收口

> **触发：** 2026-09-03 用户整理的「能做 / 不能做」清单。核对后，可做的项**都有签收方案条文**，只是实施时没落到底：GC-1/2/3 对应 [connection-hub-client §3.3 / §4.2](connection-hub-client.md)（其中 GC-1b 是 H2/H4a「配对已落」没接到拨号路径的残留）；GC-4 对应 [conversation-session-windows §3.3](conversation-session-windows.md)「Agent spawn 子代理 → catalog 有 chat、时间线可点；不加 tab、不弹对话框」与 PRD-016 验收 4（**不是** PRD-022 验收 3，也不是 navigator-engine-segments §2.6——后者写的是「不交付预同步 catalog」，本稿 §6 说明改口理由）；GC-5 对应 [navigator-engine-segments §2.5 / §3 矩阵](navigator-engine-segments.md)；GC-6 **Model 行**对应 [engine-preferences-completion §3.1](engine-preferences-completion.md)「Model 摘要只在 `models=SUPPORTED` 且 E2-2 落地后显示注册表已启用模型数」；**Provider 行按同节「G-ENG-1 前不显示」保持现状**，不是残留。本稿不新增产品行为，**不改 PRD**（规则 10a 不触发）。  
> **基线：** 相对 **commit HEAD**。工作树里另一工位有大量针对本稿各项的未提交改动，§1 按文件列全并标出**与本稿相反、以本稿为准时必须改掉**的在途设计；实施者以 `git diff` 对齐、**不重做也不 stash**（规则 3b），但不得因「已在途」保留 §1 点名要改的实现。  
> **不推翻：** [ADR-003](../decisions/003-engine-adapter-boundary.md)；[page-access-schemes §5.4](page-access-schemes.md)；[connection-hub-client §3](connection-hub-client.md)（secrets 不过 ProxyChannel；无自动拨号；SAS 不可跳过）；[navigator-engine-segments §0](navigator-engine-segments.md)（三段只读、不指挥）；[m7-ui-completion-wave §2 / §6](m7-ui-completion-wave.md)（测试非阻塞；不做会话级模型策略 UI；不为 G-ENG-* 画表单）。  
> **姊妹方案：** [session-view-frame-fanout](session-view-frame-fanout.md)（平台侧首帧丢失会放大 GC-5 的「先写成没有团队」症状；两稿独立合入，本稿不依赖它）。  
> **审查记录：** 见文末（规则 16，待起审）。

## 0. 目标 / 非目标

**目标：** Connection 页对 Hub 目录里的可用设备点 Connect 能真正建 `hubDevice` profile 并进入配对；设备行有 Rename / Revoke，Hub 账户区能输入设备码；Test Connection 报的是探测结果而不是回显；引擎 fork 出子代理后对话侧自动出现可点条目；Navigator Team / Inspect 的过渡态与标题按方案落实；Engine Overview 在 `listModels` 已通时不再写死 Unavailable。

**非目标（协议或已拍板挡住，一律保持诚实 stub，不做 UI 壳）：**

| 不做 | 依据 |
|------|------|
| 会话级 `SwitchModel` / 模型策略；Composer Route / Permission 模式 | [status.md](../progress/status.md)「不做」；无会话级 RPC |
| 订阅流 4 L3/L4 demux（Ask-user 座位进时间线） | [conversation-stream-timeline](conversation-stream-timeline.md) 未合入前不在本稿 |
| `AgentService.Rename` 进 transport；MessageQueue / Stop / Goal；Fork catalog | 无 RPC 或未进传输原语 |
| Provider / Rules / Hooks / Agents Model 子 tab（G-ENG-1/2/3/4）；Projects 按 `work_dir` 分组（G-NAV-1）；重连后团队状态后缀（G-NAV-2）；历史会话 Review 归因（G-REV-1） | [engine-protocol-surface §4](../../docs/reference/universe-agent/engine-protocol-surface.md) |
| Preferences 模态高对比描边 | [D19](../progress/deferred-gaps.md) 已 closed（T1 HC 已覆盖 Preferences pane）。本稿只留一个核对项（§4 GC-7），不算切片 |

## 1. HEAD 事实与在途改动

| 项 | HEAD | 工作树在途（另一工位，未提交） | 以本稿为准时须改掉 |
|----|------|------|------|
| Hub 设备 Connect | `handleConnectDevice` 只按 `displayName` 找已有 profile，找不到停在「No profile for device — pairing wiring pending.」；`IUniverseAgentHubService` 无建 `hubDevice` profile 的方法；`ConnectionResolver.resolveHubDevice` 已认 `hubDevice` target（查 live 目录 → relay ticket），**但 `!profile.trust` 时返回 `pairing_required`** | `hub.ts` 增 `addHubDeviceProfile({hubDeviceId, displayName})`；node 实现按 `hubBaseUrl + hubDeviceId` 去重后 `createDraft`；`accountId` 填 `auth.email`；browser stub / connectionService 转发 / pane 调用 / 测试均已改 | `accountId` 改 userId；`mustChangePassword` 拒绝（§2.1） |
| **配对回路**（GC-1b） | `PairingOrchestrator`（S1–S7 + `confirmSas` + `confirmRecoverTrust`）**生产零引用**，只被测试构造；`connectProfile` 遇 resolver `pairing_required` 直接失败；pinned 路径无 trust → `trust_missing`；`IUniverseAgentConnection` **没有**「确认 SAS」方法，pane 的 SAS 对话框**确认分支什么都不做**（只有取消会 `disconnect`）。Direct 路径今天能走通是因为无 trust 时 `endpoint.tls === null` → 明文 `connect()` → 引擎回 `pairing_nonce + sas_code`，随后同样没人写 trust | 无 | — |
| 设备行动作 | `renameDevice / revokeDevice / confirmDeviceCode` 三方法 HEAD 已有（node 走 `_runHubControlPlaneMutation` + `refreshDirectory`），pane 无任何按钮 | pane 已加**选中行**工具条 Rename / Revoke（`deviceActionsRow`，非行内）+ 账户区设备码输入 + Confirm；Revoke **不**置本地 profile `revoked`、不断开 | 工具条形态可保留（§2.2 改为「选中行工具条」）；Revoke 后置本地 profile `revoked` + 断开须补 |
| Test Connection | 按钮只 `getConnectionTestStatusText(getConnectionPhase(), pairingPending)` 回显 | `IUniverseAgentConnection.probeEngine()`：复用**已连接**的 transport 探测；未连接时不可用 | 换成按 profile 独立探测 channel（§2.3）；`probeEngine()` 删除或改名为 `probeConnectionProfile(profileId)` |
| 子代理 catalog | `ConversationSessionChatService.catalog` 内存 Map；只在 `openSubAgent` / Navigator Reveal 时惰性 `registerSubAgentChat`；chatId ≡ `agent_id`、根 = `'default'` | 新 `common/conversationLiveAgentCatalog.ts`（`collectLiveAgentTreeCatalogEntries`，自带 `agentId === 'root'`）；chat service 构造时 **自持** `acquireSessionView(activeSessionId)` 并在 `onDidApplyFrame` 调 `syncSubAgentsFromLiveTree`，只增不减 | 观察 lease 挪到 roster（§2.4 修订 3）；判根复用；标题更新 |
| Navigator Agents Refresh | `requestAgentTreeRefresh` 在 `IUniverseAgentConnection`，无 ViewAction | `NAVIGATOR_AGENTS_REFRESH_COMMAND_ID` ViewTitle 动作已加 | 补 precondition（§2.5a） |
| Navigator Team 过渡态 | `refreshTeamData` 在 `liveTree === undefined` 时走 `findManagerNodes([])` → 「当前会话没有团队」 | `navigatorTeamData.getTeamTreeEmptyCopy(capability, liveTree)`：`undefined` → 「正在读取 Agent 树…」**已落** | 与 Hierarchy 共用同一判定函数（§2.5b）；本项大半已落 |
| Inspect 标题 / stale | `staleNote` 建好即 `display:none`；标题固定 "Inspect"；`IAgentInspectService` 只有 `setTarget / getTarget / onDidChangeTarget` | 标题已写成「Inspect — {name}」；`AgentInspectView` **自持 `NavigatorSessionLeaseHolder`**；`isInspectAgentStale` 仅对 `kind === 'agent'` | **删掉 Inspect 自持 lease**（违反 §2.5「不给 Inspect 单独 lease」）→ 改为 §2.5d 总线；标题字面改回签收原文「Inspect: {name}」；stale 覆盖 `member` |
| Engine Overview | Provider / Model 两行写死「Unavailable — this client has no … API yet.」 | Model 行已按 `listModels` 写模型数；**Provider 行已写 provider 数**；已有 `engineOverviewSection.test.ts` | **Provider 行回退**到不显示 / unsupported（E2 §3.1、§3.2「不在本组重复 provider 名」）；测试文件沿用不新开 |

## 2. 设计

### 2.1 GC-1 Hub 设备 Connect（对齐在途改动，两处修订）

| 项 | 选定 |
|----|------|
| 合同 | `IUniverseAgentHubService.addHubDeviceProfile(input: { hubDeviceId; displayName? }): Promise<HubProfileResult>`；`HubProfileResult` = 现 `HubDirectAddressResult` 改名，保留 `type HubDirectAddressResult = HubProfileResult` 别名一刀内删旧名 |
| 去重 | 按 `target.kind === 'hubDevice' && hubBaseUrl === active && hubDeviceId` 命中即返回已有 `profileId`（与在途一致） |
| **修订 1：`accountId`** | 填 Hub 会话的 **userId**，不是 email。`IHubSessionStore` 增 `getAccountIdForHub(hubBaseUrl, nowMs): string \| null`（`HubSessionStore` 读 bucket.userId；`InMemoryHubSessionStore` 同）。[connection-hub-client §3.3](connection-hub-client.md) 的 `hubDevice.accountId` 语义即账号 id |
| **修订 2：前置状态** | `mustChangePassword` 时**拒绝**建 profile（`hub_password_change_required`），而不是建了再让 resolver 挡。理由：pane 上「必须先改密码」提示与设备列表同屏，建出一条 `pairingPending` profile 只会让 Connection profiles 区多一行无法连接的条目 |
| pane | `handleConnectDevice` → `addHubDeviceProfile({hubDeviceId: device.id, displayName: device.name})` → 失败写 `testStatus`；成功 `connectProfileWithPairing(profileId)` |
| Web | browser stub 返回 `hubUnsupportedResult()`（在途已有） |

**GC-1b 配对回路接线（P 槽；GC-1 的硬前置，否则 V-GC1 只能停在 `pairing_required` 失败文案）**

| 项 | 选定 |
|----|------|
| 触发 | `connectProfile(profileId)`：resolver 返回 `pairing_required`（`hubDevice` 无 trust），或 `directAddress` 无 trust 且用户显式点 Connect（S0：只在用户显式点连接时进入，无自动拨号） → 进入 `PairingOrchestrator.startPairing(profile, endpoint)`；不再直接失败 |
| 依赖注入 | `UniverseAgentConnectionService` 持有一个 `PairingOrchestrator`，`createPinnedTransport` 用生产的 `createPinnedGrpcUniverseAgentClient`（与日常拨号同一条），trust 写入走 `IConnectionProfileStore.put`（S7 原子写） |
| `connectProfile` 返回 | `startPairing` 成功 → `{ ok: true, pairingPending: true, sasCode, engineIdentityId }`（`sasCode` / `engineIdentityId` 来自 **handshake** `GetAuthNonce` / `Connect` 返回，不是 Hub 目录值）；`ConnectionPhase` = `connecting`，不置 `connected`（PRD-024 验收 6） |
| 新合同 | `IUniverseAgentConnection.confirmPairing(): Promise<ConnectProfileResult>` → orchestrator `confirmSas()`（S5–S7：正式 `Connect` + 原子写 trust）→ 成功后走既有 connected 收尾（capabilities probe、`_rememberAdvertisedMethods`）；`cancelPairing(): Promise<void>` → 丢弃 provisional、`disconnect()`。`recoverTrust`（S4 意外拿到 token）沿 orchestrator 既有 `confirmRecoverTrust`，pane 用同一对话框但文案换成「身份 + 指纹人工确认」（Desktop ADR-031） |
| pane | `promptSasConfirmDialog` 的 `sasCode` / `engineIdentityId` 只取 `connectProfile` 返回的 handshake 值；**确认 → `confirmPairing()`，取消 → `cancelPairing()`**（HEAD 确认分支为空，必须补）。Hub 目录的 `device.engineIdentityId` 只作对话框里的**展示预览**（「目录记录的引擎身份」一行），不参与核对，也不写 trust |
| Web | 两个新方法返回 `unsupported_environment` |
| 不做 | 自动重配对；跨 profile 复用 trust；跳过 SAS |

### 2.2 GC-2 设备行动作 + 设备码

| 项 | 选定 |
|----|------|
| 形态 | 采用在途的**选中行工具条**（`deviceActionsRow`：Rename / Revoke 跟随 `hubDevicesList` 选中项启用），不做行内三钮——与 Connection profiles 区的 Connect / Disconnect / Forget 同形。`revoked === true` 的行 Revoke 禁用、Rename 禁用；`NOT_SERVING` / `OFFLINE` 行 Connect 隐藏（HEAD `canConnectHubDevice`）但 Rename / Revoke 可用 |
| Rename | `IQuickInputService.input({ value: device.name, prompt })` → 空或未变不调；`hubService.renameDevice(id, name)`；失败写 `hubDirectoryBanner` 旁 `role=status`（不弹对话框） |
| Revoke | `IDialogService.confirm`（主按钮「Revoke」，正文写明「该设备将无法再通过 Hub 连接；本机已配对的 profile 会标记为 Revoked」）→ `hubService.revokeDevice(id)`。成功后 node 服务把所有 `target.hubDeviceId === id` 的本地 profile `state` 置 `'revoked'`（`ConnectionProfile.state` 已有该值）并 `_fireProfilesChanged`；若其中一条正在连接，先 `connectionService.disconnect()` |
| 设备码 | Hub 账户区在「Refresh devices」旁加一行：`input.connection-field-input`（placeholder「Device code」）+ **Confirm** 按钮 → `hubService.confirmDeviceCode(code)`；结果写 `hubAuthBadge` 旁新 `role=status` 元素；成功清空输入。仅 `signedIn` 时可用 |
| 窄宽度 | 工具条在 `.is-compact` 下换行，沿用 `connectionPreferencesPane.css` 既有分区规则 |
| 不做 | 设备列表的多选 / 批量；设备详情面板 |

### 2.3 GC-3 Test Connection 探测

[connection-hub-client §4.2](connection-hub-client.md) 原文：「对当前 active profile 跑序列 A 第 1–3 步（不 Connect），报告到 `GetAuthNonce` 成功与否；无 profile 时仍诚实文案」。HEAD 只做了「无 profile」那一半。

| 项 | 选定 |
|----|------|
| 合同 | `IUniverseAgentConnection.probeConnectionProfile(profileId): Promise<ConnectionProbeResult>`；`ConnectionProbeResult = { ok: true; path: ConnectionPath; authority: string; latencyMs: number } \| { ok: false; code: ConnectionFailureCode \| 'unsupported_environment'; reason: string }`。放在 `common/universeAgentConnection.ts` 现有 `connectProfile` 旁 |
| node 实现 | `UniverseAgentConnectionService`：`resolver.resolve(profileId)` → 按 `endpoint.tls` 有无用生产既有的 `createPinnedGrpcUniverseAgentClient` / `_createTransport` 建**独立**channel（与 `connectProfile` 同一条建链代码；**不是** `PairingOrchestrator.startPairing`——那会走进观察叶 / provisional trust / `Connect`）→ `transport.getAuthNonce({ clientIdentityId, clientPublicKey })`（client identity 来自 `clientIdentityStore.getOrCreateIdentity()`）→ 成功即 `ok` 并 `close()`；**不**发 `Connect`、不写 trust、不改 `ConnectionPhase`、不动 `this._transport`；失败按 resolver / transport 错误映射 `ConnectionFailureCode`。超时 10 s（实现参数） |
| 与在线连接的关系 | 若 `profileId` 就是当前已连接 profile，仍走独立探测 channel，探完关闭；结果不影响现连接。在途 `probeEngine()`（复用已连接 transport、未连接不可用）**不满足** §4.2「对 active profile 测」，删除 |
| browser | 返回 `{ ok: false, code: 'unsupported_environment', reason }`（该码已在 `ConnectionFailureCode` 闭集） |
| pane | 按钮文案改「Test active profile」；无 `activeProfileId` → 保留 HEAD 文案；有 → 「Testing…」→ 成功「Reachable · {path} · {latency} ms」/ 失败 `reason`。`role=status` 不变 |
| 不做 | 对全部 profile 批量探测；把探测结果写进 profile 落盘 |

### 2.4 GC-4 子代理 catalog 跟 liveAgentTree（对齐在途改动，三处修订）

| 项 | 选定 |
|----|------|
| 数据源 | 当前活动会话 lease 的 `snapshot.liveAgentTree`（与 Navigator 同源，不拉 RPC） |
| 映射 | 非根节点 → `{ chatId: agentId, title: name.trim() \|\| agentId, parentChatId }`；父为根时 `parentChatId = 'default'`；**根不登记**（[navigator-engine-segments §2.6](navigator-engine-segments.md)）。判根统一用 `navigator/common/navigatorAgentHierarchy.isEngineRootAgentId`——**修订 1**：`conversationLiveAgentCatalog.ts` 不再自带 `agentId === 'root'`；该判根函数若因分层不便被 conversation 引用，则把它下沉到 `contrib/conversation/common` 并由 navigator 反向 import（conversation 不依赖 navigator） |
| 语义 | 只增不减：节点从树上消失，catalog 条目保留（可能有已开 tab）；**修订 2**：同 id 已存在但 `title` 变化时更新标题并 fire（子代理改名在 Navigator 与对话侧要一致） |
| lease 所有权 | **修订 3**：不在 `ConversationSessionChatService` 里另持一个常驻 lease。改为由 roster 在活动会话变化 / 引擎连接变化时维护**一个**「活动会话观察 lease」，并暴露 `onDidChangeLiveAgentTree: Event<{ sessionId: string; tree: LiveAgentTreeNodeView }>`；chat service 订阅该事件调 `syncSubAgentsFromLiveTree`。**合同落点**：该事件写进 `IConversationRosterService` 接口（`conversationStubService.ts`，同 token 增量方法，ADR-003 口径），`ConversationStubService` 实现为 `Event.None`，`ConversationEngineRosterService` 实现真事件；chat service 注入的是 roster token，不得依赖实现类。理由：① lease 归属清晰——roster 已是 `acquireSessionView` 的实现方；② 观察 lease 的生命周期与「活动会话 + 引擎已连」严格绑定，断连或无活动会话时释放、事件不再 fire。注：这**不减少** lease 数（可见时仍是 Part + Agents + Team + roster 观察 = 4），收益是归属而非数量 |
| 可观察结果 | catalog-on-spawn 的产品面是：**不经 Navigator Reveal**，`openSubAgent(sessionKey, agentId)` / 面包屑 `navigateAgentBreadcrumb` 已能解析该 `agent_id` 并带正确 `parentChatId` 链。HEAD 与工作树的 `ConversationSubAgentOverlay` **不渲染 catalog 列表**，时间线里的可点性来自 Part 自己的 lease，本稿不给 Overlay 加列表零件 |

### 2.5 GC-5 Navigator 残留

| 子项 | 选定 |
|------|------|
| **GC-5a** Agents Refresh | 在途 `NAVIGATOR_AGENTS_REFRESH_COMMAND_ID` 即为方案 §2.2 的「Refresh」动作，保留；补一条：引擎未连接时动作 `precondition` 为 false（用现有 `navigatorAgentsSubview.*` 同类 context key 加 `ua.engineConnected` 或等价键） |
| **GC-5b** Team 读取态 | 对齐 [navigator-engine-segments §3](navigator-engine-segments.md) **矩阵行**（不是其下方「Team 优先级」子弹——那条会把 `undefined` 再判成「没有团队」）：未连接 → `agentTree` UNSUPPORTED → **树未到（`liveTree === undefined`）**：有失败态则失败 note，否则「正在读取 Agent 树…」→ 树无 MEMBER →「当前会话没有团队」→ … 。在途 `getTeamTreeEmptyCopy` 已覆盖「正在读取」一半；本刀把它与 Hierarchy 的判定抽成 `navigator/common` **同一个**函数，两叶不得各判各的。**失败轴**：HEAD Hierarchy 用 `getConnectionSnapshot().transport === 'failed'`——那是 gRPC 连接态，不是 `AgentService.Tree` 首拉失败；连接 ok、首拉 Tree 失败、树一直 `undefined` 时两叶都会停在「正在读取」，正是 §3 禁止句。renderer 今天**拿不到**树拉取失败事实（host `scheduleAgentTreeRefresh` 失败只在 capability 上区分 UNIMPLEMENTED）。本稿**不**把已知错轴复制到 Team：共用函数只接 `capability + liveTree + treeFetchFailed?: boolean` 三个输入，`treeFetchFailed` 由 host 经 lease 快照 / connection 事件提供——该信号 HEAD 缺失，登记为 **D21**（[deferred-gaps](../progress/deferred-gaps.md)：「host 暴露 Agent 树首拉失败态」，归订阅流 Actor 回路线），闭合前两叶行为一致地「按 capability + 树到没到」判定 |
| **GC-5c** Inspect 标题 | `renderTarget` 时 `this.updateTitle(...)`，字面钉死签收原文 **「Inspect: {0}」**（在途写成「Inspect — {0}」，改回）；无 target → "Inspect"。`nameOf`：agent → `node.name \|\| node.agentId`；member → `member_name`；task → `subject \|\| task_id`；activity → `toolName` |
| **GC-5d** Inspect stale note | **删掉在途 `AgentInspectView` 自持的 `NavigatorSessionLeaseHolder`**（§2.5 明令「不给 Inspect 单独 lease」）。`IAgentInspectService` 增 `setLiveAgentIds(source: 'agents' \| 'team', ids: ReadonlySet<string> \| undefined)` + `getLiveAgentIds(): ReadonlySet<string> \| undefined`（两源取并集；两源都 `undefined` 才返回 `undefined`）。**Agents 叶**在 `refreshFromLease` 后、**Team 叶**在 `refreshTeamData` 后各自写入树上全部 `agentId`（叶隐藏 / lease 释放时写自己那一源为 `undefined`）。`AgentInspectView`：target 为 `agent` / `member` 且 `ids !== undefined && !ids.has(id)` → 显示 `staleNote`「已不在当前树中」；`ids === undefined`（两叶都不持 lease）→ 不显示（§2.5「两叶均隐藏后不保证跟随」）。只藏 Agents、Team 仍可见时 member 消失照样能标 stale |

### 2.6 GC-6 Engine Overview 模型摘要

| 项 | 选定 |
|----|------|
| Model 行 | 按 `capabilities.models`：`UNSUPPORTED` → 保留 HEAD Unavailable 文案（附 reason title）；`UNKNOWN` → 「正在确认引擎能力…」；`SUPPORTED` → `listModels()`（generation 守卫与 `EngineProviderModelSection.refreshModels` 同式）→ 「{N} models · {M} providers」/ 0 条「No models in the registry.」/ 失败 「读取失败 — {reason}」 |
| Provider 行 | **保持 HEAD**：`providerConfig` 固定 UNSUPPORTED（G-ENG-1）→ Unavailable 文案不变。[engine-preferences-completion §3.1](engine-preferences-completion.md)「Provider 摘要在 G-ENG-1 前不显示」、§3.2「不在本组重复 provider 名（避免被读成已配置）」是已签收合同；在途「{M} providers」**回退**。要显示 provider 数须先改 E2 正文并走 PRD-025 验收 2 复核，不在本稿 |
| 触发 | `onDidChangeConnection` + 节激活（`setSectionActive(true)` 时若无数据则拉一次），不轮询 |
| 抽取 | 不需要按 provider 分组（Provider 行不显示），只用 `result.models.length`；不抽 `groupModelsByProvider` |

## 3. 切片

| 切片 | 做什么 | 硬依赖 | 测试 / Exit | 冲突域 |
|------|--------|--------|-------------|--------|
| **GC-1** | §2.1 前半（对齐在途 + 修订 1/2） | 在途改动先 `git diff` 对齐 | `universeAgentHubService.test.ts`：signedIn 建 profile 且 `target.accountId === userId`；重复调用同 id；`signedOut` / `mustChangePassword` 拒绝码；`connectionPreferencesPane.test.ts`：Connect 调 `addHubDeviceProfile` 后以返回 id 调 `connectProfile`；失败文案落 `testStatus`；「pairing wiring pending」字面在源码与测试中 **0 命中** | `common/hub.ts` · `node/universeAgentHubService.ts` · `node/hubSessionStore.ts` · `browser/universeAgentHubService.ts` · `node/universeAgentConnectionService.ts`（转发行）· `connectionPreferencesPane.ts` + 两测 |
| **GC-1b** | §2.1 配对回路接线 | GC-1；**P 槽**（改 `IUniverseAgentConnection` 合同与 node 服务） | node 测（fake pinned transport + fake orchestrator deps）：`hubDevice` 无 trust → `connectProfile` 返回 `pairingPending: true` 且 `sasCode` 来自 handshake、`ConnectionPhase !== connected`；`confirmPairing()` → profile store 写入 trust、phase `connected`；`cancelPairing()` → 无 trust 写入、`disconnect`；S4 意外 token → 走 `recoverTrust` 分支不 install；browser 两方法 `unsupported_environment`；pane 测：SAS 确认调 `confirmPairing` 一次、取消调 `cancelPairing` 一次、对话框 `sasCode` 等于 `connectProfile` 返回值而非目录值 | `common/universeAgentConnection.ts` · `node/universeAgentConnectionService.ts` · `node/pairingOrchestrator.ts`（仅接线，不改 S1–S7）· `browser/universeAgentConnectionService.ts` · `connectionPreferencesPane.ts` / `connectionPreferencesPaneSas.ts` + 测 |
| **GC-2** | §2.2（对齐在途工具条 + 补 revoke 本地态） | GC-1（同文件） | pane 测：revoked 行 Rename / Revoke 禁用；Rename 取消不调服务；Revoke 走 confirm 且拒绝不调；confirmDeviceCode 成功清空输入；hub 服务测：revoke 成功后同 `hubDeviceId` 的 profile `state === 'revoked'`；连接中的 profile 被 revoke → `disconnect` 一次 | `connectionPreferencesPane.ts` / `.css` / labels · `node/universeAgentHubService.ts` |
| **GC-3** | §2.3（替换在途 `probeEngine`） | GC-1b（同合同文件，P 槽同写者） | `universeAgentConnection.test.ts`：browser stub 返回 `unsupported_environment`；node 测（fake transport 工厂）：resolver 失败码透传；`getAuthNonce` 成功 → `ok` 且 `ConnectionPhase` 不变、`this._transport` 不变、无 `Connect` 调用、探测 channel 已 `close`；pane 测：无 active profile 保留 HEAD 文案；有 → 调 `probeConnectionProfile` 一次；`probeEngine` 字面 0 命中 | `common/universeAgentConnection.ts` · `node/universeAgentConnectionService.ts` · `browser/universeAgentConnectionService.ts` · `connectionPreferencesPane.ts` |
| **GC-4** | §2.4（对齐在途 + 修订 1/2/3） | 在途改动先对齐 | `conversationLiveAgentCatalog.test.ts`（在途）保留；`conversationSessionChat.test.ts`：fake roster fire `onDidChangeLiveAgentTree` → 不经 Reveal 即可 `openSubAgent(agentId)` / 面包屑解析、根不登记、同树再 fire 不触发 `onDidChangeCatalog`、改名触发一次；roster 观察 lease 测放**新文件** `conversationEngineRosterLiveTree.test.ts`（活动会话切换时旧 lease 释放、新 lease 获取各一次；断连后释放；stub roster 事件为 `Event.None`）——**不**改 `conversationEngineRosterService.test.ts`，避开 fanout F1 在该文件改 mock | `conversationSessionChatService.ts` · `conversationEngineRosterService.ts` · `conversationStubService.ts`（接口 + `Event.None`）· `common/conversationLiveAgentCatalog.ts` · `navigator/common/navigatorAgentHierarchy.ts`（判根下沉）+ 测 |
| **GC-5** | §2.5 a–d（含删 Inspect 自持 lease） | — | `navigatorAgentsSubviews.test.ts`：Refresh 动作调 `requestAgentTreeRefresh` 一次、未连接不可用；`navigatorTeam.test.ts`：`liveTree === undefined` → 「正在读取 Agent 树…」且**不**出现「没有团队」；Hierarchy 与 Team 对同一输入返回同一空态字串（共用函数）；`agentInspectPanel.test.ts`：四模板标题字面「Inspect: …」；Agents 源 `undefined`、Team 源含树但缺 target id → stale 可见；两源 `undefined` → 不可见；`AgentInspectView` 不 import `NavigatorSessionLeaseHolder`（负向） | `contrib/navigator/**` |
| **GC-6** | §2.6（Model 行保留在途，Provider 行回退） | — | 沿用在途 `engineOverviewSection.test.ts`：Model 三态文案；`listModels` 只调一次（generation 守卫）；Provider 行字面不含数字、不含 provider 名（负向） | `engineOverviewSection.ts` + 该测 |
| **GC-7**（核对项） | 确认 D19(2) 的 HC 描边确实覆盖 Preferences 模态（`productAccessibility.css` / `ua-common.css` 引入链） | — | 目视或 axe 一次；若缺则补 import 并记 [a11y-rwd-l1](../progress/a11y-rwd-l1.md)，不新开 D 项 | css |

**槽位与顺序：** GC-1 → GC-1b → GC-2 → GC-3 同一写者串行（Connection pane 与 `hub.ts` / `universeAgentConnection.ts` / `universeAgentConnectionService.ts` 由同人改，避免双写；GC-1b / GC-3 的合同行属 P 槽范围，该写者在此期间兼 P）；GC-4 归 B 槽；GC-5 归 Navigator 文件所有者；GC-6 归 A 槽，可与 GC-1 并行（不同文件）。任一切片不等 V 槽全绿（[m7 §2](m7-ui-completion-wave.md)）。**GC-1 单独合入没有产品价值**（Connect 只会停在 `pairing_required`），验收 V-GC1 以 GC-1b 合入为前提。

## 4. 验收（产品语言）

| ID | 场景 | 通过标准 |
|----|------|----------|
| V-GC1 | 已登录 Hub，目录里一台 ONLINE + SERVING 设备，本机无 profile；点该行 Connect（**GC-1 + GC-1b 均合入**） | Connection profiles 区出现该设备名的 profile（Pairing pending）并弹 SAS，8 位码与引擎端一致；确认后 profile 变 Paired、状态栏「Engine · Hub relay」；取消后无 trust、profile 仍 Pairing pending；不出现「pairing wiring pending」 |
| V-GC1' | 同上，但只合入 GC-1 | 出现 profile，Connect 停在 `pairing_required` 诚实文案；**不**声称弹 SAS |
| V-GC2 | 同一设备再点 Connect | 不新增第二条 profile |
| V-GC3 | 设备行 Rename → 改名确认 | 列表刷新后显示新名；取消不发请求 |
| V-GC4 | 设备行 Revoke → 确认 | 该行消失或标 revoked；本机对应 profile 变「Revoked」；若正连着则断开 |
| V-GC5 | 输入设备码 → Confirm | 成功后输入框清空、设备列表刷新；失败显示 Hub 原因 |
| V-GC6 | 选中一条 Direct profile 点 Test | 可达时显示 path + 延迟；引擎关掉后显示失败原因；期间状态栏连接态不变 |
| V-GC7 | 引擎 fork 出子代理；**不**打开 Navigator | 面包屑 / `openSubAgent(agentId)` 在 ≤ 1 s 内能解析该子代理（标题、父链正确）；点开为 PRD-016 居中对话框；期间不自动加 tab、不自动弹对话框（session-windows §3.3） |
| V-GC8 | 刚接通引擎、打开 Team 叶 | 先「正在读取 Agent 树…」，收到树后才判定「没有团队」或列成员；同一时刻 Agents Hierarchy 显示同一空态字串 |
| V-GC9 | Inspect 一个团队成员，隐藏 Agents 叶只留 Team 叶，随后该成员从树上消失 | Panel 标题「Inspect: {name}」保留，顶部出现「已不在当前树中」 |
| V-GC10 | Engine Overview，`listModels` 可用 | Model 行显示「N models」；Provider 行仍为 Unavailable，不出现任何 provider 名或计数 |

## 5. 风险

| 风险 | 缓解 |
|------|------|
| 在途改动与本稿修订并存，实施者不知以谁为准 | §1 表逐项列出在途内容与本稿修订；实施 commit 以本稿为准，先 `git diff` 对齐再改 |
| GC-4 修订 3 把 lease 挪到 roster，可能与 [session-view-frame-fanout](session-view-frame-fanout.md) F1 同期改 `conversationEngineFrameSource.ts` | GC-4 只改 roster / chat service，不碰 `conversationEngineFrameSource.ts`；F1 不碰 roster。**测试文件**：F1 改 `conversationEngineRosterService.test.ts` 的 `MockUniverseAgentSessionView`，GC-4 的观察 lease 测放新文件，不双写 |
| GC-3 探测走 `PairingOrchestrator` 会带进 trust 写路径 | §2.3 明确走 `createPinnedGrpcUniverseAgentClient` / `_createTransport` 建链，不调 `startPairing`；只调 `getAuthNonce`，不构造 `DeviceAuth`、不调 `Connect`；测试负向断言 `Connect` 调用次数为 0 |
| GC-1b 把 `PairingOrchestrator` 接进生产后，S1–S7 语义被顺手改动 | GC-1b 只写接线（deps 注入 + 两个新合同方法），`pairingOrchestrator.ts` 本体不改；既有 `pairingOrchestrator.test.ts` 全绿作门禁 |
| GC-2 Revoke 把本地 profile 置 revoked 后用户想恢复 | Hub 侧 revoke 本就不可逆；本地 profile 可 Forget 删除；不做「取消 revoke」 |
| GC-5b 「正在读取」在首帧丢失（姊妹方案 §1.2）时停留过久 | 宿主 `acquireLease` 后会补 `setLiveAgentTree`；F1 合入后彻底消除；本稿不为此加超时 |

## 6. 知识层回填（实施 commit 时）

- [connection-hub-client §4.2 / §5](connection-hub-client.md)：设备行动作、Test Connection、**配对回路接入 `connectProfile`（GC-1b，补记为 H2/H4a 残留）**标「已落」；PRD-024 仍待真 Hub 冒烟才升 `implemented`。**已回填** @ 2026-09-04。
- [navigator-engine-segments §4 N2 / N4](navigator-engine-segments.md)：Inspect 标题 / stale、Team 读取态标已落；§2.6 加「catalog 由 roster 观察 lease 预同步（GC-4，依据 session-windows §3.3）」并**改掉**「禁止预同步 catalog」一句——该禁令是为防止 A2 在 host 侧造第二张对照表；本稿的预同步仍以 `liveAgentTree` 为唯一源、id ≡ `agent_id`、根不登记，不违反其目的，但条文要改口。**已回填** @ 2026-09-04。
- [conversation-session-windows §3.3](conversation-session-windows.md)：「Agent spawn → catalog 有 chat」标已落（GC-4）。**已回填** @ 2026-09-04。
- [engine-preferences-completion §3.1](engine-preferences-completion.md)：Model 摘要标已落；Provider 摘要仍「G-ENG-1 前不显示」，不改口。**已回填** @ 2026-09-04。
- [traceability](../../docs/product/traceability.md)：PRD-016 / PRD-022 / PRD-024 / PRD-025 行「代码已落」范围更新。**已回填** @ 2026-09-04。
- [deferred-gaps](../progress/deferred-gaps.md)：新增 **D21** host 暴露 Agent 树首拉失败态（GC-5b 失败轴）；GC-7 结果写入 a11y-rwd-l1。**D21 已闭**（`IUniverseAgentConnection.isAgentTreeFetchFailed`，非 lease 字段、非 transport 错轴）；GC-7 未在本 merge 切片内，不改 a11y 账。
- [engine-protocol-surface §5](../../docs/reference/universe-agent/engine-protocol-surface.md)：`IUniverseAgentConnection` 新增 `confirmPairing` / `cancelPairing` / `probeConnectionProfile` 三方法登记。**已回填** @ 2026-09-04。

## 相关

- [connection-hub-client](connection-hub-client.md) · [navigator-engine-segments](navigator-engine-segments.md) · [engine-preferences-completion](engine-preferences-completion.md) · [conversation-session-windows](conversation-session-windows.md)（PRD-016 子代理对话框）· [session-view-frame-fanout](session-view-frame-fanout.md)
- [engine-protocol-surface §4](../../docs/reference/universe-agent/engine-protocol-surface.md)（G-ENG-1/2/3/4、G-NAV-1/2、G-REV-1）

## 审查记录（规则 16）

**2026-09-03 第一轮：** Cursor CLI `agent -p --mode ask`（默认模型；`cursor-grok-4.6-high` 多次因 API `resource_exhausted` 失败后改用）。**Approve with changes**（2 Critical + 9 Important + 3 Minor）。处理：

| 意见 | 处理 |
|------|------|
| C1 `PairingOrchestrator` 生产零引用，`connectProfile` 遇 `pairing_required` 直接失败，V-GC1 按原设计必假通过 | 本会话复核还发现 SAS 对话框**确认分支为空**、`IUniverseAgentConnection` 无确认方法。新增 **GC-1b** 配对回路接线（`startPairing` 接入 `connectProfile`；新合同 `confirmPairing` / `cancelPairing`；SAS 值只取 handshake）；V-GC1 以 GC-1b 为前提，另立 V-GC1' 描述只合 GC-1 的诚实态 |
| C2 §1 在途清单漏 GC-2/3/5b/5c/5d/6，「不重做」会保住与本稿相反的实现 | §1 表按文件列全在途行为并加「以本稿为准时须改掉」列（`probeEngine` 删、Inspect 自持 lease 删、Provider 行回退、标题字面改回、revoke 本地态补） |
| I1 GC-4 授权条文误引 PRD-022 验收 3 / §2.6；应为 session-windows §3.3 + PRD-016 验收 4 | 触发段、§6 改引；确认六项均不触发规则 10a |
| I2 GC-6 Provider 行与 E2 §3.1「G-ENG-1 前不显示」、§3.2「不重复 provider 名」冲突 | Provider 行改为保持 HEAD 并回退在途；只做 Model 行 |
| I3 「复用 pairingOrchestrator 的 channel 工厂」在生产不存在，字面照做会进 trust 写路径 | §2.3 改为 `createPinnedGrpcUniverseAgentClient` / `_createTransport` 建独立链，只调 `getAuthNonce` |
| I4 GC-5d 只让 Agents 叶推 id，Team-only 时 member 消失标不出 stale | `setLiveAgentIds(source, ids)` 双源并集；Team 叶也写 |
| I5 GC-5b 用 connection `transport` 判树拉取失败是错轴；§3 优先级子弹 vs 矩阵行不一致 | 对齐矩阵行；与 Hierarchy 共用一个判定函数；失败轴登记 **D21**（host 暴露树首拉失败态），闭合前不复制错轴 |
| I6 V-GC7「对话窗口内出现可点条目」无对应零件 | 改为「不经 Reveal，面包屑 / `openSubAgent` 能解析」；§2.4 删 Overlay 列表句 |
| I7 `onDidChangeLiveAgentTree` 未进 roster 合同 | 写进 `IConversationRosterService`（同 token 增量），stub `Event.None` |
| I8 `conversationEngineRosterService.test.ts` 与 fanout F1 双写 | GC-4 观察 lease 测放新文件 |
| I9 SAS `engineIdentityId` 用目录值与 trust 记录不同源 | 目录值只作展示预览；核对与写 trust 用 handshake 值（并入 GC-1b） |
| Minor：status.md 引文不存在；「避免 4 个 lease」不成立；GC-5c 冒号字面 | 均改入 |

改稿后 `status` 仍为 `review`，待用户签收。

**2026-09-03 签收：** 用户签收。复核 HEAD：`PairingOrchestrator` 生产零引用、SAS 确认分支空、`connectProfile` 遇 trust 直接失败；§1 在途对照表与 GC-1b / GC-6 Provider 回退已覆盖审查 C1/C2。`status` → `accepted`，实施顺序 GC-1 → GC-1b → GC-2 → GC-3（串行），GC-4/5/6 可并行槽位内推进。
