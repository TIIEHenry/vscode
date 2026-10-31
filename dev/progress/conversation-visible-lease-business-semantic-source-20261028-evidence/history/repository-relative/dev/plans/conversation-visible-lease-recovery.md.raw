---
title: "Conversation 可见叶：catalog 恢复后补回缺失 lease"
type: plan
status: accepted
phase: M7
updated: 2026-10-28
summary: "主lease仍accepted；§12双独立业务包窄amendment经固定a761原Astra规则16 C0/I0/M0/root采纳，独立accepted；仅文档签收，工具/每包执行及业务/after仍待另授。"
---

# Conversation 可见叶：catalog 恢复后补回缺失 lease

> **最新入口（2026-10-28）**：§12已获原Astra固定a761正式规则16 C0/I0/M0及root独核采纳，现独立accepted；§12.6记录归因与固定域。这里只签收文档，未授语义工具或业务包准备/执行，主lease仍accepted，业务/非作者after未达。下方既有“当前”段落按历史时点原样保留。

> **当前集成覆盖（2026-10-27）**：固定d8e新L4公开重读/sameLens窄修经原Astra C0/I0/M0/root采纳，以0ef352真双亲接入14e，当前src62996b35；仅Reveal80259B/110f7f…变更，Pane及其他src/Sources四窄implemented保持。7361首次checker五条TS2339失败与consumed原件不改；新checker、业务red/新13矩阵/完整Reveal/非作者after均待，尚无新prep或执行release。15500 metadata仍54fe、native256及额外Reveal旧JS/freeze4/cache3精确，lease accepted/overall active、fullCompile=false。[d8e真实合源/守卫/作者原件](../progress/conversation-visible-lease-narrowing-d8e-formal-integration-20261027-evidence/INDEX.md)为当前覆盖。以下固定输入、原“当前阶段”、首失败出版及E§10均按各时点保留，§1–§9与双方尾原字节不改；不由源码窄修获得运行资格，不重试旧consumed run。

> **固定输入**：`a4a70322795c509e8e9b8274cf295a1b65db663a`，`src=d78a48e5feee57fcaf5811c8425859d0a2400af0`。只读该对象，不追 main / merge / 他人 WIP。
> **当前阶段**：此前 root 接收783/f33及原Astra窄peer C0/I0/M0、关闭5fd dispose合同I1的记录保留于§8–§9。真实三路736171b1的唯一lane prep2首run在checker阶段因新L4的五个TS2339 `never`诊断失败，未emit/未运行测试，该run已consumed。root采纳原Astra只读根因与最小修法，授权本轮从clean f33仅重读当前公开Lens并断言同对象、替换两处读取根；现为待固定核/窄peer的test-only候选，详见§10。plan保持accepted，业务red/green/after全部未达，作者不重试checker或运行。

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

hide / restore 只可在独立正控或主失败之后作为诊断，不能先恢复再把结果算成自动恢复。旧源码与新候选的 input / native 来源由唯一 baseline lane 单独固定；本方案不执行或预约产物写入。

### 3.2 必要负控与恢复正控

| ID | 真实触发与必须观察的行为 |
| --- | --- |
| L1 | 上述同 visible owner 空 timeline → loading 实际缺 lease → 同 s1 ready 的主链，旧业务 red / 新 green 分开记录；收到 frame 与自己持 lease 两项都要成立。 |
| L2 | 已绘制非空同 session 内容后，保持真实引擎 live、pairing=false、同 engine identity / active / bound，仅以公开 UA 同 live 状态通知触发真实 catalog refresh，依次经历 pending、list reject / unavailable、后续同身份成功 ready；不沿 L1 的真 disconnect / reconnect。检查 lease / snapshot / entries 引用身份的窗口内不送新 frame；若另送合法新 frame，只要求原 lease 身份与原正文保留，不要求 snapshot / entries 引用不变。新 session listener 不重领、不清空。 |
| L3 | loading / unavailable / list reject 通过真实 catalog 路径观察；真 disconnect、connected pairing、connecting pairing 分别使用 §3.3 的自然 missing → QueueReader 真实公开 session 通知 → 同次 UA 通知内 callback 前后采样链。只在各门与 missing 前提均被实际证明的窗口核新增 reconcile 为 0；随后独立走真正 live / catalog 成功恢复正控。当前只有源码可行性，真实夹具未达即资格未达，不借后续合法缓存重绑或已有 lease 短路冒充覆盖。 |
| L4 | 已隐藏 / suspended 的真实叶在 loading、失败、ready 与重复 session 事件后仍无自己的 lease / 无新 acquisition；正常公开 reveal 仍按原路恢复。另核不存在 / 已移除的非 hidden 叶不能靠“不 hidden”补领。 |
| L5 | list pending 期间公开 clearInput、dispose、切换 input / bound；迟到的原 catalog / session 通知不得复活旧 input / Lens。继任 owner 只在自己的 bound / 可见 / ready 门满足时恢复；不能用相同 session 字符串代替对象存活检查。 |
| L6 | 已自动补领后，重复 ready / session 通知不再 acquire，lease 对象不变、frame 继续到达；有 lease 时不做无条件 rebind。 |
| L7 | 通过公开 `openSessionBeside` 建两个同时 visible 的 pinned 叶 s1 / s2；同一次 catalog 成功只通知 active s1，但两个真实 Pane 分别缺 lease 后均恢复自己的 bound。两个 Pane 的 lease、正文 / pending 归属分别断言，不借 active/event id，不借共享底层成功冒充。 |

L2 不把真断连后的合法缓存重绑当回归：Binding 在断连 ready 语义下可进入 `:201–204`，清掉旧 lease 并取得缓存；此行为没有本稿的引用身份承诺。L2 的 KEEP 引用身份只约束上述持续 live、同身份且无新 frame 的窗口。

L3 的“0”仅约束本次新增 session reconcile；既有 UA connection 回调的断连缓存读取不在本刀改写。测试不能通过直接设置 private / readonly 字段制造缺 lease、替换实际 Pane 为 host 字面量，或让所有负控都被同一个 suspended 条件短路来冒充各门独立覆盖。未能建立下节的独立窗口时，如实报告 setup / 资格未达；不改生产或新增测试 API 来造覆盖。

### 3.3 L3 非 live 门的公开事件与采样资格（M2）

以下是固定 a4a 的**源码可行路径，尚未运行真实夹具**。三个 case 分别创建独立真实 Pane / Roster，不把同一 case 的后续状态变化当成三份覆盖：

1. **自然 missing 前提**：先完成真实 live / 非 pairing / 同身份的 s1 catalog，真实可见 Pane 持有空 timeline lease；再发公开 UA 的同 identity、同 live 状态通知，让实际第二次 `listSessions` started 后保持 pending。Lens 的真实 UA connection 回调在 loading 时按 Binding `:181–189` 清掉空 timeline lease。必须实际核当前 Pane / input / Lens 相同且存活、bound=s1、visible=true、suspended=false、自身 lease=undefined；没有手动 release、hide / reveal、resetInput、bind 或字段赋值。此时公开 queue state 可在缺省无 getQueue hook 的夹具中为 `unsupported`，对应真实 QueueReader live scope，无需发 queue RPC。
2. **真实 session 通知来源**：然后仅通过 UA 公共 emitter 发布下表一种非 live snapshot。Roster 的 `onUaConnectionChanged` 调用 `super.setEngineConnected(false)`；其构造期已登记的 engine listener 先进入 `bindLiveTreeObservationLease → syncQueueReader`（Roster `:145,1765,1789–1790`）。`scope.live` 从 true 变 false，`ConversationEngineQueueReader.update:34–53` 同步把状态改成 stale 并调用 `changed(s1)`；Roster 构造的回调（`:129–131`）真实发出 `onDidChangeSession(s1)`。这条通知先于 Lens 的 roster engine / UA connection 回调，不依赖调用 private fire、手动 invoking 新 reconcile、rename 写入或一个假 readiness getter。
3. **前后 observer 的注册与采样**：在创建真实 Pane / Lens 之前注册一个公开 `roster.onDidChangeSession` observer，Pane 完成 setInput / listener 登记后再注册第二个 observer；二者都只读且按 fixture 的本次 UA transition 标记采样。用本次公开 UA emitter 的 fire 前 / 返回后标记包住完整通知；目标样本的顺序须为 `UA notify start → session before → session after → UA notify return`。两个 session observer 均处于**同一次 UA 通知内，晚于 Roster 同步 QueueReader 状态变化、早于 Lens connection 合法重绑**。before / after 均采当前 owner / bound / visible / suspended / lease、公开 phase / pairing / roster connected / readiness、queue stale 状态与该 Pane 的公开 bind 入口转发观察计数；观察包装必须照常转发真实入口，不手动调用或代替真实执行。before 必须已经缺 lease，after 仍缺 lease，二者之间该 Pane 的 bind 增量为 0。只看全局底层 acquire=0 不够，共享或已有 lease 都可能短路。

| 独立 case | 本次 UA snapshot | callback 窗口必须实际证明 |
| --- | --- | --- |
| 真 disconnect | 真实 `phase.kind='disconnected'`、pairing=false，保持同身份 / s1 | readiness 可按原语义为 ready；真实引擎非 live；QueueReader 真实 live→stale 通知夹住新增 reconcile，before / after 缺 lease / visible / unsuspended。 |
| connected pairing | 真实 connected phase、pairingPending=true，保持同身份 / s1 | phase 仍 connected 但 pairing hold 为真、真实引擎非 live；独立 QueueReader live→stale 通知与同一组前后门事实，不能只凭 connected 字样当 live。 |
| connecting pairing | 真实 connecting phase、pairingPending=true，保持同身份 / s1 | connecting pairing hold 为真、真实引擎非 live；独立 QueueReader live→stale 通知与同一组前后门事实，不能复用上一 case 的已有 stale scope。 |

第二个 session observer 返回后，后续 Lens connection 回调可能按原合同取得 stub cache / pairing leftover lease；该获取必须单列，**不能计入新增 reconcile 的窗口，也不能要求整个 UA 通知结束仍全局 acquire=0**。恢复正控在此之后另行解除 hold / 真正连接，重新使真实 catalog pending 时的空 timeline 自然缺 lease，再成功 ready 并验证实际 Pane 自身 lease / frame；不靠手动清 lease 制造恢复。

若实际 fixture 的订阅顺序、scope 未变、嵌套通知或合法连接回调令 before / after 看不到独立 missing 窗口，相关非 live case 必须记录为 **资格未达 / 待真实夹具验证**。不得改 Roster 事件顺序、连接缓存路径或生产 API 来满足采样；也不能把有 lease 的无动作、suspended / 不可见短路、总 acquire 数或其他 Sources 测试的结果当成本 live 门已验。

## 4. 文件范围、保护与不做

实施授权之后的最小候选预计只含：

- 生产：`src/vs/workbench/contrib/conversation/browser/conversationEditorPane.ts` 的上述 listener / 局部 guard 与必要既有 helper import。
- 回归：`src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts` 的专用真实引擎夹具与矩阵；原 QuietRoster 测试 / 断言保留。
- 必要文档：本方案、已有[作者行动记录](../progress/sources-accept-post-read-authorization-checkpoint.md#独立后续conversation可见叶-lease-恢复-draft)、[现分工看板](../parallel/active/sources-accept-post-read-authorization.md#独立后续conversation可见叶-lease-恢复)及到时 `session-windows` 的行为回填。方案阶段只改文档与导航。

不改 Roster 发事件顺序 / active-id 规则、Lens connection 回调、Binding 的 same-session KEEP、断连缓存、readiness、写门、frame source / platform / node、session-window 导航、计时器、epoch 或公共 API。local Git 迟到 notice / collapse 的完成所有权继续后置为独立候选，不混入本稿。

保护合同：除本方案明确授权的 Pane / Reveal 两 TS 候选外，a4a / ff55 的其余生产 / 测试源码与原 54 Accept + 18 Panel selectors 保持；[Accept plan](sources-accept-post-read-authorization.md)、[Panel VM plan](sources-panel-diff-view-model-lifetime.md)、[共同 factory 窄修订](sources-panel-fixture-preinjection-amendment.md)及原 dispatch JSON 不改。原旧 red、setup 失败、peer 与封存不覆写；PRD、D1387 closed、两已 implemented 窄方案及宽方案的旧边界保持。本方案不标产品或源码通过，不把已签 R3 外推为本项通过。

## 5. 交付与验证顺序

1. 已固定的 docs-only draft：按索引接入，复用行动记录 / board，保持 status ≤200 行；跑 generated-status 一致性、docs health 与 diff 检查，核 `HEAD:src` / 工作区源码仍等于 d78a。只报文档静态结果。
2. 固定 draft commit / parent / 路径 bytes 与 SHA-256 → root 独立核 → 原 Astra 规则 16，已完成并保留 Strengths / Critical / Important / Minor / Assessment 来源于 §6；root 采纳两条 Minor，只有本次独立 accepted 文档改稿获授权。方案门不代源码 / 运行门。
3. 独立 accepted 文档提交与 root 另行源码授权后才实施；实施候选再次固定、独立源码 peer。发现当前 Sources fixture / runtime 问题先响应，不扩大此切片。
4. 只有 root 释放的唯一 baseline lane 执行 checker / emit / 官方 Electron 测试，先取得 L1 精确旧 a4a 的合格业务 red，再固定新候选跑矩阵与原 reveal 回归。setup 错误与业务失败分记，finally 核原输出恢复；作者不写 out / cache / freeze。
5. 默认编辑器窗口的非作者 after 仍须实际验证同可见 Pane 在同 session catalog 恢复后不靠 hide / restore 收到正文 / pending，以及 hidden 与双 pinned visible 叶边界；不得用 Sessions 网页或另领 observer 代替。获得实证后才讨论本窄方案 implemented 与知识层回填，不升级 PRD / 旧 D / 宽方案。

**当前审查 / 运行状态**：89d Rule16/ff55 accepted及783/f33静态peer/I1关闭记录保持；后续真实三路7361的唯一lane prep2首run checker五诊断失败、无emit/测试，见§10。本轮仅新L4公开重读的类型表达候选，未取得新checker通过或业务运行资格，待root核/原Astra窄peer；旧L1red、新13矩阵/原Reveal、非作者after全未达。


## 6. 规则16原审查与独立accepted文档

**被审查的固定原稿**：commit `89d08368cf4f889e1a815f8670a0e2ffd7ea9911`，parent `a4a70322795c509e8e9b8274cf295a1b65db663a`，`src=d78a48e5feee57fcaf5811c8425859d0a2400af0`；本 plan 原 Git blob `2903caa5a1b2684fc3cf83b1eb076573fc42d128`，17039 bytes / SHA-256 `f5b430ece9dc23e3065b60cc42d216be12ca3bc074113452f95494c09884bc8f`。原稿可从该不可变 Git 对象读取，不把本次澄清倒写成原稿已知或已验证。

**来源与资格**：原 reviewer `/root/architecture_audit`（Astra）对精确 89d 正式只读 Rule16，结论 **C0/I0/M2**；root 已逐8路径 / hash / plan全文 / sourceTree / 原三Sources方案与JSON / status200及原首条核验并采纳两 Minor，于2026-10-27授权本次独立 accepted 文档改稿。**没有独立正式报告文件**；下列 Strengths / Assessment 是 root 转发 reviewer 消息的逐字摘录，原行号均指 89d 原稿，不伪造 raw 日志或 proof 路径。原 reviewer 给本作者的同轮消息也明确方案门不代表代码 / 运行通过。

### 原 Strengths（父转发消息摘录）

> 89d Rule16 Strengths：(1) :40-58唯一Pane visibility生命周期加同步listener，捕获input/lens并校验当前identity/明确bound、visible而非!hidden、未suspended、真实UA live排pairing AND roster ready AND自身missing，公开字段Lens:219/293/297/306/322可直接实现，无新服务/API/epoch。(2) :42保留原hide/reveal与断连stub路径；:54-56已有lease不动、目标不借event/active，L7两个不同bound pinned叶避免共享底层假阳性。(3) :62-79真实EditorParts/EngineRoster先于Lens/UA deferred/SessionView帧通路，先证明“有lease→自然missing”与sameactive0事件，再验证本Pane lease+实际正文pending，禁手动bind/hide恢复冒充自动恢复。(4) :89/103撤销旧listener、clear/dispose/换input及后继owner门明确，Sources候选与原签收均保护，:113要求独立非作者默认窗口after。

Critical：0。Important：0。Minor：2，均属非阻断的验证明确性，root 已采纳并要求当轮澄清：

| 原意见 | 本次改入 | 保护边界 |
| --- | --- | --- |
| M1：89d `:86` L2 须保持真实 live / 同 identity catalog refresh，不沿 L1 真 disconnect；引用身份窗口不能混入新 frame。 | L2 明确以公开同 live UA 通知触发 refresh，保持 pairing=false / 同 identity / active / bound；无新 frame 时才核 snapshot / entries 引用，有新 frame 仅核 lease 身份及正文保留，并补明确 Binding `:201–204` 的真断连合法缓存重绑。 | 不要求 L1 真断连跨越前后保持同 lease，不改 KEEP / 缓存生产行为。 |
| M2：89d `:87,93` L3 须写定真 disconnect 与两 pairing 的自然 missing、公开 session 通知来源及 callback 前后采样点；无法独立建立则资格未达。 | §3.3 分别固定三种 snapshot，以真实 pending 使空 Pane 自然 missing，再由 QueueReader live→stale 的真实 session 通知，在同次 UA 内晚于 queue 更新 / 早于 Lens 合法连接重绑的两个公开 observers 取样；root 另实读 Roster `:129–145,1745–1790` 与 QueueReader `:34–54` 接受该静态源链。 | 目前仍是源码可行性；无实际 fixture 资格，不以总 acquire0 / existing lease / hidden短路冒充，不改生产 / 事件顺序 / API 造 fixture。 |

### 原 Assessment（父转发消息摘录）

> Assessment：可由root核验采纳后独立accepted；建议当轮澄清M1/M2，二者不阻塞设计门，不代表测试已可执行/源码已正确/运行green。未改文件/编译/emit/测试/out，未干预solelane。

本次 accepted 只关闭方案审查与两 Minor 的文档澄清，不宣称测试夹具已可执行或产品已恢复。原 a4a 生产 / 测试、当前 Sources 54 / 18、三个 Sources 方案与 JSON 保持；lease 主 red / 新 green / 非作者 after 尚无证据。root 核本 accepted SHA 后仍须另行授予源码实施权，作者不自行推进该切片。


## 7. E 最小源码候选与作者静态边界（2026-10-27）

本节是 ff55 签收之后的实施事实，不改 §2–§3 合同或 §6 原审查结论。E 原为干净 `e7c246315db77aa8277775338522bb9a1cb8ff84`；root 明确授权后只做一次普通 `git merge --ff-only ff55db8937f08f116ad23e95b21fa071091b245f`，随后在 `fix/e-conversation-visible-lease-recovery-20261027` 形成候选。不追 main、未 reset / restore / stash / clean，既有 out 不是候选产物。

生产仅在 `ConversationEditorPane.bindHiddenLeafLease` 原 `visibilityDisposables` 中增加同步 roster session listener 与既有 helper import；原 `syncLease` hide / reveal 正文与调用逐字保持。回归在原 Reveal 文件中增加真实 EngineRoster（先于 Pane 创建）、公开 UA emitter / Deferred catalog、公开 SessionView host frame fixture，保留真实 FrameSource / Pane lease / TimelineHost；原 26 个 `test(...)` 的完整 AST 文本逐字相同，反向去掉新增夹具与列明的通用 harness 抽取后，默认 QuietRoster 文件完整还原 ff55。新增打开 input 走真实 `IEditorService`，不私改 lease / readiness，不改生产事件顺序或 API。

### 7.1 静态展开选择器与待运行资格

下面为 **13 个预期 case**，不是运行结果。每个 fullTitle 是固定前缀 `Conversation session window reveal + leaf SessionBar (C) visible engine lease recovery ` 加下表后缀；完整展开原件在作者静态 JSON 的 `tests`。早先进展口头计数 14 是计数误差，以本表及 AST 展开 13 为准。

| 合同 | fullTitle 后缀 | 公开观察与资格 |
| --- | --- | --- |
| L1 | `L1 same visible empty owner recovers its own lease after same-session catalog ready without reveal` | 自然 empty→missing、同 active 事件增量 0、自身 lease + DOM 正文 / pending；待运行。 |
| L2 | `L2 continuously live nonempty owner keeps lease snapshot entries and text through catalog pending failure and ready` | 持续 live / 同 identity / 无新 frame 窗口，lease / snapshot / entries 引用与正文；待运行。 |
| L3 | `L3 loading and real list rejection leave a visible empty owner missing until successful ready` | 真实 list / QueueReader；三个非 live case 的同 UA before / after 窗口及 bind 增量 0 均待运行资格。 |
| L3 | `L3 disconnected QueueReader session window keeps a naturally missing visible owner unbound` | 真实 list / QueueReader；三个非 live case 的同 UA before / after 窗口及 bind 增量 0 均待运行资格。 |
| L3 | `L3 connected pairing QueueReader session window keeps a naturally missing visible owner unbound` | 真实 list / QueueReader；三个非 live case 的同 UA before / after 窗口及 bind 增量 0 均待运行资格。 |
| L3 | `L3 connecting pairing QueueReader session window keeps a naturally missing visible owner unbound` | 真实 list / QueueReader；三个非 live case 的同 UA before / after 窗口及 bind 增量 0 均待运行资格。 |
| L4 | `L4 hidden suspended owner stays unbound through failed and ready catalogs until public restore` | 真实 hidden / restore / public prune，或未挂载非 hidden；待运行。 |
| L4 | `L4 an unmounted non-hidden bound key cannot reconcile before its public leaf exists` | 真实 hidden / restore / public prune，或未挂载非 hidden；待运行。 |
| L5 | `L5 clearInput during real catalog pending cannot revive the captured owner` | 真实 pending 后公开 owner 操作，迟到通知与继任 owner；待运行。 |
| L5 | `L5 dispose during real catalog pending cannot revive the captured owner` | 真实 pending 后公开 owner 操作，迟到通知与继任 owner；待运行。 |
| L5 | `L5 switch input during real catalog pending cannot revive the captured owner` | 真实 pending 后公开 owner 操作，迟到通知与继任 owner；待运行。 |
| L6 | `L6 repeated real session notices keep the recovered lease and continue delivering frames` | 真实重复 catalog 通知、lease 身份与后续 frame；待运行。 |
| L7 | `L7 two pinned visible owners recover their own bounds from one active-session catalog notice` | 公开 open beside，单 active catalog 通知、两 own lease 与独立正文 / pending；待运行。 |

L3 的公开 observer 注册顺序、QueueReader unsupported→stale、同次 UA 内 `start→before→after→return`、两侧 visible / unsuspended / missing 及 bind 增量 0 都已写成运行断言，**静态通过不证明任一窗口实际成立**。必须由唯一 lane 独立取得该资格；后续 Lens connection 合法缓存重绑不计入这段窗口。L4 的已移除控制由真实 catalog prune 卸掉 s2 叶后，再送真实 ready 通知检查不复活；未挂载控制另核 visible=false 且 hidden=false。

### 7.2 作者允许的检查与交付门

两 TS 仅 `createSourceFile` AST parse（不建 Program / checker / emit）均 0 syntax diagnostics；两文件 `eslint --no-cache` 实际 exit0：Pane 0 errors / 4 个既有 selector warnings，Reveal 0 errors / 0 warnings。精确还原与保护检查确认生产只有获准 listener / import、默认 QuietRoster 与原 26 tests 保持、`src` 只两路径不同，其他 Sources 源码与旧 54 / 18 selectors 不动；三 Sources plan 与 dispatch JSON bytes / SHA-256 全等 ff55。静态原件为 `/tmp/vscode-e-visible-lease-static.json`、`/tmp/vscode-e-visible-lease-eslint.json`。

out / .build / node_modules 逐条 metadata（workspace-relative path、mode、size、mtime_ns、ctime_ns、symlink target；不含 atime）分别 14865 / 416 / 47159 项，与 advance 前后 hash 相同；根 cache / eslintcache 与 node_modules cache 仍无。作者没有 typecheck / compile / transpile / emit / tests / Electron / UI / engine / out / cache / freeze 写入。文档与 diff 检查结果记于[现行动记录](../progress/sources-accept-post-read-authorization-checkpoint.md#e-可见叶lease最小源码候选2026-10-27)。

本 plan 继续 **accepted**；此候选还须 root 核固定 commit、原 reviewer 独立源码 peer，再由 root 单独释放唯一 baseline lane 的旧 a4a L1 合格业务 red / 新候选矩阵及原 reveal 回归，最后非作者默认编辑器窗口 after。未把静态结果写成实现通过；PRD / D1387 / 宽方案、历史 Sources / unary 局部签收均保持。


## 8. 5fd 正式源码 peer 与新 L4 合同修订（2026-10-27）

### 8.1 审查来源与父级采纳

精确被审查对象为 `5fd65f66ef965f75055d3338849f2bcf5cf8e7bc`（parent ff55 / src `b97e68c3278c00f53a28977f4a2a5a68cc84d07d`）。root 已独核七路径的 mode / blob / bytes / SHA、sourceTree / clean、四 Sources TS / 三 plan / JSON、原前缀与 status200、8份静态artifact及docs current==overlay。原 reviewer `/root/architecture_audit`（Astra）正式只读源码 peer **C0/I1/M0**；来源为其直接消息与 root 转发采纳，不存在另造的正式 raw 报告文件。

- **Strengths**：reviewer直接消息确认“L1/L3 真实事件链及其余矩阵静态 peer 未发现别的问题”；root转发的细项为L1真实disconnect→reconnect空lease前提、L3 early observer/QueueReader同步stale真实session bracket在Lens连接前的源码链，以及L2持续live KEEP、L4 unmounted、L5 input、L6/L7无新源码缺陷。以上全为静态判断，不提供运行资格。
- **Critical**：0。
- **Important I1**：reviewer指向5fd Reveal测试`:821/829`：“非空 s2 restore 后 prune 会 dispose Lens/registered lifetime，但普通 dispose 不把旧 lens.sessionViewLease 置 undefined；Pane 已先清 visibility listener，之后 fireVisible 不会调用 hidden-release。” 要求只修新L4，记录旧owner lease实际释放/不再接帧，保留Lens disposed、leaf absent/nonhidden/nonvisible、late bind0，不改生产Lens清字段。
- **Minor**：0。
- **Assessment**：修I1后须原reviewer窄复审；无运行通过结论。root已独读Reveal788–830、Pane129–145、WindowService716–758、Lens778–787并采纳I1，明确授权从干净5fd仅新L4合同修正与必要theme docs，不改生产/服务/API或其余case。

### 8.2 公开观察修正与源码依据

普通dispose的合同是释放registered lifetime与退出帧消费，不承诺清空仍被测试变量持有的Lens字段。新L4在正常公开restore且实际绘制后记录该Pane旧lease；用现有公开`roster.acquireSessionView(s2)`保留独立observer（不替换Pane lease），并记录真实SessionView边界当前未released的s2 host id。公开catalog prune之后仍检查Lens disposed、leaf absent且hidden=false/visible=false；随后一帧经原host边界发给仍live observer，必须被observer真实admit并更新其snapshot，而旧Pane lease snapshot引用与frame事件计数都不变。最后dispose保留observer，公开`releaseLease`记录必须出现该host id；因此检查旧Pane与roster没有残留ownership，而非检查disposed Lens字段是否清空。迟到真实ready通知仍要求旧Pane bind增量0、旧lease不接帧，存活s1 owner继续真实正文/pending正控。

root另行只读核`EngineSessionViewLease` getter638–639为每consumer replica、dispose695–702执行removeConsumer/onRelease、notifyApplied617–625拒绝disposed。该源码依据支持“活observer接帧/旧owner不接帧→最后observer释放host”的修法；不改FrameSource、不私读内部disposed/refCount/lease，不手动bind、dispose旧Pane lease或applyFrame。**这些仅为已写运行断言，实际release、隔离与L4资格仍为runtime false。**

### 8.3 作者静态与保护边界

本轮相对5fd仅新L4 `test(...)`文本变化：把当前L4完整替回5fd原L4即可逐字还原整个Reveal文件；其余12个新增动态case、原26case与默认QuietRoster全保，新增矩阵仍13条。Pane15270B / SHA-256 `90c0719d26183f27ae8e4fbcbead63d6f7e6c4aef64c1bbc39a898a65b1501d3`完整保护，`src`仅Reveal一条路径不同；Sources四TS/三plan/JSON与历史证据保护。两TS仅`createSourceFile`诊断0；本轮改动Reveal的`eslint --no-cache`实际exit0、0error/0warning。静态原件采用独立`/tmp/vscode-e-visible-lease-i1-*`命名，不覆盖5fd已交artifact。

metadata守卫的14865/416/47159计数是`out/.build/node_modules`的**后代entries**，tuple路径含目录名前缀，不含各root inode本身，仍不含atime。ff55旧status首条不含LF hash为`bc12ff2dc9c25b0dfdf46d2136a428f53d7d31f0bd3a7aaa3d59be7a0ac47651`；含LF另为`9ea9515f78c69966800dfac437b0da8a212be6ba6d9a716480dcb4f5a5d94dc7`，不可混称。root报告其独核两次初比差异由比较schema解释（多加root inode一行、首条LF边界），不是作者漂移或实际门禁失败；随后root按相同schema独扫三目录全匹配。root另核E index flags全H=22250、skipWorktree=0，commit中docs/dev tracked Markdown在FS missing0；不据此猜测555与其他工位扫描数字差异，不修复checkout。

本轮仍无Program/checker/compile/transpile/emit/runtime/UI/engine/out/cache/freeze写；plan继续accepted，不升PRD/旧波。固定修订commit先由root核，再原reviewer窄peer；旧a4a L1主red、新矩阵/原Reveal回归及非作者after仍须之后另获唯一lane执行授权。


## 9. 783 窄 peer 签收与下一门（2026-10-27，纯文档）

### 9.1 固定对象、审查来源与父级采纳

root已逐6path/source仅新L4块、mode/blob/bytes/SHA、parent/sourceTree、clean、manifest/artifact hash、status200/仅7、12行、旧raw含LF、board/checkpoint原前缀及三目录后代metadata，独核固定 `78338484340843a91f2babbf8a690989a1790bdd`（parent `5fd65f66ef965f75055d3338849f2bcf5cf8e7bc`，src `eefc0c95737b4f66c4e9581a3500b2497a15d766`）后正式接收静态候选，采纳原reviewer `/root/architecture_audit`（Astra）窄peer **C0/I0/M0**，关闭5fd新L4合同I1。§8原I1报告、父采纳与修订内容及5fd/783外部静态原件均保留，不覆盖、不另造正式raw报告文件。

- **Strengths**：原reviewer直接消息确认public acquire共享binding但得到独立lease；retired Pane lease snapshot/frame停止、保留observer真实frame正控成立；最后observer.dispose→refcount0→releaseHost→fixture released.add同步链有源码依据。root采纳的原结论同样明确：observer真实frame/snapshot变化时旧owner snapshot/事件不变，最后observer释放host；L4外完整test字节与生产Pane保持。
- **Critical / Important / Minor**：均0。
- **Assessment**：只关闭5fd测试合同I1并接收783静态源码候选，13仍是静态预期case，不提供任何运行资格或业务green。审查来源为原reviewer直接消息与root采纳消息，不用文档签收替代运行证据。

root核783时一度沿用旧字段`entries`读取已澄清的`descendantEntries`而KeyError；按新schema更正后精确通过。这是root读取器错误，不是artifact变化或metadata守卫失败。计数仍为不含root inode的14865/416/47159后代entries，LF/NoLF边界继续按§8保留。

### 9.2 当前固定源码与未达门禁

本次只改plan实施记录、board、checkpoint与status摘要四文档；全部`src`继续与783逐字相同，Pane15270B/SHA-256 `90c0719d26183f27ae8e4fbcbead63d6f7e6c4aef64c1bbc39a898a65b1501d3`、Reveal80119B/`ee287ba144f4d7412af3fe8c52f7fb0ae6183c5d443d17f3e605d7838000118c`、原26/new13/defaultQuiet与Sources四TS/三plan/JSON/历史证据保护。静态manifest入口仍用§8已有`/tmp/vscode-e-visible-lease-i1-*`，本轮不覆盖或复制原件；后续唯一lane证据入库时再统一持久化必要manifest，不新增证据目录或复制out。

下一门仍是root另行释放的唯一lane：先按其既有Sources新源验证顺序推进，再准备本lease精确旧a4a L1合格业务red、新783源码13矩阵及原Reveal回归、非作者默认编辑器窗口after。上述每项均 **runtimeObserved=false**，没有本轮执行授权；C0/I0/M0与此纯文档commit不是formal merge、green、产品完成或outputs交付。plan仍accepted，PRD/旧波不升；本轮仅docs/generator/diff及保护检查，不再AST/lint，不Program/checker/compile/emit/runtime/UI/engine/out/cache写。


## 首次 checker 失败证据出版（2026-10-27）

固定f33已由5336真三路合入，父736171b1/src90d609；prep1工具peer C0/I1/M0修订后，prep2静态peer C0/I0/M0获root采纳并单次release。实际driver/checker均exit1：Pane语法/语义0，Reveal语义5条TS2339；lint/dry/两次emit/旧L1+meta/完整Reveal均未到达，业务red、新矩阵green、meta/hooks与非作者after未运行。两JS无写入/恢复范围空，15500 metadata仍54fe；lease accepted、overall active，fullCompile=false。正式source peer与工具peer是不同审查，均不充当运行通过。准备、I1/reader错误、false/active release和单次消费见[原件](../progress/conversation-visible-lease-first-checker-failure-20261027-evidence/INDEX.md)。

TS6.0.3在实际src项目10316 roots/11250 program files中仅请求两目标语义：Pane 0/0，Reveal语法0、语义5；config/global/options/非目标语法0，非目标语义未请求。Reveal一基位置809:46（sessionId）、818:27（onDidApplyFrame）、829:41/836:37/850:36（snapshot），均为never上的TS2339；原JSON零基位置不改。noEmit=true、emitInvoked=false、forbiddenWriteAttempts=0。

原Astra/root归因于新L4公开restore前的undefined属性路径窄化保留，建议仅test引入新的公开restoredLens并核同一identity，再替换两处读取根。此为署名意见及下一作者窄修边界；本提交没有新源码候选、修补或复跑授权，不改方案合同。cleanup先于恢复守卫，actual completed/uncertain/journal/restore/ctime差异均空，所有owned已停；未写路径不得repair或给ctime例外。业务旧red、新green、完整Reveal、title/meta/hooks和非作者after未运行，不能记为0 passing。

## 10. 实际 prep2 checker 阻断与新 L4 读取根窄修订（2026-10-27）

### 10.1 失败事实、来源与最小修订授权

root报告已真三路接入并独核 `736171b1abc34e36e4991709240625827b566396` / src `90d6092dbbca80114db7f55a75e137bb1d7bef76`；该固定对象的Reveal仍为80119B / SHA-256 `ee287ba144f4d7412af3fe8c52f7fb0ae6183c5d443d17f3e605d7838000118c`，与已签f33相同。唯一lane prep2首个实际run在source checker阶段失败：Reveal TS2339、类型为`never`，1-based809 `sessionId`、818 `onDidApplyFrame`、829/836/850 `snapshot`，共五诊断；Pane无诊断。**没有emit或测试，旧L1业务red、新矩阵/原Reveal与after全部未达；该failed run已consumed，不能重试。**

失败来源是root转发的唯一lane原件`/tmp/vscode-conversation-visible-lease-f33-validation-20261027-prep2/source-checker-report.json`，1353902B / SHA-256 `24789f8d0fb98af456d2dfaf4c9dbab2ee74145d4eeb73b3d436d62b13377ba3`。本作者没有执行或重试该checker，没有触碰baseline工具/HEAD，也不把来源消息伪造成本作者运行日志；其正式失败证据由baseline另交。

原Astra只读裁定：新L4原790/797/805对同一`lens.sessionViewLease`的undefined断言造成控制流收窄，跨公开restore807及await仍保留，原809/811继续从该读取根得到`never`并传播到后续字段。root采纳最小test-only修法，并明确这只是类型表达加sameLens断言，不改变L4合同，**不需新plan amendment**：保原restore与suspended=false；在原809前从`pane.activeConversationLens`公开重读为`restoredLens`，`assert.ok`并`assert.strictEqual(restoredLens, lens)`；原sessionId断言与retiredLease采集两处读取根改为`restoredLens.sessionViewLease`。retiredLease仍在原`assertEngineFramePaints` await之后采集。原missing断言、retainedObserver、frame/snapshot、最后host release、late bind及surviving owner正控一字不改，不增加case/helper/any/cast/非空断言，不改生产或生命周期。

### 10.2 E 固定父与作者静态边界

本轮先核E的HEAD/clean/bytes/hash均为已接受f33，选择留在 `f33d16fbc5841119f5baa7ff2788060d39b8bb4f` / src `eefc0c95737b4f66c4e9581a3500b2497a15d766` 作为窄parent，**没有ff或导入7361/main/WIP**。E本baseline只有当时三份Sources plan与原JSON，保持其原字节；不假称含后来第四plan/52B stub，后续由root真实三路保留merge端已有Sources增量，不从主目录复制源码。

把本次获准的三行公开重读/同对象断言与两处读取根变更逆还原，即逐字还原整份f33 Reveal文件，因而整L4其余字节、其他12新case、原26/defaultQuiet完整保持；预期动态case仍13。Pane15270B / SHA-256 `90c0719d26183f27ae8e4fbcbead63d6f7e6c4aef64c1bbc39a898a65b1501d3`与其他全部src不变，三个Sources plan/JSON、旧peer/原件/失败历史不覆盖。

改后只对Reveal执行**一次**`createSourceFile` AST-only：0 parse diagnostics、无Program/checker；只对Reveal执行`eslint --no-cache --no-fix`实际exit0、0error/0warning，Node均显式`NODE_DISABLE_COMPILE_CACHE=1`。生产Pane未重复AST/lint。独立原件为`/tmp/vscode-e-visible-lease-narrowing-static.json`与`/tmp/vscode-e-visible-lease-narrowing-eslint.json`，不覆盖已交783/f33原件。本次语法/lint结果**不证明TS2339已通过checker**；修订仍待root核固定commit、原Astra窄peer，之后只有root另行释放唯一lane的新资格步骤。作者无Program/checker/typecheck/compile/transpile/emit/tests/UI/engine/out/cache/freeze写，不重试consumed run。

本轮source与必要plan/board/checkpoint/status一并提交；用户可见行为/生命周期合同未改，无需改session-windows。plan继续accepted，不升PRD/旧波；所有lease业务runtimeObserved仍false，不把静态修订或此前peer当green。


### d8e 单次旧 L1 前置失败证据附记（2026-10-27）

仅追加[本次证据入口](../progress/conversation-visible-lease-d8e-old-l1-failure-20261027-evidence/INDEX.md)：固定 b7dd/src62996 的单次旧 L1 未满足647业务红资格，停止/还原与未达范围、原 Astra C0/I1/M1/root采纳署名见原件；原方案与历史正文不改，lease accepted/overall active，未授新工具或执行。

最新时点以该证据为准；上文“新checker待/无新prep”等为合源前后当时记录，完整保留。E的新纯诊断draft另轨进行，未审未实现，本处不签收、不扩大合同或授执行。


[Lease after 只读输入与历史保护边界（2026-10-27；仅证据落盘，不改变 accepted 合同）](../progress/lease-after-inputs-20261027-evidence/INDEX.md)。


### 8033 setup A静态接入附记（2026-10-27）

[独立诊断方案](conversation-visible-lease-setup-diagnostics.md)的A失败报告/默认参数已获原Astra源码窄peer C0/I0/M0/root独核采纳，并以 `e92f60426b1b7f731b46f793aab0301ff55a4d67` 真双亲接入、src `fa6f7fe9f339963dd9f4190f44aa17e45f6ad731`；仅静态A完成，实际B诊断待单独授权。本方案§1–§10及所有双方历史尾原样保留，合同仍accepted、overall active，旧f33五TS2339/d8e setup前置失败/误前置叙述及纠正/E.build失败保持。没有新checker/业务red/green/after或工具准备信用；[固定合源/冲突重放/保护证明](../progress/conversation-visible-lease-setup-diagnostics-8033-formal-integration-20261027-evidence/INDEX.md)。


### 8033 单次诊断与外层保护失败附记（2026-10-27）

[结果proof与原Astra正式审查](../progress/conversation-visible-lease-setup-diagnostics-8033-outcome-20261027-evidence/INDEX.md)记录固定3497/srcfa6的一次诊断：driver0、protocol accounted-official-outcome、official1、out恢复complete；L1实际Pane-open前置失败，primary445/456/433/544/655与固定控制流证明未到动态674 lease断言，expected old-red boundary not established。root采纳两份C0/I1/M0合C0/I2/M0：fixture缺IConversationWorkRootMount；外层全.build仅log metadata漂移，整体保护验收失败，不能称全工作区恢复。createCompile/reporter日志链为高置信度静态及时序解释，没有逐次writer/PID/syscall证据；不声明dry实写或扩大out恢复例外。

本方案合同、§1–§10及全部历史尾保留，仍accepted、overall active。旧f33/d8e/原E.build失败、待新13/原26及非作者after队列不抹除，无业务red/green/coverage/after信用。下一步仅记录两个未授权缺口：真实无依赖WorkRootMount model的fixture窄片；隔离reporter输出并全.build守护的新emitter独立方案。两者须独立只读审查与root另授，当前不准备、不补运行、不touch日志或旧包。


## 11. fixture与隔离诊断的当前输入（2026-10-27）

[固定3fc唯一隔离诊断](../progress/conversation-visible-lease-isolated-diagnostic-20261027-evidence/INDEX.md)已由原Astra实际验收C0/I0/M0、root采纳：A真实L1前置链到源676 lease断言；B本次official-fail路径的隔离/记录/stop/quiet/仅Reveal恢复成立。driver0、official1、meta pass/L1 fail分列，没有业务red/green/fullReveal/after信用。原8033前置失败和whole .build FAILED不追改，前述各阶段“待运行”是当时历史。

本方案合同与accepted状态不变。后续只走[fixture/emitter窄plan§11](conversation-visible-lease-harness-and-emitter-isolation.md#11-固定3fc单次隔离诊断及当前验收2026-10-27)的新业务包门：绑定715f604实际恢复起点，精确a4a旧生产L1业务red → 固定新13与完整Reveal → 非作者真实默认编辑器after。新Pane发射、old/new切换及phase/selection/restore/判定扩展需新的源码peer和整包peer；本次consumed诊断永久不重跑。


<a id="12-业务-old-red--new-full-双包窄-amendmentdraft规则16待"></a>

## 12. 业务 old-red / new-full 双包窄 amendment（accepted，规则16 C0/I0/M0）

### 12.1 状态、输入与独立边界

本节规范设计以固定draft a7613db66f7987c8a91bf9764be831b98c9ae65c经原Astra正式规则16 C0/I0/M0、root独核采纳，现独立accepted；无C/I/M须改，规范设计保持。原draft文档父671d9c2b6aa8612086912cdcff9afa85ebdca027 / src3dc1205763451e60e70c1a8a84465613990aa526为其固定历史输入，本次accepted收口固定父a761。主plan仍accepted；root本轮只授权accepted文档、文档门禁与范围提交，不授工具或source/包准备及运行。§1–§11及全部历史逐字保留；[单Reveal隔离诊断](conversation-visible-lease-harness-and-emitter-isolation.md#11-固定3fc单次隔离诊断及当前验收2026-10-27)的no-Pane限制、唯一consumed与原8033 whole .build FAILED/noBusiness信用均不改。本节不追授该诊断为精确旧生产业务red。

后续须准备两个完全独立的包，每包有自己的workspace HEAD、输入ref/blob/bytes/SHA、不可变副本、selection、seal、pins、whole-package peer与root单次execution release；workspace HEAD与input ref分开绑定，不能以当前工作区Pane代替旧输入。当前冻结输入如下：

| 包 | Pane输入 | Reveal输入 | 唯一官方选择 |
| --- | --- | --- | --- |
| old | 精确a4a70322795c509e8e9b8274cf295a1b65db663a生产Pane；blob8678204094b429fd4280dd528a70e83b9fcf5289；14186B；SHA-256 51cfc03a3be5dc2077c30e4a4ba72ca57b150a71c5a5649239087a0d339fcc65 | 当前Reveal；blobfeb55eeed2013c948ae487bdba8217887d2fc0b5；81721B；SHA-256 8a9c3245ae661b68e160c6a1c0d79924159618da7b342c5b09cd46caa1f35e61 | 仅L1业务case与官方meta；固定两个完整fullTitle |
| new | 当前Pane；blob98ba56dacc166c24d263112940c7aee0a0363357；15270B；SHA-256 90c0719d26183f27ae8e4fbcbead63d6f7e6c4aef64c1bbc39a898a65b1501d3 | 与old同一份冻结Reveal输入；ref/blob/bytes/SHA逐项相同 | 一次完整Reveal：13新增＋26原有＝39业务case，加官方meta |

两个canonical source path分别为src/vs/workbench/contrib/conversation/browser/conversationEditorPane.ts与src/vs/workbench/contrib/conversation/test/browser/conversationSessionWindowReveal.test.ts。每包准备时将完整fullTitles及新增13/原有26/meta分桶固定，实际reporter逐名start/result/end与官方stats、pending、hooks对账，禁止仅凭grep数量或manifest声明过门。new完整39已含新增13，不另重复跑一次13。

### 12.2 同一不可变输入贯穿checker、lint与双输出seal

每包两目标从各自固定ref/blob取得不可变copy，核bytes/SHA和UTF-8 decode→encode往返仍等原bytes；checker、lint、dry与emit只能消费这同一对输入，不改workspace源码。checker保持完整当前project、ambient与依赖上下文；对canonical source path同时在readFile和getSourceFile覆盖不可变目标文本，old尤其不能落回当前Pane。显式核Program内两个目标文本都等对应copy，记录实际ref/blob/bytes/SHA与canonical路径。请求两目标syntactic/semantic及config/options/global diagnostics；不请求或声称全project semantic-clean。

lint逐目标调用lintText(text, { filePath: canonicalAbsoluteSourcePath })，text严格来自同一copy；cwd固定实际repo/config，cache=false、fix=false。恰有两个有效结果且canonical paths准确匹配Pane与Reveal；missing、duplicate、ignored、fixed output均拒绝。逐result绑定实际input ref/blob/bytes/SHA、UTF-8往返与effective config，不以lintFiles(workspace)读取当前Pane冒充old输入。

root转交并采纳原Astra的固定配置判断：eslint.config.js为122598B / SHA-256 a231e9ca6a2625cb8f53e6f342b93aeb6011269c281f3ec5c37120fe8037cf96，两目标使用普通TS parser，当前不要求额外type-aware overlay；这只是固定配置的已有只读判断，不是本轮lint执行。若实际固定effective config启用project、projectService、显式Program或type-aware rule，必须另证其Program的两个目标文本等本包输入，否则停止；不能以lintText表面成功掩盖Program静默读取current Pane。届时配置若变化，须重新固定并交peer，不沿用此判断。

每包dry只在隔离scratch产出并seal恰两个canonical JS目标，map与输入来源一并固定，拒绝缺失、重复、额外输出或bytes差异。发射阶段只可使用其对应已seal输出，官方运行须对两目标取得实际loaded fresh bytes/hash观察；manifest-only、旧native、只观察其中一个或来源不清均不够。

### 12.3 每包阶段、逐path授权与恢复集合

执行前须选择容量足够且与旧原件分离的独立scratch，并重新做容量/身份/保护preflight。本轮/tmp曾在纯文档保护记录写入时ENOSPC，0B现场及原结果均保留，改用/home保存文档记录；这不是业务工具或测试失败。未来不能借删除旧证据换空间，也不能把当前文档存储回退当作新包准备或容量已获认证。

每包只执行一次固定链：checker → lint → dry双输出seal → emit-pane → emit-reveal → official → stop/quiet → qualified restore → full guard。任何前置失败即停止后续业务阶段，保留实际exit/raw/protocol；finally仍按合格实际写入集合收束，不自动retry或启动另一个包。reporter附写继续隔离到该包/阶段scratch，全.build守护不借日志例外放宽。

emit-pane与emit-reveal各自只有一个bound output path、一次真实parent permit、独立WAL及writer PID/start/token/deadline/journal；每path至多一次发射尝试，grant真实持久化先于该path intent，completed与partial/uncertain分别记。第二阶段不得借第一阶段permit或共享一次“允许两路径”授权。parent与writer职责、阶段guards、外层流结束前保护及停止身份沿既有已签隔离合同扩展后重新源码peer，不能仅扩manifest复用单Reveal诊断工具。

后续guard只接受此前独立完成且已核对的phase exact输出作为预期差异；如emit-pane完成，emit-reveal guard仅能接受该Pane输出的精确bytes及实际合格metadata。partial、未qualified、未完成或其他漂移不能被重新baseline或列成任意允许差异；失败即收束，不继续official。未写路径必须保持原bytes/mode/mtime/ctime，不借“两个目标都在manifest”恢复或repair。

恢复union只包含两phase各自独立qualified的实际write与partial/uncertain attempt。先证明全部owned身份stop/quiet，再逐项按各自授权恢复原bytes/mode/mtime，仅其自身合格ctime变化可另记；从未写过的path不restore。一项恢复或guard失败不能跳过另一项仍qualified的必要恢复，全部尝试和异常聚合如实记录；资格不成立的path不得凭推测写回，报告非零并保留不确定状态。

新seal、guard与ctime来源必须沿[715f604实际恢复起点](../progress/conversation-visible-lease-isolated-diagnostic-20261027-evidence/INDEX.md#恢复起点与来源)的lineage重新捕获，不能复用历史821、原54fe或已consumed包。每阶段及最终分别核src、out/native、全.build、node_modules、freeze/cache与旧原件保护；采样边界不能写成每个syscall或全部故障注入都已验证。

### 12.4 old合格业务red、恢复交接与new完整结算

old合格业务red须同时满足：真实setup与§3.1前置成立；两个目标都实际loaded且精确等本包fresh sealed bytes；L1主失败为“catalog ready must restore this visible Pane lease without hide/reveal”，经本包map到冻结Reveal源676:11；官方meta通过，固定fullTitles/结果/expected hooks完整、无pending或hook失败；全部owned quiet、qualified恢复与full guard完成。官方应明确记2 tests、meta pass1/L1 fail1，与driver是否完整记账分列。unexpected pass、setup失败、timeout、其他断言、meta/hooks失败或来源不符均不算业务red，也不能改断言、加hide/reveal或换旧源洗资格。failed body跳过泄漏计算仍不能称leakfree。

old须完成全恢复并由root明确接收后，才能在另获准备授权下捕获新实际基线、准备new独立包；其工作区HEAD、native/metadata/ctime与输入重新固定，沿old合格恢复的新lineage，不复用old运行目录或release。此处是root独立授权门，driver不得自动launch或排队执行new。

new只运行一次完整Reveal，实际按固定fullTitles分别结算新增13、原有26与官方meta1；合计40 tests，39业务与1meta均pass、fail0、pending0，全部expected hooks及逐名start/result/end对账。缺失、重复、额外选择、意外skip、只跑13或仅汇总passing数量都不够。两fresh目标loaded来源与最终stop/quiet/qualified union恢复/full guard同样必须成立。任何失败都保留原结果，不能声称新矩阵或完整Reveal已绿。

通过两业务包仍不替代非作者真实默认编辑器窗口after；after须独立授权、执行与审查。主lease是否implemented继续由完整业务与after证据决定，Sources、产品/PRD/旧D/旧波不因本节或静态peer升级。

### 12.5 已签文档与当前停止点

- [x] 原draft阶段root独立授权纯docs与输入身份固定；原件保持于a761及其证据。
- [x] 固定a761 → 原Astra正式规则16 C0/I0/M0 → root独核采纳；本节独立accepted，无C/I/M须改，规范设计保持。
- [ ] 另授语义工具准备 → 新源码peer；双输入overlay、lintText、双permit/WAL及union恢复语义全部纳入，不借旧v3窄审。
- [ ] old新整包whole-package peer → root独立单次execution release → 合格business red及全恢复由root接收。
- [ ] 另授new准备并捕新基线 → 独立whole-package peer → 独立execution release → 完整39业务＋meta结算及恢复。
- [ ] 非作者真实默认编辑器after独立完成，再评估主lease实施状态。

当前只有accepted文档收口与文档gates/scoped commit授权；无工具或source准备、AST、lint、Program、compile、emit、tests、UI、engine、out/cache写入或新包准备。作者交固定accepted commit/hash、Included与只读保护后停止；root核后另授merge安全ff及下一语义工具source工作，作者不先ff merge、不接J/D/main，不自行进入任何下一门。


### 12.6 原Astra正式规则16与独立accepted文档（2026-10-28）

原Astra对固定a761主lease§12正式规则16给出C0/I0/M0 PASSED，root已亲读并结合固定文档/原件独核采纳；无Critical、Important或Minor需要改入，故§12.1输入表及§12.2–§12.4的checker/lint/permit/selection/restore规范逐字保持。review认可old/new独立恢复交接、Program目标文本与lintText/type-aware门、逐path permit/WAL及qualified恢复union、精确old断言/new39＋meta逐title结算、root调度门与ENOSPC/noBusiness边界；两包仍不替代非作者真实默认编辑器after。

被审整plan为61595B / SHA-256 c2be104baefd97a34aea1333929ce7910d54319263458773630ac5a98ff42a19。§12从header开始的域为10122B / SHA-256 1a975848777dd70dc0bc0e48f73bc0e6082176c6fb51efbe9807ac7bcdc8870e；作者含两leading LF域为10124B / SHA-256 13bce7fa2e306e5c8f65b2b721a020c7c6a31621c8ddc4b5c45719d3df8664f5，两域不混用。§1–§11旧49128B / SHA-256 b79ee3ec216136e1e6c9adf5abec155d4c247a28f60ec9f0025e3e2e3987fe92逐字保留；域读取纠正属于root reader，不是candidate变化。

[正式归因与本次固定文档证据](../progress/conversation-visible-lease-business-amendment-accepted-20261027-evidence/INDEX.md)保存root转交摘要：来源是原reviewer本会话direct FINAL，由root概述转交；不是terminal raw，也不是原消息字节快照。[a761原draft证据](../progress/conversation-visible-lease-business-amendment-draft-20261027-evidence/INDEX.md)及其manifest/gates/raw/history保持，manifest绑定固定a761；本次accepted manifest只绑定本次文档commit，不能拿新live文档核旧manifest。

本次只关闭方案文档门，主lease仍accepted，全部业务runtime与after仍pending，不升implemented/产品。下一语义工具source peer、每新包whole-package peer及root各次独立release都未由本节文档签收代授。
