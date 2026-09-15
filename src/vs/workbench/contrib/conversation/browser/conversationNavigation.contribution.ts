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
import { MOUSE_BACK_FORWARD_NAVIGATION_SETTING } from '../../../services/history/common/history.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { IEditorGroupsService, IConversationEditorPart } from '../../../services/editor/common/editorGroupsService.js';
import { registerConversationNavigationConfiguration } from '../common/conversationNavigation.js';
import { ConversationNavigationService, IConversationNavigationService } from './conversationNavigationService.js';
import { IConversationSessionChatService } from './conversationSessionChatService.js';
import { IConversationSessionWindowService } from './conversationSessionWindowService.js';

registerConversationNavigationConfiguration();
registerSingleton(IConversationNavigationService, ConversationNavigationService, InstantiationType.Delayed);

export class ConversationNavigationContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.conversationNavigation';

	private readonly registeredParts = new Set<IConversationEditorPart>();
	private readonly leafNavStores = new Map<string, DisposableStore>();

	constructor(
		@IConversationNavigationService private readonly navigationService: IConversationNavigationService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@IConversationSessionChatService private readonly sessionChatService: IConversationSessionChatService,
		@IConversationSessionWindowService private readonly sessionWindowService: IConversationSessionWindowService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
	) {
		super();

		this.registerExistingParts();
		this._register(this.editorGroupsService.onDidAddGroup(() => this.registerExistingParts()));
		this.remountLeafNav();
		this._register(this.sessionWindowService.onDidChangeVisibleWindows(() => this.remountLeafNav()));

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

	private remountLeafNav(): void {
		for (const sessionKey of this.sessionWindowService.getAllLeafSessionKeys()) {
			if (this.leafNavStores.has(sessionKey)) {
				continue;
			}
			const leaf = this.sessionWindowService.getLeafSlots(sessionKey);
			if (!leaf) {
				continue;
			}
			const store = new DisposableStore();
			this.mountWindowNav(leaf.sessionBar, sessionKey, store);
			this.leafNavStores.set(sessionKey, store);
			this._register(store);
		}
	}

	private mountWindowNav(sessionBarHost: HTMLElement, sessionKey: string, store: DisposableStore): void {
		// eslint-disable-next-line no-restricted-syntax -- presence probe on the session bar built elsewhere
		if (sessionBarHost.querySelector('.conversation-window-nav')) {
			return;
		}

		const nav = append(sessionBarHost, $('.conversation-window-nav'));
		nav.setAttribute('role', 'navigation');
		nav.setAttribute('aria-label', localize('conversationWindowNavigation', "Conversation history"));

		const resolvePart = () => this.sessionChatService.getConversationPart(sessionKey);

		const backButton = store.add(new Button(nav, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: localize('conversationNavigateBack', "Go Back"),
		}));
		backButton.icon = Codicon.arrowLeft;
		backButton.enabled = false;

		const forwardButton = store.add(new Button(nav, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: localize('conversationNavigateForward', "Go Forward"),
		}));
		forwardButton.icon = Codicon.arrowRight;
		forwardButton.enabled = false;

		const updateButtons = () => {
			const part = resolvePart();
			backButton.enabled = this.navigationService.canGoBack(part);
			forwardButton.enabled = this.navigationService.canGoForward(part);
		};

		store.add(this.navigationService.onDidChangeStack(() => updateButtons()));
		updateButtons();

		store.add(backButton.onDidClick(() => {
			void this.navigationService.goBack(resolvePart());
		}));
		store.add(forwardButton.onDidClick(() => {
			void this.navigationService.goForward(resolvePart());
		}));

		const closeNonRootButton = store.add(new Button(nav, {
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
			closeNonRootButton.enabled = this.sessionChatService.canCloseNonRoot(sessionKey);
		};

		store.add(this.sessionChatService.onDidChangeCloseNonRootState(() => updateCloseNonRootButton()));
		updateCloseNonRootButton();

		store.add(closeNonRootButton.onDidClick(() => {
			void this.sessionChatService.closeNonRootTabs(sessionKey);
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
