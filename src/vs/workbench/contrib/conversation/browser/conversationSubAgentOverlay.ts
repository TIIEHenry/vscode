/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationSubAgentOverlay.css';
import { $, addDisposableListener, append, EventHelper, EventType, isHTMLElement } from '../../../../base/browser/dom.js';
import { handleConversationOverlayTab } from './conversationConfirmationSeat.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IConversationAgentBreadcrumbItem } from '../common/conversationAgentHierarchy.js';
import { ConversationAgentBreadcrumbBox } from './conversationAgentBreadcrumb.js';
import { ConversationLens } from './conversationLens.js';

export const conversationSubAgentOverlayClass = 'conversation-subagent-overlay';
export const conversationSubAgentOverlayCardClass = 'conversation-subagent-overlay-card';
export const conversationSubAgentOverlayBackdropClass = 'conversation-subagent-overlay-backdrop';
export const conversationSubAgentOverlayPopoutClass = 'conversation-subagent-overlay-popout';
export const conversationSubAgentOverlayMaximizeClass = 'conversation-subagent-overlay-maximize';
export const conversationSubAgentOverlayCloseClass = 'conversation-subagent-overlay-close';
export const conversationSubAgentOverlayMaximizedAttribute = 'data-maximized';
export const conversationSubAgentOverlayTitleId = 'conversation-subagent-overlay-title';

export interface IConversationSubAgentOverlayState {
	readonly sessionKey: string;
	readonly chatId: string;
	readonly title: string;
	readonly sessionTitle: string;
	readonly breadcrumb: readonly IConversationAgentBreadcrumbItem[];
}

export class ConversationSubAgentOverlay extends Disposable {

	private readonly _onDidClose = this._register(new Emitter<void>());
	readonly onDidClose = this._onDidClose.event;

	private readonly _onDidRequestPromote = this._register(new Emitter<IConversationSubAgentOverlayState>());
	readonly onDidRequestPromote = this._onDidRequestPromote.event;

	private readonly _onDidSelectBreadcrumb = this._register(new Emitter<string>());
	readonly onDidSelectBreadcrumb = this._onDidSelectBreadcrumb.event;

	readonly element: HTMLElement;

	private card!: HTMLElement;
	private header!: HTMLElement;
	private nameElement!: HTMLElement;
	private descriptionElement!: HTMLElement;
	private body!: HTMLElement;
	private maximizeButton!: Button;
	private closeButton!: Button;
	private breadcrumb!: ConversationAgentBreadcrumbBox;
	private readonly lensDisposables = this._register(new DisposableStore());
	private lens: ConversationLens | undefined;
	private state: IConversationSubAgentOverlayState | undefined;
	private maximized = false;

	constructor(
		parent: HTMLElement,
		private readonly sessionBar: HTMLElement,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();
		this.element = append(parent, $(`.${conversationSubAgentOverlayClass}`));
		this.element.setAttribute('role', 'dialog');
		this.element.setAttribute('aria-modal', 'false');
		this.element.setAttribute(conversationSubAgentOverlayMaximizedAttribute, 'false');
		this.element.tabIndex = -1;
		this.element.hidden = true;
		this.renderChrome();
	}

	private renderChrome(): void {
		const backdrop = append(this.element, $(`.${conversationSubAgentOverlayBackdropClass}`));
		this._register(addDisposableListener(backdrop, EventType.MOUSE_DOWN, event => {
			if (event.target === backdrop) {
				EventHelper.stop(event, true);
				this.close();
			}
		}));

		this.card = append(this.element, $(`.${conversationSubAgentOverlayCardClass}`));
		this.header = append(this.card, $('.conversation-subagent-overlay-header'));

		const title = append(this.header, $('.conversation-subagent-overlay-title'));
		const icon = append(title, $('span.conversation-subagent-overlay-icon'));
		icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.commentDiscussion));
		this.nameElement = append(title, $('span.conversation-subagent-overlay-name'));
		this.nameElement.id = conversationSubAgentOverlayTitleId;
		this.descriptionElement = append(title, $('span.conversation-subagent-overlay-description'));

		const actions = append(this.header, $('.conversation-subagent-overlay-actions'));
		const popoutButton = this._register(new Button(actions, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: localize('conversationSubAgentOverlayPromote', "Open as tab"),
		}));
		popoutButton.icon = Codicon.openInProduct;
		popoutButton.element.classList.add(conversationSubAgentOverlayPopoutClass);
		this._register(popoutButton.onDidClick(() => {
			if (this.state) {
				this._onDidRequestPromote.fire(this.state);
			}
		}));

		this.maximizeButton = this._register(new Button(actions, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: localize('conversationSubAgentOverlayMaximize', "Maximize"),
		}));
		this.maximizeButton.icon = Codicon.screenFull;
		this.maximizeButton.element.classList.add(conversationSubAgentOverlayMaximizeClass);
		this.maximizeButton.element.setAttribute('aria-pressed', 'false');
		this._register(this.maximizeButton.onDidClick(() => this.toggleMaximized()));

		const closeButton = this._register(new Button(actions, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: localize('conversationSubAgentOverlayClose', "Close"),
			ariaLabel: localize('conversationSubAgentOverlayClose', "Close"),
		}));
		closeButton.icon = Codicon.close;
		closeButton.element.classList.add(conversationSubAgentOverlayCloseClass);
		this.closeButton = closeButton;
		this._register(closeButton.onDidClick(() => this.close()));

		this._register(addDisposableListener(this.header, EventType.DBLCLICK, event => {
			const target = event.target;
			if (isHTMLElement(target) && (target.closest('.monaco-button') || target.closest('.action-item'))) {
				return;
			}
			EventHelper.stop(event, true);
			this.toggleMaximized();
		}));

		this.breadcrumb = this._register(new ConversationAgentBreadcrumbBox(this.card));
		this._register(this.breadcrumb.onDidSelect(chatId => this._onDidSelectBreadcrumb.fire(chatId)));

		this.body = append(this.card, $('.conversation-subagent-overlay-body'));
		this._register(addDisposableListener(this.element, EventType.KEY_DOWN, event => {
			if (event.key === 'Escape') {
				event.preventDefault();
				event.stopPropagation();
				if (this.lens?.tryDismissLocalInspector()) {
					return;
				}
				this.close();
				return;
			}
			handleConversationOverlayTab(this.element, event);
		}));
	}

	open(state: IConversationSubAgentOverlayState): void {
		this.state = state;
		this.setMaximized(false);
		this.element.hidden = false;
		this.element.setAttribute('aria-modal', 'true');
		this.element.setAttribute('aria-labelledby', conversationSubAgentOverlayTitleId);
		this.element.removeAttribute('aria-label');
		this.nameElement.textContent = state.title;
		this.descriptionElement.textContent = state.sessionTitle;
		this.breadcrumb.setItems([...state.breadcrumb]);
		this.breadcrumb.layout(this.card.clientWidth);
		this.closeButton.focus();

		this.lensDisposables.clear();
		this.lens = undefined;
		this.body.replaceChildren();
		const timeline = append(this.body, $('.conversation-timeline'));
		timeline.setAttribute('data-conversation-slot', 'timeline');
		const dock = append(this.body, $('.conversation-dock'));
		dock.setAttribute('data-conversation-slot', 'dock');
		// Detached S3 harnesses are not inside `.monaco-workbench`; skip the full lens there.
		if (this.element.closest('.monaco-workbench')) {
			const filterAgentId = state.chatId !== 'default' ? state.chatId : undefined;
			this.lens = this.instantiationService.createInstance(ConversationLens, { sessionBar: this.sessionBar, timeline, dock, filterAgentId });
			this.lensDisposables.add(this.lens);
		}
	}

	toggleMaximized(): void {
		if (!this.isOpen()) {
			return;
		}
		this.setMaximized(!this.maximized);
	}

	setMaximized(maximized: boolean): void {
		this.maximized = maximized;
		this.element.setAttribute(conversationSubAgentOverlayMaximizedAttribute, String(maximized));
		this.maximizeButton.icon = maximized ? Codicon.screenNormal : Codicon.screenFull;
		const title = maximized
			? localize('conversationSubAgentOverlayRestore', "Restore")
			: localize('conversationSubAgentOverlayMaximize', "Maximize");
		this.maximizeButton.setTitle(title);
		this.maximizeButton.element.setAttribute('aria-pressed', String(maximized));
		this.breadcrumb.layout(this.card.clientWidth);
	}

	isMaximized(): boolean {
		return this.maximized && this.isOpen();
	}

	close(): void {
		if (this.element.hidden) {
			return;
		}
		this.element.hidden = true;
		this.element.setAttribute('aria-modal', 'false');
		this.element.removeAttribute('aria-labelledby');
		this.state = undefined;
		this.maximized = false;
		this.element.setAttribute(conversationSubAgentOverlayMaximizedAttribute, 'false');
		this.maximizeButton.icon = Codicon.screenFull;
		this.maximizeButton.setTitle(localize('conversationSubAgentOverlayMaximize', "Maximize"));
		this.maximizeButton.element.setAttribute('aria-pressed', 'false');
		this.lensDisposables.clear();
		this.lens = undefined;
		this.body.replaceChildren();
		this.breadcrumb.setItems([]);
		this._onDidClose.fire();
	}

	isOpen(): boolean {
		return !this.element.hidden;
	}

	getState(): IConversationSubAgentOverlayState | undefined {
		return this.state;
	}
}
