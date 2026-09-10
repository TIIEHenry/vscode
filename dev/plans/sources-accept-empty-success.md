---
title: "Sources Accept：空载荷宿主拒送（产品切片）"
type: plan
status: draft
phase: N/A
updated: 2026-09-10
summary: "R8/ADR-008 之后：A1 宿主拒空已落；D196 空串/空白 patches 亦拒送。P5 停线已裁定：A2 仍 blocked，须新选定 + 独立 Arch-First。D31 F4 仍开。"
---

# Sources Accept：空载荷宿主拒送

> **slice_id**：`accept-empty-success-plan`  
> **冲突域**：sources-git Accept payload  
> **引擎语义不重审**：[ADR-008](../decisions/008-write-git-apply-hunks-empty.md) 已裁定空 `patches` = 成功空操作。本稿只定**产品** Accept 切片。  
> **A1 已实施**（工位 D `accept-refuse-empty`）。不发明 proto / hunk。不跑 F4。不占 D26。不做 D22/F3。不改引擎。**A2 仍 blocked**。  
> **审查**：`draft`。独立审查 [bfc9d2ed](bfc9d2ed-e75b-4706-b142-d2e10fcbcc77) **Approve with changes：只批准 P5 停线，不批准 A2**。must-fix 已并入。主笔不自宣 Approve。整案不标 `accepted`。A2 须**新**选定设计 + **新**独立 Arch-First，不得因本裁定自动解锁。

## Problem class

- **症状**：Review / Panel Accept 点下去会调 `tryWriteSourcesGitApplyHunks`，默认 `{ sessionId: '', argv: [], patches: [] }`。空 `sessionId` 在引擎 `writeGitApplyHunks` 入口被 `INVALID_ARGUMENT`（`session_id is required`）挡在 apply 之前；若日后只补非空 `sessionId`、仍空 `patches`，引擎回 `supported:true` + `success:true`，宿主 `isSourcesGitWriteAccepted` 会当已接受（假 Accept）。A1 已堵住空送。A2 要同刀送真 `sessionId` + `patches`，但现有读面没有 apply stdin。
- **类标签**：产品载荷门控缺失（session 与 patches 被拆开修）+ 读/写载荷形状不匹配（展示用 `unified_diff` ≠ 已证明的 apply stdin）。
- **复发机制**：把「补 sessionId」「补 path」或「已有 `unified_diff` 字段」当成独立小修，忽略空 `patches` 已是成功空操作，或把对照串冒充 `git apply` stdin。
- **防复发**：缺任一侧就不得调 RPC。本裁定**只批准停线**。禁止只接线 session。禁止把 `unified_diff`（已缓存或再拉）或 parse/monaco 还原两侧当成 `patches`。A2 不得自动解锁。

## 代码基线（工位 D `4fdfd20b643`，A1 已合入）

| 证据 | 事实 |
|:-----|:-----|
| `sourcesChangesGitWrite.ts` L35–37 / L69–78 / L218–231 | `hasSourcesGitApplyHunksPayload`：空 session **或** 无 `trim()` 非空 patch 不调 hook。`['']` / `['  ']` 不算载荷（[D196](../progress/deferred-gaps.md) 已闭） |
| `conversationDiffReviewPane.ts` L252–255 / `sourcesDiffPanelView.ts` L348–351 | `runAccept` **不传** session / argv / patches；无 roster 注入 |
| `isSourcesGitWriteAccepted` | 只认 `supported && success`，不看请求是否空（拒空发生在发 RPC 前） |
| 引擎 `GitWorkDirWriter.kt` L77–78 / L80–82（ADR-008，只读） | 空 `patches` → `success = true` 不跑 `git apply`；空 argv 仅在 patches 非空时拒写 |
| `parseSourcesGitUnifiedDiff` L152–195 | 只还原对照两侧；丢掉 `diff` / `---` / `+++` / `@@` 头；**不是** apply stdin 抽取器 |
| `IConversationRosterService.getActiveSessionId` | Attribution 已用（`sourcesReviewAttributionService.ts` L55）；Accept 两 pane **未**注入 |

A1 之后空 Accept 走 `fallback` → 有 SCM 则 `git.stage`。土地雷仍是「只补 session、不补 patches」。

## 读面盘点（A2 patches 来源；禁止发明）

| 表面 | 已有 | 没有 | 证据 |
|:-----|:-----|:-----|:-----|
| `ReadGitChanges` 行 | `path` / `oldPath` / `kind` / `indexState` | `unified_diff`、`patches`、`argv` | `universeAgentTypes.ts` L2020–2025；`sourcesChangesGitRead.ts` L128–138 |
| Changes / Review 列表项 | `gitPath` / `indexState` | 不缓存 diff 正文 | `sourcesChangesModel.ts` L11–20；`sourcesChangesGitRead.test.ts` L252（FileDiff 仅打开时） |
| `ReadGitFileDiff` 响应 | `path` + `unifiedDiff` | 不是 `patches[]`；协议行与 Apply **≠** | `universeAgentTypes.ts` L2047–2052；`engine-protocol-surface.md` L129 / L132 |
| 打开 diff | 取回后立刻 `parse` 成两侧模型，**丢弃原串** | Accept 时手上无 `unified_diff` | `sourcesChangeEntryOpen.ts` L72–88 |
| Review Input | `modified` / `original` URI + `groupId` | 无 session、无 patches | `browser/conversationDiffReviewInput.ts` L26–44 |
| Panel 选中 | `getWriteContext()` 有本地 `path` | `runAccept` 不用 path 填 apply | `sourcesDiffPanelView.ts` L241–256、L340–351 |
| Attribution / mutation | `sessionId` + `path` + `diffStats` | 无 hunk / 无 diff 正文 | `sourcesReviewAttribution.ts` L14–26 |
| roster `getActiveSessionId()` | 非空会话候选（已存在） | Accept 未接线 | `conversationStubService.ts` L63、L303–304 |
| `WriteGitApplyHunks` 请求 | `sessionId` / `argv` / `patches[]` | 本仓无 proto 注释说 `patches` = `unified_diff` | `universeAgentTypes.ts` L2093–2104；connection L1366–1367 |
| Stage `argv` | 每 path 一条 `{ argv: [path] }` | 另一 RPC（`WriteGitStagePaths`），不是 apply 载荷 | `sourcesChangesGitWrite.ts` L41–48 |

本仓 **无** `git_service.proto`。传输测夹具里 `unifiedDiff` 与 `patches` 曾用同一 `diff --git …` 字面量，只证明原样上线，**不**证明引擎 apply stdin 与读面同形。

## Options（A1 产品门，已裁定）

| 选项 | 含义 | 拒绝 / 采纳 |
|:-----|:-----|:------------|
| **A 宿主拒空 Accept** | session 为空 **或** patches 为空：不调 `WriteGitApplyHunks`，不当 accepted；走既有 fallback（有 SCM → `git.stage`；否则诚实「不可用」） | **选定（已落）。** 不发明 hunk；堵住「只补 sessionId」假 Accept |
| B 本刀改传真 path / hunks | Accept 送真实 session + argv + patches | **拒绝（A1 刀）。** 当时无既有 apply 载荷源；禁止发明 hunk |
| C 继续空送并只记残留风险 | 保持 `{ sessionId:'', argv:[], patches:[] }` | **拒绝。** ADR-008 已拒绝把空成功当产品 Accept |

## Options（A2 patches 来源；本轮草案）

| 选项 | 含义 | 拒绝 / 采纳 |
|:-----|:-----|:------------|
| **P1 把已取回的 `unified_diff` 原串当作 `patches`** | 假设读面 unified diff = 引擎 `git apply` stdin | **拒绝。** 打开后原串已丢（`sourcesChangeEntryOpen.ts` L77–88）；本仓合同未写二者同形（两 RPC 标 ≠）；`parseSourcesGitUnifiedDiff` 拆掉头，不能还原 apply stdin。有本地 original 时根本不调 FileDiff（`needsSourcesGitFileDiff`）。把对照串当 patches = 发明映射 |
| **P2 只送 path（argv）+ 空 patches** | 靠 path 让引擎 apply-all | **拒绝。** A1 / ADR-008：空 `patches` = 成功空操作；A1 会拒送。等于假 Accept |
| **P3 等新引擎字段 / 新 proto** | 等单独 hunk 列表或 apply 专用 RPC | **拒绝（本切片）。** 禁止发明 proto |
| **P4 从 monaco / parse 两侧拼 hunk** | 用 original/modified 文本生成 apply stdin | **拒绝。** 本仓无抽取器；拼默认 hunk = 发明 |
| **P5 保持 A1 拒空（停线）** | A2 不开；缺源记 D31 | **选定。** 本裁定只批准停线。现有读面没有非发明的 `patches`。禁止只接 session。A2 须另写选定 + 独立 Arch-First |

## 选定设计

**产品选项 A（A1，已落）：宿主拒空 Accept。**

1. 谓词：`sessionId !== ''` **且** 至少一条 `trim()` 非空 patch 才允许发 RPC。缺一侧 → `tryWriteSourcesGitApplyHunks` 不调 hook、回 `undefined` → `attemptSourcesGitWrite` 走 `fallback`。`['']` / `['  ']` 不算载荷（[D196](../progress/deferred-gaps.md)）。
2. **P5 停线（本轮只批准这一条）**：**A2 仍 blocked。** 独立审查只批准停线，不批准 A2 实施。现有读面没有非发明的 apply stdin。**禁止**只接线 session。**禁止**把 `unified_diff`（已缓存或再拉的 `ReadGitFileDiff`）或 parse/monaco 还原两侧当成 `patches`。**禁止**把 Stage `{ argv: [path] }` 映射到 Apply。A2 须**新**选定设计 + **新**独立 Arch-First；本裁定不是解锁条件。缺源记 [D31](../progress/deferred-gaps.md) leftover。
3. `isSourcesGitWriteAccepted` 的 `supported && success` 口径可留；拒空发生在发 RPC 之前，空 no-op 进不了 accepted。
4. Stage / Commit 空 `sessionId` **不在本切片**（仍按既有合同空送）。
5. 不改引擎、不跑 F4、不升 PRD-009/023。不实施 A2。

## 不变量

- 禁止发明 proto 字段或默认 hunk。
- 禁止只补 `sessionId`（或只补 path）就发 `WriteGitApplyHunks`。
- 禁止把空请求的 `supported && success` 读成「用户已接受全部 hunk」。
- 禁止把 `unified_diff`（已缓存或再拉）或 `parseSourcesGitUnifiedDiff` / monaco 两侧当成 `patches`。
- 禁止把 Stage `{ argv: [path] }` 映射到 `WriteGitApplyHunks.argv` / `patches`。
- 禁止把 Q1–Q3 的任何答案当成 A2 实施许可。
- 禁止本方案实施刀改引擎仓。
- `catch (INVALID_ARGUMENT)` 不得继续充当「空 Accept 已处理」的产品语义。

## 切片

| Slice | Goal | Files / Modules | Tests | Exit Condition |
|:------|:-----|:----------------|:------|:---------------|
| **A1** | 宿主拒空：空 session 或空 patches 不调 RPC | `sourcesChangesGitWrite.ts`；pane 走 `attempt` fallback | `sourcesChangesGitWrite.test.ts`：空载荷 0 次 hook；两侧皆非空才原样上线 | **已落**（工位 D）：空 Accept 不发 unary；`undefined` → `runAccept` `git.stage`；不发明 hunk。Pane 调用未改（默认空 → 拒送） |
| **A2** | session + patches 同刀真 apply | 同上 + roster session；**patches 须有非发明来源** | 两侧缺一仍 0 次 hook；完整载荷才 accepted | **仍 blocked。** 本裁定不是 A2 实施许可。须另写选定设计 + 独立 Arch-First。禁止只改一侧；禁止用 P1–P4 或再拉 `unified_diff` / Stage argv 冒充来源 |

A1 已实施。P5 停线：A2 不实施，不占本刀。

## D31 仍开（F4 + P5 停线）

[D31](../progress/deferred-gaps.md) **不闭**。本方案 A1 已落；P5 停线；A2 **仍 blocked**（须新选定 + 新 Arch-First，不是「出现载荷就自动开」）。D31 仍欠 [sources-changes-diff](sources-changes-diff.md) **F4** V-F1–V-F7 隔离 profile 证据目录。本刀不跑 F4、不升 PRD。

## 非目标

- 不改引擎 `GitWorkDirWriter` / proto
- 不发明 `WriteGitUnstage` / 新 hunk 字段
- 不改 Stage / Commit 空 session 合同
- 不做 D22/F3、不占 D26
- 不把本文件标 `accepted`（只批准 P5 停线；A2 须新选定 + 新 Arch-First）
- 不实施 A2 代码

## 开放问题（答任何一题都不是 A2 实施许可）

1. 引擎仓 `WriteGitApplyHunks.patches` 是否与 `ReadGitFileDiff.unified_diff` **同一字符串**（`git apply` stdin）？本仓无 proto。即便答「是」，也**不是** A2 实施许可。**禁止**把再拉的 `unified_diff` 映射到 Apply `patches`。
2. Accept 时再拉 FileDiff 算不算合法读面？有本地 original 的行根本不拉。即便答「算」，也**不是** A2 实施许可。**禁止**把再拉的 `unified_diff` 映射到 Apply。
3. 非空 `patches` 时引擎还要非空 `argv`（ADR-008）。argv 用 path 是否已有合同？即便有合同句，也**不是** A2 实施许可。**禁止**把 Stage `{ argv: [path] }` 映射到 Apply。

## 相关

- [ADR-008](../decisions/008-write-git-apply-hunks-empty.md) · [D31](../progress/deferred-gaps.md) · [R8](../progress/research-queue.md)（已闭）
- [engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md) `WriteGitApplyHunks`（传输仍原样上线；产品拒空是宿主门，不是传输发明）
