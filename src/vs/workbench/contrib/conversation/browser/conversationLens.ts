/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append, reset } from '../../../../../base/browser/dom.js';
import { Disposable, toDisposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { IConversationLensSlots } from '../../../browser/parts/conversation/conversationPart.js';
import { ConversationConfirmationSeat } from './conversationConfirmationSeat.js';

/**
 * Product Conversation lens: SessionBar + stub timeline + stub dock, mounted
 * into {@link IConversationLensSlots}. Not ChatEditor / ChatViewPane.
 */
export class ConversationLens extends Disposable {

	constructor(slots: IConversationLensSlots) {
		super();

		this.mountSessionBar(slots.sessionBar);
		this.mountTimeline(slots.timeline);
		this.mountDock(slots.dock);

		this._register(toDisposable(() => {
			reset(slots.sessionBar);
			reset(slots.timeline);
			reset(slots.dock);
		}));
	}

	private mountSessionBar(host: HTMLElement): void {
		const bar = append(host, $('.conversation-lens-session-bar'));
		bar.setAttribute('role', 'banner');
		append(bar, $('span.conversation-lens-session-title')).textContent = localize('conversationLens.untitledSession', "Untitled session");
	}

	private mountTimeline(host: HTMLElement): void {
		const timeline = append(host, $('.conversation-lens-timeline'));
		timeline.setAttribute('role', 'log');
		timeline.setAttribute('aria-label', localize('conversationLens.timeline', "Conversation timeline"));

		const user = append(timeline, $('.conversation-lens-turn'));
		user.setAttribute('data-role', 'user');
		user.textContent = localize('conversationLens.stubUserTurn', "List the files in this workspace.");

		const assistant = append(timeline, $('.conversation-lens-turn'));
		assistant.setAttribute('data-role', 'assistant');
		assistant.textContent = localize('conversationLens.stubAssistantTurn', "I'll list the workspace files.");

		timeline.appendChild(this._register(new ConversationConfirmationSeat()).element);
	}

	private mountDock(host: HTMLElement): void {
		const dock = append(host, $('.conversation-lens-dock'));
		const input = append(dock, $('.conversation-lens-dock-input'));
		input.setAttribute('role', 'textbox');
		input.setAttribute('aria-readonly', 'true');
		input.setAttribute('aria-label', localize('conversationLens.dockInput', "Message"));
		input.textContent = localize('conversationLens.dockPlaceholder', "Ask anything…");
	}
}
