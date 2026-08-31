/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { DisposableStore, IDisposable } from '../../../../base/common/lifecycle.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
import { ConversationStubTurn } from './conversationStubModel.js';
import { shouldRenderTurnAsMarkdown } from './conversationTurnMarkdown.js';

/**
 * Single adapter boundary for timeline turn bodies. Production code may import
 * `contrib/chat/browser/widget/chatContentParts/**` only through implementations
 * of this interface (see conversationImportBoundaries.test.ts).
 */
export interface IConversationTurnContentAdapter {
	renderTurnBody(turn: ConversationStubTurn, container: HTMLElement): IDisposable;
}

export class ConversationTurnContentAdapter implements IConversationTurnContentAdapter {

	constructor(
		@IMarkdownRendererService private readonly markdownRendererService: IMarkdownRendererService,
	) { }

	renderTurnBody(turn: ConversationStubTurn, container: HTMLElement): IDisposable {
		const store = new DisposableStore();
		if (shouldRenderTurnAsMarkdown(turn.kind)) {
			store.add(this.markdownRendererService.render(
				new MarkdownString(turn.text),
				undefined,
				container,
			));
		} else {
			container.textContent = turn.text;
		}
		return store;
	}
}
