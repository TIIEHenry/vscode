/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { readPublishedEngineIdentityId, readPublishedLinkId } from '../../../../platform/universeAgent/common/universeAgentRendererSync.js';
import { conversationLensDockEngineNotConnected, conversationLensDockSessionLoading, conversationLensDockSessionUnavailable, conversationLensDockSessionUnavailableReason } from './conversationLensDockStrings.js';
import { isConversationSessionNotReady, type ConversationSessionReadiness } from '../common/conversationSessionReadiness.js';
import type { ConversationSessionSource } from './conversationRosterStorage.js';
import { isConversationPairingHold, type IConversationPairingHoldSource } from './conversationSessionStatus.js';

export type { ConversationSessionReadiness, IConversationSessionReadinessSource } from '../common/conversationSessionReadiness.js';
export { conversationSessionReadinessProbe, getConversationSessionReadiness } from '../common/conversationSessionReadiness.js';
export { isConversationSessionNotReady };

/** A disconnected engine cache is readable, but cannot fall back to a local stub write. */
export function isConversationDisconnectedEngineSession(roster: {
	isEngineConnected(): boolean;
	hasEngineConnectionHistory?(): boolean;
	getSessionSource?(sessionId: string): ConversationSessionSource;
}, sessionId?: string): boolean {
	return !roster.isEngineConnected() && (roster.hasEngineConnectionHistory?.() === true
		|| (sessionId !== undefined && roster.getSessionSource?.(sessionId) === 'engine-cache'));
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

export interface IPublishedEngineLink {
	readonly engineIdentityId: string | undefined;
	readonly linkId: number | undefined;
}

type PublishedEngineLinkHost = {
	uaConnection?: {
		getConnectionSnapshot(): { readonly engineIdentityId?: string; readonly linkId?: number };
	};
};

/** Snapshot of the published engine identity. Missing connection cannot observe a link change. */
export function capturePublishedEngineLink(host: PublishedEngineLinkHost | undefined): IPublishedEngineLink | undefined {
	if (!host?.uaConnection?.getConnectionSnapshot) {
		return undefined;
	}
	const snapshot = host.uaConnection.getConnectionSnapshot();
	return {
		engineIdentityId: readPublishedEngineIdentityId(snapshot),
		linkId: readPublishedLinkId(snapshot),
	};
}

/** True when the published identity and link are still the ones captured for this write. */
export function samePublishedEngineLink(host: PublishedEngineLinkHost | undefined, captured: IPublishedEngineLink | undefined): boolean {
	if (!captured) {
		return true;
	}
	const current = capturePublishedEngineLink(host);
	return current?.linkId === captured.linkId && current?.engineIdentityId === captured.engineIdentityId;
}

/**
 * A real-engine queue edit must keep its draft and hold.
 * The chain is in flight, or the queue is no longer a live ready surface.
 * Stub queues (no readState) stay on the synchronous local hold.
 */
export function engineQueueEditMustKeepHold(host: {
	queueEditSettlementItemId?: string;
	stubService: {
		isEngineConnected(): boolean;
		isEngineSessionReady?(): boolean;
		getEngineSessionReadiness?(): ConversationSessionReadiness;
		getMessageQueueState?(sessionId: string): { readonly readState?: string };
	};
	uaConnection?: IConversationPairingHoldSource;
	getBoundSessionId(): string;
}, itemId: string | undefined): boolean {
	if (itemId && host.queueEditSettlementItemId === itemId) {
		return true;
	}
	const state = host.stubService.getMessageQueueState?.(host.getBoundSessionId());
	if (!state || state.readState === undefined) {
		return false;
	}
	const live = state.readState === 'ready'
		&& host.stubService.isEngineConnected()
		&& !isConversationPairingHold(host.uaConnection)
		&& !isConversationSessionNotReady(host.stubService);
	return !live;
}
