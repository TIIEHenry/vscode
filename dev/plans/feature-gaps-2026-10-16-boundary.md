---
title: "功能缺口 2026-10-16：已有方案与维持传输层"
type: plan
status: implemented
phase: M7
updated: 2026-10-16
summary: "G1、G2、G5、G10、G19、G20 指向已实施方案。G7、G11 与协议面已写明只进传输的入口不新开产品面。D2 与 D3 文档偏差已于 cc6e17a9d8f 落地合入。不升 PRD。"
---

# 功能缺口 2026-10-16：已有方案与维持传输层

> **触发：** [功能缺口审查 2026-10-16](review-2026-10-16-feature-gaps.md)。本稿只收口「已经有方案」和「协议面已写明不建产品面」的条目，并改正两处文档。可实施的新行为在并列方案里。
> **落地：** `status: implemented`。D2 与 D3 文档偏差已于 `cc6e17a9d8f`（Slot F）落地合入。

## 1. 已有方案，本稿不重写

| 审查 | 归宿 |
|:-----|:-----|
| G1 生成中仍能 Send；G2 已连接仍发 Enqueue；G10 附件 | [engine-gap-queue-send-attachments](engine-gap-queue-send-attachments.md) 已 `accepted`。本刀只停 Enqueue 并在 streaming 时禁用 Send。附件不开刀。Pause / Resume / Clear / Hold 在已连接时仍会打到读不回的队列，该稿 §4 标为已知残留，本刀不改。代码未动。 |
| G5 Files 的工作根调用点 | [session-work-root-and-workbench-scope](session-work-root-and-workbench-scope.md)。`sourcesFilesExplorer.ts:230` 用 `getWorkRoot`，`:452` 与 `sourcesFilesList.ts:383`、`:653` 仍用 `getSessionWorkDir`。该稿 S2 的八项没有这几个调用点（第 6 项是引擎设置）。归宿仍是那份方案，由它补指针。本稿不重写其行为。 |
| G19 Preview 不跟显式切换 | 同一份会话工作根方案。等 PRD-027 P3，该方案已写明 S5 另写设计。 |
| G20 PRD-027 P3、PRD-024 H6 | [preview-category-isolation](preview-category-isolation.md)、[connection-hub-client](connection-hub-client.md) 切片 H6。不在本稿重开。 |
| 观感：一行 Composer、会话菜单、目录列表、Markdown 预览 | [cursor-visual-alignment](cursor-visual-alignment.md)。Tools 双行归该稿 S9。 |

## 2. 维持传输层，不新开产品面

审查把「没有按钮」记成缺口。本稿不补按钮。协议面原句按下面三条引用，不把 Engine 产品页或 Composer 写进 G7。

**G7。** `compact`、`getTodo`、`back`、`prune`、`resetAgent`、`branch`、`suspendLoop`、`resumeLoop`、`stopLoop`、`shelveSession`、`unshelveSession`、`purgeSession`、`exportSession`、`switchWorkDir`、`pauseAgent`、`runToolInBackground`、`stopShellTask`、`sendShellSessionClientControl`。这些行写的是「本刀只进 catalog + node 传输；不改 Conversation roster / SessionBar / Snapshots overlay」。传输可以留在 `IUniverseAgentConnection`。不在名册、底栏或 Navigator 加入口。

**G11。** Memory 全族、`GetGlobalUsage`、`writeFile`、`forceWriteFile`、`agentMerge`。协议面写的是无 UI（catalog + node）。Review 遇到哈希冲突时，不在本切片加 ForceWrite 或三方合并按钮。不发明合并字段。

**P2。** Doctor、Shutdown 的协议行写明不改 Engine Preferences / Composer。`RemoteAgentService` 里已经进 catalog 的方法保持没有产品入口。`CreateRemoteSession`、`DestroyRemoteSession`、`GetRemoteSessionHistory`、`ResumeRemoteSession` 只出现在不等号里，短表写的是其余 RPC 与 UI 仍未接；本切片也不给它们补入口。协议面第 20 行已有过期、被拒或 `UNAVAILABLE` 时换一条新链路。本切片不新做提前续期，那句换链保持。Engine Overview 的能力八行不加 Triggers、Clipboard、Context Variables、`mcpRuntime`、`providerConfig`。这是本切片的边界；前三项与 [engine-trigger-clipboard-actions](engine-trigger-clipboard-actions.md) 的不做项同向，后两项不是协议面「只进传输」那一句。

Kill、Retry、失败回滚、`file_mutation` 缺字段、mailbox、AutoDrive 空列表见 [conversation-failure-and-mutation](conversation-failure-and-mutation.md)。G3 见 [engine-mcp-definition-form](engine-mcp-definition-form.md)。G4、G15、G16 见 [engine-trigger-clipboard-actions](engine-trigger-clipboard-actions.md)。G6 见 [composer-agent-picker](composer-agent-picker.md)。

## 3. 文档偏差（实施时改原文）

**D2。** [sources overview](../../docs/systems/sources/overview.md) §4「HEAD 已知偏差」整条都由「没有注册内容提供者」推出：三处解析失败、打不开 Diff、带载荷的 Accept 显示不出来，并因此写 sources-architecture P1「签收，未实施」。`sourcesDiff.contribution.ts:27-29` 已 `registerTextModelContentProvider(SOURCES_GIT_DIFF_SCHEME, ...)`。实施时改写整条。提供者缺失以及由它推出的那几句都去掉，包括「打不开 Diff」。若 [sources-architecture](sources-architecture.md) P1 还有与提供者无关的未做项，另起一句指向那些项。没有就撤掉这条偏差。不把 PRD-009 标成 implemented。

**D3。** [engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md) 第 246 行有两处「未实施」：链接括号里的「，未实施」，以及行末「hunk 暂存方案已签、未实施」。[sources-accept-stage-hunk](sources-accept-stage-hunk.md) 里与现状相符的一句是「S1 已落、方案仍 accepted。不升 PRD-009」。实施时行末改成这一句，并去掉同行括号里的「未实施」。`conversationDiffReviewPane.ts` 与 `sourcesDiffPanelView.ts` 已调用 `writeGitApplyHunks`。不升 PRD-009，不改 ADR-008。

G3 的 engine-catalog 措辞归 [engine-mcp-definition-form](engine-mcp-definition-form.md)，不在本稿改。

## 4. 明确不改

- 不实施 §1 已指向的方案。
- 不给 §2 的 RPC 加 UI。
- 不改协议字段，不升任何 PRD。

## 5. 本地验证

文档切片没有新的运行时断言。改完后 `python3 scripts/check-docs-health.py` 0 errors。`rg` 确认 overview 的这条偏差不再含「没有注册内容提供者」和「打不开 Diff」。协议面第 246 行不再含「未实施」。
