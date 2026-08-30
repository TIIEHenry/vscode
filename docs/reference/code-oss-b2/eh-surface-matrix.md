---
title: "Extension Host 表面矩阵（推定 / 待实测）"
type: reference
status: accepted
phase: N/A
updated: 2026-08-31
summary: "贡献点 → Part 落点 → 改壳后 → 承诺分级；本轮无 EH 探针，全部标推定或待实测"
---

# EH 表面矩阵

> 父页：[eh-surface-notes](eh-surface-notes.md)（冲突原则与探针建议）。  
> **本轮无运行中的 Extension Host 探针**——表中 **不得** 写「已实测」或声称探针已跑。  
> 装扩展冒烟后，把对应行的证据列改为「已实测 @\<date\>」并更新「冲突」列。

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
| `languages` / `grammars` / `semanticToken*` | editor 语言层（`EDITOR_PART` 内 Monaco） | 仍在 End 列 `EDITOR_PART` | **承诺** | **推定** |
| `debuggers` / `breakpoints`（适配器协议） | 调试服务 + EH；不占 chrome 槽 | 协议层不变 | **承诺**（适配器） | **推定** |
| `debuggers` / `breakpoints`（调试视图） | 常用 `SIDEBAR_PART` / `PANEL_PART` ViewContainer | 视图仍在 Sidebar/Panel；End 列 Editor 独立 | **冲突**（视图容器顺序/默认开） | **待实测** |
| `viewsContainers.activitybar` | 新 Activity 图标 + `SIDEBAR_PART` 容器 | 与产品 Navigator roster / titlebar 四钮 **抢 Activity 槽** | **不承诺** | **推定** |
| `viewsContainers.panel` | `PANEL_PART` | 底栏仍在；与 ADR-047 Diff 策略并存 | **冲突**（顺序/默认开） | **待实测** |
| `views`（sidebar） | `SIDEBAR_PART` 内 View | 不变 | **冲突**（与产品 tab roster） | **待实测** |
| `views`（panel） | `PANEL_PART` 内 View | 不变 | **冲突**（有限承诺） | **待实测** |
| `views`（auxiliary / `ViewContainerLocation.AuxiliaryBar`） | `AUXILIARYBAR_PART` | Aux **默认关**靠配置/布局（INV-052-NO-RIGHT-RAIL；M2 切片 2 改 `workbench.secondarySideBar.defaultVisibility` 出厂默认，**本 pass 不断言已 `'hidden'`**）→ 视图无处去或被塞进 Sidebar | **不承诺** | **推定** |
| `customEditors` | `EDITOR_PART` tab | End Preview 内打开；**合法**（文件类） | **承诺**「能开」；**不承诺**占中心 | **推定** |
| `editor/*` 装饰 / actions | editor 文本（`EDITOR_PART`） | 随 Editor 挪到 End 列仍有效 | **承诺** | **推定** |
| `chatParticipants` / `languageModelTools` | Chat 贡献 → `ChatViewPane` 容器在 `AUXILIARYBAR_PART`（HEAD `isDefault: false`）；亦可 `ChatEditor` tab | 产品中心 = `contrib/conversation` 透镜；Aux Chat **不是** default 容器、**不是**产品 Conversation | **不承诺**为产品对话面 | **推定** |
| `menus`（`activity` / `view/title`） | Activity / 视图标题 chrome | titlebar 四钮与 Activity 菜单易撞 | **不承诺**（布局菜单） | **推定** |
| `walkthroughs` / `welcome` | 常进 `EDITOR_PART` 或空窗欢迎 | 中心不再是 editor 欢迎页 | **不承诺** | **推定** |
| `commands`（不绑 Part 槽） | 命令 palette / 键绑 | 与 grid 拓扑无关 | **承诺** | **推定** |
| `themes` / `iconThemes` | 全局 token | 不变 | **承诺** | **推定** |
| `taskDefinitions` / `problemMatchers` | 任务/问题服务 | 不变 | **承诺** | **推定** |
| `terminal` profiles / `onStartup` | 常默认 `PANEL_PART` 终端视图 | Panel 仍在底栏 | **冲突**（默认显隐/位置） | **待实测** |
| `notebook` renderers / `notebookKernelProvider` | Notebook editor → `EDITOR_PART` | End 列 Preview tabs | **承诺**开 notebook；**不承诺**占中心 | **推定** |
| `authentication` | 账号会话（无固定 Part） | 不变 | **承诺** | **推定** |

## 探针建议（尚未执行）

与 [eh-surface-notes §2](eh-surface-notes.md) 对齐；**本轮未跑**。

| 探针 | 目的 | 预期看什么 | 证据 |
|------|------|------------|------|
| 纯 LSP / language | 语言承诺是否还在 | End 列 editor 高亮、转到定义 | **待实测** |
| `viewsContainers` + tree view | 布局不承诺是否属实 | Activity 是否多出产品外图标；四钮位是否被挤 | **待实测** |
| 命令 + `editor/decoration` | 非槽位贡献 | 不依赖 Activity 仍生效 | **待实测** |

只装纯 LSP 会得到空矩阵的假安慰——须至少跑 layout 类探针后再收紧「冲突」列。

## Agents Window 外推限制

Agents Window **没有** Activity Bar：`viewsContainers.activitybar` 在该窗 **直接失去表面**。  
用 Sessions 窗冒烟 EH 时：**语言类**结果可外推（同一 editor/EH）；**布局类**结果 **不能** 外推到 B2 默认窗。

## 相关文档

- [eh-surface-notes](eh-surface-notes.md) · [desktop-shell-mapping](desktop-shell-mapping.md)
- [extension-api](../../systems/extension-api/INDEX.md) · [parts-and-grid](../../systems/workbench/parts-and-grid.md)
