/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, reset } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import { AnchorPosition } from '../../../../base/common/layout.js';
import { Disposable, toDisposable } from '../../../../base/common/lifecycle.js';
import { localize } from '../../../../nls.js';
import { IContextViewService, IOpenContextView } from '../../../../platform/contextview/browser/contextView.js';
import { IQuickInputService } from '../../../../platform/quickinput/common/quickInput.js';
import { defaultButtonStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import {
	conversationLensDockGoal,
	conversationLensDockGoalPlaceholder,
	conversationLensDockGoalPrompt,
	conversationLensDockInboxNoQueue,
	conversationLensDockInboxQueueNotListed,
	conversationLensDockInboxNoTasks,
	conversationLensDockInboxQueueLabel,
	conversationLensDockInboxTaskLabel,
	conversationLensDockNoGoal,
	conversationLensDockStop,
	conversationLensDockStopGenerating,
	conversationLensDockStopNotGenerating,
	conversationLensInboxQueueClear,
	conversationLensInboxQueueEditingTag,
	conversationLensInboxQueueEnqueue,
	conversationLensInboxQueueEnqueuePlaceholder,
	conversationLensInboxQueueEnqueuePrompt,
	conversationLensInboxQueueEnqueueUnavailable,
	conversationLensInboxQueueFailedTag,
	conversationLensInboxQueueRetry,
	conversationLensInboxQueueRetryUnavailable,
	conversationLensInboxQueuePause,
	conversationLensInboxQueueResume,
	conversationLensInboxQueueUploadingTag,
	type ConversationComposerPostFailureReason,
} from './conversationLensDockStrings.js';
import {
	ConversationMessageQueueItem,
	ConversationMessageQueueState,
	conversationMessageQueuePendingCount,
	createEmptyMessageQueueState,
} from './conversationMessageQueueModel.js';
import { IConversationRosterService } from './conversationStubService.js';
import { formatSyncChromeLabel } from './conversationSessionView.js';

export const conversationLensInboxOverlayClass = 'conversation-lens-inbox-overlay';

type InboxListPanel = 'task' | 'queue';

export interface IConversationInboxOverlayDelegate {
	onQueueItemHold(itemId: string): void;
	onScrollToPendingConfirmation(): void;
	showPostFailure(reason: ConversationComposerPostFailureReason): void;
}

/**
 * Active-phase Inbox: left Task · MessageQueue · Goal, right Stop · ctx.
 * Task and MessageQueue lists are XOR; queue rows follow Singularity message-queue-bar semantics.
 */
export class ConversationInboxOverlay extends Disposable {

	readonly element: HTMLElement;

	private readonly leftCluster: HTMLElement;
	private readonly rightCluster: HTMLElement;
	private readonly taskChip!: HTMLButtonElement;
	private readonly queueChip!: HTMLButtonElement;
	private readonly goalButton!: Button;
	private readonly stopButton!: Button;
	private readonly pendingButton!: HTMLButtonElement;
	private readonly syncStatus!: HTMLElement;

	private openPanel: InboxListPanel | undefined;
	private listContextView: IOpenContextView | undefined;
	private listPanelHost: HTMLElement | undefined;

	constructor(
		parent: HTMLElement,
		private readonly delegate: IConversationInboxOverlayDelegate,
		@IConversationRosterService private readonly stubService: IConversationRosterService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IQuickInputService private readonly quickInputService: IQuickInputService,
	) {
		super();

		this.element = append(parent, $(`.${conversationLensInboxOverlayClass}`));
		this.element.setAttribute('role', 'group');
		this.element.setAttribute('aria-label', localize('conversationLens.inbox', "Inbox"));

		this.leftCluster = append(this.element, $('.conversation-lens-inbox-left'));
		this.rightCluster = append(this.element, $('.conversation-lens-inbox-right'));

		this.taskChip = append(this.leftCluster, $('button.conversation-lens-inbox-chip.conversation-lens-inbox-task')) as HTMLButtonElement;
		this.taskChip.type = 'button';
		this._register(addDisposableListener(this.taskChip, 'click', () => this.togglePanel('task')));

		this.queueChip = append(this.leftCluster, $('button.conversation-lens-inbox-chip.conversation-lens-inbox-queue')) as HTMLButtonElement;
		this.queueChip.type = 'button';
		this._register(addDisposableListener(this.queueChip, 'click', () => this.togglePanel('queue')));

		const goalContainer = append(this.leftCluster, $('.conversation-lens-inbox-goal'));
		this.goalButton = this._register(new Button(goalContainer, {
			...defaultButtonStyles,
			small: true,
			secondary: true,
			disabled: true,
			title: conversationLensDockNoGoal,
		}));
		this.goalButton.label = conversationLensDockNoGoal;
		this.goalButton.element.classList.add('conversation-lens-inbox-chip', 'conversation-lens-inbox-goal-button');
		this.goalButton.setAriaLabel(`${conversationLensDockGoal}, ${conversationLensDockNoGoal}`);
		this._register(this.goalButton.onDidClick(() => void this.onGoalClicked()));

		this.pendingButton = append(this.leftCluster, $('button.conversation-lens-inbox-pending')) as HTMLButtonElement;
		this.pendingButton.type = 'button';
		this.pendingButton.hidden = true;
		this._register(addDisposableListener(this.pendingButton, 'click', () => this.delegate.onScrollToPendingConfirmation()));

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

		const noContextUsage = localize('conversationLens.inboxNoContextUsage', "No context usage");
		const contextRing = append(this.rightCluster, $('span.conversation-lens-inbox-context-ring'));
		contextRing.setAttribute('role', 'img');
		contextRing.setAttribute('aria-label', noContextUsage);
		contextRing.title = noContextUsage;

		this._register(this.stubService.onDidChangeEngineConnection(() => this.render()));
		this._register(this.stubService.onDidChangeSession(() => this.render()));
		this._register(toDisposable(() => this.closeListPanel()));

		this.render();
	}

	closeListPanel(): void {
		this.listContextView?.close();
	}

	render(): void {
		const sessionId = this.stubService.getActiveSessionId();
		const queueState = this.displayQueueState(sessionId);
		const taskCount = this.stubService.getAutoDriveTaskCount(sessionId);
		const pendingConfirmations = this.stubService.countPendingConfirmations(sessionId);

		this.renderTaskChip(taskCount);
		this.renderQueueChip(queueState);
		this.renderPending(pendingConfirmations);
		this.renderSyncStatus(this.stubService.getSessionSync(sessionId));
		this.renderGoal(sessionId);
		this.renderStop(sessionId);

		if (this.openPanel && this.listContextView) {
			this.refreshOpenListPanel();
		}
	}

	private renderSyncStatus(sync: ReturnType<IConversationRosterService['getSessionSync']>): void {
		const label = formatSyncChromeLabel(sync);
		if (label) {
			this.syncStatus.hidden = false;
			this.syncStatus.textContent = label;
			this.syncStatus.setAttribute('aria-label', label);
		} else {
			this.syncStatus.hidden = true;
			this.syncStatus.textContent = '';
			this.syncStatus.removeAttribute('aria-label');
		}
	}

	private renderTaskChip(taskCount: number): void {
		const label = taskCount > 0
			? localize('conversationLens.inboxTaskCount', "{0} tasks", taskCount)
			: conversationLensDockInboxNoTasks;
		this.taskChip.textContent = `${conversationLensDockInboxTaskLabel} · ${label}`;
		this.taskChip.setAttribute('aria-label', `${conversationLensDockInboxTaskLabel}, ${label}`);
		this.taskChip.setAttribute('aria-pressed', String(this.openPanel === 'task'));
	}

	private isEngineQueueUnlisted(): boolean {
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
		const pending = conversationMessageQueuePendingCount(queueState);
		const total = queueState.items.length;
		let label: string;
		if (total === 0) {
			label = this.queueEmptyCopy();
		} else if (queueState.isPaused) {
			label = localize('conversationLens.inboxQueuePaused', "{0} paused", total);
		} else if (queueState.isProcessing) {
			label = localize('conversationLens.inboxQueueSending', "Sending…");
		} else {
			label = localize('conversationLens.inboxQueueCount', "{0} queued", pending || total);
		}
		this.queueChip.textContent = `${conversationLensDockInboxQueueLabel} · ${label}`;
		this.queueChip.setAttribute('aria-label', `${conversationLensDockInboxQueueLabel}, ${label}`);
		this.queueChip.setAttribute('aria-pressed', String(this.openPanel === 'queue'));
	}

	private isGenerating(sessionId: string): boolean {
		return this.stubService.isEngineConnected() && this.stubService.getTurns(sessionId).some(turn => turn.streaming);
	}

	private renderGoal(sessionId: string): void {
		const connected = this.stubService.isEngineConnected();
		const goal = this.stubService.getSessionGoal(sessionId)?.trim();
		const label = goal || conversationLensDockNoGoal;
		this.goalButton.enabled = connected;
		this.goalButton.label = label;
		this.goalButton.setTitle(label);
		this.goalButton.setAriaLabel(`${conversationLensDockGoal}, ${label}`);
	}

	private async onGoalClicked(): Promise<void> {
		if (!this.stubService.isEngineConnected()) {
			return;
		}
		const sessionId = this.stubService.getActiveSessionId();
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
		const trimmed = next.trim();
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
		const generating = this.isGenerating(sessionId);
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
		const sessionId = this.stubService.getActiveSessionId();
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
		} else {
			this.pendingButton.hidden = true;
			this.pendingButton.textContent = '';
			this.pendingButton.removeAttribute('aria-label');
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
		const anchor = panel === 'task' ? this.taskChip : this.queueChip;
		this.listContextView = this.contextViewService.showContextView({
			getAnchor: () => anchor,
			anchorAlignment: AnchorAlignment.LEFT,
			anchorPosition: AnchorPosition.ABOVE,
			render: container => {
				const listRoot = append(container, $('.conversation-lens-inbox-list-panel'));
				this.listPanelHost = listRoot;
				if (panel === 'task') {
					this.renderTaskList(listRoot);
				} else {
					this.renderQueueList(listRoot);
				}
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
		if (panel === 'task') {
			this.renderTaskList(host);
		} else {
			this.renderQueueList(host);
		}
	}

	private renderTaskList(host: HTMLElement): void {
		const sessionId = this.stubService.getActiveSessionId();
		const tasks = this.stubService.getAutoDriveTasks(sessionId);
		const list = append(host, $('.conversation-lens-inbox-list.conversation-lens-inbox-task-list'));
		list.setAttribute('role', 'list');
		if (tasks.length === 0) {
			append(list, $('.conversation-lens-inbox-list-empty')).textContent = conversationLensDockInboxNoTasks;
			return;
		}
		for (const task of tasks) {
			const row = append(list, $('.conversation-lens-inbox-list-item'));
			row.setAttribute('role', 'listitem');
			row.textContent = task;
		}
	}

	private renderQueueList(host: HTMLElement): void {
		const sessionId = this.stubService.getActiveSessionId();
		const state = this.displayQueueState(sessionId);
		const listRoot = append(host, $('.conversation-lens-inbox-list.conversation-lens-message-queue-list'));
		listRoot.setAttribute('role', 'list');

		const header = append(listRoot, $('.queue-bar-header'));
		const summary = append(header, $('span.queue-bar-summary'));
		summary.textContent = this.formatQueueSummary(state);

		const actions = append(header, $('.queue-bar-header-actions'));
		if (state.items.length > 0) {
			if (state.isPaused) {
				const resumeButton = append(actions, $('button.queue-bar-action')) as HTMLButtonElement;
				resumeButton.type = 'button';
				resumeButton.textContent = conversationLensInboxQueueResume;
				addDisposableListener(resumeButton, 'click', () => {
					this.stubService.resumeMessageQueue(sessionId);
					this.render();
					this.refreshOpenListPanel();
				});
			} else {
				const pauseButton = append(actions, $('button.queue-bar-action')) as HTMLButtonElement;
				pauseButton.type = 'button';
				pauseButton.textContent = conversationLensInboxQueuePause;
				addDisposableListener(pauseButton, 'click', () => {
					this.stubService.pauseMessageQueue(sessionId);
					this.render();
					this.refreshOpenListPanel();
				});
			}

			const clearButton = append(actions, $('button.queue-bar-action')) as HTMLButtonElement;
			clearButton.type = 'button';
			clearButton.textContent = conversationLensInboxQueueClear;
			addDisposableListener(clearButton, 'click', () => {
				this.stubService.clearMessageQueue(sessionId);
				this.render();
				this.refreshOpenListPanel();
			});
		}

		this.renderEnqueueAction(actions);

		const body = append(listRoot, $('.queue-bar-body'));
		if (state.items.length === 0) {
			append(body, $('.conversation-lens-inbox-list-empty')).textContent = this.queueEmptyCopy();
			return;
		}

		for (const item of state.items) {
			body.appendChild(this.renderQueueItem(sessionId, item));
		}
	}

	private renderEnqueueAction(actions: HTMLElement): void {
		const enqueueButton = append(actions, $('button.queue-bar-action.conversation-lens-inbox-queue-enqueue')) as HTMLButtonElement;
		enqueueButton.type = 'button';
		enqueueButton.textContent = conversationLensInboxQueueEnqueue;
		const connected = this.stubService.isEngineConnected();
		enqueueButton.disabled = !connected;
		enqueueButton.setAttribute('aria-disabled', String(!connected));
		enqueueButton.title = connected ? conversationLensInboxQueueEnqueue : conversationLensInboxQueueEnqueueUnavailable;
		enqueueButton.setAttribute('aria-label', enqueueButton.title);
		addDisposableListener(enqueueButton, 'click', () => {
			void this.onEnqueueClicked();
		});
	}

	private async onEnqueueClicked(): Promise<void> {
		if (!this.stubService.isEngineConnected()) {
			return;
		}
		const sessionId = this.stubService.getActiveSessionId();
		const next = await this.quickInputService.input({
			title: conversationLensInboxQueueEnqueue,
			prompt: conversationLensInboxQueueEnqueuePrompt,
			placeHolder: conversationLensInboxQueueEnqueuePlaceholder,
		});
		if (next === undefined) {
			return;
		}
		const queued = this.stubService.enqueueMessageQueueItem(sessionId, next.trim());
		if (!queued) {
			return;
		}
		this.render();
		this.refreshOpenListPanel();
	}

	private formatQueueSummary(state: ConversationMessageQueueState): string {
		const count = state.items.length;
		if (count === 0) {
			return this.queueEmptyCopy();
		}
		if (state.isProcessing) {
			return localize('conversationLens.inboxQueueSummarySending', "Sending…");
		}
		if (state.isPaused) {
			return localize('conversationLens.inboxQueueSummaryPaused', "{0} messages paused", count);
		}
		return localize('conversationLens.inboxQueueSummaryQueued', "{0} messages queued", count);
	}

	private renderQueueItem(sessionId: string, item: ConversationMessageQueueItem): HTMLElement {
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
		append(itemBody, $('.queue-item-preview')).textContent = item.content;
		const meta = append(itemBody, $('.queue-item-meta'));
		meta.appendChild(document.createTextNode('queued'));
		if (item.hold === 'EDITING') {
			meta.appendChild(document.createTextNode(' · '));
			const tag = append(meta, $('span.tag.hold'));
			tag.textContent = conversationLensInboxQueueEditingTag;
		}
		if (item.status === 'UPLOADING') {
			meta.appendChild(document.createTextNode(' · '));
			const tag = append(meta, $('span.tag.upload'));
			const pct = item.uploadProgress !== undefined ? Math.round(item.uploadProgress * 100) : 0;
			tag.textContent = localize('conversationLens.inboxQueueUploading', conversationLensInboxQueueUploadingTag, pct);
		}
		if (item.status === 'FAILED' || item.status === 'UPLOAD_FAILED') {
			meta.classList.add('failed');
			meta.appendChild(document.createTextNode(' · '));
			meta.appendChild(document.createTextNode(`✗ ${item.lastError ?? conversationLensInboxQueueFailedTag}`));
			row.appendChild(this.renderQueueRetryAction(sessionId, item));
		}

		addDisposableListener(row, 'click', () => {
			if (item.hold !== 'EDITING') {
				this.stubService.holdMessageQueueItem(sessionId, item.id, 'EDITING');
				this.delegate.onQueueItemHold(item.id);
				this.render();
				this.refreshOpenListPanel();
			}
		});

		return row;
	}

	private renderQueueRetryAction(sessionId: string, item: ConversationMessageQueueItem): HTMLButtonElement {
		const retryButton = $('button.queue-bar-action.conversation-lens-inbox-queue-retry') as HTMLButtonElement;
		retryButton.type = 'button';
		retryButton.textContent = conversationLensInboxQueueRetry;
		const connected = this.stubService.isEngineConnected();
		retryButton.disabled = !connected;
		retryButton.setAttribute('aria-disabled', String(!connected));
		retryButton.title = connected ? conversationLensInboxQueueRetry : conversationLensInboxQueueRetryUnavailable;
		retryButton.setAttribute('aria-label', retryButton.title);
		addDisposableListener(retryButton, 'click', e => {
			e.stopPropagation();
			void this.onQueueRetryClicked(sessionId, item);
		});
		return retryButton;
	}

	private onQueueRetryClicked(sessionId: string, item: ConversationMessageQueueItem): void {
		if (!this.stubService.isEngineConnected()) {
			return;
		}
		this.stubService.retryMessageQueueItem(sessionId, item.id, {
			upload: item.status === 'UPLOAD_FAILED',
		});
		this.render();
		this.refreshOpenListPanel();
	}
}
