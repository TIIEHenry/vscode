---
title: "Conversation 时间线重构：订阅驱动的按根增量与文档流宿主"
type: plan
status: draft
phase: M7
updated: 2026-09-28
summary: "v2 重写（2026-09-28；v1 的 accepted 作废，理由见 §9.1）：先修订阅链路再换宿主。数据面 lease→replica 逐帧应用、不节流；视图面改为动画帧合并、隐藏只记脏、按根增量投影、只更新变化的根；补 L2/L3 交接屏障与 overlay 双 chunk 拼接；S0b 在树内先止血削顶与折叠高度；宿主换原生文档流 + content-visibility + 历史窗口化，替代 v1 冷块脱水；滚动跟随改为用户输入意图驱动。推翻「列表虚拟化进复用」拍板与前置方案流式纯文本一句，均须签收。"
---

# Conversation 时间线重构：订阅驱动的按根增量与文档流宿主

> **触发：** 2026-09-28 用户要求审查 v1（`WorkbenchObjectTree` → 热尾文档流 + 冷块卸载），并强调「消息订阅非常重要」。v1 只换 DOM 宿主，订阅链路原样保留；核心论断与对标事实也有误（§9.1）。本稿沿用 v1 的目标（削顶、折叠高度、流式颠簸、功能零回归、性能优先）重新设计。
> **沿用的已拍板合同：** [conversation-stream-timeline](conversation-stream-timeline.md) §3.3 产品投影、§3.4 三类帧（A/B/C 验收原样保留）；[session-view-frame-fanout](session-view-frame-fanout.md) 宿主 per-lease 扇出与首帧缓冲；[session-subscription-lifecycle](session-subscription-lifecycle.md) lease 所有权与流重开；ADR-046 过程折是 span overlay、座位不得成为可回收行（[conversation-lens-assembly](../../docs/reference/code-oss-b2/conversation-lens-assembly.md) `:81`）。
> **本稿要推翻或修订的拍板（须签收，§3.5）：** ① conversation-lens-assembly `:47`「列表虚拟化 … 进复用」；② conversation-stream-timeline §3.4「overlay 行 streaming 期间用纯文本 + 光标态」（HEAD 已不遵守）。

## 0. 一句话结论

v1 把问题归到树，但每个流式 token 实际走的是一条全量链：全量排序投影，全量转 turn，两次 fold / root 身份计算，整行 `clearNode` 后重渲染 Markdown，rAF 一次性测高，`updateElementHeight`，最后滚底。换成文档流只去掉最后两步，还会把树的「只重绘可见行」变成「重绘全部行」。v2 先做订阅层（S1–S2，树和文档流都能用），再换宿主（S3–S6）；另用一刀树内止血（S0b）立刻解决削顶和折叠高度，不再让缺陷修复等大改。

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
| F1 | 数据面是对的：replica 逐帧应用，游标断档即 resync，逐帧 acknowledge；视图读的是最新快照，所以视图层合并或跳帧都不会丢数据 | `conversationEngineFrameSource.ts:226-261` · `common/sessionView/apply.ts:710-783` |
| F2 | session-core 快照不可变且结构共享：`upsertById` 只替换命中项，未变项保持对象身份；overlay 文本更新不替换 `timeline` 数组 | `apply.ts:484-563, 791-804` |
| F3 | 合并器是 16ms `setTimeout`，不是前置方案 §3.4 写的「同一动画帧」；baseline 到达时直接 `this.pending = []`，**同一窗口里待发的 effects（发送失败等一次性提示）被丢弃**，与 `mergeSessionViewFrames` 注释的意图相反 | `conversationSessionViewFrameCoalescer.ts:59-96, 108-113` |
| F4 | 每次 flush 全量投影：时间线整体 `slice().sort()`，每项新建 entry，每个 overlay 块把全部 chunk 重新 join；`applyEntries` 再全量转 turn，`computeTimelineApplyPlan` 计算两次 root 身份，`patchTurnItemsInPlace` 再 build 全部元素 | `conversationLensProjection.ts:102-139` · `conversationSessionView.ts:239-300` · `conversationTimelineApply.ts:125-154` · `conversationTimelineTree.ts:317-339, 455-490` |
| F5 | 同一函数顺带刷新轨迹、sync chrome、phase、composer、density；对话透镜隐藏（切到轨迹透镜）时时间线照样 apply | `conversationLensProjection.ts:128-138, 206-218` |
| F6 | 引擎 / UA 连接每次变化都 `bindSessionView` 重取 lease 并收到 baseline；同结构 baseline 走 A 类「重绘全部根」 | `conversationLens.ts:333-349` · `conversationTimelineApply.ts:139-146` |
| F7 | 同窗同会话还有第二个 lease（子代理目录 / live agent tree） | `conversationSessionChatService.ts:95` · [D22](../progress/deferred-gaps.md) |
| F8 | overlay 不是追加式 chunk：`OverlayDeltaJoin` 把 delta 累加成整段文本，每个 delta 都发一次**全文**；`onOverlayActiveTurn` 把全文同时写进 chunk 与 `summary.title` / `preview`。IPC、replica、投影每帧都是 O(文本长度) | `node/overlayDeltaJoin.ts:114-134, 173-183` · `node/sessionCore/session-actor-overlay-fold.ts:93-160` |
| F9 | **疑似缺陷（无用例覆盖）**：同一回合 `thinkingText` 与 `streamingText` 并存时，overlay 块带两个 chunk，投影把全部 chunk `join('')`，流式回答行会带上思考正文 | `session-actor-overlay-fold.ts:134-148` · `conversationSessionView.ts:275` · `overlayDeltaJoin.ts:126-131`；现有投影用例只有单 chunk（`conversationSessionView.test.ts:159`） |
| F10 | L2/L3 交接没有屏障：overlay 移除只在 L3 `turn_completed`（`overlayActiveTurnClear`）或新 turn 开始时发生，L2 行由 `envelope_*` 落盘产生，两者是不同事件、不同帧。completed 先到，消息会消失再出现（闪空 + 跳动）；envelope 先到，两行会并存。前置方案 §3.3 写「L2 落盘后 session-core 移除 overlay 块」，与代码不符 | `overlayDeltaJoin.ts:153-171` · `session-actor-overlay-fold.ts:96-101, 162-167` · conversation-stream-timeline §3.3 overlay 行 |

### 1.2 渲染与高度

| # | 事实 | 位置 |
|---|------|------|
| R1 | 削顶根因属实：`.monaco-tl-row { display:flex; height:100%; align-items:center }`，`.monaco-tl-contents { height:100%; overflow:hidden }`；角色头 `overflow:hidden` 且无 `line-height` | `base/browser/ui/tree/media/tree.css:6-12, 46-48, 62-65` · `conversationLens.css:1755-1768` |
| R2 | 折叠高度根因：`scheduleHeightUpdate` 在一次 rAF 里测 `.monaco-tl-contents`（100% 高）的 `max(offsetHeight, scrollHeight)`，收起时读到旧行高；此后不再观察 | `conversationTimelineRenderer.ts:541-559` |
| R3 | **树内可修**：上游 chat 列表用的是同一种 `WorkbenchObjectTree`，每行挂 `DisposableResizeObserver`，经 `onDidChangeItemHeight` 调 `updateElementHeight`，流式与展开收起都靠它。v1「必须离开虚拟树才能根治」不成立 | `contrib/chat/browser/widget/chatListRenderer.ts:1196-1212` · `chatListWidget.ts:525-527, 1022-1031` |
| R4 | 每次 rerender 整行 `clearNode` 重建，含 `markdownRendererService.render(全文)`；流式行每帧整块重渲染，行内选区、焦点、过程折内滚位置随之丢失 | `conversationTimelineRenderer.ts:145-147, 364` · `conversationTurnContentAdapter.ts:64-85` · `conversationProcessFold.ts:98-148` |
| R5 | 所有 assistant 行（含流式 overlay 行）都走 Markdown，与前置方案 §3.4「streaming 期间纯文本」不一致 | `conversationTurnMarkdown.ts:9-11` · conversation-stream-timeline §3.4 |
| R6 | 每个已渲染正文各订 `onDidChangeCatalog` 与 `onDidChangeSession`，每次事件还会再加一个 hover disposable（旧的不回收）。树里只有可见行这样做，文档流里会变成全部行 | `conversationTurnContentAdapter.ts:79-81, 88-107` |
| R7 | `refreshPresentation()` 不带参数时所有 turn 进 changedIds；配置变更、引擎连接、UA 连接三处调用；用例把「2 行重绘 2 行」锁成合同 | `conversationTimelineTree.ts:492-529` · `conversationLens.ts:301, 339, 348` · `conversationTimelineApplyTree.test.ts:218-230` |
| R8 | 过程折收起用 `hidden`（display:none），但子项不论是否展开都全部渲染；外层没有 `.conversation-process-fold-body`（v1 §4.2 的 DOM 与 HEAD 不符） | `conversationProcessFold.ts:98-131` |
| R9 | Mermaid 卡片是内嵌 `WebviewElement.mountTo`（iframe 被移动或摘除即重载）；滚轮委托写的是 `.conversation-lens-timeline-scroll`，它不是滚动容器，疑似无效 | `conversationMermaidHost.ts:78-89` · `conversationTimelineRenderer.ts:253-258` · `conversationLens.css:632-638` |
| R10 | 时间线只用 `DiffEditorPool`；**没有**代码块编辑器池或「运行 / 插入」工具栏（v1 §3 矩阵中这一行在 HEAD 不存在） | `conversationTimelineRenderer.ts:20` · `conversationTurnContentAdapter.ts:64-85` |

### 1.3 滚动、置顶与无障碍

| # | 事实 | 位置 |
|---|------|------|
| S1 | 锁语义（镜像上游 chat）：初值 true；任何滚动事件只要不在底部就解锁；只有滚底按钮上锁；`withPersistedAutoScroll` 先判 Hold 短路，否则「在底部或上锁」就滚底；异步变高只在「上锁且无 Hold」时滚底 | `conversationTimelineTree.ts:103, 265-290, 754-764` · `chatListWidget.ts:353, 909-912` |
| S2 | 底垫是恒真式：`atBottom = 在底 ∨ 锁`，`showButton = ¬在底`，CSS 任一类命中即 36px，实际等于常量 | `conversationTimelineScroll.ts:48-53` · `conversationLens.css:821-825` |
| S3 | 置顶气泡可见时给树加 `padding-top: 36px`（布局位移） | `conversationLens.css:653-655` |
| S4 | `getFocusedTurn()` 读树焦点，供无障碍视图 `getAccessibleTurnContent` / `focusAccessibleTurn` 使用；树提供 `role=tree`、逐行 aria-label、方向键与 type-to-navigate | `conversationLens.ts:432-444` · `conversationTimelineTree.ts:228-243` |
| S5 | `domNode` 构造时设 `role="log"`，随后被阅读列覆盖为 `role="tabpanel"` | `conversationTimelineTree.ts:121` · `conversationLensReadingColumn.ts:99-101` |
| S6 | `DomScrollableElement` 不监听原生 `scroll`，只在 `scanDomNode()` 时回读；浏览器自己发起的滚动（锚定、focus、选区拖动）会让它的内部状态失步 | `base/browser/ui/scrollbar/scrollableElement.ts:714-760` |

### 1.4 对标（外仓只读，2026-09-28 核对；路径见 §8）

| 仓 | 列表 | 订阅 / 状态 | 跟随 | 可借鉴 |
|----|------|-------------|------|--------|
| UniverseAgentDesktop | `@tanstack/solid-virtual` 虚拟列表 | 主进程 `ViewReplicationPump`：每 lease 至多一帧在途，按 patch 键 last-wins 合并，effects 永不合并，积压超限降级为 baseline；渲染端每帧 tick 后整表重算（与本仓同病） | 纯函数模型：50px 阈值，上滑锁存「手动离开」，回到底部清除锁存 | 按 patch 键合并、effects 独立通道；跟随写成纯函数 |
| Singularity | `LazyColumn` + 稳定 key | L2 持久与 L3 运行态分离；**H1 屏障：L2 batch 必须先于 `TurnLifecycle.Completed`**，否则「生成完列表空」 | 三态 `AutoScroll / UserPaused / Following(id)`；只在末项身份或流式签名变化时跟随，**展开收起、底部 inset 变化不跟随** | H1 屏障；跟随触发条件；置顶提示只做只读投影 |
| DeepSeek harness | **纯文档流**（全部挂载），历史靠分页 `loadOlder`；`.flowItem` 预留给将来的虚拟化 | 每节点一个 seat、独立 selector，流式只重渲染活跃节点；增量 Markdown 冻结除最后 2 块外的所有块 | RO 驱动；`observedTopRef` 区分程序写入与读者滚动 | 按节点订阅；增量 Markdown；意图台账 |
| ZCode v4 | **`@tanstack/react-virtual` 绝对定位**历史，只把运行中的末尾单元放进文档流（避免 RO 滞后一帧造成抖动） | seq 严格的投影 store | `timelineScrollAnchor` 在 scroll 之前捕获 wheel / touch / 键盘意图 | 意图捕获；活尾不进虚拟行 |

结论：四个参照里三个做虚拟化；唯一纯文档流的 DeepSeek 靠分页控制 DOM，也没有「占位块脱水」；思考 / 工具折叠没有一家用 `0fr↔1fr` 网格。v1 §2 的对标表述不成立。

## 2. 目标 / 非目标

**目标**

1. 削顶与折叠高度在 S0b 就消失（树内），不等大改。
2. 流式期间每帧只处理变化的根：投影与 DOM 工作量不随会话长度增长（O(n) 指针比较除外）。
3. 时间线不可见时不做 DOM 工作；重新可见时一次追平。
4. overlay → L2 交接在视觉上一帧完成：跟随时仍贴底，离开底部时阅读位置不跳。
5. 跟随的归属只由用户意图改变；程序写入、内容增长、钳位与锚定调整都不能误解锁。
6. 对 HEAD 功能零回归；无法避免的差异逐条列在 §3.9，待签收。

**非目标**

| 不做 | 原因 |
|------|------|
| 宿主传输、lease 所有权、流重开 | 已由 session-view-frame-fanout / session-subscription-lifecycle 负责 |
| 渲染端同窗共享 lease（D22） | 独立切片；本稿的 store 以 `IConversationSessionViewLease` 为输入，将来可直接接共享 replica |
| 改 vendored `node/sessionCore/**`、`common/sessionView/**` | 应回上游 Desktop 仓；F8「全文而非追加 chunk」登记为上游缺口 G-TL-1 |
| 轨迹透镜的列表宿主 | 仍用现有实现；本稿只把它从每帧同步刷新中拆出来（S1） |
| 过程折开合动画 | 不是缺陷；如需要另行签收（§3.8 末行） |

## 3. 设计

### 3.1 分层

```text
L0 数据面（不变）   lease → replica：逐帧、不节流、不看可见性
L1 调度            FrameScheduler：按动画帧合并 changedIds / effects；隐藏时只记脏
L2 视图模型         ConversationTimelineStore：按根增量投影，产出 TimelineDelta
L3 视图             IConversationTimelineView：S0b–S2 为现有树，S3 起为 ConversationTimelineHost（文档流）
L4 滚动与可见性     FollowController（意图驱动、唯一程序写入口）+ 命中测试 / IntersectionObserver（置顶、懒挂载、窗口化）
```

规则：L0 始终运行；L1–L4 只在可见时运行；L2 的正确性不依赖 changedIds，changedIds 只用于缩小检查范围（§3.3）。

### 3.2 调度（S1）

`ConversationTimelineFrameScheduler` 取代 `ConversationSessionViewFrameCoalescer`：

| 项 | 选定 |
|----|------|
| 对齐 | `runAtThisOrScheduleAtNextAnimationFrame(targetWindow, flush)`；同一帧内 patches 取 changedIds 并集；baseline 只置 `rebuild` 标志（多次 baseline 合为一次），不再同步直冲 |
| effects | 独立 FIFO，**任何情况下都不丢**；在本帧视图更新之后按序交付；隐藏时照常交付（它们不是 DOM 工作）。`mergeSessionViewFrames` 保留为纯函数 |
| 隐藏 | `hide()`、切到轨迹透镜、编辑器不可见时只累积脏集（或 `rebuild`），不排帧；`show()` 时按最新快照一次 flush |
| 背压 | 视图永远读最新快照，积压只会让下一帧的脏集变大，不会排队；窗口最小化时 rAF 不运行，天然停画 |
| 扇出拆分 | `applySessionViewTimeline` 拆成各自订阅：时间线走本调度器；轨迹只在轨迹透镜可见时刷新；sync chrome 只在 changedIds 含 `sync` 或 baseline 时刷新；phase 只在「时间线空↔非空」或 `localPendingSends` 变化时重算 |

修复 F3（effects 丢失、未按动画帧对齐）与 F5（隐藏仍 apply、扇出耦合）。

### 3.3 增量投影 `ConversationTimelineStore`（S2）

输入：lease（snapshot + attribution + details）、reviewNav sidecar、会话链接目录。输出：有序根列表、每根模型、本次 `TimelineDelta`。

| 项 | 选定 |
|----|------|
| 条目缓存 | 按**输入身份**判定是否复用：`item`、`attribution.get(id)`、`details.get(ref)`、链接目录版本、reviewNav 全部与上次同一引用时复用上次 entry 对象。changedIds 只用来缩小检查范围——即便 IPC 把 changedIds 弄成空集，也不会留下陈旧 DOM |
| 排序 | `snapshot.timeline` 数组身份未变时复用上次排序结果（流式只动 overlay，时间线段为 O(1)）；变了才重排 |
| overlay 文本 | 每块缓存 `{ chunksRef, text }`；`chunks` 身份不变即复用，否则重拼。流式行另给 `append`：新文本以旧文本为前缀时只交付后缀，否则整段替换。F8 的全文快照在这里退化为增量 |
| overlay 双 chunk | S0 先写红测确认 F9；确认后按 chunkId 分流：`:think:` chunk 归思考，其余归正文，不再整块 join |
| 根身份 | 沿用 `buildTimelineRootIdentities` / `projectProcessFoldSpans`（§3.4 C 类合同不变）；entry 序列身份全部未变时跳过 span 重算 |
| 输出 | `TimelineDelta = { rebuild: boolean; splices: readonly { start: number; deleteCount: number; insert: readonly RootId[] }[]; changed: ReadonlySet<RootId>; append: ReadonlyMap<RootId, string> }` |
| 与 A/B/C 的对应 | A = `changed` 非空且无 splice；B/C = 有 splice；同结构 baseline 仍归 A。`getTestApplyMetrics()` 字段名不变：`setChildrenCount` 表示结构协调次数，`rerenderCount` 表示根更新次数 |

S2 里树宿主改为消费 `TimelineDelta`（`changed` 走 `rerender`，splice 走 `setChildren` diff），外部行为不变，A/B/C 现有用例不改。

### 3.4 文档流宿主 `ConversationTimelineHost`（S3）

**为什么仍要换宿主**：R3 说明树内能修，所以理由不再是「高度死锁」，而是：原生高度让嵌套滚动口、粘性面包屑、展开收起不再需要测高回灌；支持跨消息选区；reveal 与锚定交给浏览器；去掉 `ListView` 的测高、缓存、重测循环。代价是失去虚拟化，由 §3.7 补回。若 S0 基线显示文档流在目标规模下超预算，就停在 S2（树 + RO），不做 S3。

| 项 | 选定 |
|----|------|
| 门面 | 与 `ConversationTimelineTree` 相同的公开面（`applyEntries` / `setTurns` / `revealTurn` / `focusRecord` / `getFocusedTurn` / `getTurnEditHost` / `setEditingTurnId` / `refreshPresentation` / `setMermaidExtensionInfo` / `layout` / `show` / `hide` / `acquireAutoScrollHold` / `isAutoScrollHeld` / `scrollLock` / `setScrollLock` / `scrollToEnd` / `refreshScrollChrome` / `isScrolledToBottom` / `getConfirmationElement` / `getTimelineRowElement` / `getTestApplyMetrics`）；抽出 `IConversationTimelineView`，lens 只依赖接口 |
| 开关 | 设置 `ua.client.display.timelineRenderer`：`tree`（默认）/ `flow`，S6 删除 |
| DOM | `domNode`（保留 `.conversation-lens-timeline`，由阅读列设 `tabpanel`）> 滚动口 > `div.conversation-timeline-stream[role=feed]` > 每根一个 `article.conversation-timeline-item[data-turn-id][data-kind]`。流容器倾向 block 流加 `margin-bottom`，而不是 `flex + gap`（布局算法更简单），以 S0 数据为准 |
| 协调 | 按 `TimelineDelta.splices` 做键控插入与删除；已有节点只在顺序真正改变时移动（含 iframe 的节点一移动就会重载 webview，R9）；`article` 元素在内容更新中保持同一引用，`getTimelineRowElement` 返回它 |
| 按根更新 | 每种 kind 的 `ItemHost.update(entry, delta)` 只改变化的部分（header / body / actions）；更新前焦点在该根内时，更新后恢复焦点 |
| 流式正文 | 见 §3.5 D2；无论选哪个选项，流式根每个动画帧至多渲染一次正文，其余根不动 |
| overlay → L2 交接 | 同一次 flush 内完成「删 overlay 根 + 插 L2 根」。离开底部时，以首个可见、且不在本次删除集里的根为锚，提交前记下它相对视口的偏移，提交后偏差超过 1px 才补写一次。跨帧的交接由 S1b 屏障消除 |
| `content-visibility` | 每根 `content-visibility: auto; contain-intrinsic-block-size: auto 120px`；以下根强制 `visible`：流式根、编辑中的根、含未决座位的根、含焦点的根 |
| 滚动口 | 原生 `overflow-y: auto` 加工作台滚动条样式，还是 `DomScrollableElement`，由 S3 spike 决定。选后者必须监听原生 `scroll` 并调用 `scanDomNode()`（S6），否则锚定、focus 引起的原生滚动会与其内部状态冲突 |
| 布局 | `layout(height, width)`：宽或高 < 1 时跳过；宽度变化只通知需要显式 layout 的嵌入编辑器（DiffEditor），文本自然重排 |
| 空态 | 与 HEAD 相同的 `No messages yet` |

### 3.5 待签收决策

| # | 问题 | 选项 | 建议 |
|---|------|------|------|
| D1 | 是否推翻 conversation-lens-assembly `:47`「列表虚拟化进复用」 | 保留树（做到 S0b + S2 为止）；或换文档流（S3 起） | 以 S0 基线决定：目标规模下文档流达标才进入 S3 |
| D2 | 流式正文怎么渲染 | A：保留 HEAD 的流式 Markdown，但每帧至多重渲染一次流式根；必要时加 DeepSeek 式「冻结已闭合块、只重渲染尾块」。B：回到前置方案 §3.4 原文，流式期间纯文本 `Text.appendData` 加光标，L2 落盘后渲染一次 Markdown | A（对 HEAD 零回归），并把前置方案 §3.4 那一句改成 A；B 作为 S0 超预算时的降级 |
| D3 | 置顶气泡是否推动内容 | A：覆盖式（不改布局）+ `scroll-padding-top: 36px`；B：保留 HEAD 的 36px 布局位移 | A：原生滚动下的布局位移会引发锚定调整，进而触发滚动事件、改变可见区、再次切换气泡，存在振荡风险 |

### 3.6 滚动跟随 `ConversationTimelineFollowController`（S3）

纯状态机，加上唯一的程序写入口。语义与 HEAD（S1）一致，只改实现方式：

| 项 | 选定 |
|----|------|
| 状态 | `following`（即 `_scrollLock`，初值 true）；`holds` 沿用 `ConversationAutoScrollHolds` 引用计数 |
| 解锁 | 出现用户输入意图后，紧接着的 scroll 事件显示已离开底部，才置 `following = false`。意图包括：`wheel` 且 `deltaY < 0`；焦点在时间线内时按 PageUp / ArrowUp / Home；滚动条拖动（`pointerdown` 到 `pointerup`）；触摸上滑。`revealTurn` / `focusRecord` 定位后若不在底部同样解锁（与 HEAD 相同）。**单独出现的原生 scroll 事件只更新 chrome（滚底按钮、置顶气泡），不改锁**，所以内容增长、收起钳位、锚定调整、程序写入都不会误解锁 |
| 上锁 | 只在点击滚底按钮时（HEAD 合同） |
| 帧驱动贴底 | flush 时不读布局，只记 `stick = !held && (lastKnownAtBottom || following)`；DOM 写完交给 RO。本帧未触发 RO 时，在下一次 flush 前清掉 `stick` |
| 异步变高贴底 | RO 观察流容器；回调里（同一帧、绘制之前）若 `stick || (following && !held)` 就写 `scrollTop = scrollHeight`，然后清 `stick`、刷新 `lastKnownAtBottom`。这与 HEAD 的两条路径等价（帧驱动：在底或上锁；异步：上锁且无 Hold），但不额外强制同步布局，也不推迟到下一帧（推迟会先画出一帧没跟上的画面） |
| 用户开合 | 过程折、气泡 Show more、diff、visualize 的切换视为用户在阅读：以被点击的 header 为锚，切换前记视口偏移，切换后补写一次；这次高度变化不触发跟随（对照 Singularity「展开收起不跟随」）。只有末根在底部展开时继续贴底 |
| 写入口 | 所有 `scrollTop` 写入（贴底、reveal、锚点补偿、Mermaid 滚轮 `scrollBy`）只经 controller；`focus()` 一律带 `preventScroll: true`，再由 controller 定位 |
| 置顶判定 | 在 scroll 事件里（rAF 节流）对视口上、下边缘各做一次 `elementFromPoint` 命中测试（避开置顶气泡区域），得到首尾可见根，再调用 HEAD 纯函数 `resolvePinnedUserPromptState` |
| 底垫 | 常量 `padding-bottom: 36px`（S2），去掉两个切换类 |

### 3.7 长会话与重资源（S5，按 S0 数据启用）

替代 v1 的「冷块脱水」。脱水的问题在于：块边界会随删除、compact、分叉漂移；占位高度会随宽度失效；座位与选区跨块断裂；而且对标的四家都没有这样做。

| 手段 | 选定 |
|------|------|
| 布局 / 绘制 | §3.4 的 `content-visibility: auto`：离屏根不排版、不绘制，DOM 与无障碍树仍在 |
| DOM 数量 | 历史窗口化：打开会话只渲染末尾 K 根（初值 80，S0 标定）；顶部哨兵进入视口时向前补一批，并以锚点保持阅读位置；只增不减；`revealTurn` 命中未渲染的根时，先补到该根再定位 |
| 重资源 | DiffEditor 与 Mermaid webview 在根接近视口（±1 屏）时才创建；存活数设上限（LRU，初值各 8），超出时归还池并留下同高占位 |

### 3.8 无障碍、键盘与过程折（S3–S4）

| 项 | 选定 |
|----|------|
| 语义 | 流容器 `role=feed`；每根 `article` 带 `aria-posinset` / `aria-setsize`（取模型总数，含未渲染的根），标签沿用 HEAD `getAriaLabel` 文案；流式根 `aria-busy=true`；流容器不设 `aria-live`（否则逐 token 播报） |
| 键盘 | roving tabindex：ArrowUp / ArrowDown 与 PageUp / PageDown 在根之间移动，Home / End 到首尾，Enter 进入根内；保留 HEAD 树的方向键行为；不再提供树的 type-to-navigate（§3.9） |
| 焦点 | `getFocusedTurn()` 取 `activeElement.closest('article')` 对应的 turn，回退顺序与 HEAD 相同（lastReveal，再末 turn） |
| 过程折 | 收起保持 `hidden`；子项首次展开才渲染；内容更新时子项按 id 键控协调，并保留 320px 内滚口的 `scrollTop` 与粘性面包屑（ADR-046） |
| 动画（可选） | 不用 `0fr↔1fr` 网格：它要求收起的内容仍参与布局，内部按钮仍可被 Tab 聚焦。如需动画，用 `interpolate-size` / `transition-behavior: allow-discrete` 并保留 `hidden` 语义，受 `prefers-reduced-motion` 约束，另行签收 |

### 3.9 与 HEAD 的行为差异（须签收）

| 差异 | 原因 |
|------|------|
| 不再有树的 type-to-navigate | 文档流无对应组件；如需要另立「会话内查找」 |
| 置顶气泡不再推动内容（D3 选 A 时） | 避免振荡 |
| `refreshPresentation` 只重绘依赖展示开关的根（S4） | 文档流下全量重绘不可接受。点名改测：`conversationTimelineApplyTree.test.ts` › `type A — refreshPresentation (tool-details)`，旧断言 `rerenderCount: 2`，新期望 `rerenderCount: 1`（`u1` 不依赖展示开关，`a1` 的重新生成 / 删除按钮依赖 `writesEnabled`） |
| Mermaid 滚轮委托变为真正生效 | R9：HEAD 写到了非滚动容器 |

## 4. 切片

| 切片 | 内容 | Exit |
|------|------|------|
| **S0** 基线与取证 | ① 性能夹具：200 / 500 / 1000 根（长 Markdown、过程折、diff、Mermaid、流式尾），记录每次 flush 的投影 / 视图更新 / 布局耗时、本代码引起的强制同步布局次数、DOM 节点数、存活 DiffEditor / webview 数；② 用[钉死引擎](../../docs/guides/debug-engine.md)录一段真实流，确认 L2 `envelope_*` 与 L3 `turn_completed` 的相对顺序（F10）；③ F9 红测 | 基线数字写回 §5；据此签 D1 / D2 |
| **S0b** 树内止血 | `.conversation-timeline-tree .monaco-tl-row { align-items: flex-start }`；角色头补 `line-height`；行内加自然高度包裹层，用 `DisposableResizeObserver` 驱动 `updateElementHeight`（对照 R3），删除一次性 rAF 测高 | 活窗：`AGENT` 字冠完整；折叠展开无截断、收起无空洞；`conversationTimelineRenderer.test.ts` 绿 |
| **S1** 调度 | §3.2：`ConversationTimelineFrameScheduler`、扇出拆分、隐藏只记脏 | 新测：同帧多个 patch 并集为一次 flush；同窗 `[patches, effects, baseline]` 交付为 `[baseline, effects]`，effects 不丢；隐藏期间 0 次视图更新，`show()` 一次追平。点名迁移：`conversationTimelineScroll.test.ts` › `coalescer delivers both applies of a mixed window to the timeline` 改为驱动调度器（假动画帧），期望序列不变 |
| **S1b** 交接屏障（node） | 仅当 S0 ② 证实可能 completed 先到：参照 Singularity H1，`OverlayDeltaJoin` 收到 `turn_completed` 后挂起 `overlayActiveTurnClear`，等本会话下一批 L2 `envelope_appended` / `envelope_batch_appended` 投递给 Actor 之后再发；超时（初值 2s）兜底照发并计数。若 S0 显示 envelope 常常先到且间隔可见，另议（需 turn 关联，属宿主职责，UI 仍不做同一条推断） | `overlayDeltaJoin.test.ts` 覆盖两种到达顺序与超时；诊断计数可见 |
| **S2** 增量投影 | §3.3：`ConversationTimelineStore` + `TimelineDelta`；树改为消费 delta | 性质测：随机 patch 序列下，store 的根序列与 entry 内容等于 `projectSnapshotToEntries` 全量结果；S0 夹具中流式 flush 的投影耗时与根数无关；A/B/C 用例不改 |
| **S3** 文档流宿主 | §3.4、§3.6、§3.8；开关默认 `tree` | A/B/C 用例在 `flow` 下同样通过（`getTimelineRowElement` 返回 `article`）；新测：意图解锁矩阵、RO 贴底、Hold、交接锚点、键盘与 aria；活窗按 §5 走一遍 |
| **S4** 热点 | 流式根每帧至多一次正文渲染（D2）；展示开关按依赖集重绘（§3.9 点名改测）；过程折子项键控、保留内滚位置、首次展开才渲染；R6 的全局监听上提到宿主、只重装饰受影响的锚点 | S0 夹具流式 flush 达到 §5 预算 |
| **S5** 长会话 | §3.7 | 1000 根夹具的打开与滚动达到 §5 预算 |
| **S6** 收口 | 默认 `flow`；删除树路径、开关、`ConversationTimelineDelegate` 与测高代码 | D1–D3 已签；升 `implemented` 需活窗证据 |

每刀本地门禁（[health-gates](../progress/health-gates.md)）：`npm run compile-client`（跨层时 `npm run compile`）、`npm run eslint`、`scripts/run-unit-custom.sh`（conversation / universeAgent 目录）；改文档时跑 `python3 scripts/check-docs-health.py`。活窗目视用仓内 launch skill 起隔离 profile。

## 5. 验收与预算

| 类 | 标准 |
|----|------|
| 缺陷 | 角色头字冠完整；过程折、气泡展开无截断，收起无空洞；流式期间无可见抖动 |
| 订阅 | 流式期间每帧视图更新只触及变化的根（`rerenderCount` 等于变化根数）；隐藏时 0 次视图更新；effects 零丢失；changedIds 为空集的畸形帧不留陈旧 DOM |
| 交接 | 跟随中：交接前后距底 ≤ 2px；离开底部：锚点偏移变化 ≤ 1px；不出现「消息消失再出现」，也不出现两份并存 |
| 滚动 | 内容增长、收起钳位、锚定调整都不解锁；滚底按钮上锁；Hold 期间不抢滚；reveal 后不在底部即解锁 |
| 性能（目标值，S0 后确认） | 500 根流式：每帧主线程 ≤ 4ms（p95），本代码引起的强制同步布局 ≤ 1 次；1000 根会话从打开到末屏可见 ≤ 150ms；存活 DiffEditor / webview 不超过上限 |
| 功能 | v1 §3 矩阵中 HEAD 真实存在的能力全部保留（R10 那一行除外）；差异只限 §3.9 |

## 6. 风险

| 风险 | 缓解 |
|------|------|
| 文档流在大会话下内存或首屏超预算 | S0 基线 + D1 退路（停在 S2，树 + RO） |
| `content-visibility` 与锚定、首屏估高的相互作用 | 估高用 `auto` 记忆实测值；S3 spike 验证贴底与 reveal |
| 意图检测漏掉某种输入（点击滚动条轨道翻页、中键自动滚动） | 以 `pointerdown` 命中滚动口非内容区兜底；意图矩阵用例 |
| S1b 屏障等不到 L2（引擎未落盘、分叉） | 超时照发并计数；UI 层不做同一条推断 |
| 两套宿主并存期间的维护成本 | 开关只保留到 S6；两套共用 store 与 ItemHost 渲染函数 |
| F8 全文 IPC 在超长回答时每帧仍为 O(L) | 渲染端已退化为增量；上游缺口 G-TL-1：overlay 改为追加式 chunk |

## 7. 知识层回填（实施 commit 时）

- `docs/systems/conversation/lens-and-trajectory.md`：时间线宿主、跟随规则、置顶气泡。
- `docs/reference/code-oss-b2/conversation-lens-assembly.md` `:47`：D1 签定后改写。
- `dev/plans/conversation-stream-timeline.md`：§3.4 按 D2 改写流式文本一句，并注明调度已按动画帧实现；§3.3 overlay 行改正「L2 落盘即移除」的描述（F10）。
- `dev/progress/deferred-gaps.md`：登记 G-TL-1（overlay 追加式 chunk）与 F9（若确认）。

## 8. 外仓对照路径（只读）

- Desktop：`UniverseAgentDesktop/apps/desktop/src/main/session/view-replication-pump.ts` · `packages/app/src/session/operational-timeline.ts` · `packages/ui/src/timeline/message-timeline.tsx` · `packages/ui/src/timeline/timeline-event-auto-scroll-anchor-model.ts`
- Singularity：`UniverseAgent/docs/systems/message/l2-l3-cross-bus-ordering.md` · `UniverseAgent/singularity/docs/systems/session/session-ui-state-flow.md` · `UniverseAgent/singularity/docs/ui/components/message/pinned-user-prompt.md` · `UniverseAgent/singularity/ui/src/commonMain/kotlin/universe/agentic/singularity/ui/components/message/MessageListScrollController.kt` · 同目录 `state/ScrollState.kt`
- DeepSeek：`deepseek-harness/packages/client/ui-conversation/src/client/chat/ChatView.tsx` · 同目录 `ChatNodeSeat.tsx` · `deepseek-harness/packages/client/ui-primitives/src/markdown/incremental.ts`
- ZCode：`ZCode/packages/ui/src/v4/ConversationTimeline.tsx` · 同目录 `conversationTimelineLiveTail.ts` · `timelineScrollAnchor.ts`

## 9. 审查记录

### 9.1 v1 审查结论（2026-09-28，作废 v1 accepted 的理由）

| 级别 | 问题 | 依据 |
|------|------|------|
| Critical | 订阅链路整段缺席：全量投影、16ms 定时器、baseline 丢 effects、隐藏仍 apply、L2/L3 交接、overlay 全文快照都未涉及；只换宿主时流式成本不降，树的「只重绘可见行」反而变成「重绘全部行」 | F3–F10 · R4 · R7 |
| Critical | 核心定性错误：「必须离开虚拟树」——上游 chat 在同一种树里用 RO 解决了动态高度 | R3 |
| Critical | 推翻人类拍板「列表虚拟化进复用」，既未声明也未请求签收 | conversation-lens-assembly `:47` |
| Important | 对标失实：ZCode 是绝对定位虚拟列表加活尾；没有一家用占位块脱水或网格折叠 | §1.4 |
| Important | 与前置合同冲突：「流式 Markdown 保持不变」对前置 §3.4「纯文本」；前置写「同一动画帧」，实际是 16ms 定时器 | R5 · F3 |
| Important | 滚动：用原生 scroll 事件判底会把内容增长误判为上滑；RO 推迟到下一 rAF 会先画出一帧未跟随的画面；底垫条件恒真；置顶 36px 布局位移在原生滚动下可能振荡；`focusRecord` 的 `scrollIntoView` 绕过了所谓的单一写入者 | S1–S3 · §3.6 |
| Important | `0fr↔1fr` 网格要求收起的内容仍参与布局，内部按钮仍可被 Tab 聚焦，所有收起的折叠都要排版 | R8 |
| Important | 无障碍与键盘缺失；`getFocusedTurn` 服务于无障碍视图，被误写成 focusRecord | S4 |
| Important | 功能矩阵有 HEAD 不存在的项（代码块运行 / 插入、`onRetryTurn`）；`refreshPresentation` 被写成「轻量 patch」，与 HEAD 的全量重绘相反 | R7 · R10 |
| Minor | §3 表格重复且两份内容矛盾；§6.1 引用不存在的 §5.3；§4.3 代码块未闭合；v1 的规则 16 审查用 CLI 锁定模型，与规则「Task generalPurpose、不锁定模型」不符 | v1 原文 |

### 9.2 v2 规则 16 审查

待本轮只读审查后回填。
