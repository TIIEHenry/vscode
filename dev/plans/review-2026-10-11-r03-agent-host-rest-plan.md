---
title: "方案 r03：agent-host-rest"
type: plan
status: draft
phase: N/A
updated: 2026-10-11
summary: "2026-10-11 Sonnet 第 1 路审查后改稿。hold 4，drop 0，weaken 1。发布 ack 失败要写明与 github-ui 分叉，且不能把所有 success:false 当致命。隧道先关后连仍是待确认假设。"
---
# 方案 r03：agent-host-rest

状态：草案。
覆盖需求：无（正文未引用需求编号）。


hold 4，drop 0，weaken 1。2026-10-11 Sonnet 第 1 路只读审查后改过 r03-4、r03-5。

## r03-1（hold，高）

### 问题类
SSH 应用存储在解析失败或条目被滤掉之后，下一次整表保存会把原文换成更短的列表。

### 不变量
`SSH_REMOTE_AGENT_HOSTS_STORAGE_KEY` 只有在当前原文能 `JSON.parse` 成数组时才允许被替换或删除。解析抛错，或根值不是数组时，这次 upsert / remove / migrate 整次不写。数组里没通过 `isRawRemoteAgentHostEntry` 或 `isLegacySshRawEntry` 的元素原样留在写回结果里；通过校验的 SSH 条目仍按地址 upsert 或删除。键不存在时，照常写入调用方给出的条目。

### 要动的符号或文件
- `storeSSHRemoteAgentHostEntries`（`src/vs/platform/agentHost/common/remoteAgentHostService.ts` 541–555 行）：先重读原文。解析失败或根值不是数组时返回 `false`，不 `store`、不 `remove`。解析成功时，把未通过上述两个校验的原始元素接在 `toRawEntriesOfKind(entries, SSH_ENTRY_TYPE_CONFIG)` 前面再写。合并结果为空且原文曾经存在时，才 `remove`。原文与新 JSON 相同则直接返回 `true`。
- `readSSHRemoteAgentHostEntries`（525–538 行）继续给界面和调用方只返回通过校验的条目；写路径不得再把这个返回值当成存储全文。
- `addSSHRemoteAgentHostEntry`、`removeSSHRemoteAgentHostEntry` 仍先读再 upsert / filter，然后把结果交给上面的 `storeSSHRemoteAgentHostEntries`。
- `SSHConnectionFactory.storeEntry` 与 `stageConfiguration`（`src/vs/platform/agentHost/electron-browser/sshRemoteAgentHostServiceImpl.ts` 179 行、283–284 行）保持「读、upsert、store」这一调用形状，依赖 store 内部拒绝坏文档。
- `_migrateLegacyEntries`（366–384 行）：只有 `storeSSHRemoteAgentHostEntries` 返回 `true` 时，才把 settings 里已迁出的 legacy SSH 条目删掉。

### 明确不改
WebSocket 的 `storeWebSocketRemoteAgentHostEntries`（491–500 行）及其 `preservedEntries`。`isRawRemoteAgentHostEntry` / `isLegacySshRawEntry` 的字段规则。不把坏条目修成合法 SSH 记录，不改 `toRaw` 字段集合。

### 本地验证
在 `src/vs/platform/agentHost/test/electron-browser/sshRemoteAgentHostService.test.ts` 增加断言：存储值是非法 JSON、或根值不是数组时，`storeEntry` / `addSSHRemoteAgentHostEntry` 之后原文逐字仍在，`readSSHRemoteAgentHostEntries` 仍为空。数组里夹一条字段类型不符的元素时，成功连接写回后该元素仍在原文里，其余合法主机还在。settings 迁移在存储解析失败时不改 `RemoteAgentHostsSettingId`。键本来就不存在时，新增一条主机后存储里只有这一条。

## r03-2（hold，中）

### 问题类
变更集审阅的乐观动作没有进入重连重放、已回显序号丢弃和快照前清空。

### 不变量
`ChangesetStateSubscription` 的 `_pendingActions` 与会话、聊天、批注一样：`getPendingActions` 能导出，`dropPendingByClientSeq` 能按序号丢掉，`clearPending` 能清空。`AgentSubscriptionManager` 里凡是按 `SessionStateSubscription | ChatStateSubscription | AnnotationsStateSubscription` 分支处理 pending 的地方，都加上 `ChangesetStateSubscription`。快照在 `preservePending === false` 时先清空再 `handleSnapshot`；`preservePending === true` 时保留 pending，由现有 `_onSnapshotApplied` → `_recomputeOptimistic` 叠回乐观状态。

### 要动的符号或文件
- `IPendingDispatchAction.action`（`src/vs/platform/agentHost/common/state/agentSubscription.ts` 254–260 行）加入 `ClientChangesetAction`。
- `ChangesetStateSubscription`（635–722 行）补上与 `AnnotationsStateSubscription`（834–850 行）同形的 `clearPending`、`getPendingActions`、`dropPendingByClientSeq`。`getPendingActions` 的 `channel` 用 `_changesetUri`。
- `AgentSubscriptionManager` 的五处类型分支一并加上变更集：`_disposeSubscriptionEntry`（1031 行）、`getPendingActions`（1135–1142 行）、`dropPendingAction`（1150–1154 行）、`applyReconnectSnapshot`（1176–1178 行）、`markSubscriptionsMissing`（1192–1194 行）。
- `AgentHostProtocolClient._drainAfterReconnect`（`src/vs/platform/agentHost/browser/agentHostProtocolClient.ts` 929–967 行）继续只遍历 `getPendingActions()`，不另写变更集分支。`_applyReconnectResult`（884–892 行）对非拒绝的本机回显继续调用 `dropPendingAction`。

### 明确不改
变更集 `_reconcile` 对拒绝信封的处理归 r03-3。会话、聊天、批注、自动化订阅的 pending 语义。`dispatchOptimistic` 里已经存在的变更集 `applyOptimistic` 分支（1076–1079 行）。

### 本地验证
在 `src/vs/platform/agentHost/test/common/agentSubscription.test.ts` 的 `ordinary optimistic reconnect state` 里，比照 `fresh reconnect snapshots preserve pending annotation actions for replay` 与 `applyReconnectSnapshot clears pending actions and applies the fresh state`：对 `ChangesetFilesReviewChanged`，`preservePending === true` 时 `getPendingActions()` 含该动作且乐观 `reviewed` 仍在；默认快照后 pending 为空且确认态等于快照。`dropPendingAction` 按 `clientSeq` 丢掉变更集条目。`markSubscriptionsMissing` 之后 `getPendingActions()` 不再含该变更集动作。

## r03-3（hold，中）

### 问题类
带 `rejectionReason` 的变更集或批注信封，在非发起方以及发起方已经没有匹配 pending 时，仍被写进确认状态。

### 不变量
`rejectionReason` 已设置的信封永不调用 `_confirmedApply`。发起方匹配到 pending 时只摘掉该 pending，再 `_recomputeOptimistic`。找不到 pending，或 `isOwnAction` 为假时，确认态保持不动，乐观层只按剩余 pending 重算。无 `rejectionReason` 的信封仍走现有确认路径。

### 要动的符号或文件
- `ChangesetStateSubscription._reconcile`（`src/vs/platform/agentHost/common/state/agentSubscription.ts` 679–693 行）。
- `AnnotationsStateSubscription._reconcile`（790–804 行）。
- 两处都改成 `SessionStateSubscription._reconcile`（319–337 行）的三分支：匹配 pending 时仅在没有 `rejectionReason` 时 `_confirmedApply`，然后 `splice`；本机但无匹配 pending、以及其他客户端，都只在没有 `rejectionReason` 时 `_confirmedApply`。最后都 `_recomputeOptimistic`。

### 明确不改
服务端 `AgentHostStateManager.rejectClientAction`（`src/vs/platform/agentHost/node/agentHostStateManager.ts` 1623–1632 行）已经不跑 reducer。`ProtocolServerHandler._broadcastAction`。会话与聊天的 `_reconcile`。聊天里 `_promotePendingTurnStartIfTerminal` 不复制到变更集或批注。自动化订阅已经用 `if (!envelope.rejectionReason)` 包住 `super._reconcile`。

### 本地验证
在 `src/vs/platform/agentHost/test/common/agentSubscription.test.ts` 比照 `rejected own action removes pending without updating confirmed`：变更集 `ChangesetFilesReviewChanged` 与批注 `AnnotationsRemoved` 各覆盖两条。本机 `clientSeq` 匹配且 `rejectionReason` 已设置时，`verifiedValue` 不变，乐观层回到确认态。信封来自另一个 `clientId`，或本机 `clientSeq` 对不上 pending 时，`verifiedValue` 也不变。无 `rejectionReason` 的回显仍更新确认态。

## r03-4（hold，中）

### 问题类
云沙箱中继发出的 `sendToGroup` 申请了 ack，失败 ack 被丢掉，传输保持打开，未完成请求不会进入重连。

### 不变量
`send` 经 `buildPublish` 发出的每个 `ackId` 都记在本传输上。稳态收到 `type === 'ack'`、`success === false`、`ackId` 属于这批登记、且不是已处理的重复 ack 时，关掉当前 WebSocket 并让 `onClose` 只触发一次。`AgentHostProtocolClient._handleTransportClose` 因此拒绝未完成请求并按已有 `transportFactory` 重连。成功 ack 只注销编号。未登记的 ack 继续忽略。

仓内没有 Azure Web PubSub reliable ack 的 `error.name === 'Duplicate'` 说明。实施前先核对失败 ack 的形状；在核对完成前，不要把所有 `success: false` 都当成致命。重复 ack 若表示已处理，只注销编号，不关传输。

### 要动的符号或文件
- `WebPubSubRelayTransport`（`src/vs/platform/agentHost/browser/webPubSubRelayTransport.ts`）：在现有 `_pendingJoinAcks` 旁增加 publish ack 集合。`send`（284–299 行）在 `buildPublish`（`src/vs/platform/agentHost/common/webPubSub/framing.ts` 71–82 行）返回后，把每帧的 `ackId` 登记进去。
- `_startObserving` 的 `onmessage`（246–255 行）在调用 `_ingestGroupFrame`（261–274 行）之前识别 ack。失败且已登记时先 `this._ws?.close()`，再 `_fireClose()`（306–313 行）。`_fireClose` 本身仍不关 socket；`dispose` 在 `_closed` 已为真时也不再关 socket，所以这条路径必须自己关。
- 第 276–283 行的 TODO 写明保持现状是为了与 github-ui `ahp-relay/webpubsub/wps-transport.ts` 一致。删掉它并改变行为，就是本仓与那份上游分叉。改的时候在注释里写明这是本仓取舍，不是上游已经改过。

### 明确不改
`_handleHandshakeFrame` 里 joinGroup ack 的失败处理（216–230 行）。`parseInbound` 对非 group-fanout 帧返回 `ignored`。`buildPublish` 的分片与 `ackId` 分配。`cloudSandboxAgentHostService.ts` 137 行的 `transportFactory`，以及 `AgentHostProtocolClient._handleTransportClose` 的重连与 `_rejectPendingRequests`。

### 本地验证
在 `src/vs/platform/agentHost/test/browser/webPubSubRelayTransport.test.ts` 增加断言：握手完成后 `send` 发出的 `sendToGroup` 帧带 `ackId`；回一条 `success: false` 的对应 ack 后 `onClose` 只触发一次，`isOpen` 为 false，fake socket 已被 `close`。`success: true` 不触发 `onClose`。握手用的 joinGroup 失败 ack 仍只拒绝 `connect()`，与现有 `rejects the connect when a joinGroup ack reports failure` 一致。未登记的 ack 不关闭传输。

## r03-5（weaken，降为低）

### 问题类
`TunnelAgentHostConnector.connect` 在新中继登记前就拆掉同一隧道上的旧中继。后续失败会留下空连接。同一隧道能否同时挂两条中继，仓内没有证据。

### 不变量
在确认同一隧道可以同时保留旧中继和新中继之前，不要把「先连上再关旧的」写成已拍板的改法。第 268 行现在先 `closeTunnelConnections(tunnelId, 'reconnecting')`，下一条日志写的是关闭现有中继后再连接。`tunnelAgentHostConnector.test.ts` 没有用例钉住这个顺序。

若以后确认可以并存，再采用下面的关法：同一次 `connect` 在 `_createConnection` 成功返回之前，`_connections` 里该 `tunnelId` 的既有 `TunnelConnection` 保持原样，`onDidRelayClose` 不因这次尝试而发出。失败时只释放这次新建的 relay 或 socket。新连接已经放进 `_connections` 之后，再关掉同一隧道地址上其余旧连接。

### 要动的符号或文件
并存未确认之前，这一节不动代码。确认之后：

- `TunnelAgentHostConnector.connect`（`src/vs/platform/agentHost/common/tunnelAgentHostConnector.ts` 267–313 行）：去掉函数开头的 `closeTunnelConnections(tunnelId, 'reconnecting')`。在 306 行 `_createConnection` 成功之后，关闭同一 `tunnel:${tunnelId}` 地址上除刚登记的 `connectionId` 以外的连接。
- `closeTunnelConnections`（418–426 行）增加排除 `connectionId` 的参数，或由 `connect` 在登记后自行遍历并跳过新 id。新连接的 `address` 与旧连接相同，不排除的话会把刚登记的连接一起 `deleteAndDispose`。

### 明确不改
`deleteTunnel`（`src/vs/platform/agentHost/node/tunnelAgentHostService.ts` 240–244 行）在删除成功后仍关闭该隧道的全部中继。`prepareSelection` 与 `completeSelection` 不在成功前关闭旧中继，保持现状。失败路径里对本次新建 `relayClient` / socket 的 `_disposeRelayClient` / `_disposeSocket` 保持现状。

### 本地验证
在 `src/vs/platform/agentHost/test/common/tunnelAgentHostConnector.test.ts` 增加断言：先成功 `connect` 一条中继，再让同 `tunnelId` 的第二次 `connect` 在 `getTunnel` 返回空、或转发端口 / socket 打开失败处抛错。第一次 socket 的 `close` 次数仍为 0，`onDidRelayClose` 不包含第一次的 `connectionId`，`relaySend` 仍打到第一次连接。第二次成功时，旧 socket 被关闭，新 `connectionId` 仍能 `relaySend`。现有 `times out a relay step and disposes the relay client` 与 `disposes the relay client when opening the legacy socket fails` 仍只释放本次新建的 relay。
