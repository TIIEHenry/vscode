---
title: "对话阅读面"
type: plan
status: accepted
phase: N/A
updated: 2026-10-05
summary: "对话阅读面不再显示 You / Agent；非 default 助手只在首行用 11px 弱化代理名。用户气泡无描边、无投影。轨迹角色列与 Inspector 标题不再全大写，状态徽标改淡底。不升 PRD-028。"
---

# 对话阅读面

产品合同是已签收的 [PRD-028](../../docs/product/requirements.md#prd-028-视觉语言与信息密度) 用户陈述与验收 5，视觉正文是 [UI 设计原则与规范](../../docs/architecture/cross-cutting/ui-design-principles.md) §5.1 与 §5.3 的 Inspector 两句。本方案只收这一刀，不覆盖整份 PRD-028。

## 合同

- 用户回合不显示可见 "You"。助手回合不显示可见 "Agent"，不放头像，正文直接起排。
- 助手 `agentId` 存在且不是 `default` 时，回合首行用 11px、字重 400、`descriptionForeground` 显示这个代理名（`.conversation-lens-turn-source`）。没有可显示的来源时不造空标题行。
- 读屏名仍由文章上的 `aria-label` 提供（`getConversationTurnAriaLabel` / `getConversationEntryAriaLabel`）。内层不再套一层角色 `aria-label`。
- 用户气泡保持右对齐。`border: none`，`box-shadow: none`，圆角 `cornerRadius.large`。键盘焦点是 1px `focusBorder` 描边，不用投影当焦点。高对比主题仍用 `contrastBorder`。
- 乐观发送行仍写 Sending…，标题里不含 You。已落盘且挂了轨迹按钮时，标题行只放该按钮；按钮可见文案仍是 "View in trajectory"，类名 `conversation-lens-turn-header-trajectory` 保留。
- 轨迹表类型列保留角色词（You、Agent，以及思考 / 工具 / 错误等既有词），去掉 `text-transform: uppercase`。
- Inspector 区段标题正常大小写、12px（`fontSize-label1`）、字重 600。状态徽标淡底：`descriptionForeground` 混 12% 透明，不用 `badge.background`。状态词仍是代码里的 Title Case。
- 思考、工具、错误、只读、提问座位的可见角色词本刀不改文案，只去掉同一文件里回合头、轨迹角色、Inspector 标题和状态徽标的全大写。

## 不做

- 不改 Composer 的 16px 圆角和 `box-shadow: 0 4px 12px`。`conversationLensCssScan.test.ts` 锁着这两项，规范里的 8px、不投影留到单独一刀。
- 不改图示选项徽标（`conversationVisualize.css`）和 Engine 技能 / 目录分组标签（`enginePreferencesPane.css`）上残留的全大写。
- 不改过程折、权限座位、提问座位的行为，不改 `chatBackground`。
- 不升 PRD-028，不把本方案标成 `implemented`。

## 自检

本轮对照已签收的 §5.1 / §5.3 实现，不另派只读审查。产品选择已在 2026-09-28 随 PRD-028 签收，本稿不新增取舍。

- 生产时间线文章标签在 `conversationTimelineItemHost.ts` 的 `setChrome`，根标签在 `conversationTimelineHost.ts`。去掉可见 You / Agent 不改这两处。
- `getConversationTurnRoleLabel` 仍给独立思考 / 工具行和诚实行用。用户 / 助手阅读行改走 `readingTurnSourceName`。
- 用户气泡的高对比规则留在普通焦点规则之后，本刀不删。
- 置顶用户气泡本来就是无描边、无投影，本刀不改。
