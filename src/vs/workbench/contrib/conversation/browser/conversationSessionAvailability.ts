/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { conversationLensDockEngineNotConnected, conversationLensDockSessionLoading, conversationLensDockSessionUnavailable, conversationLensDockSessionUnavailableReason } from './conversationLensDockStrings.js';

/** Connected roster: catalog/bind in flight, or the active session cannot be written. */
export type ConversationSessionReadiness = 'ready' | 'loading' | 'unavailable';

/**
 * Narrow roster surface. Missing roster, a disconnected roster, or a roster
 * without `isEngineSessionReady` stays ready (D460 / D462).
 */
export interface IConversationSessionReadinessSource {
	isEngineConnected?(): boolean;
	isEngineSessionReady?(): boolean;
	getEngineSessionReadiness?(): ConversationSessionReadiness;
}

export function getConversationSessionReadiness(roster: IConversationSessionReadinessSource | undefined): ConversationSessionReadiness {
	if (!roster) {
		return 'ready';
	}
	if (roster.isEngineConnected?.() !== true) {
		return 'ready';
	}
	if (roster.getEngineSessionReadiness) {
		return roster.getEngineSessionReadiness();
	}
	if (roster.isEngineSessionReady?.() === false) {
		return 'unavailable';
	}
	return 'ready';
}

/** Connected, and the active session is still loading or cannot be written. */
export function isConversationSessionNotReady(roster: IConversationSessionReadinessSource | undefined): boolean {
	return getConversationSessionReadiness(roster) !== 'ready';
}

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
