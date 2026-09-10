/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IConversationRosterService } from './conversationStubService.js';

/**
 * Engine-connected fork attempt. `handled` means the engine path consumed the
 * action (notice on failure, no local fallthrough). `forked` is a successful
 * `forkSubAgent`. Callers must not treat `handled` as a successful fork.
 */
export type ConversationEngineForkOutcome = {
	readonly handled: boolean;
	readonly forked: boolean;
};

export function tryConnectedEngineFork(
	roster: IConversationRosterService,
	notificationService: INotificationService,
): ConversationEngineForkOutcome {
	if (!roster.isEngineConnected()) {
		return { handled: false, forked: false };
	}
	if (roster.forkSubAgent(roster.getActiveSessionId())) {
		return { handled: true, forked: true };
	}
	notificationService.error(localize('conversationFork.forkSubAgentFailed', "Could not fork conversation."));
	return { handled: true, forked: false };
}
