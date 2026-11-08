/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import assert from 'assert';
import { Emitter } from '../../../../base/common/event.js';
import { ensureNoDisposablesAreLeakedInTestSuite } from '../../../../base/test/common/utils.js';
import { TestConfigurationService } from '../../../../platform/configuration/test/common/testConfigurationService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { INotification, INotificationHandle, INotificationService, NoOpNotification } from '../../../../platform/notification/common/notification.js';
import { TestNotificationService } from '../../../../platform/notification/test/common/testNotificationService.js';
import type { IConversationSessionViewLease } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { PendingActionView, SessionViewSnapshot } from '../../../../platform/universeAgent/common/sessionView/index.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { workbenchInstantiationService } from '../../../test/browser/workbenchTestServices.js';
import { ConversationNotificationsContribution } from './conversationNotifications.contribution.js';
import { IConversationRosterService, ConversationStubService } from './conversationStubService.js';
import { IConversationTimelineRevealService } from './conversationTimelineRevealService.js';
import { createConversationConnectionTestStub } from '../test/common/conversationConnectionTestStub.js';
import { UA_CLIENT_NOTIFICATIONS_PERMISSION_REQUESTS } from '../common/uaClientSettingsKeys.js';

class RecordingNotificationService extends TestNotificationService {
	readonly notifications: INotification[] = [];

	override notify(notification: INotification): INotificationHandle {
		this.notifications.push(notification);
		return new NoOpNotification();
	}
}

/**
 * Engine roster publishes pending-count changes on onDidChangeSessionRosterDetail
 * without always firing onDidChangeSession (live lease onDidApplyFrame path).
 */
class RosterDetailPendingRoster extends ConversationStubService {
	private readonly _onDetail = this._register(new Emitter<string>());
	override readonly onDidChangeSessionRosterDetail = this._onDetail.event;

	private readonly injectedPending = new Map<string, readonly PendingActionView[]>();

	override acquireSessionView(sessionId: string): IConversationSessionViewLease {
		const lease = super.acquireSessionView(sessionId);
		const injected = this.injectedPending.get(sessionId);
		if (!injected?.length) {
			return lease;
		}
		const snapshot: SessionViewSnapshot = {
			...lease.snapshot,
			pendingActions: [...lease.snapshot.pendingActions, ...injected],
		};
		return { ...lease, snapshot };
	}

	emitPendingViaRosterDetailOnly(sessionId: string, requestId: string): void {
		this.injectedPending.set(sessionId, [{
			requestId: requestId as SessionViewSnapshot['pendingActions'][number]['requestId'],
			summary: { kind: 'permission', title: 'Allow write?', permissionKind: 'shell' },
		}]);
		this._onDetail.fire(sessionId);
	}
}

suite('ConversationNotificationsContribution (browser)', () => {
	const store = ensureNoDisposablesAreLeakedInTestSuite();

	test('roster detail without onDidChangeSession still toasts for inactive session', () => {
		const roster = store.add(new RosterDetailPendingRoster());
		const backgroundId = roster.getActiveSessionId();
		const foregroundId = roster.createSession();
		roster.switchSession(foregroundId);

		const notifications = new RecordingNotificationService();
		const instantiationService = workbenchInstantiationService(undefined, store);
		instantiationService.stub(IConversationRosterService, roster);
		instantiationService.stub(INotificationService, notifications);
		instantiationService.stub(IConfigurationService, new TestConfigurationService({
			[UA_CLIENT_NOTIFICATIONS_PERMISSION_REQUESTS]: true,
		}));
		instantiationService.stub(IWorkbenchLayoutService, {
			_serviceBrand: undefined,
			isVisible: (part: Parts) => part !== Parts.CONVERSATION_PART,
			setPartHidden: () => { },
		} as unknown as IWorkbenchLayoutService);
		instantiationService.stub(IConversationPartService, { focus: () => { } } as IConversationPartService);
		instantiationService.stub(IConversationTimelineRevealService, {
			_serviceBrand: undefined,
			registerLens: () => ({ dispose: () => { } }),
			revealItem: () => { },
			getAccessibleTurnContent: () => undefined,
			focusAccessibleTurn: () => { },
			scrollToFirstPendingConfirmation: () => { },
		});
		instantiationService.stub(IUniverseAgentConnection, createConversationConnectionTestStub());

		store.add(instantiationService.createInstance(ConversationNotificationsContribution));
		notifications.notifications.length = 0;

		roster.emitPendingViaRosterDetailOnly(backgroundId, 'req-detail-only');

		assert.strictEqual(notifications.notifications.length, 1);
		assert.ok(String(notifications.notifications[0]!.message).includes('needs your attention'));
	});
});
