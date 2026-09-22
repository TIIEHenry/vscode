/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { isConversationPairingHold, type IConversationPairingHoldSource } from './conversationSessionStatus.js';
import { IConversationRosterService, settleDispatchedEngineWrite } from './conversationStubService.js';

/**
 * Engine-connected fork attempt. `handled` means the engine path consumed the
 * action (notice on failure, no local fallthrough). `forked` is a successful
 * engine unary, not a sync `forkSubAgent` "sent" true. Callers must not treat
 * `handled` as a successful fork.
 *
 * Same honesty class as Kill leftover writes (D318): pairing-hold leftover
 * and leftover-looks-live (`isEngineConnected()===true` + pairingPending)
 * are checked before `isEngineConnected()` (D320) so a looks-live stub cannot
 * take the unary path. KEEP leftover list-fail (D456: connected +
 * `isEngineSessionReady()===false`, not pairing-hold) is the same gate as
 * D449/D454 — disconnected notice, no `forkSubAgent`. True disconnect leftover
 * and never-connected stub stay unhandled so local fork can proceed (D298).
 */
export type ConversationEngineForkOutcome = {
	readonly handled: boolean;
	readonly forked: boolean;
};

export const conversationForkEngineDisconnectedCopy = localize(
	'conversationFork.engineDisconnected',
	"Could not fork conversation — engine disconnected.",
);

/** KEEP leftover list-fail (D449/D454/D456): connected but roster not ready is not a live write surface. */
function isKeepLeftoverListFailWrite(roster: IConversationRosterService): boolean {
	return roster.isEngineConnected()
		&& roster.isEngineSessionReady?.() === false;
}

export async function tryConnectedEngineFork(
	roster: IConversationRosterService,
	notificationService: INotificationService,
	ua?: IConversationPairingHoldSource,
): Promise<ConversationEngineForkOutcome> {
	if (isConversationPairingHold(ua)) {
		if (roster.hasEngineConnectionHistory()) {
			notificationService.error(conversationForkEngineDisconnectedCopy);
			return { handled: true, forked: false };
		}
		return { handled: false, forked: false };
	}
	if (isKeepLeftoverListFailWrite(roster)) {
		if (roster.hasEngineConnectionHistory()) {
			notificationService.error(conversationForkEngineDisconnectedCopy);
			return { handled: true, forked: false };
		}
		return { handled: false, forked: false };
	}
	if (roster.isEngineConnected()) {
		const forked = await settleDispatchedEngineWrite(
			roster,
			roster.forkSubAgent(roster.getActiveSessionId()),
		);
		if (forked) {
			return { handled: true, forked: true };
		}
		notificationService.error(localize('conversationFork.forkSubAgentFailed', "Could not fork conversation."));
		return { handled: true, forked: false };
	}
	return { handled: false, forked: false };
}
