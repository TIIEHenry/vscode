/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, addDisposableListener, append, clearNode, reset } from '../../../../../base/browser/dom.js';
import { Button } from '../../../../../base/browser/ui/button/button.js';
import { KeyCode } from '../../../../../base/common/keyCodes.js';
import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { defaultButtonStyles } from '../../../../../platform/theme/browser/defaultStyles.js';
import { IConversationLensSlots } from '../../../browser/parts/conversation/conversationPart.js';
import { ConversationConfirmationSeat } from './conversationConfirmationSeat.js';
import { ConversationStubTurn } from './conversationStubModel.js';
import { IConversationStubService } from './conversationStubService.js';

/**
 * Product Conversation lens: SessionBar + stub timeline + local dock, mounted
 * into {@link IConversationLensSlots}. Not ChatEditor / ChatViewPane.
 */
export class ConversationLens extends Disposable {

	private readonly sessionTitle: HTMLElement;
	private readonly sessionSelect: HTMLSelectElement;
	private readonly timelineScroller: HTMLElement;
	private readonly timelineContent: HTMLElement;
	private readonly inboxStatus: HTMLElement;
	private readonly dockTextarea: HTMLTextAreaElement;
	private readonly sendButton: Button;

	private readonly drafts = new Map<string, string>();
	private readonly confirmationSeats = new Map<string, ConversationConfirmationSeat>();

	constructor(
		private readonly slots: IConversationLensSlots,
		@IConversationStubService private readonly stubService: IConversationStubService,
	) {
		super();

		this.mountSessionBar(slots.sessionBar);
		this.mountTimeline(slots.timeline);
		this.mountDock(slots.dock);

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
			reset(slots.sessionBar);
			reset(slots.timeline);
			reset(slots.dock);
		}));
	}

	private mountSessionBar(host: HTMLElement): void {
		const bar = append(host, $('.conversation-lens-session-bar'));
		bar.setAttribute('role', 'banner');

		this.sessionTitle = append(bar, $('span.conversation-lens-session-title'));

		const controls = append(bar, $('.conversation-lens-session-controls'));

		this.sessionSelect = append(controls, $('select.conversation-lens-session-select')) as HTMLSelectElement;
		this.sessionSelect.setAttribute('aria-label', localize('conversationLens.sessionSwitcher', "Switch session"));
		for (const session of this.stubService.getSessions()) {
			const option = append(this.sessionSelect, $('option')) as HTMLOptionElement;
			option.value = session.id;
			option.textContent = session.title;
		}
		this._register(addDisposableListener(this.sessionSelect, 'change', () => {
			const previousId = this.stubService.getActiveSessionId();
			const nextId = this.sessionSelect.value;
			if (previousId !== nextId) {
				this.drafts.set(previousId, this.dockTextarea.value);
				this.stubService.switchSession(nextId);
			}
		}));
	}

	private mountTimeline(host: HTMLElement): void {
		const timeline = append(host, $('.conversation-lens-timeline'));
		timeline.setAttribute('role', 'log');
		timeline.setAttribute('aria-label', localize('conversationLens.timeline', "Conversation timeline"));

		this.timelineScroller = timeline;
		this.timelineContent = append(timeline, $('.conversation-lens-timeline-content'));
	}

	private mountDock(host: HTMLElement): void {
		const dock = append(host, $('.conversation-lens-dock'));

		const inboxRow = append(dock, $('.conversation-lens-inbox-row'));
		inboxRow.setAttribute('role', 'status');
		inboxRow.setAttribute('aria-label', localize('conversationLens.inbox', "Inbox"));
		append(inboxRow, $('span.conversation-lens-inbox-queue')).textContent = localize('conversationLens.inboxNoQueue', "No queue");
		this.inboxStatus = append(inboxRow, $('button.conversation-lens-inbox-pending')) as HTMLButtonElement;
		this.inboxStatus.type = 'button';
		this.inboxStatus.hidden = true;
		this._register(addDisposableListener(this.inboxStatus, 'click', () => this.scrollToFirstPendingConfirmation()));

		const inputRow = append(dock, $('.conversation-lens-dock-row'));

		this.dockTextarea = append(inputRow, $('textarea.conversation-lens-dock-input')) as HTMLTextAreaElement;
		this.dockTextarea.setAttribute('aria-label', localize('conversationLens.dockInput', "Message"));
		this.dockTextarea.placeholder = localize('conversationLens.dockPlaceholder', "Ask anything…");
		this.dockTextarea.rows = 2;

		this.sendButton = this._register(new Button(inputRow, defaultButtonStyles));
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

	private applyActiveSession(sessionId: string): void {
		this.sessionSelect.value = sessionId;
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
		clearNode(this.timelineContent);

		for (const turn of this.stubService.getTurns(this.stubService.getActiveSessionId())) {
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
		el.textContent = turn.text;
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
