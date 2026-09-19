/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { AnchorPosition } from '../../../../base/common/layout.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { IDisposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextViewService, IOpenContextView } from '../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { defaultButtonStyles, defaultSelectBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { hasNativeContextMenu } from '../../../../platform/window/common/window.js';
import { ConversationEngineHistoryList } from './conversationEngineHistoryList.js';
import { ConversationEngineSnapshotsList } from './conversationEngineSnapshotsList.js';
import { conversationLensSessionBarCloseExtensionTabs, conversationLensSessionBarConversationTab, conversationLensSessionBarDeleteSession, conversationLensSessionBarGoBack, conversationLensSessionBarGoForward, conversationLensSessionBarHistory, conversationLensSessionBarMore, conversationLensSessionBarNewSession, conversationLensSessionBarRenameInputAria, conversationLensSessionBarRenameTitle, conversationLensSessionBarSnapshots, conversationLensSessionBarTrajectoryTab } from './conversationLensSessionBarStrings.js';
import { IConversationNavigationService } from './conversationNavigationService.js';
import { IConversationSessionChatService } from './conversationSessionChatService.js';
import type { ConversationLensId } from './conversationLensProjection.js';
import { IConversationRosterService } from './conversationStubService.js';
import { ConversationVisualizeOverlay } from './conversationVisualizeOverlay.js';
import type { ConversationComposerPostFailureReason } from './conversationLensDockStrings.js';
import { isConversationPairingHold, showConversationPart } from './conversationSessionStatus.js';

export interface IConversationLensSessionBarHost {
	sessionTitleButton: HTMLButtonElement;
	sessionTitleLive: HTMLElement;
	sessionTitleInput: HTMLInputElement;
	sessionTitleEditing: boolean;
	sessionTitleEditSnapshot: string;
	sessionSelectBox: SelectBox;
	sessionSelectContainer: HTMLElement;
	newSessionButton: Button;
	deleteSessionButton: Button;
	sessionMoreButton: Button;
	sessionMoreContextView: IOpenContextView | undefined;
	lensTablist: HTMLElement;
	lensTabConversation: HTMLButtonElement;
	lensTabTrajectory: HTMLButtonElement;
	sessionSyncBadge: HTMLElement;
	suppressSessionSelect: boolean;
	readingColumn: HTMLElement;
	engineHistoryList: ConversationEngineHistoryList | undefined;
	engineSnapshotsList: ConversationEngineSnapshotsList | undefined;
	dockTextarea: HTMLTextAreaElement;
	readonly stubService: IConversationRosterService;
	readonly uaConnection: IUniverseAgentConnection;
	readonly contextViewService: IContextViewService;
	readonly configurationService: IConfigurationService;
	readonly instantiationService: IInstantiationService;
	readonly visualizeOverlay: ConversationVisualizeOverlay;
	register<T extends IDisposable>(disposable: T): T;
	getBoundSessionId(): string;
	getSessionBarSelectId?(): string;
	switchLeafSession?(sessionId: string): Promise<void>;
	setLensId(lensId: ConversationLensId): void;
	handleLensTablistKeyDown(event: KeyboardEvent): void;
	beginSessionTitleEdit(): void;
	commitSessionTitleEdit(): void;
	cancelSessionTitleEdit(): void;
	createNewSession(): void;
	deleteActiveSession(): void;
	switchToSession(sessionId: string): void;
	writeComposerDraft(sessionId: string, text: string): void;
	deleteComposerDraftsForSession(sessionId: string): void;
	refreshSessionSelectOptions(): void;
	updateSessionTitle(): void;
	showPostFailure(reason: ConversationComposerPostFailureReason): void;
	setInputMaximized(maximized: boolean): void;
}

export function mountSessionBar(host: IConversationLensSessionBarHost, barHost: HTMLElement, options?: { omitLensTablist?: boolean }): void {

		const bar = append(barHost, $('.conversation-lens-session-bar'));
		bar.setAttribute('role', 'banner');

		const leading = append(bar, $('.conversation-lens-session-bar-leading'));
		const icon = append(leading, $('span.conversation-lens-session-icon'));
		icon.setAttribute('aria-hidden', 'true');
		icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.commentDiscussion));

		if (!options?.omitLensTablist) {
			mountLensTablist(host, leading);
		}

		host.sessionSyncBadge = append(leading, $('span.conversation-lens-session-sync-badge'));
		host.sessionSyncBadge.hidden = true;
		host.sessionSyncBadge.setAttribute('aria-live', 'polite');

		const titleWrap = append(leading, $('.conversation-lens-session-title-wrap'));
		host.sessionTitleButton = append(titleWrap, $('button.conversation-lens-session-title')) as HTMLButtonElement;
		host.sessionTitleButton.type = 'button';
		host.sessionTitleButton.title = conversationLensSessionBarRenameTitle;
		host.sessionTitleInput = append(titleWrap, $('input.conversation-lens-session-title-input')) as HTMLInputElement;
		host.sessionTitleInput.type = 'text';
		host.sessionTitleInput.hidden = true;
		host.sessionTitleInput.setAttribute('aria-label', conversationLensSessionBarRenameInputAria);
		host.sessionTitleLive = append(titleWrap, $('span.conversation-lens-session-title-live'));
		host.sessionTitleLive.setAttribute('aria-live', 'polite');
		host.sessionTitleLive.setAttribute('aria-atomic', 'true');
		host.register(addDisposableListener(host.sessionTitleButton, 'click', () => beginSessionTitleEdit(host)));
		host.register(addDisposableListener(host.sessionTitleInput, 'keydown', e => {
			if (e.keyCode === KeyCode.Enter) {
				e.preventDefault();
				commitSessionTitleEdit(host);
			} else if (e.keyCode === KeyCode.Escape) {
				e.preventDefault();
				e.stopPropagation();
				cancelSessionTitleEdit(host);
			}
		}));
		host.register(addDisposableListener(host.sessionTitleInput, 'blur', () => {
			if (host.sessionTitleEditing) {
				commitSessionTitleEdit(host);
			}
		}));

		const controls = append(bar, $('.conversation-lens-session-controls'));

		const switcherLabel = append(controls, $('span.conversation-lens-session-switcher-label'));
		switcherLabel.textContent = localize('conversationLens.sessionLabel', "Session");

		host.sessionSelectContainer = append(controls, $('.conversation-lens-session-select'));
		host.sessionSelectBox = host.register(createSessionSelectBox(host));
		host.sessionSelectBox.render(host.sessionSelectContainer);

		const newSessionContainer = append(controls, $('.conversation-lens-session-new'));
		host.newSessionButton = host.register(new Button(newSessionContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: conversationLensSessionBarNewSession,
		}));
		host.newSessionButton.icon = Codicon.add;
		host.register(host.newSessionButton.onDidClick(() => createNewSession(host)));

		const deleteSessionContainer = append(controls, $('.conversation-lens-session-delete'));
		host.deleteSessionButton = host.register(new Button(deleteSessionContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: conversationLensSessionBarDeleteSession,
		}));
		host.deleteSessionButton.icon = Codicon.trash;
		host.register(host.deleteSessionButton.onDidClick(() => deleteActiveSession(host)));
		bindDeleteDraftRollback(host);
		updateSessionBarWriteChrome(host);

		const moreContainer = append(controls, $('.conversation-lens-session-more'));
		host.sessionMoreButton = host.register(new Button(moreContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: conversationLensSessionBarMore,
		}));
		host.sessionMoreButton.icon = Codicon.ellipsis;
		host.register(host.sessionMoreButton.onDidClick(() => toggleSessionBarMoreContextView(host)));

		host.engineHistoryList = host.register(host.instantiationService.createInstance(
			ConversationEngineHistoryList,
			controls,
			host.readingColumn));
		host.engineHistoryList.setOnWillShow(() => host.setInputMaximized(false));
		host.engineSnapshotsList = host.register(host.instantiationService.createInstance(
			ConversationEngineSnapshotsList,
			controls,
			host.readingColumn));
		host.engineSnapshotsList.setOnWillShow(() => host.setInputMaximized(false));

		host.register(host.sessionSelectBox.onDidSelect(e => {
			if (host.suppressSessionSelect) {
				return;
			}
			const session = host.stubService.getSessions()[e.index];
			if (!session) {
				return;
			}
			switchToSession(host, session.id);
		}));
	
}

function trySessionBarWindowNav(host: IConversationLensSessionBarHost): {
	readonly canGoBack: boolean;
	readonly canGoForward: boolean;
	readonly canCloseNonRoot: boolean;
	readonly goBack: () => void;
	readonly goForward: () => void;
	readonly closeNonRoot: () => void;
} | undefined {
	try {
		return host.instantiationService.invokeFunction(accessor => {
			const navigation = accessor.get(IConversationNavigationService);
			const sessionChat = accessor.get(IConversationSessionChatService);
			return {
				canGoBack: navigation.canGoBack(),
				canGoForward: navigation.canGoForward(),
				canCloseNonRoot: sessionChat.canCloseNonRoot(),
				goBack: () => void navigation.goBack(),
				goForward: () => void navigation.goForward(),
				closeNonRoot: () => void sessionChat.closeNonRootTabs(),
			};
		});
	} catch {
		return undefined;
	}
}

function toggleSessionBarMoreContextView(host: IConversationLensSessionBarHost): void {
	if (host.sessionMoreContextView) {
		host.sessionMoreContextView.close();
		return;
	}
	host.sessionMoreContextView = host.contextViewService.showContextView({
		getAnchor: () => host.sessionMoreButton.element,
		anchorAlignment: AnchorAlignment.RIGHT,
		anchorPosition: AnchorPosition.BELOW,
		render: container => {
			const popup = append(container, $('.conversation-lens-dock-more-popup'));
			popup.setAttribute('role', 'menu');
			popup.setAttribute('aria-label', conversationLensSessionBarMore);
			const store = new DisposableStore();
			const addAction = (label: string, run: () => void, enabled = true) => {
				const item = append(popup, $('button.conversation-lens-dock-more-item')) as HTMLButtonElement;
				item.type = 'button';
				item.setAttribute('role', 'menuitem');
				item.textContent = label;
				item.disabled = !enabled;
				item.setAttribute('aria-disabled', enabled ? 'false' : 'true');
				store.add(addDisposableListener(item, 'click', e => {
					e.preventDefault();
					e.stopPropagation();
					if (!enabled) {
						return;
					}
					host.sessionMoreContextView?.close();
					run();
				}));
			};
			const navigation = trySessionBarWindowNav(host) ?? {
				canGoBack: false,
				canGoForward: false,
				canCloseNonRoot: false,
				goBack: () => { },
				goForward: () => { },
				closeNonRoot: () => { },
			};
			addAction(conversationLensSessionBarHistory, () => host.engineHistoryList?.show());
			addAction(conversationLensSessionBarSnapshots, () => host.engineSnapshotsList?.show());
			addAction(conversationLensSessionBarGoBack, () => navigation.goBack(), navigation.canGoBack);
			addAction(conversationLensSessionBarGoForward, () => navigation.goForward(), navigation.canGoForward);
			addAction(conversationLensSessionBarCloseExtensionTabs, () => navigation.closeNonRoot(), navigation.canCloseNonRoot);
			addAction(conversationLensSessionBarNewSession, () => createNewSession(host));
			addAction(conversationLensSessionBarDeleteSession, () => deleteActiveSession(host));
			for (const session of host.stubService.getSessions()) {
				addAction(session.title, () => switchToSession(host, session.id));
			}
			return toDisposable(() => {
				store.dispose();
				host.sessionMoreContextView = undefined;
			});
		},
		onDOMEvent: e => {
			if (e.type === 'click') {
				const target = e.target as HTMLElement | null;
				if (target && (target.closest('.conversation-lens-dock-more-popup') || host.sessionMoreButton.element.contains(target))) {
					return;
				}
				host.sessionMoreContextView?.close();
			}
		},
		onHide: () => {
			host.sessionMoreContextView = undefined;
		},
	});
}

export function mountLensTablist(host: IConversationLensSessionBarHost, tablistHost: HTMLElement): void {

		host.lensTablist = append(tablistHost, $('.conversation-lens-lens-tabs'));
		host.lensTablist.setAttribute('role', 'tablist');
		host.lensTablist.setAttribute('aria-label', localize('conversationLens.lensTabs', "Conversation lens"));
		host.lensTabConversation = append(host.lensTablist, $('button.conversation-lens-lens-tab')) as HTMLButtonElement;
		host.lensTabConversation.type = 'button';
		host.lensTabConversation.id = 'conversation-lens-tab-conversation';
		host.lensTabConversation.setAttribute('role', 'tab');
		host.lensTabConversation.setAttribute('data-lens-id', 'conversation');
		host.lensTabConversation.textContent = conversationLensSessionBarConversationTab;
		host.lensTabTrajectory = append(host.lensTablist, $('button.conversation-lens-lens-tab')) as HTMLButtonElement;
		host.lensTabTrajectory.type = 'button';
		host.lensTabTrajectory.id = 'conversation-lens-tab-trajectory';
		host.lensTabTrajectory.setAttribute('role', 'tab');
		host.lensTabTrajectory.setAttribute('data-lens-id', 'trajectory');
		host.lensTabTrajectory.textContent = conversationLensSessionBarTrajectoryTab;
		host.register(addDisposableListener(host.lensTabConversation, 'click', () => host.setLensId('conversation')));
		host.register(addDisposableListener(host.lensTabTrajectory, 'click', () => host.setLensId('trajectory')));
		host.register(addDisposableListener(host.lensTablist, 'keydown', event => host.handleLensTablistKeyDown(event)));

}

export function createSessionSelectBox(host: IConversationLensSessionBarHost): SelectBox {

		const sessions = host.stubService.getSessions();
		const selectedId = host.getSessionBarSelectId?.() ?? host.stubService.getActiveSessionId();
		const selectedIndex = Math.max(0, sessions.findIndex(s => s.id === selectedId));
		return new SelectBox(
			sessions.map(s => ({ text: s.title })),
			selectedIndex,
			host.contextViewService,
			defaultSelectBoxStyles,
			{
				ariaLabel: localize('conversationLens.sessionSwitcher', "Switch session"),
				useCustomDrawn: !hasNativeContextMenu(host.configurationService),
			});
	
}

export function refreshSessionSelectOptions(host: IConversationLensSessionBarHost): void {

		if (!host.sessionSelectBox) {
			return;
		}
		const sessions = host.stubService.getSessions();
		const selectedId = host.getSessionBarSelectId?.() ?? host.stubService.getActiveSessionId();
		const selectedIndex = Math.max(0, sessions.findIndex(s => s.id === selectedId));
		host.suppressSessionSelect = true;
		host.sessionSelectBox.setOptions(sessions.map(s => ({ text: s.title })), selectedIndex);
		host.suppressSessionSelect = false;
	
}

export function shouldRefreshActiveSessionChrome(host: IConversationLensSessionBarHost, sessionId: string): boolean {

		const boundId = host.getBoundSessionId();
		if (sessionId === boundId) {
			return true;
		}
		return !host.stubService.getSessions().some(session => session.id === sessionId);
	
}

export function updateSessionTitle(host: IConversationLensSessionBarHost): void {

		if (!host.sessionTitleButton) {
			return;
		}
		const sessionId = host.getBoundSessionId();
		const session = host.stubService.getSessions().find(s => s.id === sessionId) ?? host.stubService.getActiveSession();
		const title = session.title;
		host.sessionTitleButton.textContent = title;
		host.sessionTitleButton.setAttribute('aria-label', localize('conversationLens.sessionTitleAria', "Session title: {0}", title));
		host.sessionTitleLive.textContent = title;
	
}

/** KEEP leftover (D449 chrome / D454 handlers): list-fail leftover is not a live write surface. */
function isKeepLeftoverListFailWrite(host: IConversationLensSessionBarHost): boolean {
	return !!host.stubService
		&& host.stubService.isEngineConnected()
		&& host.stubService.isEngineSessionReady?.() === false;
}

export function updateSessionBarWriteChrome(host: IConversationLensSessionBarHost): void {
	const writesEnabled = !isConversationPairingHold(host.uaConnection) && !isKeepLeftoverListFailWrite(host);
	if (host.sessionTitleButton) {
		host.sessionTitleButton.disabled = !writesEnabled;
		host.sessionTitleButton.setAttribute('aria-disabled', String(!writesEnabled));
	}
	if (host.newSessionButton) {
		host.newSessionButton.enabled = writesEnabled;
	}
	if (host.deleteSessionButton) {
		host.deleteSessionButton.enabled = writesEnabled;
	}
}

export function beginSessionTitleEdit(host: IConversationLensSessionBarHost): void {

		if (isConversationPairingHold(host.uaConnection) || isKeepLeftoverListFailWrite(host)) {
			return;
		}
		if (host.sessionTitleEditing) {
			return;
		}
		host.sessionTitleEditing = true;
		const sessionId = host.getBoundSessionId();
		const session = host.stubService.getSessions().find(s => s.id === sessionId) ?? host.stubService.getActiveSession();
		host.sessionTitleEditSnapshot = session.title;
		host.sessionTitleInput.value = host.sessionTitleEditSnapshot;
		host.sessionTitleButton.hidden = true;
		host.sessionTitleInput.hidden = false;
		host.sessionTitleInput.focus();
		host.sessionTitleInput.select();
	
}

export function cancelSessionTitleEdit(host: IConversationLensSessionBarHost): void {

		if (!host.sessionTitleEditing) {
			return;
		}
		host.sessionTitleEditing = false;
		host.sessionTitleInput.value = host.sessionTitleEditSnapshot;
		host.sessionTitleInput.hidden = true;
		host.sessionTitleButton.hidden = false;
		updateSessionTitle(host);
	
}

export function commitSessionTitleEdit(host: IConversationLensSessionBarHost): void {

		if (!host.sessionTitleEditing) {
			return;
		}
		if (isKeepLeftoverListFailWrite(host)) {
			host.sessionTitleEditing = false;
			host.sessionTitleInput.hidden = true;
			host.sessionTitleButton.hidden = false;
			updateSessionTitle(host);
			host.showPostFailure('engine_disconnected');
			return;
		}
		const sessionId = host.getBoundSessionId();
		const trimmed = host.sessionTitleInput.value.trim();

		host.sessionTitleEditing = false;
		host.sessionTitleInput.hidden = true;
		host.sessionTitleButton.hidden = false;

		if (!trimmed) {
			updateSessionTitle(host);
			return;
		}

		const renamed = host.stubService.renameSession(sessionId, trimmed);
		if (!renamed) {
			host.showPostFailure(
				!host.stubService.isEngineConnected() && host.stubService.hasEngineConnectionHistory()
					? 'engine_disconnected'
					: 'failed'
			);
			updateSessionTitle(host);
			return;
		}
		updateSessionTitle(host);
		refreshSessionSelectOptions(host);
	
}

export function createNewSession(host: IConversationLensSessionBarHost): void {

		host.writeComposerDraft(host.getBoundSessionId(), host.dockTextarea.value);
		if (isConversationPairingHold(host.uaConnection) || isKeepLeftoverListFailWrite(host)) {
			host.showPostFailure('engine_disconnected');
			return;
		}
		if (!host.stubService.isEngineConnected() && host.stubService.hasEngineConnectionHistory()) {
			host.showPostFailure('engine_disconnected');
			return;
		}
		host.stubService.createSession();
	
}

const pendingDeleteDrafts = new WeakMap<IConversationLensSessionBarHost, Map<string, string>>();

function pendingDeleteDraftMap(host: IConversationLensSessionBarHost): Map<string, string> {
	let drafts = pendingDeleteDrafts.get(host);
	if (!drafts) {
		drafts = new Map();
		pendingDeleteDrafts.set(host, drafts);
	}
	return drafts;
}

function restorePendingDeleteDraft(host: IConversationLensSessionBarHost, sessionId: string): void {
	const drafts = pendingDeleteDrafts.get(host);
	if (!drafts) {
		return;
	}
	const text = drafts.get(sessionId);
	if (text === undefined) {
		return;
	}
	if (!host.stubService.getSessions().some(session => session.id === sessionId)) {
		return;
	}
	host.writeComposerDraft(sessionId, text);
	drafts.delete(sessionId);
	if (host.getBoundSessionId() === sessionId) {
		host.dockTextarea.value = text;
	}
}

function bindDeleteDraftRollback(host: IConversationLensSessionBarHost): void {
	host.register(host.stubService.onDidChangeActiveSession(sessionId => {
		restorePendingDeleteDraft(host, sessionId);
	}));
	host.register(host.stubService.onDidChangeSession(sessionId => {
		restorePendingDeleteDraft(host, sessionId);
	}));
	host.register(host.stubService.onDidFailEngineAction(failure => {
		if (failure.action === 'deleteSession') {
			restorePendingDeleteDraft(host, failure.sessionId);
		}
	}));
}

export function deleteActiveSession(host: IConversationLensSessionBarHost): void {

		if (isConversationPairingHold(host.uaConnection) || isKeepLeftoverListFailWrite(host)) {
			host.showPostFailure('engine_disconnected');
			return;
		}
		const sessionId = host.getSessionBarSelectId?.() ?? host.stubService.getActiveSessionId();
		const draftText = host.dockTextarea.value;
		host.writeComposerDraft(sessionId, draftText);
		pendingDeleteDraftMap(host).set(sessionId, draftText);
		const deleted = host.stubService.deleteSession(sessionId);
		if (!deleted) {
			pendingDeleteDraftMap(host).delete(sessionId);
			host.writeComposerDraft(sessionId, draftText);
			if (host.getBoundSessionId() === sessionId) {
				host.dockTextarea.value = draftText;
			}
			host.showPostFailure(
				!host.stubService.isEngineConnected() && host.stubService.hasEngineConnectionHistory()
					? 'engine_disconnected'
					: 'failed'
			);
			return;
		}
		host.deleteComposerDraftsForSession(sessionId);
	
}

export function switchToSession(host: IConversationLensSessionBarHost, sessionId: string): void {

		const previousId = host.getBoundSessionId();
		if (previousId !== sessionId) {
			host.visualizeOverlay.close();
			host.engineHistoryList?.close();
			host.engineSnapshotsList?.close();
			host.writeComposerDraft(previousId, host.dockTextarea.value);
		}
		if (host.switchLeafSession) {
			void host.switchLeafSession(sessionId).catch(onUnexpectedError).catch(onUnexpectedError);
			return;
		}
		if (previousId !== sessionId) {
			host.stubService.switchSession(sessionId);
		}
		// CS-4 openPendingOnFocus: showConversationPart → Part.focus → onDidFocus (contrib scrolls once).
		host.instantiationService.invokeFunction(showConversationPart);
	
}
