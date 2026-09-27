---
title: "ADR-009 Preview 类别隔离与 Surface 宿主决策"
type: decision
status: accepted
phase: N/A
updated: 2026-09-27
summary: "在 End 上格 Preview 引入轻量级类别切换条（Code | Artifacts | Planning），底层由独立 EditorGroup 分流隔离，彻底解决非代码制品污染代码 Tab 的问题"
---

# ADR-009 Preview 类别隔离与 Surface 宿主决策

## Context

原上游产品设计（UniverseAgentDesktop / Singularity，如 ADR-243 / ADR-250 及 `ui-interaction-spec.md` §UI-WB-01）在右侧工作区采用 **L1 Surface Kind Strip + L2 SubTab Strip** 的多级 Tab 体系，核心设计目的是**「用分类避免混乱」**：
- 当用户处于 `File` 时，只看到代码文件 SubTabs；
- 处于 `Canvas` 时，只看到交互制品；
- 处于 `Planning` 时，只看到任务板。

在 Code - OSS B2 拓扑手术中，Workbench 右侧被解耦竖切为 **Preview（上格，`Parts.EDITOR_PART`）** 与 **Sources（下格，`Parts.SOURCES_PART`）**（[ADR-051](../../docs/reference/code-oss-b2/desktop-shell-mapping.md)）。其中 `Terminal` 归位底栏 Panel，`Changes`/`Review`/`Files` 归位 Sources。
原 L1 `File` 种类被吸收并同构为 VS Code 原生 `EDITOR_PART` 的 Editor Tabs。

**问题与风险：**
随着产品后续引入 `Canvas`（Agent 持久化交互制品，ADR-309）、`Planning`（任务驱动面）以及 `Project Context`（规则与架构记忆）：
1. 若直接将其作为普通 `EditorInput` 在 Preview 中打开，Preview 的 Tab 栏将不可避免地退化为“代码文件、临时 diff、交互画板、Todo 任务混杂”的混乱大杂烩；
2. 原生 VS Code 缺乏类目维度的隔离，一旦打开 10+ 标签页，找代码和制品的认知成本极高；
3. 但若在 VS Code 顶层重新自研一套脱节的全局多级 Tab，又会破坏 VS Code 原生 EditorGroup 拆分与快捷键体系。

## Decision

**在 End 上格 Preview 内部引入「受控类别隔离（Scoped L1 Categories）」体系：**

1. **类别划分（三类心智域）：**
   - **`Code`（代码，默认）**：源代码、配置文件、Preview 默认 Diff 审阅。
   - **`Artifacts`（交互制品）**：Canvas 画板、React 交互卡片、独立渲染的可视化组件。
   - **`Planning`（规划与上下文）**：任务 Todo 看板、Project Context 上下文概览。

2. **交互呈现：**
   - 在 Preview 标题栏顶部提供轻量级类别切换控件：`[ Code (3) | Artifacts (1) | Planning ]`。
   - 切换时仅切换 Preview 内部展示的活动类别，各类别保持独立的 Tab 栈或视图呈现。
   - 整块 Preview 仍是统一的 `Parts.EDITOR_PART`，受右上四钮中 Preview 开关统一控制显隐。

3. **底层架构与路由分流：**
   - **EditorGroup 类别绑定**：每个类别映射到独立的 `EditorGroup`（或专属的逻辑分组），通过分组可见性切换实现隔离。
   - **输入路由围栏（Routing Fences）**：扩展 `IEditorResolverService` 与 `openEditor` 路由逻辑：
     - 代码文件（URI 为文件 scheme、TextFileEditorInput、DiffEditorInput 等）强制路由到 `Code` 组；
     - 制品类输入（如 `CanvasEditorInput` 等带有 `isArtifactInput` 标记的对象）强制路由到 `Artifacts` 组；
     - 任务类输入强制路由到 `Planning` 组；
     - 未指定目标的外部打开默认遵循类型白名单，坚决不发生跨分类静默污染。

4. **保持与 INV-TOPO 和既有决策的一致性：**
   - **INV-TOPO 依然成立**：中心仍是 `CONVERSATION_PART`，禁止把对话做成 Preview 里的类别。
   - **ADR-002 保持不变**：Conversation 内部内嵌的 `ConversationEditorPartImpl` 依然独立服务于对话 Session 窗口，不与 Preview 类别混同。
   - **ADR-005 保持不变**：Diff 默认进入 Preview 的 `Code` 分类；显式移入 Conversation 或 Panel 仍走已有通道。

## Consequences

- 满足用户「分类避免混乱」的核心初衷，同时保留了 VS Code 原生编辑器成熟的查找、分屏与语法高亮能力。
- 彻底避免未来接入 Canvas / Planning 时导致的 Tab 栏膨胀与视觉噪音。
- 需要在 `EditorPart` / `EditorGroupView` 增加类别切换与分组激活逻辑（见实施方案）。

## Alternatives

- **选项 A（维持现状不做分类）**：所有非代码制品均作为普通 EditorInput 混在同一个 Tab 栏。已由「避免混乱」原则明确否决。
- **选项 B（纯化 Preview，非代码制品全走弹层/抽屉）**：制品完全不能以 Tab 形式并存，无法支持多 Canvas 快速比对或多任务常驻查看，灵活性不足。
- **选项 C（自研脱离 EditorPart 的新 Part）**：为每个制品新增独立的 Workbench Part，将导致屏幕网格过度切碎，加剧视觉拥挤。
