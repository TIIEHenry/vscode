---
title: "Workbench 索引"
type: index
status: accepted
phase: N/A
updated: 2026-08-30
summary: "workbench 分层导航：核心、services、contrib、入口文件与虚拟模块"
---

# Workbench 索引

> 返回 [全局索引](../../INDEX.md) · 设计正文见 [分层概览](overview.md) · 跨层协作见 [系统：Workbench](../../systems/workbench/INDEX.md)

## 模块信息

- **源码**: `src/vs/workbench/`
- **职责**: 工作台框架（parts / layout）、核心 services、功能 contrib；把 Monaco 编辑器装进完整 IDE chrome
- **依赖方向**: 可依赖 `base`、`platform`、`editor`。`sessions` 可依赖本层；本层不得依赖 `sessions` 业务代码（`workbench.common.main.ts` 对 `sessions/common/theme.js`、`sizes.js` 的 side-effect 注册是令牌例外，不是业务依赖）

## 关键入口

| 入口 | 说明 |
|------|------|
| [`overview.md`](overview.md) | parts/layout、services vs contrib、贡献规则、入口加载 |
| [`services.md`](services.md) | `workbench/services/` 目录职责与代表服务 |
| `workbench.common.main.ts` | 桌面与 Web 共用的依赖图（唯一「被引用才加载」的共享入口） |
| `workbench.desktop.main.ts` | 桌面：再引入 `electron-browser/desktop.main.ts` 与桌面 services |
| `workbench.web.main.ts` | Web：再引入 `browser/web.main.ts` 与浏览器 services |
| `workbench.web.main.internal.ts` | Embedder 导出面（`create` 等），由 `src/vs/code/browser/workbench/` 加载 |
| `browser/workbench.ts` | `Workbench` 类：`startup()` → 创建 parts → restore |
| `browser/layout.ts` | `Layout`：`IWorkbenchLayoutService` 实现、grid 布局 |
| `services/layout/browser/layoutService.ts` | `Parts` 枚举、`IWorkbenchLayoutService` |

## 所属系统

| 系统 | 链接 |
|------|------|
| Workbench | [systems/workbench](../../systems/workbench/INDEX.md) |
| Editor | [systems/editor](../../systems/editor/INDEX.md) |
| Chat | [systems/chat](../../systems/chat/INDEX.md) |
| Extension API | [systems/extension-api](../../systems/extension-api/INDEX.md) |
| Processes | [systems/processes](../../systems/processes/INDEX.md) |

## 虚拟模块（深规格不在本层）

| 模块 | 源码 | 索引 |
|------|------|------|
| chat | `src/vs/workbench/contrib/chat/` | [modules/chat](../chat/INDEX.md) |
| workbench-api | `src/vs/workbench/api/` | [modules/workbench-api](../workbench-api/INDEX.md) |

## 相关文档

- [分层概览](overview.md)
- [Sessions 模块](../sessions/INDEX.md)（高于 workbench；就近 SSOT 在 `src/vs/sessions/`）
- [分层规则](../../architecture/cross-cutting/layers.md)
- [源码组织约定](../../../.github/instructions/source-code-organization.instructions.md)
