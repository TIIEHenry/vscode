---
title: "术语表"
type: concept
status: accepted
phase: N/A
updated: 2026-09-02
summary: "本仓库核心术语的单一事实源：分层、Parts、Agent UI 宿主、Conversation 系统术语（SessionBar / 叶 / Composer / Inbox / MessageQueue / stub）、不变量、能力三态、页面接入与文档约定"
---

# 术语表

每个术语只在本文件给**一条**定义。分层规则、测试入口、文档结构见对应规格，这里不复制正文。

| 术语 | 定义 | 详见 |
|------|------|------|
| **Code - OSS** | 本仓库开发的开源编辑器产品；Visual Studio Code 是带 Microsoft 定制的发行版。 | [README.md](../README.md) |
| **Agent IDE** | 本仓产品：主流程在 Conversation，配套按完整 IDE 配齐。 | [vision.md](product/vision.md) |
| **PRD-NNN** | 本仓产品需求稳定 ID。 | [requirements.md](product/requirements.md) |
| **layer** | `src/vs/` 下按依赖方向排序的源码层。低层不得依赖高层。 | [分层规则](architecture/cross-cutting/layers.md) · [source-code-organization](../.github/instructions/source-code-organization.instructions.md) |
| **base** | 最底层：无服务依赖的工具与 UI 积木，路径 `src/vs/base/`。 | [modules/base](modules/base/INDEX.md) |
| **platform** | DI 基础设施与跨层基础服务，路径 `src/vs/platform/`。 | [modules/platform](modules/platform/INDEX.md) |
| **editor** | Monaco 编辑器核心（无 `node` / `electron-*` 依赖），路径 `src/vs/editor/`。 | [架构概览](architecture/overview.md) · [source-code-organization](../.github/instructions/source-code-organization.instructions.md) |
| **workbench** | 工作台框架：布局、parts、`services/`、`contrib/`、`api/`，路径 `src/vs/workbench/`。 | [modules/workbench](modules/workbench/INDEX.md) |
| **sessions** | Agents Window 所在层，高于 `workbench`：可依赖 workbench，反向禁止。路径 `src/vs/sessions/`。 | [modules/sessions](modules/sessions/INDEX.md) · 就近 SSOT [`LAYERS.md`](../src/vs/sessions/LAYERS.md) |
| **code** | Electron 桌面入口层（main / shared / CLI），路径 `src/vs/code/`。 | [架构概览](architecture/overview.md) · [source-code-organization](../.github/instructions/source-code-organization.instructions.md) |
| **server** | 远程开发服务端入口，路径 `src/vs/server/`。 | [架构概览](architecture/overview.md) · [source-code-organization](../.github/instructions/source-code-organization.instructions.md) |
| **target environment** | 层内按运行时分子目录：`common`、`browser`、`node`、`electron-browser`、`electron-utility`、`electron-main`。只能使用该环境允许的 API，并依赖更低环境。 | [source-code-organization](../.github/instructions/source-code-organization.instructions.md) |
| **contrib** | 功能贡献：注册到工作台或 sessions 的特性包（如 git、debug、chat）。外部不得依赖某个 contrib 的内部实现。 | [source-code-organization](../.github/instructions/source-code-organization.instructions.md) |
| **chat** | 文档上的**虚拟模块**，源码在 `src/vs/workbench/contrib/chat/`，不是独立 layer。 | [modules/chat](modules/chat/INDEX.md) |
| **workbench-api** | 文档上的**虚拟模块**：Extension Host 与 `vscode.d.ts` 的实现，路径 `src/vs/workbench/api/`。 | [source-code-organization](../.github/instructions/source-code-organization.instructions.md) · [DOCS-SPEC §3.1](DOCS-SPEC.md) |
| **service** | 通过构造函数注入的跨组件依赖。非服务参数必须排在服务参数之前；生产代码不得在构造之外用 `IInstantiationService` 取服务。 | [Copilot Instructions](../.github/copilot-instructions.md) |
| **instantiation** | 由 `IInstantiationService` 创建带 DI 的对象。服务用 `registerSingleton(IMyService, Impl, InstantiationType.…)` 注册。 | [source-code-organization](../.github/instructions/source-code-organization.instructions.md) |
| **disposable** | 实现 `IDisposable` 的资源。创建后必须立刻登记以便释放；重复调用的方法应返回 `IDisposable` 给调用方登记，避免挂到会泄漏的宿主。 | [Copilot Instructions](../.github/copilot-instructions.md) |
| **extension host** | 运行扩展的独立进程；工作台通过 `workbench/api` 暴露 `vscode` API。 | [source-code-organization](../.github/instructions/source-code-organization.instructions.md) · [全局索引](INDEX.md) |
| **Extension API** | 扩展面对的公开契约，类型定义在 `vscode.d.ts`（及 proposed 变体）。 | [source-code-organization](../.github/instructions/source-code-organization.instructions.md) |
| **main / renderer / shared** | 桌面多进程：Electron main、工作台 renderer、共享进程；再加上 extension host 与 remote server。 | [架构概览](architecture/overview.md) · [How to Contribute · Debugging](https://github.com/microsoft/vscode/wiki/How-to-Contribute#debugging) |
| **Agents Window** | `sessions` 层承载的智能体会话工作台，与主 workbench 并列，不反向依赖。 | [SESSIONS.md](../src/vs/sessions/SESSIONS.md) |
| **unit test** | 核心单测，主要在 `src/vs/*/test/`；Electron 下用 `scripts/test.sh` 跑。 | [测试与校验](architecture/cross-cutting/testing.md) |
| **integration test** | API / 端到端集成测，入口在 `test/integration/`，用 `scripts/test-integration.sh`。 | [test/README.md](../test/README.md) |
| **valid-layers-check** | `npm run valid-layers-check`：检查模块分层与层类型。仅在改动可能影响分层时运行。 | [Copilot Instructions](../.github/copilot-instructions.md) |
| **就近 SSOT** | 已存在于源码旁的规格（如 `src/vs/sessions/*.md`）保持权威；`docs/` 只导航，不复制正文。 | [DOCS-SPEC.md](DOCS-SPEC.md) |
| **知识层 / 行动层** | `docs/` 是相对稳定的设计与导航；`dev/` 是 status、plan、ADR、iteration。 | [DOCUMENTATION.md](DOCUMENTATION.md) |
| **ADR** | 架构决策记录，统一放在 `dev/decisions/`。accepted 后不改正文；推翻则写新 ADR。 | [DOCUMENTATION.md](DOCUMENTATION.md) |
| **nls** | 用户可见字符串的本地化模块 `vs/nls`；禁止拼接，用 `{0}` 占位。 | [Copilot Instructions](../.github/copilot-instructions.md) |
| **INDEX** | 导航入口：链接、表格、一句话上下文；不承载大段设计正文。 | [文体指南](guides/doc-style-guide.md) |
| **Part** | workbench grid 上的一个视图单元（`Parts` 枚举）。功能往 Part 里注册，不直接 new 布局。 | [Parts/Grid](systems/workbench/parts-and-grid.md) |
| **CONVERSATION_PART** | 默认 Code 窗口 grid 的 **中心叶**（Layout `Parts` 枚举）；Part 本身只是槽宿主，内部由 `contrib/conversation` 嵌 session 窗口与 Conversation `IEditorPart`。它不是 `EditorInput`，也禁止被 `ChatEditorInput` 占据。 | [Conversation 系统](systems/conversation/INDEX.md) · [Parts/Grid](systems/workbench/parts-and-grid.md) |
| **EDITOR_PART** | End 列 Preview：`EditorGroup` + tabs + `EditorInput`（M0 已从中心叶挪到 End）。 | [Parts/Grid](systems/workbench/parts-and-grid.md) |
| **SESSIONS_PART** | Agents Window 的非 editor 中心 Part；默认 Code 窗口 grid 不装配。 | [agent-ui](systems/chat/agent-ui.md) · [LAYOUT.md](../src/vs/sessions/LAYOUT.md) |
| **ChatWidget** | contrib/chat 的对话列表+输入零件；可被多种宿主嵌套。 | [agent-ui](systems/chat/agent-ui.md) |
| **ChatEditor / ChatEditorInput** | 把对话做成主 `EDITOR_PART`（Preview）的 tab。INV-TOPO **禁止**以此当 Conversation 中心。 | [agent-ui](systems/chat/agent-ui.md) |
| **INV-TOPO** | Layout 中心必须是 `CONVERSATION_PART`，禁止 `ChatEditor` 占中心。ADR-002 允许 Part 内嵌 Conversation `IEditorPart` 画 chat tab（**已落**，S1–S6）。 | [ADR-006](../dev/decisions/006-shell-invariants.md) · [ADR-002](../dev/decisions/002-conversation-session-windows.md) |
| **SettingsEditor2** | vscode Preferences UI（`EDITOR_PART` tab）。B2 推荐作默认窗 Settings 宿主，非正式决策。 | [settings-ua-access](reference/code-oss-b2/settings-ua-access.md) |
| **ConversationSessionsView** | Navigator 产品会话 roster（Explorer `ViewPane` + `WorkbenchList`）；数据今天是 stub。 | [session-roster-reuse](reference/code-oss-b2/session-roster-reuse.md) |
| **ConversationLens** | 在每张 chat 页（`ConversationEditorPane`）内组装 SessionBar 槽 / Timeline / Dock 的产品面；持久化当前透镜 id。Part 级窗口 chrome 不在其中。 | [lens-and-trajectory](systems/conversation/lens-and-trajectory.md) |
| **SessionBar** | 两层：Part 级窗口 chrome（SelectBox、←→、关非根、Active 态 Route、hide −）与页级透镜切换 / 面包屑。自研，不是 `ChatViewTitleControl`。 | [session-windows](systems/conversation/session-windows.md) |
| **session 窗口 / 叶** | `CONVERSATION_PART` 内一个 session 的窗口，内嵌 Conversation `IEditorPart`；最多两叶并列，共用右侧 Preview。 | [session-windows](systems/conversation/session-windows.md) · [ADR-002](../dev/decisions/002-conversation-session-windows.md) |
| **ConversationChatInput** | 唯一被 Conversation 组接受的 `EditorInput`（scheme `conversation-chat`）；根 tab 不可关。围栏把其余 input 弹回 Preview。 | [session-windows §2](systems/conversation/session-windows.md) |
| **子代理对话框** | 点击时间线子代理后在 session 叶内弹出的居中 overlay（父对话仍在底下）；「打开为 tab」才成延伸 tab。不是 `MODAL_GROUP`。 | [session-windows §3](systems/conversation/session-windows.md) |
| **Composer / Dock** | 产品输入面：PreFirst 居中、Active 落列底的同一张输入卡；`composerPolicy` 三态（compose / turnEdit / queueEdit）。不是 `ChatInputPart`。 | [composer-and-inbox](systems/conversation/composer-and-inbox.md) |
| **Inbox** | Active 态 Composer 上方的左右分簇（左 Task · MessageQueue · Goal，右 Stop · 上下文环）；无权威整槽省略。 | [composer-and-inbox §3](systems/conversation/composer-and-inbox.md) |
| **MessageQueue** | 待发消息队列（状态 UPLOADING / PENDING / SENDING / FAILED…，hold 原因 EDITING）；列表交互 SSOT 在 Singularity；本仓 stub 期由夹具注入。语音转写队列不是它。 | [composer-and-inbox §4](systems/conversation/composer-and-inbox.md) |
| **轨迹透镜** | 详细对话列表：强制显示注入/chip/环境/压缩相关；长工具段可过程折（默认展开）。 | [PRD-012](product/requirements.md#prd-012-conversation-轨迹透镜) · [lens-and-trajectory](systems/conversation/lens-and-trajectory.md) |
| **过程折** | 连续思考与工具上的显示 overlay（外层摘要 → Thinking → 工具）。对话默认收起，轨迹可复用且默认展开。不是列表身份，也不是 Copilot thinking 设置。 | [PRD-013](product/requirements.md#prd-013-conversation-过程折) · [lens-and-trajectory §4](systems/conversation/lens-and-trajectory.md) |
| **图示卡（visualize）** | `visualize` 工具结果在时间线的卡片：`diagram`（mermaid）或 `comparison`（方案对比）；全屏为 Conversation overlay；扩展缺失降级为 fence。 | [PRD-014](product/requirements.md#prd-014-conversation-图示卡visualize) · [lens-and-trajectory §5](systems/conversation/lens-and-trajectory.md) |
| **IConversationRosterService** | 产品 Conversation 的会话数据契约（decorator id `'conversationStubService'`）；今天由 `ConversationStubService` 内存实现，引擎接通后由 adapter 同 token 替换。含产品方法与测试夹具两组。 | [stub-and-fixtures](systems/conversation/stub-and-fixtures.md) |
| **stub / fixture** | stub = 无引擎时的本地占位实现（回复 echo、连接态断开）；fixture = 单测与种子会话用的假数据。UI 文案凡来自二者必带 `Stub`。 | [stub-and-fixtures](systems/conversation/stub-and-fixtures.md) · [PRD-007](product/requirements.md#prd-007-诚实降级) |
| **诚实降级** | 无引擎 / 无权威 / 能力缺失时省略槽位或明示空，禁止假列表、假「已连接」、假同步。贯穿所有 PRD 的体验原则 3。 | [vision](product/vision.md) · [PRD-007](product/requirements.md#prd-007-诚实降级) |
| **能力三态** | UA `CapabilitySupport`：`SUPPORTED / UNSUPPORTED / UNKNOWN`（带 reason）；IDE 传输失败是独立态，不得映射为 UNSUPPORTED 或空列表。 | [engine-protocol-surface §2](reference/universe-agent/engine-protocol-surface.md) |
| **Preview** | End 列上格 `EDITOR_PART` 的产品名：完整编辑器能力，但不是主工作区。 | [parts-and-grid](systems/workbench/parts-and-grid.md) |
| **SOURCES_PART / Sources** | End 列下格 Part；`contrib/sources` 填 Files \| Changes \| Review 列表投影，点击在 Preview 打开。 | [Sources 系统](systems/sources/INDEX.md) |
| **四钮** | titlebar 右上 `LayoutControlMenu` 的 Navigator / Conversation / Preview / Sources 显隐钮；Panel / Aux 退到 submenu。 | [commands](systems/conversation/commands.md) |
| **INV-052-NO-DUAL-HIDE** | `Conversation ∨ (Editor ∨ Sources)` 至少一个可见；由 `enforceAgentShellVisible` 维持。 | [ADR-006](../dev/decisions/006-shell-invariants.md) |
| **INV-NO-COPILOT** | 产品 Conversation 零 import Copilot Chat Widget / 输入 / 会话模型；默认窗不以 Copilot 为入口。 | [ADR-006](../dev/decisions/006-shell-invariants.md) |
| **Engine pane / `ua.engine`** | vscode Preferences 内的 UA 引擎页（与 `ua.connection` 并列）：Skills / Agents / Rules / Hooks / MCP / Tools 的产品主面；无引擎 catalog 节隐藏；UNSUPPORTED 诚实空。list/toggle @ HEAD 见 [engine-catalog](systems/workbench/engine-catalog.md)。 | [settings-two-surfaces](../dev/plans/settings-two-surfaces.md) · [customizations-engine](../dev/plans/customizations-engine.md) |
| **`universe-agent://`** | 页面访问 scheme（`IURLHandler`），`universe-agent://settings/<page>` 打开对应 Settings 页；不绑 `product.urlProtocol`。 | [commands §4](systems/conversation/commands.md) · [page-access-schemes](../dev/plans/page-access-schemes.md) |
| **Navigator tab** | Activity 上一段 = Sidebar 一个 `ViewContainer`（Files / Sessions / Projects / Agents / Team）。子页按 vscode 列表/树重设计，不抄 Compose panel。 | [navigator-tabs-access](reference/code-oss-b2/navigator-tabs-access.md) |

上游产品与贡献流程不在本表展开，见 [How to Contribute](https://github.com/microsoft/vscode/wiki/How-to-Contribute) 与 [快速开始](guides/getting-started.md)。
