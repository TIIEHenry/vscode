/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../base/common/event.js';
import { DisposableStore, toDisposable } from '../../../base/common/lifecycle.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../platform/configuration/test/common/testConfigurationService.js';
import { IContextKeyService } from '../../../platform/contextkey/common/contextkey.js';
import { INotificationSource, NotificationsFilter, Severity } from '../../../platform/notification/common/notification.js';
import { INotificationService } from '../../../platform/notification/common/notification.js';
import { TestNotificationService } from '../../../platform/notification/test/common/testNotificationService.js';
import { IStatusbarEntry, IStatusbarService, StatusbarAlignment } from '../../services/statusbar/browser/statusbar.js';
import { notificationBellIcon, NotificationsStatus } from '../../browser/parts/notifications/notificationsStatus.js';
import { notificationDoNotDisturb, notificationHasAttention } from '../../common/contextkeys.js';
import { NotificationsModel, NotificationsPosition, NotificationsSettings } from '../../common/notifications.js';
import { workbenchInstantiationService } from './workbenchTestServices.js';

class SettableNotificationService extends TestNotificationService {
	private filter: NotificationsFilter = NotificationsFilter.OFF;
	private readonly _onDidChangeFilter: Emitter<void>;
	override readonly onDidChangeFilter;

	constructor(disposables: Pick<DisposableStore, 'add'>) {
		super();
		this._onDidChangeFilter = disposables.add(new Emitter<void>());
		this.onDidChangeFilter = this._onDidChangeFilter.event;
	}

	override getFilter(_source?: INotificationSource): NotificationsFilter {
		return this.filter;
	}

	override setFilter(filter?: NotificationsFilter | any): void {
		if (typeof filter === 'number') {
			this.filter = filter;
		}
		this._onDidChangeFilter.fire();
	}
}

suite('NotificationsStatus', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('notificationBellIcon returns correct icon for all four state combinations', () => {
		assert.strictEqual(notificationBellIcon(false, false).id, 'bell');
		assert.strictEqual(notificationBellIcon(true, false).id, 'bell-dot');
		assert.strictEqual(notificationBellIcon(false, true).id, 'bell-slash');
		assert.strictEqual(notificationBellIcon(true, true).id, 'bell-slash-dot');
	});

	test('top-right position updates context keys and does not add statusbar entry', () => {
		const entries = new Map<string, IStatusbarEntry>();
		const statusbarService = {
			_serviceBrand: undefined,
			addEntry: (entry: IStatusbarEntry, id: string, _alignment: StatusbarAlignment, _priority?: number) => {
				entries.set(id, entry);
				return {
					update: (next: IStatusbarEntry) => {
						entries.set(id, next);
					},
					dispose: () => {
						entries.delete(id);
					},
				};
			},
			createScoped() {
				return this;
			},
		} as unknown as IStatusbarService;

		const configService = new TestConfigurationService();
		configService.setUserConfiguration(NotificationsSettings.NOTIFICATIONS_POSITION, NotificationsPosition.TOP_RIGHT);

		const notificationService = new SettableNotificationService(store);

		const instantiationService = workbenchInstantiationService({
			configurationService: () => configService,
		}, store);
		instantiationService.stub(IStatusbarService, statusbarService);
		instantiationService.stub(INotificationService, notificationService);

		const contextKeyService = instantiationService.get(IContextKeyService);

		const model = store.add(new NotificationsModel());
		store.add(toDisposable(() => {
			for (const notification of [...model.notifications]) {
				notification.close();
			}
		}));

		const status = store.add(instantiationService.createInstance(NotificationsStatus, model));
		assert.ok(status);

		// Assert statusbar has no status.notifications entry in top-right position
		assert.strictEqual(entries.has('status.notifications'), false);

		// Initial state
		assert.strictEqual(contextKeyService.getContextKeyValue(notificationHasAttention.key), false);
		assert.strictEqual(contextKeyService.getContextKeyValue(notificationDoNotDisturb.key), false);
		assert.strictEqual(notificationBellIcon(
			contextKeyService.getContextKeyValue<boolean>(notificationHasAttention.key) ?? false,
			contextKeyService.getContextKeyValue<boolean>(notificationDoNotDisturb.key) ?? false
		).id, 'bell');

		// Add notification while center is not visible
		model.addNotification({ severity: Severity.Info, message: 'New notification' });
		assert.strictEqual(contextKeyService.getContextKeyValue(notificationHasAttention.key), true);
		assert.strictEqual(contextKeyService.getContextKeyValue(notificationDoNotDisturb.key), false);
		assert.strictEqual(notificationBellIcon(
			contextKeyService.getContextKeyValue<boolean>(notificationHasAttention.key) ?? false,
			contextKeyService.getContextKeyValue<boolean>(notificationDoNotDisturb.key) ?? false
		).id, 'bell-dot');

		// Enable Do Not Disturb mode
		notificationService.setFilter(NotificationsFilter.ERROR);
		assert.strictEqual(contextKeyService.getContextKeyValue(notificationHasAttention.key), true);
		assert.strictEqual(contextKeyService.getContextKeyValue(notificationDoNotDisturb.key), true);
		assert.strictEqual(notificationBellIcon(
			contextKeyService.getContextKeyValue<boolean>(notificationHasAttention.key) ?? false,
			contextKeyService.getContextKeyValue<boolean>(notificationDoNotDisturb.key) ?? false
		).id, 'bell-slash-dot');

		// Still no status.notifications in statusbar
		assert.strictEqual(entries.has('status.notifications'), false);
	});
});
