---
title: "Sessions 系统概览"
type: overview
status: accepted
phase: N/A
updated: 2026-10-03
summary: "Agents Window 一页定向：跨层依赖、服务栈与三类 provider，正文链到就近 SSOT"
---

# Sessions 系统概览

Agents Window 是 VS Code 源码层级里高于 `workbench` 的窗口：同一套 provider-neutral 模型服务多种计算后端，并自有 parts / grid / 列表，而不是再开一个普通 workbench 窗口。

**读顺序**：本页 → [系统索引](INDEX.md) → 按主题打开 [src/vs/sessions/README.md](../../../src/vs/sessions/README.md) 里的规格。不要在 `docs/` 复制那些正文。

## 跨层方向

`vs/sessions` **可以** import `vs/workbench` 以及 `editor` / `platform` / `base`。`vs/workbench` **不得** import `vs/sessions`。共享能力（例如 AI customizations 的管理编辑器）放在 workbench；Agents Window 只贡献自己的树与概览。

全局分层见 [source-code-organization](../../../.github/instructions/source-code-organization.instructions.md)；层内 `core` → `services` → `contrib` → `providers` 见 [LAYERS.md](../../../src/vs/sessions/LAYERS.md)。

与相邻系统：

| 系统 | 关系 |
|------|------|
| [Chat](../chat/INDEX.md) | 编辑器 Chat 与 customizations 的共享面在 `workbench/contrib/chat`；Sessions 消费能力契约，不按 provider 名分支 UI |
| [Processes](../processes/INDEX.md) | 桌面走 `electron-browser/sessions.ts` renderer；web 走 `sessions.web.main.ts`；Agent Host / remote 连接是独立进程侧，由 platform 服务接入 |

## 编排，而不是「一个 provider 一张皮」

窗口 UI 与 contribution 只面对三个共享服务（职责与生命周期以 [SESSIONS.md](../../../src/vs/sessions/SESSIONS.md) 为准）：

1. `ISessionsProvidersService` — 注册表
2. `ISessionsManagementService` — 目录聚合、草稿、把操作路由到所属 provider
3. `ISessionsService` — 激活/可见 session、打开与焦点

`ISession` / `IChat` 是稳定 facade；可变字段走 `IObservable`。消费者比较 resource 身份，不解析 provider URI。

## 三类 provider

| 实现 | 角色（定向，细节在规格里） |
|------|----------------------------|
| `agentHost` | 本地 Agent Host Protocol → `ISessionsProvider` |
| `copilotChatSessions` | Copilot Cloud / 本地 CLI 路径（Agent Host 不可用时） |
| `remoteAgentHost` | 每个 remote 连接一个 provider |

Provider 可以依赖非 provider contrib 与兄弟 provider；反向禁止。新后端实现 `ISessionsProvider` 并挂到对应 `sessions.*.main.ts`。

## 呈现归属

Parts、grid、title bar 属于 [LAYOUT.md](../../../src/vs/sessions/LAYOUT.md)；按 session 的工作集与恢复属于 [LAYOUT_CONTROLLER.md](../../../src/vs/sessions/LAYOUT_CONTROLLER.md)；侧栏列表属于 [SESSIONS_LIST.md](../../../src/vs/sessions/SESSIONS_LIST.md)。Phone 是同一模型上的呈现适配，见 [MOBILE.md](../../../src/vs/sessions/MOBILE.md)。

规格只在契约（所有权、接口、状态机、跨组件不变量）变化时更新；回归放测试。开发路由见 [.github/skills/sessions/SKILL.md](../../../.github/skills/sessions/SKILL.md)。

## 模型选择器

会话与新建会话输入条上的模型列表，在打开时决定要不要提示「中途换模型会清掉 prompt cache」。这条 cache 属于已经发过请求的那条聊天，不看会话汇总状态。一条已经跑过的会话里仍可以有一条 Untitled 的新聊天；这时不提示。当前聊天离开 Untitled 之后才提示。没有聊天时不提示。

按钮上显示的是当前模型池里的那一条。同一个标识再次发布时，名字、图标和能力跟着池里的新记录走，不留着第一次选中时的旧记录。

## Changes 行

变更列表里点「打开文件」时，普通改动仍打开这一行的工作区文件。删除行的工作区文件已经不在了，打开的是删除前的内容快照；没有快照则不打开。Alt「打开变更」按工作区文件、修改后一侧或快照都能找到这一行，删除行仍打开两侧 diff（修改后一侧为空）。按文件执行的变更操作（例如丢掉这一份改动）用工作区文件：多选和文件夹里的每一行都算，删除行在 diff 里点到的快照也改回工作区文件。会话地址不算文件。根行上没有这个按钮。

## 输入历史

新建会话输入条用 ↑ / ↓ 浏览已发送的输入。空草稿不会盖进历史，所以回到末尾时这一格没有条目。这时仍把输入框写成空，并清掉附件；发送钮跟手打同一套门闩。有正文或附件的草稿仍盖在离开那一格时的位置，回来还是那一份。

未发送草稿按输入条分开存。新建会话仍用 `sessions.draftState`。会话里的新聊天用 `sessions.draftState.inSession.<sessionId>`；当时还没有会话 id 时用 `sessions.draftState.inSession`。离开欢迎页留下的草稿不会出现在追问框里，追问也不会写回新建会话那一条。

## 新建会话导览

新建会话导览只教新建会话视图上的选择器和提示。Quick Chat 没有工作区，不算这个视图：不在那里开始，也不把提示或选项写进 Quick Chat。查找还在进行时切过去，就不再插入。
