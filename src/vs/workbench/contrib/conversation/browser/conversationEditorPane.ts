/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationEditorPane.css';
import { $, append } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { IEditorOptions } from '../../../../platform/editor/common/editor.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { EditorPane } from '../../../browser/parts/editor/editorPane.js';
import { IEditorOpenContext } from '../../../common/editor.js';
import { IEditorGroup } from '../../../services/editor/common/editorGroupsService.js';
import { ConversationAgentBreadcrumbBox } from './conversationAgentBreadcrumb.js';
import { ConversationLens } from './conversationLens.js';
import { ConversationChatInput, parseConversationChatResource } from './conversationChatInput.js';
import { IConversationSessionChatService } from './conversationSessionChatService.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';

export class ConversationEditorPane extends EditorPane {

	static readonly ID = 'workbench.editor.conversationChat';

	private pageChrome: HTMLElement | undefined;
	private breadcrumb: ConversationAgentBreadcrumbBox | undefined;
	private lens: ConversationLens | undefined;
	private activeInput: ConversationChatInput | undefined;
	private readonly chromeDisposables = this._register(new DisposableStore());
	private readonly lensDisposables = this._register(new DisposableStore());

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly paneInstantiationService: IInstantiationService,
		@IConversationPartService private readonly conversationPartService: IConversationPartService,
		@IConversationSessionChatService private readonly sessionChatService: IConversationSessionChatService,
	) {
		super(ConversationEditorPane.ID, group, telemetryService, themeService, storageService);
	}

	protected override createEditor(parent: HTMLElement): void {
		this.pageChrome = append(parent, $('.conversation-editor-page-chrome'));
		this.breadcrumb = this.chromeDisposables.add(this.paneInstantiationService.createInstance(ConversationAgentBreadcrumbBox, this.pageChrome));
		this.chromeDisposables.add(this.breadcrumb.onDidSelect(chatId => {
			const parsed = this.activeInput ? parseConversationChatResource(this.activeInput.resource) : undefined;
			if (!parsed) {
				return;
			}
			void this.sessionChatService.navigateAgentBreadcrumb(parsed.sessionKey, chatId);
		}));

		const content = append(parent, $('.conversation-editor-page-content'));
		const timeline = append(content, $('.conversation-timeline'));
		timeline.setAttribute('data-conversation-slot', 'timeline');
		const dock = append(content, $('.conversation-dock'));
		dock.setAttribute('data-conversation-slot', 'dock');

		const sessionBar = this.conversationPartService.getSlots()?.sessionBar;
		if (!sessionBar) {
			throw new Error('ConversationPart session bar is not available');
		}
		this.lens = this.lensDisposables.add(this.paneInstantiationService.createInstance(ConversationLens, { sessionBar, timeline, dock }));

		this.chromeDisposables.add(this.sessionChatService.onDidChangeCatalog(() => this.updateBreadcrumb()));
	}

	override async setInput(input: ConversationChatInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		this.activeInput = input;
		this.updateBreadcrumb();
	}

	private updateBreadcrumb(): void {
		if (!this.breadcrumb || !this.activeInput) {
			return;
		}

		const parsed = parseConversationChatResource(this.activeInput.resource);
		if (!parsed || parsed.isDefaultRoot) {
			this.breadcrumb.setItems([]);
			return;
		}

		const items = this.sessionChatService.getAgentHierarchyBreadcrumb(parsed.sessionKey, parsed.chatId);
		this.breadcrumb.setItems([...items]);
	}

	override layout(dimension: { width: number; height: number }): void {
		this.breadcrumb?.layout(dimension.width);
	}

	override focus(): void {
		this.lens?.focusDockInput();
	}
}
