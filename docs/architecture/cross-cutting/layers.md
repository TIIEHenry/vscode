---
title: "分层与目标环境规则"
type: architecture
status: accepted
phase: N/A
updated: 2026-08-30
summary: "src/vs 有序分层、目标环境子目录、workbench 组织、sessions import 与 valid-layers-check"
---

# 分层与目标环境规则

> 全景见 [架构概览](../overview.md)。权威约定：[.github/instructions/source-code-organization.instructions.md](../../../.github/instructions/source-code-organization.instructions.md)。`sessions` 内部再分层以 [`src/vs/sessions/LAYERS.md`](../../../src/vs/sessions/LAYERS.md) 为 SSOT，本文不复制其 contrib/provider 细则。

`src/vs/` 只有这些层目录：`base`、`platform`、`editor`、`workbench`、`sessions`、`code`、`server`。根上另有 `nls.ts`、`amdX.ts`、`monaco.d.ts`，不是层。

## 有序分层

每一层只能 import 更低层：

1. **`base`** — 无服务依赖的工具与 UI 积木（`common` / `browser` / `node`，以及 `parts/`）
2. **`platform`** — DI 与跨层基础服务（每个服务一个子目录）
3. **`editor`** — Monaco 核心；**不得**依赖 `node` 或 `electron-*`
4. **`workbench`** — 工作台框架、panels、views
5. **`code`** — 桌面入口（Electron main、shared process、CLI）
6. **`server`** — 远程开发服务端入口
7. **`sessions`** — Agents Window；可依赖 `workbench` 及以下；**`workbench` 不得 import `sessions`**

`code`、`server`、`sessions` 都在 `workbench` 之上，是并列产品入口，不是 `code → server → sessions` 的再堆叠。

```
                    code          server         sessions
                      │              │               │
                      └──────────────┼───────────────┘
                                     ▼
                                workbench
                                     │
                          ┌──────────┴──────────┐
                          ▼                     ▼
                       editor               platform
                          │                     │
                          └──────────┬──────────┘
                                     ▼
                                    base
```

## 目标环境

层内按运行时分子目录。高环境可依赖低环境，反之不行：

| 文件夹 | 可用 API | 可使用 |
|--------|----------|--------|
| `common` | 仅基础 JavaScript | — |
| `browser` | Web / DOM | `common` |
| `node` | Node.js | `common` |
| `electron-browser` | 浏览器 + 有限 Electron IPC | `common`、`browser` |
| `electron-utility` | Electron utility process | `common`、`node` |
| `electron-main` | Electron main process | `common`、`node`、`electron-utility` |

各层实际出现的目标环境（`test/` 另计）：

| 层 | 目标环境 / 组织 |
|----|-----------------|
| `base` | `common`、`browser`、`node`；跨环境部件在 `parts/`（ipc、sandbox、storage 等） |
| `platform` | 按服务分目录，其下再放 `common` / `browser` / `node` / `electron-browser` / `electron-main` / `electron-utility`（并非每个服务都有全部环境） |
| `editor` | `common`、`browser`；功能在 `contrib/`；独立嵌入在 `standalone/` |
| `workbench` | `common`、`browser`、`electron-browser`；另有 `services/`、`contrib/`、`api/` |
| `sessions` | `common`、`browser`、`electron-browser`；另有 `services/`、`contrib/` |
| `code` | `browser`、`node`、`electron-browser`、`electron-main`、`electron-utility` |
| `server` | 仅 `node` |

## Workbench 组织

- `vs/workbench/{common\|browser\|electron-browser}` — 最小工作台核心
- `vs/workbench/api` — `vscode.d.ts` 提供者（`browser` / `common` / `node` / `worker`）
- `vs/workbench/services` — 核心服务，不是某一 contrib 的私有实现
- `vs/workbench/contrib` — 功能贡献（chat、debug、terminal、search 等）

贡献规则：

- `contrib/` 外部不得依赖 `contrib/` 内部
- 每个贡献一个 `.contribution.ts` 入口
- 贡献对外 API 从单一 common 文件暴露；跨贡献只走该 API，不探内部

只有被入口引用的模块才会加载：

| 入口 | 用途 |
|------|------|
| `workbench.common.main.ts` | 全平台共享依赖 |
| `workbench.desktop.main.ts` | 仅桌面 |
| `workbench.web.main.ts` | 仅 Web（内部变体 `workbench.web.main.internal.ts`） |
| `workbench/electron-browser/desktop.main.ts` | 桌面渲染进程启动 |
| `workbench/browser/web.main.ts` | Web 工作台启动 |

桌面 / Web 壳分别在 `src/vs/code/electron-browser/workbench/` 与 `src/vs/code/browser/workbench/`。

## Sessions import 规则

`sessions` 高于 `workbench`：可以 import `vs/workbench/~`、`vs/workbench/browser/**`、`vs/workbench/services/*/~`（以及更低的 `editor` / `platform` / `base`）。反向禁止——`workbench` 不得 import `sessions`。

`sessions` 自身再分：`sessions/~` 核心 → `services/*/~` → `contrib/*/~` → `contrib/providers/*/~`。非 provider 的 contrib **不得** import `contrib/providers`。入口 `sessions.common.main.ts` / `.desktop.main.ts` / `.web.main.ts` / `.web.main.internal.ts` 可以引用其下全部子层。桌面引导 `src/vs/sessions/electron-browser/sessions.ts` 的允许集合更窄。细则只维护在 [`src/vs/sessions/LAYERS.md`](../../../src/vs/sessions/LAYERS.md)，由 `local/code-import-patterns` ESLint 强制。

分层导航：[sessions 模块](../../modules/sessions/INDEX.md) · 跨层系统：[sessions 系统](../../systems/sessions/INDEX.md)。

## 其他入口

| 入口 | 层 / 进程 |
|------|-----------|
| `src/vs/code/electron-main/main.ts` | Electron main |
| `src/vs/code/electron-utility/sharedProcess/sharedProcessMain.ts` | shared / utility |
| `src/vs/code/node/cli.ts`、`cliProcessMain.ts` | CLI |
| `src/vs/server/node/server.main.ts` | 远程 server |
| `src/vs/editor/editor.main.ts` | Monaco 独立 |

进程协作见 [Processes](../../systems/processes/INDEX.md)。

## 依赖注入

服务通过构造函数装饰器注入（`@IMyService`），用规范服务接口，不在生产代码里为测试发明 `Pick<>` 子集。提供侧：`registerSingleton(IMyService, MyServiceImpl, InstantiationType.Delayed)`。非服务参数必须写在服务参数之前。

## valid-layers-check

`package.json` 脚本 `npm run valid-layers-check` 运行：

1. `build/checker/layersChecker.ts` — 按目标环境禁止原生类型漏进 `common` / `browser` 等
2. `build/checker/layersTypeCheck.ts` — 用 `browser` / `worker` / `node` / `electron-browser` / `electron-main` / `electron-utility` 各自的 lib 做类型检查，跨环境 API 会编译失败

多数层边界还由 `tsconfig.<layer>.json` 与 ESLint import patterns 约束。仅在改动可能影响分层或目标环境时运行此脚本；日常改动优先最小针对性测试。见 [横切索引](INDEX.md) 与 [编码约定](../../../.github/copilot-instructions.md)。

## 相关分层导航

| 层 | 索引 |
|----|------|
| base | [INDEX](../../modules/base/INDEX.md) |
| platform | [INDEX](../../modules/platform/INDEX.md) |
| editor | [INDEX](../../modules/editor/INDEX.md) |
| workbench | [INDEX](../../modules/workbench/INDEX.md) |
| sessions | [INDEX](../../modules/sessions/INDEX.md) |
| code | [INDEX](../../modules/code/INDEX.md) |
| server | [INDEX](../../modules/server/INDEX.md) |
| chat（虚拟） | [INDEX](../../modules/chat/INDEX.md) |
| workbench-api（虚拟） | [INDEX](../../modules/workbench-api/INDEX.md) |
