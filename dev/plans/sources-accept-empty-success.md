---
title: "Sources Accept：空载荷宿主拒送（产品切片）"
type: plan
status: draft
phase: N/A
updated: 2026-09-07
summary: "R8/ADR-008 之后：Accept 空 session + 空 patches 宿主拒调 RPC，不当 accepted。真 path/hunks 须与 session 同刀。D31 F4 仍开。待 Architecture-First。"
---

# Sources Accept：空载荷宿主拒送

> **slice_id**：`accept-empty-success-plan`  
> **冲突域**：sources-git Accept payload  
> **引擎语义不重审**：[ADR-008](../decisions/008-write-git-apply-hunks-empty.md) 已裁定空 `patches` = 成功空操作。本稿只定**产品** Accept 切片。  
> **本刀不实施**。不发明 proto / hunk。不跑 F4。不占 D26。不做 D22/F3。不改引擎。  
> **审查**：`draft`。主笔不自批；下一步独立 Architecture-First。未 Approve 不得标 `accepted`。

## Problem class

- **症状**：Review / Panel Accept 点下去会调 `tryWriteSourcesGitApplyHunks`，默认 `{ sessionId: '', argv: [], patches: [] }`。空 `sessionId` 在引擎 `writeGitApplyHunks` 入口被 `INVALID_ARGUMENT`（`session_id is required`）挡在 apply 之前；若日后只补非空 `sessionId`、仍空 `patches`，引擎回 `supported:true` + `success:true`，宿主 `isSourcesGitWriteAccepted` 会当已接受（假 Accept）。
- **类标签**：产品载荷门控缺失（session 与 patches 被拆开修）。
- **复发机制**：把「补 sessionId」或「补 path」当成独立小修，忽略空 `patches` 已是成功空操作。
- **防复发**：下一刀必须 **session 与 patches 一起**处理；缺任一侧就不得调 RPC，也不得标 accepted。

## 代码基线（`e5c4b95993da`）

| 证据 | 事实 |
|:-----|:-----|
| `sourcesChangesGitWrite.ts` `sourcesGitApplyHunksRequest` | 写死 `sessionId: ''`；`argv` / `patches` 默认 `[]` |
| 同上 `tryWriteSourcesGitApplyHunks` | 接通 + hook 即发；默认空载荷 |
| 同上 `isSourcesGitWriteAccepted` | 只认 `supported && success`，不看请求是否空 |
| `conversationDiffReviewPane.ts` / `sourcesDiffPanelView.ts` `runAccept` | 不传 argv / patches；`accepted` 直接 return；`catch` 只 `showNotice`，**不**落到本地 `git.stage` |
| 引擎 `GitGrpcService.kt` L144–145 | 空 `sessionId` → `INVALID_ARGUMENT`，不到 `applyHunkPatches` |
| 引擎 `GitWorkDirWriter.kt` L77–78 / L80–82 | 空 `patches` → `success = true` 不跑 `git apply`；空 argv 仅在 patches 非空时拒写 |
| Sources 无 WriteGitApplyHunks 的 hunk 抽取器 | `parseSourcesGitUnifiedDiff` 只还原对照两侧，不是 apply stdin |
| `IConversationRosterService.getActiveSessionId` | Attribution 已用；Accept 两 pane **未**注入 roster |

今日空送因空白 `sessionId` 先被 INVALID_ARGUMENT 挡住，**尚未**走到假 Accept；土地雷是「只补 session、不补 patches」。

## Options

| 选项 | 含义 | 拒绝 / 采纳 |
|:-----|:-----|:------------|
| **A 宿主拒空 Accept** | session 为空 **或** patches 为空：不调 `WriteGitApplyHunks`，不当 accepted；走既有 fallback（有 SCM → `git.stage`；否则诚实「不可用」） | **选定。** 不发明 hunk；堵住「只补 sessionId」假 Accept；把今日 catch 里的 INVALID_ARGUMENT 提示改成可落地的本地 stage |
| B 本刀改传真 path / hunks | Accept 送真实 session + argv + patches | **拒绝（本刀）。** 无既有 apply 载荷源；禁止发明 hunk；只送 path / 只送 session 仍会空 patches no-op |
| C 继续空送并只记残留风险 | 保持 `{ sessionId:'', argv:[], patches:[] }` | **拒绝。** 空白 session 只是碰巧 INVALID_ARGUMENT；下一处「补 sessionId」即假 Accept。ADR-008 已拒绝把空成功当产品 Accept |

## 选定设计

**产品选项 A：宿主拒空 Accept。**

1. 新增（或等价）谓词：`sessionId !== ''` **且** `patches.length > 0` 才允许发 RPC。缺一侧 → `tryWriteSourcesGitApplyHunks` 不调 hook、回 `undefined` → `attemptSourcesGitWrite` 走 `fallback`。
2. 真 apply 是**后续刀**：必须同时有非空 session **与** 非空 patches（patches 非空时引擎还要非空 argv）。session 候选 = roster `getActiveSessionId()`（已存在，Accept 未接）。patches 候选须来自已有读面（例如已取回的 `unified_diff`），**禁止**本仓拼默认 hunk / 发明 proto 字段。
3. `isSourcesGitWriteAccepted` 的 `supported && success` 口径可留；拒空发生在发 RPC 之前，空 no-op 进不了 accepted。
4. Stage / Commit 空 `sessionId` **不在本切片**（仍按既有合同空送）。
5. 不改引擎、不跑 F4、不升 PRD-009/023。

## 不变量

- 禁止发明 proto 字段或默认 hunk。
- 禁止只补 `sessionId`（或只补 path）就发 `WriteGitApplyHunks`。
- 禁止把空请求的 `supported && success` 读成「用户已接受全部 hunk」。
- 禁止本方案实施刀改引擎仓。
- `catch (INVALID_ARGUMENT)` 不得继续充当「空 Accept 已处理」的产品语义。

## 切片

| Slice | Goal | Files / Modules | Tests | Exit Condition |
|:------|:-----|:----------------|:------|:---------------|
| **A1** | 宿主拒空：空 session 或空 patches 不调 RPC | `sourcesChangesGitWrite.ts`；`conversationDiffReviewPane.ts` / `sourcesDiffPanelView.ts` 仅当需把 fallback 从 catch 纠到 `attempt` | `sourcesChangesGitWrite.test.ts`：空载荷 0 次 hook；两侧皆非空才原样上线；`attempt` → `fallback` | 空 Accept 不发 unary；有 SCM 落到 `git.stage`；无 SCM 诚实不可用；不发明 hunk |
| **A2** | （后续，非本方案实施）session + patches 同刀真 apply | 同上 + roster session；patches 须有非发明来源 | 两侧缺一仍 0 次 hook；完整载荷才 accepted | 有证据的 session 与 patches **同时**上线；禁止只改一侧 |

A1 是下一实施刀。A2 等 patches 来源裁定后再开，不占本刀。

## D31 仍开（F4）

[D31](../progress/deferred-gaps.md) **不闭**。本方案只裁定 Accept 产品选项。D31 仍欠 [sources-changes-diff](sources-changes-diff.md) **F4** V-F1–V-F7 隔离 profile 证据目录。本刀不跑 F4、不升 PRD。

## 非目标

- 不改引擎 `GitWorkDirWriter` / proto
- 不发明 `WriteGitUnstage` / 新 hunk 字段
- 不改 Stage / Commit 空 session 合同
- 不做 D22/F3、不占 D26
- 不把本文件标 `accepted`（须独立 Architecture-First）

## 相关

- [ADR-008](../decisions/008-write-git-apply-hunks-empty.md) · [D31](../progress/deferred-gaps.md) · [R8](../progress/research-queue.md)（已闭）
- [engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md) `WriteGitApplyHunks`（传输仍原样上线；产品拒空是宿主门，不是传输发明）
