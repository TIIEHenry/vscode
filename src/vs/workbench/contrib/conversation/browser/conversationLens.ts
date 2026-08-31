/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, clearNode, reset } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { AnchorAlignment } from '../../../../base/browser/ui/contextview/contextview.js';
import { SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { AnchorPosition } from '../../../../base/common/layout.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextViewService, IOpenContextView } from '../../../../platform/contextview/browser/contextView.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
import { defaultButtonStyles, defaultSelectBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { hasNativeContextMenu } from '../../../../platform/window/common/window.js';
import { IConversationLensSlots } from '../../../browser/parts/conversation/conversationPart.js';
import { ConversationConfirmationSeat } from './conversationConfirmationSeat.js';
import {
	conversationLensDockAttachTitle,
	conversationLensDockEngineNotConnected,
	conversationLensDockInboxNoQueue,
	conversationLensDockMaximizeInput,
	conversationLensDockNoAttachments,
	conversationLensDockNoModel,
	conversationLensDockRestoreTimeline,
	conversationLensDockStop,
	conversationLensDockStopNotGenerating,
	conversationLensInputMaximizedClass,
} from './conversationLensDockStrings.js';
import { conversationLensSessionBarDeleteSession, conversationLensSessionBarHistoryTitle, conversationLensSessionBarNewSession, conversationLensSessionBarNoHistory, conversationLensSessionBarRenameInputAria, conversationLensSessionBarRenameTitle } from './conversationLensSessionBarStrings.js';
import { ConversationStubTurn } from './conversationStubModel.js';
import { IConversationStubService } from './conversationStubService.js';
import { shouldRenderTurnAsMarkdown } from './conversationTurnMarkdown.js';

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
	private historyButton!: Button;
	private historyContextView: IOpenContextView | undefined;
	private timelineScroll!: HTMLElement;
	private timelineContent!: HTMLElement;
	private inboxStatus!: HTMLButtonElement;
	private stopButton!: Button;
	private dockTextarea!: HTMLTextAreaElement;
	private sendButton!: Button;
	private attachButton!: Button;
	private attachContextView: IOpenContextView | undefined;
	private maximizeInputButton!: Button;

	private readonly slotHosts: IConversationLensSlots;
	private inputMaximized = false;

	private readonly drafts = new Map<string, string>();
	private readonly confirmationSeats = new Map<string, ConversationConfirmationSeat>();
	private readonly turnBodyDisposables = this._register(new DisposableStore());
	private suppressSessionSelect = false;

	constructor(
		slots: IConversationLensSlots,
		@IConversationStubService private readonly stubService: IConversationStubService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IMarkdownRendererService private readonly markdownRendererService: IMarkdownRendererService,
	) {
		super();

		this.slotHosts = slots;

		this.mountSessionBar(slots.sessionBar);
		this.mountTimeline(slots.timeline);
		this.mountDock(slots.dock);

		this.renderTimeline();
		this.updateSessionTitle();
		this.renderInboxStatus();

		this._register(this.stubService.onDidChangeActiveSession(sessionId => this.applyActiveSession(sessionId)));
		this._register(this.stubService.onDidChangeSession(sessionId => {
			this.refreshSessionSelectOptions();
			if (this.shouldRefreshActiveSessionChrome(sessionId)) {
				if (!this.sessionTitleEditing) {
					this.updateSessionTitle();
				}
				this.renderTimeline();
				this.renderInboxStatus();
			}
		}));

		this._register(toDisposable(() => {
			this.historyContextView?.close();
			this.attachContextView?.close();
			for (const seat of this.confirmationSeats.values()) {
				seat.dispose();
			}
			this.confirmationSeats.clear();
			reset(slots.sessionBar);
			reset(slots.timeline);
			reset(slots.dock);
		}));
	}

	isInputMaximized(): boolean {
		return this.inputMaximized;
	}

	setInputMaximized(maximized: boolean): void {
		if (this.inputMaximized === maximized) {
			return;
		}
		this.inputMaximized = maximized;
		for (const host of [this.slotHosts.timeline, this.slotHosts.dock]) {
			host.classList.toggle(conversationLensInputMaximizedClass, maximized);
		}
		this.updateMaximizeInputButton();
	}

	private toggleInputMaximized(): void {
		this.setInputMaximized(!this.inputMaximized);
	}

	private updateMaximizeInputButton(): void {
		const label = this.inputMaximized ? conversationLensDockRestoreTimeline : conversationLensDockMaximizeInput;
		this.maximizeInputButton.label = label;
		this.maximizeInputButton.element.setAttribute('aria-pressed', String(this.inputMaximized));
	}

	private mountSessionBar(host: HTMLElement): void {
		const bar = append(host, $('.conversation-lens-session-bar'));
		bar.setAttribute('role', 'banner');

		const leading = append(bar, $('.conversation-lens-session-bar-leading'));
		append(leading, ThemeIcon.asCSSSelector(Codicon.commentDiscussion)).classList.add('conversation-lens-session-icon');
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

		const historyContainer = append(controls, $('.conversation-lens-session-history'));
		this.historyButton = this._register(new Button(historyContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: conversationLensSessionBarHistoryTitle,
		}));
		this.historyButton.icon = Codicon.history;
		this._register(this.historyButton.onDidClick(() => this.toggleHistoryContextView()));

		this._register(this.sessionSelectBox.onDidSelect(e => {
			if (this.suppressSessionSelect) {
				return;
			}
			const session = this.stubService.getSessions()[e.index];
			if (!session) {
				return;
			}
			const previousId = this.stubService.getActiveSessionId();
			if (previousId !== session.id) {
				this.drafts.set(previousId, this.dockTextarea.value);
				this.stubService.switchSession(session.id);
			}
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
		const timeline = append(host, $('.conversation-lens-timeline'));
		timeline.setAttribute('role', 'log');
		timeline.setAttribute('aria-label', localize('conversationLens.timeline', "Conversation timeline"));

		this.timelineScroll = append(timeline, $('.conversation-lens-timeline-scroll'));
		this.timelineContent = append(this.timelineScroll, $('.conversation-lens-timeline-content'));
	}

	private mountDock(host: HTMLElement): void {
		const dock = append(host, $('.conversation-lens-dock'));

		const gateRow = append(dock, $('.conversation-lens-dock-gate-row'));
		gateRow.setAttribute('role', 'status');
		gateRow.setAttribute('aria-label', conversationLensDockEngineNotConnected);
		append(gateRow, $('span.conversation-lens-dock-gate-label')).textContent = conversationLensDockEngineNotConnected;

		const inboxRow = append(dock, $('.conversation-lens-inbox-row'));
		inboxRow.setAttribute('role', 'status');
		inboxRow.setAttribute('aria-label', localize('conversationLens.inbox', "Inbox"));
		append(inboxRow, $('span.conversation-lens-inbox-label')).textContent = localize('conversationLens.inboxLabel', "Inbox");
		append(inboxRow, $('span.conversation-lens-inbox-queue')).textContent = conversationLensDockInboxNoQueue;
		const stopContainer = append(inboxRow, $('.conversation-lens-inbox-stop'));
		this.stopButton = this._register(new Button(stopContainer, {
			...defaultButtonStyles,
			small: true,
			secondary: true,
			disabled: true,
			title: conversationLensDockStopNotGenerating,
		}));
		this.stopButton.label = conversationLensDockStop;
		this.stopButton.element.classList.add('conversation-lens-inbox-stop-button');
		this.stopButton.setAriaLabel(`${conversationLensDockStop}, ${conversationLensDockStopNotGenerating}`);
		this.inboxStatus = append(inboxRow, $('button.conversation-lens-inbox-pending')) as HTMLButtonElement;
		this.inboxStatus.type = 'button';
		this.inboxStatus.hidden = true;
		this._register(addDisposableListener(this.inboxStatus, 'click', () => this.scrollToFirstPendingConfirmation()));

		const composer = append(dock, $('.conversation-lens-composer'));
		const inputRow = append(composer, $('.conversation-lens-dock-input-row'));

		this.dockTextarea = append(inputRow, $('textarea.conversation-lens-dock-input')) as HTMLTextAreaElement;
		this.dockTextarea.setAttribute('aria-label', localize('conversationLens.dockInput', "Message"));
		this.dockTextarea.placeholder = localize('conversationLens.dockPlaceholder', "Ask anything…");
		this.dockTextarea.rows = 1;

		const bottomBar = append(composer, $('.conversation-lens-dock-bottom-bar'));
		const bottomLeading = append(bottomBar, $('.conversation-lens-dock-bottom-leading'));
		const attachContainer = append(bottomLeading, $('.conversation-lens-dock-attach'));
		this.attachButton = this._register(new Button(attachContainer, {
			...defaultButtonStyles,
			supportIcons: true,
			small: true,
			secondary: true,
			title: conversationLensDockAttachTitle,
		}));
		this.attachButton.icon = Codicon.attach;
		this._register(this.attachButton.onDidClick(() => this.toggleAttachContextView()));

		const maximizeInputContainer = append(bottomLeading, $('.conversation-lens-dock-maximize-input'));
		this.maximizeInputButton = this._register(new Button(maximizeInputContainer, {
			...defaultButtonStyles,
			small: true,
			secondary: true,
			title: conversationLensDockMaximizeInput,
		}));
		this.maximizeInputButton.label = conversationLensDockMaximizeInput;
		this.maximizeInputButton.element.classList.add('conversation-lens-dock-maximize-input-button');
		this.maximizeInputButton.element.setAttribute('aria-pressed', 'false');
		this._register(this.maximizeInputButton.onDidClick(() => this.toggleInputMaximized()));

		const bottomTrailing = append(bottomBar, $('.conversation-lens-dock-bottom-trailing'));
		append(bottomTrailing, $('span.conversation-lens-dock-model')).textContent = conversationLensDockNoModel;

		const actions = append(bottomTrailing, $('.conversation-lens-dock-actions'));
		this.sendButton = this._register(new Button(actions, defaultButtonStyles));
		this.sendButton.label = localize('conversationLens.send', "Send");

		this._register(addDisposableListener(this.dockTextarea, 'keydown', e => {
			if (e.keyCode === KeyCode.Enter && !e.shiftKey) {
				e.preventDefault();
				this.submitDraft();
			}
		}));
		this._register(this.sendButton.onDidClick(() => this.submitDraft()));
		this._register(addDisposableListener(this.dockTextarea, 'input', () => {
			this.drafts.set(this.stubService.getActiveSessionId(), this.dockTextarea.value);
		}));
	}

	private toggleAttachContextView(): void {
		if (this.attachContextView) {
			this.attachContextView.close();
			return;
		}
		this.attachContextView = this.contextViewService.showContextView({
			getAnchor: () => this.attachButton.element,
			anchorAlignment: AnchorAlignment.RIGHT,
			anchorPosition: AnchorPosition.ABOVE,
			render: container => {
				append(container, $('.conversation-lens-dock-attach-popup')).textContent = conversationLensDockNoAttachments;
				return toDisposable(() => {
					this.attachContextView = undefined;
				});
			},
			onDOMEvent: e => {
				if (e.type === 'click') {
					const target = e.target as HTMLElement | null;
					if (target && !this.attachButton.element.contains(target)) {
						this.attachContextView?.close();
					}
				}
			},
			onHide: () => {
				this.attachContextView = undefined;
			},
		});
	}

	private toggleHistoryContextView(): void {
		if (this.historyContextView) {
			this.historyContextView.close();
			return;
		}
		this.historyContextView = this.contextViewService.showContextView({
			getAnchor: () => this.historyButton.element,
			anchorAlignment: AnchorAlignment.RIGHT,
			anchorPosition: AnchorPosition.BELOW,
			render: container => {
				append(container, $('.conversation-lens-session-history-popup')).textContent = conversationLensSessionBarNoHistory;
				return toDisposable(() => {
					this.historyContextView = undefined;
				});
			},
			onDOMEvent: e => {
				if (e.type === 'click') {
					const target = e.target as HTMLElement | null;
					if (target && !this.historyButton.element.contains(target)) {
						this.historyContextView?.close();
					}
				}
			},
			onHide: () => {
				this.historyContextView = undefined;
			},
		});
	}

	private createNewSession(): void {
		const previousId = this.stubService.getActiveSessionId();
		this.drafts.set(previousId, this.dockTextarea.value);
		this.stubService.createSession();
	}

	private deleteActiveSession(): void {
		const sessionId = this.stubService.getActiveSessionId();
		this.drafts.delete(sessionId);
		this.stubService.deleteSession(sessionId);
	}

	private applyActiveSession(sessionId: string): void {
		this.refreshSessionSelectOptions();
		this.updateSessionTitle();
		this.dockTextarea.value = this.drafts.get(sessionId) ?? '';
		this.renderTimeline();
		this.renderInboxStatus();
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
		const pending = this.stubService.countPendingConfirmations(this.stubService.getActiveSessionId());
		if (pending > 0) {
			this.inboxStatus.hidden = false;
			this.inboxStatus.textContent = pending === 1
				? localize('conversationLens.inboxOnePending', "1 confirmation pending")
				: localize('conversationLens.inboxManyPending', "{0} confirmations pending", pending);
		} else {
			this.inboxStatus.hidden = true;
			this.inboxStatus.textContent = '';
		}
	}

	private scrollToFirstPendingConfirmation(): void {
		if (this.inputMaximized) {
			this.setInputMaximized(false);
		}
		const pending = this.stubService.getTurns(this.stubService.getActiveSessionId())
			.find(t => t.kind === 'confirmation' && t.status === 'pending');
		if (!pending) {
			return;
		}
		const seat = this.confirmationSeats.get(pending.id);
		seat?.element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
	}

	private renderTimeline(): void {
		for (const seat of this.confirmationSeats.values()) {
			seat.dispose();
		}
		this.confirmationSeats.clear();
		this.turnBodyDisposables.clear();
		clearNode(this.timelineContent);

		const turns = this.stubService.getTurns(this.stubService.getActiveSessionId());
		if (turns.length === 0) {
			const empty = append(this.timelineContent, $('.conversation-lens-timeline-empty'));
			append(empty, $('p.conversation-lens-timeline-empty-title')).textContent =
				localize('conversationLens.timelineEmptyTitle', "No messages yet");
			append(empty, $('p.conversation-lens-timeline-empty-hint')).textContent =
				localize('conversationLens.timelineEmptyHint', "Send a message below to start this session.");
			return;
		}

		for (const turn of turns) {
			this.timelineContent.appendChild(this.createTurnElement(turn));
		}
	}

	private createTurnElement(turn: ConversationStubTurn): HTMLElement {
		if (turn.kind === 'confirmation') {
			const seat = new ConversationConfirmationSeat({
				message: turn.text,
				status: turn.status ?? 'pending',
				onAllow: turn.status === 'pending'
					? () => this.resolveConfirmation(turn.id, 'allowed')
					: undefined,
				onSkip: turn.status === 'pending'
					? () => this.resolveConfirmation(turn.id, 'skipped')
					: undefined,
			});
			seat.element.setAttribute('data-turn-id', turn.id);
			seat.element.classList.add('conversation-lens-turn');
			seat.element.setAttribute('data-kind', turn.kind);
			this.confirmationSeats.set(turn.id, seat);
			return seat.element;
		}

		const el = $('div.conversation-lens-turn');
		el.setAttribute('data-kind', turn.kind);
		el.setAttribute('data-turn-id', turn.id);
		if (turn.stubEcho) {
			el.setAttribute('data-stub', 'true');
		}

		const header = append(el, $('.conversation-lens-turn-header'));
		header.textContent = turn.kind === 'user'
			? localize('conversationLens.turnYou', "You")
			: localize('conversationLens.turnAgent', "Agent");

		const body = append(el, $('.conversation-lens-turn-body'));
		if (shouldRenderTurnAsMarkdown(turn.kind)) {
			this.turnBodyDisposables.add(this.markdownRendererService.render(
				new MarkdownString(turn.text),
				undefined,
				body,
			));
		} else {
			body.textContent = turn.text;
		}

		return el;
	}

	private resolveConfirmation(turnId: string, status: 'allowed' | 'skipped'): void {
		this.stubService.resolveConfirmation(this.stubService.getActiveSessionId(), turnId, status);
	}

	private submitDraft(): void {
		const text = this.dockTextarea.value.trim();
		if (!text) {
			return;
		}
		const sessionId = this.stubService.getActiveSessionId();
		this.stubService.appendUserTurn(sessionId, text);
		this.stubService.appendStubEchoAssistant(sessionId, localize('conversationLens.stubEcho', "Stub echo — no engine connected."));
		this.drafts.set(sessionId, '');
		this.dockTextarea.value = '';
	}
}
