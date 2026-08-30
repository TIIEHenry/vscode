---
title: "Extension Host 表面 vs 改壳（冲突矩阵草案）"
type: reference
status: accepted
phase: N/A
updated: 2026-08-30
summary: "INV-EH-SURFACE：按贡献点落到哪个 Part；布局/Activity 槽默认不承诺。非探针实测。"
---

# EH 表面 vs 改壳

父方案：语言/调试可先承诺；**布局 / Activity / Editor 槽位类默认不承诺**。  
本页是 **贡献点 → Part** 地图与冲突原则。结构化矩阵见 **[eh-surface-matrix.md](eh-surface-matrix.md)**（本轮行均标 **推定** 或 **待实测**，无探针）。装扩展实测后才能改矩阵「冲突」列。

## 1. 贡献点落点

| 贡献点（`package.json`） | 默认落到 | 改壳后 | 建议承诺 |
|--------------------------|----------|--------|----------|
| `languages` / `grammars` / `semanticToken*` | editor 语言层，不占 chrome 槽 | 仍在 `EDITOR_PART` 内 | **承诺**（spike 语言冒烟） |
| `debuggers` / `breakpoints` | 调试服务 + 常用 Panel/Sidebar 视图 | 视图可能跑到 Sidebar/Panel | **倾向承诺**调试适配器；视图容器另计 |
| `viewsContainers.activitybar` | **新 Activity 图标 + Sidebar 容器** | 与产品 Navigator roster / 四钮抢 Activity | **不承诺** |
| `viewsContainers.panel` | `PANEL_PART` | 底栏仍在；与 ADR-047 Diff 策略并存 | 有限承诺（不保证顺序/默认开） |
| `views`（sidebar/panel/aux） | 对应 Part | Aux 默认关（无右 rail）时 aux 视图 **无处去或被塞进 Sidebar** | aux：**不承诺**；sidebar/panel：冲突记矩阵 |
| `customEditors` | `EDITOR_PART` tab | End Preview 内打开，**合法**（文件类） | 承诺「能开」；不承诺占中心 |
| `editor/`* 装饰/actions | editor 文本 | 随 EditorPart 挪位仍有效 | **承诺** |
| `chatParticipants` / `languageModelTools` | Chat 贡献 | 若 Conversation 不用 VS Code chat 贡献点 | **不承诺**为产品对话面（INV-NO-COPILOT / 第二会话真相） |
| `menus`（`activity` / `view/title`） | chrome | 四钮与 Activity 菜单易撞 | 布局菜单：**不承诺** |
| `walkthroughs` / `welcome` | 常进 editor 或空窗 | 中心不再是 editor 欢迎页 | **不承诺** |

## 2. spike 探针建议（与原文 §4.1.5 对齐）

| 探针 | 目的 | 看什么 |
|------|------|--------|
| 纯 LSP / language | 语言承诺是否还在 | 高亮、转到定义（End 列 editor） |
| `viewsContainers` + tree view | 布局不承诺是否属实 | Activity 是否多出产品外图标；四钮是否被挤 |
| 命令 + `editor/decoration` | 非槽位贡献 | 不依赖 Activity |

只装纯 LSP 会得到空矩阵的假安慰（spike 原文）。

## 3. 与 Sessions 窗口的差异

Agents Window **没有** Activity Bar：`viewsContainers.activitybar` 在该窗 **直接失去表面**。若有人想「先用 Sessions 窗冒烟 EH」，布局类结果 **不能外推**到 B2 默认窗。语言类结果可外推（同一 editor/EH）。

## 4. 相关文档

- [extension-api](../../systems/extension-api/INDEX.md)
- [eh-surface-matrix](eh-surface-matrix.md) · [desktop-shell-mapping](desktop-shell-mapping.md)
