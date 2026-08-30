---
title: "platform 索引"
type: index
status: accepted
phase: N/A
updated: 2026-08-30
summary: "src/vs/platform/ 导航：DI 基础设施与跨层基础服务目录"
---

# platform 索引

> 返回 [全局索引](../../INDEX.md) · 本层说明见 [overview](overview.md)

## 模块信息

- **源码**: `src/vs/platform/`
- **职责**: 依赖注入（`IInstantiationService`）与跨层共享的基础服务；不含业务 UI 与 contrib
- **依赖方向**: 只能依赖 `base`；`editor` / `workbench` / `sessions` / `code` / `server` 可依赖本层

## 关键入口

| 入口 | 说明 |
|------|------|
| [overview.md](overview.md) | 层职责、谁可以 import platform、DI 约定、代表服务 |
| `instantiation/common/instantiation.ts` | `createDecorator`、`IInstantiationService`、构造注入装饰器 |
| `instantiation/common/extensions.ts` | `registerSingleton`、`InstantiationType` |
| `instantiation/common/instantiationService.ts` | `InstantiationService` 实现 |
| `agentHost/common/agentService.ts` | `IAgentService`、`IAgentHostService` |
| `commands/common/commands.ts` | `ICommandService`、`CommandsRegistry` |
| `configuration/common/configuration.ts` | `IConfigurationService` |

## 重要服务目录

下列目录均存在于 `src/vs/platform/`。职责据该目录内真实接口与文件概括，不是完整清单。

| 目录 | 职责 |
|------|------|
| `instantiation` | DI 核心：`createDecorator`、构造注入、`registerSingleton`、`InstantiationType` |
| `registry` | 全局 `Registry` 贡献点注册表 |
| `configuration` | `IConfigurationService`：设置读写与 `ConfigurationTarget` |
| `commands` | `ICommandService` 与 `CommandsRegistry` |
| `actions` | 菜单 `MenuId` 与 `IMenuService` |
| `action` | 命令动作元数据（`ICommandAction` 等） |
| `contextkey` | `IContextKeyService` 与 `ContextKeyExpr` |
| `keybinding` | `IKeybindingService` |
| `environment` | `IEnvironmentService`：路径、CLI、进程环境 |
| `product` | `IProductService`（`product.json`） |
| `log` | `ILogService` / `ILoggerService` |
| `telemetry` | `ITelemetryService` |
| `lifecycle` | 进程生命周期（如 `ILifecycleMainService`） |
| `storage` | `IStorageService` 键值持久化 |
| `files` | `IFileService` 与文件系统 provider |
| `workspace` | `IWorkspaceContextService`、workspace trust |
| `workspaces` | 多根工作区标识与 main 侧管理 |
| `ipc` | 进程通道（`IMainProcessService` / `IRemoteService`） |
| `process` | `IProcessService` |
| `sharedProcess` | shared process 连接与生命周期常量 |
| `utilityProcess` | Electron utility process worker |
| `windows` | `IWindowsMainService`：主进程窗口集合 |
| `window` | 单窗口契约（common / electron-*） |
| `native` | `INativeHostService` 原生宿主能力 |
| `extensions` | 扩展清单与类型（`IExtension`） |
| `extensionManagement` | `IExtensionManagementService` 安装 / 卸载 |
| `remote` | `IRemoteAuthorityResolverService` 等远程权威解析 |
| `tunnel` | `ITunnelService` 端口转发 |
| `agentHost` | `IAgentHostService` / `IAgentService`：Agent Host 协议与宿主进程 |
| `agentPlugins` | Agent `plugin.json` / MCP 清单解析 |
| `chat` | Chat 跨层设置常量与 `AI_AGENT` 环境约定 |
| `mcp` | `IMcpManagementService` 等 MCP 服务器管理 |
| `theme` | `IThemeService` |
| `notification` | `INotificationService` |
| `dialogs` | `IDialogService` |
| `progress` | `IProgressService` |
| `quickinput` | `IQuickInputService` |
| `opener` | `IOpenerService` |
| `list` | `IListService` |
| `hover` | `IHoverService` |
| `layout` | `ILayoutService` |
| `accessibility` | `IAccessibilityService` |
| `userDataSync` | `IUserDataSyncService` Settings Sync |
| `userDataProfile` | `IUserDataProfilesService` 配置档案 |
| `secrets` | `ISecretStorageService` |
| `policy` | `IPolicyService` 企业策略 |
| `request` | `IRequestService` HTTP |
| `markers` | `IMarkerService` 诊断标记 |
| `undoRedo` | `IUndoRedoService` |
| `uriIdentity` | `IUriIdentityService` |
| `label` | `ILabelService` |
| `terminal` | `IPtyService` 等终端 PTY 契约 |
| `clipboard` | `IClipboardService` |
| `editor` | platform 级编辑器输入 / 模型类型（不是 Monaco 本体） |

## 所属系统

| 系统 | 链接 |
|------|------|
| Extension API | [索引](../../systems/extension-api/INDEX.md) |
| Chat | [索引](../../systems/chat/INDEX.md) |
| Processes | [索引](../../systems/processes/INDEX.md) |

## 相关文档

- [platform 概览](overview.md)
- [架构概览](../../architecture/overview.md)
- [分层规则](../../architecture/cross-cutting/layers.md)
- [横切索引](../../architecture/cross-cutting/INDEX.md)
- [base 索引](../base/INDEX.md)
- 源码组织约定：[source-code-organization.instructions.md](../../../.github/instructions/source-code-organization.instructions.md)
