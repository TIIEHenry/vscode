/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationNavigation.css';
import { $, addDisposableListener, append, EventType } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Event } from '../../../../base/common/event.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { IConversationPartService } from '../../../browser/parts/conversation/conversationPart.js';
import { MOUSE_BACK_FORWARD_NAVIGATION_SETTING } from '../../../services/history/common/history.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { IEditorGroupsService, IConversationEditorPart } from '../../../services/editor/common/editorGroupsService.js';
import { registerConversationNavigationConfiguration } from '../common/conversationNavigation.js';
import { ConversationNavigationService, IConversationNavigationService } from './conversationNavigationService.js';
import { IConversationSessionChatService } from './conversationSessionChatService.js';

registerConversationNavigationConfiguration();
registerSingleton(IConversationNavigationService, ConversationNavigationService, InstantiationType.Delayed);

class ConversationNavigationContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.conversationNavigation';

	private readonly registeredParts = new Set<IConversationEditorPart>();

	constructor(
		@IConversationNavigationService private readonly navigationService: IConversationNavigationService,
		@IConversationPartService private readonly conversationPartService: IConversationPartService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@IConversationSessionChatService private readonly sessionChatService: IConversationSessionChatService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
	) {
		super();

		this.registerExistingParts();
		this._register(this.editorGroupsService.onDidAddGroup(() => this.registerExistingParts()));

		const slots = this.conversationPartService.getSlots();
		if (slots) {
			this.mountWindowNav(slots.sessionBar);
		} else {
			this._register(this.conversationPartService.onDidCreateSlots(({ sessionBar }) => this.mountWindowNav(sessionBar)));
		}

		this.registerMouseNavigationListener();
	}

	private registerExistingParts(): void {
		for (const part of this.editorGroupsService.conversationParts) {
			if (this.registeredParts.has(part)) {
				continue;
			}
			this.registeredParts.add(part);
			this._register(this.navigationService.registerPart(part));
			this._register(this.sessionChatService.registerPartListeners(part));
		}
	}

	private mountWindowNav(sessionBarHost: HTMLElement): void {
		if (sessionBarHost.querySelector('.conversation-window-nav')) {
			return;
		}

		const nav = append(sessionBarHost, $('.conversation-window-nav'));
		nav.setAttribute('role', 'navigation');
		nav.setAttribute('aria-label', localize('conversationWindowNavigation', "Conversation history"));

		const backButton = this._register(new Button(nav, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: localize('conversationNavigateBack', "Go Back"),
		}));
		backButton.icon = Codicon.arrowLeft;
		backButton.enabled = false;

		const forwardButton = this._register(new Button(nav, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: localize('conversationNavigateForward', "Go Forward"),
		}));
		forwardButton.icon = Codicon.arrowRight;
		forwardButton.enabled = false;

		const updateButtons = () => {
			backButton.enabled = this.navigationService.canGoBack();
			forwardButton.enabled = this.navigationService.canGoForward();
		};

		this._register(this.navigationService.onDidChangeStack(() => updateButtons()));
		updateButtons();

		this._register(backButton.onDidClick(() => {
			void this.navigationService.goBack();
		}));
		this._register(forwardButton.onDidClick(() => {
			void this.navigationService.goForward();
		}));

		const closeNonRootButton = this._register(new Button(nav, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: localize('conversationCloseNonRootTabs', "Close extension tabs"),
		}));
		closeNonRootButton.icon = Codicon.closeAll;
		closeNonRootButton.element.classList.add('conversation-close-non-root');
		closeNonRootButton.enabled = false;

		const updateCloseNonRootButton = () => {
			closeNonRootButton.enabled = this.sessionChatService.canCloseNonRoot();
		};

		this._register(this.sessionChatService.onDidChangeCloseNonRootState(() => updateCloseNonRootButton()));
		updateCloseNonRootButton();

		this._register(closeNonRootButton.onDidClick(() => {
			void this.sessionChatService.closeNonRootTabs();
		}));
	}

	private registerMouseNavigationListener(): void {
		const mouseNavigationListeners = this._register(new DisposableStore());
		const handleMouseBackForwardSupport = () => {
			mouseNavigationListeners.clear();

			if (!this.configurationService.getValue(MOUSE_BACK_FORWARD_NAVIGATION_SETTING)) {
				return;
			}

			this._register(Event.runAndSubscribe(this.layoutService.onDidAddContainer, ({ container, disposables }) => {
				const eventDisposables = disposables.add(new DisposableStore());
				eventDisposables.add(addDisposableListener(container, EventType.MOUSE_DOWN, event => this.handleMouseNavigation(event, true), true));
				eventDisposables.add(addDisposableListener(container, EventType.MOUSE_UP, event => this.handleMouseNavigation(event, false), true));
				mouseNavigationListeners.add(eventDisposables);
			}, { container: this.layoutService.mainContainer, disposables: this._store }));
		};

		this._register(this.configurationService.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(MOUSE_BACK_FORWARD_NAVIGATION_SETTING)) {
				handleMouseBackForwardSupport();
			}
		}));

		handleMouseBackForwardSupport();
	}

	private handleMouseNavigation(event: MouseEvent, isMouseDown: boolean): void {
		if (!this.configurationService.getValue(MOUSE_BACK_FORWARD_NAVIGATION_SETTING)) {
			return;
		}

		if (!this.layoutService.hasFocus(Parts.CONVERSATION_PART)) {
			return;
		}

		if (event.button !== 3 && event.button !== 4) {
			return;
		}

		event.preventDefault();
		event.stopPropagation();
		event.stopImmediatePropagation();

		if (!isMouseDown) {
			return;
		}

		if (event.button === 3) {
			void this.navigationService.goBack();
		} else {
			void this.navigationService.goForward();
		}
	}
}

registerWorkbenchContribution2(ConversationNavigationContribution.ID, ConversationNavigationContribution, WorkbenchPhase.AfterRestored);
