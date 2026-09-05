/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { reset } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { IContextViewService, IOpenContextView } from '../../../../platform/contextview/browser/contextView.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IConversationLensSlots } from '../../../browser/parts/conversation/conversationPart.js';
import { ConversationIdentityStrip } from './conversationIdentityStrip.js';
import { ConversationEngineHistoryList } from './conversationEngineHistoryList.js';
import { ConversationEngineSnapshotsList } from './conversationEngineSnapshotsList.js';
import { ConversationInboxOverlay } from './conversationInboxOverlay.js';
import { ConversationTimelineTree } from './conversationTimelineTree.js';
import { ConversationTrajectory } from './conversationTrajectory.js';
import type { ConversationTimelineEntry } from './conversationSessionView.js';
import { IConversationReviewNavService } from '../common/conversationReviewEntry.js';
import type { ConversationQuestionRespondAnswers, ConversationViewFrameApplied, ConversationWriteMessage, IConversationSessionViewLease, PostOutcome } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { SyncChrome } from '../../../../platform/universeAgent/common/sessionView/index.js';
import { conversationLensInputMaximizedClass } from './conversationLensDockStrings.js';
import { getConversationTurnAccessibleText } from './conversationAccessibility.js';
import { createInputHistoryBrowseState, InputHistoryBrowseState, InputHistoryDirection } from './conversationInputHistory.js';
import { scrollToFirstPendingConfirmation as applyPendingConfirmationScroll } from './conversationPendingSeat.js';
import { IConversationRosterService } from './conversationStubService.js';
import { ConversationMermaidExtensionInfo, resolveConversationMermaidExtension } from './conversationMermaidHost.js';
import { ConversationVisualizeOverlay } from './conversationVisualizeOverlay.js';
import { IConversationTimelineRevealService } from './conversationTimelineRevealService.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IWebviewService } from '../../webview/browser/webview.js';
import { ConversationVoiceTranscriptBar } from './conversationVoiceTranscriptBar.js';
import { ConversationVoiceClip } from './conversationVoiceTranscriptModel.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { UA_CLIENT_CLIENT_TOOLS_SHOW_TOOL_INVOCATION_DETAILS } from '../common/uaClientSettingsKeys.js';
import { UA_CLIENT_DISPLAY_CONVERSATION_DENSITY } from '../common/uaClientSettingsHelpers.js';
import {
	applyConversationDensity,
	applyConversationWidth,
	bindReadingColumnLayout,
	layoutReadingSurfaces,
	mountTimeline,
} from './conversationLensReadingColumn.js';
import {
	applyActiveSession,
	bindSessionView,
	cancelToolCall,
	copyTurn,
	deleteTurn,
	findFirstPendingConfirmationTurnId,
	focusTimelineRecord,
	openVisualizeOverlay,
	renderInboxStatus,
	resolveConfirmation,
	resolveQuestion,
} from './conversationLensSessionBinding.js';
import {
	applySessionViewTimeline,
	handleLensTablistKeyDown,
	isPreFirst,
	loadLensId,
	navigateToTrajectoryFromTurn,
	navigateToTurnFromTrajectory,
	refreshTrajectoryRecords,
	setLensId,
	trajectoryProjectionOptions,
	updateConversationPhase,
	updateLensTabs,
	updateReadingColumn,
	updateSyncChrome,
} from './conversationLensProjection.js';
import {
	beginSessionTitleEdit,
	cancelSessionTitleEdit,
	commitSessionTitleEdit,
	createNewSession,
	createSessionSelectBox,
	deleteActiveSession,
	mountSessionBar,
	refreshSessionSelectOptions,
	shouldRefreshActiveSessionChrome,
	switchToSession,
	updateSessionTitle,
} from './conversationLensSessionBar.js';
import { mountDock } from './conversationLensDock.js';
import {
	composerChatId,
	deleteComposerDraftsForSession,
	draftMapKey,
	finishVoiceClip,
	getVoiceClips,
	loadConnectedComposerCatalogs,
	postBound,
	pruneOrphanComposerDrafts,
	readComposerDraft,
	refreshComposerCatalogs,
	renderVoiceTranscriptBar,
	restoreComposerDraftToInput,
	saveQueueEdit,
	saveTurnEdit,
	setVoiceClips,
	submitDraft,
	toggleVoiceRecording,
	updateVoiceMicChrome,
	writeComposerDraft,
} from './conversationLensComposer.js';
import {
	beginQueueEdit,
	beginTurnEdit,
	createComposerSelectBox,
	createRouteSelectBox,
	ensureComposerInCluster,
	exitComposerEdit,
	exitInputHistoryBrowse,
	getEditingQueueItem,
	getSessionConfig,
	getSessionInputHistory,
	navigateInputHistory,
	resetInputHistoryBrowse,
	setSessionConfig,
	showPostFailure,
	syncComposerPlacement,
	syncSessionConfigSelects,
	toggleAddContextView,
	toggleInputMaximized,
	toggleMoreContextView,
	toggleTemplatesContextView,
	toggleTuneContextView,
	updateComposerEditChrome,
	updateGateRow,
	updateMaximizeInputButton,
	updateSendEnabled,
	updateSessionConfigVisibility,
} from './conversationLensComposerChrome.js';

import type { ComposerPolicy, ConversationSessionConfigSelection } from './conversationLensComposerChrome.js';
import type { ConversationLensId } from './conversationLensProjection.js';
import { CONVERSATION_LENS_ID_STORAGE_KEY } from './conversationLensProjection.js';
/**
 * Product Conversation lens: SessionBar + stub timeline + local dock, mounted
 * into {@link IConversationLensSlots}. Not ChatEditor / ChatViewPane.
 */
export class ConversationLens extends Disposable {

	private register<T extends import('../../../../base/common/lifecycle.js').IDisposable>(disposable: T): T {
		return this._register(disposable);
	}

	private sessionTitleButton!: HTMLButtonElement;
	private sessionTitleLive!: HTMLElement;
	private sessionTitleInput!: HTMLInputElement;
	private sessionTitleEditing = false;
	private sessionTitleEditSnapshot = '';
	private sessionSelectBox!: SelectBox;
	private sessionSelectContainer!: HTMLElement;
	private newSessionButton!: Button;
	private deleteSessionButton!: Button;
	private sessionBarRouteContainer!: HTMLElement;
	private sessionBarRouteSelectBox!: SelectBox;
	private lensTablist!: HTMLElement;
	private lensTabConversation!: HTMLButtonElement;
	private lensTabTrajectory!: HTMLButtonElement;
	private lensId: ConversationLensId = 'conversation';
	private filterAgentId: string | undefined;
	private timelineTree!: ConversationTimelineTree;
	private trajectoryView!: ConversationTrajectory;
	private inboxOverlay!: ConversationInboxOverlay;
	private engineHistoryList: ConversationEngineHistoryList | undefined;
	private engineSnapshotsList: ConversationEngineSnapshotsList | undefined;
	private dockTextarea!: HTMLTextAreaElement;
	private sendButton!: Button;
	private addButton!: Button;
	private addContextView: IOpenContextView | undefined;
	private tuneButton!: Button;
	private tuneContextView: IOpenContextView | undefined;
	private permissionSelectBox!: SelectBox;
	private agentContainer!: HTMLElement;
	private agentSelectBox!: SelectBox;
	private routeContainer!: HTMLElement;
	private routeSelectBox!: SelectBox;
	private moreButton!: Button;
	private moreContextView: IOpenContextView | undefined;
	private modelSelectBox!: SelectBox;
	private modelSelectedIndex = 0;
	private templatesButton!: Button;
	private templatesContextView: IOpenContextView | undefined;
	private maximizeInputButton!: Button;
	private micButton!: Button;
	private composerCluster!: HTMLElement;
	private voiceTranscriptBar!: ConversationVoiceTranscriptBar;

	private readingColumn!: HTMLElement;
	private prefirstHero!: HTMLElement;
	private dockRoot!: HTMLElement;
	private gateRow!: HTMLElement;
	private gateLabel!: HTMLElement;
	private sessionSyncBadge!: HTMLElement;
	private sendFailureTimeout: ReturnType<typeof setTimeout> | undefined;
	private composer!: HTMLElement;
	private composerEditHeader!: HTMLElement;
	private composerEditTitle!: HTMLElement;
	private composerExitButton!: Button;
	private identityStrip!: ConversationIdentityStrip;

	private readonly slotHosts: IConversationLensSlots;
	private inputMaximized = false;
	private conversationPhase: 'prefirst' | 'active' | undefined;
	private composerPolicy: ComposerPolicy = 'compose';
	private editingTurnId: string | undefined;
	private editingQueueItemId: string | undefined;
	private composeDraftSnapshot = '';

	private readonly drafts = new Map<string, string>();
	private readonly sessionConfigBySessionId = new Map<string, ConversationSessionConfigSelection>();
	private readonly voiceClipsBySessionId = new Map<string, ConversationVoiceClip[]>();
	private readonly voicePhraseIndexBySessionId = new Map<string, number>();
	private readonly voiceTranscriptTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
	private nextVoiceClipId = 0;
	private inputHistoryBrowse: InputHistoryBrowseState = createInputHistoryBrowseState();
	private suppressSessionSelect = false;
	private mermaidExtensionInfo: ConversationMermaidExtensionInfo | undefined;
	private readonly visualizeOverlay: ConversationVisualizeOverlay;
	private sessionViewLease: IConversationSessionViewLease | undefined;
	private readonly sessionViewLifetime = this._register(new DisposableStore());
	private submitInFlight = false;
	private lastAttachedEntries: ConversationTimelineEntry[] = [];
	private lastRevealItemId: string | undefined;
	private lastReadingWidth = 0;
	private postFailureVisible = false;
	private composerCatalogGeneration = 0;
	private catalogToolNames: readonly string[] = [];

	constructor(
		slots: IConversationLensSlots,
		@IConversationRosterService private readonly stubService: IConversationRosterService,
		@IClipboardService private readonly clipboardService: IClipboardService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IInstantiationService private readonly instantiationService: IInstantiationService,
		@IStorageService private readonly storageService: IStorageService,
		@IExtensionService private readonly extensionService: IExtensionService,
		@IWebviewService private readonly webviewService: IWebviewService,
		@IConversationTimelineRevealService revealService: IConversationTimelineRevealService,
		@IConversationReviewNavService private readonly reviewNavService: IConversationReviewNavService,
		@ICommandService private readonly commandService: ICommandService,
		@IUniverseAgentConnection private readonly uaConnection: IUniverseAgentConnection,
	) {
		super();

		if (!slots.filterAgentId) {
			this._register(revealService.registerLens(this));
		}
		this._register(this.reviewNavService.onDidChange(() => {
			this.applySessionViewTimeline({ kind: 'patches', changedIds: new Set() }, { sidecarOnly: true });
		}));

		this.slotHosts = slots;
		this.filterAgentId = slots.filterAgentId;
		this.visualizeOverlay = this._register(this.instantiationService.createInstance(ConversationVisualizeOverlay));

		void resolveConversationMermaidExtension(this.extensionService).then(info => {
			this.mermaidExtensionInfo = info;
			this.timelineTree.setMermaidExtensionInfo(info);
			this.applySessionViewTimeline({ kind: 'baseline' });
		});

		this.mountTimeline(slots.timeline);
		this.mountDock(slots.dock);
		if (slots.sessionBar) {
			this.mountSessionBar(slots.sessionBar);
			this.updateSessionConfigVisibility(this.isPreFirst());
		}
		this.applyConversationDensity();
		this.restoreComposerDraftToInput();
		this.pruneOrphanComposerDrafts();
		this._register(this.configurationService.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(UA_CLIENT_DISPLAY_CONVERSATION_DENSITY)) {
				this.applyConversationDensity();
			}
			if (event.affectsConfiguration(UA_CLIENT_CLIENT_TOOLS_SHOW_TOOL_INVOCATION_DETAILS)) {
				this.timelineTree.refreshPresentation();
			}
		}));
		this.bindReadingColumnLayout();

		this.lensId = this.loadLensId();
		this.updateLensTabs();
		this.bindSessionView(this.stubService.getActiveSessionId());
		this.updateReadingColumn();
		this.updateSessionTitle();
		this.renderInboxStatus();

		this._register(this.stubService.onDidChangeActiveSession(sessionId => this.applyActiveSession(sessionId)));
		this._register(this.stubService.onDidChangeSession(sessionId => {
			this.pruneOrphanComposerDrafts();
			this.refreshSessionSelectOptions();
			if (this.shouldRefreshActiveSessionChrome(sessionId)) {
				if (!this.sessionTitleEditing) {
					this.updateSessionTitle();
				}
				this.renderInboxStatus();
				this.updateConversationPhase();
				if (this.lensId === 'trajectory' && sessionId === this.stubService.getActiveSessionId()) {
					this.refreshTrajectoryRecords(sessionId);
				}
			}
		}));
		this._register(this.stubService.onDidChangeEngineConnection(() => {
			this.updateVoiceMicChrome();
			this.refreshComposerCatalogs();
		}));
		this._register(this.uaConnection.onDidChangeConnection(() => this.refreshComposerCatalogs()));
		this.refreshComposerCatalogs();

		this._register(toDisposable(() => {
			this.addContextView?.close();
			this.tuneContextView?.close();
			this.moreContextView?.close();
			this.templatesContextView?.close();
			for (const timeout of this.voiceTranscriptTimeouts.values()) {
				clearTimeout(timeout);
			}
			this.voiceTranscriptTimeouts.clear();
			if (slots.sessionBar) {
				reset(slots.sessionBar);
			}
			reset(slots.timeline);
			reset(slots.dock);
		}));
	}

	isInputMaximized(): boolean {
		return this.inputMaximized;
	}

	setFilterAgentId(agentId: string | undefined): void {
		if (this.filterAgentId === agentId) {
			return;
		}
		if (this.dockTextarea && this.composerPolicy === 'compose') {
			this.writeComposerDraft(this.stubService.getActiveSessionId(), this.dockTextarea.value);
		}
		this.filterAgentId = agentId;
		this.restoreComposerDraftToInput();
		if (this.lensId === 'trajectory') {
			this.refreshTrajectoryRecords(this.stubService.getActiveSessionId());
		}
	}

	private trajectoryProjectionOptions(): { readonly filterAgentId?: string } | undefined {
		return trajectoryProjectionOptions(this);
	}

	focusDockInput(): void {
		this.dockTextarea?.focus();
	}

	/** Closes the trajectory inspector if it is open. Does not close the session. */
	tryDismissLocalInspector(): boolean {
		return this.trajectoryView?.tryDismissInspector() ?? false;
	}

	/** Cancels an in-progress session title edit. Does not close the session. */
	tryCancelSessionTitleEdit(): boolean {
		if (!this.sessionTitleEditing) {
			return false;
		}
		this.cancelSessionTitleEdit();
		this.sessionTitleButton?.focus();
		return true;
	}

	/** Closes the visualize overlay if it is open. Does not close the dialog or session. */
	tryCloseVisualizeOverlay(): boolean {
		if (!this.visualizeOverlay.isOpen()) {
			return false;
		}
		this.visualizeOverlay.close();
		return true;
	}

	getAccessibleTurnContent(): string | undefined {
		const turn = this.timelineTree.getFocusedTurn();
		return turn ? getConversationTurnAccessibleText(turn) : undefined;
	}

	focusAccessibleTurn(): void {
		const turn = this.timelineTree.getFocusedTurn();
		if (turn) {
			this.focusTimelineRecord(turn.id);
		} else {
			this.focusDockInput();
		}
	}

	revealTimelineItem(itemId: string): void {
		this.lastRevealItemId = itemId;
		if (this.lensId !== 'conversation') {
			this.lensId = 'conversation';
			this.storageService.store(CONVERSATION_LENS_ID_STORAGE_KEY, 'conversation', StorageScope.WORKSPACE, StorageTarget.MACHINE);
			this.updateLensTabs();
			this.trajectoryView.hide();
			this.timelineTree.show();
		}
		if (this.inputMaximized) {
			this.setInputMaximized(false);
		}
		this.timelineTree.revealTurn(itemId);
	}

	layout(height: number, width: number): void {
		const restored = this.lastReadingWidth < 1 && width > 0;
		this.lastReadingWidth = width;
		this.applyConversationWidth(width);
		layoutReadingSurfaces(this, height, width);
		if (restored && this.lastRevealItemId && this.lensId === 'conversation') {
			this.timelineTree.revealTurn(this.lastRevealItemId);
		}
	}

	setInputMaximized(maximized: boolean): void {
		if (this.inputMaximized === maximized) {
			return;
		}
		this.inputMaximized = maximized;
		for (const host of [this.slotHosts.timeline, this.slotHosts.dock]) {
			host.classList.toggle(conversationLensInputMaximizedClass, maximized);
		}
		this.readingColumn.classList.toggle(conversationLensInputMaximizedClass, maximized);
		this.updateMaximizeInputButton();
		if (maximized) {
			this.inboxOverlay.closeListPanel();
		}
	}

	private toggleInputMaximized(): void {
		toggleInputMaximized(this);
	}

	private updateMaximizeInputButton(): void {
		updateMaximizeInputButton(this);
	}

	private updateSendEnabled(): void {
		updateSendEnabled(this);
	}

	private updateGateRow(): void {
		updateGateRow(this);
	}

	private refreshComposerCatalogs(): void {
		refreshComposerCatalogs(this);
	}

	private async loadConnectedComposerCatalogs(generation: number): Promise<void> {
		return loadConnectedComposerCatalogs(this, generation);
	}

	private createComposerSelectBox(options: { text: string }[], selectedIndex: number, ariaLabel: string): SelectBox {
		return createComposerSelectBox(this, options, selectedIndex, ariaLabel);
	}

	private createRouteSelectBox(selectedIndex: number, ariaLabel: string): SelectBox {
		return createRouteSelectBox(this, selectedIndex, ariaLabel);
	}

	private getSessionConfig(sessionId: string): ConversationSessionConfigSelection {
		return getSessionConfig(this, sessionId);
	}

	private setSessionConfig(sessionId: string, patch: Partial<ConversationSessionConfigSelection>): void {
		setSessionConfig(this, sessionId, patch);
	}

	private syncSessionConfigSelects(sessionId: string): void {
		syncSessionConfigSelects(this, sessionId);
	}

	private updateSessionConfigVisibility(preFirst: boolean): void {
		updateSessionConfigVisibility(this, preFirst);
	}

	private mountSessionBar(host: HTMLElement): void {
		mountSessionBar(this, host);
	}

	private createSessionSelectBox(): SelectBox {
		return createSessionSelectBox(this);
	}

	private refreshSessionSelectOptions(): void {
		refreshSessionSelectOptions(this);
	}

	private shouldRefreshActiveSessionChrome(sessionId: string): boolean {
		return shouldRefreshActiveSessionChrome(this, sessionId);
	}

	private mountTimeline(host: HTMLElement): void {
		mountTimeline(this, host);
	}

	private mountDock(host: HTMLElement): void {
		mountDock(this, host);
	}

	private toggleAddContextView(): void {
		toggleAddContextView(this);
	}

	private toggleTuneContextView(): void {
		toggleTuneContextView(this);
	}

	private toggleMoreContextView(): void {
		toggleMoreContextView(this);
	}

	private toggleTemplatesContextView(): void {
		toggleTemplatesContextView(this);
	}

	private isPreFirst(): boolean {
		return isPreFirst(this);
	}

	private updateConversationPhase(): void {
		updateConversationPhase(this);
	}

	private beginTurnEdit(turnId: string): void {
		beginTurnEdit(this, turnId);
	}

	private beginQueueEdit(itemId: string): void {
		beginQueueEdit(this, itemId);
	}

	private exitComposerEdit(restoreComposeDraft = true, releaseQueueHold = true): void {
		exitComposerEdit(this, restoreComposeDraft, releaseQueueHold);
	}

	private getVoiceClips(sessionId: string): readonly ConversationVoiceClip[] {
		return getVoiceClips(this, sessionId);
	}

	private setVoiceClips(sessionId: string, clips: readonly ConversationVoiceClip[]): void {
		setVoiceClips(this, sessionId, clips);
	}

	private renderVoiceTranscriptBar(): void {
		renderVoiceTranscriptBar(this);
	}

	private updateVoiceMicChrome(): void {
		updateVoiceMicChrome(this);
	}

	private toggleVoiceRecording(): void {
		toggleVoiceRecording(this);
	}

	private finishVoiceClip(sessionId: string, clipId: string): void {
		finishVoiceClip(this, sessionId, clipId);
	}

	private getEditingQueueItem() {
		getEditingQueueItem(this);
	}

	private updateComposerEditChrome(): void {
		updateComposerEditChrome(this);
	}

	private syncComposerPlacement(): void {
		syncComposerPlacement(this);
	}

	private ensureComposerInCluster(): void {
		ensureComposerInCluster(this);
	}

	private switchToSession(sessionId: string): void {
		switchToSession(this, sessionId);
	}

	private openVisualizeOverlay(source: string, title?: string): void {
		openVisualizeOverlay(this, source, title);
	}

	private loadLensId(): ConversationLensId {
		return loadLensId(this);
	}

	private setLensId(lensId: ConversationLensId): void {
		setLensId(this, lensId);
	}

	private updateLensTabs(): void {
		updateLensTabs(this);
	}

	private handleLensTablistKeyDown(event: KeyboardEvent): void {
		handleLensTablistKeyDown(this, event);
	}

	private updateReadingColumn(): void {
		updateReadingColumn(this);
	}

	private refreshTrajectoryRecords(sessionId: string): void {
		refreshTrajectoryRecords(this, sessionId);
	}

	private navigateToTurnFromTrajectory(turnId: string): void {
		navigateToTurnFromTrajectory(this, turnId);
	}

	private navigateToTrajectoryFromTurn(turnId: string): void {
		navigateToTrajectoryFromTurn(this, turnId);
	}

	private createNewSession(): void {
		createNewSession(this);
	}

	private deleteActiveSession(): void {
		deleteActiveSession(this);
	}

	private applyActiveSession(sessionId: string): void {
		applyActiveSession(this, sessionId);
	}

	private bindSessionView(sessionId: string): void {
		bindSessionView(this, sessionId);
	}

	private applySessionViewTimeline(applied: ConversationViewFrameApplied,
		options?: { readonly sidecarOnly?: boolean },): void {
		applySessionViewTimeline(this, applied, options);
	}

	private bindReadingColumnLayout(): void {
		bindReadingColumnLayout(this);
	}

	private composerChatId(): string {
		return composerChatId(this);
	}

	private draftMapKey(sessionId: string): string {
		return draftMapKey(this, sessionId);
	}

	private readComposerDraft(sessionId: string): string {
		return readComposerDraft(this, sessionId);
	}

	private writeComposerDraft(sessionId: string, text: string): void {
		writeComposerDraft(this, sessionId, text);
	}

	private restoreComposerDraftToInput(): void {
		restoreComposerDraftToInput(this);
	}

	private deleteComposerDraftsForSession(sessionId: string): void {
		deleteComposerDraftsForSession(this, sessionId);
	}

	private pruneOrphanComposerDrafts(): void {
		pruneOrphanComposerDrafts(this);
	}

	private applyConversationDensity(): void {
		applyConversationDensity(this);
	}

	private applyConversationWidth(width: number): void {
		applyConversationWidth(this, width);
	}

	private updateSyncChrome(sync: SyncChrome): void {
		updateSyncChrome(this, sync);
	}

	private showPostFailure(reason: 'mailbox_full' | 'no_such_session' | 'not_authenticated'): void {
		showPostFailure(this, reason);
	}

	private updateSessionTitle(): void {
		updateSessionTitle(this);
	}

	private beginSessionTitleEdit(): void {
		beginSessionTitleEdit(this);
	}

	private cancelSessionTitleEdit(): void {
		cancelSessionTitleEdit(this);
	}

	private commitSessionTitleEdit(): void {
		commitSessionTitleEdit(this);
	}

	private renderInboxStatus(): void {
		renderInboxStatus(this);
	}

	scrollToFirstPendingConfirmation(): void {
		applyPendingConfirmationScroll({
			lensId: this.lensId,
			showConversationLens: () => this.setLensId('conversation'),
			inputMaximized: this.inputMaximized,
			setInputMaximized: maximized => this.setInputMaximized(maximized),
			findFirstPendingConfirmationTurnId: () => this.findFirstPendingConfirmationTurnId(),
			getConfirmationElement: turnId => this.timelineTree.getConfirmationElement(turnId),
		});
	}

	private findFirstPendingConfirmationTurnId(): string | undefined {
		return findFirstPendingConfirmationTurnId(this);
	}

	private async resolveConfirmation(turnId: string, status: 'allowed' | 'skipped'): Promise<void> {
		return resolveConfirmation(this, turnId, status);
	}

	private async resolveQuestion(turnId: string, requestId: string, answers: ConversationQuestionRespondAnswers, customText?: string): Promise<void> {
		return resolveQuestion(this, turnId, requestId, answers, customText);
	}

	private focusTimelineRecord(turnId: string): void {
		focusTimelineRecord(this, turnId);
	}

	private copyTurn(text: string): void {
		copyTurn(this, text);
	}

	private deleteTurn(turnId: string): void {
		deleteTurn(this, turnId);
	}

	private cancelToolCall(turn: { readonly id: string; readonly agentId?: string }): void {
		cancelToolCall(this, turn);
	}

	private resetInputHistoryBrowse(): void {
		resetInputHistoryBrowse(this);
	}

	private getSessionInputHistory(): readonly string[] {
		return getSessionInputHistory(this);
	}

	private navigateInputHistory(direction: InputHistoryDirection): boolean {
		return navigateInputHistory(this, direction);
	}

	private exitInputHistoryBrowse(): void {
		exitInputHistoryBrowse(this);
	}

	private postBound(msg: ConversationWriteMessage): Promise<PostOutcome> {
		return postBound(this, msg);
	}

	private async submitDraft(): Promise<void> {
		return submitDraft(this);
	}

	private saveTurnEdit(): void {
		saveTurnEdit(this);
	}

	private saveQueueEdit(): void {
		saveQueueEdit(this);
	}
}
