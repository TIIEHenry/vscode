---
title: "Desktop 壳合同 ↔ 本仓 Parts 映射"
type: reference
status: accepted
phase: N/A
updated: 2026-08-30
summary: "ADR-052 四钮与 IA 区域投影到默认 workbench / Agents Window；标出同构、缺维、禁止偷换"
---

# Desktop 壳合同 ↔ 本仓 Parts 映射

外仓合同（只读）：IA §1、experience-principles §2、ADR-052、ADR-051、ADR-047。  
视觉参考：外仓 `dev/plans/shell-framework-preview.html`（拓扑稿，演示 ⊇ 合同）——S1 演示的区域排布、四钮位形、Activity 通高以它为对照基准。  
本仓事实：[parts-and-grid](../../systems/workbench/parts-and-grid.md)、[agent-ui](../../systems/chat/agent-ui.md)、[sessions LAYOUT](../../../src/vs/sessions/LAYOUT.md)。

## 1. 两套窗口（先选宿主）

| | 默认 Code 窗口 | Agents Window（`vs/sessions`） |
|--|----------------|--------------------------------|
| 入口 | `workbench.desktop.main` | `sessions.desktop.main` / `sessions.web.main` |
| 中心 | `CONVERSATION_PART` | `SESSIONS_PART`（非 EditorInput） |
| Activity | 有 | **省略** |
| StatusBar | 有 | **省略** |
| Editor 显隐 | 与 Conversation 互斥（aux maximize 例外） | 可独立于 Sessions Part |
| 产品壳（四钮 + IDEA End） | 无 | 无 |
| 对 B2 S1 | **手术对象** | **样例 / 禁止当成品壳** |

父方案坚持文档壳 = 默认窗口改拓扑，**不是**把用户主窗换成 Agents Window。  
**人类已确认（2026-08-30）：** UI 框架基于**编辑器窗口**（默认 Code 窗口）改；Agents Window 仅作组件 / 算法 / 功能面 donor（§4a 复用姿态），不作产品壳入口。

## 2. 区域 → Part 投影

Desktop 目标（IA）：

```text
Activity 通高 | Conversation | Workbench End（上 Preview / 下 Sources）
              | Timeline+Dock|
主栈底：Bottom Panel + strip
StatusBar
```

| Desktop `RegionId` / 区域 | 默认窗口今天 | S1 目标投影 | 备注 |
|---------------------------|--------------|-------------|------|
| Activity rail | `ACTIVITYBAR_PART` | **保留原生；不加四钮 chrome**（2026-08-30 拍板：四钮宿主改 titlebar 右上） | 通高已近似成立 |
| Navigator body | `SIDEBAR_PART` | 保留；roster 换成产品 tab | `toggleRegion('navigatorBody')` ≙ `setSideBarHidden` + 记宽 |
| Conversation | **`CONVERSATION_PART`**（M0 占位） | 独立中心 Part | 无引擎接线；不是 ChatEditor |
| Preview | `EDITOR_PART`（End 列） | **同一 `EDITOR_PART` 已挪到 End** | 与 File tabs **同构**（spike §3.1） |
| Sources | 无独立格。SCM/Changes 常在 Sidebar 或 Panel | End **下格新占位 Part** 或临时 `PANEL`/`AUX` | spike：占位即可，不解决 ADR-051 展开语义。**slot A 实现中**；HEAD `fc6089a3` 尚无 Sources Part |
| Bottom Panel | `PANEL_PART` | 保留；**不进四钮** | 对齐 ADR-047 / ADR-052 决策 3 |
| StatusBar | `STATUSBAR_PART` | 保留 | |
| 右缘 rail | `AUXILIARYBAR_PART` | **默认关**（INV-052-NO-RIGHT-RAIL） | 布局类扩展爱往这里打，记入 EH 矩阵 |
| Titlebar | `TITLEBAR_PART`（菜单 + command center + 右上 layout controls） | **按 vscode 原生来**（2026-08-30 拍板）；四钮宿主 = 右上 layout controls 簇（原生 Sidebar/Panel/Aux 三钮同族扩展） | 不再自研顶部 chrome |
| SessionBar | Chat 标题条 / sessions `sessionHeader` | Conversation 透镜内自研 chrome | ADR-052 NO-SUBLAYOUT |

## 3. 四钮 ↔ 本仓 API

> **宿主（2026-08-30 拍板）**：titlebar 右上原生 layout controls 位（`workbench.layoutControl.*` 一族），不是 Activity 底部。四向语义与 NO-DUAL-HIDE 不变。

| 钮 | Desktop | 本仓现成 | 缺口 |
|----|---------|----------|------|
| Nav | `toggleRegion('navigatorBody')` | `setPartHidden(SIDEBAR)` + Activity 再点收起近 `setNavigatorPref` | 无 persist 宽的单一 `toggleRegion` |
| Conv | `toggleRegion('conversation')` | `setPartHidden(CONVERSATION_PART)` / `workbench.action.toggleConversation` | titlebar 四钮尚未接入 |
| Prev | `toggleRegion('preview')` | `setPartHidden(EDITOR_PART)` / `workbench.action.toggleEditorVisibility` | 不再强制开 Panel |
| Src | `toggleRegion('sources')` | 无 | 占位 Part；不能用底边细条（ADR-052 已废）。**slot A 实现中** |

> **HEAD `fc6089a3`（ConversationPart 基线）**：默认窗口已有 Conversation 中心 + Editor End 列 + `Conversation∨Editor` 互斥。**尚无** Sources 下格 Part 与 titlebar 四钮 wiring——见 [diff-footprint](diff-footprint.md) TBD@merge。

`INV-052-NO-DUAL-HIDE`：Conversation ∨ Workbench(Preview∨Sources) 至少一个可见。  
本仓默认（M0）：Conversation ∨ Editor 至少一个可见。Panel 不进此公式。Sources 下格仍缺，故 End 列暂以 Editor 代表 Workbench。

## 4. 禁止的偷换（选项 C）

| 偷换 | 为什么算 C |
|------|------------|
| 中心继续 `EDITOR_PART`，Conversation 用 `ChatEditor` | INV-TOPO |
| 主窗改成 Agents Window，无四钮 | 缺 ADR-052 维 |
| Auxiliary Bar 当 Conversation | 右栏配套，语义反了 |
| Zen Mode / 只留 Editor 当 `pureEditor` | 没 Conversation Part，藏的是「整 IDE」不是透镜 |
| Copilot Chat 视图当主流程 | INV-NO-COPILOT + 插件形 |

## 4a. 复用姿态（2026-08-30 拍板）

sessions / agent-host 配套功能面**默认保留绝大部分**（Customizations 中心：Agents / Skills / Instructions / Hooks / MCP Servers / Plugins / Tools；Tasks / worktree 运行面；复用包括功能）。例外才换：Copilot provider / entitlement / setup 流（INV-NO-COPILOT）、会话真相归属（UA 权威）、Task ↔ client-tool 双执行面 owner（Go 后 ADR 收敛）、产品自研面（SessionBar / 四钮语义 / 权限座位 / Inbox）。详见外仓父方案 §3 拍板段与 [agent-ui](../../systems/chat/agent-ui.md)。

## 5. 合法同构（应保留）

- Preview ⇄ `EDITOR_PART` + 原生 tabs + `IEditorService`
- Bottom Panel ⇄ `PANEL_PART`（Diff 深查看按 ADR-047）
- Activity 图标 rail ⇄ `ACTIVITYBAR_PART`（左边图标 tab，不搬 IDEA 竖排字）
- StatusBar ⇄ `STATUSBAR_PART`

## 6. 相关文档

- [缺口](gap-vs-desktop-shell.md) · [T1–T3](spike-t1-t3-code-facts.md) · [EH](eh-surface-notes.md) · [EH 矩阵](eh-surface-matrix.md) · [footprint](diff-footprint.md)
