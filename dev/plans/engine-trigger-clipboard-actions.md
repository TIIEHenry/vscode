---
title: "Triggers 与 Clipboard：空载荷不发，未知能力不拉列表"
type: plan
status: draft
phase: M7
updated: 2026-10-16
summary: "Add 与 Clipboard Write 不再发出空载荷。FireTrigger 只在 status 为空时画错误。三节列表在能力未知时不调用。未实施。不升 PRD。"
---

# Triggers 与 Clipboard：空载荷不发，未知能力不拉列表

> **触发：** [功能缺口审查 2026-10-16](review-2026-10-16-feature-gaps.md) G4、G15、G16。
> **不推翻：** [对话入口按广告探测](conversation-entry-capability.md) 对其余入口的 UNKNOWN 退路。不发明 Trigger 或 Clipboard 字段。不升 PRD。

## 1. 现状

`engineTriggerUpsertRequest(..., 'add')` 固定送 `emptyEngineTrigger()`（`engineTriggerList.ts:122-130`）。空 Trigger 的 `triggerId`、`name`、`type`、`promptTemplate` 皆空，`enabled` 为 false，`intervalMs` 与 `runAtEpochMs` 为 0，`target` 为 `{ kind: 'unspecified' }`（`:57-69`）。Add 按钮点击即 `handleUpsert('add')`（`engineTriggersSection.ts:142`）。Edit 无选中项时同样落到这份空 Trigger。`updateUpsertAction` 把同一个 `enabled` 赋给 `addButton` 和 `editButton`（`:458-465`）。

`engineClipboardWriteRequest()` 固定送空 `sessionId`、`agentId`、`label`、`content`、`filePath`、`url`，`type` 为 `CLIPBOARD_TEXT`（`engineClipboardList.ts:76-85`）。Write 按钮点击即 `handleWrite`，请求就是这份空载荷（`engineClipboardSection.ts:109`、`:399-405`）。

`UniverseAgentFireTriggerResult` 只有 `status`、`eventId`、`reason` 三个字符串（`universeAgentTypes.ts:3740-3744`）。本仓没有被拒取值表。`handleFire` 无论返回什么都 `writeStatus(..., 'neutral')`（`engineTriggersSection.ts:503`）。throw 已经画 error（`:504-507`）。`writeStatus` 会 `trim`（`connectionPreferencesPane.ts:89-90`）。测试 “FireTrigger resolve stays neutral” 第一次返回全空并断言没有 `is-error`（`src/vs/workbench/contrib/conversation/test/browser/engineTriggersSection.test.ts:740-757`），第二次把 `FIRED` / `queued` 锁成 neutral。

三节列表用 `conversationEntryHookPresent`。该函数在 `UNSUPPORTED` 时关闭，在 `SUPPORTED` 时开放，在 `UNKNOWN` 时改看方法是不是函数（`universeAgentCapabilities.ts:149-155`、`:180-187`）。桌面代理上方法恒为函数，所以能力未知仍会拉列表。`hook.call` 在 Triggers `:261`、Clipboard `:219`、Context Variables `:181`。门闩判断在这三次调用之前。

[conversation-entry-capability](conversation-entry-capability.md) 写明 UNKNOWN 退路是给替身和其余入口用的。本切片不改这个共享函数。

## 2. 本切片

### 2.1 空载荷不发

不建 Trigger 编辑器，不建剪贴板正文框。缺字段就不调用。

- Triggers **Add** 不再调用 `upsertTrigger`。不把 `updateUpsertAction` 那个共享 `enabled` 设成 false，否则有选中项的 Edit 会一起停。Add 按钮留在 DOM 里，点击在调用 hook 之前返回。现有 `findActionButton` 仍能找到它。
- **Edit** 仅在有选中 trigger 时发送该对象（现有 `engineTriggerUpsertRequest` 的 edit 分支）。无选中项不发送 `emptyEngineTrigger()`。Edit 的 `enabled` 仍只看现有 `canSendEngineTriggerUpsert`。
- Clipboard **Write** 不再调用 `writeClipboard`。它有自己的 `updateWriteAction`。按钮留在 DOM 里，点击在 hook 之前返回。
- `emptyEngineTrigger` 与 `engineClipboardWriteRequest` 两个构造函数留在模块里，供单测锁住「空字段原样」的编码合同。生产点击路径不调用它们。
- Read、Clear、Delete、Fire、SetTriggerEnabled 的请求形状不动。空 `scope` / `scopeId` / `triggerId` / `sessionId` 在这些仍会发出的请求里继续原样上线。

### 2.2 FireTrigger 色调

文案保持 `` `${result.status} — ${result.eventId} — ${result.reason}` ``。

- `status` 为空字符串：`writeStatus(..., 'error')`。可见文案是 `writeStatus` trim 之后的结果。全空三字段的可见文本与现有测试的 `` `${''} — ${''} — ${''}`.trim() `` 相同，并带 `is-error`。仅空白的 `status` 不另当错误。
- `status` 非空：仍是 `neutral`。`FIRED` 加 `reason: 'queued'` 继续是 neutral。不把 reason 非空当成拒绝。
- throw 仍是 error。
- 不新增 status 枚举，不把某个词写成「被拒」。协议面没有这张表之前，不猜测。

### 2.3 能力未知不拉列表

只改三节的**列表**请求：Triggers、Clipboard、Context Variables。

调用 `listTriggers` / `listClipboard` / `listContextVariable` 的条件改为：已连接、非 pairing-hold、`readConversationEntryCapability(this.connection.getConnectionSnapshot())` 里对应键是 `'SUPPORTED'`、且 hook 是函数。不读 `getCapabilitySnapshot()`，那份快照没有 `conversationEntryCapability`，缺字段会一直是 `UNKNOWN`。`UNKNOWN` 与缺字段不调用，即使方法是函数。`UNSUPPORTED` 仍不调用。

不改 `conversationEntryHookPresent`。写动作继续用现有 `triggerAdvertised` / `clipboardAdvertised` / `contextReadAdvertised`（`engineContextVariableSection.ts:325-326`），本切片不改它们的 UNKNOWN 退路。

接通且键为 `UNKNOWN` 或缺字段时，不发 List，也不把列表换成刚拉到的空数组。Triggers 的状态字段是 `triggers`，Clipboard 是 `entries`，Context Variables 是 `rows`。pairing-hold 与断连共用现有提前返回（Triggers `:238-240`，Clipboard `:196-198`，Context Variables `:157-159`），在这次判断之后才落到 `unsupported`。mode 用这三节已有的 `'unsupported'` 与 `getEngineSectionApiUnavailableCopy`（Triggers `:246-250`，Clipboard `:204-208`，Context Variables `:166-170`）。不新造 mode。这只覆盖三节列表，不把其余入口的 `UNKNOWN` 画成「引擎没有这个 RPC」。

## 3. 文档

同一实施切片只改下面点名的句子。列表门闩改成接通且对应快照键为 `SUPPORTED` 才发。写动作句子里的「接通 + hook 才发」留下。编码映射（空字段原样上线、0 原样上线）留在「若发出」的说明里。

[engine-protocol-surface](../../docs/reference/universe-agent/engine-protocol-surface.md)：

- Clipboard `Write` 第 148、199、290 行：删掉「始终发空 content」或等价句。改成生产点击不调用 `writeClipboard`；空字段编码函数仍在。
- `UpsertTrigger` 第 31、195、286 行：删掉「Add 始终发空 TriggerDto」和「Edit 无选中行仍发空 TriggerDto」。改成 Add 不发；Edit 只在有选中行时发该对象。
- `ListTriggers` 详表第 30 行、短表第 194 行、后表第 285 行；Clipboard `List` 详表第 150 行、短表第 201 行、后表第 292 行；Context Variables `List` 详表第 152 行、短表第 203 行、后表第 262 行。详表写的是「接通 + 有 hook 才发」，短表和后表写的是「接通 + hook 才发」。这九个列表格子都改成接通且对应快照键为 `SUPPORTED` 才发；`UNKNOWN` 或缺字段不发。后表第 292 行行末少一个表格竖线，改这一格时把竖线补上。

[stub-and-fixtures](../../docs/systems/conversation/stub-and-fixtures.md) 分两层改。正文第 55 行 Upsert、第 60 行 Write 只删空载荷句（「Add 始终发空 TriggerDto」「Edit 无选中行仍发空 TriggerDto」「始终发空 `sessionId` / `agentId` / `label` / `content` / `filePath` / `url`，`type` TEXT」），这两行自己的「接通 + hook 才发」留下。第 40 行 Context Variables List、第 54 行 ListTriggers、第 62 行 Clipboard List 才把「接通 + hook 才发」改成接通且对应快照键为 `SUPPORTED` 才发。

frontmatter `summary` 第 7 行里，Triggers、Clipboard、Context Variables 各只有一处「接通 + hook」，写在整组 RPC 的同一个括号里。Triggers 括号罩住 `listTriggers` / `fireTrigger` / `setTriggerEnabled` / `deleteTrigger` / `upsertTrigger`；Clipboard 罩住 `listClipboard` / `readClipboard` / `writeClipboard` / `clearClipboard`；Context Variables 罩住 `listContextVariable` / `readContextVariable`。空载荷三句照删：「Add 发空 TriggerDto」「Edit 无选中行仍发空 TriggerDto」「Write 始终发 TEXT + 空字段」。括号里的「接通 + hook」只从 `listTriggers`、`listClipboard`、`listContextVariable` 收成接通且对应键为 `SUPPORTED`。同括号里的 Fire、Set、Delete、Upsert、Read、Write、Clear、`readContextVariable` 仍留「接通 + hook」。摘要其余部分不动。

[conversation-entry-capability](conversation-entry-capability.md) 在本切片落地时，把第 23 行的三节列表 UNKNOWN 例外写成已经生效，并把第 49 行「已有对话单测不填该字段仍走今天的 hook」收窄到这三节列表以外。落地前该文保持「例外尚未实施，三节列表仍走共享函数的 UNKNOWN 退路」。其余入口的 UNKNOWN 退路不改。

## 4. 明确不改

- 不设计 cron、delivery target、剪贴板正文的输入。那些是以后的切片。
- 不改 `conversationEntryHookPresent`，不改设备、快照、权限、模型、`switchAgent` 的门闩。
- 不把这三节加进 Engine Overview 的能力八行。
- 不改 Fire 的请求字段，不改 `mapFireTriggerResponse`。
- 不升 PRD。

## 5. 本地验证

测试文件以 `src/vs/workbench/contrib/conversation/test/browser/` 下的 `engineTriggersSection.test.ts`、`engineClipboardSection.test.ts`、`engineContextVariableSection.test.ts` 为准。同名的 `browser/engineTriggersSection.test.ts`、`browser/engineClipboardSection.test.ts`、`browser/engineContextVariableSection.test.ts` 若断言点击会发空载荷或接通就 List，按同一口径改。

`createConversationConnectionTestStub` 的 `getConnectionSnapshot()`（`conversationConnectionTestStub.ts:62-68`）没有 `conversationEntryCapability`。缺字段就是 `UNKNOWN`。今天「接通就 List」的用例靠这条退路才会发出。实施时，凡是要断言 List、以及先拉出一行再点 Edit、Read、Fire、Delete、Enable、Clear 的用例，都把对应键设成 `SUPPORTED`。`browser/` 下接通后才进入 list hook 的 late-list 用例同样要设。不要给目录替身留着缺字段还期待 List。

- Triggers：Add 点击不调用 `upsertTrigger`，按钮仍可被 `findActionButton` 找到。无选中项的 Edit 不调用。有选中项的 Edit 仍送该 trigger，且 Add 的提前返回没有把它的 `enabled` 一起关掉。`FireTrigger resolve stays neutral` 的第一次全空返回改为带 `is-error`，可见文案仍是现有 trim 结果。第二次 `FIRED` / `queued` 仍无 error class。另加 `status: ''` 且 reason 非空时带 error class。快照 `listTriggers: 'UNKNOWN'` 且方法为函数时不调用 List，mode 为 `unsupported`。
- Clipboard：Write 点击不调用 `writeClipboard`，按钮仍可被找到。`listClipboard: 'UNKNOWN'` 时不调用 List。把键设成 `SUPPORTED` 之后，Read / Clear 的现有发送测试保持。
- Context Variables：`listContextVariable: 'UNKNOWN'` 时不调用 List，也不把 `rows` 换成空数组。`SUPPORTED` 时仍调用。
- `universeAgentRendererSync.test.ts` 里 `conversationEntryHookPresent` 对 UNKNOWN 仍看方法是否安装的断言保持不变。
