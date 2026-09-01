/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

/** Stub-period chat origin kinds aligned with protocol `ChatOrigin`. */
export type ConversationSessionChatOriginKind = 'user' | 'fork' | 'tool' | 'sideChat';

export interface IConversationSessionChatEntry {
	readonly chatId: string;
	readonly sessionKey: string;
	readonly title: string;
	readonly originKind: ConversationSessionChatOriginKind;
	readonly parentChatId?: string;
}
