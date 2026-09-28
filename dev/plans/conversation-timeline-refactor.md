---
title: "Conversation 时间线消息列表架构重构：文档流排版与冷热分层渲染"
type: plan
status: draft
phase: M7
updated: 2026-09-28
summary: "根除树组件引入的消息首行裁切（如 AGENT 削顶）与折叠展开高度死锁；架构与性能优先，功能零回归；参考 DeepSeek / zcode 范式，将时间线从 WorkbenchObjectTree 重构为「热尾普通文档流 + 冷历史按块卸载」；高度交给 Chromium 排版引擎自适应，折叠采用外层 CSS Grid 动效并保留内层 320px 滚动口与粘性面包屑；严格统一滚动单一写入者模型，保留 AutoScrollHold 引用计数、置顶用户提问索引映射与既有 6 大类交互座与增量 apply 契约。"
---

# Conversation 时间线消息列表架构重构：文档流排版与冷热分层渲染

> **定位：** 本方案针对会话透镜（`src/vs/workbench/contrib/conversation/`）时间线消息列表存在的系统性视觉与排版缺陷，制定从 `WorkbenchObjectTree` 向现代 AI 对话客户端架构迁移的重构技术规范。
> **原则：** 架构与性能优先，功能零回归（功能不能少）。
> **参考对标：** DeepSeek、zcode 等现代 AI 编程/对话客户端的消息流排版与视口交互架构。
> **前置依赖：** [conversation-stream-timeline](conversation-stream-timeline.md)（增量 apply 模型）；[ADR-046 过程折叠](../../docs/reference/code-oss-b2/conversation-lens-assembly.md)。
> **审查规则：** 依文档规范规则 16，方案形成后需经 Cursor CLI（`grok-4.7-xhigh`，只读模式）进行多轮架构、性能与功能完整性审查并记录闭环。

---

## 1. 现状剖析与问题确诊

### 1.1 核心缺陷表现
1. **Item 顶部裁切削平**：在助手消息（Assistant Turn）中，首行角色指示文字（如大写 `AGENT` 的 A/G/E/N/T 顶部）被一刀削平；折叠条（`> Stub · 4 steps...`）顶边内边距也出现反常收缩。
2. **折叠/展开高度无法自适应**：思考过程（Thinking）与工具调用（Tool Calls）在折叠展开后，内部内容被 `overflow: hidden` 截断；或折叠回去后，下方留出几十至上百像素的空白空洞。
3. **流式输出与异步内容颠簸**：流式生成 Markdown、图片与 Mermaid 异步渲染时，高度调整依赖手动通知和重排，滚动体验存在抖动。

### 1.2 独立根因确诊（Root Causes）
经过代码追踪与 DOM 布局排查，上述缺陷由以下两条相互叠加的独立根因造成：

```
【根因 A：树组件居中 + 高度缓存锁死】
ListView 分配行高 -> .monaco-tl-row [align-items: center]
  -> 内容真实高度 > 行高时，中心对齐向负坐标溢出
  -> .monaco-list-row 与 .monaco-tl-contents [overflow: hidden] 削顶!
  -> ListView 一旦 probe 缓存高度后跳过后续更新
  -> scheduleHeightUpdate 测量的目标 .monaco-tl-contents 受 height:100% 样式锁死
  -> 形成测量死锁，折叠展开与流式文本无法自适应!

【根因 B：角色头部样式缺失 line-height】
.conversation-lens-turn-header [overflow: hidden; font-size: 11px; font-weight: 600; text-transform: uppercase;]
  -> 缺失显式 line-height，粗体大写英文字冠直接顶到边框，被自身 overflow: hidden 再次削冠!
```

1. **根因 A（树组件样式污染与测量死锁）**：
   - 会话列表使用了基于 `AbstractTree` 的 `WorkbenchObjectTree`。`AbstractTree` 注入了 `.monaco-tl-row { display: flex; height: 100%; align-items: center; }`。
   - 虚拟列表 Delegate 初始估算高度（普通行 72px，折叠行 40px）小于实际渲染高度时，居中导致内容向上溢出负坐标，被外层 `overflow: hidden` 削平。
   - `ListView` 的 `supportDynamicHeights` 在测量一次后设置 `lastDynamicHeightWidth = renderWidth`，后续子内容变化不再主动 probe。
   - `scheduleHeightUpdate` 测量的宿主是受 CSS `height: 100%` 约束的 `.monaco-tl-contents`，其 `offsetHeight` 始终被锁定在行高，无法将内部真实尺寸回写。折叠后 `children.hidden` 改变，行高不减，产生巨大空白留白。
2. **根因 B（角色头自身的裁切）**：
   - `.conversation-lens-turn-header` 自身设置了 `overflow: hidden`，且没有声明 `line-height`。即使容器没有居中溢出，11px 粗体大写字冠（如 `AGENT`）也会被自身这一层的 `overflow: hidden` 顶边截断。
3. **架构错位**：
   - 会话时间线是一维文档流。过程折（`process-fold`）在模型层（ADR-046）已是平铺单层根，树原有的 twistie、indent、sticky scroll 均已被手动关闭。强行使用绝对定位虚拟树，不仅没有任何层次收益，反而引入了严重的样式污染与动态测量死锁。

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

本次重构必须做到**既有功能 100% 覆盖、零退化、零缺失**，所有宿主契约必须完整承接：

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
| **5. 宿主与滚动契约** | 平滑滚底与滚动锁定 | `conversationTimelineScroll.ts` | 贴底单一写入者，2px 容差判断 | 发送新消息后平滑落底 |
| | 自动滚动 Hold 机制 | `ConversationAutoScrollHolds` | 保持外部引用计数，滚到底部绝不误释放 | 保持 Hold 期间新 token 绝不抢滚 |
| | 滚动到底部悬浮按钮 | `scrollDownButton` | 原生绝对定位按钮，未到底部时浮现 | 点击立即回底，回到视野后自动淡出 |
| | 置顶当前用户提问气泡 | `conversationPinnedUserPrompt.ts` | 保留 `resolvePinnedUserPromptState` 算法 | 冷块占位准确展开根索引，置顶不跳跃 |
| | 定位跳转 `revealTurn` | `revealTurn(id, relativeTop)` | 冷块先同步注水再滚动，支持 3 次重试 | 精准居中，避免触发 pending miss 报警 |
| | 焦点控制 `focusRecord` | `focusRecord(id)` | 维持聚焦到确认/提问座，`preventScroll` | 提交后不发生视口意外跳顶 |
| | 布局测量防御 | `layout(height, width)` | 宽或高 < 1 时跳过重排，防止 0 尺寸脏写 | 面板折叠/展开时不发生异常崩溃 |
| **6. 增量 Apply 契约** | Baseline / Structure / Patches | `conversationTimelineApply.ts` | 保持增量更新计划计算，最小化 DOM 操作 | 保留 `getTestApplyMetrics` 对应语义 |

---

## 4. 目标架构与组件设计

### 4.1 组件拓扑
```
src/vs/workbench/contrib/conversation/browser/
├── conversationTimelineHost.ts          // 替代 ConversationTimelineTree：外层门面与原生滚动宿主
├── timeline/
│   ├── timelineScrollController.ts      // 单一滚动写入者、AutoScrollHold 引用计数、滚底按钮
│   ├── timelinePinnedUserController.ts  // 滚动监听与 PinnedUserPrompt 状态映射
│   ├── timelineItemHost.ts              // 顶级根节点宿主元素封装（data-turn-id, data-kind）
│   ├── timelineChunkManager.ts          // 冷热分块：基于根身份分块、注水/脱水、高度占位
│   └── renderers/
│       ├── timelineTurnRenderer.ts      // 用户/助手消息渲染（Markdown、Pills、Actions）
│       ├── timelineProcessFoldRenderer.ts // 思考/工具折叠（CSS Grid 动效、Diff 卡片借还）
│       └── timelineSeatRenderer.ts      // 权限座、提问座、ReviewNav、Mermaid 专用卡片
└── media/
    └── conversationTimeline.css         // 全新文档流排版样式，剔除 tree.css 污染
```

### 4.2 DOM 层次与样式规范

```html
<div class="conversation-timeline-scroll-host" role="log">
  <!-- 置顶用户提问浮层（位于滚动口之外，固定布局，不挤压滚动内容高度） -->
  <div class="conversation-timeline-pinned-user">...</div>

  <!-- 原生单一滚动口 -->
  <div class="conversation-timeline-viewport">
    <div class="conversation-timeline-stream">
      <!-- 冷历史分块占位符（未注水时） -->
      <div class="conversation-timeline-chunk-placeholder" style="height: 1240px;" data-chunk-id="chunk-root-0"></div>

      <!-- 热区或已注水块中的顶级逻辑根节点 -->
      <article class="conversation-timeline-item" data-turn-id="u1" data-kind="user">
        <div class="conversation-lens-turn conversation-lens-turn--user-align-end">...</div>
      </article>

      <article class="conversation-timeline-item" data-turn-id="span-1" data-kind="process-fold">
        <div class="conversation-process-fold">
          <button class="conversation-process-fold-header">...</button>
          <!-- 外层 CSS Grid 平滑开合 -->
          <div class="conversation-process-fold-body">
            <!-- 内层保留 ADR-046 的 320px 内部滚动口与粘性面包屑 -->
            <div class="conversation-process-fold-children">
              <div class="conversation-process-fold-sticky-breadcrumb">...</div>
              ...
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
/* 1. 原生滚动视口：使用 padding-top 为置顶气泡常驻留出呼吸槽，高度变化不跳动 */
.monaco-workbench .part.conversation .conversation-timeline-viewport {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overflow-anchor: auto;
  padding-top: 40px; /* 固定预留置顶气泡槽位，杜绝气泡显隐导致整个滚动条高度抖动 */
  padding-bottom: 24px;
  box-sizing: border-box;
}

/* 2. 流式流容器：使用父级 gap 保证项间距，块容器用 flow-root 防止 margin 折叠丢失缝隙 */
.monaco-workbench .part.conversation .conversation-timeline-stream {
  display: flex;
  flex-direction: column;
  gap: 12px;
  display: flow-root;
}

/* 3. 根节点项宿主：自适应高度，绝不 overflow: hidden，显式启用文本可选 */
.monaco-workbench .part.conversation .conversation-timeline-item {
  display: block;
  width: 100%;
  min-height: min-content;
  user-select: text; /* 解决 Monaco List 原有 user-select: none 的选择受限问题 */
}

/* 4. 角色头：显式指定 line-height，留足字冠垂直空间，根除削顶 */
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

/* 5. 过程折外层：CSS Grid 动效（流式生成与 reduced motion 时禁用过渡） */
.monaco-workbench .part.conversation .conversation-process-fold-body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.18s cubic-bezier(0.2, 0, 0, 1);
}

.monaco-workbench .part.conversation .conversation-process-fold-body--expanded {
  grid-template-rows: 1fr;
}

.monaco-workbench .part.conversation .conversation-process-fold-children {
  min-height: 0;
  max-height: 320px; /* 严格保留 ADR-046 内滚口 */
  overflow-y: auto;
}

@media (prefers-reduced-motion: reduce) {
  .monaco-workbench .part.conversation .conversation-process-fold-body {
    transition: none !important;
  }
}

.monaco-workbench .part.conversation .conversation-process-fold-body--streaming {
  transition: none !important; /* 流式生成追加时禁用网格过渡，防止反复打断终点 */
}
```

---

## 5. 滚动控制与「单一写入者（Single Writer）」规范

为彻底杜绝滚动条闪烁与视口跳动，确立**单一滚动写入者**铁律：

### 5.1 滚动写入仲裁规则
1. **用户滚轮 / 触摸交互**：
   - 仅改变用户贴底状态标志位 `_scrollLock`（向上滚动设为 `false`，滚回底部设为 `true`）。
   - **绝对不触碰外部 `ConversationAutoScrollHolds` 引用计数**（Hold 仅由外部 Composer、对话框显式申请与释放）。
2. **自动滚底逻辑**：
   - 触发条件：`_scrollLock === true` 且 `autoScrollHolds.isHeld() === false`。
   - 限制：每个动画帧（rAF）至多执行一次 `viewport.scrollTop = viewport.scrollHeight`。
   - 容差：沿用已有的 `isConversationTimelineScrolledToBottom(viewport, 2)`（严格保持 2px 容差）。
3. **冷块注水 / 脱水的高度补偿**：
   - 当视口上方的冷块从占位符注水为真实 DOM（或反向脱水）产生高度差 $\Delta h$ 时：
   - 由 ChunkManager 显式补偿一次 `viewport.scrollTop += deltaHeight`。
   - **在发生补偿的当前帧，临时设置 `viewport.style.overflowAnchor = 'none'`**，并在下一帧恢复为 `auto`，严禁原生锚定与 JS 补偿产生同帧双重叠加。
4. **程序控制滚动（Programmatic Scroll）**：
   - `revealTurn`、`focusRecord`、点击滚底按钮：标记为程序性滚动。
   - 在程序滚动期间暂时忽略 `scroll` 事件监听中的 `_scrollLock = false` 判定，防止误判为用户上翻。
5. **嵌套滚动隔离**：
   - Mermaid Webview 与过程折内部 320px 滚动口具有独立的滚动能力。
   - 当其未到达自身滚动边界时，阻止事件冒泡到外层；仅当内层已达顶部/底部时，才向外层视口传递剩余滚动增量。

---

## 6. 冷热分层与块管理（ChunkManager）

### 6.1 分块原则（基于逻辑根与过程折原子性）
1. **划分对象**：分块基于 `buildTimelineRootIdentities` 产生的**顶级逻辑根（Root Item）**，而不是原始平铺的 turn 下标。
2. **原子性保证**：一个 `process-fold` 无论内部包含多少个 thinking 或 tool-call，作为一个单一逻辑根整体参与分块，**严禁横向切碎折叠块**。
3. **块大小与稳定 ID**：每块包含固定数量（如 24 个）顶级根。块 ID 以其首个根的唯一身份生成（如 `chunk-u1`），在后续增量更新时稳定可追踪。

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

### 6.3 性能防御可观测指标
不设立脱离实际的虚拟指标，以真实工程上限为约束：
- **常驻活根数量上限**：热区保持 36 个根，加上视口附近至多 2 个已注水块，总挂载根稳定在 60~84 个。
- **重型编辑器池化控制**：同时激活的 Monaco Diff Editor 实例数受 `DiffEditorPool` 严格上限控制。
- **单帧重水化预算**：单帧块变更 $\le 1$，保证注水重绘耗时在 16ms 预算内。

---

## 7. 增量 Apply 协调模型（对齐 `applyEntries`）

### 7.1 算法映射
完全继承 `conversationTimelineApply.ts` 产出的 `ConversationTimelineApplyPlan`（§3.4 契约）：

```ts
if (plan.mode === 'baseline') {
    // 全量重建：注销旧 host，清空 DOM，根据根身份重新构造
    this.rebuildStream(plan.spans);
} else if (plan.mode === 'structure') {
    // 结构变更：仅按 root id 进行 Diff，对新增、删除、移动的根进行最小 DOM splice 操作
    this.patchStreamStructure(plan.removedTreeIds, plan.spans);
} else if (plan.mode === 'content') {
    // 内容补丁：绝不触碰 DOM 树结构！仅对 changedIds 对应的 ItemHost 触发局部 refreshPresentation()
    this.patchStreamContent(plan.rerenderIds);
}
```

### 7.2 测试契约兼容（`getTestApplyMetrics`）
为使现有核心单元测试 `conversationTimelineApplyTree.test.ts` 零修改平滑通过，新宿主对外保留测试度量：
- `rebuildCount` 严格映射原 `setChildrenCount`；
- `patchCount` 严格映射原 `rerenderCount`；
- 在 `content` 补丁模式下，确保 `rebuildCount === 0` 且 `patchCount === changedIds.size`，100% 维持增量契约。

---

## 8. 实施路线与切片规划（Slices）

按照小步快跑、针对性验证的原则推进：

### Slice 1：CSS 紧急止血与对齐修复（局部安全止血）
- **目标**：在不推翻树组件的前提下，局部先修好首行文字截断。
- **改动**：
  - 在 `conversationLens.css` 中仅针对 `.conversation-timeline-tree .monaco-tl-row` 覆盖 `align-items: flex-start`（严禁全局污染！）；
  - 为 `.conversation-lens-turn-header` 补足 `line-height: 16px`。
- **验证**：运行现有测试，确认首行截断消失，无全局样式破坏。

### Slice 2：时间线原生文档流宿主（架构核心）
- **目标**：实现 `ConversationTimelineHost`，彻底剔除 `WorkbenchObjectTree`。
- **改动**：
  - 新建 `conversationTimelineHost.ts`，实现 `IConversationTimelineTreeOptions` 相同的完整门面；
  - 构造普通 flex/block 视口与线性 Stream 容器，对接 `setTurns`、`applyEntries`；
  - 补齐 `revealTurn`、`focusRecord`、`getTurnEditHost` 等方法。
- **验证**：单测 `conversationTimelineApplyTree.test.ts` 无损通过。

### Slice 3：思考/工具折叠外层 CSS Grid 动效
- **目标**：彻底解决折叠展开截断与留白死锁。
- **改动**：
  - 重写过程折外层为 CSS Grid 0fr ↔ 1fr，内层保留 320px 滚动口；
  - 流式生成与 reduced motion 时禁用过渡动画；
  - 移除旧有的 `scheduleHeightUpdate`。
- **验证**：折叠展开无卡顿，无尺寸截断，收起后无空白残留。

### Slice 4：滚动、单一写入者与置顶用户气泡适配
- **目标**：将滚动系统迁移至原生 scrollport，严格落实单一写入者。
- **改动**：
  - 接入 `timelineScrollController.ts`，维持 2px 容差与 Hold 独立性；
  - 占位块正确展开覆盖根索引，置顶气泡正常计算。
- **验证**：单测 `conversationTimelineScroll.test.ts` 与 `conversationPinnedUserPrompt.test.ts` 100% 通过。

### Slice 5：冷历史按块卸载（极限性能防御）
- **目标**：实现超长会话（数百至千级 turns）下的内存与渲染保护。
- **改动**：
  - 实现 `timelineChunkManager.ts`，基于逻辑根分块；
  - 视口距离触发脱水注水，安全 dispose 并归还池。
- **验证**：长会话场景下滚动流畅，内存平稳。

### Slice 6：全量测试对齐与代码审查闭环
- **目标**：确保所有单元测试无损通过。
- **改动**：更新 `conversationLensCssScan.test.ts` 中针对树的断言为新宿主断言。
- **验证**：运行 `./scripts/test.sh` 全量通过，完成 Cursor 规则 16 审查归档。

---

## 9. 审查记录（依规则 16 执行）

> 本章记录使用 Cursor CLI（模型：`grok-4.7-xhigh`，模式：`--mode ask` 只读）对本方案的技术审查、发现问题与修改对账。

### 9.1 第一轮审查（Round 1：架构设计与极端性能审查）
- **审查模型**：`grok-4.7-xhigh`
- **初始评级**：`Request Changes`
- **发现核心问题**：
  1. *选择器全局污染*：Slice 1 的 `.monaco-tl-row` 规则若未加前缀会污染工作台所有树视图。
  2. *滚动冲突*：`overflow-anchor: auto` 与 JS `scrollTop` 写入混用会导致滚动跳变闪烁；外部 Hold 与 `_scrollLock` 概念混淆。
  3. *切块模型缺陷*：按原始 turn 下标切块会切碎 `process-fold`，且无法应对内容宽度变化导致的占位高度漂移。
  4. *样式遗漏*：`.conversation-lens-turn-header` 自身缺少 `line-height` 是导致粗体字冠被截断的独立根因。
- **对账与整改闭环**：
  1. [已修改] §1.2 拆分为独立双根因，并在 §4.3 中为角色头补足显式 `line-height: 16px`。
  2. [已修改] §8 Slice 1 明确严禁全局污染，样式严格收窄在 `.conversation-timeline-tree` 内部。
  3. [已修改] 新设 §5「单一滚动写入者」规范，严格理清用户上翻、外部 Hold（绝对不误释放）、贴底、块高度补偿（同帧关闭锚点）四类行为边界，维持 2px 容差。
  4. [已修改] §6 重写分块机制：基于顶级逻辑根分块，过程折作为原子整体不切分；脱水必须调用 `dispose()` 并归还 DiffEditorPool；删掉 `content-visibility` 伪方案与不实性能数字，建立可观测指标。
  5. [已修改] §4.3 过程折保留内层 320px 滚动口与粘性面包屑，仅在外层实施 CSS Grid 开合；流式与减弱动效时禁用过渡。
  6. [已修改] §3、§7 完整补齐 `revealTurn`、`focusRecord`、D27 编辑挂载顺序、置顶索引映射与 `getTestApplyMetrics` 增量契约。

### 9.2 第二轮审查（Round 2：功能完整性与零回归对账审查）
- **状态**：待执行第二轮最终签收审查。
