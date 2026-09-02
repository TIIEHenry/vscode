/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { toAction } from '../../../../base/common/actions.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import {
	collectPendingAttentionRequestIds,
	hasNewPendingAttention,
	isConversationSessionInactive,
} from './conversationPendingSeat.js';
import { showConversationPart } from './conversationSessionStatus.js';
import { IConversationRosterService } from './conversationStubService.js';
import { IConversationTimelineRevealService } from './conversationTimelineRevealService.js';
import {
	shouldNotifyPermissionRequests,
	shouldNotifyTurnCompleted,
} from '../common/uaClientSettingsHelpers.js';

export class ConversationNotificationsContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.conversationNotifications';

	private readonly lastPendingAttentionIds = new Map<string, Set<string>>();

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IConversationRosterService private readonly rosterService: IConversationRosterService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@INotificationService private readonly notificationService: INotificationService,
		@IUniverseAgentConnection private readonly uaConnection: IUniverseAgentConnection,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IConversationTimelineRevealService private readonly revealService: IConversationTimelineRevealService,
	) {
		super();

		for (const session of this.rosterService.getSessions()) {
			this.lastPendingAttentionIds.set(session.id, new Set(this.readPendingAttentionIds(session.id)));
		}

		this._register(this.rosterService.onDidChangeSession(sessionId => this.onSessionChanged(sessionId)));
		this._register(this.uaConnection.onDidTurnSettle(signal => this.onTurnSettle(signal.sessionId)));
	}

	private onSessionChanged(sessionId: string): void {
		const nextIds = this.readPendingAttentionIds(sessionId);
		const previousIds = this.lastPendingAttentionIds.get(sessionId);
		this.lastPendingAttentionIds.set(sessionId, new Set(nextIds));
		if (previousIds === undefined) {
			return;
		}

		if (!shouldNotifyPermissionRequests(this.configurationService)) {
			return;
		}
		if (!this.isInactiveSession(sessionId)) {
			return;
		}
		if (!hasNewPendingAttention(previousIds, nextIds)) {
			return;
		}

		this.notifyInactiveSession(
			sessionId,
			'ua.client.notifications.permission',
			localize(
				'ua.client.notifications.permissionPending',
				"Session \"{0}\" needs your attention.",
				this.sessionTitle(sessionId),
			),
		);
	}

	private onTurnSettle(sessionId: string): void {
		if (!shouldNotifyTurnCompleted(this.configurationService)) {
			return;
		}
		if (!this.isInactiveSession(sessionId)) {
			return;
		}

		this.notifyInactiveSession(
			sessionId,
			'ua.client.notifications.turn',
			localize(
				'ua.client.notifications.turnDone',
				"Session \"{0}\" finished a turn.",
				this.sessionTitle(sessionId),
			),
		);
	}

	private notifyInactiveSession(sessionId: string, idPrefix: string, message: string): void {
		this.notificationService.notify({
			id: `${idPrefix}:${sessionId}`,
			severity: Severity.Info,
			message,
			actions: {
				primary: [
					toAction({
						id: `${idPrefix}.open`,
						label: localize('ua.client.notifications.showSession', "Show"),
						run: () => this.openSessionAndRevealPending(sessionId),
					}),
				],
			},
		});
	}

	private openSessionAndRevealPending(sessionId: string): void {
		this.rosterService.switchSession(sessionId);
		this.instantiationService.invokeFunction(showConversationPart);
		this.revealService.scrollToFirstPendingConfirmation();
	}

	private isInactiveSession(sessionId: string): boolean {
		return isConversationSessionInactive(
			sessionId,
			this.rosterService.getActiveSessionId(),
			this.layoutService.isVisible(Parts.CONVERSATION_PART),
		);
	}

	private readPendingAttentionIds(sessionId: string): readonly string[] {
		const lease = this.rosterService.acquireSessionView(sessionId);
		try {
			return collectPendingAttentionRequestIds(lease.snapshot.pendingActions);
		} finally {
			lease.dispose();
		}
	}

	private sessionTitle(sessionId: string): string {
		return this.rosterService.getSessions().find(session => session.id === sessionId)?.title?.trim()
			|| sessionId;
	}
}

registerWorkbenchContribution2(ConversationNotificationsContribution.ID, ConversationNotificationsContribution, WorkbenchPhase.AfterRestored);
