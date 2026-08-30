---
title: "platform 层概览"
type: overview
status: accepted
phase: N/A
updated: 2026-08-30
summary: "platform 层角色、可导入范围、DI 约定，以及 instantiation / configuration / commands / agentHost 等代表服务"
---

# platform 层概览

> 导航见 [INDEX](INDEX.md) · 分层规则见 [layers](../../architecture/cross-cutting/layers.md)

`src/vs/platform/` 是 `src/vs/` 有序分层中的第二层：在无服务依赖的 `base` 之上，提供**依赖注入**与**跨层共享的基础服务**。本层不实现 workbench 布局、contrib 功能或 Monaco 编辑器本体；那些分别属于 `workbench`、`workbench/contrib` 与 `editor`。

## 层角色

platform 做三件事：

1. **定义服务契约**：以 `createDecorator` 产出的 `ServiceIdentifier`（通常命名为 `IXxxService`）标识服务；接口带 `_serviceBrand`。
2. **注册默认实现**：`registerSingleton(IXxxService, XxxServiceImpl, InstantiationType.Delayed)`（或 `Eager`）。
3. **按目标环境拆分实现**：同一服务可在 `common` / `browser` / `node` / `electron-browser` / `electron-utility` / `electron-main` 下各有实现，由入口进程装配。

目录按**服务域**分文件夹（如 `configuration/`、`commands/`、`agentHost/`），再按目标环境分子目录。这与 `base` 的「无服务工具」以及 `workbench/services` 的「工作台级服务」不同：platform 服务可被更高层在任意进程中注入。

## 谁可以 import platform

分层只允许向下依赖：

| 层 | 可否 import `vs/platform` |
|----|---------------------------|
| `base` | 否 |
| `platform` | 可（本层与 `base`） |
| `editor` | 可 |
| `workbench`（含 `services`、`contrib`、`api`） | 可 |
| `sessions` | 可（也可依赖 `workbench`） |
| `code`、`server` | 可 |

`workbench` 不得 import `sessions`。更高层把 platform 接口注入到自己的服务与 UI；本层不得反向依赖 `editor` / `workbench` / `sessions` / `code` / `server`。

跨进程协作（main / renderer / shared / extension host / server）见 [Processes 系统](../../systems/processes/INDEX.md)。扩展 API 对 platform 服务的暴露见 [Extension API 系统](../../systems/extension-api/INDEX.md)。

## 依赖注入

权威约定见 [source-code-organization.instructions.md](../../../.github/instructions/source-code-organization.instructions.md)。实现集中在 `instantiation/`。

### 标识符与 `@IService` 装饰器

`createDecorator<T>(serviceId)` 是创建 `ServiceIdentifier<T>` 的唯一合法方式。返回值既是运行时 id，也是**参数装饰器**：只能装饰构造函数参数，不能装饰属性或方法。

```typescript
export const IConfigurationService = createDecorator<IConfigurationService>('configurationService');

class MyComponent {
  constructor(@IConfigurationService private readonly configurationService: IConfigurationService) { }
}
```

约定：

- 装饰参数必须使用该服务的规范接口（如 `IConfigurationService`），生产代码不要用局部子集或 `Pick<...>` 来迁就测试。
- 非服务参数必须排在服务参数之前；`IInstantiationService.createInstance` 用 `GetLeadingNonServiceArgs` 抽出前缀实参，其余由容器注入。
- 服务接口声明 `readonly _serviceBrand: undefined`，以便与普通类型区分（`BrandedService`）。

### 注册：`registerSingleton` 与 `InstantiationType`

```typescript
registerSingleton(IUriIdentityService, UriIdentityService, InstantiationType.Delayed);
```

`InstantiationType`（`instantiation/common/extensions.ts`）：

| 值 | 含义 |
|----|------|
| `Delayed` | 消费者**第一次使用**时再实例化（推荐） |
| `Eager` | 一旦有消费者依赖该服务就立刻实例化，启动成本更高 |

也可传入 `SyncDescriptor`。`getSingletonServiceDescriptors()` 供各进程入口把注册表装进 `ServiceCollection`。

### `IInstantiationService`

`IInstantiationService` 本身也是一个服务（`createDecorator('instantiationService')`）：

- `createInstance(ctor, ...nonServiceArgs)`：同步构造，服务参数由容器补齐
- `invokeFunction(fn)`：把 `ServicesAccessor` 交给函数（命令 handler 常用）
- `createChild(services)`：继承现有服务并覆盖/追加；子容器可 dispose
- `dispose()`：释放本容器创建的服务与子容器，不释放父容器或外来实例

命令 handler 签名是 `(accessor: ServicesAccessor, ...args) => R`，通过 `accessor.get(IXxxService)` 取服务，而不是自己 `new`。

## 代表服务

下列名称均来自 `src/vs/platform/` 内真实 `createDecorator` 标识，不是虚构。

### 基础设施

| 标识 | 目录 | 作用 |
|------|------|------|
| `IInstantiationService` | `instantiation` | 构造注入与子容器 |
| `IConfigurationService` | `configuration` | 设置读取 / 更新；`ConfigurationTarget`（USER、WORKSPACE 等） |
| `ICommandService` | `commands` | `executeCommand`；注册表为 `CommandsRegistry` |
| `IContextKeyService` | `contextkey` | when 子句与上下文键 |
| `IKeybindingService` | `keybinding` | 键位解析与派发 |
| `IFileService` | `files` | 文件系统 provider 聚合 |
| `ILogService` / `ILoggerService` | `log` | 日志 |
| `IStorageService` | `storage` | 键值持久化 |
| `IWorkspaceContextService` | `workspace` | 工作区状态与文件夹 |
| `IEnvironmentService` | `environment` | 路径与 CLI；可用 `refineServiceDecorator` 收窄为 `INativeEnvironmentService` |
| `IProductService` | `product` | 产品配置 |
| `IMainProcessService` | `ipc` | 与 main 的 IPC 通道 |

### Agent Host（本仓库存在）

`agentHost/` 是本层体量最大的服务域之一，提供 Agent Host 协议（AHP）与宿主进程侧编排：

- `IAgentService`：经 MessagePort / `ProxyChannel` 与 agent host 进程通信；会话列表、创建、`dispatchAction`、subscribe
- `IAgentHostService`：工作台侧环境连接（`startAgentHost`、`restartAgentHost`、`onAgentHostExit`），并扩展连接契约
- 另有 `IRemoteAgentHostService`、`ITunnelAgentHostService`、`ISSHRemoteAgentHostService`、`IWSLRemoteAgentHostService`、`ICloudSandboxAgentHostService` 等按宿主形态拆分的标识

协议状态机在 `agentHost/common/state/`（生成代码来自 `agent-host-protocol`）。工作台 Chat / Sessions UI 消费这些服务，细节见 [Chat 系统](../../systems/chat/INDEX.md)。就近规格：`src/vs/platform/agentHost/AGENTS.md`。

同层相邻、但更窄的目录：

- `chat/`：跨层设置键（如 `chat.disableAIFeatures`）与 `AI_AGENT` 环境约定；**不是** `workbench/contrib/chat` 的 UI
- `mcp/`：`IMcpManagementService`、`IMcpGalleryService` 等 MCP 服务器管理
- `agentPlugins/`：`plugin.json` / MCP 清单解析（`IAgentPluginManifest`）

### 其他常用 platform 服务

`IThemeService`、`INotificationService`、`IDialogService`、`IProgressService`、`IQuickInputService`、`IOpenerService`、`ITelemetryService`、`IExtensionManagementService`、`IRemoteAuthorityResolverService`、`IUserDataSyncService`、`IUserDataProfilesService`、`ISecretStorageService`、`IPolicyService`、`IRequestService`、`IPtyService` 等。完整目录一览见 [INDEX](INDEX.md)。

更高层（`workbench/services`、`sessions`）会再实现或包装这些接口；不要在 platform 里寻找 Chat 面板或 Agents Window 的 UI。

## 相关文档

| 文档 | 关系 |
|------|------|
| [platform 索引](INDEX.md) | 本层目录导航 |
| [架构概览](../../architecture/overview.md) | 全景分层 |
| [分层规则](../../architecture/cross-cutting/layers.md) | import 方向与目标环境 |
| [Extension API](../../systems/extension-api/INDEX.md) | 扩展主机如何看见 platform 能力 |
| [Chat](../../systems/chat/INDEX.md) | Chat / agent 跨层协作（消费 `agentHost`、`chat`） |
| [Processes](../../systems/processes/INDEX.md) | 各进程如何装配 platform 单例 |
| [base 索引](../base/INDEX.md) | 本层唯一允许的下层 |
