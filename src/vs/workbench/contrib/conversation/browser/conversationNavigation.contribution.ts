/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationNavigation.css';
import { $, addDisposableListener, append, EventType, getWindow, isHTMLElement } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Event } from '../../../../base/common/event.js';
import { AnchorPosition } from '../../../../base/common/layout.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextViewService, IOpenContextView } from '../../../../platform/contextview/browser/contextView.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IWorkbenchContribution, registerWorkbenchContribution2, WorkbenchPhase } from '../../../common/contributions.js';
import { MOUSE_BACK_FORWARD_NAVIGATION_SETTING } from '../../../services/history/common/history.js';
import { IWorkbenchLayoutService, Parts } from '../../../services/layout/browser/layoutService.js';
import { IEditorGroupsService, IConversationEditorPart } from '../../../services/editor/common/editorGroupsService.js';
import { registerConversationNavigationConfiguration } from '../common/conversationNavigation.js';
import { conversationLensSessionBarDownAgent, conversationLensSessionBarUpAgent } from './conversationLensSessionBarStrings.js';
import { ConversationNavigationService, IConversationNavigationService } from './conversationNavigationService.js';
import { IConversationSessionChatService } from './conversationSessionChatService.js';
import { IConversationSessionWindowService } from './conversationSessionWindowService.js';

registerConversationNavigationConfiguration();
registerSingleton(IConversationNavigationService, ConversationNavigationService, InstantiationType.Delayed);

export class ConversationNavigationContribution extends Disposable implements IWorkbenchContribution {

	static readonly ID = 'workbench.contrib.conversationNavigation';

	private readonly registeredParts = new Set<IConversationEditorPart>();
	private readonly leafNavStores = new Map<string, DisposableStore>();
	private readonly directChildPopups = new Map<string, IOpenContextView>();

	constructor(
		@IConversationNavigationService private readonly navigationService: IConversationNavigationService,
		@IEditorGroupsService private readonly editorGroupsService: IEditorGroupsService,
		@IConversationSessionChatService private readonly sessionChatService: IConversationSessionChatService,
		@IConversationSessionWindowService private readonly sessionWindowService: IConversationSessionWindowService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IWorkbenchLayoutService private readonly layoutService: IWorkbenchLayoutService,
		@IContextViewService private readonly contextViewService: IContextViewService,
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
			this.mountAgentLevel(leaf.sessionBar, sessionKey, store);
			this.mountEditorNav(leaf.sessionWindow, sessionKey, store);
			this.leafNavStores.set(sessionKey, store);
			this._register(store);
		}
	}

	private mountAgentLevel(sessionBarHost: HTMLElement, sessionKey: string, store: DisposableStore): void {
		// eslint-disable-next-line no-restricted-syntax -- presence probe on the session bar built elsewhere
		if (sessionBarHost.querySelector('.conversation-agent-up')) {
			return;
		}

		const upHost = $('.conversation-agent-up');
		const downHost = $('.conversation-agent-down');
		const placeLevel = () => {
			// eslint-disable-next-line no-restricted-syntax -- session bar chrome is built in conversationLensSessionBar
			const controls = sessionBarHost.querySelector('.conversation-lens-session-controls');
			const parent = controls ?? sessionBarHost;
			if (upHost.parentElement !== parent || parent.firstElementChild !== upHost) {
				parent.insertBefore(upHost, parent.firstChild);
			}
			if (downHost.parentElement !== parent || downHost.previousElementSibling !== upHost) {
				parent.insertBefore(downHost, upHost.nextSibling);
			}
		};
		placeLevel();
		const observer = new MutationObserver(() => placeLevel());
		observer.observe(sessionBarHost, { childList: true, subtree: true });
		store.add({ dispose: () => observer.disconnect() });
		store.add({ dispose: () => this.closeDirectChildPopup(sessionKey) });

		const upButton = store.add(new Button(upHost, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: conversationLensSessionBarUpAgent,
			ariaLabel: conversationLensSessionBarUpAgent,
		}));
		upButton.icon = Codicon.arrowUp;
		upButton.enabled = false;

		const downButton = store.add(new Button(downHost, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: conversationLensSessionBarDownAgent,
			ariaLabel: conversationLensSessionBarDownAgent,
		}));
		downButton.icon = Codicon.arrowDown;
		downButton.enabled = false;

		let listedChildren = '';
		const updateLevelButtons = () => {
			upButton.enabled = this.sessionChatService.canGoUpOneAgent(sessionKey);
			downButton.enabled = this.sessionChatService.canGoDownOneAgent(sessionKey);
			const nextChildren = this.sessionChatService.listDirectChildAgents(sessionKey)
				.map(entry => `${entry.chatId}\t${entry.originKind}\t${entry.title}`)
				.join('\n');
			if (!downButton.enabled || nextChildren !== listedChildren) {
				listedChildren = nextChildren;
				this.closeDirectChildPopup(sessionKey);
			}
		};
		store.add(this.sessionChatService.onDidChangeCatalog(() => updateLevelButtons()));
		store.add(this.sessionChatService.onDidChangeCloseNonRootState(() => updateLevelButtons()));
		updateLevelButtons();

		store.add(upButton.onDidClick(() => {
			void this.sessionChatService.goUpOneAgent(sessionKey).catch(onUnexpectedError).catch(onUnexpectedError);
		}));
		store.add(downButton.onDidClick(() => {
			if (!downButton.enabled) {
				return;
			}
			this.toggleDirectChildPopup(sessionKey, downButton.element);
		}));
	}

	private closeDirectChildPopup(sessionKey: string): void {
		this.directChildPopups.get(sessionKey)?.close();
	}

	private toggleDirectChildPopup(sessionKey: string, anchor: HTMLElement): void {
		const existing = this.directChildPopups.get(sessionKey);
		if (existing) {
			existing.close();
			return;
		}
		const children = this.sessionChatService.listDirectChildAgents(sessionKey);
		if (children.length === 0) {
			return;
		}

		const openView = this.contextViewService.showContextView({
			getAnchor: () => anchor,
			anchorAlignment: AnchorAlignment.LEFT,
			anchorPosition: AnchorPosition.BELOW,
			render: container => {
				const popup = append(container, $('.conversation-agent-down-popup'));
				popup.setAttribute('role', 'menu');
				popup.setAttribute('aria-label', conversationLensSessionBarDownAgent);
				const popupStore = new DisposableStore();
				const items: HTMLButtonElement[] = [];
				for (const child of children) {
					const item = append(popup, $('button.conversation-agent-down-item')) as HTMLButtonElement;
					item.type = 'button';
					item.setAttribute('role', 'menuitem');
					const label = child.title || child.chatId;
					item.textContent = label;
					item.setAttribute('aria-label', label);
					items.push(item);
					popupStore.add(addDisposableListener(item, 'click', event => {
						event.preventDefault();
						event.stopPropagation();
						openView?.close();
						void this.sessionChatService.openDirectChildAgent(sessionKey, child.chatId).catch(onUnexpectedError).catch(onUnexpectedError);
					}));
				}
				popupStore.add(addDisposableListener(popup, 'keydown', event => {
					if (event.key === 'Escape') {
						event.preventDefault();
						event.stopPropagation();
						openView?.close();
						return;
					}
					// Left / right stay with the editor. Only the menu caret moves inside this list.
					if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') {
						return;
					}
					event.preventDefault();
					event.stopPropagation();
					const active = getWindow(popup).document.activeElement;
					const current = items.indexOf(active as HTMLButtonElement);
					const next = event.key === 'ArrowDown'
						? (current + 1) % items.length
						: (current <= 0 ? items.length - 1 : current - 1);
					items[next]?.focus();
				}));
				const viewWindow = getWindow(anchor);
				popupStore.add(addDisposableListener(viewWindow, 'mousedown', event => {
					const target = event.target;
					if (isHTMLElement(target) && (target.closest('.conversation-agent-down-popup') || anchor.contains(target))) {
						return;
					}
					openView?.close();
				}, true));
				popupStore.add(addDisposableListener(viewWindow, 'keydown', event => {
					if (event.key !== 'Escape') {
						return;
					}
					event.preventDefault();
					event.stopPropagation();
					openView?.close();
				}, true));
				items[0]?.focus();
				return toDisposable(() => {
					popup.remove();
					popupStore.dispose();
				});
			},
			onHide: () => {
				if (openView && this.directChildPopups.get(sessionKey) === openView) {
					this.directChildPopups.delete(sessionKey);
				}
			},
		});
		this.directChildPopups.set(sessionKey, openView);
	}

	private mountEditorNav(sessionWindowHost: HTMLElement, sessionKey: string, store: DisposableStore): void {
		// eslint-disable-next-line no-restricted-syntax -- presence probe on the editor area built elsewhere
		if (sessionWindowHost.querySelector('.conversation-editor-nav')) {
			return;
		}

		const editorNav = $('.conversation-editor-nav');
		editorNav.hidden = true;
		sessionWindowHost.insertBefore(editorNav, sessionWindowHost.firstChild);

		const nav = append(editorNav, $('.conversation-window-nav'));
		nav.setAttribute('role', 'navigation');
		nav.setAttribute('aria-label', localize('conversationEditorNavigation', "Conversation editor history"));

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

		const updateEditorNav = () => {
			const part = resolvePart();
			backButton.enabled = this.navigationService.canGoBack(part);
			forwardButton.enabled = this.navigationService.canGoForward(part);
			closeNonRootButton.enabled = this.sessionChatService.canCloseNonRoot(sessionKey);
			editorNav.hidden = !(backButton.enabled || forwardButton.enabled || closeNonRootButton.enabled);
		};

		store.add(this.navigationService.onDidChangeStack(() => updateEditorNav()));
		store.add(this.sessionChatService.onDidChangeCloseNonRootState(() => updateEditorNav()));
		updateEditorNav();

		store.add(backButton.onDidClick(() => {
			void this.navigationService.goBack(resolvePart()).catch(onUnexpectedError).catch(onUnexpectedError);
		}));
		store.add(forwardButton.onDidClick(() => {
			void this.navigationService.goForward(resolvePart()).catch(onUnexpectedError).catch(onUnexpectedError);
		}));
		store.add(closeNonRootButton.onDidClick(() => {
			void this.sessionChatService.closeNonRootTabs(sessionKey).catch(onUnexpectedError).catch(onUnexpectedError);
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
			void this.navigationService.goBack().catch(onUnexpectedError).catch(onUnexpectedError);
		} else {
			void this.navigationService.goForward().catch(onUnexpectedError).catch(onUnexpectedError);
		}
	}
}

registerWorkbenchContribution2(ConversationNavigationContribution.ID, ConversationNavigationContribution, WorkbenchPhase.AfterRestored);
