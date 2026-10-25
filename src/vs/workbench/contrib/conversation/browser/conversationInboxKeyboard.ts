/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Keyboard activation keys for a focusable Inbox queue row. */
export function isConversationInboxQueueItemActivationKey(key: string): boolean {
	return key === 'Enter' || key === ' ';
}
