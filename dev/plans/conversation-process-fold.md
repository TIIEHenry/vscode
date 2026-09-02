---
title: "Conversation 过程折：ThinkRail 缩进折叠移植"
type: plan
status: implemented
phase: N/A
updated: 2026-09-01
summary: "ADR-046 span overlay；对话默认收起、轨迹默认展开；Thinking/工具两层缩进；P1–P3/P3t 已合入 `19f3e7ba`–`42fa941e`；P4 blocked PRD-008"
---

# Conversation 过程折

> 需求：[PRD-013](../../docs/product/requirements.md#prd-013-conversation-过程折)（`accepted`）。  
> 对话列表合同：[PRD-003](../../docs/product/requirements.md#prd-003-时间线与输入) / [PRD-004](../../docs/product/requirements.md#prd-004-权限座位) 不变。  
> 数据合同：Desktop [ADR-046](../../../UniverseAgentDesktop/dev/decisions/046-process-fold-is-span-overlay.md)（span overlay，不是 `groupIdentity`）。  
> 视觉对照（只取缩进/披露层次，不搬 React）：sibling `thinkrail/apps/web/src/chat/ActivityGroup.tsx`。  
> 轨迹页：[conversation-trajectory-lens.md](conversation-trajectory-lens.md)（`accepted`）— **同一套 overlay**；轨迹默认展开；context / SYSTEM / compacted 不得进折。  
> 透镜组装：[page-access-schemes.md](page-access-schemes.md) §4 三槽冻结；本方案改 `timeline` 槽的对话列表与轨迹列表 chrome。  
> 本方案 Grok 只读审查（Approve with changes）已当轮改入；2026-09-01 用户签收。Opus 5.0 因账单未付未跑。  
> **签收：** P1–P3/P3t 已合入（`19f3e7ba`–`42fa941e`）；P4 blocked PRD-008。

**Goal：** 过程折是显示优化：连续思考与工具上盖 ThinkRail 式缩进披露，不改列表身份。对话页默认收起（阅读）。轨迹页复用同一 chrome，默认展开（分析），且不把注入 / SYSTEM 藏进折里。

## 1. 选定与拒绝

| 议题 | 选定 | 拒绝 |
|------|------|------|
| 宿主 | `timeline` 槽：对话列表 **和** 轨迹列表 | Bottom Panel；Copilot `ChatListWidget` |
| 视觉 | ThinkRail：外层 N steps、Thinking 再套一层、工具行缩进、chevron、完成勾 | 像素抄 Remix；TODO 0/0；「New messages」缺口折叠 |
| 数据 | ADR-046：连续可折段 = 平行 span overlay；行仍是 turn / record id | `deriveRows` 发明 Activity 行；`groupIdentity`；折壳当 virt 键 |
| 折内层次 | presentational `nestThinkingTools` | 引擎父子字段当折身份 |
| UI 实现 | `contrib/conversation` 共用 overlay 辅助 + Codicon | `thinkrail/**`、React、`ChatThinkingContentPart` |
| 默认 | 对话收起；轨迹展开 | 轨迹禁止过程折；假 elapsed ticker |
| 折外 | 用户正文、座位、轨迹 context / SYSTEM / compacted | 把注入/环境藏进过程区 |

用户截图钉死的是这套 **缩进披露**。轨迹复用它当分析 UI，不是再造一张对话。

## 2. HEAD 事实锚点（写入时核对）

| 事实 | 位置 |
|------|------|
| 时间线按 `getTurns` 逐条 `createTurnElement`；kind 仅 `user` / `assistant` / `confirmation` | `conversationLens.ts` `renderTimeline` / `createTurnElement` · `conversationStubModel.ts` |
| 无过程折 DOM、无 `reasoning`/`tool` kind | 同上 |
| page-access：禁止嵌入 `ChatListWidget`；parts 白名单仅 `chatContentParts/**` | [page-access-schemes](page-access-schemes.md) §4.3 |
| Copilot 有 `ChatCollapsibleContentPart` / `chat.agent.thinking.collapsedTools` | `chatCollapsibleContentPart.ts` · `chat.shared.contribution.ts` |
| `ChatListWidget` `indent: 0`、`renderIndentGuides: None` | `chatListWidget.ts` ~570–574 |
| ADR-046 拒绝相邻 kind 捆 Activity，选定 span overlay | Desktop `046-process-fold-is-span-overlay.md` 选项 C reject |
| ThinkRail 外层 `GroupDisclosure`，子级 `pl-12`；Thinking 内工具再嵌 | `thinkrail/.../ActivityGroup.tsx` `GroupDisclosure` / `ThinkingGroup` |
| ThinkRail `nestRoutineRun`：思考后的 routine tool 挂到该思考 | `thinkrail/.../rows.ts` `nestRoutineRun` |
| 轨迹方案：T3 复用本 overlay（默认展开）+ tool/subtool 树 | [conversation-trajectory-lens](conversation-trajectory-lens.md) §3.3 |

## 3. 设计

### 3.1 时间线项（对话页）

**折是平行 overlay，不是列表里多出来的一行。** ADR-046：virt/DOM 序仍是 `turns[]`；`projectProcessFoldSpans(turns): ProcessFoldSpan[]` 与 turn 数组平行（没有连续 `reasoning`/`tool` 则 `[]`）。**禁止** `TimelineItem = turn | fold`（那是 ThinkRail `deriveRows` 把 Activity 当成 row，等于 ADR-046 已否的 B'）。

`renderTimeline` **仍按 turns 顺序走**。进入某 span 覆盖的第一段时，包一层 `data-process-fold` chrome；段内每条 reasoning/tool 仍是子节点且带 `data-turn-id`（收起可 `hidden`）。span 结束后继续画后续 user / assistant / confirmation。

`ProcessFoldSpan`：

```ts
interface ProcessFoldSpan {
	readonly id: string;                 // 稳定 span id：`fold:${firstTurnId}` — **不是** 列表 item key
	readonly startIndex: number;
	readonly endIndex: number;      // exclusive
	readonly turnIds: readonly string[];
	readonly nodes: readonly ProcessFoldNode[]; // nestThinkingTools(段内 turns)
}

type ProcessFoldNode =
	| { readonly kind: 'thinking'; readonly turn: ConversationStubTurn; readonly tools: readonly ConversationStubTurn[] }
	| { readonly kind: 'tool'; readonly turn: ConversationStubTurn };
```

**切段（ADR-046，stub 简化）：** 连续 `kind ∈ {reasoning, tool}` 收入当前 span；`user` / `assistant` / `confirmation` 切开。无引擎时不做 live/settled 混段；P4 再按 ADR-046 决策 4。

`nestThinkingTools` **只吃一个 span 内的 turns**（对照 ThinkRail `nestRoutineRun`）。它不负责「哪些 turn 进 Activity」——那是切段的事。

`createTurnElement` **只**处理 HEAD 三种：`user` / `assistant` / `confirmation`。reasoning/tool **不得**掉进该函数（HEAD 非 user 会标成 `"Agent"` 气泡，`conversationLens.ts:502-504`）。折 chrome 只在 `conversationProcessFold.ts`。

**禁止：** 用 `assistant` 正文当折壳；把 confirmation 放进 `turnIds`。

### 3.2 视觉（对照截图 / ThinkRail，vscode token）

```text
[user bubble]
▼ Stub · 4 steps · thinking ×2, read ×2     ← 外层，默认收起；摘要也带 Stub
    ▶ Thinking · Stub: outline
        (思考正文)
        read  · Stub: README.md             ← 相对 Thinking 再缩进
    ▶ Thinking · Stub: draft
        write · Stub: README.md
[assistant bubble]
[confirmation seat]
```

- 外层：`role="button"` + `aria-expanded`；左侧 `Codicon.chevronRight`（展开 rotate）；摘要必须含 **Stub**（或同等诚实标记）+ `N steps · …`（对照 `summarizeSteps`，最多 4 个名字）。无引擎 fixture **禁止** `Codicon.loading`。
- Thinking 行：标签 `Thinking`（`localize` 英文源）+ Stub 摘要；展开后正文 + 其 `tools`。
- 工具行：`Codicon.check`（完成）或 `Codicon.loading`（stub 不得假装 live 引擎；若 fixture 标 `running` 必须同时 Stub）。名称 + 一行 summary。展开后 payload 纯文本。
- 缩进：**每层 `padding-inline-start: 12px`**，最多三层（外层 children / Thinking children / 工具 payload）。用 workbench `--vscode-descriptionForeground` 等 token，不用 ThinkRail 色名。
- 折壳：`data-process-fold`（ADR-046）。**禁止** `data-group-key`。每条 reasoning/tool 保留 `data-turn-id`（收起可用 `hidden`）。

**不在 T1–T3：** sticky Activity 面包屑、Virtuoso 缺口折叠、「↓ New messages」、TurnDivider specs/files chips、TODO 横幅。

### 3.3 Stub fixture

扩展 `StubTurnKind`：`'user' | 'assistant' | 'confirmation' | 'reasoning' | 'tool'`。

可选字段：`toolName?: string`；`summary?: string`；`payload?: string`（只进展开区）。

| 会话 | 对话 turns 顺序 | 过程折 |
|------|-----------------|--------|
| `untitled` | user → **reasoning, tool, reasoning, tool** → assistant → confirmation | 一段 span，两层 Thinking，各带一个 stub 工具 |
| `tour` | 现有 Q&A 不变 | 无 reasoning/tool |
| `blank` / `createSession()` | 无 | 无折壳 |

fixture 可见字符串必须含 **Stub**（PRD-007 / PRD-013.4）。例如 thinking `Stub: outline sections`；tool `toolName: 'read'`，`summary: 'Stub: README.md'`。

`shouldRenderTurnAsMarkdown`：保持 `kind === 'assistant'`。扩 kind 后测试必须断言 `reasoning` / `tool` → `false`（现有测只覆盖三种 HEAD kind，挡不住新 kind 误走 markdown）。

现有 `conversationLens.test.ts` 用 `data-kind="user"` 的断言必须仍绿：user/assistant/confirmation 仍是独立 turn 节点。

### 3.4 与轨迹的边界

| | 对话 | 轨迹 |
|--|------|------|
| overlay | 同一 `projectProcessFoldSpans` + 折 chrome | 同左 |
| 默认 | 收起 | **展开** |
| 切段 | `reasoning` / `tool` | `thinking` / `tool` / `subtool` |
| 始终折外 | user / assistant 散文 / confirmation | 另加 context / SYSTEM / compacted / user |

`projectTurnsToTrajectory`：`reasoning`→`thinking`，`tool`→`tool`。轨迹 T3 再插 subtool extras。禁止两套互不相关的折算法。

### 3.5 文件落点

全部 `src/vs/workbench/contrib/conversation/`：

| 文件 | 职责 |
|------|------|
| `conversationProcessFold.ts` | 折壳 + Thinking / 工具行 DOM |
| `conversationProcessFoldModel.ts` | `projectProcessFoldSpans` + `nestThinkingTools` + `summarizeProcessSteps` |
| `conversationStubModel.ts` | 新 kind + untitled fixture |
| `conversationLens.ts` | 对话 `renderTimeline` 命中 span 时包折 chrome（默认收起） |
| `conversationTrajectory.ts` | 轨迹列表命中 span 时 **调用同一** 折 chrome（默认展开） |
| `media/conversationLens.css` | 折 / 缩进 / chevron |
| `conversationProcessFold.test.ts` | P1：切段 confirmation/assistant 切开；nest 只在 span 内；无连续段 → `[]` 不造空壳 |
| `conversationLens.test.ts` | P2：untitled 默认外层收起且 header 含 Stub；展开后两层 indent；user/seat 不在折内 |
| `conversationTurnMarkdown.test.ts` | `reasoning`/`tool` → 非 markdown |
| `conversationProcessFoldImportBoundaries.test.ts` | 扫描 `contrib/conversation` 生产文件，禁 `chatThinkingContentPart` / `chatToolInvocationPart` / `chatCollapsibleContentPart` / `thinkrail`。**即使**路径在 page-access 白名单 `chatContentParts/**`。不与轨迹 `conversationTrajectoryImportBoundaries.test.ts` 合并 |

**禁止**改 `contrib/chat/**`、`vs/sessions/**`、`layout.ts`。**禁止**为过程折去 import `ChatCollapsibleContentPart`（它绑 `ChatTreeItem`）。

## 4. 切片

| # | 内容 | 验证 | 引擎？ |
|---|------|------|--------|
| P1 | `projectProcessFoldSpans` + `nestThinkingTools` 纯函数 | `conversationProcessFold.test.ts` | 否 |
| P2 | untitled fixture + **对话**折 chrome + 默认收起 + 缩进 | `conversationLens.test.ts` | 否 |
| P3 | 展开 Thinking / 工具 payload；Stub 文案 | 上 | 否 |
| P3t | **轨迹**挂同一 chrome，默认展开；SYSTEM/context 在折外 | `conversationTrajectoryUi.test.ts`（与轨迹 T3 同测，**同一 PR 文件互斥**） | 否 |
| P4 | 引擎 admitted turnId 连续段替换 fixture | **blocked on PRD-008** | 是 |
| P5 | sticky 面包屑、缺口折叠、executing 限高内滚 | **由 M7 [conversation-ui-closeout Q4](conversation-ui-closeout.md) 承接**（2026-09-02；Q4 不承接 P4） | 是 |

**Implemented：** **P1–P3、P3t**（`19f3e7ba`–`42fa941e`）。P4 否（blocked on PRD-008）；P5 由 M7 conversation-ui-closeout Q4 承接（2026-09-02）。

与轨迹：**不能**假设文件级并行。P2 / P3t / 轨迹 T1–T3 都可能改 `conversationLens.ts`、`conversationStubModel.ts`。**同一 PR 禁止**两人同时改这些文件。推荐：过程折 P1–P3 → 轨迹 T2（投影 reasoning/tool）→ T3/P3t（轨迹 overlay + subtool）。

## 5. 非目标

- 不搬 `ActivityGroup.tsx` / `foldState.ts` / Virtuoso。
- 不启用 Copilot `chat.agent.thinking.*`。
- 不把注入 / SYSTEM / compacted 折进过程区。
- 不做 SVG 子 agent 连线（通信先做可点记录行）。
- 不造 TODO 进度条。

## 6. 验收对照

| PRD-013 | 切片 |
|---------|------|
| 1 两层缩进 | P2 / P3t |
| 2 对话默认收起；轨迹默认展开 | P2 / P3t |
| 3 折外：user/seat；轨迹另加 SYSTEM/context | P2 / P3t |
| 4 Stub、无假耗时 | P3 |
| 5 不是 Copilot 列表行 / 不是 groupIdentity | P1 平行 span |

## 7. 风险

| 风险 | 缓解 |
|------|------|
| 把 ThinkRail `deriveRows` 当成 span 算法 | P1 只对**已切开的** reasoning/tool 段做 nest；切开规则写在 ADR-046 连续段，不扫 assistant |
| fixture 看起来像真跑过 read | 全部 Stub 前缀 |
| 与轨迹抢 `conversationStubModel` | §4 串行 seed；轨迹投影 skip 新 kind |
| 实施者 import Chat thinking part | **本方案** `conversationProcessFoldImportBoundaries.test.ts`；不占用 page-access `conversationImportBoundaries.test.ts`，不并入轨迹 harness 扫描 |

## 8. 知识层待同步（签收后）

- [conversation-lens-assembly.md](../../docs/reference/code-oss-b2/conversation-lens-assembly.md)：timeline 对话面含过程折 chrome。
- [agent-ui.md](../../docs/systems/chat/agent-ui.md)：过程折 ≠ Copilot thinking 设置。
- [glossary.md](../../docs/glossary.md)：**过程折** 词条本稿已落。
- [page-access-schemes.md](page-access-schemes.md) §4 加一句指针。

## 9. 相关文档

- [PRD-013](../../docs/product/requirements.md#prd-013-conversation-过程折) · [traceability](../../docs/product/traceability.md)
- [conversation-trajectory-lens.md](conversation-trajectory-lens.md)
- Desktop [ADR-046](../../../UniverseAgentDesktop/dev/decisions/046-process-fold-is-span-overlay.md)
- ThinkRail（只读）：`apps/web/src/chat/SPEC.md` activity 行 · `ActivityGroup.tsx` · `rows.ts` `nestRoutineRun`

## 10. 审查记录

**Reviewer：** Cursor Grok 4.6（只读）。**Assessment：** Approve with changes。Critical / Important 已当轮改入下文表。

**签收：** 2026-09-01 用户签收（Grok 审查后；Opus 5.0 因账单未付未派）。P1–P3/P3t 已合入（`19f3e7ba`–`42fa941e`）；`status: implemented`。

| 级别 | 意见 | 本稿处理 |
|------|------|----------|
| Critical | `TimelineItem.fold` = deriveRows Activity 行，违反 ADR-046 overlay | 改入 §3.1：span 平行于 turns；render 仍走 turn 序 |
| Important | 默认收起 header 无 Stub | 外层摘要必须 Stub；禁止 fixture `Codicon.loading` |
| Important | page-access 白名单仍放行 Chat thinking parts | 独立 import 扫描测 |
| Important | 与轨迹「可并行」与「保持现状」冲突 | 改入文件互斥；轨迹 seed 表改「含过程折 kinds」 |
| Important | reasoning/tool 掉进 `createTurnElement` 会变成 Agent 气泡 | 钉死只处理三种 HEAD kind |
| Important | markdown 测未覆盖新 kind | 扩 `conversationTurnMarkdown.test.ts` |
| Minor | 12px ≈ ThinkRail `--spacing:1px` 的 `pl-12` | 不像素抄；保持 12px token 缩进 |
