---
title: "贡献模型：Registry、Workbench 贡献、扩展 contributes"
type: architecture
status: accepted
phase: N/A
updated: 2026-08-30
summary: "三类贡献不要混用：platform Registry、IWorkbenchContribution/WorkbenchPhase、扩展 package.json#contributes；contrib 必须经 workbench.*.main.ts 入口加载并遵守隔离规则"
---

# 贡献模型：Registry、Workbench 贡献、扩展 contributes

> 导航：[横切索引](INDEX.md) · [分层规则](layers.md) · [Workbench 分层](../../modules/workbench/overview.md)。  
> 扩展契约与 contribution point：[Extension API](../../systems/extension-api/overview.md) · [workbench-api](../../modules/workbench-api/INDEX.md)。  
> 权威约定：[source-code-organization.instructions.md](../../../.github/instructions/source-code-organization.instructions.md)。  
> 实现主文件：`src/vs/platform/registry/common/platform.ts` · `src/vs/workbench/common/contributions.ts` · `src/vs/workbench/services/extensions/common/extensionsRegistry.ts`。

「贡献」在本仓有三层意思。它们最终都可能写进同一张工作台注册表（命令、视图、配置），但**谁登记、何时实例化、代码从哪进包**完全不同。改功能前先对号：

| 名字 | 是什么 | 谁写 | 何时生效 |
|------|--------|------|----------|
| **Registry** | 进程内按 id 挂的**注册表对象袋** | 核心 / services / contrib 在模块加载时 `Registry.add` | import 该模块立刻有表；表里的 ctor 未必已 `new` |
| **Workbench 贡献** | `IWorkbenchContribution` 类，由 DI 按 phase 实例化 | 工作台自己的 `*.contribution.ts` | `Workbench.startup()` 调 `IWorkbenchContributionsRegistry.start()` 之后，按 `WorkbenchPhase` |
| **扩展 `contributes`** | `package.json` 声明式 contribution point | 扩展清单；handler 在 renderer | 解析清单即可，**不必**先激活扩展 |

不要把「往 Registry 塞一条描述符」当成「贡献已经跑起来」，也不要把 `src/vs/workbench/contrib/` 和 `extensions/` 当成同一种插件。

## 1. Platform Registry：命名袋，不是生命周期

`IRegistry`（`platform/registry/common/platform.ts`）是全局单例 `Registry`：`add(id, data)` / `knows(id)` / `as<T>(id)`。id 必须唯一，重复 `add` 抛错。这是 **platform 层**的挂钩，workbench / editor / 各服务都往里挂自己的表。

典型表（抽样，不是清单）：

| Registry id / `Extensions.*` | 表里是什么 |
|------------------------------|------------|
| `workbench.contributions.kind` | `IWorkbenchContributionsRegistry`（本节 §2） |
| `ViewContainers` / `Views` | 视图容器与视图描述符（见 [Views 与 Composites](../../systems/workbench/views-and-composites.md)） |
| `EditorPane` / `EditorFactory` | 编辑器 pane 与 input 工厂 |
| `Configuration` | 配置 schema |
| `ExtensionsRegistry` | 扩展 contribution point 定义（本节 §3） |
| 颜色 / 图标 / 尺寸 | 主题 token 表（见 [主题](theming.md)） |

`Registry.as<T>(id)` 只取出**那张表**。往 `ViewsRegistry` 登记一个 view，不会创建 `IWorkbenchContribution`；登记一个 `IWorkbenchContribution`，也不会自动出现在侧栏。两者常配合出现：contrib 入口文件既 `registerWorkbenchContribution2`，又往 Views / Commands / Configuration 表写描述符。

## 2. Workbench 贡献：按 phase 实例化的类

`IWorkbenchContribution`（`workbench/common/contributions.ts`）是标记接口。实现类用构造注入拿服务，在指定时机被 `instantiationService.createInstance`。关闭窗口时若实例 `isDisposable`，registry 会 dispose。

现代入口是 `registerWorkbenchContribution2(id, Ctor, instantiation)`。`id` 在 `BlockStartup` / `BlockRestore`、`{ lazy: true }`、`{ editorTypeId }` 上**必填**；`AfterRestored` / `Eventually` 可以省略。旧 API `Registry.as<IWorkbenchContributionsRegistry>(Extensions.Workbench).registerWorkbenchContribution(Ctor, LifecyclePhase)` 已标 `@deprecated`。

按 id 取实例：`getWorkbenchContribution(id)`。registry 未 `start()`、或 id 未知会抛错；在 `LifecyclePhase.Restored` 之前取会打 warn。

`Workbench.startup()` 在 `initLayout()` 之后、渲染 parts 之前调用 `IWorkbenchContributionsRegistry.start(accessor)`。`start` 之后才按当前 / 即将到达的生命周期创建实例。模块顶层的 `registerWorkbenchContribution2(...)` 只是**排队**。

### WorkbenchPhase

`WorkbenchPhase` 对齐 `LifecyclePhase`，名字强调**会不会挡住首屏编辑器**：

| `WorkbenchPhase` | 对应 `LifecyclePhase` | 实例化方式 | 用途 |
|------------------|----------------------|------------|------|
| `BlockStartup` | `Starting` | **同步、阻塞** | 即将开始启动。挡编辑器出现。只放「没有它首屏会错」的登记（例如若干 extension point / MainThread customer） |
| `BlockRestore` | `Ready` | **同步、阻塞** | 服务已好，窗口即将恢复 UI。同样挡编辑器 |
| `AfterRestored` | `Restored` | **空闲切片**（强制超时 500ms） | 视图 / 面板 / 编辑器已恢复 |
| `Eventually` | `Eventually` | **空闲切片**（强制超时 3s）；且等 `whenRestored`） | 再等 2–5 秒后的收尾 |

另有两种**非 phase**实例化：

- `{ lazy: true }` — 只在 `getWorkbenchContribution(id)` 时创建
- `{ editorTypeId }` — 对应 EditorPane 首次创建时（或 `start()` 时该 pane 已存在）才创建

源码注释反复要求：挡首屏的工作尽量改到 `Lazy` 或更后的 phase。`BlockStartup` / `BlockRestore` 单次创建超过 20ms、之后 phase 超过 100ms 会 warn，并记入 `timings`。

会挡住首屏编辑器的工作应尽量放到 `Lazy` 或更后的 phase — 与 [Workbench 分层概览](../../modules/workbench/overview.md) 的启动顺序一致：`Ready` → `Restored` → 空闲后 `Eventually`。

## 3. 扩展 `package.json#contributes`：声明式点，不是 contrib 目录

第三种「贡献」属于扩展，不在 `src/vs/workbench/contrib/`。细节以 [Extension API 概览](../../systems/extension-api/overview.md) §5 为准，本页只钉边界。

Workbench 用 `ExtensionsRegistry.registerExtensionPoint` 登记点：名字写入 `package.json#contributes` 的 JSON schema，启动时解析**已安装扩展的清单**。Handler 多在 renderer（`workbench/api` 的 views / configuration；`workbench/services` 或各 contrib 的 commands、menus、languages、themes、grammars…）。

关键差异：

- **不必激活扩展**。清单里的 `contributes.views` 会进 `ViewsRegistry`，即使扩展 JS 还没跑。部分点会生成激活事件（如 `onView:<id>`）。
- Handler **改的是工作台注册表**（往往就是 §1 的某张 `Registry`），不是 `IWorkbenchContribution`。
- 激活之后的 `vscode.commands.registerCommand` 等是**命令式**第二条路，走 ExtHost → RPC → `MainThread*`。同一功能可以两条都有（命令既可声明也可 `registerCommand`）。

`browser/extensionHost.contribution.ts` 的 `ExtensionPoints` 本身是一个 `WorkbenchPhase.BlockStartup` 的 workbench 贡献：它 side-import 全部 `mainThread*.ts`，保证第一条 RPC 前 customer 已登记。这是「工作台贡献去加载扩展贡献点」，不要把三个概念收成一个。

视图落点（`contributes.viewsContainers` / `contributes.views`）见 [Views 与 Composites](../../systems/workbench/views-and-composites.md) §3：扩展只往已有 Sidebar / Panel / AuxiliaryBar 填容器与叶，不造新 `Part`。

内置产品功能若能用扩展做，走 `extensions/` + 上述契约；必须进工作台内核的才放 `workbench/contrib/`。

## 4. 入口加载：没被 `workbench.*.main.ts` import 就不进包

打包与运行时都只跟踪**入口文件的静态 import 图**。`contrib/foo/` 在磁盘上存在，不等于会加载。

| 入口 | 放什么 |
|------|--------|
| `workbench.common.main.ts` | 桌面与 Web **共用**的 services、parts、`contrib/*/…contribution.ts` |
| `workbench.desktop.main.ts` | 仅桌面（`electron-browser` 的 contrib / native services） |
| `workbench.web.main.ts`（及 `workbench.web.main.internal.ts`） | 仅 Web |

约定：每个贡献一个 **`.contribution.ts`**（或少数并列入口，如 `chat.contribution.ts` + `chat.view.contribution.ts`），由对应 `workbench.*.main.ts` **side-import**。该文件顶层做 `registerWorkbenchContribution2`、`Registry.as(…).register*`、`registerSingleton`、`registerAction2` 等。未从入口引用的模块是死代码，启动时也不会跑。

桌面壳加载 `workbench.desktop.main.js`（`src/vs/code/electron-browser/workbench/workbench.ts`）；Web 加载 `workbench.web.main.internal.js`（`src/vs/code/browser/workbench/workbench.ts`）。入口图见 [Workbench 分层概览](../../modules/workbench/overview.md)「入口文件」。

因此：只新增 `contrib/bar/browser/bar.contribution.ts` **不够**；必须在 `workbench.common.main.ts`（或 desktop / web 专用入口）加一行 import，否则贡献表里永远没有它。

## 5. Contrib 隔离规则

权威条文在 [source-code-organization.instructions.md](../../../.github/instructions/source-code-organization.instructions.md)「Contribution Rules」；分层导航见 [layers](layers.md)。写代码必须遵守：

1. **`contrib/` 外部不得 import `contrib/` 内部。** `workbench/browser`、`services/`、`api/`、`editor`、`platform` 都不能伸进某个 contrib 的实现。需要共享的能力上提成 **service**（`workbench/services/`），不是「让别人 import 我的 browser 文件」。
2. **每个贡献一个 `.contribution.ts` 入口**，由 `workbench.*.main.ts` side-import（§4）。
3. **对外 API 收在一个 common 文件**（例如 `contrib/files/browser/files.ts` 的 `IExplorerService`）。这是该 contrib 的公共面。
4. **跨 contrib 只走该 common API**，禁止 `import '../otherContrib/browser/internalThing.js'`。

`contrib/` 下一目录即一贡献。contrib **消费** `services/`，但不要把「只有自己用的实现」塞进 `services/`。`registerSingleton` 描述服务；`registerWorkbenchContribution2` 描述启动时要跑的钩子——两者都出现在 `.contribution.ts` 里很常见，职责仍要分开。

`sessions` 有自己的 `contrib/` 与入口（`sessions.*.main.ts`），规则在 [`src/vs/sessions/LAYERS.md`](../../../src/vs/sessions/LAYERS.md)；`workbench` 不得 import `sessions`。本页只管工作台贡献模型。

## 6. 相关文档

- [分层与目标环境](layers.md) · [横切索引](INDEX.md)
- [Workbench 分层概览](../../modules/workbench/overview.md) · [Views 与 Composites](../../systems/workbench/views-and-composites.md)
- [Extension API](../../systems/extension-api/overview.md) · [workbench-api](../../modules/workbench-api/INDEX.md)
- [依赖注入](instantiation.md)（`createDecorator` / `registerSingleton`，与贡献排队正交）
