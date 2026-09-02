/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, getWindow, reset } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import { SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { AnchorPosition } from '../../../../base/common/layout.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { URI } from '../../../../base/common/uri.js';
import { SOURCES_REVIEW_SHOW_FOR_PATHS_COMMAND } from '../../sources/browser/sourcesReview.contribution.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { IContextViewService, IOpenContextView } from '../../../../platform/contextview/browser/contextView.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { defaultButtonStyles, defaultSelectBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { hasNativeContextMenu } from '../../../../platform/window/common/window.js';
import { IConversationLensSlots } from '../../../browser/parts/conversation/conversationPart.js';
import { ConversationIdentityStrip } from './conversationIdentityStrip.js';
import { ConversationInboxOverlay } from './conversationInboxOverlay.js';
import { ConversationTimelineTree } from './conversationTimelineTree.js';
import { ConversationTrajectory } from './conversationTrajectory.js';
import { projectSnapshotToEntries, formatSyncChromeLabel } from './conversationSessionView.js';
import type { ConversationTimelineEntry } from './conversationSessionView.js';
import { attachReviewEntries, computeReviewNavSidecarApplied, IConversationReviewNavService } from '../common/conversationReviewEntry.js';
import { ConversationSessionViewFrameCoalescer } from './conversationSessionViewFrameCoalescer.js';
import type { ConversationViewFrameApplied } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { IConversationSessionViewLease } from '../../../../platform/universeAgent/common/conversationViewFrame.js';
import type { SyncChrome } from '../../../../platform/universeAgent/common/sessionView/index.js';
import {
	collectConversationTrajectoryTurnIds,
	collectTrajectoryTurnIdsFromSnapshot,
	findTrajectoryRecordIdForTurn,
	projectSnapshotToTrajectory,
} from './conversationTrajectoryModel.js';
import {
	conversationLensDockAddTitle,
	conversationLensDockEngineNotConnected,
	conversationLensDockEditExit,
	conversationLensDockEditingMessage,
	conversationLensDockEditingQueued,
	conversationLensDockMaximizeInput,
	conversationLensDockMicNotAvailable,
	conversationLensDockMicStopTitle,
	conversationLensDockMicTitle,
	conversationLensDockMoreTitle,
	conversationLensDockNoAttachments,
	conversationLensDockNoModel,
	conversationLensPostFailedMailboxFull,
	conversationLensPostFailedNoSession,
	conversationLensPostFailedNotAuthenticated,
	conversationLensDockNoRoute,
	conversationLensDockNoTemplates,
	conversationLensDockNoTools,
	conversationLensDockAgentLabel,
	conversationLensDockNoAgent,
	conversationLensDockStubAgent,
	conversationLensDockRouteLabel,
	conversationLensDockRouteBalanced,
	conversationLensDockRouteQuality,
	conversationLensDockRouteSpeed,
	conversationLensDockPermissionAsk,
	conversationLensDockPermissionLabel,
	conversationLensDockPlaceholder,
	conversationLensDockRestoreTimeline,
	conversationLensDockSaveQueued,
	conversationLensDockTemplatesTitle,
	conversationLensDockTuneTitle,
	conversationLensInputMaximizedClass,
	conversationLensPhasePreFirstClass,
	conversationLensPhasePreFirstDockHiddenClass,
	conversationLensPrefirstHeroClass,
	conversationLensVoiceStubPhraseOne,
	conversationLensVoiceStubPhraseThree,
	conversationLensVoiceStubPhraseTwo,
} from './conversationLensDockStrings.js';
import { conversationLensSessionBarConversationTab, conversationLensSessionBarDeleteSession, conversationLensSessionBarNewSession, conversationLensSessionBarRenameInputAria, conversationLensSessionBarRenameTitle, conversationLensSessionBarRouteLabel, conversationLensSessionBarTrajectoryTab } from './conversationLensSessionBarStrings.js';
import {
	buildSessionUserInputHistory,
	createInputHistoryBrowseState,
	exitInputHistoryBrowse,
	InputHistoryBrowseState,
	InputHistoryDirection,
	navigateInputHistoryBrowse,
} from './conversationInputHistory.js';
import { showConversationPart } from './conversationSessionStatus.js';
import { IConversationRosterService } from './conversationStubService.js';
import { ConversationMermaidExtensionInfo, resolveConversationMermaidExtension } from './conversationMermaidHost.js';
import { ConversationVisualizeOverlay } from './conversationVisualizeOverlay.js';
import { IConversationTimelineRevealService } from './conversationTimelineRevealService.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IExtensionService } from '../../../services/extensions/common/extensions.js';
import { IWebviewService } from '../../webview/browser/webview.js';
import { ConversationVoiceTranscriptBar } from './conversationVoiceTranscriptBar.js';
import { appendVoiceTextToDraft, ConversationVoiceClip } from './conversationVoiceTranscriptModel.js';

const CONVERSATION_LENS_ID_STORAGE_KEY = 'conversation.lensId';

type ConversationLensId = 'conversation' | 'trajectory';
type ComposerPolicy = 'compose' | 'turnEdit' | 'queueEdit';

interface ConversationSessionConfigSelection {
	agentIndex: number;
	routeIndex: number;
}

const COMPOSER_AGENT_OPTIONS = [
	conversationLensDockNoAgent,
	conversationLensDockStubAgent,
] as const;

const COMPOSER_ROUTE_OPTIONS = [
	conversationLensDockNoRoute,
	conversationLensDockRouteBalanced,
	conversationLensDockRouteSpeed,
	conversationLensDockRouteQuality,
] as const;

const STUB_VOICE_TRANSCRIPT_PHRASES = [
	conversationLensVoiceStubPhraseOne,
	conversationLensVoiceStubPhraseTwo,
	conversationLensVoiceStubPhraseThree,
] as const;

/**
 * Product Conversation lens: SessionBar + stub timeline + local dock, mounted
 * into {@link IConversationLensSlots}. Not ChatEditor / ChatViewPane.
 */
export class ConversationLens extends Disposable {

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
	private timelineTree!: ConversationTimelineTree;
	private trajectoryView!: ConversationTrajectory;
	private inboxOverlay!: ConversationInboxOverlay;
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
	private lastAttachedEntries: ConversationTimelineEntry[] = [];

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
	) {
		super();

		this._register(revealService.registerLens(this));
		this._register(this.reviewNavService.onDidChange(() => {
			this.applySessionViewTimeline({ kind: 'patches', changedIds: new Set() }, { sidecarOnly: true });
		}));

		this.slotHosts = slots;
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
		}

		this.lensId = this.loadLensId();
		this.updateLensTabs();
		this.bindSessionView(this.stubService.getActiveSessionId());
		this.updateReadingColumn();
		this.updateSessionTitle();
		this.renderInboxStatus();

		this._register(this.stubService.onDidChangeActiveSession(sessionId => this.applyActiveSession(sessionId)));
		this._register(this.stubService.onDidChangeSession(sessionId => {
			this.refreshSessionSelectOptions();
			if (this.shouldRefreshActiveSessionChrome(sessionId)) {
				if (!this.sessionTitleEditing) {
					this.updateSessionTitle();
				}
				this.renderInboxStatus();
				if (this.lensId === 'trajectory' && sessionId === this.stubService.getActiveSessionId()) {
					this.refreshTrajectoryRecords(sessionId);
				}
			}
		}));
		this._register(this.stubService.onDidChangeEngineConnection(() => this.updateVoiceMicChrome()));

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

	focusDockInput(): void {
		this.dockTextarea?.focus();
	}

	revealTimelineItem(itemId: string): void {
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
		this.setInputMaximized(!this.inputMaximized);
	}

	private updateMaximizeInputButton(): void {
		const title = this.inputMaximized ? conversationLensDockRestoreTimeline : conversationLensDockMaximizeInput;
		this.maximizeInputButton.icon = this.inputMaximized ? Codicon.screenNormal : Codicon.screenFull;
		this.maximizeInputButton.setTitle(title);
		this.maximizeInputButton.setAriaLabel(title);
		this.maximizeInputButton.element.setAttribute('aria-pressed', String(this.inputMaximized));
	}

	private updateSendEnabled(): void {
		const hasDraft = this.dockTextarea.value.trim().length > 0;
		if (this.composerPolicy === 'queueEdit') {
			const item = this.getEditingQueueItem();
			const changed = !!item && this.dockTextarea.value !== item.content;
			this.sendButton.enabled = hasDraft && changed;
			return;
		}
		if (this.composerPolicy === 'turnEdit') {
			this.sendButton.enabled = hasDraft;
			return;
		}
		const hasModel = this.modelSelectedIndex > 0;
		this.sendButton.enabled = hasModel && hasDraft;
	}

	private createComposerSelectBox(options: { text: string }[], selectedIndex: number, ariaLabel: string): SelectBox {
		return new SelectBox(
			options,
			selectedIndex,
			this.contextViewService,
			defaultSelectBoxStyles,
			{
				ariaLabel,
				useCustomDrawn: !hasNativeContextMenu(this.configurationService),
			},
		);
	}

	private createRouteSelectBox(selectedIndex: number, ariaLabel: string): SelectBox {
		return this.createComposerSelectBox(
			COMPOSER_ROUTE_OPTIONS.map(text => ({ text })),
			selectedIndex,
			ariaLabel,
		);
	}

	private getSessionConfig(sessionId: string): ConversationSessionConfigSelection {
		return this.sessionConfigBySessionId.get(sessionId) ?? { agentIndex: 0, routeIndex: 0 };
	}

	private setSessionConfig(sessionId: string, patch: Partial<ConversationSessionConfigSelection>): void {
		const current = this.getSessionConfig(sessionId);
		this.sessionConfigBySessionId.set(sessionId, { ...current, ...patch });
	}

	private syncSessionConfigSelects(sessionId: string): void {
		const { agentIndex, routeIndex } = this.getSessionConfig(sessionId);
		this.agentSelectBox.select(agentIndex);
		this.routeSelectBox.select(routeIndex);
		this.sessionBarRouteSelectBox.select(routeIndex);
	}

	private updateSessionConfigVisibility(preFirst: boolean): void {
		this.agentContainer.hidden = !preFirst;
		this.routeContainer.hidden = !preFirst;
		if (this.sessionBarRouteContainer) {
			this.sessionBarRouteContainer.hidden = preFirst;
		}
	}

	private mountSessionBar(host: HTMLElement): void {
		const bar = append(host, $('.conversation-lens-session-bar'));
		bar.setAttribute('role', 'banner');

		const leading = append(bar, $('.conversation-lens-session-bar-leading'));
		const icon = append(leading, $('span.conversation-lens-session-icon'));
		icon.classList.add(...ThemeIcon.asClassNameArray(Codicon.commentDiscussion));

		this.lensTablist = append(leading, $('.conversation-lens-lens-tabs'));
		this.lensTablist.setAttribute('role', 'tablist');
		this.lensTabConversation = append(this.lensTablist, $('button.conversation-lens-lens-tab')) as HTMLButtonElement;
		this.lensTabConversation.type = 'button';
		this.lensTabConversation.setAttribute('role', 'tab');
		this.lensTabConversation.setAttribute('data-lens-id', 'conversation');
		this.lensTabConversation.textContent = conversationLensSessionBarConversationTab;
		this.lensTabTrajectory = append(this.lensTablist, $('button.conversation-lens-lens-tab')) as HTMLButtonElement;
		this.lensTabTrajectory.type = 'button';
		this.lensTabTrajectory.setAttribute('role', 'tab');
		this.lensTabTrajectory.setAttribute('data-lens-id', 'trajectory');
		this.lensTabTrajectory.textContent = conversationLensSessionBarTrajectoryTab;
		this._register(addDisposableListener(this.lensTabConversation, 'click', () => this.setLensId('conversation')));
		this._register(addDisposableListener(this.lensTabTrajectory, 'click', () => this.setLensId('trajectory')));

		this.sessionSyncBadge = append(leading, $('span.conversation-lens-session-sync-badge'));
		this.sessionSyncBadge.hidden = true;
		this.sessionSyncBadge.setAttribute('aria-live', 'polite');

		const titleWrap = append(leading, $('.conversation-lens-session-title-wrap'));
		this.sessionTitleButton = append(titleWrap, $('button.conversation-lens-session-title')) as HTMLButtonElement;
		this.sessionTitleButton.type = 'button';
		this.sessionTitleButton.title = conversationLensSessionBarRenameTitle;
		this.sessionTitleInput = append(titleWrap, $('input.conversation-lens-session-title-input')) as HTMLInputElement;
		this.sessionTitleInput.type = 'text';
		this.sessionTitleInput.hidden = true;
		this.sessionTitleInput.setAttribute('aria-label', conversationLensSessionBarRenameInputAria);
		this.sessionTitleLive = append(titleWrap, $('span.conversation-lens-session-title-live'));
		this.sessionTitleLive.setAttribute('aria-live', 'polite');
		this.sessionTitleLive.setAttribute('aria-atomic', 'true');
		this._register(addDisposableListener(this.sessionTitleButton, 'click', () => this.beginSessionTitleEdit()));
		this._register(addDisposableListener(this.sessionTitleInput, 'keydown', e => {
			if (e.keyCode === KeyCode.Enter) {
				e.preventDefault();
				this.commitSessionTitleEdit();
			} else if (e.keyCode === KeyCode.Escape) {
				e.preventDefault();
				this.cancelSessionTitleEdit();
			}
		}));
		this._register(addDisposableListener(this.sessionTitleInput, 'blur', () => {
			if (this.sessionTitleEditing) {
				this.commitSessionTitleEdit();
			}
		}));

		const controls = append(bar, $('.conversation-lens-session-controls'));

		this.sessionBarRouteContainer = append(controls, $('.conversation-lens-session-route'));
		const activeSessionId = this.stubService.getActiveSessionId();
		const activeRouteIndex = this.getSessionConfig(activeSessionId).routeIndex;
		this.sessionBarRouteSelectBox = this._register(this.createRouteSelectBox(activeRouteIndex, conversationLensSessionBarRouteLabel));
		this.sessionBarRouteSelectBox.render(this.sessionBarRouteContainer);
		this._register(this.sessionBarRouteSelectBox.onDidSelect(e => {
			const sessionId = this.stubService.getActiveSessionId();
			this.setSessionConfig(sessionId, { routeIndex: e.index });
			this.routeSelectBox.select(e.index);
		}));

		const switcherLabel = append(controls, $('span.conversation-lens-session-switcher-label'));
		switcherLabel.textContent = localize('conversationLens.sessionLabel', "Session");

		this.sessionSelectContainer = append(controls, $('.conversation-lens-session-select'));
		this.sessionSelectBox = this._register(this.createSessionSelectBox());
		this.sessionSelectBox.render(this.sessionSelectContainer);

		const newSessionContainer = append(controls, $('.conversation-lens-session-new'));
		this.newSessionButton = this._register(new Button(newSessionContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: conversationLensSessionBarNewSession,
		}));
		this.newSessionButton.icon = Codicon.add;
		this._register(this.newSessionButton.onDidClick(() => this.createNewSession()));

		const deleteSessionContainer = append(controls, $('.conversation-lens-session-delete'));
		this.deleteSessionButton = this._register(new Button(deleteSessionContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: conversationLensSessionBarDeleteSession,
		}));
		this.deleteSessionButton.icon = Codicon.trash;
		this._register(this.deleteSessionButton.onDidClick(() => this.deleteActiveSession()));

		this._register(this.sessionSelectBox.onDidSelect(e => {
			if (this.suppressSessionSelect) {
				return;
			}
			const session = this.stubService.getSessions()[e.index];
			if (!session) {
				return;
			}
			this.switchToSession(session.id);
		}));
	}

	private createSessionSelectBox(): SelectBox {
		const sessions = this.stubService.getSessions();
		const selectedIndex = Math.max(0, sessions.findIndex(s => s.id === this.stubService.getActiveSessionId()));
		return new SelectBox(
			sessions.map(s => ({ text: s.title })),
			selectedIndex,
			this.contextViewService,
			defaultSelectBoxStyles,
			{
				ariaLabel: localize('conversationLens.sessionSwitcher', "Switch session"),
				useCustomDrawn: !hasNativeContextMenu(this.configurationService),
			},
		);
	}

	private refreshSessionSelectOptions(): void {
		const sessions = this.stubService.getSessions();
		const selectedIndex = Math.max(0, sessions.findIndex(s => s.id === this.stubService.getActiveSessionId()));
		this.suppressSessionSelect = true;
		this.sessionSelectBox.setOptions(sessions.map(s => ({ text: s.title })), selectedIndex);
		this.suppressSessionSelect = false;
	}

	private shouldRefreshActiveSessionChrome(sessionId: string): boolean {
		const activeId = this.stubService.getActiveSessionId();
		if (sessionId === activeId) {
			return true;
		}
		return !this.stubService.getSessions().some(session => session.id === sessionId);
	}

	private mountTimeline(host: HTMLElement): void {
		this.readingColumn = append(host, $('.conversation-lens-reading-column'));
		this.identityStrip = this._register(this.instantiationService.createInstance(ConversationIdentityStrip, this.readingColumn));
		this.prefirstHero = append(this.readingColumn, $(`.${conversationLensPrefirstHeroClass}`));
		this.prefirstHero.hidden = true;
		this.timelineTree = this._register(this.instantiationService.createInstance(ConversationTimelineTree, this.readingColumn, {
			onResolveConfirmation: (turnId, status) => this.resolveConfirmation(turnId, status),
			onCopyTurn: (_turnId, text) => this.copyTurn(text),
			onDeleteTurn: turnId => this.deleteTurn(turnId),
			onEditUserTurn: turnId => this.beginTurnEdit(turnId),
			onViewInTrajectory: turnId => this.navigateToTrajectoryFromTurn(turnId),
			onReviewNavClick: paths => {
				void this.commandService.executeCommand(
					SOURCES_REVIEW_SHOW_FOR_PATHS_COMMAND,
					paths.map(path => URI.parse(path)),
				);
			},
			onOpenVisualizeFullscreen: (source, title) => this.openVisualizeOverlay(source, title),
		}));
		this.trajectoryView = this._register(this.instantiationService.createInstance(ConversationTrajectory, this.readingColumn, {
			onNavigateToLinkedTurn: turnId => this.navigateToTurnFromTrajectory(turnId),
		}));
	}

	private mountDock(host: HTMLElement): void {
		this.dockRoot = append(host, $('.conversation-lens-dock'));

		this.gateRow = append(this.dockRoot, $('.conversation-lens-dock-gate-row'));
		this.gateRow.setAttribute('role', 'status');
		this.gateRow.setAttribute('aria-label', conversationLensDockEngineNotConnected);
		this.gateLabel = append(this.gateRow, $('span.conversation-lens-dock-gate-label'));
		this.gateLabel.textContent = conversationLensDockEngineNotConnected;

		this.inboxOverlay = this._register(this.instantiationService.createInstance(ConversationInboxOverlay, this.dockRoot, {
			onQueueItemHold: itemId => this.beginQueueEdit(itemId),
			onScrollToPendingConfirmation: () => this.scrollToFirstPendingConfirmation(),
		}));

		this.composerCluster = append(this.dockRoot, $('.conversation-lens-composer-cluster'));
		this.voiceTranscriptBar = this._register(new ConversationVoiceTranscriptBar(this.composerCluster));
		this.composer = append(this.composerCluster, $('.conversation-lens-composer'));
		this.composerEditHeader = append(this.composer, $('.conversation-lens-composer-edit-header'));
		this.composerEditHeader.hidden = true;
		this.composerEditTitle = append(this.composerEditHeader, $('span.conversation-lens-composer-edit-title'));
		const exitContainer = append(this.composerEditHeader, $('.conversation-lens-composer-edit-exit'));
		this.composerExitButton = this._register(new Button(exitContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			title: conversationLensDockEditExit,
		}));
		this.composerExitButton.icon = Codicon.close;
		this.composerExitButton.element.classList.add('conversation-lens-dock-control', 'conversation-lens-dock-control--ghost');
		this._register(this.composerExitButton.onDidClick(() => this.exitComposerEdit()));
		const inputRow = append(this.composer, $('.conversation-lens-dock-input-row'));

		this.dockTextarea = append(inputRow, $('textarea.conversation-lens-dock-input')) as HTMLTextAreaElement;
		this.dockTextarea.setAttribute('aria-label', localize('conversationLens.dockInput', "Message"));
		this.dockTextarea.placeholder = conversationLensDockPlaceholder;
		this.dockTextarea.rows = 1;

		const bottomBar = append(this.composer, $('.conversation-lens-dock-bottom-bar'));
		const bottomLeading = append(bottomBar, $('.conversation-lens-dock-bottom-leading'));

		const addContainer = append(bottomLeading, $('.conversation-lens-dock-add'));
		this.addButton = this._register(new Button(addContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			title: conversationLensDockAddTitle,
		}));
		this.addButton.icon = Codicon.add;
		this.addButton.element.classList.add('conversation-lens-dock-control', 'conversation-lens-dock-control--soft');
		this._register(this.addButton.onDidClick(() => this.toggleAddContextView()));

		const tuneContainer = append(bottomLeading, $('.conversation-lens-dock-tune'));
		this.tuneButton = this._register(new Button(tuneContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			title: conversationLensDockTuneTitle,
		}));
		this.tuneButton.icon = Codicon.settingsGear;
		this.tuneButton.element.classList.add('conversation-lens-dock-control', 'conversation-lens-dock-control--ghost');
		this._register(this.tuneButton.onDidClick(() => this.toggleTuneContextView()));

		const permissionContainer = append(bottomLeading, $('.conversation-lens-dock-permission'));
		this.permissionSelectBox = this._register(this.createComposerSelectBox(
			[{ text: conversationLensDockPermissionAsk }],
			0,
			conversationLensDockPermissionLabel,
		));
		this.permissionSelectBox.render(permissionContainer);

		this.agentContainer = append(bottomLeading, $('.conversation-lens-dock-agent'));
		this.agentSelectBox = this._register(this.createComposerSelectBox(
			COMPOSER_AGENT_OPTIONS.map(text => ({ text })),
			this.getSessionConfig(this.stubService.getActiveSessionId()).agentIndex,
			conversationLensDockAgentLabel,
		));
		this.agentSelectBox.render(this.agentContainer);
		this._register(this.agentSelectBox.onDidSelect(e => {
			this.setSessionConfig(this.stubService.getActiveSessionId(), { agentIndex: e.index });
		}));

		this.routeContainer = append(bottomLeading, $('.conversation-lens-dock-route'));
		this.routeSelectBox = this._register(this.createRouteSelectBox(
			this.getSessionConfig(this.stubService.getActiveSessionId()).routeIndex,
			conversationLensDockRouteLabel,
		));
		this.routeSelectBox.render(this.routeContainer);
		this._register(this.routeSelectBox.onDidSelect(e => {
			const sessionId = this.stubService.getActiveSessionId();
			this.setSessionConfig(sessionId, { routeIndex: e.index });
			this.sessionBarRouteSelectBox.select(e.index);
		}));

		const moreContainer = append(bottomLeading, $('.conversation-lens-dock-more'));
		this.moreButton = this._register(new Button(moreContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			title: conversationLensDockMoreTitle,
		}));
		this.moreButton.icon = Codicon.ellipsis;
		this.moreButton.element.classList.add('conversation-lens-dock-control', 'conversation-lens-dock-control--ghost');
		this._register(this.moreButton.onDidClick(() => this.toggleMoreContextView()));

		const bottomTrailing = append(bottomBar, $('.conversation-lens-dock-bottom-trailing'));

		const modelContainer = append(bottomTrailing, $('.conversation-lens-dock-model'));
		this.modelSelectBox = this._register(this.createComposerSelectBox(
			[
				{ text: conversationLensDockNoModel },
				{ text: localize('conversationLens.dockStubModel', "Stub model") },
			],
			0,
			localize('conversationLens.dockModelLabel', "Model"),
		));
		this.modelSelectBox.render(modelContainer);
		this._register(this.modelSelectBox.onDidSelect(e => {
			this.modelSelectedIndex = e.index;
			this.updateSendEnabled();
		}));

		const templatesContainer = append(bottomTrailing, $('.conversation-lens-dock-templates'));
		this.templatesButton = this._register(new Button(templatesContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			title: conversationLensDockTemplatesTitle,
		}));
		this.templatesButton.icon = Codicon.notebookTemplate;
		this.templatesButton.element.classList.add('conversation-lens-dock-control', 'conversation-lens-dock-control--ghost');
		this._register(this.templatesButton.onDidClick(() => this.toggleTemplatesContextView()));

		const maximizeInputContainer = append(bottomTrailing, $('.conversation-lens-dock-maximize-input'));
		this.maximizeInputButton = this._register(new Button(maximizeInputContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			title: conversationLensDockMaximizeInput,
		}));
		this.maximizeInputButton.element.classList.add('conversation-lens-dock-control', 'conversation-lens-dock-control--ghost', 'conversation-lens-dock-maximize-input-button');
		this.maximizeInputButton.element.setAttribute('aria-pressed', 'false');
		this.updateMaximizeInputButton();
		this._register(this.maximizeInputButton.onDidClick(() => this.toggleInputMaximized()));

		const micContainer = append(bottomTrailing, $('.conversation-lens-dock-mic'));
		this.micButton = this._register(new Button(micContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			disabled: true,
			title: `${conversationLensDockMicTitle} — ${conversationLensDockMicNotAvailable}`,
		}));
		this.micButton.icon = Codicon.mic;
		this.micButton.element.classList.add('conversation-lens-dock-control', 'conversation-lens-dock-control--ghost', 'conversation-lens-dock-control--mic');
		this._register(this.micButton.onDidClick(() => this.toggleVoiceRecording()));

		const sendContainer = append(bottomTrailing, $('.conversation-lens-dock-send'));
		this.sendButton = this._register(new Button(sendContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			title: localize('conversationLens.send', "Send"),
		}));
		this.sendButton.icon = Codicon.arrowUp;
		this.sendButton.element.classList.add('conversation-lens-dock-control', 'conversation-lens-dock-control--filled', 'conversation-lens-dock-send-button');
		this.sendButton.enabled = false;

		this._register(addDisposableListener(this.dockTextarea, 'keydown', e => {
			if (e.keyCode === KeyCode.Escape && this.composerPolicy !== 'compose') {
				e.preventDefault();
				this.exitComposerEdit();
				return;
			}
			if (e.keyCode === KeyCode.UpArrow) {
				if (this.navigateInputHistory('older')) {
					e.preventDefault();
				}
				return;
			}
			if (e.keyCode === KeyCode.DownArrow) {
				if (this.navigateInputHistory('newer')) {
					e.preventDefault();
				}
				return;
			}
			if (e.keyCode === KeyCode.Escape && this.inputHistoryBrowse.browseIndex >= 0) {
				e.preventDefault();
				this.exitInputHistoryBrowse();
				return;
			}
			if (e.keyCode === KeyCode.Enter && !e.shiftKey) {
				e.preventDefault();
				this.submitDraft();
			}
		}));
		this._register(this.sendButton.onDidClick(() => this.submitDraft()));
		this._register(addDisposableListener(this.dockTextarea, 'input', () => {
			if (this.inputHistoryBrowse.browseIndex >= 0) {
				this.inputHistoryBrowse = createInputHistoryBrowseState();
			}
			this.drafts.set(this.stubService.getActiveSessionId(), this.dockTextarea.value);
			this.updateSendEnabled();
		}));

		this.updateConversationPhase();
		this.updateVoiceMicChrome();
	}

	private toggleAddContextView(): void {
		if (this.addContextView) {
			this.addContextView.close();
			return;
		}
		this.addContextView = this.contextViewService.showContextView({
			getAnchor: () => this.addButton.element,
			anchorAlignment: AnchorAlignment.RIGHT,
			anchorPosition: AnchorPosition.ABOVE,
			render: container => {
				append(container, $('.conversation-lens-dock-add-popup')).textContent = conversationLensDockNoAttachments;
				return toDisposable(() => {
					this.addContextView = undefined;
				});
			},
			onDOMEvent: e => {
				if (e.type === 'click') {
					const target = e.target as HTMLElement | null;
					if (target && !this.addButton.element.contains(target)) {
						this.addContextView?.close();
					}
				}
			},
			onHide: () => {
				this.addContextView = undefined;
			},
		});
	}

	private toggleTuneContextView(): void {
		if (this.tuneContextView) {
			this.tuneContextView.close();
			return;
		}
		this.tuneContextView = this.contextViewService.showContextView({
			getAnchor: () => this.tuneButton.element,
			anchorAlignment: AnchorAlignment.RIGHT,
			anchorPosition: AnchorPosition.ABOVE,
			render: container => {
				append(container, $('.conversation-lens-dock-tune-popup')).textContent = conversationLensDockNoTools;
				return toDisposable(() => {
					this.tuneContextView = undefined;
				});
			},
			onDOMEvent: e => {
				if (e.type === 'click') {
					const target = e.target as HTMLElement | null;
					if (target && !this.tuneButton.element.contains(target)) {
						this.tuneContextView?.close();
					}
				}
			},
			onHide: () => {
				this.tuneContextView = undefined;
			},
		});
	}

	private toggleMoreContextView(): void {
		if (this.moreContextView) {
			this.moreContextView.close();
			return;
		}
		this.moreContextView = this.contextViewService.showContextView({
			getAnchor: () => this.moreButton.element,
			anchorAlignment: AnchorAlignment.RIGHT,
			anchorPosition: AnchorPosition.ABOVE,
			render: container => {
				const popup = append(container, $('.conversation-lens-dock-more-popup'));
				append(popup, $('div')).textContent = localize('conversationLens.dockMoreDisplay', "Display");
				append(popup, $('div')).textContent = localize('conversationLens.dockMorePin', "Pin input");
				return toDisposable(() => {
					this.moreContextView = undefined;
				});
			},
			onDOMEvent: e => {
				if (e.type === 'click') {
					const target = e.target as HTMLElement | null;
					if (target && !this.moreButton.element.contains(target)) {
						this.moreContextView?.close();
					}
				}
			},
			onHide: () => {
				this.moreContextView = undefined;
			},
		});
	}

	private toggleTemplatesContextView(): void {
		if (this.templatesContextView) {
			this.templatesContextView.close();
			return;
		}
		this.templatesContextView = this.contextViewService.showContextView({
			getAnchor: () => this.templatesButton.element,
			anchorAlignment: AnchorAlignment.RIGHT,
			anchorPosition: AnchorPosition.ABOVE,
			render: container => {
				append(container, $('.conversation-lens-dock-templates-popup')).textContent = conversationLensDockNoTemplates;
				return toDisposable(() => {
					this.templatesContextView = undefined;
				});
			},
			onDOMEvent: e => {
				if (e.type === 'click') {
					const target = e.target as HTMLElement | null;
					if (target && !this.templatesButton.element.contains(target)) {
						this.templatesContextView?.close();
					}
				}
			},
			onHide: () => {
				this.templatesContextView = undefined;
			},
		});
	}

	private isPreFirst(): boolean {
		return this.stubService.getTurns(this.stubService.getActiveSessionId()).length === 0;
	}

	private updateConversationPhase(): void {
		const preFirst = this.isPreFirst();
		if (preFirst && this.composerPolicy !== 'compose') {
			this.exitComposerEdit();
		}
		const nextPhase = preFirst ? 'prefirst' : 'active';
		if (this.conversationPhase === nextPhase) {
			return;
		}
		this.conversationPhase = nextPhase;

		this.readingColumn.classList.toggle(conversationLensPhasePreFirstClass, preFirst);
		this.slotHosts.dock.classList.toggle(conversationLensPhasePreFirstDockHiddenClass, preFirst);
		this.prefirstHero.hidden = !preFirst;
		this.updateSessionConfigVisibility(preFirst);

		if (preFirst) {
			this.prefirstHero.appendChild(this.identityStrip.element);
			this.prefirstHero.appendChild(this.gateRow);
			this.inboxOverlay.element.hidden = true;
		} else {
			this.readingColumn.insertBefore(this.identityStrip.element, this.readingColumn.firstChild);
			this.dockRoot.insertBefore(this.gateRow, this.inboxOverlay.element);
			this.inboxOverlay.element.hidden = false;
			this.gateRow.hidden = false;
		}
		this.syncComposerPlacement();
	}

	private beginTurnEdit(turnId: string): void {
		if (this.isPreFirst()) {
			return;
		}
		const sessionId = this.stubService.getActiveSessionId();
		const turn = this.stubService.getTurns(sessionId).find(t => t.id === turnId && t.kind === 'user');
		if (!turn) {
			return;
		}
		this.exitComposerEdit(false);
		this.inboxOverlay.closeListPanel();
		this.composeDraftSnapshot = this.dockTextarea.value;
		this.composerPolicy = 'turnEdit';
		this.editingTurnId = turnId;
		this.editingQueueItemId = undefined;
		this.dockTextarea.value = turn.text;
		this.timelineTree.setEditingTurnId(turnId);
		this.syncComposerPlacement();
		this.updateComposerEditChrome();
		this.updateSendEnabled();
		this.renderVoiceTranscriptBar();
		this.updateVoiceMicChrome();
		this.dockTextarea.focus();
	}

	private beginQueueEdit(itemId: string): void {
		const sessionId = this.stubService.getActiveSessionId();
		const item = this.stubService.getMessageQueueState(sessionId).items.find(row => row.id === itemId);
		if (!item) {
			return;
		}
		this.exitComposerEdit(false);
		this.inboxOverlay.closeListPanel();
		this.composeDraftSnapshot = this.dockTextarea.value;
		this.composerPolicy = 'queueEdit';
		this.editingQueueItemId = itemId;
		this.editingTurnId = undefined;
		this.timelineTree.setEditingTurnId(undefined);
		this.dockTextarea.value = item.content;
		this.syncComposerPlacement();
		this.updateComposerEditChrome();
		this.updateSendEnabled();
		this.renderVoiceTranscriptBar();
		this.updateVoiceMicChrome();
		this.dockTextarea.focus();
	}

	private exitComposerEdit(restoreComposeDraft = true, releaseQueueHold = true): void {
		if (this.composerPolicy === 'compose') {
			return;
		}
		const sessionId = this.stubService.getActiveSessionId();
		if (this.composerPolicy === 'queueEdit' && this.editingQueueItemId && releaseQueueHold) {
			this.stubService.releaseMessageQueueItemHold(sessionId, this.editingQueueItemId);
			this.renderInboxStatus();
		}
		this.composerPolicy = 'compose';
		this.editingTurnId = undefined;
		this.editingQueueItemId = undefined;
		this.timelineTree.setEditingTurnId(undefined);
		this.dockTextarea.value = restoreComposeDraft
			? (this.composeDraftSnapshot || this.drafts.get(sessionId) || '')
			: '';
		this.composeDraftSnapshot = '';
		this.syncComposerPlacement();
		this.updateComposerEditChrome();
		this.updateSendEnabled();
		this.renderVoiceTranscriptBar();
		this.updateVoiceMicChrome();
	}

	private getVoiceClips(sessionId: string): readonly ConversationVoiceClip[] {
		return this.voiceClipsBySessionId.get(sessionId) ?? [];
	}

	private setVoiceClips(sessionId: string, clips: readonly ConversationVoiceClip[]): void {
		if (clips.length === 0) {
			this.voiceClipsBySessionId.delete(sessionId);
		} else {
			this.voiceClipsBySessionId.set(sessionId, [...clips]);
		}
		this.renderVoiceTranscriptBar();
		this.updateVoiceMicChrome();
	}

	private renderVoiceTranscriptBar(): void {
		const composeMode = this.composerPolicy === 'compose';
		this.voiceTranscriptBar.setComposerVisible(composeMode);
		this.voiceTranscriptBar.render(this.getVoiceClips(this.stubService.getActiveSessionId()));
	}

	private updateVoiceMicChrome(): void {
		const engineConnected = this.stubService.isEngineConnected();
		const recording = this.getVoiceClips(this.stubService.getActiveSessionId())
			.some(clip => clip.status === 'recording');

		if (!engineConnected || this.composerPolicy !== 'compose') {
			this.micButton.enabled = false;
			this.micButton.element.classList.remove('conversation-lens-dock-control--filled');
			this.micButton.element.classList.add('conversation-lens-dock-control--ghost');
			const title = engineConnected
				? conversationLensDockMicTitle
				: `${conversationLensDockMicTitle} — ${conversationLensDockMicNotAvailable}`;
			this.micButton.setTitle(title);
			this.micButton.setAriaLabel(title);
			return;
		}

		this.micButton.enabled = true;
		if (recording) {
			this.micButton.element.classList.remove('conversation-lens-dock-control--ghost');
			this.micButton.element.classList.add('conversation-lens-dock-control--filled');
			this.micButton.setTitle(conversationLensDockMicStopTitle);
			this.micButton.setAriaLabel(conversationLensDockMicStopTitle);
			return;
		}

		this.micButton.element.classList.remove('conversation-lens-dock-control--filled');
		this.micButton.element.classList.add('conversation-lens-dock-control--ghost');
		this.micButton.setTitle(conversationLensDockMicTitle);
		this.micButton.setAriaLabel(conversationLensDockMicTitle);
	}

	private toggleVoiceRecording(): void {
		if (!this.stubService.isEngineConnected() || this.composerPolicy !== 'compose') {
			return;
		}
		const sessionId = this.stubService.getActiveSessionId();
		const clips = [...this.getVoiceClips(sessionId)];
		const recording = clips.find(clip => clip.status === 'recording');
		if (recording) {
			this.finishVoiceClip(sessionId, recording.id);
			return;
		}
		const clip: ConversationVoiceClip = {
			id: `voice-${++this.nextVoiceClipId}`,
			status: 'recording',
			durationLabel: '0:01',
		};
		this.setVoiceClips(sessionId, [...clips, clip]);
	}

	private finishVoiceClip(sessionId: string, clipId: string): void {
		const clips = this.getVoiceClips(sessionId).map(clip =>
			clip.id === clipId ? { ...clip, status: 'transcribing' as const } : clip);
		this.setVoiceClips(sessionId, clips);

		const phraseIndex = this.voicePhraseIndexBySessionId.get(sessionId) ?? 0;
		const phrase = STUB_VOICE_TRANSCRIPT_PHRASES[phraseIndex % STUB_VOICE_TRANSCRIPT_PHRASES.length];
		this.voicePhraseIndexBySessionId.set(sessionId, phraseIndex + 1);

		const existingTimeout = this.voiceTranscriptTimeouts.get(clipId);
		if (existingTimeout !== undefined) {
			clearTimeout(existingTimeout);
		}
		const timeout = setTimeout(() => {
			this.voiceTranscriptTimeouts.delete(clipId);
			const remaining = this.getVoiceClips(sessionId).filter(clip => clip.id !== clipId);
			this.setVoiceClips(sessionId, remaining);
			const draft = this.stubService.getActiveSessionId() === sessionId && this.composerPolicy === 'compose'
				? this.dockTextarea.value
				: (this.drafts.get(sessionId) ?? '');
			const nextDraft = appendVoiceTextToDraft(draft, phrase);
			this.drafts.set(sessionId, nextDraft);
			if (this.stubService.getActiveSessionId() === sessionId && this.composerPolicy === 'compose') {
				this.dockTextarea.value = nextDraft;
				this.updateSendEnabled();
			}
		}, 30);
		this.voiceTranscriptTimeouts.set(clipId, timeout);
	}

	private getEditingQueueItem() {
		if (!this.editingQueueItemId) {
			return undefined;
		}
		return this.stubService.getMessageQueueState(this.stubService.getActiveSessionId())
			.items.find(item => item.id === this.editingQueueItemId);
	}

	private updateComposerEditChrome(): void {
		const isEdit = this.composerPolicy !== 'compose';
		this.composerEditHeader.hidden = !isEdit;
		this.composer.classList.toggle('conversation-lens-composer--edit', isEdit);
		if (this.composerPolicy === 'queueEdit') {
			const item = this.getEditingQueueItem();
			this.composerEditTitle.textContent = item
				? `${conversationLensDockEditingQueued} · ${item.content}`
				: conversationLensDockEditingQueued;
			this.sendButton.setTitle(conversationLensDockSaveQueued);
			this.sendButton.setAriaLabel(conversationLensDockSaveQueued);
			return;
		}
		if (this.composerPolicy === 'turnEdit') {
			this.composerEditTitle.textContent = conversationLensDockEditingMessage;
		}
		const sendTitle = localize('conversationLens.send', "Send");
		this.sendButton.setTitle(sendTitle);
		this.sendButton.setAriaLabel(sendTitle);
	}

	private syncComposerPlacement(): void {
		if (this.composerPolicy === 'turnEdit' && this.editingTurnId) {
			this.ensureComposerInCluster();
			this.renderVoiceTranscriptBar();
			const host = this.timelineTree.getTurnEditHost(this.editingTurnId);
			if (host) {
				if (this.composer.parentElement !== host) {
					host.appendChild(this.composer);
				}
				return;
			}
			getWindow(this.composer).requestAnimationFrame(() => this.syncComposerPlacement());
			return;
		}

		this.ensureComposerInCluster();
		this.renderVoiceTranscriptBar();

		if (this.isPreFirst()) {
			if (this.composerCluster.parentElement !== this.prefirstHero) {
				this.prefirstHero.appendChild(this.composerCluster);
			}
			return;
		}

		if (this.composerCluster.parentElement !== this.dockRoot) {
			this.dockRoot.appendChild(this.composerCluster);
		}
	}

	private ensureComposerInCluster(): void {
		if (this.composer.parentElement !== this.composerCluster) {
			this.composerCluster.appendChild(this.composer);
		}
	}

	private switchToSession(sessionId: string): void {
		const previousId = this.stubService.getActiveSessionId();
		if (previousId !== sessionId) {
			this.visualizeOverlay.close();
			this.drafts.set(previousId, this.dockTextarea.value);
			this.stubService.switchSession(sessionId);
		}
		this.instantiationService.invokeFunction(showConversationPart);
	}

	private openVisualizeOverlay(source: string, title?: string): void {
		this.visualizeOverlay.open({
			source,
			title,
			extensionInfo: this.mermaidExtensionInfo,
			targetWindow: getWindow(this.slotHosts.timeline),
			webviewService: this.webviewService,
		});
	}

	private loadLensId(): ConversationLensId {
		const stored = this.storageService.get(CONVERSATION_LENS_ID_STORAGE_KEY, StorageScope.WORKSPACE);
		if (stored === 'conversation' || stored === 'trajectory') {
			return stored;
		}
		return 'conversation';
	}

	private setLensId(lensId: ConversationLensId): void {
		if (this.lensId === lensId) {
			return;
		}
		this.lensId = lensId;
		this.storageService.store(CONVERSATION_LENS_ID_STORAGE_KEY, lensId, StorageScope.WORKSPACE, StorageTarget.MACHINE);
		this.updateLensTabs();
		this.updateReadingColumn();
	}

	private updateLensTabs(): void {
		const isConversation = this.lensId === 'conversation';
		this.lensTabConversation.setAttribute('aria-selected', String(isConversation));
		this.lensTabTrajectory.setAttribute('aria-selected', String(!isConversation));
		this.lensTabConversation.tabIndex = isConversation ? 0 : -1;
		this.lensTabTrajectory.tabIndex = isConversation ? -1 : 0;
	}

	private updateReadingColumn(): void {
		const sessionId = this.stubService.getActiveSessionId();
		if (this.lensId === 'trajectory') {
			this.timelineTree.hide();
			this.refreshTrajectoryRecords(sessionId);
			this.trajectoryView.show();
		} else {
			this.trajectoryView.hide();
			this.timelineTree.show();
		}
	}

	private refreshTrajectoryRecords(sessionId: string): void {
		const engineConnected = this.stubService.isEngineConnected();
		const lease = this.sessionViewLease?.sessionId === sessionId ? this.sessionViewLease : undefined;

		if (engineConnected && lease) {
			this.trajectoryView.setRecords(
				projectSnapshotToTrajectory(lease.snapshot, lease.attribution, lease.details),
				collectTrajectoryTurnIdsFromSnapshot(lease.snapshot),
			);
			return;
		}

		const turns = this.stubService.getTurns(sessionId);
		this.trajectoryView.setRecords(
			this.stubService.getTrajectoryRecords(sessionId),
			collectConversationTrajectoryTurnIds(turns),
		);
	}

	private navigateToTurnFromTrajectory(turnId: string): void {
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
		this.timelineTree.revealTurn(turnId);
	}

	private navigateToTrajectoryFromTurn(turnId: string): void {
		const sessionId = this.stubService.getActiveSessionId();
		const records = this.stubService.getTrajectoryRecords(sessionId);
		const recordId = findTrajectoryRecordIdForTurn(turnId, records);
		if (!recordId) {
			return;
		}
		if (this.lensId !== 'trajectory') {
			this.lensId = 'trajectory';
			this.storageService.store(CONVERSATION_LENS_ID_STORAGE_KEY, 'trajectory', StorageScope.WORKSPACE, StorageTarget.MACHINE);
			this.updateLensTabs();
			this.timelineTree.hide();
			this.refreshTrajectoryRecords(sessionId);
			this.trajectoryView.show();
		}
		this.trajectoryView.revealRecord(recordId);
	}

	private createNewSession(): void {
		this.drafts.set(this.stubService.getActiveSessionId(), this.dockTextarea.value);
		this.stubService.createSession();
	}

	private deleteActiveSession(): void {
		const sessionId = this.stubService.getActiveSessionId();
		this.drafts.delete(sessionId);
		this.stubService.deleteSession(sessionId);
	}

	private applyActiveSession(sessionId: string): void {
		this.visualizeOverlay.close();
		this.exitComposerEdit();
		this.resetInputHistoryBrowse();
		this.refreshSessionSelectOptions();
		this.syncSessionConfigSelects(sessionId);
		this.updateSessionTitle();
		this.dockTextarea.value = this.drafts.get(sessionId) ?? '';
		this.bindSessionView(sessionId);
		this.renderInboxStatus();
		this.renderVoiceTranscriptBar();
		this.updateVoiceMicChrome();
	}

	private bindSessionView(sessionId: string): void {
		this.sessionViewLifetime.clear();
		const lease = this.sessionViewLifetime.add(this.stubService.acquireSessionView(sessionId));
		this.sessionViewLease = lease;
		const coalescer = this.sessionViewLifetime.add(new ConversationSessionViewFrameCoalescer(applied => this.applySessionViewTimeline(applied)));
		this.sessionViewLifetime.add(lease.onDidApplyFrame(applied => coalescer.push(applied)));
		// Baseline fires during lease construction, before the listener above is attached.
		this.applySessionViewTimeline({ kind: 'baseline' });
	}

	private applySessionViewTimeline(
		applied: ConversationViewFrameApplied,
		options?: { readonly sidecarOnly?: boolean },
	): void {
		if (!this.sessionViewLease) {
			return;
		}
		const baseEntries = projectSnapshotToEntries(
			this.sessionViewLease.snapshot,
			this.sessionViewLease.attribution,
			this.sessionViewLease.details,
		);
		const reviewNav = this.reviewNavService.getReviewNavForSession(this.sessionViewLease.sessionId);
		const entries = attachReviewEntries(baseEntries, this.sessionViewLease.snapshot, reviewNav);

		let effectiveApplied = applied;
		if (options?.sidecarOnly) {
			effectiveApplied = computeReviewNavSidecarApplied(this.lastAttachedEntries, entries);
			if (effectiveApplied.kind === 'patches' && effectiveApplied.changedIds.size === 0) {
				this.lastAttachedEntries = entries;
				return;
			}
		}

		this.lastAttachedEntries = entries;
		this.timelineTree.applyEntries(entries, effectiveApplied);
		if (this.lensId === 'trajectory') {
			this.refreshTrajectoryRecords(this.sessionViewLease.sessionId);
		}
		this.updateSyncChrome(this.sessionViewLease.snapshot.sync);
		this.updateConversationPhase();
		this.syncComposerPlacement();
	}

	private updateSyncChrome(sync: SyncChrome): void {
		const label = formatSyncChromeLabel(sync);
		if (this.sessionSyncBadge) {
			if (label) {
				this.sessionSyncBadge.hidden = false;
				this.sessionSyncBadge.textContent = label;
				this.sessionSyncBadge.setAttribute('aria-label', label);
			} else {
				this.sessionSyncBadge.hidden = true;
				this.sessionSyncBadge.textContent = '';
				this.sessionSyncBadge.removeAttribute('aria-label');
			}
		}
		this.renderInboxStatus();
	}

	private showPostFailure(reason: 'mailbox_full' | 'no_such_session' | 'not_authenticated'): void {
		const message = reason === 'mailbox_full'
			? conversationLensPostFailedMailboxFull
			: reason === 'not_authenticated'
				? conversationLensPostFailedNotAuthenticated
				: conversationLensPostFailedNoSession;
		this.gateRow.hidden = false;
		this.gateLabel.textContent = message;
		this.gateRow.setAttribute('aria-label', message);
		if (this.sendFailureTimeout) {
			clearTimeout(this.sendFailureTimeout);
		}
		this.sendFailureTimeout = setTimeout(() => {
			this.sendFailureTimeout = undefined;
			this.gateLabel.textContent = conversationLensDockEngineNotConnected;
			this.gateRow.setAttribute('aria-label', conversationLensDockEngineNotConnected);
		}, 4000);
	}

	private updateSessionTitle(): void {
		const title = this.stubService.getActiveSession().title;
		this.sessionTitleButton.textContent = title;
		this.sessionTitleLive.textContent = title;
	}

	private beginSessionTitleEdit(): void {
		if (this.sessionTitleEditing) {
			return;
		}
		this.sessionTitleEditing = true;
		this.sessionTitleEditSnapshot = this.stubService.getActiveSession().title;
		this.sessionTitleInput.value = this.sessionTitleEditSnapshot;
		this.sessionTitleButton.hidden = true;
		this.sessionTitleInput.hidden = false;
		this.sessionTitleInput.focus();
		this.sessionTitleInput.select();
	}

	private cancelSessionTitleEdit(): void {
		if (!this.sessionTitleEditing) {
			return;
		}
		this.sessionTitleEditing = false;
		this.sessionTitleInput.value = this.sessionTitleEditSnapshot;
		this.sessionTitleInput.hidden = true;
		this.sessionTitleButton.hidden = false;
		this.updateSessionTitle();
	}

	private commitSessionTitleEdit(): void {
		if (!this.sessionTitleEditing) {
			return;
		}
		const sessionId = this.stubService.getActiveSessionId();
		const trimmed = this.sessionTitleInput.value.trim();

		this.sessionTitleEditing = false;
		this.sessionTitleInput.hidden = true;
		this.sessionTitleButton.hidden = false;

		if (!trimmed) {
			this.updateSessionTitle();
			return;
		}

		this.stubService.renameSession(sessionId, trimmed);
		this.updateSessionTitle();
		this.refreshSessionSelectOptions();
	}

	private renderInboxStatus(): void {
		this.inboxOverlay.render();
	}

	private scrollToFirstPendingConfirmation(): void {
		if (this.lensId === 'trajectory') {
			this.setLensId('conversation');
		}
		if (this.inputMaximized) {
			this.setInputMaximized(false);
		}
		const pending = this.stubService.getTurns(this.stubService.getActiveSessionId())
			.find(t => t.kind === 'confirmation' && t.status === 'pending');
		if (!pending) {
			return;
		}
		const seat = this.timelineTree.getConfirmationElement(pending.id);
		seat?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}

	private resolveConfirmation(turnId: string, status: 'allowed' | 'skipped'): void {
		const outcome = this.sessionViewLease?.post({
			kind: 'permissionRespond',
			requestId: turnId,
			decision: status === 'allowed' ? 'allow' : 'deny',
		});
		if (outcome && !outcome.accepted) {
			this.showPostFailure(outcome.reason);
		}
	}

	private copyTurn(text: string): void {
		this.clipboardService.writeText(text);
	}

	private deleteTurn(turnId: string): void {
		this.stubService.deleteTurn(this.stubService.getActiveSessionId(), turnId);
	}

	private resetInputHistoryBrowse(): void {
		this.inputHistoryBrowse = createInputHistoryBrowseState();
	}

	private getSessionInputHistory(): readonly string[] {
		return buildSessionUserInputHistory(this.stubService.getTurns(this.stubService.getActiveSessionId()));
	}

	private navigateInputHistory(direction: InputHistoryDirection): boolean {
		const result = navigateInputHistoryBrowse(
			this.getSessionInputHistory(),
			this.inputHistoryBrowse,
			direction,
			this.dockTextarea.value,
		);
		if (!result.handled || result.textareaValue === undefined) {
			return result.handled;
		}
		this.inputHistoryBrowse = result.state;
		this.dockTextarea.value = result.textareaValue;
		this.drafts.set(this.stubService.getActiveSessionId(), result.textareaValue);
		return true;
	}

	private exitInputHistoryBrowse(): void {
		const result = exitInputHistoryBrowse(this.inputHistoryBrowse);
		if (!result.handled || result.textareaValue === undefined) {
			return;
		}
		this.inputHistoryBrowse = result.state;
		this.dockTextarea.value = result.textareaValue;
		this.drafts.set(this.stubService.getActiveSessionId(), result.textareaValue);
	}

	private submitDraft(): void {
		if (this.composerPolicy === 'turnEdit') {
			this.saveTurnEdit();
			return;
		}
		if (this.composerPolicy === 'queueEdit') {
			this.saveQueueEdit();
			return;
		}
		if (this.modelSelectedIndex === 0) {
			return;
		}
		const text = this.dockTextarea.value.trim();
		if (!text) {
			return;
		}
		const sessionId = this.stubService.getActiveSessionId();
		const lease = this.sessionViewLease ?? this.stubService.acquireSessionView(sessionId);
		const outcome = lease.post({ kind: 'submitInput', text });
		if (!outcome.accepted) {
			this.showPostFailure(outcome.reason);
			return;
		}
		this.drafts.set(sessionId, '');
		this.dockTextarea.value = '';
		this.resetInputHistoryBrowse();
	}

	private saveTurnEdit(): void {
		const text = this.dockTextarea.value.trim();
		if (!text || !this.editingTurnId) {
			return;
		}
		const sessionId = this.stubService.getActiveSessionId();
		const turnId = this.editingTurnId;
		this.exitComposerEdit();
		this.stubService.updateUserTurnText(sessionId, turnId, text);
	}

	private saveQueueEdit(): void {
		const text = this.dockTextarea.value.trim();
		const item = this.getEditingQueueItem();
		if (!text || !item || text === item.content) {
			return;
		}
		const sessionId = this.stubService.getActiveSessionId();
		const itemId = item.id;
		this.exitComposerEdit(true, false);
		this.stubService.updateMessageQueueItemContent(sessionId, itemId, text);
		this.stubService.releaseMessageQueueItemHold(sessionId, itemId);
		this.renderInboxStatus();
	}
}
