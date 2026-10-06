/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { getActionsFromNotification } from '../../browser/parts/notifications/notificationAccessibleView.js';
import { ChoiceAction, INotificationsFilter, NotificationViewItem } from '../../common/notifications.js';
import { IAccessibilitySignalService } from '../../../platform/accessibilitySignal/browser/accessibilitySignalService.js';
import { NotificationsFilter, Severity } from '../../../platform/notification/common/notification.js';

suite('NotificationAccessibleView', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();
	const noFilter: INotificationsFilter = { global: NotificationsFilter.OFF, sources: new Map() };

	test('accessible view does not mutate notification actions', async () => {
		let choiceRan = false;
		const primaryAction = store.add(new ChoiceAction('test.choice', {
			label: 'Test Action',
			keepOpen: true,
			run: () => { choiceRan = true; }
		}));
		const originalRun = primaryAction.run;
		const originalClass = primaryAction.class;

		const item = NotificationViewItem.create({
			severity: Severity.Info,
			message: 'Message',
			actions: { primary: [primaryAction] }
		}, noFilter)!;

		let closed = false;
		store.add(item.onDidClose(() => { closed = true; }));

		const mockAccessibilitySignalService = {
			playSignal: async () => { }
		} as unknown as IAccessibilitySignalService;

		const actions = getActionsFromNotification(item, mockAccessibilitySignalService);
		assert.ok(actions);
		assert.strictEqual(primaryAction.run, originalRun);
		assert.strictEqual(primaryAction.class, originalClass);

		const wrappedAction = actions.find(a => a.id === primaryAction.id);
		assert.ok(wrappedAction);
		assert.notStrictEqual(wrappedAction, primaryAction);

		await wrappedAction.run();
		assert.ok(choiceRan, 'choice action should have run');
		assert.ok(closed, 'notification should have closed');
	});
});
