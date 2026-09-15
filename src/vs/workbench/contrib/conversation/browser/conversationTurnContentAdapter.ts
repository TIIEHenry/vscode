/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { DisposableStore, IDisposable } from '../../../../base/common/lifecycle.js';
import { Schemas } from '../../../../base/common/network.js';
import { URI } from '../../../../base/common/uri.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IMarkdownRendererService, openLinkFromMarkdown } from '../../../../platform/markdown/browser/markdownRenderer.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import {
	ConversationChatInput,
	ConversationChatInputScheme,
	getConversationChatResource,
	parseConversationChatResource,
} from '../common/conversationChatInput.js';
import { IConversationSessionChatService } from '../common/conversationSessionChat.js';
import { ConversationStubTurn } from './conversationStubModel.js';
import { shouldRenderTurnAsMarkdown } from './conversationTurnMarkdown.js';
import { decorateConversationSessionPill } from './conversationSessionPill.js';
import { IConversationRosterService } from './conversationStubService.js';
import { IConversationSessionWindowService } from './conversationSessionWindowService.js';
import { resolveConversationTimelineLink, IConversationTimelineLinkHit } from './resolveConversationTimelineLink.js';
import { rewriteConversationStubTurnSessionLinks } from './rewriteConversationStubTurnSessionLinks.js';
import { openUaClientExternalLink } from './uaClientExternalLink.js';

const WORKBENCH_LINK_SCHEMES = new Set<string>([
	Schemas.file,
	Schemas.vscodeFileResource,
	Schemas.vscodeRemote,
	Schemas.vscodeRemoteResource,
	Schemas.vscodeNotebookCell,
	Schemas.internal,
]);

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
		@IHoverService private readonly hoverService: IHoverService,
		@IConversationRosterService private readonly rosterService: IConversationRosterService,
		@IConversationSessionChatService private readonly sessionChatService: IConversationSessionChatService,
		@IConversationSessionWindowService private readonly sessionWindowService: IConversationSessionWindowService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
	) { }

	renderTurnBody(turn: ConversationStubTurn, container: HTMLElement): IDisposable {
		const store = new DisposableStore();
		if (shouldRenderTurnAsMarkdown(turn.kind)) {
			const text = rewriteConversationStubTurnSessionLinks(
				turn.text,
				sessionKey => this.sessionChatService.getCatalog(sessionKey),
			);
			store.add(this.markdownRendererService.render(
				new MarkdownString(text),
				{
					sanitizerConfig: {
						allowedLinkSchemes: { augment: [ConversationChatInputScheme] },
					},
					actionHandler: (href) => {
						void this.handleTimelineLink(href);
					},
				},
				container,
			));
			this.decorateConversationLinks(container, store);
			store.add(this.sessionChatService.onDidChangeCatalog(() => this.decorateConversationLinks(container, store)));
			store.add(this.rosterService.onDidChangeSession(() => this.decorateConversationLinks(container, store)));
		} else {
			container.textContent = turn.text;
		}
		return store;
	}

	private decorateConversationLinks(container: HTMLElement, store: DisposableStore): void {
		const anchors = container.querySelectorAll('a[data-href^="conversation-chat:"]');
		for (const node of anchors) {
			if (!(node instanceof HTMLAnchorElement)) {
				continue;
			}
			const href = node.getAttribute('data-href');
			if (!href) {
				continue;
			}
			const resolved = this.resolveHref(href);
			if (resolved.kind !== 'hit') {
				continue;
			}
			const hover = decorateConversationSessionPill(node, resolved, this.hoverService);
			if (hover) {
				store.add(hover);
			}
		}
	}

	private resolveHref(href: string) {
		const sessionKeyFromHref = this.peekSessionKey(href);
		return resolveConversationTimelineLink(
			href,
			this.rosterService.getSessions(),
			sessionKeyFromHref ? this.sessionChatService.getCatalog(sessionKeyFromHref) : [],
		);
	}

	private peekSessionKey(href: string): string | undefined {
		try {
			return parseConversationChatResource(URI.parse(href))?.sessionKey;
		} catch {
			return undefined;
		}
	}

	private async handleTimelineLink(href: string): Promise<void> {
		let uri: URI;
		try {
			uri = URI.parse(href);
		} catch {
			return;
		}

		if (uri.scheme === ConversationChatInputScheme) {
			const resolved = this.resolveHref(href);
			if (resolved.kind === 'hit') {
				await this.activateConversationLink(resolved);
			}
			return;
		}

		if (uri.scheme === Schemas.http || uri.scheme === Schemas.https || uri.scheme === Schemas.mailto) {
			await openUaClientExternalLink(
				uri,
				this.configurationService,
				this.dialogService,
				this.openerService,
			);
			return;
		}

		if (WORKBENCH_LINK_SCHEMES.has(uri.scheme)) {
			await openLinkFromMarkdown(this.openerService, href, false);
		}
	}

	private async activateConversationLink(hit: IConversationTimelineLinkHit): Promise<void> {
		const sourceKey = this.editorGroupsService.getActiveConversationEditorPart()?.sessionKey
			?? this.rosterService.getActiveSessionId();
		if (sourceKey !== hit.sessionKey && this.sessionChatService.isSubAgentDialogOpen(sourceKey)) {
			this.sessionChatService.closeSubAgentDialog(sourceKey);
		}

		if (this.rosterService.getActiveSessionId() !== hit.sessionKey) {
			this.rosterService.switchSession(hit.sessionKey);
			await this.sessionWindowService.revealSessionWindow(hit.sessionKey);
		}

		if (hit.originKind === 'tool') {
			await this.sessionChatService.openSubAgent(hit.sessionKey, hit.chatId, hit.catalogTitle);
			return;
		}

		if (this.sessionChatService.isSubAgentDialogOpen(hit.sessionKey)) {
			this.sessionChatService.closeSubAgentDialog(hit.sessionKey);
		}

		if (hit.originKind === 'fork') {
			const existing = this.sessionChatService.findOpenTabForChat(hit.sessionKey, hit.chatId);
			if (existing) {
				const part = this.sessionChatService.getConversationPart(hit.sessionKey);
				await part?.activeGroup.openEditor(existing);
				return;
			}
			await this.sessionChatService.openExtensionTab(hit.sessionKey, hit.chatId, { title: hit.catalogTitle });
			return;
		}

		const part = this.sessionChatService.getConversationPart(hit.sessionKey);
		if (!part) {
			return;
		}
		const root = this.sessionChatService.findOpenTabForChat(hit.sessionKey, 'default')
			?? new ConversationChatInput(getConversationChatResource(hit.sessionKey, 'default'), { isDefaultRoot: true });
		await part.activeGroup.openEditor(root);
	}
}
