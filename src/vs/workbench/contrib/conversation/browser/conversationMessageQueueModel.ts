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
