---
title: "引擎写入结果闸门统一：写与刷新分开判、丢弃要可见"
type: plan
status: accepted
phase: M7
updated: 2026-10-30
summary: "写闸定为 link + dispose + 尚未清空的目标 id + MCP Remove 在途代次，刷新闸才判代次；丢弃给可见文案。设计已签收。S1（helper、Memory、Rules）和 S2（MCP、Plugins、Skills）在工作区，S3–S5 未做。sessionViewHost 在 transport_lost 拆流接受为新语义。"
---

# 引擎写入结果闸门统一：写与刷新分开判、丢弃要可见
状态：执行中。设计已签收。S1、S2 在工作区，S3–S5 未做。
覆盖需求：无（正文未引用需求编号）。


> **slice_id**：`engine-write-gate-unification`
> **基线：** HEAD `fd764e966b4`（fix: guard engine mutations by connection identity）
> **冲突域：** `src/vs/workbench/contrib/conversation/browser/` 下 `engine{Agents,Mcp,Memory,Plugins,ProviderModel,Rules,Tools,Skills}Section.ts`、`connectionPreferencesPane.ts`、`enginePreferencesPane.ts`（仅 `runEngineTest`）、`conversationLensComposer.ts`、`conversationLensComposerChrome.ts`（`showPostFailure` 要识别新原因）、`conversationLensDockStrings.ts`；新增 `engineWriteGate.ts`；对应测试。**不**改 `universeAgentConnectionService.ts`、CSS、`navigatorTeamList.ts`（同期另一条修复线在改）。
> **本稿是方案，不是实施。**
> **不推翻：** `linkId` 按 transport 铸号的语义（`universeAgentConnectionService.ts` `_publishCommittedLink`）；`isEngineConnected()` 以 `ConnectionPhase.connected` 为闸（`fd764e966b4`）；未配对 profile 的 Test Connection 不建未 pin 探测链。
> **禁止发明：** 新 RPC、新 snapshot 字段、写操作幂等键。

## Problem class

- **症状：** 对话框开着或 RPC 在途时来一次 `onDidChangeConnection`，用户点 Save/Add/Delete 后界面什么也不发生；Test Connection 停在「Testing…」；Tools 保存后 pending 仍脏、无提示；Composer 已送达的消息报 failed 并留草稿，重试即重复发送。
- **类标签：** **刷新代次被当作写入有效期** + **丢弃即静默**。
- **复发机制：** `captureWriteLink` / `sameWriteLink` 在 8 个文件各抄一份，Tools、两个偏好页和 Navigator 还各有内联变体；测试只锁「链路变化后丢弃成功结果」，没锁「写途中发生刷新」「异常分支」「丢弃后的可见状态」。

## 0. 一句话结论

闸门分两类：**刷新闸**判 `refreshGeneration` + link + dispose，过期就丢；**写闸**只判 link + dispose + 尚未被这次写清空的目标 id + 这次写自己的在途代次（只有 MCP Remove 的 `_removeServerGeneration`）。过期时按「是否已发出」给可见文案，不再静默。两类闸放进一个共享 helper，各分区删掉自抄版本。

## 1. HEAD 事实

| 事实 | 位置 |
|:-----|:-----|
| `linkId` 在 transport / profile / identity 任一变化时铸新号；同 profile 自动重连换 transport 必换号 | `universeAgentConnectionService.ts` `_publishCommittedLink`（约 L2890） |
| transport 失败码 → phase `connecting/transport_lost` 并立刻 `_scheduleReconnect()` | 同文件 `_markTransportFailed`（约 L2523） |
| Memory 每次 `onDidChangeConnection` 都 `refresh()`，`refresh()` 首行 `++refreshGeneration` | `engineMemorySection.ts` L104、L225 |
| Memory Save/Delete 在对话框**打开前**取代次，对话框关闭后与 RPC 返回后都要求代次相等，否则 `return` | `engineMemorySection.ts` L431/L444/L455/L468，L484/L491/L496/L509 |
| Rules / MCP / Plugins 同构（构造时订阅 `onDidChangeConnection` → refresh；写路径判代次） | `engineRulesSection.ts` L128、L417/L446/L479；`engineMcpSection.ts` L441、L619/L666/L737/L796/L838；`enginePluginsSection.ts` L262、L790/L818 |
| Agents Create 判 `selectionGeneration`，与选中无关 | `engineAgentsSection.ts` L908/L919/L928 |
| Agents Delete 成功后只置 `selectedProfile = undefined`，不清列表选中、不刷写按钮；MCP 同位置会清 | `engineAgentsSection.ts` L977；`engineMcpSection.ts` 约 L869 |
| Agents / Tools / ProviderModel 的 `catch` 不过闸，dispose 或换链后仍写错误 | `engineAgentsSection.ts` L930/L984；`engineToolsSection.ts` L494/L544；`engineProviderModelSection.ts` L689/L719/L736 |
| Tools `populateProfileSelect` 每次 refresh 都 `profileSelectionGeneration++`，profile id 未变也加 | `engineToolsSection.ts` L823/L832 |
| Tools 写闸是内联变体（disposed + profile id + selection generation + identity + link） | `engineToolsSection.ts` L463–L470、L517–L524 |
| Connection 页 Test：`probeConnectionProfile` 走独立探测链，但 `isCurrent()` 拿**当前连接**的 identity/link 比；过期 `return` 不清「Testing…」 | `connectionPreferencesPane.ts` L2082–L2148 |
| Connection 页列表 `onDidChangeSelection` 只要有选中就 `testGeneration++`，同 id 重选也加 | `connectionPreferencesPane.ts` 约 L770–L779 |
| Engine 页 `runEngineTest` 同构：过期 `return` 不清「Testing…」 | `enginePreferencesPane.ts` L299–L330 |
| `pairing_required` 走通用 `formatConnectionProbeStatus` + `'error'` 色 | `connectionPreferencesPane.ts` L2141 |
| Composer 发送：`outcome.accepted` 后若链路变化 → `showPostFailure('failed')` 并保留草稿 | `conversationLensComposer.ts` L445–L460 |
| 失败原因枚举无「送达未知」 | `conversationLensDockStrings.ts` L83–L91 |
| 队列编辑：编辑已接受后链路变化 → 不发 release、`showQueueEditFailure` | `conversationLensComposer.ts` L550–L554 |
| Inbox 队列行 `hold === 'EDITING'` 时点击直接 `return`；EDITING hold 只能由编辑器 Exit（`exitComposerEdit` → `releaseMessageQueueItemHold`）解除 | `conversationInboxOverlay.ts` 约 L814–L819；`conversationLensComposerChrome.ts` L465–L478 |
| Model 行 Test 按钮只在 `writable` 时渲染（`testable = writable && …`） | `engineProviderModelSection.ts` L1043–L1072 |
| `sessionViewHost.onEngineConnectionChanged` 链路不变时按 `isEngineConnected()` 二选一 `bringUpPublishedLink` / `releasePublishedLink` | `sessionViewHost.ts` L611–L632 |
| 渲染端 `connected` = `phase.kind==='connected' && !pairingPending` | `universeAgentRendererSync.ts` `UniverseAgentConnectionSyncCache` |

## 2. Options

| 选项 | 含义 | 采纳 / 拒绝 |
|:-----|:-----|:------------|
| **A 写/刷新两类闸 + 丢弃可见 + 共享 helper** | 见 §3 | **选定** |
| B 只删写路径的代次判断，不抽 helper | 改动最小 | **拒绝。** 漏步骤正是 8 份手抄造成的，不收口会再漏 |
| C 同 engine identity 换链时视为成功 | 审查建议之一 | **拒绝。** 旧 transport 上的写是否落地不可知；当作成功会清草稿、丢用户文本 |
| D 给写操作加幂等键后自动重试 | 彻底 | **拒绝本波。** 需要引擎合同，属禁止发明 |
| E 回退 `sessionViewHost` 在 transport_lost 期间保留流 | 恢复旧行为 | **拒绝。** 见 §3.7 |

## 3. 选定设计（A）

### 3.1 共享 helper `engineWriteGate.ts`

放 `src/vs/workbench/contrib/conversation/browser/engineWriteGate.ts`，只依赖 `IUniverseAgentConnection` 的 `getConnectionSnapshot()` 与 `readPublishedEngineIdentityId` / `readPublishedLinkId`。

- `type EngineWriteLink = { engineIdentityId: string; linkId: number }`
- `captureEngineWriteLink(connection): EngineWriteLink | undefined`：identity 与 link 都在才返回。是否可写（`canMutate` / `canWriteModels` 等）仍由调用方先判，helper 不吃分区状态。
- `isSameEngineWriteLink(connection, link): boolean`
- `class EngineRefreshGate`：`begin(): token`、`isCurrent(token): boolean`（代次 + link + `store.isDisposed`）、`invalidate()`（作废在途刷新，Tools 成功后调用；dispose 时也调）。MCP Remove 的 `_removeServerGeneration` 是在途互斥，不并进这个代次。
- 写闸不做类，保持函数：调用方组合 `!store.isDisposed && isSameEngineWriteLink(...) && <目标对象仍在>`。

**结果闸禁止再包 `canMutate`。** 现有 `sameWriteLink` 经 `captureWriteLink` → `canMutate()`，而 `canPerformCatalogWrite` 只在 `mode === 'ready' | 'empty'` 为真（`engineCatalog.ts`）。`refresh()` 把 `mode` 设成 `loading` 后，链路没变也会被判成「链路变了」。发出前可以用 `canMutate()` 决定要不要开写；对话框关闭后和 RPC 返回后只能调 `isSameEngineWriteLink`。各分区删掉自抄的 `EngineWriteLink` 与 `captureWriteLink` / `sameWriteLink`。

### 3.2 写闸语义

一次写分三段：**确认前**（对话框 / popover）→ **发出** → **结果返回**。

- 结果闸只有一句，确认后、发出前、结果返回后、refresh 之后和 `catch` 都用它：link + dispose + 尚未被这次写清空的目标 id + 这次写自己的在途代次。在途代次只有 MCP Remove 的 `_removeServerGeneration`；Agents Delete 没有。**不经 `canMutate`。** dispose → 静默。清空选中去掉的只是目标 id。清空之后再比选中 id，成功文案会被清掉。
- 没通过时的文案：链路变了，发出前记「连接已变化，未发送，请重试」，发出后记「连接已变化，结果未确认，请核对列表」，不显示引擎错误或 `ok:false` 的 message。链路没变但目标 id 变了，发出前记「选中已变化，未发送，请重试」，发出后记「选中已变化，结果未显示在当前项」。两条都粘住。在途代次变了同样按已发出或未发出这两句，不另写第三套。
- **写路径不再为这条通知另起 refresh。** `onDidChangeConnection` 已经会 refresh；`refresh()` 开头就把 `writeStatus` 藏掉（Memory 的 `refresh`）。`refresh()` 每个出口（含提前 return）若该字段还在就画回去。下一次用户发起的写清掉它。
- 选中 id 从 A 到 B 再回到 A，仍算同一个目标。测试可以把 link id 拨回原值，用来锁「只比当前 link，不比刷新代次」。生产里 link 序号只增不减，拨回去不是产品路径。
- **不再判** `refreshGeneration`。刷新代次只属于刷新闸。
- 选中类写包括 Agents Save/Reset、Tools 保存、Plugins `runWrite`、MCP 按选中服务器的保存和删除。**不判**选中代次。选中 A→B→A 时旧结果仍作用在同一个 id 上，可以落地。与选中无关的写（Agents Create、MCP Add、Memory/Rules Add）不判选中。
- Agents Delete 与 MCP Remove 的顺序：结果返回后先按结果闸那一句核对，再清空选中和列表选择，然后显示成功并 refresh。refresh 之后和此后的 `catch` 仍用那一句。HEAD 上 MCP Remove 的 `catch`（约 L887）在 L874 已经清空之后仍比 `selectedServer.id`，迁移时去掉这道比较。L867 比 id、`_removeServerGeneration` 和 `sameWriteLink`；L879 比代次和 `sameWriteLink`（先 dispose，再 link），不再比 id。两处都落在这一句里。
- 写成功后的 `await refresh()` 再补成功文案，沿用各分区现状。这次 refresh 会递增代次，从而丢掉写之前已经发出的列表结果，避免旧列表盖住新写入。
- **就地改状态、自己不 refresh 的写**（Tools `savePendingEnablement` / `toggleTool`）成功时要 `refreshGeneration++`，让写之前发出的 refresh 在返回时对不上代次、不得套用旧 profile，也不得 `pendingEnablement.clear()`。否则列表 RPC 若在保存提交前发出、在保存之后返回，会把刚改的开关画回旧值并清掉脏标记。

### 3.3 分区落点

| 分区 | 改动 |
|:-----|:-----|
| Memory / Rules | 写路径去掉 `isCurrent(generation)`，换 §3.2；`catch` 同闸。S1 已在工作区 |
| MCP / Plugins | 写路径去掉刷新代次。保存和 MCP Remove 都只用 §3.2 那一句（link + dispose + 尚未被这次写清空的目标 id + `_removeServerGeneration`），不另写清空前后两套。对照 HEAD：L867 比 id、代次和 `sameWriteLink`；L874 清空；L879 比代次和 `sameWriteLink`（先看 dispose，再比 link），不再比 id；L887 的 `catch` 在清空后仍比 id，迁移时去掉。S2 已在工作区，含 Add / Enable / Reload 在途禁用 |
| Agents | Create 去掉 `selectionGeneration`；Save/Reset 改判选中 id；Delete 在清空选中之前比 id，清空后再 refresh，之后只看 link 和 dispose；`catch` 过闸；Delete 成功后 `list.setSelection([])` + `updateWriteActions()`，焦点落到相邻行，无行时落列表 |
| Tools | `populateProfileSelect` 仅在 profile id 实际变化时 `profileSelectionGeneration++`（`clearCatalogPresentation` 保持加）；写闸换 helper，结果比较不经 `canMutate`；成功时 `refreshGeneration++`（§3.2）；链路变了走粘住通知，不另起 refresh |
| ProviderModel | 两处 `captureWriteLink` 换 helper；L689/L719/L736 `catch` 过闸 |
| Skills | 结果闸改调 `isSameEngineWriteLink`，不经 `canWrite()`。保留 `bodyLoadGeneration` 和 skill 名比较。S2 已在工作区 |

### 3.4 写操作在途禁用

Agents Create、MCP Add、Plugins Enable/Reload 在 RPC 在途期间禁用对应按钮（分区级 in-flight 标志，`finally` 复位）。Agents Create 默认 id 用 `Date.now()`，连点会建两个，必须挡。

### 3.5 Test Connection

- Profile 探测（`probeConnectionProfile`）：闸 = `testGeneration` + `profileAtStart === activeProfileId` + dispose，**不判**当前连接 link。
- 无 profile 探测（`probeEngine`，Connection 页与 Engine 页 `runEngineTest`）：探的就是当前连接，保留 link 判断。
- 任一过期但未 dispose：把「Testing…」清掉（`testStatus` 置空），不留悬挂态。
- 列表选中：仅在 `selected.id !== activeProfileId` 时 `testGeneration++`。
- `result.code === 'pairing_required'`：neutral 色，本地化文案「此配置尚未配对，请点 Connect 完成配对」，不显示英文原 reason。

### 3.6 Composer 与队列

- 新增失败原因 `'delivery_unknown'`，文案「连接在发送后切换，消息可能已送达；请先查看时间线再决定是否重发」。`showPostFailure`（`conversationLensComposerChrome.ts` L841）必须单独映射这一个原因。没有分支时会落到 `conversationLensPostFailedNoSession`（session not found）。发送 `accepted` 后链路变化时用它替代 `'failed'`；草稿保留（不清），由用户判断。
- 队列编辑 `accepted` 后链路变化：**不**自动 release，也不走 `'failed'`。`showQueueEditFailure` 在这条路径显示同一条未知送达文案，并且不退出编辑模式。
- 不能把解除暂停塞进现有 Exit。`exitComposerEdit(..., releaseQueueHold=true)` 会在**当前**链路上 `releaseMessageQueueItemHold`（`conversationLensComposerChrome.ts` L477）。链路已经换过时，这和自动 release 一样，可能把未落地的旧正文放出。
- 此状态下 Exit 改为确认后再解除：文案说明「编辑可能未写入，解除暂停会按引擎上的当前内容继续」。确认后才 `release` 并退出；取消则留在 queueEdit。Inbox 行在 `hold === 'EDITING'` 时点击直接 return，不能靠那里补入口。

### 3.7 `sessionViewHost` 在 transport_lost 拆流：接受

`fd764e966b4` 后，链路未变但 phase 进入 `connecting/transport_lost` 时，host 由 `bringUpPublishedLink` 改走 `releasePublishedLink`。接受，但理由不是「重连一定换 transport」：

1. 通道还活着时，下一次成功的 unary 会在**同一** transport 上把 phase 写回 `connected`（`_withTransport`，不铸新 link）。`_scheduleReconnect` 也可能因 pairing、用户拨号在途而不排。所以「失败后必换 link」不成立。
2. 同一条链路恢复时，`onEngineConnectionChanged` 看到 phase 回到 connected，会调 `bringUpPublishedLink`，而它本来就会 `connectionGeneration += 1` 并重开流。`releasePublishedLink` 是这次重建的拆掉半边，不是额外的一轮。
3. transport_lost 表示已经观察到传输失败。继续留着已失败的 stream，会和渲染端「phase 非 connected 即未连接」分裂。
4. 没有 `_activeProfileId` 的 loopback 失败不进 transport_lost，直接 `disconnected`，不在本条里。

host 测试锁两段：transport_lost 且链路未变 → `releasePublishedLink`；同一 transport 恢复为 connected → `bringUpPublishedLink` 且 generation 增加。协议面只改桌面表「引擎连接态」那一行（网页表不跑 `sessionViewHost`），补一句：phase 离开 `connected` 时主进程拆掉已发布流，同一链路恢复后再拉起。

## 4. 不变量

- 写操作结果的显示用 §3.2 那一句：link、视图是否还在、尚未被这次写清空的目标 id，以及 MCP Remove 的 `_removeServerGeneration`。与期间发生过几次列表刷新无关。
- 被闸门丢弃的写，若视图未 dispose，未发送和未确认两条都要留在界面上，随后的 `refresh()` 不得清掉。
- 被闸门丢弃的 Test Connection 只清掉「Testing…」，不另留一条提示。
- 刷新结果过期仍静默丢弃（下一次刷新会覆盖），不新增提示。
- 不改变 `linkId` 铸号规则、`isEngineConnected()` 语义与探测链 pin 规则。

## 5. 切片

| 切片 | 内容 | 验证 |
|:-----|:-----|:-----|
| S1 | `engineWriteGate.ts` + 单测；Memory、Rules 迁移（§3.2） | 同链路：对话框期间的连接事件后仍 Save；loading 中返回仍显示成功；链路离开再回到同一 id 仍显示成功。换链：未发送不调 RPC；已发送显示未确认且 refresh 后还在，不显示引擎错误。dispose 后静默 |
| S2 | MCP、Plugins、Skills 迁移；MCP Add / Plugins 在途禁用 | 同 S1 的同链路与换链用例。MCP Remove：成功后选中已空，成功文案仍在；refresh 之后不因选中为空把文案清掉。在途禁用用例 |
| S3 | Agents（Create/Delete/选中/焦点/在途）、Tools（代次只在 id 变时加、成功后作废在途 refresh）、ProviderModel `catch` | Agents Create 期间切选中仍显示成功；Delete 后选中清空、焦点落点；Tools 保存提交前发出的 list 在保存返回后不得盖掉新值和 pending |
| S4 | Test Connection 两页（§3.5） | profile 测试期间当前连接重连仍出结果；过期后无「Testing…」；同 id 重选不作废；pairing_required neutral 文案 |
| S5 | Composer `'delivery_unknown'` 含 `showPostFailure` 映射、队列编辑确认后才 release；host 测试 + 协议面桌面表一句 | 发送接受后换链显示未知送达文案且不是 “session not found”，草稿在；队列编辑换链后仍在 queueEdit，文案同样不是 `'failed'`，未确认时不发 release，确认后才 release 并退出；host：transport_lost 拆流，同 transport 恢复后再拉起 |

每片跑：`npm run typecheck-client`、改动文件 `npx eslint`、对应定向单测（`scripts/test.sh --grep`）、`git diff --check`。

## 6. 不做

- 合并 `browser/engineMcpSection.test.ts` 与 `test/browser/engineMcpSection.test.ts`：`browser/` 下与源码并排放测试是本目录惯例（59 个），两份各管不同面，本波不搬。
- 插件 Unload 加删除确认：Unload 可再 Load 恢复，不属于破坏性删除，与其他分区的删除不同类。
- 同期另一条修复线已在处理，本稿不碰：设置页 CSS、`BODY_COLUMN_GAP`、`universeAgentConnectionService.ts` 恢复分支 `_pairingPending`、`navigatorTeamList.ts` context key 与死分支。

## 7. 审查意见中驳回的条目

- **「只读但支持测试的引擎上 Model Test 按钮无反应」**：不成立。`testable = writable && …`（`engineProviderModelSection.ts` L1044），只读时按钮不渲染。
- **「同 identity 换链时 Composer 按成功处理」**：见 Option C，不采纳，改为 `'delivery_unknown'`。
- **「同 identity 换链时队列编辑仍发 release」**：不采纳，旧链路编辑结果未知，release 可能放出旧内容；见 §3.6。

## 8. 相关

- [connection-dial-generation](connection-dial-generation.md)（拨号 generation 与 snapshot/phase 原子）
- [engine-preferences-completion](engine-preferences-completion.md)
- [conversation-unary-response-recovery](conversation-unary-response-recovery.md)
- [engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md)

## 审查记录

2026-10-30：规则 16 审查在写出正式结论前中断。中途已核对、并已改入本稿的有：结果闸若仍经 `canMutate`，refresh 把 mode 打成 `loading` 会把同链路判成链路变化（§3.1）；未确认文案再调 `refresh()` 会被 `writeStatus` 清空（§3.2）；Tools 在途 list 会在保存之后盖掉新值（§3.2）；§3.7 原「重连必换 transport」不成立，同 transport 恢复会把 phase 写回 connected；队列 Exit 会在新链路上 release（§3.6）。Option E 的节号已从 §3.6 改为 §3.7。

2026-10-30 第二轮：未转 accepted。已改入的 Important：Skills 结果闸不经 `canWrite`，保留正文代次和 skill 名（§3.3）；Plugins/MCP 保留目标 id，Agents Delete 先比 id 再清空（§3.2）；未发送和未确认都粘住，Test Connection 只清 Testing（§4）；`showPostFailure` 必须映射 `delivery_unknown`，队列换链不用 `'failed'`（§3.6）。Minor：`invalidate()` 作废在途刷新，MCP Remove 代次不并入。S1 代码已在工作区。Memory 定向单测 14 通过，含换链失败不显示引擎错误、link id 离开再返回仍显示成功。

2026-10-30 第三轮：未转 accepted。已改入：结果返回在清空选中前统一为 link + dispose + 目标 id。MCP Remove 与 Agents Delete 同一顺序，并写明 HEAD `catch` 在清空后仍比 id，迁移时去掉。只改选中、链路未变时不再用「连接已变化」。

2026-10-30 第四轮：未转 accepted。清空后的闸与清空前的闸不是同一句。

2026-10-30 第五轮：已把确认前、结果返回、refresh 之后和 `catch` 收成同一句，并写入 §0。在途代次从清空前就在这句里。§4 指这一句。§3.3 MCP 行当时仍拆成清空前后两套。

2026-10-30 第六轮：§3.3 MCP 行改为只引用 §3.2 那一句。当时把 L879 写成只比代次和 link，漏了 `sameWriteLink` 里的 dispose。

2026-10-30 第七轮：L879 改为比代次和 `sameWriteLink`（先 dispose，再 link），不再比 id。

2026-10-30 第八轮：L879 的表述与 `removeSelectedServer` 一致，可以转 accepted。frontmatter 改为 `accepted`，状态行改为执行中。
