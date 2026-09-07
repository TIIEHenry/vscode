---
title: "ADR-008 WriteGitApplyHunks 空 argv / patches：引擎为成功空操作"
type: decision
status: accepted
phase: N/A
updated: 2026-09-07
summary: "R8 已闭。引擎仓 GitWorkDirWriter.applyHunkPatches 空 patches 直接 success、不跑 git apply；RPC 成功路径 supported:true。选定语义 = 成功空操作。Sources Accept 本刀仍空送。D31 F4 未跑。"
---

# ADR-008 WriteGitApplyHunks 空 argv / patches

> 本文件是 [R8](../progress/research-queue.md) 的书面结论。状态 `accepted`：先前已批准「禁止发明、等引擎证据」；证据已到，本刀只回填裁定，不改 Accept。

## Problem class

- **症状**：Sources Review / Panel Accept 按合同不发明 hunk，调用 `tryWriteSourcesGitApplyHunks` 时默认送 `{ sessionId: '', argv: [], patches: [] }`。`isSourcesGitWriteAccepted` 只认 `supported && success`。引擎把空 `patches` 当成功 no-op 时，UI 会假 Accept。
- **类标签**：跨仓协议歧义（本仓消费口径 vs 引擎实现语义）。
- **复发机制**：把「空字段原样上线」误读成「空 = apply-all / 拒写 / 成功空操作」任一，再据此改 Accept 载荷。
- **防复发**：传输合同仍只保证原样上线。引擎空列表语义必须来自引擎仓实现 / proto，禁止本仓猜测，禁止发明字段或 hunk。

## Context（代码 / 文档基线）

| 证据 | 说了什么 | 没说什么 |
|:-----|:---------|:---------|
| 本仓 **无** `git_service.proto`（全树 0 文件） | — | 本仓不能从 proto 注释裁定 |
| 引擎仓 `/home/clarence/Projects/Agents/UniverseAgent` @ `1f07008f62a83f6c564ff93f15c0b69de9c0c2e1` `grpc-server/.../GitWorkDirWriter.kt` L77–78 | `if (patches.isEmpty()) return WriteOutcome(success = true)`；**不**跑 `git apply` | 不是 apply-all |
| 同上 L80–82 | 空 `applyArgv` **仅当** `patches` 非空时回 `success = false`（`apply argv is required`） | 空 argv + 空 patches 不走此拒写 |
| 同上 `GitGrpcService.kt` L164–168 `toProtoResponse()` | 成功路径 `setSupported(true)` + `setSuccess(success)` | 空 patches 的 no-op 也会带 `supported:true` |
| [engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md) `GitService.WriteGitApplyHunks` | 已进 catalog + node；snake_case `session_id` / `argv` / `patches`；空 `sessionId` / 空 `argv` / 空 `patches` **传输**原样上线 | 本仓不发明 hunk |
| `sourcesChangesGitWrite.ts` `isSourcesGitWriteAccepted` | `supported && success` 即 accepted | 不区分 no-op 与真 apply |
| `conversationDiffReviewPane.ts` / `sourcesDiffPanelView.ts` `runAccept` | `tryWriteSourcesGitApplyHunks(connected, hook)` **不传** argv / patches | 本刀仍不改 Accept 载荷 |

## Options

| 选项 | 含义 | 拒绝理由 |
|:-----|:-----|:---------|
| A 空 = apply-all | 空 `argv`/`patches` 表示接受当前全部改动 | **拒绝。** 引擎空 `patches` 不跑 `git apply`，工作树不变。 |
| B 空 = 拒写 | 引擎应回 `supported:false` 或 `success:false` | **拒绝。** 空 `patches` 回 `success = true`；空 argv 只在 patches 非空时拒写。 |
| C 空 = 成功 no-op（当作可接受的产品语义） | 把空成功当「Accept 已完成」 | **拒绝。** 引擎虽证实此回包，但不得据此把空请求当成用户已接受全部 hunk，也不得在本刀改 Accept。 |
| D 诚实未定 | 本仓只钉传输合同，引擎语义留待证据 | 过程项。证据已到，不再是选定态。 |

## 选定设计

**引擎语义 = 成功空操作**（Verdict 3）。空 `argv` + 空 `patches`：不跑 `git apply`，工作树不变；RPC 成功路径 `supported:true` 且 `success:true`。

1. **证据锚点**（只读，不改引擎仓）：UniverseAgent `1f07008f62a83f6c564ff93f15c0b69de9c0c2e1` · `GitWorkDirWriter.kt` L77–78 / L80–82 · `GitGrpcService.kt` L164–168。
2. **客户端传输合同不变**：空列表原样上线；Sources Accept **本刀仍**默认空请求，**不**发明 hunk、**不**擅自改传 path。
3. **假 Accept 风险为真**：宿主 `isSourcesGitWriteAccepted` 把 `supported && success` 当 accepted；空 no-op 会走这条。改 Accept 载荷属后续切片，不在本刀。
4. **[R8](../progress/research-queue.md) 闭合**。**[D31](../progress/deferred-gaps.md) 仍开**（F4 未跑；Accept 是否传 path 仍待后续切片）。

## 不变量

- 禁止为闭合 R8 而发明 proto 字段或默认 hunk。
- 禁止把 `supported && success` 在空请求上解读为「用户已接受全部 hunk」。
- 禁止改引擎仓。
- 禁止本刀改 Sources Accept / 产品代码。

## Consequences

- [engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md) `WriteGitApplyHunks` 行回填：传输仍原样上线；引擎空 `patches` = success no-op；Accept 仍空送。
- [R8](../progress/research-queue.md) **closed**。[D31](../progress/deferred-gaps.md) **仍开**。
- Sources Accept 是否改传 path：后续实施切片，本刀不做。

## Alternatives

见 Options A–C（均拒绝）。另：**本仓补一份假 proto 注释** — 拒绝：等于发明协议。
