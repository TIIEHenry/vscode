---
title: "设置两套主面：本地 Client / Engine；Singularity 设置在 vscode 重设计"
type: plan
status: accepted
phase: N/A
updated: 2026-09-01
summary: "已签收：本地 vs Engine 两套主设置面；vscode 同一张脸；Customizations 降级为零件；C5 / H0–H3 ReadyToImplement；E1 等 PRD-008"
---

# 设置两套主面：本地 / Engine

> **宿主：** [page-access-schemes.md](page-access-schemes.md) — Client=`SettingsEditor2`，Connection=`ua.connection`，Engine=`ua.engine`。不重开宿主选型。  
> **零件：** [customizations-host-ui.md](customizations-host-ui.md)（文件编辑器 chrome）、[customizations-engine.md](customizations-engine.md)（引擎权威）。冲突以 **本文件** 为准。

**Goal：** 钉死两页各装什么。不实施。

本稿 `accepted`（2026-09-01）。规则 16 三轮并行 Cursor Grok 4.6（Opus 5.0 slug 不可用）。第三轮 Approve with changes 已改入。**ReadyToImplement：** C5（TOC→OpenEditor、注销 `ua.customizations` pane）与 donor H0–H3。Engine catalog **E1 blocked PRD-008**。

## 0. 人类约束（2026-09-01）

1. Singularity 有的设置 UI，基本上都在 vscode **重设计**（不搬 Compose）。
2. **两个主要设置页面：本地 和 Engine，必须分开。**
3. Connection 归本地（`ua.connection` 是第三宿主，不是第三主产品页）。
4. **UI 与 vscode 统一：** 两页同一张脸（workbench token、`SettingsEditor2` / Preferences 密度、`WorkbenchList`、原生 Button / SelectBox / InputBox / monaco）。禁止 Material 卡、Copilot 营销卡栅、第二套色板。

```text
本地 = 完整 SettingsEditor2（Application / Features / … + UA 组）
  UA 组：Display / Chat Input / Startup / Keyboard Enter /
         Notifications / Permissions / Client Tools
  → Open Connection…（ua.connection）
  → Open Engine…（只跳转）
  → Open Customizations…（C5 后 = 文件工具，不是第三主页）

Engine ua.engine：Provider / Model / Skill catalog / Agent Profile /
  Rules（= Instructions）/ Hooks / MCP 定义 / 引擎工具。
  无引擎 = 诚实空 + Test。禁止本机 Copilot 盘冒充已连。

HEAD ua.customizations pane = 禁止的第三宿主（TOC 今天仍打开它）。
```

证伪：Client 树里 Skill 开关；Engine 里改主题；只能打开 Customizations 才能管 Agent；Client 是 Settings 树而 Engine 是卡网。

## 1. 本地页

**就是完整 `SettingsEditor2`**，不是只剩 UA 组的空壳。主题复用 `workbench.colorTheme`。UA 增量（对话阅读、Enter）做在 Client `ua/*` 组。HEAD 已有 `ua/startup` emptyCopy，本波不迁启动向导。禁止在本地树做 Provider / Skill catalog / Agent Profile。

## 2. Engine 页 vs 文件工具（必须一张表，禁止第三套主设置）

| 产品行为 | 宿主 |
|----------|------|
| Provider / Model Profile | `ua.engine`。**禁止** `ModelsManagementEditor` |
| Skill catalog 列表 / enable | `ua.engine` |
| Agent Profile catalog | `ua.engine` |
| Rules（UA global/project；donor 节名 Instructions） | `ua.engine` |
| Hook 点位 + 引擎侧定义 | `ua.engine` |
| MCP **定义** CRUD（引擎权威） | `ua.engine` |
| 引擎 / Profile 工具 enablement | `ua.engine` |
| 无引擎 | **整页诚实空 + Test**。禁止在 Engine 页扫本机文件当 catalog/Stub「快接上了」 |
| 打开某份 UA markdown / `tools.json` 来编辑 | `AICustomizationManagementEditor`（文件工具）。可从 Engine 某行「在编辑器中打开」 |
| 本地 vscode MCP / 工作区普通 md | 不是 Engine catalog；donor 若列出须当普通文件，文案不得写引擎 |

零件：只把 `WorkbenchList` / monaco / markdown 预览 **拆进** Engine pane 的 vscode 密度。禁止把 Copilot 左 nav Overview 整页当 Engine 首页。

Prompts 不进默认窗产品轨（斜杠 = Skill catalog）。

## 3. Customizations 编辑器降级 + C5 打开路径

`AICustomizationManagementEditor` = 文件工具。**不是** Skill/Agent/Tools 产品首页。

**C5 TOC（默认窗合法路径，不新开 command）：**

| | HEAD | 选定 |
|--|------|------|
| TOC `ua/customizations` | `workbench.action.openCustomizationsPreferences`（第三 pane） | `aiCustomization.openManagementEditor`。TOC **组仍可留**；只换 `commandId` |
| `OpenEditor` | `f1: true`，`precondition: ChatContextKeys.enabled ∧ IsSessionsWindowContext` | **保持**。Palette 测要求条目仍注册且默认窗 `when` 为 false |
| TOC 点击 | `ICommandService.executeCommand` | **不走** Action2 `precondition`（`CommandService._tryExecuteCommand` 只调 handler）。默认窗 TOC 可打开编辑器。**不要**包进 `openUaPaneReplacingClientSettings`（那是 Connection/Engine pane）。`RequiresModal` 由 `editorGroupFinder` 接管模态。已有 Settings 模态时可能同组两个 tab，**不要**为此改回 pane helper |
| HEAD 第三宿主入口 | `OpenCustomizationsPreferencesAction`（`OPEN_CUSTOMIZATIONS_PREFERENCES_COMMAND_ID`）→ `openUaPaneReplacingClientSettings(..., ua.customizations)` | **删除**该 Action 与常量。改 TOC 不够：漏删则 Preferences 第三 tab 仍在；pane 已注销时未知 `paneId` fail-closed 回 Client |
| 注销 pane | `CustomizationsPreferencesPane` + 贡献 + CSS + `UA_CUSTOMIZATIONS_PANE_ID` + `customizationsPreferencesPane.test.ts` | **一并删**。Connection / Engine pane **保留** |
| TOC 锁测 | `settingsUaToc.test.ts` 断言 `commandId === 'workbench.action.openCustomizationsPreferences'` | 改成 `aiCustomization.openManagementEditor`。`ua/customizations` 链接行测可留 |
| 禁止 | | 为 TOC 去掉 `IsSessionsWindowContext`；新开第二条 Open 命令（executeCommand **未被** precondition 挡住，已核）；只改 TOC / 只注销 pane 而留下 pane Open Action |

Chat `ViewTitle` 仍可能挂 Open Customizations（无 Sessions 门）：默认窗须藏，走 M5 / INV-NO-COPILOT，不得当第三产品门。

## 4. 非目标

重开 Client/Connection/Engine 宿主；Navigator Agents 并进设置；两页两套皮肤；保留 `ua.customizations` pane；把 donor Overview 做成 Engine catalog。

## 5. 审查记录（规则 16）

2026-09-01 第二轮并行 Grok：**Approve**。C5：`executeCommand` 不查 precondition（`commandService.ts` `_tryExecuteCommand`）；Palette 门保持。余量表成立。Minor 已改入：去掉「除非证伪 gated」；C5 不走 pane helper。

2026-09-01 第三轮 [two-surfaces](bd6399de-54cd-47d8-816a-4ec97fedee5c)：**Approve with changes**。HEAD 七条主张成立。已改入：C5 删除 `OpenCustomizationsPreferencesAction` / pane 全套；`settingsUaToc.test.ts` 换 commandId。

2026-09-01：**签收** `accepted`。C5 / H0–H3 ReadyToImplement；E1 blocked PRD-008。未改 `src/`。
