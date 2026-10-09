/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Action } from '../../../base/common/actions.js';
import { ExpandNotificationAction } from '../../browser/parts/notifications/notificationsActions.js';
import { NotificationAccessibilityProvider, NotificationsList } from '../../browser/parts/notifications/notificationsList.js';
import { NotificationViewItem, INotificationsFilter, INotificationViewItem, NotificationsModel } from '../../common/notifications.js';
import { Severity, NotificationsFilter } from '../../../platform/notification/common/notification.js';
import { IKeybindingService } from '../../../platform/keybinding/common/keybinding.js';
import { IConfigurationService } from '../../../platform/configuration/common/configuration.js';
import { TestConfigurationService } from '../../../platform/configuration/test/common/testConfigurationService.js';
import { MockKeybindingService } from '../../../platform/keybinding/test/common/mockKeybindingService.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { DEFAULT_NOTIFICATION_ROW_HEIGHT, onDidChangeNotificationRowHeight, setNotificationRowHeight } from '../../browser/parts/notifications/notificationsViewer.js';
import { DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { workbenchInstantiationService } from './workbenchTestServices.js';
import { NotificationsCenter } from '../../browser/parts/notifications/notificationsCenter.js';

suite('NotificationsList row height', () => {
	suiteSetup(() => {
		const warmupDisposables = new DisposableStore();
		const container = document.createElement('div');
		document.body.appendChild(container);
		try {
			const instantiationService = workbenchInstantiationService(undefined, warmupDisposables);
			const list = warmupDisposables.add(instantiationService.createInstance(NotificationsList, container, {}));
			const notification = NotificationViewItem.create({ severity: Severity.Info, message: 'Warmup' }, { global: NotificationsFilter.OFF, sources: new Map() })!;
			warmupDisposables.add(toDisposable(() => notification.close()));
			list.show();
			list.layout(300);
			list.updateNotificationsList(0, 0, [notification]);
		} finally {
			warmupDisposables.dispose();
			container.remove();
		}
	});

	const store = ensureNoDisposablesAreLeakedInTestSuite();

	teardown(() => setNotificationRowHeight(DEFAULT_NOTIFICATION_ROW_HEIGHT));

	test('deduplicates row height changes', () => {
		const changes: number[] = [];
		store.add(onDidChangeNotificationRowHeight(height => changes.push(height)));

		setNotificationRowHeight(34);
		setNotificationRowHeight(34);
		setNotificationRowHeight(DEFAULT_NOTIFICATION_ROW_HEIGHT);

		assert.deepStrictEqual(changes, [34, DEFAULT_NOTIFICATION_ROW_HEIGHT]);
	});

	test('notification center updates row heights and preserves the focused row viewport position', () => {
		setNotificationRowHeight(34);
		const container = document.createElement('div');
		container.classList.add('monaco-workbench');
		document.body.appendChild(container);
		store.add(toDisposable(() => container.remove()));

		const instantiationService = workbenchInstantiationService(undefined, store);
		const model = store.add(new NotificationsModel());
		store.add(toDisposable(() => {
			for (const notification of [...model.notifications]) {
				notification.close();
			}
		}));
		const center = store.add(instantiationService.createInstance(NotificationsCenter, container, model));

		for (let index = 0; index < 10; index++) {
			model.addNotification({ severity: Severity.Info, message: `Message ${index}` });
		}
		center.show();

		const getRowState = () => {
			const row = container.querySelector<HTMLElement>('.monaco-list-row.focused');
			const rows = container.querySelector<HTMLElement>('.monaco-list-rows');
			return {
				height: row?.style.height,
				viewportTop: row && rows ? parseInt(row.style.top) + parseInt(rows.style.top || '0') : undefined
			};
		};

		const rowToFocus = container.querySelector<HTMLElement>('.monaco-list-row[data-index="7"]')!;
		rowToFocus.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, button: 0 }));
		rowToFocus.dispatchEvent(new MouseEvent('click', { bubbles: true, button: 0 }));
		const before = getRowState();
		setNotificationRowHeight(DEFAULT_NOTIFICATION_ROW_HEIGHT);
		const after = getRowState();
		center.dispose();
		setNotificationRowHeight(36);

		assert.deepStrictEqual({
			beforeHeight: before.height,
			afterHeight: after.height,
			preservedFocusedRowViewportPosition: typeof before.viewportTop === 'number' && typeof after.viewportTop === 'number' && Math.abs(after.viewportTop - before.viewportTop) <= DEFAULT_NOTIFICATION_ROW_HEIGHT - 34,
			rowAfterDispose: container.querySelector('.monaco-list-row')
		}, {
			beforeHeight: '34px',
			afterHeight: `${DEFAULT_NOTIFICATION_ROW_HEIGHT}px`,
			preservedFocusedRowViewportPosition: true,
			rowAfterDispose: null
		});
	});

	test('expanded notification height grows when the list is narrower than 450', () => {
		const container = document.createElement('div');
		container.classList.add('monaco-workbench');
		document.body.appendChild(container);
		store.add(toDisposable(() => container.remove()));

		const instantiationService = workbenchInstantiationService(undefined, store);
		const list = store.add(instantiationService.createInstance(NotificationsList, container, {}));
		list.show();

		const message = 'This is a very long notification message with multiple words designed to wrap across several lines when constrained to a narrower width, producing different rendered heights in the notification list layout.';
		const notification = NotificationViewItem.create({ severity: Severity.Info, message }, { global: NotificationsFilter.OFF, sources: new Map() })!;
		store.add(toDisposable(() => notification.close()));

		notification.expand();
		list.layout(450);
		list.updateNotificationsList(0, 0, [notification]);

		const row = container.querySelector<HTMLElement>('.monaco-list-row')!;
		assert.ok(row);
		const height450 = parseInt(row.style.height);

		list.layout(200);
		const height200 = parseInt(row.style.height);

		assert.ok(height200 > height450, `Expected height at 200px (${height200}) to be greater than at 450px (${height450})`);
	});

	test('expanded notification height stays a single row when the list is narrower than the placeholders', () => {
		const container = document.createElement('div');
		container.classList.add('monaco-workbench');
		document.body.appendChild(container);
		store.add(toDisposable(() => container.remove()));

		const instantiationService = workbenchInstantiationService(undefined, store);
		const list = store.add(instantiationService.createInstance(NotificationsList, container, {}));
		list.show();

		const message = 'This is a very long notification message with multiple words designed to wrap across several lines when constrained to a narrower width, producing different rendered heights in the notification list layout.';
		const notification = NotificationViewItem.create({ severity: Severity.Info, message }, { global: NotificationsFilter.OFF, sources: new Map() })!;
		store.add(toDisposable(() => notification.close()));
		assert.strictEqual(notification.hasProgress, false);
		assert.strictEqual(notification.canCollapse, true);
		assert.strictEqual(notification.source, undefined);
		assert.strictEqual(notification.actions?.primary?.length ?? 0, 0);

		notification.expand();
		list.layout(200);
		list.updateNotificationsList(0, 0, [notification]);

		const row = container.querySelector<HTMLElement>('.monaco-list-row')!;
		assert.ok(row);
		const height200 = parseInt(row.style.height);
		assert.ok(height200 > DEFAULT_NOTIFICATION_ROW_HEIGHT);

		// 50px is below the 96px padding, severity, and two-action deduction, but still positive.
		list.layout(50);
		const height50 = parseInt(row.style.height);
		assert.strictEqual(height50, DEFAULT_NOTIFICATION_ROW_HEIGHT);
		assert.ok(height50 < height200);
	});

	test('collapsed message growth shows expand action', () => {
		const container = document.createElement('div');
		container.classList.add('monaco-workbench');
		document.body.appendChild(container);
		store.add(toDisposable(() => container.remove()));

		const instantiationService = workbenchInstantiationService(undefined, store);
		const list = store.add(instantiationService.createInstance(NotificationsList, container, {}));
		list.show();
		list.layout(200);

		const shortMessage = 'Short';
		const longMessage = 'This is an extremely long notification message that will definitely overflow the small 200px container width and trigger message overflow.';

		const notification = NotificationViewItem.create({ severity: Severity.Info, message: shortMessage }, { global: NotificationsFilter.OFF, sources: new Map() })!;
		store.add(toDisposable(() => notification.close()));

		list.updateNotificationsList(0, 0, [notification]);

		const row = container.querySelector<HTMLElement>('.monaco-list-row')!;
		assert.ok(row);

		// Initially short message does not overflow, so no expand action
		assert.strictEqual(row.querySelector(`[aria-label="${ExpandNotificationAction.LABEL}"]`), null);

		// Update message to long text
		notification.updateMessage(longMessage);
		assert.notStrictEqual(row.querySelector(`[aria-label="${ExpandNotificationAction.LABEL}"]`), null);

		// Update message back to short text
		notification.updateMessage(shortMessage);
		assert.strictEqual(row.querySelector(`[aria-label="${ExpandNotificationAction.LABEL}"]`), null);

		// Notification with primary actions: canCollapse is false, so expand action should not appear even when long
		const primaryAction = store.add(new Action('action1', 'Action 1', undefined, true, async () => { }));
		const notificationWithPrimary = NotificationViewItem.create({
			severity: Severity.Info,
			message: shortMessage,
			actions: { primary: [primaryAction] }
		}, { global: NotificationsFilter.OFF, sources: new Map() })!;
		store.add(toDisposable(() => notificationWithPrimary.close()));

		list.updateNotificationsList(1, 0, [notificationWithPrimary]);
		const rows = container.querySelectorAll<HTMLElement>('.monaco-list-row');
		const rowWithPrimary = rows[1]!;
		assert.ok(rowWithPrimary);

		notificationWithPrimary.updateMessage(longMessage);
		assert.strictEqual(rowWithPrimary.querySelector(`[aria-label="${ExpandNotificationAction.LABEL}"]`), null);
	});

	test('double click without a row does not throw', () => {
		const container = document.createElement('div');
		container.classList.add('monaco-workbench');
		document.body.appendChild(container);
		store.add(toDisposable(() => container.remove()));

		const instantiationService = workbenchInstantiationService(undefined, store);
		const list = store.add(instantiationService.createInstance(NotificationsList, container, {}));
		list.show();
		list.layout(450);

		const notification = NotificationViewItem.create({ severity: Severity.Info, message: 'Message' }, { global: NotificationsFilter.OFF, sources: new Map() })!;
		store.add(toDisposable(() => notification.close()));

		list.updateNotificationsList(0, 0, [notification]);

		const listElement = container.querySelector<HTMLElement>('.monaco-list')!;
		assert.ok(listElement);

		// Double click directly on .monaco-list (empty target without data-index)
		assert.doesNotThrow(() => {
			listElement.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
		});
		assert.strictEqual(notification.expanded, false);

		// Double click on .monaco-list-row
		const row = container.querySelector<HTMLElement>('.monaco-list-row')!;
		assert.ok(row);
		row.dispatchEvent(new MouseEvent('dblclick', { bubbles: true, cancelable: true }));
		assert.strictEqual(notification.expanded, true);
	});

	test('layout does not collapse expanded notification when window widens', () => {
		const container = document.createElement('div');
		container.classList.add('monaco-workbench');
		document.body.appendChild(container);
		store.add(toDisposable(() => container.remove()));

		const instantiationService = workbenchInstantiationService(undefined, store);
		const list = store.add(instantiationService.createInstance(NotificationsList, container, {}));
		list.show();

		const message = 'A notification message that wraps onto multiple lines at 200px width but fits into a single line at 800px width.';
		const notification = NotificationViewItem.create({ severity: Severity.Info, message }, { global: NotificationsFilter.OFF, sources: new Map() })!;
		store.add(toDisposable(() => notification.close()));

		notification.expand();
		list.layout(200);
		list.updateNotificationsList(0, 0, [notification]);

		const row = container.querySelector<HTMLElement>('.monaco-list-row')!;
		assert.ok(row);
		const heightNarrow = parseInt(row.style.height);
		assert.ok(heightNarrow > DEFAULT_NOTIFICATION_ROW_HEIGHT);

		// Layout at a wide width where the message fits into a single line
		list.layout(800);
		assert.strictEqual(notification.expanded, true);

		// Layout back to narrow width: should still be expanded and recompute expanded height
		list.layout(200);
		assert.strictEqual(notification.expanded, true);
		const heightNarrowAgain = parseInt(row.style.height);
		assert.strictEqual(heightNarrowAgain, heightNarrow);
	});

	test('message update does not collapse expanded notification that fits on one line', () => {
		const container = document.createElement('div');
		container.classList.add('monaco-workbench');
		document.body.appendChild(container);
		store.add(toDisposable(() => container.remove()));

		const instantiationService = workbenchInstantiationService(undefined, store);
		const list = store.add(instantiationService.createInstance(NotificationsList, container, {}));
		list.show();

		const message = 'A notification message that wraps onto multiple lines at 200px width but fits into a single line at 800px width.';
		// Word joiner inside a word keeps the same line breaks, so the narrowed height matches the first measurement. The message still fits on one line at 800px.
		const updatedMessage = message.replace('notification', 'noti\u2060fication');
		const notification = NotificationViewItem.create({ severity: Severity.Info, message }, { global: NotificationsFilter.OFF, sources: new Map() })!;
		store.add(toDisposable(() => notification.close()));
		assert.strictEqual(notification.source, undefined);
		assert.strictEqual(notification.actions?.primary?.length ?? 0, 0);

		notification.expand();
		list.layout(200);
		list.updateNotificationsList(0, 0, [notification]);

		const row = container.querySelector<HTMLElement>('.monaco-list-row')!;
		assert.ok(row);
		const heightNarrow = parseInt(row.style.height);
		assert.ok(heightNarrow > DEFAULT_NOTIFICATION_ROW_HEIGHT);
		assert.ok(row.querySelector('.notification-list-item.expanded'));

		list.layout(800);
		notification.updateMessage(updatedMessage);
		assert.notStrictEqual(notification.message.raw, message);
		list.updateNotificationHeight(notification);

		assert.strictEqual(notification.expanded, true);
		assert.ok(row.querySelector('.notification-list-item.expanded'));

		list.layout(200);
		assert.strictEqual(notification.expanded, true);
		assert.strictEqual(parseInt(row.style.height), heightNarrow);
	});

	test('streaming message does not recreate secondary action toolbar when overflow state is unchanged', () => {
		const container = document.createElement('div');
		container.classList.add('monaco-workbench');
		document.body.appendChild(container);
		store.add(toDisposable(() => container.remove()));

		const instantiationService = workbenchInstantiationService(undefined, store);
		const list = store.add(instantiationService.createInstance(NotificationsList, container, {}));
		list.show();
		list.layout(200);

		const shortMessage1 = 'Chunk 1';
		const shortMessage2 = 'Chunk 1 2';
		const longMessage1 = 'This is an extremely long notification message chunk that will definitely overflow the small 200px container width and trigger message overflow.';
		const longMessage2 = 'This is an extremely long notification message chunk that will definitely overflow the small 200px container width and trigger message overflow with even more streaming text.';

		const notification = NotificationViewItem.create({ severity: Severity.Info, message: shortMessage1 }, { global: NotificationsFilter.OFF, sources: new Map() })!;
		store.add(toDisposable(() => notification.close()));

		list.updateNotificationsList(0, 0, [notification]);

		const row = container.querySelector<HTMLElement>('.monaco-list-row')!;
		assert.ok(row);

		const actionItem1 = row.querySelector<HTMLElement>('.monaco-action-bar .action-item');
		assert.ok(actionItem1);

		// Updating message with another short string should not recreate toolbar items
		notification.updateMessage(shortMessage2);
		const actionItem2 = row.querySelector<HTMLElement>('.monaco-action-bar .action-item');
		assert.strictEqual(actionItem2, actionItem1);

		// Updating message to long string overflows, so toolbar should be updated to add expand action
		notification.updateMessage(longMessage1);
		const actionItem3 = row.querySelector<HTMLElement>('.monaco-action-bar .action-item');
		assert.notStrictEqual(actionItem3, actionItem2);

		// Streaming more text into already-overflowing message should not recreate toolbar items
		notification.updateMessage(longMessage2);
		const actionItem4 = row.querySelector<HTMLElement>('.monaco-action-bar .action-item');
		assert.strictEqual(actionItem4, actionItem3);
	});

	test('updateNotificationHeight does not collapse expanded notification when message updates at wide layout (r12-1)', () => {
		const container = document.createElement('div');
		container.classList.add('monaco-workbench');
		document.body.appendChild(container);
		store.add(toDisposable(() => container.remove()));

		const instantiationService = workbenchInstantiationService(undefined, store);
		const list = store.add(instantiationService.createInstance(NotificationsList, container, {}));
		list.show();

		const longMessage = 'A notification message that wraps onto multiple lines at 200px width but fits into a single line at 1200px width.';
		const notification = NotificationViewItem.create({ severity: Severity.Info, message: longMessage }, { global: NotificationsFilter.OFF, sources: new Map() })!;
		store.add(toDisposable(() => notification.close()));

		notification.expand();
		list.layout(200);
		list.updateNotificationsList(0, 0, [notification]);

		const row = container.querySelector<HTMLElement>('.monaco-list-row')!;
		assert.ok(row);
		const heightNarrow = parseInt(row.style.height);
		assert.ok(heightNarrow > DEFAULT_NOTIFICATION_ROW_HEIGHT);
		assert.ok(row.classList.contains('expanded'));

		// Layout to wide width where text fits single line
		list.layout(1200);
		// Update message to another single-line string and update height
		notification.updateMessage('Another message that also easily fits on a single line at 1200px width.');
		list.updateNotificationHeight(notification);

		// Assert still expanded
		assert.strictEqual(notification.expanded, true);
		assert.ok(row.classList.contains('expanded'));

		// Layout back to 200px: height should expand again
		notification.updateMessage(longMessage);
		list.layout(200);
		assert.strictEqual(notification.expanded, true);
		assert.strictEqual(parseInt(row.style.height), heightNarrow);
	});

	test('narrow container does not balloon expanded height when remaining message width <= 0 (r12-2)', () => {
		const container = document.createElement('div');
		container.classList.add('monaco-workbench');
		document.body.appendChild(container);
		store.add(toDisposable(() => container.remove()));

		const instantiationService = workbenchInstantiationService(undefined, store);
		const list = store.add(instantiationService.createInstance(NotificationsList, container, {}));
		list.show();

		const longMessage = 'A long notification message that wraps onto multiple lines in a normal container.';
		const notification = NotificationViewItem.create({ severity: Severity.Info, message: longMessage }, { global: NotificationsFilter.OFF, sources: new Map() })!;
		store.add(toDisposable(() => notification.close()));

		notification.expand();
		list.layout(200);
		list.updateNotificationsList(0, 0, [notification]);

		const row = container.querySelector<HTMLElement>('.monaco-list-row')!;
		assert.ok(row);
		const normalExpandedHeight = parseInt(row.style.height);
		assert.ok(normalExpandedHeight > DEFAULT_NOTIFICATION_ROW_HEIGHT);

		// Layout to 50px (actions take 96px, remaining <= 0)
		list.layout(50);
		const narrowHeight = parseInt(row.style.height);
		assert.strictEqual(narrowHeight, DEFAULT_NOTIFICATION_ROW_HEIGHT);
		assert.ok(narrowHeight < normalExpandedHeight);
	});
});


suite('NotificationsList AccessibilityProvider', () => {

	const noFilter: INotificationsFilter = { global: NotificationsFilter.OFF, sources: new Map() };
	let configurationService: IConfigurationService;
	let keybindingService: IKeybindingService;
	let accessibilityProvider: NotificationAccessibilityProvider;
	const createdNotifications: INotificationViewItem[] = [];

	setup(() => {
		configurationService = new TestConfigurationService();
		keybindingService = new MockKeybindingService();
		accessibilityProvider = new NotificationAccessibilityProvider({}, keybindingService, configurationService);
	});

	teardown(() => {
		// Close all created notifications to prevent disposable leaks
		for (const notification of createdNotifications) {
			notification.close();
		}
		createdNotifications.length = 0;
	});

	ensureNoDisposablesAreLeakedInTestSuite();

	test('getAriaLabel includes severity prefix for Error notifications', () => {
		const notification = NotificationViewItem.create({ severity: Severity.Error, message: 'Something went wrong' }, noFilter)!;
		createdNotifications.push(notification);
		const ariaLabel = accessibilityProvider.getAriaLabel(notification);

		assert.ok(ariaLabel.startsWith('Error: '), `Expected aria label to start with "Error: ", but got: ${ariaLabel}`);
		assert.ok(ariaLabel.includes('Something went wrong'), 'Expected aria label to include original message');
		assert.ok(ariaLabel.includes('notification'), 'Expected aria label to include "notification"');
	});

	test('getAriaLabel includes severity prefix for Warning notifications', () => {
		const notification = NotificationViewItem.create({ severity: Severity.Warning, message: 'This is a warning' }, noFilter)!;
		createdNotifications.push(notification);
		const ariaLabel = accessibilityProvider.getAriaLabel(notification);

		assert.ok(ariaLabel.startsWith('Warning: '), `Expected aria label to start with "Warning: ", but got: ${ariaLabel}`);
		assert.ok(ariaLabel.includes('This is a warning'), 'Expected aria label to include original message');
		assert.ok(ariaLabel.includes('notification'), 'Expected aria label to include "notification"');
	});

	test('getAriaLabel includes severity prefix for Info notifications', () => {
		const notification = NotificationViewItem.create({ severity: Severity.Info, message: 'Information message' }, noFilter)!;
		createdNotifications.push(notification);
		const ariaLabel = accessibilityProvider.getAriaLabel(notification);

		assert.ok(ariaLabel.startsWith('Info: '), `Expected aria label to start with "Info: ", but got: ${ariaLabel}`);
		assert.ok(ariaLabel.includes('Information message'), 'Expected aria label to include original message');
		assert.ok(ariaLabel.includes('notification'), 'Expected aria label to include "notification"');
	});

	test('getAriaLabel includes source when present', () => {
		const notification = NotificationViewItem.create({
			severity: Severity.Error,
			message: 'Error with source',
			source: 'TestExtension'
		}, noFilter)!;
		createdNotifications.push(notification);
		const ariaLabel = accessibilityProvider.getAriaLabel(notification);

		assert.ok(ariaLabel.startsWith('Error: '), 'Expected aria label to start with severity prefix');
		assert.ok(ariaLabel.includes('Error with source'), 'Expected aria label to include original message');
		assert.ok(ariaLabel.includes('source: TestExtension'), 'Expected aria label to include source information');
		assert.ok(ariaLabel.includes('notification'), 'Expected aria label to include "notification"');
	});

	test('severity prefix consistency', () => {
		// Test that the severity prefixes are consistent with the ARIA alerts
		const errorNotification = NotificationViewItem.create({ severity: Severity.Error, message: 'Error message' }, noFilter)!;
		const warningNotification = NotificationViewItem.create({ severity: Severity.Warning, message: 'Warning message' }, noFilter)!;
		const infoNotification = NotificationViewItem.create({ severity: Severity.Info, message: 'Info message' }, noFilter)!;

		createdNotifications.push(errorNotification, warningNotification, infoNotification);

		const errorLabel = accessibilityProvider.getAriaLabel(errorNotification);
		const warningLabel = accessibilityProvider.getAriaLabel(warningNotification);
		const infoLabel = accessibilityProvider.getAriaLabel(infoNotification);

		// Check that each severity type gets the correct prefix
		assert.ok(errorLabel.includes('Error: Error message'), 'Error notifications should have Error prefix');
		assert.ok(warningLabel.includes('Warning: Warning message'), 'Warning notifications should have Warning prefix');
		assert.ok(infoLabel.includes('Info: Info message'), 'Info notifications should have Info prefix');
	});
});

