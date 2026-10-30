---
title: "方案 r07：conversation"
type: plan
status: implemented
phase: N/A
updated: 2026-10-24
summary: "2 hold 已实施；2026-10-24 用户签收 B（ADR-012）：引擎已接受的权限 / 模型值在 leftover 时保留，控件保持不可写。九条 leftover 用例通过。"
---
# 方案 r07：conversation

状态：已完成。
覆盖需求：无（正文未引用需求编号）。


## 核查

- r07-1 hold：`setPermissionMode` 已返回 `ok` 后，会话不可写仍把 `permissionIndex` 和下拉退回 `confirmedIndex`。行为属实，按 ADR-012 改为保留已接受值。
- r07-2 hold：`switchModel` 已返回非空 `resolvedModelId` 后，会话不可写仍把下拉和 `modelSelectedIndex` 退回切换前。行为属实，按 ADR-012 改为保留已接受值。

## 签收

- 2026-10-24 用户签收选择 B：引擎已接受的值可以显示，但 leftover 期间控件必须保持不可写。契约见 [ADR-012](../../dev/decisions/012-leftover-accepted-value-vs-write-affordance.md)。
- D383 与 D450 保持 closed 与原文；ADR-012 只收窄解释，不改写历史记录。
- 本稿 `implemented`。实现与验证见文末「落地」。

## r07-1 hold

- 问题类：引擎已接受的权限模式被本地配置和下拉写成旧档，或未发送的新档被留成当前档。
- 不变量：
  - `setPermissionMode` 的 `ok` 是该会话权限模式的事实。`sessionConfig.permissionIndex` 与仍绑定该会话时的下拉必须等于最后一次被接受的档。
  - 没发出去的档不能显示成当前档。
  - 失败结果不能改写已接受的档。
  - leftover 只影响控件是否可写，不影响已接受值。控件必须保持禁用，门闩按既有三分写原因。
- 要动的符号或文件：`drainSessionPermission`（`src/vs/workbench/contrib/conversation/browser/conversationLensComposerChrome.ts`）。
  - `result.ok` 时先把 `epoch.confirmedIndex` 写成 `sentIndex`，再判断会话是否可写。
  - 不可写时用 `restoreSessionPermissionIndex(host, sessionId, epoch.confirmedIndex)` 后返回，不再 `continue`。此时 `confirmedIndex` 已是刚接受的 `sentIndex`，所以配置和（仍绑定该会话时的）下拉保留已接受值。
  - 代际已前进且不可写时同样先记 `confirmedIndex = sentIndex`，再 restore；不得把尚未发送的新档留在界面上。
  - 不可写且 `result.ok` 为 false 时，restore 仍用进入这次请求前的 `confirmedIndex`。
  - 实现处注释改为引用 ADR-012；保留 D383/D450 的历史说明，不删除。
- 不改：`isComposerSessionWriteLive` 的判定；`applySessionPermissionIndex` 在请求返回前写入目标档；仍可写且代际前进时继续发送更新的目标；仍可写且失败时的回退和失败提示；`catch` 路径；不可写期间不补发未送出的下一档；未绑定该会话时不改另一个会话的下拉。
- 本地验证：改 `conversationLensDisposeGate.test.ts` 的两条 leftover 测试，并新增：
  - 同代 + leftover：`{ ok: true }` 后 `sessionConfig.permissionIndex` 和（仍绑定时的）下拉等于送出的档；控件 `disabled` 为 true；门闩可见。
  - 跨代 + leftover：先接受旧档，再改新档但未发送；显示旧档（accepted），不显示未发送的新档；没有第二次 `setPermissionMode`。
  - 失败 / 取消：回退到请求前 `confirmedIndex`；不可写时不发失败提示。
  - 改绑：A 的结果不改 B 的下拉；A 的配置仍是 accepted。
  - 重新可写：控件恢复启用，值仍是 accepted。

## r07-2 hold

- 问题类：引擎已解析的模型被当前会话的下拉和 `modelSelectedIndex` 退回切换前的项。
- 不变量：
  - 非空的 `resolvedModelId` 表示这次 `switchModel` 已被引擎接受。仍绑定该会话时，下拉和 `modelSelectedIndex` 必须留在这次送出的档。
  - 该会话的 `modelProfileIdBySessionId` 必须是这次的 `sentModelId`。之后 `submitDraft` 从 `modelSelectedIndex` 读到的 `modelProfileId` 必须是这一档。
  - 空的 `resolvedModelId` 表示未接受，必须退回 `rollbackIndex`。
  - leftover 只影响控件是否可写，不影响已接受值。
- 要动的符号或文件：`drainSessionModel`（同一文件）。
  - `SessionModelEpoch` 增加 `confirmedIndex` / `confirmedId`，表示最后一次被引擎接受的模型；`rollbackIndex` / `rollbackId` 仍表示当前这次请求的回退点。
  - 同一代结果返回后，先看 `result.resolvedModelId.trim()`。非空则与可写成功分支一样：`rollbackIndex = sentIndex`，`rollbackId = sentModelId`，`confirmedIndex = sentIndex`，`confirmedId = sentModelId`，`ensureSessionModelProfileIds` 将该会话记为 `sentModelId`，然后返回，不要调用 `restoreSessionModelIndex`。
  - leftover 分支用 `confirmedIndex` / `confirmedId` 恢复，不用可能已被未接受目标覆盖的 `rollbackIndex` / `rollbackId`。
  - 不按另一个 id 重映射下拉。
  - 空则仍 `restoreSessionModelIndex(host, sessionId, epoch.rollbackIndex, epoch.rollbackId)`；只有会话仍可写且仍绑定时才显示原来的失败提示。
- 不改：`submitDraft` 仍从 `catalogModelIds[modelSelectedIndex]` 读 `modelProfileId`；`applySessionModelIndex` 在请求前的乐观选中；`catch` 以及空 `resolvedModelId` 的回退；未绑定该会话时不改当前 `modelSelectedIndex`。
- 代际已前进时，若旧结果已被接受且此刻不可写，先记下 accepted，再回到 accepted 并返回；未发送的新目标不得留在界面上。旧结果为空时同样回到 accepted。这是 ADR-012 第 2 条的直接要求，优先于「代际早退」的旧写法。
- 本地验证：改同上两条 leftover 测试，并新增：
  - 同一成功结果到达时 `isEngineSessionReady() === false`，下拉和 `modelSelectedIndex` 保持送出的档，控件 disabled。
  - 结果到达前已改绑到别的会话时，源会话 profile id 仍是 `sentModelId`，当前会话的 `modelSelectedIndex` 不被改写。
  - 空 `resolvedModelId` 仍回退，且不显示失败提示当会话不可写。
  - 重新可写后 `submitDraft` 读到的 `modelProfileId` 等于 accepted。

## 验收边界

- 只对“明确接受”生效：`ok: true` / 非空 `resolvedModelId`。失败、取消、空结果仍回退。
- 已接受值只属于该 `sessionId` 和该次连接 / 会话实例。重连、换引擎、会话重建后重新读取，不把旧 accepted 当当前值。
- 显示的是最后接受值，不是当前策略允许值；写路径仍要过策略门。
- 反例：如果 leftover 时控件仍可点、门闩仍藏，本次改动就退化成“装 live”，不满足 ADR-012。

## 落地

- 2026-10-24 实施 `drainSessionPermission` / `drainSessionModel`：同一代结果先记录引擎接受值，再按 leftover 恢复显示；代际已前进且不可写时同样只保留已接受值。控件启用仍只由 `isComposerSessionWriteLive` 决定。
- 测试：`conversationLensDisposeGate.test.ts` 九条 leftover 用例通过（同代保留、跨代不显示未发送目标、跨代空结果 / 抛错回到最后接受值、失败 / 空结果回退、改绑只写源会话、重新可写后值仍为 accepted）。
- 未改：写入口、`submitDraft` 的模型读取、门闩三分文案、D383/D450 历史记录。
