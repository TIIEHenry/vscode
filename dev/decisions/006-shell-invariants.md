---
title: "ADR-006 默认窗壳不变量：采纳外仓 ADR-061，定义 INV-TOPO / NO-DUAL-HIDE / NO-COPILOT"
type: decision
status: accepted
phase: N/A
updated: 2026-09-02
summary: "追溯登记 M0–M5 实际执行的三条壳不变量与其唯一外部决策依据（UniverseAgentDesktop ADR-061）；与 Desktop ADR-003（设计 token）无关"
---

# ADR-006 默认窗壳不变量

> **编号说明**：本仓 ADR 编号与外仓 UniverseAgentDesktop 互不相关。`dev/plans/` 与 `docs/` 中多处出现的「ADR-003 token 全量迁 CSS」指 **Desktop 外仓** 的设计 token 决策；本仓 [ADR-003](003-engine-adapter-boundary.md) 是引擎 adapter 边界。本文件编号 006 是因为 003–005 已被同日的 R5 / R6 产出占用；本文件是追溯登记，不与 003–005 的裁决冲突。

## Context

M0（[m0-topology-surgery](../plans/m0-topology-surgery.md)）到 M5（[m5-ui-shell-hardening](../plans/m5-ui-shell-hardening.md)）把默认 Code 窗口改造成 Conversation 为中心的 Agent IDE 壳。整个过程依赖三条不变量，它们在 `layout.ts`、`chatShellRouting.ts`、`conversationImportBoundaries.test.ts` 里有代码与测试落点，在 [parts-and-grid](../../docs/systems/workbench/parts-and-grid.md) 与 [agent-ui](../../docs/systems/chat/agent-ui.md) 里有规格叙述，但**本仓没有任何 ADR 登记过它们**。唯一决策依据是外仓 [ADR-061](https://github.com/TIIEHenry/UniverseAgentDesktop/blob/main/dev/decisions/061-code-oss-base-and-editor-window-shell.md) 的只读链接。

按 [DOCUMENTATION.md](../../docs/DOCUMENTATION.md) 规则 10a，外仓文档只能作 `source`，不得通过整篇链接隐式继承规范。本 ADR 补上这层：明确本仓采纳了 ADR-061 的哪几条，并给三条不变量一个可引用的本地落点。这是**追溯登记**，不改变任何已落代码。

## Decision

### 1. 采纳外仓 ADR-061 的以下结论，作为默认窗壳的依据

| ADR-061 结论 | 本仓采纳形态 |
|---|---|
| 以 Code - OSS 为基座，在**默认编辑器窗口**做拓扑手术，不以 Agents Window 为产品入口 | `workbench.desktop.main` 默认 `Layout` 改 grid；`vs/sessions` 只作 donor（[vision §当前产品范围](../../docs/product/vision.md)） |
| 中心是 Conversation，编辑器退为 End 列配套（Preview） | `Parts.CONVERSATION_PART` 中心叶；`EDITOR_PART` End 上格；`SOURCES_PART` End 下格 |
| 四钮 Navigator / Conversation / Preview / Sources | titlebar `LayoutControlMenu`（D7） |
| 配套功能面默认保留（决策 5） | Copilot provider / entitlement / setup 除外，见 agent-ui §5 |

ADR-061 中未在上表列出的条款（例如 Desktop 像素合同、Desktop ADR-003 token、ADR-047 Diff 单一底栏归属）**不**因本 ADR 而被采纳；Diff 归属由本仓 [ADR-005](005-changes-diff-owner.md) 另行裁决（ADR-004 superseded）。

### 2. 三条本仓不变量

**INV-TOPO** — `Layout.createGridDescriptor` 的中心叶**必须**是 `CONVERSATION_PART`。禁止把中心改回 `EDITOR_PART`，禁止用 `ChatEditor` / `ChatEditorInput` / Custom Editor 当产品对话。文件类 `EditorInput` 永远进 End 列 Preview。允许（[ADR-002](002-conversation-session-windows.md)）Conversation Part **内部**嵌套 Conversation `IEditorPart` 画 chat tab；被拒绝的是「ChatEditor 占中心」，不是「Conversation 内不能有 EditorGroup」。

**INV-052-NO-DUAL-HIDE** — `Conversation ∨ (Editor ∨ Sources)` 至少一个可见。`setConversationHidden` / `setEditorHidden` / `setSourcesHidden` 通过 `enforceAgentShellVisible` 维持；原 editor↔panel 互斥（藏 editor 强制弹 Panel）作废；Panel / Aux maximize 藏 End 列而非 Conversation；Zen Mode 同规则。禁止出现「Conversation 关、Preview 关、只剩被强制打开的终端 Panel」的脏状态。命名沿用 Desktop INV-052，本仓公式以 `layout.ts` 为准。

**INV-NO-COPILOT** — 产品 Conversation（`contrib/conversation`）**零 import** `ChatWidget` / `ChatListWidget` / `chat/browser/widget/input/` / `agentSessions/`；只允许 `chat/browser/widget/chatContentParts/**` 渲染函数经唯一 adapter 入参（由 `conversationImportBoundaries.test.ts` 机械 enforce）。默认窗不把 Copilot Chat、setup、entitlement、Sign In 当产品入口（agent-ui §5 列出的全部 `f1: false` / `IsSessionsWindowContext` 门闩）。`IChatModel` / AHP / `copilotChatSessions` 均不得当会话权威。

### 3. 修改这三条不变量的门槛

任何改动都需要**新 ADR** 推翻本文件（规则 5），并先改对应 PRD（规则 10a）。局部例外必须在该 ADR 里逐条写明它松动了哪一条、为什么不算推翻。目前唯一登记的例外是 [ADR-005](005-changes-diff-owner.md)：显式动作带入的只读 Diff 审阅 input 可进 Conversation 延伸 tab；默认打开路径仍落 Preview，因此 INV-TOPO「文件永远进 Preview」在默认路径上不变。

## Consequences

- 新会话读 `dev/decisions/` 即可知道壳的三条红线，不必翻外仓。
- `parts-and-grid` / `agent-ui` / `glossary` 中对 INV-* 的叙述改为链接本 ADR，不再各自复述公式。
- R5 引擎接线（[ADR-003](003-engine-adapter-boundary.md)）设计 adapter 时，`IChatModel` / AHP 不得作权威这条已有落点，可直接引用。

## Alternatives

- **继续只链外仓 ADR-061**：违反规则 10a；外仓演进会静默改变本仓依据。
- **把不变量写进 AGENTS.md**：AGENTS.md 是导航，不是决策记录；且无法表达「怎样才算推翻」。
- **拆成三个 ADR**：三条不变量同源（ADR-061）、同时落地（M0），拆开只增加索引噪音。

## 相关

- 代码：`src/vs/workbench/browser/layout.ts`（`enforceAgentShellVisible`）· `src/vs/workbench/contrib/chat/browser/chatShellRouting.ts` · `src/vs/workbench/contrib/conversation/test/browser/conversationImportBoundaries.test.ts`
- 规格：[parts-and-grid §4–5](../../docs/systems/workbench/parts-and-grid.md) · [agent-ui §3 / §5](../../docs/systems/chat/agent-ui.md) · [Conversation 系统](../../docs/systems/conversation/INDEX.md)
- 需求：[PRD-001](../../docs/product/requirements.md#prd-001-以-conversation-为中心) · [PRD-006](../../docs/product/requirements.md#prd-006-默认无-copilot--chat-冒充) · [PRD-007](../../docs/product/requirements.md#prd-007-诚实降级)
