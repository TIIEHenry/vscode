/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import type { ConversationStubSession } from './conversationStubModel.js';

/**
 * Sessions sidebar empty chrome. New session is a real local action; this
 * must not advertise a stub conversation or invent an engine session.
 */
export const conversationSessionsViewEmptyMessage = localize(
	'conversationSessionsView.empty',
	"No sessions — use New session to start one.",
);

export const conversationSessionsViewNoMatches = localize(
	'conversationSessionsView.noMatches',
	"No matches",
);

/** Same-row session subtitle shared by Sessions and Projects. */
export function formatSessionRosterSubtitle(session: ConversationStubSession, pendingConfirmations: number): string {
	const turnCount = session.turns.length;
	let subtitle: string;
	if (turnCount === 0) {
		subtitle = localize('conversationSessionsView.noMessages', "No messages");
	} else if (turnCount === 1) {
		subtitle = localize('conversationSessionsView.oneMessage', "1 message");
	} else {
		subtitle = localize('conversationSessionsView.manyMessages', "{0} messages", turnCount);
	}
	if (pendingConfirmations > 0) {
		const pending = pendingConfirmations === 1
			? localize('conversationSessionsView.oneConfirmationPending', "1 confirmation pending")
			: localize('conversationSessionsView.manyConfirmationsPending', "{0} confirmations pending", pendingConfirmations);
		subtitle = `${subtitle} · ${pending}`;
	}
	return subtitle;
}
