/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationPart.css';
import { $, append } from '../../../../base/browser/dom.js';
import { LayoutPriority } from '../../../../base/browser/ui/splitview/splitview.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { localize } from '../../../../nls.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { Part } from '../../part.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { appendPartRegionHideControl } from './partRegionHideControl.js';

export const IConversationPartService = createDecorator<IConversationPartService>('conversationPartService');

/**
 * Slot hosts inside {@link ConversationPart}. The Part does not render product
 * chrome; `workbench/contrib/conversation` fills these elements.
 */
export interface IConversationLensSlots {
	readonly sessionBar: HTMLElement;
	readonly timeline: HTMLElement;
	readonly dock: HTMLElement;
	/** Non-root sub-agent chat id (≡ engine agent_id) for trajectory attribution filtering. */
	readonly filterAgentId?: string;
}

export interface IConversationPartWindowSlots {
	readonly sessionBar: HTMLElement;
	readonly sessionWindowGrid: HTMLElement;
	/** Primary session leaf editor host; created by {@link IConversationSessionWindowService}. */
	readonly editorPartHost: HTMLElement | undefined;
}

export interface IConversationPartService {
	readonly _serviceBrand: undefined;

	readonly onDidCreateSlots: Event<IConversationPartWindowSlots>;
	getSlots(): IConversationPartWindowSlots | undefined;
	focus(): void;
}

/**
 * Center workbench part for the Agent IDE shell. Slot host only: SessionBar,
 * timeline, and input dock. Not an EditorInput; files still open in
 * {@link Parts.EDITOR_PART}.
 */
export class ConversationPart extends Part implements IConversationPartService {

	declare readonly _serviceBrand: undefined;

	//#region IView

	readonly minimumWidth: number = 300;
	readonly maximumWidth: number = Number.POSITIVE_INFINITY;
	readonly minimumHeight: number = 0;
	readonly maximumHeight: number = Number.POSITIVE_INFINITY;
	get snap(): boolean { return true; }

	readonly priority = LayoutPriority.High;

	//#endregion

	private _slots: IConversationPartWindowSlots | undefined;
	private readonly _onDidCreateSlots = this._register(new Emitter<IConversationPartWindowSlots>());
	readonly onDidCreateSlots: Event<IConversationPartWindowSlots> = this._onDidCreateSlots.event;

	constructor(
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
	) {
		super(Parts.CONVERSATION_PART, { hasTitle: false }, themeService, storageService, layoutService);
	}

	getSlots(): IConversationPartWindowSlots | undefined {
		return this._slots;
	}

	override create(parent: HTMLElement): void {
		this.element = parent;
		parent.classList.add('conversation');
		parent.tabIndex = 0;

		super.create(parent);
	}

	protected override createContentArea(parent: HTMLElement): HTMLElement {
		const regionChrome = append(parent, $('.conversation-region-chrome'));
		appendPartRegionHideControl(
			regionChrome,
			this.layoutService,
			Parts.CONVERSATION_PART,
			localize('hideConversation', "Hide Conversation"),
			disposable => this._register(disposable),
		);

		const content = append(parent, $('.content'));

		const sessionBar = append(content, $('.conversation-session-bar'));
		sessionBar.setAttribute('data-conversation-slot', 'sessionBar');

		const sessionWindowGrid = append(content, $('.conversation-session-window-grid'));

		this._slots = { sessionBar, sessionWindowGrid, editorPartHost: undefined };
		this._onDidCreateSlots.fire(this._slots);

		return content;
	}

	override layout(width: number, height: number, top: number, left: number): void {
		if (!this.layoutService.isVisible(Parts.CONVERSATION_PART)) {
			return;
		}

		super.layout(width, height, top, left);
		this.layoutContents(width, height);
	}

	focus(): void {
		const dockInput = this.getContainer()?.querySelector('textarea.conversation-lens-dock-input') as HTMLTextAreaElement | null;
		if (dockInput) {
			dockInput.focus();
			return;
		}
		this.getContainer()?.focus();
	}

	toJSON(): object {
		return {
			type: Parts.CONVERSATION_PART
		};
	}
}

registerSingleton(IConversationPartService, ConversationPart, InstantiationType.Eager);
