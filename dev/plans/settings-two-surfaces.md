---
title: "设置两套主面：本地 Client / Engine；Singularity 设置在 vscode 重设计"
type: plan
status: draft
phase: N/A
updated: 2026-09-01
summary: "产品设置只有本地与 Engine 两页，必须分开；视觉与 vscode 统一；Customizations 编辑器不是第三套主设置"
---

# 设置两套主面：本地 / Engine

> **宿主：** [page-access-schemes.md](page-access-schemes.md) — Client=`SettingsEditor2`，Connection=`ua.connection`，Engine=`ua.engine`。不重开宿主选型。  
> **零件：** [customizations-host-ui.md](customizations-host-ui.md)（文件编辑器 chrome）、[customizations-engine.md](customizations-engine.md)（引擎权威）。冲突以 **本文件** 为准。

**Goal：** 钉死两页各装什么。不实施。

## 0. 人类约束（2026-09-01）

1. Singularity 有的设置 UI，基本上都在 vscode **重设计**（不搬 Compose）。
2. **两个主要设置页面：本地 和 Engine，必须分开。**
3. Connection 归本地（`ua.connection` 是第三宿主，不是第三主产品页）。
4. **UI 与 vscode 统一：** 两页同一张脸（workbench token、`SettingsEditor2` / Preferences 密度、`WorkbenchList`、原生 Button / SelectBox / InputBox / monaco）。禁止 Material 卡、Copilot 营销卡栅、第二套色板。

```text
本地 SettingsEditor2：Display / Chat Input / Keyboard / Notifications /
  Permissions 座位 / Client Tools
  → Open Connection…（ua.connection）
  → Open Engine…（只跳转）
  → Open Customizations…（C5 后 = 文件工具，不是第三主页）

Engine ua.engine：Provider / Model / Skill / Agent Profile / Rules /
  Hooks / MCP 定义 / 引擎工具。无引擎 = 诚实空 + Test。

HEAD ua.customizations pane = 禁止的第三宿主（TOC 今天仍打开它）。
```

证伪：Client 树里 Skill 开关；Engine 里改主题；只能打开 Customizations 才能管 Agent；Client 是 Settings 树而 Engine 是卡网。

## 1. 本地页

无连接也可开。主题复用 `workbench.colorTheme`。UA 增量（对话阅读、Enter）做在 Client 树。禁止在本地树做 Provider / Skill catalog / Agent Profile。

## 2. Engine 页

产品 catalog 在这里。无引擎整页诚实空，禁止浏览本机 Copilot 文件冒充已连。Provider **禁止** `ModelsManagementEditor`。Prompts 不进默认窗产品轨。

零件从 Customizations 编辑器拆用时，只拆列表/预览行为，chrome 落到 Engine pane 的 vscode 密度上。

## 3. Customizations 编辑器降级

`AICustomizationManagementEditor` = 文件工具 donor。C5 目标 TOC → `aiCustomization.openManagementEditor`；HEAD 仍是 `workbench.action.openCustomizationsPreferences` + `ua.customizations` pane。产品 Skill/Agent 主路径是 §2，不是这只 Overview。

## 4. 非目标

重开 Client/Connection/Engine 宿主；Navigator Agents 并进设置；两页两套皮肤；保留 `ua.customizations` pane。
