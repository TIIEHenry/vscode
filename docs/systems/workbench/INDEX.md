---
title: "Workbench 系统索引"
type: index
status: accepted
phase: N/A
updated: 2026-09-02
summary: "跨层工作台系统：layout/parts、services、contrib；含 Parts/Grid、Engine catalog（M6-C list-only）与 Settings 接入"
---

# Workbench

> 返回 [全局索引](../../INDEX.md) · 设计正文见 [系统概览](overview.md) · 分层导航见 [modules/workbench](../../modules/workbench/INDEX.md)

## 涉及分层

- `base` — DOM / grid / 生命周期积木（`SerializableGrid`、`Part` 依赖的 UI）
- `platform` — DI、`IConfigurationService`、`IStorageService`、命令与 context key
- `editor` — Monaco；workbench 用 `editor.all` 与 `IEditorService` 把编辑器嵌进 `EDITOR_PART`
- `workbench` — 框架、services、contrib（本系统主场）
- `code` / `server` — 桌面 renderer / Web embedder / 远程服务端加载 workbench 入口
- `sessions` — Agents Window，可复用 workbench 服务；反向禁止业务依赖
- `extensions` — 经 `workbench/api` 把 `vscode.d.ts` 接到同一套 services

## 设计目标

- 用固定的 **parts + grid** 描述窗口 chrome，功能以 **view / editor / contribution** 插入，而不是改核心布局类
- **services** 稳定、可注入；**contrib** 可增删且互不穿透内部
- 桌面与 Web **共享** `workbench.common.main.ts`，差异只留在 desktop / web 入口
- 扩展与内置 contrib 走同一套视图 / 编辑器 / 命令注册表

## 模块协作

| 分层 | 职责 | 关键符号 |
|------|------|----------|
| `base` | 无服务 UI 与 grid | `SerializableGrid`、`ISerializableView` |
| `platform` | 单例与跨层服务 | `registerSingleton`、`IInstantiationService` |
| `editor` | 文本 / diff 编辑器核心 | `editor.all`、`ICodeEditor` |
| `workbench` 核心 | 启动、parts、layout | `Workbench`、`Layout`、`Parts` |
| `workbench` services | 编辑器组、视图、文件、扩展 | `IEditorService`、`IEditorGroupsService`、`IWorkbenchLayoutService` |
| `workbench` contrib | 产品功能（按角色分组，见模块概览） | `*.contribution.ts`、`IWorkbenchContribution` |
| `workbench/api` | Extension Host 实现 | 见 [workbench-api](../../modules/workbench-api/INDEX.md) |
| `contrib/chat` | Chat / Agent UI | 见 [chat](../../modules/chat/INDEX.md) |
| `code` | 加载 desktop / web 入口 | `code/electron-browser/workbench`、`code/browser/workbench` |
| `sessions` | 另一套窗口 chrome | 见 [sessions](../../modules/sessions/INDEX.md) |

## 分析（B2）

- [Parts、Grid、显隐](parts-and-grid.md) — 默认窗口 UI 框架；T1/T2 代码锚点
- [Activity + Sidebar](activity-and-sidebar.md) — Navigator / 四钮 Nav
- [EditorPart tabs](editor-part-tabs.md) — Preview 同构；ADR-002 Conversation 嵌套 IEditorPart 第四插入面（**已落**，S1–S6）
- [Panel + AuxiliaryBar](panel-and-auxiliary-bar.md) — 底栏 / 禁右 rail
- [Title / Status](chrome-title-status.md) — AppTabBar / StatusBar 对照
- [Views / composites](views-and-composites.md) — 视图容器插入面
- [配套 contrib](companion-contribs.md) — files / SCM / terminal / debug
- [Layout 状态](layout-state.md) — 显隐与尺寸持久化
- [Desktop 壳映射](../../reference/code-oss-b2/desktop-shell-mapping.md)
- [Engine catalog](engine-catalog.md) — `ua.engine` Skills/Agents/MCP/Tools catalog @ HEAD；SaveSkillContent 传输 @ `45fa7a35`
- [Settings UA 接入](../../reference/code-oss-b2/settings-ua-access.md) — Preferences 宿主与 UA 三层
- [Navigator tab 适配](../../reference/code-oss-b2/navigator-tabs-access.md) — Activity 五段按 ViewContainer 重设计（draft）

## 相关文档

- [系统概览](overview.md)
- [modules/workbench](../../modules/workbench/INDEX.md) · [分层概览](../../modules/workbench/overview.md)
- [chat](../../modules/chat/INDEX.md) · [workbench-api](../../modules/workbench-api/INDEX.md) · [sessions](../../modules/sessions/INDEX.md)
- [Editor 系统](../editor/INDEX.md) · [Processes](../processes/INDEX.md) · [Extension API](../extension-api/INDEX.md)
- [源码组织约定](../../../.github/instructions/source-code-organization.instructions.md)
