---
title: "Workbench 核心服务"
type: overview
status: accepted
phase: N/A
updated: 2026-08-30
summary: "workbench/services 与 contrib 的边界；代表目录职责（editor、views、extensions、files、textfile、host、lifecycle、layout、chat entitlement）"
---

# Workbench 核心服务

> 分层叙述见 [Workbench 概览](overview.md)。导航见 [INDEX](INDEX.md)。跨层协作见 [systems/workbench](../../systems/workbench/overview.md)。  
> 注册约定：[分层规则 · 依赖注入](../../architecture/cross-cutting/layers.md)。Chat 深规格在 [modules/chat](../chat/INDEX.md)，本文只记 `services/chat` 的 entitlement。

`src/vs/workbench/services/` 放**跨功能的工作台服务**，不是某一 contrib 的私有实现。当前约 90 个子目录；下面按角色抽样，不是完整清单。

## Services vs contrib

| | `services/` | `contrib/` |
|--|-------------|------------|
| **放什么** | 多处功能都要消费的核心能力 | 产品功能（Explorer、Search、Debug、Terminal、Chat…） |
| **怎么进容器** | `registerSingleton(IFoo, FooImpl, InstantiationType.Delayed)` | `*.contribution.ts` 注册命令、视图、EditorPane、配置、`IWorkbenchContribution` |
| **谁可以依赖谁** | 核心、其他 services、contrib 都可以注入 | contrib **消费** services；**不要**把「只有自己用的实现」塞进 `services/` |
| **禁止** | 在 `Workbench.initServices()` / `desktop.main` / `web.main` 里手写 `serviceCollection.set`（源码注释反复强调） | `contrib/` 外部 import `contrib/` 内部 |

边界细则与入口加载见 [概览 · Services vs contrib](overview.md#services-vs-contrib)。目标环境子目录与全仓库一致：`common` ⊂ `browser` ⊂ `electron-browser`。

## 代表目录

这些是写代码时最常碰到的一组；职责以目录内真实接口为准。

| 目录 | 代表接口 | 职责 |
|------|----------|------|
| `editor/` | `IEditorService`、`IEditorGroupsService`、`IEditorResolverService`、`IEditorPaneService` | 打开/关闭编辑器、管理编辑器组、按资源解析 EditorPane |
| `views/` | `IViewsService`、`IViewDescriptorService` | 打开/关闭 view container 与单个 view；跟踪可见性与焦点 |
| `extensions/` | `IExtensionService` | 拉起 Extension Host（LocalProcess / WebWorker / Remote）、激活扩展、RPC 与 running location |
| `files/` | `IElevatedFileService` | 提权写文件（可能弹出管理员凭据）；通用 `IFileService` 在 `platform/files`，不在本目录 |
| `textfile/` | `ITextFileService`、`ITextEditorService` | 文本文件模型、dirty/untitled、编码、保存参与者 |
| `host/` | `IHostService` | 窗口焦点、开窗、重启、原生 toast；桌面再叠 `INativeHostService` |
| `lifecycle/` | `ILifecycleService` | `LifecyclePhase`（Ready / Restored / Eventually）与关机 veto / join |
| `layout/` | `IWorkbenchLayoutService`、`Parts` | Part 显隐与尺寸、grid 拓扑、Zen Mode 等布局设置 |
| `chat/` | `IChatEntitlementService` | **仅**账号/套餐/额度门闩与 setup context key；**不**持有 `IChatModel`。见 [chat](../chat/INDEX.md) |

`services/extensions` 管宿主进程与激活；安装/启用/推荐在旁边的 `extensionManagement/`、`extensionRecommendations/`。`services/chat` 不要当成 Chat 功能本体——本体在 `contrib/chat/`。

## 抽样目录（15–25）

从仓库实列抽样，一行职责。未列出的目录同样是一等服务，按同名接口进目录即可。

| 目录 | 职责 |
|------|------|
| `editor/` | 编辑器与编辑器组的打开、解析、Pane 注册 |
| `views/` | 视图容器与视图的可见性、打开/关闭 |
| `extensions/` | Extension Host 生命周期与扩展激活 |
| `extensionManagement/` | 安装/卸载、启用、本机/远程/Web 扫描 |
| `files/` | 提权写盘（`IElevatedFileService`） |
| `filesConfiguration/` | 自动保存、只读、关联等文件配置 |
| `textfile/` | 文本模型、编码、保存与 untitled 衔接 |
| `workingCopy/` | 通用 working copy、backup、history |
| `untitled/` | 未保存文本编辑器模型 |
| `host/` | 跨 Web/桌面的窗口与焦点 |
| `lifecycle/` | 启动 phase 与关机序列 |
| `layout/` | Parts / grid 与布局设置 |
| `panecomposite/` | Sidebar / Panel / AuxiliaryBar 上的 pane composite |
| `activity/` | 活动栏条目与徽章 |
| `statusbar/` | 状态栏条目 |
| `workspaces/` | 工作区编辑、信任、文件夹身份 |
| `configuration/` | 工作台侧 JSON 编辑等配置辅助 |
| `commands/` | 命令注册与执行的工作台面 |
| `keybinding/` | 键位编辑与解析辅助 |
| `notification/` | 通知中心 |
| `dialogs/` | 工作台对话框 |
| `environment/` | 工作台环境（路径、参数） |
| `themes/` | 颜色/文件图标/产品图标主题服务 |
| `authentication/` | 认证 session 与扩展查询 |
| `chat/` | Chat entitlement（账号/额度），不是 Chat UI |

## 相关文档

- [Workbench 分层概览](overview.md) · [Workbench 索引](INDEX.md)
- [Extension API](../../systems/extension-api/overview.md) · [workbench-api](../workbench-api/INDEX.md)
- [内置扩展](../../architecture/cross-cutting/builtin-extensions.md)
- [源码组织约定](../../../.github/instructions/source-code-organization.instructions.md)
