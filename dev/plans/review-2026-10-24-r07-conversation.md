---
title: "审查 r07：conversation"
type: reference
status: draft
phase: N/A
updated: 2026-10-24
summary: "2 条；配对挂起或列表失败时，权限与模型下拉在引擎已接受写入后仍退回旧选择。2026-10-24 已签收 ADR-012 并实施：保留已接受值，控件保持不可写。"
---
# 审查 r07：conversation

状态：草案。
覆盖需求：无（正文未引用需求编号）。


## r07-1 高

- 症状：用户把会话权限从 Ask 改到 Permit（或在途中再改一档）后，`setPermissionMode` 已经返回成功，只要此时配对挂起或列表失败使会话不可写，下拉和 `sessionConfig.permissionIndex` 会退回旧档，或停在尚未发给引擎的新档上；引擎保留已经接受的模式。之后可以发送时，界面显示 Ask，工具实际按 Permit 执行。
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts` 第 1116–1132 行
- 引用：

```
1116:1132:src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts
			const result = await setPermissionMode.call(host.uaConnection, { sessionId, mode });
			if (epoch.generation !== sentGeneration) {
				// Pairing-hold cannot take a correcting write. Leave the newer choice.
				if (!isComposerSessionWriteLive(host)) {
					return;
				}
				// The engine accepted this mode. A later still-latest failure rolls
				// back here, not to the unconfirmed index the next request started from.
				if (result.ok) {
					epoch.confirmedIndex = sentIndex;
				}
				continue;
			}
			// D383 leftover-looks-live: pairing-hold first. D450 KEEP leftover index; do not keep live apply.
			if (!isComposerSessionWriteLive(host)) {
				restoreSessionPermissionIndex(host, sessionId, epoch.confirmedIndex);
				return;
			}
```

- 为什么是问题：`applySessionPermissionIndex` 在请求返回前就把目标和 `permissionSelectBox` 写成新档（第 1248–1253 行）。同一代请求返回后，第 1130–1132 行只看 `isComposerSessionWriteLive`（第 898–901 行：未连接、配对挂起或列表失败即为不可写），不看 `result.ok`，用 `confirmedIndex`（缺省为 Ask，索引 0）把配置和下拉写回去。更新一代且不可写时，第 1117–1120 行直接返回：已成功的旧档不记入 `confirmedIndex`，界面上的新档也不再发送。`conversationLensDisposeGate.test.ts` 的 `in-flight leftover-looks-live permission and model apply restore leftover index`（第 3486–3499 行）和 `in-flight leftover permission restore after switch to B does not roll back B select`（第 3996–4005 行）都在 `{ ok: true }` 之后断言会话 A 的 `permissionIndex === 0`。
- 既有契约：第 1130 行的注释写明 `D383 leftover-looks-live: pairing-hold first. D450 KEEP leftover index; do not keep live apply.`；D383（`dev/progress/deferred-gaps.md:397`）与 D450（`:464`）均已 closed。D450 的产品取舍是 leftover 期间不能把写面画得像 live。实现把这条约束落在“值”上，于是引擎已接受的 Permit 被改写成 Ask，值开始撒谎。
- 已签收方向：2026-10-24 用户签收 [ADR-012](../../dev/decisions/012-leftover-accepted-value-vs-write-affordance.md)。leftover 不显示未接受的乐观值；引擎已接受的值可以显示，但控件必须保持不可写并说明原因。D383/D450 保持 closed 与原文，ADR-012 只收窄解释。已按 [方案 r07](review-2026-10-24-r07-conversation-plan.md) 实施。

## r07-2 中

- 症状：`switchModel` 已经解析出新模型后，配对挂起或列表失败会把当前会话的模型下拉和 `modelSelectedIndex` 退回切换前的项；下一次提交按这个下标读取 `modelProfileId`。
- 位置：`src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts` 第 1192–1195 行；`src/vs/workbench/contrib/conversation/browser/conversationLensComposer.ts` 第 403–407 行
- 引用：

```
1192:1195:src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts
			// D383 leftover-looks-live: pairing-hold first. D450 KEEP leftover index; do not keep live model.
			if (!isComposerSessionWriteLive(host)) {
				restoreSessionModelIndex(host, sessionId, epoch.rollbackIndex, epoch.rollbackId);
				return;
			}
```

```
403:407:src/vs/workbench/contrib/conversation/browser/conversationLensComposer.ts
			const modelProfileId = host.catalogModelIds?.[host.modelSelectedIndex] ?? '';
			const outcome = await postBound(host, {
				kind: 'submitInput',
				text,
				...(modelProfileId ? { modelProfileId } : {}),
```

- 为什么是问题：仍绑定该会话时，`restoreSessionModelIndex` 会把 `modelSelectedIndex` 和下拉写回 `rollbackIndex`（第 1312–1316 行），不采用已经返回的 `result.resolvedModelId`。同一 leftover 测试在 `resolvedModelId` 为 `gpt-test` 之后断言 `modelSelectedIndex === 0`（第 3491–3500 行）。`submitDraft` 用这个下标取 `catalogModelIds` 作为 `modelProfileId`。
- 既有契约：第 1194 行的注释写明 `D383 leftover-looks-live: pairing-hold first. D450 KEEP leftover index; do not keep live model.`。与 r07-1 相同，原实现把“不可写”投影成“值回退”，导致引擎已解析的模型被画成旧模型。
- 已签收方向：同 ADR-012。模型下拉保留引擎已解析的模型；leftover 期间控件保持不可写，门闩说明原因。
