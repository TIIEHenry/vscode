/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { addDisposableListener } from '../../../../base/browser/dom.js';
import { DisposableStore, IDisposable } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
import { URI } from '../../../../base/common/uri.js';
import { ConversationStubTurn } from './conversationStubModel.js';
import { shouldRenderTurnAsMarkdown } from './conversationTurnMarkdown.js';
import { openUaClientExternalLink } from './uaClientExternalLink.js';

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
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IDialogService private readonly dialogService: IDialogService,
		@IOpenerService private readonly openerService: IOpenerService,
	) { }

	renderTurnBody(turn: ConversationStubTurn, container: HTMLElement): IDisposable {
		const store = new DisposableStore();
		if (shouldRenderTurnAsMarkdown(turn.kind)) {
			store.add(this.markdownRendererService.render(
				new MarkdownString(turn.text),
				undefined,
				container,
			));
			store.add(addDisposableListener(container, 'click', (event) => {
				const anchor = (event.target as HTMLElement | null)?.closest('a');
				if (!anchor?.href) {
					return;
				}
				event.preventDefault();
				event.stopPropagation();
				void openUaClientExternalLink(
					URI.parse(anchor.href),
					this.configurationService,
					this.dialogService,
					this.openerService,
				);
			}));
		} else {
			container.textContent = turn.text;
		}
		return store;
	}
}
