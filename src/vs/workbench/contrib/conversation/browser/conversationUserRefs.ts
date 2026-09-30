/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { parseConversationChatResource } from '../common/conversationChatInput.js';

/** Tail marker inside the existing `text` string. Not a new wire field. */
export const CONVERSATION_REFS_MARKER = '<<<conversation-refs>>>';

export interface IConversationRefsDocument {
	/** Visible composer / user-bubble body. Illegal or absent trailers keep the original string here. */
	readonly body: string;
	readonly refs: readonly string[];
	/** True only when the single marker and every following non-empty line passed the link gate. */
	readonly trailer: boolean;
}

export function conversationUserBodyText(text: string): string {
	const split = splitConversationRefs(text);
	return split.trailer ? split.body : text;
}

/**
 * Text a row is read or copied as. User rows use {@link conversationUserBodyText};
 * every other kind keeps `text`, including a legal refs trailer.
 */
export function conversationTurnReadText(kind: string, text: string): string {
	return kind === 'user' ? conversationUserBodyText(text) : text;
}

export function splitConversationRefs(text: string): IConversationRefsDocument {
	const lines = text.split(/\r?\n/);
	const markerIndexes: number[] = [];
	for (let index = 0; index < lines.length; index++) {
		if (lines[index] === CONVERSATION_REFS_MARKER) {
			markerIndexes.push(index);
		}
	}
	if (markerIndexes.length !== 1) {
		return { body: text, refs: [], trailer: false };
	}
	const marker = markerIndexes[0];
	const refs: string[] = [];
	for (let index = marker + 1; index < lines.length; index++) {
		const line = lines[index];
		if (line.length === 0) {
			continue;
		}
		if (!isLegalConversationRefResource(line)) {
			return { body: text, refs: [], trailer: false };
		}
		refs.push(line);
	}
	let body = lines.slice(0, marker).join('\n');
	if (body.endsWith('\n')) {
		body = body.slice(0, -1);
	}
	return { body, refs, trailer: true };
}

export function isLegalConversationRefResource(line: string): boolean {
	let uri: URI;
	try {
		uri = URI.parse(line);
	} catch {
		return false;
	}
	if (uri.authority || uri.query || uri.fragment) {
		return false;
	}
	return !!parseConversationChatResource(uri);
}
