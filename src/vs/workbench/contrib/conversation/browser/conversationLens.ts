/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, clearNode, reset } from '../../../../base/browser/dom.js';
import { Button } from '../../../../base/browser/ui/button/button.js';
import { SelectBox } from '../../../../base/browser/ui/selectBox/selectBox.js';
import { KeyCode } from '../../../../base/common/keyCodes.js';
import { Codicon } from '../../../../base/common/codicons.js';
import { MarkdownString } from '../../../../base/common/htmlContent.js';
import { Disposable, DisposableStore, toDisposable } from '../../../../base/common/lifecycle.js';
import { ThemeIcon } from '../../../../base/common/themables.js';
import { localize } from '../../../../nls.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextViewService } from '../../../../platform/contextview/browser/contextView.js';
import { IMarkdownRendererService } from '../../../../platform/markdown/browser/markdownRenderer.js';
import { defaultButtonStyles, defaultSelectBoxStyles } from '../../../../platform/theme/browser/defaultStyles.js';
import { hasNativeContextMenu } from '../../../../platform/window/common/window.js';
import { IConversationLensSlots } from '../../../browser/parts/conversation/conversationPart.js';
import { ConversationConfirmationSeat } from './conversationConfirmationSeat.js';
import {
	conversationLensDockEngineNotConnected,
	conversationLensDockInboxNoQueue,
	conversationLensDockNoModel,
} from './conversationLensDockStrings.js';
import { conversationLensSessionBarNewSession } from './conversationLensSessionBarStrings.js';
import { ConversationStubTurn } from './conversationStubModel.js';
import { IConversationStubService } from './conversationStubService.js';
import { shouldRenderTurnAsMarkdown } from './conversationTurnMarkdown.js';

/**
 * Product Conversation lens: SessionBar + stub timeline + local dock, mounted
 * into {@link IConversationLensSlots}. Not ChatEditor / ChatViewPane.
 */
export class ConversationLens extends Disposable {

	private sessionTitle!: HTMLElement;
	private sessionSelectBox!: SelectBox;
	private sessionSelectContainer!: HTMLElement;
	private newSessionButton!: Button;
	private timelineScroll!: HTMLElement;
	private timelineContent!: HTMLElement;
	private inboxStatus!: HTMLButtonElement;
	private dockTextarea!: HTMLTextAreaElement;
	private sendButton!: Button;

	private readonly drafts = new Map<string, string>();
	private readonly confirmationSeats = new Map<string, ConversationConfirmationSeat>();
	private readonly turnBodyDisposables = this._register(new DisposableStore());
	private suppressSessionSelect = false;

	constructor(
		_slots: IConversationLensSlots,
		@IConversationStubService private readonly stubService: IConversationStubService,
		@IContextViewService private readonly contextViewService: IContextViewService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IMarkdownRendererService private readonly markdownRendererService: IMarkdownRendererService,
	) {
		super();

		this.mountSessionBar(_slots.sessionBar);
		this.mountTimeline(_slots.timeline);
		this.mountDock(_slots.dock);

		this.renderTimeline();
		this.updateSessionTitle();
		this.renderInboxStatus();

		this._register(this.stubService.onDidChangeActiveSession(sessionId => this.applyActiveSession(sessionId)));
		this._register(this.stubService.onDidChangeSession(sessionId => {
			if (sessionId === this.stubService.getActiveSessionId()) {
				this.renderTimeline();
				this.renderInboxStatus();
			}
		}));

		this._register(toDisposable(() => {
			for (const seat of this.confirmationSeats.values()) {
				seat.dispose();
			}
			this.confirmationSeats.clear();
			reset(_slots.sessionBar);
			reset(_slots.timeline);
			reset(_slots.dock);
		}));
	}

	private mountSessionBar(host: HTMLElement): void {
		const bar = append(host, $('.conversation-lens-session-bar'));
		bar.setAttribute('role', 'banner');

		const leading = append(bar, $('.conversation-lens-session-bar-leading'));
		append(leading, ThemeIcon.asCSSSelector(Codicon.commentDiscussion)).classList.add('conversation-lens-session-icon');
		this.sessionTitle = append(leading, $('span.conversation-lens-session-title'));

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
		append(bottomBar, $('.conversation-lens-dock-bottom-leading'));

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

	private createNewSession(): void {
		const previousId = this.stubService.getActiveSessionId();
		this.drafts.set(previousId, this.dockTextarea.value);
		this.stubService.createSession();
	}

	private applyActiveSession(sessionId: string): void {
		this.refreshSessionSelectOptions();
		this.updateSessionTitle();
		this.dockTextarea.value = this.drafts.get(sessionId) ?? '';
		this.renderTimeline();
		this.renderInboxStatus();
	}

	private updateSessionTitle(): void {
		this.sessionTitle.textContent = this.stubService.getActiveSession().title;
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
