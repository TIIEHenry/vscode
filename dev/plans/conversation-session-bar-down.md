---
title: "会话栏下一级"
type: plan
status: accepted
phase: N/A
updated: 2026-10-02
summary: "会话栏在上一级旁加下一级：弹出直接子代理；根上没有 parentChatId 的 fork 也算孩子。窄宽两钮都留在栏上。对照 HEAD 上一级自检。不升 PRD。"
---

# 会话栏下一级

系统规格：[session-windows](../../docs/systems/conversation/session-windows.md) §4。工作台那句栏位清单：[parts-and-grid](../../docs/systems/workbench/parts-and-grid.md)。

## 合同

- 上一级不改语义：仍是立刻 `goUpOneAgent`。根和 fork 上禁用。
- 下一级紧挨上一级，放在 `.conversation-lens-session-controls` 最左、History 之前。两钮都是 22px。`.is-narrow` / `.is-compact` 都不隐藏，不收进 More，也不塞进 Dock 的权限 / Tune 弹出层。
- 没有直接子代理时下一级禁用。
- 直接子代理 = 本叶 catalog 里 `parentChatId` 等于当前 chat 的条目。当前 chat 是根 `default` 时，再列入 `originKind === 'fork'` 且没有 `parentChatId` 的条目。只列这一层，不列整棵树。
- 当前 chat：子代理对话框开着时用对话框的 chat；否则用活动 `ConversationChatInput` 的 chatId。活动编辑器不是 chat（例如审阅 diff）时没有当前 chat，下一级禁用。
- tool：`openSubAgent`（已有延伸 tab 先聚焦，否则现有对话框）。
- fork 以及其他非 tool：`openExtensionTab`。不调用 `openForkTab`。那个入口会再 `registerForkChat`，把已有 `parentChatId` 清掉，而且不吃本叶 `sessionKey`。本刀不给 `registerForkChat` 补 `parentChatId`。
- 点一项后关弹出层。Escape 与点外面（`mousedown`）关闭。不绑定编辑器 ←→，不拦截鼠标侧键。
- 文案 `localize('conversationLens.sessionBarDownAgent', "下一级")`，title 与 `aria-label` 同一句。
- 不升任何 PRD。方案保持 `accepted`（无产品目视签收）。

## 自检（对照 HEAD `7fe2d92631e` 的上一级）

本轮按任务要求对照现有上一级代码自检，不另派只读审查。

- 挂载仍在 `conversationNavigation.contribution.ts`。上一级已经插在控件最前，并在控件晚出现时用 `MutationObserver` 再放进去。下一级跟在它后面，观察者同一处。
- 上一级只听 catalog 与 close-non-root。下一级同样听，这样切 tab、开关对话框会刷新能否点击。孩子名单变了才关掉已开的弹出层，避免焦点本身把列表收掉。
- `openSubAgent` 已经是「有延伸 tab 则聚焦，否则对话框」。fork 的延伸 tab 本体是 `openExtensionTab`；`openForkTab` 只是先注册再调用它。
- 窄宽 `display: none` 只写在 History / Snapshots / New / Delete / select 上，选择器里没有 `.conversation-agent-up`。下一级类名不得写进这些选择器。
- 弹出层类名用 `.conversation-agent-down-popup`，不复用 `.conversation-lens-dock-more-popup`。
- catalog 同步与 `registerForkChat` 的形状不动。

## 不做

- 不记录 fork 的 `parentChatId`。
- 不把子代理列表放进 Dock `…`。
- 不改编辑器区 ←→ / 关掉延伸标签。
- 不升 PRD，不把本方案标成 `implemented`。
