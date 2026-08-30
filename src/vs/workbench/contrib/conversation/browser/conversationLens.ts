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
import {
	CONVERSATION_STUB_INBOX_ITEMS,
	CONVERSATION_STUB_SESSIONS,
	IConversationStubSession,
	IConversationStubTurn,
} from './conversationStubSessions.js';

/**
 * Product Conversation lens: SessionBar + stub timeline + local dock, mounted
 * into {@link IConversationLensSlots}. Not ChatEditor / ChatViewPane.
 */
export class ConversationLens extends Disposable {

	private readonly sessionTitle: HTMLElement;
	private readonly sessionSelect: HTMLSelectElement;
	private readonly inboxButton: Button;
	private readonly inboxBadge: HTMLElement;
	private readonly timelineContent: HTMLElement;
	private readonly confirmationSeat: ConversationConfirmationSeat;
	private readonly dockTextarea: HTMLTextAreaElement;
	private readonly sendButton: Button;

	private readonly sessionTurns = new Map<string, IConversationStubTurn[]>();
	private readonly drafts = new Map<string, string>();

	private activeSessionId: string;
	private inboxOpen = false;

	constructor(slots: IConversationLensSlots) {
		super();

		const defaultSession = CONVERSATION_STUB_SESSIONS[0];
		this.activeSessionId = defaultSession.id;
		for (const session of CONVERSATION_STUB_SESSIONS) {
			this.sessionTurns.set(session.id, [...session.turns]);
		}

		this.mountSessionBar(slots.sessionBar);
		this.mountTimeline(slots.timeline);
		this.mountDock(slots.dock);

		this.renderTimeline();
		this.updateSessionTitle();

		this._register(toDisposable(() => {
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
		for (const session of CONVERSATION_STUB_SESSIONS) {
			const option = append(this.sessionSelect, $('option')) as HTMLOptionElement;
			option.value = session.id;
			option.textContent = session.title;
		}
		this._register(addDisposableListener(this.sessionSelect, 'change', () => {
			this.switchSession(this.sessionSelect.value);
		}));

		const inboxHost = append(controls, $('.conversation-lens-inbox-host'));
		this.inboxButton = this._register(new Button(inboxHost, defaultButtonStyles));
		this.inboxButton.label = localize('conversationLens.inbox', "Inbox");
		this.inboxBadge = append(inboxHost, $('span.conversation-lens-inbox-badge'));
		this.inboxBadge.textContent = String(CONVERSATION_STUB_INBOX_ITEMS.length);
		this.inboxBadge.setAttribute('aria-label', localize('conversationLens.inboxUnread', "{0} unread", CONVERSATION_STUB_INBOX_ITEMS.length));
		this._register(this.inboxButton.onDidClick(() => {
			if (this.inboxOpen) {
				this.closeInbox();
			} else {
				this.openInbox();
			}
		}));
	}

	private mountTimeline(host: HTMLElement): void {
		const timeline = append(host, $('.conversation-lens-timeline'));
		timeline.setAttribute('role', 'log');
		timeline.setAttribute('aria-label', localize('conversationLens.timeline', "Conversation timeline"));

		this.timelineContent = append(timeline, $('.conversation-lens-timeline-content'));
		this.confirmationSeat = this._register(new ConversationConfirmationSeat());
		timeline.appendChild(this.confirmationSeat.element);
	}

	private mountDock(host: HTMLElement): void {
		const dock = append(host, $('.conversation-lens-dock'));
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
			this.drafts.set(this.activeSessionId, this.dockTextarea.value);
		}));
	}

	private getActiveSession(): IConversationStubSession {
		return CONVERSATION_STUB_SESSIONS.find(s => s.id === this.activeSessionId) ?? CONVERSATION_STUB_SESSIONS[0];
	}

	private switchSession(sessionId: string): void {
		if (this.activeSessionId === sessionId) {
			return;
		}
		this.drafts.set(this.activeSessionId, this.dockTextarea.value);
		this.activeSessionId = sessionId;
		this.sessionSelect.value = sessionId;
		this.updateSessionTitle();
		this.dockTextarea.value = this.drafts.get(sessionId) ?? '';
		if (this.inboxOpen) {
			this.closeInbox();
		} else {
			this.renderTimeline();
		}
	}

	private updateSessionTitle(): void {
		this.sessionTitle.textContent = this.getActiveSession().title;
	}

	private openInbox(): void {
		if (this.inboxOpen) {
			return;
		}
		this.inboxOpen = true;
		this.renderInbox();
		this.confirmationSeat.element.hidden = true;
	}

	private closeInbox(): void {
		if (!this.inboxOpen) {
			return;
		}
		this.inboxOpen = false;
		this.renderTimeline();
		this.confirmationSeat.element.hidden = false;
	}

	private renderTimeline(): void {
		clearNode(this.timelineContent);
		const turns = this.sessionTurns.get(this.activeSessionId) ?? [];
		for (const turn of turns) {
			this.timelineContent.appendChild(this.createTurnElement(turn));
		}
	}

	private renderInbox(): void {
		clearNode(this.timelineContent);
		const panel = append(this.timelineContent, $('.conversation-lens-inbox-panel'));
		panel.setAttribute('role', 'region');
		panel.setAttribute('aria-label', localize('conversationLens.inboxPanel', "Inbox"));

		const header = append(panel, $('.conversation-lens-inbox-header'));
		append(header, $('h3.conversation-lens-inbox-title')).textContent = localize('conversationLens.inbox', "Inbox");
		const closeButton = append(header, $('button.conversation-lens-inbox-close')) as HTMLButtonElement;
		closeButton.type = 'button';
		closeButton.textContent = localize('conversationLens.inboxClose', "Close");
		addDisposableListener(closeButton, 'click', () => this.closeInbox());

		const list = append(panel, $('ul.conversation-lens-inbox-list'));
		for (const item of CONVERSATION_STUB_INBOX_ITEMS) {
			const row = append(list, $('li.conversation-lens-inbox-item'));
			row.textContent = item.title;
		}
	}

	private createTurnElement(turn: IConversationStubTurn): HTMLElement {
		const el = $('div.conversation-lens-turn');
		el.setAttribute('data-role', turn.role);
		if (turn.role === 'tool') {
			const label = append(el, $('span.conversation-lens-tool-label'));
			label.textContent = localize('conversationLens.toolTurn', "Tool");
			append(el, $('span.conversation-lens-turn-text')).textContent = turn.text;
		} else {
			el.textContent = turn.text;
		}
		return el;
	}

	private submitDraft(): void {
		const text = this.dockTextarea.value.trim();
		if (!text) {
			return;
		}
		const turns = this.sessionTurns.get(this.activeSessionId);
		if (!turns) {
			return;
		}
		turns.push({ role: 'user', text });
		this.drafts.set(this.activeSessionId, '');
		this.dockTextarea.value = '';
		if (!this.inboxOpen) {
			this.renderTimeline();
		}
	}
}
