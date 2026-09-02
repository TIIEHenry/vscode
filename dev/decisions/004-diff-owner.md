---
title: "ADR-004 Diff 深查看宿主：底部 Panel 专用容器"
type: decision
status: superseded
phase: N/A
updated: 2026-09-02
summary: "PRD-009 Diff owner：推荐 B（PANEL_PART 专用容器，对照 Desktop ADR-047）；否决 A（HEAD 编辑器区）与 C（Sources Changes 内嵌）。已被 ADR-005 取代。"
---

> **Superseded by [ADR-005](005-changes-diff-owner.md) @ 2026-09-02**（user decision: default Preview, movable to conversation/panel — NOT exclusive Panel B）

# ADR-004 Diff 深查看宿主

## 状态

`superseded`（2026-09-02。原推荐 B，**未签收**；用户裁决见 [ADR-005](005-changes-diff-owner.md)。）

关联：[PRD-009](../../docs/product/requirements.md#prd-009-changes-与-diff) · [R6](../progress/research-queue.md) · [diff-footprint](../../docs/reference/code-oss-b2/diff-footprint.md) · [companion-contribs §5](../../docs/systems/workbench/companion-contribs.md) · [parts-and-grid](../../docs/systems/workbench/parts-and-grid.md) · 外仓 [Desktop ADR-047](../../../UniverseAgentDesktop/dev/decisions/047-typed-slot-hosts-and-vscode-bottom-panel.md) · [ADR-051](../../../UniverseAgentDesktop/dev/decisions/051-workbench-preview-and-sources.md)

## Context

[PRD-009](../../docs/product/requirements.md#prd-009-changes-与-diff) 要求 Sources 有 Changes，且文件级 Diff **有明确打开位置**。验收标准未决，直到 Diff owner 选定。对照合同（Desktop ADR-047 `INV-047-DIFF-OWNER`）：Diff 深查看 **0× L1 / 不进 Changes 内嵌**，路由 Bottom Panel。HEAD 落点是 End 列 `EDITOR_PART`（Preview）。这是未选分叉，不是「已实现但待验证」。

HEAD 代码事实：

- `openSourcesChangeEntry`（`contrib/sources`）有 `scmResource` 时走 `ISCMResource.open`（与 SCM 视图相同，典型结果 = `EDITOR_PART` Diff / multi-diff）；无 SCM 资源时回退 `IEditorService.openEditor` 打开文件。单测锁住这条路径。
- Chat 编辑会话 `ChatEditingSession.show()` → `MultiDiffEditor` 同样落 `EDITOR_PART`（[tools-and-editing](../../docs/systems/chat/tools-and-editing.md)）。
- 编辑器内 QuickDiff 是 File 行内提示，不是深查看面。
- Sources 三 tab 已落：Changes = 清单 + stage/unstage/commit；Review = 只读清单。两者都经 `openSourcesChangeEntry`，**不是**内嵌 diff。

四钮与互斥（不得为 Diff 改公式）：

| 约束 | HEAD |
|------|------|
| 四钮 | titlebar `LayoutControlMenu` 仅 **Navigator / Conversation / Preview / Sources**。Panel / Aux 在 submenu。**没有 Panel 钮**（Desktop ADR-047 / ADR-052 决策 3）。 |
| 互斥 | `enforceAgentShellVisible` / `forceShownAgentShellPart`：**Conversation ∨ (Editor ∨ Sources) ≥ 1**。`PANEL_PART` **不参与**。 |
| Panel maximize | 藏 End 列（Editor + Sources），Conversation 保持可见；maximize 期间跳过 `enforceAgentShellVisible`。 |
| Panel 默认 | `PANEL_HIDDEN` 默认 `true`。Terminal 仍是 Panel 默认座。Inspect 已占一个 `hideIfEmpty` 容器（`workbench.panel.agentInspect`，`order: 50`）。 |

Preview 归属（PRD-005 / Desktop ADR-051）：上格 = **文件查看/编辑**；下格 Sources = **列表面宿主**，不准入文件级 Diff 深查看。

EH：`viewsContainers.panel` 已标 **冲突（顺序/默认开）**，证据仍 **待实测**（[eh-surface-matrix](../../docs/reference/code-oss-b2/eh-surface-matrix.md)，D9）。Inspect 已示范「产品 Panel 容器 + `hideIfEmpty` + 非默认开」。

## Options

### A — 编辑器区 Diff editor（HEAD）

文件级 Diff 继续作为 `EditorInput` 进 End 上格 `EDITOR_PART`（与 File tab 同组）。Sources Changes / Review 点击维持 `ISCMResource.open`。

| 面 | 评估 |
|----|------|
| 四钮 / 互斥 | 开 Diff **等于**亮 Preview。藏 Preview 会连 Diff tab 一起藏。不改 `enforceAgentShellVisible`，但 Preview 钮语义变成「文件 **和** Diff」。 |
| Preview 归属 | Diff 与 File 抢同一 tab 条、同一显隐。违反 ADR-051「Preview 才准入编辑/预览面、Diff 0× L1」。 |
| EH Panel | 不新增产品 Panel 容器；`viewsContainers.panel` 冲突面不变。 |
| 成本 | 零改绑。 |

否决：把未选分叉写成终态；PRD-009 的「明确打开位置」会变成「和文件预览同一个槽」。

### B — 底部 Panel 专用容器（对照 Desktop ADR-047）

产品 Diff 深查看进 `PANEL_PART` 的 **专用 ViewContainer**（建议 id 族 `workbench.panel.agentDiff`，对齐 Inspect 的 `workbench.panel.*`）。容器 `hideIfEmpty: true`、**不是** Panel 默认 composite、**不**进四钮。宿主是 ViewPane 内嵌 Diff 控件（`IDiffEditor` / multi-diff widget），**不是**把 `EDITOR_PART` 变成第二 Editor Group，也 **不是** editor-in-panel。

产品打开路径（Sources Changes / Review 的 SCM 资源、Chat 编辑会话 `show()`、时间线「查看更改」深查看）改绑到该容器。QuickDiff 留在 File 编辑器。非产品命令（用户从 Command Palette 显式 `Open Changes` / 扩展 `vscode.diff`）可继续走 editor，本 ADR 不把整个 git 扩展改成只认 Panel。

| 面 | 评估 |
|----|------|
| 四钮 / 互斥 | Panel 与四钮正交。开 Diff **不**强制亮 Preview 或 Sources，也 **不**触发 `enforceAgentShellVisible`。关完临时 Diff tab、容器空 → Panel 可收起，不影响 Conversation ∨ (Editor ∨ Sources)。Maximize 仍是用户动作；standard 开 Panel **不得**派生隐藏 Preview（Desktop `INV-047-WB-VISIBLE` 在本仓的对应：不因开 Diff 调用 `setEditorHidden(true)`）。点 Diff **不得**自动撑开已收起的 Sources（ADR-047 决策 3）。 |
| Preview 归属 | Preview 只剩 File / 预览。Diff 离开 L1。与 PRD-005、ADR-051 一致。 |
| EH Panel | 与 Terminal / Problems / Output / Inspect / 扩展 `viewsContainers.panel` **抢 tab 条顺序与默认开**。这是矩阵已登记的冲突，不是新发明。缓解：非 `isDefault`、`hideIfEmpty`、order 高于 Terminal（Inspect 已用 50；Diff 建议 ≥ 40 且 **低于** Terminal 默认座）、不为 Diff 注册 Open Command 到 LayoutControlMenu。D9 探针仍要实测「产品 Diff 容器是否把扩展 Panel 视图挤出默认可见」。 |
| 成本 | 须改 `openSourcesChangeEntry` 的 SCM 分支、Chat 编辑 `show()`、以及一块 Panel 贡献（对照 `agentInspect.contribution.ts`）。高于 A，低于「把 Panel 做成第二 EditorPart」。 |

### C — Sources Changes 内嵌 inline diff

在 End 下格 Changes（或 Review）行下 / 面板内嵌 hunk 或 mini diff。深查看不离开 Sources。

| 面 | 评估 |
|----|------|
| 四钮 / 互斥 | Diff 寿命绑在 Sources 钮上。Sources 隐藏则 Diff 消失；若为看 Diff 而强制 `setSourcesHidden(false)`，等于用互斥公式的 End 叶承载深查看，并违反「点 Diff 不得自动撑开 Sources」。 |
| Preview 归属 | Preview 保持干净，但 Sources 从列表面变成第二编辑器。违反 ADR-051 准入表（不准入文件级 Diff 深查看）。 |
| EH Panel | 不碰 Panel。 |
| 成本 | 自研 inline diff；难复用 `DiffEditor` 全套（侧边栏、多文件、accept/reject）。End 列已是 Editor 上 / Sources 下，内嵌会挤清单。 |

否决：Desktop ADR-047 已拒绝「Diff 进 Changes 内嵌」；本仓 ADR-051 同样不准入。

## Decision

**推荐 B**（底部 Panel 专用容器）。

签收后钉死：

1. **产品 Diff 深查看 owner = `PANEL_PART` 专用容器**，0× `EDITOR_PART`（Preview / L1），0× `SOURCES_PART` 内嵌。
2. **Changes 仍是 Sources tab 清单**（stage / unstage / commit）。点击清单打开的是 Panel Diff，不是 Preview 文件 tab，也不是行内展开。
3. **四钮不变。** 禁止为 Diff 增加第五枚 LayoutControlMenu 钮；禁止把 Panel 拉回主簇。
4. **互斥公式不变。** `enforceAgentShellVisible` 继续只看 Conversation / Editor / Sources。开/关 Diff 只操作 `PANEL_PART`。
5. **Preview 不被 Diff 派生显隐。** 开 standard Diff 不藏 Preview；藏 Preview 不卸 Diff 容器（用户可同时：Conversation + hidden Preview + 底栏 Diff）。
6. **QuickDiff 留在 File 编辑器**，不替代 Panel 深查看。
7. **EH：** 接受 `viewsContainers.panel` 顺序/默认开冲突；用 Inspect 同款 `hideIfEmpty` + 非默认开约束产品容器。冲突行的「已实测」仍归 D9，不在本 ADR 宣称探针已过。

实施须另写 plan（不在本 draft 范围）。本 ADR 不授权「顺便」改 `layout.ts` grid 或四钮。

## Consequences

- PRD-009 在本 ADR **`accepted` 之后**才能写验收标准（Sources Changes 清单 + 文件级 Diff 打开 `PANEL_PART` 产品容器）。`draft` 期间需求保持 `blocked`。
- 知识层（[companion-contribs §5](../../docs/systems/workbench/companion-contribs.md)、[desktop-shell-mapping](../../docs/reference/code-oss-b2/desktop-shell-mapping.md)、[agent-ui](../../docs/systems/chat/agent-ui.md)、[parts-and-grid](../../docs/systems/workbench/parts-and-grid.md)）里「Diff 仍 EDITOR_PART FORK」在签收 + 实施后改写；本 draft **不**提前改那些已接受页。
- Inspect 与 Diff 将是两个 Panel 产品容器。须在实施 plan 里规定同时打开时的 tab 顺序，以及与 Terminal 默认座的共存（空 Diff 不抢 Terminal 首开）。
- Panel maximize 仍藏 End 列：用户主动最大化底栏时 Preview/Sources 消失、Conversation 在；这与「standard Diff 不藏 Preview」不矛盾。

## Alternatives

- **A（维持 HEAD）**：实施成本最低，但 Preview 继续兼 Diff，四钮 Preview 语义污染，对照合同失败。仅可作「签收前的代码现状」，不能当 owner。
- **C（Changes 内嵌）**：四钮把 Diff 锁在 Sources 上；列表面宿主被撑成编辑器；外仓与 ADR-051 均已拒绝。
- **Panel 第二 Editor Group / editor-in-panel**：Desktop ADR-047 已拒绝「Panel 完全开放成第二 Editor Group」（File 会进底栏）。本仓选 ViewPane 内嵌 Diff 控件，避免 File 与 Diff 在 Panel 再混一次。
- **为 Diff 加第五钮**：推翻四钮合同；与「Panel 不进四钮」冲突。
- **开 Diff 时强制亮 Preview 或 Sources**：分别退回 A 或 C 的显隐耦合。
