/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { rewriteMarkdownLinks } from '../../../../base/common/markdownLinks.js';
import { getConversationChatResource } from '../common/conversationChatInput.js';
import { IConversationSessionChatEntry } from '../common/conversationSessionChat.js';

/** Stub/fixture path contract — same segments as `conversation-chat:` resources, no scheme. */
const STUB_SESSION_LINK_PATH = /^\/session\/([^/]+)\/chat\/([^/]+)$/;
const URI_SCHEME_PREFIX = /^[A-Za-z][A-Za-z0-9+.-]*:/;

export type ConversationStubTurnCatalogLookup = (sessionKey: string) => readonly IConversationSessionChatEntry[];

/**
 * Projects stub/fixture markdown session links onto `conversation-chat:` when
 * writing `ConversationStubTurn.text`. Only path-only `/session/<key>/chat/<id>`
 * hrefs are parseable here. Catalog must hit `tool` / `fork`; otherwise the
 * source is left byte-for-byte intact (including already-`conversation-chat:`
 * links and any live-engine scheme — R9). No RPC.
 */
export function rewriteConversationStubTurnSessionLinks(
	text: string,
	catalogForSession: ConversationStubTurnCatalogLookup,
): string {
	return rewriteMarkdownLinks(text, {
		rewriteLink: token => {
			if (token.type !== 'link') {
				return undefined;
			}
			const rewrittenHref = rewriteStubSessionLinkHref(token.href, catalogForSession);
			if (rewrittenHref === undefined) {
				return undefined;
			}
			return replaceMarkdownLinkHref(token.raw, token.href, rewrittenHref);
		},
	});
}

function rewriteStubSessionLinkHref(
	href: string,
	catalogForSession: ConversationStubTurnCatalogLookup,
): string | undefined {
	const trimmed = href.trim();
	if (!trimmed || URI_SCHEME_PREFIX.test(trimmed)) {
		return undefined;
	}
	const parsed = parseStubSessionLinkPath(trimmed);
	if (!parsed) {
		return undefined;
	}
	const entry = catalogForSession(parsed.sessionKey).find(item => item.chatId === parsed.chatId);
	if (!entry || (entry.originKind !== 'tool' && entry.originKind !== 'fork')) {
		return undefined;
	}
	return getConversationChatResource(parsed.sessionKey, parsed.chatId).toString();
}

function parseStubSessionLinkPath(href: string): { sessionKey: string; chatId: string } | undefined {
	const match = STUB_SESSION_LINK_PATH.exec(href);
	if (!match) {
		return undefined;
	}
	try {
		return {
			sessionKey: decodeURIComponent(match[1]),
			chatId: decodeURIComponent(match[2]),
		};
	} catch {
		return undefined;
	}
}

function replaceMarkdownLinkHref(raw: string, oldHref: string, newHref: string): string | undefined {
	const destOpen = raw.lastIndexOf('](');
	if (destOpen < 0) {
		return undefined;
	}
	const destClose = raw.lastIndexOf(')');
	if (destClose <= destOpen) {
		return undefined;
	}
	const dest = raw.slice(destOpen + 2, destClose);
	if (!dest.startsWith(oldHref)) {
		return undefined;
	}
	return `${raw.slice(0, destOpen + 2)}${newHref}${dest.slice(oldHref.length)})`;
}
