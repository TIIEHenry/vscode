---
title: "Navigator tab 适配：按 vscode ViewContainer 重设计子页"
type: reference
status: draft
phase: N/A
updated: 2026-08-31
summary: "对照 Desktop Activity 五段与 Singularity panel 优化稿：每个 Navigator tab 用独立 ViewContainer + vscode 列表/树零件重设计；禁止像素抄 Compose；Engines 不进 Activity"
---

# Navigator tab 适配

> **结构性决策 SSOT** = [`dev/plans/page-access-schemes.md`](../../../dev/plans/page-access-schemes.md)；冲突以父方案为准。

外仓合同（只读，不复制正文）：[IA §2](../../../../UniverseAgentDesktop/docs/product/information-architecture.md)、[ui-interaction-spec](../../../../UniverseAgentDesktop/docs/product/ui-interaction-spec.md)（Agent/Team 发现归 Navigator、inspect 归 Bottom Panel）、Desktop [navigator-activity-segments](../../../../UniverseAgentDesktop/dev/plans/navigator-activity-segments.md)。上游 panel 优化稿只作意图参考：`navigator-{projects,files,agents,team,engines}-design-optimization.md`（均 `draft`，不是本仓合同）。  
本仓事实：[壳映射](desktop-shell-mapping.md) §2、[views-and-composites](../../systems/workbench/views-and-composites.md)、[activity-and-sidebar](../../systems/workbench/activity-and-sidebar.md)、[companion-contribs](../../systems/workbench/companion-contribs.md)、[session-roster-reuse](session-roster-reuse.md)。

本页写 **每个 Activity 段的子页怎么用 vscode 零件重设计**，不是实施切片。**推荐（非正式决策）** 须人类签收。

## 1. 问题

Singularity Navigator 是 **TabLayout + 单一 body**：一段 Activity 换一整块 Compose panel（共享 ActionBar、Body filter、dense row）。Desktop 合同是同一套 **五段**（Projects / Sessions / Files / Agents / Team；**不加 Engines**），但实现必须换 vscode 插入面。

本仓今天：

| Desktop 段 | HEAD 宿主 | 内容 |
|------------|-----------|------|
| Files（默认） | Explorer `VIEW_CONTAINER`（`workbench.view.explorer`，`isDefault: true`） | Folders 树 + Open Editors |
| Sessions | 独立容器 `workbench.view.sessions`（order 10） | `ConversationSessionsView` + stub 列表 |
| Projects / Agents / Team | 独立容器 `workbench.view.navigator.{projects,agents,team}`（order 11–13） | `NavigatorStubView` 一句「not connected — no engine」 |
| Engines | **无** Activity 段 | 对齐 Desktop 本片；连接面走 Settings |

壳映射只写了「honest stub」。Singularity 优化稿里的 Engine→Project→Session 树、Agents Hierarchy/Activity、Team Members/Tasks **不能**原样搬进 Sidebar。要按 vscode 的 `ViewContainer` / `ViewPane` / `WorkbenchList` / `WorkbenchAsyncDataTree` **重设计信息架构与控件**，只保留产品意图。

## 2. 宿主规则（已落地，保持）

```text
ACTIVITYBAR_PART 图标
    → 一个 ViewContainer（Sidebar 单一 body）
        → ViewPaneContainer（mergeViewWithContainerWhenSingleView）
            → 一叶（或少数叶）ViewPane
```

| 规则 | 说明 |
|------|------|
| **一段 = 一个容器** | 不要把 Projects/Agents/Team 塞回 Explorer 当第二叶（HEAD 已拆开；保持）。Sessions 也不回 Explorer。 |
| **默认 Files** | Explorer `isDefault: true` 不变。 |
| **不是 Conversation** | 任何 Navigator tab 都是配套发现面，禁止升格 `CONVERSATION_PART` / `ChatEditor`。 |
| **不是 Workbench L1** | Agents / Team / Prompt **0×** Preview Surface（外仓 UI-INV-08 / UI-WB-01）。 |
| **Engines 不进 rail** | 连接发现 → [Settings 接入](settings-ua-access.md) Connection/Engine 分组。 |
| **hideIfEmpty** | 五段容器均 `hideIfEmpty: true` + 单叶 `canToggleVisibility` / `canMoveView`。用户关掉或搬走唯一叶后 Activity 图标会消失，与「五段常在」张力。v1 **接受**（与 vscode 默认容器同构）；若产品要求图标恒在，签收后改 `hideIfEmpty: false` 或禁 toggle。 |

共享 chrome **不要**复刻 Singularity `NavigatorPanelBar` + Body filter 双行。vscode 合同是：`ViewPane` 标题 + 标题动作 + 可选 `ViewsSubMenu`；过滤用 `WorkbenchList` 自带 filter / 标题 filter action，或 pane 内一行 IDE 风格 input（不自研第二套 Material bar）。

## 3. 各 tab：意图 → vscode 零件（推荐）

### 3.1 Files — 保留 Explorer，不重画树

| | |
|--|--|
| 产品意图 | 工作区树权威；发现后打开到 Preview（`EDITOR_PART`） |
| 本仓 donor | `ExplorerView` / `IExplorerService` / `WorkbenchCompressibleAsyncDataTree`（`contrib/files`） |
| 推荐 | **整容器保留。** 打开仍走 `IEditorService`。不要把 Explorer 搬进 End Sources（[companion-contribs](../../systems/workbench/companion-contribs.md) §4）。 |
| 不要 | 像素抄 Singularity Files scaffold / breadcrumb；Sources Files 是 End **列表投影**，不是第二棵权威树。 |
| Open Editors | 可留在 Explorer 容器内（vscode 习惯）；**不要**拿它冒充 Sources Files。 |

无引擎也成立：树权威是本地工作区，不依赖 UA。

### 3.2 Sessions — 已有方案，本页不重开

产品 roster = `ConversationSessionsView`（`WorkbenchList`）。有引擎后换服务不换 View。详见 [session-roster-reuse](session-roster-reuse.md)。  
**不要**用 Projects 树替代 Sessions（Desktop 五段里 Sessions 是独立段；Singularity Projects 曾吸收 session list，本仓 **不**把两段合成一棵树）。

### 3.3 Projects — 用树/列表重做，不当第二 Sessions

Singularity 意图（只取问题，不取 Compose 树合同）：「有哪些可工作会话，属于哪个 Engine / Project」。Desktop 本片是 **诚实空**，不发假 roster。

| 阶段 | 推荐 UI | vscode 零件 |
|------|---------|-------------|
| 无引擎（保持） | 空态一句 + 可选「Open Folder / Open Workspace」 | 现有 `NavigatorProjectsView`；CTA 走 `workbench.action.files.openFolder` / `openWorkspace`（`IWorkspaceContextService`） |
| 有本地工作区、无 UA | 当前窗口工作区 + 最近工作区 | `IWorkspaceContextService` 当前 folders；`IWorkspacesService.getRecentlyOpened()` → `WorkbenchList` 或 `WorkbenchAsyncDataTree`（两级：Recent / Current）。**不是** UA session catalog |
| 有引擎后 | Engine → Project → Session **只读发现投影** | 同一 `ViewPane` 换 data source；树用 `WorkbenchAsyncDataTree`（可压缩）。Engine 节点 = **分组轴**，不是连接生命周期（连接面仍在 Settings），也不是第二份产品 roster。活动会话只发 `switchSession`（同一 `getActiveSessionId()`），不持久化第二份 catalog |

**禁止：**

- 把 Projects 做成第二份 `ConversationSessionsView`（Sessions 已独占「当前窗会话扁平列表」）。
- 用 `IChatModel` / agentSessions / Copilot workspace picker 冒充 Project。
- 在 Projects 里做 Engine 设置、Files 浏览、Agents 运行树。
- 把 Singularity **ENG-IA-2**（Projects 独占 session list）套到本仓。Desktop 五段里 Sessions 已独立；ENG-IA-2 只用来禁止 Engines 复制 Projects，不是把 Sessions 并进 Projects。

### 3.4 Agents — 发现树，不是 Customizations「Agents」

| | |
|--|--|
| 产品意图 | **当前 session** 的 agent 发现 / 活动导航；深查看进 Bottom Panel，不是 Preview L1 |
| 无引擎 | 保持 honest empty（已落地） |
| 有引擎后 | 一棵 `WorkbenchAsyncDataTree`（hierarchy）；可选第二叶或 `ViewPane` 内 tab strip 做 Activity（工具进行中列表 = `WorkbenchList`） |
| 复用 | 树/列表虚拟化、`ViewPane` 标题动作（Refresh / Filter）。confirmation 零件不进本 tab |
| **禁止** | `AICustomizationManagementEditor` 的 Agents（那是 **文件型 agent 定义**，见 [settings-ua-access](settings-ua-access.md) §4）；`IChatAgentService` participant 列表；恢复 Agent Detail 为 `EDITOR_PART` |

Select 行可切 Conversation 读视图（共享 session 导航态）；**不得**改引擎执行 owner。

**inspect 插入面（未选机制）：** 产品落点 = Bottom Panel（外仓 UI-ROUTE-02）。vscode 侧是 `ViewContainerLocation.Panel`（`PANEL_PART` 的 composite / `ViewPane`），**不是** `EDITOR_PART` Preview tab，也 **不要**把「临时 tab」读成 editor tab。候选（签收前不假装已有）：专用 Panel 容器 + ViewPane，或复用已有 Panel 叶。editor-in-panel 跟 ADR-047 Diff FORK 是另一族，本页不借用。

### 3.5 Team — 成员列表，不是 SCM / Accounts

| | |
|--|--|
| 产品意图 | session-scope 协作发现（成员 / 任务）；inspect 同 §3.4（Panel ViewContainer，机制未选） |
| 无引擎 | honest empty |
| 有引擎后 | `WorkbenchList`（Members）+ 可选第二叶 Tasks；不要搬 Singularity Members/Tasks 双视图的 Material shell |
| **禁止** | GitHub Accounts 菜单、Extensions 市场、把 Team 注册成 Preview Surface、伪造 `team.*` RPC |

### 3.6 Engines — 不进 Activity

产品 roster 有 Engines；Desktop Activity **故意不加**。本仓保持：

- rail **0×** Engines 图标。
- 连接生命周期 → Settings Connection 自定义控件（[settings-ua-access](settings-ua-access.md) §3）。
- 禁止在 Projects 树里再做一份 Engine 工作列表（外仓 Engines 优化稿也禁止 Engines 复制 Projects）。

## 4. 共享零件清单（跨 tab）

| 需求 | 用 | 不用 |
|------|----|------|
| 侧栏宿主 | `ViewContainer` + `ViewPane` + `ViewPaneContainer` | 新 Part、Compose TabLayout |
| 扁平名单 | `WorkbenchList`（Sessions 已用；Team / Recent 同构） | `AgentSessionsControl` |
| 层级 | `WorkbenchAsyncDataTree` / Explorer 已有 compressible 树 | 自研 DOM 树、Singularity dense row 像素 |
| 空态 | `viewsRegistry.registerViewWelcomeContent`（donor：Explorer `EmptyView` 的 command markdown 链）。HEAD stub 是 `renderBody` 一句诚实文案，加 CTA 时改走 welcome content，不要自绘 `Button` | 假行、`contrib/welcomeGettingStarted` walkthrough |
| 标题动作 | `ViewAction` / `MenuId.ViewTitle` | 自研第二 ActionBar |
| 过滤 | 列表 filter / pane 内一行 input | Singularity Body filter 胶囊 |

有引擎后：**换 data source，不换容器 id**（与 Sessions「换服务不换 View」同构）。

## 5. 分阶段

1. **无引擎（已落）：** 五段图标 + Files 真树 + Sessions stub 列表 + 三句 empty。本页不要求改代码。
2. **本地工作区增强（推荐，仍无 UA）：** Projects 空态加 Open Folder / Recent；Files 不动。
3. **引擎：** Projects / Agents / Team 换投影；inspect 只进 `PANEL_PART`（机制见 §3.4，本阶段仍未选）；Sessions 走 roster adapter。

### 会话身份所有权

`getActiveSessionId()` 的 owner 是 Sessions roster 服务（今天 `IConversationStubService`，见 [session-roster-reuse](session-roster-reuse.md) §5）。Projects / Agents 树若投影同一 session id，只发 `switchSession`，**不得**另存一份 active id。本仓不另立法 `INV-NAV-DUP-1`（外仓无此号）。

阶段 2 可在签收后单独切片，不阻塞 M4。

## 6. 非目标

- 不实施本页；不接 `agent.list` / team RPC。
- 不像素复刻 Singularity panel 优化稿（那些稿是 KMP/Compose，且仍 `draft`）。
- 不把 Welcome / Overview / Planning / Project Context / Canvas 写进本页（Workbench Surface，另族）。
- 不改 Activity 通高、四钮、`layout.ts` grid。

## 7. 相关文档

- [壳映射](desktop-shell-mapping.md) · [views-and-composites](../../systems/workbench/views-and-composites.md) · [companion-contribs](../../systems/workbench/companion-contribs.md)
- [session-roster-reuse](session-roster-reuse.md) · [settings-ua-access](settings-ua-access.md)
- 外仓 IA §2 · navigator-activity-segments · ui-interaction-spec（discover / inspect）

## 审查

2026-08-31 已经 Opus 5.0（`claude-opus-5-thinking-high`）审查并改稿。无 Critical。Important：Projects 里 Engine 只作只读分组轴，勿与「Engines 不进 Activity / 连接面在 Settings」打架，也勿套 ENG-IA-2；active id 单一 owner；空态走 `registerViewWelcomeContent`；inspect 的 vscode 插入面未选，Panel ≠ editor tab。
