---
title: "审查 r05：notifications-dialogs"
type: reference
status: draft
phase: N/A
updated: 2026-10-06
summary: "窄窗展开高度按 450 算会裁切；消息变长不补展开钮；无障碍改写动作；顶右铃无未读；空白双击崩溃。"
---

# 审查 r05：notifications-dialogs
状态：草案。
覆盖需求：无（正文未引用需求编号）。


范围：`src/vs/workbench/browser/parts/notifications`、`src/vs/workbench/browser/parts/dialogs`。已对照 [review-2026-10-06.md](review-2026-10-06.md) 及 r01–r16 发现稿；无同路径命中。dialogs 活码未检出符合门禁的用户可见缺陷。

## r05-1 中

- 症状：窗口变窄后展开通知，正文底部被裁切，需的行高不够。
- 引用：

```116:116:src/vs/workbench/browser/parts/notifications/notificationsViewer.ts
		this.offsetHelper.style.width = `${450 /* notifications container width */ - (10 /* padding */ + 30 /* severity icon */ + (actions * 30) /* actions */ - (Math.max(actions - 1, 0) * 4) /* less padding for actions > 1 */)}px`;
```

- 为什么是问题：列表实际宽度由 `notificationsCenter.layout` / `notificationsToasts.layoutLists` 按窗口收成小于 450。测高却固定按 450 算，字换行更少，`getHeight` 偏小，展开行矮于真实内容，出现裁切。
- 方向：用当前列表/容器宽度测高，不要写死 450。

## r05-2 中

- 症状：折叠通知的文案事后变长并出现省略号，却没有展开按钮，只能靠悬停看全文。
- 引用：

```429:440:src/vs/workbench/browser/parts/notifications/notificationsViewer.ts
		this.inputDisposables.add(notification.onDidChangeContent(event => {
			switch (event.kind) {
				case NotificationViewItemContentChangeKind.SEVERITY:
					this.renderSeverity(notification);
					break;
				case NotificationViewItemContentChangeKind.PROGRESS:
					this.renderProgress(notification);
					break;
				case NotificationViewItemContentChangeKind.MESSAGE:
					this.renderMessage(notification, messageCustomHover);
					break;
			}
		}));
```

- 为什么是问题：首次 `render` 才会用 `messageOverflows` 调用 `renderSecondaryActions`。消息变更只重绘正文，不重算工具条；由短变长后 `canCollapse` 仍为真，但展开/折叠动作不会出现。
- 方向：MESSAGE 变更后复用 `renderMessage` 的溢出结果再跑一遍 `renderSecondaryActions`。

## r05-3 中

- 症状：打开通知无障碍视图后再回界面，主/次按钮的 `keepOpen` 失效被直接关掉，齿轮菜单里动作图标变成铃铛。
- 引用：

```112:119:src/vs/workbench/browser/parts/notifications/notificationAccessibleView.ts
	if (actions) {
		for (const action of actions) {
			action.class = ThemeIcon.asClassName(Codicon.bell);
			const initialAction = action.run;
			action.run = () => {
				initialAction();
				notification.close();
			};
		}
	}
```

- 为什么是问题：这里改的是 `notification.actions` 里的同一批对象。视图关掉后改写仍在；按钮路径会走被包过的 `run`（总是 `close`），次要动作的 `class` 也留在菜单上。
- 方向：拷贝动作再改 `class`/`run`，或只在无障碍提供者里包一层，不动原稿。

## r05-4 中

- 症状：通知位置为右上时，标题栏铃始终是普通铃，没有未读圆点，也看不出免打扰；状态栏铃已被撤掉。
- 引用：

```104:111:src/vs/workbench/browser/parts/notifications/notificationsStatus.ts
		// For top-right position, hide the status bar bell entirely
		// (it is shown in the title bar instead via menu registration)
		const position = getNotificationsPosition(this.configurationService);
		if (position === NotificationsPosition.TOP_RIGHT) {
			this.notificationsCenterStatusItem?.dispose();
			this.notificationsCenterStatusItem = undefined;

			this.currentAlignment = undefined;
		}
```

```331:336:src/vs/workbench/browser/parts/notifications/notificationsCommands.ts
	MenuRegistry.appendMenuItem(MenuId.TitleBar, {
		command: {
			id: TOGGLE_NOTIFICATIONS_CENTER,
			title: localize('toggleNotifications', "Toggle Notifications"),
			icon: Codicon.bell,
		},
```

- 为什么是问题：状态栏条目会按 `newNotificationsCount` / 进度 / 免打扰在 `bell`、`bell-dot`、`bell-slash` 间切换；右上改走标题栏后只注册了静态 `Codicon.bell`，未读与免打扰状态不再反映到可见控件。
- 方向：标题栏铃随未读与过滤状态切换图标，或右上仍保留可更新的状态栏条目。

## r05-5 低

- 症状：通知中心列表低于最大高度而留下空白时，双击空白处会抛异常，手势中断。
- 引用：

```121:122:src/vs/workbench/browser/parts/notifications/notificationsList.ts
		// Toggle on double click
		this._register((list.onMouseDblClick(event => (event.element as INotificationViewItem).toggle())));
```

- 为什么是问题：`event.element` 在点到行外空白时可以为空，却直接 `.toggle()`，运行时 TypeError。
- 方向：无 element 时直接返回。
