/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../../nls.js';

export type ConversationStubTurnRole = 'user' | 'assistant' | 'tool';

export interface IConversationStubTurn {
	readonly role: ConversationStubTurnRole;
	readonly text: string;
}

export interface IConversationStubSession {
	readonly id: string;
	readonly title: string;
	readonly turns: readonly IConversationStubTurn[];
}

export interface IConversationStubInboxItem {
	readonly id: string;
	readonly title: string;
}

/** In-memory stub sessions for the Conversation lens (no engine). */
export const CONVERSATION_STUB_SESSIONS: readonly IConversationStubSession[] = [
	{
		id: 'refactor-auth',
		title: localize('conversationLens.sessionRefactorAuth', "Refactor auth module"),
		turns: [
			{ role: 'user', text: localize('conversationLens.stubRefactorUser1', "How should we split the auth service?") },
			{ role: 'assistant', text: localize('conversationLens.stubRefactorAssistant1', "Split token validation from session storage first.") },
			{ role: 'tool', text: localize('conversationLens.stubRefactorTool1', "grep authService in src/") },
			{ role: 'assistant', text: localize('conversationLens.stubRefactorAssistant2', "Found 12 references across 4 files.") },
		],
	},
	{
		id: 'unit-tests',
		title: localize('conversationLens.sessionUnitTests', "Add unit tests"),
		turns: [
			{ role: 'user', text: localize('conversationLens.stubTestsUser1', "Add tests for the layout service.") },
			{ role: 'assistant', text: localize('conversationLens.stubTestsAssistant1', "I'll scaffold tests under workbench/test/browser.") },
			{ role: 'user', text: localize('conversationLens.stubTestsUser2', "Cover grid neighbor constraints too.") },
		],
	},
	{
		id: 'debug-ci',
		title: localize('conversationLens.sessionDebugCi', "Debug CI pipeline"),
		turns: [
			{ role: 'user', text: localize('conversationLens.stubCiUser1', "Why is the layers check failing on loop/A?") },
			{ role: 'tool', text: localize('conversationLens.stubCiTool1', "read valid-layers-check.log") },
			{ role: 'assistant', text: localize('conversationLens.stubCiAssistant1', "sessions imported workbench/contrib — that violates the layer graph.") },
		],
	},
];

export const CONVERSATION_STUB_INBOX_ITEMS: readonly IConversationStubInboxItem[] = [
	{ id: 'inbox-1', title: localize('conversationLens.inboxItem1', "Review PR #482 — Conversation Part slots") },
	{ id: 'inbox-2', title: localize('conversationLens.inboxItem2', "Agent asked to run npm test") },
	{ id: 'inbox-3', title: localize('conversationLens.inboxItem3', "New workspace invitation from teammate") },
];
