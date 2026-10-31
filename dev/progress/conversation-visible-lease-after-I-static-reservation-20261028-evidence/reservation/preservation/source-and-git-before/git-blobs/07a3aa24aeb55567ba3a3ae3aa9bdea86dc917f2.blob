/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { conversationLensDockEngineNotConnected, conversationLensDockSessionLoading, conversationLensDockSessionUnavailable, conversationLensDockSessionUnavailableReason } from './conversationLensDockStrings.js';
import { type ConversationSessionReadiness } from '../common/conversationSessionReadiness.js';

export type { ConversationSessionReadiness, IConversationSessionReadinessSource } from '../common/conversationSessionReadiness.js';
export { conversationSessionReadinessProbe, getConversationSessionReadiness, isConversationSessionNotReady } from '../common/conversationSessionReadiness.js';

/** Gate and write-hold sentence. Pairing-hold wins over session readiness. */
export function conversationSessionHoldReason(pairingHold: boolean, readiness: ConversationSessionReadiness): string | undefined {
	if (pairingHold) {
		return conversationLensDockEngineNotConnected;
	}
	if (readiness === 'loading') {
		return conversationLensDockSessionLoading;
	}
	if (readiness === 'unavailable') {
		return `${conversationLensDockSessionUnavailable} — ${conversationLensDockSessionUnavailableReason}`;
	}
	return undefined;
}

/** Empty timeline copy while no turns are painted. Ready sessions use the ordinary empty line. */
export function conversationTimelineEmptyKind(readiness: ConversationSessionReadiness): 'empty' | 'loading' | 'unavailable' {
	if (readiness === 'loading') {
		return 'loading';
	}
	if (readiness === 'unavailable') {
		return 'unavailable';
	}
	return 'empty';
}

/** Short status for a control that is not the gate. Ready has no phrase. */
export function conversationSessionShortStatus(readiness: ConversationSessionReadiness): string | undefined {
	if (readiness === 'loading') {
		return conversationLensDockSessionLoading;
	}
	if (readiness === 'unavailable') {
		return conversationLensDockSessionUnavailable;
	}
	return undefined;
}
