/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationPart.css';
import './media/ua-common.css';
import { $, append } from '../../../../base/browser/dom.js';
import { LayoutPriority } from '../../../../base/browser/ui/splitview/splitview.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { Part } from '../../part.js';
import { IEditorGroupsService } from '../../../services/editor/common/editorGroupsService.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { appendPartRegionHideControl } from './partRegionHideControl.js';

export const conversationSessionLeafHiddenClass = 'conversation-session-leaf-hidden';
export const conversationSessionLeafPrimaryClass = 'conversation-session-leaf-primary';
export const conversationSessionLeafSecondaryClass = 'conversation-session-leaf-secondary';

export const IConversationPartService = createDecorator<IConversationPartService>('conversationPartService');

/**
 * Slot hosts inside {@link ConversationPart}. The Part does not render product
 * chrome; `workbench/contrib/conversation` fills these elements.
 */
export interface IConversationLensSlots {
	/** Test / leftover path only. Production pane does not pass this (leaf-level bar). */
	readonly sessionBar?: HTMLElement;
	/** Page-chrome / overlay host for 「对话 | 轨迹」. */
	readonly lensTablist?: HTMLElement;
	readonly timeline: HTMLElement;
	readonly dock: HTMLElement;
	/** Non-root sub-agent chat id (≡ engine agent_id) for trajectory attribution filtering. */
	readonly filterAgentId?: string;
	/** This leaf's session; omitted lenses follow the roster active session. */
	readonly sessionKey?: string;
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
	/** Fired at the end of {@link focus}; CS-4 contrib scrolls pending seats from here. */
	readonly onDidFocus: Event<void>;
	getSlots(): IConversationPartWindowSlots | undefined;
	setFocusedLeafContainer(container: HTMLElement | undefined): void;
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
	readonly minimumHeight: number = 160;
	readonly maximumHeight: number = Number.POSITIVE_INFINITY;
	get snap(): boolean { return true; }

	readonly priority = LayoutPriority.High;

	//#endregion

	private focusedLeafContainer: HTMLElement | undefined;
	private _slots: IConversationPartWindowSlots | undefined;
	private readonly _onDidCreateSlots = this._register(new Emitter<IConversationPartWindowSlots>());
	readonly onDidCreateSlots: Event<IConversationPartWindowSlots> = this._onDidCreateSlots.event;
	private readonly _onDidFocus = this._register(new Emitter<void>());
	readonly onDidFocus: Event<void> = this._onDidFocus.event;

	constructor(
		@IThemeService themeService: IThemeService,
		@IStorageService storageService: IStorageService,
		@IWorkbenchLayoutService layoutService: IWorkbenchLayoutService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
	) {
		super(Parts.CONVERSATION_PART, { hasTitle: false }, themeService, storageService, layoutService);
	}

	getSlots(): IConversationPartWindowSlots | undefined {
		return this._slots;
	}

	setFocusedLeafContainer(container: HTMLElement | undefined): void {
		this.focusedLeafContainer = container;
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
		this.layoutConversationEditorParts();
	}

	/**
	 * Subsequent chrome / window resize must re-layout each conversation
	 * editor part from its leaf host size. Creation already does a first
	 * layout (host size or 800×600); skipping 0×0 hosts avoids clobbering
	 * that first layout when flex has not assigned pixels yet.
	 */
	private layoutConversationEditorParts(): void {
		for (const part of this.editorGroupsService.conversationParts) {
			const host = part.getContainer();
			if (!host) {
				continue;
			}

			const hostWidth = host.clientWidth;
			const hostHeight = host.clientHeight;
			if (hostWidth <= 0 || hostHeight <= 0) {
				continue;
			}

			part.layout(hostWidth, hostHeight, 0, 0);
		}
	}

	focus(): void {
		const root = this.resolveFocusRoot();
		// eslint-disable-next-line no-restricted-syntax -- the dock input belongs to the lens, which this part only hosts
		const dockInput = root?.querySelector('textarea.conversation-lens-dock-input') as HTMLTextAreaElement | null;
		const autoFocus = this.configurationService.getValue<boolean>('ua.client.chatInput.autoFocus') !== false;
		if (dockInput && autoFocus) {
			dockInput.focus();
		} else if (root) {
			root.focus();
		} else {
			this.getContainer()?.focus();
		}
		this._onDidFocus.fire();
	}

	private resolveFocusRoot(): HTMLElement | undefined {
		const focused = this.focusedLeafContainer;
		if (focused && !focused.classList.contains(conversationSessionLeafHiddenClass)) {
			return focused;
		}
		const container = this.getContainer();
		const firstVisible = container?.querySelector(`.conversation-session-leaf:not(.${conversationSessionLeafHiddenClass})`) as HTMLElement | null;
		// No session-window leaves (direct lens mount): search the whole part so the dock textarea still receives focus.
		return firstVisible ?? container ?? undefined;
	}

	toJSON(): object {
		return {
			type: Parts.CONVERSATION_PART
		};
	}
}

registerSingleton(IConversationPartService, ConversationPart, InstantiationType.Eager);
