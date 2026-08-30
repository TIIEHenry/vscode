---
title: "Extension API 概览"
type: overview
status: accepted
phase: N/A
updated: 2026-08-30
summary: "vscode.d.ts 是扩展契约；extension host 在独立进程兑现；proposed 与 contribution point 的边界"
---

# Extension API 概览

> 导航：[系统索引](INDEX.md) · [workbench-api](../../modules/workbench-api/INDEX.md) · [workbench](../../modules/workbench/INDEX.md) · [Processes](../processes/INDEX.md)

本系统回答四件事：扩展看见什么类型、代码跑在哪个进程、尚未稳定的 API 如何 gated、以及 `package.json#contributes` 与 `vscode.*` 的分工。

## 1. `vscode.d.ts` 是契约，不是实现

`src/vscode-dts/vscode.d.ts` 用 `declare module 'vscode'` 声明扩展可 import 的模块。扩展只依赖这份（以及自己启用的 proposed）类型；工作台内部服务标识符不出现在契约里。

实现在 `src/vs/workbench/api/common/extHost.api.impl.ts` 的 `createApiFactoryAndRegisterActors`：对**每个** `IExtensionDescription` 返回一个 `typeof vscode` 对象。同一进程里的扩展共享 ExtHost actor，但拿到的是各自的 API 表面（便于按扩展做 proposed 检查、遥测与弃用报告）。

稳定模块里现有的 **namespace**（以 `vscode.d.ts` 为准，不要臆造）：

| Namespace | 典型职责 |
|-----------|----------|
| `commands` | 注册 / 执行命令 |
| `window` | 编辑器组、信息提示、终端、状态栏、TreeView 等 UI |
| `workspace` | 工作区文件夹、文档、配置、文件系统、搜索 |
| `languages` | 语言特性 provider（补全、诊断、hover 等） |
| `notebooks` | Notebook 控制器与相关 API |
| `debug` | 调试会话与适配器 |
| `tasks` | 任务提供与执行 |
| `scm` | Source Control |
| `comments` | Comment controller |
| `env` | 应用环境、剪贴板、打开外部 URI |
| `extensions` | 查询已装扩展 |
| `authentication` | 认证 provider / session |
| `l10n` | 扩展本地化 |
| `tests` | 测试控制器 |
| `chat` | Chat participant 等 |
| `lm` | 语言模型与 tool |

类型（`Position`、`Range`、`Uri`、`Diagnostic` 等）由 `extHostTypes` 与 converter 在 RPC 边界与内部 editor/workbench 类型互转。契约变更必须先改 `src/vscode-dts/`，再改 ExtHost / MainThread。

就近说明见 [src/vscode-dts/README.md](../../../src/vscode-dts/README.md)。

## 2. Extension host 进程

扩展代码不在 renderer 里跑。Workbench 通过 `src/vs/workbench/services/extensions/` 拉起 host，种类是 `ExtensionHostKind`：

| Kind | 典型入口 | 运行时 |
|------|----------|--------|
| `LocalProcess` | `workbench/api/node/extensionHostProcess.ts`；工作台侧 `localProcessExtensionHost.ts` | 本机 Node 进程（桌面） |
| `LocalWebWorker` | `workbench/api/worker/extensionHostWorker.ts`；工作台侧 `webWorkerExtensionHost.ts` | 本机 Web Worker（Web / 部分桌面 web 扩展） |
| `Remote` | 远端同样走 Node `extensionHostProcess`；工作台侧 `remoteExtensionHost.ts` | 远程机器上的 Node 进程 |

两端共用 `ExtensionHostMain`：收到 `IMessagePassingProtocol` 与 `IExtensionHostInitData` 后建 `RPCProtocol`、灌入 singleton，再 `IExtHostExtensionService.initialize()`。进程级拓扑（main / renderer / shared / ext host / server）见 [Processes](../processes/INDEX.md)。

### RPC

`common/extHost.protocol.ts` 用 `createProxyIdentifier` 定义双向 shape：

- `MainContext` — ExtHost 调用 workbench（`MainThreadCommands`、`MainThreadDocuments`、…）
- `ExtHostContext` — workbench 调用 ExtHost（`ExtHostCommands`、`ExtHostDocuments`、…）

Renderer 侧 class 用 `@extHostNamedCustomer(MainContext.…)` 登记到 `ExtHostCustomersRegistry`，构造时注入 [workbench](../../modules/workbench/INDEX.md) 服务。ExtHost 侧在 `createApiFactoryAndRegisterActors` 里 `rpcProtocol.set(ExtHostContext.…, actor)`。扩展调用 `vscode.commands.registerCommand` 时，真正改命令注册表的是 renderer 上的 `MainThreadCommands`。

## 3. `common` / `browser` / `node` / `worker`

按 [源码组织](../../../.github/instructions/source-code-organization.instructions.md) 的 target environment 拆分，不要把 Node API 放进 `common` 或 `worker`。

| 目录 | 谁在跑 | 放什么 |
|------|--------|--------|
| `api/common` | 所有 host | 协议、API factory、大多数 `ExtHost*`、`extHost.common.services.ts` |
| `api/browser` | **renderer**（不是 host） | `MainThread*`、`extensionHost.contribution.ts`、部分 contribution point（`views`、`configuration`、`jsonValidation`、`statusBarItems`） |
| `api/node` | LocalProcess / Remote host | `extensionHostProcess.ts`；覆盖 terminal / debug / search / task / tunnel / 磁盘 FS 等 Node 实现 |
| `api/worker` | LocalWebWorker host | Worker 入口与精简 singleton；无 Node 的 debug/task/terminal 走 `common` 里的 Worker stub |

`extHost.common.services.ts` 先注册可共享的实现；`extHost.node.services.ts` / `extHost.worker.services.ts` 再覆盖必须分叉的服务。注释要求：能放 common 的 import 不要只写进 node/worker。

## 4. Proposed 与 stable

| | Stable | Proposed |
|---|--------|----------|
| 声明 | `vscode.d.ts` | `vscode.proposed.<name>.d.ts`（`<name>` 匹配 `[a-zA-Z]+`） |
| 目录 | 随编辑器发布 | 新增文件会生成 `src/vs/platform/extensions/common/extensionsApiProposals.ts` |
| 扩展如何启用 | 无需声明 | `package.json#enabledApiProposals` 列出名字 |
| 运行时 | 始终可用 | `checkProposedApiEnabled` / `isProposedApiEnabled`；未启用则抛错或当 false |
| 发布 | 可发布 | 使用 proposed 的扩展**不能**发布到 Marketplace |

实现里凡是 proposed 成员，必须在进入逻辑前调用上述检查，且名字与生成表一致。Workbench 的 `ExtensionsProposedApi` 还会按 `product.json#extensionEnabledApiProposals`、`--enable-proposed-api` 以及是否从源码 / 扩展开发模式启动，过滤或放宽列表。稳定化意味着把类型搬进 `vscode.d.ts` 并去掉检查；废弃则从 proposed 文件与生成表删除。

## 5. Contribution point（高阶）

扩展有两条贡献路径，不要混成「都是 vscode API」：

1. **声明式** — `package.json` 的 `contributes`。Workbench 用 `ExtensionsRegistry.registerExtensionPoint` 登记点，启动时解析清单，**不必**先激活扩展。Handler 多在 renderer：`workbench/api` 里有 `views` / `viewsContainers`、`configuration` / `configurationDefaults`、`jsonValidation`、`statusBarItems`；更多点（`commands`、`menus`、`languages`、`themes`、`grammars` 等）在 `workbench/services` 或各 contrib。部分点会生成激活事件（例如 `onView:<id>`）。
2. **命令式** — 激活后调用 `vscode.commands`、`vscode.languages.register*` 等。这些走 ExtHost → RPC → `MainThread*`。

`browser/extensionHost.contribution.ts` 的 `ExtensionPoints` 在 `WorkbenchPhase.BlockStartup` 实例化若干点，并 side-effect import 全部 `mainThread*.ts`，保证 customer 在第一条 RPC 前已登记。Contribution point 改的是工作台注册表；`vscode.*` 改的是运行中的 host 状态。两者都可能指向同一功能（命令既可 `contributes.commands` 声明，也可 `registerCommand` 注册）。

## 6. 改动时看哪里

| 意图 | 位置 |
|------|------|
| 改扩展可见类型 / 新稳定 API | `src/vscode-dts/vscode.d.ts` → `extHost.api.impl.ts` → 对应 `ExtHost*` / `MainThread*` / `extHost.protocol.ts` |
| 新 proposed | 按 [vscode-dts README](../../../src/vscode-dts/README.md) 加 `vscode.proposed.<name>.d.ts`，实现处 `checkProposedApiEnabled` |
| 新 contribution point | `ExtensionsRegistry.registerExtensionPoint`；清单 schema 与 handler 放在消费该点的 workbench 模块，而不是塞进 `vscode.d.ts` |
| 只改 host 生命周期 / 进程 | [Processes](../processes/INDEX.md) 与 `workbench/services/extensions/`，不是 `vscode.d.ts` |
