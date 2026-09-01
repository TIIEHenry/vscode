/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationSubAgentOverlay.css';
import { $, addDisposableListener, append, EventType } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Emitter } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { ConversationLens } from './conversationLens.js';

export const conversationSubAgentOverlayClass = 'conversation-subagent-overlay';

export interface IConversationSubAgentOverlayState {
	readonly sessionKey: string;
	readonly chatId: string;
	readonly title: string;
}

export class ConversationSubAgentOverlay extends Disposable {

	private readonly _onDidClose = this._register(new Emitter<void>());
	readonly onDidClose = this._onDidClose.event;

	private readonly _onDidRequestMaximize = this._register(new Emitter<IConversationSubAgentOverlayState>());
	readonly onDidRequestMaximize = this._onDidRequestMaximize.event;

	readonly element: HTMLElement;

	private chrome!: HTMLElement;
	private body!: HTMLElement;
	private readonly lensDisposables = this._register(new DisposableStore());
	private state: IConversationSubAgentOverlayState | undefined;

	constructor(
		parent: HTMLElement,
		private readonly sessionBar: HTMLElement,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
	) {
		super();
		this.element = append(parent, $(`.${conversationSubAgentOverlayClass}`));
		this.element.setAttribute('role', 'dialog');
		this.element.setAttribute('aria-modal', 'false');
		this.element.hidden = true;
		this.renderChrome();
	}

	private renderChrome(): void {
		this.chrome = append(this.element, $('.conversation-subagent-overlay-chrome'));
		const title = append(this.chrome, $('.conversation-subagent-overlay-title'));
		title.textContent = localize('conversationSubAgentOverlayTitle', "Sub-agent");

		const actions = append(this.chrome, $('.conversation-subagent-overlay-actions'));

		const maximizeButton = this._register(new Button(actions, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: localize('conversationSubAgentOverlayMaximize', "Maximize to tab"),
		}));
		maximizeButton.icon = Codicon.screenFull;
		maximizeButton.element.classList.add('conversation-subagent-overlay-maximize');
		this._register(maximizeButton.onDidClick(() => {
			if (this.state) {
				this._onDidRequestMaximize.fire(this.state);
			}
		}));

		const closeButton = this._register(new Button(actions, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: localize('conversationSubAgentOverlayClose', "Close"),
		}));
		closeButton.icon = Codicon.close;
		closeButton.element.classList.add('conversation-subagent-overlay-close');
		this._register(closeButton.onDidClick(() => this.close()));

		this.body = append(this.element, $('.conversation-subagent-overlay-body'));
		this._register(addDisposableListener(this.element, EventType.KEY_DOWN, event => {
			if (event.key === 'Escape') {
				event.stopPropagation();
				this.close();
			}
		}));
	}

	open(state: IConversationSubAgentOverlayState): void {
		this.state = state;
		this.element.hidden = false;
		this.element.setAttribute('aria-label', state.title);
		const titleElement = this.chrome.querySelector('.conversation-subagent-overlay-title') as HTMLElement;
		titleElement.textContent = state.title;

		this.lensDisposables.clear();
		this.body.replaceChildren();
		const timeline = append(this.body, $('.conversation-timeline'));
		timeline.setAttribute('data-conversation-slot', 'timeline');
		const dock = append(this.body, $('.conversation-dock'));
		dock.setAttribute('data-conversation-slot', 'dock');
		this.lensDisposables.add(this.instantiationService.createInstance(ConversationLens, { sessionBar: this.sessionBar, timeline, dock }));
	}

	close(): void {
		if (this.element.hidden) {
			return;
		}
		this.element.hidden = true;
		this.state = undefined;
		this.lensDisposables.clear();
		this.body.replaceChildren();
		this._onDidClose.fire();
	}

	isOpen(): boolean {
		return !this.element.hidden;
	}

	getState(): IConversationSubAgentOverlayState | undefined {
		return this.state;
	}
}
