/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { IConversationSessionChatEntry } from './conversationSessionChat.js';

export interface IConversationAgentBreadcrumbItem {
	readonly chatId: string;
	readonly title: string;
	readonly isCurrent: boolean;
}

/**
 * Builds agent hierarchy breadcrumb items by walking stub {@link IConversationSessionChatEntry.parentChatId}
 * (protocol `origin.chat`) up to the session default root chat.
 */
export function buildAgentHierarchyBreadcrumb(
	catalog: readonly IConversationSessionChatEntry[],
	chatId: string,
): IConversationAgentBreadcrumbItem[] {
	const byId = new Map(catalog.map(entry => [entry.chatId, entry]));
	const current = byId.get(chatId);
	if (!current || current.originKind !== 'tool') {
		return [];
	}

	const chain: IConversationSessionChatEntry[] = [current];
	let walk = current;
	const visited = new Set<string>([walk.chatId]);

	while (walk.parentChatId && walk.parentChatId !== walk.chatId) {
		if (walk.parentChatId === 'default') {
			break;
		}

		const parent = byId.get(walk.parentChatId);
		if (!parent || visited.has(parent.chatId)) {
			break;
		}

		chain.unshift(parent);
		visited.add(parent.chatId);
		walk = parent;
	}

	const rootTitle = byId.get('default')?.title ?? localize('conversationAgentBreadcrumbRoot', "Root session");
	const rootEntry: IConversationSessionChatEntry = byId.get('default') ?? {
		sessionKey: current.sessionKey,
		chatId: 'default',
		title: rootTitle,
		originKind: 'user',
	};

	if (chain[0]?.chatId !== 'default') {
		chain.unshift(rootEntry);
	}

	return chain.map((entry, index) => ({
		chatId: entry.chatId,
		title: entry.title,
		isCurrent: index === chain.length - 1,
	}));
}
