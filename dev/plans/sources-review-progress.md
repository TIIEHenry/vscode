---
title: "Sources Review：只导航审阅面——本地审阅进度、引擎归因装饰、「查看更改」入口"
type: plan
status: accepted
phase: N/A
updated: 2026-09-02
summary: "PRD-023：R1–R4b 已落 @ `05007b60`–`f1065288`；R5 验收 + 知识层待冒烟；缺口 G-REV-1"
---

# Sources Review：只导航审阅面

> **需求**：[PRD-023](../../docs/product/requirements.md#prd-023-sources-review-审阅进度与归因)（`accepted` @2026-09-02，随本稿签收）；同批已改 [PRD-005](../../docs/product/requirements.md#prd-005-preview-与-sources) 用户陈述里「review 引擎未接线」一句与 traceability（规则 10a：PRD 改口属签收批，不是实施切片）。  
> **基线**：本稿相对 **commit HEAD**（含 [sources-changes-diff](sources-changes-diff.md) F1–F3 已落：`sourcesChangeEntryOpen.ts` 三宿主分派、`ConversationDiffReviewInput`、Panel Diff 视图；含 stream-timeline S1 的 `platform/universeAgent/common/sessionView`）。不以未 checkout 的工作树为准。  
> **对照合同（`source`，不隐式继承）**：Desktop [ADR-043](../../../UniverseAgentDesktop/dev/decisions/043-agent-change-disposition-and-review-progress.md)：Review 只导航（UI-INV-09）；审阅进度是 scope-local own-data，键 `(scopeKeyId, path, contentHash)`，内容变即失效，不落盘、不回写引擎、不进会话事实、不做 Send / Commit 门禁（INV-DISP-2 / 6）；无 correlation 时禁止「本轮改动」文案（INV-DISP-3）；Discard 归 Changes owner。Desktop [ui-interaction-spec](../../../UniverseAgentDesktop/docs/product/ui-interaction-spec.md) `UI-REVIEW-01`：助手回合尾「查看更改」只打开 Sources（优先 Review），无 capability 则省略。**本仓分叉**：Desktop 把审阅进度放在 Changes owner；本仓 PRD-023 把它放在 **Review**——这是 Review tab 的存在理由，Changes 保持纯 stage / commit 面。  
> **不推翻**：[ADR-005](../decisions/005-changes-diff-owner.md)（Diff 默认归属可设；开 Diff 不自动撑开已收起的 Sources）；[sources-changes-diff](sources-changes-diff.md) F1–F5（本稿不碰 `sourcesChangeEntryOpen.ts` / Diff input / Panel 视图）；[conversation-stream-timeline](conversation-stream-timeline.md)（不改 session-core 类型；`projectSnapshotToEntries` 签名不加参数）。  
> **审查记录**：见文末。规则 16 三轮已过（第三轮无 Critical，Important 全部改入），2026-09-02 用户授权「用 Cursor CLI Grok 审查、架构由本会话裁定」，据此 `accepted`。**R1–R4b 代码已落** @ `05007b60`–`f1065288`；**R5** 验收（V-R1–V-R6）+ §7 知识层仍待冒烟证据。

## 0. 目标与非目标

**目标**：让 Review tab 有存在理由——用户在这里按「我看过哪些、还剩哪些、哪些是这一轮 Agent 改的」审阅一批变更，点行开 Diff（按当前默认归属），点归因回到对话里那一步；而不是 Changes 去掉按钮的复印件。全部只读；无引擎时审阅进度仍可用，归因与「查看更改」整槽省略。

**非目标**（本稿不做）：

| 不做 | 原因 |
|------|------|
| review comment、approve / request-changes 状态、任何写回引擎或 git 的「已评审」标记 | ADR-043 拒绝写回；引擎 proto 无 review 概念（§6） |
| 审阅进度落盘（workspace / profile storage） | ADR-043 待裁决点已裁 window-local；PRD-017 只管会话与布局 |
| 审阅进度参与 commit / send 门禁，或 Changes 行显示「未审阅不可提交」 | INV-DISP-6 |
| Review 里的 Discard / Revert / Stage；从 **Changes** 行打开 Diff 时标已审阅 | UI-INV-09；Review 才是审阅面，不污染 Changes |
| turn 级 Undo、按 turn 分组列表 | INV-DISP-1；归因只是装饰 chip，列表键仍是 path |
| 用引擎 `GitService.ReadGitChanges(session_id)` 替换本地 SCM 作为列表权威 | 本仓工作区是 git 权威；远程引擎另一 work_dir 见 §2.5，v1 只加 note |
| 从 L2 工具 `arguments_json` 里解析 path 当归因 | 那是工具专有 args，不是 admitted correlation（INV-DISP-3）；缺口 G-REV-1 |
| 改 `extensions/git`、改 session-core 类型、改 `projectSnapshotToEntries` 签名 | 见不推翻 |

## 1. HEAD 事实（实施起点；以 `git show HEAD:` 为准）

| 事实 | 位置 |
|------|------|
| Review 列表 = `collectSourcesReviewEntries` 取 **与 Changes 同一批** `ISCMService` 资源；`ISourcesChangeEntry` **没有** `rootUri`；inline filter 按 `filterSourcesEntries(entries, query)`（整段 `includes` 于 name / description / fsPath；**不支持 `\|`**） | `contrib/sources/browser/sourcesReviewList.ts` · `common/sourcesReviewModel.ts` · `common/sourcesFilterModel.ts` |
| 行打开：`list.onDidOpen` → `openSourcesChangeEntry(entry, deps, options)`（`sourcesChangeEntryOpen.ts`，由 `sourcesChangesList.ts` 再导出）；`deps = { editorService, quickDiffService, configurationService, instantiationService, sourcesDiffPanelService }`；按 `sources.diff.defaultOwner`（`preview` 默认 / `conversation` / `panel`）分派。Review 已注入这五个服务 | `sourcesReviewList.ts` L176–194 · `sourcesChangeEntryOpen.ts` |
| `sources.contribution.ts` 已 `import './conversationDiffReview.contribution.js'` / `'./sourcesDiff.contribution.js'` | `sources.contribution.ts` |
| header hint 文案 `Read-only list. Review engine not connected.`（`role="note"`）；行高 22px；a11y label 只有 name + description | `sourcesReviewListStrings.ts` · `sourcesReviewList.ts` |
| `SourcesTabsHost.selectTab` 为 **private**；`SourcesListFilterBox` 只有 getter | `sourcesTabsHost.ts` · `sourcesListFilterBox.ts` |
| Changes 行 stage / unstage / commit 走 git 命令 | `sourcesChangesList.ts` · `common/sourcesChangesGit.ts` |
| vscode `etag()` = `mtime.toString(29) + size.toString(31)`，**不是**内容哈希 | `platform/files/common/files.ts` |
| 系统文档把 Review 写成「评审能力依赖 PRD-008；今天只是第二个只读视角」；companion-contribs §5 仍写「实施方案待写」 | [systems/sources/overview.md](../../docs/systems/sources/overview.md) · [companion-contribs](../../docs/systems/workbench/companion-contribs.md) |
| 会话视图 lease（S1 已落）：`SessionViewSnapshot.timeline[]` / `overlay.blocks[]`（流式块）/ `attribution`；`RuntimeOverlayView` **只有 `blocks`，没有 file_mutation**；`platform/universeAgent` 树内零处 `file_mutation` | `platform/universeAgent/common/sessionView/types.ts` |
| Conversation 时间线投影：**合同** = [stream-timeline §3.3](conversation-stream-timeline.md)（`projectSnapshotToEntries(snapshot, attribution)` 单一纯函数、`orderKey` 序、`entriesToLegacyTurns` shim、`ConversationTimelineEntryKind` 扩 `system / question / error / unknown`）与 §3.4（帧类 A / B / C，`changedIds` 来自 ViewFrame）。**HEAD 只有** vendored `sessionView/**` + `common/conversationViewFrame.ts`（`ConversationViewFrame { frame, attribution }`、`ItemAttribution` 是 vscode 自有类型）；contrib 侧投影随 S1 / S2 合入后才存在，R4b 扩 kind 的对象在那之后 | `platform/universeAgent/common/conversationViewFrame.ts` · stream-timeline |
| `TimelineItemView` 字段 = `id / orderKey / turnId? / summary / detail? / agentId?`；`TimelineItemSummary` 的 `tool` 臂只有 `toolName`，**没有 `toolCallId`**——session-core fold 丢掉 `tool_call_id`；vendored 类型不可改（SYNC） | `platform/universeAgent/common/sessionView/types.ts` |
| 轨迹 reveal：`ConversationTimelineTree.revealTurn(id)`（私有，按**时间线 item / entry id** 索引，不是引擎 `turn_id`）、`ConversationLens.navigateToTrajectoryFromTurn`（透镜内方法）；**没有**已注册的 reveal 命令 | `conversationTimelineTree.ts` · `conversationLens.ts` |
| `TurnCompletedChange{turn_id (runtimeTurnId), …, assistant_turn_id (落盘 assistant envelope id)}`：runtime turn id 与 L2 项 id **不假定相等** | 外仓 `message_envelope.proto` |
| 引擎 proto：`ToolRuntimeSnapshotProto{tool_call_id, tool_name, family, owner_scope_id?, lifecycle, timing, …, payload.file_mutation_payload{path, operation, diff_stats{added_lines, removed_lines, changed_files}, preview_ref(kind=DIFF)}}` 是 L3 `tool_runtime_snapshot`（**不落库**；**无 `turn_id` / `agent_id`**）；`ToolCallLifecycleEvent{turn_id, tool_call_id, agent_id, change}` 是 L3；`RuntimeOverlaySnapshotEvent.tool_runtime_snapshots` 是重连重播种；`GetHistory` 只回 `MessageEnvelopeProto`，L2 `ToolCallBlock` 只有 `tool_call_id / tool_name / arguments_json` | 外仓 `message_envelope.proto` |
| 引擎 proto：`GitService.ReadGitChanges(session_id)` / `ReadGitFileDiff(session_id, path, index_state)` 带 `supported / reason` | 外仓 `git_service.proto` |
| `ConnectRequest.shared_fs_root`（**客户端发**）、`ConnectResponse.work_dir`（**服务器**工作目录） | 外仓 `common.proto` |

## 2. 形态

### 2.1 一行 Review 条目

```text
[icon] path/to/file.ts                                    +12 −3   [Turn 4 · coder]   ●
       ~ src/                                                                          ○
  │      │                                                  │            │             └ 审阅进度：● 未审阅 / ○ 已审阅（内容变后回到 ●）
  │      └ 第二行 description（行高改 2 行 = 44px；a11y label 追加审阅态与归因）  │
  │                                                          │            └ 归因 chip（仅引擎接通且该 path 有归因；最多 2 + "+n"）
  └ 与 Changes 同一 ISCMResource；decorations 沿用 SCM                └ diff stats（有 quick diff 时本地算；无则省略）
```

列表**成员与顺序**仍由 SCM 决定；本稿只加三类装饰。行点击行为不变（`openSourcesChangeEntry` 按当前 `defaultOwner` 分派）。同一 uri 出现在 staged / working tree 两组时**共享**同一审阅态（键按 uri）。

### 2.2 审阅进度（`contrib/sources/common/sourcesReviewProgress.ts`，新；R1）

| 项 | 选定 |
|----|------|
| 服务 | `ISourcesReviewProgressService`（contrib 内注册，`InstantiationType.Delayed`），**纯内存** `Map<key, { reviewedAt }>`；窗口关闭即丢。**不注入 `IStorageService`**；测试用 progress 模块 import 扫描 + 运行时 mock 双保险 |
| 键 | `scopeKeyId` = 由 `ISCMService.repositories` 按 uri 反查所属 `ISCMRepository.provider.rootUri` 字串（**不**给 `ISourcesChangeEntry` 加字段，不动 `sourcesChangesModel.ts`）；`path` = 资源 URI 字串；`contentHash` = `IFileService.stat(uri).etag`。**etag 是 mtime+size 代理**：满足 ADR-043「工作区可见内容变即失效」，不是加密哈希；同大小且 mtime 不变的覆盖不失效，接受 |
| 删除态 / 非 file scheme / stat 失败 | etag 记 `''`，仍可标已审阅，只靠 uri 区分；文件复现后 etag 非空 → 回 ● |
| rename | URI 变即新键（未审阅）；旧键在下次 SCM refresh 时随「资源已不在列表」清理。与 ADR-043 按 path 键一致 |
| 标记为已审阅 | ① 用户从 **Review 行**打开 Diff（任何宿主）：`try { await openSourcesChangeEntry(...) }` 正常返回才标记（该函数返回 `Promise<void>`，无成功布尔；抛出则不标）；挂在 Review `onDidOpen` 的调用点之后，**不**改 `openSourcesChangeEntry` 本体，Changes 行打开不标；② 行 hover / 右键「Mark as reviewed」/「Mark as unreviewed」；③ 标题动作「Mark all as reviewed」（当前可见集） |
| 失效 | `IFileService.onDidFilesChange` 命中该 URI → 重新 stat；etag 不同 → 删键 → 行回 ● |
| 计数 / 过滤 | header「已审阅 x / y」；filter box 右侧 toggle「仅未审阅」 |
| 禁止 | 写 `IStorageService`；被 Changes / commit 路径读取；出现在 Conversation 时间线；用「verified / approved」字样 |

### 2.3 归因 sidecar（`contrib/sources/browser/sourcesReviewAttribution.ts`，新；R3）

| 项 | 选定 |
|----|------|
| 数据源 | **vscode 自有、累积观察**的 own-data，**不是** lease 快照的 `overlay.blocks`。来源 = **M6-A2 host** 产出的 `onDidFileMutation: Event<IFileMutationRecord{ sessionId, toolCallId, turnId, agentId, path, operation, diffStats? }>`（§8 增量；A1 只在接口上留事件类型，join 是产品 demux 不是传输，落 A2 host 与 attribution 同层——demux / fold 旁路，不经 session-core 类型）。contrib 不见 proto 臂名 |
| host join 规则（§8） | host 维护 session 内 `tool_call_id → { turnId, agentId }` 表（与 sidecar 同寿，随 session 切换换桶）：`ToolCallLifecycleEvent{turn_id, tool_call_id, agent_id}` 到达即写表；`tool_runtime_snapshot.payload.file_mutation_payload` 到达时查表——命中则产出**完整记录**，未命中进 **pending**，待 lifecycle 到达再产出；**禁止**产出缺 turnId 的记录再在 chip 上猜。`RuntimeOverlaySnapshotEvent.tool_runtime_snapshots` 重播种只补 path / operation，同样查表回填。**turnId settle**：lifecycle 给的是 runtimeTurnId；`TurnCompletedChange.assistant_turn_id` 到达后，该 turn 的记录 `turnId` 改写为落盘 id，使其与 `TimelineItemView.turnId` 同一 id 空间 |
| 保留 | sidecar 按 sessionId 分桶，随会话切换换桶、窗口关闭即丢；**断连不清空**（已观察到的事实，对齐 PRD-007 验收 5 快照保留）；重连后由重播种 + 表回填补齐本连接内快照；历史仍空（G-REV-1） |
| 路径匹配 | 引擎 `path` 相对 connection 快照 `workDir`（`ConnectResponse.work_dir`）；`join(workDir, path)` 与工作区根比对；不匹配 → 无 chip、不报错 |
| chip | 「Turn {n} · {agent}」。**n 在 lease 快照上算，不用产品 entries**（entries 不带 `orderKey` / `turnId`）：用 `ItemAttribution.toolCallId` 反查该工具的 `TimelineItemView.id` → 取其 `orderKey`；n = `snapshot.timeline` 中 `attribution.get(id).role === 'user'` 且 `orderKey` ≤ 该工具 `orderKey` 的项数。反查不到（历史被截 / 未 settle / stub）→ 只显示「{agent}」不显示 Turn 数，不猜；agent 名 = `attribution.agentPath` 末段，无则 `agentId`。同 path 多次 → 按 turnId 去重，最多 2 枚 + `+n` |
| 点击 chip | 命令 `conversation.revealItem({ toolCallId })`（§2.6）；**不**在 Review 里内嵌任何对话内容 |
| 无引擎 / 从未连接 | 整槽省略，无占位、无 Stub chip、无「Agent 改了 N 个文件」 |

### 2.4 「查看更改」导航行（R4；跨域）

| 项 | 选定 |
|----|------|
| 物化（幂等派生，无边沿事件） | 不依赖 `turn_lifecycle` 一次性边沿，也**不**在 connection 上另造 `onDidTurnComplete`，也**不**看 overlay（`OverlayBlockView` 无 `turnId`，「该 turn 的 overlay」不可判定）。完成信号**只**用 settle：对 sidecar 里 ① `turnId` 已被 `TurnCompletedChange.assistant_turn_id` **settle** 为落盘 id、② 有 ≥1 条可匹配当前工作区的 `IFileMutationRecord`（§2.3）、③ 当前工作区有 SCM 提供者 的 turn → **upsert** `IReviewNavRecord { sessionId, turnId, paths[] }` 进 sidecar 的 reviewNav 桶（own-data，断连保留）；迟到的 snapshot 只更新 `paths[]`（N 变、id 不变）。任一不满足 → 不存在该记录（UI-REVIEW-01：无 git / capability 则省略；work_dir 不匹配时与 chip 一致整条省略） |
| 渲染 | 第二纯函数 **`attachReviewEntries(entries, snapshot, reviewNav)`**（**不**改 `projectSnapshotToEntries` 签名；产品 entry 不带 `turnId` / `orderKey`，所以把 lease 快照一并传入，用 `entry.id === TimelineItemView.id` 读 `turnId`）：对每条 `IReviewNavRecord`，在 attach 前 entries 中**该 `turnId` 的最后一条 L2 entry（含 tool / thinking）之后**插入 `kind: 'reviewNav'`、`id: reviewNav:${turnId}` 的 entry（对齐 UI-REVIEW-01「Assistant 结果之后」，不是 assistant 正文之后）；找不到任何该 `turnId` 的 entry → 本帧不插（等下一帧）。文案「查看更改（N 个文件）」；折外；不是气泡、不是工具卡、不是 StatusBar。过程折 span 判定排除该 kind；`entriesToLegacyTurns` 丢弃该 kind |
| 帧类与触发 | 帧类判定输入是 **attach 之后**的数组：透镜对 attach 前后数组做 `diffProjections`。reviewNav **增 / 删 = 帧类 B**；**同 id 的 N / 文案变 = 帧类 A**（`rerender`，不 `setChildren`，与 stream-timeline §3.4 同 id 内容变化的合同一致）。触发点两个：① 新 ViewFrame 应用后照常 attach；② 透镜订阅 sidecar `onDidChange`，**无新帧也跑** `attach + applyEntries`（有增删走 B，仅 N 变走 A）。§3.4 的 `changedIds` 只覆盖 snapshot / overlay id，reviewNav 的 id 由 `attachReviewEntries` 自己给出 |
| 点击 | `sources.review.showForPaths(paths[])`（R4a）：`setPartHidden(false, SOURCES_PART)`（用户显式动作）→ `SourcesTabsHost.selectTab('review')`（改 public）→ 设置 Review **专用 path-set**（§2.7），不走文本 filter |
| 与 ADR-005 | 这条只打开 Sources、**不**开 Diff，与「开 Diff 不自动撑开已收起的 Sources」不是同一约束；用户随后点行才开 Diff |
| 所有权 | R4a（`contrib/sources`：命令 + path-set + `selectTab` public）；R4b（`contrib/conversation`：`attachReviewEntries` + kind + 渲染，排 stream-timeline S2 之后同工位） |

### 2.5 引擎工作目录 ≠ 本工作区

判定：connection 快照 `workDir`（来自 `ConnectResponse.work_dir`）与 `IWorkspaceContextService` 任一根不同，**或** IDE 自己在 `ConnectRequest` 里没发 `shared_fs_root`（无共享文件系统，IDE 侧已知）。此时 Review header 追加一行 note「引擎工作目录 `{workDir}` 与本工作区不同；此列表来自本地 SCM，未做归因」；chip 与「查看更改」整槽省略。**不**改用 `ReadGitChanges` 列引擎侧变更——那是另一份权威，需要新 PRD；记为 [deferred-gaps](../progress/deferred-gaps.md) 候选，不是引擎缺口。

### 2.6 `conversation.revealItem`（归 `contrib/conversation`；与 [navigator-engine-segments §2.6](navigator-engine-segments.md) 共用）

参数 `{ itemId } \| { toolCallId }`。`toolCallId → itemId` 的映射是 **vscode own-data**，**不**改 vendored `sessionView/types.ts`：M6-A2 host 在 fold 产出帧时同时看到 domain arm 的 `tool_call_id` 与 `TimelineItemView.id`，写入 `ItemAttribution.toolCallId?`（`conversationViewFrame.ts` 是 vscode 自有类型，§8 增量）——overlay 行卸挂换成 L2 项时，**新的 L2 `TimelineItemView.id` 也要写同一 `toolCallId`**，否则回合完成后 chip 点击必走静默 return；`revealItem` 在 lease `attribution` 里反查 `toolCallId` 得到 item id，再调 `revealTurn(itemId)`（`revealTurn` 按时间线 item id 索引）；查不到 → 静默 return（stub 期 id ≠ tool_call_id 即此分支）。Conversation 隐藏时先 `setPartHidden(false, CONVERSATION_PART)` + 聚焦（**复用 M5 H5 的模式**，不是调用 H5 本身）。谁先落（navigator N3 / review R3）谁建，另一方只调用。

### 2.7 Review 专用 path-set

`SourcesReviewList` 增 `setPathFilter(paths: URI[] \| undefined)`：非空时列表只显示命中 path 的行，header 显示「仅显示本回合 N 个文件 · 清除」；与文本 filter **叠加**（AND）；不改 `filterSourcesEntries` 语义（Files / Changes 不受影响，输入 `|` 行为不变）。切会话或用户点「清除」→ 置空。

### 2.8 文案改口

| 位置 | HEAD | 改为 | 何时 |
|------|------|------|------|
| `sourcesReviewListHeaderHint` | `Read-only list. Review engine not connected.` | `Read-only. Review progress is kept for this window only.`；引擎接通且有归因时追加 ` Attribution from the connected engine.`；§2.5 情形追加 note | R2 |
| PRD-005 用户陈述 | 「面板顶有说明该面只读、review 引擎未接线」 | 「面板顶有说明该面只读；审阅进度与归因见 PRD-023」 | **签收批**（规则 10a） |
| [systems/sources/overview.md](../../docs/systems/sources/overview.md) | 「评审能力依赖 PRD-008」 | 「Review 是只导航面；审阅进度本地；归因依赖 PRD-008」 | R2 |
| [companion-contribs §5](../../docs/systems/workbench/companion-contribs.md) | 「实施方案待写」 | 对齐 ADR-005 已落地 + Review 无写操作 | R2 |

## 3. 切片与硬依赖

| 切片 | 做什么 | 硬依赖 | 测试 / Exit |
|------|--------|--------|-------------|
| **R1 审阅进度** **已落** @ `05007b60` | `ISourcesReviewProgressService` + 键 / etag 失效 / rename 清理 + 行 ● / ○ + 两行行高与 a11y + 三个标记动作 + 「已审阅 x / y」+「仅未审阅」toggle + Review `onDidOpen` 成功后自动标记 | 无（HEAD 三参数调用点已在；可立即开） | 新 `sourcesReviewProgress.test.ts`：同 key 幂等；etag 变 → 失效；repo 不同互不影响；stat 失败 etag `''`；资源消失清键；`IStorageService` import 扫描 + 运行时 mock 零调用。新 `sourcesReviewList.test.ts`：行状态 / 计数 / toggle；Review 打开成功才标记、失败不标；Changes 打开不标 |
| **R2 文案与知识层改口** **已落** @ `05007b60` | §2.8 三处（PRD-005 除外） | 无（可与 R1 并行） | strings 单测更新；`check-docs-health` 0 warning |
| **R4a Sources 命令 + path-set** **已落** @ `05007b60` | `sources.review.showForPaths`；`selectTab` public；§2.7 path-set；新 `sourcesReview.contribution.ts`（**不**塞进 `sources.contribution.ts`） | 无硬依赖（建议与 R1 同工位，不阻塞；无引擎可开） | 命令单测：Sources 隐藏时被显示；tab 切到 review；path-set 生效且与文本 filter AND；「清除」置空；Files / Changes filter 行为不变 |
| **R3 归因 sidecar** **已落** @ `c7091b8e` | 消费 `onDidFileMutation` → 分桶 sidecar；chip 渲染 + Turn n 算法；work_dir 匹配；断连保留；`conversation.revealItem`（若 navigator N3 未建） | M6-A2 含 §8 增量（host join 表 + pending + settle + 重播种回填 + `ItemAttribution.toolCallId`）；S1 lease | 新 `sourcesReviewAttribution.test.ts`：fixture 事件 + fake lease 快照 → chip 数 / 去重 / `+n` / Turn n = 快照中 `role==='user'` 且 orderKey ≤ 工具项的条数 / `toolCallId` 反查不到时只显 agent；work_dir 不同 → 零 chip；断连 → chip 保留、列表不变；从未连接 → 零 chip；`revealItem` 经 attribution 反查、查不到静默 |
| **R4b 「查看更改」行** **已落** @ `f1065288` | reviewNav 幂等物化（settle 信号）+ `attachReviewEntries(entries, snapshot, reviewNav)` + `'reviewNav'` kind + 透镜订阅 sidecar `onDidChange` + 帧类 B / A + 调 R4a | R3 + stream-timeline **S2**（`applyEntries` / `diffProjections` 与 contrib 侧 kind 存在）| 新 `conversationReviewEntry.test.ts`：无 mutation → 无行；无 SCM → 无行；work_dir 不匹配 → 无行；**未 settle → 无行，`turn_completed` 后出现**；迟到 snapshot → N 递增、id 不变、判为帧类 A；新增 / 删除 → 帧类 B；插入点在该 turn 最后一条 L2 entry（含 tool）之后；该 turn 尚无 entry → 本帧不插；无新帧只有 sidecar 变化也重渲染；过程折不吞该 kind；`entriesToLegacyTurns` 丢弃该 kind；断连后行保留 |
| **R5 验收 + 知识层** | §4 V-R1–V-R6；§7 知识层；engine-protocol-surface §1 / §4 回填 | R1–R4 | 证据目录；0 warning |

冲突域：R1 / R2 / R4a 只改 `sourcesReviewList.ts`、`sourcesReviewListStrings.ts`、`sourcesTabsHost.ts`（`selectTab` 可见性）与新文件；**不改** `sourcesChangeEntryOpen.ts` / `sourcesChangesList.ts` / `sourcesChangesModel.ts` / Diff input / Panel 视图 / `sources.contribution.ts`。R3 只读 connection 接口。R4b 改 `contrib/conversation`，须在 S2 之后由同工位做。

## 4. 验收（产品语言；勿提前勾）

| ID | 场景 | 通过标准 |
|----|------|----------|
| V-R1 | 无引擎、git 仓库 3 个变更 | Review 三行全 ●，header「已审阅 0 / 3」；点第一行 → Diff 出现在当前 `sources.diff.defaultOwner` 宿主（默认 Preview），回到 Review 该行 ○，计数 1 / 3；改动该文件保存 → 行回 ●，计数 0 / 3；从 Changes 点同一行 → 审阅态不变 |
| V-R2 | 重载窗口 | 审阅进度全部回 ●（不落盘）；无「已同步」类文案 |
| V-R3 | 「仅未审阅」toggle | 列表只剩 ● 行；清 toggle 恢复；Changes / Files tab 不受影响 |
| V-R4a | 引擎接通，Agent 一轮改 2 文件 | 两行出现「Turn n · agent」chip（n = 会话视图中排在该工具之前（含）的用户回合数）；点 chip → Conversation 高亮对应工具行（Conversation 隐藏时先显示）；回合完成、overlay 卸挂后点 chip 仍能定位 |
| V-R4b | 同上 | 该回合下方出现「查看更改（2 个文件）」，点击 → Sources 显示、Review tab、只显示这 2 个文件 + 「清除」 |
| V-R5 | 引擎 work_dir ≠ 工作区 | header 出现 note；无 chip；无「查看更改」；列表与 Changes 一致 |
| V-R6 | 已连接后拔掉引擎 | 已出现的 chip 与「查看更改」行**保留**，点击仍可用（本地 SCM）；不再新增；审阅进度不变；无假归因、无「已同步」 |

## 5. 风险

| 风险 | 缓解 |
|------|------|
| etag 只是 mtime+size 代理 | 键合同写明「工作区可见内容变」语义；V-R1 保存路径覆盖 |
| 审阅进度被误当「已验证」 | 文案只用「已审阅 / 未审阅」；PRD-023 验收 2 |
| sidecar 与 Conversation 过程折重复建第二份工具模型 | sidecar 只存 `IFileMutationRecord` 与 reviewNav，不存工具正文；reveal 回到 Conversation 的同一 item |
| G-REV-1 不补 → 历史会话零归因 | header 不写总数；chip 缺席时不写占位；重播种覆盖本连接 |
| R4b 挤进 stream-timeline 冲突域 | 第二纯函数附加，排 S2 之后同工位 |
| `turnId` → Turn n 解析依赖 entries 完整 | 解析不到只显 agent，不猜序号 |

## 6. 协议缺口与非缺口（回填 engine-protocol-surface §4）

| ID | 项 | 结论 |
|----|----|------|
| **G-REV-1** | 持久化历史里没有归一化的 `file_mutation` 载荷（`ToolRuntimeSnapshotProto` 是 L3 不落库；L2 `ToolCallBlock` 的 path 藏在工具专有 `arguments_json`，禁止当 admitted correlation 解析） | 引擎缺口：`GetHistory` 工具项带 `file_mutation_payload` 或 `DetailRef(kind=DIFF)`；未补前归因仅限本连接（含重播种） |
| — | review comment / approve RPC | **不是缺口**：ADR-043 明确不做 |
| — | `GitService.ReadGitChanges / ReadGitFileDiff` | 已存在；v1 不消费（§2.5），留给「远程引擎变更列表」新 PRD |

缺口 ID 带 `REV` 前缀，避免与 stream-timeline G1–G5、navigator G-NAV-* 撞名。

## 7. 知识层落点（R2 / R5，不在本稿）

- [systems/sources/overview.md](../../docs/systems/sources/overview.md)：Review 行改「只导航 + 审阅进度（窗口内存）+ 归因装饰 + path-set」；§「Review 引擎」删。
- [companion-contribs §5](../../docs/systems/workbench/companion-contribs.md)：对齐 ADR-005 已落地；加「Review 无写操作；审阅进度不入 SCM」。sources-changes-diff **F5** 也改此节，两者错开（后落者合并前者措辞）。
- [engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md)：§1 加 `tool_runtime_snapshot.file_mutation_payload` + `ToolCallLifecycleEvent` join（host 消费）；§4 加 G-REV-1。
- [traceability](../../docs/product/traceability.md) PRD-023 行；PRD-005 行加「Review 语义见 PRD-023」（签收批）。

## 8. 对 m6-engine-wave 的增量修订（随本稿同批签收）

| m6 位置 | 增量 |
|---------|------|
| §8 M6-A1 `IUniverseAgentConnection` | **只**在接口上留事件类型 `onDidFileMutation: Event<IFileMutationRecord{ sessionId, toolCallId, turnId, agentId, path, operation, diffStats? }>`（A1「不自建投影」不变，A1 不实现 join；A1 阶段该事件实现为 `Event.None`，**禁止**把未 join 的 L3 snapshot 当 `IFileMutationRecord` 发出）；connection 快照暴露 `workDir` 与「本次 Connect 是否发送了 `shared_fs_root`」 |
| §8 M6-A2 host（demux / fold 旁路，与 attribution 同层，不经 session-core 类型） | ① session 内 `tool_call_id → { turnId, agentId }` 表：`ToolCallLifecycleEvent` 写表；② `tool_runtime_snapshot.payload.file_mutation_payload` 查表产出记录，未命中进 pending；③ `RuntimeOverlaySnapshotEvent.tool_runtime_snapshots` 重播种只补 path / operation、查表回填、去重；④ `TurnCompletedChange.assistant_turn_id` 到达后把该 turn 记录的 `turnId` settle 为落盘 id；⑤ fold 产出帧时写 `ItemAttribution.toolCallId?`（`conversationViewFrame.ts`，vscode 类型；**不改** `sessionView/types.ts`） |
| §8 M6-A2 验证 | 加：fake 流推 lifecycle + snapshot → 一条记录含 turnId / agentId；先 snapshot 后 lifecycle → 先 pending 再产出；`turn_completed` 后 turnId 变为 `assistant_turn_id`；重播种不重复；帧 attribution 带 `toolCallId` |

## 相关

- [sources-changes-diff](sources-changes-diff.md) · [ADR-005](../decisions/005-changes-diff-owner.md) · [conversation-stream-timeline](conversation-stream-timeline.md) · [conversation-trajectory-lens](conversation-trajectory-lens.md) · [navigator-engine-segments](navigator-engine-segments.md)（共用 `conversation.revealItem`）
- 外仓：Desktop ADR-043 · ui-interaction-spec UI-INV-09 / UI-REVIEW-01 · UniverseAgent `message_envelope.proto` / `git_service.proto` / `common.proto`

## 审查记录（规则 16）

**2026-09-02 第一轮：** Cursor CLI `cursor-grok-4.6-high`（`--mode ask` 只读）。**Approve with changes**（4 Critical + 7 Important + 7 Minor）。处理：

| 意见 | 处理 |
|------|------|
| C1 §1 写的是工作树而非 HEAD（F1–F3 已合入） | §1 按 `git show HEAD:` 重写；冲突域点名 `sourcesReviewList.ts` vs `sourcesChangeEntryOpen.ts`；V-R1 改「按 defaultOwner」；R4a 另开 `sourcesReview.contribution.ts`；文首加基线句 |
| C2 归因源不在 lease overlay；`turnId` 不在 snapshot 上 | §2.3 改为消费 A2 demux 的 `onDidFileMutation`（join `ToolCallLifecycleEvent`），§8 增量修订 m6；Turn n 算法写明；断连 / 重连 / 重开区分 |
| C3 `\|` filter 与 `filterSourcesEntries` 冲突；`selectTab` private | **选定 A**：Review 专用 path-set（§2.7），不改文本 filter；`selectTab` 改 public 列入 R4a |
| C4 断连后「查看更改」与 sidecar 清空互斥 | §2.4 物化 `IReviewNavRecord` own-data、断连保留；状态机进 PRD-023 验收 3；第二纯函数 `attachReviewEntries`；V-R6 改写 |
| I1 PRD-005 改口属签收批 | 移出 R2；文首与 §2.8 标「签收批」；PRD-023 依赖段改按验收编号 |
| I2 写明本仓分叉（进度在 Review 不在 Changes） | 文首「本仓分叉」句；INV-DISP-3 进非目标 |
| I3 etag 语义 / rename / rootUri 反查 | §2.2 重写键合同；删同义反复回退句 |
| I4 G3 撞名；reveal 命令不存在 | 缺口改 `G-REV-1`；§2.6 新命令 `conversation.revealItem` 与 navigator 共用；禁止解析 `arguments_json` |
| I5 work_dir 不匹配时「查看更改」仍出现；`shared_fs_root` 在 Request | §2.4 出现条件加匹配；§2.5 判定改从 IDE 已知的请求字段读 |
| I6 依赖 | §3 重写：R1 / R2 / R4a 无引擎可开；R3 依赖 `onDidFileMutation`；R4b 依赖 S2 |
| I7 验收 | V-R4 拆 a / b；V-R1 去写死 Preview |
| Minor（行高、同 uri 共享、storage 负向测、成功后标记、缺口前缀、companion-contribs、Changes 不标） | 全部改入 §2.1 / §2.2 / §0 / §3 / §6 / §7 |

**2026-09-02 第二轮：** 同一 reviewer 配置。**Approve with changes**（2 Critical + 4 Important + 3 Minor）。处理：

| 意见 | 处理 |
|------|------|
| C1 `toolCallId` 写进 vendored session-core 类型 | 删「S4 `TimelineItemView` 带 `toolCallId`」；映射改为 A2 host 在 fold 时写 `ItemAttribution.toolCallId?`（vscode 类型）；`revealItem` 经 attribution 反查 |
| C2 reviewNav 与 stream-timeline §3.3 / §3.4 不自洽 | §2.4 重写：插入点 = 该 turn 最后一条 entry 之后、id `reviewNav:${turnId}`；帧类判定用 attach 后数组；透镜订阅 sidecar `onDidChange` 无帧也 apply；物化改幂等派生，不造 `onDidTurnComplete`；host 用 `assistant_turn_id` settle turnId |
| I1 Turn n 对 `kind:'user'` 永远 fallback | n = orderKey 不大于该工具项的 user entry 条数 |
| I2 §1 Conversation 行又是工作树 | 改为「合同 = stream-timeline；HEAD 只有 vendor + frame 类型」 |
| I3 重播种 join 缺规则 | §2.3 / §8：session 内 `tool_call_id → {turnId, agentId}` 表 + pending，禁止缺 turnId 的记录 |
| I4 join 挂 A1 与「不自建投影」打架 | A1 只留事件类型；join / settle / 重播种全在 A2 host |
| Minor（R4a 依赖过严、F5 同改 companion-contribs、`revealTurn` 按 item id） | R4a 改无硬依赖；§7 注明与 F5 错开；§2.6 写明 item id |

**2026-09-02 第三轮：** 同一 reviewer 配置。**Approve with changes，无 Critical**（3 Important + 4 Minor；reviewer 注明改入后可签收、不必第四轮）。处理：

| 意见 | 处理 |
|------|------|
| I1 Turn n / 插入点写在产品 entries 的 `orderKey` / `turnId` 上，而 entries 没有这两字段 | Turn n 改在 lease 快照上算（`toolCallId` 反查 item → `orderKey`，数 `role==='user'`）；`attachReviewEntries` 签名改 `(entries, snapshot, reviewNav)`，用 `entry.id === TimelineItemView.id` 读 `turnId` |
| I2 「该 turn 已无 live overlay」不可判定 | 物化完成信号只用 settle；删 overlay 句；R4b 测试改「未 settle 无行 / `turn_completed` 后出现」 |
| I3 N 变一律帧类 B 与 §3.4 类 A 冲突 | 增删 = B，同 id N / 文案变 = A |
| Minor（frontmatter、`Promise<void>` 无成功布尔、L2 新 id 也写 `toolCallId`、A1 `Event.None`） | 全部改入 |

**签收：** 2026-09-02，用户授权「用 Cursor CLI Grok 审查、架构由本会话裁定」。三轮意见全部核验属实并改入；`status: accepted`。同批：PRD-023 `proposed → accepted`；PRD-005 用户陈述改口；traceability PRD-005 / 023 行；m6 §8 按本稿 §8 修订（记入 m6 增量修订节）。
