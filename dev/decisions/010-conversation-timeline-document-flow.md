---
title: "ADR-010 对话时间线原生文档流宿主决策"
type: decision
status: accepted
phase: M7
updated: 2026-09-28
summary: "推翻 conversation-lens-assembly :47「列表虚拟化进复用」既有决策，对话时间线彻底弃用 WorkbenchObjectTree 虚拟列表，迁移至原生文档流宿主，消除测高与流式贴底滞后，配合 content-visibility 与窗口化保障长会话性能"
---

# ADR-010 对话时间线原生文档流宿主决策

## Context

在先前的 B2 壳拓扑装配与时间线设计中（[conversation-lens-assembly.md](../../docs/reference/code-oss-b2/conversation-lens-assembly.md) `:47`），既定的人类决策为：
> 「SessionBar / Inbox / 透镜自研；列表虚拟化、markdown/code、confirmation 零件进复用；权限座位半自研。」

据此，对话透镜时间线（`ConversationTimelineTree`）基于 VS Code 平台的 `WorkbenchObjectTree<ConversationTimelineItem>` 实现，沿用了绝对定位列表虚拟化机制与手工测高代理（`ConversationTimelineDelegate`）。

在后续的真实流式对话演进中，虚拟树暴露出根本性的架构缺陷：
1. **强制同步布局（Layout Thrashing）**：虚拟列表依赖 JS 计算绝对位置，流式 token 增长、过程折开合、代码/Diff 块动态展开都会频繁触发 `ConversationTimelineDelegate.getHeight()`（读取 `offsetHeight` / `scrollHeight`），再调用 `updateElementHeight`，导致频繁重排；
2. **流式贴底天然滞后**：测高与列表重排分步进行，流式输出时自动贴底总滞后一帧，频繁出现削顶或视觉抖动；
3. **嵌套滚动与粘性定位脆弱**：过程折内部的 320px 滚动口与粘性面包屑在虚拟行内难以稳定计算行高；
4. **跨行选区受阻**：离屏 DOM 节点被虚拟化机制卸载，导致跨消息的鼠标划词复制被直接截断。

在 2026-09-28 的重构规划中，用户明确指示「一次重构好，你决定怎么实现，主要是效果和性能，先把方案设计好」。经技术推演，必须在「继续修补虚拟树」与「转向原生文档流」之间做出决断（符合 [DOCUMENTATION.md](../../docs/DOCUMENTATION.md) 规则 4「两方案择一」）。

## Decision

**2026-09-28 经用户明确签收拍定，彻底推翻 `conversation-lens-assembly.md` `:47` 关于「列表虚拟化进复用」的决策，对话时间线全面转向原生文档流宿主（Native Document Flow）：**

1. **废弃虚拟树与测高**：
   - 彻底删除 `ConversationTimelineTree`、`ConversationTimelineDelegate`、`ConversationTimelineRenderer` 与 `ConversationTimelineProcessFoldRenderer`；
   - 新建 `ConversationTimelineHost`，容器为原生 Block 流（`<div role="feed">`），各根节点为普通 `<article>`；高度完全交由现代浏览器的排版引擎自然计算，JS 零测高。
2. **长会话性能兜底体系（D8）**：
   - **离屏跳过**：根节点启用 `content-visibility: auto; contain-intrinsic-block-size: auto 120px`（末尾 3 根、流式根、编辑根与座位保持 `visible`），离开视口自动跳过排版与绘制；
   - **历史窗口化（只增不减）**：打开会话时初次挂载末尾 60 根，向上滚动触碰哨兵时增量补 40 根；最早的未决座位强制包含在初始窗口中，保证座位永不脱水；
   - **重资源存活预算池**：展开的 DiffEditor（上限 6）与 Mermaid Webview（上限 4）在进入视口 1 屏内才挂载，离开视口释放回收并保留等高占位符。
3. **流式 Markdown 词法块冻结（D2）**：
   - 除最后 2 个顶层 token 外，按 marked 块级词法分析增量冻结已渲染节点，尾部 2 块带 `fillInIncompleteTokens` 增量重渲染；L2 落盘后再完整渲染定稿。
4. **原生滚动口与写入台账跟随（D4/D6/D12/D13）**：
   - 采用原生 `overflow-y: auto` 配合浏览器滚动锚定（`overflow-anchor: auto`）；
   - `ConversationTimelineFollowController` 维护写入台账，区分自身写入与用户意图；非自身写入在底部时恢复跟随，发送消息时上锁贴底，展开/收起非末尾根时自动解除跟随并锁定当前 header 位置。

## Consequences

### Positive
- **消灭 Layout Thrashing**：高度由浏览器原生排版计算，彻底消除 JS 频繁测高带来的重排开销；
- **流式贴底平滑无抖动**：流式内容增长与视口贴底同步完成，消除一帧延迟与削顶缺陷；
- **原生排版能力复原**：天然支持跨消息任意划词文本选区、嵌套滚动口与粘性吸顶；
- **长会话表现稳定**：结合 `content-visibility` 与历史窗口化，在 PRD-020 1,000 回合夹具下保持高效（发送到出现 ≤ 200ms，活窗主线程 ≤ 4ms/帧）。

### Negative / Trade-offs
- 不再支持虚拟树原生的键盘快速拼写导航（type-to-navigate），对话场景由 roving tabindex 方向键替代；
- 超长列表或超大表格在流式增长时，其所在单个顶层 token 尾部退化为 O(单块长度)，由 PRD-020 夹具覆盖；
- 既有装配与系统文档需同步更正（`conversation-lens-assembly.md` 等 8 处引用）。

## Alternatives Considered

- **备选 1：保留 `WorkbenchObjectTree` 并参考上游 Chat 引入 ResizeObserver 异步测高**  
  *驳回原因*：仍受困于绝对定位虚拟化、无法原生支持跨消息划词选区与嵌套粘性面包屑，且流式贴底滞后无法根除。
- **备选 2：双宿主或设置开关（虚拟树 + 热尾文档流）**  
  *驳回原因*：状态同步和事件派发复杂度翻倍，维护成本极高，违背用户「一次重构好，不留双宿主和开关」的要求。

## References
- 重构实施方案：[conversation-timeline-refactor.md](../plans/conversation-timeline-refactor.md)（accepted）
- 装配契约文档：[conversation-lens-assembly.md](../../docs/reference/code-oss-b2/conversation-lens-assembly.md)
- 性能需求规范：[requirements.md](../../docs/product/requirements.md) PRD-020
