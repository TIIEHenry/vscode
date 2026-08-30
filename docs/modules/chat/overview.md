---
title: "chat 虚拟模块概览"
type: overview
status: accepted
phase: N/A
updated: 2026-08-30
summary: "为何从 workbench 抽出 contrib/chat、依赖方向、browser/common 拆分，以及 platform/chat 与本 contrib 的归属"
---

# chat 虚拟模块概览

> 导航见 [INDEX](INDEX.md)。跨层协作见 [Chat 系统](../../systems/chat/overview.md)；宿主 / INV-TOPO / Copilot 边界见 [agent-ui](../../systems/chat/agent-ui.md)。  
> `browser/` / `common/` 文件夹地图以 [chatCodeOrganization.md](../../../src/vs/workbench/contrib/chat/chatCodeOrganization.md) 为 **SSOT**，下文只写拆分原则，不复述目录清单。

`src/vs/workbench/contrib/chat/` 是 **workbench contrib 虚拟模块**，不是 `src/vs/` 独立分层。分层规则仍走 workbench → sessions；本目录只把它抽成文档导航入口。另有薄层 `src/vs/platform/chat/`，职责见下文。

## 为何从 workbench 抽出

`workbench` 模块覆盖整个 `src/vs/workbench/`（核心、parts、services、全部 contrib）。chat 仍是其中一块 **功能贡献**，不是新的 `vs/` 层：

- 源码组织约定不变：contrib 可消费 `workbench/services` 与更低层，**不得**被 `workbench` 核心 / `services` / `api` / 其他 contrib 的实现反向深入。
- 到 2025 年底，本 contrib 已是 workbench 下体量最大的贡献。把它单独做成文档模块，是为了给入口、边界和文件夹地图一个稳定导航点，避免把 chat 细节写进 [workbench 概览](../workbench/overview.md)。
- **虚拟**的含义：文档树有 `docs/modules/chat/`，源码树没有与 `base` / `platform` / `editor` / `workbench` / `sessions` 平级的 `src/vs/chat/`。eslint 的 import 层仍按 workbench contrib 执行。

产品职责（对话 UI、会话模型、participant、语言模型工具、编辑会话）落在本 contrib。跨层如何协作、Widget 嵌进哪些宿主、Copilot 边界，写在 [systems/chat](../../systems/chat/overview.md) 与 [agent-ui](../../systems/chat/agent-ui.md)，本页不改写。

## 依赖方向

作为 workbench contrib，只允许向下依赖：

| 方向 | 规则 |
|------|------|
| 本 contrib → | 可依赖 `workbench`（含 services）、`editor`、`platform`、`base` |
| 更低层 → 本 contrib | **禁止**。`base` / `platform` / `editor` / `workbench` 核心与 `services/` 不得 import `contrib/chat` 内部 |
| `sessions` → 本 contrib | **允许**。Agents Window 消费 `IChatService` / `IChatWidgetService`；窗口特有 UI 在 `src/vs/sessions/contrib/chat/` |
| 本 contrib → `sessions` | **禁止**。反向依赖违反 workbench → sessions 分层 |
| 其他 contrib | 只走本包对外的 common API（如 `browser/chat.ts` 的 Widget 契约），禁止深入 `widget/`、`chatEditing/` 等内部模块 |

加载入口仍是 workbench 的 contribution 机制：`workbench.common.main.ts` 拉入 `browser/chat.shared.contribution.ts` 等；Sessions 窗口同样导入该 shared contribution，再叠加自己的 chat contrib。分层与会话域契约见 [sessions 模块](../sessions/INDEX.md) 与 `src/vs/sessions/` 就近 SSOT，不在此展开。

## browser / common 拆分

目标环境与全仓库一致：`common` ⊂ `browser`。`common/` 不得使用 DOM；`browser/` 实现 UI 与依赖 DOM 的会话面。

| 分区 | 放什么 |
|------|--------|
| `common/` | 无 DOM 的服务与模型：`IChatService` / `ChatService`、`IChatModel` / `ChatViewModel` / 会话存储、`IChatAgentService`（participant）、`ILanguageModelToolsService` 与 `builtinTools/`、编辑契约 `IChatEditingService` |
| `browser/` | Widget 与宿主：`IChatWidget` / `ChatWidget`、`widget/` 核心零件、`widgetHosts/`、`chatContentParts/`、`chatEditing/` 的 `ChatEditingSession` 与 diff UI、actions / attachments / accessibility 等 |

`chatCodeOrganization.md` 还规定：`widget/` 内核心零件必须被 `ChatWidget` 直接引用；列表、输入、agent/model 选择器属于 Widget 本体，不散落到宿主里。宿主只负责把同一 Widget 嵌进侧栏、编辑器页或 Quick Chat——具体清单与红线见 [agent-ui](../../systems/chat/agent-ui.md)。

共享 DI 注册在 `browser/chat.shared.contribution.ts`（`IChatService`、`IChatAgentService`、`ILanguageModelToolsService`、`IChatEditingService` 等）。Workbench 与 Sessions 共用这组注册，而不是各抄一份模型。

## platform/chat 与本 contrib

`src/vs/platform/chat/` 是 **跨层设置与约定**，不是本 contrib 的下沉副本。两者不要混放：

| 归属 | 放什么 | 不放什么 |
|------|--------|----------|
| `platform/chat` | 设置键与常量（如 `ChatAIDisabledSettingId`、`ChatEditAutoApproveSettingId`）、`AI_AGENT` 环境约定、归档类文案（`chatSettings.ts`、`aiAgentEnv.ts`、`sessionArchiveActions.ts`） | 会话模型、`IChatService`、Widget、工具实现、编辑会话 |
| 本 contrib | 对话 UI、`IChatService` / `IChatModel`、participant、工具基础设施与内置工具、`IChatEditingService` / `ChatEditingSession` | 仅供多进程/多层共用的设置 id；账号/额度门闩 |
| `workbench/services/chat` | entitlement（`IChatEntitlementService`） | `IChatModel` 或 Widget |

platform 可被 contrib、entitlement、更高层在任意进程读取；它不能依赖本 contrib。把 `IChatModel` 或 `ChatWidget` 下沉到 `platform/chat` 会破坏分层。设置如何被 Widget / 编辑会话消费，见 [Chat 系统概览](../../systems/chat/overview.md)。

## 相关文档

- [chat 模块索引](INDEX.md)
- [Chat 系统概览](../../systems/chat/overview.md) · [Agent UI 清单](../../systems/chat/agent-ui.md)
- [workbench 模块](../workbench/INDEX.md) · [platform 模块](../platform/INDEX.md) · [sessions 模块](../sessions/INDEX.md)
- 文件夹地图 SSOT：[chatCodeOrganization.md](../../../src/vs/workbench/contrib/chat/chatCodeOrganization.md)
