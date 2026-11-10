/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import './media/conversationLens.css';
import '../../../browser/media/uaRoundedIcons.css';
import '../../../browser/media/uaRoundedMenus.css';
import { reset } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IDialogService } from '../../../../platform/dialogs/common/dialogs.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { IContextMenuService, IContextViewService, IOpenContextView } from '../../../../platform/contextview/browser/contextView.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IConversationLensSlots } from '../../../browser/parts/conversation/conversationPart.js';
import { ConversationIdentityStrip } from './conversationIdentityStrip.js';
import { ConversationEngineHistoryList } from './conversationEngineHistoryList.js';
import { ConversationEngineSnapshotsList } from './conversationEngineSnapshotsList.js';
import { ConversationInboxOverlay, type ConversationInboxContextUsage } from './conversationInboxOverlay.js';
import { ConversationTimelineHost } from './conversationTimelineHost.js';
import { ConversationTrajectory } from './conversationTrajectory.js';
import type { ConversationTimelineEntry } from './conversationSessionView.js';
import { IConversationReviewNavService } from './conversationReviewEntry.js';
import type { ConversationQuestionRespondAnswers, ConversationViewFrameApplied, ConversationWriteMessage, IConversationSessionViewLease, PostOutcome } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { SessionViewSnapshot, SyncChrome, TimelineItemSummary } from '../../../../platform/universeAgent/common/sessionView/index.js';
import { conversationLensInputMaximizedClass, type ConversationComposerPostFailureReason } from './conversationLensDockStrings.js';
import { getConversationTurnAccessibleText } from './conversationAccessibility.js';
import { InputHistoryDirection } from './conversationInputHistory.js';
import { ConversationComposerModel } from './conversationComposerModel.js';
import { IConversationSessionChoiceService } from './conversationSessionChoiceService.js';
import { findFirstInboxPendingConfirmationTurnId, scrollToFirstPendingConfirmation as applyPendingConfirmationScroll } from './conversationPendingSeat.js';
import { IConversationRosterService } from './conversationStubService.js';
import { ConversationMermaidExtensionInfo, resolveConversationMermaidExtension } from './conversationMermaidHost.js';
import { ConversationVisualizeOverlay } from './conversationVisualizeOverlay.js';
import { IConversationTimelineRevealService } from './conversationTimelineRevealService.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IWebviewService } from '../../webview/browser/webview.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { UA_CLIENT_CLIENT_TOOLS_SHOW_TOOL_INVOCATION_DETAILS, UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR } from '../common/uaClientSettingsKeys.js';
import { UA_CLIENT_DISPLAY_CONVERSATION_DENSITY } from '../common/uaClientSettingsHelpers.js';
import {
	applyConversationDensity,
	applyConversationWidth,
	bindReadingColumnLayout,
	getConversationDisplayMode,
	layoutReadingSurfaces,
	mountTimeline,
} from './conversationLensReadingColumn.js';
import { applyDockInputMaxHeight } from './conversationNarrowLayout.js';
import {
	applyActiveSession,
	bindSessionView,
	cancelToolCall,
	respondClientTool,
	copyTurn,
	deleteTurn,
	regenerateTurn as regenerateTurnBound,
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
	createConversationLensAriaId,
	type ConversationLensId,
	CONVERSATION_LENS_ID_STORAGE_KEY,
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
	updateSessionBarWriteChrome,
	updateSessionTitle,
} from './conversationLensSessionBar.js';
import { composerDraftText, composerSubmitText } from './conversationComposerRefs.js';
import { mountDock } from './conversationLensDock.js';
import { IConversationTimelineLinkHit } from './resolveConversationTimelineLink.js';
import {
	composerChatId,
	deleteComposerDraftsForSession,
	draftMapKey,
	loadConnectedComposerCatalogs,
	postBound,
	readComposerDraft,
	refreshComposerCatalogs,
	restoreComposerDraftToInput,
	saveQueueEdit,
	saveTurnEdit,
	submitDraft,
	writeComposerDraft,
} from './conversationLensComposer.js';
import {
	beginQueueEdit,
	beginTurnEdit,
	cancelQueueEdit,
	createComposerSelectBox,
	type ComposerPickerRole,
	ensureComposerInCluster,
	exitComposerEdit,
	exitInputHistoryBrowse,
	getEditingQueueItem,
	getSessionConfig,
	getSessionInputHistory,
	navigateInputHistory,
	paintSessionChoice,
	resetInputHistoryBrowse,
	setSessionConfig,
	clearPostFailure,
	composerWriteBusyReason,
	showPostFailure,
	syncComposerPlacement,
	syncSessionConfigSelects,
	toggleInputMaximized,
	toggleMoreContextView,
	toggleTuneContextView,
	updateComposerEditChrome,
	updateComposerSessionSelectsEnabled,
	updateGateRow,
	updateMaximizeInputButton,
	updateSendEnabled,
	updateSessionConfigVisibility,
	updateComposerSingleLineLayout,
	type ConversationSessionConfigSelection,
} from './conversationLensComposerChrome.js';

/**
 * D546: mermaid resolve is fire-and-forget. A lone `.then` leaks reject /
 * then-throw, so the chain ends in a single `.catch(onUnexpectedError)`.
 */
export function scheduleConversationMermaidExtensionResolve(host: {
	readonly extensionService: IExtensionService;
	readonly isDisposed: boolean;
	mermaidExtensionInfo: ConversationMermaidExtensionInfo | undefined;
	readonly timelineTree: Pick<ConversationTimelineHost, 'setMermaidExtensionInfo'>;
	applySessionViewTimeline(applied: ConversationViewFrameApplied): void;
}): void {
	void resolveConversationMermaidExtension(host.extensionService).then(info => {
		if (host.isDisposed || host.mermaidExtensionInfo === info) {
			return;
		}
		host.mermaidExtensionInfo = info;
		host.timelineTree.setMermaidExtensionInfo(info);
		host.applySessionViewTimeline({ kind: 'baseline' });
	}).catch(onUnexpectedError);
}

function admittedSnapshotUsageNumber(summary: object, key: 'inputTokens' | 'outputTokens' | 'contextPct'): number | undefined {
	const desc = Object.getOwnPropertyDescriptor(summary, key);
	if (desc === undefined || !Object.hasOwn(desc, 'value')) {
		return undefined;
	}
	return typeof desc.value === 'number' && Number.isFinite(desc.value) ? desc.value : undefined;
}

/**
 * Latest admitted usage row on the lease timeline, in orderKey order.
 * The inbox ring uses that row's contextPct only. Token counts are copied when
 * they are finite own data. A later usage row that omitted contextPct does not
 * keep an older percentage, and nothing is derived from token counts.
 */
export function latestAdmittedInboxContextUsage(snapshot: SessionViewSnapshot | undefined): ConversationInboxContextUsage | undefined {
	if (!snapshot) {
		return undefined;
	}
	const ordered = snapshot.timeline.slice().sort((a, b) => a.orderKey < b.orderKey ? -1 : a.orderKey > b.orderKey ? 1 : 0);
	let latest: TimelineItemSummary | undefined;
	for (const item of ordered) {
		if (item.summary.kind === 'usage') {
			latest = item.summary;
		}
	}
	if (latest?.kind !== 'usage') {
		return undefined;
	}
	const contextPct = admittedSnapshotUsageNumber(latest, 'contextPct');
	if (contextPct === undefined) {
		return undefined;
	}
	const inputTokens = admittedSnapshotUsageNumber(latest, 'inputTokens');
	const outputTokens = admittedSnapshotUsageNumber(latest, 'outputTokens');
	return {
		contextPct,
		...(inputTokens !== undefined ? { inputTokens } : {}),
		...(outputTokens !== undefined ? { outputTokens } : {}),
	};
}

/**
 * Product Conversation lens: SessionBar + stub timeline + local dock, mounted
 * into {@link IConversationLensSlots}. Not ChatEditor / ChatViewPane.
 */
export class ConversationLens extends Disposable {

	register<T extends import('../../../../base/common/lifecycle.js').IDisposable>(disposable: T): T {
		return this._register(disposable);
	}

	get isDisposed(): boolean {
		return this._store.isDisposed;
	}

	sessionTitleButton!: HTMLButtonElement;
	readonly lensAriaId = createConversationLensAriaId();
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
	lensId: ConversationLensId = 'conversation';
	/** Overlay / filtered lenses must not persist the shared lens id. */
	pinConversationLens = false;
	filterAgentId: string | undefined;
	timelineTree!: ConversationTimelineHost;
	trajectoryView!: ConversationTrajectory;
	inboxOverlay!: ConversationInboxOverlay;
	engineHistoryList: ConversationEngineHistoryList | undefined;
	engineSnapshotsList: ConversationEngineSnapshotsList | undefined;
	dockTextarea!: HTMLTextAreaElement;
	composerRefRow!: HTMLElement;
	composerAtSuggest!: HTMLElement;
	readonly composerRefResources: string[] = [];
	/** Assigned by `wireComposerAt` when the dock mounts. */
	declare syncComposerRefs: (() => void) | undefined;
	sendButton!: Button;
	addButton!: Button;
	addContextView: IOpenContextView | undefined;
	tuneButton!: Button;
	permissionSelectBox!: SelectBox;
	agentContainer!: HTMLElement;
	agentSelectBox!: SelectBox;
	moreButton!: Button;
	sessionMoreButton!: Button;
	sessionMoreContextView: IOpenContextView | undefined;
	modelSelectBox!: SelectBox;
	modelSelectedIndex = 0;
	maximizeInputButton!: Button;
	composerCluster!: HTMLElement;

	readingColumn!: HTMLElement;
	prefirstHero!: HTMLElement;
	dockRoot!: HTMLElement;
	gateRow!: HTMLElement;
	gateLabel!: HTMLElement;
	sessionSyncBadge!: HTMLElement;
	composer!: HTMLElement;
	composerEditHeader!: HTMLElement;
	composerEditTitle!: HTMLElement;
	composerExitButton!: Button;
	identityStrip!: ConversationIdentityStrip;

	readonly slotHosts: IConversationLensSlots;
	inputMaximized = false;
	conversationPhase: 'prefirst' | 'active' | undefined;
	readonly composerModel = this._register(new ConversationComposerModel());

	readonly drafts = new Map<string, string>();
	suppressSessionSelect = false;
	mermaidExtensionInfo: ConversationMermaidExtensionInfo | undefined;
	readonly visualizeOverlay: ConversationVisualizeOverlay;
	sessionViewLease: IConversationSessionViewLease | undefined;
	readonly sessionViewLifetime = this._register(new DisposableStore());
	submitInFlight = false;
	/** Hidden session leaves release the lease; connection churn must not re-acquire until restore. */
	sessionViewBindingSuspended = false;
	lastAttachedEntries: ConversationTimelineEntry[] = [];
	lastRevealItemId: string | undefined;
	lastReadingWidth = 0;
	lastReadingHeight = 0;
	private lastTurnWriteHold: string | undefined;
	composerCatalogGeneration = 0;
	catalogToolNames: readonly string[] = [];
	catalogModelIds: readonly string[] = [];
	boundSessionId: string | undefined;

	constructor(
		slots: IConversationLensSlots,
		@IConversationRosterService public readonly stubService: IConversationRosterService,
		@IClipboardService public readonly clipboardService: IClipboardService,
		@IContextViewService public readonly contextViewService: IContextViewService,
		@IContextMenuService public readonly contextMenuService: IContextMenuService,
		@IConfigurationService public readonly configurationService: IConfigurationService,
		@IInstantiationService public readonly instantiationService: IInstantiationService,
		@IStorageService public readonly storageService: IStorageService,
		@IExtensionService public readonly extensionService: IExtensionService,
		@IWebviewService public readonly webviewService: IWebviewService,
		@IConversationTimelineRevealService revealService: IConversationTimelineRevealService,
		@IConversationReviewNavService public readonly reviewNavService: IConversationReviewNavService,
		@ICommandService public readonly commandService: ICommandService,
		@IUniverseAgentConnection public readonly uaConnection: IUniverseAgentConnection,
		@IDialogService public readonly dialogService: IDialogService,
		@IConversationSessionChoiceService public readonly sessionChoiceService: IConversationSessionChoiceService,
	) {
		super();

		// Registration key is the sessionKey passed in at construction. boundSessionId is
		// still unset here, and setBoundSessionId does not rebuild the lens.
		if (!slots.filterAgentId && slots.sessionKey !== undefined) {
			this._register(revealService.registerLens(slots.sessionKey, this));
		}
		this._register(this.reviewNavService.onDidChange(() => {
			this.applySessionViewTimeline({ kind: 'patches', changedIds: new Set() }, { sidecarOnly: true });
		}));

		this.slotHosts = slots;
		this.filterAgentId = slots.filterAgentId;
		this.boundSessionId = slots.sessionKey;
		this.pinConversationLens = slots.pinConversationLens === true || slots.filterAgentId !== undefined;
		this.visualizeOverlay = this._register(this.instantiationService.createInstance(ConversationVisualizeOverlay));

		scheduleConversationMermaidExtensionResolve(this);

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
		this._register(this.configurationService.onDidChangeConfiguration(event => {
			if (event.affectsConfiguration(UA_CLIENT_DISPLAY_CONVERSATION_DENSITY)) {
				this.applyConversationDensity();
			}
			if (event.affectsConfiguration(UA_CLIENT_CLIENT_TOOLS_SHOW_TOOL_INVOCATION_DETAILS)) {
				this.timelineTree.refreshPresentation();
			}
			if (event.affectsConfiguration(UA_CLIENT_KEYBOARD_ENTER_BEHAVIOR)) {
				this.updateSendEnabled();
			}
		}));
		this.bindReadingColumnLayout();

		this.lensId = this.pinConversationLens ? 'conversation' : this.loadLensId();
		this.updateLensTabs();
		this.bindSessionView(this.getBoundSessionId());
		this.updateReadingColumn();
		this.updateSessionTitle();
		this.renderInboxStatus();

		this._register(this.stubService.onDidChangeActiveSession(sessionId => {
			if (this.boundSessionId !== undefined && sessionId !== this.boundSessionId) {
				this.closeBoundInnerOverlays();
				return;
			}
			if (this.boundSessionId !== undefined) {
				// The bound session became the active session again: focus back from the
				// other window, a hidden leaf restored, or a pick in the Sessions list.
				// This lens's session did not change, so this is not a session switch.
				this.refreshReactivatedBoundSession();
				return;
			}
			this.applyActiveSession(sessionId);
		}));
		this._register(this.stubService.onDidChangeSession(sessionId => {
			this.refreshSessionSelectOptions();
			if (this.shouldRefreshActiveSessionChrome(sessionId)) {
				if (!this.sessionTitleEditing) {
					this.updateSessionTitle();
				}
				this.renderInboxStatus();
				this.updateConversationPhase();
				this.updateGateRow();
				updateComposerSessionSelectsEnabled(this);
				if (this.lensId === 'trajectory' && sessionId === this.getBoundSessionId()) {
					this.refreshTrajectoryRecords(sessionId);
				}
			}
		}));
		this._register(this.stubService.onDidChangeEngineConnection(() => {
			this.refreshComposerCatalogs();
			this.rebindSessionViewAfterConnectionChange();
			this.updateConversationPhase();
			this.updateSyncChrome();
			this.updateSessionBarWriteChrome();
			this.timelineTree.refreshPresentation();
		}));
		this._register(this.uaConnection.onDidChangeConnection(() => {
			this.refreshComposerCatalogs();
			this.updateGateRow();
			this.rebindSessionViewAfterConnectionChange();
			this.updateConversationPhase();
			this.updateSyncChrome();
			this.updateSessionBarWriteChrome();
			this.timelineTree.refreshPresentation();
		}));
		this._register(this.sessionChoiceService.onDidChangeSessionChoice(sessionId => paintSessionChoice(this, sessionId)));
		this.refreshComposerCatalogs();

		this._register(toDisposable(() => {
			this.addContextView?.close();
			this.composerModel.tuneContextView?.close();
			this.composerModel.moreContextView?.close();
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
		if (this.dockTextarea && this.composerModel.policy === 'compose') {
			this.writeComposerDraft(this.getBoundSessionId(), composerDraftText(this));
		}
		this.boundSessionId = next;
		this.identityStrip.setBoundSessionId(next);
		this.applyActiveSession(this.getBoundSessionId());
	}

	getBoundSessionId(): string {
		return this.boundSessionId ?? this.stubService.getActiveSessionId();
	}

	/**
	 * Session id for History, Snapshots, and Inbox. Bound leaves return the
	 * field only. Unbound lenses (no sessionKey) follow the roster. Callers
	 * must not wrap {@link getBoundSessionId}.
	 */
	listSessionId(): string {
		if (this.boundSessionId !== undefined) {
			return this.boundSessionId;
		}
		return this.stubService.getActiveSessionId();
	}

	/** Session bar select / delete target. Bound lenses return the field without reading the roster. */
	getSessionBarSelectId(): string {
		return this.listSessionId();
	}

	private closeBoundInnerOverlays(): void {
		this.inboxOverlay.closeListPanel();
		this.engineHistoryList?.close({ restoreFocus: false });
		this.engineSnapshotsList?.close({ restoreFocus: false });
		this.visualizeOverlay.close({ restoreFocus: false });
	}

	/**
	 * Edits, the failure row, and trajectory search stay. Readiness follows the
	 * roster's active session, so gates and chrome still repaint. Config selects are
	 * not re-selected: that would overwrite an in-flight model switch.
	 */
	private refreshReactivatedBoundSession(): void {
		const sessionId = this.boundSessionId;
		if (sessionId === undefined) {
			return;
		}
		// A hidden leaf is re-bound by its pane when it becomes visible.
		if (!this.sessionViewBindingSuspended && this.sessionViewLease?.sessionId !== sessionId) {
			this.bindSessionView(sessionId);
		}
		if (!this.sessionTitleEditing) {
			this.updateSessionTitle();
		}
		this.renderInboxStatus();
		this.updateConversationPhase();
		this.updateGateRow();
		updateComposerSessionSelectsEnabled(this);
		this.updateSendEnabled();
		this.updateSyncChrome();
	}

	setFilterAgentId(agentId: string | undefined): void {
		if (this.filterAgentId === agentId) {
			return;
		}
		if (this.composerModel.policy === 'turnEdit') {
			this.exitComposerEdit(true);
		}
		if (this.dockTextarea && this.composerModel.policy === 'compose') {
			this.writeComposerDraft(this.getBoundSessionId(), composerDraftText(this));
		}
		this.filterAgentId = agentId;
		this.restoreComposerDraftToInput();
		if (this.sessionViewLease && this.sessionViewLease.sessionId === this.getBoundSessionId()) {
			this.applySessionViewTimeline({ kind: 'baseline' });
		} else if (this.lensId === 'trajectory') {
			this.refreshTrajectoryRecords(this.getBoundSessionId());
		}
	}

	trajectoryProjectionOptions(): { readonly filterAgentId?: string } | undefined {
		return trajectoryProjectionOptions(this);
	}

	focusDockInput(): void {
		this.dockTextarea?.focus();
	}

	activateConversationLink(hit: IConversationTimelineLinkHit): Promise<void> {
		return this.timelineTree.activateConversationLink(hit);
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
			if (!this.pinConversationLens) {
				this.storageService.store(CONVERSATION_LENS_ID_STORAGE_KEY, 'conversation', StorageScope.WORKSPACE, StorageTarget.MACHINE);
			}
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
		// The composer can mount in the dock, timeline row, or pre-first reading column.
		// Cap it from the leaf height so a short split leaf keeps its send row visible.
		for (const host of [this.slotHosts.dock, this.slotHosts.timeline, this.readingColumn]) {
			applyDockInputMaxHeight(host, height);
		}
		this.applyConversationWidth(width);
		layoutReadingSurfaces(this, height, width);
		if (restored && this.lastRevealItemId && this.lensId === 'conversation') {
			this.timelineTree.revealTurn(this.lastRevealItemId);
		}
	}

	setInputMaximized(maximized: boolean): void {
		const unchanged = this.inputMaximized === maximized;
		if (!unchanged) {
			this.inputMaximized = maximized;
			for (const host of [this.slotHosts.timeline, this.slotHosts.dock]) {
				host.classList.toggle(conversationLensInputMaximizedClass, maximized);
			}
			this.readingColumn.classList.toggle(conversationLensInputMaximizedClass, maximized);
			this.updateMaximizeInputButton();
			this.updateComposerSingleLineLayout();
		}
		// Repeat maximize still closes these overlays. An editor leaf can already
		// be maximized while its published History / Snapshots lists are open.
		if (maximized) {
			this.inboxOverlay.closeListPanel();
			this.engineHistoryList?.close();
			this.engineSnapshotsList?.close();
			this.visualizeOverlay.close();
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
		this.syncTurnWriteHold();
	}

	turnWriteHoldReason(): string | undefined {
		return composerWriteBusyReason(this);
	}

	/** Timeline write buttons read the same hold as Send; repaint them only when it flips. */
	private syncTurnWriteHold(): void {
		const hold = composerWriteBusyReason(this);
		if (hold === this.lastTurnWriteHold) {
			return;
		}
		this.lastTurnWriteHold = hold;
		this.timelineTree?.refreshTurnWriteHolds();
		if (this.sendButton) {
			updateSendEnabled(this);
		}
	}

	focusComposerInput(): void {
		const textarea = this.dockTextarea;
		if (textarea?.isConnected && !textarea.disabled && !textarea.closest('[hidden]')) {
			textarea.focus({ preventScroll: true });
		}
	}

	updateComposerSingleLineLayout(): void {
		updateComposerSingleLineLayout(this);
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

	createComposerSelectBox(options: { text: string }[], selectedIndex: number, ariaLabel: string, role?: ComposerPickerRole): SelectBox {
		return createComposerSelectBox(this, options, selectedIndex, ariaLabel, role);
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

	toggleTuneContextView(): void {
		toggleTuneContextView(this);
	}

	toggleMoreContextView(): void {
		toggleMoreContextView(this);
	}

	isPreFirst(): boolean {
		return isPreFirst(this);
	}

	updateConversationPhase(): void {
		updateConversationPhase(this);
	}

	displayMode() {
		return getConversationDisplayMode(this);
	}

	relayoutReadingSurfaces(): void {
		const measuredWidth = Math.floor(this.readingColumn?.clientWidth ?? 0);
		const measuredHeight = Math.floor(this.readingColumn?.clientHeight ?? 0);
		if (measuredWidth > 0 && measuredHeight > 0) {
			this.lastReadingWidth = measuredWidth;
			this.lastReadingHeight = measuredHeight;
		}
		let width = this.lastReadingWidth;
		let height = this.lastReadingHeight;
		if (width < 1 || height < 1) {
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

	cancelQueueEdit(): void {
		cancelQueueEdit(this);
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

	deleteActiveSession(): Promise<void> {
		return deleteActiveSession(this);
	}

	applyActiveSession(sessionId: string): void {
		applyActiveSession(this, sessionId);
	}

	bindSessionView(sessionId: string): void {
		this.sessionViewBindingSuspended = false;
		bindSessionView(this, sessionId);
		this.sessionChoiceService.readBackPermissionMode(sessionId).catch(onUnexpectedError);
	}

	releaseSessionViewLeaseForHiddenLeaf(): void {
		// Hiding the leaf gives the result coming back to it used to give: the edit, the
		// failure row, row-local action state, and input-history browse end here.
		if (this.composerModel.policy !== 'compose') {
			// Never release the queue hold here. While this session is still active the
			// queue is ready, and a release would requeue the pre-edit body. After a switch
			// from the Sessions list the queue is already stale, so a release request would
			// be refused by engineQueueEditMustKeepHold and the edit would stay open.
			this.exitComposerEdit(true, false);
		}
		this.clearPostFailure();
		this.timelineTree.clearTurnActionState();
		this.resetInputHistoryBrowse();
		this.sessionViewLifetime.clear();
		this.sessionViewLease = undefined;
		this.sessionViewBindingSuspended = true;
		this.renderInboxStatus();
	}

	private rebindSessionViewAfterConnectionChange(): void {
		if (this.sessionViewBindingSuspended) {
			return;
		}
		this.bindSessionView(this.getBoundSessionId());
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

	applyConversationDensity(): void {
		applyConversationDensity(this);
	}

	applyConversationWidth(width: number): void {
		applyConversationWidth(this, width);
		this.updateComposerSingleLineLayout();
	}

	updateSyncChrome(_sync?: SyncChrome): void {
		updateSyncChrome(this);
	}

	showPostFailure(reason: ConversationComposerPostFailureReason): void {
		showPostFailure(this, reason);
	}

	clearPostFailure(): void {
		clearPostFailure(this);
	}

	noteResponseFailure(turnId: string, error: string): void {
		this.timelineTree.noteResponseFailure(turnId, error);
	}

	noteTurnActionFailure(rowId: string, message: string): void {
		this.timelineTree.noteTurnActionFailure(rowId, message);
	}

	settleTurnWrite(rowId: string, _accepted: boolean): void {
		this.timelineTree.settleTurnWrite(rowId);
	}

	updateSessionTitle(): void {
		updateSessionTitle(this);
	}

	updateSessionBarWriteChrome(): void {
		updateSessionBarWriteChrome(this);
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
		this.inboxOverlay.setContextUsage(latestAdmittedInboxContextUsage(this.sessionViewLease?.snapshot));
		renderInboxStatus(this);
		this.syncTurnWriteHold();
	}

	scrollToFirstPendingConfirmation(): void {
		applyPendingConfirmationScroll({
			lensId: this.lensId,
			showConversationLens: () => this.setLensId('conversation'),
			inputMaximized: this.inputMaximized,
			setInputMaximized: maximized => this.setInputMaximized(maximized),
			findFirstPendingConfirmationTurnId: () => this.findFirstPendingConfirmationTurnId(),
			revealPendingTurn: turnId => this.timelineTree.revealPendingTurn(turnId),
		});
	}

	scrollToInboxPendingConfirmation(): void {
		const turnId = findFirstInboxPendingConfirmationTurnId(
			this.lastAttachedEntries,
			this.stubService.getTurns(this.getBoundSessionId()),
		);
		if (!turnId) {
			return;
		}
		applyPendingConfirmationScroll({
			lensId: this.lensId,
			showConversationLens: () => this.setLensId('conversation'),
			inputMaximized: this.inputMaximized,
			setInputMaximized: maximized => this.setInputMaximized(maximized),
			findFirstPendingConfirmationTurnId: () => turnId,
			revealPendingTurn: id => this.timelineTree.revealPendingTurn(id, { focusSeat: true }),
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

	copyTurn(text: string, rowId?: string): void {
		copyTurn(this, text, rowId);
	}

	deleteTurn(turnId: string, agentId?: string, rowId?: string): void {
		deleteTurn(this, turnId, agentId, rowId);
	}

	regenerateTurn(turn: { readonly id: string; readonly turnId?: string; readonly agentId?: string }): void {
		regenerateTurnBound(this, turn);
	}

	cancelToolCall(turn: { readonly id: string; readonly agentId?: string }): void {
		cancelToolCall(this, turn);
	}

	respondClientTool(turn: { readonly id: string }): void {
		respondClientTool(this, turn);
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

	/** A send or edit save that adds no failure of its own clears the previous one. */
	async submitDraft(): Promise<void> {
		if (composerWriteBusyReason(this) || composerSubmitText(this) === undefined) {
			return submitDraft(this);
		}
		const sessionId = this.getBoundSessionId();
		const failures = this.composerModel.postFailureSerial;
		await submitDraft(this);
		if (!this.isDisposed && this.getBoundSessionId() === sessionId && this.composerModel.postFailureSerial === failures) {
			clearPostFailure(this);
		}
	}

	saveTurnEdit(): void {
		saveTurnEdit(this);
	}

	saveQueueEdit(): void {
		saveQueueEdit(this);
	}
}
