---
title: "ADR-008 WriteGitApplyHunks 空 argv / patches：本仓不能裁定引擎语义"
type: decision
status: review
phase: N/A
updated: 2026-09-07
summary: "R8：本仓无 git_service.proto；注释只保证空列表原样上线。空 argv/patches 是 apply-all、拒写、还是成功 no-op，本仓无法裁定。Sources Accept 继续空送、不发明 hunk。D31 F4 未跑。"
---

# ADR-008 WriteGitApplyHunks 空 argv / patches

> 本文件是 [R8](../progress/research-queue.md) 的书面结论。状态 `review`：Plan Roadmap 主笔不自宣 Architecture-First Approve。

## Problem class

- **症状**：Sources Review / Panel Accept 按合同不发明 hunk，调用 `tryWriteSourcesGitApplyHunks` 时默认送 `{ sessionId: '', argv: [], patches: [] }`。`isSourcesGitWriteAccepted` 只认 `supported && success`。若引擎把空请求当成功 no-op，UI 会假 Accept。
- **类标签**：跨仓协议歧义（本仓消费口径 vs 引擎实现语义）。
- **复发机制**：把「空字段原样上线」误读成「空 = apply-all / 拒写 / 成功空操作」任一，再据此改 Accept 载荷。
- **防复发**：本仓只记录**已证实的传输合同**；引擎空列表语义必须来自本仓已有 proto 注释，或引擎仓/活引擎证据。禁止猜测，禁止发明字段或 hunk。

## Context（代码 / 文档基线）

| 证据 | 说了什么 | 没说什么 |
|:-----|:---------|:---------|
| 本仓 **无** `git_service.proto`（全树 0 文件） | — | 无法对照字段注释裁定空列表 |
| [engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md) `GitService.WriteGitApplyHunks` | 已进 catalog + node；snake_case `session_id` / `argv` / `patches`；空 `sessionId` / 空 `argv` / 空 `patches` **原样上线**；响应 `supported`/`reason`/`success`/`error_message`/`exit_code`/`stdout` | 空列表在引擎侧是 apply-all、拒写、还是成功 no-op |
| `universeAgentTypes.ts` `UniverseAgentWriteGitApplyHunksRequest` | `argv: readonly string[]`；`patches: readonly string[]`；注释「Empty `argv` / empty `patches` sent as-is」 | 同上 |
| `universeAgentConnection.ts` `writeGitApplyHunks?` | 同上；proto 字段仅上表六响应键 | 同上 |
| `grpcClient.ts` `writeGitApplyHunks` | wire `{ session_id, argv: [...], patches: [...] }`，空数组原样转发 | 无字段号注释、无空列表语义 |
| `sourcesChangesGitWrite.ts` `sourcesGitApplyHunksRequest` | 默认 `argv=[]` / `patches=[]`；「no default hunk / no path invent」 | 不解释引擎如何解释空列表 |
| `conversationDiffReviewPane.ts` / `sourcesDiffPanelView.ts` `runAccept` | `tryWriteSourcesGitApplyHunks(connected, hook)` **不传** argv / patches | 未发明 path / hunk |

## Options

| 选项 | 含义 | 拒绝理由 |
|:-----|:-----|:---------|
| A 空 = apply-all | 空 `argv`/`patches` 表示接受当前全部改动 | 本仓 proto / 协议面无此注释。猜测引擎行为。 |
| B 空 = 拒写 | 引擎应回 `supported:false` 或 `success:false` | 同上。本仓只测「空列表原样转发」，不测引擎回包。 |
| C 空 = 成功 no-op | `supported && success` 且工作树不变 | 同上。此选项正是 R8 担心的假 Accept。 |
| **D 诚实未定** | 本仓只钉传输合同；引擎语义留待引擎仓 proto 注释或活引擎实测 | **选定。** 不发明字段，不改 Accept 载荷。 |

## 选定设计

1. **本仓不裁定**空 `argv` / 空 `patches` 的引擎语义（apply-all / 拒写 / 成功 no-op 三者均无 in-repo 证据）。
2. **客户端合同不变**：空列表原样上线；Sources Accept **继续**调用默认空请求，**不**发明 hunk、**不**擅自改传 path。
3. **R8 保持 open**，直到下面「剩余问题」有引擎仓或活引擎证据。
4. **[D31](../progress/deferred-gaps.md) 仍开**：F4 隔离 profile 冒烟未跑；本 ADR 不跑 F4、不升 PRD。

## 不变量

- 禁止为闭合 R8 而发明 proto 字段或默认 hunk。
- 禁止把 `supported && success` 在空请求上解读为「用户已接受全部 hunk」，除非引擎仓明文或实测证明空 = apply-all。
- 禁止改引擎仓。

## 剩余问题（R8 仍开的唯一闭合条件）

引擎仓 `git_service.proto`（或 `WriteGitApplyHunks` 实现）对 **空 `argv` 且空 `patches`** 的请求，返回哪一种？

1. apply-all（工作树/暂存区发生变化，且 `supported && success`）
2. 拒写（`supported:false`，或 `supported:true && success:false`）
3. 成功空操作（`supported && success`，工作树不变）

证据必须来自引擎仓注释/实现，或活引擎 unary 回包 + 工作树对照。本仓注释不足以下结论。

## Consequences

- [engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md) `WriteGitApplyHunks` 行回填「引擎空列表语义未定」。
- [R8](../progress/research-queue.md) 不闭。[D31](../progress/deferred-gaps.md) 不闭。
- Sources Accept 是否改传 path：等本问题有证据后再开实施切片。

## Alternatives

见 Options A–C。另：**本仓补一份假 proto 注释** — 拒绝：等于发明协议。
