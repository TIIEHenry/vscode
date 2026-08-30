---
title: "Sessions 模块概览"
type: overview
status: accepted
phase: N/A
updated: 2026-08-30
summary: "vs/sessions 目录角色、层内 import 方向、sessions.*.main 入口与规格路由"
---

# Sessions 模块概览

> 导航见 [INDEX](INDEX.md)。跨层职责与服务编排见 [systems/sessions](../../systems/sessions/overview.md)。  
> 契约正文只在 `src/vs/sessions/` 就近 SSOT，本页不复制。

`src/vs/sessions/` 实现 Agents Window：在 `workbench` 之上自有 core、共享服务、功能 contrib 与计算后端 provider。仓库分层见 [source-code-organization](../../../.github/instructions/source-code-organization.instructions.md)；层内图以 [LAYERS.md](../../../src/vs/sessions/LAYERS.md) 为 SSOT。

## 目录角色

| 路径 | 角色 |
|------|------|
| `browser/`、`common/` | **sessions/~ 核心**（与 `electron-browser/` 同层）：窗口壳、parts 装配、web 工厂。目标环境规则与全仓库一致：`common` ⊂ `browser` ⊂ `electron-browser` |
| `electron-browser/` | 桌面 renderer 引导与桌面 contribution；`sessions.ts` 的 import 面比 core 更窄 |
| `services/` | **共享服务**接口与实现；按域分子目录，再按 `common` / `browser` / `electron-browser` 拆 |
| `contrib/` | **非 provider 功能**：`chat`、`sessions`（列表）、`layout`、`changes`、`terminal`、`editor`、`files` 等 |
| `contrib/providers/` | **计算后端适配**：`agentHost`、`copilotChatSessions`、`remoteAgentHost` |
| `sessions.*.main.ts` | **入口**：副作用 import 决定哪些 contribution 进包 |
| `test/`、`skills/` | 测试与可执行工作流；**不是**子系统架构规格 |

`services/` 代表域：`sessions`、`customView`、`title`、`workspace`、`workspaceFolderLabel`、`agentHost`、`agentHostFilter`、`chatView` 等。某域只被一个 contrib 使用时，实现应留在该 contrib，不要上提。

## 层内 import（摘要）

由 ESLint `local/code-import-patterns` 强制。完整允许/禁止列表与例外以 [LAYERS.md](../../../src/vs/sessions/LAYERS.md) 为准，不要在此维护第二份图。

```
sessions.*.main.ts
  ├─ contrib/*/~
  ├─ contrib/providers/*/~
  └─ services/*/~
        └─ sessions/~   （browser / common / electron-browser）
```

| 层 | 可向下 | 禁止 |
|----|--------|------|
| `sessions/~` | `base` / `platform` / `editor` / `workbench`（含 `workbench/browser`）、本层 `services` | 任何 `sessions/contrib` |
| `services/*/~` | 核心可 import 的范围，**不含** `workbench/browser/**`；可 `workbench/contrib`、兄弟 services | `sessions/contrib` |
| `contrib/*/~`（非 provider） | services 能 import 的 + 兄弟 contrib | `contrib/providers` |
| `contrib/providers/*/~` | 非 provider contrib + 兄弟 provider | —（contrib 里最宽） |
| 入口 mains | 上述全部 | — |

硬约束：**非 provider contrib 不得 import provider 实现**。共享符号抽到 `services/`、`common/` 或共享 contrib 模块。

`electron-browser/sessions.ts` 只允许 `vs/base/~`、`vs/platform/*/~`、`vs/sessions/~` 与 `sessions.desktop.main.js`。跨模块：`vs/sessions` 可 import `vs/workbench` 及更低；**`vs/workbench` 不得 import `vs/sessions`**。全局规则见 [layers](../../architecture/cross-cutting/layers.md)。

## 入口文件

未从对应 `sessions.*.main.ts` 引用的模块不会加载。全平台共享的放 common；桌面或 Web 专用的放 desktop / web。

```
sessions.common.main.ts
  ├─ editor.all + 选用的 workbench parts / services / contrib
  ├─ sessions core parts、共用 services
  └─ 共用 contrib（chat、sessions 列表、changes…）与部分 provider 符号
        │
        ├─ sessions.desktop.main.ts
        │     electron-browser/sessions.ts 加载 desktop.main
        │     桌面 services、layout contribution、本地 / remote provider
        │
        └─ sessions.web.main.ts
              browser/web.main.ts + web.factory
              sessions.web.main.internal.ts → embedder `create`
              phone-aware dialog、layout contribution、web / remote provider
```

| 文件 | 层标注 | 谁加载 |
|------|--------|--------|
| `sessions.common.main.ts` | `browser` | desktop / web 都 import |
| `sessions.desktop.main.ts` | `electron-browser` | 桌面 renderer |
| `sessions.web.main.ts` | `browser` | Web 包 |
| `sessions.web.main.internal.ts` | `browser` | Web embedder，再 export `create` |

新 contribution 或 provider 必须挂到能覆盖目标平台的 main。`contrib/layout` 在 desktop 与 web main 各引一次（web 运行时再选 desktop / phone）。

## 规格路由

接口、生命周期、状态机与跨组件不变量只改就近 SSOT。本层只指路：

| 要查 | 打开 |
|------|------|
| 层内 import 图 | [LAYERS.md](../../../src/vs/sessions/LAYERS.md) |
| session/chat 模型、服务、provider 契约 | [SESSIONS.md](../../../src/vs/sessions/SESSIONS.md) |
| parts / grid / title bar | [LAYOUT.md](../../../src/vs/sessions/LAYOUT.md) |
| 按 session 捕获与恢复 | [LAYOUT_CONTROLLER.md](../../../src/vs/sessions/LAYOUT_CONTROLLER.md) |
| 侧栏列表 | [SESSIONS_LIST.md](../../../src/vs/sessions/SESSIONS_LIST.md) |
| single-pane / Phone | [SINGLE_PANE_SCENARIOS.md](../../../src/vs/sessions/SINGLE_PANE_SCENARIOS.md) · [MOBILE.md](../../../src/vs/sessions/MOBILE.md) |
| customizations | [AI_CUSTOMIZATIONS.md](../../../src/vs/sessions/AI_CUSTOMIZATIONS.md) |
| 各 provider | [agentHost](../../../src/vs/sessions/contrib/providers/agentHost/AGENT_HOST_SESSIONS_PROVIDER.md) · [copilotChatSessions](../../../src/vs/sessions/contrib/providers/copilotChatSessions/COPILOT_CHAT_SESSIONS_PROVIDER.md) · [remoteAgentHost](../../../src/vs/sessions/contrib/providers/remoteAgentHost/REMOTE_AGENT_HOST_SESSIONS_PROVIDER.md) |

子系统索引进 [README.md](../../../src/vs/sessions/README.md)。开发原则见 [.github/skills/sessions/SKILL.md](../../../.github/skills/sessions/SKILL.md)。

## 相关文档

- [模块索引](INDEX.md)
- [系统概览](../../systems/sessions/overview.md)
- [Workbench 模块](../workbench/INDEX.md)
- [横切分层](../../architecture/cross-cutting/layers.md)
