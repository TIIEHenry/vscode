---
title: "Conversation 可见叶：catalog 恢复后补回缺失 lease"
type: plan
status: draft
phase: M7
updated: 2026-10-27
summary: "固定a4a/srcd78a的独立窄draft；仅Pane在既有visibility生命周期监听session变化，为存活、可见、未suspended、真实引擎live且catalog ready的当前bound叶补缺失lease；真实EditorParts/EngineRoster事件回归待审查与授权。"
---

# Conversation 可见叶：catalog 恢复后补回缺失 lease

> **固定输入**：`a4a70322795c509e8e9b8274cf295a1b65db663a`，`src=d78a48e5feee57fcaf5811c8425859d0a2400af0`。只读该对象，不追 main / merge / 他人 WIP。
> **当前阶段**：root 采纳原 Astra 的新鲜源码范围裁定后，仅授权独立 draft 文档。本稿没有实现、测试源码或新运行证据；先固定 docs-only commit 与路径哈希，root 核验，再交原 Astra 按 [规则 16](../../docs/DOCUMENTATION.md#规则-16方案写完必须经只读审查再改稿)只读审查。独立 accepted 及后续源码授权之前不得实施，也不请求 baseline 接入 D HEAD。当前 Sources wave 如报告源码 / fixture 问题，优先处理当前候选。

## 1. 来源、已有 SSOT 与实际缺口

本稿落实历史 [§24 可见 Pane 缺 lease 候选](../progress/default-editor-contract-audit-2026-10-26-evidence/conversation-response-recovery-code-review.md#24-e重连后可见pane未自动恢复lease产品生命周期important候选2026-10-27)的独立后续范围。现场曾观察真实 Pane 的 bound 正确、entries 空、未 disposed，但自身 lease 缺失；独立 observer 已能读到 pending，公开 hide / restore 后 Pane 恢复。原报告没有完整 callback trace 或独立最小复现，本稿仍保留此证据限制，不把源码解释升级为新运行证明。

查重后使用以下边界，不复制其长期契约：

| 既有入口 | 已负责的范围 | 本稿关系 |
| --- | --- | --- |
| [session-windows](../../docs/systems/conversation/session-windows.md) / [ADR-002](../decisions/002-conversation-session-windows.md) | 默认编辑器窗口的 session 叶、真实 EditorPart、隐藏释放与恢复重领 | 复用实际 Pane 的可见性与 owner 生命周期；不改窗口导航或隐藏语义。 |
| [conversation-bound-session](conversation-bound-session.md) | connection 重绑以 bound 叶为目标，不借 roster active 身份 | 补领也只取当前明确 bound key；非活动 pinned visible 叶同样适用。 |
| [session-availability-and-delete-confirm](session-availability-and-delete-confirm.md#s2-会话就绪度单一判定prd-007-验收-6) | 只依赖 roster 的 readiness；断连返回 ready 的既有读取语义 | 复用判定，并另核真实引擎 live；不改变 readiness 含义或删除 / 写门。 |
| [session-subscription-lifecycle](session-subscription-lifecycle.md) / [frame fanout](session-view-frame-fanout.md) | platform / 宿主订阅回收、流重开、lease 帧分发 | 本稿只处理渲染 Pane 没有 lease 的消费入口，不改其 API、重试或合并订阅。 |
| [unary response recovery](conversation-unary-response-recovery.md#10-最终实施与局部签收2026-10-27) | 响应失败恢复准确座位及既有断连写门；明确保留 §24 | 保持已签局部结论，不重开 unary / §25 或放宽任何响应写门。 |

固定 a4a 的实际事件链：

1. `ConversationEngineRosterService` 先于消费 Lens 注册 UA connection 监听（`:143`）。connected 分支发起 catalog refresh（`:1745–1771`）；async 主体在首个 await 前把 `listCompleted=false`（`:2000–2008`）。
2. Lens 的 roster / UA connection 监听调用既有 rebind（`conversationLens.ts:393–409,790–795`）。`conversationLensSessionBinding.ts:181–189` 在 not-ready、没有非空同 session leftovers 时清除其 lifetime / lease；非空同 session KEEP 分支仍保留原 owner。
3. 同 s1 catalog 成功后 ready，并激活原 s1（Roster `:2041–2056`）。active id 没变就不发 active-session 事件；后续 session-change 只刷新 Lens chrome（Lens `:378–392`），没有缺 lease 补领。
4. `ConversationEditorPane.bindHiddenLeafLease`（`:232–250`）只在 setInput 和 visible-windows 变化时执行。hide / restore 能走原路补偿，纯 catalog-ready 没有这个触发。

缺口是 **同一存活可见消费者在 ready 后缺自己的 lease，没有对齐入口**。公开 observer / Roster observation lease 收到 frame，不能证明该 Pane 已持有 lease。四个 Conversation 生产文件及两个 Sources `runGitAction` 方法在 c7 → a4a 保持相同；当前 Accept / Panel VM 改动没有覆盖这条链。

## 2. 最小设计与所有权

唯一拟改生产点为 `conversationEditorPane.ts` 的 `bindHiddenLeafLease`：在现有 `visibilityDisposables` 中再登记 `roster.onDidChangeSession`，执行同步、无 await 的缺 lease reconcile。它与本次 input 的原 visibility listener 一起在下一次 bind、clearInput、dispose 的既有 clear 中移除，不另建长期订阅、timer 或生命周期 epoch。

**原可见性路径保持**：隐藏事件继续调用 `releaseSessionViewLeaseForHiddenLeaf()`；正常 reveal 继续沿原 `syncLease → lens.bindSessionView(sessionKey)` 恢复，包括既有 local stub / 断连缓存行为。新 session listener 不用严格引擎门替换原 reveal 路径，也不把隐藏释放反向解释成 ready 后应该自动显示。

新 reconcile 同时满足下列条件才调用一次既有 `lens.bindSessionView(key)`：

| 条件 | 取值与限制 |
| --- | --- |
| 当前 owner 仍相同且存活 | 在本次 `bindHiddenLeafLease` 捕获 input、lens、明确 sessionKey；callback 核当前 activeInput / lens 仍为捕获对象，input 未 disposed、lens 未 disposed，visibility / lens store 未 disposed。不能只凭 session 字符串相同认定旧 owner 有效。 |
| input 与 Lens 的明确 bound 一致 | 当前 input resource 解析出的 sessionKey、捕获 key、`lens.boundSessionId` 三者一致且非空。目标使用这个当前 bound key，不用 `getActiveSessionId()`、event 参数，也不利用 `getBoundSessionId()` 的 active fallback。 |
| 当前叶确实可见 | `sessionWindowService.isSessionWindowVisible(key) === true`；仅“不在 hidden 集合”不够，未挂载 / 已移除叶不能补领。 |
| 未因隐藏而 suspended | `lens.sessionViewBindingSuspended === false`；session event 不解除 suspended。 |
| 当前真实引擎 live，排除 pairing | 通过现有 `lens.uaConnection` 读取当刻 phase / pairing snapshot，复用 `isConversationEngineLive` 与 `isConversationPairingHold` 的公开语义；同时要求 `roster.isEngineConnected()`。不以测试 flag 或 readiness 字符串单独代表真实连接。 |
| catalog 现已 ready | 复用 `getConversationSessionReadiness(roster) === 'ready'`。断连本来可返回 ready，所以必须与上一行 AND，不改该 helper。 |
| 自身确实缺 lease | `lens.sessionViewLease === undefined`；存在 lease 即无动作，不因 session 事件主动换 owner、重置 timeline 或重新获取同一 lease。 |

不按 session event 的 id 过滤 listener。catalog 成功通常仅发 active id，但另一个 pinned visible 叶也可能缺 lease；每个 listener 检查自己的当前 bound 和可见性。两个 Pane 各自对齐，不能用共享底层 lease / 缓存已 live 推断两个 Pane 都成功。

捕获对象与当刻字段均在同步回调里核验，核验到调用之间不增加 await。现有 teardown / `visibilityDisposables.clear()` 负责撤销旧 listener；不添加新服务、公共 API、通用框架或 generation。callback 遇到任一门关闭就无动作，等待后续真实 session 事件；不轮询或自行重连。

## 3. 真实回归夹具与证据资格

回归入口放在既有 `conversationSessionWindowReveal.test.ts`，使用真实 `createEditorParts → EditorService → ConversationPart / SessionWindowService → ConversationEditorPane → ConversationLens` 链。现 `createRevealHarness` 默认是 `QuietRosterService`；其原测试与默认行为保持。新增专用引擎夹具必须实例化真实 `ConversationEngineRosterService`，不能把 QuietRoster 或 ready getter stub 称为真实 catalog 恢复。

依赖用既有公开边界注入：

- 同一个 UA connection fixture 提供公开 connection emitter、phase / pairing / published identity，以及真实调用的 `listSessions` started / release Deferred；Roster 必须在真实 Pane / Lens 之前创建。可复用现 roster 测试的 connection 实现模式，不为生产加测试 API。
- `IUniverseAgentSessionView` fixture 提供实际 acquire / release 与 `onDynamicDidApplyFrame(leaseId)` 事件，保留真实 `ConversationEngineFrameSource`、lease、projection 和 TimelineHost；使用已有合法 frame shape，不向 Lens 手填 entries / snapshot。
- 通过公开 editor / window 操作取得实际 Pane，再由 `activeConversationLens` 只读观察 owner、bound、suspended、lease、snapshot / entries。公开 lease acquire 的计数包含 Roster observation owner，必须按实际 Pane 的对象与 lease session 归属分开判断。
- 使用 `whenEngineCatalogRefreshComplete()`、显式 list-start / acquire / frame-admitted 事件及有界 await 等待；不用 sleep、无限 microtask 循环、源码字符串断言或延长 timeout 洗绿。所有 Deferred / DOM / editor / service 正常收束，保留 disposable tracker。

### 3.1 主 red 必须经过的链

1. 相同引擎身份、catalog 含 s1，真实打开可见 s1 Pane。先证明同一个 input / Pane / Lens 存活、bound=s1、确实有自己的 lease、实际空 timeline / entries；不能从一开始就没有 lease。
2. 通过公开 UA 断连 / 重连推进，第二次 `listSessions` 实际 started 后保持 Deferred pending。核公开 readiness 为 loading、叶仍可见、owner 对象不变；既有 connection → Binding 链实际把这个空 timeline owner 的 lease 变成 undefined。该中间态不成立即 setup 失败。
3. 返回包含同 s1 的真实 catalog 成功结果，等待 refresh 完成；核当前真实连接 live / 非 pairing / ready，active id 仍 s1、此恢复阶段 active-session change 增量为 0。
4. **不 hide / reveal、不 resetInput、不手动 bind / assign lease**，直接断言这个 Pane 的 Lens 自动有 `sessionId=s1` 的自身 lease。旧 a4a 应在此业务断言失败；若首先发生 load / DI / missing API / timeout / tracker 错误，不能计主业务 red。
5. 新候选再通过实际 session-view lease 的 frame 事件送入可识别正文与 pending，等待 admitted / timeline scheduler 正常落画，核该 Pane 的实际 turn 行 / pending 座位。仅 observer 或底层缓存收到 frame 不算通过；此处不点击响应写钮。

hide / restore 只可在独立正控或主失败之后作为诊断，不能先恢复再把结果算成自动恢复。旧源码与新候选的 input / native 来源由唯一 baseline lane 单独固定；本 draft 不执行或预约产物写入。

### 3.2 必要负控与恢复正控

| ID | 真实触发与必须观察的行为 |
| --- | --- |
| L1 | 上述同 visible owner 空 timeline → loading 实际缺 lease → 同 s1 ready 的主链，旧业务 red / 新 green 分开记录；收到 frame 与自己持 lease 两项都要成立。 |
| L2 | 已绘制非空同 session 内容，经历 catalog pending、list reject / unavailable、后续同身份成功 ready；同 session KEEP 的原 lease / snapshot / entries 身份与正文保留，新 session listener 不重领、不清空。此控制固定同 active / bound，避免既有 active 切换引起的合法 rebind 混入。 |
| L3 | 实际缺 lease 时，loading、unavailable、list reject、真 disconnect、connected / connecting pairing 分别触发可观察 session 通知：新 reconcile acquisition 增量为 0；再经公开恢复、真实成功 catalog 后补领并收到 frame。先证明各 case 的真实状态与缺 lease 前提；若被既有 connection 缓存路径合法领到 lease，须在明确的 session callback 边界区分来源，不能凭总 acquisition 数写成新 reconcile 通过，也不修改该缓存路径来凑 fixture。 |
| L4 | 已隐藏 / suspended 的真实叶在 loading、失败、ready 与重复 session 事件后仍无自己的 lease / 无新 acquisition；正常公开 reveal 仍按原路恢复。另核不存在 / 已移除的非 hidden 叶不能靠“不 hidden”补领。 |
| L5 | list pending 期间公开 clearInput、dispose、切换 input / bound；迟到的原 catalog / session 通知不得复活旧 input / Lens。继任 owner 只在自己的 bound / 可见 / ready 门满足时恢复；不能用相同 session 字符串代替对象存活检查。 |
| L6 | 已自动补领后，重复 ready / session 通知不再 acquire，lease 对象不变、frame 继续到达；有 lease 时不做无条件 rebind。 |
| L7 | 通过公开 `openSessionBeside` 建两个同时 visible 的 pinned 叶 s1 / s2；同一次 catalog 成功只通知 active s1，但两个真实 Pane 分别缺 lease 后均恢复自己的 bound。两个 Pane 的 lease、正文 / pending 归属分别断言，不借 active/event id，不借共享底层成功冒充。 |

L3 的“0”仅约束本次新增 session reconcile；既有 UA connection 回调的断连缓存读取不在本刀改写。测试不能通过直接设置 private / readonly 字段制造缺 lease、替换实际 Pane 为 host 字面量，或让所有负控都被同一个 suspended 条件短路来冒充各门独立覆盖。若真实夹具未能建立独立触发链，应明确报告 setup 未达并先修夹具，不削弱合同。

## 4. 文件范围、保护与不做

实施授权之后的最小候选预计只含：

- 生产：`src/vs/workbench/contrib/conversation/browser/conversationEditorPane.ts` 的上述 listener / 局部 guard 与必要既有 helper import。
- 回归：`src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts` 的专用真实引擎夹具与矩阵；原 QuietRoster 测试 / 断言保留。
- 必要文档：本方案、已有[作者行动记录](../progress/sources-accept-post-read-authorization-checkpoint.md#独立后续conversation可见叶-lease-恢复-draft)、[现分工看板](../parallel/active/sources-accept-post-read-authorization.md#独立后续conversation可见叶-lease-恢复)及到时 `session-windows` 的行为回填。方案阶段只改文档与导航。

不改 Roster 发事件顺序 / active-id 规则、Lens connection 回调、Binding 的 same-session KEEP、断连缓存、readiness、写门、frame source / platform / node、session-window 导航、计时器、epoch 或公共 API。local Git 迟到 notice / collapse 的完成所有权继续后置为独立候选，不混入本稿。

当前 a4a 的全部生产 / 测试源码与原 54 Accept + 18 Panel selectors 保持；[Accept plan](sources-accept-post-read-authorization.md)、[Panel VM plan](sources-panel-diff-view-model-lifetime.md)、[共同 factory 窄修订](sources-panel-fixture-preinjection-amendment.md)及原 dispatch JSON 不改。原旧 red、setup 失败、peer 与封存不覆写；PRD、D1387 closed、两已 implemented 窄方案及宽方案的旧边界保持。本 draft 不标产品或源码通过，不把已签 R3 外推为本项通过。

## 5. 交付与验证顺序

1. 本 docs-only draft：按索引接入，复用行动记录 / board，保持 status ≤200 行；跑 generated-status 一致性、docs health 与 diff 检查，核 `HEAD:src` / 工作区源码仍等于 d78a。只报文档静态结果。
2. 固定 draft commit / parent / 路径 bytes 与 SHA-256 → root 独立核 → 原 Astra 规则 16，只读产出 Strengths / Critical / Important / Minor / Assessment；父核后当轮改入 Critical / Important，保留不采纳理由。该 gate 未通过前保持 draft。
3. 独立 accepted 文档提交与 root 另行源码授权后才实施；实施候选再次固定、独立源码 peer。发现当前 Sources fixture / runtime 问题先响应，不扩大此切片。
4. 只有 root 释放的唯一 baseline lane 执行 checker / emit / 官方 Electron 测试，先取得 L1 精确旧 a4a 的合格业务 red，再固定新候选跑矩阵与原 reveal 回归。setup 错误与业务失败分记，finally 核原输出恢复；作者不写 out / cache / freeze。
5. 默认编辑器窗口的非作者 after 仍须实际验证同可见 Pane 在同 session catalog 恢复后不靠 hide / restore 收到正文 / pending，以及 hidden 与双 pinned visible 叶边界；不得用 Sessions 网页或另领 observer 代替。获得实证后才讨论本窄方案 implemented 与知识层回填，不升级 PRD / 旧 D / 宽方案。

**当前审查 / 运行状态**：仅 draft 作者源码与文档核对；原 Astra 的 scope 裁定不等于本方案 Rule 16。该审查、主 red、新 green、非作者 after 均未发生。
