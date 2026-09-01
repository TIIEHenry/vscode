---
title: "Navigator tab 适配：按 vscode ViewContainer 重设计子页"
type: reference
status: accepted
phase: N/A
updated: 2026-09-01
summary: "@77d6e7cc 五段 Activity 已落产品 chrome（page-access 切片 1a–4 + M5 切片 1–4；D4 closed）：Files=Explorer；Sessions/Projects/Agents/Team 各 ViewPane + WorkbenchList/树 + 内联 filter；inspect→Panel；数据仍 stub/本地工作区；Engines 不进 Activity"
---

# Navigator tab 适配

> **结构性决策 SSOT** = [`dev/plans/page-access-schemes.md`](../../../dev/plans/page-access-schemes.md)；冲突以父方案为准。

外仓合同（只读，不复制正文）：[IA §2](../../../../UniverseAgentDesktop/docs/product/information-architecture.md)、[ui-interaction-spec](../../../../UniverseAgentDesktop/docs/product/ui-interaction-spec.md)（Agent/Team 发现归 Navigator、inspect 归 Bottom Panel）、Desktop [navigator-activity-segments](../../../../UniverseAgentDesktop/dev/plans/navigator-activity-segments.md)。上游 panel 优化稿只作意图参考：`navigator-{projects,files,agents,team,engines}-design-optimization.md`（均 `draft`，不是本仓合同）。  
本仓事实：[壳映射](desktop-shell-mapping.md) §2、[views-and-composites](../../systems/workbench/views-and-composites.md)、[activity-and-sidebar](../../systems/workbench/activity-and-sidebar.md)、[companion-contribs](../../systems/workbench/companion-contribs.md)、[session-roster-reuse](session-roster-reuse.md)。

本页写 **每个 Activity 段的子页怎么用 vscode 零件重设计**。**选定（已签收）** 见父方案；**已落地** = HEAD `@77d6e7cc` 代码事实。页面接入 **切片 1a–4 已落**（父方案 `implemented`）；Navigator 宿主与 inspect 属切片 3，Sessions roster 行为属切片 2；**M5 切片 2** 拥有 roster 选行 show+focus（D4 closed @ [rerun-2230](../../../dev/progress/d4-evidence/rerun-2230/)）。

## 1. 问题

Singularity Navigator 是 **TabLayout + 单一 body**：一段 Activity 换一整块 Compose panel（共享 ActionBar、Body filter、dense row）。Desktop 合同是同一套 **五段**（Projects / Sessions / Files / Agents / Team；**不加 Engines**），但实现必须换 vscode 插入面。

本仓 @ `77d6e7cc`：

| Desktop 段 | HEAD 宿主 | 内容（产品 chrome；数据仍 stub / 本地） |
|------------|-----------|----------------------------------------|
| Files（默认） | Explorer `VIEW_CONTAINER`（`workbench.view.explorer`，`isDefault: true`，`hideIfEmpty: true`） | `ExplorerView` 权威树 + Open Editors（`contrib/files`） |
| Sessions | 独立容器 `workbench.view.sessions`（order 10；`hideIfEmpty: false`） | 叶 `workbench.view.conversationSessions` → `ConversationSessionsView`（`conversationSessionsView.ts`）：`WorkbenchList` 44px 双行 SessionCard、内联 filter、标题 New/Delete；行选 → `switchSession` + 显示并聚焦 `CONVERSATION_PART`（**M5 切片 2** / page-access 切片 2）；数据 = `IConversationRosterService` 内存 stub |
| Projects | 独立容器 `workbench.view.navigator.projects`（order 11） | 叶 `workbench.view.navigatorProjects` → `NavigatorProjectsView`（`navigatorProjectsList.ts`）：无工作区时 `registerViewWelcomeContent`（Open Folder / Recent）；有工作区或 Recent 时 `WorkbenchList`（当前 folders + `IWorkspacesService.getRecentlyOpened()`）+ 内联 filter；`canToggleVisibility: false` |
| Agents | 独立容器 `workbench.view.navigator.agents`（order 12） | 叶 `workbench.view.navigatorAgents` → `NavigatorAgentsView`（`navigatorStubView.ts`）：ViewTitle **Hierarchy / Activity** 子视图切换；Hierarchy = `WorkbenchObjectTree`；Activity = `WorkbenchList`；内联 filter；标题 **Inspect** → `workbench.panel.agentInspect.view`；无引擎时空态文案（非 Copilot 假数据） |
| Team | 独立容器 `workbench.view.navigator.team`（order 13） | 叶 `workbench.view.navigatorTeam` → `NavigatorTeamView`（`navigatorTeamList.ts`）：ViewTitle **Members / Tasks** 子视图；各子视图 `WorkbenchList` + 内联 filter；标题 **Inspect**（同 Agents 单叶）；无引擎时空态 |
| Engines | **无** Activity 段 | 连接面走 Settings → Preferences Connection pane（`ua.connection`） |

五段 **UI 壳与 vscode 零件已按本页选定落地**；Singularity 优化稿里的 Engine→Project→Session 树、Agents Hierarchy/Activity、Team Members/Tasks **不能**像素搬进 Sidebar，但 **子视图结构与控件族已在 HEAD 用 vscode 零件重做**（见 §3.3–3.5）。有引擎后只换 data source，不换容器 id。

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
| **Engines 不进 rail** | 连接发现 → [Settings 接入](settings-ua-access.md) Preferences **Connection pane**。 |
| **hideIfEmpty（选定）** | **产品四段**（Sessions / Projects / Agents / Team）`hideIfEmpty: false` + 唯一叶 `canToggleVisibility: false`（HEAD 已改）。**Files（Explorer）例外（HUMAN_DECISION）：** 维持 vscode 默认 `hideIfEmpty: true`——关尽 Explorer 可见叶后 **Files 图标可消失**；「五段常在」产品合同 = 产品四段恒在，Files 是 vscode 原生多叶容器。 |

共享 chrome **不要**复刻 Singularity `NavigatorPanelBar` + Body filter 双行。vscode 合同是：`ViewPane` 标题 + 标题动作 + 可选 `ViewsSubMenu`；过滤用 `WorkbenchList` 自带 filter / 标题 filter action，或 pane 内一行 IDE 风格 input（不自研第二套 Material bar）。

## 3. 各 tab：意图 → vscode 零件（选定）

### 3.1 Files — 保留 Explorer，不重画树

| | |
|--|--|
| 产品意图 | 工作区树权威；发现后打开到 Preview（`EDITOR_PART`） |
| 本仓 donor | `ExplorerView` / `IExplorerService` / `WorkbenchCompressibleAsyncDataTree`（`contrib/files`） |
| 选定 | **整容器保留。** 打开仍走 `IEditorService`。不要把 Explorer 搬进 End Sources（[companion-contribs](../../systems/workbench/companion-contribs.md) §4）。`hideIfEmpty: true` 维持 vscode 默认（Files 图标可消失，见 §2 HUMAN_DECISION）。 |
| 不要 | 像素抄 Singularity Files scaffold / breadcrumb；Sources Files 是 End **列表投影**，不是第二棵权威树。 |
| Open Editors | 可留在 Explorer 容器内（vscode 习惯）；**不要**拿它冒充 Sources Files。 |

无引擎也成立：树权威是本地工作区，不依赖 UA。

### 3.2 Sessions — 已有方案，本页不重开

产品 roster = `ConversationSessionsView`（`WorkbenchList`，44px 双行 SessionCard；`CONVERSATION_SESSION_ROW_HEIGHT`）。内联 filter（`ConversationSessionsInlineFilterBox`）；标题动作 New / Delete。点击行 → `IConversationRosterService.switchSession`；Conversation 隐藏时亦显示并聚焦 `CONVERSATION_PART`（**M5 切片 2**；Alt+点击 → Open beside）。容器 / 叶：`hideIfEmpty: false`、`canToggleVisibility: false`（page-access 切片 3 断言见 `navigatorStubViews.test.ts`）。有引擎后换服务不换 View。详见 [session-roster-reuse](session-roster-reuse.md)。  
**不要**用 Projects 树替代 Sessions（Desktop 五段里 Sessions 是独立段；Singularity Projects 曾吸收 session list，本仓 **不**把两段合成一棵树）。

### 3.3 Projects — 用树/列表重做，不当第二 Sessions

Singularity 意图（只取问题，不取 Compose 树合同）：「有哪些可工作会话，属于哪个 Engine / Project」。Desktop 本片在无 UA 引擎时展示 **本地工作区发现**，不发假 session roster。

| 阶段 | 选定 UI | vscode 零件 | HEAD @ `77d6e7cc` |
|------|---------|-------------|-------------------|
| 无工作区 | 空态 + Open Folder / Recent CTA | `registerViewWelcomeContent`（`workbench.action.files.openFolder` / `openRecent`） | **已落**（`navigator.contribution.ts`） |
| 有本地工作区、无 UA | 当前窗口 folders + 最近工作区 | `IWorkspaceContextService` + `IWorkspacesService.getRecentlyOpened()` → `WorkbenchList`（`ResourceLabels` 行）+ 内联 filter | **已落**（`navigatorProjectsList.ts`）；**不是** UA session catalog |
| 有引擎后 | Engine → Project → Session **只读发现投影** | 同一 `ViewPane` 换 data source；树用 `WorkbenchAsyncDataTree`（可压缩）。Engine 节点 = **分组轴**，不是连接生命周期（连接面仍在 Settings → Connection pane），也不是第二份产品 roster。活动会话只发 `switchSession`（同一 `getActiveSessionId()`），不持久化第二份 catalog | 待引擎 adapter |

**禁止：**

- 把 Projects 做成第二份 `ConversationSessionsView`（Sessions 已独占「当前窗会话扁平列表」）。
- 用 `IChatModel` / agentSessions / Copilot workspace picker 冒充 Project。
- 在 Projects 里做 Engine 设置、Files 浏览、Agents 运行树。
- 把 Singularity **ENG-IA-2**（Projects 独占 session list）套到本仓。Desktop 五段里 Sessions 已独立；ENG-IA-2 只用来禁止 Engines 复制 Projects，不是把 Sessions 并进 Projects。

### 3.4 Agents — 发现树，不是 Customizations「Agents」

| | |
|--|--|
| 产品意图 | **当前 session** 的 agent 发现 / 活动导航；深查看进 Bottom Panel，不是 Preview L1 |
| 无引擎（HEAD 已落） | `NavigatorAgentsView`：ViewTitle **Hierarchy / Activity** 子视图（`MenuId.ViewTitle` navigation）；Hierarchy = `WorkbenchObjectTree`；Activity = `WorkbenchList`；内联 filter；各子视图诚实空态（「no engine」）；标题 **Inspect** → Panel |
| 有引擎后 | 同一 chrome 换 data source；Activity 列表 = 工具进行中 |
| 复用 | 树/列表虚拟化、`ViewPane` 标题动作（Refresh / Filter）。confirmation 零件不进本 tab |
| **禁止** | `AICustomizationManagementEditor` 的 Agents（那是 **文件型 agent 定义**，见 [settings-ua-access](settings-ua-access.md) §4）；`IChatAgentService` participant 列表；恢复 Agent Detail 为 `EDITOR_PART` |

Select 行可切 Conversation 读视图（共享 session 导航态）；**不得**改引擎执行 owner。

**inspect（选定，HEAD 已注册）：** 专用 Panel 容器 **`workbench.panel.agentInspect`** + 单叶 view id **`workbench.panel.agentInspect.view`** + `AgentInspectView`（`agentInspect.contribution.ts`）。Agents/Team 行 action「Inspect」→ `ViewsService.openView` 打开 Panel 叶。**v1 单叶**：Agents/Team 共用同一 view id + 同一 ctor；第二叶 id 显式延期（可与 §9.6 EH 矩阵一起定）。**不是** `openEditor` Preview tab，**不是** editor-in-panel（ADR-047 Diff FORK 另一族）。容器 `order: 50`，`hideIfEmpty: true`（inspect 非常在产品轨，默认折叠）。

### 3.5 Team — 成员列表，不是 SCM / Accounts

| | |
|--|--|
| 产品意图 | session-scope 协作发现（成员 / 任务）；inspect 同 §3.4（专用 Panel 容器，v1 单叶） |
| 无引擎（HEAD 已落） | `NavigatorTeamView`：ViewTitle **Members / Tasks** 子视图；各子视图 `WorkbenchList` + 内联 filter；诚实空态；标题 **Inspect**（与 Agents 共用 `workbench.panel.agentInspect.view`） |
| 有引擎后 | 同一 chrome 换 Members / Tasks 投影 |
| **禁止** | GitHub Accounts 菜单、Extensions 市场、把 Team 注册成 Preview Surface、伪造 `team.*` RPC |

### 3.6 Engines — 不进 Activity

产品 roster 有 Engines；Desktop Activity **故意不加**。本仓保持：

- rail **0×** Engines 图标。
- 连接生命周期 → Settings TOC 链接 → Preferences **Connection pane**（`ua.connection`；见 [settings-ua-access](settings-ua-access.md)）。
- 禁止在 Projects 树里再做一份 Engine 工作列表（外仓 Engines 优化稿也禁止 Engines 复制 Projects）。

## 4. 共享零件清单（跨 tab）

| 需求 | 用 | 不用 |
|------|----|------|
| 侧栏宿主 | `ViewContainer` + `ViewPane` + `ViewPaneContainer` | 新 Part、Compose TabLayout |
| 扁平名单 | `WorkbenchList`（Sessions 44px SessionCard；Projects / Team / Agents Activity 22px 行；HEAD 已用） | `AgentSessionsControl` |
| 层级 | `WorkbenchObjectTree` / `WorkbenchAsyncDataTree`（Agents Hierarchy 已用；有引擎后 Projects 树） | 自研 DOM 树、Singularity dense row 像素 |
| 空态 | `registerViewWelcomeContent`（Projects 无工作区）+ pane 内诚实空态 DOM（Agents/Team/Sessions 无数据） | 假行、`contrib/welcomeGettingStarted` walkthrough |
| 标题动作 | `ViewAction` / `MenuId.ViewTitle`（子视图切换 Hierarchy/Activity、Members/Tasks、Inspect 已用） | 自研第二 ActionBar |
| 过滤 | pane 内一行 IDE input（`*InlineFilterBox` 族；HEAD 四段均已用） | Singularity Body filter 胶囊 |
| inspect | Panel 容器 `workbench.panel.agentInspect` | Preview `EditorInput` |

有引擎后：**换 data source，不换容器 id**（与 Sessions「换服务不换 View」同构）。

## 5. 分阶段

1. **无引擎产品 chrome（已落 @ `77d6e7cc`）：** page-access **切片 1a–4** + **M5 切片 1–4**（D4 closed）。五段 Activity 图标；Files = Explorer 真树；Sessions / Projects / Agents / Team 各 `ViewPane` 产品壳（列表/树、内联 filter、子视图切换、Inspect）；Panel inspect 容器 `workbench.panel.agentInspect` v1 单叶；产品四段 `hideIfEmpty: false` + 唯一叶 `canToggleVisibility: false`。
2. **本地工作区 Projects 列表（已落）：** `NavigatorProjectsView` 当前 folders + Recent；与 Explorer 树 **重复可接受**（发现面 vs 权威树，父方案 C10）。
3. **引擎（切片 5+）：** Projects / Agents / Team 换 UA 投影；inspect 叶接引擎 payload；Sessions 走 roster adapter；StatusBar 芯片可切 Engine pane。

### 会话身份所有权

`getActiveSessionId()` 的 owner 是 Sessions roster 服务（今天 `IConversationRosterService`，decorator id `'conversationStubService'`，见 [session-roster-reuse](session-roster-reuse.md) §5）。Projects / Agents 树若投影同一 session id，只发 `switchSession`，**不得**另存一份 active id。本仓不另立法 `INV-NAV-DUP-1`（外仓无此号）。

## 6. 非目标

- 不像素复刻 Singularity panel 优化稿（那些稿是 KMP/Compose，且仍 `draft`）。
- 不把 Welcome / Overview / Planning / Project Context / Canvas 写进本页（Workbench Surface，另族）。
- 不改 Activity 通高、四钮、`layout.ts` grid。

## 7. 相关文档

- [壳映射](desktop-shell-mapping.md) · [views-and-composites](../../systems/workbench/views-and-composites.md) · [companion-contribs](../../systems/workbench/companion-contribs.md)
- [session-roster-reuse](session-roster-reuse.md) · [settings-ua-access](settings-ua-access.md)
- 外仓 IA §2 · navigator-activity-segments · ui-interaction-spec（discover / inspect）
- 父方案：[page-access-schemes.md](../../../dev/plans/page-access-schemes.md) §1.3 / §5

## 审查

2026-08-31 已经 Opus 5.0（`claude-opus-5-thinking-high`）审查并改稿。无 Critical。Important：Projects 里 Engine 只作只读分组轴，勿与「Engines 不进 Activity / 连接面在 Settings」打架，也勿套 ENG-IA-2；active id 单一 owner；空态走 `registerViewWelcomeContent`。

2026-09-01 按父方案 §12 同步：产品四段 `hideIfEmpty: false` + 禁 toggle；Files 例外；inspect 钉 `workbench.panel.agentInspect` v1 单叶；连接面 → Preferences Connection pane；与 HEAD 对齐。

2026-09-01 **status → accepted**；按 HEAD `@77d6e7cc` 同步五段事实：Sessions 44px roster + M5 切片 2 show+focus；Projects `navigatorProjectsList` WorkbenchList；Agents Hierarchy/Activity 子视图；Team Members/Tasks 子视图；移除「honest stub only」表述（产品 chrome 已落，数据仍 stub/本地）。page-access 切片 1a–4 `implemented`；D4 closed @ rerun-2230。
