/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../../platform/configuration/test/common/testConfigurationService.js';
import { IConfigurationService } from '../../../../../platform/configuration/common/configuration.js';
import { INotification, INotificationHandle, INotificationService, NoOpNotification } from '../../../../../platform/notification/common/notification.js';
import { TestNotificationService } from '../../../../../platform/notification/test/common/testNotificationService.js';
import { IUniverseAgentConnection } from '../../../../../platform/universeAgent/common/universeAgentConnection.js';
import type { ITurnSettleSignal } from '../../../../../platform/universeAgent/common/universeAgentTypes.js';
import { IConversationPartService } from '../../../../browser/parts/conversation/conversationPart.js';
import { IWorkbenchLayoutService, Parts } from '../../../../services/layout/browser/layoutService.js';
import { workbenchInstantiationService } from '../../../../test/browser/workbenchTestServices.js';
import { ConversationNotificationsContribution } from '../../browser/conversationNotifications.contribution.js';
import { IConversationRosterService, ConversationStubService } from '../../browser/conversationStubService.js';
import { IConversationTimelineRevealService } from '../../browser/conversationTimelineRevealService.js';
import { createConversationConnectionTestStub } from '../common/conversationConnectionTestStub.js';
import {
	UA_CLIENT_NOTIFICATIONS_PERMISSION_REQUESTS,
	UA_CLIENT_NOTIFICATIONS_TURN_COMPLETED,
} from '../../common/uaClientSettingsKeys.js';
import {
	shouldNotifyPermissionRequests,
	shouldNotifyTurnCompleted,
} from '../../common/uaClientSettingsHelpers.js';

class RecordingNotificationService extends TestNotificationService {
	readonly notifications: INotification[] = [];

	override notify(notification: INotification): INotificationHandle {
		this.notifications.push(notification);
		return new NoOpNotification();
	}
}

suite('ConversationNotificationsContribution', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	function mount(options?: {
		readonly conversationVisible?: boolean;
		readonly configuration?: Record<string, unknown>;
		readonly settleEmitter?: Emitter<ITurnSettleSignal>;
	}): {
		readonly roster: ConversationStubService;
		readonly notifications: RecordingNotificationService;
		readonly revealCalls: string[];
		readonly switched: string[];
		readonly layout: { conversationVisible: boolean };
	} {
		const instantiationService = workbenchInstantiationService(undefined, store);
		const roster = store.add(new ConversationStubService());
		const notifications = new RecordingNotificationService();
		const revealCalls: string[] = [];
		const switched: string[] = [];
		const originalSwitch = roster.switchSession.bind(roster);
		roster.switchSession = (sessionId: string) => {
			switched.push(sessionId);
			originalSwitch(sessionId);
		};
		const layout = { conversationVisible: options?.conversationVisible ?? true };
		const configuration = new TestConfigurationService({
			[UA_CLIENT_NOTIFICATIONS_PERMISSION_REQUESTS]: true,
			[UA_CLIENT_NOTIFICATIONS_TURN_COMPLETED]: false,
			...options?.configuration,
		});
		const settleEmitter = options?.settleEmitter;
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(INotificationService, notifications);
		instantiationService.stub(IConfigurationService, configuration);
		instantiationService.stub(IWorkbenchLayoutService, {
			_serviceBrand: undefined,
			isVisible: (part: Parts) => part !== Parts.CONVERSATION_PART || layout.conversationVisible,
			setPartHidden: () => { },
		} as unknown as IWorkbenchLayoutService);
		instantiationService.stub(IConversationPartService, { focus: () => { } } as IConversationPartService);
		instantiationService.stub(IConversationTimelineRevealService, {
			_serviceBrand: undefined,
			registerLens: () => ({ dispose: () => { } }),
			revealItem: () => { },
			getAccessibleTurnContent: () => undefined,
			focusAccessibleTurn: () => { },
			scrollToFirstPendingConfirmation: () => revealCalls.push('scroll'),
		});
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub(
			settleEmitter ? { onDidTurnSettle: settleEmitter.event } : {},
		));
		store.add(instantiationService.createInstance(ConversationNotificationsContribution));
		return { roster, notifications, revealCalls, switched, layout };
	}

	test('helpers read the two CS-3 keys', () => {
		const configuration = new TestConfigurationService({
			[UA_CLIENT_NOTIFICATIONS_PERMISSION_REQUESTS]: false,
			[UA_CLIENT_NOTIFICATIONS_TURN_COMPLETED]: true,
		});
		assert.strictEqual(shouldNotifyPermissionRequests(configuration), false);
		assert.strictEqual(shouldNotifyTurnCompleted(configuration), true);
		assert.strictEqual(shouldNotifyPermissionRequests(), true);
		assert.strictEqual(shouldNotifyTurnCompleted(), false);
	});

	test('active visible session does not toast when a confirmation appears', () => {
		const { roster, notifications } = mount();
		const activeId = roster.getActiveSessionId();
		roster.appendConfirmationTurn(activeId, 'Allow write?');
		assert.strictEqual(notifications.notifications.length, 0);
	});

	test('inactive session permission seat toasts; click switches, shows part, then scrolls', async () => {
		const { roster, notifications, revealCalls, switched } = mount();
		const firstId = roster.getActiveSessionId();
		const secondId = roster.createSession();
		roster.switchSession(secondId);
		notifications.notifications.length = 0;
		switched.length = 0;

		roster.appendConfirmationTurn(firstId, 'Allow write?');
		assert.strictEqual(notifications.notifications.length, 1);
		const toast = notifications.notifications[0]!;
		assert.ok(String(toast.message).includes('needs your attention'));
		const labels = toast.actions?.primary?.map(action => action.label) ?? [];
		assert.ok(!labels.some(label => /allow|skip|grant/i.test(label)));
		assert.strictEqual(labels[0], 'Show');

		await toast.actions!.primary![0]!.run();
		assert.deepStrictEqual(switched, [firstId]);
		assert.deepStrictEqual(revealCalls, ['scroll']);
	});

	test('active session still toasts when Conversation part is hidden', () => {
		const { roster, notifications, layout } = mount();
		layout.conversationVisible = false;
		roster.appendConfirmationTurn(roster.getActiveSessionId(), 'Allow write?');
		assert.strictEqual(notifications.notifications.length, 1);
	});

	test('permission toast is skipped when the setting is off', () => {
		const { roster, notifications } = mount({
			configuration: { [UA_CLIENT_NOTIFICATIONS_PERMISSION_REQUESTS]: false },
		});
		const firstId = roster.getActiveSessionId();
		const secondId = roster.createSession();
		roster.switchSession(secondId);
		notifications.notifications.length = 0;
		roster.appendConfirmationTurn(firstId, 'Allow write?');
		assert.strictEqual(notifications.notifications.length, 0);
	});

	test('stub session change does not fabricate a turn-completed toast', () => {
		const { roster, notifications } = mount({
			configuration: { [UA_CLIENT_NOTIFICATIONS_TURN_COMPLETED]: true },
		});
		const firstId = roster.getActiveSessionId();
		const secondId = roster.createSession();
		roster.switchSession(secondId);
		notifications.notifications.length = 0;
		roster.appendStubEchoAssistant(firstId, 'done');
		assert.strictEqual(notifications.notifications.length, 0);
	});

	test('engine onDidTurnSettle toasts only for an inactive session when enabled', () => {
		const settleEmitter = store.add(new Emitter<ITurnSettleSignal>());
		const { roster, notifications } = mount({
			configuration: { [UA_CLIENT_NOTIFICATIONS_TURN_COMPLETED]: true },
			settleEmitter,
		});
		const firstId = roster.getActiveSessionId();
		const secondId = roster.createSession();
		roster.switchSession(secondId);
		notifications.notifications.length = 0;

		settleEmitter.fire({ sessionId: firstId, runtimeTurnId: 'r1', assistantTurnId: 'a1' });
		assert.strictEqual(notifications.notifications.length, 1);
		assert.ok(String(notifications.notifications[0]!.message).includes('finished a turn'));

		notifications.notifications.length = 0;
		settleEmitter.fire({ sessionId: secondId, runtimeTurnId: 'r2', assistantTurnId: 'a2' });
		assert.strictEqual(notifications.notifications.length, 0);
	});

	test('turn-completed toast stays off by default', () => {
		const settleEmitter = store.add(new Emitter<ITurnSettleSignal>());
		const { roster, notifications } = mount({ settleEmitter });
		const firstId = roster.getActiveSessionId();
		roster.switchSession(roster.createSession());
		notifications.notifications.length = 0;
		settleEmitter.fire({ sessionId: firstId, runtimeTurnId: 'r1', assistantTurnId: 'a1' });
		assert.strictEqual(notifications.notifications.length, 0);
	});
});
