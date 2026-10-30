---
title: "方案 r12：views-notifications"
type: plan
status: accepted
phase: N/A
updated: 2026-10-08
summary: "2026-10-08 用户签收。hold 2，drop 0，weaken 0。消息更新不再静默折叠仍展开的通知，过窄时测宽不再夹成 0。不升 implemented，不升 PRD。"
---
# 方案 r12：views-notifications

状态：执行中。
覆盖需求：无（正文未引用需求编号）。


hold 2，drop 0，weaken 0。

## r12-1（hold，中）

问题类：变宽后刚好排成一行的已展开通知，下一次消息更新会静默折叠，模型与 DOM 脱节，再变窄时多行正文被单行高度裁掉。

不变量：没有 primary actions、也没有 source 的通知，用户展开后，只要用户没有折叠，`expanded` 在变宽、消息更新、再变窄之后仍为 true。变窄后的行高回到按当前宽度测出的多行高度，列表行上的 `expanded` class 与模型一致。无动作且已展开时仍因 `_expanded` 为 sticky。带 source 或 primary actions 时，展开高度继续在正文之外另加一行；`canCollapse === false` 时 `collapse` 仍直接返回。

要动的符号或文件：`NotificationsList.updateNotificationHeight`（`src/vs/workbench/browser/parts/notifications/notificationsList.ts`）。它是通知中心 `NotificationViewItemContentChangeKind.MESSAGE` 分支和 toast 同名分支共用的测高入口。此处对 `NotificationsListDelegate.getHeight` 传入与 `layout` 相同的跳过折叠标志。

怎么改：消息更新只按当前容器宽度重算行高，不把「当前宽度下测高等于单行」当成用户已折叠。跳过折叠后模型保持展开，随后 `layout` 仍会重算 `item.expanded` 为真的项，变窄时行高能再增加。不要在 `getHeight` 里把 `collapse(true)` 改成同步 `collapse()`：展开事件会让中心走 `updateNotificationsList`、toast 走 `onDidChangeExpansion`，在测高过程中重入列表。自动折叠若以后仍需要，放在测高返回之后，由中心或 toast 的消息分支显式调用不跳过事件的 `collapse()`，让现有整行重绘去掉 `expanded` class 并换工具条；本条不把这步放进 `getHeight`。

明确不改：不改 `layout` 里已经传入跳过折叠的测高；不改 `NotificationViewItem.collapse` 的 `skipEvents` 语义；不改 `render` 里按模型切换 `expanded` class 的位置；不改消息文本的 `onDidChangeContent` 局部刷新，也不改「溢出状态未变就不重建工具条」；不改 source / primary 的额外行高，也不改 `white-space` 规则。

怎样本地验证：`./scripts/test.sh --run src/vs/workbench/test/browser/notificationsList.test.ts`。现有 `layout does not collapse expanded notification when window widens`、`expanded notification height grows when the list is narrower than 450`、`collapsed message growth shows expand action`、`streaming message does not recreate secondary action toolbar when overflow state is unchanged` 仍通过。同一文件新增：无 source、无 primary 的长消息先展开，`layout(200)` 后行高大于 `DEFAULT_NOTIFICATION_ROW_HEIGHT` 且行带 `expanded`；再 `layout` 到该正文能排进一行的宽度；`updateMessage` 成另一条在该宽度下仍是一行的正文，并调用 `updateNotificationHeight`。断言 `expanded` 仍为 true，行仍带 `expanded`。再 `layout(200)`，断言行高回到第一次的多行高度。

## r12-2（hold，低）

问题类：列表容器比图标和工具条占位还窄、但宽度仍大于 0 时，测宽被夹成 0，展开行高按逐字折行被撑得远高于可见正文。

不变量：`clientWidth` 为 0 或父节点还不在时，测量宽度仍退回 450。容器宽为正、且扣掉现有占位后剩余小于等于 0 时，这次不测量，首选正文高度就是 `LINE_HEIGHT`，展开行高停在单行；有 source 或 primary actions 时仍由 `getHeight` 另加一行。剩余宽度大于 0 时，扣减式与现在相同：无进度且可折叠至少两个动作，扣 96px；再有 secondary 时三个动作，扣 122px。

要动的符号或文件：`NotificationsListDelegate.computePreferredHeight`（`src/vs/workbench/browser/parts/notifications/notificationsViewer.ts`）。测量节点仍是 `.notification-offset-helper`，其 `word-wrap: break-word` 与绝对定位留在 `notificationsList.css`。

怎么改：先用现有扣减式算剩余宽度。`containerWidth` 大于 0 且剩余小于等于 0 时，不要把测量节点宽度写成 0，也不要往里面渲染正文；直接返回 `LINE_HEIGHT`。剩余大于 0 时照旧写入该宽度并读 `offsetHeight` / `scrollHeight`。

明确不改：不改 `|| 450` 对 0 宽的退路；不改动作计数（关闭、展开/折叠、secondary、进度时不计入关闭）；不改正常宽度下的折行测高；不改 r12-1 的跳过折叠；不改偏移节点的 CSS。

怎样本地验证：同上 `./scripts/test.sh --run src/vs/workbench/test/browser/notificationsList.test.ts`。现有 `expanded notification height grows when the list is narrower than 450`（`layout(200)`，剩余宽度仍大于 0）仍通过，且 200px 行高仍大于 450px 行高。同一文件新增：无进度、可折叠、无 source、无 primary 的长消息展开后，`layout` 到小于上述占位扣减的正宽度（例如 50）。断言行高等于 `DEFAULT_NOTIFICATION_ROW_HEIGHT`，并且小于 `layout(200)` 时的展开行高。
