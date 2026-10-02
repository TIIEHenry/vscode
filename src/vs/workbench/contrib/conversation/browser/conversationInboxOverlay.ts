/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, reset } from '../../../../base/browser/dom.js';
import { Button, ButtonWithIcon } from '../../../../base/browser/ui/button/button.js';
import { renderIcon } from '../../../../base/browser/ui/iconLabel/iconLabels.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import { onUnexpectedError } from '../../../../base/common/errors.js';
import { AnchorPosition } from '../../../../base/common/layout.js';
import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { format } from '../../../../base/common/strings.js';
import { localize } from '../../../../nls.js';
import { IContextViewService, IOpenContextView } from '../../../../platform/contextview/browser/contextView.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import {
	conversationLensDockGoal,
	conversationLensDockGoalPlaceholder,
	conversationLensDockGoalPrompt,
	conversationLensDockGoalUnavailable,
	conversationLensDockInboxNoQueue,
	conversationLensDockInboxQueueNotListed,
	conversationLensDockInboxQueueLabel,
	conversationLensDockNoGoal,
	conversationLensDockStop,
	conversationLensDockStopGenerating,
	conversationLensDockStopNotGenerating,
	conversationLensInboxQueueClear,
	conversationLensInboxQueueQueuedTag,
	conversationLensInboxQueueEditingCount,
	conversationLensInboxQueueEditingTag,
	conversationLensInboxQueueEnqueue,
	conversationLensInboxQueueEnqueuePlaceholder,
	conversationLensInboxQueueEnqueuePrompt,
	conversationLensInboxQueueEnqueueUnavailable,
	conversationLensInboxQueueFailedCount,
	conversationLensInboxQueueFailedTag,
	conversationLensInboxQueueRetry,
	conversationLensInboxQueueRetryUnavailable,
	conversationLensInboxQueuePause,
	conversationLensInboxQueueResume,
	conversationLensInboxQueueSummaryEditing,
	conversationLensInboxQueueSummaryFailed,
	conversationLensInboxQueueSummaryUploading,
	conversationLensInboxQueueUploadingCount,
	conversationLensInboxQueueUploadingTag,
	type ConversationComposerPostFailureReason,
} from './conversationLensDockStrings.js';
import {
	ConversationMessageQueueItem,
	ConversationMessageQueueState,
	conversationMessageQueueHeadline,
	createEmptyMessageQueueState,
} from './conversationMessageQueueModel.js';
import { IUniverseAgentConnection } from '../../../../platform/universeAgent/common/universeAgentConnection.js';
import { IConversationRosterService } from './conversationStubService.js';
import { shouldAutoRevealPendingConfirmation } from './conversationPendingSeat.js';
import { isConversationPairingHold } from './conversationSessionStatus.js';
import { conversationUserBodyText } from './conversationComposerRefs.js';

export const conversationLensInboxOverlayClass = 'conversation-lens-inbox-overlay';

type InboxListPanel = 'queue';

export interface IConversationInboxOverlayDelegate {
	onQueueItemHold(itemId: string): void;
	onScrollToPendingConfirmation(): void;
	showPostFailure(reason: ConversationComposerPostFailureReason): void;
	/** Visible timeline projection, not `getTurns()` (legacy turns drop streaming rows). */
	hasStreamingEntry(): boolean;
}

/**
 * Active-phase Inbox: left Task · MessageQueue · Goal, right Stop · ctx.
 * Task and MessageQueue lists are XOR; queue rows follow Singularity message-queue-bar semantics.
 */
export class ConversationInboxOverlay extends Disposable {

	readonly element: HTMLElement;

	private readonly leftCluster: HTMLElement;
	private readonly rightCluster: HTMLElement;
	private readonly queueChip!: HTMLButtonElement;
	private readonly goalButton!: ButtonWithIcon;
	private readonly stopButton!: Button;
	private readonly pendingButton!: HTMLButtonElement;
	private readonly syncStatus!: HTMLElement;

	private openPanel: InboxListPanel | undefined;
	private listContextView: IOpenContextView | undefined;
	private listPanelHost: HTMLElement | undefined;

	constructor(
		parent: HTMLElement,
		private readonly delegate: IConversationInboxOverlayDelegate,
		private readonly getSessionId: (() => string | undefined) | undefined,
		@IConversationRosterService private readonly stubService: IConversationRosterService,
		@IUniverseAgentConnection private readonly uaConnection: IUniverseAgentConnection,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IQuickInputService private readonly quickInputService: IQuickInputService,
	) {
		super();

		this.element = append(parent, $(`.${conversationLensInboxOverlayClass}`));
		this.element.setAttribute('role', 'group');
		this.element.setAttribute('aria-label', localize('conversationLens.inbox', "Inbox"));

		this.leftCluster = append(this.element, $('.conversation-lens-inbox-left'));
		this.rightCluster = append(this.element, $('.conversation-lens-inbox-right'));

		this.queueChip = append(this.leftCluster, $('button.conversation-lens-inbox-chip.conversation-lens-inbox-queue')) as HTMLButtonElement;
		this.queueChip.type = 'button';
		this._register(addDisposableListener(this.queueChip, 'click', () => {
			if (this.openPanel === 'queue') {
				this.togglePanel('queue');
				return;
			}
			const queueState = this.displayQueueState(this.resolveSessionId());
			if (!this.queueListCanOpen(queueState)) {
				return;
			}
			this.togglePanel('queue');
		}));

		const goalContainer = append(this.leftCluster, $('.conversation-lens-inbox-goal'));
		this.goalButton = this._register(new ButtonWithIcon(goalContainer, {
			...defaultButtonStyles,
			small: true,
			secondary: true,
			disabled: true,
			title: conversationLensDockNoGoal,
		}));
		this.goalButton.icon = Codicon.target;
		this.goalButton.iconElement.setAttribute('aria-hidden', 'true');
		this.goalButton.element.classList.add('conversation-lens-inbox-chip', 'conversation-lens-inbox-goal-button');
		this.goalButton.setAriaLabel(`${conversationLensDockGoal}, ${conversationLensDockNoGoal}`);
		this._register(this.goalButton.onDidClick(() => void this.onGoalClicked().catch(onUnexpectedError).catch(onUnexpectedError)));

		this.pendingButton = append(this.leftCluster, $('button.conversation-lens-inbox-pending')) as HTMLButtonElement;
		this.pendingButton.type = 'button';
		this.pendingButton.hidden = true;
		this._register(addDisposableListener(this.pendingButton, 'click', () => {
			if (!shouldAutoRevealPendingConfirmation(this.uaConnection)) {
				return;
			}
			this.delegate.onScrollToPendingConfirmation();
		}));

		this.syncStatus = append(this.leftCluster, $('span.conversation-lens-inbox-sync'));
		this.syncStatus.hidden = true;
		this.syncStatus.setAttribute('aria-live', 'polite');

		const stopContainer = append(this.rightCluster, $('.conversation-lens-inbox-stop'));
		this.stopButton = this._register(new Button(stopContainer, {
			...defaultButtonStyles,
			small: true,
			secondary: true,
			disabled: true,
			title: conversationLensDockStopNotGenerating,
		}));
		this.stopButton.label = conversationLensDockStop;
		this.stopButton.element.classList.add('conversation-lens-inbox-chip', 'conversation-lens-inbox-stop-button');
		this.stopButton.setAriaLabel(`${conversationLensDockStop}, ${conversationLensDockStopNotGenerating}`);
		this._register(this.stopButton.onDidClick(() => this.onStopClicked()));

		this._register(this.stubService.onDidChangeEngineConnection(() => this.render()));
		this._register(this.stubService.onDidChangeSession(() => this.render()));
		this._register(this.stubService.onDidChangeActiveSession(sessionId => {
			const bound = this.getSessionId?.();
			if (this.getSessionId && bound && bound !== sessionId) {
				this.closeListPanel();
				return;
			}
			this.render();
		}));
		this._register(this.uaConnection.onDidChangeConnection(() => this.render()));
		this._register(toDisposable(() => this.closeListPanel()));

		this.render();
	}

	closeListPanel(): void {
		this.listContextView?.close();
	}

	private resolveSessionId(): string {
		if (this.getSessionId) {
			return this.getSessionId() ?? '';
		}
		return this.stubService.getActiveSessionId();
	}

	render(): void {
		const sessionId = this.resolveSessionId();
		const queueState = this.displayQueueState(sessionId);
		const pendingConfirmations = this.stubService.countPendingConfirmations(sessionId);

		this.renderQueueChip(queueState);
		this.renderPending(pendingConfirmations);
		this.renderSyncStatus(this.stubService.getSessionSync(sessionId));
		this.renderGoal(sessionId);
		this.renderStop(sessionId);

		if (this.openPanel && this.listContextView) {
			this.refreshOpenListPanel();
		}
	}

	private renderSyncStatus(_sync: ReturnType<IConversationRosterService['getSessionSync']>): void {
		this.syncStatus.hidden = true;
		this.syncStatus.textContent = '';
		this.syncStatus.removeAttribute('aria-label');
	}

	private isEngineQueueUnlisted(): boolean {
		// D373 leftover-looks-live: pairing-hold first. Live "not listed" is not
		// only `connected || history` — leftover-looks-live uses leftover chrome.
		if (isConversationPairingHold(this.uaConnection)) {
			return !this.stubService.isEngineConnected() && this.stubService.hasEngineConnectionHistory();
		}
		return this.stubService.isEngineConnected() || this.stubService.hasEngineConnectionHistory();
	}

	private displayQueueState(sessionId: string): ConversationMessageQueueState {
		if (this.isEngineQueueUnlisted()) {
			return createEmptyMessageQueueState();
		}
		return this.stubService.getMessageQueueState(sessionId);
	}

	private queueEmptyCopy(): string {
		return this.isEngineQueueUnlisted()
			? conversationLensDockInboxQueueNotListed
			: conversationLensDockInboxNoQueue;
	}

	private renderQueueChip(queueState: ConversationMessageQueueState): void {
		const total = queueState.items.length;
		const label = this.formatQueueHeadline(queueState, 'chip');
		reset(this.queueChip);
		const icon = append(this.queueChip, renderIcon(Codicon.listOrdered));
		icon.classList.add('conversation-lens-inbox-chip-icon');
		icon.setAttribute('aria-hidden', 'true');
		const meta = append(this.queueChip, $('span.conversation-lens-inbox-chip-meta'));
		meta.textContent = label;
		if (total === 0) {
			this.queueChip.setAttribute('data-queue-empty', 'true');
		} else {
			this.queueChip.removeAttribute('data-queue-empty');
		}
		const accessible = `${conversationLensDockInboxQueueLabel}, ${label}`;
		this.queueChip.setAttribute('aria-label', accessible);
		this.queueChip.title = accessible;
		const canOpen = this.queueListCanOpen(queueState) || this.openPanel === 'queue';
		this.queueChip.setAttribute('aria-disabled', String(!canOpen));
		this.queueChip.setAttribute('aria-pressed', canOpen ? String(this.openPanel === 'queue') : 'false');
	}

	/** No rows and Enqueue unavailable: the chip already shows the status. */
	private queueListCanOpen(queueState: ConversationMessageQueueState): boolean {
		return queueState.items.length > 0 || this.isEnqueueOffered();
	}

	private isEnqueueOffered(): boolean {
		return !isConversationPairingHold(this.uaConnection)
			&& !this.isKeepLeftoverListFailWrite()
			&& (this.stubService.isEngineConnected() || this.stubService.hasEngineConnectionHistory());
	}

	/** KEEP leftover list-fail (D451): connected but roster not ready is not a live Inbox write surface. */
	private isKeepLeftoverListFailWrite(): boolean {
		return this.stubService.isEngineConnected()
			&& this.stubService.isEngineSessionReady?.() === false;
	}

	private isGenerating(_sessionId: string): boolean {
		// D373 leftover-looks-live: pairing-hold first. Streaming leftover is not live generating.
		// D451 KEEP leftover list-fail: leftover streaming is not live Stop.
		return !isConversationPairingHold(this.uaConnection)
			&& this.stubService.isEngineConnected()
			&& !this.isKeepLeftoverListFailWrite()
			&& this.delegate.hasStreamingEntry();
	}

	private isSessionGoalAvailable(): boolean {
		return !isConversationPairingHold(this.uaConnection)
			&& this.stubService.isEngineConnected()
			&& !this.isKeepLeftoverListFailWrite()
			&& typeof this.uaConnection.setSessionGoal === 'function';
	}

	private renderGoal(sessionId: string): void {
		const goal = this.stubService.getSessionGoal(sessionId)?.trim();
		const label = goal || conversationLensDockNoGoal;
		const available = this.isSessionGoalAvailable();
		this.goalButton.enabled = available;
		this.goalButton.label = goal ?? '';
		if (goal) {
			this.goalButton.element.removeAttribute('data-goal-empty');
		} else {
			this.goalButton.element.setAttribute('data-goal-empty', 'true');
		}
		if (available) {
			this.goalButton.setTitle(label);
			this.goalButton.setAriaLabel(`${conversationLensDockGoal}, ${label}`);
		} else {
			this.goalButton.setTitle(conversationLensDockGoalUnavailable);
			this.goalButton.setAriaLabel(`${conversationLensDockGoal} — ${conversationLensDockGoalUnavailable}`);
		}
	}

	private async onGoalClicked(): Promise<void> {
		if (isConversationPairingHold(this.uaConnection) || this.isKeepLeftoverListFailWrite() || !this.isSessionGoalAvailable()) {
			return;
		}
		if (!this.stubService.isEngineConnected()) {
			if (this.stubService.hasEngineConnectionHistory()) {
				this.delegate.showPostFailure('engine_disconnected');
			}
			return;
		}
		const sessionId = this.resolveSessionId();
		const current = this.stubService.getSessionGoal(sessionId);
		const next = await this.quickInputService.input({
			title: conversationLensDockGoal,
			prompt: conversationLensDockGoalPrompt,
			placeHolder: conversationLensDockGoalPlaceholder,
			value: current,
		});
		if (next === undefined) {
			return;
		}
		if (this.resolveSessionId() !== sessionId) {
			return;
		}
		if (isConversationPairingHold(this.uaConnection) || this.isKeepLeftoverListFailWrite()) {
			return;
		}
		const trimmed = next.trim();
		// Same text is not a write. The roster returns false for that, and this path would show it as a send failure.
		if (trimmed === (current?.trim() ?? '')) {
			return;
		}
		let applied = true;
		if (trimmed) {
			applied = this.stubService.setSessionGoal(sessionId, trimmed);
		} else if (current) {
			applied = this.stubService.cancelSessionGoal(sessionId);
		}
		if (!applied) {
			this.delegate.showPostFailure(
				!this.stubService.isEngineConnected() && this.stubService.hasEngineConnectionHistory()
					? 'engine_disconnected'
					: 'failed'
			);
			return;
		}
		this.render();
	}

	private renderStop(sessionId: string): void {
		const generating = this.isGenerating(sessionId)
			&& !isConversationPairingHold(this.uaConnection)
			&& !this.isKeepLeftoverListFailWrite();
		this.stopButton.enabled = generating;
		if (generating) {
			this.stopButton.setTitle(conversationLensDockStop);
			this.stopButton.setAriaLabel(`${conversationLensDockStop}, ${conversationLensDockStopGenerating}`);
		} else {
			this.stopButton.setTitle(conversationLensDockStopNotGenerating);
			this.stopButton.setAriaLabel(`${conversationLensDockStop}, ${conversationLensDockStopNotGenerating}`);
		}
	}

	private onStopClicked(): void {
		if (isConversationPairingHold(this.uaConnection) || this.isKeepLeftoverListFailWrite()) {
			return;
		}
		const sessionId = this.resolveSessionId();
		if (!this.isGenerating(sessionId) && !this.stopButton.enabled) {
			return;
		}
		const cancelled = this.stubService.cancelGeneration(sessionId);
		if (!cancelled) {
			this.delegate.showPostFailure(
				!this.stubService.isEngineConnected() && this.stubService.hasEngineConnectionHistory()
					? 'engine_disconnected'
					: 'failed'
			);
		}
	}

	private renderPending(pending: number): void {
		if (pending > 0) {
			this.pendingButton.hidden = false;
			const label = pending === 1
				? localize('conversationLens.inboxOnePending', "1 confirmation pending")
				: localize('conversationLens.inboxManyPending', "{0} confirmations pending", pending);
			this.pendingButton.textContent = label;
			this.pendingButton.setAttribute('aria-label', label);
			const enabled = shouldAutoRevealPendingConfirmation(this.uaConnection);
			this.pendingButton.disabled = !enabled;
			this.pendingButton.setAttribute('aria-disabled', String(!enabled));
			if (!enabled) {
				this.pendingButton.title = localize('conversationLens.inboxPendingPairingHold', "Confirmations are paused until pairing finishes.");
			} else {
				this.pendingButton.removeAttribute('title');
			}
		} else {
			this.pendingButton.hidden = true;
			this.pendingButton.disabled = false;
			this.pendingButton.textContent = '';
			this.pendingButton.removeAttribute('aria-label');
			this.pendingButton.removeAttribute('aria-disabled');
			this.pendingButton.removeAttribute('title');
		}
	}

	private togglePanel(panel: InboxListPanel): void {
		if (this.openPanel === panel && this.listContextView) {
			this.listContextView.close();
			return;
		}
		this.listContextView?.close();
		// close()/onHide clears openPanel; assign the next panel after that wipe.
		this.openPanel = panel;
		const anchor = this.element;
		this.listContextView = this.contextViewService.showContextView({
			getAnchor: () => anchor,
			anchorAlignment: AnchorAlignment.LEFT,
			anchorPosition: AnchorPosition.ABOVE,
			render: container => {
				const listRoot = append(container, $('.conversation-lens-inbox-list-panel'));
				const columnWidth = Math.round(this.element.getBoundingClientRect().width);
				if (columnWidth > 0) {
					listRoot.style.width = `${columnWidth}px`;
				}
				this.listPanelHost = listRoot;
				this.renderQueueList(listRoot);
				this.render();
				return toDisposable(() => {
					this.listPanelHost = undefined;
					this.listContextView = undefined;
					this.openPanel = undefined;
					this.render();
				});
			},
			onDOMEvent: e => {
				if (e.type === 'click') {
					const target = e.target as HTMLElement | null;
					if (target && !this.element.contains(target) && !target.closest('.context-view')) {
						this.listContextView?.close();
					}
				}
			},
			onHide: () => {
				this.listPanelHost = undefined;
				this.listContextView = undefined;
				this.openPanel = undefined;
				this.render();
			},
		});
	}

	private refreshOpenListPanel(): void {
		const panel = this.openPanel;
		const host = this.listPanelHost;
		if (!panel || !host) {
			return;
		}
		reset(host);
		this.renderQueueList(host);
	}

	private renderQueueList(host: HTMLElement): void {
		const sessionId = this.resolveSessionId();
		const state = this.displayQueueState(sessionId);
		const listRoot = append(host, $('.conversation-lens-inbox-list.conversation-lens-message-queue-list'));
		listRoot.setAttribute('role', 'list');
		if (state.items.length === 0) {
			listRoot.classList.add('conversation-lens-message-queue-list--empty');
			listRoot.removeAttribute('role');
		}

		const header = append(listRoot, $('.queue-bar-header'));
		const summary = append(header, $('span.queue-bar-summary'));
		summary.textContent = this.formatQueueSummary(state);
		if (state.items.length === 0) {
			summary.classList.add('conversation-lens-inbox-list-empty');
		}

		const actions = append(header, $('.queue-bar-header-actions'));
		if (state.items.length > 0) {
			if (state.isPaused) {
				const resumeButton = append(actions, $('button.queue-bar-action')) as HTMLButtonElement;
				resumeButton.type = 'button';
				resumeButton.textContent = conversationLensInboxQueueResume;
				this.bindLeftoverQueueWrite(resumeButton, () => this.stubService.resumeMessageQueue(this.resolveSessionId()));
			} else {
				const pauseButton = append(actions, $('button.queue-bar-action')) as HTMLButtonElement;
				pauseButton.type = 'button';
				pauseButton.textContent = conversationLensInboxQueuePause;
				this.bindLeftoverQueueWrite(pauseButton, () => this.stubService.pauseMessageQueue(this.resolveSessionId()));
			}

			const clearButton = append(actions, $('button.queue-bar-action.conversation-lens-inbox-queue-clear')) as HTMLButtonElement;
			clearButton.type = 'button';
			clearButton.textContent = conversationLensInboxQueueClear;
			this.bindLeftoverQueueWrite(clearButton, () => this.stubService.clearMessageQueue(this.resolveSessionId()));
		}

		this.renderEnqueueAction(actions);

		if (state.items.length === 0) {
			return;
		}

		const body = append(listRoot, $('.queue-bar-body'));

		for (const item of state.items) {
			body.appendChild(this.renderQueueItem(item));
		}
	}

	private isLeftoverQueueWriteLive(): boolean {
		return !isConversationPairingHold(this.uaConnection)
			&& this.stubService.isEngineConnected()
			&& !this.isKeepLeftoverListFailWrite();
	}

	private bindLeftoverQueueWrite(button: HTMLButtonElement, run: () => void): void {
		const enabled = this.isLeftoverQueueWriteLive();
		button.disabled = !enabled;
		button.setAttribute('aria-disabled', String(!enabled));
		addDisposableListener(button, 'click', () => {
			if (!this.isLeftoverQueueWriteLive()) {
				return;
			}
			run();
			this.render();
			this.refreshOpenListPanel();
		});
	}

	private renderEnqueueAction(actions: HTMLElement): void {
		const enqueueButton = append(actions, $('button.queue-bar-action.conversation-lens-inbox-queue-enqueue')) as HTMLButtonElement;
		enqueueButton.type = 'button';
		enqueueButton.textContent = conversationLensInboxQueueEnqueue;
		const enabled = this.isEnqueueOffered();
		enqueueButton.disabled = !enabled;
		enqueueButton.setAttribute('aria-disabled', String(!enabled));
		enqueueButton.title = enabled ? conversationLensInboxQueueEnqueue : conversationLensInboxQueueEnqueueUnavailable;
		enqueueButton.setAttribute('aria-label', enqueueButton.title);
		addDisposableListener(enqueueButton, 'click', () => {
			void this.onEnqueueClicked().catch(onUnexpectedError).catch(onUnexpectedError);
		});
	}

	private shouldRejectEnqueueWrite(): boolean {
		if (isConversationPairingHold(this.uaConnection) || this.isKeepLeftoverListFailWrite()) {
			return true;
		}
		if (!this.stubService.isEngineConnected()) {
			if (this.stubService.hasEngineConnectionHistory()) {
				this.delegate.showPostFailure('engine_disconnected');
			}
			return true;
		}
		return false;
	}

	private async onEnqueueClicked(): Promise<void> {
		if (this.shouldRejectEnqueueWrite()) {
			return;
		}
		const sessionId = this.resolveSessionId();
		const next = await this.quickInputService.input({
			title: conversationLensInboxQueueEnqueue,
			prompt: conversationLensInboxQueueEnqueuePrompt,
			placeHolder: conversationLensInboxQueueEnqueuePlaceholder,
		});
		if (next === undefined) {
			return;
		}
		if (this.resolveSessionId() !== sessionId) {
			return;
		}
		if (this.shouldRejectEnqueueWrite()) {
			return;
		}
		const queued = this.stubService.enqueueMessageQueueItem(sessionId, next.trim());
		if (!queued) {
			this.delegate.showPostFailure(
				!this.stubService.isEngineConnected() && this.stubService.hasEngineConnectionHistory()
					? 'engine_disconnected'
					: 'failed'
			);
			return;
		}
		this.render();
		this.refreshOpenListPanel();
	}

	private formatQueueHeadline(state: ConversationMessageQueueState, surface: 'chip' | 'summary'): string {
		const headline = conversationMessageQueueHeadline(state);
		switch (headline.kind) {
			case 'empty':
				return this.queueEmptyCopy();
			case 'sending':
				return surface === 'chip'
					? localize('conversationLens.inboxQueueSending', "Sending…")
					: localize('conversationLens.inboxQueueSummarySending', "Sending…");
			case 'paused':
				return surface === 'chip'
					? localize('conversationLens.inboxQueuePaused', "{0} paused", headline.count)
					: localize('conversationLens.inboxQueueSummaryPaused', "{0} messages paused", headline.count);
			case 'queued':
				return surface === 'chip'
					? localize('conversationLens.inboxQueueCount', "{0} queued", headline.count)
					: localize('conversationLens.inboxQueueSummaryQueued', "{0} messages queued", headline.count);
			case 'failed':
				return surface === 'chip'
					? format(conversationLensInboxQueueFailedCount, headline.count)
					: format(conversationLensInboxQueueSummaryFailed, headline.count);
			case 'editing':
				if (headline.count === 1) {
					return conversationLensInboxQueueEditingTag;
				}
				return surface === 'chip'
					? format(conversationLensInboxQueueEditingCount, headline.count)
					: format(conversationLensInboxQueueSummaryEditing, headline.count);
			case 'uploading':
				if (headline.percent !== undefined) {
					return format(conversationLensInboxQueueUploadingTag, headline.percent);
				}
				return surface === 'chip'
					? format(conversationLensInboxQueueUploadingCount, headline.count)
					: format(conversationLensInboxQueueSummaryUploading, headline.count);
		}
	}

	private formatQueueSummary(state: ConversationMessageQueueState): string {
		return this.formatQueueHeadline(state, 'summary');
	}

	private renderQueueItem(item: ConversationMessageQueueItem): HTMLElement {
		const row = $('div.queue-item');
		row.setAttribute('role', 'listitem');
		row.setAttribute('data-item-id', item.id);
		if (item.hold === 'EDITING') {
			row.classList.add('hold-editing');
		}
		if (item.status === 'FAILED') {
			row.classList.add('queue-failed');
		} else if (item.status === 'UPLOAD_FAILED') {
			row.classList.add('upload-failed');
		}
		if (item.status === 'UPLOADING') {
			row.classList.add('uploading');
		}
		if (item.pinned) {
			row.classList.add('pinned');
		}
		if (item.locked) {
			row.classList.add('lock-checkpoint');
		}

		const main = append(row, $('.queue-item-main'));
		const itemBody = append(main, $('.queue-item-body'));
		append(itemBody, $('.queue-item-preview')).textContent = conversationUserBodyText(item.content);
		const meta = append(itemBody, $('.queue-item-meta'));
		const appendMetaSep = () => {
			if (meta.childNodes.length > 0) {
				meta.appendChild(document.createTextNode(' · '));
			}
		};
		// Queued is only a waiting PENDING row. Other statuses already have their own tag.
		if (item.status === 'PENDING' && item.hold !== 'EDITING') {
			meta.appendChild(document.createTextNode(conversationLensInboxQueueQueuedTag));
		}
		if (item.status === 'SENDING') {
			meta.appendChild(document.createTextNode(localize('conversationLens.inboxQueueSending', "Sending…")));
		}
		if (item.hold === 'EDITING') {
			appendMetaSep();
			const tag = append(meta, $('span.tag.hold'));
			tag.textContent = conversationLensInboxQueueEditingTag;
		}
		if (item.status === 'UPLOADING') {
			appendMetaSep();
			const tag = append(meta, $('span.tag.upload'));
			const pct = item.uploadProgress !== undefined ? Math.round(item.uploadProgress * 100) : 0;
			tag.textContent = format(conversationLensInboxQueueUploadingTag, pct);
		}
		if (item.status === 'FAILED' || item.status === 'UPLOAD_FAILED') {
			meta.classList.add('failed');
			appendMetaSep();
			meta.appendChild(document.createTextNode(`✗ ${item.lastError ?? conversationLensInboxQueueFailedTag}`));
			row.appendChild(this.renderQueueRetryAction(item));
		}

		addDisposableListener(row, 'click', () => {
			if (isConversationPairingHold(this.uaConnection)) {
				return;
			}
			if (item.hold !== 'EDITING') {
				this.stubService.holdMessageQueueItem(this.resolveSessionId(), item.id, 'EDITING');
				this.delegate.onQueueItemHold(item.id);
				this.render();
				this.refreshOpenListPanel();
			}
		});

		return row;
	}

	private renderQueueRetryAction(item: ConversationMessageQueueItem): HTMLButtonElement {
		const retryButton = $('button.queue-bar-action.conversation-lens-inbox-queue-retry') as HTMLButtonElement;
		retryButton.type = 'button';
		retryButton.textContent = conversationLensInboxQueueRetry;
		const connected = !isConversationPairingHold(this.uaConnection) && this.stubService.isEngineConnected();
		retryButton.disabled = !connected;
		retryButton.setAttribute('aria-disabled', String(!connected));
		retryButton.title = connected ? conversationLensInboxQueueRetry : conversationLensInboxQueueRetryUnavailable;
		retryButton.setAttribute('aria-label', retryButton.title);
		addDisposableListener(retryButton, 'click', e => {
			e.stopPropagation();
			void this.onQueueRetryClicked(this.resolveSessionId(), item);
		});
		return retryButton;
	}

	private onQueueRetryClicked(sessionId: string, item: ConversationMessageQueueItem): void {
		if (isConversationPairingHold(this.uaConnection) || !this.stubService.isEngineConnected()) {
			return;
		}
		const retried = this.stubService.retryMessageQueueItem(sessionId, item.id, {
			upload: item.status === 'UPLOAD_FAILED',
		});
		if (!retried) {
			this.delegate.showPostFailure(
				!this.stubService.isEngineConnected() && this.stubService.hasEngineConnectionHistory()
					? 'engine_disconnected'
					: 'failed'
			);
			return;
		}
		this.render();
		this.refreshOpenListPanel();
	}
}
