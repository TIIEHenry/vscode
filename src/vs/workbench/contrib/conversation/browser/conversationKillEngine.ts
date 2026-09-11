/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { INotificationService } from '../../../../platform/notification/common/notification.js';
import { IConversationRosterService } from './conversationStubService.js';

/**
 * Engine Kill attempt. `handled` means the action consumed the command
 * (notice on leftover/disconnect-with-history or connected false; silent on
 * connected true). `killed` is a successful `killSubAgent`.
 *
 * Same honesty class as Create Snapshot (D299): pairing-hold leftover and
 * true disconnect leftover both have `isEngineConnected()` false + history,
 * so they notice and must not call `killSubAgent` (roster would still take
 * the wasEverConnected engine path). Never-connected stays a silent no-op.
 * Kill has no local success path (unlike fork).
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

export function tryKillSubAgent(
	roster: IConversationRosterService,
	notificationService: Pick<INotificationService, 'error'>,
	args?: ConversationKillSubAgentArgs,
): ConversationEngineKillOutcome {
	if (roster.isEngineConnected()) {
		const killed = roster.killSubAgent(roster.getActiveSessionId(), args);
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
