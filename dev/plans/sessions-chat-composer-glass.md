---
title: "Agents 窗口聊天输入去掉毛玻璃和投影"
type: plan
status: implemented
phase: N/A
updated: 2026-10-16
summary: "追问卡去毛玻璃和投影已落；工作态聚焦描边被 40% 混色覆盖问题已于 cd93865b15a 修正为 focusBorder 并补齐状态测试。扫描测试与单元测试全部通过。不升 PRD-028。"
---

# Agents 窗口聊天输入去掉毛玻璃和投影

> **落地：** `status: implemented`。追问卡去毛玻璃和投影已落；工作态聚焦描边被 40% 混色覆盖问题已于 `cd93865b15a` 修正为 `focusBorder` 并补齐状态测试。扫描测试与单元测试全部通过。不升 PRD-028。

落地确认（2026-10-16）：追问卡去毛玻璃和投影已落；工作态聚焦描边被 40% 混色覆盖问题已于 commit `cd93865b15a` 修正为 `focusBorder` 并补齐状态测试。扫描测试与单元测试已全部通过，状态正式对齐为 `implemented`。不升 PRD-028。

系统规格：[UI 设计原则与规范](../../docs/architecture/cross-cutting/ui-design-principles.md) 原则六与 §5.2。需求：[PRD-028](../../docs/product/requirements.md#prd-028-视觉语言与信息密度) 验收 7。

## 合同

- 只改 Agents 窗口会话聊天里、文档流上的输入面。`src/vs/workbench/contrib/conversation/` 不改。Conversation Composer 的圆角和投影留在原处。
- 跟在 `.has-chat-background` 上、且不是 `.new-chat-in-session` 的 `.new-chat-widget-content`：去掉 `backdrop-filter` 与 `-webkit-backdrop-filter`，去掉 `box-shadow`。背景改为不透明的 `var(--session-view-background)`，与同一背景下的用户气泡同一层底色。低对比描边和 `cornerRadius.large` 保留。
- 三处聚焦投影去掉 `0 4px 16px`：`chatView.css` 的 `.chat-input-container.focused`、`chatInput.css` 的 `.new-chat-input-area:focus-within`、`newChatInSession.css` 的 `.new-chat-in-session .new-chat-input-area:focus-within`。非高对比聚焦把描边换成 `var(--vscode-focusBorder)`。高对比仍用 `contrastActiveBorder` / `contrastBorder`，并且同样 `box-shadow: none`。
- `.chat-input-container.working.focused` 是可达状态；上游 `ChatWidget` 在请求进行中会加 `working`。该状态也必须使用 `focusBorder`（高对比仍用 `contrastActiveBorder` / `contrastBorder`），不能由更高特异性的 40% 不透明度混色覆盖；原则四要求焦点色不低于 60% 不透明度。
- 非高对比聚焦规则的特异性必须盖过 `:not(.hc-black):not(.hc-light) .new-chat-input-area` 的静息描边，否则聚焦色画不出来。高对比规则写在后面，特异性不低于这条聚焦规则，避免被它盖住。
- 会话输入的高对比规则必须是同一节点上的 `.monaco-workbench.hc-black.agent-sessions-workbench`。`hc-black` 与 `agent-sessions-workbench` 加在同一个 workbench 根上，后代选择器 `.hc-black .agent-sessions-workbench` 匹配不到。
- 助手回复的侧向淡出、次级工具条、Quick Input / Run Script 浮层阴影不动。浮层仍允许投影。上游 `chat.css` 的通用聚焦投影不改；Agents 窗口用更具体的 `box-shadow: none` 盖住。
- 不升 PRD-028。本稿已落地为 `implemented`（工作态聚焦描边问题已于 `cd93865b15a` 修正为 `focusBorder` 并补齐测试，测试全部通过）。

## 不做

- 不改对话框、引导页、图示浮层、子代理浮层的 `backdrop-filter`。
- 不改 Conversation 透镜、阅读面、过程折。
- 不改发送钮尺寸、Composer 16px 圆角、水族箱。
- 不把自动化卡片或受阻列表的浮层阴影收进本刀。

## 验证

- `chatView.test.ts`：追问卡背景是不透明的 `--session-view-background`，`backdrop-filter` 与 `box-shadow` 为 `none`。三处聚焦的 `box-shadow` 为 `none`；普通与 `.working.focused` 非高对比描边都是 `focusBorder`，高对比描边使用对比边框。`hc-black` 和 `hc-light` 均覆盖。
- `sessionsFocusRingScan.test.ts`：三份 CSS 源码不再出现 `backdrop-filter` 或 `4px 16px` 投影。
- 命令：`scripts/test.sh --grep "keeps background-image composer controls|chat composer focus has no drop shadow|sessions chat composer has no glass"`。

## 只读审查与改稿

实施前未完成规则 16 的独立审查；2026-10-05 独立只读追审确认主体合同与实现基本一致，但指出 `.working.focused` 的 40% 混色被实际使用，违反上文焦点合同与原则四。合同和验证已补此状态；追审不能追溯补成实施前门禁。2026-10-16 落地确认：该问题已于 commit `cd93865b15a` 完成修复并补齐状态测试，相关测试全部通过，状态对齐为 `implemented`。
