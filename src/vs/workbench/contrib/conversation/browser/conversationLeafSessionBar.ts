/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, clearNode } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { IContextMenuService, IContextViewService, IOpenContextView } from '../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { ConversationEngineHistoryList } from './conversationEngineHistoryList.js';
import { ConversationEngineSnapshotsList } from './conversationEngineSnapshotsList.js';
import {
	applySessionTitleHold,
	beginSessionTitleEdit,
	cancelSessionTitleEdit,
	commitSessionTitleEdit,
	createNewSession,
	deleteActiveSession,
	IConversationLensSessionBarHost,
	mountSessionBar,
	refreshSessionSelectOptions,
	shouldRefreshActiveSessionChrome,
	updateSessionBarWriteChrome,
	updateSessionTitle,
} from './conversationLensSessionBar.js';
import type { ConversationComposerPostFailureReason } from './conversationLensDockStrings.js';
import { createConversationLensAriaId, type ConversationLensId } from './conversationLensProjection.js';
import { IConversationRosterService } from './conversationStubService.js';
import { applyLeafWidthClasses } from './conversationNarrowLayout.js';
import { IConversationSessionWindowService } from './conversationSessionWindowService.js';
import { ConversationVisualizeOverlay } from './conversationVisualizeOverlay.js';
import type { ConversationComposerModel } from './conversationComposerModel.js';
import { IConversationTimelineRevealService } from './conversationTimelineRevealService.js';
import { shouldAutoRevealPendingConfirmation } from './conversationPendingSeat.js';
import { shouldOpenPendingOnFocus } from '../common/uaClientSettingsHelpers.js';

export interface IConversationLeafPaneAccessors {
	writeComposerDraft(sessionId: string, text: string): void;
	deleteComposerDraftsForSession(sessionId: string): void;
	readonly composerModel: Pick<ConversationComposerModel, 'policy' | 'composeDraftSnapshot' | 'tuneContextView' | 'setTuneContextView' | 'moreContextView' | 'setMoreContextView'>;
	/** The lens's own chip array, not a copy: draft restore splices it in place. */
	getComposerRefResources?(): string[] | undefined;
	syncComposerRefs?(): void;
	getDockTextarea(): HTMLTextAreaElement | undefined;
	getReadingColumn(): HTMLElement | undefined;
	getVisualizeOverlay(): ConversationVisualizeOverlay | undefined;
	showPostFailure(reason: ConversationComposerPostFailureReason): void;
	setLensId(lensId: ConversationLensId): void;
	handleLensTablistKeyDown(event: KeyboardEvent): void;
	setInputMaximized(maximized: boolean): void;
	closeInboxListPanel?(): void;
}

export class ConversationLeafSessionBar extends Disposable implements IConversationLensSessionBarHost {
	readonly lensAriaId = createConversationLensAriaId();

	get isDisposed(): boolean {
		return this._store.isDisposed;
	}

	register<T extends IDisposable>(disposable: T): T {
		return this._register(disposable);
	}

	override dispose(): void {
		if (this.sessionMoreContextView) {
			this.sessionMoreContextView.close();
			this.sessionMoreContextView = undefined;
		}
		this.engineHistoryList?.dispose();
		this.engineHistoryList = undefined;
		this.engineSnapshotsList?.dispose();
		this.engineSnapshotsList = undefined;
		const bar = this.barHost.querySelector<HTMLElement>('.conversation-lens-session-bar');
		if (bar) {
			clearNode(bar);
			bar.remove();
		}
		super.dispose();
	}

	sessionTitleButton!: HTMLButtonElement;
	sessionTitleLive!: HTMLElement;
	sessionTitleInput!: HTMLInputElement;
	sessionTitleEditing = false;
	sessionTitleEditSnapshot = '';
	sessionSelectBox!: SelectBox;
	sessionSelectContainer!: HTMLElement;
	newSessionButton!: Button;
	deleteSessionButton!: Button;
	sessionMoreButton!: Button;
	sessionMoreContextView: IOpenContextView | undefined;
	lensTablist!: HTMLElement;
	lensTabConversation!: HTMLButtonElement;
	lensTabTrajectory!: HTMLButtonElement;
	sessionSyncBadge!: HTMLElement;
	suppressSessionSelect = false;
	readingColumn: HTMLElement;
	engineHistoryList: ConversationEngineHistoryList | undefined;
	engineSnapshotsList: ConversationEngineSnapshotsList | undefined;
	dockTextarea: HTMLTextAreaElement;
	visualizeOverlay: ConversationVisualizeOverlay;
	private readonly hideButton: HTMLButtonElement;

	constructor(
		private readonly sessionKey: string,
		private readonly barHost: HTMLElement,
		private readonly accessors: IConversationLeafPaneAccessors,
		@IConversationRosterService public readonly stubService: IConversationRosterService,
		@IUniverseAgentConnection public readonly uaConnection: IUniverseAgentConnection,
		@IContextViewService public readonly contextViewService: IContextViewService,
		@IContextMenuService public readonly contextMenuService: IContextMenuService,
		@IConfigurationService public readonly configurationService: IConfigurationService,
		@IInstantiationService public readonly instantiationService: IInstantiationService,
		@IConversationSessionWindowService private readonly sessionWindowService: IConversationSessionWindowService,
		@IDialogService public readonly dialogService: IDialogService,
		@IConversationTimelineRevealService private readonly timelineRevealService: IConversationTimelineRevealService,
	) {
		super();
		this.readingColumn = accessors.getReadingColumn() ?? $('div');
		this.dockTextarea = accessors.getDockTextarea() ?? $('textarea') as HTMLTextAreaElement;
		this.visualizeOverlay = accessors.getVisualizeOverlay() ?? this.instantiationService.createInstance(ConversationVisualizeOverlay);
		if (!accessors.getVisualizeOverlay()) {
			this._register(this.visualizeOverlay);
		}

		this.lensTablist = $('div');
		this.lensTabConversation = $('button') as HTMLButtonElement;
		this.lensTabTrajectory = $('button') as HTMLButtonElement;

		mountSessionBar(this, barHost, { omitLensTablist: true });

		this.hideButton = append(barHost.querySelector('.conversation-lens-session-bar') ?? barHost, $('button.conversation-session-leaf-hide')) as HTMLButtonElement;
		this.hideButton.type = 'button';
		this.hideButton.title = localize('hideConversationSessionWindow', "Hide session window");
		this.hideButton.setAttribute('aria-label', localize('hideConversationSessionWindow', "Hide session window"));
		this.hideButton.classList.add(...ThemeIcon.asClassNameArray(Codicon.remove));
		this._register(addDisposableListener(this.hideButton, 'click', () => {
			if (this._store.isDisposed) {
				return;
			}
			this.sessionWindowService.hideSessionWindow(this.sessionKey);
		}));
		this._register(this.sessionWindowService.onDidChangeVisibleWindows(() => this.updateHideButton()));
		this._register(this.stubService.onDidChangeSession(sessionId => {
			if (this._store.isDisposed) {
				return;
			}
			this.refreshSessionSelectOptions();
			updateSessionBarWriteChrome(this);
			if (shouldRefreshActiveSessionChrome(this, sessionId)) {
				if (!this.sessionTitleEditing) {
					this.updateSessionTitle();
				}
			}
		}));
		this._register(this.stubService.onDidChangeActiveSession(() => {
			if (this._store.isDisposed) {
				return;
			}
			updateSessionBarWriteChrome(this);
		}));
		this._register(this.stubService.onDidChangeEngineConnection(() => {
			if (this._store.isDisposed) {
				return;
			}
			updateSessionBarWriteChrome(this);
		}));
		this._register(this.uaConnection.onDidChangeConnection(() => {
			if (this._store.isDisposed) {
				return;
			}
			updateSessionBarWriteChrome(this);
		}));
		this.updateHideButton();
		this.updateSessionTitle();
		this.refreshSessionSelectOptions();
		updateSessionBarWriteChrome(this);

		const initialWidth = barHost.clientWidth > 0
			? barHost.clientWidth
			: barHost.parentElement?.clientWidth ?? 0;
		if (initialWidth > 0) {
			this.layout(initialWidth);
		}
	}

	layout(width: number): void {
		if (width <= 0) {
			return;
		}
		applyLeafWidthClasses(this.barHost, width);
		if (this.barHost.parentElement) {
			applyLeafWidthClasses(this.barHost.parentElement, width);
		}
		const bar = this.barHost.querySelector<HTMLElement>('.conversation-lens-session-bar');
		if (bar) {
			applyLeafWidthClasses(bar, width);
		}
	}

	applyWidth(width: number): void {
		applyLeafWidthClasses(this.barHost, width);
	}

	getBoundSessionId(): string {
		return this.sessionKey;
	}

	listSessionId(): string {
		return this.sessionKey;
	}

	getSessionBarSelectId(): string {
		return this.sessionKey;
	}

	async switchLeafSession(sessionId: string): Promise<void> {
		if (this._store.isDisposed) {
			return;
		}
		if (this.sessionTitleEditing) {
			this.cancelSessionTitleEdit();
		}
		const replaceOutgoingLeaf = this.sessionWindowService.getVisibleWindowCount() >= 2
			&& !this.sessionWindowService.isSessionWindowVisible(sessionId);
		const result = replaceOutgoingLeaf
			? await this.sessionWindowService.revealSessionWindow(sessionId, { replace: this.sessionKey })
			: await this.sessionWindowService.revealSessionWindow(sessionId);
		if (this._store.isDisposed || result.cancelled) {
			return;
		}
		if (this.stubService.getActiveSessionId() !== sessionId) {
			this.stubService.switchSession(sessionId);
		}
		if (
			this.timelineRevealService
			&& shouldOpenPendingOnFocus(this.configurationService)
			&& shouldAutoRevealPendingConfirmation(this.uaConnection)
			&& this.stubService.hasPendingAttentionSeat(sessionId)
		) {
			this.timelineRevealService.scrollToFirstPendingConfirmation(sessionId);
		}
	}

	get inboxOverlay(): { closeListPanel(): void } | undefined {
		if (!this.accessors.closeInboxListPanel) {
			return undefined;
		}
		return {
			closeListPanel: () => this.accessors.closeInboxListPanel?.(),
		};
	}

	setLensId(lensId: ConversationLensId): void {
		if (this._store.isDisposed) {
			return;
		}
		this.accessors.setLensId(lensId);
	}

	handleLensTablistKeyDown(event: KeyboardEvent): void {
		if (this._store.isDisposed) {
			return;
		}
		this.accessors.handleLensTablistKeyDown(event);
	}

	beginSessionTitleEdit(): void {
		if (this._store.isDisposed) {
			return;
		}
		beginSessionTitleEdit(this);
	}

	commitSessionTitleEdit(): void {
		if (this._store.isDisposed) {
			return;
		}
		commitSessionTitleEdit(this);
	}

	cancelSessionTitleEdit(): void {
		if (this._store.isDisposed) {
			return;
		}
		cancelSessionTitleEdit(this);
	}

	createNewSession(): void {
		if (this._store.isDisposed) {
			return;
		}
		createNewSession(this);
	}

	deleteActiveSession(): Promise<void> {
		if (this._store.isDisposed) {
			return Promise.resolve();
		}
		return deleteActiveSession(this);
	}

	switchToSession(sessionId: string): void {
		if (this._store.isDisposed) {
			return;
		}
		void this.switchLeafSession(sessionId).catch(onUnexpectedError);
	}

	get composerModel(): Pick<ConversationComposerModel, 'policy' | 'composeDraftSnapshot' | 'tuneContextView' | 'setTuneContextView' | 'moreContextView' | 'setMoreContextView'> {
		return this.accessors.composerModel;
	}

	get composerRefResources(): string[] | undefined {
		return this.accessors.getComposerRefResources?.();
	}

	syncComposerRefs(): void {
		this.accessors.syncComposerRefs?.();
	}

	writeComposerDraft(sessionId: string, text: string): void {
		this.accessors.writeComposerDraft(sessionId, text);
	}

	deleteComposerDraftsForSession(sessionId: string): void {
		this.accessors.deleteComposerDraftsForSession(sessionId);
	}

	refreshSessionSelectOptions(): void {
		if (this._store.isDisposed) {
			return;
		}
		refreshSessionSelectOptions(this);
	}

	updateSessionTitle(): void {
		if (this._store.isDisposed || !this.sessionTitleButton) {
			return;
		}
		const sessionId = this.getBoundSessionId();
		const session = this.stubService.getSessions().find(s => s.id === sessionId);
		if (!session) {
			this.sessionTitleButton.textContent = '';
			this.sessionTitleButton.setAttribute('aria-label', localize('conversationLens.sessionTitleAria', "Session title: {0}", ''));
			this.sessionTitleLive.textContent = '';
			applySessionTitleHold(this);
			return;
		}
		updateSessionTitle(this);
	}

	showPostFailure(reason: ConversationComposerPostFailureReason): void {
		this.accessors.showPostFailure(reason);
	}

	setInputMaximized(maximized: boolean): void {
		this.accessors.setInputMaximized(maximized);
	}

	private updateHideButton(): void {
		if (this._store.isDisposed) {
			return;
		}
		const isPrimary = this.sessionWindowService.getPrimarySessionKey() === this.sessionKey;
		const onlyVisible = this.sessionWindowService.getVisibleWindowCount() <= 1;
		const hidden = this.sessionWindowService.isSessionWindowHidden(this.sessionKey);
		this.hideButton.hidden = onlyVisible || isPrimary || hidden;
	}
}
