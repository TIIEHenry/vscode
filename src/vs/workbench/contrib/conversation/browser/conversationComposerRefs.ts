/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import { ENGINE_BIND_FAILED_SESSION_ID } from './conversationEngineRosterService.js';
import {
	getConversationChatResource,
	parseConversationChatResource,
} from '../common/conversationChatInput.js';
import { IConversationSessionChatEntry } from '../common/conversationSessionChat.js';
import {
	IConversationTimelineLinkHit,
	IConversationTimelineLinkRosterSession,
	resolveConversationTimelineLink,
} from './resolveConversationTimelineLink.js';

/** Tail marker inside the existing `text` string. Not a new wire field. */
export const CONVERSATION_REFS_MARKER = '<<<conversation-refs>>>';

export interface IConversationRefsDocument {
	/** Visible composer / user-bubble body. Illegal or absent trailers keep the original string here. */
	readonly body: string;
	readonly refs: readonly string[];
	/** True only when the single marker and every following non-empty line passed the link gate. */
	readonly trailer: boolean;
}

export interface IComposerSurfaceHost {
	dockTextarea: { value: string };
	composerRefResources?: string[];
	syncComposerRefs?(): void;
}

export interface IComposerAtCandidate {
	readonly sessionKey: string;
	readonly chatId: string;
	readonly resource: string;
	readonly sessionTitle: string;
	readonly catalogTitle?: string;
	readonly originKind: IConversationTimelineLinkHit['originKind'];
	readonly hit: IConversationTimelineLinkHit;
}

export function conversationUserBodyText(text: string): string {
	const split = splitConversationRefs(text);
	return split.trailer ? split.body : text;
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

export function composeConversationPayload(body: string, refs: readonly string[]): string | undefined {
	const trimmed = body.trim();
	if (!trimmed && refs.length === 0) {
		return undefined;
	}
	if (refs.length === 0) {
		return trimmed;
	}
	const block = `${CONVERSATION_REFS_MARKER}\n${refs.join('\n')}`;
	return trimmed ? `${trimmed}\n\n${block}` : block;
}

export function composerDraftText(host: IComposerSurfaceHost): string {
	const refs = host.composerRefResources ?? [];
	if (refs.length === 0) {
		return host.dockTextarea.value;
	}
	return composeConversationPayload(host.dockTextarea.value, refs) ?? '';
}

export function composerSubmitText(host: IComposerSurfaceHost): string | undefined {
	return composeConversationPayload(host.dockTextarea.value, host.composerRefResources ?? []);
}

export function applyComposerSurfaceText(host: IComposerSurfaceHost, full: string): void {
	const split = splitConversationRefs(full);
	if (split.trailer) {
		host.dockTextarea.value = split.body;
		host.composerRefResources?.splice(0, host.composerRefResources.length, ...split.refs);
	} else {
		host.dockTextarea.value = full;
		host.composerRefResources?.splice(0, host.composerRefResources.length);
	}
	host.syncComposerRefs?.();
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

export function peekConversationRefSessionKey(resource: string): string | undefined {
	try {
		return parseConversationChatResource(URI.parse(resource))?.sessionKey;
	} catch {
		return undefined;
	}
}

export interface IComposerAtQuery {
	readonly start: number;
	readonly end: number;
	readonly query: string;
}

export function findComposerAtQuery(value: string, selectionStart: number, selectionEnd = selectionStart): IComposerAtQuery | undefined {
	if (selectionStart !== selectionEnd || selectionStart < 0 || selectionStart > value.length) {
		return undefined;
	}
	let index = selectionStart - 1;
	while (index >= 0) {
		const ch = value.charAt(index);
		if (isComposerMentionWhitespace(ch)) {
			return undefined;
		}
		if (ch === '@') {
			if (index > 0 && !isComposerMentionWhitespace(value.charAt(index - 1))) {
				return undefined;
			}
			return {
				start: index,
				end: selectionStart,
				query: value.slice(index + 1, selectionStart),
			};
		}
		index--;
	}
	return undefined;
}

export function acceptComposerAtMention(
	value: string,
	selectionStart: number,
	resource: string,
	refs: readonly string[],
): { value: string; selection: number; refs: readonly string[] } | undefined {
	const mention = findComposerAtQuery(value, selectionStart);
	if (!mention) {
		return undefined;
	}
	let tokenEnd = mention.start + 1;
	while (tokenEnd < value.length && !isComposerMentionWhitespace(value.charAt(tokenEnd))) {
		tokenEnd++;
	}
	const nextValue = value.slice(0, mention.start) + value.slice(tokenEnd);
	const nextRefs = refs.indexOf(resource) >= 0 ? refs : [...refs, resource];
	return { value: nextValue, selection: mention.start, refs: nextRefs };
}

export function listComposerAtCandidates(
	sessions: readonly IConversationTimelineLinkRosterSession[],
	catalogFor: (sessionKey: string) => readonly IConversationSessionChatEntry[],
	query: string,
): IComposerAtCandidate[] {
	const out: IComposerAtCandidate[] = [];
	const seen = new Set<string>();
	for (const session of sessions) {
		if (!session.id || session.id === ENGINE_BIND_FAILED_SESSION_ID) {
			continue;
		}
		const catalog = catalogFor(session.id);
		const consider = (chatId: string) => {
			const resource = getConversationChatResource(session.id, chatId).toString();
			const resolved = resolveConversationTimelineLink(resource, sessions, catalog);
			if (resolved.kind !== 'hit') {
				return;
			}
			if (!matchesAtQuery(query, resolved.sessionTitle, resolved.catalogTitle)) {
				return;
			}
			const key = `${resolved.sessionKey}\n${resolved.chatId}`;
			if (seen.has(key)) {
				return;
			}
			seen.add(key);
			out.push({
				sessionKey: resolved.sessionKey,
				chatId: resolved.chatId,
				resource,
				sessionTitle: resolved.sessionTitle,
				catalogTitle: resolved.catalogTitle,
				originKind: resolved.originKind,
				hit: resolved,
			});
		};
		consider('default');
		for (const entry of catalog) {
			if (entry.originKind !== 'tool' && entry.originKind !== 'fork') {
				continue;
			}
			if (entry.chatId === 'default') {
				continue;
			}
			consider(entry.chatId);
		}
	}
	return out;
}

function matchesAtQuery(query: string, sessionTitle: string, catalogTitle?: string): boolean {
	const needle = query.trim().toLowerCase();
	if (!needle) {
		return true;
	}
	if (sessionTitle.toLowerCase().includes(needle)) {
		return true;
	}
	return !!catalogTitle && catalogTitle.toLowerCase().includes(needle);
}

function isComposerMentionWhitespace(ch: string): boolean {
	return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r' || ch === '\f';
}
