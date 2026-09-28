---
title: "Conversation 时间线消息列表架构重构：文档流排版与冷热分层渲染"
type: plan
status: draft
phase: M7
updated: 2026-09-28
summary: "根除树组件引入的消息首行裁切（如 AGENT 削顶）与折叠展开高度死锁；架构与性能优先，功能零回归；参考 DeepSeek / zcode 范式，将时间线从 WorkbenchObjectTree 重构为「热尾普通文档流 + 冷历史按块卸载」；高度交给 Chromium 排版引擎自适应，折叠采用现代 CSS Grid 动效，滚动对齐 overflow-anchor 与 AutoScrollHold，完好保留既有 6 大类交互座与增量 apply 模型。"
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
1. **Item 顶部裁切削平**：在助手消息（Assistant Turn）中，首行角色的文字顶端（如大写 `AGENT` 的 A/G/E/N/T 顶部）被整齐削平；折叠条（`> Stub · 4 steps...`）顶边内边距也出现反常收缩。
2. **折叠/展开高度无法自适应**：思考过程（Thinking）与工具调用（Tool Calls）在折叠展开后，内部内容被 `overflow: hidden` 截断；或折叠回去后，下方留出几十至上百像素的空白空洞。
3. **流式输出卡顿与跳动**：流式生成 Markdown、图片与 Mermaid 异步渲染时，高度调整依赖手动通知和重绘，滚动体验存在抖动。

### 1.2 系统性技术根因（Root Cause）
经过代码追踪与 DOM 布局排查，上述现象并非单纯的 CSS margin/padding 疏漏，而是**底层选型与测量机制的系统性技术死锁（Impedance Mismatch）**：

```
+-----------------------------------------------------------------------------------+
| WorkbenchObjectTree (基于 AbstractTree / ListView)                               |
|                                                                                   |
|  .monaco-list-row [position: absolute; overflow: hidden; height: 固定估算值 (72px)]   |
|   |                                                                               |
|   +--> .monaco-tl-row [display: flex; height: 100%; align-items: center;]         |
|         |                                                                         |
|         +--> .monaco-tl-contents [height: 100%; overflow: hidden;]                |
|               |                                                                   |
|               +--> .conversation-lens-turn (真实内容高度: ~92px)                    |
|                     - 顶部因 flex 居中被推向负坐标 [-10px]                          |
|                     - 负坐标越界部分被 overflow: hidden 削平 -> 首行 AGENT 削冠!    |
|                     - scheduleHeightUpdate 测量的目标是 height:100% 的 contents   |
|                       始终测出 72px -> 无法更新真实尺寸 -> 测量死锁!                   |
+-----------------------------------------------------------------------------------+
```

1. **树控件样式污染**：`AbstractTree` 强行包裹的 `.monaco-tl-row` 自带 `align-items: center`，当虚拟列表 Delegate 预估高度（72px）小于内容真实高度（~92px）时，内容在垂直方向上下对称居中，导致顶部向负坐标溢出，被父级 `overflow: hidden` 削平。
2. **测量闭环死锁**：`scheduleHeightUpdate` 读取的是 `.monaco-tl-contents` 的 `offsetHeight`，而该节点在 CSS 中受 `height: 100%` 约束，其尺寸已经被锁死在 `monaco-list-row` 的行高上，内部元素无论是展开还是收起，外部永远读取到旧高度。
3. **架构错位**：会话时间线本质是一维文档流（Linear Document Flow）。当前过程折（`process-fold`）在模型上已经通过 ADR-046 投影为扁平单层根，树控件原有的缩进线（Indent）、折叠三角（Twistie）、黏性滚动（Sticky Scroll）均已被手动关闭，却平白承受了绝对定位虚拟列表的巨大复杂性与排版副作用。

---

## 2. 架构选型与对标分析（参考 DeepSeek / zcode）

现代顶级 AI 客户端（DeepSeek、zcode 等）普遍摒弃了「每个消息绝对定位、JS 全权计算高度」的静态虚拟列表。

### 2.1 选型矩阵对比

| 评估维度 | 现行方案 (`WorkbenchObjectTree`) | 方案甲：纯原生 DOM 文档流 | 方案乙：自研流式虚拟列表 | **方案丙（推荐）：热尾文档流 + 冷历史按块卸载** |
| :--- | :--- | :--- | :--- | :--- |
| **高度所有权** | JS 算法与 VirtualDelegate | 浏览器排版引擎（Layout Engine） | JS 前缀和树与二分查找 | **热区排版引擎自适应；冷区由占位高度维持** |
| **折叠展开** | 需 JS 强制测量并触发重排，易截断 | 100% 天然自适应，零 JS 测量 | 每次展开需重算后续所有项 `top` | **热区内完全自适应；冷区冻结高度无需重算** |
| **流式排版体验** | 存在高频重测与像素跳动 | 极度丝滑，文字自然换行撑开 | 滚动条与视口频繁抖动 | **热区极度丝滑；流式行始终处于热区** |
| **DOM 节点压力** | 极低（视口级复用） | 随着回合增加单调线性递增 | 较低（视口级复用） | **常驻仅 50~80 个节点，超长会话恒定** |
| **重型资源管理** | 依赖虚拟列表的 mount/unmount | 若不卸载，Diff/Mermaid 占用巨大 | 需复杂的 Webview 回收协议 | **离开热区时由 Host 级统一步伐归还至对象池** |
| **视口与滚动锚定** | 依赖脆弱的 JS 手工 Hold 补丁 | 原生 `overflow-anchor: auto` | 算法极度复杂，易与自动滚底冲突 | **结合原生滚动锚定与经典 AutoScrollHold 引用计数** |
| **推荐适用场景** | 静态树形目录（文件树/大纲树） | 短会话（<150 回合） | 社交聊天（固定单行/简短气泡） | **重型 Agent 编程 IDE 会话（含长代码、Diff、思考折叠）** |

### 2.2 目标架构：方案丙（热尾文档流 + 冷历史按块卸载）
- **热区（Active Hot Tail）**：当前活跃的最近 30~50 个消息项（包含正在流式输出的消息、刚执行完毕的工具调用、最近的用户提问），全部置于 Chromium 原生文档流中。排版、换行、折叠展开 100% 交给浏览器排版引擎，**彻底消除削顶与截断**。
- **冷区（Frozen Cold Chunks）**：离开视口向上超过 100+ 回合的历史消息，按 Chunk（例如每 24 个 turn 为一个 Block）打包。未进入视口时，整个 Chunk 替换为一个具有固定高度的占位元素（Placeholder），释放内部庞大的 DOM 节点、Markdown 抽象语法树与重型编辑器（Monaco Diff Editor / Webview）。
- **滚动条连续性**：利用 Chunk Placeholder 的累积高度，滚动条全行程保持精准，不会发生滚动条突然跳跃变长或变短。

---

## 3. 功能完整性保证矩阵（功能不能少）

本次重构必须做到**既有功能 100% 覆盖、零退化、零缺失**：

| 功能大类 | 具体能力项 | 原实现位置 | 重构后承接位置与机制 | 验证标准 |
| :--- | :--- | :--- | :--- | :--- |
| **1. 用户回合** | 纯文本气泡展示 | `conversationUserBubbleCollapse.ts` | `TimelineUserTurnRenderer`，原生 flex 靠右 | 气泡圆角、背景与文本一致 |
| | 长文本折叠 / 展开 | 同上（Show more / less） | 保持原阈值与动画，原生自适应撑开 | 展开时不截断，折叠后无空白 |
| | 点击气泡进入编辑 | `onEditUserTurn` + composer host | 挂载到 host，保持 D27 顺序要求 | 点击激活 Dock 编辑框，原位置高亮 |
| | 文本复制功能 | `onCopyTurn` + CopyButton | 原生按钮事件委托，不丢失剪贴板能力 | 单元测试验证复制 payload 正确 |
| **2. 助手回合** | 流式 Markdown 渲染 | `conversationTurnContentAdapter.ts` | 保持不变，单点注入，增量文本更新 | 流式输出逐行生长无抖动 |
| | 代码高亮与操作栏 | `chatContentCodePools` + 工具栏 | 保持代码块复制、运行、插入等功能 | 代码块语法高亮完整 |
| | 会话 Pill 链接与悬浮 | `conversationSessionPill.ts` | 保持 `conversation-chat` 单点分流与 hover | Pill 点击跳转至指定子代理/会话 |
| | 回合重新生成 / 复制 | `onRegenerateTurn` / `onCopyTurn` | 助手行底操作栏原生渲染 | 触发模型重试，原消息状态转换 |
| | 轨迹透镜跳转 | `onViewInTrajectory` | 助手头部及操作栏按钮跳转 | 联动切换 Trajectory 透镜并定位 |
| **3. 思考与工具折叠** | 思考内容展开/收起 | `conversationProcessFold.ts` | CSS Grid 原生伸缩动画（0fr ↔ 1fr） | 展开无高度上限限制，收起零高度残留 |
| | 工具调用状态与参数 | 同上（tool row） | 原生 block，执行态 spinner 动效 | loading 图标、参数卡片展示完整 |
| | 工具 Diff 对比卡片 | `DiffEditorPool` | 保持向 pool 借用，离开热区自动归还 | 工具修改 diff 展开即看，内存受控 |
| | 取消工具 / 客户端工具响应 | `onCancelToolCall` / `onRespondClientTool` | 原生按钮事件绑定 | 用户点击取消/响应能正确通知上游 |
| | 粘性面包屑（Sticky Breadcrumb） | `conversation-process-fold-sticky-breadcrumb` | 原生 CSS `position: sticky; top: 0` | 内部滚动时面包屑紧贴上沿 |
| **4. 交互组件** | 权限确认卡片 | `ConversationConfirmationSeat` | 原生独立卡片挂载，不可被丢弃 | Allow/Skip 响应，状态持久化保留 |
| | 用户提问互动卡片 | `ConversationQuestionSeat` | 单选/多选/输入互动座，原生表单控件 | 回答后提交至 agent，卡片状态切换 |
| | ReviewNav 卡片 | `conversation-review-nav` | 独立导航卡片，点击打开文件审查 | 点击调起 Review 对比界面 |
| | Mermaid 可视化卡片 | `ConversationVisualizeCard` | 保持 Webview 宿主，全屏查看与滚轮转发 | 图表完整渲染，双向滚轮不抢夺 |
| **5. 滚动与视口** | 平滑滚底与滚动锁定 | `conversationTimelineScroll.ts` | 原生 `scrollTop = scrollHeight` + 容差判断 | 发送新消息后平滑落底 |
| | 自动滚动 Hold 机制 | `ConversationAutoScrollHolds` | 保持引用计数模型，向上滚动绝不强拉 | 用户向上翻阅时新 token 不抢滚 |
| | 滚动到底部悬浮按钮 | `scrollDownButton` | 原生绝对定位按钮，未到底部时浮现 | 点击立即回底，回到视野后自动淡出 |
| | 置顶当前用户提问气泡 | `conversationPinnedUserPrompt.ts` | 保留 `resolvePinnedUserPromptState` 算法 | 滚动脱离时顶部浮出最近用户提问 |
| **6. 增量 Apply 契约** | Baseline / Structure / Patches | `conversationTimelineApply.ts` | 保持增量更新计划计算，最小化 DOM 操作 | 避免无意义的全量清空与重绘 |

---

## 4. 目标架构详细设计

### 4.1 组件拓扑与职责划分

```
src/vs/workbench/contrib/conversation/browser/
├── conversationTimelineHost.ts          // 替代 ConversationTimelineTree：外层门面与原生滚动宿主
├── timeline/
│   ├── timelineScrollController.ts      // 滚底、AutoScrollHold 引用计数、滚动到底部按钮
│   ├── timelinePinnedUserController.ts  // 滚动时计算并更新置顶的用户提问
│   ├── timelineItemHost.ts              // 每一个回合或折叠项的 DOM 包装容器（带 data-turn-id）
│   ├── timelineChunkManager.ts          // 冷热分层管理：热区挂载、冷区占位高度维持
│   └── renderers/
│       ├── timelineTurnRenderer.ts      // 用户/助手消息渲染（Markdown、Pills、Actions）
│       ├── timelineProcessFoldRenderer.ts // 思考与工具折叠渲染（CSS Grid 动效、Diff 卡片）
│       └── timelineSeatRenderer.ts      // 权限座、提问座、ReviewNav、Mermaid 专用卡片
└── media/
    └── conversationTimeline.css         // 全新文档流排版样式，剔除 tree.css 污染
```

### 4.2 容器与 DOM 排版模型（彻底告别绝对定位）

全新的时间线容器 DOM 结构如下：

```html
<div class="conversation-timeline-scroll-host">
  <!-- 置顶用户提问浮层 -->
  <div class="conversation-timeline-pinned-user">...</div>

  <!-- 原生滚动内容区 -->
  <div class="conversation-timeline-viewport">
    <!-- 冷历史分块占位（未激活时） -->
    <div class="conversation-timeline-chunk-placeholder" style="height: 1280px;" data-chunk-id="chunk-0"></div>

    <!-- 热区真实 DOM 列表（普通块文档流） -->
    <div class="conversation-timeline-stream">
      <!-- 用户回合 -->
      <article class="conversation-timeline-item" data-turn-id="u1" data-kind="user">
        <div class="conversation-timeline-user-bubble">...</div>
      </article>

      <!-- 思考与工具折叠（process-fold） -->
      <article class="conversation-timeline-item" data-turn-id="fold-1" data-kind="process-fold">
        <div class="conversation-process-fold">
          <button class="conversation-process-fold-header">...</button>
          <div class="conversation-process-fold-body">
            <div class="conversation-process-fold-content">...</div>
          </div>
        </div>
      </article>

      <!-- 助手回合 -->
      <article class="conversation-timeline-item" data-turn-id="a1" data-kind="assistant">
        <header class="conversation-timeline-header">
          <span class="conversation-timeline-role">AGENT</span>
          <span class="conversation-timeline-agent-identity">Stub</span>
        </header>
        <div class="conversation-timeline-markdown-body">...</div>
      </article>
    </div>
  </div>

  <!-- 滚底快捷悬浮按钮 -->
  <div class="conversation-timeline-scroll-down">...</div>
</div>
```

### 4.3 核心 CSS 排版规则（解决削顶与自适应）

在 `conversationTimeline.css` 中确立规则：
```css
/* 1. 视口与滚动：启用浏览器原生滚动锚定与呼吸内边距 */
.conversation-timeline-viewport {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  overflow-anchor: auto; /* 关键：上方折叠/展开或内容注入时视口天然锚定 */
  display: flex;
  flex-direction: column;
  padding: 16px 20px 32px;
  box-sizing: border-box;
}

/* 2. 消息项宿主：普通文档流块，高度 100% 自适应，绝不设置 overflow: hidden */
.conversation-timeline-item {
  display: flex;
  flex-direction: column;
  width: 100%;
  margin-bottom: 16px;
  min-height: min-content;
  box-sizing: border-box;
}

/* 3. 角色头部：显式指定 line-height，防止字体字冠被贴边截断 */
.conversation-timeline-header {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  line-height: 16px; /* 关键：为大写粗体文字留出充足垂直空间 */
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--vscode-descriptionForeground);
  margin-bottom: 6px;
}

/* 4. 折叠动画：现代 CSS Grid 0fr ↔ 1fr 模式（零 JS 测量，极致流畅） */
.conversation-process-fold-body {
  display: grid;
  grid-template-rows: 0fr;
  transition: grid-template-rows 0.2s cubic-bezier(0.2, 0, 0, 1);
  overflow: hidden;
}

.conversation-process-fold-body--expanded {
  grid-template-rows: 1fr;
}

.conversation-process-fold-content {
  min-height: 0; /* 必须设置，允许子元素在 0fr 时折叠收起 */
}
```

### 4.4 滚动控制与 AutoScrollHold 模型

继承并升级 `conversationTimelineScroll.ts`：
1. **自动滚底判断（Bottom Tolerance）**：
   ```ts
   function isScrolledToBottom(viewport: HTMLElement, tolerance = 4): boolean {
     return viewport.scrollHeight - viewport.scrollTop - viewport.clientHeight <= tolerance;
   }
   ```
2. **AutoScrollHold 引用计数**：
   - 当用户主动向上滚动查看历史时，通过 `wheel` 或 `touchstart` 自动获取 Hold；
   - 处于 Hold 期间，新到达的 Token 或流式增量**绝不强拉视口**；
   - 用户滚动回底部时，释放所有 Hold 并重新吸附。
3. **原生滚动锚定（Scroll Anchoring）**：
   - 浏览器原生 `overflow-anchor: auto` 会在用户阅读上方历史时，自动修正下方由于图片加载或折叠引起的几何偏移，无需 JS 复杂的重平衡算法。

---

## 5. 性能边界与冷热分层策略（1000+ Turns 防御）

### 5.1 场景性能预期

| 会话规模 | DOM 策略 | 内存预期 | 帧率预期 |
| :--- | :--- | :--- | :--- |
| **日常会话（1~100 turns）** | 纯原生文档流，全量常驻 | < 15 MB | 稳定 60 FPS，零白边 |
| **中型会话（100~300 turns）** | 启用 `content-visibility: auto` 跳过绘制 | < 30 MB | 稳定 60 FPS |
| **极限长上下文（1000+ turns）** | 激活 `TimelineChunkManager` 冷历史分块卸载 | 恒定 < 45 MB | 稳定 60 FPS，滚动条丝滑 |

### 5.2 块管理（Chunking）机制
1. **分块边界**：每 24 个回合封装为一个逻辑 Chunk。
2. **热尾豁免**：最近的 2 个 Chunk（约 48 个 items）永远作为热区常驻，绝不卸载。
3. **离开视口卸载**：当上方的 Chunk 距离当前视口顶部超过 2 屏时，触发 DOM 节点脱水（卸载），记录最后测得的 `clientHeight`，替换为固定高度的 `placeholder`。
4. **滚入视口重水化**：当用户向上滚动靠近冷区（提前 1 屏缓冲）时，重新挂载该 Chunk 的 DOM 节点，保持用户浏览无缝。

---

## 6. 实施路线与切片规划（Slices）

按照小步快跑、针对性验证的原则推进：

### Slice 1：CSS 紧急止血与对齐修复（快速消除截断）
- **目标**：在不推翻树组件的前提下，先修好视觉截断 Bug。
- **改动**：在 `conversationLens.css` 中覆盖 `.monaco-tl-row { align-items: flex-start !important; }`，给 `.conversation-lens-timeline-row` 补充 `padding-top: 4px` 与 line-height。
- **验证**：运行现有测试，确认首行截断消失，且无任何单测失败。

### Slice 2：时间线原生宿主与文档流基础（架构核心）
- **目标**：实现 `ConversationTimelineHost`，剥离 `WorkbenchObjectTree`。
- **改动**：
  - 建立 `conversationTimelineHost.ts`，实现 `IConversationTimelineTreeOptions` 相同的外部门面。
  - 构造普通 flex/block 容器，支持 `setTurns`、`applyEntries`。
- **验证**：替换入口挂载，验证回合基本渲染。

### Slice 3：思考/工具折叠与 CSS Grid 动画重构
- **目标**：彻底解决折叠展开截断与留白死锁。
- **改动**：重写 `renderProcessFoldSpan`，移除 JS 高度回调，接入 CSS Grid 0fr ↔ 1fr 动效。
- **验证**：反复点击展开与收起，确认内容 100% 完整展示，折叠后零空白残留。

### Slice 4：滚动、AutoScrollHold 与置顶用户气泡适配
- **目标**：将滚动系统从虚拟列表平滑迁移至原生 scrollport。
- **改动**：迁移 `conversationTimelineScroll.ts` 与 `conversationPinnedUserPrompt.ts` 监听至原生容器。
- **验证**：单测 `conversationTimelineScroll.test.ts` 与 `conversationPinnedUserPrompt.test.ts` 100% 通过。

### Slice 5：冷历史按块卸载（极限性能防御）
- **目标**：实现 1000+ 极限 turns 下的内存与渲染保护。
- **改动**：实现 `TimelineChunkManager`，只在超过 100 回合时激活分块卸载。
- **验证**：长会话压测夹具（PRD-020 scale fixture）验证内存与滚动流畅度。

### Slice 6：全量测试对齐与代码审查闭环
- **目标**：确保所有单元测试（`conversationTimelineApplyTree.test.ts`、`conversationLens.test.ts` 等）无损通过。
- **验证**：运行 `./scripts/test.sh`，完成 Cursor 最终只读审查并归档。

---

## 7. 审查记录（依规则 16 执行）

> 本章记录使用 Cursor CLI（模型：`grok-4.7-xhigh`，模式：`--mode ask` 只读）对本方案的技术审查、发现问题与修改对账。

### 审查纪要（待执行）
*(方案将在下一阶段由 Cursor Agent 进行逐条深度批判审查并回填修改项)*
