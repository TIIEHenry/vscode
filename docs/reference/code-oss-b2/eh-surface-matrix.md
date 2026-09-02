---
title: "Extension Host 表面矩阵（推定 / 待实测）"
type: reference
status: accepted
phase: N/A
updated: 2026-09-02
summary: "贡献点 → Part 落点 → 承诺分级；D5 wave3 + D9 panel/decoration 已实测；terminal 自动化 blocked"
---

# EH 表面矩阵

> 父页：[eh-surface-notes](eh-surface-notes.md)（冲突原则与探针建议）。  
> **探针已选；安装 2/3 @2026-09-01**（`redhat.vscode-yaml`、`gruntfuggly.todo-tree` → `/tmp/d5-probe-ext-vsix`；`ms-vscode.js-debug` 用产品内置，不装 VSIX）——表中 **不得** 写「已实测」直到 `launch.sh` 冒烟完成。  
> 装扩展冒烟后，把对应行的证据列由「探针已选」改为「已实测 @\<date\>」并更新「冲突」列。

列说明：

| 列 | 含义 |
|----|------|
| **贡献点** | `package.json` 扩展贡献点或贡献族 |
| **lands on** | 改壳 **前** 默认落到哪个 Part / 子系统 |
| **after shell change** | M0 拓扑（`ConversationPart` 中心 + `EditorPart` End 列）后的预期落点 |
| **承诺 \| 不承诺 \| 冲突** | 对产品扩展面的合同分级（见 eh-surface-notes §1） |
| **证据** | **推定** = 自代码路径 / 文档推理；**待实测** = 须装扩展验证 |

## 矩阵

| 贡献点 | lands on | after shell change | 承诺 \| 不承诺 \| 冲突 | 证据 |
|--------|----------|-------------------|------------------------|------|
| `languages` / `grammars` / `semanticToken*` | editor 语言层（`EDITOR_PART` 内 Monaco） | 仍在 End 列 `EDITOR_PART` | **承诺** | **已实测 @2026-09-01** — `redhat.vscode-yaml` 诊断 @ [rerun-2348](../../../dev/progress/d5-evidence/smoke-rerun-2348/) |
| `debuggers` / `breakpoints`（适配器协议） | 调试服务 + EH；不占 chrome 槽 | 协议层不变 | **承诺**（适配器） | **推定** |
| `debuggers` / `breakpoints`（调试视图） | 常用 `SIDEBAR_PART` / `PANEL_PART` ViewContainer | 视图仍在 Sidebar/Panel；End 列 Editor 独立 | **冲突**（视图容器顺序/默认开） | **已实测 @2026-09-02** — 内置 js-debug + `launch.json` @ [wave3](../../../dev/progress/d5-evidence/smoke-wave3-0001/) |
| `viewsContainers.activitybar` | 新 Activity 图标 + `SIDEBAR_PART` 容器 | 与产品 Navigator roster / titlebar 四钮 **抢 Activity 槽** | **不承诺** | **推定** |
| `viewsContainers.panel` | `PANEL_PART` | 底栏仍在；与 ADR-047 Diff 策略并存 | **冲突**（顺序/默认开） | **已实测 @2026-09-02** — `zhangmo8.git-panel` → Panel tabs Ports · **Git Panel** · Inspect @ [d9](../../../dev/progress/d5-evidence/smoke-d9-0001/) |
| `views`（sidebar） | `SIDEBAR_PART` 内 View | 不变 | **冲突**（与产品 tab roster） | **已实测 @2026-09-02** — `gruntfuggly.todo-tree` via 产品 **TODOs** 槽 → **TODOs: Tree** @ [wave3](../../../dev/progress/d5-evidence/smoke-wave3-0001/) |
| `views`（panel） | `PANEL_PART` 内 View | 不变 | **冲突**（有限承诺） | **已实测 @2026-09-02** — git-panel `panelHistoryView` / `panelChanges` @ [d9](../../../dev/progress/d5-evidence/smoke-d9-0001/) |
| `views`（auxiliary / `ViewContainerLocation.AuxiliaryBar`） | `AUXILIARYBAR_PART` | Aux **默认关**（`workbench.secondarySideBar.defaultVisibility` 出厂 `'hidden'`；splash 同值；Chat 容器 `isDefault: false`）→ 视图无处去或被塞进 Sidebar | **不承诺** | **推定** |
| `customEditors` | `EDITOR_PART` tab | End Preview 内打开；**合法**（文件类） | **承诺**「能开」；**不承诺**占中心 | **推定** |
| `editor/*` 装饰 / actions | editor 文本（`EDITOR_PART`） | 随 Editor 挪到 End 列仍有效 | **承诺** | **已实测 @2026-09-02** — `usernamehw.errorlens` + `d5-probe-todo.js` @ [d9](../../../dev/progress/d5-evidence/smoke-d9-0001/) |
| `chatParticipants` / `languageModelTools` | Chat 贡献 → `ChatViewPane` 容器在 `AUXILIARYBAR_PART`（HEAD `isDefault: false`）；亦可 `ChatEditor` tab | 产品中心 = `contrib/conversation` 透镜；Aux Chat **不是** default 容器、**不是**产品 Conversation | **不承诺**为产品对话面 | **推定** |
| `menus`（`activity` / `view/title`） | Activity / 视图标题 chrome | titlebar 四钮与 Activity 菜单易撞 | **不承诺**（布局菜单） | **推定** |
| `walkthroughs` / `welcome` | 常进 `EDITOR_PART` 或空窗欢迎 | 中心不再是 editor 欢迎页 | **不承诺** | **推定** |
| `commands`（不绑 Part 槽） | 命令 palette / 键绑 | 与 grid 拓扑无关 | **承诺** | **推定** |
| `themes` / `iconThemes` | 全局 token | 不变 | **承诺** | **推定** |
| `taskDefinitions` / `problemMatchers` | 任务/问题服务 | 不变 | **承诺** | **推定** |
| `terminal` profiles / `onStartup` | 常默认 `PANEL_PART` 终端视图 | Panel 仍在底栏 | **冲突**（默认显隐/位置） | **待实测** |
| `notebook` renderers / `notebookKernelProvider` | Notebook editor → `EDITOR_PART` | End 列 Preview tabs | **承诺**开 notebook；**不承诺**占中心 | **推定** |
| `authentication` | 账号会话（无固定 Part） | 不变 | **承诺** | **推定** |

## Probe plan

与 [eh-surface-notes §2](eh-surface-notes.md) 对齐。以下为 **D5 最小探针集**（1 LSP + 2 layout，共 3 个扩展）；**已装入** `EXT_DIR=/tmp/d5-probe-ext-vsix`（2 个 VSIX + 内置 js-debug）。

| 扩展 | Marketplace ID | 验证行 / 探针 | 看什么 | 安装 |
|------|----------------|---------------|--------|------|
| YAML | `redhat.vscode-yaml` | 探针「纯 LSP / language」 | End 列 `EDITOR_PART` 内：语法高亮、hover、schema 诊断 | VSIX OK |
| Todo Tree | `gruntfuggly.todo-tree` | `views`（sidebar）；探针「`viewsContainers` + tree view」 | Sidebar 树视图是否落槽；Activity 是否多出产品外图标 | VSIX OK |
| JavaScript Debugger | `ms-vscode.js-debug` | `debuggers` / `breakpoints`（调试视图） | F5 启动调试后 Run and Debug / 断点视图在 Sidebar/Panel 的显隐 | **builtin**（VSIX 安装被拒） |

**D9 次级探针（2026-09-02）** — 装于 `/tmp/d5-probe-ext-vsix`（与 wave3 同目录）：

| 扩展 | Marketplace ID | 验证行 | 安装 |
|------|----------------|--------|------|
| Git Panel | `zhangmo8.git-panel` | `viewsContainers.panel` / `views`(panel) | VSIX OK |
| Terminals Manager | `fabiospampinato.vscode-terminals` | `terminal` onStartup + `.vscode/terminals.json` | VSIX OK；**xterm 冒烟 blocked**（见 [d9](../../../dev/progress/d5-evidence/smoke-d9-0001/)） |
| Error Lens | `usernamehw.errorlens` | 命令 + `editor/decoration` | VSIX OK |

**仍待实测**：`terminal` profiles / `onStartup` 行（扩展已选已装；需人工或可靠 terminal 自动化）。

**wave3 不覆盖**（D5 首轮）：panel / terminal / decoration — panel 与 decoration 已由 D9 关闭。

只装纯 LSP 会得到空矩阵的假安慰——须至少跑 layout 类探针后再收紧「冲突」列。

## 探针建议（对照表）

| 探针 | 目的 | 预期看什么 | 证据 |
|------|------|------------|------|
| 纯 LSP / language | 语言承诺是否还在 | End 列 editor 高亮、转到定义 | **已实测 @2026-09-01** |
| `viewsContainers` + tree view | 布局不承诺是否属实 | Activity 是否多出产品外图标；四钮位是否被挤 | **已实测 @2026-09-02** — 无独立扩展 Activity 图标；复用产品 TODOs 槽 |
| 命令 + `editor/decoration` | 非槽位贡献 | 不依赖 Activity 仍生效 | **已实测 @2026-09-02** — Error Lens @ [d9](../../../dev/progress/d5-evidence/smoke-d9-0001/) |

## Agents Window 外推限制

Agents Window **没有** Activity Bar：`viewsContainers.activitybar` 在该窗 **直接失去表面**。  
用 Sessions 窗冒烟 EH 时：**语言类**结果可外推（同一 editor/EH）；**布局类**结果 **不能** 外推到 B2 默认窗。

## 相关文档

- [eh-surface-notes](eh-surface-notes.md) · [desktop-shell-mapping](desktop-shell-mapping.md)
- [extension-api](../../systems/extension-api/INDEX.md) · [parts-and-grid](../../systems/workbench/parts-and-grid.md)
