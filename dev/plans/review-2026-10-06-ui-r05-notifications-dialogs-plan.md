---
title: "方案 r05：notifications-dialogs"
type: plan
status: draft
phase: N/A
updated: 2026-10-06
summary: "hold 4，weaken 1，drop 0。窄窗展开仍按 450 测高；消息变长不补展开钮；无障碍改写原动作；右上铃无未读；空白双击降级。"
---

# 方案 r05：notifications-dialogs
状态：草案。
覆盖需求：无（正文未引用需求编号）。


hold 4，weaken 1，drop 0。dialogs 发现稿无条目，本方案不改 `src/vs/workbench/browser/parts/dialogs`。

## r05-1

- 问题类：展开通知的测高把容器宽度写死为 450，列表窄于 450 时行高偏小，正文被裁切。
- 不变量：`NotificationsListDelegate.getHeight` 在 `expanded` 时，用当前 `notifications-list-container` 的布局宽度减去现有 chrome 公式测正文高度。容器尚未插入文档或 `clientWidth` 为 0 时仍用 450。测出的消息宽度小于 0 时按 0。`NotificationsList.layout` 写完 `style.width` 之后，对已展开项用新宽度重算高度并各调用一次 `updateElementHeight`，再 `list.layout()` 一次。折叠项仍直接返回 `ROW_HEIGHT`。中心与 toast 的宽度上限仍是 `Math.min(450, 工作台宽度 - 16)`。
- 要动的符号或文件：`NotificationsListDelegate.computePreferredHeight`（`src/vs/workbench/browser/parts/notifications/notificationsViewer.ts` 第 116 行，把 `450` 换成 `offsetHelper` 父节点 `clientWidth`，0 则回退 450）。`NotificationsList.layout`（`notificationsList.ts` 第 244–253 行）在设置 `listContainer.style.width` 之后、调用 `this.list.layout()` 之前，对 `viewModel` 里 `expanded` 的项调用 `list.updateElementHeight(index, listDelegate.getHeight(item))`。不要在循环里调用 `NotificationsList.updateNotificationHeight`（第 201–209 行），那个方法每次都会再 `list.layout()`。
- 明确不改什么：`NotificationsCenter.MAX_DIMENSIONS`（`notificationsCenter.ts` 第 40 行）与 `NotificationsToasts.MAX_WIDTH`（`notificationsToasts.ts` 第 50 行）；`notificationsCenter.layout` 第 411–441 行和 `computeMaxDimensions` 第 625–650 行的可用宽度计算；第 116 行公式里 padding、severity、action 的常数；`.notification-offset-helper` 的 CSS（`notificationsList.css` 第 22–27 行）；折叠行高。
- 怎样本地验证：没有覆盖测宽的测试。`src/vs/workbench/test/browser/notificationsList.test.ts` 已把列表挂进 `document.body`。新测试描述写 `expanded notification height grows when the list is narrower than 450`。无 primary、无 source 的长英文消息（含空格，能在 200px 与 450px 折出不同行数），先 `expand()`，再 `layout(450)` 后 `updateNotificationsList`，记下该行 `style.height`；再 `layout(200)`。断言 200px 时的行高大于 450px。`layout` 自身要完成重算，测试在第二次 `layout` 之后不要再手动 `updateNotificationHeight`。`scripts/test.sh --grep "expanded notification height grows when the list is narrower than 450"`。

## r05-2

- 问题类：折叠通知的消息事后变长并溢出时，展开动作不会补上。
- 不变量：`NotificationTemplateRenderer` 在 `NotificationViewItemContentChangeKind.MESSAGE` 时用 `renderMessage` 的返回值再跑 `renderSecondaryActions`。无 primary（`canCollapse` 为真，`notifications.ts` 第 574–576 行与第 607–616 行）、未展开、无 source、且 `messageOverflows` 为真时，工具条含 `ExpandNotificationAction`。消息再变短且不再溢出时，该动作消失。已展开仍是折叠动作；有 source 时展开动作本来就在（第 483–484 行），消息变更后仍在。有 primary 时 `canCollapse` 为假，消息变长也不出现展开动作。重复 MESSAGE 不累积 `ConfigureNotificationAction`。
- 要动的符号或文件：`NotificationTemplateRenderer.render` 的 MESSAGE 分支（`notificationsViewer.ts` 第 437–438 行）改为 `const messageOverflows = this.renderMessage(...); this.renderSecondaryActions(notification, messageOverflows);`。`renderSecondaryActions`（第 468 行）开头清空本渲染器上单独的 `DisposableStore`，`ConfigureNotificationAction` 只放进这个 store，不再 `inputDisposables.add`。store 用 `this._register` 挂到渲染器生命周期。
- 明确不改什么：SEVERITY 与 PROGRESS 分支；`notificationsCenter.ts` 第 333–336 行和 `notificationsToasts.ts` 第 327–330 行在展开时更新行高的路径；`canCollapse` 的定义；折叠消息的 CSS（`.monaco-list` 的 `white-space: nowrap` 在 `list.css` 第 10 行，省略号在 `notificationsList.css` 第 52–58 行，展开才 `white-space: normal` 在第 78–80 行）。
- 怎样本地验证：没有这条路径的测试。新测试放在 `notificationsList.test.ts`，描述写 `collapsed message growth shows expand action`。列表 `layout` 到有限宽度并插入无 source、无 primary 的短消息，断言工具条没有 aria-label `Expand Notification`（`ExpandNotificationAction.LABEL`）。`updateMessage` 成长文本后，不调用 `updateNotificationsList`，断言该 aria-label 出现。再 `updateMessage` 回短文本，断言消失。另有一条带 primary 的通知，`updateMessage` 成长文本后仍没有该 aria-label。工具条 CSS 在未悬停时 `display: none`（第 85–93 行），节点仍在，用 `querySelector` 读 aria-label，不要依赖可见性。`scripts/test.sh --grep "collapsed message growth shows expand action"`。

## r05-3

- 问题类：打开通知无障碍视图会改写原动作的 `class` 和 `run`，回到界面后 `keepOpen` 失效，齿轮菜单里的次要动作带上铃铛图标。
- 不变量：`getActionsFromNotification` 返回的动作不是 `notification.actions` 里的同一批对象。原 `ChoiceAction` 的 `class` 与 `run` 在调用前后是同一引用。拷贝的 `run` 以方法调用执行原 `action.run()`（保留 `this`，从而跑到 `ChoiceAction` 构造时放进 `_actionCallback` 的 `choice.run` 与 `onDidRun`，`notifications.ts` 第 754–762 行），然后再 `notification.close()`。拷贝的 `class` 默认是铃铛；`label` 含 `Manage Extension` 的拷贝改为齿轮。原动作供主按钮（`notificationsViewer.ts` 第 521–530 行的 `keepOpen` 判断）和齿轮菜单（第 273–274 行推入的 secondary，菜单在 `menu.ts` 第 305 行以 `icon: true` 画 `action.class`）继续使用。
- 要动的符号或文件：`getActionsFromNotification`（`notificationAccessibleView.ts` 第 112–125 行）。不要 `action.class = ...` 和 `action.run = ...`。为 primary、secondary 各做一个新的 `IAction`：字段从原动作读取，`run` 闭包调用原对象的 `action.run()`。导出该函数供测试引用。`Manage Extension` 的齿轮类名只写在拷贝上（第 122–125 行）。
- 明确不改什么：`ChoiceAction`；`renderButtons` 里 `keepOpen` 为真则不 `close` 的判断（第 528–529 行）；`notificationService.ts` 里 `onDidRun` 对 `keepOpen` 的关闭（约第 298–304 行）；无障碍工具条 `_updateToolbar` 在 `class` 为空时补 `primitiveSquare`（`accessibleView.ts` 第 766–770 行）——拷贝已经有 `class`，这条不会改到原稿；主按钮不读取 `action.class` 画图标（`renderButtons` 只设 `button.label`）。
- 怎样本地验证：没有 `notificationAccessibleView` 的测试。新文件 `src/vs/workbench/test/browser/notificationAccessibleView.test.ts`，描述写 `accessible view does not mutate notification actions`。`NotificationViewItem.create` 带一个 `keepOpen: true` 的 `ChoiceAction`，`choice.run` 里置位。记下 `action.run` 与 `action.class`（新建时为 `undefined`）。调用 `getActionsFromNotification` 后二者不变，返回数组里的对应项不是原引用。执行返回项的 `run`，断言 `choice.run` 已跑且通知 `onDidClose` 触发。`IAccessibilitySignalService` 用只含空 `playSignal` 的替身。`scripts/test.sh --grep "accessible view does not mutate notification actions"`。

## r05-4

- 问题类：通知位置为右上时，标题栏铃钉死为普通铃，未读、进行中和免打扰都看不出来。
- 不变量：右上且 `workbench.notifications.showInTitleBar` 为真时，标题栏上恰好一个铃，图标与状态栏同一套布尔：`hasAttention = notificationsInProgress > 0 || newNotificationsCount > 0`，`doNotDisturb = getFilter() === NotificationsFilter.ERROR`（无 source 参数）。四态为 `bell`、`bell-dot`、`bell-slash`、`bell-slash-dot`（`codiconsLibrary.ts` 第 149、412、530–531 行）。未读计数、打开中心清零（`notificationsStatus.ts` 第 190 行）和「中心或 toast 可见则不计进行中」（第 76–80 行）保持现有规则。右上仍不创建状态栏条目。
- 要动的符号或文件：在 `src/vs/workbench/common/contextkeys.ts` 通知区（第 166–170 行附近）增加 `notificationHasAttention`、`notificationDoNotDisturb` 两个布尔 `RawContextKey`，默认 false。`NotificationsStatus` 注入 `IContextKeyService`，在 `updateNotificationsCenterStatusItem` 用上面两个布尔 `set` context key；状态栏文案仍由这两个布尔选出与现在相同的 `$(bell)` / `$(bell-dot)` / `$(bell-slash)` / `$(bell-slash-dot)`。导出 `notificationBellIcon(hasAttention, doNotDisturb): ThemeIcon`。`registerNotificationCommands` 里替换第 331–343 行那一条静态 `Codicon.bell`：对四种布尔组合各 `appendMenuItem`，`icon` 来自 `notificationBellIcon`，`when` 是现有的位置与按钮条件再与对应 context key 的肯定或否定相与。命令 id 仍是 `notifications.toggleList`，group `navigation`，order `10000`。
- 明确不改什么：右上分支对 `notificationsCenterStatusItem` 的 `dispose`（第 107–112 行）；底左、底右的状态栏对齐；`newNotificationsCount` 的加减；按来源的过滤不改变全局 `getFilter()` 时标题栏不画铃铛斜杠；`workbench.ts` 与 `sessions/browser/workbench.ts` 里 `createInstance(NotificationsStatus, model)` 的实参；按钮设置默认 true（`workbench.contribution.ts` 第 664–667 行）与位置默认底右（第 652 行）。
- 怎样本地验证：`notificationsPosition.test.ts` 里 `top-right position hides status bar bell` 只断言文件内局部函数返回 `'hidden'`，不覆盖 `NotificationsStatus` 或标题栏图标。新测试放在 `src/vs/workbench/test/browser/notificationsStatus.test.ts`。`notificationBellIcon` 四种组合的 `id` 分别是 `bell`、`bell-dot`、`bell-slash`、`bell-slash-dot`。再用 `workbenchInstantiationService` 创建 `NotificationsStatus`：`IStatusbarService` 按 `conversationSessionStatusBar.test.ts` 那种记录 `addEntry` / `dispose` 的替身；`INotificationService` 不要用 `TestNotificationService`（`getFilter` 固定 `OFF`，`setFilter` 为空，`onDidChangeFilter` 为 `Event.None`，见 `testNotificationService.ts` 第 11、43–46 行），换成可改 `getFilter` 并触发 `onDidChangeFilter` 的替身。`MockContextKeyService.contextMatchesRules` 恒为 false（`mockKeybindingService.ts` 第 51–52 行），不断言菜单可见性，只读 `getContextKeyValue`。位置先设为 `top-right` 再构造，断言状态栏没有 `status.notifications`。模型在中心不可见时 `addNotification` 后 `notificationHasAttention` 为 true，图标函数得到 `bell-dot`。替身把全局 filter 设为 `ERROR` 并触发事件后，`notificationDoNotDisturb` 为 true，图标为 `bell-slash-dot`。不要在测试里调用 `registerNotificationCommands`，避免命令表再挂一份 handler。`scripts/test.sh --grep notificationBellIcon`。

## r05-5 降级

发现稿写的是列表矮于最大高度时，双击底部空白会崩。布局对不上，降级。无行目标上的空引用仍然成立，修这一处。

- 降级说明（读到的反证）：`NotificationsList.layout`（第 244–253 行）只写 `maxHeight`，不把高度撑到最大值。`.monaco-list` 是 `height: 100%`（`list.css` 第 6–8 行）。父级 `.notifications-list-container` 与 `.notifications-center` 都没有固定高度，百分比高度按内容收缩，短列表内部没有一条可双击的空白带。`IListMouseEvent.element` 的类型是 `T | undefined`（`list.ts` 第 46 行）。`toMouseEvent` 在找不到 `data-index` 时把 `element` 留空（`listView.ts` 第 1165–1169、1541–1559 行）。滚动条在 `.monaco-list` 里且没有 `data-index`，双击会走到第 122 行。同文件上下文菜单已在第 108–111 行对空元素返回。
- 问题类：双击通知列表里没有行元素的目标时，对空 `element` 调用 `toggle`，抛 TypeError。
- 不变量：`onMouseDblClick` 在 `event.element` 为空时返回。有元素时仍调用 `toggle()`。
- 要动的符号或文件：`NotificationsList.createNotificationsList` 里第 122 行的双击回调，先判断 `event.element`。
- 明确不改什么：第 108–119 行的上下文菜单；`NotificationViewItem.toggle`；列表高度与 `maxHeight` 的计算。
- 怎样本地验证：`notificationsList.test.ts` 新测试描述写 `double click without a row does not throw`。无 primary 的通知插入并 `layout`。向 `.monaco-list` 派发 `dblclick`（目标就是该节点，没有 `data-index`），断言不抛，且 `expanded` 仍为 false。再向 `.monaco-list-row` 派发 `dblclick`，断言 `expanded` 为 true。`scripts/test.sh --grep "double click without a row does not throw"`。
