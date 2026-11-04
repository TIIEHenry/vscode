/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export type ConversationDisplayMode = 'live' | 'cached' | 'stub';

export type ConversationLivePhase = 'streaming' | 'running' | 'waiting-input' | 'pending' | 'done' | 'failed' | 'cancelled' | 'unknown';

export interface ConversationLivePhaseRow {
	readonly kind?: string;
	readonly streaming?: boolean;
	readonly toolStatus?: string;
}

/**
 * The one renderer-side interpretation of a row's active state.
 * Cached and stub snapshots keep terminal facts but never present stale work as live.
 */
export function getConversationLivePhase(row: ConversationLivePhaseRow, mode: ConversationDisplayMode = 'live'): ConversationLivePhase {
	switch (row.toolStatus) {
		case 'failed':
			return 'failed';
		case 'cancelled':
			return 'cancelled';
		case 'completed':
			return 'done';
		case 'pending':
			return mode === 'live' ? 'pending' : 'unknown';
		case 'running':
			return mode === 'live' ? 'running' : 'unknown';
	}
	if (row.streaming === true) {
		return mode === 'live' ? 'streaming' : 'unknown';
	}
	if (row.kind === 'tool' || row.kind === 'thinking') {
		return 'unknown';
	}
	return 'done';
}

export function isConversationLivePhaseActive(phase: ConversationLivePhase): boolean {
	return phase === 'streaming' || phase === 'running' || phase === 'pending' || phase === 'waiting-input';
}

export function isConversationRowActive(row: ConversationLivePhaseRow, mode: ConversationDisplayMode = 'live'): boolean {
	return isConversationLivePhaseActive(getConversationLivePhase(row, mode));
}
