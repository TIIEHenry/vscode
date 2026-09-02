---
title: "ADR-005 文件级 Diff 归属：默认 Preview，可移对话窗口 / 底部"
type: decision
status: accepted
phase: N/A
updated: 2026-09-02
summary: "PRD-009 Diff owner：默认 EDITOR_PART（Preview）；用户显式动作可移入 Conversation 延伸 tab（只读审阅）或底部 Panel 产品 Diff 视图（重宿主）；本地覆盖外仓 ADR-047 单一底栏归属"
---

# ADR-005 文件级 Diff 归属：默认 Preview，可移对话窗口 / 底部

## Context

[PRD-009](../../docs/product/requirements.md#prd-009-changes-与-diff) 之前 `blocked`，原因是 Diff owner 未选（[research-queue R6](../progress/research-queue.md)）。三个候选：

- **A** 编辑器区 Diff editor（HEAD 现状：`SourcesChangesList.openSourcesChangeEntry` 走 `ISCMResource.open()` / `openEditor(ACTIVE_GROUP)`，落主 `EDITOR_PART`）
- **B** 底部 Panel 专用容器（外仓 Desktop ADR-047 `INV-047-DIFF-OWNER`：Diff 只在 `PANEL_PART` transient tab，0× L1，不进 Changes 内嵌）
- **C** Sources Changes 内嵌 inline diff

相关已拍板合同：

- [ADR-002](002-conversation-session-windows.md)：Conversation 是第四类 editor 容器，围栏只接受 conversation 类 input。代码事实：`conversationEditorRouting.ts` `isBlockedFromConversationGroup` 对任何非 `ConversationChatInput` 返回 true；`editorGroupFinder.ts` `handleGroupResult` 把被拦 input 改落 `mainPart.activeGroup`。`DiffEditorInput` 今天会被弹回 Preview。
- [conversation-session-windows §3.8 A3](../plans/conversation-session-windows.md)：Conversation part `excludeFromGlobalEditorAggregation`，不进 `IEditorService.editors` / Close All / 脏编辑器确认 / hot exit / 工作集恢复。
- INV-052-NO-DUAL-HIDE（`layout.ts` `enforceAgentShellVisible`）：Conversation ∨ (Editor ∨ Sources) ≥ 1；Panel 不在四钮，M5 V3 要求「只关 Preview 时 Panel 不被强制弹出」。
- [companion-contribs §5](../../docs/systems/workbench/companion-contribs.md)：记录 Desktop 目标（Panel）与本仓现状（EDITOR_PART）的映射张力；「开 Diff 不得自动撑开已收起的 Sources 下格」。

产品原则：主流程在对话（vision §体验原则 1）。用户审阅 Agent 改动时希望留在对话窗口，而不是每次切到右边 Preview；但 Preview 是完整编辑器，可写编辑必须留在那里。

## Decision

**默认 A；A / B 与「移入对话窗口」三者可切换。** 用户 2026-09-02 裁决。

1. **默认归属 = Preview（主 `EDITOR_PART`）。** Changes / Review 行点击、SCM 命令、任何未点名目标的 Diff 打开都落 Preview。HEAD 路由保留。
2. **可移入对话窗口（Conversation 延伸 tab）。** 围栏从「只接受 `ConversationChatInput`」放宽为「`ConversationChatInput` + **显式动作**带入的 Diff 审阅 input」：
   - 只经显式路径进入：用户命令「移到对话窗口」、tab 拖入、或用户已把默认归属设为对话窗口。默认 `openEditor` / `ACTIVE_GROUP` / `SIDE_GROUP` / 焦点在 Conversation 时打开文件 **仍**落 Preview（ADR-002 围栏第 4 条不变）。
   - 进入对话窗口的是 **只读审阅 input**（新 input 类型，包装同一 change 引用；不是可写 `DiffEditorInput`），提供 revert / accept 变更与「在 Preview 打开」；不允许在对话窗口内编辑文件正文。理由：A3 聚合豁免会让该组绕过脏编辑器确认与 hot exit，可写 Diff 进去会丢保存保护。
   - 它是普通延伸 tab：可关、后退可关（`closeChildOnBack`）、「关闭根以外全部 tab」会一起关；根 tab 关闭拦截器不变。
   - 普通文件、untitled、`ChatEditorInput` 继续被围栏拦回 Preview。PRD-016「文件仍在右边 Preview」加此唯一例外。
3. **可移到底部（Panel 产品 Diff 视图，重宿主）。** Panel 是 ViewContainer 不是 EditorPart，不做「第三个 EditorPart」。底部承载 = `contrib/sources`（或新 contrib）注册一个产品 Panel 视图，内嵌 `DiffEditorWidget` 显示同一 change 引用。「移到底部」= 关掉当前 Diff tab + 在该视图里打开；「移回」= 反向。用户感知为移动，实现是换宿主。
   - Panel 因用户动作显示不算违反 V3；`enforceAgentShellVisible` / `ensureAgentShellMinimumVisible` 不把它当脏状态改回。
   - 不进四钮；不改 INV-052 公式。
4. **默认归属可配置**：一个设置 `preview | conversation | panel`（键名在 plan 内定）。设置只影响 **用户从 Changes / Review 点开** 的 Diff；SCM 命令与扩展打开的 Diff 仍按 vscode 习惯落 Preview。
5. **本仓对外仓 ADR-047 的关系**：ADR-047 的「Diff 只在 Panel」在本仓 **不再作为目标**。保留其两条约束：不做 C（Changes 内嵌 inline diff）；开 Diff 不自动撑开已收起的 Sources 下格。`companion-contribs §5` 的「Desktop 目标」列改为「已被 ADR-005 覆盖」。

## Consequences

- PRD-009 `blocked` → `accepted`；R6 closed。
- 需新实施方案（`dev/plans/sources-changes-diff.md`，规则 16 审查后开切片）。切片大致：① 围栏放宽 + 审阅 input + 单测（焦点在 Conversation 打开文件仍进 Preview；`CONVERSATION_GROUP` + 普通文件仍拒；审阅 input 经显式动作可进）；② Changes / Review 行 → Diff（Preview）+ 「移到…」动作与默认归属设置；③ Panel 产品 Diff 视图 + 重宿主往返；④ 知识层：`parts-and-grid` §5 插入面表、`editor-part-tabs` 围栏句、`companion-contribs` §5、`agent-ui` Sources 行。
- ADR-002 围栏措辞「只接受 conversation 类 input」须在知识层改为「conversation 类 input + 显式带入的 Diff 审阅 input」；`isBlockedFromConversationGroup` 需要第二个白名单分支。
- A3 聚合豁免保持：对话窗口内的 Diff 审阅 tab 同样不进全局枚举。因其只读，无脏状态外漏。
- D9 EH 矩阵 `viewsContainers.panel` 探针可与产品 Panel Diff 视图同批实测。
- 「Agent 改过的文件」归因（哪一轮改了什么）仍依赖 PRD-008；本 ADR 只裁 Diff 打开与移动。

## Alternatives

- **B 单一归属（Desktop ADR-047 原样）**：Diff 只在 Panel。拒绝：与「主流程在对话」冲突（审阅要离开中心）；Panel 不是 EditorPart，multi-diff / 编辑器命令生态在底栏缺失；用户已裁决要能进对话窗口。
- **C Sources Changes 内嵌 inline diff**：拒绝：Sources 是 End 下格配套区，宽度与高度不适合深查看；与 ADR-047 保留约束「不进 Changes 内嵌」一致。
- **允许可写 `DiffEditorInput` 进对话窗口**：拒绝：A3 聚合豁免会绕过脏编辑器确认 / hot exit / 工作集；要么放弃豁免（推翻 ADR-002 S1a），要么接受丢改动风险。选只读审阅 input。
- **在 Panel 区再造一个 EditorPart 以支持真 tab 拖动**：拒绝：要把新 part 接进 INV-052 互斥、Panel maximize 恢复（V4）、`EditorParts` 聚合豁免；改动面大，收益只是拖动手感。重宿主足够。
- **默认归属 = 对话窗口**：拒绝：会让对话时间线被 Diff tab 挤占，且 SCM / 扩展习惯是编辑器区；默认 Preview、显式移入更保守。
