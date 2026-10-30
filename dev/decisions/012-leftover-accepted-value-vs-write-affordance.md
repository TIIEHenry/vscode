---
title: "ADR-012 leftover 显示已接受值，但不得显示可写"
type: decision
status: accepted
phase: N/A
updated: 2026-10-24
summary: "2026-10-24 用户签收。收窄 D383/D450：leftover 不显示未接受的乐观值；引擎已接受的值可以显示，但控件必须保持不可写并说明原因。"
---

# ADR-012 leftover 显示已接受值，但不得显示可写
状态：当前有效。

## Context

[D383](../progress/deferred-gaps.md) 与 [D450](../progress/deferred-gaps.md) 要求 leftover 期间 composer 不看起来像 live 写面。实现把这条约束落在“值”上：`setPermissionMode` 返回 `ok` 或 `switchModel` 返回非空 `resolvedModelId` 之后，只要 `isComposerSessionWriteLive` 为 false，就把权限 / 模型下拉和会话配置退回请求前的值（`conversationLensComposerChrome.ts:1151`、`:1214`）。

这会产生一个比“写面看起来像 live”更严重的问题：引擎已经接受 Permit 或某个模型，界面却显示 Ask 或旧模型。用户下一次看到 Ask，会以为工具将询问；引擎实际按 Permit 执行。这违反权限边界与状态诚实，不是单纯的外观取舍。

实现落地时还发现一处同类边界：更新一代已发出但尚未返回时，旧一代的结果可能先到。旧一代被接受，或旧一代失败 / 为空，都不能把“未发送的新目标”留在界面上；已接受值要用独立的 `confirmedIndex` / `confirmedId` 保存，不能复用会被新目标覆盖的回退点。

根因是两条不同的事实被压在同一个值里：

1. **引擎已接受什么**：`confirmedIndex` / `confirmedId`，由成功返回建立。
2. **此刻能不能写**：`isComposerSessionWriteLive`，由连接、配对和会话就绪度决定。

把第 2 条失败投影成第 1 条回退，会让值撒谎。D383/D450 真正要守的是“不要装成可写”，不是“把已接受的事实改写成旧值”。

## Decision

2026-10-24 用户签收。

1. **值只表达已接受事实。** `setPermissionMode` 返回 `ok: true` 后，`epoch.confirmedIndex` 写成 `sentIndex`；`switchModel` 返回非空 `resolvedModelId` 后，`epoch.confirmedIndex` / `confirmedId` 和该会话的 `modelProfileIdBySessionId` 写成这次送出的值。即使此刻 `isComposerSessionWriteLive` 为 false，也保留这个已接受值。
2. **未接受的值不得显示。** 失败、取消、空 `resolvedModelId`，以及尚未发出的更新一代目标，仍回退到请求前的 `confirmedIndex` / `confirmedId`。leftover 期间不补发未送出的目标。
3. **可写性单独表达。** `isComposerSessionWriteLive` 继续只决定控件启用、门闩文案和是否允许发起新写入。leftover 时权限 / 模型控件必须保持不可写，门闩按既有三分写原因（未连接 / 未就绪 / 引擎不支持），不得因为值已更新而放开控件。
4. **身份绑定。** 已接受值只属于该 `sessionId` 和该次连接 / 会话实例。重连、换引擎、会话重建后重新读取，不把旧 accepted 当当前值；结果返回前已改绑到别的会话时，只更新源会话的配置，不改当前会话的下拉。
5. **D383/D450 不重写。** 两条记录保持 closed 与原文。本 ADR 只收窄它们的解释：leftover 可以显示已接受值，但不能显示可写 affordance。实现处注释改为引用本 ADR，不删除 D383/D450 的历史说明。

## Consequences

### 正面

- 权限和模型的值不再撒谎：用户看到的档就是引擎最后接受的档。
- 可写性仍诚实：leftover 期间控件禁用、门闩可见，不会让人以为可以继续改。
- 改动局部：把 `confirmed` 赋值移到 leftover 判断之前；模型侧新增 `confirmedIndex` / `confirmedId` 记录最后接受值，复用现有 profile map；不需要新 RPC、新状态机或新持久化。

### 负面 / 代价

- leftover 期间下拉会显示新值，视觉上比现在更接近 live；必须靠禁用态和门闩把“不可写”说清楚，不能只改值。
- 现有两条 leftover 测试的期望要改，测试名也要从“restore leftover index”改成“keep accepted value, stay read-only”。
- 需要新增“已接受但当前不可写”的断言，防止以后把值更新和控件启用重新耦合。

## Alternatives

- **保持回退（选择 A）**：值继续撒谎，用户可能误判权限边界。否决。
- **回退并加提示（选择 C）**：提示可被错过，控件值仍是假的；若改成只读标签显示 accepted，实际就是本 ADR 的呈现变体。否决原样 C。
- **leftover 时隐藏控件**：隐藏会丢失“引擎已接受什么”的事实，也改变既有布局与键盘路径。否决。

## References

- 发现与方案：[review-2026-10-24-r07-conversation](../plans/review-2026-10-24-r07-conversation.md)、[方案 r07](../plans/review-2026-10-24-r07-conversation-plan.md)
- 既有决策：D383、D450（[deferred-gaps](../progress/deferred-gaps.md)）
- 系统规格：[composer-and-inbox](../../docs/systems/conversation/composer-and-inbox.md)
- 测试：`conversationLensDisposeGate.test.ts`
