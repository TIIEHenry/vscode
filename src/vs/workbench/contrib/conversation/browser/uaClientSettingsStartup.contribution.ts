/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Disposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IWorkbenchEnvironmentService } from '../../../services/environment/common/environmentService.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { IConversationRosterService } from './conversationStubService.js';
import {
	shouldNotifyPermissionRequests,
	shouldNotifyTurnCompleted,
	shouldOpenConversationOnStartup,
	shouldRestoreLastSessionOnStartup,
} from '../common/uaClientSettingsHelpers.js';
import { ConversationStubTurn } from './conversationStubModel.js';

class UaClientStartupContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.uaClientStartup';

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IConversationRosterService private readonly rosterService: IConversationRosterService,
		@IWorkbenchEnvironmentService private readonly environmentService: IWorkbenchEnvironmentService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IConversationPartService private readonly conversationPartService: IConversationPartService,
	) {
		super();

		if (this.environmentService.isSessionsWindow) {
			return;
		}

		const sessions = this.rosterService.getSessions();
		if (sessions.length > 0) {
			if (shouldRestoreLastSessionOnStartup(this.configurationService)) {
				const activeId = this.rosterService.getActiveSessionId();
				if (!sessions.some(session => session.id === activeId)) {
					this.rosterService.switchSession(sessions[0].id);
				}
			} else if (this.rosterService.getActiveSessionId() !== sessions[0].id) {
				this.rosterService.switchSession(sessions[0].id);
			}
		}

		if (shouldOpenConversationOnStartup(this.configurationService)) {
			if (!this.layoutService.isVisible(Parts.CONVERSATION_PART)) {
				this.layoutService.setPartHidden(false, Parts.CONVERSATION_PART);
			}
			this.conversationPartService.focus();
		}
	}
}

class UaClientNotificationsContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.uaClientNotifications';

	private readonly lastTurnCountBySession = new Map<string, number>();
	private readonly lastPendingCountBySession = new Map<string, number>();

	constructor(
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IConversationRosterService private readonly rosterService: IConversationRosterService,
		@INotificationService private readonly notificationService: INotificationService,
	) {
		super();

		this._register(this.rosterService.onDidChangeSession(sessionId => this.onSessionChanged(sessionId)));
		for (const session of this.rosterService.getSessions()) {
			this.captureBaseline(session.id);
		}
	}

	private captureBaseline(sessionId: string): void {
		const turns = this.rosterService.getTurns(sessionId);
		this.lastTurnCountBySession.set(sessionId, turns.length);
		this.lastPendingCountBySession.set(sessionId, this.countPending(turns));
	}

	private onSessionChanged(sessionId: string): void {
		const activeId = this.rosterService.getActiveSessionId();
		const isBackground = sessionId !== activeId;
		const turns = this.rosterService.getTurns(sessionId);
		const pending = this.countPending(turns);
		const previousPending = this.lastPendingCountBySession.get(sessionId) ?? 0;
		const previousTurnCount = this.lastTurnCountBySession.get(sessionId) ?? turns.length;

		if (isBackground && shouldNotifyPermissionRequests(this.configurationService) && pending > previousPending) {
			this.notificationService.notify({
				severity: Severity.Info,
				message: localize('ua.client.notifications.permissionPending', "A background session needs your attention."),
			});
		}

		if (isBackground && shouldNotifyTurnCompleted(this.configurationService) && turns.length > previousTurnCount) {
			const completedAssistant = turns.slice(previousTurnCount).some(turn => turn.kind === 'assistant');
			if (completedAssistant) {
				this.notificationService.notify({
					severity: Severity.Info,
					message: localize('ua.client.notifications.turnDone', "A background session completed a turn."),
				});
			}
		}

		this.lastTurnCountBySession.set(sessionId, turns.length);
		this.lastPendingCountBySession.set(sessionId, pending);
	}

	private countPending(turns: readonly ConversationStubTurn[]): number {
		return turns.filter(turn => (turn.kind === 'confirmation' || turn.kind === 'question') && turn.status === 'pending').length;
	}
}

registerWorkbenchContribution2(UaClientStartupContribution.ID, UaClientStartupContribution, WorkbenchPhase.AfterRestored);
registerWorkbenchContribution2(UaClientNotificationsContribution.ID, UaClientNotificationsContribution, WorkbenchPhase.AfterRestored);
