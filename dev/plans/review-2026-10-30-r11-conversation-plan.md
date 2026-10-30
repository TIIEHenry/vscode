---
title: "十六路审查 r11：conversation 方案"
type: plan
status: draft
phase: N/A
updated: 2026-10-30
summary: "hold 3、drop 2、weaken 0。"
---

# 十六路审查 r11：conversation 方案
状态：草案。
覆盖需求：无（正文未引用需求编号）。


只改下面 hold 的三条。范围停在 `src/vs/workbench/contrib/conversation`。

| 编号 | 判定 | 严重度 | 说明 |
|:-----|:-----|:-------|:-----|
| r11-1 | hold | 高 | 见下文 |
| r11-2 | drop | 中 | 不是问题。`listed ghost sessions with lease bind failure shows bind-failed roster row` 要求列出 session-100 与 session-101 后，当前租约绑定失败时名册只剩绑定失败占位，两个 id 都不可再选。`monitorListedEngineSessionBind` 在 `ok === false` 且 `engineBoundSessionIds.size === 0` 时调用 `markEngineSessionBindFailed`，与该测试一致。列表失败保留行是 `doRefreshEngineCatalog` 的 catch，另一条分支。 |
| r11-3 | hold | 中 | 见下文 |
| r11-4 | drop | 中 | 不是问题。编辑留空时 `parseModelDialog` 得到 `level: 0`，合同把 0 定义为沿用或未声明：`UniverseAgentUpsertModelRequest` 注释 “Blank level stays 0 and means keep or undeclared”；`docs/systems/workbench/engine-catalog.md` 写明留空发 0 表示沿用已有等级或由引擎默认；`docs/reference/universe-agent/engine-protocol-surface.md` 写明 level 0 仍表示沿用或默认。`encodeModelEntry` 只在 `request.level > 0` 时写出 level 字段。新增留空发 0 已由 `add model sends empty description, cost, and speed when those fields are blank` 锁住。 |
| r11-5 | hold | 中 | 见下文 |

### r11-1

问题类：重连显示名恰好为 `host:port` 的直连档时，先忘掉并可能断开。add 失败应留下旧档。拨号失败时若已经 forget，旧档和当前连接回不来；本条把 forget 放到拨号成功之后。

不变量：

- 显示名恰好是 `host:port` 的 directAddress 档，在 `addDirectAddressProfile` 返回 ok 且随后的拨号成功之前，不得调用 `forgetConnectionProfile`。forget 的 id 集合在 add 之前拍下，不含本次新 `profileId`。
- 该档的 `profileId` 等于 `connectedProfileId` 时，在拨号成功之前不得 `disconnect`。add 失败或拨号失败时，旧档和当前连接都还在。
- `ensureDirectAddressProfileForConnect` 的整个等待期间，连接按钮处于与 `connectInFlight` 相同的写入占用；第二次点击不得再进入忘记或新建。占用须延续到 `connectProfileWithPairing` 已置上 `connectInFlight`，两段之间没有 await。

要动的符号：`ConnectionPreferencesPane.handleConnectDirectAddress`、`ConnectionPreferencesPane.ensureDirectAddressProfileForConnect`、`connectInFlight`、`isConnectWriteHeld`、`updateConnectGates`。文件：`src/vs/workbench/contrib/conversation/browser/connectionPreferencesPane.ts`。

改法：

1. 进入确保档之前占用连接写入并 `updateConnectGates`。`connectProfileWithPairing` 开头若见到 `isConnectWriteHeld()` 会直接返回，因此这段占用不能在调用它时仍为真。确保函数返回后、调用 `connectProfileWithPairing` 之前同步放下这段占用，并由 `connectProfileWithPairing` 在自己的第一个 await 之前置上 `connectInFlight`。确保失败的返回路径放下占用并写状态行。
2. 在 `addDirectAddressProfile` 之前拍下当时匹配的旧 `host:port` 档，排除还没返回的新 `profileId`。先 add。add 返回失败则把该失败交回调用方，不忘记、不断开，旧档和 `connectedProfileId` 保持原样。add 成功后把新 `profileId` 交给 `connectProfileWithPairing(..., { skipEngineSwitchConfirm: true })`。只有这次拨号成功且不是配对挂起时，才对拍下的旧档 `forgetConnectionProfile`；forget 成功且该 id 仍是 `connectedProfileId` 时才 `disconnect`。拨号失败或抛错时不 forget、不 disconnect。`add`、`forget`、`disconnect` 抛错都从 `finally` 放下这次确保占用。
3. `addDirectAddressProfile` 在名称为空时会把 `displayName` 设成 `host:port`。add 之后再查找会把新档和旧档都算进匹配集。forget 只用 add 之前拍下的 id，不得包含本次返回的 `profileId`。

明确不改什么：

- `findDirectAddressProfilesForEndpoint` 只匹配 displayName 恰好为 `host:port` 的 directAddress。自定义名称不在这条替换里。保持 `findDirectAddressProfilesForEndpoint matches canonical host:port label only` 与 `Direct Connect does not forget or disconnect a same-name profile on a different endpoint`。
- 有待确认会话时，取消切换不进入忘记。保持 `Direct Address cancel does not call forgetConnectionProfile or disconnect`。
- 当前连接已是同一 `host:port` 时不弹切换确认。保持 `same host:port reconnect does not prompt`。
- 成功时仍然铸新 profileId 并连上新档。保持 `Direct Connect forgets existing endpoint profile and recreates with allowPrivateNetwork` 的最终连接对象。

本地验证：

- 改 `src/vs/workbench/contrib/conversation/test/browser/connectionPreferencesPane.test.ts` 中 `Direct Connect forgets a host:port profile and disconnects only after that forget succeeds`：调用顺序变为 add 成功、拨号成功、然后 forget 拍下的旧 id、forget 成功后再 disconnect，最终 `connectedProfileId` 为新档。拨号失败时 forget 与 disconnect 都未调用。
- 改写 `Direct Connect forget failure does not add or disconnect` 的工序以配合新顺序：新增断言「`addDirectAddressProfile` 返回失败时 `forgetConnectionProfile` 与 `disconnect` 均未被调用，`connectedProfileId` 仍是旧档，直连状态行是 add 的 reason」。forget 失败的断言改为：add 已成功之后 forget 返回失败，则 `disconnect` 未被调用。
- 新增断言：`addDirectAddressProfile` 尚未返回时再次进入 `handleConnectDirectAddress`，第二次的 forget 次数为 0，连接按钮处于占用。
- 用本地单元入口跑该测试文件里上述测试名（`scripts/test.sh` 或 `run-unit-custom.sh`）。

### r11-3

问题类：连续切换模型时，被盖掉且未被引擎接受的乐观选项会变成失败回滚点，下一条消息按这个被拒绝的模型发送。

不变量：

- 一轮连点结束后，`modelSelectedIndex` 与 `modelProfileIdBySessionId` 等于引擎最后一次接受的模型。一次都未接受时，等于连点开始前已经接受的模型。
- `applySessionModelIndex` 在已有切换在飞、且 `catalogModelIds[modelIndex]` 非空时，只更新 generation、`targetIndex`、`targetModelId` 和乐观下拉，不把 `rollbackIndex` / `rollbackId` 改成当时的 `modelSelectedIndex`。空模型槽不在这条里：已有切换在飞时仍按现在的空槽分支处理，不把下拉乐观选成 0。`selecting the empty model does not send switchModel and a stale failure does not force index 0` 仍断言再点空槽后 `selectedIndex` 为 2。
- `drainSessionModel` 见到过期结果、会话仍可写、且 `resolvedModelId` 非空时，先把该次接受值写入 confirmed 与 rollback，再继续发送更新的目标。
- 代数已对齐的失败或抛错，用 confirmed 恢复，恢复结果就是 `submitDraft` 读到的 `catalogModelIds[modelSelectedIndex]`。

要动的符号：`applySessionModelIndex`、`drainSessionModel`、`restoreSessionModelIndex`、`SessionModelEpoch` 的 `rollbackIndex`、`rollbackId`、`confirmedIndex`、`confirmedId`。文件：`src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts`。`submitDraft` 在 `src/vs/workbench/contrib/conversation/browser/conversationLensComposer.ts` 继续读 `host.catalogModelIds?.[host.modelSelectedIndex]`，发送公式不动。

改法：

1. 在飞时的后续点击保留进入这次连点前的 rollback / confirmed。乐观更新下拉的代码保留。
2. 过期且 `isComposerSessionWriteLive` 的成功结果，按 `drainSessionPermission` 记下已接受值的方式，把 `sentIndex` / `sentModelId` 写入 `confirmedIndex`、`confirmedId`、`rollbackIndex`、`rollbackId` 和会话模型表，然后 continue。过期且失败或抛错时不改 confirmed。
3. 最新一次 `resolvedModelId` 为空或抛错时，`restoreSessionModelIndex` 的参数用 confirmed，并在绑定会话上显示现有的模型失败提示。

明确不改什么：

- `drainSessionPermission` 及其测试。
- 不可写时保留已接受值、不发送更新目标。保持 `leftover model keeps the accepted value and does not show an unsent newer target`、`leftover stale model with an empty resolved id restores the last accepted model`、`leftover stale model throw restores the last accepted model and not the unsent target`。
- 空模型槽不调用 `switchModel`，过期失败不把选择打成 0。保持 `selecting the empty model does not send switchModel and a stale failure does not force index 0`。
- 后一次请求成功时停在后一次。保持 `overlapping switchModel failure does not restore the dropdown to the earlier index`、`overlapping switchModel success does not keep the earlier modelId`。
- 单次失败回到切换前已接受的模型。保持 `submitDraft omits modelProfileId when the settled model index is 0`。

本地验证：

- 在 `src/vs/workbench/contrib/conversation/test/browser/conversationLensDisposeGate.test.ts` 新增两条断言。
- 第一条：已接受起点为目录中的空槽或已有 id；`applySessionModelIndex` 切到下一档并挂起 `switchModel`，再切到再下一档；第一次以空 `resolvedModelId` 或抛错结束，第二次同样失败。下拉、`modelSelectedIndex`、`modelProfileIdBySessionId` 停在连点前已接受的 id。接着 `submitDraft`，`modelProfileId` 与该 id 一致；起点是空槽则载荷不带 `modelProfileId`。
- 第二条：第一次过期成功时，下拉与会话模型表停在这次写入 confirmed 的 `sentModelId`。`resolvedModelId` 只做非空判断；两者不一致时以 `sentModelId` 为准。第二次失败后 `submitDraft` 带这个 `sentModelId`。
- 用本地单元入口跑该文件中的新断言和上面列出的既有测试名。

### r11-5

问题类：删除 MCP 服务器的请求已经返回后，期间若改选了另一台，成功或失败都在读结果之前返回，列表不刷新。

不变量：

- `removeMcpServer` 已结束、写链路仍是发起时的链路、控件未 dispose 时，按 `result.ok` 处理：成功必须 `refresh()`，刷新后的列表不含该 `serverId`。
- 选中行在等待期间变成另一台，只取消这条删除的成功文案，也只在选中行仍是被删 id 时清空选择。刷新仍然执行。
- 失败且选中行仍是该 `serverId` 时，显示现有的写入失败。选中行已变成另一台时，不把旧行的失败文案写到新行上；成功路径的刷新不受这条例外影响。

要动的符号：`EngineMcpSection.removeSelectedServer`、`setSelectedServer` 里对 `_removeServerGeneration` 的递增。文件：`src/vs/workbench/contrib/conversation/browser/engineMcpSection.ts`。

改法：

1. 请求返回后，把「写链路 / dispose」和「选中代数」拆开。写链路变了或已 dispose：保持现在的放弃，不刷新、不写文案。
2. 写链路仍有效时先读 `result.ok`。成功则 `refresh()`，并且只有 `refresh()` 返回真才考虑成功文案。用户在等待期间没有改选时，沿现有成功路径写 `ENGINE_MCP_REMOVE_SUCCESS_COPY`：现有代码在 `refresh()` 前直接写 `this.selectedServer = undefined`，不经 `setSelectedServer`。不要改成刷新后再看 `selectedServer?.id === serverId`。成功刷新且新列表不含被删 id 时，`setServers` → `restoreServerSelection` 会 `setSelectedServer(undefined)` 并递增 `_removeServerGeneration`，刷新后的 id 和代数都不再匹配，那两个条件写不出文案。列表失败时不得写 “Removed.”。`engineCatalogSections.test.ts` 锁住：`removeSelectedServer()` 返回 `true` 且随后 `listMcpServers` 失败时，成功文案不得留下。选中行已是另一台时跳过成功文案，也不要把另一台的选择清掉；刷新照做。
3. 失败且选中行仍是该 `serverId`、代数未被更新的删除盖掉时，走现有 `showWriteFailed`。选中行已变则不写这条失败文案。
4. `setSelectedServer` 在 id 变化时仍可递增 `_removeServerGeneration`，该代数只决定文案和是否清空当前选择，不再决定要不要 `refresh()`。

明确不改什么：

- `confirmAndRemoveSelectedServer` 在确认期间 `refreshGeneration` 变化、写链路变化或选中 id 已变时，不调用 `removeSelectedServer`。
- 更新对话框在改选后不提交。保持 `Confirmation after selected server changes does not update either server`。
- dispose 递增 `_removeServerGeneration` 与 `refreshGeneration` 后不再刷 UI。
- `sameWriteLink` 失败时不刷新、不写文案。

本地验证：

- 在 `src/vs/workbench/contrib/conversation/test/browser/engineMcpSection.test.ts` 新增：选中服务器 A，让 `removeMcpServer` 挂起，`selectServerByIdForTest` 改到 B，再以 `{ ok: true }` 结束。断言之后发生了列表刷新，列表中没有 A，成功文案未写到 B 上，选中项仍是 B（B 仍在刷新结果里时）。
- 同文件新增失败断言：同样在挂起期间改选到 B，以失败结果结束。不把 A 的失败文案写成当前状态；未改选时的失败仍显示写入失败。保持现有未改选即删除成功的 `removeSelectedServer` 用例。
- 用本地单元入口跑该文件中的新断言和 `Confirmation after selected server changes does not update either server`。新测试自己让刷新结果不含 A。列表内容来自 `refresh()` 的 `listMcpServers`，不是本条改动能保证的不变量。

## 审查

2026-10-30 只读审查的结论是须改稿。Critical 已改：r11-5 不再在刷新后用「选中 id 仍是被删服务器」决定成功文案；列表失败不得写 “Removed.”。Important 已改：r11-1 在 add 之前拍下旧档，拨号成功后才 forget，且不含新 `profileId`；r11-3 把空模型槽排除在「不改 rollback」之外，过期成功以 `sentModelId` 为准。
