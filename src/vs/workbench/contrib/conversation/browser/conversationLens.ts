/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationLens.css';
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
import { conversationLensInputMaximizedClass, type ConversationComposerPostFailureReason } from './conversationLensDockStrings.js';
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
	retryError as retryErrorBound,
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
	mountLensTablist,
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

	register<T extends import('../../../../base/common/lifecycle.js').IDisposable>(disposable: T): T {
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
	sessionBarRouteContainer!: HTMLElement;
	sessionBarRouteSelectBox!: SelectBox;
	lensTablist!: HTMLElement;
	lensTabConversation!: HTMLButtonElement;
	lensTabTrajectory!: HTMLButtonElement;
	lensId: ConversationLensId = 'conversation';
	filterAgentId: string | undefined;
	timelineTree!: ConversationTimelineTree;
	trajectoryView!: ConversationTrajectory;
	inboxOverlay!: ConversationInboxOverlay;
	engineHistoryList: ConversationEngineHistoryList | undefined;
	engineSnapshotsList: ConversationEngineSnapshotsList | undefined;
	dockTextarea!: HTMLTextAreaElement;
	sendButton!: Button;
	addButton!: Button;
	addContextView: IOpenContextView | undefined;
	tuneButton!: Button;
	tuneContextView: IOpenContextView | undefined;
	permissionSelectBox!: SelectBox;
	agentContainer!: HTMLElement;
	agentSelectBox!: SelectBox;
	routeContainer!: HTMLElement;
	routeSelectBox!: SelectBox;
	moreButton!: Button;
	moreContextView: IOpenContextView | undefined;
	modelSelectBox!: SelectBox;
	modelSelectedIndex = 0;
	templatesButton!: Button;
	templatesContextView: IOpenContextView | undefined;
	maximizeInputButton!: Button;
	micButton!: Button;
	composerCluster!: HTMLElement;
	voiceTranscriptBar!: ConversationVoiceTranscriptBar;

	readingColumn!: HTMLElement;
	prefirstHero!: HTMLElement;
	dockRoot!: HTMLElement;
	gateRow!: HTMLElement;
	gateLabel!: HTMLElement;
	sessionSyncBadge!: HTMLElement;
	sendFailureTimeout: ReturnType<typeof setTimeout> | undefined;
	composer!: HTMLElement;
	composerEditHeader!: HTMLElement;
	composerEditTitle!: HTMLElement;
	composerExitButton!: Button;
	identityStrip!: ConversationIdentityStrip;

	readonly slotHosts: IConversationLensSlots;
	inputMaximized = false;
	conversationPhase: 'prefirst' | 'active' | undefined;
	composerPolicy: ComposerPolicy = 'compose';
	editingTurnId: string | undefined;
	editingQueueItemId: string | undefined;
	composeDraftSnapshot = '';

	readonly drafts = new Map<string, string>();
	readonly sessionConfigBySessionId = new Map<string, ConversationSessionConfigSelection>();
	readonly voiceClipsBySessionId = new Map<string, ConversationVoiceClip[]>();
	readonly voicePhraseIndexBySessionId = new Map<string, number>();
	readonly voiceTranscriptTimeouts = new Map<string, ReturnType<typeof setTimeout>>();
	nextVoiceClipId = 0;
	inputHistoryBrowse: InputHistoryBrowseState = createInputHistoryBrowseState();
	suppressSessionSelect = false;
	mermaidExtensionInfo: ConversationMermaidExtensionInfo | undefined;
	readonly visualizeOverlay: ConversationVisualizeOverlay;
	sessionViewLease: IConversationSessionViewLease | undefined;
	readonly sessionViewLifetime = this._register(new DisposableStore());
	submitInFlight = false;
	lastAttachedEntries: ConversationTimelineEntry[] = [];
	lastRevealItemId: string | undefined;
	lastReadingWidth = 0;
	lastReadingHeight = 0;
	postFailureVisible = false;
	composerCatalogGeneration = 0;
	catalogToolNames: readonly string[] = [];
	catalogModelIds: readonly string[] = [];
	boundSessionId: string | undefined;

	constructor(
		slots: IConversationLensSlots,
		@IConversationRosterService readonly stubService: IConversationRosterService,
		@IClipboardService readonly clipboardService: IClipboardService,
		@IContextViewService readonly contextViewService: IContextViewService,
		@IConfigurationService readonly configurationService: IConfigurationService,
		@IInstantiationService readonly instantiationService: IInstantiationService,
		@IStorageService readonly storageService: IStorageService,
		@IExtensionService readonly extensionService: IExtensionService,
		@IWebviewService readonly webviewService: IWebviewService,
		@IConversationTimelineRevealService revealService: IConversationTimelineRevealService,
		@IConversationReviewNavService readonly reviewNavService: IConversationReviewNavService,
		@ICommandService readonly commandService: ICommandService,
		@IUniverseAgentConnection readonly uaConnection: IUniverseAgentConnection,
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
		this.boundSessionId = slots.sessionKey;
		this.visualizeOverlay = this._register(this.instantiationService.createInstance(ConversationVisualizeOverlay));

		void resolveConversationMermaidExtension(this.extensionService).then(info => {
			if (this._store.isDisposed || this.mermaidExtensionInfo === info) {
				return;
			}
			this.mermaidExtensionInfo = info;
			this.timelineTree.setMermaidExtensionInfo(info);
			this.applySessionViewTimeline({ kind: 'baseline' });
		});

		this.mountTimeline(slots.timeline);
		this.mountDock(slots.dock);
		if (slots.sessionBar) {
			this.mountSessionBar(slots.sessionBar);
			this.updateSessionConfigVisibility(this.isPreFirst());
		} else if (slots.lensTablist) {
			this.mountLensTablist(slots.lensTablist);
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
		this.bindSessionView(this.getBoundSessionId());
		this.updateReadingColumn();
		this.updateSessionTitle();
		this.renderInboxStatus();

		this._register(this.stubService.onDidChangeActiveSession(sessionId => {
			if (this.boundSessionId !== undefined && sessionId !== this.boundSessionId) {
				return;
			}
			this.applyActiveSession(sessionId);
		}));
		this._register(this.stubService.onDidChangeSession(sessionId => {
			this.pruneOrphanComposerDrafts();
			this.refreshSessionSelectOptions();
			if (this.shouldRefreshActiveSessionChrome(sessionId)) {
				if (!this.sessionTitleEditing) {
					this.updateSessionTitle();
				}
				this.renderInboxStatus();
				this.updateConversationPhase();
				if (this.lensId === 'trajectory' && sessionId === this.getBoundSessionId()) {
					this.refreshTrajectoryRecords(sessionId);
				}
			}
		}));
		this._register(this.stubService.onDidChangeEngineConnection(() => {
			this.updateVoiceMicChrome();
			this.refreshComposerCatalogs();
			this.bindSessionView(this.getBoundSessionId());
		}));
		this._register(this.uaConnection.onDidChangeConnection(() => {
			this.refreshComposerCatalogs();
			this.updateGateRow();
			this.updateVoiceMicChrome();
			this.bindSessionView(this.stubService.getActiveSessionId());
		}));
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
			if (slots.lensTablist) {
				reset(slots.lensTablist);
			}
			reset(slots.timeline);
			reset(slots.dock);
		}));
	}

	isInputMaximized(): boolean {
		return this.inputMaximized;
	}

	setBoundSessionId(sessionKey: string | undefined): void {
		const next = sessionKey || undefined;
		if (this.boundSessionId === next) {
			return;
		}
		if (this.dockTextarea && this.composerPolicy === 'compose') {
			this.writeComposerDraft(this.getBoundSessionId(), this.dockTextarea.value);
		}
		this.boundSessionId = next;
		this.applyActiveSession(this.getBoundSessionId());
	}

	getBoundSessionId(): string {
		return this.boundSessionId ?? this.stubService.getActiveSessionId();
	}

	setFilterAgentId(agentId: string | undefined): void {
		if (this.filterAgentId === agentId) {
			return;
		}
		if (this.dockTextarea && this.composerPolicy === 'compose') {
			this.writeComposerDraft(this.getBoundSessionId(), this.dockTextarea.value);
		}
		this.filterAgentId = agentId;
		this.restoreComposerDraftToInput();
		if (this.lensId === 'trajectory') {
			this.refreshTrajectoryRecords(this.getBoundSessionId());
		}
	}

	trajectoryProjectionOptions(): { readonly filterAgentId?: string } | undefined {
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
		this.lastReadingHeight = height;
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

	toggleInputMaximized(): void {
		toggleInputMaximized(this);
	}

	updateMaximizeInputButton(): void {
		updateMaximizeInputButton(this);
	}

	updateSendEnabled(): void {
		updateSendEnabled(this);
	}

	updateGateRow(): void {
		updateGateRow(this);
	}

	refreshComposerCatalogs(): void {
		refreshComposerCatalogs(this);
	}

	async loadConnectedComposerCatalogs(generation: number): Promise<void> {
		return loadConnectedComposerCatalogs(this, generation);
	}

	createComposerSelectBox(options: { text: string }[], selectedIndex: number, ariaLabel: string): SelectBox {
		return createComposerSelectBox(this, options, selectedIndex, ariaLabel);
	}

	createRouteSelectBox(selectedIndex: number, ariaLabel: string): SelectBox {
		return createRouteSelectBox(this, selectedIndex, ariaLabel);
	}

	getSessionConfig(sessionId: string): ConversationSessionConfigSelection {
		return getSessionConfig(this, sessionId);
	}

	setSessionConfig(sessionId: string, patch: Partial<ConversationSessionConfigSelection>): void {
		setSessionConfig(this, sessionId, patch);
	}

	syncSessionConfigSelects(sessionId: string): void {
		syncSessionConfigSelects(this, sessionId);
	}

	updateSessionConfigVisibility(preFirst: boolean): void {
		updateSessionConfigVisibility(this, preFirst);
	}

	mountSessionBar(host: HTMLElement): void {
		mountSessionBar(this, host);
	}

	mountLensTablist(host: HTMLElement): void {
		mountLensTablist(this, host);
	}

	createSessionSelectBox(): SelectBox {
		return createSessionSelectBox(this);
	}

	refreshSessionSelectOptions(): void {
		refreshSessionSelectOptions(this);
	}

	shouldRefreshActiveSessionChrome(sessionId: string): boolean {
		return shouldRefreshActiveSessionChrome(this, sessionId);
	}

	mountTimeline(host: HTMLElement): void {
		mountTimeline(this, host);
	}

	mountDock(host: HTMLElement): void {
		mountDock(this, host);
	}

	toggleAddContextView(): void {
		toggleAddContextView(this);
	}

	toggleTuneContextView(): void {
		toggleTuneContextView(this);
	}

	toggleMoreContextView(): void {
		toggleMoreContextView(this);
	}

	toggleTemplatesContextView(): void {
		toggleTemplatesContextView(this);
	}

	isPreFirst(): boolean {
		return isPreFirst(this);
	}

	updateConversationPhase(): void {
		updateConversationPhase(this);
	}

	relayoutReadingSurfaces(): void {
		let width = this.lastReadingWidth;
		let height = this.lastReadingHeight;
		if (width < 1 || height < 1) {
			const measuredWidth = Math.floor(this.readingColumn?.clientWidth ?? 0);
			const measuredHeight = Math.floor(this.readingColumn?.clientHeight ?? 0);
			if (measuredWidth < 1 || measuredHeight < 1) {
				return;
			}
			width = measuredWidth;
			height = measuredHeight;
			this.lastReadingWidth = width;
			this.lastReadingHeight = height;
		}
		layoutReadingSurfaces(this, height, width);
	}

	beginTurnEdit(turnId: string): void {
		beginTurnEdit(this, turnId);
	}

	beginQueueEdit(itemId: string): void {
		beginQueueEdit(this, itemId);
	}

	exitComposerEdit(restoreComposeDraft = true, releaseQueueHold = true): void {
		exitComposerEdit(this, restoreComposeDraft, releaseQueueHold);
	}

	getVoiceClips(sessionId: string): readonly ConversationVoiceClip[] {
		return getVoiceClips(this, sessionId);
	}

	setVoiceClips(sessionId: string, clips: readonly ConversationVoiceClip[]): void {
		setVoiceClips(this, sessionId, clips);
	}

	renderVoiceTranscriptBar(): void {
		renderVoiceTranscriptBar(this);
	}

	updateVoiceMicChrome(): void {
		updateVoiceMicChrome(this);
	}

	toggleVoiceRecording(): void {
		toggleVoiceRecording(this);
	}

	finishVoiceClip(sessionId: string, clipId: string): void {
		finishVoiceClip(this, sessionId, clipId);
	}

	getEditingQueueItem() {
		return getEditingQueueItem(this);
	}

	updateComposerEditChrome(): void {
		updateComposerEditChrome(this);
	}

	syncComposerPlacement(): void {
		syncComposerPlacement(this);
	}

	ensureComposerInCluster(): void {
		ensureComposerInCluster(this);
	}

	switchToSession(sessionId: string): void {
		switchToSession(this, sessionId);
	}

	openVisualizeOverlay(source: string, title?: string): void {
		openVisualizeOverlay(this, source, title);
	}

	loadLensId(): ConversationLensId {
		return loadLensId(this);
	}

	setLensId(lensId: ConversationLensId): void {
		setLensId(this, lensId);
		this.relayoutReadingSurfaces();
	}

	updateLensTabs(): void {
		updateLensTabs(this);
	}

	handleLensTablistKeyDown(event: KeyboardEvent): void {
		handleLensTablistKeyDown(this, event);
		this.relayoutReadingSurfaces();
	}

	updateReadingColumn(): void {
		updateReadingColumn(this);
	}

	refreshTrajectoryRecords(sessionId: string): void {
		refreshTrajectoryRecords(this, sessionId);
	}

	navigateToTurnFromTrajectory(turnId: string): void {
		navigateToTurnFromTrajectory(this, turnId);
		this.relayoutReadingSurfaces();
	}

	navigateToTrajectoryFromTurn(turnId: string): void {
		navigateToTrajectoryFromTurn(this, turnId);
	}

	createNewSession(): void {
		createNewSession(this);
	}

	deleteActiveSession(): void {
		deleteActiveSession(this);
	}

	applyActiveSession(sessionId: string): void {
		applyActiveSession(this, sessionId);
	}

	bindSessionView(sessionId: string): void {
		bindSessionView(this, sessionId);
	}

	applySessionViewTimeline(applied: ConversationViewFrameApplied,
		options?: { readonly sidecarOnly?: boolean },): void {
		applySessionViewTimeline(this, applied, options);
	}

	bindReadingColumnLayout(): void {
		bindReadingColumnLayout(this);
	}

	composerChatId(): string {
		return composerChatId(this);
	}

	draftMapKey(sessionId: string): string {
		return draftMapKey(this, sessionId);
	}

	readComposerDraft(sessionId: string): string {
		return readComposerDraft(this, sessionId);
	}

	writeComposerDraft(sessionId: string, text: string): void {
		writeComposerDraft(this, sessionId, text);
	}

	restoreComposerDraftToInput(): void {
		restoreComposerDraftToInput(this);
	}

	deleteComposerDraftsForSession(sessionId: string): void {
		deleteComposerDraftsForSession(this, sessionId);
	}

	pruneOrphanComposerDrafts(): void {
		pruneOrphanComposerDrafts(this);
	}

	applyConversationDensity(): void {
		applyConversationDensity(this);
	}

	applyConversationWidth(width: number): void {
		applyConversationWidth(this, width);
	}

	updateSyncChrome(sync: SyncChrome): void {
		updateSyncChrome(this, sync);
	}

	showPostFailure(reason: ConversationComposerPostFailureReason): void {
		showPostFailure(this, reason);
	}

	updateSessionTitle(): void {
		updateSessionTitle(this);
	}

	beginSessionTitleEdit(): void {
		beginSessionTitleEdit(this);
	}

	cancelSessionTitleEdit(): void {
		cancelSessionTitleEdit(this);
	}

	commitSessionTitleEdit(): void {
		commitSessionTitleEdit(this);
	}

	renderInboxStatus(): void {
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

	findFirstPendingConfirmationTurnId(): string | undefined {
		return findFirstPendingConfirmationTurnId(this);
	}

	async resolveConfirmation(turnId: string, status: 'allowed' | 'skipped'): Promise<void> {
		return resolveConfirmation(this, turnId, status);
	}

	async resolveQuestion(turnId: string, requestId: string, answers: ConversationQuestionRespondAnswers, customText?: string): Promise<void> {
		return resolveQuestion(this, turnId, requestId, answers, customText);
	}

	focusTimelineRecord(turnId: string): void {
		focusTimelineRecord(this, turnId);
	}

	copyTurn(text: string): void {
		copyTurn(this, text);
	}

	deleteTurn(turnId: string): void {
		deleteTurn(this, turnId);
	}

	cancelToolCall(turn: { readonly id: string; readonly agentId?: string }): void {
		cancelToolCall(this, turn);
	}

	retryError(turn: { readonly id: string; readonly turnId?: string; readonly agentId?: string }): void {
		retryErrorBound(this, turn);
	}

	resetInputHistoryBrowse(): void {
		resetInputHistoryBrowse(this);
	}

	getSessionInputHistory(): readonly string[] {
		return getSessionInputHistory(this);
	}

	navigateInputHistory(direction: InputHistoryDirection): boolean {
		return navigateInputHistory(this, direction);
	}

	exitInputHistoryBrowse(): void {
		exitInputHistoryBrowse(this);
	}

	postBound(msg: ConversationWriteMessage): Promise<PostOutcome> {
		return postBound(this, msg);
	}

	async submitDraft(): Promise<void> {
		return submitDraft(this);
	}

	saveTurnEdit(): void {
		saveTurnEdit(this);
	}

	saveQueueEdit(): void {
		saveQueueEdit(this);
	}
}
