---
title: "Conversation 透镜、时间线与轨迹"
type: architecture
status: accepted
phase: N/A
updated: 2026-09-02
summary: "ConversationEditorPane 页 chrome；「对话 | 轨迹」双透镜；ConversationTimelineTree + 单点 content adapter；轨迹记录八种 kind；过程折 span overlay；visualize 图示卡与 mermaid 降级；PRD-003 / 012 / 013 / 014 系统规格"
---

# Conversation 透镜、时间线与轨迹

> 导航：[系统索引](INDEX.md)。需求：[PRD-003](../../product/requirements.md#prd-003-时间线与输入) · [PRD-012](../../product/requirements.md#prd-012-conversation-轨迹透镜) · [PRD-013](../../product/requirements.md#prd-013-conversation-过程折) · [PRD-014](../../product/requirements.md#prd-014-conversation-图示卡visualize)。donor 对照与「为什么不用 ChatWidget」见 [conversation-lens-assembly](../../reference/code-oss-b2/conversation-lens-assembly.md)。

## 1. 页 chrome 在哪

每张 chat tab / 子代理对话框的内容由 `ConversationEditorPane`（`workbench.editor.conversationChat`）渲染。它把 `IConversationLensSlots`（`sessionBar` / `timeline` / `dock` 三个 DOM 槽）交给 `ConversationLens` 填。**注意两层 SessionBar**：Part 级的窗口 chrome（SelectBox、←→、关非根、Route）在 `ConversationPart.sessionBar`；页级的「对话 | 轨迹」透镜切换与面包屑在 pane 内。会话切换不随 tab 复制。

`ConversationLens` 把当前透镜 id（`'conversation' | 'trajectory'`）存到 `StorageScope.WORKSPACE`（`CONVERSATION_LENS_ID_STORAGE_KEY`），是本系统今天**唯一**持久化的用户状态。

## 2. 对话透镜：时间线

| 零件 | 文件 | 说明 |
|------|------|------|
| `ConversationTimelineTree` | `conversationTimelineTree.ts` | `WorkbenchObjectTree<ConversationTimelineItem>` 绿field 列表；行 = turn 或 process-fold 节点 |
| 自动滚底 | `conversationTimelineScroll.ts` | `ConversationAutoScrollHolds`：用户上滚时 hold，新回合到达不抢滚 |
| 内容渲染 | `conversationTurnContentAdapter.ts` · `conversationTurnMarkdown.ts` | **唯一**允许触碰 `contrib/chat/browser/widget/chatContentParts/**` 的入口；只借 markdown / code block 渲染函数，不造 `IChatRequestViewModel` 影子模型 |
| 用户卡 | `conversationUserBubbleCollapse.ts` | 用户回合展示为纯文本卡；点卡进入编辑（PRD-015 验收 6） |
| 置顶提示 | `conversationPinnedUserPrompt.ts` | 滚动时把当前可见段落对应的用户提问钉在列顶（对齐 Singularity `PinnedUserPromptState`） |
| 权限座位 | `conversationConfirmationSeat.ts` | Allow / Skip；处理后按钮消失、记录留在列表（PRD-004）；不是可回收 virt 行 |
| 图示卡 | `conversationVisualizeCard.ts` | §5 |

对话透镜**不含**：context 注入卡、环境 / SYSTEM 全文、工具 schema 目录；用户回合只显示正文（PRD-012 验收 2）。这些都在轨迹页。

## 3. 轨迹透镜

模型：`conversationTrajectoryModel.ts`。

- `ConversationTrajectoryKind = system | user | context | compacted | message | tool | subtool | thinking`。
- `projectTurnsToTrajectory(turns)` 把 stub 回合投影成记录；**confirmation 与 visualization 不投影**（座位与图示卡是对话页专属）。
- `mergeTrajectoryFixtureExtras` 补入 stub 期才有的 system / context / subtool 记录，文案常量带 `Stub`（`CONVERSATION_TRAJECTORY_STUB_*`）；引擎接通后此函数应由 adapter 提供的真实记录取代。
- 双向 reveal（T5a）：`findTurnIdForTrajectoryRecord` / `findTrajectoryRecordIdForTurn` 让两页互跳到同一条；fixture-only 行返回 `undefined`。

视图：`conversationTrajectory.ts` + `conversationTrajectoryList.ts`。选中一行打开**局部检查器**（pane 内，不占 Bottom Panel）。父子工具时 `subtool` 相对 `tool` 再缩进。pending 权限或新 Diff **不**自动切到轨迹（验收 6）。无引擎且该会话无 fixture 时写诚实空态（验收 7）。

T5 搜索 / 虚拟化 / Overview 瀑布条延期为 [D10](../../../dev/progress/deferred-gaps.md)（[PRD-020](../../product/requirements.md#prd-020-规模与性能上限)）。

## 4. 过程折（overlay，不是列表身份）

模型：`conversationProcessFoldModel.ts`。

- 对话页：`projectProcessFoldSpans(turns)` — 连续 thinking / tool 成一个 span；user、assistant、confirmation 打断。`nestThinkingTools` 把工具行缩进到最近的 thinking 下。
- 轨迹页：`projectTrajectoryProcessFoldSpans(records)` — thinking / tool / subtool 成 span；user、context、system、message、compacted 打断，**始终在折外**。
- 外层摘要 `summarizeProcessSteps` / `summarizeTrajectoryProcessSteps` 必含 `Stub`（PRD-013 验收 4），无假耗时。
- 默认态：对话页收起，轨迹页展开（验收 2）。视图 `conversationProcessFold.ts`；两页共用 overlay 辅助函数，宿主 DOM 各自一套。
- 折壳不是 Copilot Chat 列表行，也不是 `groupIdentity`；分组按 Desktop ADR-046「平行 span overlay」。

## 5. 图示卡（visualize）

- 协议类型在 `common/conversationVisualize.ts`：`type: 'diagram'`（`mermaid` 必填）或 `'comparison'`（`options[]`：name / pros / cons / recommended / 可选 mermaid）。`parseVisualizeArgs` 失败时给 `fallbackMarkdown`（错误说明 + 原始 fence）。
- 渲染：`conversationVisualizeCard.ts` 在时间线以卡片呈现，无 You / Agent 气泡头；`conversationVisualizeOverlay.ts` 全屏 overlay（Close + Reset，Esc 关闭），**不是** mermaid preview editor tab。
- mermaid 宿主 `conversationMermaidHost.ts`：依赖内置扩展 `vscode.mermaid-markdown-features` 的 `chat-webview-out` 资源起 webview；扩展缺失时 `fallback: true`，退回 `<pre>` 源码 fence + Stub 文案（PRD-014 验收 4）。
- 引擎 admitted `visualize` **只**映射为 `visualization` kind（`visualizeArgsFromMermaidTool` 是未来 adapter 入口），不进 tool / reasoning span，轨迹不投影。

## 6. 与需求验收的对应

| PRD | 验收 | 落点 |
|-----|------|------|
| 003 | 1–3 | §2 时间线树；发送链见 [composer-and-inbox](composer-and-inbox.md)；stub 回复 `stubEcho` 标记 |
| 012 | 1 双页不可关、默认对话 | §1 `ConversationLens` 透镜切换 + 持久化 |
| 012 | 2 对话页不含注入 / SYSTEM | §2 末段 |
| 012 | 3 轨迹至少一条 context / 带 block 的 user / SYSTEM；局部检查器 | §3 fixture extras + 检查器 |
| 012 | 4–5 过程折默认展开、subtool 缩进 | §4 / §3 |
| 012 | 6–8 不自动切轨迹、诚实空、非 Copilot | §3 |
| 013 | 1–5 | §4 |
| 014 | 1–5 | §5 |

## 7. 测试

`conversationLens.test.ts`、`conversationLensRevealNavigation.test.ts`、`conversationTimelineScroll.test.ts`、`conversationTurnMarkdown.test.ts`、`conversationUserBubbleCollapse.test.ts`、`conversationPinnedUserPrompt.test.ts`、`conversationTrajectory*.test.ts`（含 `ImportBoundaries`）、`conversationProcessFold*.test.ts`、`conversationVisualize*.test.ts`。import 红线由 `conversationImportBoundaries.test.ts` 机械 enforce（[ADR-006](../../../dev/decisions/006-shell-invariants.md) INV-NO-COPILOT）。
