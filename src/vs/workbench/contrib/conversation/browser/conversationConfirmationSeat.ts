/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { $, append } from '../../../../../base/browser/dom.js';
import { Button } from '../../../../../base/browser/ui/button/button.js';
import { Disposable } from '../../../../../base/common/lifecycle.js';
import { localize } from '../../../../../nls.js';
import { defaultButtonStyles } from '../../../../../platform/theme/browser/defaultStyles.js';
import { ConfirmationStatus } from './conversationStubModel.js';

export interface IConversationConfirmationSeatOptions {
	readonly message: string;
	readonly status: ConfirmationStatus;
	readonly onAllow?: () => void;
	readonly onSkip?: () => void;
}

/**
 * Timeline confirmation seat copied from contrib/chat confirmation chrome
 * (Allow / Skip, pending summary, Input needed). Not ChatConfirmationWidget:
 * no IChatModel, no engine, no Copilot setup.
 */
export class ConversationConfirmationSeat extends Disposable {

	readonly element: HTMLElement;

	constructor(options: IConversationConfirmationSeatOptions) {
		super();

		const isPending = options.status === 'pending';

		this.element = $('.conversation-lens-confirmation-seat');
		this.element.setAttribute('role', 'group');
		this.element.setAttribute('aria-label', localize('conversationLens.confirmationSeat', "Confirmation"));

		const summary = append(this.element, $('.conversation-lens-confirmation-summary'));
		const pendingLabel = append(summary, $('span.conversation-lens-confirmation-pending'));
		if (isPending) {
			pendingLabel.textContent = localize('conversationLens.confirmationPending', "1 confirmation pending");
			append(summary, $('span.conversation-lens-input-needed')).textContent = localize('conversationLens.inputNeeded', "Input needed");
		} else if (options.status === 'allowed') {
			pendingLabel.textContent = localize('conversationLens.confirmationAllowed', "Allowed");
		} else {
			pendingLabel.textContent = localize('conversationLens.confirmationSkipped', "Skipped");
		}

		append(this.element, $('p.conversation-lens-confirmation-message')).textContent = options.message;

		if (isPending && options.onAllow && options.onSkip) {
			const actions = append(this.element, $('.conversation-lens-confirmation-actions'));
			const allow = this._register(new Button(actions, defaultButtonStyles));
			allow.label = localize('conversationLens.allow', "Allow");
			this._register(allow.onDidClick(() => options.onAllow!()));

			const skip = this._register(new Button(actions, { ...defaultButtonStyles, secondary: true }));
			skip.label = localize('conversationLens.skip', "Skip");
			this._register(skip.onDidClick(() => options.onSkip!()));
		}
	}
}
