/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Keyboard activation keys for a focusable Inbox queue row. */
export function isConversationInboxQueueItemActivationKey(key: string): boolean {
	return key === 'Enter' || key === ' ';
}

/** Nested controls (for example Retry) must not activate their containing row. */
export function shouldActivateConversationInboxQueueItem(key: string, target: unknown, row: unknown): boolean {
	return target === row && isConversationInboxQueueItemActivationKey(key);
}
