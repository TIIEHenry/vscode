---
title: "ADR-011 Preview 两级标签：类别条独占一行，每个类别有自己的编辑器组"
type: decision
status: accepted
phase: M7
updated: 2026-09-28
summary: "2026-09-28 用户签收。保留两级标签：类别条独占 Preview 顶部一行，七个类别；每个编辑器组属于一个类别。取代 ADR-009 的三类与「或专属的逻辑分组」，否决 HEAD 的单组过滤实现"
---

# ADR-011 Preview 两级标签：类别条独占一行，每个类别有自己的编辑器组

## Context

[ADR-009](009-preview-category-isolation.md) 决定在 Preview 里按类别隔离编辑器，类别条放在 Preview 顶部。底层机制写的是"每个类别映射到独立的 `EditorGroup`（或专属的逻辑分组）"，两条路都留着，没有选。

HEAD 走了第二条路，范围也变了：

1. **机制**：所有类别共用组的模型，标签栏外面套一层按当前类别过滤的视图模型（`CategoryFilteredEditorGroupModel`）；`EditorGroupView.isEmpty` 被改成"当前类别为空"；标题控件在打开编辑器时强切全局类别。类别条挂在最左侧组的标签行里，和编辑器标签同一行。
2. **范围**：类别从三类扩到七类（Overview、Terminal、Code、Web、Planning、History、Artifacts），是在界面补全提交 `1b8ee713696` 里加的，没有改 PRD。

2026-09-28 的架构审查（清单见[实施方案 §2](../plans/preview-category-isolation.md#2-head-事实)）发现，大部分缺陷出自同一个根源：一个组同一时刻只有一个活动编辑器、一份最近使用顺序和一段固定标签前缀。在它上面叠过滤视图，要么视图和模型对"谁是活动编辑器"说法不一（在看起来为空的类别里按"关闭编辑器"会关掉看不见的文件），要么就得改组本身的语义。HEAD 改了 `isEmpty`，于是单组时停在空类别，保存状态会删掉整个编辑器布局；多组时，装着其他类别编辑器的组会被当成空组直接销毁。类别逻辑还因此散进了组视图、标题控件、三种标签控件、水印和命令，并且因为只按"是不是主 Part"判断，漏进了 Agents 窗口和辅助窗。

2026-09-28 用户在会话中定了三点：

1. 保留两级标签。
2. 类别条独占 Preview 顶部一行，放在所有编辑器组之上。
3. 保留现在的七个类别，写进 PRD，并写清 Terminal、History 与底部 Panel、Sources 的分工。

剩下的底层机制属于 [DOCUMENTATION.md](../../docs/DOCUMENTATION.md) 规则 4 的"两方案择一"，由本 ADR 决定。

## Decision

2026-09-28 用户签收。

1. **两级标签。**
   - 第一级是类别条：独占 Preview 顶部一行，高度遵循 [UI 设计原则](../../docs/architecture/cross-cutting/ui-design-principles.md)的区域标题条上限（不高于 28px）。由主 Preview Part 自己画在编辑器网格上方，不用 `Part` 基类的标题区（固定 35px，浮动面板下 32px），也不放进任何组的标签控件。
   - 第二级是每个编辑器组的原生标签栏；标签、固定、预览、脏态、拖放和分屏的语义与上游一致。
2. **七个类别**，顺序固定：Overview、Terminal、Code（默认）、Web、Planning、History、Artifacts。各类别装什么以 [PRD-027](../../docs/product/requirements.md#prd-027-preview-类别隔离与-surface-宿主) 的「类别内容」为准。ADR-009 背景里写的"Terminal 归底部 Panel、Changes / Review / Files 归 Sources"继续成立：Panel 仍是终端的默认位置，Terminal 类别只收开在编辑区的终端；Sources 仍列当前工作区的文件、改动与审阅，History 类别只收用户打开的历史版本。
3. **类别就是组的归属。**
   - 主 Preview 的每个编辑器组恰好属于一个类别。当前类别的组可见；其他类别的组用 `EditorPart.setGroupViewVisible` 隐藏、模型保留，与 `ConversationEditorPartImpl.setGroupHidden` 是同一机制。
   - 切换类别只改组的显隐和活动组，不打开、不关闭、不移动任何编辑器。
   - 类别内分屏只在本类别的组之间发生。当前类别至少保留一个组，空了也保留；其余组照常受 `closeEmptyGroups` 约束。
   - 组的归属按组 id 随编辑器布局一起保存和恢复。
4. **组模型与标签控件不感知类别。** `EditorGroupModel` 和各标签控件不含类别逻辑，HEAD 在组视图、标题控件、标签控件里加的类别分支全部撤回。主 Preview Part 回答「这个组现在可见吗」。路由、可见编辑器、按序号找组和激活隐藏组，都用这个回答，不在那些文件里写类别名。类别的定义和分类规则仍只在类别服务里。这也符合 [ADR-007](007-upstream-sync.md) 对上游只留最小挂点的要求。
5. **路由只在一处。** 打开请求在 `editorGroupFinder` 里、Conversation 围栏之后确定类别：
   - 输入已在某个组里打开、且按现有规则就地显示时，留在那个组，并切到该组的类别再显示。
   - 否则按分类规则确定类别，进该类别最近活动的组，没有就建；`SIDE_GROUP` 相对该类别的活动组分屏。分屏、复制和拖拽新建的组继承来源组的类别，不经过这里。
   - 输入还不在任何组里、而调用方点名的组属于别的类别时，改送到输入所属的类别。
   - 不是「留在原组」的用户主动打开，切到该输入的类别；后台打开（`inactive`）不切，只在目标类别上打提示点。
   - 把编辑器移到别的类别，是把它真正移到那个类别的组里。
6. **作用范围。** 只有默认窗口的主 Preview 分类别：工作台的 `EditorParts.createMainEditorPart` 返回带类别的主 Preview Part，Agents 窗口用自己覆写的 `createMainEditorPart`，辅助窗、模态与 Conversation 内嵌 Part 都不经过它，因此都不分类别。隐藏组里的编辑器仍在打开的编辑器全集里（保存全部、关闭确认照常覆盖），但不算可见编辑器；按方向、序号或列定位组的入口只在当前类别的组里找。

## Consequences

### 正面

- 组的模型语义不再被改写：`isEmpty`、`count`、`activeEditor`、关闭和固定标签都按组本身。审查发现的丢编辑器、静默不关、看不见的活动编辑器、固定标签错位和整栏重建，都从结构上消失。
- 类别内可以分屏；恢复走标准的布局序列化；拖放和"移到类别"都是真实的组操作，不再需要按实例存的归属覆盖。
- 上游文件的改动收回到几个挂点，合并上游时冲突面变小；Agents 窗口、辅助窗和模态天然不受影响。

### 负面 / 代价

- 隐藏组仍在 `getGroups()` 里，而且不能拿掉（保存全部、打开的编辑器列表、关闭确认和布局序列化都依赖全集）。可见编辑器、按序号聚焦、`ViewColumn`、扩展标签组和布局里「编辑区是不是空的」都要改用主 Preview Part 的可见性回答；直接 `openEditor` 激活隐藏组的路径要先切类别。清单见实施方案 §3.7。
- 所有类别的组共用一棵网格：隐藏整条分支、在类别之间拖动组、`applyLayout` 与工作集恢复时的归属，都要专门设计和测试。
- 当前类别的最后一个组不能被 `closeEmptyGroups` 移除；HEAD 的旧布局没有归属表，需要一次迁移。

## Alternatives

- **保留单组过滤视图，补齐不变式**（HEAD 路线）：要保证活动编辑器始终属于当前类别、固定标签下标换算正确、计数统一派生、`isEmpty` 不改义，改动仍散在组视图和三种标签控件里；根源（一个组只有一个活动编辑器和一份最近使用顺序）也不变。否决。
- **每个类别一个嵌套 `EditorPart`**（仿 Conversation 内嵌 Part）：每个类别有独立网格，但 `IEditorGroupsService.mainPart` 是单实例，上游大量逻辑把它当作 Preview 的唯一入口；Preview 编辑器还必须参与全局编辑器聚合，不能像 Conversation 那样退出。改动面远大于本决定。否决。
- **类别条和编辑器标签同一行**（HEAD 形态）：省一行高度，但每次切类别都要把类别条搬到另一个组的标签栏，在分屏、单标签和无标签模式下没有稳定位置，还得继续改标签控件。用户 2026-09-28 选择独占一行。否决。

## 与 ADR-009 的关系

ADR-009 Decision 4（INV-TOPO、ADR-002、ADR-005 的一致性）继续有效。本 ADR 取代 ADR-009 的三处：Decision 1 的三类（改为七类）；Decision 2 里类别条的位置（明确为独占一行）；Decision 3 里"或专属的逻辑分组"（只保留真实的组）。ADR-009 正文不改。

## References

- 需求：[PRD-027](../../docs/product/requirements.md#prd-027-preview-类别隔离与-surface-宿主)；视觉与空态：[PRD-028](../../docs/product/requirements.md#prd-028-视觉语言与信息密度)、[UI 设计原则 §5.4 / §6](../../docs/architecture/cross-cutting/ui-design-principles.md)
- 实施方案：[preview-category-isolation](../plans/preview-category-isolation.md)（v2）
- 系统规格：[editor-part-tabs §6](../../docs/systems/workbench/editor-part-tabs.md)
