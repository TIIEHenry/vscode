/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { isConversationPairingHold, type IConversationPairingHoldSource } from './conversationSessionStatus.js';
import { IConversationRosterService, settleDispatchedEngineWrite } from './conversationStubService.js';

/**
 * Engine Kill attempt. `handled` means the action consumed the command
 * (notice on leftover/disconnect-with-history or connected false; silent on
 * connected unary success). `killed` is a successful engine unary, not a
 * sync `killSubAgent` "sent" true.
 *
 * Same honesty class as other leftover writes (D318): pairing-hold leftover
 * and leftover-looks-live (`isEngineConnected()===true` + pairingPending)
 * are checked before `isEngineConnected()` so a looks-live stub cannot take
 * the unary path. KEEP leftover list-fail (D456: connected +
 * `isEngineSessionReady()===false`, not pairing-hold) is the same gate as
 * D449/D454 — disconnected notice, no `killSubAgent`. True disconnect leftover
 * still notices. Never-connected stays a silent no-op. Kill has no local
 * success path (unlike fork).
 */
export type ConversationEngineKillOutcome = {
	readonly handled: boolean;
	readonly killed: boolean;
};

export interface ConversationKillSubAgentArgs {
	readonly agentId?: string;
	readonly force?: boolean;
}

export const conversationKillEngineDisconnectedCopy = localize(
	'conversationKill.engineDisconnected',
	"Could not kill sub-agent — engine disconnected.",
);

export const conversationKillEngineFailedCopy = localize(
	'conversationKill.killSubAgentFailed',
	"Could not kill sub-agent.",
);

/** KEEP leftover list-fail (D449/D454/D456): connected but roster not ready is not a live write surface. */
function isKeepLeftoverListFailWrite(roster: IConversationRosterService): boolean {
	return roster.isEngineConnected()
		&& roster.isEngineSessionReady?.() === false;
}

export async function tryKillSubAgent(
	roster: IConversationRosterService,
	notificationService: Pick<INotificationService, 'error'>,
	args?: ConversationKillSubAgentArgs,
	ua?: IConversationPairingHoldSource,
): Promise<ConversationEngineKillOutcome> {
	if (isConversationPairingHold(ua)) {
		if (roster.hasEngineConnectionHistory()) {
			notificationService.error(conversationKillEngineDisconnectedCopy);
			return { handled: true, killed: false };
		}
		return { handled: false, killed: false };
	}
	if (isKeepLeftoverListFailWrite(roster)) {
		if (roster.hasEngineConnectionHistory()) {
			notificationService.error(conversationKillEngineDisconnectedCopy);
			return { handled: true, killed: false };
		}
		return { handled: false, killed: false };
	}
	if (roster.isEngineConnected()) {
		const killed = await settleDispatchedEngineWrite(
			roster,
			roster.killSubAgent(roster.getActiveSessionId(), args),
		);
		if (!killed) {
			notificationService.error(conversationKillEngineFailedCopy);
		}
		return { handled: true, killed };
	}
	if (roster.hasEngineConnectionHistory()) {
		notificationService.error(conversationKillEngineDisconnectedCopy);
		return { handled: true, killed: false };
	}
	return { handled: false, killed: false };
}
