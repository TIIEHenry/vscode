/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Voice transcription queue — independent from Inbox MessageQueue (PRD-015 §3.5). */
export type ConversationVoiceClipStatus = 'recording' | 'transcribing';

export interface ConversationVoiceClip {
	readonly id: string;
	readonly status: ConversationVoiceClipStatus;
	readonly durationLabel: string;
}

export function appendVoiceTextToDraft(current: string, incoming: string): string {
	const next = incoming.trim();
	if (!next) {
		return current;
	}
	const cur = current.replace(/\s+$/g, '');
	return cur.length === 0 ? next : `${cur} ${next}`;
}
