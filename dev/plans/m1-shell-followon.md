---
title: "M1 壳后续切片（M0 拓扑之后）"
type: plan
status: proposed
phase: M1
updated: 2026-08-31
summary: "M0 壳已落后的 vscode-fork 下一波：四钮 chrome、Conversation 透镜（无引擎）、Sources Files 列表投影；最多三切片"
---

# M1 壳后续切片

> **前置**：[m0-topology-surgery.md](m0-topology-surgery.md)（`implemented`，代码事实）。  
> **决策**：外仓 [ADR-061](https://github.com/TIIEHenry/UniverseAgentDesktop/blob/main/dev/decisions/061-code-oss-base-and-editor-window-shell.md)（`accepted`）。  
> **本仓事实**：[parts-and-grid](../../docs/systems/workbench/parts-and-grid.md) · [desktop-shell-mapping](../../docs/reference/code-oss-b2/desktop-shell-mapping.md) · [agent-ui](../../docs/systems/chat/agent-ui.md) · [companion-contribs](../../docs/systems/workbench/companion-contribs.md)

**Goal：** 在 **不接** UniverseAgent 引擎 / gRPC / adapter 的前提下，把默认编辑器窗口从「拓扑已齐、中心与 Sources 仍是占位」推进到可读的产品壳：四钮 chrome 收敛、Conversation 透镜可装 donor、Sources 有 Files 列表投影。

**Architecture：** 继续改 **默认 Code 窗口**（`workbench.desktop.main`）。`vs/sessions` 仍只作 donor，禁止当产品壳、禁止 workbench 反向 import sessions。Conversation 仍不是 `EditorInput`。引擎接线不进本波。

## 全局约束

- 不碰 UniverseAgent 引擎、gRPC、adapter、session-core（INV-UA-TRUTH 仍成立，本波只留空座位）。
- 不把 `IChatModel` / Copilot entitlement / `chatSetup` 提成会话真相（INV-NO-COPILOT）。
- 不改 `vs/sessions` 当成品壳；Agents Window 只读参照。
- 本方案 **不** 勾 D3 compile / D4 启动演示 / D5 EH 探针（见文末 deferred）。
- 分层：`workbench/browser` 不得 import `workbench/contrib`。

---

## M0 已落地（本波不再做）

| 项 | HEAD 事实 |
|----|-----------|
| Conversation 中心 Part | `ConversationPart`：标题 + 假时间线 + 假 dock；非 `ChatEditor` |
| End 列 | 上 `EDITOR_PART`（Preview / 原生 tabs），下 `SOURCES_PART` 占位 |
| 互斥 | `Conversation ∨ (Editor ∨ Sources)`；`enforceAgentShellVisible` |
| 四钮命令 | titlebar `LayoutControlMenu`：Nav(=Sidebar) / Conversation / Preview / Sources |
| 存储 | `conversation.hidden`、`sources.hidden`、`editor.size` / `sources.size` |

合入锚点：`b5631393`（A+B）· footprint `b283fe19`。

## 对照：M0「不做范围」里仍有效的项

摘自 [m0-topology-surgery.md §不做范围](m0-topology-surgery.md)：

| 排除项 | M1 态度 |
|--------|---------|
| 引擎迁移（UA / gRPC / adapter） | **仍排除**（整波） |
| 会话权威 | **仍排除**；Desktop / UA 仍是真相 |
| Sources 真实语义（ADR-051 全量） | 本波只做 **Files 列表投影**（切片 3）；Changes / Diff 不进 |
| `vs/sessions` 改动 | **仍排除** |
| 四钮 UI 完整产品化 | **本波切片 1**（即 D7） |
| Copilot / entitlement | **仍排除** |

## 对照：ADR-061「待定（另切片，不阻塞 M0）」

| 待定 | 本波 |
|------|------|
| Task↔client-tool 双执行面 owner | **不进三切片**；见文末 deferred（引擎邻接） |
| 扩展分发（Open VSX / 自建 / 子集） | 不进 |
| 产品身份（`product.json` 名称 / 图标 / trade dress） | 不进 |
| 文档 SSOT 从外仓迁 fork 的时机 | 不进（本仓 `docs/` 已自洽） |
| 上游 rebase 节奏 | 不进（流程，不是壳切片） |

外仓「生效后文档动作」列账（desktop-client-plan amendment、ADR-042 supersede、047/051/052 映射注记等）是 **UniverseAgentDesktop** 文档债，不是本 fork 的 M1 代码切片。

---

## 推荐下一波顺序（恰好 3 切片）

顺序 = 残留 M0 chrome → 产品中心透镜 → End 下格开始有语义。后一切片不依赖前一切片的运行时，但 **不要并行改同一 `layoutActions.ts` / 两 Part 的 grid 邻居逻辑**。

### 切片 1 — 四钮 chrome 收敛（闭 D7）

**做什么：** titlebar `LayoutControlMenu` 只留产品四钮 **Nav / Conversation / Preview / Sources**。收掉与四钮抢位的原生 Panel、Auxiliary Bar 图标钮（以及 Sidebar 在右侧时的第二套图标）。命令本身保留在 Command Palette 与 `LayoutControlMenuSubmenu`（Configure Layout）。

**现状：** `layoutActions.ts` 在 `toggles`/`both` 下同时注册原生 Sidebar 图标钮（order 0/2，标题仍是 “Toggle Primary Side Bar”）+ Conversation / Preview / Sources，再加 Panel / Aux → 最多 6–7 钮。[deferred-gaps D7](../progress/deferred-gaps.md) 已记；fable 判非 M0 must-fix。

**Likely files：**

| 路径 | 角色 |
|------|------|
| `src/vs/workbench/browser/actions/layoutActions.ts` | 给原生 Panel / Aux（及重复 Sidebar）的 `MenuId.LayoutControlMenu` 项加 `when`；给 Nav 用的 Sidebar 项改标题为 Navigator |
| `src/vs/workbench/browser/parts/titlebar/`（仅当容器 CSS/间距被挤坏） | layout control 簇宽度 |
| `src/vs/workbench/common/contextkeys.ts` · `browser/contextkeys.ts` | 仅当需要 `AgentShellLayoutControl` 一类 context，而不是散落 `config.*` |
| `src/vs/workbench/services/layout/test/browser/layoutService.test.ts` | 不测菜单 DOM；互斥公式不应被本切片改动 |

**不是方案分叉：** ADR-061 决策 4 已定宿主 = titlebar layout controls，四向语义不变。剩下是 chrome 卫生。

**选定路径：** 用菜单 `when` 藏原生 Panel / Aux 图标钮；**保留** Sidebar 那一枚作为 Nav（同一 `workbench.action.toggleSidebarVisibility`），只改可见标题。不新开 `workbench.layoutControl.*` 配置项，除非 `when` 无法区分辅助窗。Panel 仍可从菜单/命令显隐，**不进四钮**（ADR-047 / ADR-052 决策 3）。

### 切片 2 — Conversation 透镜（无引擎）

**做什么：** 把中心从「标题 + 两行占位文案」换成 **自研透镜骨架**：SessionBar 槽 + 时间线槽 + Input Dock 槽。数据用 **本地 stub / 假时间线**（spike §4.1 已允许）。可把本仓 confirmation 零件（Allow/Skip、「N confirmation pending」、Input needed）经 **contrib 贡献点** 填进时间线座位。**禁止** 整块搬 `ChatViewPane` / `ChatEditor` / `chatSetup`。

**现状：** `conversationPart.ts` 已是独立 Part（INV-TOPO 满足）；内容仍是占位。ADR-061 决策 5：SessionBar / Inbox / Conversation 透镜 = 产品自研面；列表虚拟化、markdown content parts、confirmation = donor；`IChatModel` 不是权威。

**Likely files：**

| 路径 | 角色 |
|------|------|
| `src/vs/workbench/browser/parts/conversation/conversationPart.ts` | Part 仍只做槽：title / content host / `IConversationPartService` 扩成可 `setContent` 或暴露 content element |
| `src/vs/workbench/browser/parts/conversation/media/conversationPart.css` | SessionBar / timeline / dock 分区，不抄 Copilot 像素 |
| **新建** `src/vs/workbench/contrib/conversation/`（或同等 contrib 目录） | 透镜实现、stub 时间线、confirmation 座位装配；在 `workbench.common.main` 注册 |
| `src/vs/workbench/contrib/chat/browser/widget/`（只读 donor） | confirmation / list 零件；**复制或经接口引用，禁止** `browser/parts` import contrib |
| `src/vs/workbench/workbench.common.main.ts` | contrib 登记 |
| 对应 `test/`（contrib 或 workbench browser） | 槽可挂内容；默认打开 URI **不是** `ChatEditorInput` |

**不是方案分叉：** 宿主已是 `ConversationPart`（M0）；复用姿态已拍板（ADR-061 决策 5 + [agent-ui](../../docs/systems/chat/agent-ui.md) §2/§7）。

**选定路径：** Part = 槽（`workbench/browser`）；透镜 = `workbench/contrib` 填槽（对齐 sessions core vs `sessions/contrib/chat`，且不破坏分层）。Inbox 全产品面、真权限状态机、UA 接线 **不进本切片**（可把 confirmation **零件** 嵌进假时间线一行，证明座位，不接引擎）。

### 切片 3 — Sources Files 列表投影（非 ADR-051 全量）

**做什么：** End 下格从「Sources」占位文案变成 **只读 Files 列表**：条目来自工作区 / Explorer 模型的投影，点击 `IEditorService.openEditor` 落到 End **上格** Preview。树权威仍在 Sidebar Explorer（Navigator Files）。**不**搬 `ExplorerView`，**不**第二棵树，**不用** Open Editors 冒充 Files。

**现状：** `sourcesPart.ts` 仅占位。映射张力已写在 [companion-contribs §4](../../docs/systems/workbench/companion-contribs.md)：合法路径就是列表投影。

**Likely files：**

| 路径 | 角色 |
|------|------|
| `src/vs/workbench/browser/parts/sources/sourcesPart.ts` + `media/sourcesPart.css` | 槽（同切片 2：browser 不 import contrib） |
| **新建** `src/vs/workbench/contrib/sources/` 或挂在 `contrib/files/` 下的投影视图 | 只读列表；读 `IExplorerService` / `IWorkspaceContextService`，不 new 树权威 |
| `src/vs/workbench/contrib/files/browser/explorerViewlet.ts` 等 | **只读参照**；不要改默认 Sidebar 容器 |
| `src/vs/workbench/workbench.common.main.ts` | 贡献登记 |
| 对应 test | 点击打开的 input 落在 `EDITOR_PART`；Sources 隐藏时不自动撑开（对齐 ADR-051「不因打开而展开已收起下格」的 Files 子集） |

**不是方案分叉（Files 这一刀）：** IA 已定 Navigator = 树权威、Sources Files = 列表投影；companion-contribs 已否决三种偷换。

**本切片明确不做：** Sources **Changes** tab、stage/commit UI、把 Sidebar scm 搬进 End。那是 ADR-051 下一刀，且会撞上下面的 Diff **FORK**。

---

## FORK（须人类 / fable 拍板，本波不选）

**Diff 深查看落点（ADR-047 vs 本仓习惯）。** Desktop：文件级 Diff 走 Bottom Panel（`PANEL_PART`），Changes 只是 Sources tab 清单，Diff **不**进 L1、**不**嵌进 Changes。本仓今天：点 scm 变更打开的是 `EDITOR_PART` 里的 Diff / multi-diff（End 上格 Preview），外加编辑器 QuickDiff。这是两条不能同时当真的合同：继续把 Diff 当 Preview = 低 fork 成本、违反 ADR-047；把 Diff 改绑 `PANEL_PART` = 对齐壳合同、要动 git/scm 打开路径与 editor 习惯，diff footprint 明显高于切片 3。切片 3 **只做 Files 列表**，把这条留下；在人类/fable 未书面选择之前，禁止「顺便」改 Diff 路由。

---

## 仍 deferred（本方案不排期、不验收）

### 验证债（M0 留下，仍开）

| ID | 项 | 说明 |
|----|-----|------|
| **D3** | compile | `npm run compile` + `valid-layers-check`；本波方案 **不**跑、不把绿编译当 M1 入口 |
| **D4** | 启动 T1–T3 演示 | 目视 Conversation 中心、End Editor/Sources、互斥、四钮；依赖 D3 |
| **D5** | EH 探针冒烟 | LSP + layout 类扩展；矩阵「待实测」→「已实测」 |

### 本波刻意不做的 vscode-fork 项

- UniverseAgent 引擎 / gRPC / adapter / Device Grant / session-core。
- Task↔client-tool 双执行面 owner（ADR-061 待定；与引擎邻接，**不要**在壳切片里偷选）。
- 扩展分发、`product.json` 身份、rebase 节奏、外仓文档列账。
- ADR-051 Changes tab、ADR-047 Diff 改绑（上节 FORK）。
- 真 Inbox 产品面、权限状态机接引擎、ADR-003 token 全量迁 CSS、多窗口 coordinator。
- Zen Mode 与 Conversation 的产品语义（今日 Zen **不**藏 Conversation；保持，不单开切片）。
- 把生产入口改成 Agents Window，或 workbench import `vs/sessions`。

---

## 验收（方案层；实施另 commit）

切片落地后（仍 **不**要求本方案期间 compile）：

1. LayoutControlMenu 主簇可见钮 = Nav / Conversation / Preview / Sources（辅助窗除外）。
2. Conversation 中心仍非 `ChatEditorInput`；透镜有 SessionBar / 时间线 / dock 三槽；无 Copilot setup。
3. Sources 有可点击 Files 列表；Explorer 仍在 Sidebar；打开文件仍在 End 上格 tabs。
4. `python3 scripts/check-docs-health.py` 在文档变更后 0 error。

## 相关文档

- [m0-topology-surgery.md](m0-topology-surgery.md)
- [deferred-gaps.md](../progress/deferred-gaps.md)
- [agent-ui.md](../../docs/systems/chat/agent-ui.md)
- [companion-contribs.md](../../docs/systems/workbench/companion-contribs.md)
- 外仓 ADR-061（只读）
