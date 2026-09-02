/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { ConversationTurnKind } from './conversationStubModel.js';

/** Agent/assistant timeline rows are a Markdown reading surface (Desktop §8.6). */
export function shouldRenderTurnAsMarkdown(kind: ConversationTurnKind): boolean {
	return kind === 'assistant';
}
