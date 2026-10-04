---
title: "Agents 窗口聊天输入去掉毛玻璃和投影"
type: plan
status: draft
phase: N/A
updated: 2026-10-05
summary: "PRD-028 原则六：Agents 窗口跟在聊天背景上的追问卡改为不透明底，输入聚焦只换 focusBorder，不再毛玻璃、不再投影。不改 Conversation 阅读面。不升 PRD-028。"
---

# Agents 窗口聊天输入去掉毛玻璃和投影

系统规格：[UI 设计原则与规范](../../docs/architecture/cross-cutting/ui-design-principles.md) 原则六与 §5.2。需求：[PRD-028](../../docs/product/requirements.md#prd-028-视觉语言与信息密度) 验收 7。

## 合同

- 只改 Agents 窗口会话聊天里、文档流上的输入面。`src/vs/workbench/contrib/conversation/` 不改。Conversation Composer 的圆角和投影留在原处。
- 跟在 `.has-chat-background` 上、且不是 `.new-chat-in-session` 的 `.new-chat-widget-content`：去掉 `backdrop-filter` 与 `-webkit-backdrop-filter`，去掉 `box-shadow`。背景改为不透明的 `var(--session-view-background)`，与同一背景下的用户气泡同一层底色。低对比描边和 `cornerRadius.large` 保留。
- 三处聚焦投影去掉 `0 4px 16px`：`chatView.css` 的 `.chat-input-container.focused`、`chatInput.css` 的 `.new-chat-input-area:focus-within`、`newChatInSession.css` 的 `.new-chat-in-session .new-chat-input-area:focus-within`。非高对比聚焦把描边换成 `var(--vscode-focusBorder)`。高对比仍用 `contrastActiveBorder` / `contrastBorder`，并且同样 `box-shadow: none`。
- 非高对比聚焦规则的特异性必须盖过 `:not(.hc-black):not(.hc-light) .new-chat-input-area` 的静息描边，否则聚焦色画不出来。高对比规则写在后面，特异性不低于这条聚焦规则，避免被它盖住。
- 会话输入的高对比规则必须是同一节点上的 `.monaco-workbench.hc-black.agent-sessions-workbench`。`hc-black` 与 `agent-sessions-workbench` 加在同一个 workbench 根上，后代选择器 `.hc-black .agent-sessions-workbench` 匹配不到。
- 助手回复的侧向淡出、次级工具条、Quick Input / Run Script 浮层阴影不动。浮层仍允许投影。上游 `chat.css` 的通用聚焦投影不改；Agents 窗口用更具体的 `box-shadow: none` 盖住。
- 不升 PRD-028。本稿保持 `draft`（无单独只读审查、无产品目视签收）。

## 不做

- 不改对话框、引导页、图示浮层、子代理浮层的 `backdrop-filter`。
- 不改 Conversation 透镜、阅读面、过程折。
- 不改发送钮尺寸、Composer 16px 圆角、水族箱。
- 不把自动化卡片或受阻列表的浮层阴影收进本刀。

## 验证

- `chatView.test.ts`：追问卡背景是不透明的 `--session-view-background`，`backdrop-filter` 与 `box-shadow` 为 `none`。三处聚焦的 `box-shadow` 为 `none`；非高对比描边是 `focusBorder`，高对比描边不是 `focusBorder`。
- `sessionsFocusRingScan.test.ts`：三份 CSS 源码不再出现 `backdrop-filter` 或 `4px 16px` 投影。
- 命令：`scripts/test.sh --grep "keeps background-image composer controls|chat composer focus has no drop shadow|sessions chat composer has no glass"`。
