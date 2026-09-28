---
title: "Conversation 时间线一次性重构：订阅驱动的按根增量 + 文档流宿主"
type: plan
status: implemented
phase: M7
updated: 2026-09-28
summary: "v3.2（2026-09-28 已获用户明确签收 accepted，两轮规则 16 审查均已改稿）：一次重构到位，效果与性能优先。订阅层：动画帧调度（16ms 兜底），隐藏只停宿主 DOM，Inbox 与 lastAttachedEntries 每帧照旧，effects 接发送失败提示并回填未发文本；交接改为宿主侧按 turn 关联的 H1 顺序（对齐 Singularity，不做 UI 推断）；投影按输入身份缓存，按身份判定变化根；宿主为原生文档流 + content-visibility + 历史窗口化（未决座位强制在窗）+ 重资源预算，删除 WorkbenchObjectTree 与测高；流式正文按 marked 词法块冻结；跟随沿用 HEAD 解锁语义，排除自身写入，发送时上锁。D1 推翻「列表虚拟化进复用」，已签收并建立 ADR-010。"
---

# Conversation 时间线一次性重构：订阅驱动的按根增量 + 文档流宿主

> **触发**：2026-09-28 用户先要求审查 v1（树 → 热尾文档流 + 冷块卸载），并强调「消息订阅非常重要」；随后要求「一次重构好，你决定怎么实现，主要是效果和性能，先把方案设计好」。v1 审查结论见 §11.1；v2（分刀 + 开关）已被本稿取代。
> **授权与签收**：§2 的决策由实施方依用户上述授权拍定。其中 D1 推翻 [conversation-lens-assembly](../../docs/reference/code-oss-b2/conversation-lens-assembly.md) `:47` 的人类拍板「列表虚拟化 … 进复用」，属于规则 4 的「两方案择一」：已于 2026-09-28 获用户明确签收，并建立 [ADR-010](../decisions/010-conversation-timeline-document-flow.md)（§9）。D2、D5、D10 修订 [conversation-stream-timeline](conversation-stream-timeline.md) §3.3 / §3.4 中的相关句子，实施 commit 同刀改写。
> **沿用的合同**：
> - conversation-stream-timeline §3.3 产品投影与 §3.4 三类帧（A/B/C 语义不变，测法按 §6 点名调整）；
> - [session-view-frame-fanout](session-view-frame-fanout.md) 宿主 per-lease 扇出；
> - [session-subscription-lifecycle](session-subscription-lifecycle.md) lease 所有权与流重开；
> - ADR-046：过程折是 span overlay，座位不得成为可回收行（conversation-lens-assembly `:81`）；
> - UI 不做 overlay 与 L2「同一条」推断。

## 0. 结论

可以一次到位。缺陷和卡顿的根源是每个 token 都走一遍全量链路，不只是树本身的问题。本次重构是一个变更集，在独立工位分支上按 §5 的顺序落地，每一步都能编译、能跑测试；树、测高代码和 16ms 合并器在同一变更里删除，不留开关，也不保留双宿主。

四件事一起做：

1. **订阅层**
   - 视图按动画帧调度，16ms 兜底。
   - 时间线不可见时只停宿主的 DOM 更新；投影、`lastAttachedEntries`、Inbox 每帧照旧。
   - effects 接到发送失败提示，并把未发文本回填输入框。HEAD 里 effects 没有任何消费者。
   - overlay 到 L2 的交接，由宿主按 turn 关联排好顺序。
2. **投影层**：按输入身份缓存。变化根由身份判定，身份不同时再比较结构，不再依赖 changedIds；同内容的 baseline 做到零 DOM 工作。
3. **宿主层**
   - 原生文档流，配合 `content-visibility`、历史窗口化和重资源预算。
   - 只更新变化的根。
   - 流式正文按 marked 词法块冻结，每帧只重渲染尾部。
4. **滚动层**
   - 解锁语义沿用 HEAD，但排除控制器自己的写入。
   - 滚回底部时恢复跟随，发送时上锁。
   - 帧驱动的贴底在 flush 末尾同步完成，异步变高由 ResizeObserver 贴底。

## 1. HEAD 事实（2026-09-28 核对；CSS 行号随并行改动漂移，以选择器为准）

### 1.1 订阅链路

```text
gRPC SessionEventStream（electron-main）
  → demux + OverlayDeltaJoin → session-core Actor → 每个 lease 一条 ViewFrame
  → IPC onDynamicDidApplyFrame(leaseId)
  → EngineSessionViewLease.onHostFrame：applyViewFrame 到 replica（逐帧；失序即 requestResync）→ acknowledge
  → onDidApplyFrame(applied) → ConversationSessionViewFrameCoalescer（setTimeout 16ms）
  → applySessionViewTimeline：projectSnapshotToEntries（全量）→ attachReviewEntries → timelineTree.applyEntries
     同时刷新 lastAttachedEntries / 轨迹 / sync chrome 与 Inbox / phase / composer / density
```

| # | 事实 | 位置 |
|---|------|------|
| F1 | 数据面没有问题：replica 逐帧应用，游标断档即 resync，逐帧 acknowledge。视图读的是最新快照，所以视图层合并或跳帧都不会丢数据 | `conversationEngineFrameSource.ts:226-261` · `common/sessionView/apply.ts:710-783` |
| F2 | session-core 快照不可变且结构共享：`upsertById` 只替换命中项，未变项保持对象身份；overlay 文本更新不会替换 `timeline` 数组 | `apply.ts:484-563, 791-804` |
| F3 | 合并器用的是 16ms `setTimeout`，不是前置方案 §3.4 写的「同一动画帧」。baseline 到达时同步 flush 并执行 `this.pending = []`，同一窗口里待发的 effects 被丢弃 | `conversationSessionViewFrameCoalescer.ts:59-96`（baseline 分支 `:75-82`） |
| F4 | 每次 flush 都全量投影：<br>① 时间线整体 `slice().sort()`；<br>② 每项新建 entry；<br>③ 每个 overlay 块把全部 chunk 重新 join；<br>④ `applyEntries` 再全量转 turn；<br>⑤ `computeTimelineApplyPlan` 计算两次 root 身份；<br>⑥ `patchTurnItemsInPlace` 再 build 全部元素 | `conversationLensProjection.ts:102-139` · `conversationSessionView.ts:239-300` · `conversationTimelineApply.ts:125-154` · `conversationTimelineTree.ts:317-339, 455-490` |
| F5 | 同一次 flush 逐帧驱动多个消费者：<br>· `lastAttachedEntries`（Stop 读 `hasStreamingEntry`，待决查找与重新生成也读它）；<br>· 轨迹（HEAD 已按透镜门控）；<br>· `updateSyncChrome` → `renderInboxStatus`，一次画 queue / 待决 / sync / goal / stop 五个 chip；<br>· phase、composer、density。<br>对话透镜隐藏时，时间线照样 apply | `conversationLensProjection.ts:128-138, 146-166` · `conversationInboxOverlay.ts:165-179` · `conversationLensDock.ts:124` · `conversationLensSessionBinding.ts:194-204, 461` |
| F6 | 引擎或 UA 连接每次变化，都会 `bindSessionView` 重取 lease 并收到 baseline；同结构 baseline 走 A 类「重绘全部根」 | `conversationLens.ts:333-349` · `conversationTimelineApply.ts:139-146` |
| F7 | 同窗同会话还有第二个 lease（子代理目录 / live agent tree）；子代理浮层里还有第二个 lens 宿主 | `conversationSessionChatService.ts:95` · `conversationSubAgentOverlay.ts:204-210` · [D22](../progress/deferred-gaps.md) |
| F8 | overlay 不是追加式 chunk。`OverlayDeltaJoin` 把 delta 累加成整段文本，每个 delta 都发一次**全文**；`onOverlayActiveTurn` 把全文同时写进 chunk 与 `summary.title` / `preview`。所以 IPC、replica、投影每帧都是 O(文本长度)。overlay 块 id 就是 L3 `turn_id` | `node/overlayDeltaJoin.ts:114-134, 173-183` · `node/sessionCore/session-actor-overlay-fold.ts:93-160` |
| F9 | **疑似缺陷，无用例覆盖**。同一回合 `thinkingText` 与 `streamingText` 并存时，overlay 块带两个 chunk（`${turnId}:think:0` 与 `${turnId}:0`）。summary 为 text 或 tool 时，投影仍把全部 chunk `join('')`，流式回答或工具行会带上思考正文 | `session-actor-overlay-fold.ts:105-148` · `conversationSessionView.ts:275` · `overlayDeltaJoin.ts:126-131`；投影用例只有单 chunk（`conversationSessionView.test.ts:159`） |
| F10 | **交接顺序**：<br>· 引擎合同 INV-H1-L2：成功回合先落 L2 助手继任 batch，再放出 `TurnLifecycle.Completed`。线路上允许 Completed 先到，Singularity 在 bridge 按 `(agentId, turnId)` 重排。<br>· 本仓 overlay 只在 `overlayActiveTurnClear` 时移除（由 `turn_completed`、新 turn、runtime epoch 前进、终态回收、会话关闭或清除、快照无 active turn 等触发），与 L2 落盘没有关联。<br>· 后果：常态（L2 先到）两行并存，直到 Completed 到达；Completed 先到时消息先消失再出现。<br>前置方案 §3.3「L2 落盘后 session-core 移除 overlay 块」与代码不符 | `UniverseAgent/docs/systems/message/l2-l3-cross-bus-ordering.md` §3.1 / §4 · `overlayDeltaJoin.ts:153-171` · `session-actor-overlay-fold.ts:96-101, 162-167, 194-199, 214-218` · `session-actor-stream-fold.ts:380-386, 710-715` · `sessionStreamDemux.ts:795-798` |
| F11 | **ViewEffect 在渲染端没有消费者**。唯一的 kind 是 `send_failed`：本地待发失败时，session-core 把该行从 `localPendingSends` 移除，并向该会话**所有** lease 广播这个 effect。合并器把它送进 `applySessionViewTimeline`，时间线返回 `none`。用户看到的是「发送中」的消息无声消失 | `node/sessionCore/session-actor-chat-outbox.ts:4, 191-218` · `conversationTimelineApply.ts:130-132` |
| F12 | `scrollToFirstPendingConfirmation` 直接调 `scrollIntoView({ behavior: 'smooth' })`，调用方有三个：Dock「跳到待确认」、reveal 服务、焦点贡献 | `conversationPendingSeat.ts:55-68` · `conversationTimelineRevealService.ts:73-81` · `conversationInboxOverlay.ts:129` · `conversationOpenPendingOnFocus.contribution.ts:47` |
| F13 | 已有的可见性信号：<br>· 隐藏的 leaf 窗口在 `bindHiddenLeafLease` 中释放 lease，收不到帧；<br>· Part 不可见时 `layout` 直接返回；<br>· lens 切透镜时调 `timelineTree.hide()` / `show()` | `conversationEditorPane.ts:190-209` · `conversationPart.ts:140-142` · `conversationLensProjection.ts:206-218` |
| F14 | demux 从 L2 envelope 读取 `turn_id`，写入 `TimelineItemView.turnId` | `sessionStreamDemux.ts:167-169` |

### 1.2 渲染与高度

| # | 事实 | 位置 |
|---|------|------|
| R1 | 削顶根因属实：`.monaco-tl-row { display:flex; height:100%; align-items:center }`，`.monaco-tl-contents { height:100%; overflow:hidden }`；角色头 `overflow:hidden` 且没有 `line-height` | `base/browser/ui/tree/media/tree.css:6-12, 46-48, 62-65` · `conversationLens.css` `.conversation-lens-turn-header`（:1762-1775） |
| R2 | 折叠高度根因：`scheduleHeightUpdate` 只在渲染后和显式开合时，用一次 rAF 测 `.monaco-tl-contents`（100% 高）的 `max(offsetHeight, scrollHeight)`；收起时读到的是旧行高，内容异步变高也不再观察 | `conversationTimelineRenderer.ts:541-559` |
| R3 | 树内本可修：上游 chat 用的是同一种 `WorkbenchObjectTree`，每行挂 `DisposableResizeObserver`，经 `onDidChangeItemHeight` 调 `updateElementHeight`。离开树的理由是效果与简化（§2 D1），不是「树修不好」 | `contrib/chat/browser/widget/chatListRenderer.ts:1196-1212` · `chatListWidget.ts:525-527, 1022-1031` |
| R4 | 每次 rerender 都整行 `clearNode` 重建，包括 `markdownRendererService.render(全文)`。流式行每帧整块重渲染，行内选区、焦点、过程折内滚位置随之丢失 | `conversationTimelineRenderer.ts:145-147, 364` · `conversationTurnContentAdapter.ts:64-85` · `conversationProcessFold.ts:98-148` |
| R5 | 所有 assistant 行（含流式 overlay 行）都走 Markdown，与前置方案 §3.4「streaming 期间纯文本」不一致。基础渲染器已有 `fillInIncompleteTokens` 选项 | `conversationTurnMarkdown.ts:9-11` · `base/browser/markdownRenderer.ts:42, 229-237` |
| R6 | 每个已渲染正文各订 `onDidChangeCatalog` 与 `onDidChangeSession`：树里只有可见行这样做，文档流里会变成全部行。已装饰的锚点会直接返回，没有 hover 泄漏 | `conversationTurnContentAdapter.ts:79-81` · `conversationSessionPill.ts:45-47` |
| R7 | `refreshPresentation()` 不带参数时，所有 turn 都进 changedIds。调用点三处：配置变更、引擎连接、UA 连接 | `conversationTimelineTree.ts:492-529` · `conversationLens.ts:301, 339, 348` |
| R8 | 过程折收起时用 `hidden`，但子项不论是否展开都会全部渲染 | `conversationProcessFold.ts:98-131` |
| R9 | Mermaid 卡片：<br>· 内嵌 `WebviewElement.mountTo`，iframe 被移动或摘除就会重载；<br>· 滚轮委托写的是 `.conversation-lens-timeline-scroll`，它不是滚动容器，疑似无效；<br>· Mermaid 解析完成后，lens 用一次 baseline 强制重绘 | `conversationMermaidHost.ts:78-89` · `conversationTimelineRenderer.ts:253-258` · `conversationLens.css` `.conversation-lens-timeline-scroll`（:630-636） · `conversationLens.ts:147-162` |
| R10 | 时间线只用 `DiffEditorPool`，没有代码块编辑器池，也没有「运行 / 插入」工具栏 | `conversationTimelineRenderer.ts:20` · `conversationTurnContentAdapter.ts:64-85` |
| R11 | 每次 flush 调 `applyConversationDensity`，对整个时间线 `querySelectorAll('[data-process-fold]')` 并逐个挂类。密度样式本来就用祖先选择器，这个循环是多余的 | `conversationLensReadingColumn.ts:302-316` · `conversationLens.css` `.density-compact …`（:3676 起） |
| R12 | reviewNav 变化走同步直调，绕过合并器（`sidecarOnly`）；`requestDetail` 回填正文时不发帧 | `conversationLens.ts:274-276` · `conversationLensProjection.ts:119-126` · `conversationEngineFrameSource.ts:210-221` |

### 1.3 滚动、置顶与无障碍

| # | 事实 | 位置 |
|---|------|------|
| S1 | 本仓的锁语义：<br>· 初值 true；<br>· 滚动事件只要不在底部就解锁；<br>· 只有滚底按钮上锁；<br>· 帧驱动更新在「在底部或上锁」时滚底，异步变高只在「上锁且无 Hold」时滚底。<br>上游 chat 与此不同：滚动从不解锁，按钮与提交（autoScroll 模式）时上锁，帧驱动只看是否在底部 | `conversationTimelineTree.ts:103, 265-290, 754-764` · `chatListWidget.ts:626-628, 657-660, 1154-1164` · `chatWidget.ts:3209` |
| S2 | 底垫条件是恒真式：`atBottom = 在底 ∨ 锁`，`showButton = ¬在底`，CSS 任一类命中就加 36px，实际等于常量 | `conversationTimelineScroll.ts:48-53` · `conversationLens.css` `.conversation-timeline-at-bottom …`（:828-832） |
| S3 | 置顶气泡可见时，给树加 `padding-top: 36px`，造成布局位移 | `conversationLens.css` `:has(.conversation-timeline-pinned-user--visible)`（:651-653） |
| S4 | `getFocusedTurn()` 读树焦点，供无障碍视图的 `getAccessibleTurnContent` / `focusAccessibleTurn` 使用。树提供 `role=tree`、逐行 aria-label、方向键与 type-to-navigate | `conversationLens.ts:432-444` · `conversationTimelineTree.ts:228-243` |
| S5 | `domNode` 构造时设 `role="log"`，随后被阅读列覆盖为 `role="tabpanel"` | `conversationTimelineTree.ts:121` · `conversationLensReadingColumn.ts:99-101` |
| S6 | `DomScrollableElement` 不监听原生 `scroll`，只在 `scanDomNode()` 时回读，所以浏览器自己发起的滚动会让它失步。本 lens 已有原生细滚动条主题的先例 | `base/browser/ui/scrollbar/scrollableElement.ts:714-760` · `conversationLens.css:2849-2850` |

### 1.4 对标（外仓只读，2026-09-28 核对；路径见 §10）

| 仓 | 列表 | 订阅 / 状态 | 跟随 | 本稿采用 |
|----|------|-------------|------|----------|
| UniverseAgentDesktop | `@tanstack/solid-virtual` 虚拟列表 | 主进程 `ViewReplicationPump`：每 lease 至多一帧在途，按 patch 键 last-wins 合并，effects 永不合并；渲染端每帧整表重算 | 50px 阈值；上滑时锁存「手动离开」，回到底部清除 | effects 独立通道；回到底部恢复跟随 |
| Singularity | `LazyColumn` + 稳定 key | L2 / L3 分离；bridge `GenerationDisplayHandoffOrdering` 按 `(agentId, turnId)` 保证 L2 batch 先于 Completed | 只在末项身份或流式签名变化时跟随；展开收起、inset 变化不跟随；发送与按钮时跟随 | 宿主侧 H1 交接；开合不被贴底拽走；发送时上锁 |
| DeepSeek harness | 纯文档流，历史分页 `loadOlder` | 每节点一个 seat 独立 selector；增量 Markdown 按解析器位置冻结，末尾 2 块不冻结 | RO 驱动；`observedTopRef` 区分程序写入与读者滚动 | 文档流、按根更新、块冻结、程序写入台账 |
| ZCode v4 | `@tanstack/react-virtual` 绝对定位历史 + 文档流活尾 | seq 严格的投影 store | 在 scroll 之前捕获 wheel / touch / 键盘意图 | —（本稿改用写入台账，见 §3.8） |

四家都没有用「占位块脱水」，也都没有用 `0fr↔1fr` 网格做思考 / 工具折叠。

## 2. 决策（实施方拍定，2026-09-28）

| # | 决策 | 理由 |
|---|------|------|
| D1 | **宿主换成原生文档流**，删除 `WorkbenchObjectTree` 路径 | 高度由排版引擎决定，流式贴底不再滞后一帧；嵌套滚动口与粘性面包屑不再需要测高；支持跨消息选区。性能由 D8 兜住。推翻 lens-assembly `:47`，accept 时须用户明确签收并建 ADR |
| D2 | **流式正文按 marked 词法块冻结**（§3.5），尾部用 `fillInIncompleteTokens` 渲染；L2 落盘后完整渲染一次定稿 | 保留 HEAD 流式 Markdown 的观感，每帧成本从 O(全文) 降到 O(未冻结部分)。改写前置方案 §3.4「streaming 期间纯文本」 |
| D3 | **置顶气泡改为覆盖式**，不再推动内容；滚动口设 `scroll-padding-top` | 原生滚动下，布局位移会引发锚定调整，锚定调整触发滚动事件，滚动改变可见区，可见区又让气泡切换，形成振荡 |
| D4 | **非程序写入的滚动落在底部时，恢复跟随**；滚底按钮照旧上锁 | 与 Desktop / Singularity 做法一致。顺带修掉 HEAD 的一个问题：手动回到底部后，图片或 Mermaid 晚到变高不会跟随 |
| D5 | **交接由宿主按 turn 关联排序**（§3.6）：<br>· L2 助手继任 envelope 到达时，紧随其后清除同一 turn 的 overlay；<br>· Completed 先到时先挂起清除，等匹配的 L2、下一个 TurnStart 或超时再清；<br>· 其他移除路径照旧立即清除 | 常态下（L2 先到）消除两行并存，Completed 先到时消除闪空。这是宿主（vscode 自有 `overlayDeltaJoin.ts`）按协议 id 排序，与 Singularity bridge 同法，UI 不做推断。改写前置方案 §3.3「接受一次卸行 + 挂行」 |
| D6 | **滚动口用原生 `overflow-y: auto`**，配主题细滚动条 | 保留浏览器的滚动锚定、原生键盘滚动与选区滚动。`DomScrollableElement` 不回读原生滚动（S6），`overflow: hidden` 容器是否参与锚定也未经验证 |
| D7 | **过程折外层开合做高度动画**：纯 CSS，只挂在 `.monaco-workbench.monaco-enable-motion` 下，并限定在流容器内；执行中的折叠不做动画 | `.monaco-enable-motion` 由无障碍服务按 `workbench.reduceMotion` 切换（`accessibilityService.ts:87`），所以不再叠加 `prefers-reduced-motion`，以免压过用户设置。chevron 仍沿用 `.ua-motion`，本次不统一 |
| D8 | **长会话**：`content-visibility: auto` + 历史窗口化（只增不减，未决座位强制在窗）+ DiffEditor / webview 存活上限；不做冷块脱水 | 离屏不排版、不绘制；首屏只渲染末尾一段；重资源有上限；座位永远在 DOM 中（lens-assembly `:81`） |
| D9 | **发送失败如实提示，并回填文本**。触发条件：本 lease 上一快照里有待发项、本帧被移除，且收到 `send_failed`。提示显示在该 lease 的 dock 失败提示位（`showPostFailure`，Inbox 只是转发）。未发文本回填输入框：输入框为空时直接填入，非空时追加到草稿末尾 | 修 F11。待发项只在发起它的 lease 可见，所以子代理浮层等其他 lease 不会重复提示。现有 `'failed'` 文案「Retry failed — could not post. Try again.」不适用于已受理后失败的情况，改用新文案 |
| D10 | **overlay chunk 分类**：<br>· summary 为 reasoning 时只拼 `:think:` chunk；<br>· 其余情况正文只拼非 `:think:` chunk，思考 chunk 在同一根内渲染为收起的思考段（复用思考节点渲染）。<br>node 测钉住 vendored chunkId 格式；登记上游缺口 G-TL-2（chunk 应自带类别） | 修 F9，而且不拆根、不派生 id；流式期间思考内容仍可展开查看。改写前置方案 §3.3「chunks 按 orderKey 拼接」为「同类 chunk 按 orderKey 拼接」 |
| D11 | **reveal 命中收起的过程折子项时，先展开外层（及所在 thinking 组）再定位** | 子项改为懒渲染后，reveal 必须能找到目标；从轨迹跳转过来时直接看到那一步 |
| D12 | **跟随中用户展开或收起非末尾根时，解除跟随**，保持被点 header 的位置；末尾根照常贴底 | 对照 Singularity「展开收起不跟随」；HEAD 此时会把视图拽到底部 |
| D13 | **发送时上锁并贴底**：`post()` 受理后 `following = true` | 上游 chat（`chatWidget.ts:3209`）与 Singularity（发送时跟随）同做法；HEAD 在上滑状态下发送后不跟随新回答 |

## 3. 设计

### 3.1 数据流

```text
lease（replica，逐帧，不看可见性）
  │ onDidApplyFrame
  ▼
ConversationTimelineFrameScheduler（每 lease 一个，挂在 lens 绑定上）
  · patches：并集 changedIds；baseline：置 rebuild
  · reviewNav / 链接目录 / requestDetail 回填：置 sidecar 脏
  · 排帧：rAF 与 16ms 兜底定时器，先到先执行（无 vsync 的测试进程、后台窗口也会推进）
  · effects：独立 FIFO，在同一次 flush 里交付
  │ flush（每帧至多一次；可见性不影响 flush 本身）
  ▼
带缓存的投影 → entries → lastAttachedEntries（每帧）
  ├─ ConversationTimelineHost.applyEntries：可见时做 DOM 协调；不可见时只记下最新 entries，show() 时同步协调
  ├─ 轨迹：仅轨迹透镜可见时（与 HEAD 相同）
  ├─ sync chrome / Inbox / phase / composer / density：每帧照旧调用（density 去掉逐折叠循环）
  └─ effects 消费者（D9）
```

### 3.2 订阅与调度

| 项 | 选定 |
|----|------|
| 调度器 | `ConversationTimelineFrameScheduler` 取代 `ConversationSessionViewFrameCoalescer`：<br>· `runAtThisOrScheduleAtNextAnimationFrame` 与 16ms `setTimeout` 谁先到谁执行，执行后取消另一个；<br>· 构造参数可注入排帧函数（测试用同步帧或假帧）；<br>· 输出为单一回调 `onFlush({ applied?: ConversationViewFrameApplied; sidecar: boolean; effects: readonly ViewEffect[] })`，测试观察这一批；<br>· `normalizeSessionViewChangedIds`、`normalizeSessionViewFrameApplied`、`mergeSessionViewFrames` 作为纯函数迁入新文件 |
| baseline | 不再同步直冲，也不再清空待交付的 effects；同一帧内多次 baseline 合并为一次 |
| 可见性 | 宿主 `setVisible(false)` 只暂停 DOM 协调；`show()` / `setVisible(true)` 同步协调到最新 entries（待决座位切回对话透镜后会立刻查 DOM，F12）。信号来源：lens 切透镜（`updateReadingColumn`）、Part 可见性（`IWorkbenchLayoutService.isVisible(Parts.CONVERSATION_PART)` 及其变化事件）、子代理浮层自身显隐。隐藏的 leaf 窗口已经释放 lease（F13），无需另做处理 |
| 其他消费者 | 与 HEAD 一样每次 flush 都调用：`lastAttachedEntries`、`updateSyncChrome`（含 Inbox 五个 chip）、phase、composer、density。它们在输入不变时开销很小；density 去掉逐折叠循环（R11） |
| reviewNav | `reviewNavService.onDidChange` 改为向调度器置 sidecar 脏，下一帧随投影一起处理；删除 `sidecarOnly` 与 `computeReviewNavSidecarApplied` |
| requestDetail | lease 回填正文后，向调度器置 sidecar 脏，让 visualization 等依赖 detail 的根及时更新（R12） |
| Mermaid | `scheduleConversationMermaidExtensionResolve` 只调 `setMermaidExtensionInfo`，由宿主重建 visualization 根；删除强制 baseline（R9） |
| effects 消费者 | 在 lens 绑定里处理（D9）：<br>1. 比较上一快照与本帧的 `localPendingSends`，得出被移除的待发项；<br>2. 仅当本 lease 有被移除项、且收到 `send_failed` 时提示，同一 effectId 只提示一次；<br>3. 文本优先用 composer 在 `post()` 受理时记下的全文（按受理 correlation 对应，实施时核对 correlation id 与 `operationId` 的关系），没有记录时退回 summary 预览；<br>4. 其他 kind 只写日志。<br>`send_failed` 字面量在 `common/conversationViewFrame.ts` 中声明，由 `platform/universeAgent/test/node/conversationViewFrameSendFailed.test.ts` 钉住与 vendored 常量相等（node 测导入 sessionCore 有先例 `sessionViewHostFanout.test.ts`） |

### 3.3 投影缓存与变化判定

变化判定只看输入，不看 changedIds。所以即便 changedIds 是空集的畸形帧，也不会留下陈旧 DOM。

| 项 | 选定 |
|----|------|
| entry 缓存 | `projectSnapshotToEntries` 增加可选 `cache` 参数，不传时行为与 HEAD 完全相同。缓存键覆盖 `timelineItemToEntry` 读取的全部输入（`conversationSessionView.ts:335-434`）：<br>· `item`；<br>· `attribution.get(id)`；<br>· visualize 时的 `details.get(item.detail)`；<br>· permission 时的 `pendingIds.has(id)`；<br>· question 时算出的 `resolveQuestionRequestId(id, pendingIds)`（`:311-322, 414`）；<br>· assistant 文本时的链接目录版本。<br>键全部不变就复用上次的 entry 对象 |
| 链接目录版本 | 新增计数器，在两种情况下加一并向调度器置 sidecar 脏：`sessionChatService.onDidChangeCatalog`（`conversationSessionChatService.ts:45-46`）、roster 会话变化。已完成行的链接改写因此随目录更新；HEAD 要等下一帧到来才更新 |
| 结构相等兜底 | 身份不同时逐字段比较：先比引用再比值，字符串先比长度；`metadata` 按键浅比较，嵌套对象只在引用不同时才比较值。内容相同就复用旧对象，所以同内容 baseline 的 DOM 工作为零 |
| 排序 | `snapshot.timeline` 数组身份不变时，复用上次的排序结果 |
| overlay | 每块按 `chunks` 身份缓存拼接结果，拼接按 D10 分类 |
| reviewNav | 导航条目按 `(turnId, paths)` 缓存；`attachReviewEntries` 无变化时返回原数组 |
| turn 与 root | `entryToRenderableTurn` 按 entry 身份复用 turn。span 不复用对象，因为它的 `startIndex` / `endIndex` 会随前方根的变化而失效；过程折根是否变化，按 `turnIds` 序列与各 turn 身份判定 |
| 协调纯函数 | `computeTimelineReconcile(prevRoots, nextRoots)` 返回 `{ mode: 'none' \| 'content' \| 'structure'; removed; changed; order }`：<br>· A/B/C 语义与前置 §3.4 一致；<br>· 取代 `computeTimelineApplyPlan`，`conversationReviewEntry.ts:199` 同刀改用新函数；<br>· `buildTimelineRootIdentities` 迁入协调模块 |

流式帧的投影成本为 n 次指针比较，加上流式块本身的 O(文本长度)。后者由 F8 决定：IPC 本身就是全文，渲染端无法更低；登记为上游缺口 G-TL-1。

### 3.4 宿主 `ConversationTimelineHost`

| 项 | 选定 |
|----|------|
| 门面 | 与 `ConversationTimelineTree` 相同的公开方法：`applyEntries` / `setTurns` / `revealTurn` / `focusRecord` / `getFocusedTurn` / `getTurnEditHost` / `setEditingTurnId` / `refreshPresentation` / `setMermaidExtensionInfo` / `layout` / `show` / `hide` / `acquireAutoScrollHold` / `isAutoScrollHeld` / `scrollLock` / `setScrollLock` / `scrollToEnd` / `refreshScrollChrome` / `isScrolledToBottom` / `getConfirmationElement` / `getTimelineRowElement` / `getTestApplyMetrics` / `resetTestApplyMetrics` / `domNode`。另加 `setVisible` 与测试钩子 `getTestExpandedState()`。lens 各文件只改类型名 |
| DOM | `domNode`（保留 `.conversation-lens-timeline`，阅读列照旧设 `tabpanel`）> `.conversation-timeline-viewport`（滚动口）> `.conversation-timeline-stream[role=feed]` > 每根一个 `article.conversation-timeline-item[data-root-id][data-kind]`。<br>根上用 `data-root-id`；行内保留 HEAD 的 `data-turn-id` / `data-fold-id`，避免与过程折内 thinking 的 `data-turn-id` 冲突。<br>置顶气泡与滚底按钮是 `domNode` 下与滚动口并列的覆盖层。空态沿用 `No messages yet` |
| 排版 | 流容器是 block 流，根之间用 `margin-bottom`；阅读列 `max-width: 720px` 居中；底垫为常量 `padding-bottom: 36px`（S2）；根节点 `user-select: text` |
| 协调 | 按 id 键控：新根插入，消失的根移除；已有节点只在顺序真正改变时才移动（含 iframe 的节点移动会重载 webview，R9）。`article` 在内容更新中保持同一引用，`getTimelineRowElement` 经 Map 返回它。<br>指标：`setChildrenCount` 为发生过根级插入 / 删除 / 移动的 `applyEntries` 次数；`rerenderCount` 为已有根被更新的次数（新插入的根不计） |
| 按根更新 | `ConversationTimelineItemHost.update(root)`：普通根在 `article` 内重建内容，复用现有渲染函数；过程折根与流式根走增量（§3.5 / §3.7）。重建前若焦点在该根内，重建后把焦点放回该 `article`；焦点用 `getActiveElement()` 读取 |
| 展示开关 | 渲染时记录根是否读取了 `writesEnabled` / `showLiveChrome` / `showToolInvocationDetails`（过程折根的 aria-label 读 `showLiveChrome`，也算在内）；`refreshPresentation()` 只重建这些根。座位在渲染时读 `writesEnabled`，所以仍会重建，question 草稿随之丢失，与 HEAD 相同 |
| 其他显式刷新 | `setEditingTurnId` 只重建新旧两个根，D27 顺序不变（`provideTurnEditComposer` 先于 `setEditingTurnId`）。`setMermaidExtensionInfo` 只重建 visualization 根 |
| 链接装饰 | 宿主持有唯一一份 `onDidChangeCatalog` / `onDidChangeSession` 订阅；事件到达时**同步**重装饰含 `conversation-chat:` 链接的已渲染根（`conversationTimelineSessionPills.test.ts:419-439` 依赖同步） |
| `content-visibility` | 根默认 `content-visibility: auto; contain-intrinsic-block-size: auto 120px`。以下根改为 `visible`：流式根、编辑中的根、含未决座位的根、`:focus-within` 的根、末尾 3 个根 |
| 窗口化 | 打开会话时，窗口起点取「末尾 60 根的起点」与「最早含未决座位的根」两者中更早的一个，座位因此永远在 DOM 中。流顶哨兵进入视口上方 1.5 屏范围时，向前补 40 根，每帧至多一批。窗口起点按根 id 记录，历史被删除或 compact 时按 id 重新定位；窗口只增不减。`revealTurn` / `focusRecord` 命中未渲染的根时，分帧补到该根再定位。`aria-setsize` 取模型总数 |
| 待决座位定位 | `scrollToFirstPendingConfirmation`（F12）改为调用宿主 `revealTurn(id, 'nearest')`：经滚动写入口，并按 §3.8 解锁 |
| 重资源预算 | `ConversationTimelineResourceBudget`：展开的 diff 块与 Mermaid webview 在接近视口（上下各 1 屏）时才创建；远离时释放（DiffEditor 归还池，webview 销毁）并留同高占位。存活上限初值 DiffEditor 6、webview 4，超出时按最久未接近者先释放 |
| 滚动口 | 原生 `overflow-y: auto; overflow-anchor: auto; scrollbar-width: thin; scrollbar-color: var(--vscode-scrollbarSlider-background) transparent; scrollbar-gutter: stable; scroll-padding-top: 44px` |
| 观察器 | ResizeObserver（流容器与滚动口）和 IntersectionObserver（窗口哨兵与资源预算）经宿主选项里的工厂创建，测试可注入假实现 |
| 布局 | `layout(height, width)` 只做两件事：reveal 恢复、通知嵌入的 DiffEditor 宽度变化。尺寸为 0 时不报错、不清状态 |

### 3.5 流式正文：marked 词法块冻结

`IConversationTurnContentAdapter` 增加可选方法 `renderStreamingBody(turn, container)`，返回 `{ update(text): void; dispose(): void }`，由 `ConversationStreamingMarkdown` 实现：

| 步 | 规则 |
|----|------|
| 前缀快路径 | 新文本以已处理文本为前缀时，只处理新增部分；否则（例如链接改写改动了前文）清空重来 |
| 词法 | 只对冻结偏移之后的后缀调用 `marked.lexer`，得到顶层块 token |
| 冻结 | 除最后 2 个顶层 token 外，其余 token 按 `raw` 渲染一次，然后把冻结偏移前移到最后一个冻结 token 之后。末尾 2 块不冻结，用来吸收「看似结束、实则继续」的列表和段落（与 DeepSeek 相同）。渲染出的子节点直接并入正文容器，不另包一层，外边距节奏与定稿一致。链接装饰在冻结时做一次 |
| 尾块 | 最后 2 个 token 每帧至多重渲染一次，带 `fillInIncompleteTokens: true`，未闭合的代码围栏直接画成代码块 |
| 思考段 | D10 的同根思考 chunk 用纯文本前缀追加，默认收起 |
| 光标 | 流式根正文末尾显示插入符（CSS 伪元素），只在 `.monaco-enable-motion` 下闪烁 |
| 定稿 | L2 行是新根，用 `renderTurnBody` 完整渲染一次。引用式链接、脚注等跨块结构在增量阶段可能不准，在这里纠正 |

每帧成本为 O(未冻结部分)。例外：仍在增长的超长列表或表格属于同一个顶层 token，这时尾部等于该 token 的长度（§8）。思考正文与工具流式文本本来就是纯文本，按前缀快路径 `appendData`。

### 3.6 overlay → L2 交接（D5，宿主侧）

在 vscode 自有的 `platform/universeAgent/node/overlayDeltaJoin.ts` 中实现，按 L3 `turn_id` 与 L2 envelope `turn_id`（F14）关联，对齐 Singularity `GenerationDisplayHandoffOrdering`：

| 到达顺序 | 行为 |
|----------|------|
| L2 助手继任 envelope 先到（常态） | 照常投递该 L2 arm，紧接着对同一 turn 发出 `overlayActiveTurnClear`。两条 patch 在相邻帧内到达渲染端，调度器通常把它们合并进同一次 flush |
| `turn_completed` 先到 | 先挂起清除，等待以下任一事件：匹配 turn 的 L2 助手 envelope（到达后按上一行处理）、下一个 `turn_started`（取消 / 出错恢复）、2s 超时（兜底照发并计数） |
| runtime epoch 前进、终态回收、会话关闭或清除、快照无 active turn（F10） | 不经挂起，照旧立即清除 |

渲染端不做「同一条」推断，也不需要幽灵行：它看到的始终是「L2 行出现，随后 overlay 行移除」，两步通常在同一帧完成。跟随中照常贴底；离开底部时，由原生锚定保持阅读位置。如果实测发现 L2 与 L3 的 `turn_id` 不同源，退回 HEAD 行为（接受一次卸行加挂行），并登记缺口（§8）。

### 3.7 过程折

| 项 | 选定 |
|----|------|
| 增量更新 | `renderProcessFoldSpan` 改为返回可更新句柄：<br>· 外层 header 摘要原地更新；<br>· 子项按 turn id 键控：新增的追加，变化的只重建该子项，消失的移除；<br>· 320px 内滚口与粘性面包屑元素不重建，`scrollTop` 自然保留 |
| 懒渲染 | 子项在首次展开时才渲染（HEAD 收起时也全量渲染，R8）；reveal 命中子项时先展开（D11） |
| 流式思考 | 思考正文按纯文本前缀追加；执行中的 `--executing` 样式（160px）不变 |
| 开合动画（D7） | 流容器设 `interpolate-size: allow-keywords`。在 `.monaco-workbench.monaco-enable-motion .conversation-timeline-stream` 下，`.conversation-process-fold-children` 过渡 `height 160ms` 与 `display 160ms allow-discrete`，配 `@starting-style` 从 0 开始。执行中的折叠不做过渡；轨迹里的折叠（`conversationLens.css:1038-1045`）不受影响 |
| 展开态 | userBubble / processFold / visualize 的展开 Map 沿用，按 id 修剪，与 HEAD 相同。span id 变化（含交接时首项从 overlay 变为 L2）仍按前置 §3.4 C 类重置为默认态 |

### 3.8 滚动跟随 `ConversationTimelineFollowController`

| 项 | 选定 |
|----|------|
| 状态 | `following`（即 `_scrollLock`，初值 true）；`holds` 沿用 `ConversationAutoScrollHolds` 引用计数 |
| 写入台账 | 所有程序写入（贴底、reveal、锚点补偿、Mermaid 滚轮 `scrollBy`）只经 controller，并记下写入后的 `scrollTop`。`focus()` 一律带 `preventScroll: true`，再由 controller 按 `block: 'nearest'` 定位 |
| 解锁与恢复 | 若 scroll 事件的 `scrollTop` 与台账最近一次写入值相差 1px 以内，视为自身写入，不改锁。<br>其余滚动事件（滚轮、键盘、滚动条、触摸、Tab 聚焦、选区拖动、读屏器等）：<br>· 不在底部 → `following = false`（HEAD 语义）；<br>· 落在底部 2px 内 → `following = true`（D4）。平滑滚动的最后一次事件落在底部时即恢复。<br>其他改锁操作：<br>· 点滚底按钮 → `following = true` 并贴底；<br>· `post()` 受理 → `following = true` 并贴底（D13）；<br>· `revealTurn` / `focusRecord` 定位后不在底部 → `following = false`（与 HEAD 相同） |
| 帧驱动贴底 | 在 `applyEntries` 末尾同步完成，语义同 HEAD 的 `withPersistedAutoScroll`：Hold 时跳过；否则若 `lastKnownAtBottom \|\| following`，写入 `scrollTop = scrollHeight`。只读一次布局，读写不交错 |
| 异步变高贴底 | ResizeObserver 观察流容器与滚动口（输入框长高导致视口变矮也会触发）；回调里若 `following && !held` 就贴底，条件在回调时判断，不缓存 |
| 用户开合（D12） | 适用于过程折、气泡 Show more、diff、visualize 的切换：<br>· 切换的是非末尾根且当前在跟随 → 先 `following = false`，再以被点 header 为锚补偿位置；<br>· 切换的是末尾根 → 照常贴底 |
| 置顶判定 | 在 scroll 事件里（rAF 节流），用 `getWindow(viewport).document.elementFromPoint` 在视口上、下边缘各命中一次（避开气泡区域），得到首尾可见根的模型下标，再调用 HEAD 纯函数 `resolvePinnedUserPromptState`；RO 回调后同样刷新 |
| 置顶气泡（D3） | 覆盖在滚动口顶部，带不透明背景与下沿渐隐；点击调用 `revealTurn`，复制按钮调用 `onCopyTurn`（与 HEAD 相同） |

### 3.9 无障碍与键盘

| 项 | 选定 |
|----|------|
| 语义 | 流容器 `role=feed`。每根 `article` 带 `aria-posinset` / `aria-setsize`，`aria-label` 与 HEAD `getAriaLabel` 同文；流式根 `aria-busy=true`。流容器不设 `aria-live`，否则会逐 token 播报 |
| 键盘 | roving tabindex。焦点在 `article` 上时：<br>· ArrowUp / ArrowDown、PageUp / PageDown 在根之间移动；<br>· Home / End 到首尾；<br>· Enter 进入根内第一个可聚焦元素，Escape 回到 `article`。<br>焦点在根内控件上时，不拦截方向键 |
| 焦点框 | 键盘聚焦 `article:focus-visible` 时显示焦点框；鼠标聚焦（`:focus:not(:focus-visible)`）不显示，延续 HEAD「点击不出现行焦点框」的约定 |
| 焦点 | `getFocusedTurn()` 取 `getActiveElement()` 所在 `article` 对应的 turn，过程折根取其首个 turn（与 HEAD 相同）；回退顺序不变，先 lastReveal，再末 turn |

### 3.10 与 HEAD 的有意差异

| 差异 | 原因 |
|------|------|
| 不再有树的 type-to-navigate | 文档流无对应组件 |
| 时间线不再受 `workbench.list.smoothScrolling`、`mouseWheelScrollSensitivity`、`fastScrollSensitivity` 影响 | 原生滚动（D6） |
| 置顶气泡不再推动内容 | D3 |
| 手动滚回底部即恢复跟随；发送时上锁 | D4 / D13 |
| 跟随中展开或收起非末尾根会解除跟随，header 不跳 | D12 |
| reveal 到收起的过程折子项时自动展开 | D11 |
| 交接时不再两行并存或先消失再出现 | D5 |
| 发送失败有如实提示，并回填未发文本 | D9（HEAD 静默） |
| 流式回答不再带出思考正文；思考段在同根内可展开 | D10 |
| 同内容 baseline 与展示开关刷新，只动需要动的根 | §3.3 / §3.4；用例点名见 §6 |
| 待决座位定位会扩窗，并解除跟随 | §3.4 |
| Mermaid 滚轮委托真正生效；Mermaid 解析完成不再触发整帧 baseline | R9 |

## 4. 代码落点

| 动作 | 文件 |
|------|------|
| 新增 | `browser/conversationTimelineHost.ts` · `conversationTimelineItemHost.ts` · `conversationTimelineReconcile.ts`（`computeTimelineReconcile`、`buildTimelineRootIdentities`、结构相等）· `conversationTimelineFollow.ts` · `conversationTimelineScheduler.ts`（含迁入的三个纯函数）· `conversationStreamingMarkdown.ts` · `conversationTimelineResourceBudget.ts` · `media/conversationTimeline.css` · `platform/universeAgent/test/node/conversationViewFrameSendFailed.test.ts` |
| 修改：宿主与订阅 | `platform/universeAgent/node/overlayDeltaJoin.ts`：D5 交接顺序<br>`conversationSessionView.ts`：投影缓存参数、D10 分类<br>`conversationReviewEntry.ts`：导航条目缓存；删除 `computeReviewNavSidecarApplied`；改用新协调函数<br>`conversationEngineFrameSource.ts`：`normalizeSessionViewFrameApplied` 改从调度器文件导入（`:27, 254`）；`requestDetail` 回填后通知置脏<br>`conversationLensSessionBinding.ts`：调度器、effects 消费者；保留 `host: host.slotHosts.timeline` 字面量（CSS 扫描测 `:353` 钉住）<br>`conversationLensProjection.ts`：投影缓存、宿主可见性<br>`conversationSessionChatService.ts` / roster：链接目录版本事件<br>`platform/universeAgent/common/conversationViewFrame.ts`：`send_failed` 常量 |
| 修改：lens 与接线 | `conversationLens.ts`：类型名；删除 Mermaid 强制 baseline（`:147-162`）；reviewNav 改为置脏（`:274-276`）；`refreshPresentation` 调用点不变（`:301, 339, 348`）；接入 Part 可见性<br>`conversationLensReadingColumn.ts`：挂载宿主；density 删逐折叠循环<br>`conversationLensComposer.ts`：D13 受理后上锁；D9 记录受理文本<br>`conversationLensComposerChrome.ts`：类型名；D9 回填文本<br>`conversationLensDockStrings.ts`：D9 新文案<br>`conversationLensDock.ts`：`hasStreamingEntry` 依赖不变，核对即可<br>`conversationPendingSeat.ts`：改调 `revealTurn`<br>`conversationSubAgentOverlay.ts`：浮层显隐接宿主可见性<br>`conversationPinnedUserPrompt.ts:26`：`{@link}` 改指宿主 |
| 修改：渲染 | `conversationTurnContentAdapter.ts`：去掉每个正文各自的全局订阅；新增 `renderStreamingBody?`、`decorateLinks?`（均为可选）<br>`conversationProcessFold.ts`：可更新句柄、懒渲染<br>`conversationTimelineRenderer.ts`：只保留渲染辅助函数与字符串<br>`conversationTimelineScroll.ts`：`computeConversationScrollDownState` 只返回 `showButton`<br>`conversationTimelineTypes.ts`：选项去掉 `paddingBottom`，加观察器工厂<br>`conversationMermaidHost.ts` / `conversationVisualizeCard.ts`：接资源预算，滚轮经 controller<br>`media/conversationLens.css`：删除树相关规则 |
| 修改：测试夹具 | `test/browser/conversationLensLayoutHarness.ts:80-92, 190-201`：宿主类名与视口选择器 |
| 删除 | `conversationTimelineTree.ts` · `conversationSessionViewFrameCoalescer.ts` · `conversationTimelineApply.ts` · `ConversationTimelineDelegate` / `ConversationTimelineRenderer` / `ConversationTimelineProcessFoldRenderer` 与测高代码 |
| 不动 | vendored `node/sessionCore/**`、`common/sessionView/**`；宿主传输与 lease；轨迹透镜宿主；`src/vs/sessions`（无引用） |

## 5. 实施顺序（一个变更集）

在独立工位分支（[worktrees](../loop/worktrees.md)）上完成全部步骤并通过门禁，然后按规则 13 分两次提交合入 `agent-ide`：先提交方案，再提交实施。每步结束都跑 `npm run compile-client` 和该步相关的单测。第 4 步起 lens 切到新宿主，第 10 步删除树。

1. **原型验证**：宿主骨架（原生滚动口、block 流、`content-visibility`、同步贴底、RO 贴底、原生锚定）加上 PRD-020 的 1000 回合夹具（`conversationPrd020ScaleFixture.ts`）。在隔离 profile 里实测：贴底、上滑解锁、向上滚动时 `content-visibility` 首次渲染是否跳动。同时用[钉死引擎](../../docs/guides/debug-engine.md)录一段真实流，确认 L2 与 L3 的 `turn_id` 同源，以及 L2 与 Completed 的实际到达顺序。锚定不可靠时，在这一步改为手动锚点补偿，然后再继续。
2. **订阅层**：调度器、effects 消费者、reviewNav / Mermaid / requestDetail 改道、可见性接线、`overlayDeltaJoin.ts` 交接顺序。
3. **投影层**：投影缓存、链接目录版本、结构相等兜底、reviewNav 缓存、turn 复用、`computeTimelineReconcile`。F9 先写红测，再按 D10 分类。
4. **宿主**：DOM、键控协调、ItemHost、座位、reveal / focusRecord / 置顶 / 滚底按钮 / 空态、指标与测试钩子。lens 切到宿主，待决座位改道，迁移 A/B/C 用例。
5. **跟随**：controller、写入台账、同步贴底与 RO 贴底、D12 开合、D13 发送上锁。
6. **流式正文**：词法块冻结、同根思考段、适配器可选接口、链接装饰上提。
7. **过程折**：可更新句柄、懒渲染、D11 展开、内滚保留、开合动画。
8. **长会话**：窗口化（未决座位强制在窗）、资源预算。
9. **无障碍与键盘**。
10. **收口**：删除树、合并器、`conversationTimelineApply.ts` 与树相关 CSS，完成测试迁移。门禁：`npm run compile`、`npm run eslint`、`scripts/run-unit-custom.sh`（含 `scripts/check-test-baseline.sh` 差集比对）、`python3 scripts/check-docs-health.py`、`python3 scripts/generate-docs-status.py --check`、`python3 -m unittest scripts/tests/test_docs_status.py`。
11. **活窗验证与知识层回填**（§7、§9）。

## 6. 测试

**新增**

| 文件 | 覆盖 |
|------|------|
| `conversationTimelineScheduler.test.ts` | 同帧多个 patch 合并为一次 flush；同窗 `[patches, effects, baseline]` 交付为一批 `{ applied: baseline, effects }`；16ms 兜底在无帧时推进；sidecar 脏单独触发 flush |
| `conversationTimelineProjection.test.ts` | 性质测：随机 patch 序列下，带缓存与不带缓存的投影逐项相等。<br>未触及项保持同一对象。<br>以下变化使对应项失效：pending 移除（座位 entry，PRD-004）；question requestId 变化；attribution / detail 变化；链接目录版本变化。<br>D10 分类（含 tool 块带思考 chunk） |
| `conversationTimelineReconcile.test.ts` | 三种模式；按身份与结构判定 `changed`；过程折根按 `turnIds` 与 turn 身份判定；同内容 baseline 为 `none` |
| `conversationTimelineFollow.test.ts` | 自身写入不改锁；非自身滚动离底解锁、落底恢复；Hold；D12 开合；D13 发送上锁；reveal 解锁；RO 在回调时才判断条件 |
| `conversationStreamingMarkdown.test.ts` | 末尾 2 块不冻结；前缀快路径；非前缀时重来；未闭合围栏经 `fillInIncompleteTokens` 渲染为代码块；定稿后 DOM 文本与完整渲染一致；列表缩进续段、缩进代码块、`~~~` 围栏不被切开 |
| `conversationTimelineHost.test.ts` | DOM 身份（逐元素 `strictEqual`）；窗口化补批与 reveal 扩窗；未决座位强制在窗；`content-visibility` 例外类；aria 属性与键盘；焦点恢复；资源预算的挂载与释放（注入假 IntersectionObserver）；D11 展开；`setMermaidExtensionInfo` 只重建 visualization 根；`show()` 同步协调 |
| `overlayDeltaJoin.test.ts`（node，扩充） | L2 先到时紧随其后清除；Completed 先到时挂起，等匹配 L2 后清除；挂起期间收到下一个 `turn_started` 时清除；2s 超时清除并计数；epoch / 终态 / 关闭路径立即清除 |
| `test/node/conversationViewFrameSendFailed.test.ts` | 渲染端 `send_failed` 常量与 vendored `SEND_FAILED_EFFECT_KIND` 相等 |

**点名修改**（[health-gates](../progress/health-gates.md) 要求写明文件、旧断言、新期望）

`conversationTimelineApplyTree.test.ts`：

| 用例 / 位置 | 旧 | 新 |
|-------------|----|----|
| `type A — refreshPresentation (tool-details)` | `rerenderCount: 2` | `rerenderCount: 1`（`u1` 不读展示开关；`a1` 的重新生成 / 删除按钮读 `writesEnabled`） |
| `type A — same-structure setTurns baseline` | `rerenderCount: 2` | `rerenderCount: 1`（只有 `a1` 内容变化） |
| `type A — same-structure engine/mermaid baseline` | `rerenderCount: 2`，标题含 rerenders | `rerenderCount: 0`（内容相同）；标题改为「不更新任何根」 |
| `same-structure baseline that extends a process fold` | `rerenderCount: 2` | `rerenderCount: 1`（只有过程折根变化） |
| `structure-changing baseline still rebuilds the tree` | 标题与语义为「整树重建」 | 改名为键控协调；断言 `u1` / `a1` DOM 同引用；`setChildrenCount: 1` 不变 |
| DOM 复用断言（`:146-149, 196-199, 225-229, 240-243, 258-261`） | 数组整体 `deepStrictEqual`，证明不了同一引用 | 逐元素 `strictEqual` |
| 夹具 `createTree` / `expandedState` | 构造 `ConversationTimelineTree`；读私有 `renderer.*` | 构造 `ConversationTimelineHost`；读 `getTestExpandedState()` |

`conversationTimelineScroll.test.ts`：

| 用例 / 位置 | 旧 | 新 |
|-------------|----|----|
| 导入（`:10-18`、`:224-230`） | 从合并器与 `conversationTimelineApply.ts` 导入 | 从调度器与协调模块导入 |
| `scroll-down button is decoupled from the at-bottom padding state` | 断言 `showButton` 与 `atBottom` | 只断言 `showButton` |
| `S2 three-frame matrix` 各用例 | `computeTimelineApplyPlan` 的 `mode` / `rerenderIds` | `computeTimelineReconcile` 的 `mode` / `changed`，其中：<br>· `:154-160`：`rerenderIds ['u1','a1']` → `changed ['a1']`；<br>· `pending:` 前缀与 chrome id 两条：改为投影层断言，移入 `conversationTimelineProjection.test.ts`；<br>· `:148-152`「effects → none」：移到调度器测试；<br>· 「structure-changing baseline」：期望从 `baseline` 改为 `structure` |
| 夹具（`:170`） | effect kind 字面量 `'sendFailed'` | 改用 `send_failed` 常量 |
| `coalescer delivers both applies of a mixed window to the timeline`（`:184-197`） | 驱动合并器 + `timeout(64)` | 驱动调度器（注入假帧），期望的批内容不变 |

`conversationTimelineRenderer.test.ts`：

| 用例 | 旧 | 新 |
|------|----|----|
| suite `ConversationTimelineDelegate dynamic heights`（`:372` 起，含 `getDynamicHeight returns recorded height or null`） | 断言 Delegate 高度缓存 | 整个 suite 删除（无测高） |
| suite `ConversationTimelineRenderer user-bubble writesEnabled`：`writesEnabled false does not call onEditUserTurn`、`writesEnabled true still calls onEditUserTurn`（`:267, 275`） | 构造树渲染器 | 改为驱动 `ConversationTimelineItemHost`，断言不变 |
| suite `ConversationTimelineRenderer assistant delete agentId`：`:338, 349, 360` 三条 | 构造树渲染器 | 改为驱动 `ConversationTimelineItemHost`，断言不变 |

其他文件：

| 文件 › 位置 | 旧 | 新 |
|-------------|----|----|
| `conversationLens.test.ts:118-126` `inflateTimelineRowHeights`、`:190-203` `restoreDelegateRowHeights` | 读树私有 `turnItems` / `safeUpdateElementHeight` | 两个辅助函数及其调用删除（高度自然）；定时等待（`:172-175`、`:3428-3433`）不变，16ms 兜底保证推进 |
| `conversationLensRevealNavigation.test.ts:294, 343` | 从轨迹跳转后，在 DOM 中找到收起折内的子项 | 原断言保留；新增断言「目标所在过程折已展开」（D11） |
| `conversationTrajectory.test.ts:13, 67-95` | `.conversation-lens-timeline-scroll`、`.conversation-timeline-tree`、`ConversationTimelineTree.layout` | `.conversation-timeline-viewport`、`.conversation-timeline-stream`、宿主 `layout` |
| `conversationIdentityStrip.test.ts:29, 96, 112-113` | 导入树、查 `.conversation-timeline-tree`、调 `timelineTree.layout` | 导入宿主、查 `.conversation-timeline-stream`、调宿主 `layout` |
| `conversationLensDisposeGate.test.ts:273-281, 692-697, 780-840` | `applySessionViewTimeline` 的部分 host 桩只有 `timelineTree.applyEntries` | 桩补投影缓存与 `setVisible`；断言不变 |
| `conversationLensDisposeGate.test.ts:855-870` | 对 `conversationLens.ts` 连接处理块做源码扫描 | 按新的连接处理块更新期望字面量 |
| `node/conversationLensCssScan.test.ts:124-129` | 要求 `.conversation-timeline-tree .monaco-list-row { outline: none }` | 要求 `.conversation-timeline-item:focus:not(:focus-visible) { outline: none }`，且 `.conversation-timeline-item:focus-visible` 带 outline；扫描文件改为 `media/conversationTimeline.css` |

不受影响的测试：

- `conversationPinnedUserPrompt.test.ts`
- `ConversationAutoScrollHolds` 与 2px 判底用例
- 过程折单测：全部以展开态渲染（`conversationProcessFold.test.ts:244-256`、`conversationProcessFoldToolDetails.test.ts:42-50`）
- `conversationTimelineSessionPills.test.ts:419-439`：重装饰保持同步
- `conversationSessionsView.test.ts`：其中的 `.monaco-list-row` 属于会话列表

## 7. 验收与性能预算

| 类 | 标准 |
|----|------|
| 缺陷 | 角色头字冠完整；过程折与气泡展开时无截断、收起时无空洞；流式期间无可见抖动 |
| 订阅 | 流式期间每帧只更新流式根（`rerenderCount` 等于变化根数）。隐藏时 DOM 协调次数为零，同时 Dock、Stop、Inbox 各 chip 与轨迹保持最新。同内容 baseline 时根更新次数为零、无闪烁。发送失败只在发起的 lease 提示一次，文本回到输入框 |
| 交接 | L2 先到与 Completed 先到两种顺序下：两行并存不超过一帧；不出现「消息消失再出现」；跟随中交接前后距底 ≤ 2px；离开底部时阅读锚点偏移 ≤ 1px |
| 滚动 | 内容增长、收起钳位、锚定调整、自身写入都不解锁；Tab 聚焦、选区拖动、读屏器滚动离底时会解锁；手动回到底部与发送时恢复跟随；Hold 期间不抢滚；reveal 后不在底部即解锁；开合时 header 不跳 |
| 性能：PRD-020 | 1,000 回合下，从发送到出现在时间线 ≤ 200 ms（本机、无引擎；`requirements.md` PRD-020 验收 1，用 `conversationPrd020ScaleFixture.ts`） |
| 性能：活窗 trace（1,000 回合，流式中） | 每帧主线程合计 ≤ 4 ms（p95）；时间线代码每次 flush 至多 1 次强制布局，且读写不交错 |
| 性能：长会话 | 打开到末屏可见 ≤ 150 ms；向上滚动全程没有 > 50 ms 的长任务；存活 DiffEditor ≤ 6、webview ≤ 4 |
| 功能 | HEAD 真实存在的能力全部保留，差异仅限 §3.10 |

**验证方式**：

- 单测只断言工作量（重建了几个根、缓存命中、调度次数），不断言毫秒。
- 毫秒指标在隔离 profile（仓内 launch skill）下采集：接[钉死引擎](../../docs/guides/debug-engine.md)的真实流与 PRD-020 夹具，用 DevTools performance trace 记录，结果写回本稿。
- 本地门禁见 §5 第 10 步，依据 [health-gates](../progress/health-gates.md)。

## 8. 风险与兜底

| 风险 | 兜底 |
|------|------|
| 向上滚动时，原生锚定与 `content-visibility` 仍有跳动 | 第 1 步原型即验证；不可靠时改为手动锚点补偿：记下首个可见根的偏移，插入后补写 |
| L2 与 L3 的 `turn_id` 不同源，宿主交接无法关联 | 第 1 步用真实流确认；不同源时退回 HEAD 行为（一次卸行加挂行），登记缺口 G-TL-3，并在验收记录两行并存的时长 |
| 仍在增长的超长列表或表格使尾部退化为 O(该块长度) | 可接受（受单块长度约束）；PRD-020 夹具覆盖；必要时对单块节流 |
| 增量阶段的跨块结构（引用式链接、脚注）不准 | 定稿渲染时纠正 |
| 其他滚动来源（中键自动滚动等） | 都属于非自身写入，按 HEAD 语义处理，不依赖意图识别 |
| 一次性变更体量大 | 在独立工位上做；第 4 步起新宿主接管 lens，后续步骤都在真实路径上验证；每步编译并跑单测；树在最后一步删除 |
| F8 全文 IPC 在超长回答时每帧仍为 O(L) | 渲染端已按前缀增量处理；上游缺口 G-TL-1：overlay 改为追加式 chunk |

## 9. 知识层回填与签收（实施 commit 同刀）

- 新建 ADR `dev/decisions/NNN-conversation-timeline-document-flow.md`（规则 4「两方案择一」），记录 D1 推翻 lens-assembly `:47`，以及用户的明确签收。
- `docs/reference/code-oss-b2/conversation-lens-assembly.md`：凡提及 `ConversationTimelineTree` / 列表虚拟化的地方都改为文档流宿主并链到 ADR，共 8 处：frontmatter summary（`:7`）、`:23`、`:33`、`:42`、`:47`、`:51`、`:57`、`:78`。
- `dev/plans/conversation-stream-timeline.md`：
  - §3.4：流式文本一句改为 D2，并注明调度已按动画帧实现（16ms 兜底）；
  - §3.3 overlay 行：「L2 落盘即移除」与「接受一次卸行 + 挂行」改为 F10 与 D5 的描述；
  - §3.3：「chunks 按 orderKey 拼接」改为 D10。
- `docs/systems/conversation/lens-and-trajectory.md`：补时间线宿主、跟随规则、置顶气泡、交接。
- `dev/progress/status.md`：更正第 78–80 条中 v1「通过审查 / accepted」的记载，改为指向本稿。
- `dev/progress/deferred-gaps.md`：登记 G-TL-1（overlay 追加式 chunk）、G-TL-2（chunk 类别）；G-TL-3 视第 1 步结果决定是否登记；F9 若确认，随本次关闭。

## 10. 外仓对照路径（只读）

- Desktop：`UniverseAgentDesktop/apps/desktop/src/main/session/view-replication-pump.ts` · `packages/app/src/session/operational-timeline.ts` · `packages/ui/src/timeline/message-timeline.tsx` · `packages/ui/src/timeline/timeline-event-auto-scroll-anchor-model.ts`
- Singularity：`UniverseAgent/docs/systems/message/l2-l3-cross-bus-ordering.md` · `UniverseAgent/singularity/bridge/src/jvmAndAndroidMain/kotlin/universe/agentic/singularity/bridge/GenerationDisplayHandoffOrdering.kt` · `UniverseAgent/singularity/docs/systems/session/session-ui-state-flow.md` · `UniverseAgent/singularity/docs/ui/components/message/pinned-user-prompt.md` · `UniverseAgent/singularity/ui/src/commonMain/kotlin/universe/agentic/singularity/ui/components/message/MessageListScrollController.kt` · 同目录 `state/ScrollState.kt`
- DeepSeek：`deepseek-harness/packages/client/ui-conversation/src/client/chat/ChatView.tsx` · 同目录 `ChatNodeSeat.tsx` · `deepseek-harness/packages/client/ui-primitives/src/markdown/incremental.ts`
- ZCode：`ZCode/packages/ui/src/v4/ConversationTimeline.tsx` · 同目录 `conversationTimelineLiveTail.ts` · `timelineScrollAnchor.ts`

## 11. 审查记录

### 11.1 v1 审查结论（2026-09-28，作废 v1 accepted 的理由）

| 级别 | 问题 | 依据 |
|------|------|------|
| Critical | 订阅链路整段缺席：全量投影、16ms 定时器、baseline 丢 effects、隐藏仍 apply、L2/L3 交接、overlay 全文快照都未涉及。只换宿主时流式成本不降，树的「只重绘可见行」反而变成「重绘全部行」 | F3–F10 · R4 · R7 |
| Critical | 核心定性错误：「必须离开虚拟树」。上游 chat 在同一种树里用 RO 解决了动态高度 | R3 |
| Critical | 推翻人类拍板「列表虚拟化进复用」，既未声明也未请求签收 | conversation-lens-assembly `:47` |
| Important | 对标失实：ZCode 是绝对定位虚拟列表加活尾；没有一家用占位块脱水或网格折叠 | §1.4 |
| Important | 与前置合同冲突：「流式 Markdown 保持不变」与前置 §3.4「纯文本」矛盾；前置写「同一动画帧」，实际是 16ms 定时器 | R5 · F3 |
| Important | 滚动：用原生 scroll 事件判底，会把内容增长误判为上滑；RO 推迟到下一 rAF，会先画出一帧未跟随的画面；底垫条件恒真；置顶 36px 布局位移在原生滚动下可能振荡 | S1–S3 |
| Important | `0fr↔1fr` 网格要求收起的内容仍参与布局，内部按钮仍可被 Tab 聚焦 | R8 |
| Important | 无障碍与键盘缺失；`getFocusedTurn` 服务于无障碍视图，被误写成 focusRecord | S4 |
| Important | 功能矩阵有 HEAD 不存在的项（代码块运行 / 插入、`onRetryTurn`）；`refreshPresentation` 写成「轻量 patch」，与 HEAD 的全量重绘相反 | R7 · R10 |
| Minor | §3 表格重复且两份内容矛盾；§6.1 引用不存在的 §5.3；§4.3 代码块未闭合；v1 的规则 16 审查用 CLI 锁定模型，与规则「Task generalPurpose、不锁定模型」不符 | v1 原文 |

### 11.2 v2 → v3

v2 是分刀方案（树内止血、设置开关、按基线再决定宿主）。用户要求一次到位，并授权实施方决定。v3 据此做了以下改动：

- 拍定 D1–D9；
- 删去树内止血与双宿主开关；
- 新增 F11（effects 无消费者）、R11（density 每帧全量查询）；
- 新增交接处理、回到底部恢复跟随、过程折动画、同内容 baseline 零 DOM 工作，以及对应的点名改测。

### 11.3 规则 16 审查（2026-09-28，两轮）

第一轮审查 v3，结论 request changes，改稿得 v3.1：

| 级别 | 审查意见 | 处置 |
|------|----------|------|
| Critical | 隐藏时暂停整个 flush，会冻结轨迹、Inbox、Stop；「可见性入口不存在」不准确 | 采纳：只暂停宿主 DOM 协调；可见性改用 F13 的现有信号 |
| Critical | sync chrome 只在 `sync` / baseline 时刷新，Inbox 在普通 patch 帧上会失步 | 采纳（v3.2 进一步改为每帧照旧调用，见下表） |
| Critical | rAF / RO / IO 缺少测试接缝，现有 20ms 定时等待会失效 | 采纳并调整：加 16ms 兜底定时器；帧驱动贴底改为同步；排帧函数与观察器可注入 |
| Important | 幽灵行在有排队消息时释放不了；F9 拆根不妥；前置 §3.3 需要同刀修订 | 采纳（v3.2 改为宿主侧交接，见下表） |
| Important | F9 拆分超出产品投影合同 | 采纳：改为 D10 分类拼接 |
| Important | 冻结边界不满足 CommonMark | 采纳：改为 marked 词法块冻结 + `fillInIncompleteTokens` |
| Important | 跟随控制器：「无意图不解锁」是未声明的行为变化，另有平滑滚动、意图滞留、`stick` 清理时机等问题 | 采纳并调整：恢复 HEAD 解锁语义，排除自身写入；新增 D12 |
| Important | 窗口化与懒渲染冲突：待决座位直接 `scrollIntoView`；reveal 到收起的折叠 | 采纳：待决座位改调 `revealTurn`；新增 D11 |
| Important | 缓存键：链接目录没有版本；question 依赖 pending 前缀扫描；reviewNav 绕过调度 | 采纳 |
| Important | D9 文案、提示位置、多 lease 重复提示、测试路径 | 采纳 |
| Important | §4 缺文件 | 采纳，已补齐 |
| Important | §6 漏列与错列 | 采纳 |
| Minor | CSS 锚点漂移、轨迹本已门控、density 只需删循环、phase 不应门控、D7 门控、结构比较先比引用、目标窗口 API、强制布局预算、展示开关依赖、`data-turn-id` 冲突、冻结块排版节奏、末尾根可见性、视口变矮时贴底、effects 交付时机、夹具字面量、`setChildrenCount` 定义、`{@link}` 悬空、CSS 扫描字面量、D1 签收与 ADR | 全部采纳 |

第二轮审查（审的是 v3 原稿，其中已被 v3.1 修掉的不再重复），结论 request changes，改稿得 v3.2：

| 级别 | 审查意见 | 处置 |
|------|----------|------|
| Critical | 「只认意图才解锁」会漏掉 Tab、选区、读屏器滚动和待决座位的程序滚动；§3.10 没有列出这些变化 | v3.1 已改为 HEAD 语义加写入台账；v3.2 在 §7 补验收条目 |
| Critical | 隐藏只记脏加门控，会让 `lastAttachedEntries` 与 Inbox 五个 chip 陈旧；`show()` 需要同步完成；漏了第二个 lens 宿主 | 采纳：`lastAttachedEntries` 与 Inbox 每帧照旧（撤回 v3.1 的输入门控，因为 queue / goal / stop 没有对应的 changed id）；`show()` 同步协调；子代理浮层已列入 |
| Critical | 幽灵行没有定义「overlay 根」，F9 没有 id 方案；按引擎合同 L2 先到才是常态，两行并存是主要问题；F10 的移除路径不全 | 采纳并改设计：D5 改为宿主侧按 turn 关联的 H1 交接，撤销幽灵行；D10 不拆根，思考段放在同根内；F10 补齐移除路径与引擎合同；§7 增加「两行并存不超过一帧」 |
| Important | 签收与归档口径：需要 ADR；lens-assembly 不止 `:47` 失真；status.md 仍记 v1 通过审查 | 采纳：§9 列出 8 处与 status.md |
| Important | S1「镜像上游 chat」不实 | 采纳：S1 改写；并据上游做法新增 D13（发送时上锁） |
| Important | R6 的 hover 泄漏不成立 | 采纳：R6 改写，删除「修 R6 泄漏」 |
| Important | 点名改测仍不逐条：Delegate 用例未列标题；`conversationLens.test.ts` 漏了读树内部的辅助函数；`deepStrictEqual` 证明不了同一引用 | 采纳：§6 逐条列出 |
| Important | §4 漏文件 | v3.1 已补；v3.2 再补 `overlayDeltaJoin.ts` 与 `conversationLensComposer.ts` |
| Important | 窗口化会让更早的未决座位失效 | 采纳：窗口起点包含最早的未决座位 |
| Important | 性能预算没有挂已签的 PRD-020 | 采纳：§7 挂 PRD-020 验收 1，原型改用 1000 回合夹具 |
| Important | effects 交付时机自相矛盾；多 lens 重复提示 | v3.1 已解决（flush 始终运行；按本 lease 待发项判定） |
| Minor | 链接目录版本需新增；`requestDetail` 不发帧；reduced motion；视口 RO；调度器输出 API；Mermaid 用例；门禁清单不全；「一个变更集」口径；R2 措辞 | 全部采纳 |
