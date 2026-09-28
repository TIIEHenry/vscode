---
title: "Conversation 时间线一次性重构：订阅驱动的按根增量 + 文档流宿主"
type: plan
status: draft
phase: M7
updated: 2026-09-28
summary: "v3（2026-09-28）：按用户要求一次重构到位、由实施方拍板、效果与性能优先。订阅层：动画帧调度、effects 接到发送失败提示、隐藏只记脏、投影按输入身份缓存、按身份判定变化根；宿主：原生文档流 + content-visibility + 历史窗口化 + 重资源预算，删除 WorkbenchObjectTree 与测高；流式正文块冻结增量 Markdown；交接幽灵行防闪空；跟随只由用户意图改变并在回到底部时恢复。决策 D1–D9 已由实施方拍定（用户授权），推翻「列表虚拟化进复用」与前置方案流式纯文本一句。"
---

# Conversation 时间线一次性重构：订阅驱动的按根增量 + 文档流宿主

> **触发：** 2026-09-28 用户先要求审查 v1（树 → 热尾文档流 + 冷块卸载），强调「消息订阅非常重要」；随后要求「一次重构好，你决定怎么实现，主要是效果和性能，先把方案设计好」。v1 审查结论见 §11.1；v2（分刀 + 开关 + 按基线再决定）已被本稿取代。
> **授权：** §2 的决策由实施方拍定，依据是用户上述授权；其中 D1 推翻 [conversation-lens-assembly](../../docs/reference/code-oss-b2/conversation-lens-assembly.md) `:47`「列表虚拟化 … 进复用」，D2 修订 [conversation-stream-timeline](conversation-stream-timeline.md) §3.4「overlay 行 streaming 期间用纯文本」。实施 commit 同刀改写这两处（§9）。
> **沿用的合同：** conversation-stream-timeline §3.3 产品投影与 §3.4 三类帧（A/B/C 语义不变，测法按 §6 点名调整）；[session-view-frame-fanout](session-view-frame-fanout.md) 宿主 per-lease 扇出；[session-subscription-lifecycle](session-subscription-lifecycle.md) lease 所有权与流重开；ADR-046 过程折是 span overlay、座位不得成为可回收行（conversation-lens-assembly `:81`）；UI 不做 overlay 与 L2「同一条」推断。

## 0. 结论

可以一次到位。缺陷与卡顿的根源在「每个 token 走一遍全量链路」，不只在树。本次重构是一个变更集，内部按 §5 的顺序落地，每一步都能编译、能跑测试；树、测高代码和 16ms 合并器在同一变更里删除，不留开关和双宿主。

四件事一起做：

1. **订阅层**：视图面改为动画帧调度；时间线不可见时不做 DOM 工作；effects 接到发送失败提示（HEAD 没有任何消费者）。
2. **投影层**：按输入身份缓存投影结果，变化根由身份与结构比较判定，不再依赖 changedIds，同内容 baseline 做到零 DOM 工作。
3. **宿主层**：原生文档流，配 `content-visibility`、历史窗口化和重资源预算；只更新变化的根；流式正文用块冻结的增量 Markdown。
4. **滚动层**：跟随只由用户意图改变；贴底在 ResizeObserver 回调里同帧完成；overlay 到 L2 的交接用幽灵行防止闪空。

## 1. HEAD 事实（2026-09-28 核对）

### 1.1 订阅链路

```text
gRPC SessionEventStream（electron-main）
  → demux + OverlayDeltaJoin → session-core Actor → 每个 lease 一条 ViewFrame
  → IPC onDynamicDidApplyFrame(leaseId)
  → EngineSessionViewLease.onHostFrame：applyViewFrame 到 replica（逐帧；失序即 requestResync）→ acknowledge
  → onDidApplyFrame(applied) → ConversationSessionViewFrameCoalescer（setTimeout 16ms）
  → applySessionViewTimeline：projectSnapshotToEntries（全量）→ attachReviewEntries → timelineTree.applyEntries
     同时刷新轨迹 / sync chrome / phase / composer / density
```

| # | 事实 | 位置 |
|---|------|------|
| F1 | 数据面是对的：replica 逐帧应用，游标断档即 resync，逐帧 acknowledge；视图读的是最新快照，所以视图层合并或跳帧不会丢数据 | `conversationEngineFrameSource.ts:226-261` · `common/sessionView/apply.ts:710-783` |
| F2 | session-core 快照不可变且结构共享：`upsertById` 只替换命中项，未变项保持对象身份；overlay 文本更新不替换 `timeline` 数组 | `apply.ts:484-563, 791-804` |
| F3 | 合并器是 16ms `setTimeout`，不是前置方案 §3.4 写的「同一动画帧」；baseline 到达时直接 `this.pending = []`，同一窗口里待发的 effects 被丢弃 | `conversationSessionViewFrameCoalescer.ts:59-96, 108-113` |
| F4 | 每次 flush 全量投影：时间线整体 `slice().sort()`，每项新建 entry，每个 overlay 块把全部 chunk 重新 join；`applyEntries` 再全量转 turn，`computeTimelineApplyPlan` 计算两次 root 身份，`patchTurnItemsInPlace` 再 build 全部元素 | `conversationLensProjection.ts:102-139` · `conversationSessionView.ts:239-300` · `conversationTimelineApply.ts:125-154` · `conversationTimelineTree.ts:317-339, 455-490` |
| F5 | 同一函数顺带刷新轨迹、sync chrome、phase、composer、density；对话透镜隐藏（切到轨迹透镜）时时间线照样 apply | `conversationLensProjection.ts:128-138, 206-218` |
| F6 | 引擎 / UA 连接每次变化都 `bindSessionView` 重取 lease 并收到 baseline；同结构 baseline 走 A 类「重绘全部根」 | `conversationLens.ts:333-349` · `conversationTimelineApply.ts:139-146` |
| F7 | 同窗同会话还有第二个 lease（子代理目录 / live agent tree） | `conversationSessionChatService.ts:95` · [D22](../progress/deferred-gaps.md) |
| F8 | overlay 不是追加式 chunk：`OverlayDeltaJoin` 把 delta 累加成整段文本，每个 delta 都发一次全文；`onOverlayActiveTurn` 把全文同时写进 chunk 与 `summary.title` / `preview`。IPC、replica、投影每帧都是 O(文本长度) | `node/overlayDeltaJoin.ts:114-134, 173-183` · `node/sessionCore/session-actor-overlay-fold.ts:93-160` |
| F9 | **疑似缺陷（无用例覆盖）**：同一回合 `thinkingText` 与 `streamingText` 并存时，overlay 块带两个 chunk，投影把全部 chunk `join('')`，流式回答行会带上思考正文 | `session-actor-overlay-fold.ts:134-148` · `conversationSessionView.ts:275` · `overlayDeltaJoin.ts:126-131`；投影用例只有单 chunk（`conversationSessionView.test.ts:159`） |
| F10 | L2/L3 交接没有屏障：overlay 移除只在 L3 `turn_completed`（`overlayActiveTurnClear`）或新 turn 开始时发生，L2 行由 `envelope_*` 落盘产生，是不同事件、不同帧。completed 先到时消息会消失再出现；envelope 先到时两行并存。前置方案 §3.3 写「L2 落盘后 session-core 移除 overlay 块」，与代码不符 | `overlayDeltaJoin.ts:153-171` · `session-actor-overlay-fold.ts:96-101, 162-167` |
| F11 | **ViewEffect 在渲染端没有消费者**：唯一的 kind 是 `send_failed`（本地待发失败，同时把该行从 `localPendingSends` 移除），合并器把它送进 `applySessionViewTimeline` 后由时间线返回 `none`。用户看到的是「发送中」的消息无声消失 | `node/sessionCore/session-actor-chat-outbox.ts:4, 191-218` · `conversationTimelineApply.ts:130-132`；渲染端无其他 `effects` 分支 |

### 1.2 渲染与高度

| # | 事实 | 位置 |
|---|------|------|
| R1 | 削顶根因属实：`.monaco-tl-row { display:flex; height:100%; align-items:center }`，`.monaco-tl-contents { height:100%; overflow:hidden }`；角色头 `overflow:hidden` 且无 `line-height` | `base/browser/ui/tree/media/tree.css:6-12, 46-48, 62-65` · `conversationLens.css:1755-1768` |
| R2 | 折叠高度根因：`scheduleHeightUpdate` 在一次 rAF 里测 `.monaco-tl-contents`（100% 高）的 `max(offsetHeight, scrollHeight)`，收起时读到旧行高，此后不再观察 | `conversationTimelineRenderer.ts:541-559` |
| R3 | 树内本可修：上游 chat 在同一种 `WorkbenchObjectTree` 上每行挂 `DisposableResizeObserver`，经 `onDidChangeItemHeight` 调 `updateElementHeight`。离开树的理由是效果与简化（§2 D1），不是「树修不好」 | `contrib/chat/browser/widget/chatListRenderer.ts:1196-1212` · `chatListWidget.ts:525-527, 1022-1031` |
| R4 | 每次 rerender 整行 `clearNode` 重建，含 `markdownRendererService.render(全文)`；流式行每帧整块重渲染，行内选区、焦点、过程折内滚位置随之丢失 | `conversationTimelineRenderer.ts:145-147, 364` · `conversationTurnContentAdapter.ts:64-85` · `conversationProcessFold.ts:98-148` |
| R5 | 所有 assistant 行（含流式 overlay 行）都走 Markdown，与前置方案 §3.4「streaming 期间纯文本」不一致 | `conversationTurnMarkdown.ts:9-11` |
| R6 | 每个已渲染正文各订 `onDidChangeCatalog` 与 `onDidChangeSession`，每次事件还会再加一个 hover disposable（旧的不回收） | `conversationTurnContentAdapter.ts:79-81, 88-107` |
| R7 | `refreshPresentation()` 不带参数时所有 turn 进 changedIds；配置变更、引擎连接、UA 连接三处调用 | `conversationTimelineTree.ts:492-529` · `conversationLens.ts:301, 339, 348` |
| R8 | 过程折收起用 `hidden`，但子项不论是否展开都全部渲染 | `conversationProcessFold.ts:98-131` |
| R9 | Mermaid 卡片是内嵌 `WebviewElement.mountTo`（iframe 被移动或摘除即重载）；滚轮委托写的是 `.conversation-lens-timeline-scroll`，它不是滚动容器，疑似无效 | `conversationMermaidHost.ts:78-89` · `conversationTimelineRenderer.ts:253-258` · `conversationLens.css:632-638` |
| R10 | 时间线只用 `DiffEditorPool`，没有代码块编辑器池或「运行 / 插入」工具栏 | `conversationTimelineRenderer.ts:20` · `conversationTurnContentAdapter.ts:64-85` |
| R11 | 每次 flush 调 `applyConversationDensity`，对整个时间线 `querySelectorAll('[data-process-fold]')` 并逐个读配置；turnEdit 时 `syncComposerPlacement` 找不到编辑宿主会自排 rAF 重试 | `conversationLensReadingColumn.ts:302-316` · `conversationLensComposerChrome.ts:428-441` |

### 1.3 滚动、置顶与无障碍

| # | 事实 | 位置 |
|---|------|------|
| S1 | 锁语义（镜像上游 chat）：初值 true；滚动事件只要不在底部就解锁；只有滚底按钮上锁；帧驱动更新在「在底部或上锁」时滚底，异步变高只在「上锁且无 Hold」时滚底 | `conversationTimelineTree.ts:103, 265-290, 754-764` · `chatListWidget.ts:353, 909-912` |
| S2 | 底垫是恒真式：`atBottom = 在底 ∨ 锁`，`showButton = ¬在底`，CSS 任一类命中即 36px，实际等于常量 | `conversationTimelineScroll.ts:48-53` · `conversationLens.css:821-825` |
| S3 | 置顶气泡可见时给树加 `padding-top: 36px`（布局位移） | `conversationLens.css:653-655` |
| S4 | `getFocusedTurn()` 读树焦点，供无障碍视图 `getAccessibleTurnContent` / `focusAccessibleTurn` 使用；树提供 `role=tree`、逐行 aria-label、方向键与 type-to-navigate | `conversationLens.ts:432-444` · `conversationTimelineTree.ts:228-243` |
| S5 | `domNode` 构造时设 `role="log"`，随后被阅读列覆盖为 `role="tabpanel"` | `conversationTimelineTree.ts:121` · `conversationLensReadingColumn.ts:99-101` |
| S6 | `DomScrollableElement` 不监听原生 `scroll`，只在 `scanDomNode()` 时回读，浏览器自己发起的滚动会让它失步；本 lens 已有原生细滚动条主题先例 | `base/browser/ui/scrollbar/scrollableElement.ts:714-760` · `conversationLens.css:2849-2850` |

### 1.4 对标（外仓只读，2026-09-28 核对；路径见 §10）

| 仓 | 列表 | 订阅 / 状态 | 跟随 | 本稿采用 |
|----|------|-------------|------|----------|
| UniverseAgentDesktop | `@tanstack/solid-virtual` 虚拟列表 | 主进程 `ViewReplicationPump`：每 lease 至多一帧在途，按 patch 键 last-wins 合并，effects 永不合并；渲染端每帧整表重算 | 50px 阈值，上滑锁存「手动离开」，回到底部清除 | effects 独立通道；回到底部恢复跟随 |
| Singularity | `LazyColumn` + 稳定 key | L2 / L3 分离；H1 屏障：L2 batch 先于 `TurnLifecycle.Completed` | 只在末项身份或流式签名变化时跟随；展开收起、inset 变化不跟随 | 开合不触发跟随；交接防闪空 |
| DeepSeek harness | 纯文档流，历史分页 `loadOlder` | 每节点 seat 独立 selector；增量 Markdown 冻结除最后 2 块外的所有块 | RO 驱动；`observedTopRef` 区分程序写与读者滚动 | 文档流、按根更新、块冻结增量 Markdown、意图台账 |
| ZCode v4 | `@tanstack/react-virtual` 绝对定位历史 + 文档流活尾 | seq 严格投影 store | 在 scroll 之前捕获 wheel / touch / 键盘意图 | 意图捕获 |

没有一家用「占位块脱水」，也没有一家用 `0fr↔1fr` 网格做思考 / 工具折叠。

## 2. 决策（实施方拍定，2026-09-28）

| # | 决策 | 理由 |
|---|------|------|
| D1 | **宿主换原生文档流**，删除 `WorkbenchObjectTree` 路径 | 效果：高度由排版引擎决定，流式贴底不再滞后一帧，嵌套滚动口与粘性面包屑无需测高，支持跨消息选区；性能靠 D8 兜住。推翻 lens-assembly `:47` |
| D2 | **流式正文用块冻结的增量 Markdown**（§3.5）；L2 落盘后用完整 Markdown 渲染一次 | 保留 HEAD 的流式 Markdown 观感，每帧成本从 O(全文) 降到 O(新增 + 尾块)；改写前置方案 §3.4 那一句 |
| D3 | **置顶气泡覆盖式**，不再推动内容；滚动口设 `scroll-padding-top` | 原生滚动下的布局位移会引发锚定调整、滚动事件、可见区变化，再次切换气泡，存在振荡 |
| D4 | **用户滚回底部即恢复跟随**；滚底按钮照旧上锁 | Desktop / Singularity 同做法；修掉 HEAD「手动回到底部后，图片或 Mermaid 晚到变高不跟随」 |
| D5 | **交接用幽灵行**（§3.6）：overlay 根被删而同帧没有新根补位时，保留其 DOM 作只读占位，直到新根插入或超时 | 不做「同一条」推断，只推迟移除，解决 completed 先到造成的闪空与跳动；宿主侧 H1 屏障不在本次 |
| D6 | **滚动口用原生 `overflow-y: auto`** + 主题细滚动条 | 保留浏览器滚动锚定、原生键盘与选区滚动；`DomScrollableElement` 不回读原生滚动（S6），且 `overflow: hidden` 容器是否参与锚定未经验证 |
| D7 | **过程折外层开合做高度动画**，纯 CSS，挂在 `.monaco-enable-motion` 下；执行中的折叠与 reduced motion 不做 | 效果；用 `interpolate-size` + `transition-behavior: allow-discrete`，收起仍是 `hidden`，不可聚焦、不参与布局 |
| D8 | **长会话**：`content-visibility: auto` + 历史窗口化（只增不减）+ DiffEditor / webview 存活上限；不做冷块脱水 | 离屏不排版不绘制；首屏只渲染末尾一段；重资源有上限 |
| D9 | **effects 接到发送失败提示**：`send_failed` 走 Inbox 现有 `showPostFailure('failed')`，按 effectId 去重；未知 kind 只记日志 | 修 F11；不自造文案 |

## 3. 设计

### 3.1 数据流

```text
lease（replica，逐帧，不看可见性）
  │ onDidApplyFrame
  ▼
ConversationTimelineFrameScheduler（每 lease 一个，挂在 lens 绑定上）
  · patches：并集 changedIds，排到下一动画帧
  · baseline：置 rebuild，排到下一动画帧
  · effects：独立 FIFO，本帧视图更新之后交给 effects 消费者（D9），隐藏时照常交付
  · 时间线不可见：只记脏不排帧；变为可见时立即 flush 一次
  │ flush（每帧至多一次）
  ▼
带缓存的投影：snapshot + attribution + details + pending + reviewNav + 链接目录
  → entries（未变项复用同一对象）→ turns（按 entry 身份复用）→ roots（span 复用）
  │
  ▼
ConversationTimelineHost.applyEntries
  结构：按 id 键控协调；交接幽灵行
  内容：只对身份或结构变化的根调用 ItemHost.update；流式根走增量正文
  之后：FollowController 在 RO 回调里决定是否贴底；刷新置顶气泡与滚底按钮
  │
  └─ 其他消费者各自按需：轨迹（仅轨迹透镜可见时）、sync chrome（sync 变化或 baseline）、phase（空↔非空或待发变化）
```

### 3.2 订阅与调度

| 项 | 选定 |
|----|------|
| 调度器 | `ConversationTimelineFrameScheduler` 取代 `ConversationSessionViewFrameCoalescer`，用 `runAtThisOrScheduleAtNextAnimationFrame(targetWindow, flush)`；`normalizeSessionViewChangedIds` / `mergeSessionViewFrames` 作为纯函数迁入新文件 |
| baseline | 不再同步直冲，不再清空 pending effects；同帧多次 baseline 合并为一次 |
| 可见性 | 时间线 `hide()`（切到轨迹透镜）或所在 Part / 编辑器不可见时暂停；可见性入口现在没有，需新增（`ConversationEditorPane` 目前没有 `setEditorVisible` 覆写）；窗口最小化时 rAF 不运行，天然停画 |
| 背压 | 视图永远读最新快照，积压只让下一帧脏集变大，不排队 |
| 扇出拆分 | 轨迹只在轨迹透镜可见时刷新；sync chrome 只在 changedIds 含 `sync` 或 baseline 时刷新；phase 只在「时间线空↔非空」或 `localPendingSends` 数组身份变化时重算；composer 放置只随 phase / 编辑态变化调用；density 改为只在时间线根节点挂一个类（过程折样式改用祖先选择器），去掉每帧 `querySelectorAll`（R11） |
| effects 消费者 | lens 绑定里处理：`kind === 'send_failed'` → `showPostFailure('failed')`，effectId 去重（保留最近 64 个）；失败码写日志；其他 kind 只写日志。`send_failed` 字面量在 `common/conversationViewFrame.ts` 声明，node 测钉住与 vendored 常量相等 |

### 3.3 投影缓存与变化判定

变化判定只看输入，不看 changedIds；changedIds 为空集的畸形帧也不会留下陈旧 DOM。

| 项 | 选定 |
|----|------|
| entry 缓存 | `projectSnapshotToEntries` 增加可选 `cache` 参数（不传时与 HEAD 完全相同）。缓存键覆盖 `timelineItemToEntry` 读取的全部输入：`item`、`attribution.get(id)`、`details.get(item.detail)`、该项对应 requestId 的 pending 成员关系、链接目录版本（`conversationSessionView.ts:335-370`）。键全部不变则复用上次 entry 对象 |
| 结构相等兜底 | 身份不同但内容相同（IPC 反序列化后的 baseline、`stubTurnsToEntries` 每次新建）时，逐字段比较后仍复用旧对象；`metadata` 等嵌套字段按值比较。所以同内容 baseline 的 DOM 工作为零 |
| 排序 | `snapshot.timeline` 数组身份不变时复用上次排序结果 |
| overlay | 每块按 `chunks` 身份缓存拼接结果。F9 先写红测确认；确认后按 chunkId 的 `:think:` 段分流，思考 chunk 归 thinking 行、其余归正文，用例钉住 vendored chunkId 格式 |
| reviewNav | 导航条目按 `(turnId, paths)` 缓存，`attachReviewEntries` 无变化时返回原数组 |
| turn 与 root | `entriesToRenderableTurns` 按 entry 身份复用 turn；`projectProcessFoldSpans` 的 span 在 `turnIds` 与各 turn 身份都不变时复用旧对象 |
| 协调纯函数 | `computeTimelineReconcile(prevRoots, nextRoots)` → `{ mode: 'none' \| 'content' \| 'structure'; removed; changed; order }`。`changed` 是身份（或兜底后）变化的根；A/B/C 语义与前置 §3.4 一致；取代 `computeTimelineApplyPlan`（`conversationReviewEntry.ts:199` 同刀改用新函数） |

每个流式帧的投影成本：n 次指针比较，加上流式块本身的 O(文本长度)（F8 决定了 IPC 就是全文，渲染端无法更低；登记上游缺口 G-TL-1）。

### 3.4 宿主 `ConversationTimelineHost`

| 项 | 选定 |
|----|------|
| 门面 | 与 `ConversationTimelineTree` 相同的公开方法（`applyEntries` / `setTurns` / `revealTurn` / `focusRecord` / `getFocusedTurn` / `getTurnEditHost` / `setEditingTurnId` / `refreshPresentation` / `setMermaidExtensionInfo` / `layout` / `show` / `hide` / `acquireAutoScrollHold` / `isAutoScrollHeld` / `scrollLock` / `setScrollLock` / `scrollToEnd` / `refreshScrollChrome` / `isScrolledToBottom` / `getConfirmationElement` / `getTimelineRowElement` / `getTestApplyMetrics` / `resetTestApplyMetrics` / `domNode`），另加测试钩子 `getTestExpandedState()`；lens 各文件只改类型名 |
| DOM | `domNode`（保留 `.conversation-lens-timeline`，阅读列照旧设 `tabpanel`）> `.conversation-timeline-viewport`（滚动口）> `.conversation-timeline-stream[role=feed]` > 每根一个 `article.conversation-timeline-item[data-turn-id][data-kind]`；置顶气泡与滚底按钮是 `domNode` 下与滚动口并列的覆盖层；空态沿用 `No messages yet` |
| 排版 | 流容器是 block 流，根之间用 `margin-bottom`；阅读列 `max-width: 720px` 居中；底垫常量 `padding-bottom: 36px`（S2）；根节点 `user-select: text` |
| 协调 | 按 id 键控：新根插入、消失的根移除；已有节点只在顺序真正改变时移动（含 iframe 的节点移动会重载 webview，R9）。`article` 在内容更新中保持同一引用，`getTimelineRowElement` 返回它 |
| 按根更新 | `ConversationTimelineItemHost.update(turnOrSpan)`：普通根在 `article` 内重建内容（复用现有渲染函数），过程折与流式根走增量（§3.5 / §3.7）；重建前焦点在该根内时，重建后把焦点放回该 `article` |
| 展示开关 | 渲染时记录根是否读取了 `writesEnabled` / `showLiveChrome` / `showToolInvocationDetails`；`refreshPresentation()` 只重建这些根 |
| 其他显式刷新 | `setEditingTurnId` 只重建新旧两个根（D27 顺序不变：`provideTurnEditComposer` 先于 `setEditingTurnId`）；`setMermaidExtensionInfo` 只重建 visualization 根，不再依赖 baseline 强刷 |
| 链接装饰 | 宿主持有唯一一份 `onDidChangeCatalog` / `onDidChangeSession` 订阅，只对含 `conversation-chat:` 链接的已渲染根重新装饰；每根的 hover disposable 在重装前释放（修 R6） |
| `content-visibility` | 根默认 `content-visibility: auto; contain-intrinsic-block-size: auto 120px`；流式根、编辑中根、含未决座位的根、幽灵行、`:focus-within` 的根改为 `visible` |
| 窗口化 | 打开会话只渲染末尾 60 根；流顶哨兵进入视口上方 1.5 屏范围时向前补 40 根（每帧至多一批）；窗口起点按根 id 记录，历史被删除或 compact 时按 id 重新定位；只增不减；`revealTurn` 命中未渲染的根时分帧补到该根再定位；`aria-setsize` 取模型总数 |
| 重资源预算 | `ConversationTimelineResourceBudget`：展开的 diff 块与 Mermaid webview 在接近视口（上下各 1 屏）时才创建，远离时释放（DiffEditor 归还池，webview 销毁）并留同高占位；存活上限 DiffEditor 6、webview 4（初值），超出按最久未接近者先释放 |
| 滚动口 | 原生 `overflow-y: auto; overflow-anchor: auto; scrollbar-width: thin; scrollbar-color: var(--vscode-scrollbarSlider-background) transparent; scrollbar-gutter: stable; scroll-padding-top: 44px` |
| 布局 | `layout(height, width)` 只做 reveal 恢复与嵌入 DiffEditor 的宽度通知；尺寸为 0 时不报错、不清状态 |

### 3.5 流式正文：块冻结增量 Markdown

`IConversationTurnContentAdapter` 增加可选 `renderStreamingBody(turn, container)`，返回 `{ update(text): void; dispose(): void }`；实现为 `ConversationStreamingMarkdown`：

| 步 | 规则 |
|----|------|
| 前缀快路径 | 新文本以已处理文本为前缀时只处理新增部分；否则（例如链接改写改动了前文）清空重来 |
| 冻结边界 | 在新增区域里找最后一个安全边界：围栏代码块之外的空行，且空行前后都不是列表项、引用或表格行（避免把松散列表、表格切成两段） |
| 冻结 | 边界之前的新块用 `markdownRendererService.render` 渲染一次，追加为独立子元素，此后不再改动；链接装饰在冻结时做一次 |
| 尾块 | 边界之后的尾部每帧至多重渲染一次；尾部处在未闭合的代码围栏内时，按纯文本追加到 `pre > code`（`Text.appendData`），围栏闭合后再作为一个块冻结 |
| 光标 | 流式根正文末尾显示插入符（CSS 伪元素）；reduced motion 下不闪烁 |
| 定稿 | L2 行是新根，用 `renderTurnBody` 完整渲染一次；增量渲染中可能出现的引用式链接、脚注等偏差在这里消除 |

思考正文与工具流式文本本来就是纯文本，按前缀快路径 `appendData`。

### 3.6 overlay → L2 交接

| 情形 | 处理 |
|------|------|
| 同帧内 overlay 根被删、同时有新根插入到它的位置附近 | 一次提交完成替换；跟随中由 RO 贴底，离开底部时由原生锚定保持阅读位置 |
| overlay 根被删而同帧没有新根（`turn_completed` 先到） | 保留该 `article` 为幽灵行：`data-ghost`、`inert`、`aria-hidden="true"`、去掉插入符；不计入 `aria-setsize`，`getTimelineRowElement` / `getFocusedTurn` 不返回它。之后第一个在其前一个兄弟之后插入新根的 flush 里同帧移除；1000ms 超时、rebuild、换会话时直接移除 |
| envelope 先到，两行短暂并存 | 通常在同一动画帧内被调度器合并；若活窗验证可见，另立宿主侧按 turn 关联的清除（不在本次） |

### 3.7 过程折

| 项 | 选定 |
|----|------|
| 增量更新 | `renderProcessFoldSpan` 改为返回可更新句柄：外层 header 摘要原地更新；子项按 turn id 键控，新增的追加、变化的只重建该子项、消失的移除；320px 内滚口与粘性面包屑元素不重建，`scrollTop` 自然保留 |
| 懒渲染 | 子项在首次展开时才渲染（HEAD 收起时也全量渲染，R8） |
| 流式思考 | 思考正文纯文本前缀追加；执行中的 `--executing` 样式（160px）不变 |
| 开合动画（D7） | 流容器 `interpolate-size: allow-keywords`；`.conversation-process-fold-children` 在 `.monaco-workbench.monaco-enable-motion` 下过渡 `height 160ms` 与 `display 160ms allow-discrete`，配 `@starting-style` 从 0 起；执行中的折叠、`prefers-reduced-motion` 下不过渡 |
| 展开态 | userBubble / processFold / visualize 的展开 Map 沿用，按 id 修剪（与 HEAD 相同） |

### 3.8 滚动跟随 `ConversationTimelineFollowController`

| 项 | 选定 |
|----|------|
| 状态 | `following`（即 `_scrollLock`，初值 true）；`holds` 沿用 `ConversationAutoScrollHolds` 引用计数 |
| 意图 | 捕获 `wheel`、焦点在时间线内的 PageUp / PageDown / ArrowUp / ArrowDown / Home / End / Space、滚动条拖动（`pointerdown` 命中滚动口非内容区到 `pointerup`）、`touchmove`；意图在下一次 scroll 事件或 `pointerup` 后失效 |
| 解锁与恢复 | 有意图的 scroll 事件落定后：离开底部 → `following = false`；落在底部 2px 内 → `following = true`（D4）。滚底按钮 → `following = true` 并贴底。`revealTurn` / `focusRecord` 定位后不在底部 → `following = false`（与 HEAD 相同）。**没有意图的 scroll 事件只刷新 chrome，不改锁**，所以内容增长、收起钳位、锚定调整、程序写入都不会误解锁 |
| 帧驱动贴底 | flush 时不读布局，只记 `stick = !held && (lastKnownAtBottom \|\| following)`；DOM 写完交给 RO。本帧没有触发 RO 时，在下一次 flush 前清掉 `stick` |
| 异步变高贴底 | RO 观察流容器；回调里（同帧、绘制之前）若 `stick \|\| (following && !held)` 就写 `scrollTop = scrollHeight`，随后刷新 `lastKnownAtBottom`。不推迟到下一帧 |
| 用户开合 | 过程折、气泡 Show more、diff、visualize 的切换视为阅读行为：在这次高度变化（含 D7 动画期间，最长 250ms）里不贴底，由原生锚定保持 header 位置；被切换的是最后一个根且此前在底部时照常贴底；`following` 状态不变 |
| 写入口 | 所有 `scrollTop` 写入（贴底、reveal、Mermaid 滚轮 `scrollBy`）只经 controller；`focus()` 一律带 `preventScroll: true`，再由 controller 按 `block: 'nearest'` 定位 |
| 置顶判定 | scroll 事件里（rAF 节流）在视口上、下边缘各做一次 `elementFromPoint`（避开气泡区域），得到首尾可见根的模型下标，再调用 HEAD 纯函数 `resolvePinnedUserPromptState`；RO 回调后同样刷新 |
| 置顶气泡（D3） | 覆盖在滚动口顶部，带不透明背景与下沿渐隐；点击 → `revealTurn`，复制按钮 → `onCopyTurn`（与 HEAD 相同） |

### 3.9 无障碍与键盘

| 项 | 选定 |
|----|------|
| 语义 | 流容器 `role=feed`；每根 `article` 带 `aria-posinset` / `aria-setsize` 与 HEAD `getAriaLabel` 同文的 `aria-label`；流式根 `aria-busy=true`；流容器不设 `aria-live`（否则逐 token 播报） |
| 键盘 | roving tabindex：焦点在 `article` 上时，ArrowUp / ArrowDown 与 PageUp / PageDown 在根之间移动，Home / End 到首尾，Enter 进入根内第一个可聚焦元素，Escape 回到 `article`；焦点在根内控件上时不拦截方向键 |
| 焦点 | `getFocusedTurn()` 取 `activeElement.closest('article')` 对应的 turn（过程折根取其首个 turn，与 HEAD 相同），回退顺序不变（lastReveal，再末 turn） |

### 3.10 与 HEAD 的有意差异

| 差异 | 原因 |
|------|------|
| 不再有树的 type-to-navigate | 文档流无对应组件 |
| 时间线不再受 `workbench.list.smoothScrolling`、`mouseWheelScrollSensitivity`、`fastScrollSensitivity` 影响 | 原生滚动（D6） |
| 置顶气泡不再推动内容 | D3 |
| 手动滚回底部恢复跟随 | D4 |
| 发送失败会有提示 | D9（HEAD 静默） |
| 同内容 baseline、展示开关刷新只动需要动的根 | §3.3 / §3.4；用例点名见 §6 |
| Mermaid 滚轮委托真正生效 | R9 |

## 4. 代码落点

| 动作 | 文件 |
|------|------|
| 新增 | `browser/conversationTimelineHost.ts`（宿主）· `conversationTimelineItemHost.ts`（按根 DOM）· `conversationTimelineReconcile.ts`（`computeTimelineReconcile`、span 复用、结构相等）· `conversationTimelineFollow.ts` · `conversationTimelineScheduler.ts`（含迁入的 normalize / merge 纯函数）· `conversationStreamingMarkdown.ts` · `conversationTimelineResourceBudget.ts` · `media/conversationTimeline.css` |
| 修改 | `conversationSessionView.ts`（投影缓存参数、F9 分流）· `conversationReviewEntry.ts`（导航条目缓存、改用新协调函数）· `conversationLensSessionBinding.ts`（调度器、effects 消费者）· `conversationLensProjection.ts`（扇出拆分）· `conversationLensReadingColumn.ts`（挂载宿主、density 根类）· `conversationLens.ts` / `conversationLensComposerChrome.ts`（类型名、composer 放置按需调用）· `conversationTurnContentAdapter.ts`（去掉每正文的全局订阅，加 `renderStreamingBody?` / `decorateLinks?` / `onDidChangeLinkTargets?`，均为可选）· `conversationProcessFold.ts`（可更新句柄、懒渲染）· `conversationTimelineRenderer.ts`（只保留渲染辅助函数与字符串）· `conversationTimelineScroll.ts`（`computeConversationScrollDownState` 只返回 `showButton`）· `conversationTimelineTypes.ts`（选项去掉 `paddingBottom`）· `conversationMermaidHost.ts` / `conversationVisualizeCard.ts`（接资源预算、滚轮经 controller）· `conversationEditorPane.ts`（可见性入口）· `platform/universeAgent/common/conversationViewFrame.ts`（`send_failed` 常量）· `media/conversationLens.css`（删树相关规则、density 改祖先选择器） |
| 删除 | `conversationTimelineTree.ts` · `conversationSessionViewFrameCoalescer.ts` · `conversationTimelineApply.ts`（`buildTimelineRootIdentities` 迁入协调模块）· `ConversationTimelineDelegate` / `ConversationTimelineRenderer` / `ConversationTimelineProcessFoldRenderer` 与测高代码 |
| 不动 | vendored `node/sessionCore/**`、`common/sessionView/**`；宿主传输与 lease；轨迹透镜宿主 |

## 5. 实施顺序（一个变更集）

每步结束跑 `npm run compile-client` 与该步相关单测；第 4 步起 lens 已切到新宿主，树在第 10 步删除。

1. **原型验证**：宿主骨架（原生滚动口、block 流、`content-visibility`、RO 贴底、原生锚定）加 200 根夹具，用隔离 profile 实测贴底、上滑解锁、向上滚动时 `content-visibility` 渲染是否跳动。发现锚定不可靠时，在此步改为手动锚点补偿，再继续。
2. **订阅层**：调度器、effects 消费者、扇出拆分、可见性暂停。
3. **投影层**：投影缓存、结构相等兜底、reviewNav 缓存、turn / span 复用、`computeTimelineReconcile`、F9 红测与分流。
4. **宿主**：DOM、键控协调、ItemHost、座位、reveal / focusRecord / 置顶 / 滚底按钮 / 空态、指标与测试钩子；lens 切换到宿主；迁移 A/B/C 用例。
5. **跟随**：controller、意图捕获、RO 贴底、开合抑制、幽灵行交接。
6. **流式正文**：增量 Markdown、适配器可选接口、链接装饰上提。
7. **过程折**：可更新句柄、懒渲染、内滚保留、开合动画。
8. **长会话**：窗口化、资源预算。
9. **无障碍与键盘**。
10. **收口**：删树、合并器、`conversationTimelineApply.ts` 与树相关 CSS；完成测试迁移；`npm run compile`、`npm run eslint`、`scripts/run-unit-custom.sh`、`python3 scripts/check-docs-health.py`。
11. **活窗验证与知识层回填**（§7、§9）。

## 6. 测试

**新增**

| 文件 | 覆盖 |
|------|------|
| `conversationTimelineScheduler.test.ts` | 同帧多 patch 合并为一次 flush；同窗 `[patches, effects, baseline]` 交付为 `[baseline, effects]`；隐藏期间零次视图更新，恢复可见时一次追平 |
| `conversationTimelineProjection.test.ts` | 性质测：随机 patch 序列下，带缓存投影与不带缓存逐项相等；未触及项保持同一对象；pending 移除使座位 entry 失效（PRD-004）；attribution / detail 变化使对应项失效；F9 双 chunk 分流 |
| `conversationTimelineReconcile.test.ts` | 三种模式；按身份与结构判定 `changed`；span 复用；同内容 baseline 为 `none` |
| `conversationTimelineFollow.test.ts` | 意图矩阵（滚轮上下、按键、滚动条拖动、触摸）；无意图滚动不改锁；回到底部恢复跟随；Hold；开合抑制；reveal 解锁；`stick` 清除时机 |
| `conversationStreamingMarkdown.test.ts` | 边界判定（围栏、列表、表格、引用）；前缀快路径；非前缀重来；未闭合围栏纯文本；定稿后 DOM 文本与完整渲染一致 |
| `conversationTimelineHost.test.ts` | DOM 身份；窗口化补批与 reveal 扩窗；`content-visibility` 例外类；幽灵行生命周期；aria 属性与键盘；焦点恢复；资源预算挂载与释放（假 IntersectionObserver）；effects 零丢失 |
| node：`sendFailedEffectKind.test.ts` | 渲染端 `send_failed` 常量与 vendored `SEND_FAILED_EFFECT_KIND` 相等 |

**点名修改**（[health-gates](../progress/health-gates.md) 要求写明文件、旧断言、新期望）

| 文件 › 用例 | 旧 | 新 |
|-------------|----|----|
| `conversationTimelineApplyTree.test.ts` › `type A — refreshPresentation (tool-details)` | `rerenderCount: 2` | `rerenderCount: 1`（`u1` 不读展示开关；`a1` 的重新生成 / 删除按钮读 `writesEnabled`） |
| 同上 › `type A — same-structure setTurns baseline` | `rerenderCount: 2` | `rerenderCount: 1`（只有 `a1` 内容变化） |
| 同上 › `type A — same-structure engine/mermaid baseline` | `rerenderCount: 2` | `rerenderCount: 0`（内容相同） |
| 同上 › `same-structure baseline that extends a process fold` | `rerenderCount: 2` | `rerenderCount: 1`（只有过程折根变化） |
| 同上 › `structure-changing baseline still rebuilds the tree` | 用例名与语义「整树重建」 | 改名为键控协调；断言 `u1` / `a1` DOM 同引用，`setChildrenCount: 1` 不变 |
| 同上 › 夹具 `createTree` / `expandedState` | 构造 `ConversationTimelineTree`，读私有 `renderer.*` | 构造 `ConversationTimelineHost`，读 `getTestExpandedState()` |
| `conversationTimelineScroll.test.ts` › `scroll-down button is decoupled from the at-bottom padding state` | 断言 `showButton` 与 `atBottom` | 只断言 `showButton` |
| 同上 › `coalescer delivers both applies of a mixed window to the timeline` | 驱动 `ConversationSessionViewFrameCoalescer` + `timeout(64)` | 驱动调度器（假动画帧），期望序列不变 |
| 同上 › `ConversationTimelineApply (S2 three-frame matrix)` 各用例 | `computeTimelineApplyPlan` 的 `mode` / `rerenderIds` | `computeTimelineReconcile` 的 `mode` / `changed`；`pending:` 前缀与 chrome id 两条改为投影层断言（移入 `conversationTimelineProjection.test.ts`）；「structure-changing baseline」期望从 `baseline` 改为 `structure` |
| `conversationTimelineRenderer.test.ts` | Delegate 高度与树渲染器用例 | Delegate 用例删除；渲染输出用例改为驱动 `ConversationTimelineItemHost`，DOM 断言不变 |
| `conversationProcessFold*.test.ts` | 收起时断言子项 DOM | 先展开再断言（懒渲染） |
| `conversationTimelineSessionPills.test.ts` | 适配器内部订阅重装饰 | 宿主统一重装饰 |
| `conversationLens.test.ts` · `conversationLensRevealNavigation.test.ts` · `conversationIdentityStrip.test.ts` · `conversationSessionsView.test.ts` · `node/conversationLensCssScan.test.ts` | 引用树类名 / `.monaco-list-row` / 树 CSS | 改为宿主类名与 `article.conversation-timeline-item` / 新 CSS 文件；实施第 4、10 步逐个核对 |

`conversationPinnedUserPrompt.test.ts`、`ConversationAutoScrollHolds` 与 2px 判底用例不变。

## 7. 验收与性能预算

| 类 | 标准 |
|----|------|
| 缺陷 | 角色头字冠完整；过程折与气泡展开无截断、收起无空洞；流式期间无可见抖动 |
| 订阅 | 流式期间每帧只有流式根被更新（`rerenderCount` 等于变化根数）；隐藏时零次视图更新；同内容 baseline 零次根更新、无闪烁；发送失败有提示且不重复 |
| 交接 | 跟随中交接前后距底 ≤ 2px；离开底部时阅读锚点偏移 ≤ 1px；不出现「消息消失再出现」 |
| 滚动 | 内容增长、收起钳位、锚定调整都不解锁；手动回到底部恢复跟随；Hold 期间不抢滚；reveal 后不在底部即解锁；开合时 header 不跳 |
| 性能（活窗 trace，500 根，流式中） | 每帧主线程合计 ≤ 4ms（p95）；时间线代码引起的强制同步布局为 0 |
| 性能（1000 根） | 打开到末屏可见 ≤ 150ms；向上滚动全程无 > 50ms 长任务；存活 DiffEditor ≤ 6、webview ≤ 4 |
| 功能 | HEAD 真实存在的能力全部保留，差异只限 §3.10 |

**验证方式**：单测断言工作量（重建根数、缓存命中、调度次数），不断言毫秒；毫秒指标在隔离 profile（仓内 launch skill）下接[钉死引擎](../../docs/guides/debug-engine.md)真实流，用 DevTools performance trace 采集，结果写回本稿。本地门禁见 [health-gates](../progress/health-gates.md)：`npm run compile`、`npm run eslint`、`scripts/run-unit-custom.sh`、`python3 scripts/check-docs-health.py`。

## 8. 风险与兜底

| 风险 | 兜底 |
|------|------|
| 原生锚定与 `content-visibility` 在向上滚动时仍有跳动 | 第 1 步原型即验证；不可靠时改为手动锚点补偿（记首个可见根偏移，插入后补写） |
| 增量 Markdown 边界判错导致流式期间排版偏差 | 定稿渲染兜底；边界规则保守；用例覆盖常见结构；必要时退化为「只重渲染尾块」 |
| 幽灵行滞留 | 1000ms 超时；rebuild / 换会话即清 |
| 意图检测漏掉某种输入（中键自动滚动等） | `pointerdown` 命中滚动口非内容区兜底；意图矩阵用例 |
| 一次性变更体量大 | 第 4 步起新宿主就接管 lens，后续步骤都在真实路径上验证；每步编译与单测；树在最后一步删除 |
| F8 全文 IPC 在超长回答时每帧仍为 O(L) | 渲染端已按前缀增量处理；上游缺口 G-TL-1：overlay 改为追加式 chunk |

## 9. 知识层回填（实施 commit 同刀）

- `docs/reference/code-oss-b2/conversation-lens-assembly.md` `:47`：改为文档流宿主，注明本稿与用户授权日期。
- `dev/plans/conversation-stream-timeline.md`：§3.4 流式文本一句改为 D2；注明调度按动画帧实现；§3.3 overlay 行改正「L2 落盘即移除」的描述（F10）。
- `docs/systems/conversation/lens-and-trajectory.md`：时间线宿主、跟随规则、置顶气泡、交接。
- `dev/progress/deferred-gaps.md`：登记 G-TL-1；F9 若确认则随本次关闭。

## 10. 外仓对照路径（只读）

- Desktop：`UniverseAgentDesktop/apps/desktop/src/main/session/view-replication-pump.ts` · `packages/app/src/session/operational-timeline.ts` · `packages/ui/src/timeline/message-timeline.tsx` · `packages/ui/src/timeline/timeline-event-auto-scroll-anchor-model.ts`
- Singularity：`UniverseAgent/docs/systems/message/l2-l3-cross-bus-ordering.md` · `UniverseAgent/singularity/docs/systems/session/session-ui-state-flow.md` · `UniverseAgent/singularity/docs/ui/components/message/pinned-user-prompt.md` · `UniverseAgent/singularity/ui/src/commonMain/kotlin/universe/agentic/singularity/ui/components/message/MessageListScrollController.kt` · 同目录 `state/ScrollState.kt`
- DeepSeek：`deepseek-harness/packages/client/ui-conversation/src/client/chat/ChatView.tsx` · 同目录 `ChatNodeSeat.tsx` · `deepseek-harness/packages/client/ui-primitives/src/markdown/incremental.ts`
- ZCode：`ZCode/packages/ui/src/v4/ConversationTimeline.tsx` · 同目录 `conversationTimelineLiveTail.ts` · `timelineScrollAnchor.ts`

## 11. 审查记录

### 11.1 v1 审查结论（2026-09-28，作废 v1 accepted 的理由）

| 级别 | 问题 | 依据 |
|------|------|------|
| Critical | 订阅链路整段缺席：全量投影、16ms 定时器、baseline 丢 effects、隐藏仍 apply、L2/L3 交接、overlay 全文快照都未涉及；只换宿主时流式成本不降，树的「只重绘可见行」反而变成「重绘全部行」 | F3–F10 · R4 · R7 |
| Critical | 核心定性错误：「必须离开虚拟树」——上游 chat 在同一种树里用 RO 解决了动态高度 | R3 |
| Critical | 推翻人类拍板「列表虚拟化进复用」，既未声明也未请求签收 | conversation-lens-assembly `:47` |
| Important | 对标失实：ZCode 是绝对定位虚拟列表加活尾；没有一家用占位块脱水或网格折叠 | §1.4 |
| Important | 与前置合同冲突：「流式 Markdown 保持不变」对前置 §3.4「纯文本」；前置写「同一动画帧」，实际是 16ms 定时器 | R5 · F3 |
| Important | 滚动：用原生 scroll 事件判底会把内容增长误判为上滑；RO 推迟到下一 rAF 会先画出一帧未跟随的画面；底垫条件恒真；置顶 36px 布局位移在原生滚动下可能振荡；`focusRecord` 的 `scrollIntoView` 绕过了所谓的单一写入者 | S1–S3 · §3.8 |
| Important | `0fr↔1fr` 网格要求收起的内容仍参与布局，内部按钮仍可被 Tab 聚焦 | R8 |
| Important | 无障碍与键盘缺失；`getFocusedTurn` 服务于无障碍视图，被误写成 focusRecord | S4 |
| Important | 功能矩阵有 HEAD 不存在的项（代码块运行 / 插入、`onRetryTurn`）；`refreshPresentation` 被写成「轻量 patch」，与 HEAD 的全量重绘相反 | R7 · R10 |
| Minor | §3 表格重复且两份内容矛盾；§6.1 引用不存在的 §5.3；§4.3 代码块未闭合；v1 的规则 16 审查用 CLI 锁定模型，与规则「Task generalPurpose、不锁定模型」不符 | v1 原文 |

### 11.2 v2 → v3

v2 是分刀方案（树内止血、设置开关、按基线再决定宿主）。用户要求一次到位并授权实施方决定后，本稿：拍定 D1–D9；删去树内止血与双宿主开关；新增 F11（effects 无消费者）、R11（density 每帧全量查询）、交接幽灵行、回到底部恢复跟随、过程折动画、同内容 baseline 零 DOM 工作与对应的点名改测。

### 11.3 规则 16 审查

待本轮只读审查后回填。
