---
title: "Agents 窗口登记引擎连接服务"
type: plan
status: draft
phase: N/A
updated: 2026-10-05
summary: "Agents 桌面与 Web 入口侧载与对应工作台相同的 IUniverseAgentConnection 登记。Changes 与布局不再因服务未注册而起不来。不新开连接，不升 PRD。"
---

# Agents 窗口登记引擎连接服务

> **本稿是方案，未签收。** 本轮没有另派只读审查，`status` 保持 `draft`。
> **不改** `universeAgentConnectionService` 的拨号、握手、快照形状，也不改主进程通道注册。
> **不升** PRD-008、PRD-019、PRD-024。

## 0. 一句话结论

Agents 窗口不加载 `workbench.desktop.main` / `workbench.web.main`。`ChangesViewService` 和 Agent Host changeset 已经注入 `IUniverseAgentConnection`，布局 contribution 又会立刻构造 Changes 服务。入口不登记这个服务时，Changes 多文件差异和会话布局两处 contribution 一起起不来。桌面入口侧载 electron-browser 的连接客户端，Web 入口侧载 browser 的诚实不可用实现。两边都只是登记，不新开一条引擎连接。

## 1. HEAD 事实

| 事实 | 位置 |
|------|------|
| 桌面 Code 窗登记连接客户端 | `src/vs/workbench/workbench.desktop.main.ts` 侧载 `platform/universeAgent/electron-browser/universeAgentConnectionService.js` |
| Web 工作台登记 browser 实现 | `src/vs/workbench/workbench.web.main.ts` 侧载 `platform/universeAgent/browser/universeAgentConnectionService.js` |
| Agents 桌面入口不引用上述模块 | `src/vs/sessions/sessions.desktop.main.ts` |
| Agents Web 入口同样不引用 | `src/vs/sessions/sessions.web.main.ts` |
| 主进程通道对所有窗都在，不按是否 Agents 窗分支 | `src/vs/code/electron-main/app.ts` 把 `IUniverseAgentConnection` 放进服务表，并注册 `universeAgentConnection` 通道 |
| Changes 构造函数注入连接 | `src/vs/sessions/contrib/changes/browser/changesViewService.ts` `@IUniverseAgentConnection` |
| 布局立刻要 Changes 服务 | `src/vs/sessions/contrib/layout/browser/baseSessionLayoutController.ts` `@IChangesViewService`；`sessions.layout.contribution.ts` 在 `BlockRestore` 创建控制器 |
| Agent Host changeset 同样注入 | `src/vs/sessions/contrib/providers/agentHost/browser/agentHostSessionChangesets.ts` |
| Web 实现 `pairingPending` 为假，事件是 `Event.None`，探测返回不支持 | `src/vs/platform/universeAgent/browser/universeAgentConnectionService.ts` `WebUniverseAgentConnection` |
| 登记本身是副作用 import | electron-browser 文件调用 `registerMainProcessRemoteService`；browser 文件调用 `registerSingleton` |

会话代码只注入 `IUniverseAgentConnection`。不注入 session view、pty、hub。

## 2. 选定

1. `sessions.desktop.main.ts` 增加一行侧载：`../platform/universeAgent/electron-browser/universeAgentConnectionService.js`。不侧载 browser 那份，避免同一进程登记两次。
2. `sessions.web.main.ts` 增加一行侧载：`../platform/universeAgent/browser/universeAgentConnectionService.js`。不侧载 electron-browser 那份。
3. 不把这两行放进 `sessions.common.main.ts`。common 同时被桌面和 Web 引用，环境专用登记放错文件会在另一边双登记或引到错误层。
4. 不改连接服务实现，不在 Agents 入口再 `new` 一份主进程服务。桌面客户端连的是 `app.ts` 里已有的那一个通道。
5. Web 继续用现有 `WebUniverseAgentConnection`：不假装已连接，不把 `pairingPending` 写成真。

## 3. 不做

- 不登记 session view、pty、hub。会话代码没有注入它们。
- 不改 `changesViewService` 的写闸，不改 `changesWriteHold`。
- 不改主进程配对框、拨号或信任。
- 不在 Web 上画桌面连接控件。
- 不升任何 PRD，不把本稿标成 `implemented`。

## 4. 验证

源码扫描，不启动窗口。

| 断言 | 落点 |
|------|------|
| 桌面入口含 electron-browser 连接登记，且不含 browser 那份 | 新的 `src/vs/sessions/test/node/sessionsUniverseAgentConnectionRegistration.test.ts` |
| Web 入口含 browser 连接登记，且不含 electron-browser 那份 | 同上 |
| `sessions.common.main.ts` 两份都不含 | 同上 |
| `changesViewService.ts` 构造函数仍注入 `IUniverseAgentConnection` | 同上，防止依赖被删掉后扫描仍绿 |

命令：`scripts/test.sh --grep "Agents window registers universe agent connection"`。

## 5. 知识层

实施时在 [sessions 模块概览](../../docs/modules/sessions/overview.md) 入口一节写明：Agents 窗口不加载工作台 main，连接服务要由对应的 `sessions.*.main.ts` 侧载。不改产品需求。

## 审查记录

2026-10-05：写稿时没有另派只读审查。`status` 保持 `draft`。
