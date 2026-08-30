---
title: "base 概览"
type: overview
status: accepted
phase: N/A
updated: 2026-08-30
summary: "base 的依赖边界、代表性子系统，以及 platform 及以上如何消费它"
---

# base 概览

> 导航：[模块索引](INDEX.md) · [分层规则](../../architecture/cross-cutting/layers.md)

`src/vs/base/` 是 `src/vs/` 的最底层：通用工具与 UI 积木。约定见 [Source Code Organization](../../../.github/instructions/source-code-organization.instructions.md)：**无服务依赖**，不注册 singleton，不实现 `IXxxService`。

## 可以依赖 / 不可以依赖

由 `eslint.config.js` 的 `local/code-import-patterns` 强制：

| 代码位置 | 允许 import | 禁止 |
|----------|-------------|------|
| `src/vs/base/~`（`common` / `browser` / `node` 等） | 仅 `vs/base/~` | `vs/platform/*`、`vs/editor/*`、`vs/workbench/*`、`vs/sessions/*`、`vs/code/*`、`vs/server/*` |
| `src/vs/base/parts/*/~` | `vs/base/~` 与 `vs/base/parts/*/~` | 同上；也不得反向被 `common`/`browser`/`node` 依赖 |

层内目标环境（与全仓库一致）：

| 文件夹 | 可用 API | 可依赖 |
|--------|----------|--------|
| `common` | 基本 JavaScript | — |
| `browser` | Web / DOM | `common` |
| `node` | Node.js | `common` |
| `electron-browser` / `electron-main` | 仅出现在 `parts/`（如 ipc、sandbox、contextmenu） | 对应更低环境 |

因此：`common` 不得使用 DOM 或 Node API；`browser` 与 `node` 互不引用。主题服务、配置、实例化等属于 [`src/vs/platform/`](../../../src/vs/platform/)，不在本层。

个别文件会相对引用 [`src/vs/nls.ts`](../../../src/vs/nls.ts) 做字符串本地化，这不是对更高分层的依赖。

## 代表性子系统

### 断言 — `assert`

[`src/vs/base/common/assert.ts`](../../../src/vs/base/common/assert.ts) 提供 `assert`（失败抛 `BugIndicatingError`）、已弃用的 `ok`，以及 `assertNever`。错误类型在 [`common/errors.ts`](../../../src/vs/base/common/errors.ts)。

### 生命周期 — `IDisposable` / `Disposable`

[`src/vs/base/common/lifecycle.ts`](../../../src/vs/base/common/lifecycle.ts) 是全仓库资源所有权的核心：

- `IDisposable.dispose()`
- `toDisposable` / `combinedDisposable` / `dispose`
- `DisposableStore`、`DisposableMap`、`DisposableSet`
- 抽象基类 `Disposable`（子类用 `_register`）

测试侧用 [`src/vs/base/test/common/utils.ts`](../../../src/vs/base/test/common/utils.ts) 的 disposable tracker，避免监听器与 store 泄漏。

### 事件 — `Event` / `Emitter`

[`src/vs/base/common/event.ts`](../../../src/vs/base/common/event.ts) 把事件做成可订阅函数：`Event<T>` + `Emitter<T>`，订阅返回 `IDisposable`。`Event` 命名空间提供 debounce、map、once 等组合子。浏览器侧 [`src/vs/base/browser/event.ts`](../../../src/vs/base/browser/event.ts) 的 `DomEmitter` 把 DOM 事件接到同一模型。

取消与异步建立在同一套原语上：[`cancellation.ts`](../../../src/vs/base/common/cancellation.ts)、[`async.ts`](../../../src/vs/base/common/async.ts)。

### 主题类型与 UI 积木

本层**没有** `IThemeService`。它只提供可主题化的值与无服务控件：

| 符号 / 目录 | 路径 | 角色 |
|-------------|------|------|
| `ThemeColor` / `ThemeIcon` | [`common/themables.ts`](../../../src/vs/base/common/themables.ts) | 颜色/图标标识与 CSS 类名 |
| `Color` / `RGBA` | [`common/color.ts`](../../../src/vs/base/common/color.ts) | 颜色运算 |
| `Codicon` | [`common/codicons.ts`](../../../src/vs/base/common/codicons.ts) | 内置图标目录 |
| `Widget` | [`browser/ui/widget.ts`](../../../src/vs/base/browser/ui/widget.ts) | 控件基类（绑定 DOM 事件并登记 disposable） |
| 控件集 | [`browser/ui/`](../../../src/vs/base/browser/ui/) | actionbar、button、list、tree、menu、splitview、grid、sash 等 |

`platform/theme` 等上层把 `ThemeIcon` 接到真正的主题注册表与样式表。

### 其他高频工具

- [`URI`](../../../src/vs/base/common/uri.ts)、[`resources.ts`](../../../src/vs/base/common/resources.ts)、[`path.ts`](../../../src/vs/base/common/path.ts)
- [`observable.ts`](../../../src/vs/base/common/observable.ts)（门面；实现在 [`observableInternal/`](../../../src/vs/base/common/observableInternal/)）
- [`actions.ts`](../../../src/vs/base/common/actions.ts) 的 `IAction`
- [`platform.ts`](../../../src/vs/base/common/platform.ts) 的 OS / web / Electron 探测
- [`common/worker/`](../../../src/vs/base/common/worker/) 的 web worker 引导

### `parts/`：跨环境子系统

| 子系统 | 源码 | 作用 |
|--------|------|------|
| ipc | [`parts/ipc/`](../../../src/vs/base/parts/ipc/) | `IChannel` / `IServerChannel` 与各环境传输 |
| sandbox | [`parts/sandbox/`](../../../src/vs/base/parts/sandbox/) | 沙箱渲染进程配置类型与 preload |
| storage | [`parts/storage/`](../../../src/vs/base/parts/storage/) | 键值存储原语（无 workbench 配置语义） |
| request | [`parts/request/`](../../../src/vs/base/parts/request/) | HTTP 请求选项与离线错误 |
| contextmenu | [`parts/contextmenu/`](../../../src/vs/base/parts/contextmenu/) | 原生/Electron 上下文菜单项形状 |

## 上层如何使用

`platform`、`editor`、`workbench`、`sessions`、`code`、`server` 均可 import `vs/base/~` 与 `vs/base/parts/*/~`，且只能向下依赖。典型用法：

1. **生命周期**：服务与 contrib 继承 `Disposable`，或把监听器放进 `DisposableStore`。
2. **事件**：平台服务对外暴露 `Event<T>`，内部用 `Emitter`。
3. **标识与路径**：全栈用 `URI`，不用裸字符串路径。
4. **UI**：workbench / editor 组合 `browser/ui` 控件，而不是另写一套 list/tree/button。
5. **进程间**：`platform` 的 IPC 服务建在 `parts/ipc` 的 channel 模型上。
6. **主题**：上层实现主题服务；控件与命令只携带 `ThemeIcon` / `ThemeColor`。

单测复用 [`src/vs/base/test/common/`](../../../src/vs/base/test/common/)（如 `utils.ts`、`mock.ts`）以及 `test/browser`、`test/node`。
