---
title: "Conversation session 窗口与 chat tab"
type: architecture
status: accepted
phase: N/A
updated: 2026-09-02
summary: "PRD-016 / ADR-002 的系统规格：Part 内最多两叶 session 窗口，每叶嵌 Conversation IEditorPart；ConversationChatInput 围栏；fork / 子代理 / sideChat catalog；overlay、面包屑、导航栈、split"
---

# Conversation session 窗口与 chat tab

> 导航：[系统索引](INDEX.md)。需求：[PRD-016](../../product/requirements.md#prd-016-conversation-session-窗口与-chat-tab)。决策：[ADR-002](../../../dev/decisions/002-conversation-session-windows.md)。方案与切片历史：[conversation-session-windows](../../../dev/plans/conversation-session-windows.md)（S1–S6 `implemented`）。

## 1. 结构

```text
CONVERSATION_PART
├── sessionBar（Part 级窗口 chrome：SelectBox、←→、关非根、Route、hide −）
└── sessionWindowGrid
    ├── leaf[primary]  session A ── Conversation IEditorPart
    │                               ├── CONVERSATION_GROUP: [root tab] [fork tab] [sub-agent tab]
    │                               └── CONVERSATION_SIDE_GROUP（split 后第二列）
    │                  └── ConversationSubAgentOverlay（居中卡片，覆盖在叶上）
    └── leaf[beside]   session B ── Conversation IEditorPart（最多两叶）
```

- **叶** = 一个 session 的窗口。`IConversationSessionWindowService` 维护 `leafOrder` 与 `hidden` 状态；`CONVERSATION_SESSION_WINDOW_MAX_LEAVES = 2`。`ensurePrimaryWindow(sessionKey)` 跟随 `IConversationRosterService.onDidChangeActiveSession`；`openSessionBeside` 建第二叶（Navigator roster 右键「Open beside」或 Alt+点击）；`hideSessionWindow` 后回到单窗，`restoreSessionWindow` 原样恢复。
- **叶内 EditorPart** 由 `EditorParts.createConversationEditorPart` 创建，注册进 `IEditorGroupsService.parts`，共用主窗 `windowId`，`excludeFromGlobalEditorAggregation = true`（不进全局 editor 枚举、MRU `activePart`、`applyState` 工作集恢复、`IHistoryService`）。细节见 [editor-part-tabs §4](../workbench/editor-part-tabs.md)。
- 两叶**共用**右侧 Preview / Sources / Panel；这不是 ADR-001 的双 session 孪生。

## 2. `ConversationChatInput` 与围栏

- 资源：`conversation-chat:/session/<sessionKey>/chat/<chatId>`；`chatId === 'default'` 为根。TypeId `workbench.editors.conversationChatInput`。
- 根 tab 实现 `IEditorCloseHandler`，用户关闭被拦；窗口 chrome「关非根」调用 `closeNonRootTabs`，不 `closeGroup` 根组。
- **围栏**（`common/conversationEditorRouting.ts`）：`isBlockedFromConversationGroup` 对 `ChatEditorInput`、任何非 `ConversationChatInput` 的 `EditorInput`、scheme 不是 `conversation-chat` 的 untyped input 均返回 true；`editorGroupFinder` 把被拦 input 改落主 `EDITOR_PART` 活动组。因此文件 / untitled / Diff / Copilot Chat 都在 Preview 打开。
- **已登记的例外**（[ADR-005](../../../dev/decisions/005-changes-diff-owner.md) `accepted`，实施 plan [sources-changes-diff](../../../dev/plans/sources-changes-diff.md)）：围栏白名单加第二类 input——**只读 Diff 审阅 input**（`ConversationDiffReviewInput`），只经显式动作（「移到对话窗口」、tab 拖入、用户设的默认归属）进入；默认 `openEditor` / `ACTIVE_GROUP` / `SIDE_GROUP` 仍落 Preview。它是普通延伸 tab：可关、后退可关、「关非根」一起关。落地后本节 §2 首条须改口。

## 3. chat catalog：root / fork / tool / sideChat

`IConversationSessionChatService` 按 session 维护 `IConversationSessionChatEntry[]`（`chatId`、`title`、`originKind ∈ user | fork | tool | sideChat`、`parentChatId`），与协议 `ChatOrigin` 四 kind 对齐。stub 期 catalog 来自内存 fixture；活数据依赖 PRD-008。

| 用户动作 | 服务调用 | 结果 |
|----------|----------|------|
| Fork（`ForkConversationAction` 的 Conversation 版） | `registerForkChat` → `openForkTab` | 同 session 新增一张**延伸 tab**；不产生第二个根会话 |
| 点击时间线里的子代理 | `openSubAgent` | 叶内**居中对话框**（`ConversationSubAgentOverlay`：backdrop + card + popout / maximize / close），父对话仍在底下；**不**加 tab |
| 对话框「铺满」 | `toggleSubAgentDialogMaximized` | 仍是 overlay，仍只有根 tab |
| 对话框「打开为 tab」 | `promoteSubAgentDialog` → `openExtensionTab` | 关对话框，加一张延伸 tab |
| 面包屑点击祖先 | `navigateAgentBreadcrumb` | 对话框内替换预览（或回根关对话框）；已是 tab 时**替换当前延伸 tab**，不叠新 tab |
| 关非根 | `closeNonRootTabs` | 关闭该叶所有非根 tab（含子代理 tab） |

面包屑由 `common/conversationAgentHierarchy.ts::buildAgentHierarchyBreadcrumb` 沿 `parentChatId` 走到 `default`；只对 `originKind === 'tool'` 的 chat 生成。协议侧另有 `ChatInteractivity`（Full / ReadOnly / Hidden；`SideChat` 不是它的值，而是 `ChatOrigin` 四 kind 之一）呈现合同已签收，本仓 stub 期一律 Full，且 `contrib/conversation` 尚无对应符号（只有 `ConversationSessionChatOriginKind`）。

## 4. 导航栈

`IConversationNavigationService` 为**每个** Conversation `IEditorPart` 维护独立栈（`ConversationNavigationStack`，深 50）：记录 `(groupId, ConversationChatInput)`；`goBack` / `goForward` 由 SessionBar ←→ 与鼠标侧键（`event.button === 3 / 4`，`conversationNavigation.contribution.ts`）触发；关闭的 tab 从栈里移除。与 `IHistoryService` 完全隔离——Preview 聚焦时鼠标侧键仍是文件历史。

设置 `conversation.navigate.closeChildOnBack`（默认 `true`）：后退时关掉延伸 tab 或子代理对话框，而不是只切换焦点；根 tab 永不因后退关闭。

## 5. split 与并列

- **split**（`workbench.action.conversation.splitSessionWindow`，F1 可见）：同一叶内新建 `CONVERSATION_SIDE_GROUP`，两列各自 tab；`hideSplitColumn` / `showSplitColumn` 收放。仍是同一 session、同一叶；fork 不会因此被送进 Preview。
- **并列** = 第二叶（§1）；隐藏后剩单叶；再打开恢复。

## 6. 与 PRD-016 验收的对应

| 验收 | 落点 |
|------|------|
| 1 中间可见 chat tab，不是 Preview 里的 Chat 标签 | §1 叶内 EditorPart + §2 围栏 |
| 2 根 tab 不可关；隐藏再打开 tab 仍在 | `IEditorCloseHandler` + `hideSessionWindow` 保留叶（**进程内**；跨重启见 PRD-017） |
| 3 Fork 不产生第二根会话 | §3 `registerForkChat` |
| 4 子代理点击前无 tab / 无对话框；点击后 overlay；弹出才 tab | §3 |
| 5 面包屑 + 关非根 | §3 |
| 6 split 仍同 session 同叶 | §5 |
| 7 并列是第二 session 叶，共用 Preview | §1 |
| 8 ←→ 与鼠标 4/5；后退默认关子项 | §4 |
| 9 「对话 \| 轨迹」在 tab / 对话框内 | [lens-and-trajectory](lens-and-trajectory.md) |

## 7. 测试

`contrib/conversation/test/browser/`：`conversationSessionChat.test.ts`、`conversationSessionSplit.test.ts`、`conversationSessionWindowSideBySide.test.ts`、`conversationEditorFence.test.ts`、`conversationEditorAggregation.test.ts`、`conversationNavigation.test.ts`。D4 目视：V5 / V7（[shell-smoke-verification](../../guides/shell-smoke-verification.md)）。
