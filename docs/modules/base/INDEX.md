---
title: "base 索引"
type: index
status: accepted
phase: N/A
updated: 2026-08-30
summary: "src/vs/base/ 导航：无服务依赖的工具与 UI 积木，全仓库最底层"
---

# base 索引

> 返回 [全局索引](../../INDEX.md) · [分层规则](../../architecture/cross-cutting/layers.md)

## 模块信息

- **源码**: [`src/vs/base/`](../../../src/vs/base/)
- **职责**: 无服务依赖的通用工具、资源生命周期、事件与可观察量，以及浏览器 UI 积木。不提供 DI / singleton。
- **依赖方向**: 最底层。`src/vs/base/~` 只能 import `vs/base/~`；`src/vs/base/parts/*/~` 还可 import 其他 `vs/base/parts/*/~`。禁止依赖 `platform` / `editor` / `workbench` / `sessions` / `code` / `server`。

## 关键文件夹

| 路径 | 目标环境 | 说明 |
|------|----------|------|
| [`common/`](../../../src/vs/base/common/) | 纯 JS | 断言、生命周期、事件、URI、异步、observable、颜色/图标类型等 |
| [`browser/`](../../../src/vs/base/browser/) | Web / DOM | DOM 助手、手势、Markdown 渲染；[`ui/`](../../../src/vs/base/browser/ui/) 为无服务控件 |
| [`node/`](../../../src/vs/base/node/) | Node.js | `pfs`、进程、端口、zip、crypto 等 |
| [`parts/`](../../../src/vs/base/parts/) | 按子目录分层 | 可复用子系统：`ipc`、`sandbox`、`storage`、`request`、`contextmenu` |
| [`test/`](../../../src/vs/base/test/) | 测试 | 与 `common` / `browser` / `node` 对齐的单测与测试助手 |

## 关键入口

| 入口 | 说明 |
|------|------|
| [`common/assert.ts`](../../../src/vs/base/common/assert.ts) | `assert` / `ok` / `assertNever` |
| [`common/lifecycle.ts`](../../../src/vs/base/common/lifecycle.ts) | `IDisposable`、`Disposable`、`DisposableStore` |
| [`common/event.ts`](../../../src/vs/base/common/event.ts) | `Event` / `Emitter` |
| [`common/themables.ts`](../../../src/vs/base/common/themables.ts) | `ThemeColor` / `ThemeIcon`（类型与 CSS 类名，不是主题服务） |
| [`browser/ui/`](../../../src/vs/base/browser/ui/) | Button、List、Tree、SplitView、Grid 等控件 |
| [`parts/ipc/common/ipc.ts`](../../../src/vs/base/parts/ipc/common/ipc.ts) | `IChannel` / `IServerChannel` |

## 所属系统

base 被所有上层消费，本身不是独立产品系统。

| 系统 | 链接 |
|------|------|
| Editor | [索引](../../systems/editor/INDEX.md) |
| Workbench | [索引](../../systems/workbench/INDEX.md) |
| Sessions | [索引](../../systems/sessions/INDEX.md) |
| Chat | [索引](../../systems/chat/INDEX.md) |
| Extension API | [索引](../../systems/extension-api/INDEX.md) |
| Processes | [索引](../../systems/processes/INDEX.md) |

## 相关文档

- [本层概览](overview.md)
- 上一层导航：[platform 索引](../platform/INDEX.md)
- [架构概览](../../architecture/overview.md)
- [分层规则](../../architecture/cross-cutting/layers.md)
- [Source Code Organization](../../../.github/instructions/source-code-organization.instructions.md)
