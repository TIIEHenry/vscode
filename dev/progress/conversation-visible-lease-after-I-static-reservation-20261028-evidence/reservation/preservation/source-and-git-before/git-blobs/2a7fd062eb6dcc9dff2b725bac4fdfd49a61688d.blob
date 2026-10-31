/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Aligns with Singularity message-queue-bar.md §3.2 — local stub only until PRD-008. */
export type ConversationQueueItemStatus = 'UPLOADING' | 'UPLOAD_FAILED' | 'PENDING' | 'SENDING' | 'FAILED';

export type ConversationQueueItemHoldReason = 'EDITING';

export interface ConversationMessageQueueItem {
	readonly id: string;
	readonly content: string;
	readonly status: ConversationQueueItemStatus;
	readonly hold: ConversationQueueItemHoldReason | undefined;
	readonly uploadProgress: number | undefined;
	readonly retryCount: number;
	readonly lastError: string | undefined;
	readonly locked: boolean;
	readonly pinned: boolean;
}

export interface ConversationMessageQueueState {
	readonly items: readonly ConversationMessageQueueItem[];
	readonly isPaused: boolean;
	readonly isProcessing: boolean;
}

export function createEmptyMessageQueueState(): ConversationMessageQueueState {
	return { items: [], isPaused: false, isProcessing: false };
}

export function conversationMessageQueuePendingCount(state: ConversationMessageQueueState): number {
	return state.items.filter(item => item.status === 'PENDING' && item.hold === undefined).length;
}

/**
 * Chip and list header share this. Processing wins over pause.
 * `queued` counts waiting PENDING rows only — not editing, failed, or uploading rows.
 */
export type ConversationMessageQueueHeadline =
	| { readonly kind: 'empty' }
	| { readonly kind: 'sending' }
	| { readonly kind: 'paused'; readonly count: number }
	| { readonly kind: 'queued'; readonly count: number }
	| { readonly kind: 'failed'; readonly count: number }
	| { readonly kind: 'editing'; readonly count: number }
	| { readonly kind: 'uploading'; readonly count: number; readonly percent: number | undefined };

function isQueueItemFailed(item: ConversationMessageQueueItem): boolean {
	return item.status === 'FAILED' || item.status === 'UPLOAD_FAILED';
}

export function conversationMessageQueueHeadline(state: ConversationMessageQueueState): ConversationMessageQueueHeadline {
	const items = state.items;
	if (items.length === 0) {
		return { kind: 'empty' };
	}
	if (state.isProcessing) {
		return { kind: 'sending' };
	}
	if (state.isPaused) {
		return { kind: 'paused', count: items.length };
	}
	const pending = conversationMessageQueuePendingCount(state);
	if (pending > 0) {
		return { kind: 'queued', count: pending };
	}
	if (items.every(item => item.status === 'SENDING')) {
		return { kind: 'sending' };
	}
	if (items.every(item => item.status === 'UPLOADING')) {
		const only = items.length === 1 ? items[0] : undefined;
		const percent = only
			? (only.uploadProgress !== undefined ? Math.round(only.uploadProgress * 100) : 0)
			: undefined;
		return { kind: 'uploading', count: items.length, percent };
	}
	if (items.every(isQueueItemFailed)) {
		return { kind: 'failed', count: items.length };
	}
	if (items.every(item => item.hold === 'EDITING')) {
		return { kind: 'editing', count: items.length };
	}
	if (items.some(item => item.status === 'SENDING')) {
		return { kind: 'sending' };
	}
	if (items.some(item => item.status === 'UPLOADING')) {
		return {
			kind: 'uploading',
			count: items.filter(item => item.status === 'UPLOADING').length,
			percent: undefined,
		};
	}
	if (items.some(isQueueItemFailed)) {
		return { kind: 'failed', count: items.filter(isQueueItemFailed).length };
	}
	return { kind: 'editing', count: items.length };
}
