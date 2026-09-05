/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { IDisposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { defaultButtonStyles, defaultSelectBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { hasNativeContextMenu } from '../../../../platform/window/common/window.js';
import { ConversationEngineHistoryList } from './conversationEngineHistoryList.js';
import { ConversationEngineSnapshotsList } from './conversationEngineSnapshotsList.js';
import { conversationLensSessionBarConversationTab, conversationLensSessionBarDeleteSession, conversationLensSessionBarNewSession, conversationLensSessionBarRenameInputAria, conversationLensSessionBarRenameTitle, conversationLensSessionBarRouteLabel, conversationLensSessionBarTrajectoryTab } from './conversationLensSessionBarStrings.js';
import type { ConversationLensId } from './conversationLensProjection.js';
import { IConversationRosterService } from './conversationStubService.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { ConversationVisualizeOverlay } from './conversationVisualizeOverlay.js';

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
	sessionBarRouteContainer: HTMLElement;
	sessionBarRouteSelectBox: SelectBox;
	lensTablist: HTMLElement;
	lensTabConversation: HTMLButtonElement;
	lensTabTrajectory: HTMLButtonElement;
	suppressSessionSelect: boolean;
	readingColumn: HTMLElement;
	engineHistoryList: ConversationEngineHistoryList | undefined;
	engineSnapshotsList: ConversationEngineSnapshotsList | undefined;
	routeSelectBox: SelectBox;
	dockTextarea: HTMLTextAreaElement;
	readonly stubService: IConversationRosterService;
	readonly contextViewService: IContextViewService;
	readonly configurationService: IConfigurationService;
	readonly instantiationService: IInstantiationService;
	readonly visualizeOverlay: ConversationVisualizeOverlay;
	register<T extends IDisposable>(disposable: T): T;
	createRouteSelectBox(selectedIndex: number, ariaLabel: string): SelectBox;
	getSessionConfig(sessionId: string): { agentIndex: number; routeIndex: number };
	setSessionConfig(sessionId: string, patch: Partial<{ agentIndex: number; routeIndex: number }>): void;
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
}

export function mountSessionBar(host: IConversationLensSessionBarHost, host: HTMLElement): void {

		const bar = append(host, $('.conversation-lens-session-bar'));
		bar.setAttribute('role', 'banner');

		const leading = append(bar, $('.conversation-lens-session-bar-leading'));
		const icon = append(leading, $('span.conversation-lens-session-icon'));
		icon.setAttribute('aria-hidden', 'true');
		icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.commentDiscussion));

		host.lensTablist = append(leading, $('.conversation-lens-lens-tabs'));
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

		host.sessionBarRouteContainer = append(controls, $('.conversation-lens-session-route'));
		const activeSessionId = host.stubService.getActiveSessionId();
		const activeRouteIndex = host.getSessionConfig(activeSessionId).routeIndex;
		host.sessionBarRouteSelectBox = host.register(host.createRouteSelectBox(activeRouteIndex, conversationLensSessionBarRouteLabel));
		host.sessionBarRouteSelectBox.render(host.sessionBarRouteContainer);
		host.register(host.sessionBarRouteSelectBox.onDidSelect(e => {
			const sessionId = host.stubService.getActiveSessionId();
			host.setSessionConfig(sessionId, { routeIndex: e.index });
			host.routeSelectBox.select(e.index);
		}));

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

		host.engineHistoryList = host.register(host.instantiationService.createInstance(
			ConversationEngineHistoryList,
			controls,
			host.readingColumn));
		host.engineSnapshotsList = host.register(host.instantiationService.createInstance(
			ConversationEngineSnapshotsList,
			controls,
			host.readingColumn));

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

export function createSessionSelectBox(host: IConversationLensSessionBarHost): SelectBox {

		const sessions = host.stubService.getSessions();
		const selectedIndex = Math.max(0, sessions.findIndex(s => s.id === host.stubService.getActiveSessionId()));
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

		const sessions = host.stubService.getSessions();
		const selectedIndex = Math.max(0, sessions.findIndex(s => s.id === host.stubService.getActiveSessionId()));
		host.suppressSessionSelect = true;
		host.sessionSelectBox.setOptions(sessions.map(s => ({ text: s.title })), selectedIndex);
		host.suppressSessionSelect = false;
	
}

export function shouldRefreshActiveSessionChrome(host: IConversationLensSessionBarHost, sessionId: string): boolean {

		const activeId = host.stubService.getActiveSessionId();
		if (sessionId === activeId) {
			return true;
		}
		return !host.stubService.getSessions().some(session => session.id === sessionId);
	
}

export function updateSessionTitle(host: IConversationLensSessionBarHost): void {

		const title = host.stubService.getActiveSession().title;
		host.sessionTitleButton.textContent = title;
		host.sessionTitleButton.setAttribute('aria-label', localize('conversationLens.sessionTitleAria', "Session title: {0}", title));
		host.sessionTitleLive.textContent = title;
	
}

export function beginSessionTitleEdit(host: IConversationLensSessionBarHost): void {

		if (host.sessionTitleEditing) {
			return;
		}
		host.sessionTitleEditing = true;
		host.sessionTitleEditSnapshot = host.stubService.getActiveSession().title;
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
		const sessionId = host.stubService.getActiveSessionId();
		const trimmed = host.sessionTitleInput.value.trim();

		host.sessionTitleEditing = false;
		host.sessionTitleInput.hidden = true;
		host.sessionTitleButton.hidden = false;

		if (!trimmed) {
			updateSessionTitle(host);
			return;
		}

		host.stubService.renameSession(sessionId, trimmed);
		updateSessionTitle(host);
		refreshSessionSelectOptions(host);
	
}

export function createNewSession(host: IConversationLensSessionBarHost): void {

		host.writeComposerDraft(host.stubService.getActiveSessionId(), host.dockTextarea.value);
		host.stubService.createSession();
	
}

export function deleteActiveSession(host: IConversationLensSessionBarHost): void {

		const sessionId = host.stubService.getActiveSessionId();
		host.deleteComposerDraftsForSession(sessionId);
		host.stubService.deleteSession(sessionId);
	
}

export function switchToSession(host: IConversationLensSessionBarHost, sessionId: string): void {

		const previousId = host.stubService.getActiveSessionId();
		if (previousId !== sessionId) {
			host.visualizeOverlay.close();
			host.engineHistoryList?.close();
			host.engineSnapshotsList?.close();
			host.writeComposerDraft(previousId, host.dockTextarea.value);
			host.stubService.switchSession(sessionId);
		}
		// CS-4 openPendingOnFocus: showConversationPart → Part.focus → onDidFocus (contrib scrolls once).
		host.instantiationService.invokeFunction(showConversationPart);
	
}
