/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { isConversationPairingHold, type IConversationPairingHoldSource } from './conversationSessionStatus.js';
import { IConversationRosterService } from './conversationStubService.js';

/**
 * Engine-connected fork attempt. `handled` means the engine path consumed the
 * action (notice on failure, no local fallthrough). `forked` is a successful
 * `forkSubAgent`. Callers must not treat `handled` as a successful fork.
 *
 * Same honesty class as Kill leftover writes (D318): pairing-hold leftover
 * and leftover-looks-live (`isEngineConnected()===true` + pairingPending)
 * are checked before `isEngineConnected()` (D320) so a looks-live stub cannot
 * take the unary path. Both notice and must not call `forkSubAgent`. True
 * disconnect leftover and never-connected stub stay unhandled so local fork
 * can proceed (D298).
 */
export type ConversationEngineForkOutcome = {
	readonly handled: boolean;
	readonly forked: boolean;
};

export const conversationForkEngineDisconnectedCopy = localize(
	'conversationFork.engineDisconnected',
	"Could not fork conversation — engine disconnected.",
);

export function tryConnectedEngineFork(
	roster: IConversationRosterService,
	notificationService: INotificationService,
	ua?: IConversationPairingHoldSource,
): ConversationEngineForkOutcome {
	if (isConversationPairingHold(ua)) {
		if (roster.hasEngineConnectionHistory()) {
			notificationService.error(conversationForkEngineDisconnectedCopy);
			return { handled: true, forked: false };
		}
		return { handled: false, forked: false };
	}
	if (roster.isEngineConnected()) {
		if (roster.forkSubAgent(roster.getActiveSessionId())) {
			return { handled: true, forked: true };
		}
		notificationService.error(localize('conversationFork.forkSubAgentFailed', "Could not fork conversation."));
		return { handled: true, forked: false };
	}
	return { handled: false, forked: false };
}
