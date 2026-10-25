/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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

/**
 * Sources already ANDs transport connected and pairing on its own write door.
 * A session context with no `isEngineConnected` would short-circuit to ready
 * and hide `isEngineSessionReady() === false`. Force the probe, then let an
 * explicit tri-state win.
 */
export function conversationSessionReadinessProbe(session: {
	isEngineSessionReady(): boolean;
	getEngineSessionReadiness?(): ConversationSessionReadiness;
}): IConversationSessionReadinessSource {
	const source: IConversationSessionReadinessSource = {
		isEngineConnected: () => true,
		isEngineSessionReady: () => session.isEngineSessionReady(),
	};
	if (session.getEngineSessionReadiness) {
		source.getEngineSessionReadiness = () => session.getEngineSessionReadiness!();
	}
	return source;
}
