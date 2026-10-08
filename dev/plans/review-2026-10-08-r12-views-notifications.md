---
title: "审查 r12：views-notifications"
type: reference
status: draft
phase: N/A
updated: 2026-10-08
summary: "2 条，最重是变宽后的消息更新把仍显示为展开的通知静默折叠，再变窄时正文被裁切。"
---

# 审查 r12：views-notifications

对照已提交改动与 10-06 的 r05、r06。固定 450 测高、消息变长不出展开、空目标双击、标题栏铃铛、欢迎焦点、树消息清空、过滤容器下标，都已按当时方案改过，不再报。

## r12-1 中

- 症状：较窄时展开、变宽后正文已能排进一行的通知，下一次消息更新后仍显示折叠按钮；窗口再变窄时多行正文被裁成一行。
- 位置：`src/vs/workbench/browser/parts/notifications/notificationsList.ts` 第 213、257–261 行；`src/vs/workbench/browser/parts/notifications/notificationsViewer.ts` 第 96–97 行
- 引用：`getHeight(item, true)`；`notification.collapse(true /* skip events, no change in height */)`
- 为什么是问题：`layout` 对已展开项测高时跳过折叠，变宽后模型仍是展开，行高写成单行，渲染器不会因此重绘，工具条继续显示折叠。中心和 toast 在消息变化且当时仍展开时调用 `updateNotificationHeight`（`notificationsCenter.ts` 第 333–336 行，`notificationsToasts.ts` 第 327–330 行），那里的 `getHeight(item)` 不传跳过标志。测高回到单行就 `collapse(true)`，注释写明不发事件。整行重绘只挂在展开/折叠事件上（中心第 340–342 行，toast 第 315–317 行），所以 DOM 仍带着 `expanded`。之后 `layout` 只重算 `item.expanded` 为真的项，变窄时行高不再增加；展开样式下正文是 `white-space: normal`，多出来的行被单行高度裁掉。
- 方向：消息更新这条测高在「只是变宽导致变成单行、用户并未折叠」时也要跳过静默折叠；若决定折叠，必须发出展开事件让整行重绘。

## r12-2 低

- 症状：通知列表窄到扣掉图标和工具条占位后没有剩余宽度时，展开行高会被测得远高于可见正文。
- 位置：`src/vs/workbench/browser/parts/notifications/notificationsViewer.ts` 第 116–118 行
- 引用：`const messageWidth = Math.max(containerWidth - (10 /* padding */ + 30 /* severity icon */ + (actions * 30) /* actions */ - (Math.max(actions - 1, 0) * 4) /* less padding for actions > 1 */), 0);`
- 为什么是问题：无进度且可折叠时动作数至少为 2，扣减是 96px；再有次要动作时是 122px。容器 `clientWidth` 大于 0 但小于该扣减时，测量宽度变成 0（真正的 0 仍退回 450）。偏移节点是绝对定位且 `word-wrap: break-word`（`notificationsList.css` 第 22–26 行），没有可用行宽时词会被拆开，`offsetHeight` 按大量折行变大，展开行被撑得很高。
- 方向：测量宽度不要夹到 0；容器比占位还窄时按单行高返回，或保留一个能放下一个词的最小宽度。
