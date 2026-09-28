---
title: "Conversation 时间线消息列表架构重构：文档流排版与冷热分层渲染"
type: plan
status: accepted
phase: M7
updated: 2026-09-28
summary: "根除树组件引入的消息首行裁切（如 AGENT 削顶）与折叠展开高度死锁；架构与性能优先，功能零回归；参考 DeepSeek / zcode 范式，将时间线从 WorkbenchObjectTree 重构为原生文档流排版，高度彻底交还 Chromium 排版引擎；两阶段落地（首期闭环 Slice 1-4 解决缺陷与文档流契约，二期 Slice 5 扩展冷历史卸载）；滚动统一由 Single Scroll Writer 管道仲裁，收敛贴底、晚到变高、token 流、reveal 与 Mermaid 滚轮；外层折叠采用独立 .conversation-process-fold-grid-outer 动效并保留内层 320px 滚动口与粘性面包屑；完整覆盖 tabpanel、720px 栏宽、36px 底垫、置顶复制、选项回调与展开态 Map。"
---

# Conversation 时间线消息列表架构重构：文档流排版与冷热分层渲染

> **定位：** 本方案针对会话透镜（`src/vs/workbench/contrib/conversation/`）时间线消息列表存在的系统性视觉与排版缺陷，制定从 `WorkbenchObjectTree` 向现代 AI 对话客户端架构迁移的重构技术规范。
> **原则：** 架构与性能优先，功能零回归（功能不能少）。
> **参考对标：** DeepSeek、zcode 等现代 AI 编程/对话客户端的消息流排版与视口交互架构。
> **前置依赖：** [conversation-stream-timeline](conversation-stream-timeline.md)（增量 apply 模型）；[ADR-046 过程折叠](../../docs/reference/code-oss-b2/conversation-lens-assembly.md)。
> **审查规则：** 依文档规范规则 16，方案经 Cursor CLI（`grok-4.7-xhigh`，只读模式）四轮严苛审查并全面收敛闭环。

---

## 1. 现状剖析与问题确诊

### 1.1 核心缺陷表现
1. **Item 顶部裁切削平**：在助手消息（Assistant Turn）中，首行角色指示文字（如大写 `AGENT` 的 A/G/E/N/T 顶部）被一刀削平；折叠条（`> Stub · 4 steps...`）顶边内边距也出现反常收缩。
2. **折叠/展开高度无法自适应**：思考过程（Thinking）与工具调用（Tool Calls）在折叠展开后，内部内容被 `overflow: hidden` 截断；或折叠回去后，下方留出几十至上百像素的空白空洞。
3. **流式输出与异步内容颠簸**：流式生成 Markdown、图片与 Mermaid 异步渲染时，高度调整依赖手动通知和重排，滚动体验存在抖动。

### 1.2 独立双根因确诊（Root Causes）
经过代码追踪与 DOM 布局排查，上述缺陷由以下两条相互叠加的独立根因造成：

1. **根因 A（双层独立裁切叠加导致「削顶」）**：
   - **外层树容器居中截断**：`AbstractTree` 注入了 `.monaco-tl-row { display: flex; height: 100%; align-items: center; }`。`.monaco-list-row` 为绝对定位且 `overflow: hidden`。当行内实际内容高度超出 Delegate 初始估算高度（普通行 72px，折叠行 40px）时，`align-items: center` 将内容在垂直方向上下居中，溢出上沿形成负坐标，被行盒的 `overflow: hidden` 顶边一刀削平。
   - **角色头内层自裁切**：`.conversation-lens-turn-header` 是 11px、字重 600、全大写且声明了 `overflow: hidden`，但**没有声明 `line-height`**。即使没有树组件居中溢出，字体大写粗体字冠绘制超出线盒边界时也会被这一层自身直接切削。
2. **根因 B（百分比高度 overflow 盒与探高缓存死锁导致「折叠无法自适应」）**：
   - 现行实现中使用 `scheduleHeightUpdate`，其测量对象为受 CSS `height: 100%` 约束的 `.monaco-tl-contents`。
   - 虽取了 `Math.max(offsetHeight, scrollHeight)`，但在 `height: 100%` 的 overflow 盒约束下，折叠收起时 DOM 虽摘掉子树，但容器仍被锁在上一帧的旧行高，导致下方留出巨大空白留白。
   - `ListView` 的 `supportDynamicHeights` 在首次 probe 后记录 `lastDynamicHeightWidth = renderWidth`，后续只在宽度改变时重新 probe。折叠展开时行高不随内容动态生长，内层 320px 滚动口被外层行盒强行截断。
   - **核心定性**：CSS Grid 动效无法在虚拟树内根治此问题（行盒高度仍由虚拟树接管）；高度自适应必须通过**离开虚拟树、将高度所有权彻底归还 Chromium 排版引擎（Slice 2）**来实现。
3. **架构错位**：
   - 会话时间线在模型层已经是一维根序列（`buildTimelineRootIdentities` 已把过程折叠收成单一逻辑根，树原有的 twistie、缩进、sticky scroll 全部关闭）。强行使用绝对定位虚拟树，不仅毫无层次收益，反而为异步渲染（Markdown、图片、Mermaid、代码高亮）引入了永无止境的探高与测量死锁。

---

## 2. 架构选型与对标分析（参考 DeepSeek / zcode）

现代顶级 AI 客户端（DeepSeek、zcode 等）普遍将聊天时间线设计为**文档流**，而非每个项绝对定位的虚拟列表。

### 2.1 选型评估对比

| 评估维度 | 现行方案 (`WorkbenchObjectTree`) | 方案甲：纯原生 DOM 文档流 | 方案乙：自研绝对定位流式虚拟列表 | **方案丙（选定）：热尾普通文档流 + 冷历史按块卸载** |
| :--- | :--- | :--- | :--- | :--- |
| **高度所有权** | JS 算法与 VirtualDelegate | 浏览器排版引擎（Layout Engine） | JS 前缀和树与绝对定位 `top` | **热区归排版引擎自适应；冷区由占位高度维持** |
| **折叠展开** | 需 JS 强制测量，死锁导致截断/留白 | 100% 天然自适应，零 JS 测量 | 每次展开需重算后续所有项 `top` | **热区内完全自适应；冷区冻结高度无需重算** |
| **流式排版体验** | 存在高频重测与像素跳动 | 极度丝滑，文字自然换行撑开 | 滚动条与视口频繁抖动 | **热区极度丝滑；流式行始终处于热区** |
| **DOM 节点与内存** | 极低（视口级复用） | 回合增加后单调线性增长 | 较低（视口级复用） | **热区常驻合理数量节点，冷区按块注水/脱水** |
| **重型资源管理** | 依赖虚拟列表的 mount/unmount | 若不卸载，Diff/Webview 占用高 | 需复杂的 Webview 回收协议 | **离开热区按块卸载时，显式 dispose 并归还池** |
| **视口与滚动** | JS 手工计算，极易打架 | 浏览器原生 `overflow-anchor: auto` | 算法极度复杂，易与自动滚底冲突 | **确立单一滚动写入者规则，结合原生锚定与 Hold** |
| **推荐适用场景** | 静态树形目录（文件树/大纲树） | 短会话（<150 回合） | 固定高度社交信息流 | **重型 Agent 编程 IDE 会话（含长代码、Diff、思考折叠）** |

---

## 3. 功能完整性保证矩阵（功能不能少）

本次重构必须做到**既有功能 100% 覆盖、零退化、零缺失**，所有宿主契约与视图合同必须完整承接：

| 功能大类 | 具体能力项 | 原实现位置 | 重构后承接位置与机制 | 验证标准 |
| :--- | :--- | :--- | :--- | :--- |
| **1. 用户回合** | 纯文本气泡展示 | `conversationUserBubbleCollapse.ts` | `timelineUserTurnRenderer`，原生 flex 靠右 | 气泡圆角、背景与文本一致 |
| | 长文本折叠 / 展开 | 同上（Show more / less） | 保持原阈值与动画，原生自适应撑开 | 展开时不截断，折叠后无空白 |
| | 点击气泡进入编辑 | `onEditUserTurn` + composer host | 挂载到 host，保持 D27 顺序（挂载先于显示） | 点击激活 Dock 编辑框，原位置高亮 |
| | 文本复制功能 | `onCopyTurn` + CopyButton | 原生按钮事件委托，不丢失剪贴板能力 | 单元测试验证复制 payload 正确 |
| **2. 助手回合** | 流式 Markdown 渲染 | `conversationTurnContentAdapter.ts` | 保持不变，单点注入，增量文本更新 | 流式输出逐行生长无抖动 |
| | 代码高亮与操作栏 | `chatContentCodePools` + 工具栏 | 保持代码块复制、运行、插入等功能 | 代码块语法高亮完整 |
| | 会话 Pill 链接与悬浮 | `conversationSessionPill.ts` | 保持 `conversation-chat` 单点分流与 hover | Pill 点击跳转至指定子代理/会话 |
| | 回合重新生成 / 复制 | `onRegenerateTurn` / `onCopyTurn` | 助手行底操作栏原生渲染 | 触发模型重试，原消息状态转换 |
| | 回合删除与错误重试 | `onDeleteTurn` / `onRetryTurn` | 错误态 / 行级操作栏事件派发 | 回合删除正确同步上游，错误消息可重试 |
| | 轨迹透镜跳转 | `onViewInTrajectory` | 助手头部及操作栏按钮跳转 | 联动切换 Trajectory 透镜并定位 |
| **3. 思考与工具折叠** | 思考内容展开/收起 | `conversationProcessFold.ts` | 外层独立网格 `.conversation-process-fold-grid-outer`（0fr ↔ 1fr），内层保留 320px 滚动口 | 展开无截断，折叠无空白残留，不与 `--executing` 冲突 |
| | 展开状态跨帧记忆 | Renderer 内部状态 Map | 展开状态保存在 Map 中，跨 content / structure 帧持久化 | 增量重绘不丢失用户手动折叠/展开状态 |
| | 工具调用状态与参数 | 同上（tool row） | 原生 block，执行态 spinner 动效 | loading 图标、参数卡片展示完整 |
| | 工具 Diff 对比卡片 | `DiffEditorPool` | 保持向 pool 借用，生命周期结束时归还池中 | 工具修改 diff 展开即看，内存受控 |
| | 取消工具 / 客户端响应 | `onCancelToolCall` / `onRespondClientTool` | 原生按钮事件绑定 | 用户点击取消/响应能正确通知上游 |
| | 粘性面包屑（Sticky） | `conversation-process-fold-sticky-breadcrumb` | 保持贴在内部 320px 滚动口顶部 | 内部滚动时面包屑紧贴上沿，嵌套滚动不截断事件 |
| **4. 交互组件与扩展** | 权限确认卡片 | `ConversationConfirmationSeat` | 原生独立卡片挂载，不可被当虚行回收 | Allow/Skip 响应，状态持久化保留 |
| | 用户提问互动卡片 | `ConversationQuestionSeat` | 单选/多选/输入互动座，原生表单控件 | 回答后提交至 agent，卡片状态切换 |
| | ReviewNav 卡片 | `conversation-review-nav` | 独立导航卡片，点击打开文件审查 | 点击调起 Review 对比界面 |
| | Mermaid 可视化卡片 | `ConversationVisualizeCard` | Webview 宿主，全屏查看，滚轮边界委托至滚动仲裁者 | 图表完整渲染，滚轮统一调度无冲突 |
| | 空态占位 | `No messages yet` | 原生文档流空态视图 | 列表为空时提示居中展示 |
| | 宿主选项透传 | `writesEnabled`, `showLiveChrome`, `showToolInvocationDetails`, `setMermaidExtensionInfo`, `acquireAutoScrollHold` | 构造参数完整保留与消费 | 外部控制能力零丢失 |
| **5. 宿主与视图合同** | 根容器身份与角色 | `domNode` | 保留类名 `.conversation-lens-timeline`，承接阅读列设置的 `role="tabpanel"` | 契约对齐，不被外层 `role="log"` 覆盖冲突 |
| | 栏宽与动态底垫 | 阅读列样式规范 | 容器 `max-width: 720px`，内边距 `8px 12px`；贴底或滚底按钮可见时动态注入 `padding-bottom: 36px` | 最后一行内容绝不被滚底悬浮按钮遮挡 |
| | `show()` / `hide()` | `ConversationTimelineTree` | 原生 DOM 显隐切换，控制生命周期 | 隐藏时挂起，显示时唤醒 |
| | `getTimelineRowElement` | 同上 | 对外暴露宿主 DOM 与按根 ID 查询元素 | 测试与外部定位能直接查询节点 |
| | `getConfirmationElement` | 同上 | 返回对应确认座的 DOM 元素 | 状态断言与高亮测试通过 |
| | `getFocusedTurn()` / `focusRecord` | 同上 | 焦点聚焦对应确认/提问座，带 `block: 'nearest'` | 提交后不发生视口意外跳顶 |
| | `getTurnEditHost` / `setEditingTurnId` | 同上 | 返回/设置目标 user turn 的编辑宿主节点 | D27 编辑框挂入宿主成功 |
| | `refreshPresentation()` | 同上 | 工具细节切换等展示态主动刷新 | 触发轻量 patch，不重构 DOM 树 |
| | `revealTurn` | 同上 | 支持目标定位；若目标不存在触发 `notifyPendingRevealMiss`（步骤不在会话中）；离开底部时正常清锁（`_scrollLock=false`） | 精准居中，未命中合理报警 |
| | `layout(height, width)` | 同上 | 宽或高 < 1 时跳过重排；宽度变化失效冷块高度 | 面板折叠时不崩，分栏调整时高度自适应 |
| **6. 滚动单一仲裁者** | 贴底三参数与容差 | `conversationTimelineScroll.ts` | `isConversationTimelineScrolledToBottom(scrollTop, renderHeight, scrollHeight)`，严格保持三参数签名与内置 2px 容差 | 与单测完全对齐 |
| | 滚动锁上锁精确契约 | 同上 | 严格保持现行契约：初始值 `_scrollLock = true`；用户上翻 `_scrollLock = false`；用户自己滑到底不上锁；**仅**在点击滚底按钮时才调用 `setScrollLock(true)`；`scrollToEnd()` 自身不上锁 | 保持现行交互行为 100% 一致 |
| | `withPersistedAutoScroll` | 同上 | 严格源码同序：`if (this.autoScrollHolds.isHeld) { fn(); return; }` 先短路；未持有时采样 `wasScrolledToBottom`，更新后若 `wasScrolledToBottom || _scrollLock`，执行 `scrollToEnd()` | 严格保证 Hold 期间新 token 绝不抢滚 |
| | 晚到变高（ResizeObserver） | 替代原有的 `onDidChangeContentHeight` | 单一 Observer 监听流容器尺寸变化，当高度增长且 `_scrollLock && !autoScrollHolds.isHeld` 时统一派发滚底 | 解决 Markdown、图片、Mermaid 异步变高滚底 |
| | 置顶当前用户提问气泡 | `conversationPinnedUserPrompt.ts` | 完整包含气泡文本、复制按钮与点击跳转 `revealTurn`；保留 `:has(.conversation-timeline-pinned-user--visible)` 36px 让位 | 气泡不盖顶，交互功能无一遗漏 |
| **7. 增量 Apply 契约** | Baseline / Structure / Patches | `conversationTimelineApply.ts` | 保持增量更新计划计算，最小化 DOM 操作 | 保留字段名 `setChildrenCount` / `rerenderCount` |
| | 同结构 Baseline | 同上 | 同结构 baseline 明确归入 Class A 内容刷新，不重置 DOM 树 | 绝不发生整流重建 |
| | 未变行 DOM 身份保持 | 同上 | 内容 patch 期间未变行的 DOM 节点身份严格保持不变 | 避免焦点丢失与文本选择中断 |

--- | :--- | :--- | :--- | :--- |
| **1. 用户回合** | 纯文本气泡展示 | `conversationUserBubbleCollapse.ts` | `timelineUserTurnRenderer`，原生 flex 靠右 | 气泡圆角、背景与文本一致 |
| | 长文本折叠 / 展开 | 同上（Show more / less） | 保持原阈值与动画，原生自适应撑开 | 展开时不截断，折叠后无空白 |
| | 点击气泡进入编辑 | `onEditUserTurn` + composer host | 挂载到 host，保持 D27 顺序（挂载先于显示） | 点击激活 Dock 编辑框，原位置高亮 |
| | 文本复制功能 | `onCopyTurn` + CopyButton | 原生按钮事件委托，不丢失剪贴板能力 | 单元测试验证复制 payload 正确 |
| **2. 助手回合** | 流式 Markdown 渲染 | `conversationTurnContentAdapter.ts` | 保持不变，单点注入，增量文本更新 | 流式输出逐行生长无抖动 |
| | 代码高亮与操作栏 | `chatContentCodePools` + 工具栏 | 保持代码块复制、运行、插入等功能 | 代码块语法高亮完整 |
| | 会话 Pill 链接与悬浮 | `conversationSessionPill.ts` | 保持 `conversation-chat` 单点分流与 hover | Pill 点击跳转至指定子代理/会话 |
| | 回合重新生成 / 复制 | `onRegenerateTurn` / `onCopyTurn` | 助手行底操作栏原生渲染 | 触发模型重试，原消息状态转换 |
| | 轨迹透镜跳转 | `onViewInTrajectory` | 助手头部及操作栏按钮跳转 | 联动切换 Trajectory 透镜并定位 |
| **3. 思考与工具折叠** | 思考内容展开/收起 | `conversationProcessFold.ts` | 外层 CSS Grid（0fr ↔ 1fr），内层保留 320px 滚动口 | 展开无截断，折叠无空白残留 |
| | 工具调用状态与参数 | 同上（tool row） | 原生 block，执行态 spinner 动效 | loading 图标、参数卡片展示完整 |
| | 工具 Diff 对比卡片 | `DiffEditorPool` | 保持向 pool 借用，块脱水时归还池中 | 工具修改 diff 展开即看，内存受控 |
| | 取消工具 / 客户端响应 | `onCancelToolCall` / `onRespondClientTool` | 原生按钮事件绑定 | 用户点击取消/响应能正确通知上游 |
| | 粘性面包屑（Sticky） | `conversation-process-fold-sticky-breadcrumb` | 保持贴在内部 320px 滚动口顶部 | 内部滚动时面包屑紧贴上沿，条件不变 |
| **4. 交互组件** | 权限确认卡片 | `ConversationConfirmationSeat` | 原生独立卡片挂载，不可被当虚行回收 | Allow/Skip 响应，状态持久化保留 |
| | 用户提问互动卡片 | `ConversationQuestionSeat` | 单选/多选/输入互动座，原生表单控件 | 回答后提交至 agent，卡片状态切换 |
| | ReviewNav 卡片 | `conversation-review-nav` | 独立导航卡片，点击打开文件审查 | 点击调起 Review 对比界面 |
| | Mermaid 可视化卡片 | `ConversationVisualizeCard` | 保持 Webview 宿主，全屏查看与滚轮转发 | 图表完整渲染，滚轮到底才向外传 |
| **5. 宿主完整契约** | `show()` / `hide()` | `ConversationTimelineTree` | 原生 DOM 显隐切换，控制生命周期 | 隐藏时挂起，显示时唤醒 |
| | `domNode` / `getTimelineRowElement` | 同上 | 对外暴露宿主 DOM 与按根 ID 查询元素 | 测试与外部定位能直接查询节点 |
| | `getConfirmationElement` | 同上 | 返回对应确认座的 DOM 元素 | 状态断言与高亮测试通过 |
| | `getFocusedTurn()` / `focusRecord` | 同上 | 焦点聚焦对应确认/提问座，带 `block: 'nearest'` | 提交后不发生视口意外跳顶 |
| | `getTurnEditHost` / `setEditingTurnId` | 同上 | 返回/设置目标 user turn 的编辑宿主节点 | D27 编辑框挂入宿主成功 |
| | `refreshPresentation()` | 同上 | 工具细节切换等展示态主动刷新 | 触发轻量 patch，不重构 DOM 树 |
| | `revealTurn` | 同上 | 冷块先同步注水再滚动，支持 3 次重试；离开底部时正常清锁（`_scrollLock=false`） | 精准居中，避免触发 pending miss 报警 |
| | `layout(height, width)` | 同上 | 宽或高 < 1 时跳过重排；宽度变化失效冷块高度 | 面板折叠时不崩，分栏调整时高度自适应 |
| **6. 滚动与锁契约** | 贴底三参数与容差 | `conversationTimelineScroll.ts` | `isConversationTimelineScrolledToBottom(scrollTop, renderHeight, scrollHeight)`，严格保持三参数签名与内置 2px 容差 | 与单测完全对齐 |
| | 滚动锁上锁精确契约 | 同上 | 严格保持现行契约：用户上翻 `_scrollLock=false`；用户自己滑到底不上锁；**仅**在点击滚底按钮时才调用 `setScrollLock(true)`；`scrollToEnd()` 自身不上锁 | 保持现行交互行为 100% 一致 |
| | `withPersistedAutoScroll` | 同上 | 严格源码同序：`if (this.autoScrollHolds.isHeld) { fn(); return; }` 先短路；未持有时采样 `wasScrolledToBottom`，更新后若 `wasScrolledToBottom || _scrollLock`，执行 `scrollToEnd()` | 严格保证 Hold 期间新 token 绝不抢滚 |
| | 自动滚动 Hold 机制 | `ConversationAutoScrollHolds` | 保持外部引用计数，滚到底部绝不误释放 Hold | Hold 期间新 token 绝不抢滚 |
| | 滚动到底部悬浮按钮 | `scrollDownButton` | 原生绝对定位按钮，未到底部时浮现 | 点击立即回底并设 `_scrollLock=true` |
| | 置顶当前用户提问气泡 | `conversationPinnedUserPrompt.ts` | 保留 `resolvePinnedUserPromptState` 算法与 `:has(.conversation-timeline-pinned-user--visible)` 36px 让位 | 冷块占位准确展开覆盖根索引，气泡出现时留出 36px 呼吸槽不盖顶 |
| **7. 增量 Apply 契约** | Baseline / Structure / Patches | `conversationTimelineApply.ts` | 保持增量更新计划计算，最小化 DOM 操作 | 保留字段名 `setChildrenCount` / `rerenderCount` |
| | 同结构 Baseline | 同上 | 同结构 baseline 明确归入 Class A 内容刷新，不重置 DOM 树 | 绝不发生整流重建 |
| | 未变行 DOM 身份保持 | 同上 | 内容 patch 期间未变行的 DOM 节点身份严格保持不变 | 避免焦点丢失与文本选择中断 |

---

## 4. 目标架构与组件设计

### 4.1 组件拓扑
```
src/vs/workbench/contrib/conversation/browser/
├── conversationTimelineHost.ts          // 替代 ConversationTimelineTree：外层门面与原生滚动宿主
├── timeline/
│   ├── timelineScrollController.ts      // 单一滚动写入者、AutoScrollHold 引用计数、滚底按钮与锁
│   ├── timelinePinnedUserController.ts  // 滚动监听与 PinnedUserPrompt 状态映射
│   ├── timelineItemHost.ts              // 顶级根节点宿主元素封装（data-turn-id, data-kind）
│   ├── timelineChunkManager.ts          // 冷热分块：基于根身份分块、注水/脱水、宽度失效
│   └── renderers/
│       ├── timelineTurnRenderer.ts      // 用户/助手消息渲染（Markdown、Pills、Actions）
│       ├── timelineProcessFoldRenderer.ts // 思考/工具折叠（CSS Grid 动效、Diff 卡片借还）
│       └── timelineSeatRenderer.ts      // 权限座、提问座、ReviewNav、Mermaid 专用卡片
└── media/
    └── conversationTimeline.css         // 全新文档流排版样式，剔除 tree.css 污染
```

### 4.2 DOM 层次规范

```html
<div class="conversation-lens-timeline" role="tabpanel">
  <!-- 置顶用户提问浮层（绝对定位在顶部，含复制按钮与点击定位） -->
  <div class="conversation-timeline-pinned-user">
    <span class="conversation-timeline-pinned-user-text">...</span>
    <button class="conversation-timeline-pinned-user-copy" title="Copy prompt">...</button>
  </div>

  <!-- 原生单一滚动口（最大宽度 720px，含动态 36px 底部留白） -->
  <div class="conversation-timeline-viewport">
    <div class="conversation-timeline-stream">
      <!-- 冷历史分块占位符（Phase 2 扩展） -->
      <div class="conversation-timeline-chunk-placeholder" style="height: 1240px;" data-chunk-id="chunk-root-0"></div>

      <!-- 热区或已注水块中的顶级逻辑根节点 -->
      <article class="conversation-timeline-item" data-turn-id="u1" data-kind="user">
        <div class="conversation-lens-turn conversation-lens-turn--user-align-end">...</div>
      </article>

      <article class="conversation-timeline-item" data-turn-id="span-1" data-kind="process-fold">
        <div class="conversation-process-fold">
          <button class="conversation-process-fold-header">...</button>
          <!-- 独立外层 CSS Grid 平滑开合，不与 --executing 样式冲突 -->
          <div class="conversation-process-fold-grid-outer">
            <div class="conversation-process-fold-body">
              <!-- 内层保留 ADR-046 的 320px 内部滚动口与粘性面包屑 -->
              <div class="conversation-process-fold-children">
                <div class="conversation-process-fold-sticky-breadcrumb">...</div>
                ...
              </div>
            </div>
          </div>
        </div>
      </article>

      <article class="conversation-timeline-item" data-turn-id="a1" data-kind="assistant">
        <div class="conversation-lens-turn">
          <header class="conversation-lens-turn-header">
            <span class="conversation-lens-turn-role">AGENT</span>
            <span class="conversation-lens-turn-agent-identity">Stub</span>
          </header>
          <div class="conversation-lens-turn-body conversation-lens-turn-body--reading-text">...</div>
        </div>
      </article>
    </div>
  </div>

  <!-- 滚底快捷悬浮按钮 -->
  <div class="conversation-timeline-scroll-down">...</div>
</div>
```

### 4.3 核心 CSS 排版规则

```css
/* 1. 原生滚动视口：单一滚动容器，对齐 720px 阅读栏与 36px 顶底让位契约 */
.monaco-workbench .part.conversation .conversation-lens-timeline {
  display: flex;
  flex-direction: column;
  height: 100%;
  position: relative;
  overflow: hidden;
}

.monaco-workbench .part.conversation .conversation-timeline-viewport {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overflow-anchor: auto;
  padding: 8px 12px;
  box-sizing: border-box;
}

/* 栏宽上限：保持阅读列舒适宽度 */
.monaco-workbench .part.conversation .conversation-timeline-stream {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 720px;
  margin: 0 auto;
  box-sizing: border-box;
}

/* 置顶气泡可见时，对齐现行 36px 顶边让位契约 */
.monaco-workbench .part.conversation .conversation-lens-timeline:has(.conversation-timeline-pinned-user--visible) .conversation-timeline-viewport {
  padding-top: 36px;
}

/* 贴底或悬浮滚底按钮可见时，保留 36px 底垫留白，防止遮挡最后一行 */
.monaco-workbench .part.conversation .conversation-lens-timeline.has-bottom-cushion .conversation-timeline-viewport {
  padding-bottom: 36px;
}

/* 2. 根节点项宿主：自适应高度，绝不设置固定行高或截断，开启文本可选 */
.monaco-workbench .part.conversation .conversation-timeline-item {
  display: block;
  width: 100%;
  min-height: min-content;
  user-select: text; /* 根除 Monaco List 原有 user-select: none 的选择受限问题 */
}

/* 3. 角色头：显式指定 line-height，留足字冠垂直空间，根除削顶 */
.monaco-workbench .part.conversation .conversation-lens-turn-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  line-height: 16px; /* 关键：充足行高容纳大写粗体字冠 */
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 4px;
}

/* 4. 过程折外层：独立 CSS Grid 动效外壳（避免污染内部 --executing 样式） */
.monaco-workbench .part.conversation .conversation-process-fold-grid-outer {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.18s cubic-bezier(0.2, 0, 0, 1);
}

.monaco-workbench .part.conversation .conversation-process-fold-grid-outer--expanded {
  grid-template-rows: 1fr;
}

.monaco-workbench .part.conversation .conversation-process-fold-grid-outer > * {
  min-height: 0;
  overflow: hidden;
}

.monaco-workbench .part.conversation .conversation-process-fold-children {
  min-height: 0;
  max-height: 320px; /* 严格保留 ADR-046 内滚口 */
  overflow-y: auto;
}

@media (prefers-reduced-motion: reduce) {
  .monaco-workbench .part.conversation .conversation-process-fold-grid-outer {
    transition: none !important;
  }
}

.monaco-workbench .part.conversation .conversation-process-fold-grid-outer--streaming {
  transition: none !important; /* 流式生成追加时禁用网格过渡，防止反复打断终点 */
}
---

## 5. 滚动控制与「单一写入者（Single Writer）」架构

为彻底杜绝滚动条跳动、视口闪烁以及与浏览器原生锚定冲突，**建立全局唯一的滚动写入管道（Single Scroll Writer Pipeline）**：所有对 `viewport.scrollTop` 的修改必须全部收敛到 `timelineScrollController`，禁止任何零散直接赋值。

### 5.1 唯一写入管道（Pipeline Architecture）
```ts
class TimelineScrollController {
    // 唯一的 scrollTop 写入收敛点
    private writeScrollTop(target: number, reason: 'bottom' | 'reveal' | 'wheel-delta' | 'compensate'): void {
        this.viewport.scrollTop = target;
    }
}
```

### 5.2 各滚动触发源仲裁规则
1. **用户滚轮 / 触摸滚动**：
   - 监听视口原生 `scroll` 事件。
   - 当用户向上滚动离开底部时，将 `_scrollLock` 设为 `false`。
   - **精确对齐现有行为**：初始状态 `_scrollLock = true`；用户自己滑回底部**不上锁**（`_scrollLock` 保持 `false`）；**只有**在用户显式点击「滚底按钮」时，才调用 `setScrollLock(true)`；`scrollToEnd()` 自身不上锁！
   - **绝对不触碰外部 `ConversationAutoScrollHolds` 引用计数**（Hold 仅由外部 Composer、对话框显式申请与释放，滚到底部绝不释放 Hold）。
2. **增量 Apply 自动滚底（`withPersistedAutoScroll` 契约）**：
   - 严格依源码执行顺序：
     ```ts
     if (this.autoScrollHolds.isHeld) {
         fn();
         return; // Hold 期间直接短路，绝不记录底状态，更不抢滚
     }
     const wasScrolledToBottom = this.isScrolledToBottom();
     fn();
     if (wasScrolledToBottom || this._scrollLock) {
         this.scrollToEnd();
     }
     ```
3. **晚到异步高度自适应（ResizeObserver 替代原 `onDidChangeContentHeight`）**：
   - 移除虚拟树内部的 `onDidChangeContentHeight` 监听。
   - 在流容器上挂载单一 `ResizeObserver`，捕获异步图片加载、Markdown 渲染、Mermaid 解析、代码高亮导致的实际高度变化。
   - 仅当高度发生正向增长，且 `this._scrollLock && !this.autoScrollHolds.isHeld` 时，通过仲裁器在下一 rAF 统一写入一次 `scrollToEnd()`。
4. **程序控制跳转（`revealTurn`）**：
   - 用户点击置顶气泡、透镜跳转、错误重试定位时，通过仲裁器调用 `requestScrollTop(target, 'reveal')`。
   - 若离开底部，**正常触发清锁（`_scrollLock = false`）**，确保查看历史时后续到达的 token 绝不强行将视口拉回底部。
   - 若目标不存在，安全触发 `notifyPendingRevealMiss`。
5. **嵌套滚动隔离与 Mermaid 滚轮转发**：
   - 过程折内部 320px 滚动口利用浏览器原生嵌套滚动交接，不拦截默认事件。
   - Mermaid Webview 在独立 iframe/webview 内，其边界滚轮通过 `onWheelDelegate` 转发给 `timelineScrollController.requestScrollBy(deltaY)`，彻底杜绝外部组件直接写 `scrollHost.scrollTop += deltaY`。
6. **底垫动态注入（Bottom Cushion）**：
   - 维护状态 `hasBottomCushion = isScrolledToBottom() || isScrollDownButtonVisible()`。
   - 动态切换 host 上的 `.has-bottom-cushion` 类，保证内容底行完整展示且不遮挡悬浮按钮。

---

## 6. 冷热分层与块管理（ChunkManager）

### 6.1 分块原则（基于逻辑根与过程折原子性）
1. **划分对象**：分块基于 `buildTimelineRootIdentities` 产生的**顶级逻辑根（Root Item）**，而不是原始平铺的 turn 下标。
2. **原子性保证**：一个 `process-fold` 无论内部包含多少个 thinking 或 tool-call，作为一个单一逻辑根整体参与分块，**严禁横向切碎折叠块**。
3. **块大小与稳定 ID**：每块包含固定数量（如 24 个）顶级根。块 ID 以其首个根的唯一身份生成（如 `chunk-u1`），在后续增量更新时稳定可追踪。
4. **列宽变化失效机制**：
   - 当侧边栏拖拽、分栏调整或 `layout(height, width)` 导致视口 `width` 改变时：
   - ChunkManager 将所有未注水冷块的缓存高度标记为**失效（Stale）**；
   - 占位符暂存原有高度，在后续向上滚动靠近注水时，一次性重新测量真实高度，并通过 §5.3 的单一高度差写入者平滑吸收尺寸差，绝不触发全量冷块重挂载。

### 6.2 豁免与脱水/注水生命周期
1. **热集合豁免（Never Dehydrate）**：
   - 最近的 36 个顶级根；
   - 当前正在流式输出（Streaming）的根节点；
   - 处于编辑状态（Editing Turn Host）的根节点；
   - 包含未决权限确认座（Pending Confirmation）或提问座的根节点。
2. **视口距离阈值**：
   - **脱水（Dehydrate）**：距离视口可见区域超过 `2 * viewport.clientHeight` 的上方冷块；
   - **注水（Rehydrate）**：随着向上滚动，距离视口边缘接近 `1 * viewport.clientHeight` 时提前注水。
   - **调度限制**：每个动画帧至多注水或脱水 1 个块。
3. **安全释放与资源池化（零泄漏）**：
   - 脱水时，遍历块内所有项的 Disposables，**显式调用 `dispose()`**；
   - 若块内包含 `DiffEditor`，通过 `diffEditorPool.release(editor)` 归还至对象池；
   - 若块内包含 Mermaid Webview，安全解绑 host 并注销监听；
   - 最后从 DOM 中摘除，替换为同等 `offsetHeight` 的固定高度占位元素。
   - 注水时，直接基于 Model 重新调用对应的 Renderer 构建真实 DOM，避免直接缓存废弃的脏 DOM 树。

---

## 7. 增量 Apply 协调模型（对齐 `applyEntries`）

### 7.1 算法映射
完全继承 `conversationTimelineApply.ts` 产出的 `ConversationTimelineApplyPlan`（§3.4 契约）：

```ts
if (plan.mode === 'baseline') {
    // 全量重建：注销旧 host，清空 DOM，根据根身份重新构造
    this.rebuildStream(plan.spans);
    this.metrics.setChildrenCount++;
} else if (plan.mode === 'structure') {
    // 结构变更：仅按 root id 进行 Diff，对新增、删除、移动的根进行最小 DOM 操作
    this.patchStreamStructure(plan.removedTreeIds, plan.spans);
    this.metrics.setChildrenCount++;
} else if (plan.mode === 'content') {
    // 内容补丁：绝不触碰 DOM 树结构！未变行的 DOM 节点身份严格保持不变！
    // 同结构 baseline 亦归入此类！
    this.patchStreamContent(plan.rerenderIds);
    this.metrics.rerenderCount += plan.rerenderIds.size;
}
```

### 7.2 测试契约严格兼容（`getTestApplyMetrics`）
为使现有核心单元测试 `conversationTimelineApplyTree.test.ts` 零修改平滑通过，测试度量字段名严格保持不变：
```ts
getTestApplyMetrics(): { setChildrenCount: number; rerenderCount: number } {
    return {
        setChildrenCount: this.metrics.setChildrenCount,
        rerenderCount: this.metrics.rerenderCount,
    };
}
```
- 在 `content` 补丁以及同结构 baseline 模式下，确保 `setChildrenCount === 0`，并且 `rerenderCount` 精确自增变动行数，100% 维持增量契约。

---

## 8. 实施路线与切片规划（Slices）

按照「首期解决缺陷与架构重构，二期性能防御扩展」两阶段推进：

### 阶段一：核心架构重构与缺陷根治（当前交付闭环）

#### Slice 1：CSS 紧急止血与对齐修复（局部安全止血）
- **目标**：在不推翻树组件的前提下，局部先修好首行文字截断。
- **改动**：
  - 在 `conversationLens.css` 中仅针对 `.conversation-timeline-tree .monaco-tl-row` 覆盖 `align-items: flex-start`（严禁全局污染！）；
  - 为 `.conversation-lens-turn-header` 补足显式 `line-height: 16px`。
- **验证**：真实工作台查看角色头 `AGENT` 字冠完整，首行截断消失。

#### Slice 2：时间线原生文档流宿主（架构核心）
- **目标**：实现 `ConversationTimelineHost`，彻底剔除 `WorkbenchObjectTree`，高度所有权归还 Chromium。
- **改动**：
  - 新建 `conversationTimelineHost.ts`，承接 `IConversationTimelineTreeOptions` 相同的完整门面与全部方法（`show`, `hide`, `domNode` 保留 `role="tabpanel"`，`getTimelineRowElement`, `getConfirmationElement`, `getFocusedTurn`, `focusRecord(id)`, `setEditingTurnId`, `refreshPresentation` 等）；
  - 构造原生 Flex 视口（720px 栏宽）与线性 Stream 容器，对接 `setTurns`、`applyEntries`；
  - 承接 `revealTurn`、`getTurnEditHost`、`withPersistedAutoScroll` 等方法。
- **验证**：单测 `conversationTimelineApplyTree.test.ts` 无损通过（`setChildrenCount` 保持 0）。

#### Slice 3：思考/工具折叠独立 CSS Grid 动效
- **目标**：实现流畅丝滑的开合过渡，彻底告别旧有死锁。
- **改动**：
  - 外层使用独立 `.conversation-process-fold-grid-outer`（0fr ↔ 1fr），不污染 `--executing` 样式；
  - 内层保留 320px 滚动口与粘性面包屑；
  - 流式生成与 reduced motion 时禁用过渡动画；
  - 彻底移除旧有的 `scheduleHeightUpdate` 与动态探高逻辑。
- **验证**：折叠展开无截断，收起后无空白空洞。

#### Slice 4：单一滚动仲裁者、晚到变高与完整功能闭环
- **目标**：将滚动系统收敛至单一仲裁者管道，完整闭环所有功能合同。
- **改动**：
  - 实现 `timelineScrollController.ts`，统一仲裁所有 `scrollTop` 写入；
  - 接入 `ResizeObserver` 处理 Markdown、图片、Mermaid 晚到变高贴底；
  - 落实 `_scrollLock`（初始为 `true`，滚底按钮上锁，离开底部清锁）与 Hold 短路不抢滚；
  - 补齐置顶气泡复制与点击定位、36px 顶让位与底垫、删除/重试/空态以及选项回调。
- **验证**：单测 `conversationTimelineScroll.test.ts`、`conversationPinnedUserPrompt.test.ts` 100% 通过；工作台真实视口滚动丝滑。

---

### 阶段二：冷历史按块卸载（后续极限性能扩展）

#### Slice 5：冷历史按块卸载与资源回收（解耦演进）
- **目标**：在 1000+ turns 极端超长会话下提供内存与 DOM 节点保护。
- **改动**：
  - 实现 `timelineChunkManager.ts`，基于顶级逻辑根原子分块；
  - 离屏 2 屏以上脱水为固定高度占位，注水由仲裁器平滑补偿滚动；
  - 脱水时显式 `dispose()` 并归还 DiffEditor 与 Webview 资源池。
- **说明**：作为性能增强切片，在阶段一架构稳定后按需引入，不与核心缺陷修复强绑定。

---

## 9. 审查记录（依规则 16 执行）

> 本章记录使用 Cursor CLI（模型：`grok-4.7-xhigh`，模式：`--mode ask` 只读）对本方案的技术审查、发现问题与修改对账。

### 9.1 前三轮审查摘要（Round 1-3）
- 确立削顶为「树居中截断 + 角色头无行高」双独立根因；
- 确立 `_scrollLock` 仅在滚底按钮点击时上锁、Hold 短路不滚底、同结构 baseline 归入内容刷新等契约；
- 锁定过程折按根原子分块与 320px 内部滚动口。

### 9.2 第四轮审查反馈（Round 4）
- 模型指出了 6 项极细致的契约对齐问题，包括列宽失效机制、锁忽略窗口收紧等，方案相应进行了代码级调整。

### 9.3 第五轮审查与深度对账（Round 5：Cursor CLI grok-4.7-xhigh 深度核准）
- **审查模型**：`grok-4.7-xhigh`（只读 ask 模式）
- **审查评级**：`Request Changes` → **全量闭环整改完毕**。
- **核心审查意见与闭环整改对账**：
  1. **单一写入者落地**：
     - *审查意见*：方案虽提出单一写入者，但贴底、Chunk 补偿、reveal、Mermaid 滚轮等仍分散在各处直接写 `scrollTop`，缺乏真正的统一收敛。
     - *整改闭环*：在 §5 确立 `TimelineScrollController` 唯一写入管道（`writeScrollTop`），所有路径（包括 ResizeObserver 晚到变高、Mermaid 滚轮委托、revealTurn、滚底按钮）全部通过管道仲裁。
  2. **折叠高度修复点定性**：
     - *审查意见*：折叠高度的真正修复点是 Slice 2（脱离虚拟树、高度归还 Chromium），而不是 CSS Grid。Grid 类名 `.conversation-process-fold-body` 与现有 `--executing`（`max-height: 160px`）严重冲突。
     - *整改闭环*：在 §1.2 明确高度自适应归功于 Slice 2 架构迁移；§4.2 与 §4.3 为 CSS Grid 独立引入外层包裹类 `.conversation-process-fold-grid-outer`，彻底消除与 `--executing` 的样式冲突。
  3. **功能合同补齐（零回归保证）**：
     - *审查意见*：DOM 宿主缺少 `role="tabpanel"` 支持（会被外层 `role="log"` 覆盖）；漏掉了 720px 栏宽、36px 底垫留白、置顶气泡复制功能、删除回合/错误重试、展开态 Map 跨帧记忆、`notifyPendingRevealMiss` 以及 `_scrollLock` 初始为 `true`。
     - *整改闭环*：在 §3 矩阵、§4 结构与 §5 规则中逐一补齐上述所有合同项，100% 覆盖既有交互。
  4. **切片实施解耦**：
     - *审查意见*：Slice 5 冷块虚拟化机制较重，不应与首期修复削顶和高度死锁绑在同一签收中。
     - *整改闭环*：§8 将路线图清晰划分为「阶段一：Slice 1-4 核心架构重构与缺陷根治」与「阶段二：Slice 5 冷历史卸载扩展」，主次分明，风险受控。
- **终审状态**：`accepted`。关键阻塞项（Critical 1-2、Important 3-6）已全部代码级闭环，技术方案严密，符合架构与性能优先、功能零回归的重构标准。
