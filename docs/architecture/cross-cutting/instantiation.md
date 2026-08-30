---
title: "依赖注入与 instantiation"
type: architecture
status: accepted
phase: N/A
updated: 2026-08-30
summary: "构造注入、createDecorator 标识、Delayed/Eager 单例，以及各层如何 registerSingleton；生产代码不得在构造函数之外用 IInstantiationService 取服务"
---

# 依赖注入与 instantiation

> 导航见 [横切索引](INDEX.md) · 分层见 [layers](layers.md) · platform 层角色见 [platform 概览](../../modules/platform/overview.md)。  
> 权威编码约定：[source-code-organization.instructions.md](../../../.github/instructions/source-code-organization.instructions.md) · [copilot-instructions.md](../../../.github/copilot-instructions.md)。  
> 实现：`src/vs/platform/instantiation/common/instantiation.ts`、`extensions.ts`。

`src/vs/` 的服务不 `new` 出来再互相传递，而是经 **构造函数注入**。`platform/instantiation` 提供标识符、全局单例注册表与容器；各层把实现写进注册表，进程入口把注册表装进 `ServiceCollection` 并 `new InstantiationService`。`base` 无服务，不参与本机制。

## 标识符：`createDecorator`

`createDecorator<T>(serviceId)` 是创建 `ServiceIdentifier<T>` 的**唯一**合法方式。返回值既是运行时 id，也是**参数装饰器**：只能装饰构造函数参数，不能装饰属性或方法（参数个数不是 3 会抛错）。同名 `serviceId` 会复用已有标识。

```typescript
export const IConfigurationService = createDecorator<IConfigurationService>('configurationService');
```

约定：

- 标识通常命名为 `IXxxService`，与接口同名导出。
- 服务接口声明 `readonly _serviceBrand: undefined`，以便与普通类型区分（`BrandedService`）。
- `refineServiceDecorator` 把已有标识收窄为子接口（如 `IEnvironmentService` → `INativeEnvironmentService`），不另开字符串 id。

装饰器把 `{ id, index }` 记在构造函数的 `$di$dependencies` 上，容器据此补齐服务参数。

## 构造注入

消费侧只声明依赖，不查找容器：

```typescript
class MyComponent {
  constructor(@IConfigurationService private readonly configurationService: IConfigurationService) { }
}
```

规则：

- 装饰参数必须使用该服务的**规范接口**。生产代码不要用局部子集或 `Pick<...>` 来迁就测试；偏接口、adapter、桩只放在测试里。
- **非服务参数必须排在服务参数之前**。`IInstantiationService.createInstance` 用 `GetLeadingNonServiceArgs` 抽出前缀实参，其余由容器注入。
- 需要动态构造对象时，把 `IInstantiationService` 本身注入进来，再调用 `createInstance` / `createChild`；不要在方法体里回头查别的服务。

### 生产代码：禁止在构造函数之外用 `IInstantiationService` 取服务

[.github/copilot-instructions.md](../../../.github/copilot-instructions.md) 规定：服务依赖**必须**写在构造函数上，**不得**在之后任何时刻通过 `IInstantiationService` 再取。

这意味着：

- 类在生产路径上需要的服务，全部写成 `@IXxxService` 构造参数。
- 不要保存 `ServicesAccessor`，不要在方法里 `instantiationService.invokeFunction(a => a.get(IXxxService))` 补漏依赖。
- `invokeFunction` / `accessor.get` 留给**没有构造函数的回调**（命令 handler 签名是 `(accessor: ServicesAccessor, ...args) => R`），不是普通服务类的延期查找。

`IInstantiationService`（`createDecorator('instantiationService')`）的合法用途是工厂与子容器，不是服务定位器：

| 方法 | 作用 |
|------|------|
| `createInstance(ctor, ...nonServiceArgs)` | 同步构造；服务参数由容器补齐 |
| `invokeFunction(fn)` | 把一次性 `ServicesAccessor` 交给函数（命令 handler） |
| `createChild(services)` | 继承并覆盖/追加；子容器可 dispose |
| `dispose()` | 释放本容器创建的服务与子容器；不释放父容器或外来实例 |

## 注册：`registerSingleton` 与 `InstantiationType`

```typescript
registerSingleton(IUriIdentityService, UriIdentityService, InstantiationType.Delayed);
```

`InstantiationType`（`extensions.ts`）：

| 值 | 含义 |
|----|------|
| `Delayed`（推荐） | 消费者**第一次使用**时再实例化 |
| `Eager` | 一旦有消费者**依赖**该服务就立刻实例化，启动成本更高 |

也可传入 `SyncDescriptor`（例如带构造前缀参数，或 IPC stub）。`registerSingleton` 把 `[ServiceIdentifier, SyncDescriptor]` 推进模块级 `_registry`。`getSingletonServiceDescriptors()` 返回该表，供各进程入口写入 `ServiceCollection`。

同一 `ServiceIdentifier` 可被多次注册（后写入 `ServiceCollection` 的覆盖先写入的）。真正装进容器的是**当前进程已加载模块**里的调用，因此「加载哪个实现文件」决定「哪个实现生效」。

## 各层如何注册单例

`IInstantiationService` **本身**不走 `registerSingleton`：入口 `new InstantiationService(serviceCollection, strict?)`。其余服务按层写入全局表，或在入口里 `ServiceCollection.set`。

| 层 | 怎么注册 | 谁装进容器 |
|----|----------|------------|
| `base` | 不注册 | — |
| `platform` | 实现文件末尾 `registerSingleton`；同一接口可在 `common` / `browser` / `node` / `electron-*` 各有一份，由入口 import 选中 | 工作台 / EH / standalone 扫 `_registry`；main / CLI / shared / server 常手写 `services.set` |
| `editor` | `common`/`browser` 服务与 `contrib` 侧 `registerSingleton`（多为 `Delayed`） | 工作台入口加载后进入同一 `_registry`；Monaco 独立见 `editor/standalone/browser/standaloneServices.ts`（大量 `Eager` + `getSingletonServiceDescriptors`） |
| `workbench` | `workbench/services/**` 实现文件注册；跨桌面/Web 的放 `workbench.common.main.ts`，仅桌面 / 仅 Web 分别放 `workbench.desktop.main.ts` / `workbench.web.main.ts` | `workbench/browser/workbench.ts`：`getSingletonServiceDescriptors()` → `serviceCollection.set` → `new InstantiationService`。**不要**在 `workbench.ts` 里再注册 |
| `sessions` | `sessions.common.main.ts`（及 desktop/web 入口）与 sessions 服务实现 | `sessions/browser/workbench.ts` 同样扫 `_registry` |
| `code` | 一般**不** `registerSingleton` | `electron-main/main.ts`、`app.ts`、`sharedProcessMain.ts`、`cliProcessMain.ts` 手建 `ServiceCollection` 并 `set` 早期服务 |
| `server` | 同 `code`：入口装配，不靠全局表 | `server` 进程入口手写 `ServiceCollection` |
| `workbench/api`（EH） | 扩展主机侧模块 `registerSingleton` | `extensionHostMain.ts`：`new ServiceCollection(...getSingletonServiceDescriptors())` |

要点：

- **副作用注册**：实现模块被入口 import 时执行 `registerSingleton`。没被入口引用的模块不会进产物，也不会进 `_registry`。
- **按目标环境拆实现**：platform / workbench 对同一标识在不同环境文件里各注册一次；桌面入口加载 `electron-browser` 实现，Web 加载 `browser` 实现。
- **进程入口手装配**：main、shared、CLI、server 要在日志 / 文件 / 环境等基础设施就绪后才能构造工作台级服务，因此早期实例直接 `new` 再 `set`，而不是等 Delayed 图展开。
- **覆盖**：更高层可以为 platform 标识再注册工作台实现（或 Null 实现），装入 `ServiceCollection` 时后写覆盖。

跨进程如何各装一套容器，见 [Processes](../../systems/processes/INDEX.md)。

## 相关文档

| 文档 | 关系 |
|------|------|
| [分层规则](layers.md) | import 方向；DI 一句摘要以本文为准 |
| [platform 概览](../../modules/platform/overview.md) | 层角色与代表服务 |
| [架构概览](../overview.md) | 全景分层与运行时原则 |
| [Processes](../../systems/processes/INDEX.md) | 各进程入口如何装配容器 |
| [Extension API](../../systems/extension-api/INDEX.md) | 扩展主机容器与对外 API |
| [编码约定](../../../.github/copilot-instructions.md) | 构造注入、禁止 ctor 外 lookup |
