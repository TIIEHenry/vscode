/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { Disposable, IDisposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { ConversationEngineHistoryList } from './conversationEngineHistoryList.js';
import { ConversationEngineSnapshotsList } from './conversationEngineSnapshotsList.js';
import {
	beginSessionTitleEdit,
	cancelSessionTitleEdit,
	commitSessionTitleEdit,
	createNewSession,
	deleteActiveSession,
	IConversationLensSessionBarHost,
	mountSessionBar,
	refreshSessionSelectOptions,
	updateSessionTitle,
} from './conversationLensSessionBar.js';
import type { ConversationComposerPostFailureReason } from './conversationLensDockStrings.js';
import type { ConversationLensId } from './conversationLensProjection.js';
import { IConversationRosterService } from './conversationStubService.js';
import { IConversationSessionWindowService } from './conversationSessionWindowService.js';
import { ConversationVisualizeOverlay } from './conversationVisualizeOverlay.js';

export interface IConversationLeafPaneAccessors {
	writeComposerDraft(sessionId: string, text: string): void;
	deleteComposerDraftsForSession(sessionId: string): void;
	getDockTextarea(): HTMLTextAreaElement | undefined;
	getReadingColumn(): HTMLElement | undefined;
	getVisualizeOverlay(): ConversationVisualizeOverlay | undefined;
	showPostFailure(reason: ConversationComposerPostFailureReason): void;
	setLensId(lensId: ConversationLensId): void;
	handleLensTablistKeyDown(event: KeyboardEvent): void;
}

export class ConversationLeafSessionBar extends Disposable implements IConversationLensSessionBarHost {

	register<T extends IDisposable>(disposable: T): T {
		return this._register(disposable);
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
		barHost: HTMLElement,
		private readonly accessors: IConversationLeafPaneAccessors,
		@IConversationRosterService public readonly stubService: IConversationRosterService,
		@IUniverseAgentConnection public readonly uaConnection: IUniverseAgentConnection,
		@IContextViewService public readonly contextViewService: IContextViewService,
		@IConfigurationService public readonly configurationService: IConfigurationService,
		@IInstantiationService public readonly instantiationService: IInstantiationService,
		@IConversationSessionWindowService private readonly sessionWindowService: IConversationSessionWindowService,
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
		this._register(addDisposableListener(this.hideButton, 'click', () => this.sessionWindowService.hideSessionWindow(this.sessionKey)));
		this._register(this.sessionWindowService.onDidChangeVisibleWindows(() => this.updateHideButton()));
		this.updateHideButton();
		this.updateSessionTitle();
		this.refreshSessionSelectOptions();
	}

	getBoundSessionId(): string {
		return this.sessionKey;
	}

	getSessionBarSelectId(): string {
		return this.sessionKey;
	}

	async switchLeafSession(sessionId: string): Promise<void> {
		if (this.sessionWindowService.getVisibleWindowCount() >= 2) {
			await this.sessionWindowService.revealSessionWindow(sessionId, { replace: this.sessionKey });
		} else {
			await this.sessionWindowService.revealSessionWindow(sessionId);
		}
		if (this.stubService.getActiveSessionId() !== sessionId) {
			this.stubService.switchSession(sessionId);
		}
	}

	setLensId(lensId: ConversationLensId): void {
		this.accessors.setLensId(lensId);
	}

	handleLensTablistKeyDown(event: KeyboardEvent): void {
		this.accessors.handleLensTablistKeyDown(event);
	}

	beginSessionTitleEdit(): void {
		beginSessionTitleEdit(this);
	}

	commitSessionTitleEdit(): void {
		commitSessionTitleEdit(this);
	}

	cancelSessionTitleEdit(): void {
		cancelSessionTitleEdit(this);
	}

	createNewSession(): void {
		createNewSession(this);
	}

	deleteActiveSession(): void {
		deleteActiveSession(this);
	}

	switchToSession(sessionId: string): void {
		void this.switchLeafSession(sessionId);
	}

	writeComposerDraft(sessionId: string, text: string): void {
		this.accessors.writeComposerDraft(sessionId, text);
	}

	deleteComposerDraftsForSession(sessionId: string): void {
		this.accessors.deleteComposerDraftsForSession(sessionId);
	}

	refreshSessionSelectOptions(): void {
		refreshSessionSelectOptions(this);
	}

	updateSessionTitle(): void {
		updateSessionTitle(this);
	}

	showPostFailure(reason: ConversationComposerPostFailureReason): void {
		this.accessors.showPostFailure(reason);
	}

	private updateHideButton(): void {
		const isPrimary = this.sessionWindowService.getPrimarySessionKey() === this.sessionKey;
		const onlyVisible = this.sessionWindowService.getVisibleWindowCount() <= 1;
		const hidden = this.sessionWindowService.isSessionWindowHidden(this.sessionKey);
		this.hideButton.hidden = onlyVisible || isPrimary || hidden;
	}
}
