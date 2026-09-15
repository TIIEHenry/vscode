/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationEditorPane.css';
import { $, append } from '../../../../base/browser/dom.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
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
import { ConversationChatInput, parseConversationChatResource } from '../common/conversationChatInput.js';
import { ConversationEditorPaneId } from '../common/conversationSessionWindow.js';
import { CONVERSATION_LEAF_COMPACT_WIDTH, CONVERSATION_LEAF_NARROW_WIDTH } from './conversationNarrowLayout.js';
import { IConversationSessionChatService } from '../common/conversationSessionChat.js';
import { ConversationLeafSessionBar, IConversationLeafPaneAccessors } from './conversationLeafSessionBar.js';
import { IConversationSessionWindowService } from './conversationSessionWindowService.js';
import { shouldAutoFocusComposer } from '../common/uaClientSettingsHelpers.js';
import type { ConversationComposerPostFailureReason } from './conversationLensDockStrings.js';
import type { ConversationLensId } from './conversationLensProjection.js';

export class ConversationEditorPane extends EditorPane implements IConversationLeafPaneAccessors {

	static readonly ID = ConversationEditorPaneId;

	private pageRoot: HTMLElement | undefined;
	private pageChrome: HTMLElement | undefined;
	private lensTablist: HTMLElement | undefined;
	private breadcrumb: ConversationAgentBreadcrumbBox | undefined;
	private timelineHost: HTMLElement | undefined;
	private dockHost: HTMLElement | undefined;
	private lens: ConversationLens | undefined;
	private leafSessionBar: ConversationLeafSessionBar | undefined;
	private activeInput: ConversationChatInput | undefined;
	private readonly chromeDisposables = this._register(new DisposableStore());
	private readonly lensDisposables = this._register(new DisposableStore());
	private readonly visibilityDisposables = this._register(new DisposableStore());

	constructor(
		group: IEditorGroup,
		@ITelemetryService telemetryService: ITelemetryService,
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IInstantiationService private readonly paneInstantiationService: IInstantiationService,
		@IConversationSessionChatService private readonly sessionChatService: IConversationSessionChatService,
		@IConversationSessionWindowService private readonly sessionWindowService: IConversationSessionWindowService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
	) {
		super(ConversationEditorPane.ID, group, telemetryService, themeService, storageService);
	}

	protected override createEditor(parent: HTMLElement): void {
		const pageRoot = append(parent, $('.conversation-editor-page'));
		pageRoot.tabIndex = -1;
		this.pageRoot = pageRoot;
		this.pageChrome = append(pageRoot, $('.conversation-editor-page-chrome'));
		this.lensTablist = append(this.pageChrome, $('.conversation-editor-lens-tablist'));
		this.breadcrumb = this.chromeDisposables.add(this.paneInstantiationService.createInstance(ConversationAgentBreadcrumbBox, this.pageChrome));
		this.chromeDisposables.add(this.breadcrumb.onDidSelect(chatId => {
			const parsed = this.activeInput ? parseConversationChatResource(this.activeInput.resource) : undefined;
			if (!parsed) {
				return;
			}
			void this.sessionChatService.navigateAgentBreadcrumb(parsed.sessionKey, chatId);
		}));

		const content = append(pageRoot, $('.conversation-editor-page-content'));
		const timeline = append(content, $('.conversation-timeline'));
		timeline.setAttribute('data-conversation-slot', 'timeline');
		const dock = append(content, $('.conversation-dock'));
		dock.setAttribute('data-conversation-slot', 'dock');

		this.timelineHost = timeline;
		this.dockHost = dock;

		this.chromeDisposables.add(this.sessionChatService.onDidChangeCatalog(() => this.updateBreadcrumb()));
	}

	override async setInput(input: ConversationChatInput, options: IEditorOptions | undefined, context: IEditorOpenContext, token: CancellationToken): Promise<void> {
		await super.setInput(input, options, context, token);
		this.activeInput = input;
		const parsed = parseConversationChatResource(input.resource);
		this.ensureLens(parsed?.sessionKey);
		this.lens?.setBoundSessionId(parsed?.sessionKey);
		this.lens?.setFilterAgentId(parsed && !parsed.isDefaultRoot ? parsed.chatId : undefined);
		this.mountLeafSessionBar(parsed?.sessionKey);
		this.bindHiddenLeafLease(parsed?.sessionKey);
		this.updateBreadcrumb();
	}

	private ensureLens(sessionKey: string | undefined): void {
		if (this.lens || !this.lensTablist || !this.timelineHost || !this.dockHost) {
			return;
		}
		this.lens = this.lensDisposables.add(this.paneInstantiationService.createInstance(ConversationLens, {
			lensTablist: this.lensTablist,
			timeline: this.timelineHost,
			dock: this.dockHost,
			sessionKey,
		}));
	}

	private mountLeafSessionBar(sessionKey: string | undefined): void {
		if (!sessionKey || this.leafSessionBar) {
			return;
		}
		const leaf = this.sessionWindowService.getLeafSlots(sessionKey);
		if (!leaf || leaf.sessionBar.querySelector('.conversation-lens-session-bar')) {
			return;
		}
		this.leafSessionBar = this.lensDisposables.add(this.paneInstantiationService.createInstance(
			ConversationLeafSessionBar,
			sessionKey,
			leaf.sessionBar,
			this,
		));
	}

	private bindHiddenLeafLease(sessionKey: string | undefined): void {
		this.visibilityDisposables.clear();
		if (!sessionKey || !this.lens) {
			return;
		}
		const syncLease = () => {
			if (!this.lens) {
				return;
			}
			if (this.sessionWindowService.isSessionWindowHidden(sessionKey)) {
				this.lens.releaseSessionViewLeaseForHiddenLeaf();
				return;
			}
			if (!this.lens.sessionViewLease) {
				this.lens.bindSessionView(sessionKey);
			}
		};
		this.visibilityDisposables.add(this.sessionWindowService.onDidChangeVisibleWindows(syncLease));
		syncLease();
	}

	writeComposerDraft(sessionId: string, text: string): void {
		this.lens?.writeComposerDraft(sessionId, text);
	}

	deleteComposerDraftsForSession(sessionId: string): void {
		this.lens?.deleteComposerDraftsForSession(sessionId);
	}

	getDockTextarea(): HTMLTextAreaElement | undefined {
		return this.lens?.dockTextarea;
	}

	getReadingColumn(): HTMLElement | undefined {
		return this.lens?.readingColumn;
	}

	getVisualizeOverlay() {
		return this.lens?.visualizeOverlay;
	}

	showPostFailure(reason: ConversationComposerPostFailureReason): void {
		this.lens?.showPostFailure(reason);
	}

	setLensId(lensId: ConversationLensId): void {
		this.lens?.setLensId(lensId);
	}

	handleLensTablistKeyDown(event: KeyboardEvent): void {
		this.lens?.handleLensTablistKeyDown(event);
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
		const narrow = dimension.width > 0 && dimension.width < CONVERSATION_LEAF_NARROW_WIDTH;
		const compact = dimension.width > 0 && dimension.width < CONVERSATION_LEAF_COMPACT_WIDTH;
		this.pageRoot?.classList.toggle('is-narrow', narrow);
		this.pageRoot?.classList.toggle('is-compact', compact);
		this.breadcrumb?.layout(dimension.width);
		const chromeHeight = this.pageChrome?.offsetHeight ?? 0;
		const contentHeight = Math.max(0, dimension.height - chromeHeight);
		this.lens?.layout(contentHeight, dimension.width);
	}

	override focus(): void {
		if (shouldAutoFocusComposer(this.configurationService)) {
			this.lens?.focusDockInput();
			return;
		}
		this.pageRoot?.focus();
	}

	get activeConversationLens(): ConversationLens | undefined {
		return this.lens;
	}

	get leafSessionBarHost(): ConversationLeafSessionBar | undefined {
		return this.leafSessionBar;
	}
}
