---
title: "M2 产品壳：无引擎的剩余 vscode-fork chrome"
type: plan
status: implemented
phase: M2
updated: 2026-08-31
summary: "三切片已落地：透镜 stub 产品面、Chat/Aux 卫生、文档诚实；无引擎；Diff FORK 不选"
---

# M2 产品壳（无引擎）

> **产品需求层回链（后补，不改本方案历史正文）**：现行产品陈述以 [docs/product/requirements.md](../../docs/product/requirements.md) 为准；本文件「产品完成线」只是 M2 当时记录。入口：[docs/product/INDEX.md](../../docs/product/INDEX.md)。

> **前置**：[m0-topology-surgery.md](m0-topology-surgery.md) · [m1-shell-followon.md](m1-shell-followon.md)（均 `implemented`，代码事实）。  
> **决策**：外仓 [ADR-061](https://github.com/TIIEHenry/UniverseAgentDesktop/blob/main/dev/decisions/061-code-oss-base-and-editor-window-shell.md)（`accepted`，只读）。  
> **本仓事实**：[parts-and-grid](../../docs/systems/workbench/parts-and-grid.md) · [desktop-shell-mapping](../../docs/reference/code-oss-b2/desktop-shell-mapping.md) · [agent-ui](../../docs/systems/chat/agent-ui.md) · [panel-and-auxiliary-bar](../../docs/systems/workbench/panel-and-auxiliary-bar.md) · [companion-contribs](../../docs/systems/workbench/companion-contribs.md) · [views-and-composites](../../docs/systems/workbench/views-and-composites.md)

**Goal：** 在 **不接** UniverseAgent 引擎 / gRPC / adapter 的前提下，把默认编辑器窗口从「M1 骨架壳」推到 **ADR-061 编辑器窗口方案作为产品壳已经完整**：中心透镜可读可写（本地 stub）、Chat/Aux 不再冒充产品 Conversation、知识层不再把已落的槽写成占位。

**Architecture：** 继续改 **默认 Code 窗口**（`workbench.desktop.main`）。`ConversationPart` 仍只做三槽（SessionBar / timeline / dock）；产品面全部在 `workbench/contrib/conversation`。Inbox 按 Desktop spec §8.3 住在 **Dock 槽内**，不新开 Part、不加第四槽、不改 `layout.ts` grid。`IChatModel` / Copilot / `vs/sessions` 仍不是权威。引擎接线不进本波。

> `status: implemented` — 三切片代码/文档已在树（透镜 `7822d430` · Aux hidden `9b34c1b6` · 文档 `221e8823`）。Diff FORK 未选。compile / 启动 / EH 仍 deferred（D3–D5）。

## 全局约束

- 不碰 UniverseAgent 引擎、gRPC、adapter、session-core（INV-UA-TRUTH）。本波只把 spike §4.2 里 **UI 产品面**做成诚实 stub。
- 不把 `IChatModel` / Copilot entitlement / `chatSetup` 提成会话真相（INV-NO-COPILOT）。
- 不改 `vs/sessions` 当成品壳；Agents Window 只读参照。禁止 workbench 反向 import sessions。
- 不改 `product.json` 身份（名称 / 图标 / trade dress）。
- 不迁 ADR-003 token、不接 Open VSX。
- **不碰 Diff 深查看路由。** ADR-047 要 `PANEL_PART`；本树今天开在 `EDITOR_PART`。这是 **PARKED FORK**：本方案不选、不叫 fable、任何切片不得「顺便」改绑。Sources Changes tab 同出。
- 不改 `layout.ts` 的 `createGridDescriptor` / `arrangeMiddleSectionNodes` / 互斥公式。M0 拓扑已锁。
- 三切片 **禁止并行改同一文件**。各自文件表互斥；可独立落地。
- 本方案 **不** 勾 D3 compile / D4 启动演示 / D5 EH 探针。
- 分层：`workbench/browser` 不得 import `workbench/contrib`。

---

## M0 + M1 已落地（本波不再做）

| 项 | HEAD 事实 |
|----|-----------|
| 拓扑 | `ConversationPart` 中心；End 上 `EDITOR_PART`、下 `SOURCES_PART`；`Conversation ∨ (Editor ∨ Sources)` |
| 四钮 | titlebar `LayoutControlMenu`：Nav / Conversation / Preview / Sources（D7 已闭） |
| Conversation 透镜 | `contrib/conversation`：**骨架** — SessionBar 固定 “Untitled session”、两行假 turn、复制的 confirmation 座位、dock `aria-readonly` |
| Sources Files | `contrib/sources` 只读列表投影；点击开 End Preview。Explorer 仍是 Sidebar 树权威 |
| 中心不是 ChatEditor | 单测已锁 `CONVERSATION_PART ≠ ChatEditorInput` |

合入锚点：M0 `b5631393` · D7 `2dcd5a0a` · 透镜 `4f3fef65` · Files `156f0fe5`。

## 对照：spike §4.2 / M1「刻意不做」里 **本波要做** 的项

外仓 spike [§4.2 不做](https://github.com/TIIEHenry/UniverseAgentDesktop/blob/main/dev/plans/code-oss-b2-topology-spike.md) 把「真 Inbox / 权限座位 / 时间线阅读产品面」整段推迟。M1 切片 2 明确：**Inbox 全产品面、真权限状态机、UA 接线不进**；只嵌 confirmation **零件** 证明座位。

M2 收的是 **无引擎的产品阅读/写入面**，不是引擎：

| §4.2 / M1 推迟项 | M2 |
|------------------|----|
| 真 Inbox 产品面 | **做 stub**：Dock 内 Inbox 状态行（诚实空 Queue/Tasks；有本地 pending 才显示 confirmation 摘要）。无 Task/Queue 权威时 **不伪造列表**（Desktop §8.3 / `UI-INV-06`） |
| 权限座位 | **做本地状态**：座位进时间线列表；Allow/Skip 改 stub `pending → allowed/skipped`，关掉 CTA，留下记录。不接 `pendingActions` / 引擎 |
| 时间线阅读产品面 | **做会话列表**：有 identity 的 turn 列表，可滚、角色可辨，不再是两行写死文案 |
| SessionBar | **做 stub 多会话切换**（本地数组）。无 capability 的 History/Route/Snapshots **省略**（Desktop §6.4） |
| Input Dock | **做真实本地输入**（可编辑 + Send → append 到当前 stub 会话）。仍禁止 `ChatInputPart` picker 顶替 §8.3 |

仍 **整波排除**：UA / gRPC / adapter、`IChatModel`、Open VSX、`product.json` 身份、ADR-003、`vs/sessions` 改动、Changes tab、Diff 改绑、compile/EH。

## 对照：ADR-061「待定（另切片，不阻塞 M0）」

| 待定 | 本波 |
|------|------|
| Task↔client-tool 双执行面 owner | **不进**（引擎邻接） |
| 扩展分发（Open VSX / 自建 / 子集） | 不进 |
| 产品身份（`product.json`） | 不进 |
| 文档 SSOT 从外仓迁 fork | 不进；本仓 `docs/` 只做 **诚实**（切片 3） |
| 上游 rebase 节奏 | 不进 |

---

## 产品完成线（无引擎）

M2 出口 = 默认编辑器窗口作为 **UniverseAgentDesktop B2/ADR-061 产品壳** 在「没有引擎」这个前提下已经完整：

1. 用户打开默认窗，**中心**是 Conversation 透镜，不是 Aux 里的 Chat，也不是 `ChatEditor` tab。
2. SessionBar 能在若干 **stub 会话** 间切换；时间线是该会话的 **对话列表**；权限座位在列表里可点 Allow/Skip（只改本地 stub）。
3. Dock 能打字、Send，turn 出现在当前会话时间线。Inbox 行诚实：无队列权威不造假列表。
4. 右缘 Auxiliary Bar **默认关**（INV-052-NO-RIGHT-RAIL）。`ChatViewPane` 仍可被命令打开作 donor/对照，但 **不是** 产品 Conversation，也不是 Aux 的 `isDefault` 容器。
5. 知识层不再把 Conversation 写成「M0 占位」、Sources 写成「无真实语义」、Chat 写成默认右栏主流程。
6. Sources Files 保持 M1；**Changes / Diff 明确仍缺口**（FORK），文档照实写。

未完成线（诚实写进文档，不假装 M2 会做）：引擎、会话权威、Diff owner、Changes tab、compile/启动/EH、产品身份。

---

## 推荐顺序（恰好 3 切片）

顺序 = 产品中心面 → 去掉错误的默认 Chat 右栏 → 文档对齐代码。后一切片 **不依赖** 前一切片的运行时；文件表互斥，禁止两人同时改同一路径。

### 切片 1 — Conversation 透镜产品化（stub 会话 + Inbox stub + 时间线列表 + 本地 Dock）

**做什么：** 把 M1 骨架换成 **可操作的本地产品面**，仍无引擎。

| 面 | M1 骨架 | M2 目标 |
|----|---------|---------|
| SessionBar | 单一 “Untitled session” 文本 | ≥2 个 stub 会话；标题 = 当前会话；切换器（按钮或下拉）。无 capability 的 History / Route / Snapshots / maximize **不画** |
| Timeline | 两行写死文案 + 尾部钉死的 confirmation | **会话列表**：`user` / `assistant` / `confirmation` 带稳定 `id`；可滚；当前会话的 turns 全量渲染。confirmation 是列表项，不是列表外的装饰 |
| 权限座位 | 复制的 Allow/Skip chrome，点击无状态 | Allow → `allowed`、Skip → `skipped`；CTA 消失，记录留在列表（对齐 Desktop「已关闭 pending 不留 CTA」）。文案仍可用 M1 的 “Write README.md?” |
| Inbox | 无 | 放在 **dock 槽顶部** 的状态行。Queue / Tasks：**诚实空**（「No queue」或整槽省略），禁止假任务列表。仅当当前会话有 `pending` confirmation 时显示 “N confirmation pending”，点击滚到座位 |
| Dock 输入 | `aria-readonly` 占位 “Ask anything…” | 真输入（`<textarea>` 或 `contenteditable`）+ Send。Enter（非 Shift）提交。提交后 append 一条 `user` turn 到 **当前 stub 会话**。允许一条标明 stub 的本地 echo `assistant` 行（`data-stub="true"`），禁止看起来像已接引擎 |

**本地模型（切片内新建，不要用 `IChatModel`）：**

```ts
type StubTurnKind = 'user' | 'assistant' | 'confirmation';
type ConfirmationStatus = 'pending' | 'allowed' | 'skipped';

interface ConversationStubTurn {
	readonly id: string;
	readonly kind: StubTurnKind;
	readonly text: string;
	readonly status?: ConfirmationStatus; // confirmation only
	readonly stubEcho?: boolean;          // local dock echo only
}

interface ConversationStubSession {
	readonly id: string;
	title: string;
	turns: ConversationStubTurn[];
}
```

种子（建议，可微调文案，不可改成接引擎）：

- `untitled` — 用户/助手各一行 + 一条 pending confirmation（沿用 M1 README 座位）。
- `tour` — 若干只读 stub turns，无 pending。
- `blank` — 空时间线，用来证明 Dock append。

进程内数组即可，**不必** `StorageService` 持久化（刷新回到种子）。禁止 `IChatService` / `IChatModel` / `ISessionsService` / Copilot setup。

**不是方案分叉：** 宿主已是 `ConversationPart` 三槽（M0/M1）；Inbox 合同在 Desktop §8.3 = Dock 内状态行，不是第四 Part。权限交互继续半自研：座位语义按 Desktop，零件继续用本仓 `ConversationConfirmationSeat`（可加 props/callback），**禁止**整块搬 `ChatConfirmationWidget` / `ChatViewPane`。

**选定路径：** 全部发生在 `contrib/conversation`。`conversationPart.ts` **不改**（三槽已够）。不引入 `ChatWidget` 虚拟化（stub 体量不值得）。不抄 `ChatInputPart` 的 model/mode picker。

**Likely files（本切片独占）：**

| 路径 | 角色 |
|------|------|
| `src/vs/workbench/contrib/conversation/browser/conversationStubModel.ts` | **新建** 种子会话 + append/resolve/switch API |
| `src/vs/workbench/contrib/conversation/browser/conversationLens.ts` | 改：按 model 填三槽；切会话重绘 |
| `src/vs/workbench/contrib/conversation/browser/conversationConfirmationSeat.ts` | 改：接收 message/status/onAllow/onSkip；resolved 不渲染按钮 |
| `src/vs/workbench/contrib/conversation/browser/conversationInbox.ts` | **新建（可选拆文件）** Dock 顶 Inbox 行 |
| `src/vs/workbench/contrib/conversation/browser/media/conversationLens.css` | SessionBar 切换器、列表、可编辑 dock、Inbox 行 |
| `src/vs/workbench/contrib/conversation/browser/conversation.contribution.ts` | 仅当要注入 `IInstantiationService`；否则不动 |
| `src/vs/workbench/contrib/conversation/test/browser/conversationLens.test.ts` | 扩：多会话切换、Send append、Allow 消 CTA、Inbox 在无 queue 时不造假列表、中心仍非 `ChatEditorInput` |

**本切片明确不做：** 改 `conversationPart.ts` / `layout.ts`；碰 `contrib/chat`；碰 `contrib/sources`；持久化 stub；虚拟化；Markdown content parts；把 echo 接成真正的 agent 回合。

---

### 切片 2 — Chat / AuxiliaryBar 卫生（INV-052-NO-RIGHT-RAIL）

**做什么：** 让 `ChatViewPane` + Auxiliary Bar **不再是产品 Conversation**。合同：[desktop-shell-mapping §4](../../docs/reference/code-oss-b2/desktop-shell-mapping.md)「Auxiliary Bar 当 Conversation = 选项 C」；[panel-and-auxiliary-bar §5](../../docs/systems/workbench/panel-and-auxiliary-bar.md) **INV-052-NO-RIGHT-RAIL → 产品壳默认关**；[views-and-composites §5](../../docs/systems/workbench/views-and-composites.md) `ChatViewPane` 是 ViewPane，不是中心透镜。

**现状（HEAD 代码，文档尚未对齐）：**

```ts
// chatParticipant.contribution.ts — Chat 容器今天是 Aux 的 default
}, ViewContainerLocation.AuxiliaryBar, { isDefault: true, doNotRegisterOpenCommand: true });
```

Chat 容器挂在 `AuxiliaryBar` 且 **`isDefault: true`**。叠加 `workbench.secondarySideBar.defaultVisibility` 出厂 `'visibleInWorkspace'`（`workbench.contribution.ts` + main splash `themeMainServiceImpl.ts`），工作区首开会亮右栏并把 Chat 当默认 composite —— 这就是产品级「Agent 当聊天插件 + 右 rail」，直接打脸 INV-052-NO-RIGHT-RAIL。

`layout.ts` 里对新用户还有「default 不是 hidden 就强制亮 Aux」的分支。**不要改这条 grid/状态机代码**：把配置默认改成 `'hidden'` 后，现有分支已经会走 `case 'hidden': return true`。切片 2 **禁止** 改 `createGridDescriptor` / `arrangeMiddleSectionNodes` / `enforceAgentShellVisible`。

**选定路径（两刀，缺一不可）：**

1. Chat 容器：`registerViewContainer(..., AuxiliaryBar, { isDefault: false, doNotRegisterOpenCommand: true })`（或等价：不再当该 location 的 default container）。`ChatViewPane` **保留注册**，Command Palette / View 菜单 / 现有 `Ctrl+Cmd+Alt+I` 仍可打开作 donor 对照。
2. 默认编辑器窗口：`workbench.secondarySideBar.defaultVisibility` 的 **default** 改为 `'hidden'`。`agentsWindow` 覆盖 **保持** `{ default: 'visibleInWorkspace', readOnly: true }`（Agents Window 不是本产品壳）。main splash 的同名 Setting 默认对齐 `'hidden'`，避免第一帧画出右栏。

**不选：** 删除 `ChatViewPane` / `ChatWidget`（配套 donor 与 EH 对照还要用）；把 Chat 容器改挂到 `ConversationPart`（ViewContainer 只能进 Sidebar/Panel/Aux，见 views-and-composites §4）；把 Chat 改挂 Sidebar 当新的产品对话（同样是插件形）；改 `product.json`；为藏 Aux 去动 grid 描述符。

**Likely files（本切片独占）：**

| 路径 | 角色 |
|------|------|
| `src/vs/workbench/contrib/chat/browser/chatParticipant.contribution.ts` | `isDefault: false` |
| `src/vs/workbench/browser/workbench.contribution.ts` | 仅改 `workbench.secondarySideBar.defaultVisibility` 的 editor-window `default` → `'hidden'`；不动其它 setting |
| `src/vs/platform/theme/electron-main/themeMainServiceImpl.ts` | splash Setting 默认 `'hidden'`，与上条同值 |
| `src/vs/workbench/contrib/chat/test/browser/chatViewContainer.test.ts`（或同等新测） | 断言 Chat 容器 location = AuxiliaryBar 且 **不是** default；不要测 Conversation 透镜 |

`chatActions.ts` 里 `workbench.action.chat.toggleDefaultVisibility` 只在 Chat 已开在 Aux 时出现，**可留**：用户显式打开 Chat 后仍能改自己的 Aux 默认。不要在本切片改它的行为，以免和切片 1 文件表纠缠。

**本切片明确不做：** `layout.ts`；`contrib/conversation`；关掉 Panel；改四钮；把 `ChatEditor` 从编辑器注册表删除（它违反 INV-TOPO，但默认打开路径不是本切片的 Aux 卫生；中心非 ChatEditor 已由切片 1 单测锁住）。

---

### 切片 3 — 文档诚实

**做什么：** 知识层按 **代码事实** 重写过时句，并写清 M2 之后仍缺什么。不发明引擎已接、Diff 已按 ADR-047、compile 已绿。

本切片 **只改 `docs/`（外加本方案落地后的 `updated`）**。不改 `src/`。`dev/plans/m0-*.md` / `m1-*.md` 作为历史方案可留「当时范围」句；若文末仍把 M1 标成 `proposed`，改成已落地的交叉链接。`dev/progress/status.md` 由实施 commit 按 DOCUMENTATION 规则 3a 写一行，不在本方案预写。

**HEAD 已撒谎 / 过时的句（实施时逐条改，不要只改摘要）：**

| 文件 | 不诚实处 | 改成 |
|------|----------|------|
| [agent-ui.md](../../docs/systems/chat/agent-ui.md) | §3 停在「M1 骨架」；§7 Sources「M0 占位」 | 中心 = 产品透镜（stub 会话/列表/本地 dock/Inbox 行）；Sources Files 列表已落；ChatViewPane 非产品 Conversation；引擎仍无 |
| [desktop-shell-mapping.md](../../docs/reference/code-oss-b2/desktop-shell-mapping.md) | Conversation「M0 占位」；Sources「占位」；右 rail「默认关」但代码当时是 Chat `isDefault` | Conversation = 已填槽的产品透镜（无引擎）；Sources Files 投影已落、Changes/Diff 仍缺口；Aux **出厂 hidden**，Chat 非 default 容器 |
| [parts-and-grid.md](../../docs/systems/workbench/parts-and-grid.md) | `SOURCES_PART`「M0 无真实语义」 | End 下格 = Files 列表投影；Changes 不在此 Part |
| [companion-contribs.md](../../docs/systems/workbench/companion-contribs.md) | 「Conversation（今天无 Part）」；§4 仍像 Sources 无格 | 有 `CONVERSATION_PART`；Files 投影已落；Changes/Diff FORK 原样保留 |
| [panel-and-auxiliary-bar.md](../../docs/systems/workbench/panel-and-auxiliary-bar.md) | 「出厂可能按 visibleInWorkspace 打开」 | 默认编辑器窗口出厂 `hidden`；Agents Window 覆盖不变；Chat 不再是 Aux default |
| [views-and-composites.md](../../docs/systems/workbench/views-and-composites.md) | ChatViewPane 未点名 Aux `isDefault` | 补一句：曾是 Aux default，产品壳改为非 default + Aux 默认关 |
| [glossary.md](../../docs/glossary.md) | `CONVERSATION_PART`「M0 占位」 | 中心锚点 + contrib 透镜；非 `EditorInput` |
| [eh-surface-matrix.md](../../docs/reference/code-oss-b2/eh-surface-matrix.md) | Aux「默认关」写得像已落地；`chatParticipants`「常进 Sidebar ChatViewPane」 | Aux 默认关（配置）；Chat 容器仍在 Aux 但非 default、非产品透镜。探针行仍「推定」 |
| [diff-footprint.md](../../docs/reference/code-oss-b2/diff-footprint.md) | conversation/sources 仍标占位 | 指向 contrib 透镜 / Files 列表；**不要**把本波假装成 footprint 重测（D6 已闭，本波不重跑） |
| [tools-and-editing.md](../../docs/systems/chat/tools-and-editing.md) | Changes「Sources 占位」 | Files 已有；Changes 仍不在 End |
| [m0-topology-surgery.md](m0-topology-surgery.md) 文末 | 「后续 m1 `proposed`」 | 链到 M1 `implemented` + 本 M2 |

切片 1/2 落地后把上述「目标句」写成现在时。若切片 3 **先于** 代码合入：只写 HEAD 真相 + 「M2 目标见本方案」，禁止提前把 Aux 写成已经 hidden。

**本切片明确不做：** 改 `src/`；外仓 ADR 列账；把 D3–D5 勾成完成；重写 IA/spec。

---

## FORK（须人类 / fable 拍板，本波不选）

**Diff 深查看落点（ADR-047 vs 本仓习惯）。** Desktop：文件级 Diff → `PANEL_PART`。本仓：scm 变更打开 `EDITOR_PART` Diff。两条合同不能同时当真。M1 已 PARKED。M2 **仍然不选、不叫 fable、不改 git/scm 打开路径**。Sources **Changes** tab 跟着这条一起留在缺口表。

---

## 仍 deferred（本方案不排期、不验收）

### 验证债（M0 留下，仍开）

| ID | 项 | 说明 |
|----|-----|------|
| **D3** | compile | `npm run compile` + `valid-layers-check`；**不是** M2 出口 |
| **D4** | 启动 T1–T3 演示 | 依赖 D3 |
| **D5** | EH 探针冒烟 | 矩阵「待实测」→「已实测」 |

### 整波不做的 vscode-fork 项

- UniverseAgent 引擎 / gRPC / adapter / Device Grant / session-core。
- Task↔client-tool 双执行面 owner。
- Open VSX、`product.json` 身份、rebase 节奏、外仓文档列账、ADR-003 token 全量迁 CSS。
- ADR-051 Changes tab、ADR-047 Diff 改绑（上节 FORK）。
- 多窗口 coordinator；Zen Mode 与 Conversation 的产品语义（今日 Zen 不藏 Conversation，保持）。
- 把生产入口改成 Agents Window。

---

## 切片文件互斥（实施门闩）

| 切片 | 可改 | 禁止碰 |
|------|------|--------|
| 1 透镜产品化 | `src/vs/workbench/contrib/conversation/**` | `layout.ts`、`conversationPart.ts`、`contrib/chat/**`、`contrib/sources/**`、`docs/**` |
| 2 Chat/Aux 卫生 | `chatParticipant.contribution.ts`、`workbench.contribution.ts`（仅 secondarySideBar 默认值）、`themeMainServiceImpl.ts`（仅同名 Setting）、Chat 容器测试 | `layout.ts`、`contrib/conversation/**`、`contrib/sources/**`、`docs/**` |
| 3 文档诚实 | 上表 `docs/**` + 过时的 plan 交叉链接 | `src/**` |

无共享 grid 手术。无「两人改同一文件」。

---

## 验收（方案层；实施另 commit）

切片落地后（仍 **不**要求本方案期间 compile）：

1. 中心透镜：可切换 stub 会话；时间线是 turn 列表；Dock 可输入并 append；Allow/Skip 只改本地 confirmation；Inbox 不伪造 Queue。中心 URI / Part 仍不是 `ChatEditorInput`。零 `IChatModel`。
2. 新工作区默认：**Auxiliary Bar 隐藏**；Chat 容器 **不是** Aux `isDefault`。用命令打开 Chat 不得把 ConversationPart 换成 ViewPane。
3. 知识层不再把已落槽写成占位；Changes/Diff FORK、引擎、D3–D5 仍标明缺口。
4. `python3 scripts/check-docs-health.py` 在文档变更后 0 error。

## 相关文档

- [m0-topology-surgery.md](m0-topology-surgery.md) · [m1-shell-followon.md](m1-shell-followon.md)
- [deferred-gaps.md](../progress/deferred-gaps.md)
- [agent-ui.md](../../docs/systems/chat/agent-ui.md)
- [panel-and-auxiliary-bar.md](../../docs/systems/workbench/panel-and-auxiliary-bar.md)
- 外仓 ADR-061（只读）· spike §4.2（只读）
