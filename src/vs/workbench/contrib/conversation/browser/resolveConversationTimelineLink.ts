/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { URI } from '../../../../base/common/uri.js';
import {
	ConversationChatInputScheme,
	getConversationChatResource,
	parseConversationChatResource,
} from '../common/conversationChatInput.js';
import { IConversationSessionChatEntry } from '../common/conversationSessionChat.js';

export type ConversationTimelineLinkOrigin = 'root' | 'tool' | 'fork';

export interface IConversationTimelineLinkHit {
	readonly kind: 'hit';
	readonly sessionKey: string;
	readonly chatId: string;
	readonly originKind: ConversationTimelineLinkOrigin;
	readonly resource: URI;
	readonly sessionTitle: string;
	readonly catalogTitle?: string;
	readonly workDir?: string;
	readonly model?: string;
}

export interface IConversationTimelineLinkMiss {
	readonly kind: 'miss';
}

export interface IConversationTimelineLinkExternal {
	readonly kind: 'external';
	readonly uri: URI;
}

export type ConversationTimelineLinkResolution =
	| IConversationTimelineLinkHit
	| IConversationTimelineLinkMiss
	| IConversationTimelineLinkExternal;

export interface IConversationTimelineLinkRosterSession {
	readonly id: string;
	readonly title: string;
	readonly workDir?: string;
}

export function resolveConversationTimelineLink(
	href: string,
	rosterSessions: readonly IConversationTimelineLinkRosterSession[],
	catalog: readonly IConversationSessionChatEntry[],
): ConversationTimelineLinkResolution {
	let uri: URI;
	try {
		uri = URI.parse(href);
	} catch {
		return { kind: 'miss' };
	}

	if (uri.scheme !== ConversationChatInputScheme) {
		return { kind: 'external', uri };
	}

	if (uri.authority || uri.query || uri.fragment) {
		return { kind: 'miss' };
	}

	const parsed = parseConversationChatResource(uri);
	if (!parsed) {
		return { kind: 'miss' };
	}

	const session = rosterSessions.find(item => item.id === parsed.sessionKey);
	if (!session) {
		return { kind: 'miss' };
	}

	const resource = getConversationChatResource(parsed.sessionKey, parsed.chatId);
	if (parsed.chatId === 'default') {
		return {
			kind: 'hit',
			sessionKey: parsed.sessionKey,
			chatId: parsed.chatId,
			originKind: 'root',
			resource,
			sessionTitle: session.title.trim() || parsed.sessionKey,
			workDir: session.workDir,
		};
	}

	const entry = catalog.find(item => item.chatId === parsed.chatId);
	if (!entry || (entry.originKind !== 'tool' && entry.originKind !== 'fork')) {
		return { kind: 'miss' };
	}

	return {
		kind: 'hit',
		sessionKey: parsed.sessionKey,
		chatId: parsed.chatId,
		originKind: entry.originKind,
		resource,
		sessionTitle: session.title.trim() || parsed.sessionKey,
		catalogTitle: entry.title,
		workDir: session.workDir,
		model: entry.model,
	};
}
